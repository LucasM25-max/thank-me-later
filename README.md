# Thank Me Later

A no-sign-in AI chat app styled with a warm, minimalist Claude-like layout.

## Deploy to Vercel

1. Create a new GitHub repository and upload all files in this project.
2. Import the repository into Vercel.
3. Add these Vercel Environment Variables:
   - `GEMINI_API_KEY` — your Gemini API key.
   - `APIBEAM_BASE_URL` — your private ApiBeam application URL.
   - `APIBEAM_MODEL` — normally `gpt-5.6-luna`; change it only if your ApiBeam bridge reports a different model ID.
4. Deploy.

Do **not** commit a real `.env` file. The app never exposes either server-side secret to the browser.

## Models

- GPT-5.6 Luna — proxied through ApiBeam using its OpenAI-compatible `/chat/completions` endpoint.
- Gemini Pro Latest — Gemini `gemini-pro-latest`.
- Gemini Flash Latest — Gemini `gemini-flash-latest`.
- Gemini Flash Lite Latest — Gemini `gemini-flash-lite-latest`.

## Local development

```bash
npm install
npm run dev
```

For local API testing, create `.env.local` from `.env.example` and fill in the values.

## Storage

Chats, folders and messages are stored in browser `localStorage`. Files are attached to the outgoing request but are not persisted after a page reload, avoiding local-storage quota problems.
