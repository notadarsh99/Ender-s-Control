import { $, $$, errorToast } from '../util.js';
import { state, on, canControl } from '../store.js';
import { request } from '../socket.js';

const CONTROLS = ['forward', 'back', 'left', 'right', 'jump', 'sprint', 'sneak'];
const KEYMAP = { w: 'forward', a: 'left', s: 'back', d: 'right', ' ': 'jump', shift: 'sneak' };

const held = new Set(); // controls currently pressed from this browser

const button = (control) => document.querySelector(`.pad-btn[data-control="${control}"]`);
const setActive = (control, active) => { const b = button(control); if (b) b.classList.toggle('active', active); };
const onControlsPage = () => state.page === 'controls';

async function send(control, enabled) {
  const res = await request('move:set', { control, state: enabled });
  if (!res.ok) {
    held.delete(control);
    setActive(control, false);
    if (enabled) errorToast(res.error);
  }
}

function press(control) {
  if (held.has(control) || !canControl()) return;
  held.add(control);
  setActive(control, true);
  send(control, true);
}

function release(control) {
  if (!held.has(control)) return;
  held.delete(control);
  setActive(control, false);
  send(control, false);
}

async function stopAll() {
  held.clear();
  CONTROLS.forEach((c) => setActive(c, false));
  const res = await request('move:stop');
  if (!res.ok && state.status && state.status.spawned) errorToast(res.error);
}

function refreshEnabled() {
  const ok = canControl();
  $$('.pad-btn').forEach((b) => { b.disabled = !ok; });
  $('#btn-stop-move').disabled = !state.online || !(state.status && state.status.spawned);
  const notice = $('#controls-notice');
  if (!state.status || state.status.state !== 'connected') {
    notice.hidden = false;
    notice.textContent = 'Connect Ender to enable controls.';
  } else if (state.afk && state.afk.manualIdle) {
    notice.hidden = false;
    notice.textContent = 'Idle mode is on. Turn it off on the Overview page to move or look around.';
  } else {
    notice.hidden = true;
  }
  if (!ok) { held.clear(); CONTROLS.forEach((c) => setActive(c, false)); }
}

function syncFromServer(c) {
  CONTROLS.forEach((control) => {
    const active = Boolean(c && c[control]);
    if (active) held.add(control); else held.delete(control);
    setActive(control, active);
  });
}

const isTyping = (e) => {
  const t = e.target;
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
    && !(t.type === 'range');
};

export function initControls() {
  $$('.pad-btn').forEach((btn) => {
    const control = btn.dataset.control;
    if (btn.dataset.toggle === 'true') {
      btn.addEventListener('click', () => { if (held.has(control)) release(control); else press(control); });
      return;
    }
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { btn.setPointerCapture(e.pointerId); } catch (_) { /* not critical */ }
      press(control);
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => btn.addEventListener(ev, () => release(control)));
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  });

  $('#btn-stop-move').addEventListener('click', stopAll);

  document.addEventListener('keydown', (e) => {
    if (!onControlsPage() || isTyping(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key === 'r') { if (!e.repeat) { if (held.has('sprint')) release('sprint'); else press('sprint'); } return; }
    const control = KEYMAP[key];
    if (!control) return;
    e.preventDefault();
    if (!e.repeat) press(control);
  });
  document.addEventListener('keyup', (e) => {
    const control = KEYMAP[e.key.toLowerCase()];
    if (control && held.has(control)) release(control);
  });

  // Safety: never leave the bot walking when the operator looks away.
  window.addEventListener('blur', () => { if (held.size) stopAll(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && held.size) stopAll(); });
  on('page', () => { if (!onControlsPage() && held.size) stopAll(); });

  on('controls', syncFromServer);
  on('status', refreshEnabled);
  on('afk', refreshEnabled);
  on('online', refreshEnabled);
  refreshEnabled();
}
