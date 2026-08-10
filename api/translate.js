export const maxDuration = 60;

const LANGUAGES = new Set(['English','Spanish','French','German','Italian','Portuguese','Dutch','Polish','Arabic','Chinese (Simplified)','Japanese','Korean','Hindi','Turkish','Russian','Greek']);

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow','POST'); return res.status(405).json({ error:'Method not allowed' }); }
  try {
    const { text, sourceLanguage = 'Detect language', targetLanguage } = req.body || {};
    if (typeof text !== 'string' || !text.trim()) return res.status(400).json({ error:'Enter some text to translate.' });
    if (!targetLanguage || !LANGUAGES.has(targetLanguage)) return res.status(400).json({ error:'Please choose a valid target language.' });
    if (sourceLanguage !== 'Detect language' && !LANGUAGES.has(sourceLanguage)) return res.status(400).json({ error:'Please choose a valid source language.' });
    if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error:'GEMINI_API_KEY is not configured.' });
    const sourceInstruction = sourceLanguage === 'Detect language' ? 'Detect the source language automatically.' : `The source language is ${sourceLanguage}.`;
    const prompt = `Translate the text below into ${targetLanguage}. ${sourceInstruction} Preserve the original meaning, tone, punctuation, paragraph breaks, names, numbers, and formatting. Do not explain your choices. Return only the translated text.\n\nTEXT TO TRANSLATE:\n${text.slice(0, 30000)}`;
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=' + encodeURIComponent(process.env.GEMINI_API_KEY), { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ contents:[{ role:'user', parts:[{ text:prompt }] }], generationConfig:{ temperature:0.2 } }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return res.status(response.status >= 400 && response.status < 600 ? response.status : 502).json({ error:data?.error?.message || 'Gemini translation request failed.' });
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const translation = parts.map(part => typeof part?.text === 'string' ? part.text : '').join('').trim();
    if (!translation) return res.status(502).json({ error:'Gemini returned an empty translation.' });
    return res.status(200).json({ translation, sourceLanguage, targetLanguage, model:'gemini-3.5-flash-lite' });
  } catch (error) { return res.status(500).json({ error:error?.message || 'Unexpected translation error.' }); }
}
