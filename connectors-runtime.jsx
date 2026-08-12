import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Connectors } from './connectors.jsx';
import { supabase } from './account-auth.jsx';

let githubToken = '';
let githubEnabled = false;
let githubSessionId = null;
let githubProtocol = 'modern';
const originalFetch = window.fetch.bind(window);
let installed = false;

function installStyles() {
  // Connector visuals are owned exclusively by style.css. Runtime code only mounts the screen.
}

function toolPrompt(tools) {
  const compact = tools.slice(0, 40).map(t => ({ name: t.name, description: t.description || '', inputSchema: t.inputSchema || {} }));
  return `GITHUB CONNECTOR: The user explicitly enabled GitHub. You may use the official GitHub MCP tools below. Never invent tool results. When you need GitHub data or an action, output exactly one line in this form and nothing else around the tool request: <github_tool>{"name":"TOOL_NAME","arguments":{}}</github_tool>. Use only a tool from this list and provide arguments matching its schema. After receiving a [GitHub MCP tool result], answer the user normally. Do not reveal or request the user's access token.\nTOOLS:\n${JSON.stringify(compact)}`;
}

async function callGateway(action, body) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Your account session has expired. Please sign in again.');
  const response = await originalFetch('/api/mcp-github', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ action, token: githubToken, sessionId: githubSessionId, protocol: githubProtocol, ...body }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || 'GitHub connector request failed.');
  if (data.sessionId !== undefined) githubSessionId = data.sessionId;
  if (data.protocol) githubProtocol = data.protocol;
  return data;
}

async function chatWithGithub(request) {
  const first = JSON.parse(request.body || '{}');
  const toolsResponse = await callGateway('connect', {});
  const tools = toolsResponse.tools || [];
  let messages = [...(first.messages || []), { role: 'user', content: `${toolPrompt(tools)}\n\nContinue with the user's original request above.` }];
  let data;
  for (let i = 0; i < 4; i += 1) {
    const response = await originalFetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...first, messages }) });
    data = await response.json();
    if (!response.ok) return new Response(JSON.stringify(data), { status: response.status, headers: { 'content-type': 'application/json' } });
    const match = String(data?.text || '').match(/<github_tool>([\s\S]*?)<\/github_tool>/i);
    if (!match) break;
    let call;
    try { call = JSON.parse(match[1]); } catch { break; }
    const allowed = tools.find(t => t.name === call?.name);
    if (!allowed) break;
    let toolResult;
    try { toolResult = await callGateway('call', { tool: call.name, arguments: call.arguments || {} }); } catch (error) { toolResult = { result: { isError: true, content: [{ type: 'text', text: error.message }] } }; }
    const assistantText = String(data?.text || '').replace(match[0], '').trim();
    messages = [...messages, { role: 'assistant', content: assistantText }, { role: 'user', content: `[GitHub MCP tool result for ${call.name}]\n${JSON.stringify(toolResult.result || toolResult).slice(0, 30000)}\n\nUse this result to answer the original user request. If another GitHub tool is necessary, emit another <github_tool> request; otherwise answer normally.` }];
  }
  return new Response(JSON.stringify(data || { text: 'No response returned.' }), { status: 200, headers: { 'content-type': 'application/json' } });
}

function installFetchInterceptor() {
  if (installed) return;
  installed = true;
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    if (githubEnabled && url.includes('/api/chat') && init?.body) return chatWithGithub({ body: init.body });
    return originalFetch(input, init);
  };
}

async function restoreGithubRuntimeState() {
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData?.session?.user?.id) return;
    const userId = sessionData.session.user.id;
    const [{ data: connection, error: connectionError }, { data: storedToken, error: tokenError }] = await Promise.all([
      supabase.from('connector_connections').select('status, enabled, metadata').eq('user_id', userId).eq('connector_id', 'github').maybeSingle(),
      supabase.rpc('get_github_connector_token')
    ]);
    if (connectionError || tokenError) return;
    const hasToken = typeof storedToken === 'string' && storedToken.length >= 10;
    if (!hasToken || connection?.status !== 'connected') { githubToken = ''; githubEnabled = false; return; }
    githubToken = storedToken;
    githubEnabled = connection.enabled === true;
  } catch { githubToken = ''; githubEnabled = false; }
}

