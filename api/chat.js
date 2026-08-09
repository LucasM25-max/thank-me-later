export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      model,
      messages,
      attachments = [],
      fileContext = '',
      toolResult = null,
      webSearch = false,
      createImage = false
    } = req.body || {};

    if (!model || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Missing model or messages' });
    }
    if (!messages.every((m) => m && ['user', 'assistant', 'system'].includes(m.role) && typeof m.content === 'string')) {
      return res.status(400).json({ error: 'Invalid message format' });
    }

    const chatPrompt = 'Answer helpfully, accurately and clearly. Preserve conversation context.';
    const contextualMessages = [{ role: 'system', content: chatPrompt }, ...messages.map((m) => ({ role: m.role, content: m.content }))];

    const lastUserIndex = [...contextualMessages].map((m) => m.role).lastIndexOf('user');
    const commandPrefix = model === 'gpt-5.6-luna' && webSearch ? '@Web search\n' : '';
    const imagePrefix = model === 'gpt-5.6-luna' && createImage ? '@Create image\n' : '';
    if (lastUserIndex >= 0 && (commandPrefix || imagePrefix)) {
      const content = contextualMessages[lastUserIndex].content;
      const prefixes = `${commandPrefix}${imagePrefix}`;
      contextualMessages[lastUserIndex].content = `${prefixes}${content}`;
    }

    if (fileContext && contextualMessages.length) {
      contextualMessages[contextualMessages.length - 1].content += `\n\nThe user attached text files. Use their contents as source material:\n${String(fileContext).slice(0, 120000)}`;
    }
    if (toolResult && contextualMessages.length) {
      contextualMessages[contextualMessages.length - 1].content += `\n\nA local tool produced this result. Treat it as supplied tool output: ${String(toolResult).slice(0, 4000)}`;
    }

    const requestJson = async (url, options = {}) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);
      try {
        return await fetch(url, { ...options, signal: controller.signal });
      } finally {
        clearTimeout(timeout);
      }
    };

    if (model.startsWith('gemini-')) {
      if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
      const contents = contextualMessages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
      const imageAttachments = attachments.filter((a) => a && a.type?.startsWith('image/') && typeof a.data === 'string');
      if (imageAttachments.length && contents.length) {
        contents[contents.length - 1].parts.push(...imageAttachments.map((a) => ({ inlineData: { mimeType: a.type, data: a.data } })));
      }
      if (!contents.length) return res.status(400).json({ error: 'No usable messages supplied' });

      const r = await requestJson(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contents, generationConfig: { temperature: 0.7 } })
      });
      const data = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: data?.error?.message || 'Gemini request failed' });
      return res.status(200).json({ text: data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || 'No response returned.' });
    }

    const provider = model === 'gpt-5.6-luna' ? {
      base: 'https://apibeam.bitsmall.in/app/ysw4a2tcac3ly44dgp4tf',
      model: 'gpt-5.6-luna'
    } : model === 'claude-sonnet-5' ? {
      base: 'https://apibeam.bitsmall.in/app/cjzxbswhe4lw9y7rutrsr',
      model: 'claude-sonnet-5'
    } : model === 'glm-5.2' ? {
      base: 'https://apibeam.bitsmall.in/app/8gjkog1269ekxnqffqskgm',
      model: 'glm-5.2'
    } : null;

    if (!provider) return res.status(400).json({ error: 'Unsupported model' });

    const imageParts = attachments
      .filter((a) => a && a.type?.startsWith('image/') && typeof a.data === 'string')
      .map((a) => ({ type: 'image_url', image_url: { url: `data:${a.type};base64,${a.data}` } }));
    const converted = contextualMessages.map((m, i) => i === contextualMessages.length - 1 && imageParts.length
      ? { ...m, content: [{ type: 'text', text: m.content }, ...imageParts] }
      : m);

    const r = await requestJson(`${provider.base}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer not-needed' },
      body: JSON.stringify({ model: provider.model, messages: converted, temperature: 0.7 })
    });
    const responseText = await r.text();
    let data = null;
    try { data = responseText ? JSON.parse(responseText) : null; } catch {}
    if (!r.ok) {
      const upstreamError = data?.error?.message || data?.message || responseText?.slice(0, 1000) || 'ApiBeam request failed';
      return res.status(r.status >= 400 && r.status < 600 ? r.status : 502).json({ error: upstreamError });
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
      let domain = '';
      try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch {}
      seenUrls.add(url);
      citationSources.push({ url, title: String(title || domain || `Source ${fallbackIndex + 1}`), domain, refs });
    };
    const walkAnnotations = (value) => {
      if (!value) return;
      if (Array.isArray(value)) { value.forEach(walkAnnotations); return; }
      if (typeof value !== 'object') return;
      addSource(value, citationSources.length);
      Object.entries(value).forEach(([key, child]) => {
        if (!['url', 'source_url', 'href', 'link', 'uri'].includes(key)) walkAnnotations(child);
      });
    };
    walkAnnotations(annotations);

    const rawText = String(message?.content || data?.text || 'No response returned.');
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
    const message = e?.name === 'AbortError' ? 'Upstream request timed out' : e?.message || 'Unexpected server error';
    return res.status(e?.name === 'AbortError' ? 504 : 500).json({ error: message });
  }
}
