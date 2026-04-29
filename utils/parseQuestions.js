function parseQuestions(text) {
  const questions = [];

  const blocks = text.split(/\n\s*\n/);

  blocks.forEach((block) => {
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l !== "");

    if (!lines.length) return;

    if (/^\d+\./.test(lines[0])) {
      const questionText = lines[0].replace(/^\d+\.\s*/, "");

      const options = [];
      let answer = null;

      lines.forEach((line) => {
        if (/^[A-D]\./.test(line)) {
          options.push(line.replace(/^[A-D]\.\s*/, ""));
        }

        if (/^answer/i.test(line)) {
          const ans = line.split(":")[1]?.trim().toUpperCase();
          answer = ["A", "B", "C", "D"].indexOf(ans);
        }
      });

      if (options.length === 4 && answer !== null) {
        questions.push({
          question: questionText,
          options,
          answer,
        });
      }
    }
  });

  return questions;
}

module.exports = parseQuestions;