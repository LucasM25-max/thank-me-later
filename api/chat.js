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

    if (model !== 'gpt-5.6-luna') return res.status(400).json({ error: 'Unsupported model' });
    const base = (process.env.APIBEAM_BASE_URL || 'https://apibeam.bitsmall.in/app/ysw4a2tcac3ly44dgp4tf').replace(/\/$/, '');
    const imageParts = attachments.filter((a) => a.type?.startsWith('image/')).map((a) => ({ type: 'image_url', image_url: { url: `data:${a.type};base64,${a.data}` } }));
    const converted = contextualMessages.map((m, i) => i === contextualMessages.length - 1 && imageParts.length ? { ...m, content: [{ type: 'text', text: m.content }, ...imageParts] } : m);
    const r = await fetch(`${base}/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer not-needed' }, body: JSON.stringify({ model: process.env.APIBEAM_MODEL || 'gpt-5.6-luna', messages: converted, temperature: 0.7 }) });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data?.error?.message || data?.message || 'ApiBeam request failed' });
    return res.status(200).json({ text: data?.choices?.[0]?.message?.content || data?.text || 'No response returned.' });
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'Unexpected server error' });
  }
}
