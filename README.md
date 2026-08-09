# Thank Me Later

A no-sign-in AI chat app with a warm, minimalist interface, multiple AI models, web search, file attachments, Markdown rendering, and an optional browser-based code runner.

## Features

- GPT-5.6 Luna via the app's ApiBeam connection.
- Claude Sonnet 5 via its dedicated ApiBeam connection.
- GLM 5.2 via its dedicated ApiBeam connection.
- Gemini Pro Latest, Gemini Flash Latest, and Gemini Flash Lite Latest.
- Slash-command menu in the composer: type `/` to open available commands.
- Web Search command displayed as a pill in the composer and sent to GPT-5.6 Luna as `@Web search`.
- Web-search citations rendered as compact inline pills that link to their cited sources.
- Markdown/GFM responses, including tables and code blocks.
- Local chat history stored in browser `localStorage`.
- File attachments for supported text and binary files.
- Chat export and message copy/regeneration controls.
- Code mode with a browser sandbox for JavaScript and Python execution, with a 10-second execution limit.

## Deploy to Vercel

1. Import this repository into Vercel.
2. Add these Vercel Environment Variables:
   - `GEMINI_API_KEY` — your Gemini API key.
   - `APIBEAM_BASE_URL` — your private ApiBeam application URL for GPT-5.6 Luna.
   - `APIBEAM_MODEL` — normally `gpt-5.6-luna`; change it only if your ApiBeam bridge reports a different model ID.
3. Deploy.

Do **not** commit a real `.env` file. Server-side secrets should remain in Vercel environment variables and must not be exposed to the browser.

## Models

- **GPT-5.6 Luna** — proxied through ApiBeam using its OpenAI-compatible `/chat/completions` endpoint.
- **Claude Sonnet 5** — proxied through its dedicated ApiBeam endpoint.
- **GLM 5.2** — proxied through its dedicated ApiBeam endpoint.
- **Gemini Pro Latest** — Gemini `gemini-pro-latest`.
- **Gemini Flash Latest** — Gemini `gemini-flash-latest`.
- **Gemini Flash Lite Latest** — Gemini `gemini-flash-lite-latest`.

## Web Search

Select **Web search** from the `/` command menu. The selected command appears as a pill in the composer. When the message is sent, the frontend sends the model the `@Web search` marker so the ApiBeam/GPT-5.6 Luna integration can handle the request.

When the API returns citation metadata, the frontend maps citation markers in the response to compact, clickable source pills. Each pill opens the cited source in a new browser tab.

## Local development

```bash
npm install
npm run dev
```

For local API testing, create `.env.local` from `.env.example` and fill in the required values.

## Storage

Chats and messages are stored in browser `localStorage`. File attachments are included with the outgoing request but are not persisted after a page reload, avoiding local-storage quota problems.
