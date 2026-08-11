import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Connectors } from './connectors.jsx';

let githubToken = '';
let githubEnabled = false;
let githubSessionId = null;
let originalFetch = window.fetch.bind(window);
let installed = false;

function toolPrompt(tools) {
  const compact = tools.slice(0, 40).map(t => ({ name: t.name, description: t.description || '', inputSchema: t.inputSchema || {} }));
  return `\n\nGITHUB CONNECTOR: The user explicitly enabled GitHub. You may use the official GitHub MCP tools below. Never invent tool results. When you need GitHub data or an action, output exactly one line in this form and nothing else around the tool request: <github_tool>{"name":"TOOL_NAME","arguments":{}}</github_tool>. Use only a tool from this list and provide arguments matching its schema. After receiving a [GitHub MCP tool result], answer the user normally. Do not reveal or request the user's access token.\nTOOLS:\n${JSON.stringify(compact)}`;
}

async function callGateway(action, body) {
  const response = await originalFetch('/api/mcp-github', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, token: githubToken, sessionId: githubSessionId, ...body }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || 'GitHub connector request failed.');
  if (data.sessionId) githubSessionId = data.sessionId;
  return data;
}

async function chatWithGithub(request) {
  const first = JSON.parse(request.body || '{}');
  const toolsResponse = await callGateway('connect', {});
  githubSessionId = toolsResponse.sessionId || githubSessionId;
  const tools = toolsResponse.tools || [];
  const enriched = { ...first, messages: [...(first.messages || []), { role: 'user', content: `${toolPrompt(tools)}\n\nContinue with the user's original request above.` }] };
  let response = await originalFetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(enriched) });
  let data = await response.json();
  if (!response.ok) return new Response(JSON.stringify(data), { status: response.status, headers: { 'content-type': 'application/json' } });
  for (let i = 0; i < 3; i += 1) {
    const match = String(data?.text || '').match(/<github_tool>([\s\S]*?)<\/github_tool>/i);
    if (!match) break;
    let call;
    try { call = JSON.parse(match[1]); } catch { break; }
    const allowed = tools.find(t => t.name === call?.name);
    if (!allowed) break;
    let toolResult;
    try { toolResult = await callGateway('call', { tool: call.name, arguments: call.arguments || {} }); }
    catch (error) { toolResult = { result: { isError: true, content: [{ type: 'text', text: error.message }] } }; }
    const assistantText = String(data?.text || '').replace(match[0], '').trim();
    const followup = { ...first, messages: [...(first.messages || []), { role: 'assistant', content: assistantText }, { role: 'user', content: `[GitHub MCP tool result for ${call.name}]\n${JSON.stringify(toolResult.result || toolResult).slice(0, 30000)}\n\nUse this result to answer the original user request. Do not call another tool unless necessary.` }] };
    response = await originalFetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(followup) });
    data = await response.json();
    if (!response.ok) break;
  }
  return new Response(JSON.stringify(data), { status: response.status, headers: { 'content-type': 'application/json' } });
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

function SidebarConnectorButton({ onOpen }) {
  useEffect(() => {
    const find = () => {
      const sidebar = document.querySelector('.sidebar');
      const library = [...document.querySelectorAll('.sidebar-tool')].find(el => el.textContent?.trim() === 'Library');
      if (!sidebar || !library) return;
      let button = document.getElementById('tml-connectors-sidebar-button');
      if (!button) {
        button = document.createElement('button');
        button.id = 'tml-connectors-sidebar-button';
        button.className = 'sidebar-tool tml-connectors-sidebar-button';
        button.innerHTML = '<span class="sidebar-tool-icon">⌘</span><span>Connectors</span>';
        button.addEventListener('click', onOpen);
        library.parentElement.insertBefore(button, library);
      }
    };
    find();
    const observer = new MutationObserver(find);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [onOpen]);
  return null;
}

function Overlay({ close }) {
  return <div className="tml-connectors-overlay"><Connectors onExit={close} onConnectorChange={state => { githubEnabled = state.status === 'connected' && state.enabled; }} /></div>;
}

function boot() {
  installFetchInterceptor();
  const mount = document.createElement('div'); mount.id = 'tml-connectors-runtime'; document.body.appendChild(mount);
  let root = null;
  const open = () => { if (root) return; root = createRoot(mount); root.render(<Overlay close={() => { root?.unmount(); root = null; }} />); };
  createRoot(document.createElement('div')).render(<SidebarConnectorButton onOpen={open} />);
  window.__tmlConnectors = { setToken: token => { githubToken = token || ''; }, setEnabled: enabled => { githubEnabled = !!enabled; } };
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
