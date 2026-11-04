'use strict';

/**
 * Validation / sanitising helpers for every payload that arrives from the
 * browser. Each validator returns { ok: true, value } or { ok: false, error }.
 */

const CONTROLS = Object.freeze(['forward', 'back', 'left', 'right', 'jump', 'sprint', 'sneak']);

// Control characters, DEL, and the Minecraft formatting character.
// eslint-disable-next-line no-control-regex
const UNSAFE_CHARS = /[\u0000-\u001f\u007f§]/g;

const AUTH_COMMANDS = new Set([
  'login', 'l', 'register', 'reg', 'changepassword', 'changepass', 'unregister', 'passwd',
]);

const ok = (value) => ({ ok: true, value });
const fail = (error) => ({ ok: false, error });

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isFiniteNumber = (v) => typeof v === 'number' && Number.isFinite(v);

function sanitizeText(input, maxLength) {
  return String(input).replace(UNSAFE_CHARS, '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function validateChatMessage(payload, maxLength) {
  if (!isPlainObject(payload) || typeof payload.message !== 'string') return fail('Invalid chat payload');
  const message = sanitizeText(payload.message, maxLength);
  if (!message) return fail('Message is empty');
  if (message.startsWith('/')) {
    const cmd = message.slice(1).split(' ')[0].toLowerCase();
    if (AUTH_COMMANDS.has(cmd)) {
      return fail('Authentication commands are blocked in chat - use the Authentication page');
    }
  }
  return ok(message);
}

function validateMovement(payload) {
  if (!isPlainObject(payload)) return fail('Invalid payload');
  if (!CONTROLS.includes(payload.control)) return fail('Unknown control');
  if (typeof payload.state !== 'boolean') return fail('State must be boolean');
  return ok({ control: payload.control, state: payload.state });
}

function validateCameraRotate(payload) {
  if (!isPlainObject(payload)) return fail('Invalid payload');
  if (!isFiniteNumber(payload.dyaw) || !isFiniteNumber(payload.dpitch)) return fail('Deltas must be numbers');
  const clamp = (n) => Math.max(-90, Math.min(90, n));
  return ok({ dyaw: clamp(payload.dyaw), dpitch: clamp(payload.dpitch) });
}

function validateCameraSet(payload) {
  if (!isPlainObject(payload)) return fail('Invalid payload');
  if (!isFiniteNumber(payload.yaw) || !isFiniteNumber(payload.pitch)) return fail('Yaw/pitch must be numbers');
  return ok({
    yaw: Math.max(-180, Math.min(180, payload.yaw)),
    pitch: Math.max(-90, Math.min(90, payload.pitch)),
  });
}

function validateAuth(payload, maxPassword) {
  if (!isPlainObject(payload)) return fail('Invalid payload');
  if (payload.mode !== 'login' && payload.mode !== 'register') return fail('Mode must be login or register');
  const { password } = payload;
  if (typeof password !== 'string' || password.length < 1) return fail('Password is required');
  if (password.length > maxPassword) return fail('Password is too long');
  if (/[\s\u0000-\u001f\u007f§]/.test(password)) {
    return fail('Password cannot contain spaces or control characters');
  }
  return ok({ mode: payload.mode, password });
}

function validateBoolean(payload, key) {
  if (!isPlainObject(payload) || typeof payload[key] !== 'boolean') return fail(`"${key}" must be boolean`);
  return ok(payload[key]);
}

function validateLogCategory(payload, categories) {
  if (payload === undefined || payload === null) return ok(null);
  if (!isPlainObject(payload)) return fail('Invalid payload');
  if (payload.category === undefined || payload.category === null || payload.category === 'all') return ok(null);
  if (!categories.includes(payload.category)) return fail('Unknown log category');
  return ok(payload.category);
}


const DESTINATIONS = ['auto', 'hand', 'off-hand', 'head', 'torso', 'legs', 'feet'];
const isSlot = (n) => Number.isInteger(n) && n >= 5 && n <= 45; // armor 5-8, main 9-35, hotbar 36-44, off-hand 45

function validateInvSelect(payload) {
  if (!isPlainObject(payload) || !Number.isInteger(payload.slot) || payload.slot < 0 || payload.slot > 8) {
    return fail('Hotbar slot must be 0-8');
  }
  return ok(payload.slot);
}

function validateInvEquip(payload) {
  if (!isPlainObject(payload) || !isSlot(payload.slot)) return fail('Invalid inventory slot');
  const destination = payload.destination === undefined ? 'auto' : payload.destination;
  if (!DESTINATIONS.includes(destination)) return fail('Unknown equip destination');
  return ok({ slot: payload.slot, destination });
}

function validateInvSlot(payload) {
  if (!isPlainObject(payload) || !isSlot(payload.slot)) return fail('Invalid inventory slot');
  return ok(payload.slot);
}

function validateInvDrop(payload) {
  if (!isPlainObject(payload) || !isSlot(payload.slot)) return fail('Invalid inventory slot');
  if (payload.stack !== undefined && typeof payload.stack !== 'boolean') return fail('"stack" must be boolean');
  return ok({ slot: payload.slot, stack: Boolean(payload.stack) });
}

function validateInvMove(payload) {
  if (!isPlainObject(payload) || !isSlot(payload.from) || !isSlot(payload.to)) return fail('Invalid inventory slot');
  return ok({ from: payload.from, to: payload.to });
}


const HOST_RE = /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/;
const USERNAME_RE = /^[A-Za-z0-9_]{3,16}$/;

/** Connection target edited from the dashboard: hostname / IPv4, port, username. */
function validateSettings(payload) {
  if (!isPlainObject(payload)) return fail('Invalid payload');
  if (typeof payload.host !== 'string') return fail('Server address is required');
  const host = payload.host.trim().toLowerCase();
  if (!HOST_RE.test(host)) return fail('Server address must be a hostname or IPv4 address (no http://, spaces or port)');
  const raw = typeof payload.port === 'string' ? payload.port.trim() : payload.port;
  const port = typeof raw === 'string' && /^\d{1,5}$/.test(raw) ? Number(raw) : raw;
  if (!Number.isInteger(port) || port < 1 || port > 65535) return fail('Port must be a whole number from 1 to 65535');
  const username = typeof payload.username === 'string' ? payload.username.trim() : '';
  if (!USERNAME_RE.test(username)) return fail('Username must be 3-16 characters: letters, numbers or underscore');
  return ok({ host, port, username });
}

/**
 * Simple token-bucket rate limiter. `ratePerSecond` tokens refill every
 * second up to `burst` (defaults to the rate). One instance per socket + group.
 */
function createLimiter(ratePerSecond, burst = Math.max(1, ratePerSecond)) {
  let tokens = burst;
  let last = Date.now();
  return function allow() {
    const now = Date.now();
    tokens = Math.min(burst, tokens + ((now - last) / 1000) * ratePerSecond);
    last = now;
    if (tokens < 1) return false;
    tokens -= 1;
    return true;
  };
}

module.exports = {
  CONTROLS,
  sanitizeText,
  validateChatMessage,
  validateMovement,
  validateCameraRotate,
  validateCameraSet,
  validateAuth,
  validateBoolean,
  validateLogCategory,
  validateInvSelect,
  validateInvEquip,
  validateInvSlot,
  validateInvDrop,
  validateInvMove,
  validateSettings,
  createLimiter,
};
