(() => {
  let menu = null;
  let pendingCommand = null;
  const COMMAND_MARKER = '\u2063[TML_COMMAND]\u2063';

  const getComposer = () => document.querySelector('.composer');
  const getTextarea = () => document.querySelector('.composer textarea') || document.querySelector('textarea');
  const getModel = () => document.querySelector('.model > button')?.textContent?.trim() || '';
  const isGPT = () => /GPT-5\.6 Luna/i.test(getModel());

  function cleanIcons() {
    document.querySelectorAll('svg').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.mode').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.sidebar-collapsed .chat-row').forEach(el => el.style.display = 'none');
    document.querySelectorAll('[title="Open sidebar"]').forEach(el => {
      if (!el.closest('.sidebar')) el.style.display = 'none';
    });
  }

  function closeMenu() { menu?.remove(); menu = null; }

  function setReactTextarea(value) {
    const textarea = getTextarea();
    if (!textarea) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    setter?.call(textarea, value);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.focus();
  }

  function addPill(label) {
    const pending = document.querySelector('.pending');
    if (!pending) return;
    pending.querySelectorAll('.tml-command-pill').forEach(p => p.remove());
    const pill = document.createElement('span');
    pill.className = 'tml-command-pill';
    pill.textContent = label;
    pending.prepend(pill);
  }

  function selectCommand(kind) {
    const textarea = getTextarea();
    if (!textarea) return;
    const current = textarea.value.replace(/\/$/, '').replace(/^\u2063\[TML_COMMAND\]\u2063\s*/, '').trimStart();
    pendingCommand = kind;
    setReactTextarea(`${COMMAND_MARKER}${current ? ` ${current}` : ''}`);
    addPill(kind === 'code' ? 'Code' : kind === 'web' ? 'Web search' : kind === 'image' ? 'Create image' : 'Deep research');
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
        if (textarea.value.endsWith('/')) makeMenu();
        else if (!textarea.value.includes(COMMAND_MARKER)) closeMenu();
      }, true);
      textarea.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); }, true);
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
          if (pendingCommand) {
            const command = pendingCommand;
            const prefix = command === 'web' ? '@Web search' : command === 'image' ? '@Create image' : command === 'research' ? '@Deep research' : '';
            body.messages = Array.isArray(body.messages) ? body.messages.map((m, i) => {
              if (i !== body.messages.length - 1) return m;
              let content = String(m.content || '').replace(COMMAND_MARKER, '').trim();
              if (prefix) content = `${prefix}${content ? ` ${content}` : ''}`;
              return { ...m, content };
            }) : body.messages;
            body.codeCommand = command === 'code';
            pendingCommand = null;
          }
          init = { ...init, body: JSON.stringify(body) };
        }
      } catch {}
      return original.call(this, input, init);
    };
    document.body.dataset.tmlFetchPatched = '1';
  }

  new MutationObserver(bind).observe(document.documentElement, { childList: true, subtree: true });
  setInterval(bind, 700);
  bind();
})();
