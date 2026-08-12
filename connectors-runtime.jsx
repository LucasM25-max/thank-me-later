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
  if (document.getElementById('tml-connectors-styles')) return;
  const style = document.createElement('style');
  style.id = 'tml-connectors-styles';
  style.textContent = `.tml-connectors-overlay{position:fixed;top:0;right:0;bottom:0;left:var(--tml-sidebar-left,270px);z-index:10;background:#f7f6f3;overflow:auto;pointer-events:none}.tml-connectors-overlay .connectors-page{pointer-events:auto}.connectors-page{width:min(900px,calc(100% - 48px));margin:0 auto;padding:28px 0 80px;color:#292724}.connectors-intro{max-width:720px;padding:42px 0 28px}.connectors-eyebrow{display:flex;align-items:center;gap:7px;color:#a15e45;font-size:11px;font-weight:700;letter-spacing:.08em}.connectors-intro h1{font:500 48px/1.05 'Source Serif 4',Georgia;margin:15px 0 12px;letter-spacing:-.045em}.connectors-intro p{margin:0;color:#77736d;font-size:15px;line-height:1.7}.connector-card{background:#fffdfa;border:1px solid #ded9d1;border-radius:18px;box-shadow:0 6px 22px #00000008;overflow:hidden}.connector-card-main{display:flex;gap:17px;padding:23px}.connector-icon{width:48px;height:48px;flex:none;border-radius:14px;background:#292724;color:#fff;display:grid;place-items:center}.connector-copy{min-width:0;flex:1}.connector-title-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.connector-title-row h2{margin:0;font-size:19px;letter-spacing:-.02em}.connector-status{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:4px 8px;font-size:10px;font-weight:700;background:#eeeae4;color:#777}.connector-status.connected{background:#edf6ee;color:#47704f}.connector-dot{width:6px;height:6px;border-radius:50%;background:#aaa}.connector-copy p{margin:8px 0 14px;color:#706a63;font-size:13px;line-height:1.55}.connector-endpoint{display:flex;align-items:center;gap:8px;flex-wrap:wrap;color:#918980;font-size:10px}.connector-endpoint code{padding:5px 7px;background:#f2efe9;border-radius:7px;color:#655d55;font:10px ui-monospace,SFMono-Regular,Consolas,monospace;overflow:hidden;text-overflow:ellipsis}.connector-actions{display:flex;gap:8px;align-items:center;padding:13px 18px;border-top:1px solid #eee9e2;background:#faf8f5}.connector-toggle,.connector-primary,.connector-secondary{border:1px solid #d9d3cb;border-radius:9px;padding:8px 11px;display:flex;align-items:center;gap:7px;font:600 12px DM Sans,Arial;cursor:pointer}.connector-primary{background:#d97757;border-color:#d97757;color:#fff}.connector-primary:hover{background:#c9684b}.connector-secondary{background:#fff;color:#5f5952}.connector-secondary:hover{background:#f1eee8}.connector-toggle{background:#fff;color:#666}.connector-toggle.on{background:#292724;color:#fff;border-color:#292724}.connector-toggle i{width:24px;height:14px;border-radius:99px;background:#d4cec6;position:relative}.connector-toggle i:after{content:'';position:absolute;top:2px;left:2px;width:10px;height:10px;border-radius:50%;background:#fff;transition:transform .18s}.connector-toggle.on i{background:#d97757}.connector-toggle.on i:after{transform:translateX(10px)}.connector-permission,.connector-error{margin:0 18px 14px;padding:10px 12px;border-radius:10px;display:flex;gap:8px;align-items:flex-start;font-size:11px;line-height:1.45}.connector-permission{background:#f0f6f0;color:#54705a}.connector-error{background:#fff0ee;color:#99483d}.connectors-note{display:flex;gap:11px;margin:16px 0 10px;padding:15px 16px;border:1px solid #e5dfd7;border-radius:13px;background:#f0ede8;color:#6d665f;font-size:11px;line-height:1.55}.connectors-note b{color:#4c4640}.connectors-note p{margin:3px 0 0}.connectors-doc{display:flex;align-items:center;gap:6px;font-size:11px;padding:3px 2px}.connectors-doc a{color:#a65e45;text-decoration:none}.connectors-doc a:hover{text-decoration:underline}.connector-modal-backdrop{position:fixed;inset:0;background:#2d292566;display:grid;place-items:center;padding:20px;z-index:20;pointer-events:auto}.connector-modal{position:relative;width:min(430px,100%);background:#fffdfa;border:1px solid #ded8d0;border-radius:18px;padding:25px;box-shadow:0 24px 80px #0003}.connector-modal-close{position:absolute;right:13px;top:13px;border:0;background:transparent;color:#777;padding:6px;border-radius:7px;cursor:pointer}.connector-modal-close:hover{background:#eeeae3;color:#333}.connector-modal-icon{width:38px;height:38px;border-radius:11px;background:#292724;color:#fff;display:grid;place-items:center}.connector-modal h3{margin:16px 0 7px;font-size:21px}.connector-modal p{margin:0 0 18px;color:#756e67;font-size:12px;line-height:1.55}.connector-modal label{display:grid;gap:7px;color:#59534c;font-size:11px;font-weight:700}.connector-modal input{width:100%;box-sizing:border-box;border:1px solid #d8d2ca;background:#fff;border-radius:10px;padding:11px 12px;font:13px DM Sans;color:#302d29;outline:none}.connector-modal input:focus{border-color:#b9a89a;box-shadow:0 0 0 3px #8c7b6b12}.modal-connect{width:100%;justify-content:center;margin-top:14px}.spin{animation:tml-spin .8s linear infinite}@keyframes tml-spin{to{transform:rotate(360deg)}}.tml-connectors-sidebar-button{position:relative!important;display:flex!important;visibility:visible!important;opacity:1!important;width:100%!important;min-width:0!important;height:40px!important;margin:2px 0 4px!important;padding:0 12px!important;border:0!important;border-radius:10px!important;background:transparent!important;color:#555!important;box-shadow:none!important;align-items:center!important;justify-content:flex-start!important;gap:9px!important;font:500 14px/1 DM Sans,Arial,sans-serif!important;cursor:pointer!important;box-sizing:border-box!important;transition:background .15s ease,color .15s ease!important}.tml-connectors-sidebar-button:hover{background:#e4e0d8!important;color:#292724!important}.tml-connectors-sidebar-button:focus-visible{outline:2px solid #c97055!important;outline-offset:-2px!important}.tml-connectors-sidebar-button .sidebar-tool-icon{width:16px;height:16px;flex:0 0 16px;border-radius:0;background:transparent;color:#9d634f;display:grid;place-items:center;font:700 16px/1 DM Sans,Arial,sans-serif;box-shadow:none}.tml-connectors-sidebar-button .sidebar-tool-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}@media(max-width:900px){.tml-connectors-sidebar-button{height:38px!important;margin:2px 0 3px!important;padding-left:10px!important}}`;
  document.head.appendChild(style);
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
