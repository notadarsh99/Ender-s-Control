import { $, setText, errorToast, toast } from '../util.js';
import { state, on, isInWorld, canControl } from '../store.js';
import { request } from '../socket.js';

// Player-inventory window layout: 5-8 armor | 9-35 backpack | 36-44 hotbar | 45 off-hand
const ARMOR_SLOTS = [5, 6, 7, 8];
const OFFHAND_SLOT = 45;
const ARMOR_LABELS = ['Helmet', 'Chestplate', 'Leggings', 'Boots'];

let selected = null; // window slot number, or null

function hueOf(name) {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

function initials(item) {
  const words = String(item.displayName || item.name).split(/[\s_]+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return String(words[0] || '?').slice(0, 2).toUpperCase();
}

export function itemTile(item) {
  const hue = hueOf(item.name);
  const tile = document.createElement('div');
  tile.className = 'item-tile';
  tile.style.background = `linear-gradient(135deg, hsl(${hue} 60% 42%), hsl(${(hue + 40) % 360} 55% 28%))`;
  tile.textContent = initials(item);
  return tile;
}

/** Item currently in a window slot, read from the latest snapshot. */
function itemAt(slot) {
  const inv = state.inventory;
  if (!inv) return null;
  if (slot >= 9 && slot <= 35) return inv.main[slot - 9];
  if (slot >= 36 && slot <= 44) return inv.hotbar[slot - 36];
  if (slot >= 5 && slot <= 8) return inv.armor[slot - 5].item;
  if (slot === OFFHAND_SLOT) return inv.offhand;
  return null;
}

function slotEl(item, slotNum, { held = false } = {}) {
  const slot = document.createElement('div');
  const manage = canControl();
  slot.className = `slot${held ? ' held' : ''}${manage ? ' selectable' : ''}${slotNum === selected ? ' selected' : ''}${manage && selected !== null && slotNum !== selected ? ' target-hint' : ''}`;
  slot.dataset.slot = String(slotNum);
  if (manage) {
    slot.tabIndex = 0;
    slot.setAttribute('role', 'button');
    slot.addEventListener('click', () => onSlotClick(slotNum));
    slot.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSlotClick(slotNum); }
    });
  }
  if (!item) return slot;

  slot.appendChild(itemTile(item));
  if (item.count > 1) {
    const c = document.createElement('span');
    c.className = 'count';
    c.textContent = String(item.count);
    slot.appendChild(c);
  }
  if (item.durability && item.durability.used > 0) {
    const left = Math.max(0, 1 - item.durability.used / item.durability.max);
    const dur = document.createElement('div');
    dur.className = 'dur';
    const fill = document.createElement('i');
    fill.style.width = `${Math.round(left * 100)}%`;
    fill.style.background = `hsl(${Math.round(left * 120)} 75% 50%)`;
    dur.appendChild(fill);
    slot.appendChild(dur);
  }
  const dura = item.durability ? ` - durability ${item.durability.max - item.durability.used}/${item.durability.max}` : '';
  slot.title = `${item.displayName} x${item.count} (${item.name})${dura}`;
  return slot;
}

function fill(hostId, items, firstSlot, heldIndex = -1) {
  const host = document.getElementById(hostId);
  host.textContent = '';
  items.forEach((item, i) => host.appendChild(slotEl(item, firstSlot + i, { held: i === heldIndex })));
}

function empty(count) { return Array.from({ length: count }, () => null); }

// ------------------------------------------------------------------ actions
async function call(event, payload, okMessage) {
  const res = await request(event, payload);
  if (!res.ok) errorToast(res.error);
  else if (okMessage) toast('success', okMessage);
  return res;
}

async function onSlotClick(slot) {
  if (!canControl()) return;
  if (selected === null) {
    if (itemAt(slot)) { selected = slot; render(); }
    return;
  }
  if (selected === slot) { selected = null; render(); return; }
  const from = selected;
  selected = null;
  render();
  await call('inv:move', { from, to: slot });
}

