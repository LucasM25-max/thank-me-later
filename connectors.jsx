import React, { useEffect, useState } from 'react';
import { GitBranch, ShieldCheck, Plug, Power, ExternalLink, X, Check, AlertCircle, Loader2, LockKeyhole } from 'lucide-react';
import { supabase } from './account-auth.jsx';

const GITHUB_ENDPOINT = 'https://api.githubcopilot.com/mcp/';

export function Connectors({ onExit, onConnectorChange }) {
  const [connection, setConnection] = useState({ status: 'disconnected', enabled: false });
  const [token, setToken] = useState('');
  const [hasStoredToken, setHasStoredToken] = useState(false);
  const [showConnect, setShowConnect] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tools, setTools] = useState([]);

  const loadConnection = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.user?.id) throw new Error('Your account session has expired. Please sign in again.');
      const { data, error: connectionError } = await supabase.from('connector_connections').select('status, enabled, metadata').eq('connector_id', 'github').maybeSingle();
      if (connectionError) throw connectionError;
      const { data: storedToken, error: tokenError } = await supabase.rpc('get_github_connector_token');
      const hasToken = !tokenError && typeof storedToken === 'string' && storedToken.length >= 10;
      setHasStoredToken(hasToken);
      if (hasToken) {
        setToken(storedToken);
        window.__tmlConnectors?.setToken(storedToken);
      }
      if (data) {
        const next = { status: data.status === 'connected' && hasToken ? 'connected' : 'disconnected', enabled: data.enabled === true && hasToken };
        setConnection(next);
        setTools(Array.isArray(data.metadata?.tools) ? data.metadata.tools : []);
        window.__tmlConnectors?.setEnabled(next.status === 'connected' && next.enabled);
        onConnectorChange?.(next);
      } else {
        window.__tmlConnectors?.setEnabled(false);
      }
    } catch (e) {
      setError(e?.message || 'Unable to restore the GitHub connector.');
      window.__tmlConnectors?.setEnabled(false);
    }
  };
  useEffect(() => { loadConnection(); }, []);

  const persist = async (patch) => {
    const next = { ...connection, ...patch };
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    const userId = sessionData?.session?.user?.id;
    if (!userId) throw new Error('Your account session has expired. Please sign in again.');
    setConnection(next);
    const { error: persistError } = await supabase.from('connector_connections').upsert({ user_id: userId, connector_id: 'github', status: next.status, enabled: next.enabled, metadata: { endpoint: GITHUB_ENDPOINT, tools: tools.slice(0, 80) } }, { onConflict: 'user_id,connector_id' });
    if (persistError) throw persistError;
    window.__tmlConnectors?.setEnabled(next.status === 'connected' && next.enabled);
    onConnectorChange?.(next);
  };

  const connect = async () => {
    if (!token.trim()) { setError('Enter a GitHub access token to connect GitHub. Your credential will be encrypted and stored securely with your account.'); return; }
    setBusy(true); setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Your account session has expired. Please sign in again.');
      const cleanToken = token.trim();
      const response = await fetch('/api/mcp-github', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ action: 'connect', token: cleanToken }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'GitHub connection failed.');
      const { error: tokenError } = await supabase.rpc('store_github_connector_token', { p_token: cleanToken });
      if (tokenError) throw new Error(tokenError.message || 'GitHub credential could not be saved securely.');
      const discovered = Array.isArray(data.tools) ? data.tools : [];
      setTools(discovered);
      setHasStoredToken(true);
      window.__tmlConnectors?.setToken(cleanToken);
      window.__tmlConnectors?.setEnabled(false);
      await persist({ status: 'connected', enabled: false });
      setShowConnect(false);
    } catch (e) { setError(e.message || 'GitHub connection failed.'); }
    finally { setBusy(false); }
  };

  const disconnect = async () => {
    setBusy(true); setError('');
    try {
      await supabase.rpc('delete_github_connector_token');
      await supabase.from('connector_connections').delete().eq('connector_id', 'github');
      setConnection({ status: 'disconnected', enabled: false }); setTools([]); setToken(''); setHasStoredToken(false); window.__tmlConnectors?.setToken(''); window.__tmlConnectors?.setEnabled(false); onConnectorChange?.({ status: 'disconnected', enabled: false });
    } catch (e) { setError(e?.message || 'GitHub could not be disconnected.'); }
    finally { setBusy(false); }
  };

  const toggle = async () => {
    if (connection.status !== 'connected') { setShowConnect(true); return; }
    if (!token && !hasStoredToken) { setShowConnect(true); setError('Reconnect GitHub to restore the credential for this account.'); return; }
    try { await persist({ enabled: !connection.enabled }); } catch (e) { setError(e?.message || 'Unable to update the connector.'); }
  };

  return <div className="connectors-page">
    <div className="connectors-intro"><div className="connectors-eyebrow"><Plug size={13}/> CONNECTORS</div><h1>Connect your tools.</h1><p>Give your AI access to external services when you choose. Connectors are off until you explicitly enable them.</p></div>
    <div className="connector-card">
      <div className="connector-card-main"><div className="connector-icon"><GitBranch size={24}/></div><div className="connector-copy"><div className="connector-title-row"><h2>GitHub</h2><span className={`connector-status ${connection.status}`}>{connection.status === 'connected' ? <><Check size={11}/> Connected</> : <><span className="connector-dot"/> Not connected</>}</span></div><p>Let your AI search repositories, inspect code, work with issues and pull requests, and use GitHub's official MCP tools.</p><div className="connector-endpoint"><span>Official remote MCP server</span><code>{GITHUB_ENDPOINT}</code></div></div></div>
      <div className="connector-actions"><button className={`connector-toggle ${connection.enabled ? 'on' : ''}`} onClick={toggle} disabled={busy}><span><Power size={14}/>{connection.enabled ? 'Enabled' : 'Disabled'}</span><i/></button>{connection.status === 'connected' ? <button className="connector-secondary" onClick={disconnect} disabled={busy}>{busy ? <Loader2 className="spin" size={14}/> : <X size={14}/>} Disconnect</button> : <button className="connector-primary" onClick={() => setShowConnect(true)} disabled={busy}><GitBranch size={15}/> {hasStoredToken ? 'Reconnect GitHub' : 'Connect GitHub'}</button>}</div>
      {connection.status === 'connected' && <div className="connector-permission"><ShieldCheck size={15}/><span><b>{connection.enabled ? 'GitHub tools are available to the AI.' : 'Connected, but disabled.'}</b> {tools.length ? `${tools.length} MCP tools discovered.` : ''}</span></div>}
      {error && <div className="connector-error"><AlertCircle size={15}/>{error}</div>}
    </div>
    <div className="connectors-note"><LockKeyhole size={15}/><div><b>Your credential is stored securely.</b><p>The GitHub credential is encrypted in your account's secure Supabase Vault and is restored after you reload the app. It is never stored in localStorage or included in model messages.</p></div></div>
    <div className="connectors-doc"><ExternalLink size={14}/><a href="https://github.com/github/github-mcp-server" target="_blank" rel="noreferrer">GitHub MCP Server documentation</a></div>
    {showConnect && <div className="connector-modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setShowConnect(false)}><div className="connector-modal"><button className="connector-modal-close" onClick={() => setShowConnect(false)}><X size={17}/></button><div className="connector-modal-icon"><GitBranch size={21}/></div><h3>Connect GitHub</h3><p>Connect the official GitHub MCP server. Your credential is encrypted and stored securely with your account so the connection survives page reloads.</p><label>GitHub access token<input type="password" value={token} onChange={e => setToken(e.target.value)} autoComplete="off" placeholder="Paste token"/></label><button className="connector-primary modal-connect" onClick={connect} disabled={busy}>{busy ? <><Loader2 className="spin" size={15}/> Checking…</> : <><Check size={15}/> Connect &amp; save</>}</button></div></div>}
  </div>;
}
