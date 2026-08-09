export const maxDuration = 300;

const TIME_LIMIT_MS = 270000;
const ABORT_MARKER = '<<ABORTED_BY_TIME_LIMIT>>';
const CONTINUE_PROMPT = 'Finish the task to completion, continuing from where you left off';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function readStreamingResponse(response, deadline) {
  if (!response.body) return { text: await response.text(), timedOut: false };
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  let timedOut = false;

  const extract = (raw) => {
    const lines = raw.split(/\r?\n/);
    for (const line of lines) {
      const value = line.startsWith('data:') ? line.slice(5).trim() : '';
      if (!value || value === '[DONE]') continue;
      try {
        const parsed = JSON.parse(value);
        const delta = parsed?.choices?.[0]?.delta?.content;
        if (typeof delta === 'string') text += delta;
        else if (typeof parsed?.choices?.[0]?.message?.content === 'string') text += parsed.choices[0].message.content;
      } catch {}
    }
  };

  while (true) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) { timedOut = true; break; }
    const result = await Promise.race([
      reader.read(),
      sleep(remaining).then(() => ({ timeout: true }))
    ]);
    if (result?.timeout) { timedOut = true; break; }
    if (result.done) {
      buffer += decoder.decode();
      extract(buffer);
      break;
    }
    buffer += decoder.decode(result.value, { stream: true });
    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop() || '';
    events.forEach(extract);
  }

  if (timedOut) {
    try { await reader.cancel(); } catch {}
  }
  return { text, timedOut };
}

async function requestWithTimeLimit(url, body) {
  const controller = new AbortController();
  const deadline = Date.now() + TIME_LIMIT_MS;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer not-needed' },
      body,
      signal: controller.signal
    });
    const result = await readStreamingResponse(response, deadline);
    return { response, text: result.text, timedOut: result.timedOut };
  } finally {
    try { controller.abort(); } catch {}
  }
}

function parseProviderText(text) {
  const raw = String(text || '');
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch {}
  if (data && typeof data === 'object') {
    const content = data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? data?.text;
    return { data, text: typeof content === 'string' ? content : '' };
  }
  return { data: null, text: raw };
}

