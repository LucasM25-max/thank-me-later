import React, { useEffect, useState } from 'react';
import { Github, ShieldCheck, Plug, Power, ExternalLink, X, Check, AlertCircle, Loader2, LockKeyhole } from 'lucide-react';
import { supabase } from './account-auth.jsx';

const GITHUB_ENDPOINT = 'https://api.githubcopilot.com/mcp/';

export function Connectors({ onExit, onConnectorChange }) {
  const [connection, setConnection] = useState({ status: 'disconnected', enabled: false });
  const [token, setToken] = useState('');
  const [showConnect, setShowConnect] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tools, setTools] = useState([]);

  const loadConnection = async () => {
    const { data } = await supabase.from('connector_connections').select('status, enabled, metadata').eq('connector_id', 'github').maybeSingle();
    if (data) {
      const needsReconnect = data.status === 'connected';
      setConnection({ status: needsReconnect ? 'connected' : 'disconnected', enabled: false });
      setTools(Array.isArray(data.metadata?.tools) ? data.metadata.tools : []);
      window.__tmlConnectors?.setEnabled(false);
    }
  };
  useEffect(() => { loadConnection(); }, []);

  const persist = async (patch) => {
    const next = { ...connection, ...patch };
    setConnection(next);
    await supabase.from('connector_connections').upsert({ connector_id: 'github', status: next.status, enabled: next.enabled, metadata: { endpoint: GITHUB_ENDPOINT, tools: tools.slice(0, 80) } }, { onConflict: 'user_id,connector_id' });
    window.__tmlConnectors?.setEnabled(next.status === 'connected' && next.enabled);
    onConnectorChange?.(next);
  };

  const connect = async () => {
    if (!token.trim()) { setError('Enter a GitHub access token to connect GitHub. The token is kept only in this browser session and is never saved to chat history.'); return; }
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/mcp-github', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'connect', token: token.trim() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'GitHub connection failed.');
      const discovered = Array.isArray(data.tools) ? data.tools : [];
      setTools(discovered);
      window.__tmlConnectors?.setToken(token.trim());
      window.__tmlConnectors?.setEnabled(false);
      await persist({ status: 'connected', enabled: false });
      setShowConnect(false);
    } catch (e) { setError(e.message || 'GitHub connection failed.'); }
    finally { setBusy(false); }
  };

  const disconnect = async () => {
    setBusy(true); setError('');
    try {
      await supabase.from('connector_connections').delete().eq('connector_id', 'github');
      setConnection({ status: 'disconnected', enabled: false }); setTools([]); setToken(''); window.__tmlConnectors?.setToken(''); window.__tmlConnectors?.setEnabled(false); onConnectorChange?.({ status: 'disconnected', enabled: false });
    } finally { setBusy(false); }
  };

  const toggle = async () => {
    if (connection.status !== 'connected') { setShowConnect(true); return; }
    if (!token) { setShowConnect(true); setError('Reconnect GitHub to restore the credential for this browser session.'); return; }
    await persist({ enabled: !connection.enabled });
  };

  return <div className="connectors-page">
    <div className="connectors-top"><button className="connectors-back" onClick={onExit}>Back to chat</button></div>
    <div className="connectors-intro"><div className="connectors-eyebrow"><Plug size={13}/> CONNECTORS</div><h1>Connect your tools.</h1><p>Give your AI access to external services when you choose. Connectors are off until you explicitly enable them.</p></div>
    <div className="connector-card">
      <div className="connector-card-main"><div className="connector-icon"><Github size={24}/></div><div className="connector-copy"><div className="connector-title-row"><h2>GitHub</h2><span className={`connector-status ${connection.status}`}>{connection.status === 'connected' ? <><Check size={11}/> Connected</> : <><span className="connector-dot"/> Not connected</>}</span></div><p>Let your AI search repositories, inspect code, work with issues and pull requests, and use GitHub's official MCP tools.</p><div className="connector-endpoint"><span>Official remote MCP server</span><code>{GITHUB_ENDPOINT}</code></div></div></div>
      <div className="connector-actions"><button className={`connector-toggle ${connection.enabled ? 'on' : ''}`} onClick={toggle} disabled={busy}><span><Power size={14}/>{connection.enabled ? 'Enabled' : 'Disabled'}</span><i/></button>{connection.status === 'connected' ? <button className="connector-secondary" onClick={disconnect} disabled={busy}>{busy ? <Loader2 className="spin" size={14}/> : <X size={14}/>} Disconnect</button> : <button className="connector-primary" onClick={() => setShowConnect(true)} disabled={busy}><Github size={15}/> Connect GitHub</button>}</div>
      {connection.status === 'connected' && <div className="connector-permission"><ShieldCheck size={15}/><span><b>{connection.enabled ? 'GitHub tools are available to the AI.' : token ? 'Connected, but disabled.' : 'GitHub is connected to your account. Reconnect in this browser to enable it.'}</b> {tools.length ? `${tools.length} MCP tools discovered.` : ''}</span></div>}
      {error && <div className="connector-error"><AlertCircle size={15}/>{error}</div>}
    </div>
    <div className="connectors-note"><LockKeyhole size={15}/><div><b>Your credential stays out of chat.</b><p>The GitHub credential is held in memory by this browser session and sent only to the connector endpoint when the AI needs GitHub tools. It is not stored in localStorage or included in model messages.</p></div></div>
    <div className="connectors-doc"><ExternalLink size={14}/><a href="https://github.com/github/github-mcp-server" target="_blank" rel="noreferrer">GitHub MCP Server documentation</a></div>
    {showConnect && <div className="connector-modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setShowConnect(false)}><div className="connector-modal"><button className="connector-modal-close" onClick={() => setShowConnect(false)}><X size={17}/></button><div className="connector-modal-icon"><Github size={21}/></div><h3>Connect GitHub</h3><p>Connect the official GitHub MCP server. Your credential is kept in memory only and is never written to browser storage.</p><label>GitHub access token<input type="password" value={token} onChange={e => setToken(e.target.value)} autoComplete="off" placeholder="Paste token"/></label><button className="connector-primary modal-connect" onClick={connect} disabled={busy}>{busy ? <><Loader2 className="spin" size={15}/> Checking…</> : <><Check size={15}/> Connect</>}</button></div></div>}
  </div>;
}
