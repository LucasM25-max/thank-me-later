import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Plus, Paperclip, ArrowUp, MessageSquare, FolderPlus, ChevronDown, X } from 'lucide-react';
import './style.css';

const models = [
  ['gpt-5.6-luna', 'GPT-5.6 Luna'],
  ['gpt-5.6-terra', 'GPT-5.6 Terra'],
  ['gemini-pro-latest', 'Gemini Pro'],
  ['gemini-flash-latest', 'Gemini Flash'],
  ['gemini-flash-lite-latest', 'Gemini Flash Lite']
];

const id = () => crypto.randomUUID();

function load(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return Array.isArray(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function App() {
  const [chats, setChats] = useState(() => load('tml-chats', []));
  const [folders, setFolders] = useState(() => load('tml-folders', []));
  const [active, setActive] = useState(null);
  const [model, setModel] = useState('gpt-5.6-luna');
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const textareaRef = useRef(null);

  const chat = chats.find((item) => item.id === active) || null;

  useEffect(() => {
    try {
      localStorage.setItem('tml-chats', JSON.stringify(chats));
      localStorage.setItem('tml-folders', JSON.stringify(folders));
    } catch {
      // Keep the app usable even if browser storage is full or unavailable.
    }
  }, [chats, folders]);

  useEffect(() => {
    if (!active && chats[0]) setActive(chats[0].id);
    if (active && !chats.some((item) => item.id === active)) setActive(chats[0]?.id || null);
  }, [active, chats]);

  const createChat = () => {
    const c = { id: id(), title: 'New chat', messages: [], folder: null, updated: Date.now() };
    setChats((current) => [c, ...current]);
    setActive(c.id);
    return c;
  };

  const attach = async (event) => {
    const selected = [...(event.target.files || [])].slice(0, 6);
    const next = await Promise.all(selected.map((file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({
        name: file.name,
        type: file.type || 'application/octet-stream',
        data: String(reader.result).split(',')[1] || ''
      });
      reader.onerror = () => reject(reader.error || new Error(`Could not read ${file.name}`));
      reader.readAsDataURL(file);
    })));
    setFiles((current) => [...current, ...next].slice(0, 6));
    event.target.value = '';
  };

  const send = async () => {
    const content = text.trim();
    if (busy || (!content && !files.length)) return;

    let currentChat = chat;
    if (!currentChat) currentChat = createChat();

    const userMessage = {
      id: id(),
      role: 'user',
      content: content || 'Please analyse the attached file(s).',
      files: files.map(({ name, type }) => ({ name, type }))
    };
    const messages = [...currentChat.messages, userMessage];
    const attachments = files;
    const chatId = currentChat.id;

    setBusy(true);
    setText('');
    setFiles([]);
    setChats((current) => current.map((item) => item.id === chatId ? {
      ...item,
      title: item.messages.length ? item.title : (content.slice(0, 42) || 'Attached files'),
      messages,
      updated: Date.now()
    } : item));

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: messages.map(({ role, content: messageContent }) => ({ role, content: messageContent })),
          attachments
        })
      });

      let data = {};
      try { data = await response.json(); } catch { /* handled below */ }
      if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
      if (!data.text) throw new Error('The model returned an empty response.');

      setChats((current) => current.map((item) => item.id === chatId ? {
        ...item,
        messages: [...messages, { id: id(), role: 'assistant', content: data.text }],
        updated: Date.now()
      } : item));
    } catch (error) {
      setChats((current) => current.map((item) => item.id === chatId ? {
        ...item,
        messages: [...messages, { id: id(), role: 'assistant', content: `Error: ${error.message || 'Unable to send message.'}` }],
        updated: Date.now()
      } : item));
    } finally {
      setBusy(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  const newFolder = () => {
    const name = prompt('Folder name');
    if (name?.trim()) setFolders((current) => [...current, { id: id(), name: name.trim() }]);
  };

  return <div className="app">
    <aside>
      <div className="brand">Thank Me Later</div>
      <button className="new" onClick={createChat}><Plus />New chat</button>
      <button className="folderbtn" onClick={newFolder}><FolderPlus />New folder</button>
      <small>CHATS</small>
      {chats.map((item) => <button key={item.id} className={`chat ${item.id === active ? 'active' : ''}`} onClick={() => setActive(item.id)}><MessageSquare />{item.title}</button>)}
    </aside>

    <main>
      <header>
        <div className="model">
          <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
            {models.find((item) => item[0] === model)?.[1] || model}<ChevronDown size={16} />
          </button>
          {open && <div className="models">
            {models.map((item) => <button type="button" key={item[0]} onClick={() => { setModel(item[0]); setOpen(false); }}>{item[1]}</button>)}
          </div>}
        </div>
      </header>

      <section>
        {!chat ? <div className="hero"><h1>How can I help you today?</h1><p>Choose a model, ask anything, or attach an image or file.</p></div> : chat.messages.map((message) => <div key={message.id} className={`msg ${message.role}`}>
          <div className="bubble">
            {message.files?.map((file, index) => <span key={index} className="file">📎 {file.name}</span>)}
            {message.content}
          </div>
        </div>)}
        {busy && <div className="msg assistant"><div className="bubble">Thinking…</div></div>}
      </section>

      <footer>
        {files.length > 0 && <div className="pending">{files.map((file, index) => <span key={`${file.name}-${index}`}>{file.name}<button type="button" aria-label={`Remove ${file.name}`} onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}><X size={12} /></button></span>)}</div>}
        <div className="composer">
          <label title="Attach files"><Paperclip /><input type="file" multiple onChange={attach} /></label>
          <textarea ref={textareaRef} value={text} onChange={(event) => setText(event.target.value)} onKeyDown={handleKeyDown} placeholder="Message Thank Me Later…" rows={1} />
          <button type="button" aria-label="Send message" disabled={busy || (!text.trim() && !files.length)} onClick={send}><ArrowUp /></button>
        </div>
      </footer>
    </main>
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
