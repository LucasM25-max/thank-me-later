(() => {
  let menu = null;
  let connectorMenu = null;
  let pendingCommand = null;
  let selectedConnector = null;
  const COMMAND_MARKER = '\u2063[TML_COMMAND]\u2063';
  const CONNECTOR_MARKER = '\u2063[TML_CONNECTOR]\u2063';

  const getComposer = () => document.querySelector('.composer');
  const getTextarea = () => document.querySelector('.composer textarea') || document.querySelector('textarea');
  const getModel = () => document.querySelector('.model > button')?.textContent?.trim() || '';
  const isGPT = () => /GPT-5\.6 Luna/i.test(getModel());

  function closeMenu() { menu?.remove(); menu = null; }
  function closeConnectorMenu() { connectorMenu?.remove(); connectorMenu = null; }

  function setTextareaValue(value) {
    const textarea = getTextarea();
    if (!textarea) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    setter?.call(textarea, value);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.focus();
  }

  function githubLogo() {
    const img = document.createElement('img');
    img.className = 'tml-github-logo';
    img.alt = '';
    img.src = 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png';
    img.onerror = () => { img.style.display = 'none'; };
    return img;
  }

  function addCommandPill(label) {
    const composer = getComposer();
    if (!composer) return;
    composer.querySelectorAll('.tml-command-pill').forEach(p => p.remove());
    const pill = document.createElement('span');
    pill.className = 'tml-command-pill';
    pill.textContent = label;
    const textarea = getTextarea();
    if (textarea) textarea.parentElement?.insertBefore(pill, textarea);
  }

  function addConnectorPill() {
    const composer = getComposer();
    const textarea = getTextarea();
    if (!composer || !textarea) return;
    composer.querySelectorAll('.tml-connector-inline').forEach(p => p.remove());
    if (!selectedConnector || !isGPT()) return;

    const pill = document.createElement('span');
    pill.className = 'tml-connector-inline';
    pill.title = 'GitHub connector';
    pill.appendChild(githubLogo());

    const label = document.createElement('span');
    label.textContent = selectedConnector;
    pill.appendChild(label);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'tml-connector-remove';
    remove.setAttribute('aria-label', 'Remove GitHub connector');
    remove.textContent = '×';
    remove.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      selectedConnector = null;
      addConnectorPill();
    });
    pill.appendChild(remove);

    const wrapper = textarea.parentElement;
    if (wrapper && wrapper !== composer) {
      wrapper.insertBefore(pill, textarea);
    } else {
      textarea.before(pill);
    }
  }

  function selectCommand(kind) {
    const textarea = getTextarea();
    if (!textarea) return;
    const current = textarea.value
      .replace(/\/$/, '')
      .replace(/^\u2063\[TML_COMMAND\]\u2063\s*/, '')
      .trimStart();
    pendingCommand = kind;
    setTextareaValue(`${COMMAND_MARKER}${current ? ` ${current}` : ''}`);
    addCommandPill(kind === 'code' ? 'Code' : kind === 'web' ? 'Web search' : kind === 'image' ? 'Create image' : 'Deep research');
    closeMenu();
  }

  function makeCommandMenu() {
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

  function openConnectorMenu() {
    closeConnectorMenu();
    const composer = getComposer();
    if (!composer || !isGPT()) return;

    connectorMenu = document.createElement('div');
    connectorMenu.id = 'tml-connector-menu';
    connectorMenu.className = 'tml-connector-menu';

    const title = document.createElement('div');
    title.className = 'tml-connector-title';
    title.textContent = 'Connectors';
    connectorMenu.appendChild(title);

    const github = document.createElement('button');
    github.type = 'button';
    github.className = 'tml-connector-option';
    github.appendChild(githubLogo());
    const copy = document.createElement('span');
    const name = document.createElement('strong');
    name.textContent = 'GitHub';
    const description = document.createElement('small');
    description.textContent = 'Connect GitHub to this prompt';
    copy.append(name, description);
    github.appendChild(copy);
    github.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      selectedConnector = 'GitHub';
      addConnectorPill();
      closeConnectorMenu();
      getTextarea()?.focus();
    });
    connectorMenu.appendChild(github);
    composer.appendChild(connectorMenu);
  }

  function createConnectorButton() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tml-connector-button';
    button.title = 'Connectors';
    button.setAttribute('aria-label', 'Connectors');
    button.innerHTML = '<span aria-hidden="true">+</span>';
    button.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      openConnectorMenu();
    });
    return button;
  }

  function ensureConnectorButton() {
    const composer = getComposer();
    const textarea = getTextarea();
    if (!composer || !textarea) return;

    let button = composer.querySelector('.tml-connector-button');
    if (!isGPT()) {
      button?.remove();
      closeConnectorMenu();
      composer.querySelectorAll('.tml-connector-inline').forEach(p => p.remove());
      selectedConnector = null;
      return;
    }

    if (!button) {
      button = createConnectorButton();
      // Prefer the actual attachment/file control, but always keep a fallback.
      const fileControl = Array.from(composer.querySelectorAll('button, label')).find(el => {
        const text = `${el.getAttribute('title') || ''} ${el.getAttribute('aria-label') || ''} ${el.textContent || ''}`;
        return /attach|file|upload/i.test(text);
      });
      if (fileControl) {
        fileControl.insertAdjacentElement('afterend', button);
      } else {
        const controls = textarea.parentElement;
        if (controls) controls.insertBefore(button, textarea);
        else composer.insertBefore(button, textarea);
      }
    }

    // Reinsert if the host app has moved/removed it.
    if (!composer.contains(button)) {
      const controls = textarea.parentElement || composer;
      controls.insertBefore(button, textarea);
    }
    addConnectorPill();
  }

  function bind() {
    const textarea = getTextarea();
    if (textarea && !textarea.dataset.tmlBound) {
      textarea.dataset.tmlBound = '1';
      textarea.addEventListener('input', () => {
        if (textarea.value.endsWith('/')) makeCommandMenu();
        else if (!textarea.value.includes(COMMAND_MARKER)) closeMenu();
      }, true);
      textarea.addEventListener('keydown', e => {
        if (e.key === 'Escape') { closeMenu(); closeConnectorMenu(); }
      }, true);
    }
    ensureConnectorButton();
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
          if (selectedConnector && /gpt-5\.6-luna/i.test(String(body.model || ''))) {
            body.messages = Array.isArray(body.messages) ? body.messages.map((m, i) => {
              if (i !== body.messages.length - 1 || m.role !== 'user') return m;
              const content = String(m.content || '').replace(/^\s*/, '');
              if (/^@GitHub\b/i.test(content)) return m;
              return { ...m, content: `@${selectedConnector}${content ? ` ${content}` : ''}` };
            }) : body.messages;
            selectedConnector = null;
          }
          if (pendingCommand) {
            const command = pendingCommand;
            const prefix = command === 'web' ? '@Web search' : command === 'image' ? '@Create image' : command === 'research' ? '@Deep research' : '';
            body.messages = Array.isArray(body.messages) ? body.messages.map((m, i) => {
              if (i !== body.messages.length - 1 || m.role !== 'user') return m;
              let content = String(m.content || '').replace(COMMAND_MARKER, '').trim();
              if (prefix) {
                if (/^@GitHub\b/i.test(content)) {
                  content = content.replace(/^@GitHub\b\s*/i, '');
                  content = `@GitHub ${prefix}${content ? ` ${content}` : ''}`;
                } else content = `${prefix}${content ? ` ${content}` : ''}`;
              }
              return { ...m, content };
            }) : body.messages;
            body.codeCommand = command === 'code';
            pendingCommand = null;
          }
          init = { ...init, body: JSON.stringify(body) };
        }
      } catch (_) {}
      return original.call(this, input, init);
    };
    document.body.dataset.tmlFetchPatched = '1';
  }

  new MutationObserver(bind).observe(document.documentElement, { childList: true, subtree: true });
  setInterval(bind, 500);
  bind();
})();
