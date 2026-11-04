import { $, setText } from '../util.js';
import { state, on } from '../store.js';

const CONTROL_LABELS = {
  forward: 'Forward', back: 'Back', left: 'Left', right: 'Right', jump: 'Jump', sprint: 'Sprint', sneak: 'Sneak',
};

function fmtWorldTime(ticks) {
  if (ticks === null || ticks === undefined) return '-';
  const hours24 = (Math.floor(ticks / 1000) + 6) % 24;
  const minutes = Math.floor(((ticks % 1000) / 1000) * 60);
  const isDay = ticks < 12000;
  return `${String(hours24).padStart(2, '0')}:${String(minutes).padStart(2, '0')} (${isDay ? 'day' : 'night'})`;
}

function bar(id, value, max) {
  $(id).style.width = value === null ? '0%' : `${Math.max(0, Math.min(100, (value / max) * 100))}%`;
}

function render() {
  const p = state.player;
  const tag = $('#pl-status');
  if (!p) {
    tag.textContent = 'Offline';
    tag.dataset.state = 'disconnected';
    ['pl-health-text', 'pl-food-text', 'pl-xp-text', 'pl-sat', 'pl-gm', 'pl-dim', 'pl-ground', 'pl-time', 'pl-weather',
      'pl-x', 'pl-y', 'pl-z', 'pl-facing', 'pl-yaw', 'pl-pitch'].forEach((id) => setText(id, '-'));
    ['#pl-health-bar', '#pl-food-bar', '#pl-xp-bar'].forEach((id) => bar(id, null, 1));
    $('#pl-needle').style.transform = 'rotate(0deg)';
    const chips = $('#pl-controls');
    chips.textContent = '';
    const off = document.createElement('span');
    off.className = 'chip chip-off';
    off.textContent = 'none';
    chips.appendChild(off);
    return;
  }

  tag.textContent = p.status;
  tag.dataset.state = p.status === 'Dead' ? 'disconnected' : 'connected';

  setText('pl-health-text', `${p.health} / ${p.maxHealth}`);
  bar('#pl-health-bar', p.health, p.maxHealth);
  $('#pl-health-bar').classList.toggle('low', p.health <= 6);
  setText('pl-food-text', `${p.food} / 20`);
  bar('#pl-food-bar', p.food, 20);
  setText('pl-xp-text', `Level ${p.xpLevel} (${Math.round(p.xpProgress * 100)}%)`);
  bar('#pl-xp-bar', p.xpProgress, 1);
  setText('pl-sat', p.saturation);
  setText('pl-gm', p.gameMode);
  setText('pl-dim', p.dimension);
  setText('pl-ground', p.onGround ? 'Yes' : 'No');
  setText('pl-time', fmtWorldTime(p.timeOfDay));
  setText('pl-weather', p.raining ? 'Raining' : 'Clear');
  setText('pl-x', p.position.x);
  setText('pl-y', p.position.y);
  setText('pl-z', p.position.z);
  setText('pl-facing', `${p.facing} (${Math.round(p.heading)}°)`);
  setText('pl-yaw', `${p.yaw}°`);
  setText('pl-pitch', `${p.pitch}°`);
  $('#pl-needle').style.transform = `rotate(${p.heading}deg)`;

  const chips = $('#pl-controls');
  chips.textContent = '';
  const active = Object.keys(CONTROL_LABELS).filter((c) => p.controls && p.controls[c]);
  if (!active.length) {
    const off = document.createElement('span');
    off.className = 'chip chip-off';
    off.textContent = 'none';
    chips.appendChild(off);
  } else {
    active.forEach((c) => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = CONTROL_LABELS[c];
      chips.appendChild(chip);
    });
  }
}

export function initPlayer() {
  on('player', render);
  render();
}
