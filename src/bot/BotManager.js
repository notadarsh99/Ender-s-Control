'use strict';

const EventEmitter = require('events');
const Movement = require('./movement');
const Camera = require('./camera');
const Actions = require('./actions');
const InventoryControl = require('./inventoryControl');
const Chat = require('./chat');
const AfkMonitor = require('./afk');
const { playerSnapshot, serverSnapshot } = require('./player');
const { inventorySnapshot } = require('./inventory');

const RECONNECT_COOLDOWN_MS = 5000; // be polite: many servers throttle rapid re-joins
const TICK_MS = 1000;

const FRIENDLY_ERRORS = {
  ECONNREFUSED: 'Connection refused - the server is offline or the port is wrong',
  ENOTFOUND: 'Server address could not be resolved (DNS lookup failed)',
  ETIMEDOUT: 'Connection timed out',
  ECONNRESET: 'Connection was reset by the server',
  EHOSTUNREACH: 'Server host is unreachable',
};

/** Turns a kick/disconnect reason (string, JSON string or chat object) into plain text. */
function flattenReason(reason) {
  const walk = (node) => {
    if (node === null || node === undefined) return '';
    if (typeof node === 'string') return node;
    if (Array.isArray(node)) return node.map(walk).join('');
    if (typeof node === 'object') {
      const own = node.text || node.translate || (node.value && walk(node.value)) || '';
      return String(own) + walk(node.extra) + walk(node.with);
    }
    return String(node);
  };
  let value = reason;
  if (typeof reason === 'string') {
    try { value = JSON.parse(reason); } catch (_) { value = reason; }
  }
  // eslint-disable-next-line no-control-regex
  return walk(value).replace(/§./g, '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 300) || 'No reason given';
}

/**
 * Owns the single Ender bot: lifecycle, state machine and feature modules.
 * Emits: status, player, inventory, chat, notify, afk, controls.
 */
class BotManager extends EventEmitter {
  constructor({ config, logger, createBot, initialTarget, persist }) {
    super();
    this.config = config;
    this.logger = logger;
    this.persist = persist || null;
    // Connection target - editable from the dashboard while disconnected.
    this.target = {
      host: config.bot.host,
      port: config.bot.port,
      username: config.bot.username,
      version: config.bot.version,
      ...(initialTarget || {}),
    };
    this.createBot = createBot || ((opts) => require('mineflayer').createBot(opts));

    this.bot = null;
    this.generation = 0;
    this.state = 'disconnected'; // disconnected | connecting | connected | disconnecting
    this.spawned = false;
    this.authStatus = 'unknown'; // unknown | required | command_sent | authenticated
    this.connectedSince = null;
    this.lastAttemptAt = 0;
    this.lastError = null;
    this.lastDisconnect = null;
    this.lastAuthCommandAt = 0;
    this.reconnectTimer = null;
    this.connectTimer = null;
    this.tickTimer = null;
    this.inventoryTimer = null;
    this.intentional = false;

    this.movement = new Movement();
    this.camera = new Camera();
    this.actions = new Actions();
    this.invControl = new InventoryControl();
    this.chat = new Chat({ maxLength: config.limits.chatMaxLength, bufferSize: config.limits.chatBufferSize });
    this.afk = new AfkMonitor(config.bot.afkThresholdMs);

    this.chat.on('message', (entry) => {
      this.logger.info('chat', entry.type === 'outgoing' ? `> ${entry.text}` : entry.text);
      this._detectAuthHints(entry);
      this.emit('chat', entry);
    });
    this.chat.on('cleared', () => this.emit('chatCleared'));
    this.afk.on('change', (snap) => this.emit('afk', snap));
  }

  // ---------------------------------------------------------------- status

  getStatus() {
    const cfg = { ...this.config.bot, ...this.target };
    return {
      state: this.state,
      spawned: this.spawned,
      authStatus: this.authStatus,
      connectedSince: this.connectedSince,
      uptimeMs: this.connectedSince ? Date.now() - this.connectedSince : 0,
      serverTime: Date.now(),
      reconnectPending: Boolean(this.reconnectTimer),
      lastError: this.lastError,
      lastDisconnect: this.lastDisconnect,
      target: { host: cfg.host, port: cfg.port, version: cfg.version, username: cfg.username, auth: cfg.auth },
      defaults: { host: this.config.bot.host, port: this.config.bot.port, username: this.config.bot.username },
      server: this.spawned ? serverSnapshot(this.bot) : null,
    };
  }

  _setState(state) {
    if (this.state === state) return;
    this.state = state;
    this.emit('status', this.getStatus());
  }

  _notify(level, title, message) {
    this.emit('notify', { level, title, message, ts: Date.now() });
  }

  _detectAuthHints(entry) {
    if (entry.type === 'outgoing') return;
    const t = entry.text.toLowerCase();
    if (/\/(login|register)|please (log ?in|register)|you must (log ?in|register)|need to (log ?in|register)/.test(t)) {
      if (this.authStatus !== 'authenticated') this._setAuth('required');
    } else if (/(successful(ly)? (logged|log) ?in|logged in successfully|login successful|successfully registered|registered successfully|welcome back)/.test(t)) {
      this._setAuth('authenticated');
    }
  }

  _setAuth(status) {
    if (this.authStatus === status) return;
    this.authStatus = status;
    this.emit('status', this.getStatus());
  }

  // ------------------------------------------------------------ connection

  connect() {
    if (this.state !== 'disconnected') {
      return { ok: false, error: `Cannot connect while ${this.state}` };
    }
    const wait = RECONNECT_COOLDOWN_MS - (Date.now() - this.lastAttemptAt);
    if (wait > 0) {
      return { ok: false, error: `Please wait ${Math.ceil(wait / 1000)}s before reconnecting (server rate limits)` };
    }
    return this._start();
  }

  _start() {
    const cfg = { ...this.config.bot, ...this.target };
    this.lastAttemptAt = Date.now();
    this.intentional = false;
    this.spawned = false;
    this.authStatus = 'unknown';
    this.lastError = null;
    this.connectedSince = null;
    this.generation += 1;
    const gen = this.generation;
    this._setState('connecting');
    this.logger.info('connection', `Connecting to ${cfg.host}:${cfg.port} as ${cfg.username} (MC ${cfg.version}, offline auth)`);

    let bot;
    try {
      bot = this.createBot({
        host: cfg.host,
        port: cfg.port,
        username: cfg.username,
        version: cfg.version,
        auth: cfg.auth,
        hideErrors: false,
      });
    } catch (err) {
      this._handleFailure(gen, err);
      return { ok: false, error: err.message };
    }
    this.bot = bot;

    this.connectTimer = setTimeout(() => {
      if (gen !== this.generation || this.spawned) return;
      this._handleFailure(gen, new Error('Timed out waiting to join the server'));
      try { bot.end('timeout'); } catch (_) { /* ignore */ }
    }, cfg.connectTimeoutMs);

    bot.once('login', () => {
      if (gen !== this.generation) return;
      this.logger.info('connection', 'Handshake complete, logged in to the server');
      this.emit('status', this.getStatus());
    });

    bot.once('spawn', () => {
      if (gen !== this.generation) return;
      clearTimeout(this.connectTimer);
      this.spawned = true;
      this.connectedSince = Date.now();
      this.movement.attach(bot);
      this.camera.attach(bot);
      this.actions.attach(bot);
      this.invControl.attach(bot);
      this.chat.attach(bot);
      this.movement.setLocked(this.afk.manualIdle);
      this.camera.setLocked(this.afk.manualIdle);
      this.actions.setLocked(this.afk.manualIdle);
      this.invControl.setLocked(this.afk.manualIdle);
      this._setState('connected');
      this.logger.info('connection', `${cfg.username} spawned in the world`);
      this._notify('success', 'Connected', `${cfg.username} joined ${cfg.host}:${cfg.port}`);
      this._startTicking(gen);
      this.emit('inventory', inventorySnapshot(bot));
    });

    bot.on('health', () => { if (gen === this.generation) this._emitPlayer(); });
    bot.on('death', () => {
      if (gen !== this.generation) return;
      this.logger.warn('connection', `${this.target.username} died`);
      this._notify('warn', 'Bot died', 'The bot will respawn automatically.');
    });
    bot.on('spawn', () => { if (gen === this.generation && this.spawned) this._emitPlayer(); }); // respawns / dimension changes
    bot.on('experience', () => { if (gen === this.generation) this._emitPlayer(); });

    if (bot.inventory && typeof bot.inventory.on === 'function') {
      bot.inventory.on('updateSlot', () => this._scheduleInventory(gen));
    }

    bot.on('kicked', (reason) => {
      if (gen !== this.generation) return;
      const text = flattenReason(reason);
      this.lastDisconnect = { kind: 'kicked', reason: text, ts: Date.now() };
      this.logger.error('error', `Kicked from server: ${text}`);
      this._notify('error', 'Kicked from server', text);
    });

    bot.on('error', (err) => {
      if (gen !== this.generation) return;
      this._handleError(err);
    });

    bot.once('end', (reason) => {
      if (gen !== this.generation) return;
      this._handleEnd(gen, reason);
    });

    return { ok: true };
  }

  _handleError(err) {
    const friendly = FRIENDLY_ERRORS[err && err.code] || (err && err.message) || 'Unknown error';
    this.lastError = friendly;
    this.logger.error('error', friendly);
    this._notify('error', 'Bot error', friendly);
    this.emit('status', this.getStatus());
  }

  _handleFailure(gen, err) {
    if (gen !== this.generation) return;
    this._handleError(err);
    this._teardown();
    this.lastDisconnect = { kind: 'failed', reason: this.lastError, ts: Date.now() };
    this._setState('disconnected');
  }

  _handleEnd(gen, reason) {
    clearTimeout(this.connectTimer);
    const wasSpawned = this.spawned;
    const recentKick = this.lastDisconnect && Date.now() - this.lastDisconnect.ts < 5000;
    let detail = String(reason || 'connection closed');
    if (recentKick) detail = this.lastDisconnect.reason;
    else if (!wasSpawned && this.lastError) detail = this.lastError; // e.g. DNS failure is more useful than "socketClosed"
    this._teardown();
    if (!this.lastDisconnect || Date.now() - this.lastDisconnect.ts >= 5000) {
      this.lastDisconnect = { kind: this.intentional ? 'manual' : (wasSpawned ? 'lost' : 'failed'), reason: detail, ts: Date.now() };
    }
    if (this.intentional) {
      this.logger.info('connection', 'Disconnected');
      this._notify('info', 'Disconnected', `${this.target.username} left the server.`);
    } else if (wasSpawned) {
      this.logger.error('connection', `Connection lost: ${detail}`);
      this._notify('error', 'Connection lost', detail);
    } else {
      this.logger.error('connection', `Could not join: ${detail}`);
      this._notify('error', 'Could not join', detail);
    }
    this._setState('disconnected');
  }

  _teardown() {
    clearTimeout(this.connectTimer);
    clearInterval(this.tickTimer);
    clearTimeout(this.inventoryTimer);
    this.tickTimer = null;
    this.inventoryTimer = null;
    this.movement.stopAll();
    this.movement.detach();
    this.camera.detach();
    this.actions.detach();
    this.invControl.detach();
    this.chat.detach();
    this.spawned = false;
    this.connectedSince = null;
    this.authStatus = 'unknown';
    this.bot = null;
    this.generation += 1; // invalidate any late events from the old bot
  }

  disconnect() {
    if (this.state === 'disconnected') {
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
        this.emit('status', this.getStatus());
        return { ok: true };
      }
      return { ok: false, error: 'Bot is already disconnected' };
    }
    if (this.state === 'disconnecting') return { ok: false, error: 'Already disconnecting' };
    this.intentional = true;
    this._setState('disconnecting');
    const bot = this.bot;
    const gen = this.generation;
    try {
      if (this.spawned && typeof bot.quit === 'function') bot.quit('Disconnected from dashboard');
      else bot.end('Disconnected from dashboard');
    } catch (_) { /* fall through to forced end */ }
    // Safety net: if the socket never reports "end", force the state forward.
    setTimeout(() => {
      if (gen === this.generation && this.state === 'disconnecting') this._handleEnd(gen, 'forced');
    }, 3000).unref();
    return { ok: true };
  }

  reconnect() {
    if (this.reconnectTimer) return { ok: false, error: 'A reconnect is already scheduled' };
    if (this.state === 'connecting' || this.state === 'disconnecting') {
      return { ok: false, error: `Cannot reconnect while ${this.state}` };
    }
    const begin = () => {
      const wait = Math.max(0, RECONNECT_COOLDOWN_MS - (Date.now() - this.lastAttemptAt));
      this.logger.info('connection', `Reconnecting in ${Math.ceil(wait / 1000)}s`);
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        if (this.state !== 'disconnected') return;
        const r = this._start();
        if (!r.ok) this._notify('error', 'Reconnect failed', r.error);
      }, wait);
      this.emit('status', this.getStatus());
    };
    if (this.state === 'connected') {
      this.disconnect();
      const onStatus = (s) => {
        if (s.state === 'disconnected') {
          this.removeListener('status', onStatus);
          begin();
        }
      };
      this.on('status', onStatus);
    } else {
      begin();
    }
    return { ok: true };
  }

  // ----------------------------------------------------------- live updates

  _startTicking(gen) {
    clearInterval(this.tickTimer);
    this.tickTimer = setInterval(() => {
      if (gen !== this.generation) return;
      this._emitPlayer();
      this.emit('status', this.getStatus());
    }, TICK_MS);
  }

  _emitPlayer() {
    if (!this.bot || !this.spawned) return;
    this.emit('player', playerSnapshot(this.bot, this.movement.snapshot()));
  }

  _scheduleInventory(gen) {
    if (this.inventoryTimer) return;
    this.inventoryTimer = setTimeout(() => {
      this.inventoryTimer = null;
      if (gen === this.generation && this.bot && this.spawned) this.emit('inventory', inventorySnapshot(this.bot));
    }, 150);
  }

  getPlayer() { return this.spawned ? playerSnapshot(this.bot, this.movement.snapshot()) : null; }
  getInventory() { return this.spawned ? inventorySnapshot(this.bot) : null; }

  // ------------------------------------------------------ connection settings

  /** Changes host / port / username. Only allowed while fully disconnected. */
  updateTarget({ host, port, username }) {
    if (this.state !== 'disconnected' || this.reconnectTimer) {
      return { ok: false, error: 'Disconnect the bot before changing connection settings' };
    }
    this.target = { ...this.target, host, port, username };
    this.lastError = null;
    this.lastDisconnect = null;
    if (this.persist) {
      try {
        this.persist({ host, port, username });
      } catch (err) {
        this.logger.warn('system', `Could not save connection settings: ${err.message}`);
      }
    }
    this.logger.info('system', `Connection settings updated: ${username} @ ${host}:${port}`);
    this.emit('status', this.getStatus());
    return { ok: true };
  }

  // ---------------------------------------------------------------- actions

  setControl(control, enabled) {
    if (enabled) this.afk.touch();
    const r = this.movement.setControl(control, enabled);
    if (r.ok) this.emit('controls', this.movement.snapshot());
    return r;
  }

  stopMovement() {
    const r = this.movement.stopAll();
    this.emit('controls', this.movement.snapshot());
    return r;
  }

  rotateCamera(dyaw, dpitch) { this.afk.touch(); return this.camera.rotate(dyaw, dpitch); }
  setCamera(yaw, pitch) { this.afk.touch(); return this.camera.set(yaw, pitch); }
  resetCamera() { this.afk.touch(); return this.camera.reset(); }

  clickAttack() { this.afk.touch(); return this.actions.attack(); }
  clickDig(enabled) { if (enabled) this.afk.touch(); return this.actions.setDigging(enabled); }
  clickUse() { this.afk.touch(); return this.actions.use(); }

  // Inventory control (acts on the bot's own inventory only)
  invSelect(hotbarIndex) { this.afk.touch(); const r = this.invControl.select(hotbarIndex); if (r.ok) this._scheduleInventory(this.generation); return r; }
  invEquip(slot, destination) { this.afk.touch(); return this.invControl.equip(slot, destination); }
  invUnequip(slot) { this.afk.touch(); return this.invControl.unequip(slot); }
  invDrop(slot, stack) { this.afk.touch(); return this.invControl.drop(slot, stack); }
  invMove(from, to) { this.afk.touch(); return this.invControl.move(from, to); }

  sendChat(payload) {
    if (!this.spawned) return { ok: false, error: 'Bot is not in the world' };
    this.afk.touch();
    return this.chat.send(payload, this.config.limits.chatMaxLength);
  }

  /** Sends /login or /register. The password is passed straight through and never stored or logged. */
  authenticate({ mode, password }) {
    if (!this.spawned || !this.bot) return { ok: false, error: 'Bot is not in the world' };
    if (Date.now() - this.lastAuthCommandAt < 2000) return { ok: false, error: 'Please wait a moment before trying again' };
    this.lastAuthCommandAt = Date.now();
    try {
      this.bot.chat(mode === 'register' ? `/register ${password} ${password}` : `/login ${password}`);
    } catch (err) {
      return { ok: false, error: `Could not send command: ${err.message}` };
    }
    this.afk.touch();
    this._setAuth('command_sent');
    this.logger.info('connection', `Sent /${mode} command (credentials hidden)`);
    return { ok: true };
  }

  setIdle(enabled) {
    this.afk.setManualIdle(enabled);
    this.movement.setLocked(enabled);
    this.camera.setLocked(enabled);
    this.actions.setLocked(enabled);
    this.invControl.setLocked(enabled);
    if (enabled) this.emit('controls', this.movement.snapshot());
    this.logger.info('system', enabled ? 'Manual idle mode enabled' : 'Manual idle mode disabled');
    return { ok: true };
  }

  shutdown() {
    clearTimeout(this.reconnectTimer);
    this.afk.destroy();
    if (this.bot) {
      this.intentional = true;
      try { this.bot.end('Dashboard shutting down'); } catch (_) { /* ignore */ }
    }
    this._teardown();
  }
}

module.exports = BotManager;
module.exports.flattenReason = flattenReason;
