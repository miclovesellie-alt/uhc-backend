const fetch = globalThis.fetch || require("node-fetch");
const Settings = require("../models/Settings");

const SYSTEM_PROMPT_STUDY = `You are the UHC AI Study Assistant & Medical Tutor. You help students, healthcare workers, and learners understand medical concepts, public health, nursing, anatomy, and academic subjects. Keep responses clear, accurate, encouraging, and structured with clean markdown formatting.`;

// ─── Error codes that indicate quota/rate-limit exhaustion ───────────────────
const QUOTA_CODES = [429, 503, 529];

function isQuotaError(status, body) {
  if (QUOTA_CODES.includes(status)) return true;
  const txt = JSON.stringify(body || "").toLowerCase();
  return (
    txt.includes("quota") ||
    txt.includes("rate_limit") ||
    txt.includes("rate limit") ||
    txt.includes("exceeded") ||
    txt.includes("overloaded") ||
    txt.includes("insufficient_quota")
  );
}

// ─── Fetch a setting: env var first, then MongoDB Settings collection ─────────
async function getSettingKey(envKey, dbKey) {
  let val = process.env[envKey];
  if (!val || val === `YOUR_${envKey}`) {
    try {
      const doc = await Settings.findOne({ key: dbKey });
      if (doc && doc.value) val = doc.value;
    } catch (e) {}
  }
  return val || null;
}

// ─── Provider runner helper ───────────────────────────────────────────────────
// Returns: { text, provider } on success, or throws { quotaExhausted: true } on quota error
async function tryGemini(prompt, systemInstruction, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 1200 }
    })
  });
  const data = await res.json();

  if (isQuotaError(res.status, data)) {
    const err = new Error("Gemini quota exhausted");
    err.quotaExhausted = true;
    throw err;
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini: empty response");
  return { text, provider: "Google Gemini" };
}

async function tryGroq(prompt, systemInstruction, apiKey) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1200
    })
  });
  const data = await res.json();

  if (isQuotaError(res.status, data)) {
    const err = new Error("Groq quota exhausted");
    err.quotaExhausted = true;
    throw err;
  }

  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Groq: empty response");
  return { text, provider: "Groq (Llama 3.1)" };
}

async function tryClaude(prompt, systemInstruction, apiKey) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-3-haiku-20240307",
      max_tokens: 1200,
      system: systemInstruction,
      messages: [{ role: "user", content: prompt }]
    })
  });
  const data = await res.json();

  if (isQuotaError(res.status, data)) {
    const err = new Error("Claude quota exhausted");
    err.quotaExhausted = true;
    throw err;
  }

  const text = data.content?.[0]?.text;
  if (!text) throw new Error("Claude: empty response");
  return { text, provider: "Claude (Haiku)" };
}

// ─── Provider display names (used in failover messages) ──────────────────────
const PROVIDER_NAMES = {
  gemini: "Google Gemini",
  groq: "Groq (Llama 3.1)",
  claude: "Claude AI"
};

/**
 * Core engine: cascade through Gemini → Groq → Claude.
 * Returns { text, provider, failoverMessage?, allExhausted? }
 */
async function generateAIResponse(prompt, systemInstruction = SYSTEM_PROMPT_STUDY) {
  const geminiKey = await getSettingKey("GEMINI_API_KEY", "geminiApiKey");
  const groqKey   = await getSettingKey("GROQ_API_KEY",   "groqApiKey");
  const claudeKey = await getSettingKey("CLAUDE_API_KEY", "claudeApiKey");

  const providers = [];
  if (geminiKey) providers.push({ id: "gemini", fn: tryGemini, key: geminiKey });
  if (groqKey)   providers.push({ id: "groq",   fn: tryGroq,   key: groqKey });
  if (claudeKey) providers.push({ id: "claude", fn: tryClaude, key: claudeKey });

  // No providers configured → offline fallback
  if (providers.length === 0) {
    return {
      text: generateOfflineFallback(prompt),
      provider: "UHC Core Engine (Offline)",
      failoverMessage: null,
      allExhausted: false
    };
  }

  let lastExhaustedName = null;
  let failoverMessage   = null;
  let quotaHitCount     = 0;   // how many providers actually hit their rate/quota limit

  for (let i = 0; i < providers.length; i++) {
    const { id, fn, key } = providers[i];
    try {
      const result = await fn(prompt, systemInstruction, key);
      // Build a friendly notice if we had to switch providers due to quota
      if (lastExhaustedName) {
        failoverMessage = `🔄 Your ${lastExhaustedName} tokens ran out — don't worry, we switched you to ${PROVIDER_NAMES[id]} automatically!`;
      }
      return { ...result, failoverMessage, allExhausted: false };
    } catch (err) {
      if (err.quotaExhausted) {
        quotaHitCount++;
        lastExhaustedName = PROVIDER_NAMES[id];
        console.warn(`[AI] ${id} quota exhausted. Trying next provider...`);
      } else {
        // Non-quota error (invalid key, network issue, empty response)
        // Log it and try next, but don't count as quota exhaustion
        console.error(`[AI] ${id} non-quota error:`, err.message);
      }
    }
  }

  // Only show the subscription wall if at least one provider confirmed
  // genuine quota exhaustion AND all configured providers have been tried.
  // If failures were all non-quota (e.g., bad keys), use the offline engine.
  if (quotaHitCount > 0) {
    return {
      text: null,
      provider: null,
      failoverMessage: null,
      allExhausted: true,
      exhaustedMessage: `🚫 All AI engines have reached their free daily limit. Upgrade to UHC Premium for unlimited access, or come back tomorrow when quotas reset!`
    };
  }

  // Fallback: all providers failed for non-quota reasons (bad keys / network)
  return {
    text: generateOfflineFallback(prompt),
    provider: "UHC Core Engine (Offline)",
    failoverMessage: "⚠️ AI engines are currently unavailable. Make sure API keys are configured in Admin Settings.",
    allExhausted: false
  };
}

