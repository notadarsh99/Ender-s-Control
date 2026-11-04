'use strict';

const { CONTROLS } = require('../utils/validate');

const blank = () => Object.fromEntries(CONTROLS.map((c) => [c, false]));

/** Wraps mineflayer control states (WASD, jump, sprint, sneak). */
class Movement {
  constructor() {
    this.bot = null;
    this.state = blank();
    this.locked = false; // true while manual idle mode is on
  }

  attach(bot) {
    this.bot = bot;
    this.state = blank();
  }

  detach() {
    this.bot = null;
    this.state = blank();
  }

  setLocked(locked) {
    this.locked = Boolean(locked);
    if (this.locked) this.stopAll();
  }

  setControl(control, enabled) {
    if (!this.bot) return { ok: false, error: 'Bot is not connected' };
    if (this.locked && enabled) return { ok: false, error: 'Idle mode is on - disable it to move' };
    try {
      this.bot.setControlState(control, enabled);
      this.state[control] = enabled;
      return { ok: true };
    } catch (err) {
      return { ok: false, error: `Could not set control: ${err.message}` };
    }
  }

  stopAll() {
    if (this.bot) {
      for (const control of CONTROLS) {
        try { this.bot.setControlState(control, false); } catch (_) { /* bot may be closing */ }
      }
    }
    this.state = blank();
    return { ok: true };
  }

  snapshot() {
    return { ...this.state };
  }
}

module.exports = Movement;
