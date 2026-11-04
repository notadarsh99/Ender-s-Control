'use strict';

/**
 * Read-only inventory view. Player inventory window layout:
 *   5-8 armor (head, chest, legs, feet) | 9-35 main | 36-44 hotbar | 45 off-hand
 */
const ARMOR_SLOTS = [
  { slot: 5, label: 'Helmet' },
  { slot: 6, label: 'Chestplate' },
  { slot: 7, label: 'Leggings' },
  { slot: 8, label: 'Boots' },
];

/** Which equipment slot an item can be worn in, or null if it cannot be worn. */
function wearDest(name) {
  if (name === 'shield') return 'off-hand';
  if (/_helmet$|^carved_pumpkin$|_head$|_skull$/.test(name)) return 'head';
  if (/_chestplate$|^elytra$/.test(name)) return 'torso';
  if (/_leggings$/.test(name)) return 'legs';
  if (/_boots$/.test(name)) return 'feet';
  return null;
}

function toItem(item, slot) {
  if (!item) return null;
  const out = {
    slot,
    name: item.name,
    displayName: item.displayName || item.name,
    count: item.count,
    wear: wearDest(item.name),
  };
  if (typeof item.maxDurability === 'number' && item.maxDurability > 0) {
    const used = typeof item.durabilityUsed === 'number' ? item.durabilityUsed : 0;
    out.durability = { used, max: item.maxDurability };
  }
  return out;
}

function inventorySnapshot(bot) {
  if (!bot || !bot.inventory) return null;
  const slots = bot.inventory.slots;
  const range = (from, to) => {
    const list = [];
    for (let i = from; i <= to; i += 1) list.push(toItem(slots[i], i));
    return list;
  };
  const heldSlot = 36 + (bot.quickBarSlot || 0);
  return {
    main: range(9, 35),
    hotbar: range(36, 44),
    armor: ARMOR_SLOTS.map(({ slot, label }) => ({ label, item: toItem(slots[slot], slot) })),
    offhand: toItem(slots[45], 45),
    held: toItem(bot.heldItem, heldSlot),
    heldSlot: bot.quickBarSlot || 0,
  };
}

module.exports = { inventorySnapshot, wearDest };
