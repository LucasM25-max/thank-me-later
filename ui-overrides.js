(() => {
  'use strict';

  /* ================================================================
     TML COMMAND + CONNECTOR UI
     Connector UI is self-contained and styled here so it cannot be
     hidden by the application's existing CSS.
     ================================================================ */

  const COMMAND_MARKER = '\u2063[TML_COMMAND]\u2063';
  let pendingCommand = null;
  let selectedConnector = null;
  let commandMenu = null;
  let connectorMenu = null;

  const $ = (selector, root = document) => root.querySelector(selector);
  const composer = () => $('.composer');
  const input = () => $('.composer textarea') || $('textarea');
  const model = () => $('.model > button')?.textContent?.replace(/\s+/g, ' ').trim() || '';
  const isLuna = () => /gpt\s*[- ]?5\.6\s*luna/i.test(model());

  function installStyles() {
    if ($('#tml-fresh-connector-css')) return;
    const style = document.createElement('style');
    style.id = 'tml-fresh-connector-css';
    style.textContent = `
      .composer .tml-fresh-plus {
        all: unset !important;
        box-sizing: border-box !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        flex: 0 0 36px !important;
        width: 36px !important;
        min-width: 36px !important;
        max-width: 36px !important;
        height: 36px !important;
        min-height: 36px !important;
        max-height: 36px !important;
        margin: 0 !important;
        padding: 0 !important;
        border: 0 !important;
        border-radius: 9px !important;
        background: transparent !important;
        color: #625d55 !important;
        cursor: pointer !important;
        font: 400 26px/36px Arial, sans-serif !important;
        opacity: 1 !important;
        visibility: visible !important;
        position: relative !important;
        z-index: 9999 !important;
        transform: none !important;
      }
      .composer .tml-fresh-plus:hover {
        background: #eeeae3 !important;
        color: #24211e !important;
      }
      .composer .tml-fresh-plus span {
        all: unset !important;
        display: block !important;
        font: 400 26px/36px Arial, sans-serif !important;
        color: inherit !important;
      }

      .composer .tml-fresh-pill {
        all: unset !important;
        box-sizing: border-box !important;
        display: inline-flex !important;
        align-items: center !important;
        flex: 0 0 auto !important;
        align-self: flex-end !important;
        height: 28px !important;
        min-height: 28px !important;
        margin: 0 6px 5px 2px !important;
        padding: 0 7px !important;
        gap: 5px !important;
        border: 1px solid #d6d1c8 !important;
        border-radius: 999px !important;
        background: #eeeae5 !important;
        color: #504b44 !important;
        font: 600 12px/28px DM Sans, Arial, sans-serif !important;
        white-space: nowrap !important;
        visibility: visible !important;
        opacity: 1 !important;
      }
      .composer .tml-fresh-pill img {
        width: 15px !important;
        height: 15px !important;
        display: block !important;
        flex: 0 0 15px !important;
      }
      .composer .tml-fresh-pill .tml-pill-remove {
        all: unset !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 17px !important;
        height: 17px !important;
        border-radius: 50% !important;
        color: #777168 !important;
        cursor: pointer !important;
        font: 400 15px/17px Arial, sans-serif !important;
      }
      .composer .tml-fresh-pill .tml-pill-remove:hover {
        background: #ded9d0 !important;
        color: #292621 !important;
      }

      .composer .tml-fresh-menu {
        position: absolute !important;
        left: 7px !important;
        bottom: calc(100% + 9px) !important;
        width: 270px !important;
        box-sizing: border-box !important;
        padding: 7px !important;
        background: #fff !important;
        border: 1px solid #ded9d1 !important;
        border-radius: 14px !important;
        box-shadow: 0 16px 40px rgba(0,0,0,.16) !important;
        z-index: 10000 !important;
      }
      .composer .tml-fresh-menu-title {
        padding: 8px 10px !important;
        color: #403c37 !important;
        font: 600 13px/18px DM Sans, Arial, sans-serif !important;
      }
      .composer .tml-fresh-github {
        all: unset !important;
        box-sizing: border-box !important;
        width: 100% !important;
        min-height: 50px !important;
        padding: 9px 10px !important;
        display: flex !important;
        align-items: center !important;
        gap: 10px !important;
        border-radius: 10px !important;
        cursor: pointer !important;
        color: #403c37 !important;
      }
      .composer .tml-fresh-github:hover { background: #f1eee8 !important; }
      .composer .tml-fresh-github img {
        width: 21px !important;
        height: 21px !important;
        display: block !important;
      }
      .composer .tml-fresh-github-text {
        display: flex !important;
        flex-direction: column !important;
        gap: 2px !important;
      }
      .composer .tml-fresh-github-text strong {
        font: 600 13px/17px DM Sans, Arial, sans-serif !important;
      }
      .composer .tml-fresh-github-text small {
        color: #888 !important;
        font: 400 11px/15px DM Sans, Arial, sans-serif !important;
      }
    `;
    document.head.appendChild(style);
  }

  function githubLogo() {
    const img = document.createElement('img');
    img.src = 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png';
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
    return img;
  }

  function removeMenus() {
    commandMenu?.remove();
    connectorMenu?.remove();
    commandMenu = null;
    connectorMenu = null;
  }

  function removePill() {
    document.querySelectorAll('.tml-fresh-pill').forEach(el => el.remove());
  }

  function setInputValue(value) {
    const el = input();
    if (!el) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    if (setter) setter.call(el, value); else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.focus();
  }

  function renderPill() {
    removePill();
    const box = composer();
    const el = input();
    if (!box || !el || !selectedConnector || !isLuna()) return;

    const pill = document.createElement('span');
    pill.className = 'tml-fresh-pill';
    pill.appendChild(githubLogo());

    const label = document.createElement('span');
    label.textContent = selectedConnector;
    pill.appendChild(label);

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'tml-pill-remove';
    removeButton.textContent = '×';
    removeButton.setAttribute('aria-label', 'Remove GitHub connector');
    removeButton.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      selectedConnector = null;
      renderPill();
      el.focus();
    });
    pill.appendChild(removeButton);

    // Same flex row as the textarea: immediately before the text itself.
    el.parentNode.insertBefore(pill, el);
  }

  function openConnectorMenu() {
    connectorMenu?.remove();
    const box = composer();
    if (!box || !isLuna()) return;

    connectorMenu = document.createElement('div');
    connectorMenu.className = 'tml-fresh-menu';

    const title = document.createElement('div');
    title.className = 'tml-fresh-menu-title';
    title.textContent = 'Connectors';
    connectorMenu.appendChild(title);

    const github = document.createElement('button');
    github.type = 'button';
    github.className = 'tml-fresh-github';
    github.appendChild(githubLogo());

    const text = document.createElement('span');
    text.className = 'tml-fresh-github-text';
    const name = document.createElement('strong');
    name.textContent = 'GitHub';
    const description = document.createElement('small');
    description.textContent = 'Connect GitHub to this prompt';
    text.append(name, description);
    github.appendChild(text);

    github.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      selectedConnector = 'GitHub';
      connectorMenu?.remove();
      connectorMenu = null;
      renderPill();
      input()?.focus();
    });

    connectorMenu.appendChild(github);
    box.appendChild(connectorMenu);
  }

  function findFileControl(box) {
    return Array.from(box.querySelectorAll('label,button')).find(node => {
      if (node.classList.contains('tml-fresh-plus')) return false;
      const metadata = [
        node.getAttribute('aria-label'),
        node.getAttribute('title'),
        node.textContent
      ].filter(Boolean).join(' ');
      return /attach|file|upload/i.test(metadata);
    });
  }

  function installPlus() {
    const box = composer();
    const el = input();
    if (!box || !el) return;

    let plus = box.querySelector('.tml-fresh-plus');

    if (!isLuna()) {
      plus?.remove();
      removePill();
      connectorMenu?.remove();
      connectorMenu = null;
      selectedConnector = null;
      return;
    }

    if (!plus) {
      plus = document.createElement('button');
      plus.type = 'button';
      plus.className = 'tml-fresh-plus';
      plus.title = 'Connectors';
      plus.setAttribute('aria-label', 'Connectors');

      const symbol = document.createElement('span');
      symbol.textContent = '+';
      plus.appendChild(symbol);

      plus.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        openConnectorMenu();
      });

      const file = findFileControl(box);
      if (file) {
        // Exact requested location: immediately after the file button.
        file.insertAdjacentElement('afterend', plus);
      } else {
        // Guaranteed fallback inside the actual composer row.
        el.parentNode.insertBefore(plus, el);
      }
    }

    // Reassert visibility every reconciliation cycle.
    plus.hidden = false;
    plus.disabled = false;
    plus.style.setProperty('display', 'flex', 'important');
    plus.style.setProperty('visibility', 'visible', 'important');
    plus.style.setProperty('opacity', '1', 'important');
    plus.style.setProperty('pointer-events', 'auto', 'important');
    plus.style.setProperty('z-index', '9999', 'important');

    renderPill();
  }

  function openCommandMenu() {
    commandMenu?.remove();
    const box = composer();
    if (!box) return;

    commandMenu = document.createElement('div');
    commandMenu.className = 'tml-fresh-menu';
    const title = document.createElement('div');
    title.className = 'tml-fresh-menu-title';
    title.textContent = 'Commands';
    commandMenu.appendChild(title);

    const choices = [];
    if (isLuna()) {
      choices.push(['web', 'Web search', 'Search current information']);
      choices.push(['image', 'Create image', 'Create an image']);
      choices.push(['research', 'Deep research', 'Research the request']);
    }
    choices.push(['code', 'Code', 'Use coding mode']);

    choices.forEach(([kind, label, description]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.style.cssText = 'all:unset!important;box-sizing:border-box!important;width:100%!important;padding:10px!important;display:flex!important;flex-direction:column!important;gap:2px!important;border-radius:9px!important;cursor:pointer!important;';
      const strong = document.createElement('strong');
      strong.textContent = label;
      const small = document.createElement('small');
      small.textContent = description;
      small.style.cssText = 'color:#888!important;font:400 11px/15px DM Sans,Arial,sans-serif!important;';
      button.append(strong, small);
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        const el = input();
        if (!el) return;
        const current = el.value.replace(/\/$/, '').replace(/^\u2063\[TML_COMMAND\]\u2063\s*/, '').trimStart();
        pendingCommand = kind;
        setInputValue(`${COMMAND_MARKER}${current ? ` ${current}` : ''}`);
        commandMenu?.remove();
        commandMenu = null;
      });
      commandMenu.appendChild(button);
    });

    box.appendChild(commandMenu);
  }

  function bindCommands() {
    const el = input();
    if (!el || el.dataset.tmlFreshBound) return;
    el.dataset.tmlFreshBound = '1';
    el.addEventListener('input', () => {
      if (el.value.endsWith('/')) openCommandMenu();
      else if (!el.value.includes(COMMAND_MARKER)) commandMenu?.remove();
    }, true);
    el.addEventListener('keydown', event => {
      if (event.key === 'Escape') removeMenus();
    }, true);
  }

  function patchFetch() {
    if (window.__tmlFreshFetchPatched) return;
    window.__tmlFreshFetchPatched = true;
    const original = window.fetch;

    window.fetch = async function(inputRequest, init) {
      try {
        const url = typeof inputRequest === 'string' ? inputRequest : inputRequest?.url || '';
        if (url.endsWith('/api/chat') && init?.body) {
          const body = JSON.parse(init.body);
          body.mode = 'chat';

          const messages = Array.isArray(body.messages) ? body.messages.slice() : [];
          let lastUser = -1;
          for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i]?.role === 'user') { lastUser = i; break; }
          }

          if (lastUser >= 0) {
            let content = String(messages[lastUser].content || '')
              .replace(COMMAND_MARKER, '')
              .trim();

            if (selectedConnector && /gpt\s*[- ]?5\.6\s*luna/i.test(String(body.model || ''))) {
              if (!/^@GitHub\b/i.test(content)) {
                content = `@GitHub${content ? ` ${content}` : ''}`;
              }
            }

            if (pendingCommand) {
              const prefix = pendingCommand === 'web'
                ? '@Web search'
                : pendingCommand === 'image'
                  ? '@Create image'
                  : pendingCommand === 'research'
                    ? '@Deep research'
                    : '';
              if (prefix) {
                if (/^@GitHub\b/i.test(content)) {
                  content = content.replace(/^@GitHub\b\s*/i, '');
                  content = `@GitHub ${prefix}${content ? ` ${content}` : ''}`;
                } else {
                  content = `${prefix}${content ? ` ${content}` : ''}`;
                }
              }
              body.codeCommand = pendingCommand === 'code';
            }

            messages[lastUser] = { ...messages[lastUser], content };
            body.messages = messages;
          }

          selectedConnector = null;
          pendingCommand = null;
          removePill();
          init = { ...init, body: JSON.stringify(body) };
        }
      } catch (_) {}
      return original.call(this, inputRequest, init);
    };
  }

  function reconcile() {
    installStyles();
    installPlus();
    bindCommands();
    patchFetch();
  }

  new MutationObserver(reconcile).observe(document.documentElement, {
    childList: true,
    subtree: true
  });
  window.addEventListener('load', reconcile);
  window.setInterval(reconcile, 400);
  reconcile();
})();
