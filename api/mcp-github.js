export const maxDuration = 60;

const MCP_URL = 'https://api.githubcopilot.com/mcp/';
const MODERN_VERSION = '2026-07-28';
const SUPABASE_URL = 'https://pwoctabbdrlrvusfrffq.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_LeW85hQR5fdSMfsq516OKw_6nHXtchR';

async function verifyAppSession(req) {
  const authorization = req.headers.authorization || '';
  if (!authorization.startsWith('Bearer ')) return false;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_PUBLISHABLE_KEY, authorization } });
  return response.ok;
}

async function readMcpResponse(response) {
  const text = await response.text();
  if (!text) return {};
  if (response.headers.get('content-type')?.includes('text/event-stream')) {
    let result = {};
    for (const block of text.split(/\n\n+/)) for (const line of block.split(/\r?\n/)) {
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try { result = JSON.parse(payload); } catch {}
    }
    return result;
  }
  try { return JSON.parse(text); } catch { return { raw: text.slice(0, 4000) }; }
}

async function modernRequest(token, method, params = {}, id = Date.now()) {
  const headers = { 'content-type': 'application/json', accept: 'application/json, text/event-stream', authorization: `Bearer ${token}`, 'mcp-protocol-version': MODERN_VERSION, 'mcp-method': method, 'mcp-name': 'github' };
  const response = await fetch(MCP_URL, { method: 'POST', headers, body: JSON.stringify({ jsonrpc: '2.0', id, method, params }) });
  return { response, data: await readMcpResponse(response) };
}

async function legacyRequest(token, body, sessionId) {
  const headers = { 'content-type': 'application/json', accept: 'application/json, text/event-stream', authorization: `Bearer ${token}` };
  if (sessionId) headers['mcp-session-id'] = sessionId;
  const response = await fetch(MCP_URL, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await readMcpResponse(response);
  return { response, data, sessionId: response.headers.get('mcp-session-id') || sessionId || null };
}

async function connect(token) {
  const modern = await modernRequest(token, 'tools/list', {}, 1);
  if (modern.response.ok && !modern.data?.error) return { protocol: 'modern', sessionId: null, tools: modern.data?.result?.tools || [] };
  const init = await legacyRequest(token, { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'thank-me-later', version: '1.0.0' } } });
  if (!init.response.ok) throw new Error(init.data?.error?.message || modern.data?.error?.message || 'GitHub MCP authentication failed.');
  await legacyRequest(token, { jsonrpc: '2.0', method: 'notifications/initialized', params: {} }, init.sessionId);
  const listed = await legacyRequest(token, { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }, init.sessionId);
  if (!listed.response.ok) throw new Error(listed.data?.error?.message || 'GitHub MCP tool discovery failed.');
  return { protocol: 'legacy', sessionId: listed.sessionId, tools: listed.data?.result?.tools || [] };
}

async function callTool(token, name, arguments_, protocol, sessionId) {
  if (protocol === 'modern') {
    const result = await modernRequest(token, 'tools/call', { name, arguments: arguments_ || {} });
    if (!result.response.ok || result.data?.error) throw new Error(result.data?.error?.message || 'GitHub MCP tool call failed.');
    return result.data?.result || {};
  }
  const result = await legacyRequest(token, { jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name, arguments: arguments_ || {} } }, sessionId);
  if (!result.response.ok || result.data?.error) throw new Error(result.data?.error?.message || 'GitHub MCP tool call failed.');
  return result.data?.result || {};
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await verifyAppSession(req))) return res.status(401).json({ error: 'Sign in to use Connectors.' });
  try {
    const { action, token, tool, arguments: toolArguments, sessionId, protocol } = req.body || {};
    if (typeof token !== 'string' || token.trim().length < 10) return res.status(400).json({ error: 'A valid GitHub access token is required.' });
    if (action === 'connect') {
      const result = await connect(token.trim());
      return res.status(200).json({ connected: true, protocol: result.protocol, sessionId: result.sessionId, tools: result.tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
    }
    if (action === 'call') {
      if (!tool) return res.status(400).json({ error: 'Missing MCP tool name.' });
      const result = await callTool(token.trim(), tool, toolArguments, protocol || 'modern', sessionId);
      return res.status(200).json({ result });
    }
    return res.status(400).json({ error: 'Unsupported action.' });
  } catch (error) {
    return res.status(502).json({ error: error?.message || 'GitHub MCP request failed.' });
  }
}
