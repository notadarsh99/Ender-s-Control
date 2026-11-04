'use strict';

const { CATEGORIES } = require('../utils/logger');
const v = require('../utils/validate');

/**
 * Socket.IO layer. Every inbound event is rate limited, validated and
 * acknowledged with { ok, error? }. Nothing from the browser is trusted.
 */
function registerSockets(io, manager, logger, config) {
  // ---- broadcast bot -> browsers -------------------------------------------
  manager.on('status', (s) => io.emit('bot:status', s));
  manager.on('player', (p) => io.emit('player:update', p));
  manager.on('inventory', (i) => io.emit('inventory:update', i));
  manager.on('chat', (m) => io.emit('chat:message', m));
  manager.on('chatCleared', () => io.emit('chat:cleared'));
  manager.on('notify', (n) => io.emit('notify', n));
  manager.on('afk', (a) => io.emit('afk:update', a));
  manager.on('controls', (c) => io.emit('controls:update', c));
  logger.on('entry', (e) => io.emit('log:entry', e));
  logger.on('cleared', (category) => io.emit('log:cleared', { category }));

  io.on('connection', (socket) => {
    const limit = {
      control: v.createLimiter(40),
      camera: v.createLimiter(60),
      chat: v.createLimiter(2),
      lifecycle: v.createLimiter(1, 4),
      auth: v.createLimiter(0.5, 5), // slow refill: protects server login limits
      misc: v.createLimiter(10),
      action: v.createLimiter(5, 6),
      inventory: v.createLimiter(6, 8),
      settings: v.createLimiter(2, 20), // cheap, validated, local-only form
    };

    /** Wraps a handler with rate limiting + ack handling. */
    const on = (event, limiter, handler) => {
      socket.on(event, (...args) => {
        // The client may send (payload, ack) or just (ack).
        const reply = typeof args[args.length - 1] === 'function' ? args.pop() : () => {};
        const payload = args[0];
        if (!limiter()) return reply({ ok: false, error: 'Too many requests - slow down' });
        try {
          return handler(payload, reply);
        } catch (err) {
          logger.error('error', `Handler error for ${event}: ${err.message}`);
          return reply({ ok: false, error: 'Internal error' });
        }
      });
    };

    // Initial state for the freshly opened dashboard.
    socket.emit('init', {
      status: manager.getStatus(),
      player: manager.getPlayer(),
      inventory: manager.getInventory(),
      chat: manager.chat.history(),
      logs: logger.history(),
      afk: manager.afk.snapshot(),
      controls: manager.movement.snapshot(),
    });

    // ---- lifecycle ---------------------------------------------------------
    on('bot:connect', limit.lifecycle, (_p, ack) => ack(manager.connect()));
    on('bot:disconnect', limit.lifecycle, (_p, ack) => ack(manager.disconnect()));
    on('bot:reconnect', limit.lifecycle, (_p, ack) => ack(manager.reconnect()));

    // ---- movement ----------------------------------------------------------
    on('move:set', limit.control, (payload, ack) => {
      const r = v.validateMovement(payload);
      if (!r.ok) return ack(r);
      return ack(manager.setControl(r.value.control, r.value.state));
    });
    on('move:stop', limit.control, (_p, ack) => ack(manager.stopMovement()));

    // ---- camera ------------------------------------------------------------
    on('camera:rotate', limit.camera, (payload, ack) => {
      const r = v.validateCameraRotate(payload);
      if (!r.ok) return ack(r);
      return ack(manager.rotateCamera(r.value.dyaw, r.value.dpitch));
    });
    on('camera:set', limit.camera, (payload, ack) => {
      const r = v.validateCameraSet(payload);
      if (!r.ok) return ack(r);
      return ack(manager.setCamera(r.value.yaw, r.value.pitch));
    });
    on('camera:reset', limit.misc, (_p, ack) => ack(manager.resetCamera()));

    // ---- clicks (left = attack / break, right = use / place) --------------
    on('action:attack', limit.action, (_p, ack) => ack(manager.clickAttack()));
    on('action:dig', limit.action, (payload, ack) => {
      const r = v.validateBoolean(payload, 'state');
      if (!r.ok) return ack(r);
      return ack(manager.clickDig(r.value));
    });
    on('action:use', limit.action, (_p, ack) => {
      Promise.resolve(manager.clickUse()).then(ack, () => ack({ ok: false, error: 'Internal error' }));
    });

    // ---- inventory control ---------------------------------------------------
    const invReply = (promise, ack) => Promise.resolve(promise).then(ack, () => ack({ ok: false, error: 'Internal error' }));
    on('inv:select', limit.inventory, (payload, ack) => {
      const r = v.validateInvSelect(payload);
      return r.ok ? ack(manager.invSelect(r.value)) : ack(r);
    });
    on('inv:equip', limit.inventory, (payload, ack) => {
      const r = v.validateInvEquip(payload);
      return r.ok ? invReply(manager.invEquip(r.value.slot, r.value.destination), ack) : ack(r);
    });
    on('inv:unequip', limit.inventory, (payload, ack) => {
      const r = v.validateInvSlot(payload);
      return r.ok ? invReply(manager.invUnequip(r.value), ack) : ack(r);
    });
    on('inv:drop', limit.inventory, (payload, ack) => {
      const r = v.validateInvDrop(payload);
      return r.ok ? invReply(manager.invDrop(r.value.slot, r.value.stack), ack) : ack(r);
    });
    on('inv:move', limit.inventory, (payload, ack) => {
      const r = v.validateInvMove(payload);
      return r.ok ? invReply(manager.invMove(r.value.from, r.value.to), ack) : ack(r);
    });

    // ---- connection settings ------------------------------------------------
    on('settings:set', limit.settings, (payload, ack) => {
      const r = v.validateSettings(payload);
      if (!r.ok) return ack(r);
      return ack(manager.updateTarget(r.value));
    });

    // ---- chat --------------------------------------------------------------
    on('chat:send', limit.chat, (payload, ack) => ack(manager.sendChat(payload)));
    on('chat:clear', limit.misc, (_p, ack) => {
      manager.chat.clear();
      ack({ ok: true });
    });

    // ---- authentication ------------------------------------------------------
    on('auth:submit', limit.auth, (payload, ack) => {
      const r = v.validateAuth(payload, config.limits.passwordMaxLength);
      if (!r.ok) return ack(r);
      return ack(manager.authenticate(r.value));
    });

    // ---- idle mode -----------------------------------------------------------
    on('idle:set', limit.misc, (payload, ack) => {
      const r = v.validateBoolean(payload, 'enabled');
      if (!r.ok) return ack(r);
      return ack(manager.setIdle(r.value));
    });

    // ---- logs --------------------------------------------------------------
    on('log:clear', limit.misc, (payload, ack) => {
      const r = v.validateLogCategory(payload, CATEGORIES);
      if (!r.ok) return ack(r);
      logger.clear(r.value);
      return ack({ ok: true });
    });
  });
}

module.exports = registerSockets;
