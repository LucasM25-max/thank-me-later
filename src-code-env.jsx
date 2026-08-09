import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import JSZip from 'jszip';
import { Plus, Paperclip, ArrowUp, MessageSquare, ChevronDown, X, Copy, RotateCcw, Download, Calculator, Globe, Code2, Sparkles, Terminal, PanelLeftClose, Trash2, Play, FileCode2, FolderArchive } from 'lucide-react';
import './style.css';
import './command-menu.css';

const models = [
  ['gpt-5.6-luna', 'GPT-5.6 Luna'],
  ['claude-sonnet-5', 'Claude Sonnet 5'],
  ['glm-5.2', 'GLM 5.2'],
  ['gemini-pro-latest', 'Gemini Pro'],
  ['gemini-flash-latest', 'Gemini Flash'],
  ['gemini-flash-lite-latest', 'Gemini Flash Lite']
];

// Deliberately built without literal backticks. The previous version put escaped
// Markdown fences inside a JavaScript template literal, which Vite/Rolldown parsed
// as an invalid Unicode escape during production builds.
const CODE_PROMPT = [
  'Act as an expert software engineer working inside a browser-based coding environment.',
  'Produce robust, maintainable solutions and use the available code environment when execution would materially help.',
  '',
  'The application understands a /run-code command. For a multi-file project, return a fenced JSON project manifest after /run-code project.',
  'The manifest must have this shape conceptually: {"entry":"src/index.js","files":[{"path":"src/index.js","language":"javascript","content":"..."}]}',
  'Every file must have a relative path and complete content. Keep paths portable and do not use absolute filesystem paths.',
  'Supported source types include JavaScript/CommonJS, TypeScript, Python, HTML, CSS, JSON, Markdown, XML and text.',
  'JavaScript projects can use local CommonJS require() between generated files. TypeScript source is transpiled by the browser environment. Python projects can use local generated Python files through the Pyodide filesystem.',
  'For a simple one-file program, /run-code followed by one fenced code block is valid.',
  'Do not emit /run-code for illustrative code that should not be executed.',
  'Do not rely on native OS commands, arbitrary npm packages, a real Node.js process, or external services being available in the browser runner.',
  'If a requested dependency cannot run there, implement the needed functionality locally or clearly state the limitation and provide the closest runnable version.',
  '',
  'When the application sends [Application code execution result], treat it as trusted tool output. Use it to fix errors, modify the project, or continue the task.',
  'If a project fails, emit a fresh complete /run-code project manifest rather than only a patch.'
].join('\n');

const makeId = () => crypto.randomUUID();
const MAX_FILE_SIZE = 250000;
const safeText = (value, max = 120000) => String(value || '').slice(0, max);

