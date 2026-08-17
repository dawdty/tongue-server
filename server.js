import express from "express";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import fs from "node:fs/promises";
import multer from "multer";
import { extractTextFromUploads } from "./ocr/extractText.js";
import { generateRoleplayScenario } from "./agent/generateRoleplayScenario.js";
import { createAgent } from "./agent/createAgent.js";
import { extractStudyMaterial } from "./agent/extractStudyMaterial.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, ".env") });

const app = express();
app.use(express.json());
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const upload = multer({
  dest: path.join(os.tmpdir(), "clangtut-uploads"),
  limits: {
    files: 10,
    fileSize: 20 * 1024 * 1024,
  },
});

// OCR endpoint: accepts up to 10 uploaded files (multipart/form-data field "files"),
// extracts text via Tesseract, optionally generates study material with OpenAI,
// and returns JSON: { text, ocrText, studyText, language, tesseractLang }.

app.post("/api/ocr", upload.array("files", 10), async (req, res) => {
  const files = Array.isArray(req.files) ? req.files : [];
  const tesseractLangRaw =
    typeof req.body?.tesseractLang === "string" ? req.body.tesseractLang : "";
  const tesseractLang = tesseractLangRaw.trim() || "eng";
  const languageRaw =
    typeof req.body?.language === "string" ? req.body.language : "";
  const language = languageRaw.trim();

  try {
    const ocrText = await extractTextFromUploads(files, {
      tesseractLang,
      maxCharsPerFile: 30_000,
    });

    let studyText = "";
    try {
      if (OPENAI_API_KEY) {
        studyText = await extractStudyMaterial({
          ocrText,
          language,
          openaiApiKey: OPENAI_API_KEY,
        });
      }
    } catch (err) {
      console.error(err);
      studyText = "";
    }

    // Back-compat: keep `text` as the "best" text to display.
    res.json({
      text: studyText || ocrText,
      ocrText,
      studyText,
      language: language || undefined,
      tesseractLang,
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  } finally {
    await Promise.all(
      files
        .map((f) => f?.path)
        .filter(Boolean)
        .map((p) => fs.rm(p, { force: true })),
    );
  }
});

app.post("/session", async (req, res) => {
  try {
    if (!OPENAI_API_KEY) {
      return res.status(500).send("Missing OPENAI_API_KEY");
    }

    const { language, scenario, documentsText } = req.body ?? {};
    const roleplayScenario = await generateRoleplayScenario({
      scenario,
      openaiApiKey: OPENAI_API_KEY,
    });
    const agent = createAgent({ language, roleplayScenario, documentsText });
    const response = await fetch(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session: {
            type: "realtime",
            model: agent.model,
            instructions: agent.instructions,
            audio: {
              output: {
                voice: "marin",
              },
            },
          },
        }),
      },
    );

    const session = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({
        error: session?.error?.message || "Failed to create Realtime client secret",
      });
    }

    if (typeof session?.value !== "string" || session.value.length === 0) {
      throw new Error("OpenAI response missing Realtime client secret value");
    }

    res.json({
      client_secret: { value: session.value },
      model: agent.model,
      roleplayScenario,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to create session");
  }
});

// Start the server

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`Server is running on port ${PORT}`);
});
