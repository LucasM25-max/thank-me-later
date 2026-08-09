(() => {
  let commandMenu = null;
  let connectorMenu = null;
  let pendingCommand = null;
  let connector = null;
  const COMMAND_MARKER = '\u2063[TML_COMMAND]\u2063';

  const qs = (s, root = document) => root.querySelector(s);
  const composer = () => qs('.composer');
  const textarea = () => qs('.composer textarea') || qs('textarea');
  const modelName = () => qs('.model > button')?.textContent?.replace(/\s+/g, ' ').trim() || '';
  const luna = () => /gpt[\s-]*5\.6[\s-]*luna/i.test(modelName());

  const remove = el => { if (el) el.remove(); };
  const closeMenus = () => { remove(commandMenu); commandMenu = null; remove(connectorMenu); connectorMenu = null; };

  function setValue(value) {
    const el = textarea();
    if (!el) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    if (setter) setter.call(el, value); else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.focus();
  }

  function githubIcon(size = 16) {
    const span = document.createElement('span');
    span.className = 'tml-github-icon';
    span.style.width = `${size}px`;
    span.style.height = `${size}px`;
    span.textContent = '●';
    span.setAttribute('aria-hidden', 'true');
    return span;
  }

  function makePill() {
    const el = textarea();
    if (!el) return;
    document.querySelectorAll('.tml-connector-pill').forEach(remove);
    if (!connector || !luna()) return;

    const pill = document.createElement('span');
    pill.className = 'tml-connector-pill';
    pill.append(githubIcon(15));
    const label = document.createElement('span');
    label.textContent = connector;
    pill.append(label);
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'tml-connector-remove';
    x.textContent = '×';
    x.setAttribute('aria-label', 'Remove GitHub connector');
    x.onclick = e => { e.preventDefault(); e.stopPropagation(); connector = null; makePill(); el.focus(); };
    pill.append(x);

    // The pill is a sibling immediately before the textarea, inside the same
    // text-entry row. It can therefore never render in a separate row above it.
    el.parentElement?.insertBefore(pill, el);
  }

  function openConnectorMenu() {
    remove(connectorMenu);
    const box = composer();
    const plus = qs('.tml-connector-button');
    if (!box || !plus || !luna()) return;

    connectorMenu = document.createElement('div');
    connectorMenu.className = 'tml-connector-menu';
    connectorMenu.innerHTML = '<div class="tml-connector-heading">Connectors</div>';

    const github = document.createElement('button');
    github.type = 'button';
    github.className = 'tml-connector-choice';
    github.append(githubIcon(20));
    const text = document.createElement('span');
    text.innerHTML = '<strong>GitHub</strong><small>Connect GitHub to this prompt</small>';
    github.append(text);
    github.onclick = e => {
      e.preventDefault();
      e.stopPropagation();
      connector = 'GitHub';
      makePill();
      remove(connectorMenu);
      connectorMenu = null;
      textarea()?.focus();
    };
    connectorMenu.append(github);
    box.append(connectorMenu);
  }

  function installPlus() {
    const box = composer();
    const el = textarea();
    if (!box || !el) return;

    let plus = qs('.tml-connector-button', box);
    if (!luna()) {
      remove(plus);
      remove(connectorMenu);
      document.querySelectorAll('.tml-connector-pill').forEach(remove);
      connector = null;
      return;
    }

    if (!plus) {
      plus = document.createElement('button');
      plus.type = 'button';
      plus.className = 'tml-connector-button';
      plus.setAttribute('aria-label', 'Connectors');
      plus.title = 'Connectors';
      plus.textContent = '+';
      plus.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        openConnectorMenu();
      };
      // Put it directly before the file/attachment control when possible.
      const file = Array.from(box.querySelectorAll('label,button')).find(node => {
        if (node === plus) return false;
        const s = `${node.getAttribute('title') || ''} ${node.getAttribute('aria-label') || ''} ${node.textContent || ''}`;
        return /attach|file|upload/i.test(s);
      });
      if (file) file.parentNode.insertBefore(plus, file.nextSibling);
      else el.parentElement?.insertBefore(plus, el);
    }

    // Keep it visible even if the app rerenders the composer.
    plus.style.display = 'inline-grid';
    plus.style.visibility = 'visible';
    plus.style.opacity = '1';
    plus.style.flex = '0 0 34px';
    plus.style.width = '34px';
    plus.style.height = '34px';
    plus.style.minWidth = '34px';
    plus.style.minHeight = '34px';
    plus.style.position = 'relative';
    plus.style.zIndex = '100';
    makePill();
  }

  function commandPill(label) {
    document.querySelectorAll('.tml-command-pill').forEach(remove);
    const el = textarea();
    if (!el) return;
    const p = document.createElement('span');
    p.className = 'tml-command-pill';
    p.textContent = label;
    el.parentElement?.insertBefore(p, el);
  }

  function commandMenu() {
    remove(commandMenu);
    const box = composer();
    if (!box) return;
    commandMenu = document.createElement('div');
    commandMenu.className = 'command-menu';
    const items = [];
    if (luna()) items.push(['web', 'Web search', 'Search current information']);
    if (luna()) items.push(['image', 'Create image', 'Create an image']);
    if (luna()) items.push(['research', 'Deep research', 'Research the request']);
    items.push(['code', 'Code', 'Use coding mode']);
    items.forEach(([kind, label, description]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = `<strong>${label}</strong><span>${description}</span>`;
      b.onclick = e => {
        e.preventDefault(); e.stopPropagation();
        const el = textarea(); if (!el) return;
        const current = el.value.replace(/\/$/, '').replace(/^\u2063\[TML_COMMAND\]\u2063\s*/, '').trimStart();
        pendingCommand = kind;
        setValue(`${COMMAND_MARKER}${current ? ` ${current}` : ''}`);
        commandPill(kind === 'code' ? 'Code' : kind === 'web' ? 'Web search' : kind === 'image' ? 'Create image' : 'Deep research');
        remove(commandMenu); commandMenu = null;
      };
      commandMenu.append(b);
    });
    box.append(commandMenu);
  }

  function patchSend() {
    if (window.__tmlConnectorSendPatched) return;
    const original = window.fetch;
    window.fetch = async (input, init) => {
      try {
        const url = typeof input === 'string' ? input : input?.url || '';
        if (url.endsWith('/api/chat') && init?.body) {
          const body = JSON.parse(init.body);
          body.mode = 'chat';
          if (Array.isArray(body.messages) && body.messages.length) {
            const last = body.messages[body.messages.length - 1];
            if (last?.role === 'user') {
              let content = String(last.content || '').replace(COMMAND_MARKER, '').trim();
              if (connector && /gpt[\s-]*5\.6[\s-]*luna/i.test(String(body.model || ''))) {
                if (!/^@GitHub\b/i.test(content)) content = `@GitHub${content ? ` ${content}` : ''}`;
              }
              if (pendingCommand) {
                const prefix = pendingCommand === 'web' ? '@Web search' : pendingCommand === 'image' ? '@Create image' : pendingCommand === 'research' ? '@Deep research' : '';
                if (prefix) content = `${prefix}${content ? ` ${content}` : ''}`;
                body.codeCommand = pendingCommand === 'code';
              }
              body.messages = body.messages.map((m, i) => i === body.messages.length - 1 ? { ...m, content } : m);
            }
          }
          connector = null;
          pendingCommand = null;
          document.querySelectorAll('.tml-connector-pill,.tml-command-pill').forEach(remove);
          init = { ...init, body: JSON.stringify(body) };
        }
      } catch (_) {}
      return original(input, init);
    };
    window.__tmlConnectorSendPatched = true;
  }

  function bind() {
    installPlus();
    const el = textarea();
    if (el && !el.dataset.tmlCommandsBound) {
      el.dataset.tmlCommandsBound = '1';
      el.addEventListener('input', () => {
        if (el.value.endsWith('/')) commandMenu();
        else if (!el.value.includes(COMMAND_MARKER)) remove(commandMenu);
      }, true);
      el.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenus(); }, true);
    }
    patchSend();
  }

  new MutationObserver(bind).observe(document.documentElement, { childList: true, subtree: true });
  window.setInterval(bind, 300);
  bind();
})();
