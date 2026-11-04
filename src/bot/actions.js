'use strict';

const { Vec3 } = require('vec3');

const ENTITY_REACH = 4;
const BLOCK_REACH = 5;
const ATTACK_COOLDOWN_MS = 500;
const CALL_TIMEOUT_MS = 3000;

// Block face index (as reported by mineflayer's raycast) -> face normal.
const FACE_NORMALS = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];

// Blocks that open a GUI / toggle when right-clicked instead of accepting a placed block.
const INTERACTIVE = new RegExp([
  'chest$', '^barrel$', 'crafting_table', 'furnace', 'smoker', 'anvil$', 'enchanting_table', '_door$', 'trapdoor',
  '_button$', '^lever$', 'shulker_box', '_bed$', 'fence_gate', 'brewing_stand', '^hopper$', '^dispenser$', '^dropper$',
  '^loom$', 'grindstone', 'cartography_table', 'smithing_table', 'stonecutter', 'note_block', '^jukebox$', '^bell$',
  '^beacon$', '^lectern$', '^repeater$', '^comparator$', '^cauldron$', '^crafter$',
].join('|'));

const withTimeout = (promise, ms = CALL_TIMEOUT_MS) => Promise.race([
  Promise.resolve(promise),
  new Promise((resolve) => { setTimeout(resolve, ms).unref(); }), // the server may never confirm; don't hang the UI
]);

const nameOf = (thing, fallback) => (thing && (thing.username || thing.displayName || thing.name || thing.type)) || fallback;

/**
 * Mouse clicks. Everything acts on what Ender's crosshair is pointing at, so
 * the operator aims with the camera first. One click is one action - nothing
 * here repeats by itself (holding "break" keeps mining only while the button
 * is physically held, and is stopped on release / blur / idle mode).
 *   left  : attack the entity in reach, otherwise swing the arm
 *   break : mine the targeted block while held
 *   right : open / toggle the targeted block, place a held block item against
 *           the clicked face, or use the held item when nothing is targeted
 */
class Actions {
  constructor() {
    this.bot = null;
    this.locked = false;
    this.holding = false; // break button is held
    this.digging = false; // a dig is in flight
    this.lastAttackAt = 0;
  }

  attach(bot) { this.bot = bot; }

  detach() {
    this.holding = false;
    this.digging = false;
    this.bot = null;
  }

  setLocked(locked) {
    this.locked = Boolean(locked);
    if (this.locked) this.setDigging(false);
  }

  _guard() {
    if (!this.bot || !this.bot.entity) return { ok: false, error: 'Bot is not in the world' };
    if (this.locked) return { ok: false, error: 'Idle mode is on - disable it to click' };
    return null;
  }

  attack() {
    const blocked = this._guard();
    if (blocked) return blocked;
    const now = Date.now();
    if (now - this.lastAttackAt < ATTACK_COOLDOWN_MS) return { ok: false, error: 'Attack is on cooldown - wait a moment' };
    this.lastAttackAt = now;
    try {
      const entity = this.bot.entityAtCursor(ENTITY_REACH);
      if (entity) {
        this.bot.attack(entity);
        return { ok: true, info: `Attacked ${nameOf(entity, 'entity')}` };
      }
      this.bot.swingArm();
      return { ok: true, info: 'Swung arm' };
    } catch (err) {
      return { ok: false, error: `Click failed: ${err.message}` };
    }
  }

  setDigging(enabled) {
    if (!enabled) {
      this.holding = false;
      if (this.digging && this.bot && typeof this.bot.stopDigging === 'function') {
        try { this.bot.stopDigging(); } catch (_) { /* bot may be closing */ }
      }
      return { ok: true };
    }
    const blocked = this._guard();
    if (blocked) return blocked;
    if (this.holding) return { ok: true, info: 'Breaking...' };
    try {
      const block = this.bot.blockAtCursor(BLOCK_REACH);
      if (!block) return { ok: false, error: 'No block under the crosshair - aim with the camera first' };
      if (typeof this.bot.canDigBlock === 'function' && !this.bot.canDigBlock(block)) {
        return { ok: false, error: `Cannot break ${nameOf(block, 'that block')}` };
      }
      this.holding = true;
      this._digLoop(block);
      return { ok: true, info: `Breaking ${nameOf(block, 'block')}` };
    } catch (err) {
      return { ok: false, error: `Click failed: ${err.message}` };
    }
  }

  /** Mines the targeted block, then the next one under the crosshair, until the button is released. */
  async _digLoop(first) {
    let block = first;
    try {
      while (this.holding && this.bot && block) {
        this.digging = true;
        try {
          await this.bot.dig(block, 'ignore'); // 'ignore': never move the camera on its own
        } catch (_) {
          break; // aborted on release, out of reach, or not breakable
        } finally {
          this.digging = false;
        }
        if (!this.holding || !this.bot) break;
        block = this.bot.blockAtCursor(BLOCK_REACH);
        if (block && typeof this.bot.canDigBlock === 'function' && !this.bot.canDigBlock(block)) break;
      }
    } finally {
      this.holding = false;
    }
  }

  async use() {
    const blocked = this._guard();
    if (blocked) return blocked;
    const bot = this.bot;
    try {
      const held = bot.heldItem;
      const heldName = held ? nameOf(held, 'item') : null;
      const block = bot.blockAtCursor(BLOCK_REACH);

      if (!block) {
        const entity = bot.entityAtCursor(ENTITY_REACH);
        if (entity && typeof bot.activateEntity === 'function') {
          await withTimeout(bot.activateEntity(entity));
          return { ok: true, info: `Interacted with ${nameOf(entity, 'entity')}` };
        }
        bot.activateItem();
        return { ok: true, info: heldName ? `Used ${heldName}` : 'Used empty hand' };
      }

      const blockName = nameOf(block, 'block');
      const sneaking = typeof bot.getControlState === 'function' && bot.getControlState('sneak');
      const isBlockItem = Boolean(held && bot.registry && bot.registry.blocksByName && bot.registry.blocksByName[held.name]);
      const normal = FACE_NORMALS[block.face];
      if (isBlockItem && normal && (!INTERACTIVE.test(block.name) || sneaking)) {
        await withTimeout(bot.placeBlock(block, new Vec3(normal[0], normal[1], normal[2])));
        return { ok: true, info: `Placed ${heldName} on ${blockName}` };
      }
      await withTimeout(bot.activateBlock(block));
      return { ok: true, info: `Interacted with ${blockName}` };
    } catch (err) {
      return { ok: false, error: `Click failed: ${err.message}` };
    }
  }
}

module.exports = Actions;
