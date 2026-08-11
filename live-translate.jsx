import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Check, ChevronDown, Download, Languages, Library as LibraryIcon, Mic, Pause, Play, Save, Square, Trash2, Volume2, X } from 'lucide-react';

const LIVE_MODEL = 'gemini-3.5-live-translate-preview';
const STORAGE_KEY = 'tml-translation-library';

export const LIVE_LANGUAGES = [
  ['af','Afrikaans'],['ak','Akan'],['sq','Albanian'],['am','Amharic'],['ar','Arabic'],['hy','Armenian'],['az','Azerbaijani'],['eu','Basque'],['be','Belarusian'],['bn','Bengali'],['bg','Bulgarian'],['my','Burmese (Myanmar)'],['ca','Catalan'],['zh-Hans','Chinese (Simplified)'],['zh-Hant','Chinese (Traditional)'],['hr','Croatian'],['cs','Czech'],['da','Danish'],['nl','Dutch'],['en','English'],['et','Estonian'],['fil','Filipino'],['fi','Finnish'],['fr','French'],['gl','Galician'],['ka','Georgian'],['de','German'],['el','Greek'],['gu','Gujarati'],['ha','Hausa'],['he','Hebrew'],['hi','Hindi'],['hu','Hungarian'],['is','Icelandic'],['id','Indonesian'],['it','Italian'],['ja','Japanese'],['jv','Javanese'],['kn','Kannada'],['kk','Kazakh'],['km','Khmer'],['rw','Kinyarwanda'],['ko','Korean'],['lo','Lao'],['lv','Latvian'],['lt','Lithuanian'],['mk','Macedonian'],['ms','Malay'],['ml','Malayalam'],['mr','Marathi'],['mn','Mongolian'],['ne','Nepali'],['no','Norwegian'],['fa','Persian'],['pl','Polish'],['pt-BR','Portuguese (Brazil)'],['pt-PT','Portuguese (Portugal)'],['pa','Punjabi'],['ro','Romanian'],['ru','Russian'],['sr','Serbian'],['sd','Sindhi'],['si','Sinhala'],['sk','Slovak'],['sl','Slovenian'],['es','Spanish'],['su','Sundanese'],['sw','Swahili'],['sv','Swedish'],['ta','Tamil'],['te','Telugu'],['th','Thai'],['tr','Turkish'],['uk','Ukrainian'],['ur','Urdu'],['uz','Uzbek'],['vi','Vietnamese'],['zu','Zulu']
];

const loadLibrary = () => { try { const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } };
const makeId = () => crypto.randomUUID();
const languageName = code => LIVE_LANGUAGES.find(([id]) => id === code)?.[1] || code;
const formatDate = value => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function pcm16ToFloat32(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const output = new Float32Array(Math.floor(bytes.byteLength / 2));
  for (let i = 0; i < output.length; i += 1) output[i] = view.getInt16(i * 2, true) / 32768;
  return output;
}

function downsampleTo16k(buffer, sourceRate) {
  if (sourceRate === 16000) return buffer;
  const ratio = sourceRate / 16000;
  const length = Math.round(buffer.length / ratio);
  const result = new Float32Array(length);
  let offset = 0;
  for (let i = 0; i < length; i += 1) {
    const next = Math.min(Math.round((i + 1) * ratio), buffer.length);
    let sum = 0;
    let count = 0;
    for (let j = offset; j < next; j += 1) { sum += buffer[j]; count += 1; }
    result[i] = count ? sum / count : 0;
    offset = next;
  }
  return result;
}

function floatToPcm16Base64(samples) {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < samples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(i * 2, sample < 0 ? sample * 32768 : sample * 32767, true);
  }
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  return btoa(binary);
}

function createWavBlob(chunks, sampleRate = 24000) {
  const data = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const buffer = new ArrayBuffer(44 + data);
  const view = new DataView(buffer);
  const write = (offset, text) => [...text].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
  write(0, 'RIFF'); view.setUint32(4, 36 + data, true); write(8, 'WAVE'); write(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, data, true);
  let offset = 44;
  chunks.forEach(chunk => { new Uint8Array(buffer, offset, chunk.length).set(chunk); offset += chunk.length; });
  return new Blob([buffer], { type: 'audio/wav' });
}

