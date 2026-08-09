(() => {
  'use strict';

  const originalFetch = window.fetch.bind(window);

  function decorateBody(body) {
    if (!body || typeof body !== 'object') return body;
    const messages = Array.isArray(body.messages) ? body.messages.map((message) => ({ ...message })) : null;
    if (!messages?.length) return body;

    const last = messages[messages.length - 1];
    const enabled = (() => {
      try { return localStorage.getItem('tml-github-connector') === '1'; } catch { return false; }
    })();

    if (enabled && last?.role === 'user' && typeof last.content === 'string') {
      const content = last.content.trim();
      if (content && !/^@GitHub\b/i.test(content)) {
        last.content = `@GitHub ${last.content}`;
      }
    }

    return { ...body, messages };
  }

  window.fetch = async (input, init = {}) => {
    try {
      const url = typeof input === 'string' ? input : input?.url || '';
      const isChatRequest = /\/api\/chat(?:\/|\?|$)/i.test(url);
      const rawBody = init?.body;

      if (isChatRequest && typeof rawBody === 'string' && rawBody.trim()) {
        const body = JSON.parse(rawBody);
        const decorated = decorateBody(body);
        init = { ...init, body: JSON.stringify(decorated) };
      }
    } catch (error) {
      // Connector decoration must never prevent an otherwise valid request.
      console.warn('Connector request decoration skipped:', error);
    }

    return originalFetch(input, init);
  };
})();
