export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({error:'Method not allowed'})
  try {
    const {model, messages, attachments=[]} = req.body || {}
    if (!model || !Array.isArray(messages)) return res.status(400).json({error:'Missing model or messages'})
    const isGemini = model.startsWith('gemini-')
    if (isGemini) {
      if (!process.env.GEMINI_API_KEY) return res.status(500).json({error:'GEMINI_API_KEY is not configured'})
      const parts=[]
      for (const m of messages) {
        if (m.role === 'system') continue
        if (m.role === 'assistant') parts.push({role:'model',parts:[{text:m.content}]})
        else parts.push({role:'user',parts:[{text:m.content}]})
      }
      if (attachments.length) {
        const last = parts[parts.length-1]
        last.parts.push(...attachments.map(a => ({inlineData:{mimeType:a.type || 'application/octet-stream', data:a.data}})))
      }
      const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({contents:parts.map(x=>({role:x.role,parts:x.parts})),generationConfig:{temperature:.7}})})
      const data=await r.json()
      if(!r.ok) return res.status(r.status).json({error:data?.error?.message || 'Gemini request failed'})
      const text=data?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('') || 'No response returned.'
      return res.status(200).json({text})
    }
    const base=(process.env.APIBEAM_BASE_URL||'').replace(/\/$/,'')
    if(!base) return res.status(500).json({error:'APIBEAM_BASE_URL is not configured'})
    const content=[]
    for (const a of attachments) if (a.type?.startsWith('image/')) content.push({type:'image_url',image_url:{url:`data:${a.type};base64,${a.data}`}})
    const converted=messages.map((m,i)=> i===messages.length-1 && attachments.length ? {...m,content:[{type:'text',text:m.content},...content]} : m)
    const r=await fetch(`${base}/chat/completions`,{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer not-needed'},body:JSON.stringify({model:process.env.APIBEAM_MODEL||'gpt-5.6-luna',messages:converted,temperature:.7})})
    const data=await r.json()
    if(!r.ok) return res.status(r.status).json({error:data?.error?.message || data?.message || 'ApiBeam request failed'})
    const text=data?.choices?.[0]?.message?.content || data?.text || 'No response returned.'
    return res.status(200).json({text})
  } catch(e) { return res.status(500).json({error:e.message || 'Unexpected server error'}) }
}
