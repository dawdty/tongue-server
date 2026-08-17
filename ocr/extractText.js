/* warning - majority ai-generated code */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileAsync } from "./exec.js";

const DEFAULT_MAX_CHARS = 30_000;

//Helper to clamp text length with truncation notice

function clampText(text, maxChars = DEFAULT_MAX_CHARS) {
  if (typeof text !== "string") return "";
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return (
    trimmed.slice(0, maxChars) +
    `\n\n[Truncated: ${trimmed.length - maxChars} chars omitted]`
  );
}

//Check if a file path exists

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

//Ensure Tesseract CLI is available

async function ensureCliAvailable() {
  try {
    await execFileAsync("tesseract", ["--version"]);
  } catch (err) {
    throw new Error(
      "Missing required CLI: tesseract. Install in the container with `apt-get update && apt-get install -y tesseract-ocr`."
    );
  }
}

//  Ensure PDF-to-image CLI is available

async function ensurePdfCliAvailable() {
  try {
    await execFileAsync("pdftoppm", ["-v"]);
  } catch {
    throw new Error(
      "Missing required CLI: pdftoppm (poppler-utils). Install with `apt-get update && apt-get install -y poppler-utils`."
    );
  }
}

//OCR an image file using Tesseract

async function ocrImageFile(imagePath, { tesseractLang = "eng" } = {}) {
  await ensureCliAvailable();
  const { stdout } = await execFileAsync("tesseract", [
    imagePath,
    "stdout",
    "-l",
    tesseractLang,
  ]);
  return stdout ?? "";
}

//OCR a PDF file by converting pages to images and processing each

async function ocrPdfFile(pdfPath, { tesseractLang = "eng" } = {}) {
  await ensureCliAvailable();
  await ensurePdfCliAvailable();

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "clangtut-pdf-"));
  const prefix = path.join(tmpDir, "page");

  try {
    // Produces files like page-1.png, page-2.png, ...
    await execFileAsync("pdftoppm", ["-png", "-r", "200", pdfPath, prefix]);

    const files = (await fs.readdir(tmpDir))
      .filter((f) => f.startsWith("page-") && f.endsWith(".png"))
      .sort((a, b) => {
        const na = Number(a.match(/page-(\d+)\.png$/)?.[1] ?? 0);
        const nb = Number(b.match(/page-(\d+)\.png$/)?.[1] ?? 0);
        return na - nb;
      });

    if (files.length === 0) return "";

    const chunks = [];
    for (let i = 0; i < files.length; i++) {
      const imgPath = path.join(tmpDir, files[i]);
      const pageText = await ocrImageFile(imgPath, { tesseractLang });
      const cleaned = (pageText ?? "").trim();
      if (cleaned) {
        chunks.push(`--- Page ${i + 1} ---\n${cleaned}`);
      }
    }

    return chunks.join("\n\n");
  } finally {
    // Best-effort cleanup
    try {
      const entries = await fs.readdir(tmpDir);
      await Promise.all(
        entries.map((f) => fs.rm(path.join(tmpDir, f), { force: true }))
      );
      await fs.rmdir(tmpDir).catch(() => {});
    } catch {
      // ignore
    }
  }
}

//Determine if file looks like a PDF

function looksLikePdf({ mimeType, originalName } = {}) {
  const ext = typeof originalName === "string" ? path.extname(originalName).toLowerCase() : "";
  return mimeType === "application/pdf" || ext === ".pdf";
}

//Determine if file looks like an image

function looksLikeImage({ mimeType, originalName } = {}) {
  if (typeof mimeType === "string" && mimeType.startsWith("image/")) return true;
  const ext = typeof originalName === "string" ? path.extname(originalName).toLowerCase() : "";
  return [".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff"].includes(ext);
}

//Extract text from a single uploaded file (image or PDF) using OCR

export async function extractTextFromFile(
  filePath,
  { mimeType, originalName, tesseractLang = "eng", maxChars = DEFAULT_MAX_CHARS } = {}
) {
  if (!(await pathExists(filePath))) {
    throw new Error(`Upload missing on disk: ${filePath}`);
  }

  let raw = "";
  if (looksLikePdf({ mimeType, originalName })) {
    raw = await ocrPdfFile(filePath, { tesseractLang });
  } else if (looksLikeImage({ mimeType, originalName })) {
    raw = await ocrImageFile(filePath, { tesseractLang });
  } else {
    throw new Error(
      `Unsupported file type: ${mimeType ?? "unknown"} (${originalName ?? ""})`
    );
  }

  return clampText(raw, maxChars);
}

//Extract text from multiple uploaded files using OCR

export async function extractTextFromUploads(
  uploads,
  { tesseractLang = "eng", maxCharsPerFile = DEFAULT_MAX_CHARS } = {}
) {
  const files = Array.isArray(uploads) ? uploads : [];
  const parts = [];

  for (const f of files) {
    const name = f?.originalname ?? "upload";
    const text = await extractTextFromFile(f.path, {
      mimeType: f.mimetype,
      originalName: name,
      tesseractLang,
      maxChars: maxCharsPerFile,
    });

    const cleaned = (text ?? "").trim();
    if (cleaned) {
      parts.push(`=== ${name} ===\n${cleaned}`);
    }
  }

  return parts.join("\n\n");
}
