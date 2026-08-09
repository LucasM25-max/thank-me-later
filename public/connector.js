(() => {
  'use strict';

  let open = false;
  let selected = false;
  let button = null;
  let menu = null;
  let pill = null;

  const $ = (s) => document.querySelector(s);

  function ensure() {
    if (!button) {
      button = document.createElement('button');
      button.id = 'tml-connectors-button';
      button.type = 'button';
      button.textContent = '+';
      button.title = 'Connectors';
      button.setAttribute('aria-label', 'Connectors');
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        open = !open;
        render();
      });
      document.body.appendChild(button);
    }

    if (!menu) {
      menu = document.createElement('div');
      menu.id = 'tml-connectors-menu';
      menu.innerHTML = '<div class="tml-connectors-title">Connectors</div><button type="button" class="tml-connector-option"><span class="tml-gh-icon">GH</span><span><b>GitHub</b><small>Use GitHub with this prompt</small></span></button>';
      menu.querySelector('button').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        selected = true;
        open = false;
        render();
        $('.composer textarea')?.focus();
      });
      document.body.appendChild(menu);
    }

    if (!pill) {
      pill = document.createElement('div');
      pill.id = 'tml-connector-pill';
      pill.innerHTML = '<span class="tml-gh-icon small">GH</span><span>GitHub</span><button type="button" aria-label="Remove GitHub connector">×</button>';
      pill.querySelector('button').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        selected = false;
        render();
        $('.composer textarea')?.focus();
      });
      document.body.appendChild(pill);
    }
  }

  function installStyles() {
    if ($('#tml-connector-styles')) return;
    const style = document.createElement('style');
    style.id = 'tml-connector-styles';
    style.textContent = `
      #tml-connectors-button {
        position: fixed !important;
        z-index: 2147483647 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 34px !important;
        height: 34px !important;
        padding: 0 !important;
        margin: 0 !important;
        border: 0 !important;
        border-radius: 9px !important;
        background: transparent !important;
        color: #625d55 !important;
        font: 400 25px/34px Arial, sans-serif !important;
        cursor: pointer !important;
        visibility: visible !important;
        opacity: 1 !important;
      }
      #tml-connectors-button:hover { background: #eeeae3 !important; color: #292621 !important; }
      #tml-connectors-menu { position: fixed !important; z-index: 2147483646 !important; width: 270px !important; padding: 7px !important; background: #fff !important; border: 1px solid #ded9d1 !important; border-radius: 14px !important; box-shadow: 0 16px 40px rgba(0,0,0,.12) !important; }
      .tml-connectors-title { padding: 8px 10px; color: #403c37; font: 600 13px/18px DM Sans,Arial,sans-serif; }
      .tml-connector-option { all: unset; box-sizing: border-box; width: 100%; min-height: 54px; padding: 9px 10px; display: flex; align-items: center; gap: 10px; border-radius: 10px; color: #403c37; cursor: pointer; font-family: DM Sans,Arial,sans-serif; }
      .tml-connector-option:hover { background: #f1eee8; }
      .tml-connector-option span:last-child { display:flex; flex-direction:column; gap:2px; }
      .tml-connector-option b { font-size:13px; line-height:17px; }
      .tml-connector-option small { color:#888; font-size:11px; line-height:15px; }
      .tml-gh-icon { width:24px; height:24px; flex:none; display:flex; align-items:center; justify-content:center; border-radius:6px; background:#24292f; color:#fff; font:700 10px/24px Arial,sans-serif; }
      .tml-gh-icon.small { width:16px; height:16px; border-radius:4px; font-size:7px; line-height:16px; }

      /* The selected connector belongs in the composer accessory row, not over the textarea. */
      #tml-connector-pill {
        position: static !important;
        z-index: auto !important;
        display: inline-flex !important;
        align-items: center !important;
        gap: 6px !important;
        height: 28px !important;
        width: max-content !important;
        padding: 0 7px !important;
        margin: 0 4px 4px 0 !important;
        border: 1px solid #d6d1c8 !important;
        border-radius: 999px !important;
        background: #eeeae5 !important;
        color: #504b44 !important;
        font: 600 12px/28px DM Sans,Arial,sans-serif !important;
        box-shadow: 0 1px 2px rgba(0,0,0,.06) !important;
      }
      #tml-connector-pill button { all:unset; width:17px; height:17px; display:flex; align-items:center; justify-content:center; border-radius:50%; color:#777168; cursor:pointer; font:400 15px/17px Arial,sans-serif; }
      #tml-connector-pill button:hover { background:#ded9d0; }

      /* Keep the textarea clear of the standalone + control. */
      .composer textarea { padding-left: 43px !important; }
    `;
    document.head.appendChild(style);
  }

  function movePillIntoAccessoryRow() {
    const pending = $('.pending');
    if (!pending || !pill) return;
    if (pill.parentElement !== pending) pending.insertBefore(pill, pending.firstChild);
  }

  function render() {
    const composer = $('.composer');
    const textarea = $('.composer textarea');
    if (!composer || !textarea) {
      if (button) button.style.display = 'none';
      if (menu) menu.style.display = 'none';
      if (pill) pill.style.display = 'none';
      return;
    }

    ensure();
    installStyles();
    movePillIntoAccessoryRow();

    const file = composer.querySelector('label[title], label[aria-label]') || composer.querySelector('label');
    const cr = composer.getBoundingClientRect();
    const fr = file?.getBoundingClientRect();
    const x = fr && fr.width > 0 ? fr.right + 3 : cr.left + 4;
    const y = fr && fr.height > 0 ? fr.top + (fr.height - 34) / 2 : cr.top + (cr.height - 34) / 2;

    button.style.left = `${Math.round(x)}px`;
    button.style.top = `${Math.round(y)}px`;
    button.style.display = 'flex';

    if (open) {
      const br = button.getBoundingClientRect();
      const width = 270;
      menu.style.left = `${Math.round(Math.min(Math.max(8, br.left), innerWidth - width - 8))}px`;
      menu.style.top = `${Math.round(Math.max(8, br.top - 145))}px`;
      menu.style.display = 'block';
    } else {
      menu.style.display = 'none';
    }

    if (selected) {
      pill.style.display = 'inline-flex';
    } else {
      pill.style.display = 'none';
    }

    textarea.style.paddingLeft = '43px';
  }

  function boot() {
    installStyles();
    render();
    new MutationObserver(render).observe(document.body, { childList: true, subtree: true });
    addEventListener('resize', render);
    addEventListener('scroll', render, true);
    setInterval(render, 500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
