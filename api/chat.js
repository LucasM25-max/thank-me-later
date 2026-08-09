export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({error:'Method not allowed'})
  try {
    const {model, messages, attachments=[]} = req.body || {}
    if (!model || !Array.isArray(messages)) return res.status(400).json({error:'Missing model or messages'})
    if (model.startsWith('gemini-')) {
      if (!process.env.GEMINI_API_KEY) return res.status(500).json({error:'GEMINI_API_KEY is not configured'})
      const contents=messages.filter(m=>m.role!=='system').map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.content}]}))
      if(attachments.length) contents[contents.length-1].parts.push(...attachments.map(a=>({inlineData:{mimeType:a.type||'application/octet-stream',data:a.data}})))
      const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({contents,generationConfig:{temperature:.7}})})
      const data=await r.json();if(!r.ok)return res.status(r.status).json({error:data?.error?.message||'Gemini request failed'})
      return res.status(200).json({text:data?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'No response returned.'})
    }
    const base=(process.env.APIBEAM_BASE_URL||'https://apibeam.bitsmall.in/app/ysw4a2tcac3ly44dgp4tf').replace(/\/$/,'')
    const imageParts=attachments.filter(a=>a.type?.startsWith('image/')).map(a=>({type:'image_url',image_url:{url:`data:${a.type};base64,${a.data}`}}))
    const converted=messages.map((m,i)=>i===messages.length-1&&imageParts.length?{...m,content:[{type:'text',text:m.content},...imageParts]}:m)
    const r=await fetch(`${base}/chat/completions`,{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer not-needed'},body:JSON.stringify({model:process.env.APIBEAM_MODEL||'gpt-5.6-luna',messages:converted,temperature:.7})})
    const data=await r.json();if(!r.ok)return res.status(r.status).json({error:data?.error?.message||data?.message||'ApiBeam request failed'})
    return res.status(200).json({text:data?.choices?.[0]?.message?.content||data?.text||'No response returned.'})
  } catch(e){return res.status(500).json({error:e.message||'Unexpected server error'})}
}
