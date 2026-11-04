'use strict';

const rad = (deg) => (deg * Math.PI) / 180;
const PITCH_LIMIT = Math.PI / 2;

/** Camera (yaw / pitch) control. All public angles are in degrees. */
class Camera {
  constructor() {
    this.bot = null;
    this.locked = false;
  }

  attach(bot) { this.bot = bot; }
  detach() { this.bot = null; }
  setLocked(locked) { this.locked = Boolean(locked); }

  _look(yaw, pitch) {
    if (!this.bot || !this.bot.entity) return { ok: false, error: 'Bot is not in the world' };
    if (this.locked) return { ok: false, error: 'Idle mode is on - disable it to look around' };
    const clampedPitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));
    try {
      Promise.resolve(this.bot.look(yaw, clampedPitch, true)).catch(() => {});
      return { ok: true };
    } catch (err) {
      return { ok: false, error: `Could not rotate camera: ${err.message}` };
    }
  }

  rotate(dyawDeg, dpitchDeg) {
    if (!this.bot || !this.bot.entity) return { ok: false, error: 'Bot is not in the world' };
    return this._look(this.bot.entity.yaw + rad(dyawDeg), this.bot.entity.pitch + rad(dpitchDeg));
  }

  set(yawDeg, pitchDeg) {
    return this._look(rad(yawDeg), rad(pitchDeg));
  }

  reset() {
    return this._look(0, 0);
  }
}

module.exports = Camera;
