import { $, errorToast } from '../util.js';
import { state, on, canControl } from '../store.js';
import { request } from '../socket.js';
import { itemTile } from './inventory.js';

async function select(index) {
  if (!canControl()) return;
  const res = await request('inv:select', { slot: index });
  if (!res.ok) errorToast(res.error);
}

function render() {
  const host = $('#hotbar-quick');
  const inv = state.inventory;
  const ok = canControl();
  host.textContent = '';
  for (let i = 0; i < 9; i += 1) {
    const item = inv ? inv.hotbar[i] : null;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `hb-btn${inv && inv.heldSlot === i ? ' active' : ''}`;
    btn.disabled = !ok;
    btn.title = item ? `${item.displayName} x${item.count}` : `Slot ${i + 1} (empty)`;
    const key = document.createElement('span');
    key.className = 'hb-key';
    key.textContent = String(i + 1);
    btn.appendChild(key);
    if (item) {
      btn.appendChild(itemTile(item));
      if (item.count > 1) {
        const c = document.createElement('span');
        c.className = 'count';
        c.textContent = String(item.count);
        btn.appendChild(c);
      }
    }
    btn.addEventListener('click', () => select(i));
    host.appendChild(btn);
  }
}

export function initHotbar() {
  document.addEventListener('keydown', (e) => {
    if (state.page !== 'controls' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
    if (e.key >= '1' && e.key <= '9') { e.preventDefault(); select(Number(e.key) - 1); }
  });
  on('inventory', render);
  on('status', render);
  on('afk', render);
  on('online', render);
  render();
}
