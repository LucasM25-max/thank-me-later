import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowLeftRight, ChevronDown, Globe2, Languages, Mic2, Search, Sparkles, X } from 'lucide-react';
import './translate-tool.css';

const LANGUAGES = ['English','Spanish','French','German','Italian','Portuguese','Dutch','Polish','Arabic','Chinese (Simplified)','Japanese','Korean','Hindi','Turkish','Russian','Greek'];

function LanguagePicker({ value, onChange, detect = false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const filtered = LANGUAGES.filter(language => language.toLowerCase().includes(query.toLowerCase()));
  return <div className="translate-language-wrap">
    <button className="translate-language" onClick={() => setOpen(v => !v)} aria-expanded={open}>
      <span className="translate-language-icon"><Globe2 size={15}/></span><span>{value}</span><ChevronDown size={15} className={open ? 'rotate' : ''}/>
    </button>
    {open && <div className="translate-language-menu">
      <div className="translate-search"><Search size={14}/><input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search languages"/></div>
      {detect && <button className="translate-language-option" onClick={() => {onChange('Detect language');setOpen(false);setQuery('')}}><span className="detect-dot"/>Detect language</button>}
      <div className="translate-language-list">{filtered.map(language => <button className="translate-language-option" key={language} onClick={() => {onChange(language);setOpen(false);setQuery('')}}>{language}</button>)}</div>
    </div>}
  </div>;
}

function TranslateTool({ onClose }) {
  const [tab, setTab] = useState('text');
  const [source, setSource] = useState('English');
  const [target, setTarget] = useState('Spanish');
  const [input, setInput] = useState('');
  const swap = () => { if (source === 'Detect language') return; setSource(target); setTarget(source); };
  return <div className="translate-overlay">
    <div className="translate-backdrop" onClick={onClose}/>
    <section className="translate-workspace" role="dialog" aria-label="Translate">
      <div className="translate-glow translate-glow-a"/><div className="translate-glow translate-glow-b"/>
      <header className="translate-header">
        <div className="translate-title-wrap"><div className="translate-app-icon"><Languages size={21}/></div><div><h1>Translate</h1><p>Words, conversations, and ideas — in any language.</p></div></div>
        <button className="translate-close" onClick={onClose} aria-label="Close Translate"><X size={19}/></button>
      </header>
      <nav className="translate-tabs" aria-label="Translation mode">
        <button className={tab === 'text' ? 'active' : ''} onClick={() => setTab('text')}><span className="tab-orb"><Languages size={16}/></span>Text<span className="tab-shine"/></button>
        <button className={tab === 'audio' ? 'active' : ''} onClick={() => setTab('audio')}><span className="tab-orb"><Mic2 size={16}/></span>Audio<span className="tab-shine"/></button>
      </nav>
      {tab === 'text' ? <main className="translate-content text-mode">
        <div className="translate-hero"><span className="eyebrow"><Sparkles size={12}/> TRANSLATION STUDIO</span><h2>Say it in another language.</h2><p>Choose your languages, then bring your words across.</p></div>
        <div className="translate-panels">
          <article className="translate-panel source-panel"><div className="panel-top"><LanguagePicker value={source} onChange={setSource} detect/><span className="panel-meta">SOURCE</span></div><textarea value={input} onChange={e => setInput(e.target.value)} placeholder="Type or paste text here…" spellCheck="true"/><div className="panel-bottom"><span>{input.length.toLocaleString()} characters</span><button className="subtle-action" onClick={() => setInput('')}>Clear</button></div></article>
          <button className="swap-language" onClick={swap} aria-label="Swap languages"><ArrowLeftRight size={17}/></button>
          <article className="translate-panel target-panel"><div className="panel-top"><LanguagePicker value={target} onChange={setTarget}/><span className="panel-meta">TRANSLATION</span></div><div className="translate-empty"><div className="empty-orbit"><Languages size={23}/></div><strong>Your translation will appear here</strong><span>Clear, natural, and ready to use.</span></div><div className="panel-bottom"><span className="ready-dot"/>Ready to translate</div></article>
        </div>
      </main> : <main className="translate-content audio-mode">
        <div className="audio-hero"><span className="eyebrow"><span className="live-pip"/> LIVE TRANSLATION</span><h2>Speak naturally.</h2><p>Your conversation, translated as it happens.</p></div>
        <div className="audio-stage"><div className="audio-language-bar"><LanguagePicker value={source} onChange={setSource} detect/><div className="audio-arrow"><ArrowLeftRight size={15}/></div><LanguagePicker value={target} onChange={setTarget}/></div><div className="mic-halo"><div className="mic-ring ring-one"/><div className="mic-ring ring-two"/><button className="mic-button" aria-label="Start audio translation"><Mic2 size={31}/><span/></button></div><strong className="audio-status">Ready when you are</strong><span className="audio-hint">Tap the microphone to begin a live translation session.</span><div className="audio-wave"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div></div>
      </main>}
      <footer className="translate-footer"><span><span className="footer-status"/>Translation workspace</span><span className="footer-model">Designed for Gemini-powered translation</span></footer>
    </section>
  </div>;
}

export function mountTranslateTool() {
  if (document.getElementById('tml-translate-root')) return;
  const root = document.createElement('div'); root.id = 'tml-translate-root'; document.body.appendChild(root);
  let close = () => {};
  const open = () => { root.dataset.open = 'true'; render(); };
  close = () => { root.dataset.open = 'false'; render(); };
  const render = () => createRoot(root).render(root.dataset.open === 'true' ? <TranslateTool onClose={close}/> : null);
  const button = document.createElement('button');
  button.className = 'translate-sidebar-button'; button.type = 'button'; button.setAttribute('aria-label','Translate'); button.innerHTML = '<span class="translate-sidebar-icon">⌁</span><span>Translate</span>';
  button.addEventListener('click', open); document.body.appendChild(button);
  root._tmlButton = button;
}