async function getToken(targetLanguageCode, echoTargetLanguage) {
  const response = await fetch('/api/live-token', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ targetLanguageCode, echoTargetLanguage }) });
  let data = {};
  try { data = await response.json(); } catch {}
  if (!response.ok) throw new Error(data?.error || `Unable to create Live Translate session (${response.status})`);
  if (!data.token) throw new Error('The Live Translate token service returned no token.');
  return data.token;
}

function Transcript({ segments }) {
  return <div className="live-transcript">{segments.length ? segments.map(segment => <div className="transcript-segment" key={segment.id}><div className="transcript-column"><span>Original</span><p>{segment.input || '…'}</p></div><div className="transcript-divider"/><div className="transcript-column"><span>Translation</span><p>{segment.output || '…'}</p></div></div>) : <div className="transcript-empty">Speak naturally. Your live transcript will appear here.</div>}</div>;
}

function Orb({ status, audioActive }) {
  return <div className={`live-orb-stage ${status} ${audioActive ? 'audio-active' : ''}`} aria-label={status === 'paused' ? 'Translation paused' : 'Live translation active'}><div className="live-orb-glow"/><div className="live-orb"><div className="live-orb-core"/></div><div className="live-orb-label">{status === 'paused' ? 'Paused' : status === 'starting' ? 'Connecting…' : audioActive ? 'Translating' : 'Listening'}</div></div>;
}

