import './style.css';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pwoctabbdrlrvusfrffq2.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_LeW85hQR5fdSMfsq516OKw_6nHXtchR';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

const escapeHtml = (value = '') => String(value).replace(/[&<>'\"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '\"':'&quot;' })[ch]);
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
  // Authentication consumes the canonical global design system imported above.
}

function authShell() {
  const shell = document.createElement('div'); shell.className = 'tml-auth-shell';
  shell.innerHTML = `<div class="tml-auth-card"><div class="tml-auth-brand"><span class="tml-auth-brand-mark">T</span><span>Thank Me Later</span></div><h1 class="tml-auth-title"></h1><p class="tml-auth-sub"></p><form class="tml-auth-form"><div class="tml-auth-field"><label>Email</label><input name="email" type="email" autocomplete="email" required></div><div class="tml-auth-field password-field"><label>Password</label><input name="password" type="password" autocomplete="current-password" required></div><div class="tml-auth-field name-field"><label>Display name</label><input name="displayName" autocomplete="name"></div><div class="tml-auth-message"></div><button class="tml-auth-primary" type="submit"></button></form><button class="tml-auth-secondary switch-mode"></button><button class="tml-auth-secondary reset-mode">Forgot your password?</button></div>`;
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
