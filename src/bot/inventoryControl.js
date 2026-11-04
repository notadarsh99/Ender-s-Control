'use strict';

const { wearDest } = require('./inventory');

// Player-inventory window layout: 5-8 armor | 9-35 backpack | 36-44 hotbar | 45 off-hand
const EQUIPMENT_SLOTS = { 5: 'head', 6: 'torso', 7: 'legs', 8: 'feet', 45: 'off-hand' };
const CALL_TIMEOUT_MS = 5000;

const withTimeout = (promise) => Promise.race([
  Promise.resolve(promise),
  new Promise((_, reject) => { setTimeout(() => reject(new Error('the server did not respond')), CALL_TIMEOUT_MS).unref(); }),
]);

const labelOf = (item) => item.displayName || item.name;

/**
 * Manages the bot's own inventory (select hotbar slot, equip, unequip, drop,
 * move / swap). Slot numbers are window slots and are validated before they
 * reach this class.
 */
class InventoryControl {
  constructor() {
    this.bot = null;
    this.locked = false;
  }

  attach(bot) { this.bot = bot; }
  detach() { this.bot = null; }
  setLocked(locked) { this.locked = Boolean(locked); }

  _guard() {
    if (!this.bot || !this.bot.inventory) return { ok: false, error: 'Bot is not in the world' };
    if (this.locked) return { ok: false, error: 'Idle mode is on - disable it to manage the inventory' };
    return null;
  }

  _item(slot) {
    return this.bot.inventory.slots[slot] || null;
  }

  async _run(fn) {
    try {
      return await fn();
    } catch (err) {
      return { ok: false, error: `Inventory action failed: ${err.message}` };
    }
  }

  select(hotbarIndex) {
    const blocked = this._guard();
    if (blocked) return blocked;
    try {
      this.bot.setQuickBarSlot(hotbarIndex);
      return { ok: true, info: `Selected hotbar slot ${hotbarIndex + 1}` };
    } catch (err) {
      return { ok: false, error: `Inventory action failed: ${err.message}` };
    }
  }

  async equip(slot, destination = 'auto') {
    const blocked = this._guard();
    if (blocked) return blocked;
    return this._run(async () => {
      const item = this._item(slot);
      if (!item) return { ok: false, error: 'That slot is empty' };
      const dest = destination === 'auto' ? (wearDest(item.name) || 'hand') : destination;
      await withTimeout(this.bot.equip(item, dest));
      return { ok: true, info: dest === 'hand' ? `Holding ${labelOf(item)}` : `Equipped ${labelOf(item)}` };
    });
  }

  async unequip(slot) {
    const blocked = this._guard();
    if (blocked) return blocked;
    const dest = EQUIPMENT_SLOTS[slot];
    if (!dest) return { ok: false, error: 'That is not an armor or off-hand slot' };
    return this._run(async () => {
      const item = this._item(slot);
      if (!item) return { ok: false, error: 'Nothing is equipped there' };
      await withTimeout(this.bot.unequip(dest));
      return { ok: true, info: `Unequipped ${labelOf(item)}` };
    });
  }

  async drop(slot, stack) {
    const blocked = this._guard();
    if (blocked) return blocked;
    return this._run(async () => {
      const item = this._item(slot);
      if (!item) return { ok: false, error: 'That slot is empty' };
      // Window click, mode 4 (drop): button 0 drops one item, button 1 the whole stack.
      await withTimeout(this.bot.clickWindow(slot, stack ? 1 : 0, 4));
      return { ok: true, info: stack ? `Dropped ${labelOf(item)} x${item.count}` : `Dropped 1 ${labelOf(item)}` };
    });
  }

  async move(from, to) {
    const blocked = this._guard();
    if (blocked) return blocked;
    if (from === to) return { ok: false, error: 'Pick a different slot to move to' };
    return this._run(async () => {
      const item = this._item(from);
      if (!item) return { ok: false, error: 'That slot is empty' };
      const armorDest = EQUIPMENT_SLOTS[to];
      if (armorDest && armorDest !== 'off-hand' && wearDest(item.name) !== armorDest) {
        return { ok: false, error: `${labelOf(item)} cannot be worn there` };
      }
      await withTimeout(this.bot.moveSlotItem(from, to));
      return { ok: true, info: `Moved ${labelOf(item)}` };
    });
  }
}

module.exports = InventoryControl;
