# Thank Me Later

A no-sign-in AI chat app with a warm, minimalist interface, multiple AI models, web search, file attachments, Markdown rendering, an optional browser-based code runner, and real-time voice translation.

## Features

- GPT-5.6 Luna via the app's ApiBeam connection.
- Claude Sonnet 5 via its dedicated ApiBeam connection.
- GLM 5.2 via its dedicated ApiBeam connection.
- Gemini Pro Latest, Gemini Flash Latest, and Gemini Flash Lite Latest.
- Live Translate powered by Gemini 3.5 Live Translate (`gemini-3.5-live-translate-preview`).
- Real-time microphone translation with translated audio playback and input/output transcripts.
- Configurable target language and optional echoing when speech is already in the target language.
- Translation transcripts can be discarded, saved to the browser Library, downloaded as Markdown, or downloaded as PDF.
- Saved translation transcripts are stored locally in browser `localStorage`; audio is not persisted.
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
   - `GEMINI_API_KEY` — your Gemini API key. It is used only by server-side API routes.
   - `APIBEAM_BASE_URL` — your private ApiBeam application URL for GPT-5.6 Luna.
   - `APIBEAM_MODEL` — normally `gpt-5.6-luna`; change it only if your ApiBeam bridge reports a different model ID.
3. Deploy.

Live Translate uses a server-issued Gemini ephemeral token. The browser never receives the permanent `GEMINI_API_KEY`; the Live API connection is made directly from the browser using the short-lived token.

Do **not** commit a real `.env` file. Server-side secrets should remain in Vercel environment variables and must not be exposed to the browser.

## Models

- **GPT-5.6 Luna** — proxied through ApiBeam using its OpenAI-compatible `/chat/completions` endpoint.
- **Claude Sonnet 5** — proxied through its dedicated ApiBeam endpoint.
- **GLM 5.2** — proxied through its dedicated ApiBeam endpoint.
- **Gemini Pro Latest** — Gemini `gemini-pro-latest`.
- **Gemini Flash Latest** — Gemini `gemini-flash-latest`.
- **Gemini Flash Lite Latest** — Gemini `gemini-flash-lite-latest`.
- **Gemini 3.5 Live Translate** — Gemini Live API model `gemini-3.5-live-translate-preview`, using 16 kHz mono PCM input and 24 kHz mono PCM output.

## Live Translate

Open **Live Translate** from the left sidebar, choose a target language, and select **Start translation**. The feature streams microphone audio to Gemini Live API over an authenticated WebSocket and plays the translated audio in real time. The interface uses a Claude-inspired warm palette with a pulsing Live-style orb.

The Live API session enables both input and output audio transcription. **Pause translation** stops microphone capture without discarding the current session transcript; **End translation** closes the session and presents save/export options.

The **Library** stores saved transcripts in `localStorage`. It contains transcript text and metadata only; microphone and translated audio are not persisted.

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

Chats and messages are stored in browser `localStorage`. Saved Live Translate transcripts are stored separately in `tml-translation-library`. File attachments are included with the outgoing request but are not persisted after a page reload, avoiding local-storage quota problems.
