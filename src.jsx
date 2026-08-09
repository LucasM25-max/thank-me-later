import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Plus, Paperclip, ArrowUp, MessageSquare, ChevronDown, X, Copy, RotateCcw, Download, Calculator, Globe, Code2, Sparkles, Terminal, PanelLeftClose, PanelLeftOpen, Trash2, Play } from 'lucide-react';
import './style.css';
import './command-menu.css';

const models = [
  ['gpt-5.6-luna', 'GPT-5.6 Luna'],
  ['gemini-pro-latest', 'Gemini Pro'],
  ['gemini-flash-latest', 'Gemini Flash'],
  ['gemini-flash-lite-latest', 'Gemini Flash Lite']
];
const modes = {
  chat: { label: 'Chat', icon: Sparkles },
  research: { label: 'Research', icon: Globe },
  coding: { label: 'Code', icon: Code2 },
  analysis: { label: 'Analyse', icon: Calculator }
};
const id = () => crypto.randomUUID();
function load(key, fallback) { try { const value = JSON.parse(localStorage.getItem(key) || 'null'); return Array.isArray(value) ? value : fallback; } catch { return fallback; } }
function safeText(text, max = 120000) { return String(text || '').slice(0, max); }
function localTool(text) {
  const match = text.trim().match(/^(?:calculate|calc)\s+([0-9+\-*/().,%\s]+)$/i);
  if (!match) return null;
  const expr = match[1].replace(/%/g, '/100');
  if (!/^[0-9+\-*/().\s]+$/.test(expr)) return null;
  try { const value = Function(`"use strict"; return (${expr})`)(); return typeof value === 'number' && Number.isFinite(value) ? `Calculator result: ${value}` : null; } catch { return null; }
}
function normaliseLanguage(value) {
  const raw = String(value || '').toLowerCase().replace(/[^a-z0-9+#.-]/g, '');
  if (['js', 'javascript', 'node', 'nodejs'].includes(raw)) return 'javascript';
  if (['py', 'python', 'python3'].includes(raw)) return 'python';
  return raw;
}
function detectLanguage(code, fenceLanguage, commandLanguage) {
  const explicit = normaliseLanguage(commandLanguage) || normaliseLanguage(fenceLanguage);
  if (explicit === 'javascript' || explicit === 'python') return explicit;
  const source = String(code || '');
  if (/\bprint\s*\(/.test(source) && !/\bconsole\.(log|error|warn)\s*\(/.test(source)) return 'python';
  if (/\b(def|import|from)\s+[A-Za-z_]/.test(source) && !/[;{}]\s*$/.test(source)) return 'python';
  return 'javascript';
}
function extractRunCode(text) {
  const match = String(text || '').match(/(?:^|\n)\s*\/run-code(?:\s+([^\s`]+))?\s*(?:\r?\n)+\s*```([^\r\n`]*)\r?\n([\s\S]*?)```/i);
  if (!match) return null;
  const language = detectLanguage(match[3], match[2], match[1]);
  if (!['javascript', 'python'].includes(language)) return null;
  return { language, code: safeText(match[3], 50000), displayText: String(text).replace(match[0], '\n').replace(/\n{3,}/g, '\n\n').trim() };
}
function runInSandbox(language, code) {
  return new Promise(resolve => {
    const workerSource = `const send=(kind,value)=>self.postMessage({kind,value:String(value??'')});self.onmessage=async(e)=>{const {language,code}=e.data;try{if(language==='javascript'){self.fetch=undefined;self.XMLHttpRequest=undefined;self.WebSocket=undefined;self.EventSource=undefined;self.importScripts=undefined;let out='';const stringify=x=>{try{return typeof x==='string'?x:JSON.stringify(x)}catch{return String(x)}};const log=(...a)=>{out+=a.map(stringify).join(' ')+'\\n'};console.log=log;console.warn=log;console.error=log;const fn=new Function('console','fetch','XMLHttpRequest','WebSocket',code);const result=await fn(console,undefined,undefined,undefined);if(result!==undefined)out+=stringify(result)+'\\n';send('done',out.trim()||'(No output)')}else if(language==='python'){importScripts('https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js');const pyodide=await loadPyodide({indexURL:'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/'});let out='';pyodide.setStdout({batched:s=>{out+=s+'\\n'}});pyodide.setStderr({batched:s=>{out+='[stderr] '+s+'\\n'}});await pyodide.runPythonAsync(code);send('done',out.trim()||'(No output)')}else throw new Error('Unsupported language: '+language)}catch(err){send('error',err?.stack||err?.message||String(err))}};`;
    const worker = new Worker(URL.createObjectURL(new Blob([workerSource], { type: 'application/javascript' })));
    const timer = setTimeout(() => { worker.terminate(); resolve({ ok: false, output: 'Execution stopped: time limit exceeded (10 seconds).' }); }, 10000);
    worker.onmessage = e => { if (e.data.kind === 'done' || e.data.kind === 'error') { clearTimeout(timer); worker.terminate(); resolve({ ok: e.data.kind === 'done', output: e.data.value }); } };
    worker.onerror = e => { clearTimeout(timer); worker.terminate(); resolve({ ok: false, output: e.message || 'Sandbox error' }); };
    worker.postMessage({ language, code });
  });
}
function Markdown({ children }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
    a: ({ node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
    pre: ({ children }) => <div className="md-pre">{children}</div>,
    code: ({ inline, className, children, ...props }) => inline ? <code className="md-inline" {...props}>{children}</code> : <pre className="md-code"><code className={className} {...props}>{children}</code></pre>,
    table: ({ children }) => <div className="md-table-wrap"><table>{children}</table></div>
  }}>{children}</ReactMarkdown>;
}

function App() {
  const [chats, setChats] = useState(() => load('tml-chats', []));
  const [active, setActive] = useState(null);
  const [model, setModel] = useState('gpt-5.6-luna');
  const [mode, setMode] = useState('chat');
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const [runner, setRunner] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const textareaRef = useRef(null);
  const chat = chats.find(item => item.id === active) || null;

  useEffect(() => { try { localStorage.setItem('tml-chats', JSON.stringify(chats)); } catch {} }, [chats]);
  useEffect(() => { if (!active && chats[0]) setActive(chats[0].id); if (active && !chats.some(item => item.id === active)) setActive(chats[0]?.id || null); }, [active, chats]);

  const createChat = () => { const c = { id: id(), title: 'New chat', messages: [], updated: Date.now() }; setChats(x => [c, ...x]); setActive(c.id); return c; };
  const deleteChat = chatId => { const target = chats.find(c => c.id === chatId); if (!target || !window.confirm(`Delete “${target.title}”? This removes it from local storage.`)) return; setChats(x => x.filter(c => c.id !== chatId)); if (active === chatId) setActive(chats.find(c => c.id !== chatId)?.id || null); };
  const copy = async content => { try { await navigator.clipboard.writeText(content); } catch {} };
  const exportChat = () => { if (!chat) return; const blob = new Blob([chat.messages.map(m => `${m.role.toUpperCase()}\n${m.content}`).join('\n\n')], { type: 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${chat.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'chat'}.txt`; a.click(); URL.revokeObjectURL(a.href); };

  const attach = async event => {
    const selected = [...(event.target.files || [])].slice(0, 6 - files.length);
    try {
      const next = await Promise.all(selected.map(file => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ name: file.name, type: file.type || 'application/octet-stream', data: String(reader.result).split(',')[1] || '', text: /^text\/(plain|csv|markdown)/i.test(file.type) || /\.(txt|csv|md|json|xml|log)$/i.test(file.name) ? safeText(String(reader.result)) : '' });
        reader.onerror = () => reject(reader.error || new Error(`Could not read ${file.name}`));
        if (/^text\//i.test(file.type) || /\.(txt|csv|md|json|xml|log)$/i.test(file.name)) reader.readAsText(file); else reader.readAsDataURL(file);
      })));
      setFiles(x => [...x, ...next].slice(0, 6));
    } catch (e) { window.alert(e.message || 'Could not read attachment.'); }
    event.target.value = '';
  };

  const selectWebSearch = () => { setWebSearch(true); setText(t => t.replace(/\/$/, '')); setCommandOpen(false); textareaRef.current?.focus(); };
  const handleTextChange = e => { const value = e.target.value; setText(value); setCommandOpen(value.endsWith('/') && !webSearch); };

  const requestAI = async (messages, attachments, fileContext, toolResult) => {
    const response = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model, mode, messages, attachments, fileContext, toolResult }) });
    let data = {}; try { data = await response.json(); } catch {}
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    if (!data.text) throw new Error('The model returned an empty response.');
    return data.text;
  };

  const send = async (overrideText = null) => {
    const raw = (overrideText ?? text).trim();
    if (busy || (!raw && !files.length)) return;
    let currentChat = chat; if (!currentChat) currentChat = createChat();
    const attachments = files;
    const fileContext = attachments.filter(f => f.text).map(f => `\n\n[Attached text file: ${f.name}]\n${f.text}`).join('');
    const toolResult = localTool(raw);
    const outbound = webSearch ? `@Web search${raw ? ` ${raw}` : ''}` : raw;
    const userMessage = { id: id(), role: 'user', content: raw || 'Please analyse the attached file(s).', webSearch, files: attachments.map(({ name, type }) => ({ name, type })) };
    const messages = [...currentChat.messages, userMessage];
    const apiMessages = [...currentChat.messages, { role: 'user', content: outbound || 'Please analyse the attached file(s).' }];
    const chatId = currentChat.id;
    setBusy(true); setText(''); setFiles([]); setWebSearch(false); setCommandOpen(false);
    setChats(x => x.map(item => item.id === chatId ? { ...item, title: item.messages.length ? item.title : (raw.slice(0, 48) || 'Attached files'), messages, updated: Date.now() } : item));
    try {
      let aiText = await requestAI(apiMessages, attachments, fileContext, toolResult);
      const command = mode === 'coding' ? extractRunCode(aiText) : null;
      if (command) {
        setRunner({ language: command.language, code: command.code, status: 'running', output: '' });
        const cleaned = command.displayText || 'Running the generated code…';
        setChats(x => x.map(item => item.id === chatId ? { ...item, messages: [...messages, { id: id(), role: 'assistant', content: cleaned }], updated: Date.now() } : item));
        const result = await runInSandbox(command.language, command.code);
        setRunner({ language: command.language, code: command.code, status: result.ok ? 'done' : 'error', output: result.output });
        const toolMessage = { role: 'user', content: `[Application code execution result]\nLanguage: ${command.language}\nStatus: ${result.ok ? 'success' : 'error'}\nOutput:\n${result.output}` };
        aiText = await requestAI([...apiMessages, { role: 'assistant', content: aiText }, toolMessage], [], '', null);
        setChats(x => x.map(item => item.id === chatId ? { ...item, messages: [...messages, { id: id(), role: 'assistant', content: cleaned }, { id: id(), role: 'assistant', content: aiText }], updated: Date.now() } : item));
      } else setChats(x => x.map(item => item.id === chatId ? { ...item, messages: [...messages, { id: id(), role: 'assistant', content: aiText }], updated: Date.now() } : item));
    } catch (error) {
      setChats(x => x.map(item => item.id === chatId ? { ...item, messages: [...messages, { id: id(), role: 'assistant', content: `Error: ${error.message || 'Unable to send message.'}` }], updated: Date.now() } : item));
    } finally { setBusy(false); textareaRef.current?.focus(); }
  };

  const regenerate = (messageIndex) => { if (!chat || busy || messageIndex < 1) return; const previous = chat.messages[messageIndex - 1]; if (previous?.role !== 'user') return; setChats(x => x.map(item => item.id === chat.id ? { ...item, messages: item.messages.slice(0, messageIndex), updated: Date.now() } : item)); setTimeout(() => { setWebSearch(Boolean(previous.webSearch)); send(previous.content); }, 0); };
  const handleKeyDown = e => { if (e.key === 'Escape') { setCommandOpen(false); return; } if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };
  const ModeIcon = modes[mode].icon;

  return <div className={`app ${runner ? 'runner-open' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
    <aside className="sidebar">
      <div className="brand"><span>Thank Me Later</span><button className="icon-btn sidebar-toggle" onClick={() => setSidebarCollapsed(true)} title="Minimise sidebar"><PanelLeftClose size={17} /></button></div>
      <button className="new" onClick={createChat}><Plus size={18} /><span>New chat</span></button>
      <small>CHATS</small>
      {chats.map(item => <div key={item.id} className={`chat-row ${item.id === active ? 'active' : ''}`}><button className="chat" onClick={() => setActive(item.id)} title={item.title}><MessageSquare size={17} /><span>{item.title}</span></button><button className="delete-chat" onClick={() => deleteChat(item.id)} aria-label={`Delete ${item.title}`} title="Delete chat"><Trash2 size={14} /></button></div>)}
      {!chats.length && <div className="empty-chats">No chats yet.</div>}
    </aside>
    <main>
      <header><div className="toolbar">
        {sidebarCollapsed && <button className="icon-btn" onClick={() => setSidebarCollapsed(false)} title="Open sidebar"><PanelLeftOpen size={18} /></button>}
        <div className="model"><button type="button" onClick={() => { setModelOpen(v => !v); setModeOpen(false); }}>{models.find(item => item[0] === model)?.[1] || model}<ChevronDown size={16} /></button>{modelOpen && <div className="models">{models.map(item => <button type="button" key={item[0]} onClick={() => { setModel(item[0]); setModelOpen(false); }}>{item[1]}</button>)}</div>}</div>
        <div className="mode"><button type="button" onClick={() => { setModeOpen(v => !v); setModelOpen(false); }}><ModeIcon size={15} />{modes[mode].label}<ChevronDown size={14} /></button>{modeOpen && <div className="models mode-list">{Object.entries(modes).map(([key, item]) => { const Icon = item.icon; return <button key={key} onClick={() => { setMode(key); setModeOpen(false); }}><Icon size={15} />{item.label}</button>; })}</div>}</div>
        {chat && <button className="export" onClick={exportChat} title="Export chat"><Download size={16} /></button>}
      </div></header>
      <section>{!chat ? <div className="hero"><h1>How can I help you today?</h1><p>Chat, research, code, analyse files, or use built-in tools.</p></div> : chat.messages.map((message, index) => <div key={message.id} className={`msg ${message.role}`}><div className="bubble">{message.files?.map((file, i) => <span key={i} className="file"><Paperclip size={12} />{file.name}</span>)}<div className="content">{message.role === 'assistant' ? <Markdown>{message.content}</Markdown> : <>{message.webSearch && <span className="message-command-pill"><Globe size={13} />Web search</span>}{message.content}</>}</div>{message.role === 'assistant' && !message.content.startsWith('Error:') && <div className="actions"><button onClick={() => copy(message.content)} title="Copy"><Copy size={14} /></button><button onClick={() => regenerate(index)} title="Regenerate"><RotateCcw size={14} /></button></div>}</div></div>)}{busy && <div className="msg assistant"><div className="bubble"><span className="dots">Thinking<span>.</span><span>.</span><span>.</span></span></div></div>}</section>
      <footer>{files.length > 0 && <div className="pending">{files.map((file, index) => <span key={`${file.name}-${index}`}><Paperclip size={12} />{file.name}<button type="button" aria-label={`Remove ${file.name}`} onClick={() => setFiles(x => x.filter((_, i) => i !== index))}><X size={12} /></button></span>)}</div>}
        <div className="composer-wrap">{webSearch && <div className="active-command-pill"><Globe size={14} /><span>Web search</span><button type="button" onClick={() => setWebSearch(false)} aria-label="Remove web search"><X size={13} /></button></div>}
          {commandOpen && <div className="command-menu"><div className="command-title">Commands</div><button type="button" onClick={selectWebSearch}><span className="command-icon"><Globe size={16} /></span><span><b>Web search</b><small>Search the web for current information</small></span></button></div>}
          <div className="composer"><label title="Attach files"><Paperclip /><input type="file" multiple onChange={attach} /></label><textarea ref={textareaRef} value={text} onChange={handleTextChange} onKeyDown={handleKeyDown} placeholder={mode === 'research' ? 'Ask for research…' : mode === 'coding' ? 'Describe what you want to code…' : 'Message Thank Me Later…'} rows={1} /><button type="button" aria-label="Send message" disabled={busy || (!text.trim() && !files.length && !webSearch)} onClick={() => send()}><ArrowUp /></button></div>
        </div><div className="hint">Enter to send · Shift+Enter for a new line · <b>{modes[mode].label}</b> mode</div></footer>
    </main>
    {runner && <aside className="runner"><div className="runner-head"><div><b><Terminal size={16} /> Code Runner</b><small>{runner.language} · browser sandbox</small></div><button onClick={() => setRunner(null)} title="Close runner"><X size={16} /></button></div><div className="runner-status"><span className={`status-dot ${runner.status}`} />{runner.status === 'running' ? 'Running code…' : runner.status === 'done' ? 'Execution complete' : 'Execution error'}<span className="runner-limit">10s limit</span></div><div className="runner-code"><div className="runner-label">CODE</div><pre>{runner.code}</pre><div className="runner-actions"><button onClick={async () => { setRunner(r => ({ ...r, status: 'running', output: '' })); const result = await runInSandbox(runner.language, runner.code); setRunner(r => ({ ...r, status: result.ok ? 'done' : 'error', output: result.output })); }}><Play size={13} /> Run again</button><button onClick={() => copy(runner.code)}><Copy size={13} /> Copy</button></div></div><div className="runner-output"><div className="runner-label">OUTPUT</div><pre>{runner.output || (runner.status === 'running' ? 'Starting sandbox…' : '')}</pre></div><div className="runner-note">Code runs locally in an isolated Web Worker. It cannot access your app's DOM or server environment.</div></aside>}
  </div>;
}
createRoot(document.getElementById('root')).render(<App />);
