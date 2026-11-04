'use strict';

const EventEmitter = require('events');
const { validateChatMessage } = require('../utils/validate');

/** Receives server chat and sends (validated) messages / commands. */
class Chat extends EventEmitter {
  constructor({ maxLength, bufferSize }) {
    super();
    this.maxLength = maxLength;
    this.bufferSize = bufferSize;
    this.bot = null;
    this.messages = [];
    this.seq = 0;
    this._onMessage = null;
  }

  attach(bot) {
    this.bot = bot;
    this._onMessage = (jsonMsg, position) => {
      if (position === 'game_info') return; // action bar spam
      let text = '';
      let motd = '';
      try {
        text = jsonMsg.toString();
        motd = typeof jsonMsg.toMotd === 'function' ? jsonMsg.toMotd() : text;
      } catch (_) {
        return;
      }
      if (!text.trim()) return;
      this._push({
        type: position === 'system' ? 'system' : 'chat',
        text: text.slice(0, 1000),
        motd: motd.slice(0, 2000),
      });
    };
    bot.on('message', this._onMessage);
  }

  detach() {
    if (this.bot && this._onMessage) this.bot.removeListener('message', this._onMessage);
    this.bot = null;
    this._onMessage = null;
  }

  _push(partial) {
    const entry = { id: ++this.seq, ts: Date.now(), ...partial };
    this.messages.push(entry);
    if (this.messages.length > this.bufferSize) this.messages.shift();
    this.emit('message', entry);
    return entry;
  }

  /** Adds a locally generated line (e.g. echo of a sent command). */
  note(type, text) {
    return this._push({ type, text, motd: text });
  }

  send(payload) {
    if (!this.bot) return { ok: false, error: 'Bot is not connected' };
    const parsed = validateChatMessage(payload, this.maxLength);
    if (!parsed.ok) return parsed;
    try {
      this.bot.chat(parsed.value);
    } catch (err) {
      return { ok: false, error: `Could not send message: ${err.message}` };
    }
    if (parsed.value.startsWith('/')) this.note('outgoing', parsed.value); // commands are not echoed by servers
    return { ok: true };
  }

  history() { return this.messages.slice(); }

  clear() {
    this.messages = [];
    this.emit('cleared');
  }
}

module.exports = Chat;
