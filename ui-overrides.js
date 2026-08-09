(() => {
  'use strict';

  // Connector UI deliberately lives OUTSIDE React's .composer tree.
  // React owns .composer and can remove DOM nodes inserted into it.
  // This implementation therefore mounts its controls directly under body
  // and positions them against the live composer controls.

  let selected = false;
  let menu = null;
  let button = null;
  let pill = null;
  let lastLuna = false;
  let originalFetch = null;

  const q = (s, root = document) => root.querySelector(s);
  const composer = () => q('.composer');
  const textarea = () => q('.composer textarea') || q('textarea');
  const luna = () => /gpt\s*[- ]?5\.6\s*luna/i.test(q('.model > button')?.textContent || '');

  function githubMark(size = 16) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('aria-hidden', 'true');
    svg.style.display = 'block';
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill', 'currentColor');
    path.setAttribute('d', 'M12 .67a11.33 11.33 0 0 0-3.58 22.08c.57.1.78-.25.78-.55v-2.15c-3.18.69-3.85-1.34-3.85-1.34-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.67 1.24 3.32.95.1-.74.4-1.24.72-1.53-2.54-.29-5.2-1.27-5.2-5.67 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.45.11-3.02 0 0 .96-.31 3.12 1.17a10.84 10.84 0 0 1 5.68 0c2.16-1.48 3.12-1.17 3.12-1.17.62 1.57.23 2.73.11 3.02.73.8 1.18 1.82 1.18 3.07 0 4.41-2.67 5.37-5.21 5.66.41.36.77 1.07.77 2.16v3.2c0 .31.21.66.79.55A11.33 11.33 0 0 0 12 .67Z');
    svg.appendChild(path);
    return svg;
  }

  function styles() {
    if (q('#tml-connector-native-css')) return;
    const s = document.createElement('style');
    s.id = 'tml-connector-native-css';
    s.textContent = `
      #tml-connector-plus{position:fixed;z-index:2147483000;display:none;align-items:center;justify-content:center;width:34px;height:34px;padding:0;border:0;border-radius:9px;background:transparent;color:#625d55;cursor:pointer;font:400 25px/34px Arial,sans-serif;box-sizing:border-box;}
      #tml-connector-plus:hover{background:#eeeae3;color:#292621}
      #tml-connector-menu{position:fixed;z-index:2147483001;width:260px;padding:7px;background:#fff;border:1px solid #ded9d1;border-radius:14px;box-shadow:0 16px 40px #0002;box-sizing:border-box;display:none}
      #tml-connector-menu .title{padding:8px 10px;color:#403c37;font:600 13px/18px DM Sans,Arial,sans-serif}
      #tml-connector-menu button{all:unset;box-sizing:border-box;width:100%;min-height:50px;padding:9px 10px;display:flex;align-items:center;gap:10px;border-radius:10px;color:#403c37;cursor:pointer;font-family:DM Sans,Arial,sans-serif}
      #tml-connector-menu button:hover{background:#f1eee8}
      #tml-connector-menu .copy{display:flex;flex-direction:column;gap:2px}
      #tml-connector-menu strong{font-size:13px;line-height:17px}
      #tml-connector-menu small{color:#888;font-size:11px;line-height:15px}
      #tml-connector-pill{position:fixed;z-index:2147482999;display:none;align-items:center;gap:5px;height:28px;padding:0 7px;border:1px solid #d6d1c8;border-radius:999px;background:#eeeae5;color:#504b44;font:600 12px/28px DM Sans,Arial,sans-serif;white-space:nowrap;box-sizing:border-box;box-shadow:0 1px 2px #0001}
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
      github.appendChild(githubMark(21));
      const copy = document.createElement('span');
      copy.className = 'copy';
      const name = document.createElement('strong');
      name.textContent = 'GitHub';
      const desc = document.createElement('small');
      desc.textContent = 'Connect GitHub to this prompt';
      copy.append(name, desc);
      github.appendChild(copy);
      github.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); selected = true; closeMenu(); render(); textarea()?.focus(); });
      menu.appendChild(github);
      document.body.appendChild(menu);
    }
    if (!pill) {
      pill = document.createElement('div');
      pill.id = 'tml-connector-pill';
      pill.appendChild(githubMark(15));
      const label = document.createElement('span');
      label.textContent = 'GitHub';
      pill.appendChild(label);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '×';
      remove.setAttribute('aria-label', 'Remove GitHub connector');
      remove.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); selected = false; render(); textarea()?.focus(); });
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
    if (!box || !input || !luna()) {
      if (button) button.style.display = 'none';
      if (pill) pill.style.display = 'none';
      closeMenu();
      lastLuna = false;
      if (!luna()) selected = false;
      return;
    }

    ensureElements();
    const file = fileControl();
    const cr = box.getBoundingClientRect();
    const fr = file?.getBoundingClientRect();
    const ir = input.getBoundingClientRect();

    // Always position in the viewport, outside React's DOM ownership.
    // This is the critical fix: React cannot remove these nodes.
    const x = fr ? fr.right + 2 : cr.left + 8;
    const y = fr ? fr.top + (fr.height - 34) / 2 : cr.bottom - 42;
    button.style.left = `${Math.round(x)}px`;
    button.style.top = `${Math.round(y)}px`;
    button.style.display = 'flex';

    if (selected) {
      const pr = { width: 82 };
      const px = ir.left + 4;
      const py = ir.top + Math.max(4, (ir.height - 28) / 2);
      pill.style.left = `${Math.round(px)}px`;
      pill.style.top = `${Math.round(py)}px`;
      pill.style.display = 'flex';
      input.style.paddingLeft = `${pr.width}px`;
    } else {
      pill.style.display = 'none';
      input.style.paddingLeft = '';
    }
    lastLuna = true;
  }

  function toggleMenu() {
    if (!luna()) return;
    ensureElements();
    if (menu.style.display === 'block') { closeMenu(); return; }
    const r = button.getBoundingClientRect();
    const width = 260;
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.round(r.top - 9 - 155)}px`;
    menu.style.display = 'block';
  }

  function closeMenu() { if (menu) menu.style.display = 'none'; }

  function render() { position(); }

  function patchFetch() {
    if (originalFetch || typeof window.fetch !== 'function') return;
    originalFetch = window.fetch;
    window.fetch = async function(request, init) {
      try {
        const url = typeof request === 'string' ? request : request?.url || '';
        if (url.endsWith('/api/chat') && init?.body && selected) {
          const body = JSON.parse(init.body);
          if (/gpt\s*[- ]?5\.6\s*luna/i.test(String(body.model || ''))) {
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
            selected = false;
            render();
          }
        }
      } catch (_) {}
      return originalFetch.call(this, request, init);
    };
  }

  function reconcile() {
    styles();
    ensureElements();
    position();
    patchFetch();
  }

  document.addEventListener('click', e => {
    if (menu && menu.style.display === 'block' && !menu.contains(e.target) && e.target !== button) closeMenu();
  }, true);
  window.addEventListener('resize', render);
  window.addEventListener('scroll', render, true);
  new MutationObserver(reconcile).observe(document.documentElement, { childList: true, subtree: true });
  window.setInterval(reconcile, 250);
  reconcile();
})();
