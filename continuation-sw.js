const CONTINUE_HEADER = 'x-tml-continuation';
const MAX_CONTINUATIONS = 64;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

async function continueChat(request) {
  let body;
  try { body = await request.clone().json(); } catch { return fetch(request); }
  let currentBody = body;

  for (let attempt = 0; attempt < MAX_CONTINUATIONS; attempt += 1) {
    const nextRequest = new Request(request, {
      headers: new Headers({ ...Object.fromEntries(request.headers.entries()), [CONTINUE_HEADER]: '1' }),
      body: JSON.stringify(currentBody)
    });
    const response = await fetch(nextRequest);
    if (!response.ok) return response;

    let data;
    try { data = await response.clone().json(); } catch { return response; }
    if (!data?.continuation || !Array.isArray(data.messages)) return response;

    currentBody = { ...currentBody, messages: data.messages };
  }

  return new Response(JSON.stringify({ error: 'The model required more continuation steps than the safety limit allows.' }), {
    status: 504,
    headers: { 'content-type': 'application/json' }
  });
}

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.pathname !== '/api/chat' || event.request.method !== 'POST') return;
  if (event.request.headers.get(CONTINUE_HEADER) === '1') return;
  event.respondWith(continueChat(event.request));
});