function loadChats() {
  try {
    const value = JSON.parse(localStorage.getItem('tml-chats') || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function languageForPath(path = '') {
  const ext = path.toLowerCase().split('.').pop();
  return ({
    js: 'javascript', mjs: 'javascript', cjs: 'javascript',
    ts: 'typescript', jsx: 'javascript', tsx: 'typescript',
    py: 'python', html: 'html', htm: 'html', css: 'css',
    json: 'json', md: 'markdown', txt: 'text', xml: 'xml',
    svg: 'html', sql: 'sql', sh: 'shell', bash: 'shell'
  })[ext] || 'text';
}

function normaliseLanguage(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9+#.-]/g, '');
}

function detectLanguage(code, fenceLanguage, commandLanguage) {
  const explicit = normaliseLanguage(commandLanguage) || normaliseLanguage(fenceLanguage);
  if (explicit) return explicit;
  return /\b(def|from|import)\s+[A-Za-z_]/.test(String(code || '')) ? 'python' : 'javascript';
}

function parseProject(text) {
  const source = String(text || '');
  const command = source.match(/(?:^|\n)\s*\/run-code(?:\s+([^\s`]+))?/i);
  if (!command) return null;

  const jsonFence = source.match(/```(?:json|project|files)\s*\n([\s\S]*?)```/i);
  if (jsonFence) {
    try {
      const parsed = JSON.parse(jsonFence[1]);
      if (Array.isArray(parsed?.files)) {
        const projectFiles = parsed.files
          .filter(file => file && typeof file.path === 'string')
          .map(file => ({
            path: file.path.replace(/^\/+/, ''),
            language: normaliseLanguage(file.language) || languageForPath(file.path),
            content: safeText(file.content, MAX_FILE_SIZE)
          }));
        if (projectFiles.length) {
          return {
            entry: parsed.entry || projectFiles[0].path,
            files: projectFiles,
            displayText: source.replace(command[0], '').replace(jsonFence[0], '').replace(/\n{3,}/g, '\n\n').trim()
          };
        }
      }
    } catch {
      // Fall through to the single-file parser.
    }
  }

  const fileBlocks = [...source.matchAll(/```file:([^\n`]+)\s*\n([\s\S]*?)```/gi)];
  if (fileBlocks.length) {
    const projectFiles = fileBlocks.map(match => ({
      path: match[1].trim(),
      language: languageForPath(match[1].trim()),
      content: safeText(match[2], MAX_FILE_SIZE)
    }));
    return {
      entry: projectFiles.find(file => /(^|\/)index\.(js|mjs|cjs|html|py)$/i.test(file.path))?.path || projectFiles[0].path,
      files: projectFiles,
      displayText: source.replace(command[0], '').replace(/```file:[^\n`]+\s*\n[\s\S]*?```/gi, '').replace(/\n{3,}/g, '\n\n').trim()
    };
  }

  const fence = source.match(/```([^\r\n`]*)\r?\n([\s\S]*?)```/i);
  if (!fence) return null;
  const language = detectLanguage(fence[2], fence[1], command[1]);
  const path = language === 'python' ? 'main.py' : language === 'html' ? 'index.html' : language === 'css' ? 'style.css' : language === 'typescript' ? 'main.ts' : 'main.js';
  return {
    entry: path,
    files: [{ path, language, content: safeText(fence[2], MAX_FILE_SIZE) }],
    displayText: source.replace(command[0], '').replace(fence[0], '').replace(/\n{3,}/g, '\n\n').trim()
  };
}

function filesObject(files) {
  return Object.fromEntries(files.map(file => [file.path, file.content]));
}

function runJavaScriptProject(project) {
  return new Promise(resolve => {
    const workerSource = `
      self.onmessage = function(event) {
        try {
          const files = event.data.files;
          const entry = event.data.entry;
          const output = [];
          const stringify = value => typeof value === 'string' ? value : JSON.stringify(value, null, 2);
          const log = (...args) => output.push(args.map(stringify).join(' '));
          console.log = log;
          console.warn = log;
          console.error = log;
          const resolvePath = (from, request) => {
            let path = request.startsWith('.') ? from.split('/').slice(0, -1).join('/') + '/' + request : request;
            path = path.replace(/\\\\/g, '/').split('/').reduce((parts, part) => {
              if (!part || part === '.') return parts;
              if (part === '..') { parts.pop(); return parts; }
              parts.push(part);
              return parts;
            }, []).join('/');
            const candidates = [path, path + '.js', path + '.json', path + '.ts', path + '/index.js', path + '/index.json'];
            return candidates.find(candidate => Object.prototype.hasOwnProperty.call(files, candidate)) || null;
          };
          const cache = new Map();
          const requireLocal = (from, request) => {
            if (!request.startsWith('.')) throw new Error('External package "' + request + '" is not available in the browser runner.');
            const path = resolvePath(from, request);
            if (!path) throw new Error('Cannot resolve local module "' + request + '" from ' + from);
            if (cache.has(path)) return cache.get(path).exports;
            const module = { exports: {} };
            cache.set(path, module);
            if (path.endsWith('.json')) {
              module.exports = JSON.parse(files[path]);
              return module.exports;
            }
            const fn = new Function('module', 'exports', 'require', '__filename', '__dirname', files[path]);
            fn(module, module.exports, name => requireLocal(path, name), path, path.split('/').slice(0, -1).join('/'));
            return module.exports;
          };
          const result = requireLocal(entry, './' + entry.split('/').pop());
          if (result !== undefined && output.length === 0) output.push(stringify(result));
          self.postMessage({ ok: true, output: output.join('\\n') || '(No output)' });
        } catch (error) {
          self.postMessage({ ok: false, output: error?.stack || error?.message || String(error) });
        }
      };
    `;
    const worker = new Worker(URL.createObjectURL(new Blob([workerSource], { type: 'application/javascript' })));
    const timer = setTimeout(() => {
      worker.terminate();
      resolve({ ok: false, output: 'Execution stopped: time limit exceeded (10 seconds).' });
    }, 10000);
    worker.onmessage = event => {
      clearTimeout(timer);
      worker.terminate();
      resolve(event.data);
    };
    worker.onerror = event => {
      clearTimeout(timer);
      worker.terminate();
      resolve({ ok: false, output: event.message || 'JavaScript worker error' });
    };
    worker.postMessage({ files: filesObject(project.files), entry: project.entry });
  });
}

function runHtmlProject(project) {
  return new Promise(resolve => {
    const files = filesObject(project.files);
    const entry = files[project.entry] != null ? project.entry : Object.keys(files).find(path => /\.html?$/i.test(path));
    if (!entry) return resolve({ ok: false, output: 'No HTML entry file found.' });
    let html = files[entry];
    html = html.replace(/<link[^>]+href=["']([^"']+)["'][^>]*>/gi, (full, href) => files[href] != null ? `<style>${files[href]}</style>` : full);
    html = html.replace(/<script[^>]+src=["']([^"']+)["'][^>]*><\/script>/gi, (full, src) => files[src] != null ? `<script>${files[src]}<\/script>` : full);
    const frame = document.createElement('iframe');
    frame.sandbox.add('allow-scripts');
    frame.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;border:0';
    document.body.appendChild(frame);
    frame.srcdoc = html;
    setTimeout(() => {
      frame.remove();
      resolve({ ok: true, output: 'Web application loaded successfully.' });
    }, 1500);
  });
}

async function runProject(project) {
  const languages = project.files.map(file => file.language);
  if (languages.includes('html') || /\.html?$/i.test(project.entry)) return runHtmlProject(project);
  if (languages.includes('javascript') || languages.includes('typescript') || /\.(js|mjs|cjs|ts|tsx|jsx)$/i.test(project.entry)) return runJavaScriptProject(project);
  return { ok: true, output: 'Files generated successfully.' };
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function downloadProject(project) {
  if (project.files.length === 1) {
    downloadBlob(new Blob([project.files[0].content], { type: 'text/plain' }), project.files[0].path.split('/').pop());
    return;
  }
  const zip = new JSZip();
  project.files.forEach(file => zip.file(file.path, file.content));
  downloadBlob(await zip.generateAsync({ type: 'blob' }), 'generated-project.zip');
}

function getCitationEntries(annotations = []) {
  return (Array.isArray(annotations) ? annotations : []).map((annotation, index) => {
    const url = annotation?.url || annotation?.source_url || annotation?.href || annotation?.citation?.url || annotation?.source?.url;
    if (!url) return null;
    let domain = '';
    try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch {}
    return {
      url: String(url),
      title: String(annotation?.title || domain || `Source ${index + 1}`),
      domain,
      refs: [annotation?.id, annotation?.ref, annotation?.citation_id, annotation?.citation?.id, annotation?.citation?.ref].filter(Boolean).map(String)
    };
  }).filter(Boolean);
}

function Markdown({ children, annotations = [] }) {
  const entries = getCitationEntries(annotations);
  let text = String(children || '');
  entries.forEach(entry => {
    entry.refs.forEach(ref => {
      text = text.replaceAll(`cite${ref}`, `[${entry.domain || entry.title}](${entry.url})`);
    });
  });
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>;
}

function CodeCard({ project, onDownload, onRun }) {
  return (
    <div className="code-card">
      <div className="code-card-head">
        <b><FileCode2 size={15} />Generated project</b>
        <div className="code-card-actions">
          <button onClick={onRun}><Play size={12} />Run</button>
          <button onClick={onDownload}>{project.files.length > 1 ? <><FolderArchive size={12} />Download ZIP</> : <><Download size={12} />Download</>}</button>
        </div>
      </div>
      <div className="code-card-files">{project.files.map(file => <span className="code-file" key={file.path}>{file.path}</span>)}</div>
      <pre>{project.files.length === 1 ? project.files[0].content : `${project.files.length} files generated. Use Run to execute the project or download the complete project.`}</pre>
    </div>
  );
}

function App() {
  const [chats, setChats] = useState(loadChats);
  const [active, setActive] = useState(null);
  const [model, setModel] = useState('gpt-5.6-luna');
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const [createImage, setCreateImage] = useState(false);
  const [codeCommand, setCodeCommand] = useState(false);
  const [runner, setRunner] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const textareaRef = useRef(null);
  const chat = chats.find(item => item.id === active) || null;

  useEffect(() => {
    try { localStorage.setItem('tml-chats', JSON.stringify(chats)); } catch {}
  }, [chats]);

  useEffect(() => {
    if (!active && chats[0]) setActive(chats[0].id);
    if (active && !chats.some(item => item.id === active)) setActive(chats[0]?.id || null);
  }, [active, chats]);

  const createChat = () => {
    const newChat = { id: makeId(), title: 'New chat', messages: [], updated: Date.now() };
    setChats(items => [newChat, ...items]);
    setActive(newChat.id);
    return newChat;
  };

  const deleteChat = chatId => {
    const target = chats.find(item => item.id === chatId);
    if (!target || !window.confirm(`Delete “${target.title}”? This removes it from local storage.`)) return;
    setChats(items => items.filter(item => item.id !== chatId));
    if (active === chatId) setActive(chats.find(item => item.id !== chatId)?.id || null);
  };

  const copy = async content => {
    try { await navigator.clipboard.writeText(content); } catch {}
  };

  const exportChat = () => {
    if (!chat) return;
    const content = chat.messages.map(message => `${message.role.toUpperCase()}\n${message.content}`).join('\n\n');
    downloadBlob(new Blob([content], { type: 'text/plain' }), `${chat.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'chat'}.txt`);
  };

  const attach = async event => {
    const selected = [...(event.target.files || [])].slice(0, 6 - files.length);
    const textLike = file => /^text\//i.test(file.type) || /\.(txt|csv|md|json|xml|log|js|ts|py|html|css)$/i.test(file.name);
    try {
      const next = await Promise.all(selected.map(file => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result);
          resolve({ name: file.name, type: file.type || 'application/octet-stream', data: result.split(',')[1] || '', text: textLike(file) ? safeText(result) : '' });
        };
        reader.onerror = () => reject(reader.error || new Error(`Could not read ${file.name}`));
        if (textLike(file)) reader.readAsText(file); else reader.readAsDataURL(file);
      })));
      setFiles(items => [...items, ...next].slice(0, 6));
    } catch (error) {
      window.alert(error.message || 'Could not read attachment.');
    }
    event.target.value = '';
  };

  const selectCommand = command => {
    setWebSearch(command === 'web');
    setCreateImage(command === 'image');
    setCodeCommand(command === 'code');
    setText(value => value.replace(/\/$/, ''));
    setCommandOpen(false);
    textareaRef.current?.focus();
  };

  const handleTextChange = event => {
    const value = event.target.value;
    setText(value);
    setCommandOpen(value.endsWith('/'));
  };

  const requestAI = async (messages, attachments, fileContext, toolResult) => {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model, messages, attachments, fileContext, toolResult })
    });
    let data = {};
    try { data = await response.json(); } catch {}
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    if (!data.text) throw new Error('The model returned an empty response.');
    return { text: data.text, annotations: Array.isArray(data.annotations) ? data.annotations : [] };
  };

  const send = async (overrideText = null, overrideCode = null) => {
    const raw = (overrideText ?? text).trim();
    const useCode = overrideCode ?? codeCommand;
    if (busy || (!raw && !files.length)) return;

    let currentChat = chat;
    if (!currentChat) currentChat = createChat();

    const attachments = files;
    const fileContext = attachments.filter(file => file.text).map(file => `\n\n[Attached text file: ${file.name}]\n${file.text}`).join('');
    const userContent = useCode ? `${CODE_PROMPT}\n\nUser request:\n${raw || 'Please analyse the attached file(s).'}` : raw || 'Please analyse the attached file(s).';
    const userMessage = {
      id: makeId(),
      role: 'user',
      content: raw || 'Please analyse the attached file(s).',
      webSearch,
      createImage,
      codeCommand: useCode,
      files: attachments.map(({ name, type }) => ({ name, type }))
    };
    const messages = [...currentChat.messages, userMessage];
    const apiMessages = [...currentChat.messages, { role: 'user', content: userContent }];
    const chatId = currentChat.id;

    setBusy(true);
    setText('');
    setFiles([]);
    setWebSearch(false);
    setCreateImage(false);
    setCodeCommand(false);
    setCommandOpen(false);
    setChats(items => items.map(item => item.id === chatId ? {
      ...item,
      title: item.messages.length ? item.title : (raw.slice(0, 48) || 'Attached files'),
      messages,
      updated: Date.now()
    } : item));

    try {
      let result = await requestAI(apiMessages, attachments, fileContext, null);
      const project = useCode ? parseProject(result.text) : null;
      if (project) {
        setRunner({ project, status: 'running', output: 'Preparing project…', selected: project.entry });
        const firstAssistant = { id: makeId(), role: 'assistant', content: project.displayText || '', annotations: result.annotations, project };
        setChats(items => items.map(item => item.id === chatId ? { ...item, messages: [...messages, firstAssistant], updated: Date.now() } : item));
        const execution = await runProject(project);
        setRunner({ project, status: execution.ok ? 'done' : 'error', output: execution.output, selected: project.entry });
        const executionMessage = {
          role: 'user',
          content: `[Application code execution result]\nProject entry: ${project.entry}\nFiles: ${project.files.map(file => file.path).join(', ')}\nStatus: ${execution.ok ? 'success' : 'error'}\nOutput:\n${execution.output}`
        };
        result = await requestAI([...apiMessages, { role: 'assistant', content: result.text }, executionMessage], [], '', null);
        setChats(items => items.map(item => item.id === chatId ? {
          ...item,
          messages: [...messages, firstAssistant, { id: makeId(), role: 'assistant', content: result.text, annotations: result.annotations }],
          updated: Date.now()
        } : item));
      } else {
        setChats(items => items.map(item => item.id === chatId ? {
          ...item,
          messages: [...messages, { id: makeId(), role: 'assistant', content: result.text, annotations: result.annotations }],
          updated: Date.now()
        } : item));
      }
    } catch (error) {
      setChats(items => items.map(item => item.id === chatId ? {
        ...item,
        messages: [...messages, { id: makeId(), role: 'assistant', content: `Error: ${error.message || 'Unable to send message.'}` }],
        updated: Date.now()
      } : item));
    } finally {
      setBusy(false);
      textareaRef.current?.focus();
    }
  };

  const regenerate = (messageIndex) => {
    if (!chat || busy || messageIndex < 1) return;
    const previous = chat.messages[messageIndex - 1];
    if (previous?.role !== 'user') return;
    setChats(items => items.map(item => item.id === chat.id ? { ...item, messages: item.messages.slice(0, messageIndex), updated: Date.now() } : item));
    setTimeout(() => send(previous.content, Boolean(previous.codeCommand)), 0);
  };

  const handleKeyDown = event => {
    if (event.key === 'Escape') {
      setCommandOpen(false);
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  return (
    <div className={`app ${runner ? 'runner-open' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="brand"><span>Thank Me Later</span><button className="icon-btn sidebar-toggle" onClick={() => setSidebarCollapsed(value => !value)} title={sidebarCollapsed ? 'Open sidebar' : 'Minimise sidebar'}><PanelLeftClose size={17} /></button></div>
        <button className="new" onClick={createChat}><Plus size={18} /><span>New chat</span></button>
        <small>CHATS</small>
        {chats.map(item => <div key={item.id} className={`chat-row ${item.id === active ? 'active' : ''}`}><button className="chat" onClick={() => setActive(item.id)} title={item.title}><MessageSquare size={17} /><span>{item.title}</span></button><button className="delete-chat" onClick={() => deleteChat(item.id)} aria-label={`Delete ${item.title}`} title="Delete chat"><Trash2 size={14} /></button></div>)}
        {!chats.length && <div className="empty-chats">No chats yet.</div>}
      </aside>

      <main>
        <header>
          <div className="toolbar">
            <div className="model">
              <button onClick={() => setModelOpen(value => !value)}>{models.find(item => item[0] === model)?.[1] || model}<ChevronDown size={15} /></button>
              {modelOpen && <div className="models">{models.map(([value, label]) => <button key={value} onClick={() => { setModel(value); setModelOpen(false); }}>{label}</button>)}</div>}
            </div>
            {chat && <button className="export" onClick={exportChat} title="Export chat"><Download size={16} /></button>}
          </div>
        </header>

        <section>
          {!chat || !chat.messages.length ? (
            <div className="hero">
              <h1>What can I help with?</h1>
              <p>Ask anything, attach files, or use a command.</p>
              <div className="quick">
                <button onClick={() => { setText('Explain this concept simply: '); textareaRef.current?.focus(); }}><Sparkles size={15} />Explain a concept</button>
                <button onClick={() => { setText('Calculate '); textareaRef.current?.focus(); }}><Calculator size={15} />Calculate</button>
                <button onClick={() => selectCommand('web')}><Globe size={15} />Web search</button>
              </div>
            </div>
          ) : chat.messages.map((message, index) => (
            <div className={`msg ${message.role}`} key={message.id || index}>
              <div className="bubble">
                {message.role === 'user' && message.webSearch && <div className="web-pill"><Globe size={13} /><span>Web search</span></div>}
                {message.role === 'user' && message.createImage && <div className="web-pill"><Sparkles size={13} /><span>Create image</span></div>}
                {message.role === 'user' && message.codeCommand && <div className="web-pill"><Code2 size={13} /><span>Code</span></div>}
                {message.files?.map(file => <div className="file" key={file.name}><Paperclip size={12} />{file.name}</div>)}
                <div className="content">{message.role === 'assistant' ? <Markdown annotations={message.annotations}>{message.content}</Markdown> : message.content}</div>
                {message.project && <CodeCard project={message.project} onDownload={() => downloadProject(message.project)} onRun={async () => { setRunner({ project: message.project, status: 'running', output: 'Running…', selected: message.project.entry }); const result = await runProject(message.project); setRunner({ project: message.project, status: result.ok ? 'done' : 'error', output: result.output, selected: message.project.entry }); }} />}
                {message.role === 'assistant' && <div className="actions"><button onClick={() => copy(message.content)} title="Copy"><Copy size={14} /></button><button onClick={() => regenerate(index)} title="Regenerate"><RotateCcw size={14} /></button></div>}
              </div>
            </div>
          ))}
          {busy && <div className="msg assistant"><div className="bubble dots"><span>•</span><span>•</span><span>•</span></div></div>}
        </section>

        <footer>
          {commandOpen && <div className="command-menu">
            <button onClick={() => selectCommand('web')}><Globe size={16} /><span><b>Web search</b><small>Search the web for current information</small></span></button>
            <button onClick={() => selectCommand('image')}><Sparkles size={16} /><span><b>Create image</b><small>Create an image from your prompt</small></span></button>
            <button onClick={() => selectCommand('code')}><Code2 size={16} /><span><b>Code</b><small>Use the browser coding environment</small></span></button>
          </div>}
          <div className="pending">
            {webSearch && <span className="web-pill"><Globe size={13} />Web search<button onClick={() => setWebSearch(false)}><X size={12} /></button></span>}
            {createImage && <span className="web-pill"><Sparkles size={13} />Create image<button onClick={() => setCreateImage(false)}><X size={12} /></button></span>}
            {codeCommand && <span className="web-pill"><Code2 size={13} />Code<button onClick={() => setCodeCommand(false)}><X size={12} /></button></span>}
            {files.map(file => <span key={file.name}><Paperclip size={12} />{file.name}<button onClick={() => setFiles(items => items.filter(item => item.name !== file.name))}><X size={12} /></button></span>)}
          </div>
          <div className="composer">
            <label title="Attach files"><Paperclip size={18} /><input type="file" multiple onChange={attach} /></label>
            <textarea ref={textareaRef} value={text} onChange={handleTextChange} onKeyDown={handleKeyDown} placeholder="Message..." rows={1} />
            <button onClick={() => send()} disabled={busy || (!text.trim() && !files.length)} title="Send"><ArrowUp size={18} /></button>
          </div>
          <div className="hint">Press <b>Enter</b> to send · <b>Shift+Enter</b> for a new line · type <b>/</b> for commands</div>
        </footer>
      </main>

      {runner && <aside className="runner">
        <div className="runner-head"><div><b><Terminal size={16} />Code environment</b><small>{runner.project.files.length} file{runner.project.files.length === 1 ? '' : 's'} · {runner.project.entry}</small></div><button onClick={() => setRunner(null)}><X size={17} /></button></div>
        <div className="runner-status"><span className={`status-dot ${runner.status}`}></span>{runner.status === 'running' ? 'Running…' : runner.status === 'done' ? 'Completed' : 'Execution error'}<span className="runner-limit">10s</span></div>
        <div className="runner-files">{runner.project.files.map(file => <button className={runner.selected === file.path ? 'active' : ''} key={file.path} onClick={() => setRunner(value => ({ ...value, selected: file.path }))}>{file.path}</button>)}</div>
        <div className="runner-code"><div className="runner-label">{runner.selected}</div><pre>{runner.project.files.find(file => file.path === runner.selected)?.content || ''}</pre><div className="runner-actions"><button onClick={() => copy(runner.project.files.find(file => file.path === runner.selected)?.content || '')}><Copy size={13} />Copy</button><button onClick={() => downloadProject(runner.project)}>{runner.project.files.length > 1 ? <><FolderArchive size={13} />ZIP</> : <><Download size={13} />Download</>}</button></div></div>
        <div className="runner-output"><div className="runner-label">OUTPUT</div><pre>{runner.output || '(No output)'}</pre></div>
        <div className="runner-note"><Play size={13} />Browser-safe project execution. JavaScript and HTML/CSS/JS projects are supported. Native OS commands and arbitrary external packages are not executed.</div>
      </aside>}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
