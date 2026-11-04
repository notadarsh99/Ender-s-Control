import { $, $$ } from '../util.js';
import { state, emit } from '../store.js';

const TITLES = {
  overview: 'Overview', controls: 'Controls', chat: 'Live Chat', player: 'Player',
  inventory: 'Inventory', auth: 'Authentication', settings: 'Settings', logs: 'Logs',
};

export function showPage(name, { updateHash = true } = {}) {
  if (!TITLES[name]) name = 'overview';
  state.page = name;
  $$('.page').forEach((p) => p.classList.toggle('active', p.dataset.page === name));
  $$('.nav-item').forEach((n) => n.classList.toggle('active', n.dataset.page === name));
  $('#page-title').textContent = TITLES[name];
  document.title = `${TITLES[name]} - ENDER CONTROL`;
  if (updateHash) history.replaceState(null, '', `#${name}`);
  closeDrawer();
  $('#pages').scrollTop = 0;
  emit('page', name);
}

function openDrawer() { $('#sidebar').classList.add('open'); $('#scrim').classList.add('show'); }
function closeDrawer() { $('#sidebar').classList.remove('open'); $('#scrim').classList.remove('show'); }

export function initNav() {
  $$('.nav-item').forEach((btn) => btn.addEventListener('click', () => showPage(btn.dataset.page)));
  $$('[data-goto]').forEach((btn) => btn.addEventListener('click', () => showPage(btn.dataset.goto)));
  $('#menu-btn').addEventListener('click', openDrawer);
  $('#scrim').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });
  window.addEventListener('hashchange', () => showPage(location.hash.slice(1), { updateHash: false }));
  showPage(location.hash.slice(1) || 'overview', { updateHash: false });
}
