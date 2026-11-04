import { $, fmtTime, mcFragment, errorToast } from '../util.js';
import { state, on, feed, isInWorld } from '../store.js';
import { request } from '../socket.js';

const MAX_DOM = 500;
let unread = 0;

const filterValue = () => $('#chat-filter').value;
const searchValue = () => $('#chat-search').value.trim().toLowerCase();

function matches(m) {
  const f = filterValue();
  if (f !== 'all' && m.type !== f) return false;
  const q = searchValue();
  return !q || m.text.toLowerCase().includes(q);
}

function buildRow(m) {
  const row = document.createElement('div');
  row.className = `msg ${m.type}`;
  const t = document.createElement('time');
  t.textContent = fmtTime(m.ts);
  const body = document.createElement('div');
  body.className = 'body';
  if (m.type === 'outgoing') body.textContent = m.text;
  else body.appendChild(mcFragment(m.motd || m.text));
  row.append(t, body);
  return row;
}

function scrollIfNeeded() {
  if ($('#chat-autoscroll').checked) {
    const list = $('#chat-list');
    list.scrollTop = list.scrollHeight;
  }
}

function renderAll() {
  const list = $('#chat-list');
  list.textContent = '';
  const frag = document.createDocumentFragment();
  feed.chat.filter(matches).slice(-MAX_DOM).forEach((m) => frag.appendChild(buildRow(m)));
  list.appendChild(frag);
  if (!list.children.length) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = feed.chat.length ? 'No messages match your filter.' : 'Chat messages from the server will appear here.';
    list.appendChild(p);
  }
  scrollIfNeeded();
}

function appendOne(m) {
  const list = $('#chat-list');
  if (matches(m)) {
    const empty = list.querySelector('.empty');
    if (empty) empty.remove();
    list.appendChild(buildRow(m));
    while (list.children.length > MAX_DOM) list.firstChild.remove();
    scrollIfNeeded();
  }
  if (state.page !== 'chat' && m.type !== 'outgoing') {
    unread += 1;
    const badge = $('#chat-badge');
    badge.hidden = false;
    badge.textContent = unread > 99 ? '99+' : String(unread);
  }
}

function refreshInput() {
  const ok = isInWorld();
  $('#chat-input').disabled = !ok;
  $('#chat-send').disabled = !ok;
  $('#chat-input').placeholder = ok ? 'Send a message or /command...' : 'Connect Ender to chat';
}

export function initChat() {
  const input = $('#chat-input');

  $('#chat-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = input.value.trim();
    if (!message) return;
    const res = await request('chat:send', { message });
    if (res.ok) { input.value = ''; $('#chat-counter').textContent = '0/256'; } else errorToast(res.error);
    input.focus();
  });
  input.addEventListener('input', () => { $('#chat-counter').textContent = `${input.value.length}/256`; });

  $('#chat-filter').addEventListener('change', renderAll);
  $('#chat-search').addEventListener('input', renderAll);
  $('#btn-chat-clear').addEventListener('click', async () => {
    const res = await request('chat:clear');
    if (!res.ok) errorToast(res.error);
  });

  on('chatMessage', appendOne);
  on('chatReset', () => { renderAll(); });
  on('status', refreshInput);
  on('online', refreshInput);
  on('page', (name) => {
    if (name === 'chat') {
      unread = 0;
      $('#chat-badge').hidden = true;
      scrollIfNeeded();
    }
  });
  renderAll();
  refreshInput();
}
