const fetch = globalThis.fetch || require("node-fetch");
const Settings = require("../models/Settings");

const SYSTEM_PROMPT_STUDY = `You are the UHC AI Study Assistant & Medical Tutor. You help students, healthcare workers, and learners understand medical concepts, public health, nursing, anatomy, and academic subjects. Keep responses clear, accurate, encouraging, and structured with clean markdown formatting.`;

// Helper to fetch setting from DB if process.env is missing
async function getSettingKey(envKey, dbKey) {
  let val = process.env[envKey];
  if (!val || val === `YOUR_${envKey}`) {
    try {
      const doc = await Settings.findOne({ key: dbKey });
      if (doc && doc.value) val = doc.value;
    } catch (e) {}
  }
  return val;
}

/**
 * Send prompt with automatic multi-AI provider cascading failover.
 * Order: Google Gemini -> Groq (Llama 3) -> Mistral AI -> Hugging Face -> Offline Smart Fallback
 */
async function generateAIResponse(prompt, systemInstruction = SYSTEM_PROMPT_STUDY) {
  const geminiApiKey = await getSettingKey("GEMINI_API_KEY", "geminiApiKey");
  const groqApiKey = await getSettingKey("GROQ_API_KEY", "groqApiKey");
  const mistralApiKey = await getSettingKey("MISTRAL_API_KEY", "mistralApiKey");
  const huggingfaceApiKey = await getSettingKey("HUGGINGFACE_API_KEY", "huggingfaceApiKey");

  // Provider 1: Google Gemini API
  if (geminiApiKey && geminiApiKey !== "YOUR_GEMINI_API_KEY") {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1000 }
        })
      });
      const data = await response.json();
      if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
        return {
          text: data.candidates[0].content.parts[0].text,
          provider: "Google Gemini 1.5 Flash"
        };
      }
      console.warn("Gemini API quota/limit reached or no candidate. Failover to Groq...");
    } catch (err) {
      console.error("Gemini API Error, failing over to Groq:", err.message);
    }
  }

  // Provider 2: Groq API (Llama-3.1 8B)
  if (groqApiKey && groqApiKey !== "YOUR_GROQ_API_KEY") {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${groqApiKey}`
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: prompt }
          ],
          temperature: 0.7
        })
      });
      const data = await response.json();
      if (data.choices && data.choices[0]?.message?.content) {
        return {
          text: data.choices[0].message.content,
          provider: "Groq (Llama 3.1)"
        };
      }
      console.warn("Groq API quota reached. Failover to Mistral...");
    } catch (err) {
      console.error("Groq API Error, failing over to Mistral:", err.message);
    }
  }

  // Provider 3: Mistral AI API
  if (mistralApiKey && mistralApiKey !== "YOUR_MISTRAL_API_KEY") {
    try {
      const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${mistralApiKey}`
        },
        body: JSON.stringify({
          model: "mistral-tiny",
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: prompt }
          ]
        })
      });
      const data = await response.json();
      if (data.choices && data.choices[0]?.message?.content) {
        return {
          text: data.choices[0].message.content,
          provider: "Mistral AI"
        };
      }
    } catch (err) {
      console.error("Mistral API Error, failing over to HuggingFace:", err.message);
    }
  }

  // Provider 4: Hugging Face Inference API
  if (huggingfaceApiKey && huggingfaceApiKey !== "YOUR_HUGGINGFACE_API_KEY") {
    try {
      const response = await fetch("https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${huggingfaceApiKey}`
        },
        body: JSON.stringify({ inputs: `${systemInstruction}\n\nUser: ${prompt}\nAssistant:` })
      });
      const data = await response.json();
      if (Array.isArray(data) && data[0]?.generated_text) {
        return {
          text: data[0].generated_text.split("Assistant:")[1] || data[0].generated_text,
          provider: "Hugging Face Inference"
        };
      }
    } catch (err) {
      console.error("HuggingFace API Error:", err.message);
    }
  }

  // Provider 5: Smart Offline Engine Fallback
  return {
    text: generateOfflineFallback(prompt),
    provider: "UHC Core AI Engine"
  };
}

/**
 * Offline Smart Fallback for testing & unconfigured API keys
 */
function generateOfflineFallback(prompt) {
  const lower = prompt.toLowerCase();
  
  if (lower.includes("explain option") || lower.includes("why option")) {
    return `### 💡 AI Answer Breakdown\n\n* **Option Analysis**: The selected option was evaluated based on standard medical/educational reference material.\n* **Core Medical Concept**: Focus on primary symptoms, physiological mechanisms, and clinical guidelines related to this question.\n* **Study Tip**: Review key definitions and compare option lengths and definitions when practicing.\n\n*(Note: Add your free \`GEMINI_API_KEY\` or \`GROQ_API_KEY\` in Admin Settings for live multi-AI response!)*`;
  }

  if (lower.includes("shorten") || lower.includes("balance options")) {
    return JSON.stringify({
      options: [
        "Concise Option A",
        "Concise Option B",
        "Concise Option C",
        "Concise Option D"
      ]
    });
  }

  return `### 🤖 UHC AI Study Assistant\n\nThank you for asking: **"${prompt.slice(0, 60)}..."**\n\nHere is a helpful summary:\n* **Core Principle**: Medical and health concepts rely on systematic understanding of fundamentals.\n* **Key Focus**: Always prioritize patient safety, clear evidence, and standard practice guidelines.\n\n> 🔑 *Tip: Provide free API keys in Admin Settings to enable multi-AI failover (Gemini, Groq, Mistral)!*`;
}

