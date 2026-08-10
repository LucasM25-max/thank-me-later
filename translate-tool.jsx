import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowLeftRight, ChevronDown, Globe2, Languages, Mic2, Search, Sparkles, Volume2, X } from 'lucide-react';
import './translate-tool.css';

const LANGUAGES = ['English','Spanish','French','German','Italian','Portuguese','Dutch','Polish','Arabic','Chinese (Simplified)','Japanese','Korean','Hindi','Turkish','Russian','Greek'];
const SPEECH_CODES = {'English':'en-US','Spanish':'es-ES','French':'fr-FR','German':'de-DE','Italian':'it-IT','Portuguese':'pt-PT','Dutch':'nl-NL','Polish':'pl-PL','Arabic':'ar-SA','Chinese (Simplified)':'zh-CN','Japanese':'ja-JP','Korean':'ko-KR','Hindi':'hi-IN','Turkish':'tr-TR','Russian':'ru-RU','Greek':'el-GR'};

function LanguagePicker({ value, onChange, detect = false }) {
  const [open, setOpen] = useState(false); const [query, setQuery] = useState('');
  const filtered = LANGUAGES.filter(language => language.toLowerCase().includes(query.toLowerCase()));
  return <div className="translate-language-wrap">
    <button className="translate-language" onClick={() => setOpen(v => !v)} aria-expanded={open}><span className="translate-language-icon"><Globe2 size={15}/></span><span>{value}</span><ChevronDown size={15} className={open ? 'rotate' : ''}/></button>
    {open && <div className="translate-language-menu"><div className="translate-search"><Search size={14}/><input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search languages"/></div>{detect && <button className="translate-language-option" onClick={() => {onChange('Detect language');setOpen(false);setQuery('')}}><span className="detect-dot"/>Detect language</button>}<div className="translate-language-list">{filtered.map(language => <button className="translate-language-option" key={language} onClick={() => {onChange(language);setOpen(false);setQuery('')}}>{language}</button>)}</div></div>}
  </div>;
}

function TranslateTool({ onClose }) {
  const [tab, setTab] = useState('text'); const [source, setSource] = useState('English'); const [target, setTarget] = useState('Spanish');
  const [input, setInput] = useState(''); const [output, setOutput] = useState(''); const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const [copied, setCopied] = useState(false);
  const swap = () => { if (source === 'Detect language') { setSource(target); setTarget('English'); } else { setSource(target); setTarget(source); } setOutput(''); setError(''); };
  const translate = async () => {
    if (!input.trim() || loading) return;
    setLoading(true); setError(''); setOutput(''); setCopied(false);
    try {
      const response = await fetch('/api/translate', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ text:input, sourceLanguage:source, targetLanguage:target }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Translation failed. Please try again.');
      setOutput(typeof data.translation === 'string' ? data.translation : '');
    } catch (e) { setError(e?.message || 'Translation failed. Please try again.'); } finally { setLoading(false); }
  };
  const clear = () => { setInput(''); setOutput(''); setError(''); setCopied(false); };
  const copy = async () => { if (!output) return; try { await navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch {} };
  const listen = () => { if (!output || !('speechSynthesis' in window)) return; window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(output); utterance.lang = SPEECH_CODES[target] || 'en-US'; utterance.rate = 0.95; window.speechSynthesis.speak(utterance); };
  return <div className="translate-overlay"><div className="translate-backdrop" onClick={onClose}/><section className="translate-workspace" role="dialog" aria-label="Translate">
    <div className="translate-glow translate-glow-a"/><div className="translate-glow translate-glow-b"/>
    <header className="translate-header"><div className="translate-title-wrap"><div className="translate-app-icon"><Languages size={21}/></div><div><h1>Translate</h1><p>Words, conversations, and ideas — in any language.</p></div></div><button className="translate-close" onClick={onClose} aria-label="Close Translate"><X size={19}/></button></header>
    <nav className="translate-tabs" aria-label="Translation mode"><button className={tab === 'text' ? 'active' : ''} onClick={() => setTab('text')}><span className="tab-orb"><Languages size={16}/></span>Text<span className="tab-shine"/></button><button className={tab === 'audio' ? 'active' : ''} onClick={() => setTab('audio')}><span className="tab-orb"><Mic2 size={16}/></span>Audio<span className="tab-shine"/></button></nav>
    {tab === 'text' ? <main className="translate-content text-mode"><div className="translate-hero"><span className="eyebrow"><Sparkles size={12}/> TRANSLATION STUDIO</span><h2>Say it in another language.</h2><p>Choose your languages, then bring your words across.</p></div>
      <div className="translate-panels"><article className="translate-panel source-panel"><div className="panel-top"><LanguagePicker value={source} onChange={setSource} detect/><span className="panel-meta">SOURCE</span></div><textarea value={input} onChange={e => {setInput(e.target.value);if(error)setError('')}} placeholder="Type or paste text here…" spellCheck="true"/><div className="panel-bottom"><span>{input.length.toLocaleString()} characters</span><button className="subtle-action" onClick={clear}>Clear</button></div></article>
        <button className="swap-language" onClick={swap} aria-label="Swap languages"><ArrowLeftRight size={17}/></button>
        <article className="translate-panel target-panel"><div className="panel-top"><LanguagePicker value={target} onChange={setTarget}/><span className="panel-meta">TRANSLATION</span></div><div className="translation-output">{loading ? <div className="translation-state"><span className="translation-spinner"/><strong>Translating…</strong><span>Gemini is working on your translation.</span></div> : error ? <div className="translation-state error-state"><div className="error-orb">!</div><strong>Translation failed</strong><span>{error}</span><button className="retry-button" onClick={translate}>Try again</button></div> : output ? <div className="translation-result">{output}</div> : <div className="translate-empty"><div className="empty-orbit"><Languages size={23}/></div><strong>Your translation will appear here</strong><span>Clear, natural, and ready to use.</span></div>}</div><div className="panel-bottom output-actions"><span className="ready-dot"/>{output ? <div className="output-buttons"><button onClick={copy}>{copied ? 'Copied' : 'Copy'}</button><button onClick={listen}><Volume2 size={13}/> Listen</button></div> : <span>{loading ? 'Processing securely' : 'Ready to translate'}</span>}</div></article></div>
      <div className="translate-action-row"><button className="primary-translate" onClick={translate} disabled={!input.trim() || loading}><Sparkles size={15}/>{loading ? 'Translating…' : 'Translate'}</button><span>Powered by Gemini 3.5 Flash-Lite</span></div>
    </main> : <main className="translate-content audio-mode"><div className="audio-hero"><span className="eyebrow"><span className="live-pip"/> LIVE TRANSLATION</span><h2>Speak naturally.</h2><p>Your conversation, translated as it happens.</p></div><div className="audio-stage"><div className="audio-language-bar"><LanguagePicker value={source} onChange={setSource} detect/><div className="audio-arrow"><ArrowLeftRight size={15}/></div><LanguagePicker value={target} onChange={setTarget}/></div><div className="mic-halo"><div className="mic-ring ring-one"/><div className="mic-ring ring-two"/><button className="mic-button" aria-label="Start audio translation"><Mic2 size={31}/><span/></button></div><strong className="audio-status">Ready when you are</strong><span className="audio-hint">Tap the microphone to begin a live translation session.</span><div className="audio-wave"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div></div></main>}
    <footer className="translate-footer"><span><span className="footer-status"/>Translation workspace</span><span className="footer-model">Text translation · Gemini 3.5 Flash-Lite</span></footer>
  </section></div>;
}

export function mountTranslateTool() {
  if (document.getElementById('tml-translate-root')) return;
  const root = document.createElement('div'); root.id = 'tml-translate-root'; document.body.appendChild(root); let close = () => {};
  const open = () => { root.dataset.open='true'; render(); }; close = () => { root.dataset.open='false'; render(); };
  const render = () => createRoot(root).render(root.dataset.open === 'true' ? <TranslateTool onClose={close}/> : null);
  const button = document.createElement('button'); button.className='translate-sidebar-button'; button.type='button'; button.setAttribute('aria-label','Translate'); button.innerHTML='<span class="translate-sidebar-icon">⌁</span><span>Translate</span>'; button.addEventListener('click',open);
  const attach = () => { const sidebar = [...document.querySelectorAll('aside,nav,[data-sidebar],div')].find(el => { const r=el.getBoundingClientRect(); return r.left < 30 && r.width >= 190 && r.width <= 340 && r.height > 400; }); if(sidebar){ button.style.position='absolute'; button.style.left='14px'; button.style.top='auto'; button.style.bottom='86px'; button.style.zIndex='99999'; sidebar.style.position=sidebar.style.position==='static'?'relative':sidebar.style.position; sidebar.appendChild(button); return true; } button.style.position='fixed'; button.style.left='14px'; button.style.bottom='86px'; button.style.zIndex='99999'; if(!button.parentElement)document.body.appendChild(button); return false; };
  document.body.appendChild(button); attach(); const observer=new MutationObserver(() => { if(!button.isConnected) document.body.appendChild(button); attach(); }); observer.observe(document.body,{childList:true,subtree:true}); root._tmlButton=button;
}
