(() => {
  'use strict';
  let originalFetch = null;

  function hook() {
    if (originalFetch || typeof window.fetch !== 'function') return;
    originalFetch = window.fetch;
    window.fetch = async function(request, init) {
      try {
        const pill = document.querySelector('#tml-connector-pill');
        const selected = pill && getComputedStyle(pill).display !== 'none';
        const url = typeof request === 'string' ? request : request?.url || '';
        if (selected && url.endsWith('/api/chat') && init?.body) {
          const body = JSON.parse(init.body);
          const messages = Array.isArray(body.messages) ? body.messages.slice() : [];
          for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i]?.role === 'user') {
              const content = String(messages[i].content || '').trim();
              messages[i] = { ...messages[i], content: /^@GitHub\b/i.test(content) ? content : `@GitHub${content ? ` ${content}` : ''}` };
              break;
            }
          }
          body.messages = messages;
          init = { ...init, body: JSON.stringify(body) };
          pill.style.display = 'none';
        }
      } catch (_) {}
      return originalFetch.call(this, request, init);
    };
  }

  hook();
  setInterval(hook, 250);
})();
