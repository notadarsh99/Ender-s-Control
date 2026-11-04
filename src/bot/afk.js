'use strict';

const EventEmitter = require('events');

/**
 * AFK / idle indicator. This is purely informational plus a manual idle
 * switch - it never generates movement, jumps, chat or any other activity to
 * keep the bot "active". Idle mode simply holds the bot still.
 */
class AfkMonitor extends EventEmitter {
  constructor(thresholdMs) {
    super();
    this.thresholdMs = thresholdMs;
    this.manualIdle = false;
    this.lastInput = Date.now();
    this.lastStatus = this.status();
    this.timer = setInterval(() => this._check(), 5000);
    this.timer.unref();
  }

  /** Record that the operator interacted with the bot. */
  touch() {
    this.lastInput = Date.now();
    this._check();
  }

  setManualIdle(enabled) {
    this.manualIdle = Boolean(enabled);
    if (!this.manualIdle) this.lastInput = Date.now();
    this._check();
  }

  status() {
    if (this.manualIdle) return 'idle';
    if (Date.now() - this.lastInput > this.thresholdMs) return 'afk';
    return 'active';
  }

  snapshot() {
    return {
      status: this.status(),
      manualIdle: this.manualIdle,
      idleForMs: Date.now() - this.lastInput,
      thresholdMs: this.thresholdMs,
    };
  }

  _check() {
    const status = this.status();
    if (status !== this.lastStatus) {
      this.lastStatus = status;
      this.emit('change', this.snapshot());
    }
  }

  destroy() {
    clearInterval(this.timer);
  }
}

module.exports = AfkMonitor;