/**
 * Smart offline response for when no API keys are set
 */
function generateOfflineFallback(prompt) {
  const lower = prompt.toLowerCase();

  if (lower.includes("explain") && (lower.includes("option") || lower.includes("answer"))) {
    return `### 💡 Answer Breakdown\n\n* **Selection Analysis**: Your chosen option was evaluated against standard medical reference material.\n* **Core Concept**: Focus on primary symptoms, mechanisms, and clinical guidelines for this topic.\n* **Study Tip**: Pay attention to option lengths — equal-length options are usually well-balanced.\n\n> 🔑 *Add a free API key in Admin Settings to enable live AI explanations!*`;
  }

  if (lower.includes("shorten") || lower.includes("balance")) {
    return JSON.stringify({
      options: ["Concise Option A", "Concise Option B", "Concise Option C", "Concise Option D"]
    });
  }

  return `### 🤖 UHC AI Study Assistant\n\nThank you for your question!\n\n* **Tip**: Medical success relies on systematic, consistent revision.\n* **Focus**: Prioritise patient safety, evidence-based practice, and standard clinical guidelines.\n\n> 🔑 *Configure a free Gemini or Groq API key in Admin Settings to unlock live AI responses!*`;
}

// ─── Exported service methods ─────────────────────────────────────────────────

/** General chat question */
exports.askAI = async (question) => {
  return await generateAIResponse(question);
};

/** Quiz option explainer */
exports.explainQuizOption = async (questionText, options, selectedIndex, correctIndex) => {
  const selectedText = options[selectedIndex] || "None";
  const correctText  = options[correctIndex]  || "None";
  const isCorrect    = selectedIndex === correctIndex;

  const prompt = `A student answered a quiz question:
Question: "${questionText}"
Option 0: ${options[0]}
Option 1: ${options[1]}
Option 2: ${options[2]}
Option 3: ${options[3]}

Student selected: Option ${selectedIndex} ("${selectedText}") — ${isCorrect ? "CORRECT ✅" : "INCORRECT ❌"}
Correct answer: Option ${correctIndex} ("${correctText}")

Give a concise 3-part markdown breakdown:
1. **${isCorrect ? "Why You Got It Right" : "Why This Was Incorrect"}** — 2 clear sentences.
2. **Correct Concept** — Why Option ${correctIndex} ("${correctText}") is the right medical/academic answer.
3. **Memory Tip** — One bullet-point mnemonic or memory trick for this concept.`;

  return await generateAIResponse(prompt);
};

/** Admin: shorten & balance question options */
exports.shortenAndBalanceOptions = async (questionText, originalOptions, correctAnswerIndex) => {
  const prompt = `You are an expert medical exam designer. This question has unbalanced answer options that make the correct answer predictable.

Question: "${questionText}"
Options:
0: ${originalOptions[0]}
1: ${originalOptions[1]}
2: ${originalOptions[2]}
3: ${originalOptions[3]}
Correct Answer Index: ${correctAnswerIndex}

Rewrite all 4 options to be CONCISE (5–12 words each), equally balanced in length, and all plausible. Keep option ${correctAnswerIndex} as the correct answer.
Return ONLY valid JSON — no markdown, no code fences, no extra text:
{"options": ["Short opt 0","Short opt 1","Short opt 2","Short opt 3"]}`;

  try {
    const res = await generateAIResponse(prompt, "You are a JSON-only API. Output valid JSON with key 'options'.");
    const cleaned = (res.text || "").replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (parsed.options?.length === 4) return parsed.options;
  } catch (e) {
    console.error("[AI] Option shortener parse error:", e.message);
  }
  return originalOptions.map(o => (o.length > 60 ? o.split(/[,.]/)[0].trim() : o));
};

/** Admin: generate quiz questions from study notes */
exports.generateQuestionsFromNotes = async (notesText, count = 3, courseName = "General Health") => {
  const prompt = `You are a medical professor. Read these study notes and generate ${count} well-structured multiple-choice questions for the course "${courseName}".

Study Notes:
"""
${notesText.slice(0, 3000)}
"""

Each question must include:
- "question": string
- "options": array of 4 concise, equally-balanced strings
- "answer": integer (0–3, index of correct option)
- "explanation": brief plain-text explanation

Return ONLY valid JSON — no markdown, no code fences:
{"questions": [...]}`;

  try {
    const res = await generateAIResponse(prompt, "You output strictly valid JSON with key 'questions'.");
    const cleaned = (res.text || "").replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed.questions)) return parsed.questions;
  } catch (e) {
    console.error("[AI] Notes generator parse error:", e.message);
  }
  return [];
};

/** Admin: generate similar questions based on an existing one */
exports.generateSimilarQuestions = async (baseQuestion, options, answerIndex, count = 2) => {
  const prompt = `Given this base question: "${baseQuestion}" (Correct answer: "${options[answerIndex]}"), generate ${count} variation questions testing the same core concept. Each must have 4 short, balanced options.
Return ONLY valid JSON: {"questions": [{"question":"...","options":[...],"answer":0,"explanation":"..."}]}`;

  try {
    const res = await generateAIResponse(prompt, "You output strictly valid JSON.");
    const cleaned = (res.text || "").replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed.questions)) return parsed.questions;
  } catch (e) {
    console.error("[AI] Similar questions parse error:", e.message);
  }
  return [];
};
