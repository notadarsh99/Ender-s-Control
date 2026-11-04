import { $, $$, errorToast } from '../util.js';
import { state, on, isInWorld } from '../store.js';
import { request } from '../socket.js';

const AUTH_LABEL = { unknown: 'Unknown', required: 'Login required', command_sent: 'Command sent', authenticated: 'Logged in' };
let mode = 'login';

function setMsg(text, kind = '') {
  const el = $('#auth-msg');
  el.textContent = text;
  el.className = `form-msg ${kind}`.trim();
}

function render() {
  const s = state.status;
  const key = s && s.spawned ? s.authStatus : 'unknown';
  const tag = $('#auth-tag');
  tag.dataset.state = key;
  tag.textContent = s && s.spawned ? (AUTH_LABEL[key] || key) : 'Not in world';
  const ok = isInWorld();
  $('#auth-submit').disabled = !ok;
  $('#auth-password').disabled = !ok;
  if (!ok) setMsg('Connect Ender to the server before authenticating.');
  else if ($('#auth-msg').textContent.startsWith('Connect Ender')) setMsg('');
}

function setMode(next) {
  mode = next;
  $$('[data-auth-mode]').forEach((b) => b.classList.toggle('active', b.dataset.authMode === next));
  $('#auth-submit-text').textContent = next === 'register' ? 'Send /register' : 'Send /login';
  $('#auth-password').autocomplete = 'new-password';
}

export function initAuth() {
  $$('[data-auth-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.authMode)));

  const pwd = $('#auth-password');
  $('#auth-toggle').addEventListener('click', () => {
    const show = pwd.type === 'password';
    pwd.type = show ? 'text' : 'password';
    $('#auth-toggle use').setAttribute('href', show ? '#i-eye-off' : '#i-eye');
    $('#auth-toggle').setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });

  $('#auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = pwd.value;
    if (!password) { setMsg('Enter the password first.', 'err'); return; }
    if (/\s/.test(password)) { setMsg('Passwords cannot contain spaces.', 'err'); return; }
    // Clear the field immediately - the value lives only in this local variable while it is sent.
    pwd.value = '';
    pwd.type = 'password';
    $('#auth-toggle use').setAttribute('href', '#i-eye');
    $('#auth-submit').disabled = true;
    setMsg('Sending...');
    const res = await request('auth:submit', { mode, password });
    $('#auth-submit').disabled = !isInWorld();
    if (res.ok) setMsg(`/${mode} command sent. Watch the chat for the server's reply.`, 'ok');
    else { setMsg(res.error, 'err'); errorToast(res.error); }
  });

  // Never keep a typed password around when leaving the page.
  on('page', (name) => { if (name !== 'auth') { pwd.value = ''; pwd.type = 'password'; } });
  on('status', render);
  on('online', render);
  setMode('login');
  render();
}
