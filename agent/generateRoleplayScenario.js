
//Function to generate a two-person roleplay scenario using gpt-4o-mini
//Returns a scenario with user and tutor roles and a brief scene description.

export async function generateRoleplayScenario({ scenario, openaiApiKey } = {}) {
  const trimmed = typeof scenario === "string" ? scenario.trim() : "";
  if (!trimmed) return "";

  if (!openaiApiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const prompt =
    "generate a two-person roleplay scenario assigning a character to the agent and one to the user." +
    "\n\nScenario idea (from the user):\n" +
    trimmed +
    "\n\nReturn ONLY the scenario in the format [User]: User Role, [Tutor]: Tutor Role, [Scene]: BRIEF Scene description. Total less than 20 words.";

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 400,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Scenario generation failed: ${resp.status} ${text}`);
  }

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;
  return typeof content === "string" ? content.trim() : "";
}
