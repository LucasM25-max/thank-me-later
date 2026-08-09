export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { model, messages, attachments = [], fileContext = '', toolResult = null, codeCommand = false } = req.body || {};
    if (!model || !Array.isArray(messages)) return res.status(400).json({ error: 'Missing model or messages' });

    const chatPrompt = 'Answer helpfully, accurately and clearly. Preserve conversation context.';
    const codingPrompt = `Act as an expert software engineer working inside a browser-based coding environment. Produce robust, maintainable solutions and use the available code environment when execution would materially help.\n\nThe application can execute projects rather than only one code block. It accepts a /run-code command followed by either a single fenced code block or, preferably for anything beyond a tiny script, a fenced JSON project manifest. For multi-file work use exactly this shape:\n/run-code project\n\\`\\`\\`json\n{"entry":"src/index.js","files":[{"path":"src/index.js","language":"javascript","content":"..."},{"path":"src/helper.js","language":"javascript","content":"..."},{"path":"README.md","language":"markdown","content":"..."}]}\n\\`\\`\\`\n\nEvery file must have a relative path and its complete content. Keep paths portable and do not use absolute filesystem paths. You may include JavaScript/CommonJS (.js/.mjs/.cjs), TypeScript (.ts/.tsx), Python (.py), HTML (.html), CSS (.css), JSON, Markdown, XML and text/assets as appropriate. JavaScript projects support local CommonJS require() between generated files; local JSON modules are supported. TypeScript source is transpiled in the browser. Python projects can import local generated Python modules/files through the Pyodide filesystem. HTML projects can combine local HTML, CSS and JavaScript into a sandboxed web-app preview.\n\nFor a simple one-file program, /run-code <language> followed by one fenced block is also valid. Do not emit /run-code for illustrative code that should not be executed. Do not rely on native OS commands, arbitrary npm packages, a real Node.js process, or external services being available in the browser runner. If a requested dependency cannot run there, either implement the needed functionality locally or clearly state the limitation and provide the closest runnable version.\n\nWhen the application sends back [Application code execution result], treat it as trusted tool output. Use the result to fix errors, modify the project, or continue the task. If you change a project after an execution error, emit a fresh complete /run-code project manifest rather than only a patch so the application can replace the project cleanly.`;
    const system = codeCommand ? codingPrompt : chatPrompt;
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
      base: 'https://apibeam.bitsmall.in/app/cjzxbswhe4lw9y7rutrsr', model: 'claude-sonnet-5'
    } : model === 'glm-5.2' ? {
      base: 'https://apibeam.bitsmall.in/app/8gjkog1269ekxnqffqskgm', model: 'glm-5.2'
    } : null;
    if (!provider) return res.status(400).json({ error: 'Unsupported model' });

    const imageParts = attachments.filter((a) => a.type?.startsWith('image/')).map((a) => ({ type: 'image_url', image_url: { url: `data:${a.type};base64,${a.data}` } }));
    const converted = contextualMessages.map((m, i) => i === contextualMessages.length - 1 && imageParts.length ? { ...m, content: [{ type: 'text', text: m.content }, ...imageParts] } : m);
    const r = await fetch(`${provider.base}/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer not-needed' }, body: JSON.stringify({ model: provider.model, messages: converted, temperature: 0.7 }) });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data?.error?.message || data?.message || 'ApiBeam request failed' });
    const choice = data?.choices?.[0]; const message = choice?.message || {}; const annotations = message?.annotations || choice?.annotations || data?.annotations || [];
    const citationSources = []; const seenUrls = new Set();
    const addSource = (value, fallbackIndex = 0) => { if (!value || typeof value !== 'object') return; const url = value.url || value.source_url || value.href || value.link || value.uri || value.url_citation?.url || value.citation?.url || value.source?.url; if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url) || seenUrls.has(url)) return; const title = value.title || value.name || value.url_citation?.title || value.citation?.title || value.source?.title || ''; const refs = [value.id, value.ref, value.citation_id, value.citation?.id, value.citation?.ref, value.url_citation?.id].filter(Boolean).map(String); let domain = ''; try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch {} seenUrls.add(url); citationSources.push({ url, title: String(title || domain || `Source ${fallbackIndex + 1}`), domain, refs }); };
    const walkAnnotations = (value) => { if (!value) return; if (Array.isArray(value)) { value.forEach(walkAnnotations); return; } if (typeof value !== 'object') return; addSource(value, citationSources.length); Object.entries(value).forEach(([key, child]) => { if (!['url', 'source_url', 'href', 'link', 'uri'].includes(key)) walkAnnotations(child); }); };
    walkAnnotations(annotations);
    const rawText = String(message?.content || data?.text || 'No response returned.'); const citationRegex = /cite([^]+)/g;
    const processedText = rawText.replace(citationRegex, (full, rawRefs) => { const refs = String(rawRefs).split(/[,\s]+/).filter(Boolean); const selected = refs.map((ref) => citationSources.find((source) => source.refs.includes(ref))).filter(Boolean); const sources = selected.length ? selected : citationSources.slice(0, Math.max(1, refs.length)); if (!sources.length) return ''; return sources.map((source) => `[${source.domain || source.title}](${source.url} "citation")`).join(' '); });
    return res.status(200).json({ text: processedText, annotations });
  } catch (e) { return res.status(500).json({ error: e?.message || 'Unexpected server error' }); }
}