function updateOverlayPosition() {
  const sidebar = document.querySelector('.sidebar');
  const width = sidebar?.getBoundingClientRect().width || 270;
  document.documentElement.style.setProperty('--tml-sidebar-left', `${Math.max(0, width)}px`);
}

function setConnectorScreen(open) {
  document.documentElement.classList.toggle('tml-connectors-open', open);
  document.body.classList.toggle('tml-connectors-open', open);
  if (open) updateOverlayPosition();
}

function SidebarConnectorButton({ onOpen }) {
  useEffect(() => {
    const find = () => {
      const candidates = [...document.querySelectorAll('button, a, [role="button"], .sidebar-tool')];
      const library = candidates.find(el => {
        const label = el.querySelector?.('.sidebar-tool-label')?.textContent?.trim() || el.textContent?.trim() || '';
        return label === 'Library' || label.endsWith('Library');
      });
      if (!library) return;
      let button = document.getElementById('tml-connectors-sidebar-button');
      if (!button) {
        button = document.createElement('button');
        button.id = 'tml-connectors-sidebar-button';
        button.type = 'button';
        button.className = 'sidebar-tool tml-connectors-sidebar-button';
        button.setAttribute('aria-label', 'Connectors');
        button.innerHTML = '<span class="sidebar-tool-icon" aria-hidden="true">✦</span><span class="sidebar-tool-label">Connectors</span>';
        button.addEventListener('click', onOpen);
        const parent = library.parentElement;
        if (parent) parent.insertBefore(button, library);
      }
      updateOverlayPosition();
    };
    find();
    const observer = new MutationObserver(find);
    observer.observe(document.body, { childList: true, subtree: true });
    const resize = () => updateOverlayPosition();
    window.addEventListener('resize', resize);
    return () => { observer.disconnect(); window.removeEventListener('resize', resize); };
  }, [onOpen]);
  return null;
}

function Overlay({ close }) {
  return <div className="tml-connectors-overlay"><Connectors onExit={close} onConnectorChange={state => { githubEnabled = state.status === 'connected' && state.enabled; }} /></div>;
}

function boot() {
  installStyles();
  installFetchInterceptor();
  const mount = document.createElement('div');
  mount.id = 'tml-connectors-runtime';
  document.body.appendChild(mount);
  let root = null;
  let sidebarNavigationCleanup = null;

  const close = () => {
    if (!root) return;
    sidebarNavigationCleanup?.();
    sidebarNavigationCleanup = null;
    root.unmount();
    root = null;
    setConnectorScreen(false);
  };

  const installSidebarNavigationClose = () => {
    const onSidebarPointerDown = event => {
      if (!root) return;
      const target = event.target instanceof Element ? event.target : event.target?.parentElement;
      if (!target) return;
      if (target.closest('#tml-connectors-sidebar-button')) return;
      if (!target.closest('.sidebar')) return;
      const navigationTarget = target.closest('button, a, [role="button"], .sidebar-tool');
      if (!navigationTarget) return;
      close();
    };
    document.addEventListener('pointerdown', onSidebarPointerDown, true);
    sidebarNavigationCleanup = () => document.removeEventListener('pointerdown', onSidebarPointerDown, true);
  };

  const open = () => {
    if (root) return;
    setConnectorScreen(true);
    updateOverlayPosition();
    root = createRoot(mount);
    root.render(<Overlay close={close} />);
    installSidebarNavigationClose();
  };

  const helper = document.createElement('div');
  helper.style.display = 'none';
  document.body.appendChild(helper);
  createRoot(helper).render(<SidebarConnectorButton onOpen={open} />);
  window.__tmlConnectors = { setToken: token => { githubToken = token || ''; }, setEnabled: enabled => { githubEnabled = !!enabled; } };
  restoreGithubRuntimeState();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
