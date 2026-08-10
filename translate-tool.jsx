import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowLeftRight,
  Check,
  ChevronDown,
  Clipboard,
  Globe2,
  Languages,
  Mic2,
  Search,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react';
import './translate-tool.css';

const LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Dutch',
  'Polish', 'Arabic', 'Chinese (Simplified)', 'Japanese', 'Korean', 'Hindi',
  'Turkish', 'Russian', 'Greek',
];

const SPEECH_CODES = {
  English: 'en-US', Spanish: 'es-ES', French: 'fr-FR', German: 'de-DE', Italian: 'it-IT',
  Portuguese: 'pt-PT', Dutch: 'nl-NL', Polish: 'pl-PL', Arabic: 'ar-SA',
  'Chinese (Simplified)': 'zh-CN', Japanese: 'ja-JP', Korean: 'ko-KR', Hindi: 'hi-IN',
  Turkish: 'tr-TR', Russian: 'ru-RU', Greek: 'el-GR',
};

function LanguagePicker({ value, onChange, detect = false, align = 'left' }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);
  const filtered = LANGUAGES.filter(language => language.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    const close = event => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div className={`translate-language-wrap ${align === 'right' ? 'align-right' : ''}`} ref={rootRef}>
      <button
        className={`translate-language ${open ? 'is-open' : ''}`}
        type="button"
        onClick={() => setOpen(current => !current)}
        aria-expanded={open}
      >
        <Globe2 size={15} />
        <span>{value}</span>
        <ChevronDown size={14} className={open ? 'rotate' : ''} />
      </button>
      {open && (
        <div className="translate-language-menu">
          <div className="translate-search">
            <Search size={14} />
            <input
              autoFocus
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search languages"
              aria-label="Search languages"
            />
          </div>
          {detect && (
            <button
              className={`translate-language-option ${value === 'Detect language' ? 'selected' : ''}`}
              type="button"
              onClick={() => { onChange('Detect language'); setOpen(false); setQuery(''); }}
            >
              <span className="detect-dot" />
              Detect language
            </button>
          )}
          <div className="translate-language-list">
            {filtered.map(language => (
              <button
                className={`translate-language-option ${value === language ? 'selected' : ''}`}
                type="button"
                key={language}
                onClick={() => { onChange(language); setOpen(false); setQuery(''); }}
              >
                {language}
                {value === language && <Check size={14} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TranslateTool({ onClose }) {
  const [tab, setTab] = useState('text');
  const [source, setSource] = useState('English');
  const [target, setTarget] = useState('Spanish');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const swap = () => {
    if (source === 'Detect language') {
      setSource(target);
      setTarget('English');
    } else {
      setSource(target);
      setTarget(source);
    }
    setOutput('');
    setError('');
  };

  const translate = async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    setError('');
    setOutput('');
    setCopied(false);

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: input, sourceLanguage: source, targetLanguage: target }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Translation failed. Please try again.');
      setOutput(typeof data.translation === 'string' ? data.translation : '');
    } catch (translationError) {
      setError(translationError?.message || 'Translation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const clear = () => {
    setInput('');
    setOutput('');
    setError('');
    setCopied(false);
  };

  const copy = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  };

  const listen = () => {
    if (!output || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(output);
    utterance.lang = SPEECH_CODES[target] || 'en-US';
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  };

  const inputCount = input.length;
  const outputCount = output.length;

  return (
    <div className="translate-overlay">
      <button className="translate-backdrop" type="button" aria-label="Close Translate" onClick={onClose} />
      <section className="translate-workspace" role="dialog" aria-modal="true" aria-label="Translate">
        <header className="translate-header">
          <div className="translate-title-wrap">
            <div className="translate-app-icon"><Languages size={20} strokeWidth={2} /></div>
            <div>
              <div className="translate-kicker">TOOL</div>
              <h1>Translate</h1>
            </div>
          </div>
          <button className="translate-close" type="button" onClick={onClose} aria-label="Close Translate">
            <X size={18} />
          </button>
        </header>

        <div className="translate-rule" />

        <nav className="translate-tabs" aria-label="Translation mode">
          <button className={tab === 'text' ? 'active' : ''} type="button" onClick={() => setTab('text')}>
            <Languages size={15} />
            Text
          </button>
          <button className={tab === 'audio' ? 'active' : ''} type="button" onClick={() => setTab('audio')}>
            <Mic2 size={15} />
            Audio
          </button>
        </nav>

        {tab === 'text' ? (
          <main className="translate-content text-mode">
            <div className="translate-hero">
              <h2>Translate anything.</h2>
              <p>Write naturally. We'll handle the language.</p>
            </div>

            <div className="translate-panels">
              <article className="translate-panel source-panel">
                <div className="panel-top">
                  <div>
                    <span className="panel-label">FROM</span>
                    <LanguagePicker value={source} onChange={setSource} detect />
                  </div>
                  <span className="panel-count">{inputCount.toLocaleString()} / 5,000</span>
                </div>
                <textarea
                  value={input}
                  onChange={event => { setInput(event.target.value.slice(0, 5000)); if (error) setError(''); }}
                  placeholder="Type or paste text here..."
                  aria-label="Text to translate"
                />
                <div className="panel-bottom">
                  <span className="panel-hint">Tip: paste a sentence, paragraph, or longer text.</span>
                  {input && <button className="text-action" type="button" onClick={clear}>Clear</button>}
                </div>
              </article>

              <button className="swap-language" type="button" onClick={swap} aria-label="Swap languages" title="Swap languages">
                <ArrowLeftRight size={16} />
              </button>

              <article className="translate-panel target-panel">
                <div className="panel-top">
                  <div>
                    <span className="panel-label">TO</span>
                    <LanguagePicker value={target} onChange={setTarget} align="right" />
                  </div>
                  <span className="panel-count">{outputCount.toLocaleString()}</span>
                </div>
                <div className="translation-output">
                  {loading ? (
                    <div className="translation-state">
                      <span className="translation-spinner" />
                      <strong>Translating</strong>
                      <span>Finding the most natural wording...</span>
                    </div>
                  ) : error ? (
                    <div className="translation-state error-state">
                      <strong>Something went wrong</strong>
                      <span>{error}</span>
                      <button className="retry-button" type="button" onClick={translate}>Try again</button>
                    </div>
                  ) : output ? (
                    <div className="translation-result">{output}</div>
                  ) : (
                    <div className="translate-empty">
                      <div className="empty-orbit"><Languages size={20} /></div>
                      <strong>Your translation will appear here</strong>
                      <span>Choose a language and translate when you're ready.</span>
                    </div>
                  )}
                </div>
                <div className="panel-bottom output-actions">
                  {output ? (
                    <div className="output-buttons">
                      <button type="button" onClick={copy}><Clipboard size={13} />{copied ? 'Copied' : 'Copy'}</button>
                      <button type="button" onClick={listen}><Volume2 size={13} />Listen</button>
                    </div>
                  ) : (
                    <span className="panel-hint">{loading ? 'Working on your translation' : 'Ready'}</span>
                  )}
                </div>
              </article>
            </div>

            <div className="translate-action-row">
              <button className="primary-translate" type="button" onClick={translate} disabled={!input.trim() || loading}>
                <Sparkles size={15} />
                {loading ? 'Translating...' : 'Translate'}
              </button>
              <span className="translate-powered">Powered by Gemini 3.5 Flash-Lite</span>
            </div>
          </main>
        ) : (
          <main className="translate-content audio-mode">
            <div className="translate-hero">
              <h2>Speak naturally.</h2>
              <p>Audio translation is ready for the next step of the workspace.</p>
            </div>
            <div className="audio-stage">
              <div className="audio-language-bar">
                <LanguagePicker value={source} onChange={setSource} detect />
                <button className="audio-arrow" type="button" onClick={swap} aria-label="Swap languages"><ArrowLeftRight size={14} /></button>
                <LanguagePicker value={target} onChange={setTarget} />
              </div>
              <div className="mic-halo">
                <div className="mic-ring ring-one" />
                <div className="mic-ring ring-two" />
                <button className="mic-button" type="button" disabled aria-label="Audio translation unavailable"><Mic2 size={28} /></button>
              </div>
              <strong className="audio-status">Audio translation coming next</strong>
              <span className="audio-hint">Text translation is available now.</span>
            </div>
          </main>
        )}

        <footer className="translate-footer">
          <span><span className="footer-status" />Translate workspace</span>
          <span className="footer-model">Gemini 3.5 Flash-Lite</span>
        </footer>
      </section>
    </div>
  );
}

let mounted = false;

export function mountTranslateTool() {
  if (mounted || typeof document === 'undefined') return;
  mounted = true;

  const host = document.body || document.documentElement;
  const button = document.createElement('button');
  button.id = 'tml-translate-sidebar-button';
  button.type = 'button';
  button.setAttribute('aria-label', 'Open Translate');
  button.setAttribute('data-translate-button', 'true');
  button.innerHTML = '<span class="tml-translate-button-icon"></span><span>Translate</span>';

  let overlayHost = document.getElementById('tml-translate-root');
  if (!overlayHost) {
    overlayHost = document.createElement('div');
    overlayHost.id = 'tml-translate-root';
    overlayHost.setAttribute('data-translate-ui', 'true');
    host.appendChild(overlayHost);
  }

  let open = false;
  const reactRoot = createRoot(overlayHost);
  const render = () => reactRoot.render(
    open ? <TranslateTool onClose={() => { open = false; render(); }} /> : null,
  );

  button.onclick = () => { open = true; render(); };
  host.appendChild(button);
  render();
}