/**
 * AI Quiz Option Shortener & Balancer
 */
exports.shortenAndBalanceOptions = async (questionText, originalOptions, correctAnswerIndex) => {
  const prompt = `You are an expert medical exam creator. The following multiple-choice question has options that may be unequal in length, making the correct answer obvious.
Question: "${questionText}"
Options:
0: ${originalOptions[0]}
1: ${originalOptions[1]}
2: ${originalOptions[2]}
3: ${originalOptions[3]}
Correct Answer Index: ${correctAnswerIndex}

Task: Rewrite all 4 options so they are CONCISE, equal in word length (5-12 words each), and plausible. Preserve option ${correctAnswerIndex} as the correct answer.
Return strictly valid JSON format with key "options": array of 4 short strings. Do NOT output markdown code fences or extra text.
Example format:
{"options": ["Short opt 0", "Short opt 1", "Short opt 2", "Short opt 3"]}`;

  try {
    const aiRes = await generateAIResponse(prompt, "You are a JSON-only API that outputs valid JSON object with key 'options'.");
    const cleaned = (aiRes.text || "").replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (parsed.options && Array.isArray(parsed.options) && parsed.options.length === 4) {
      return parsed.options;
    }
  } catch (err) {
    console.error("Failed to parse AI option shortener JSON:", err);
  }

  return originalOptions.map(opt => (opt.length > 60 ? opt.split(/[,.]/)[0].trim() : opt));
};

/**
 * AI Question Generator from Study Notes
 */
exports.generateQuestionsFromNotes = async (notesText, count = 3, courseName = "General Health") => {
  const prompt = `You are a medical professor. Read the following study notes and generate ${count} multiple-choice quiz questions for the course "${courseName}".

Study Notes:
"""
${notesText.slice(0, 3000)}
"""

Task: Generate ${count} high-quality questions. Each question must have:
- "question": string
- "options": array of 4 concise strings (equal length)
- "answer": integer (0 to 3, index of correct option)
- "explanation": brief explanation

Return strictly valid JSON format with key "questions": array of question objects. Do NOT include markdown formatting.`;

  try {
    const aiRes = await generateAIResponse(prompt, "You output strictly valid JSON with key 'questions'.");
    const cleaned = (aiRes.text || "").replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (parsed.questions && Array.isArray(parsed.questions)) {
      return parsed.questions;
    }
  } catch (err) {
    console.error("Failed to generate questions from notes:", err);
  }

  return [];
};

/**
 * AI Similar Question Generator
 */
exports.generateSimilarQuestions = async (baseQuestionText, options, answerIndex, count = 2) => {
  const prompt = `Given this base question: "${baseQuestionText}" (Correct Option: "${options[answerIndex]}"), generate ${count} similar variation questions on the same core concept with 4 short, balanced options.
Return strictly valid JSON format with key "questions": array of objects having "question", "options" (4 strings), "answer" (0-3 index), and "explanation".`;

  try {
    const aiRes = await generateAIResponse(prompt, "You output strictly valid JSON.");
    const cleaned = (aiRes.text || "").replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (parsed.questions && Array.isArray(parsed.questions)) {
      return parsed.questions;
    }
  } catch (err) {
    console.error("Failed to generate similar questions:", err);
  }

  return [];
};

/**
 * General Question Answer
 */
exports.askAI = async (question) => {
  return await generateAIResponse(question);
};

/**
 * Explain Quiz Option (Right vs Wrong)
 */
exports.explainQuizOption = async (questionText, options, selectedIndex, correctIndex) => {
  const selectedText = options[selectedIndex] || "None";
  const correctText = options[correctIndex] || "None";
  const isCorrect = selectedIndex === correctIndex;

  const prompt = `A user took a quiz on this question:
Question: "${questionText}"
Option 0: ${options[0]}
Option 1: ${options[1]}
Option 2: ${options[2]}
Option 3: ${options[3]}

User selected: Option ${selectedIndex} ("${selectedText}")
Correct answer: Option ${correctIndex} ("${correctText}")
User was: ${isCorrect ? "CORRECT" : "INCORRECT"}

Task: Provide a concise 3-part breakdown in markdown:
1. **${isCorrect ? "Why Your Answer Is Right" : "Why Your Answer Was Incorrect"}**: Explain in 2 sentences.
2. **Correct Concept Explanation**: Explain why Option ${correctIndex} ("${correctText}") is the correct medical/educational fact.
3. **Takeaway Tip**: 1 bullet point memory trick for this concept.`;

  return await generateAIResponse(prompt);
};
