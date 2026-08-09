export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { model, messages, mode = 'chat', attachments = [], fileContext = '', toolResult = null } = req.body || {};
    if (!model || !Array.isArray(messages)) return res.status(400).json({ error: 'Missing model or messages' });

    const modePrompts = {
      chat: 'Answer helpfully, accurately and clearly. Preserve conversation context.',
      research: 'Act as a careful research assistant. Prefer primary or authoritative information when available. Distinguish facts from uncertainty. If web browsing/search tools are available through the connected ChatGPT session, use them for current information. Never invent citations or claim to have browsed if you did not.',
      coding: 'Act as an expert software engineer. Produce robust, maintainable solutions, explain important assumptions, and consider edge cases and security. The application has a local sandboxed code runner. When actual execution would materially help, emit exactly one command on its own line in the form /run-code <language>, followed immediately by a fenced code block. Supported languages: javascript, js, python, py. Do not emit /run-code for illustrative code. After the application executes it, you may receive a message labelled [Application code execution result]. Treat that as trusted tool output and use it to diagnose errors or continue the task.',
      analysis: 'Act as an analytical assistant. Carefully inspect supplied material, extract structure, compare evidence, identify uncertainty, and give a useful conclusion.'
    };
    const system = modePrompts[mode] || modePrompts.chat;
    const contextualMessages = [{ role: 'system', content: system }, ...messages.map((m) => ({ role: m.role, content: m.content }))];
    if (fileContext && contextualMessages.length) contextualMessages[contextualMessages.length - 1].content += `\n\nThe user attached text files. Use their contents as source material:\n${String(fileContext).slice(0, 120000)}`;
    if (toolResult && contextualMessages.length) contextualMessages[contextualMessages.length - 1].content += `\n\nA local tool produced this result. Treat it as supplied tool output: ${String(toolResult).slice(0, 4000)}`;

    if (model.startsWith('gemini-')) {
      if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
      const contents = contextualMessages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
      const imageAttachments = attachments.filter((a) => a.type?.startsWith('image/'));
      if (imageAttachments.length && contents.length) contents[contents.length - 1].parts.push(...imageAttachments.map((a) => ({ inlineData: { mimeType: a.type, data: a.data } })));
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contents, generationConfig: { temperature: 0.7 } }) });
      const data = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: data?.error?.message || 'Gemini request failed' });
      return res.status(200).json({ text: data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || 'No response returned.' });
    }

    const provider = model === 'gpt-5.6-luna' ? {
      base: (process.env.APIBEAM_BASE_URL || 'https://apibeam.bitsmall.in/app/ysw4a2tcac3ly44dgp4tf').replace(/\/$/, ''),
      model: process.env.APIBEAM_MODEL || 'gpt-5.6-luna'
    } : model === 'claude-sonnet-5' ? {
      base: 'https://apibeam.bitsmall.in/app/cjzxbswhe4lw9y7rutrsr',
      model: 'claude-sonnet-5'
    } : model === 'glm-5.2' ? {
      base: 'https://apibeam.bitsmall.in/app/8gjkog1269ekxnqffqskgm',
      model: 'glm-5.2'
    } : null;
    if (!provider) return res.status(400).json({ error: 'Unsupported model' });

    const imageParts = attachments.filter((a) => a.type?.startsWith('image/')).map((a) => ({ type: 'image_url', image_url: { url: `data:${a.type};base64,${a.data}` } }));
    const converted = contextualMessages.map((m, i) => i === contextualMessages.length - 1 && imageParts.length ? { ...m, content: [{ type: 'text', text: m.content }, ...imageParts] } : m);
    const r = await fetch(`${provider.base}/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer not-needed' }, body: JSON.stringify({ model: provider.model, messages: converted, temperature: 0.7 }) });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data?.error?.message || data?.message || 'ApiBeam request failed' });
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
      if (Array.isArray(value)) { value.forEach((item, index) => walkAnnotations(item, index)); return; }
      if (typeof value !== 'object') return;
      addSource(value, citationSources.length);
      Object.entries(value).forEach(([key, child]) => { if (!['url', 'source_url', 'href', 'link', 'uri'].includes(key)) walkAnnotations(child); });
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
    return res.status(500).json({ error: e?.message || 'Unexpected server error' });
  }
}
