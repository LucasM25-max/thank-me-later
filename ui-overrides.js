(() => {
  const CODE_MARKER = '\u2063[TML_CODE_COMMAND]\u2063';
  let menu = null;
  let codeSelected = false;
  let suppressNextSlash = false;

  const getComposer = () => document.querySelector('.composer');
  const getTextarea = () => document.querySelector('.composer textarea') || document.querySelector('textarea');
  const getModel = () => document.querySelector('.model > button')?.textContent?.trim() || '';
  const isGPT = () => /GPT-5\.6 Luna/i.test(getModel());

  function cleanIcons() {
    document.querySelectorAll('svg').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.mode').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.sidebar-collapsed .chat-row').forEach(el => el.style.display = 'none');
  }

  function closeMenu() {
    menu?.remove();
    menu = null;
  }

  function setReactTextarea(value) {
    const textarea = getTextarea();
    if (!textarea) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    setter?.call(textarea, value);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.focus();
  }

  function selectCommand(kind) {
    const textarea = getTextarea();
    if (!textarea) return;
    const current = textarea.value.replace(/\/$/, '').trimStart();
    if (kind === 'code') {
      codeSelected = true;
      setReactTextarea(`${CODE_MARKER}${current ? ` ${current}` : ''}`);
    } else {
      codeSelected = false;
      setReactTextarea(current);
      const pill = document.createElement('span');
      pill.className = 'tml-command-pill';
      pill.textContent = kind === 'web' ? 'Web search' : kind === 'image' ? 'Create image' : 'Deep research';
      pill.dataset.command = kind;
      const pending = document.querySelector('.pending');
      if (pending) pending.prepend(pill);
      if (kind === 'web') document.querySelector('.web-pill')?.click?.();
    }
    closeMenu();
  }

  function makeMenu() {
    closeMenu();
    const composer = getComposer();
    if (!composer) return;
    menu = document.createElement('div');
    menu.id = 'tml-command-menu';
    menu.className = 'command-menu';
    const items = [];
    if (isGPT()) items.push(['web', 'Web search', 'Search the web for current information']);
    if (isGPT()) items.push(['image', 'Create image', 'Create an image from your prompt']);
    if (isGPT()) items.push(['research', 'Deep research', 'Carry out deeper research on the request']);
    items.push(['code', 'Code', 'Use the dedicated coding system prompt']);
    items.forEach(([kind, label, description]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.innerHTML = `<strong>${label}</strong><span>${description}</span>`;
      button.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); selectCommand(kind); });
      menu.appendChild(button);
    });
    composer.appendChild(menu);
  }

  function bind() {
    cleanIcons();
    const textarea = getTextarea();
    if (textarea && !textarea.dataset.tmlBound) {
      textarea.dataset.tmlBound = '1';
      textarea.addEventListener('input', () => {
        if (textarea.value.endsWith('/') && !suppressNextSlash) makeMenu();
        else if (!textarea.value.endsWith('/')) closeMenu();
      }, true);
      textarea.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeMenu();
      }, true);
    }
    if (!document.body.dataset.tmlFetchPatched) patchFetch();
  }

  function patchFetch() {
    const original = window.fetch;
    window.fetch = async function(input, init) {
      try {
        const url = typeof input === 'string' ? input : input?.url || '';
        if (url.endsWith('/api/chat') && init?.body) {
          const body = JSON.parse(init.body);
          body.mode = 'chat';
          if (codeSelected) {
            body.codeCommand = true;
            body.messages = Array.isArray(body.messages) ? body.messages.map((m, i) => i === body.messages.length - 1 ? { ...m, content: String(m.content || '').replace(CODE_MARKER, '').trim() } : m) : body.messages;
            codeSelected = false;
          }
          init = { ...init, body: JSON.stringify(body) };
        }
      } catch {}
      return original.call(this, input, init);
    };
    document.body.dataset.tmlFetchPatched = '1';
  }

  new MutationObserver(() => bind()).observe(document.documentElement, { childList: true, subtree: true });
  setInterval(bind, 700);
  bind();
})();