export function LiveTranslate({ onExit }) {
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [echoTargetLanguage, setEchoTargetLanguage] = useState(false);
  const [status, setStatus] = useState('idle');
  const [segments, setSegments] = useState([]);
  const [audioActive, setAudioActive] = useState(false);
  const [error, setError] = useState('');
  const [completedAt, setCompletedAt] = useState(null);
  const [saved, setSaved] = useState(false);
  const wsRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);
  const inputBufferRef = useRef(new Float32Array());
  const playbackContextRef = useRef(null);
  const nextPlaybackTimeRef = useRef(0);
  const outputAudioChunksRef = useRef([]);
  const currentSegmentRef = useRef(null);
  const stoppedRef = useRef(false);

  const updateTranscript = useCallback((type, text) => {
    if (!text) return;
    setSegments(current => {
      const last = current[current.length - 1];
      if (!last || last[type] || last[type === 'input' ? 'output' : 'input']) {
        const segment = { id: makeId(), input: type === 'input' ? text : '', output: type === 'output' ? text : '' };
        currentSegmentRef.current = segment.id;
        return [...current, segment];
      }
      const next = [...current];
      next[next.length - 1] = { ...last, [type]: `${last[type] || ''}${text}` };
      return next;
    });
  }, []);

  const handleServerMessage = useCallback(async event => {
    try {
      const message = JSON.parse(event.data);
      const content = message?.serverContent;
      if (!content) return;
      if (content.inputTranscription?.text) updateTranscript('input', content.inputTranscription.text);
      if (content.outputTranscription?.text) updateTranscript('output', content.outputTranscription.text);
      for (const part of content.modelTurn?.parts || []) {
        if (!part?.inlineData?.data) continue;
        const bytes = base64ToBytes(part.inlineData.data);
        outputAudioChunksRef.current.push(bytes);
        const samples = pcm16ToFloat32(bytes);
        if (!playbackContextRef.current) playbackContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
        const context = playbackContextRef.current;
        if (context.state === 'suspended') await context.resume();
        const audioBuffer = context.createBuffer(1, samples.length, 24000);
        audioBuffer.copyToChannel(samples, 0);
        const source = context.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(context.destination);
        const start = Math.max(context.currentTime + 0.02, nextPlaybackTimeRef.current || context.currentTime + 0.02);
        source.start(start);
        nextPlaybackTimeRef.current = start + audioBuffer.duration;
        setAudioActive(true);
        source.onended = () => { if (context.currentTime >= nextPlaybackTimeRef.current - 0.04) setAudioActive(false); };
      }
    } catch (e) { console.warn('Live Translate message parse failed', e); }
  }, [updateTranscript]);

  const stopCapture = useCallback(async () => {
    processorRef.current?.disconnect(); sourceRef.current?.disconnect();
    processorRef.current = null; sourceRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop()); streamRef.current = null;
    if (audioContextRef.current) { try { await audioContextRef.current.close(); } catch {} audioContextRef.current = null; }
    inputBufferRef.current = new Float32Array();
  }, []);

  const closeSession = useCallback(async () => {
    stoppedRef.current = true;
    await stopCapture();
    const ws = wsRef.current; wsRef.current = null;
    if (ws && ws.readyState === WebSocket.OPEN) ws.close(1000, 'Translation ended');
    if (playbackContextRef.current) { try { await playbackContextRef.current.close(); } catch {} playbackContextRef.current = null; }
    nextPlaybackTimeRef.current = 0;
    setAudioActive(false);
  }, [stopCapture]);

  const startCapture = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    streamRef.current = stream;
    const context = new (window.AudioContext || window.webkitAudioContext)();
    audioContextRef.current = context;
    await context.resume();
    const source = context.createMediaStreamSource(stream); sourceRef.current = source;
    const processor = context.createScriptProcessor(4096, 1, 1); processorRef.current = processor;
    processor.onaudioprocess = event => {
      if (stoppedRef.current || status === 'paused') return;
      const input = event.inputBuffer.getChannelData(0);
      const merged = new Float32Array(inputBufferRef.current.length + input.length); merged.set(inputBufferRef.current); merged.set(input, inputBufferRef.current.length); inputBufferRef.current = merged;
      const targetSamples = Math.floor(context.sampleRate * 0.1);
      while (inputBufferRef.current.length >= targetSamples) {
        const chunk = inputBufferRef.current.slice(0, targetSamples); inputBufferRef.current = inputBufferRef.current.slice(targetSamples);
        const pcm = downsampleTo16k(chunk, context.sampleRate); const ws = wsRef.current;
        if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ realtimeInput: { audio: { data: floatToPcm16Base64(pcm), mimeType: 'audio/pcm;rate=16000' } } }));
      }
    };
    source.connect(processor); processor.connect(context.destination);
  }, [status]);

  const start = useCallback(async () => {
    if (status !== 'idle') return;
    setError(''); setSaved(false); setSegments([]); setCompletedAt(null); outputAudioChunksRef.current = []; stoppedRef.current = false; setStatus('starting');
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.WebSocket) throw new Error('This browser does not support the microphone features required for Live Translate.');
      const token = await getToken(targetLanguage, echoTargetLanguage);
      const ws = new WebSocket(`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(token)}`);
      wsRef.current = ws;
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Gemini Live API connection timed out.')), 15000);
        ws.onopen = () => { clearTimeout(timeout); ws.send(JSON.stringify({ setup: { model: `models/${LIVE_MODEL}`, generationConfig: { responseModalities: ['AUDIO'], inputAudioTranscription: {}, outputAudioTranscription: {}, translationConfig: { targetLanguageCode: targetLanguage, echoTargetLanguage } } } })); resolve(); };
        ws.onerror = () => { clearTimeout(timeout); reject(new Error('Could not connect to Gemini Live API.')); };
      });
      ws.onmessage = handleServerMessage;
      ws.onerror = () => setError('The Gemini Live session encountered a connection error.');
      ws.onclose = event => { if (!stoppedRef.current && status !== 'paused') setError(event.reason || 'The Gemini Live session closed unexpectedly.'); };
      await startCapture();
      setStatus('active');
    } catch (e) {
      await closeSession(); setStatus('idle'); setError(e?.message || 'Unable to start translation.');
    }
  }, [closeSession, echoTargetLanguage, handleServerMessage, startCapture, status, targetLanguage]);

  const pause = useCallback(async () => {
    if (status === 'active') { await stopCapture(); setStatus('paused'); }
    else if (status === 'paused') { try { stoppedRef.current = false; await startCapture(); setStatus('active'); } catch (e) { setError(e?.message || 'Unable to resume microphone capture.'); } }
  }, [startCapture, status, stopCapture]);

  const end = useCallback(async () => {
    await closeSession(); setCompletedAt(Date.now()); setStatus('completed');
  }, [closeSession]);

  useEffect(() => () => { closeSession(); }, [closeSession]);

  const transcript = useMemo(() => segments.map((segment, index) => ({ ...segment, index })), [segments]);
  const saveConversation = useCallback(() => {
    const item = { id: makeId(), createdAt: completedAt || Date.now(), targetLanguage, targetLanguageName: languageName(targetLanguage), echoTargetLanguage, transcript };
    const library = loadLibrary(); localStorage.setItem(STORAGE_KEY, JSON.stringify([item, ...library].slice(0, 100))); setSaved(true);
  }, [completedAt, echoTargetLanguage, targetLanguage, transcript]);

  const downloadMarkdown = useCallback(() => {
    const lines = [`# Live Translation`, '', `Date: ${formatDate(completedAt || Date.now())}`, `Target language: ${languageName(targetLanguage)}`, '', '---', ''];
    transcript.forEach((segment, index) => { lines.push(`### Segment ${index + 1}`, '', `**Original:** ${segment.input || '—'}`, '', `**Translation:** ${segment.output || '—'}`, ''); });
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `live-translation-${new Date(completedAt || Date.now()).toISOString().slice(0,10)}.md`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [completedAt, targetLanguage, transcript]);

  const downloadPdf = useCallback(async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'pt', format: 'a4' }); const margin = 44; const width = 595 - margin * 2; let y = 52;
      const addText = (text, size = 10, bold = false, gap = 7) => { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); const lines = doc.splitTextToSize(String(text || '—'), width); if (y + lines.length * (size + 4) > 800) { doc.addPage(); y = 52; } doc.text(lines, margin, y); y += lines.length * (size + 4) + gap; };
      addText('Live Translation', 20, true, 12); addText(`Date: ${formatDate(completedAt || Date.now())}`, 10); addText(`Target language: ${languageName(targetLanguage)}`, 10); y += 8;
      transcript.forEach((segment, index) => { addText(`Segment ${index + 1}`, 11, true, 5); addText(`Original: ${segment.input || '—'}`, 10); addText(`Translation: ${segment.output || '—'}`, 10, false, 12); });
      doc.save(`live-translation-${new Date(completedAt || Date.now()).toISOString().slice(0,10)}.pdf`);
    } catch (e) { setError(e?.message || 'PDF export failed.'); }
  }, [completedAt, targetLanguage, transcript]);

  if (status === 'completed') return <div className="live-page completed"><div className="live-complete-card"><div className="live-complete-icon"><Check size={22}/></div><h1>Translation complete</h1><p>Your transcript is ready. Choose what you want to do with it.</p><div className="live-complete-transcript"><Transcript segments={transcript}/></div><div className="live-complete-actions"><button className="secondary" onClick={onExit}><X size={15}/>Exit</button><button className="primary" onClick={saveConversation}><Save size={15}/>{saved ? 'Saved' : 'Save conversation'}</button><button className="secondary" onClick={downloadMarkdown}><Download size={15}/>Download Markdown</button><button className="secondary" onClick={downloadPdf}><Download size={15}/>Download PDF</button></div>{error && <div className="live-error">{error}</div>}</div></div>;

  if (status === 'idle') return <div className="live-page"><div className="live-intro"><div className="live-eyebrow"><Languages size={15}/>Live Translate</div><h1>Speak naturally.<br/><em>Translate instantly.</em></h1><p>Real-time spoken translation powered by Gemini 3.5 Live Translate. Your transcript stays in this browser unless you choose to save it.</p><div className="live-settings"><label>Translate into<select value={targetLanguage} onChange={e => setTargetLanguage(e.target.value)}><option value="">Select a language</option>{LIVE_LANGUAGES.map(([code, name]) => <option value={code} key={code}>{name}</option>)}</select></label><label className="live-check"><input type="checkbox" checked={echoTargetLanguage} onChange={e => setEchoTargetLanguage(e.target.checked)}/><span><b>Echo target language</b><small>Repeat speech that is already in the target language</small></span></label></div><button className="live-start" onClick={start}><Mic size={17}/>Start translation</button>{error && <div className="live-error">{error}</div>}</div></div>;

  return <div className="live-page active"><div className="live-active-head"><div><span className="live-eyebrow"><Languages size={15}/>Live Translate</span><h1>{languageName(targetLanguage)}</h1></div><div className="live-session-pill"><span className="live-session-dot"/>{status === 'paused' ? 'Paused' : 'Live'}</div></div><div className="live-active-content"><Orb status={status} audioActive={audioActive}/><div className="live-controls"><button className="live-control secondary" onClick={pause}>{status === 'paused' ? <Play size={16}/> : <Pause size={16}/>} {status === 'paused' ? 'Resume translation' : 'Pause translation'}</button><button className="live-control danger" onClick={end}><Square size={14}/>End translation</button></div><Transcript segments={segments}/></div></div>;
}

