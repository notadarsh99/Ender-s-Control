import { $, toast, errorToast } from '../util.js';
import { state, on } from '../store.js';
import { request } from '../socket.js';
import { showPage } from './nav.js';

let dirty = false; // true while the form holds edits that have not been saved

const FIELDS = ['host', 'port', 'username'];
const input = (name) => $(`#set-${name}`);

function setMsg(text, kind = '') {
  const el = $('#set-msg');
  el.textContent = text;
  el.className = `form-msg ${kind}`.trim();
}

function fill(values) {
  input('host').value = values.host;
  input('port').value = String(values.port);
  input('username').value = values.username;
}

function editable() {
  const s = state.status;
  return Boolean(state.online && s && s.state === 'disconnected' && !s.reconnectPending);
}

function render() {
  const s = state.status;
  const ok = editable();

  FIELDS.forEach((name) => { input(name).disabled = !ok; });
  ['#set-save', '#set-save-connect', '#set-reset'].forEach((sel) => { $(sel).disabled = !ok; });
  $('#set-notice').hidden = ok || !s;

  const tag = $('#set-tag');
  tag.textContent = ok ? 'Editable' : 'Locked';
  tag.dataset.state = ok ? 'active' : 'connecting';

  if (!s) return;
  $('#set-version').textContent = s.target.version || '-';
  if (!dirty) fill(s.target); // never overwrite what the user is typing
}

/** Sends the form to the server. Resolves true when the settings were saved. */
async function save(values) {
  setMsg('Saving...');
  const res = await request('settings:set', values);
  if (!res.ok) {
    setMsg(res.error, 'err');
    errorToast(res.error);
    return false;
  }
  dirty = false;
  if (state.status) fill(state.status.target);
  setMsg('Saved. These settings will be used the next time Ender connects.', 'ok');
  toast('success', 'Settings saved', `${state.status.target.username} @ ${state.status.target.host}:${state.status.target.port}`);
  return true;
}

const current = () => ({ host: input('host').value, port: input('port').value, username: input('username').value });

export function initSettings() {
  FIELDS.forEach((name) => input(name).addEventListener('input', () => { dirty = true; setMsg(''); }));

  $('#set-form').addEventListener('submit', (e) => {
    e.preventDefault();
    save(current());
  });

  $('#set-save-connect').addEventListener('click', async () => {
    if (!(await save(current()))) return;
    const res = await request('bot:connect');
    if (res.ok) showPage('overview');
    else { setMsg(res.error, 'err'); errorToast(res.error); }
  });

  $('#set-reset').addEventListener('click', async () => {
    const d = state.status && state.status.defaults;
    if (!d) return;
    fill(d);
    dirty = true;
    await save(d);
  });

  // Leaving the page with unsaved edits discards them, so the form always matches the server.
  on('page', (name) => {
    if (name !== 'settings' && dirty && state.status) { dirty = false; fill(state.status.target); setMsg(''); }
  });
  on('status', render);
  on('online', render);
  render();
}
