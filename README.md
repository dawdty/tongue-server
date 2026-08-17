# Tongue Server

Standalone Express backend for the Tongue native and web clients.

It provides the existing API contracts:

- `POST /session` creates an OpenAI Realtime ephemeral client key.
- `POST /api/ocr` extracts PDF/image text and optionally creates study material.

## Setup

```bash
npm install
cp .env.example .env
```

Add your OpenAI API key to `.env`:

```env
OPENAI_API_KEY=...
```

For OCR, install `tesseract` and `pdftoppm` and ensure they are available on
your `PATH`.

## Run

```bash
npm start
```

The server listens on `http://localhost:3000` by default. The native client can
target it with:

```bash
EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:3000 npm start
```