export function Library({ onOpen, onNew }) {
  const [items, setItems] = useState(loadLibrary);
  useEffect(() => { const refresh = () => setItems(loadLibrary()); window.addEventListener('storage', refresh); return () => window.removeEventListener('storage', refresh); }, []);
  const remove = id => { const next = items.filter(item => item.id !== id); localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setItems(next); };
  return <div className="library-page"><div className="library-head"><div><div className="live-eyebrow"><BookOpen size={15}/>Library</div><h1>Saved translations</h1><p>Transcripts you chose to keep on this device.</p></div><button className="live-start compact" onClick={onNew}><Languages size={15}/>New translation</button></div>{!items.length ? <div className="library-empty"><LibraryIcon size={28}/><h2>Your library is empty</h2><p>Save a completed Live Translate session and it will appear here.</p><button className="secondary" onClick={onNew}>Start a translation</button></div> : <div className="library-grid">{items.map(item => <article className="library-card" key={item.id} onClick={() => onOpen(item)}><div className="library-card-top"><div className="library-card-icon"><Volume2 size={17}/></div><button className="library-delete" aria-label="Delete transcript" onClick={e => { e.stopPropagation(); remove(item.id); }}><Trash2 size={14}/></button></div><h2>{item.targetLanguageName || languageName(item.targetLanguage)}</h2><p>{formatDate(item.createdAt)}</p><div className="library-preview">{item.transcript?.slice(0,2).map((segment, i) => <div key={i}><b>{segment.input || '—'}</b><span>{segment.output || '—'}</span></div>)}</div><div className="library-open">Open transcript <ChevronDown size={14} style={{ transform: 'rotate(-90deg)' }}/></div></article>)}</div>}</div>;
}

