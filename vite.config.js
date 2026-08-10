import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const injectModelCatalog = () => ({
  name: 'inject-model-catalog',
  transform(code, id) {
    if (!id.endsWith('/src-code-env.jsx')) return null
    const modelBlock = /const models = \[[\s\S]*?\n\];/
    const replacement = `const models = [
  ['gpt-5.6-sol', 'GPT-5.6 Sol · 61 · Extra Limited Usage'],
  ['k3', 'Kimi K3 · 60 · Limited Usage'],
  ['qwen3.8-max', 'Qwen 3.8 Max · 58'],
  ['gpt-5.6-terra', 'GPT-5.6 Terra · 57'],
  ['claude-opus-4-8', 'Claude Opus 4.8 · 57'],
  ['claude-sonnet-5', 'Claude Sonnet 5 · 55 · Limited Usage'],
  ['glm-5.2', 'GLM 5.2 · 53 · Limited Usage'],
  ['gpt-5.6-luna', 'GPT-5.6 Luna · 52'],
  ['gemini-flash-latest', 'Gemini 3.6 Flash · 52'],
  ['minimax-m3', 'Minimax M3 · 45'],
  ['gemini-flash-lite-latest', 'Gemini 3.5 Flash-Lite · 37']
];`
    if (!modelBlock.test(code)) return null
    let transformed = code.replace(modelBlock, replacement)

    const handleFilesBlock = /const handleFiles=e=>\{[\s\S]*?e\.target\.value='';\};/
    const fixedHandleFiles = `const handleFiles=e=>{const incoming=[...e.target.files].slice(0,6);Promise.all(incoming.map(file=>new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>{const bytes=new Uint8Array(reader.result||new ArrayBuffer(0));let binary='';const chunkSize=0x8000;for(let i=0;i<bytes.length;i+=chunkSize)binary+=String.fromCharCode(...bytes.subarray(i,Math.min(i+chunkSize,bytes.length)));const data=btoa(binary);let text='';if(file.type.startsWith('text/')||/\\.(md|json|js|ts|jsx|tsx|css|html|py|txt|xml)$/i.test(file.name)){try{text=new TextDecoder().decode(bytes)}catch{}}resolve({name:file.name,type:file.type||'application/octet-stream',data,text})};reader.onerror=()=>resolve({name:file.name,type:file.type||'application/octet-stream',data:'',text:''});reader.readAsArrayBuffer(file)}))).then(next=>setFiles(next));e.target.value='';};`
    transformed = transformed.replace(handleFilesBlock, fixedHandleFiles)

    const translateComponent = `function TranslateWorkspace({onClose}){const [tab,setTab]=useState('text');const [source,setSource]=useState('Detect language');const [target,setTarget]=useState('English');const [input,setInput]=useState('');const [output,setOutput]=useState('');const [loading,setLoading]=useState(false);const [error,setError]=useState('');const languages=['Detect language','English','Spanish','French','German','Italian','Portuguese','Chinese','Japanese','Korean','Arabic','Hindi','Russian','Dutch'];const translate=async()=>{if(!input.trim()||loading)return;setLoading(true);setError('');try{const r=await fetch('/api/translate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:input,sourceLanguage:source,targetLanguage:target})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.error||'Translation failed');setOutput(d.translation||d.text||'')}catch(e){setError(e.message||'Translation failed')}finally{setLoading(false)}};const swap=()=>{if(source==='Detect language')return;setSource(target);setTarget(source);setInput(output);setOutput(input)};return <div className="tml-translate-overlay"><div className="tml-translate-shell"><div className="tml-translate-head"><div><div className="tml-translate-kicker">TOOL</div><h1>Translate</h1><p>Translate text with Gemini.</p></div><button className="tml-translate-close" onClick={onClose}><X size={18}/></button></div><div className="tml-translate-tabs"><button className={tab==='text'?'active':''} onClick={()=>setTab('text')}>Text</button><button className={tab==='audio'?'active':''} onClick={()=>setTab('audio')}>Audio</button></div>{tab==='text'?<div className="tml-translate-card"><div className="tml-translate-panel"><select value={source} onChange={e=>setSource(e.target.value)}>{languages.map(l=><option key={l}>{l}</option>)}</select><textarea value={input} onChange={e=>setInput(e.target.value)} placeholder="Enter text to translate…"/><div className="tml-translate-foot"><span>{input.length.toLocaleString()} characters</span><button onClick={()=>{setInput('');setOutput('');setError('')}}>Clear</button></div></div><button className="tml-translate-swap" onClick={swap} disabled={source==='Detect language'}>⇄</button><div className="tml-translate-panel output"><select value={target} onChange={e=>setTarget(e.target.value)}>{languages.filter(l=>l!=='Detect language').map(l=><option key={l}>{l}</option>)}</select><div className="tml-translate-result">{loading?<span className="tml-translate-muted">Translating…</span>:error?<div className="tml-translate-error">{error}<button onClick={translate}>Try again</button></div>:output?<>{output}</>:<span className="tml-translate-muted">Your translation will appear here.</span>}</div><div className="tml-translate-foot"><span></span>{output&&<><button onClick={()=>navigator.clipboard?.writeText(output)}>Copy</button><button onClick={()=>{const u=new SpeechSynthesisUtterance(output);u.lang=target;window.speechSynthesis.speak(u)}}>Listen</button></>}</div></div><div className="tml-translate-action"><button onClick={translate} disabled={loading||!input.trim()}>{loading?'Translating…':'Translate'}</button></div></div>:<div className="tml-translate-audio"><div className="tml-translate-orb">🎙</div><h2>Live translation</h2><p>Audio translation will be connected in Phase 3.</p><div className="tml-translate-route"><span>English</span><b>→</b><span>Spanish</span></div></div>}</div></div>}
`
    transformed = transformed.replace('function App(){', `${translateComponent}function App(){`)

    // Inject the button at the first actual sidebar action after the New Chat control.
    const newChatPatterns = [
      /(<button[^>]*className="new"[^>]*>[\s\S]*?<\/button>)/,
      /(<button[^>]*className='new'[^>]*>[\s\S]*?<\/button>)/,
      /(<button[^>]*>\s*<Plus[^>]*\/?>\s*<span>New chat<\/span>\s*<\/button>)/
    ]
    const sidebarButton = `<button type="button" className="translate-sidebar-button" onClick={()=>setTranslateOpen(true)}><Globe size={16}/><span>Translate</span></button>`
    let sidebarInjected = false
    for (const pattern of newChatPatterns) {
      if (pattern.test(transformed)) { transformed = transformed.replace(pattern, `$1${sidebarButton}`); sidebarInjected = true; break }
    }

    // Find the App state declaration even if minified formatting changes.
    if (/function App\(\)\{/.test(transformed)) {
      transformed = transformed.replace(/(function App\(\)\{)/, `$1const [translateOpen,setTranslateOpen]=useState(false);`)
    }

    // Render the workspace at the App root so it is guaranteed to be visible after clicking the sidebar item.
    const rootMarkers = ['<main>', '<div className="app">', '<div className="app-shell">']
    for (const marker of rootMarkers) {
      if (transformed.includes(marker)) { transformed = transformed.replace(marker, `${marker}{translateOpen&&<TranslateWorkspace onClose={()=>setTranslateOpen(false)}/>`); break }
    }

    const translateCss = `<style>.translate-sidebar-button{display:flex!important;visibility:visible!important;opacity:1!important;position:relative;z-index:20;width:calc(100% - 20px);margin:8px 10px 14px;align-items:center;gap:10px;padding:10px 12px;border:1px solid rgba(120,120,140,.22);border-radius:11px;background:rgba(255,255,255,.06);color:inherit;font:inherit;cursor:pointer;text-align:left}.translate-sidebar-button:hover{background:rgba(255,255,255,.1);border-color:rgba(120,160,255,.4)}.tml-translate-overlay{position:fixed;inset:0;z-index:9999;background:rgba(8,10,18,.78);backdrop-filter:blur(18px);display:flex;align-items:center;justify-content:center;padding:32px}.tml-translate-shell{width:min(1100px,100%);max-height:calc(100vh - 64px);overflow:auto;border:1px solid rgba(255,255,255,.12);border-radius:28px;background:linear-gradient(145deg,rgba(27,31,45,.99),rgba(13,16,27,.99));box-shadow:0 30px 100px rgba(0,0,0,.55);padding:30px}.tml-translate-head{display:flex;justify-content:space-between;align-items:flex-start}.tml-translate-kicker{font-size:11px;letter-spacing:.18em;color:#8b9cff;font-weight:700}.tml-translate-head h1{margin:4px 0;font-size:34px}.tml-translate-head p{margin:0;color:#9da4b7}.tml-translate-close{border:0;background:rgba(255,255,255,.06);color:inherit;border-radius:12px;padding:9px;cursor:pointer}.tml-translate-tabs{display:flex;gap:6px;margin:28px 0 18px;padding:5px;background:rgba(255,255,255,.05);border-radius:13px;width:max-content}.tml-translate-tabs button{border:0;background:transparent;color:#aeb5c7;padding:9px 20px;border-radius:9px;cursor:pointer;font-weight:650}.tml-translate-tabs button.active{background:#fff;color:#111827;box-shadow:0 4px 18px rgba(0,0,0,.18)}.tml-translate-card{position:relative;display:grid;grid-template-columns:1fr 1fr;gap:14px}.tml-translate-panel{min-height:360px;border:1px solid rgba(255,255,255,.1);border-radius:20px;background:rgba(255,255,255,.035);overflow:hidden;display:flex;flex-direction:column}.tml-translate-panel select{margin:0;padding:17px 18px;border:0;border-bottom:1px solid rgba(255,255,255,.08);background:transparent;color:inherit;font:inherit;font-weight:650}.tml-translate-panel textarea{flex:1;resize:none;min-height:270px;padding:20px;border:0;outline:0;background:transparent;color:inherit;font:inherit;font-size:17px;line-height:1.6}.tml-translate-result{flex:1;min-height:270px;padding:20px;font-size:17px;line-height:1.6;white-space:pre-wrap}.tml-translate-foot{display:flex;justify-content:flex-end;gap:8px;align-items:center;padding:11px 16px;color:#7f879b;font-size:12px}.tml-translate-foot span:first-child{margin-right:auto}.tml-translate-foot button,.tml-translate-error button{border:0;background:rgba(255,255,255,.07);color:inherit;border-radius:8px;padding:7px 10px;cursor:pointer}.tml-translate-swap{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2;width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,255,255,.14);background:#202638;color:#fff;cursor:pointer;box-shadow:0 8px 25px rgba(0,0,0,.3)}.tml-translate-action{grid-column:1/-1;display:flex;justify-content:center;margin-top:4px}.tml-translate-action button{border:0;border-radius:13px;padding:12px 30px;background:linear-gradient(135deg,#8b9cff,#6d7cff);color:#fff;font-weight:750;cursor:pointer;box-shadow:0 10px 30px rgba(105,120,255,.25)}.tml-translate-action button:disabled{opacity:.45;cursor:not-allowed}.tml-translate-muted{color:#737b8e}.tml-translate-error{color:#ff8f9a;display:flex;gap:12px;align-items:center;flex-wrap:wrap}.tml-translate-audio{text-align:center;padding:70px 20px 90px}.tml-translate-orb{margin:0 auto 25px;width:130px;height:130px;border-radius:50%;display:grid;place-items:center;font-size:38px;background:radial-gradient(circle at 35% 30%,#a9b4ff,#6674ff 45%,#252c55);box-shadow:0 0 70px rgba(102,116,255,.35)}.tml-translate-audio h2{font-size:27px;margin:0 0 8px}.tml-translate-audio p{color:#9299ab}.tml-translate-route{display:flex;justify-content:center;gap:18px;margin-top:28px;color:#b9c0d0}.tml-translate-route b{color:#8290ff}@media(max-width:760px){.tml-translate-overlay{padding:12px}.tml-translate-shell{padding:20px;border-radius:20px;max-height:calc(100vh - 24px)}.tml-translate-card{grid-template-columns:1fr}.tml-translate-swap{display:none}.tml-translate-panel{min-height:260px}.tml-translate-panel textarea,.tml-translate-result{min-height:180px}.tml-translate-action{grid-column:auto}.tml-translate-tabs{width:100%}.tml-translate-tabs button{flex:1}}</style>`
    transformed += translateCss
    return { code: transformed, map: null }
  }
})

export default defineConfig({ plugins: [react(), injectModelCatalog()] })