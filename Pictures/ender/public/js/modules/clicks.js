import { $, errorToast } from '../util.js';
import { state, on, canControl } from '../store.js';
import { request } from '../socket.js';

let resetTimer = null;

function showResult(text, ok = true) {
  const tag = $('#click-result');
  tag.textContent = text;
  tag.dataset.state = ok ? 'connected' : 'disconnected';
  clearTimeout(resetTimer);
  resetTimer = setTimeout(() => { tag.textContent = 'Ready'; tag.dataset.state = ''; }, 3500);
}

async function run(event, payload) {
  if (!canControl()) return;
  const res = await request(event, payload);
  if (res.ok) showResult(res.info || 'Done');
  else { showResult(res.error, false); errorToast(res.error); }
}

export const leftClick = () => run('action:attack');
export const rightClick = () => run('action:use');
export const setDig = (enabled) => run('action:dig', { state: enabled });

function refreshEnabled() {
  const ok = canControl();
  ['#btn-click-left', '#btn-click-dig', '#btn-click-right'].forEach((sel) => { $(sel).disabled = !ok; });
}

export function initClicks() {
  $('#btn-click-left').addEventListener('click', leftClick);
  $('#btn-click-right').addEventListener('click', rightClick);

  // Hold to break: pointer down starts digging, anything that ends the press stops it.
  const dig = $('#btn-click-dig');
  let holding = false;
  const stop = () => {
    if (!holding) return;
    holding = false;
    dig.classList.remove('active');
    setDig(false);
  };
  dig.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (!canControl()) return;
    try { dig.setPointerCapture(e.pointerId); } catch (_) { /* not critical */ }
    holding = true;
    dig.classList.add('active');
    setDig(true);
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => dig.addEventListener(ev, stop));
  dig.addEventListener('contextmenu', (e) => e.preventDefault());

  // Never leave the bot digging when the operator looks away.
  window.addEventListener('blur', stop);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  on('page', () => { if (state.page !== 'controls') stop(); });

  on('status', refreshEnabled);
  on('afk', refreshEnabled);
  on('online', refreshEnabled);
  refreshEnabled();
}
