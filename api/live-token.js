export const maxDuration = 30;

const MODEL = 'models/gemini-3.5-live-translate-preview';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
  try {
    const { targetLanguageCode = 'en', echoTargetLanguage = false } = req.body || {};
    if (typeof targetLanguageCode !== 'string' || !/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/.test(targetLanguageCode)) return res.status(400).json({ error: 'Invalid target language code' });
    if (typeof echoTargetLanguage !== 'boolean') return res.status(400).json({ error: 'Invalid echo target language setting' });
    const now = Date.now();
    const payload = {
      uses: 1,
      expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
      newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
      liveConnectConstraints: {
        model: MODEL,
        config: {
          responseModalities: ['AUDIO'],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          translationConfig: { targetLanguageCode, echoTargetLanguage }
        }
      }
    };
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/auth_tokens', {
      method: 'POST',
      headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return res.status(response.status).json({ error: data?.error?.message || 'Gemini ephemeral token request failed' });
    return res.status(200).json({ token: data?.name, expiresAt: data?.expireTime, model: MODEL });
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Unexpected Live Translate token error' });
  }
}
