export const maxDuration = 300;

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
  try {
    const { model, messages, attachments = [], fileContext = '', toolResult = null, webSearch = false, createImage = false } = req.body || {};
    if (!model || !Array.isArray(messages) || messages.length === 0) return res.status(400).json({ error: 'Missing model or messages' });
    if (!messages.every((m) => m && ['user', 'assistant', 'system'].includes(m.role) && typeof m.content === 'string')) return res.status(400).json({ error: 'Invalid message format' });
    const chatPrompt = 'Answer helpfully, accurately and clearly. Preserve conversation context.';
    const contextualMessages = [{ role: 'system', content: chatPrompt }, ...messages.map((m) => ({ role: m.role, content: m.content }))];
    const lastUserIndex = [...contextualMessages].map((m) => m.role).lastIndexOf('user');
    const commandPrefix = model === 'gpt-5.6-luna' && webSearch ? '@Web search\n' : '';
    const imagePrefix = model === 'gpt-5.6-luna' && createImage ? '@Create image\n' : '';
    if (lastUserIndex >= 0 && (commandPrefix || imagePrefix)) contextualMessages[lastUserIndex].content = `${commandPrefix}${imagePrefix}${contextualMessages[lastUserIndex].content}`;
    if (fileContext && contextualMessages.length) contextualMessages[contextualMessages.length - 1].content += `\n\nThe user attached text files. Use their contents as source material:\n${String(fileContext).slice(0, 120000)}`;
    if (toolResult && contextualMessages.length) contextualMessages[contextualMessages.length - 1].content += `\n\nA local tool produced this result. Treat it as supplied tool output: ${String(toolResult).slice(0, 4000)}`;

    // Never impose an artificial 60-second timeout. Long reasoning/code generations must be
    // allowed to finish. maxDuration above is the serverless runtime's outer boundary.
    const requestJson = async (url, options = {}) => fetch(url, options);

    if (model.startsWith('gemini-')) {
      if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
      const contents = contextualMessages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
      const imageAttachments = attachments.filter((a) => a && a.type?.startsWith('image/') && typeof a.data === 'string');
      if (imageAttachments.length && contents.length) contents[contents.length - 1].parts.push(...imageAttachments.map((a) => ({ inlineData: { mimeType: a.type, data: a.data } })));
      if (!contents.length) return res.status(400).json({ error: 'No usable messages supplied' });
      const r = await requestJson(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contents, generationConfig: { temperature: 0.7 } }) });
      const data = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: data?.error?.message || 'Gemini request failed' });
      return res.status(200).json({ text: data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || 'No response returned.' });
    }

    const provider = model === 'gpt-5.6-luna' ? { base: 'https://apibeam.bitsmall.in/app/ysw4a2tcac3ly44dgp4tf', model: 'gpt-5.6-luna' } : model === 'claude-sonnet-5' ? { base: 'https://apibeam.bitsmall.in/app/cjzxbswhe4lw9y7rutrsr', model: 'claude-sonnet-5' } : model === 'glm-5.2' ? { base: 'https://apibeam.bitsmall.in/app/8gjkog1269ekxnqffqskgm', model: 'glm-5.2' } : null;
    if (!provider) return res.status(400).json({ error: 'Unsupported model' });
    const imageParts = attachments.filter((a) => a && a.type?.startsWith('image/') && typeof a.data === 'string').map((a) => ({ type: 'image_url', image_url: { url: `data:${a.type};base64,${a.data}` } }));
    const converted = contextualMessages.map((m, i) => i === contextualMessages.length - 1 && imageParts.length ? { ...m, content: [{ type: 'text', text: m.content }, ...imageParts] } : m);
    const upstreamUrl = `${provider.base}/chat/completions`;
    const upstreamBody = JSON.stringify({ model: provider.model, messages: converted, temperature: 0.7 });

    // ApiBeam can occasionally return its own HTML Gateway Timeout page (rather than a JSON
    // error) while the upstream model is still being processed. Treat that as a transient
    // upstream failure instead of dumping the gateway's HTML into the chat. Retry a few times
    // with a short backoff, especially for GLM where this has been observed.
    const transientStatuses = new Set([408, 429, 500, 502, 503, 504]);
    const transientText = (text) => /(?:gateway\s+timeout|upstream\s+timeout|bad\s+gateway|service\s+unavailable|upstream\s+request)/i.test(String(text || '')) || /^\s*<!doctype html/i.test(String(text || '')) || /^\s*<html[\s>]/i.test(String(text || ''));
    let r = null;
    let responseText = '';
    let lastTransientError = '';
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        r = await requestJson(upstreamUrl, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer not-needed' }, body: upstreamBody });
        responseText = await r.text();
      } catch (error) {
        if (attempt === 2) throw error;
        lastTransientError = error?.message || 'Upstream connection failed';
        await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
        continue;
      }
      const transient = !r.ok && (transientStatuses.has(r.status) || transientText(responseText));
      if (!transient || r.ok) break;
      lastTransientError = responseText;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
    }

    let data = null; try { data = responseText ? JSON.parse(responseText) : null; } catch {}
    if (!r?.ok) {
      const htmlGateway = transientText(responseText) && /<\/?(?:html|!doctype)/i.test(responseText);
      const message = htmlGateway
        ? `GLM 5.2 upstream gateway timed out after multiple attempts. The provider did not return a model response. Please retry the request.`
        : data?.error?.message || data?.message || responseText?.slice(0, 1000) || lastTransientError || 'ApiBeam request failed';
      return res.status(r?.status >= 400 && r?.status < 600 ? r.status : 502).json({ error: message });
    }
    if (!data || typeof data !== 'object') return res.status(502).json({ error: 'ApiBeam returned an invalid response.' });
    const choice = data?.choices?.[0];
    const message = choice?.message || {};
    const annotations = message?.annotations || choice?.annotations || data?.annotations || [];
    const citationSources = [];
    const seenUrls = new Set();
    const addSource = (value, fallbackIndex = 0) => {
      if (!value || typeof value !== 'object') return;
      const url = value.url || value.source_url || value.href || value.link || value.uri || value.url_citation?.url || value.citation?.url || value.source?.url;
      if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url) || seenUrls.has(url)) return;
      const title = value.title || value.name || value.url_citation?.title || value.citation?.title || value.source?.title || '';
      const refs = [value.id, value.ref, value.citation_id, value.citation?.id, value.citation?.ref, value.url_citation?.id].filter(Boolean).map(String);
      let domain = ''; try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch {}
      seenUrls.add(url); citationSources.push({ url, title: String(title || domain || `Source ${fallbackIndex + 1}`), domain, refs });
    };
    const walkAnnotations = (value) => { if (!value) return; if (Array.isArray(value)) { value.forEach(walkAnnotations); return; } if (typeof value !== 'object') return; addSource(value, citationSources.length); Object.entries(value).forEach(([key, child]) => { if (!['url', 'source_url', 'href', 'link', 'uri'].includes(key)) walkAnnotations(child); }); };
    walkAnnotations(annotations);

    let rawText = String(message?.content || data?.text || 'No response returned.');
    const THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.min.js';
    const augmentHtml = (html) => {
      const source = String(html || '');
      if (!/\bTHREE\s*\./.test(source)) return source;
      if (/<script[^>]+(?:src|type)=["'][^"']*three(?:\.module)?(?:\.min)?\.js[^"']*["'][^>]*>/i.test(source)) return source;
      if (/https?:\/\/[^"'\s>]*three[^"'\s>]*\.js/i.test(source)) return source;
      const loader = `<script src="${THREE_CDN}"></script>`;
      if (/<head\b[^>]*>/i.test(source)) return source.replace(/(<head\b[^>]*>)/i, `$1${loader}`);
      return loader + source;
    };
    const augmentProjectManifest = (text) => {
      const match = text.match(/```(?:json|project|files)\s*\n([\s\S]*?)```/i);
      if (!match) return text;
      try {
        const project = JSON.parse(match[1]);
        if (!Array.isArray(project?.files)) return text;
        let changed = false;
        const files = project.files.map((file) => {
          if (!file || typeof file.path !== 'string' || !/\.html?$/i.test(file.path)) return file;
          const next = augmentHtml(file.content);
          if (next !== file.content) changed = true;
          return { ...file, content: next };
        });
        if (!changed) return text;
        const replacement = '```json\n' + JSON.stringify({ ...project, files }, null, 2) + '\n```';
        return text.slice(0, match.index) + text.slice(match.index).replace(match[0], replacement);
      } catch { return text; }
    };
    rawText = augmentProjectManifest(rawText);
    const citationRegex = /cite([^]+)/g;
    const processedText = rawText.replace(citationRegex, (full, rawRefs) => {
      const refs = String(rawRefs).split(/[,\s]+/).filter(Boolean);
      const selected = refs.map((ref) => citationSources.find((source) => source.refs.includes(ref))).filter(Boolean);
      const sources = selected.length ? selected : citationSources.slice(0, Math.max(1, refs.length));
      if (!sources.length) return '';
      return sources.map((source) => `[${source.domain || source.title}](${source.url} "citation")`).join(' ');
    });
    return res.status(200).json({ text: processedText, annotations });
  } catch (e) {
    const message = e?.name === 'AbortError' ? 'Upstream request was aborted by the hosting platform' : e?.message || 'Unexpected server error';
    return res.status(500).json({ error: message });
  }
}
