(() => {
  'use strict';

  // Connector controls are mounted outside React so React re-renders cannot remove them.
  let selected = false;
  let menu = null;
  let button = null;
  let pill = null;
  let originalFetch = null;

  const q = (s, root = document) => root.querySelector(s);
  const composer = () => q('.composer');
  const textarea = () => q('.composer textarea') || q('textarea');

  function styles() {
    if (q('#tml-connector-native-css')) return;
    const s = document.createElement('style');
    s.id = 'tml-connector-native-css';
    s.textContent = `
      #tml-connector-plus{position:fixed!important;z-index:2147483000!important;display:flex!important;align-items:center!important;justify-content:center!important;width:34px!important;height:34px!important;padding:0!important;border:0!important;border-radius:9px!important;background:transparent!important;color:#625d55!important;cursor:pointer!important;font:400 25px/34px Arial,sans-serif!important;box-sizing:border-box!important;visibility:visible!important;opacity:1!important}
      #tml-connector-plus:hover{background:#eeeae3!important;color:#292621!important}
      #tml-connector-menu{position:fixed;z-index:2147483001;width:260px;padding:7px;background:#fff;border:1px solid #ded9d1;border-radius:14px;box-shadow:0 16px 40px #0002;box-sizing:border-box;display:none}
      #tml-connector-menu .title{padding:8px 10px;color:#403c37;font:600 13px/18px DM Sans,Arial,sans-serif}
      #tml-connector-menu button{all:unset;box-sizing:border-box;width:100%;min-height:50px;padding:9px 10px;display:flex;align-items:center;gap:10px;border-radius:10px;color:#403c37;cursor:pointer;font-family:DM Sans,Arial,sans-serif}
      #tml-connector-menu button:hover{background:#f1eee8}
      #tml-connector-menu .icon{width:24px;height:24px;display:flex;align-items:center;justify-content:center;border-radius:6px;background:#24292f;color:#fff;font:700 11px/24px Arial,sans-serif;flex:none}
      #tml-connector-menu .copy{display:flex;flex-direction:column;gap:2px}
      #tml-connector-menu strong{font-size:13px;line-height:17px}
      #tml-connector-menu small{color:#888;font-size:11px;line-height:15px}
      #tml-connector-pill{position:fixed;z-index:2147482999;display:none;align-items:center;gap:5px;height:28px;padding:0 7px;border:1px solid #d6d1c8;border-radius:999px;background:#eeeae5;color:#504b44;font:600 12px/28px DM Sans,Arial,sans-serif;white-space:nowrap;box-sizing:border-box;box-shadow:0 1px 2px #0001}
      #tml-connector-pill .icon{font:700 9px/16px Arial;background:#24292f;color:#fff;width:16px;height:16px;border-radius:4px;text-align:center}
      #tml-connector-pill button{all:unset;width:17px;height:17px;display:flex;align-items:center;justify-content:center;border-radius:50%;color:#777168;cursor:pointer;font:400 15px/17px Arial,sans-serif}
      #tml-connector-pill button:hover{background:#ded9d0;color:#292621}
    `;
    document.head.appendChild(s);
  }

  function ensureElements() {
    if (!button) {
      button = document.createElement('button');
      button.id = 'tml-connector-plus';
      button.type = 'button';
      button.title = 'Connectors';
      button.setAttribute('aria-label', 'Connectors');
      button.textContent = '+';
      button.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); toggleMenu(); });
      document.body.appendChild(button);
    }

    if (!menu) {
      menu = document.createElement('div');
      menu.id = 'tml-connector-menu';
      const title = document.createElement('div');
      title.className = 'title';
      title.textContent = 'Connectors';
      menu.appendChild(title);

      const github = document.createElement('button');
      github.type = 'button';
      const icon = document.createElement('span');
      icon.className = 'icon';
      icon.textContent = 'GH';
      github.appendChild(icon);
      const copy = document.createElement('span');
      copy.className = 'copy';
      const name = document.createElement('strong');
      name.textContent = 'GitHub';
      const desc = document.createElement('small');
      desc.textContent = 'Connect GitHub to this prompt';
      copy.append(name, desc);
      github.appendChild(copy);
      github.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        selected = true;
        closeMenu();
        render();
        textarea()?.focus();
      });
      menu.appendChild(github);
      document.body.appendChild(menu);
    }

    if (!pill) {
      pill = document.createElement('div');
      pill.id = 'tml-connector-pill';
      const icon = document.createElement('span');
      icon.className = 'icon';
      icon.textContent = 'GH';
      pill.appendChild(icon);
      const label = document.createElement('span');
      label.textContent = 'GitHub';
      pill.appendChild(label);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '×';
      remove.setAttribute('aria-label', 'Remove GitHub connector');
      remove.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        selected = false;
        render();
        textarea()?.focus();
      });
      pill.appendChild(remove);
      document.body.appendChild(pill);
    }
  }

  function fileControl() {
    const box = composer();
    if (!box) return null;
    return Array.from(box.querySelectorAll('label,button')).find(el => {
      const text = `${el.getAttribute('title') || ''} ${el.getAttribute('aria-label') || ''}`;
      return /attach|file|upload/i.test(text);
    });
  }

  function position() {
    const box = composer();
    const input = textarea();
    if (!box || !input) {
      if (button) button.style.display = 'none';
      if (pill) pill.style.display = 'none';
      closeMenu();
      return;
    }

    ensureElements();
    const file = fileControl();
    const cr = box.getBoundingClientRect();
    const fr = file?.getBoundingClientRect();
    const ir = input.getBoundingClientRect();

    // Prefer the real attachment control as the anchor, but fall back to the
    // composer itself. This prevents the + button from being positioned at
    // (0,0) when the attachment label is temporarily unavailable during React renders.
    const x = fr && fr.width > 0 ? fr.right + 4 : cr.left + 6;
    const y = fr && fr.height > 0 ? fr.top + (fr.height - 34) / 2 : cr.top + (cr.height - 34) / 2;
    button.style.left = `${Math.round(x)}px`;
    button.style.top = `${Math.round(y)}px`;
    button.style.display = 'flex';

    if (selected) {
      const px = ir.left + 4;
      const py = ir.top + Math.max(4, (ir.height - 28) / 2);
      pill.style.left = `${Math.round(px)}px`;
      pill.style.top = `${Math.round(py)}px`;
      pill.style.display = 'flex';
      input.style.paddingLeft = '82px';
    } else {
      pill.style.display = 'none';
      input.style.paddingLeft = '';
    }
  }

  function toggleMenu() {
    ensureElements();
    if (menu.style.display === 'block') {
      closeMenu();
      return;
    }
    const r = button.getBoundingClientRect();
    const width = 260;
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    const top = Math.max(8, r.top - 165);
    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.round(top)}px`;
    menu.style.display = 'block';
  }

  function closeMenu() {
    if (menu) menu.style.display = 'none';
  }

  function render() {
    styles();
    ensureElements();
    position();
  }

  function patchFetch() {
    if (originalFetch || typeof window.fetch !== 'function') return;
    originalFetch = window.fetch;
    window.fetch = async function(request, init) {
      try {
        const url = typeof request === 'string' ? request : request?.url || '';
        if (url.endsWith('/api/chat') && init?.body && selected) {
          const body = JSON.parse(init.body);
          const messages = Array.isArray(body.messages) ? body.messages.slice() : [];
          for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i]?.role === 'user') {
              const content = String(messages[i].content || '').trim();
              messages[i] = {
                ...messages[i],
                content: /^@GitHub\b/i.test(content) ? content : `@GitHub${content ? ` ${content}` : ''}`
              };
              break;
            }
          }
          body.messages = messages;
          init = { ...init, body: JSON.stringify(body) };
          selected = false;
          render();
        }
      } catch (_) {}
      return originalFetch.call(this, request, init);
    };
  }

  document.addEventListener('click', e => {
    if (menu && menu.style.display === 'block' && !menu.contains(e.target) && e.target !== button) closeMenu();
  }, true);

  window.addEventListener('resize', render);
  window.addEventListener('scroll', render, true);
  new MutationObserver(render).observe(document.documentElement, { childList: true, subtree: true });
  window.setInterval(render, 500);
  render();
  patchFetch();
})();
