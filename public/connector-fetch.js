(() => {
  'use strict';
  let originalFetch = null;
  let hooked = false;

  function hook() {
    if (hooked || typeof window.fetch !== 'function') return;
    hooked = true;
    originalFetch = window.fetch;
    window.fetch = async function(request, init) {
      try {
        const selected = document.querySelector('#tml-connectors-button[data-selected="github"]');
        if (selected && init?.body) {
          const url = typeof request === 'string' ? request : request?.url || '';
          if (url.endsWith('/api/chat')) {
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
            selected.removeAttribute('data-selected');
          }
        }
      } catch (_) {}
      return originalFetch.call(this, request, init);
    };
  }

  function watch() {
    const button = document.querySelector('#tml-connectors-button');
    if (button && !button.dataset.fetchHookReady) {
      button.dataset.fetchHookReady = '1';
      button.addEventListener('click', () => {
        // The connector menu script sets this marker when GitHub is selected.
      });
    }
    hook();
  }
  setInterval(watch, 250);
  watch();
})();
