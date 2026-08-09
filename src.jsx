import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Plus, Paperclip, ArrowUp, MessageSquare, FolderPlus, ChevronDown, X, Copy, RotateCcw, Download, Calculator, Globe, Code2, Sparkles } from 'lucide-react';
import './style.css';

const models = [
  ['gpt-5.6-luna', 'GPT-5.6 Luna'],
  ['gpt-5.6-terra', 'GPT-5.6 Terra'],
  ['gemini-pro-latest', 'Gemini Pro'],
  ['gemini-flash-latest', 'Gemini Flash'],
  ['gemini-flash-lite-latest', 'Gemini Flash Lite']
];
const modes = {
  chat: { label: 'Chat', icon: Sparkles, prompt: 'Answer helpfully, accurately and clearly. Preserve conversation context.' },
  research: { label: 'Research', icon: Globe, prompt: 'Act as a research assistant. Prefer careful sourcing and distinguish known facts from uncertainty. If web browsing/search tools are available through the connected ChatGPT session, use them when current information is required. Never invent sources or claim to have browsed when you did not.' },
  coding: { label: 'Code', icon: Code2, prompt: 'Act as an expert software engineer. Give robust, maintainable code, explain important assumptions, and pay attention to edge cases and security.' },
  analysis: { label: 'Analyse', icon: Calculator, prompt: 'Analyse the supplied material carefully. Extract useful structure, identify uncertainty, compare evidence, and give a concise conclusion followed by useful detail.' }
};

const id = () => crypto.randomUUID();
function load(key, fallback) { try { const value = JSON.parse(localStorage.getItem(key) || 'null'); return Array.isArray(value) ? value : fallback; } catch { return fallback; } }
function safeText(text, max = 120000) { return String(text || '').slice(0, max); }
function localTool(text) {
  const match = text.trim().match(/^(?:calculate|calc)\s+([0-9+\-*/().,%\s]+)$/i);
  if (!match) return null;
  const expr = match[1].replace(/%/g, '/100');
  if (!/^[0-9+\-*/().\s]+$/.test(expr)) return null;
  try {
    const value = Function(`"use strict"; return (${expr})`)();
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    return `Calculator result: ${value}`;
  } catch { return null; }
}

