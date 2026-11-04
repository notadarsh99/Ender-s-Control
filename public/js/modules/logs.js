import { $, $$, fmtTime, errorToast } from '../util.js';
import { state, on, feed } from '../store.js';
import { request } from '../socket.js';

const MAX_DOM = 600;
let tab = 'all';
let unseenErrors = 0;

const visible = (e) => tab === 'all' || e.category === tab;

function buildRow(e) {
  const row = document.createElement('div');
  row.className = `log-row ${e.level}`;
  const t = document.createElement('time');
  t.textContent = fmtTime(e.ts);
  const cat = document.createElement('span');
  cat.className = `log-cat ${e.category}`;
  cat.textContent = e.category;
  const text = document.createElement('span');
  text.className = 'text';
  text.textContent = e.message;
  row.append(t, cat, text);
  return row;
}

function updateCount() {
  const shown = feed.logs.filter(visible).length;
  $('#log-count').textContent = `${shown} ${shown === 1 ? 'entry' : 'entries'} · logs are kept in memory only and vanish when the dashboard stops.`;
}

function scrollIfNeeded() {
  if ($('#log-autoscroll').checked) {
    const list = $('#log-list');
    list.scrollTop = list.scrollHeight;
  }
}

function renderAll() {
  const list = $('#log-list');
  list.textContent = '';
  const frag = document.createDocumentFragment();
  feed.logs.filter(visible).slice(-MAX_DOM).forEach((e) => frag.appendChild(buildRow(e)));
  list.appendChild(frag);
  updateCount();
  scrollIfNeeded();
}

function appendOne(e) {
  if (visible(e)) {
    const list = $('#log-list');
    list.appendChild(buildRow(e));
    while (list.children.length > MAX_DOM) list.firstChild.remove();
    scrollIfNeeded();
  }
  updateCount();
  if (e.category === 'error' && state.page !== 'logs') {
    unseenErrors += 1;
    const badge = $('#log-badge');
    badge.hidden = false;
    badge.textContent = unseenErrors > 99 ? '99+' : String(unseenErrors);
  }
}

export function initLogs() {
  $$('[data-log-tab]').forEach((btn) => btn.addEventListener('click', () => {
    tab = btn.dataset.logTab;
    $$('[data-log-tab]').forEach((b) => b.classList.toggle('active', b === btn));
    renderAll();
  }));

  $('#btn-log-clear').addEventListener('click', async () => {
    const res = await request('log:clear', { category: tab });
    if (!res.ok) errorToast(res.error);
  });

  on('logEntry', appendOne);
  on('logsReset', renderAll);
  on('page', (name) => {
    if (name === 'logs') {
      unseenErrors = 0;
      $('#log-badge').hidden = true;
      scrollIfNeeded();
    }
  });
  renderAll();
}
