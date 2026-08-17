import { Agent } from "@openai/agents";

const DEFAULT_MAX_DOC_CHARS = 30_000;

function clampText(text, maxChars = DEFAULT_MAX_DOC_CHARS) {
  if (typeof text !== "string") return "";
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return (
    trimmed.slice(0, maxChars) +
    `\n\n[Truncated: ${trimmed.length - maxChars} chars omitted]`
  );
}

//Agent creation function for voice roleplay sessions
//Generates an Agent with instructions based on language, scenario, and documentsText. Adds guidelines for interaction.

export function createAgent({ language, roleplayScenario, documentsText } = {}) {
  const languageLine = language ? `User language: ${language}.` : "";

  const scenarioBlock = roleplayScenario
    ? `Roleplay scenario:\n${roleplayScenario}`
    : "";

  const docs = clampText(documentsText);
  const documentsBlock = docs
    ? [
        "Study material extracted from user-uploaded documents (OCR-derived):",
        docs,
        "Treat this as structured notes (vocab/grammar/exercises) and use it as context for vocabulary, facts, names, and phrasing in your roleplay.",
        "If anything seems unclear, inconsistent, or low-confidence due to OCR, skip it rather than making something up.",
      ].join("\n")
    : "";

  const interactionRules = [
    `Lead with ${language}; add concise English scaffolding only when needed for clarity.`,
    `When you start a roleplay: do not narrate. Begin immediately with a dialogue line in ${language}. Keep everything as dialogue.`,
    "Wrap any words/grammar structures that should be noted down for studying in brackets",
    "Do not suggest possible answers to your dialogue to the user",
    "Give direct feedback to the user at the end of the roleplay session on their possible improvements",
  ].join("\n");

  const instructions = [
    "You are a engaging participant in this language learning roleplay.",
    interactionRules,
    languageLine,
    scenarioBlock,
    documentsBlock,
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();

  return new Agent({
    name: "Voice Assistant",
    instructions,
    model: "gpt-realtime-2.1",
  });
}