function App() {
  const [chats, setChats] = useState(() => load('tml-chats', []));
  const [folders, setFolders] = useState(() => load('tml-folders', []));
  const [active, setActive] = useState(null);
  const [model, setModel] = useState('gpt-5.6-luna');
  const [mode, setMode] = useState('chat');
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);
  const textareaRef = useRef(null);
  const chat = chats.find((item) => item.id === active) || null;

  useEffect(() => { try { localStorage.setItem('tml-chats', JSON.stringify(chats)); localStorage.setItem('tml-folders', JSON.stringify(folders)); } catch {} }, [chats, folders]);
  useEffect(() => { if (!active && chats[0]) setActive(chats[0].id); if (active && !chats.some((item) => item.id === active)) setActive(chats[0]?.id || null); }, [active, chats]);

  const createChat = () => { const c = { id: id(), title: 'New chat', messages: [], folder: null, updated: Date.now() }; setChats((current) => [c, ...current]); setActive(c.id); return c; };

  const attach = async (event) => {
    const selected = [...(event.target.files || [])].slice(0, 6 - files.length);
    const next = await Promise.all(selected.map((file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, type: file.type || 'application/octet-stream', size: file.size, data: String(reader.result).split(',')[1] || '', text: /^text\/(plain|csv|markdown)/i.test(file.type) || /\.(txt|csv|md|json|xml|log)$/i.test(file.name) ? safeText(String(reader.result)) : '' });
      reader.onerror = () => reject(reader.error || new Error(`Could not read ${file.name}`));
      if (/^text\//i.test(file.type) || /\.(txt|csv|md|json|xml|log)$/i.test(file.name)) reader.readAsText(file); else reader.readAsDataURL(file);
    })));
    setFiles((current) => [...current, ...next].slice(0, 6)); event.target.value = '';
  };

  const send = async (overrideText = null) => {
    const content = (overrideText ?? text).trim();
    if (busy || (!content && !files.length)) return;
    let currentChat = chat; if (!currentChat) currentChat = createChat();
    const attachments = files;
    const fileContext = attachments.filter((f) => f.text).map((f) => `\n\n[Attached text file: ${f.name}]\n${f.text}`).join('');
    const toolResult = localTool(content);
    const userMessage = { id: id(), role: 'user', content: content || 'Please analyse the attached file(s).', files: attachments.map(({ name, type }) => ({ name, type })) };
    const messages = [...currentChat.messages, userMessage];
    const chatId = currentChat.id;
    setBusy(true); setText(''); setFiles([]);
    setChats((current) => current.map((item) => item.id === chatId ? { ...item, title: item.messages.length ? item.title : (content.slice(0, 48) || 'Attached files'), messages, updated: Date.now() } : item));
    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model, mode, messages, attachments, fileContext, toolResult }) });
      let data = {}; try { data = await response.json(); } catch {}
      if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
      if (!data.text) throw new Error('The model returned an empty response.');
      setChats((current) => current.map((item) => item.id === chatId ? { ...item, messages: [...messages, { id: id(), role: 'assistant', content: data.text }], updated: Date.now() } : item));
    } catch (error) {
      setChats((current) => current.map((item) => item.id === chatId ? { ...item, messages: [...messages, { id: id(), role: 'assistant', content: `Error: ${error.message || 'Unable to send message.'}` }], updated: Date.now() } : item));
    } finally { setBusy(false); textareaRef.current?.focus(); }
  };

  const regenerate = (messageIndex) => {
    if (!chat || busy || messageIndex < 1) return;
    const previous = chat.messages[messageIndex - 1];
    if (previous?.role !== 'user') return;
    setChats((current) => current.map((item) => item.id === chat.id ? { ...item, messages: item.messages.slice(0, messageIndex), updated: Date.now() } : item));
    setTimeout(() => send(previous.content), 0);
  };
  const copy = async (content) => { try { await navigator.clipboard.writeText(content); } catch {} };
  const exportChat = () => { if (!chat) return; const blob = new Blob([chat.messages.map((m) => `${m.role.toUpperCase()}\n${m.content}`).join('\n\n')], { type: 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${chat.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'chat'}.txt`; a.click(); URL.revokeObjectURL(a.href); };
  const handleKeyDown = (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } };
  const newFolder = () => { const name = prompt('Folder name'); if (name?.trim()) setFolders((current) => [...current, { id: id(), name: name.trim() }]); };
  const ModeIcon = modes[mode].icon;

  return <div className="app">
    <aside><div className="brand">Thank Me Later</div><button className="new" onClick={createChat}><Plus />New chat</button><button className="folderbtn" onClick={newFolder}><FolderPlus />New folder</button><small>CHATS</small>{chats.map((item) => <button key={item.id} className={`chat ${item.id === active ? 'active' : ''}`} onClick={() => setActive(item.id)}><MessageSquare />{item.title}</button>)}</aside>
    <main>
      <header>
        <div className="toolbar">
          <div className="model"><button type="button" onClick={() => { setOpen((v) => !v); setModeOpen(false); }} aria-expanded={open}>{models.find((item) => item[0] === model)?.[1] || model}<ChevronDown size={16} /></button>{open && <div className="models">{models.map((item) => <button type="button" key={item[0]} onClick={() => { setModel(item[0]); setOpen(false); }}>{item[1]}</button>)}</div>}</div>
          <div className="mode"><button type="button" onClick={() => { setModeOpen((v) => !v); setOpen(false); }}><ModeIcon size={15} />{modes[mode].label}<ChevronDown size={14} /></button>{modeOpen && <div className="models mode-list">{Object.entries(modes).map(([key, item]) => { const Icon = item.icon; return <button key={key} onClick={() => { setMode(key); setModeOpen(false); }}><Icon size={15} />{item.label}</button>; })}</div>}</div>
          {chat && <button className="export" onClick={exportChat} title="Export chat"><Download size={16} /></button>}
        </div>
      </header>
      <section>
        {!chat ? <div className="hero"><h1>How can I help you today?</h1><p>Chat, research, code, analyse files, or use built-in tools.</p><div className="quick"><button onClick={() => { setMode('research'); setText('Research '); textareaRef.current?.focus(); }}><Globe />Research</button><button onClick={() => { setMode('coding'); setText('Help me code '); textareaRef.current?.focus(); }}><Code2 />Code</button><button onClick={() => { setText('calculate '); textareaRef.current?.focus(); }}><Calculator />Calculate</button></div></div> : chat.messages.map((message, index) => <div key={message.id} className={`msg ${message.role}`}><div className="bubble">{message.files?.map((file, i) => <span key={i} className="file"><Paperclip size={12} /> {file.name}</span>)}<div className="content">{message.content}</div>{message.role === 'assistant' && !message.content.startsWith('Error:') && <div className="actions"><button onClick={() => copy(message.content)} title="Copy"><Copy size={14} /></button><button onClick={() => regenerate(index)} title="Regenerate"><RotateCcw size={14} /></button></div>}</div></div>)}
        {busy && <div className="msg assistant"><div className="bubble"><span className="dots">Thinking<span>.</span><span>.</span><span>.</span></span></div></div>}
      </section>
      <footer>
        {files.length > 0 && <div className="pending">{files.map((file, index) => <span key={`${file.name}-${index}`}><Paperclip size={12} />{file.name}<button type="button" aria-label={`Remove ${file.name}`} onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}><X size={12} /></button></span>)}</div>}
        <div className="composer"><label title="Attach files"><Paperclip /><input type="file" multiple onChange={attach} /></label><textarea ref={textareaRef} value={text} onChange={(event) => setText(event.target.value)} onKeyDown={handleKeyDown} placeholder={mode === 'research' ? 'Ask for research…' : mode === 'coding' ? 'Describe what you want to code…' : 'Message Thank Me Later…'} rows={1} /><button type="button" aria-label="Send message" disabled={busy || (!text.trim() && !files.length)} onClick={() => send()}><ArrowUp /></button></div><div className="hint">Enter to send · Shift+Enter for a new line · <b>{modes[mode].label}</b> mode</div>
      </footer>
    </main>
  </div>;
}
createRoot(document.getElementById('root')).render(<App />);
