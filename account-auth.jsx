import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pwoctabbdrlrvusfrffq.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_LeW85hQR5fdSMfsq516OKw_6nHXtchR';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[ch]);
const localChats = () => { try { const value = JSON.parse(localStorage.getItem('tml-chats') || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } };

async function syncChats(user) {
  if (!user) return;
  const local = localChats();
  const { data, error } = await supabase.from('user_chat_state').select('chats').eq('user_id', user.id).maybeSingle();
  if (error) return;
  const remote = Array.isArray(data?.chats) ? data.chats : [];
  if (remote.length) {
    localStorage.setItem('tml-chats', JSON.stringify(remote));
    return;
  }
  if (local.length) await supabase.from('user_chat_state').upsert({ user_id: user.id, chats: local }, { onConflict: 'user_id' });
}

function injectStyles() {
  if (document.getElementById('tml-account-styles')) return;
  const style = document.createElement('style'); style.id = 'tml-account-styles';
  style.textContent = `
  .tml-auth-shell{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;background:#f7f3ee;color:#302b27;font-family:DM Sans,Inter,system-ui,sans-serif;padding:24px}
  .tml-auth-card{width:min(420px,100%);background:#fffdfa;border:1px solid #e6ded5;border-radius:22px;box-shadow:0 20px 60px #3b302514;padding:34px}
  .tml-auth-brand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:20px;margin-bottom:8px}.tml-auth-brand-mark{width:32px;height:32px;border-radius:10px;background:#302b27;color:white;display:grid;place-items:center;font-size:15px}
  .tml-auth-title{font-size:28px;letter-spacing:-.04em;margin:22px 0 6px}.tml-auth-sub{color:#746b64;font-size:14px;line-height:1.55;margin:0 0 24px}
  .tml-auth-field{display:grid;gap:7px;margin:14px 0}.tml-auth-field label{font-size:12px;font-weight:600;color:#5f554d}.tml-auth-field input{box-sizing:border-box;width:100%;border:1px solid #ddd3ca;background:#fff;border-radius:11px;padding:12px 13px;font:inherit;color:#302b27;outline:none}.tml-auth-field input:focus{border-color:#9a8d82;box-shadow:0 0 0 3px #8c7b6b14}
  .tml-auth-primary{width:100%;border:0;border-radius:11px;background:#302b27;color:white;padding:12px 14px;font:600 14px inherit;cursor:pointer;margin-top:7px}.tml-auth-primary:disabled{opacity:.55;cursor:wait}
  .tml-auth-secondary{border:0;background:transparent;color:#6f6258;font:600 13px inherit;cursor:pointer;padding:10px 0}.tml-auth-error{margin:12px 0;padding:10px 12px;border-radius:10px;background:#fff0ee;color:#9b4236;font-size:12px;line-height:1.45}.tml-auth-success{margin:12px 0;padding:10px 12px;border-radius:10px;background:#edf7ef;color:#3e7548;font-size:12px;line-height:1.45}
  .tml-account-menu{position:fixed;left:14px;bottom:14px;z-index:100000;display:flex;align-items:center;gap:8px}.tml-account-button{display:flex;align-items:center;gap:9px;border:1px solid #ddd4cb;background:#fffdfa;color:#403831;border-radius:13px;padding:8px 11px;box-shadow:0 5px 18px #2d241408;cursor:pointer;font:600 12px DM Sans,Inter,sans-serif}.tml-account-avatar{width:25px;height:25px;border-radius:8px;background:#302b27;color:#fff;display:grid;place-items:center;font-size:11px}.tml-account-pop{position:absolute;left:0;bottom:47px;width:220px;background:#fffdfa;border:1px solid #e4dcd3;border-radius:14px;padding:7px;box-shadow:0 14px 40px #2d24141c}.tml-account-meta{padding:10px 10px 12px;border-bottom:1px solid #eee7e0;margin-bottom:5px}.tml-account-name{font-weight:700;font-size:13px}.tml-account-email{color:#81766d;font-size:11px;margin-top:3px;overflow:hidden;text-overflow:ellipsis}.tml-account-action{width:100%;text-align:left;border:0;background:transparent;border-radius:9px;padding:9px 10px;color:#514840;font:600 12px DM Sans,Inter,sans-serif;cursor:pointer}.tml-account-action:hover{background:#f2eee9}
  `; document.head.appendChild(style);
}

function authShell() {
  const shell = document.createElement('div'); shell.className = 'tml-auth-shell';
  shell.innerHTML = `<div class="tml-auth-card"><div class="tml-auth-brand"><span class="tml-auth-brand-mark">T</span><span>Thank Me Later</span></div><h1 class="tml-auth-title"></h1><p class="tml-auth-sub"></p><form class="tml-auth-form"><div class="tml-auth-field"><label>Email</label><input name="email" type="email" autocomplete="email" required></div><div class="tml-auth-field password-field"><label>Password</label><input name="password" type="password" autocomplete="current-password" required></div><div class="tml-auth-field name-field" style="display:none"><label>Display name</label><input name="displayName" autocomplete="name"></div><div class="tml-auth-message"></div><button class="tml-auth-primary" type="submit"></button></form><button class="tml-auth-secondary switch-mode"></button><button class="tml-auth-secondary reset-mode">Forgot your password?</button></div>`;
  document.body.appendChild(shell); return shell;
}

async function renderAuth() {
  injectStyles();
  const { data: { session } } = await supabase.auth.getSession();
  if (session) return session;
  const shell = authShell(); const title = shell.querySelector('.tml-auth-title'); const sub = shell.querySelector('.tml-auth-sub'); const form = shell.querySelector('form'); const primary = shell.querySelector('.tml-auth-primary'); const switcher = shell.querySelector('.switch-mode'); const reset = shell.querySelector('.reset-mode'); const message = shell.querySelector('.tml-auth-message'); const nameField = shell.querySelector('.name-field'); let mode = 'signin';
  const paint = () => { const resetMode = mode === 'reset'; title.textContent = resetMode ? 'Reset your password' : mode === 'signin' ? 'Welcome back' : 'Create your account'; sub.textContent = resetMode ? 'Enter your email and we’ll send you a secure reset link.' : mode === 'signin' ? 'Sign in to keep your chats and settings connected to your account.' : 'Create an account to keep your Thank Me Later data with you.'; primary.textContent = resetMode ? 'Send reset link' : mode === 'signin' ? 'Sign in' : 'Create account'; switcher.textContent = resetMode ? 'Back to sign in' : mode === 'signin' ? 'Create an account' : 'Already have an account? Sign in'; reset.style.display = resetMode ? 'none' : 'block'; nameField.style.display = mode === 'signup' && !resetMode ? 'grid' : 'none'; shell.querySelector('.password-field').style.display = resetMode ? 'none' : 'grid'; };
  paint();
  switcher.onclick = () => { mode = mode === 'signin' ? 'signup' : 'signin'; message.textContent = ''; message.className = 'tml-auth-message'; paint(); };
  reset.onclick = () => { mode = 'reset'; message.textContent = ''; message.className = 'tml-auth-message'; paint(); };
  form.onsubmit = async e => { e.preventDefault(); message.textContent = ''; message.className = 'tml-auth-message'; primary.disabled = true; const fd = new FormData(form); const email = String(fd.get('email') || '').trim(); const password = String(fd.get('password') || ''); let result;
    if (mode === 'reset') result = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}${location.pathname}` });
    else if (mode === 'signup') result = await supabase.auth.signUp({ email, password, options: { data: { display_name: String(fd.get('displayName') || '').trim() } } });
    else result = await supabase.auth.signInWithPassword({ email, password });
    primary.disabled = false;
    if (result.error) { message.className = 'tml-auth-message tml-auth-error'; message.textContent = result.error.message; return; }
    if (mode === 'reset') { message.className = 'tml-auth-message tml-auth-success'; message.textContent = 'If an account exists for that email, a password reset link has been sent.'; return; }
    if (mode === 'signup' && !result.data.session) { message.className = 'tml-auth-message tml-auth-success'; message.textContent = 'Account created. Check your email to confirm your address, then return here to sign in.'; return; }
    shell.remove(); await syncChats(result.data.session.user); await loadApplication(result.data.session.user);
  };
  return null;
}

async function loadApplication(user) {
  await import('./src-code-env.jsx');
  const profile = await supabase.from('profiles').select('display_name,avatar_url').eq('id', user.id).maybeSingle();
  const displayName = profile.data?.display_name || user.user_metadata?.display_name || user.email?.split('@')[0] || 'Account';
  const wrap = document.createElement('div'); wrap.className = 'tml-account-menu'; wrap.innerHTML = `<button class="tml-account-button"><span class="tml-account-avatar">${escapeHtml(displayName.slice(0,1).toUpperCase())}</span><span>${escapeHtml(displayName)}</span></button><div class="tml-account-pop" style="display:none"><div class="tml-account-meta"><div class="tml-account-name">${escapeHtml(displayName)}</div><div class="tml-account-email">${escapeHtml(user.email || '')}</div></div><button class="tml-account-action" data-action="signout">Sign out</button></div>`; document.body.appendChild(wrap);
  const button = wrap.querySelector('.tml-account-button'); const pop = wrap.querySelector('.tml-account-pop'); button.onclick = () => { pop.style.display = pop.style.display === 'none' ? 'block' : 'none'; }; wrap.querySelector('[data-action="signout"]').onclick = async () => { await supabase.auth.signOut(); location.reload(); };
  document.addEventListener('click', e => { if (!wrap.contains(e.target)) pop.style.display = 'none'; });
  window.addEventListener('beforeunload', () => { const chats = localChats(); if (chats.length) supabase.from('user_chat_state').upsert({ user_id: user.id, chats }, { onConflict: 'user_id' }); });
}

(async () => { const session = await renderAuth(); if (session) { await syncChats(session.user); await loadApplication(session.user); } })();
