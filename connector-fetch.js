(() => {
  'use strict';

  // The React composer owns the request body, so this small bridge is deliberately
  // outside React: it converts connector UI state into the same @-command syntax
  // understood by the model gateway. This also keeps the connector implementation
  // independent of React re-renders.
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    try {
      const url = typeof input === 'string' ? input : input?.url || '';
      if (/\/api\/chat(?:\?|$)/.test(url) && init?.body) {
        const state = localStorage.getItem('tml-github-connector') === '1';
        if (state) {
          const body = JSON.parse(init.body);
          if (Array.isArray(body.messages) && body.messages.length) {
            const last = body.messages[body.messages.length - 1];
            if (last?.role === 'user' && typeof last.content === 'string' && !/^@GitHub\b/i.test(last.content.trim())) {
              last.content = `@GitHub ${last.content}`;
            }
          }
          init = { ...init, body: JSON.stringify(body) };
        }
      }
    } catch (error) {
      // Never break sending because connector decoration failed.
      console.warn('Connector request decoration skipped:', error);
    }
    return originalFetch(input, init);
  };
})();
