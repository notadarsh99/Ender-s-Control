'use strict';

const EventEmitter = require('events');

const CATEGORIES = Object.freeze(['connection', 'chat', 'error', 'system']);
const LEVELS = Object.freeze(['info', 'warn', 'error']);

/**
 * In-memory ring-buffer logger. Nothing is written to disk, which also
 * guarantees that no credential can be persisted through the logs.
 */
class Logger extends EventEmitter {
  constructor(maxEntries = 500) {
    super();
    this.maxEntries = maxEntries;
    this.entries = [];
    this.seq = 0;
  }

  add(category, level, message) {
    if (!CATEGORIES.includes(category)) category = 'system';
    if (!LEVELS.includes(level)) level = 'info';
    const entry = {
      id: ++this.seq,
      ts: Date.now(),
      category,
      level,
      message: String(message).slice(0, 1000),
    };
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) this.entries.shift();
    this.emit('entry', entry);
    return entry;
  }

  info(category, message) { return this.add(category, 'info', message); }
  warn(category, message) { return this.add(category, 'warn', message); }
  error(category, message) { return this.add(category, 'error', message); }

  history() { return this.entries.slice(); }

  clear(category) {
    this.entries = category && CATEGORIES.includes(category)
      ? this.entries.filter((e) => e.category !== category)
      : [];
    this.emit('cleared', category || null);
  }
}

module.exports = { Logger, CATEGORIES, LEVELS };