export function SavedTranscript({ item, onBack }) {
  const downloadMarkdown = () => {
    const lines = [`# Live Translation`, '', `Date: ${formatDate(item.createdAt)}`, `Target language: ${item.targetLanguageName || languageName(item.targetLanguage)}`, '', '---', ''];
    (item.transcript || []).forEach((segment, index) => lines.push(`### Segment ${index + 1}`, '', `**Original:** ${segment.input || '—'}`, '', `**Translation:** ${segment.output || '—'}`, ''));
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `live-translation-${new Date(item.createdAt).toISOString().slice(0,10)}.md`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const downloadPdf = async () => {
    const { jsPDF } = await import('jspdf'); const doc = new jsPDF({ unit: 'pt', format: 'a4' }); const margin = 44; const width = 595 - margin * 2; let y = 52;
    const addText = (text, size = 10, bold = false, gap = 7) => { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); const lines = doc.splitTextToSize(String(text || '—'), width); if (y + lines.length * (size + 4) > 800) { doc.addPage(); y = 52; } doc.text(lines, margin, y); y += lines.length * (size + 4) + gap; };
    addText('Live Translation', 20, true, 12); addText(`Date: ${formatDate(item.createdAt)}`, 10); addText(`Target language: ${item.targetLanguageName || languageName(item.targetLanguage)}`, 10, false, 12); (item.transcript || []).forEach((segment, index) => { addText(`Segment ${index + 1}`, 11, true, 5); addText(`Original: ${segment.input || '—'}`, 10); addText(`Translation: ${segment.output || '—'}`, 10, false, 12); }); doc.save(`live-translation-${new Date(item.createdAt).toISOString().slice(0,10)}.pdf`);
  };
  return <div className="saved-page"><div className="saved-head"><button className="saved-back" onClick={onBack}><ChevronDown size={16} style={{ transform: 'rotate(90deg)' }}/>Library</button><div className="saved-actions"><button className="secondary" onClick={downloadMarkdown}><Download size={14}/>Markdown</button><button className="secondary" onClick={downloadPdf}><Download size={14}/>PDF</button></div></div><div className="saved-title"><div className="live-eyebrow"><BookOpen size={15}/>Saved translation</div><h1>{item.targetLanguageName || languageName(item.targetLanguage)}</h1><p>{formatDate(item.createdAt)}</p></div><Transcript segments={item.transcript || []}/></div>;
}
