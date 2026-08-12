import React, { useEffect, useState } from 'react';
import { ShieldCheck, Plug, Power, ExternalLink, X, Check, AlertCircle, Loader2, LockKeyhole, ArrowLeft, Github } from 'lucide-react';
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

  const requireSession = async () => {
    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    const session = data?.session;
    if (!session?.user?.id) throw new Error('Your account session has expired. Please sign in again.');
    return session;
  };

  const loadConnection = async () => {
    try {
      const session = await requireSession();
      const { data, error: connectionError } = await supabase
        .from('connector_connections')
        .select('status, enabled, metadata')
        .eq('user_id', session.user.id)
        .eq('connector_id', 'github')
        .maybeSingle();
      if (connectionError) throw connectionError;

      const { data: storedToken, error: tokenError } = await supabase.rpc('get_github_connector_token');
      if (tokenError) throw tokenError;
      const hasToken = typeof storedToken === 'string' && storedToken.length >= 10;
      setHasStoredToken(hasToken);

      const hasConnection = Boolean(data);
      const persistedConnected = data?.status === 'connected';
      const persistedEnabled = data?.enabled === true;

      if (hasConnection && persistedConnected && !hasToken) {
        const inconsistentMessage = 'GitHub needs to be reconnected because the account credential is missing.';
        setConnection({ status: 'disconnected', enabled: false });
        setTools(Array.isArray(data.metadata?.tools) ? data.metadata.tools : []);
        setToken('');
        window.__tmlConnectors?.setToken('');
        window.__tmlConnectors?.setEnabled(false);
        setError(inconsistentMessage);
        onConnectorChange?.({ status: 'disconnected', enabled: false });
        return;
      }

      if (hasToken) {
        setToken(storedToken);
        window.__tmlConnectors?.setToken(storedToken);
      } else {
        window.__tmlConnectors?.setToken('');
      }

      const next = hasConnection && persistedConnected && hasToken
        ? { status: 'connected', enabled: persistedEnabled }
        : { status: 'disconnected', enabled: false };
      setConnection(next);
      setTools(Array.isArray(data?.metadata?.tools) ? data.metadata.tools : []);
      window.__tmlConnectors?.setEnabled(next.status === 'connected' && next.enabled);
      onConnectorChange?.(next);
    } catch (e) {
      setError(e?.message || 'Unable to restore the GitHub connector.');
      window.__tmlConnectors?.setToken('');
      window.__tmlConnectors?.setEnabled(false);
      onConnectorChange?.({ status: 'disconnected', enabled: false });
    }
  };

  useEffect(() => { loadConnection(); }, []);

  const connect = async () => {
    if (!token.trim()) {
      setError('Enter a GitHub access token to connect GitHub. Your credential will be encrypted and stored securely with your account.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const session = await requireSession();
      const cleanToken = token.trim();

      const response = await fetch('/api/mcp-github', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: 'connect', token: cleanToken })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'GitHub connection failed.');

      const discovered = Array.isArray(data.tools) ? data.tools : [];
      const { error: saveError } = await supabase.rpc('save_github_connector', {
        p_token: cleanToken,
        p_enabled: false,
        p_metadata: { endpoint: GITHUB_ENDPOINT, tools: discovered.slice(0, 80) }
      });
      if (saveError) throw new Error(saveError.message || 'GitHub credential could not be saved securely.');

      const next = { status: 'connected', enabled: false };
      setTools(discovered);
      setHasStoredToken(true);
      setToken(cleanToken);
      setConnection(next);
      window.__tmlConnectors?.setToken(cleanToken);
      window.__tmlConnectors?.setEnabled(false);
      onConnectorChange?.(next);
      setShowConnect(false);
    } catch (e) {
      setError(e?.message || 'GitHub connection failed.');
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    setError('');
    try {
      await requireSession();
      const { error: disconnectError } = await supabase.rpc('delete_github_connector_token');
      if (disconnectError) throw disconnectError;

      const next = { status: 'disconnected', enabled: false };
      setConnection(next);
      setTools([]);
      setToken('');
      setHasStoredToken(false);
      window.__tmlConnectors?.setToken('');
      window.__tmlConnectors?.setEnabled(false);
      onConnectorChange?.(next);
    } catch (e) {
      setError(e?.message || 'GitHub could not be disconnected.');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async () => {
    if (connection.status !== 'connected') {
      setShowConnect(true);
      return;
    }
    if (!hasStoredToken) {
      setShowConnect(true);
      setError('Reconnect GitHub to restore the credential for this account.');
      return;
    }
    const nextEnabled = !connection.enabled;
    try {
      const { error: toggleError } = await supabase.rpc('set_github_connector_enabled', { p_enabled: nextEnabled });
      if (toggleError) throw toggleError;
      const next = { ...connection, enabled: nextEnabled };
      setConnection(next);
      window.__tmlConnectors?.setEnabled(next.status === 'connected' && next.enabled);
      onConnectorChange?.(next);
    } catch (e) {
      setError(e?.message || 'Unable to update the connector.');
    }
  };

  const statusLabel = connection.status === 'connected'
    ? (connection.enabled ? 'Connected · enabled' : 'Connected · disabled')
    : 'Not connected';

  return <div className="connectors-page">
    <button className="saved-back" onClick={onExit} aria-label="Back to chat">
      <ArrowLeft size={15} /> Back to chat
    </button>

    <div className="connectors-intro">
      <div className="connectors-eyebrow"><Plug size={13} /> CONNECTORS</div>
      <h1>Connect your tools.</h1>
      <p>Give your AI access to external services when you choose. Connections stay off until you explicitly enable them.</p>
    </div>

    <div className="connector-card" aria-labelledby="github-connector-title">
      <div className="connector-card-main">
        <div className="connector-icon"><Github size={22} /></div>
        <div className="connector-copy">
          <div className="connector-title-row">
            <h2 id="github-connector-title">GitHub</h2>
            <span className={`connector-status ${connection.status}`}>
              {connection.status === 'connected' ? <Check size={11} /> : <span className="connector-dot" />}
              {statusLabel}
            </span>
          </div>
          <p>Search repositories, inspect code, work with issues and pull requests, and use GitHub's official MCP tools from chat.</p>
          <div className="connector-endpoint">
            <span>Official GitHub MCP server</span>
            <span aria-hidden="true">·</span>
            <span>{tools.length ? `${tools.length} tools available` : 'Tools discovered after connection'}</span>
          </div>
        </div>
      </div>

      <div className="connector-actions">
        <button className={`connector-toggle ${connection.enabled ? 'on' : ''}`} onClick={toggle} disabled={busy} aria-pressed={connection.enabled}>
          <span><Power size={14} />{connection.enabled ? 'Enabled' : 'Disabled'}</span><i aria-hidden="true" />
        </button>
        {connection.status === 'connected' ? (
          <button className="connector-secondary" onClick={disconnect} disabled={busy}>
            {busy ? <Loader2 className="spin" size={14} /> : <X size={14} />} Disconnect
          </button>
        ) : (
          <button className="connector-primary" onClick={() => { setError(''); setShowConnect(true); }} disabled={busy}>
            <Github size={15} /> {hasStoredToken ? 'Reconnect GitHub' : 'Connect GitHub'}
          </button>
        )}
      </div>

      {connection.status === 'connected' && <div className="connector-permission">
        <ShieldCheck size={15} />
        <span><b>{connection.enabled ? 'GitHub tools are available to the AI.' : 'GitHub is connected but currently disabled.'}</b> {tools.length ? `${tools.length} MCP tools were discovered from the official server.` : 'Enable the connection when you want those tools available in chat.'}</span>
      </div>}
      {error && <div className="connector-error"><AlertCircle size={15} />{error}</div>}
    </div>

    <div className="connectors-note">
      <LockKeyhole size={15} />
      <div>
        <b>Your credential is stored securely.</b>
        <p>The GitHub credential is encrypted in your account's secure Supabase Vault and restored after you reload the app. It is never stored in localStorage or included in model messages.</p>
      </div>
    </div>

    <div className="connectors-doc">
      <ExternalLink size={14} />
      <a href="https://github.com/github/github-mcp-server" target="_blank" rel="noreferrer">Read the GitHub MCP Server documentation</a>
    </div>

    {showConnect && <div className="connector-modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setShowConnect(false)}>
      <div className="connector-modal" role="dialog" aria-modal="true" aria-labelledby="connector-modal-title">
        <button className="connector-modal-close" onClick={() => setShowConnect(false)} aria-label="Close"><X size={17} /></button>
        <div className="connector-modal-icon"><Github size={21} /></div>
        <h3 id="connector-modal-title">Connect GitHub</h3>
        <p>Connect the official GitHub MCP server. Your credential is encrypted and stored securely with your account so the connection survives page reloads.</p>
        <label>GitHub access token<input type="password" value={token} onChange={e => setToken(e.target.value)} autoComplete="off" placeholder="Paste token" /></label>
        <button className="connector-primary modal-connect" onClick={connect} disabled={busy}>{busy ? <><Loader2 className="spin" size={15} /> Checking…</> : <><Check size={15} /> Connect &amp; save</>}</button>
      </div>
    </div>}
  </div>;
}
