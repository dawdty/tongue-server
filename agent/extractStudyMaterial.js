const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_MAX_INPUT_CHARS = 20_000;

function clampText(text, maxChars = DEFAULT_MAX_INPUT_CHARS) {
  if (typeof text !== "string") return "";
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return (
    trimmed.slice(0, maxChars) +
    `\n\n[Truncated: ${trimmed.length - maxChars} chars omitted]`
  );
}

//Function to extract study material from OCR text using gpt-4o-mini
//Generates vocabulary, grammar points, and exercises based on the provided OCR text and target language.

export async function extractStudyMaterial({
  ocrText,
  language,
  openaiApiKey,
  model = DEFAULT_MODEL,
} = {}) {
  const text = clampText(ocrText);
  const targetLanguage = typeof language === "string" ? language.trim() : "";

  if (!text) return "";
  if (!openaiApiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const prompt = [
    "",
    targetLanguage
      ? `Target language for study: ${targetLanguage}.`
      : "Target language for study: (unspecified).",
    "Given the following OCR text, extract useful study material IN THE TARGET LANGUAGE.",
    "If the OCR text is not in the target language, still extract any relevant words/phrases you can, and create general grammar practice appropriate for the target language.",
    "Output not in Markdown with these sections:",
    "1) Vocabulary (10-25 items): word/phrase — short meaning; include pronunciation if relevant (e.g., Pinyin for Chinese).",
    "2) Key grammar patterns (3-6): brief explanation + 1 example from or inspired by the text.",
    "3) Exercises (6-10): mix of fill-in-the-blank, translation, and short-answer. Keep them beginner/intermediate unless the text is clearly advanced.",
    "Be concise, readable, and avoid huge walls of text.",
    "\nOCR text:\n" + text,
  ].join("\n");

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
      max_tokens: 900,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`Study material extraction failed: ${resp.status} ${errText}`);
  }

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;
  return typeof content === "string" ? content.trim() : "";
}
