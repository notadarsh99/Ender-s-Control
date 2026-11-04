import { $, $$, clamp, errorToast } from '../util.js';
import { state, on, canControl } from '../store.js';
import { request } from '../socket.js';
import { leftClick, rightClick } from './clicks.js';

const SENS_KEY = 'ender.sensitivity';
const DEG_PER_PIXEL = 0.15;
const LOOK_STEP = 4; // degrees per tick for hold-to-look buttons
const KEY_STEP = 6;  // degrees per arrow key press

let sensitivity = 1;
let sliderBusyUntil = 0;

const pad = () => $('#cam-pad');

function loadSensitivity() {
  try {
    const saved = parseFloat(localStorage.getItem(SENS_KEY));
    if (Number.isFinite(saved)) sensitivity = clamp(saved, 0.2, 3);
  } catch (_) { /* storage unavailable */ }
}

function applySensitivityUI() {
  $('#sens-slider').value = String(sensitivity);
  $('#sens-val').textContent = `${sensitivity.toFixed(1)}×`;
}

async function rotate(dyaw, dpitch) {
  if (!canControl()) return;
  const res = await request('camera:rotate', { dyaw: clamp(dyaw, -90, 90), dpitch: clamp(dpitch, -90, 90) });
  if (!res.ok) errorToast(res.error);
}

function refreshEnabled() {
  const ok = canControl();
  pad().classList.toggle('disabled', !ok);
  $$('[data-look]').forEach((b) => { b.disabled = !ok; });
  ['#yaw-slider', '#pitch-slider', '#btn-cam-reset'].forEach((sel) => { $(sel).disabled = !ok; });
}

function initDrag() {
  const el = pad();
  const dot = $('#cam-dot');
  let dragging = false;
  let lastX = 0; let lastY = 0; let accX = 0; let accY = 0; let offX = 0; let offY = 0;
  let timer = null;

  const flush = () => {
    if (!accX && !accY) return;
    const dyaw = -accX * DEG_PER_PIXEL * sensitivity;
    const dpitch = -accY * DEG_PER_PIXEL * sensitivity;
    accX = 0; accY = 0;
    rotate(dyaw, dpitch);
  };
  const end = () => {
    if (!dragging) return;
    dragging = false;
    clearInterval(timer);
    flush();
    offX = 0; offY = 0;
    dot.style.transform = '';
    el.classList.remove('dragging');
  };

  let startX = 0; let startY = 0; let startAt = 0; let travelled = 0;

  el.addEventListener('contextmenu', (e) => e.preventDefault());
  el.addEventListener('pointerdown', (e) => {
    if (!canControl()) return;
    if (e.button === 2) { rightClick(); return; } // right mouse button = right click
    if (e.button !== 0) return;
    dragging = true;
    startX = e.clientX; startY = e.clientY; startAt = Date.now(); travelled = 0;
    lastX = e.clientX; lastY = e.clientY;
    try { el.setPointerCapture(e.pointerId); } catch (_) { /* not critical */ }
    el.classList.add('dragging');
    timer = setInterval(flush, 40);
  });
  el.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX; const dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    accX += dx; accY += dy;
    travelled = Math.max(travelled, Math.hypot(e.clientX - startX, e.clientY - startY));
    offX = clamp(offX + dx, -90, 90); offY = clamp(offY + dy, -70, 70);
    dot.style.transform = `translate(${offX}px, ${offY}px)`;
  });
  el.addEventListener('pointerup', (e) => {
    const wasTap = dragging && e.button === 0 && travelled < 6 && Date.now() - startAt < 300;
    end();
    if (wasTap) leftClick(); // quick tap without dragging = left click
  });
  ['pointercancel', 'lostpointercapture'].forEach((ev) => el.addEventListener(ev, end));
}

function initHoldButtons() {
  $$('[data-look]').forEach((btn) => {
    let timer = null;
    const step = () => {
      const s = LOOK_STEP * sensitivity;
      const dir = btn.dataset.look;
      rotate(dir === 'left' ? s : dir === 'right' ? -s : 0, dir === 'up' ? s : dir === 'down' ? -s : 0);
    };
    const stop = () => { clearInterval(timer); timer = null; };
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { btn.setPointerCapture(e.pointerId); } catch (_) { /* not critical */ }
      step();
      stop();
      timer = setInterval(step, 70);
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => btn.addEventListener(ev, stop));
  });

  document.addEventListener('keydown', (e) => {
    if (state.page !== 'controls' || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT')) return;
    const s = KEY_STEP * sensitivity;
    const moves = { ArrowLeft: [s, 0], ArrowRight: [-s, 0], ArrowUp: [0, s], ArrowDown: [0, -s] };
    if (!moves[e.key]) return;
    e.preventDefault();
    rotate(...moves[e.key]);
  });
}

function initSliders() {
  const yaw = $('#yaw-slider'); const pitch = $('#pitch-slider');
  let timer = null;
  const send = () => {
    timer = null;
    request('camera:set', { yaw: Number(yaw.value), pitch: Number(pitch.value) })
      .then((res) => { if (!res.ok) errorToast(res.error); });
  };
  const onInput = () => {
    sliderBusyUntil = Date.now() + 900;
    $('#yaw-val').textContent = `${yaw.value}°`;
    $('#pitch-val').textContent = `${pitch.value}°`;
    if (!timer) timer = setTimeout(send, 40);
  };
  yaw.addEventListener('input', onInput);
  pitch.addEventListener('input', onInput);

  $('#sens-slider').addEventListener('input', (e) => {
    sensitivity = clamp(parseFloat(e.target.value) || 1, 0.2, 3);
    applySensitivityUI();
    try { localStorage.setItem(SENS_KEY, String(sensitivity)); } catch (_) { /* storage unavailable */ }
  });

  $('#btn-cam-reset').addEventListener('click', async () => {
    const res = await request('camera:reset');
    if (!res.ok) errorToast(res.error);
  });
}

function renderPlayer() {
  const p = state.player;
  if (!p) { $('#cam-facing').textContent = '-'; return; }
  $('#cam-facing').textContent = `${p.facing} (${Math.round(p.heading)}°)`;
  if (Date.now() < sliderBusyUntil) return; // don't fight the user's slider
  $('#yaw-slider').value = String(Math.round(p.yaw));
  $('#pitch-slider').value = String(Math.round(p.pitch));
  $('#yaw-val').textContent = `${Math.round(p.yaw)}°`;
  $('#pitch-val').textContent = `${Math.round(p.pitch)}°`;
}

export function initCamera() {
  loadSensitivity();
  applySensitivityUI();
  initDrag();
  initHoldButtons();
  initSliders();
  on('player', renderPlayer);
  on('status', refreshEnabled);
  on('afk', refreshEnabled);
  on('online', refreshEnabled);
  refreshEnabled();
}