function isTransient(text, status) {
  return [408, 429, 500, 502, 503, 504].includes(status) || /(?:gateway\s+timeout|upstream\s+timeout|bad\s+gateway|service\s+unavailable|upstream\s+request)/i.test(String(text || '')) || /^\s*<!doctype html/i.test(String(text || '')) || /^\s*<html[\s>]/i.test(String(text || ''));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
  try {
    const { model, messages, attachments = [], fileContext = '', toolResult = null, webSearch = false, createImage = false } = req.body || {};
    if (!model || !Array.isArray(messages) || messages.length === 0) return res.status(400).json({ error: 'Missing model or messages' });
    if (!messages.every((m) => m && ['user', 'assistant', 'system'].includes(m.role) && typeof m.content === 'string')) return res.status(400).json({ error: 'Invalid message format' });

    const timeLimitPrompt = `Complete the user's task thoroughly. You have a maximum working window of 4 minutes 30 seconds for this call. If you are still working when that limit is reached, immediately stop and output your best current response, then put the exact marker ${ABORT_MARKER} as the final text. Never claim the task is complete if it is not. The application will silently continue from your partial response.`;
    const chatPrompt = `Answer helpfully, accurately and clearly. Preserve conversation context.\n\n${timeLimitPrompt}`;
    const contextualMessages = [{ role: 'system', content: chatPrompt }, ...messages.map((m) => ({ role: m.role, content: m.content }))];
    const lastUserIndex = [...contextualMessages].map((m) => m.role).lastIndexOf('user');
    const commandPrefix = model === 'gpt-5.6-luna' && webSearch ? '@Web search\n' : '';
    const imagePrefix = model === 'gpt-5.6-luna' && createImage ? '@Create image\n' : '';
    if (lastUserIndex >= 0 && (commandPrefix || imagePrefix)) contextualMessages[lastUserIndex].content = `${commandPrefix}${imagePrefix}${contextualMessages[lastUserIndex].content}`;
    if (fileContext && contextualMessages.length) contextualMessages[contextualMessages.length - 1].content += `\n\nThe user attached text files. Use their contents as source material:\n${String(fileContext).slice(0, 120000)}`;
    if (toolResult && contextualMessages.length) contextualMessages[contextualMessages.length - 1].content += `\n\nA local tool produced this result. Treat it as supplied tool output: ${String(toolResult).slice(0, 4000)}`;

    if (model.startsWith('gemini-')) {
      if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
      const contents = contextualMessages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
      const imageAttachments = attachments.filter((a) => a && a.type?.startsWith('image/') && typeof a.data === 'string');
      if (imageAttachments.length && contents.length) contents[contents.length - 1].parts.push(...imageAttachments.map((a) => ({ inlineData: { mimeType: a.type, data: a.data } })));
      if (!contents.length) return res.status(400).json({ error: 'No usable messages supplied' });
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contents, generationConfig: { temperature: 0.7 } }) });
      const data = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: data?.error?.message || 'Gemini request failed' });
      return res.status(200).json({ text: data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || 'No response returned.' });
    }

    const provider = model === 'gpt-5.6-luna' ? { base: 'https://apibeam.bitsmall.in/app/ysw4a2tcac3ly44dgp4tf', model: 'gpt-5.6-luna' } : model === 'claude-sonnet-5' ? { base: 'https://apibeam.bitsmall.in/app/cjzxbswhe4lw9y7rutrsr', model: 'claude-sonnet-5' } : model === 'glm-5.2' ? { base: 'https://apibeam.bitsmall.in/app/8gjkog1269ekxnqffqskgm', model: 'glm-5.2' } : null;
    if (!provider) return res.status(400).json({ error: 'Unsupported model' });

    const imageParts = attachments.filter((a) => a && a.type?.startsWith('image/') && typeof a.data === 'string').map((a) => ({ type: 'image_url', image_url: { url: `data:${a.type};base64,${a.data}` } }));
    const converted = contextualMessages.map((m, i) => i === contextualMessages.length - 1 && imageParts.length ? { ...m, content: [{ type: 'text', text: m.content }, ...imageParts] } : m);
    const upstreamUrl = `${provider.base}/chat/completions`;
    const body = JSON.stringify({ model: provider.model, messages: converted, temperature: 0.7, stream: true });

    let result;
    try {
      result = await requestWithTimeLimit(upstreamUrl, body);
    } catch (error) {
      throw error;
    }
    const { response, text } = result;
    const parsed = parseProviderText(text);
    const returnedText = parsed.text || text;

    if (!response.ok && isTransient(returnedText, response.status)) {
      return res.status(response.status >= 400 && response.status < 600 ? response.status : 502).json({ error: 'The upstream model gateway timed out. Please retry the request.' });
    }
    if (!response.ok) return res.status(response.status >= 400 && response.status < 600 ? response.status : 502).json({ error: parsed.data?.error?.message || parsed.data?.message || returnedText?.slice(0, 1000) || 'ApiBeam request failed' });

    const markerIndex = returnedText.indexOf(ABORT_MARKER);
    const partial = (markerIndex >= 0 ? returnedText.slice(0, markerIndex) : returnedText).trimEnd();
    const shouldContinue = result.timedOut || markerIndex >= 0;
    const annotations = parsed.data?.choices?.[0]?.message?.annotations || parsed.data?.annotations || [];

    if (shouldContinue) {
      // IMPORTANT: this response ends this Vercel invocation. The browser-side continuation
      // worker immediately creates a completely new HTTP invocation with these messages.
      // Nothing here loops, so every 4m30s attempt gets a fresh Vercel duration budget.
      const continuationMessages = [
        ...messages,
        { role: 'assistant', content: `${partial}\n${ABORT_MARKER}` },
        { role: 'user', content: CONTINUE_PROMPT }
      ];
      return res.status(200).json({ text: partial || 'Working…', annotations, continuation: true, messages: continuationMessages });
    }

    return res.status(200).json({ text: partial || 'No response returned.', annotations, continuation: false });
  } catch (e) {
    const message = e?.name === 'AbortError' ? 'The upstream request ended unexpectedly' : e?.message || 'Unexpected server error';
    return res.status(500).json({ error: message });
  }
}