function renderActions() {
  const bar = $('#inv-actions');
  const item = selected === null ? null : itemAt(selected);
  if (selected !== null && (!item || !canControl())) selected = null; // item vanished or controls locked
  bar.hidden = selected === null;
  if (selected === null) return;

  setText('inv-sel-name', `${item.displayName} x${item.count}`);
  const isHotbar = selected >= 36 && selected <= 44;
  const isArmor = ARMOR_SLOTS.includes(selected);
  const isOffhand = selected === OFFHAND_SLOT;
  $('#btn-inv-select').hidden = !isHotbar;
  $('#btn-inv-equip').hidden = isArmor || isOffhand;
  $('#btn-inv-offhand').hidden = isOffhand;
  $('#btn-inv-unequip').hidden = !(isArmor || isOffhand);
}

function wireActions() {
  const withSelected = (fn) => async () => {
    if (selected === null) return;
    const slot = selected;
    await fn(slot);
    selected = null;
    render();
  };
  $('#btn-inv-select').addEventListener('click', withSelected((slot) => call('inv:select', { slot: slot - 36 })));
  $('#btn-inv-equip').addEventListener('click', withSelected((slot) => call('inv:equip', { slot, destination: 'auto' })));
  $('#btn-inv-offhand').addEventListener('click', withSelected((slot) => call('inv:equip', { slot, destination: 'off-hand' })));
  $('#btn-inv-unequip').addEventListener('click', withSelected((slot) => call('inv:unequip', { slot })));
  $('#btn-inv-drop1').addEventListener('click', withSelected((slot) => call('inv:drop', { slot, stack: false })));
  $('#btn-inv-dropall').addEventListener('click', withSelected((slot) => call('inv:drop', { slot, stack: true })));
  $('#btn-inv-cancel').addEventListener('click', () => { selected = null; render(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && selected !== null) { selected = null; render(); }
  });
}

// ------------------------------------------------------------------- render
function render() {
  const inv = state.inventory;
  const ok = isInWorld();
  $('#inv-notice').hidden = ok && Boolean(inv);
  if (!inv) selected = null;

  fill('inv-main', inv ? inv.main : empty(27), 9);
  fill('inv-hotbar', inv ? inv.hotbar : empty(9), 36, inv ? inv.heldSlot : -1);

  const armor = $('#inv-armor');
  armor.textContent = '';
  (inv ? inv.armor : ARMOR_LABELS.map((label) => ({ label, item: null }))).forEach((a, i) => {
    const row = document.createElement('div');
    row.className = 'armor-row';
    row.appendChild(slotEl(a.item, ARMOR_SLOTS[i]));
    const label = document.createElement('span');
    label.textContent = a.item ? a.item.displayName : a.label;
    row.appendChild(label);
    armor.appendChild(row);
  });

  const held = $('#inv-held');
  held.textContent = '';
  held.appendChild(slotEl(inv ? inv.held : null, inv ? 36 + inv.heldSlot : 36, { held: Boolean(inv && inv.held) }));
  if (inv && inv.held) {
    const n = document.createElement('div');
    n.className = 'item-name';
    n.textContent = `${inv.held.displayName} x${inv.held.count}`;
    held.appendChild(n);
  }

  const off = $('#inv-offhand');
  off.textContent = '';
  off.appendChild(slotEl(inv ? inv.offhand : null, OFFHAND_SLOT));

  if (inv) {
    const all = [...inv.main, ...inv.hotbar, ...inv.armor.map((a) => a.item), inv.offhand].filter(Boolean);
    setText('inv-count', `${all.length} slots`);
    setText('inv-total', all.reduce((sum, i) => sum + i.count, 0));
  } else {
    setText('inv-count', '-');
    setText('inv-total', '-');
  }
  renderActions();
}

export function initInventory() {
  wireActions();
  on('inventory', render);
  on('status', render);
  on('afk', render);
  on('online', render);
  on('page', () => { if (selected !== null) { selected = null; render(); } });
  render();
}
