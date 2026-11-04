'use strict';

/**
 * End-to-end test of the dashboard backend using a fake Mineflayer bot, so it
 * runs offline. Starts the real HTTP + Socket.IO server on loopback and drives
 * it with a real Socket.IO client. Run with: npm test
 */
const EventEmitter = require('events');
const http = require('http');
const { io: connect } = require('socket.io-client');

const baseConfig = require('../src/config');
const { Logger } = require('../src/utils/logger');
const BotManager = require('../src/bot/BotManager');
const createServer = require('../src/server/app');

const PORT = 39000 + Math.floor(Math.random() * 900);
const config = { ...baseConfig, dashboard: { host: '127.0.0.1', port: PORT } };
const SECRET = 'S3cret!pw-9271';

let passed = 0; let failed = 0;
const check = (name, cond, extra = '') => {
  if (cond) { passed += 1; console.log(`  ✓ ${name}`); } else { failed += 1; console.log(`  ✗ ${name} ${extra}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const section = (t) => console.log(`\n${t}`);

const { makeFakeBot: rawMakeFakeBot, chatMsg } = require('./fake-bot');

let fakeBot = null;
const makeFakeBot = (opts) => { fakeBot = rawMakeFakeBot(opts); return fakeBot; };

// ------------------------------------------------------------------ helpers
const logger = new Logger(500);
const persisted = [];
const manager = new BotManager({ config, logger, createBot: makeFakeBot, persist: (t) => persisted.push(t) });
const server = createServer({ config, manager, logger });

const rawGet = (headers = {}, path = '/') => new Promise((resolve, reject) => {
  const req = http.request({ host: '127.0.0.1', port: PORT, path, headers, method: 'GET' }, (res) => {
    let body = ''; res.on('data', (d) => { body += d; }); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
  });
  req.on('error', reject); req.end();
});

function waitFor(socket, event, predicate = () => true, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(event, handler); reject(new Error(`timeout waiting for ${event}`)); }, timeout);
    function handler(data) { if (predicate(data)) { clearTimeout(timer); socket.off(event, handler); resolve(data); } }
    socket.on(event, handler);
  });
}
const ask = (socket, event, payload) => new Promise((resolve) => {
  const t = setTimeout(() => resolve({ ok: false, error: 'NO ACK' }), 3000);
  const cb = (res) => { clearTimeout(t); resolve(res); };
  if (payload === undefined) socket.emit(event, cb); else socket.emit(event, payload, cb);
});

async function main() {
  const address = await server.start();
  section('HTTP server');
  check('binds to loopback only', address.address === '127.0.0.1', address.address);

  const page = await rawGet({ host: `127.0.0.1:${PORT}` });
  check('serves the dashboard page', page.status === 200 && page.body.includes('ENDER CONTROL'));
  check('sends a Content-Security-Policy', /default-src 'self'/.test(page.headers['content-security-policy'] || ''));
  for (const p of ['/favicon.ico', '/apple-touch-icon.png', '/img/logo-mark.png', '/img/dev-avatar.png', '/img/logo.jpg', '/css/theme.css', '/css/layout.css', '/css/components.css', '/js/main.js', '/js/modules/chat.js', '/socket.io/socket.io.js']) {
    const r = await rawGet({ host: `127.0.0.1:${PORT}` }, p);
    check(`serves ${p}`, r.status === 200);
  }
  const evil = await rawGet({ host: 'evil.example.com' });
  check('rejects a foreign Host header (DNS rebinding)', evil.status === 403);
  const missing = await rawGet({ host: `127.0.0.1:${PORT}` }, '/nope');
  check('404 for unknown paths', missing.status === 404);

  section('Socket security');
  const bad = connect(`http://127.0.0.1:${PORT}`, { extraHeaders: { Origin: 'http://evil.example.com' }, transports: ['polling'], reconnection: false });
  const rejected = await new Promise((resolve) => { bad.on('connect', () => resolve(false)); bad.on('connect_error', () => resolve(true)); setTimeout(() => resolve(false), 3000); });
  bad.close();
  check('rejects cross-origin socket connections', rejected);

  const s = connect(`http://127.0.0.1:${PORT}`, { transports: ['websocket'], reconnection: false });
  const init = await waitFor(s, 'init');
  check('receives init state on connect', init && init.status && init.status.state === 'disconnected');
  check('target is play.digitalvigital.fun:25616 / 1.21.11 / Ender',
    init.status.target.host === 'play.digitalvigital.fun' && init.status.target.port === 25616
    && init.status.target.version === '1.21.11' && init.status.target.username === 'Ender');

  section('Validation (bot offline)');
  check('movement refused while disconnected', (await ask(s, 'move:set', { control: 'forward', state: true })).ok === false);
  check('chat refused while disconnected', (await ask(s, 'chat:send', { message: 'hi' })).ok === false);
  check('rejects unknown control', (await ask(s, 'move:set', { control: 'fly', state: true })).ok === false);
  check('rejects non-boolean state', (await ask(s, 'move:set', { control: 'forward', state: 'yes' })).ok === false);
  check('rejects null payload', (await ask(s, 'move:set', null)).ok === false);
  check('rejects NaN camera delta', (await ask(s, 'camera:rotate', { dyaw: 'a', dpitch: 1 })).ok === false);
  check('clicks refused while disconnected', (await ask(s, 'action:attack')).ok === false && (await ask(s, 'action:use')).ok === false);
  check('rejects disconnect when not connected', (await ask(s, 'bot:disconnect')).ok === false);

  section('Connection settings (bot offline)');
  const defaultsTarget = { host: init.status.target.host, port: init.status.target.port, username: init.status.target.username };
  check('status exposes the defaults', init.status.defaults && init.status.defaults.host === 'play.digitalvigital.fun' && init.status.defaults.port === 25616 && init.status.defaults.username === 'Ender');
  for (const [label, payload] of [
    ['url instead of hostname', { host: 'http://example.com', port: 25565, username: 'Ender' }],
    ['host containing a port', { host: 'example.com:25565', port: 25565, username: 'Ender' }],
    ['host with spaces', { host: 'my server.com', port: 25565, username: 'Ender' }],
    ['empty host', { host: '', port: 25565, username: 'Ender' }],
    ['port 0', { host: 'example.com', port: 0, username: 'Ender' }],
    ['port 65536', { host: 'example.com', port: 65536, username: 'Ender' }],
    ['non-numeric port', { host: 'example.com', port: 'abc', username: 'Ender' }],
    ['fractional port', { host: 'example.com', port: 25565.5, username: 'Ender' }],
    ['username too short', { host: 'example.com', port: 25565, username: 'ab' }],
    ['username too long', { host: 'example.com', port: 25565, username: 'a'.repeat(17) }],
    ['username with a space', { host: 'example.com', port: 25565, username: 'bad name' }],
    ['username with a section sign', { host: 'example.com', port: 25565, username: 'ab\u00a7c' }],
    ['non-object payload', 'example.com'],
  ]) {
    check(`rejects ${label}`, (await ask(s, 'settings:set', payload)).ok === false);
  }
  check('rejected edits changed nothing', manager.getStatus().target.host === defaultsTarget.host && persisted.length === 0);
  const changedP = waitFor(s, 'bot:status', (x) => x.target.username === 'Bot_One');
  const saved = await ask(s, 'settings:set', { host: ' Mc.Example.COM ', port: '25570', username: 'Bot_One' });
  check('valid settings accepted', saved.ok === true, JSON.stringify(saved));
  const changed = await changedP;
  check('host is trimmed + lower-cased, port is a number', changed.target.host === 'mc.example.com' && changed.target.port === 25570);
  check('status broadcast to dashboards', changed.target.username === 'Bot_One');
  check('only host / port / username are persisted', persisted.length === 1 && JSON.stringify(Object.keys(persisted[0]).sort()) === JSON.stringify(['host', 'port', 'username']));
  check('IPv4 addresses are accepted', (await ask(s, 'settings:set', { host: '192.168.1.20', port: 25565, username: 'Ender' })).ok === true);
  check('localhost is accepted', (await ask(s, 'settings:set', { host: 'localhost', port: 25565, username: 'Ender' })).ok === true);
  check('restore the default target', (await ask(s, 'settings:set', defaultsTarget)).ok === true && manager.getStatus().target.host === 'play.digitalvigital.fun');

  section('Connection lifecycle');
  const connectedP = waitFor(s, 'bot:status', (st) => st.state === 'connected');
  const r1 = await ask(s, 'bot:connect');
  check('connect accepted', r1.ok === true);
  const dup = await ask(s, 'bot:connect');
  check('duplicate connect is refused', dup.ok === false, JSON.stringify(dup));
  const st = await connectedP;
  check('reaches connected + spawned', st.state === 'connected' && st.spawned === true);
  check('tracks connection duration', typeof st.connectedSince === 'number');
  check('settings cannot be changed while connected', (await ask(s, 'settings:set', { host: 'example.com', port: 25565, username: 'Other' })).ok === false && manager.getStatus().target.username === 'Ender');
  check('reports server info', st.server && st.server.maxPlayers === 20 && st.server.ping === 42 && st.server.gameMode === 'survival');

  section('Player + inventory');
  const player = await waitFor(s, 'player:update');
  check('position reported', player.position.x === 10.5 && player.position.y === 64 && player.position.z === -20.25);
  check('health / hunger / xp reported', player.health === 20 && player.food === 18 && player.xpLevel === 7);
  check('dimension normalised', player.dimension === 'The Nether');
  check('status reported', player.status === 'Standing');
  fakeBot.inventory.emit('updateSlot');
  const inv = await waitFor(s, 'inventory:update');
  check('inventory main slot', inv.main[0] && inv.main[0].name === 'cobblestone' && inv.main[0].count === 64);
  check('inventory hotbar + held item', inv.hotbar[0].name === 'diamond_sword' && inv.held.name === 'diamond_sword');
  check('armor slots', inv.armor[0].label === 'Helmet' && inv.armor[0].item.name === 'iron_helmet');
  check('durability reported', inv.held.durability && inv.held.durability.max === 1561);

  section('Movement');
  const cu = waitFor(s, 'controls:update');
  check('forward on', (await ask(s, 'move:set', { control: 'forward', state: true })).ok === true);
  check('controls broadcast', (await cu).forward === true);
  check('bot received control state', fakeBot.controls.forward === true);
  for (const c of ['back', 'left', 'right', 'jump', 'sprint', 'sneak']) await ask(s, 'move:set', { control: c, state: true });
  check('all seven controls reach the bot', ['forward', 'back', 'left', 'right', 'jump', 'sprint', 'sneak'].every((c) => fakeBot.controls[c] === true));
  check('stop clears everything', (await ask(s, 'move:stop')).ok === true && Object.values(fakeBot.controls).every((v) => v === false));

  section('Camera');
  check('rotate accepted', (await ask(s, 'camera:rotate', { dyaw: 30, dpitch: -10 })).ok === true);
  await sleep(20);
  check('yaw / pitch changed', Math.abs(fakeBot.entity.yaw - (30 * Math.PI) / 180) < 1e-9 && Math.abs(fakeBot.entity.pitch + (10 * Math.PI) / 180) < 1e-9);
  check('pitch clamps at straight up', (await ask(s, 'camera:set', { yaw: 0, pitch: 500 })).ok === true && Math.abs(fakeBot.entity.pitch - Math.PI / 2) < 1e-9);
  check('reset', (await ask(s, 'camera:reset')).ok === true && fakeBot.entity.yaw === 0 && fakeBot.entity.pitch === 0);


  section('Clicks');
  fakeBot.cursorEntity = { username: 'Zombie' };
  const hit = await ask(s, 'action:attack');
  check('left click attacks the entity under the crosshair', hit.ok === true && /Attacked Zombie/.test(hit.info) && fakeBot.attacked.length === 1, JSON.stringify(hit));
  const spam = await ask(s, 'action:attack');
  check('attack spam hits the cooldown', spam.ok === false && /cooldown/i.test(spam.error), JSON.stringify(spam));
  await sleep(600);
  fakeBot.cursorEntity = null;
  const swing = await ask(s, 'action:attack');
  check('left click with nothing in reach swings the arm', swing.ok === true && /Swung/.test(swing.info) && fakeBot.swings === 1);
  const noBlock = await ask(s, 'action:dig', { state: true });
  check('break needs a block under the crosshair', noBlock.ok === false && /No block/.test(noBlock.error));
  fakeBot.cursorBlock = { name: 'stone', displayName: 'Stone', face: 1 };
  const dig = await ask(s, 'action:dig', { state: true });
  check('hold-to-break starts digging without moving the camera', dig.ok === true && /Breaking Stone/.test(dig.info) && fakeBot.digCalls.length === 1 && fakeBot.digCalls[0][1] === 'ignore', JSON.stringify(dig));
  check('second dig press does not start a duplicate dig', (await ask(s, 'action:dig', { state: true })).ok === true && fakeBot.digCalls.length === 1);
  check('releasing stops digging', (await ask(s, 'action:dig', { state: false })).ok === true && fakeBot.stopDigs >= 1);
  check('dig rejects non-boolean state', (await ask(s, 'action:dig', { state: 'yes' })).ok === false);
  fakeBot.cursorBlock = null;
  await sleep(1300); // let the click rate limiter refill
  const useItem = await ask(s, 'action:use');
  check('right click with no block uses the held item', useItem.ok === true && fakeBot.itemUses === 1 && /Used Diamond Sword/.test(useItem.info), JSON.stringify(useItem));
  fakeBot.cursorBlock = { name: 'stone', displayName: 'Stone', face: 1 };
  const act = await ask(s, 'action:use');
  check('right click on a block with a non-block item interacts', act.ok === true && fakeBot.activated.includes('stone'), JSON.stringify(act));
  fakeBot.heldItem = { name: 'cobblestone', displayName: 'Cobblestone', count: 64 };
  await sleep(220);
  const place = await ask(s, 'action:use');
  check('right click with a block item places it on the clicked face', place.ok === true && fakeBot.placed.length === 1 && fakeBot.placed[0].join() === 'stone,0,1,0', JSON.stringify([place, fakeBot.placed]));
  fakeBot.cursorBlock = { name: 'chest', displayName: 'Chest', face: 1 };
  await sleep(220);
  await ask(s, 'action:use');
  check('right click on a chest opens it instead of placing', fakeBot.activated.includes('chest') && fakeBot.placed.length === 1);
  fakeBot.heldItem = fakeBot.inventory.slots[36];
  fakeBot.cursorBlock = null;
  const clickBurst = await Promise.all(Array.from({ length: 14 }, () => ask(s, 'action:use')));
  check('click events are rate limited', clickBurst.some((r) => r.ok === false && /Too many/.test(r.error)));
  await sleep(1300);

  section('Chat');
  const incoming = fakeBot.sent.length === 0 ? await waitFor(s, 'chat:message', (m) => m.text.includes('hello Ender')).catch(() => null) : null;
  const hist = logger.history().filter((e) => e.category === 'chat');
  check('incoming chat captured', Boolean(incoming) || hist.some((e) => e.message.includes('hello Ender')));
  if (incoming) check('colour codes preserved for rendering', incoming.motd.startsWith('§a'));
  await sleep(700);
  check('send message', (await ask(s, 'chat:send', { message: 'hello world' })).ok === true && fakeBot.sent.includes('hello world'));
  await sleep(700);
  const sanitized = await ask(s, 'chat:send', { message: 'a\u0000b§c\n d' });
  check('control chars / section signs stripped', sanitized.ok === true && fakeBot.sent.includes('abc d'), JSON.stringify(fakeBot.sent.slice(-2)));
  await sleep(700);
  const long = await ask(s, 'chat:send', { message: 'x'.repeat(1000) });
  check('over-long message truncated to 256', long.ok === true && fakeBot.sent[fakeBot.sent.length - 1].length === 256);
  await sleep(700);
  const blocked = await ask(s, 'chat:send', { message: '/login hunter2' });
  check('/login blocked in chat box', blocked.ok === false && !fakeBot.sent.some((m) => m.includes('hunter2')));
  await sleep(700);
  const blocked2 = await ask(s, 'chat:send', { message: '/REGISTER abc abc' });
  check('/register (any case) blocked in chat box', blocked2.ok === false);
  await sleep(700);
  check('other commands allowed', (await ask(s, 'chat:send', { message: '/help' })).ok === true && fakeBot.sent.includes('/help'));
  const burst = await Promise.all(Array.from({ length: 8 }, () => ask(s, 'chat:send', { message: 'spam' })));
  check('chat is rate limited', burst.some((r) => r.ok === false && /Too many/.test(r.error)));
  check('chat clear works', (await ask(s, 'chat:clear')).ok === true && manager.chat.history().length === 0);

  section('Inventory control');
  await sleep(1300); // let earlier rate limiters refill
  fakeBot.inventory.slots[37] = { name: 'iron_chestplate', displayName: 'Iron Chestplate', count: 1, type: 99 };
  fakeBot.inventory.slots[38] = { name: 'torch', displayName: 'Torch', count: 12, type: 50 };
  check('select hotbar slot', (await ask(s, 'inv:select', { slot: 2 })).ok === true && fakeBot.quickBarSlot === 2);
  check('select rejects slot 9', (await ask(s, 'inv:select', { slot: 9 })).ok === false);
  check('select rejects non-integer', (await ask(s, 'inv:select', { slot: 1.5 })).ok === false);
  fakeBot.setQuickBarSlot(0);
  check('equip chestplate auto-picks torso', (await ask(s, 'inv:equip', { slot: 37 })).ok === true && fakeBot.invCalls.some((c) => c[0] === 'equip' && c[1] === 'iron_chestplate' && c[2] === 'torso'));
  check('equip torch to off-hand', (await ask(s, 'inv:equip', { slot: 38, destination: 'off-hand' })).ok === true && fakeBot.invCalls.some((c) => c[0] === 'equip' && c[1] === 'torch' && c[2] === 'off-hand'));
  check('equip sword auto-picks hand', (await ask(s, 'inv:equip', { slot: 36 })).ok === true && fakeBot.invCalls.some((c) => c[0] === 'equip' && c[1] === 'diamond_sword' && c[2] === 'hand'));
  check('equip rejects empty slot', (await ask(s, 'inv:equip', { slot: 44 })).ok === false);
  check('equip rejects bad destination', (await ask(s, 'inv:equip', { slot: 36, destination: 'tail' })).ok === false);
  check('equip rejects out-of-range slot', (await ask(s, 'inv:equip', { slot: 99 })).ok === false);
  await sleep(900);
  check('drop one uses a window drop click', (await ask(s, 'inv:drop', { slot: 38, stack: false })).ok === true && fakeBot.invCalls.some((c) => c[0] === 'click' && c[1] === 38 && c[2] === 0 && c[3] === 4));
  check('drop stack uses a window drop click (button 1)', (await ask(s, 'inv:drop', { slot: 38, stack: true })).ok === true && fakeBot.invCalls.some((c) => c[0] === 'click' && c[1] === 38 && c[2] === 1 && c[3] === 4));
  check('drop rejects empty slot', (await ask(s, 'inv:drop', { slot: 44, stack: false })).ok === false);
  check('drop rejects non-boolean stack', (await ask(s, 'inv:drop', { slot: 38, stack: 'x' })).ok === false);
  await sleep(900);
  check('move swaps two slots', (await ask(s, 'inv:move', { from: 9, to: 40 })).ok === true && fakeBot.inventory.slots[40] && fakeBot.inventory.slots[40].name === 'cobblestone');
  check('move rejects same slot', (await ask(s, 'inv:move', { from: 9, to: 9 })).ok === false);
  check('move rejects empty source', (await ask(s, 'inv:move', { from: 44, to: 10 })).ok === false);
  check('move rejects crafting-grid / invalid slots', (await ask(s, 'inv:move', { from: 1, to: 10 })).ok === false);
  check('unequip armor slot', (await ask(s, 'inv:unequip', { slot: 5 })).ok === true && fakeBot.invCalls.some((c) => c[0] === 'unequip' && c[1] === 'head'));
  check('unequip rejects a normal slot', (await ask(s, 'inv:unequip', { slot: 20 })).ok === false);
  fakeBot.inventory.slots[9] = fakeBot.inventory.slots[40]; fakeBot.inventory.slots[40] = null;
  const burstInv = await Promise.all(Array.from({ length: 14 }, () => ask(s, 'inv:select', { slot: 1 })));
  check('inventory actions are rate limited', burstInv.some((r) => r.ok === false && /Too many/.test(r.error)));
  await sleep(1500);
  await ask(s, 'idle:set', { enabled: true });
  check('inventory control blocked in idle mode', (await ask(s, 'inv:select', { slot: 1 })).ok === false && (await ask(s, 'inv:drop', { slot: 36, stack: false })).ok === false);
  await ask(s, 'idle:set', { enabled: false });
  fakeBot.setQuickBarSlot(0);

  section('Authentication');
  check('rejects empty password', (await ask(s, 'auth:submit', { mode: 'login', password: '' })).ok === false);
  check('rejects password with spaces', (await ask(s, 'auth:submit', { mode: 'login', password: 'a b' })).ok === false);
  check('rejects bad mode', (await ask(s, 'auth:submit', { mode: 'sudo', password: 'abc' })).ok === false);
  const a1 = await ask(s, 'auth:submit', { mode: 'login', password: SECRET });
  check('login command sent', a1.ok === true && fakeBot.sent.includes(`/login ${SECRET}`));
  const a2 = await ask(s, 'auth:submit', { mode: 'register', password: SECRET });
  check('rapid second attempt throttled', a2.ok === false);
  check('login status updated', manager.getStatus().authStatus === 'command_sent');
  const dump = JSON.stringify([logger.history(), manager.chat.history(), manager.getStatus(), manager.getPlayer()]);
  check('password never appears in logs / chat / state', !dump.includes(SECRET));
  check('log notes the command with credentials hidden', logger.history().some((e) => /credentials hidden/.test(e.message)));
  fakeBot.emit('message', chatMsg('You have successfully logged in!'), 'system');
  await sleep(50);
  check('server login confirmation detected', manager.getStatus().authStatus === 'authenticated');

  section('AFK / idle');
  check('starts active', manager.afk.snapshot().status === 'active');
  check('idle on', (await ask(s, 'idle:set', { enabled: true })).ok === true && manager.afk.snapshot().status === 'idle');
  check('movement blocked in idle mode', (await ask(s, 'move:set', { control: 'forward', state: true })).ok === false);
  check('camera blocked in idle mode', (await ask(s, 'camera:rotate', { dyaw: 5, dpitch: 0 })).ok === false);
  fakeBot.cursorEntity = { username: 'Zombie' };
  check('clicks blocked in idle mode', (await ask(s, 'action:attack')).ok === false && (await ask(s, 'action:use')).ok === false);
  check('idle rejects non-boolean', (await ask(s, 'idle:set', { enabled: 'x' })).ok === false);
  check('idle off', (await ask(s, 'idle:set', { enabled: false })).ok === true);
  check('movement works again', (await ask(s, 'move:set', { control: 'forward', state: true })).ok === true);
  await ask(s, 'move:stop');
  manager.afk.lastInput = Date.now() - config.bot.afkThresholdMs - 1000;
  check('AFK indicator after long inactivity (passive only)', manager.afk.snapshot().status === 'afk');
  manager.afk.touch();

  section('Logs');
  check('connection logs recorded', logger.history().some((e) => e.category === 'connection'));
  check('log clear (category) works', (await ask(s, 'log:clear', { category: 'chat' })).ok === true && !logger.history().some((e) => e.category === 'chat'));
  check('log clear rejects bad category', (await ask(s, 'log:clear', { category: 'secrets' })).ok === false);

  section('Unexpected disconnect / reconnect');
  const notifyP = waitFor(s, 'notify', (n) => /Kicked/.test(n.title));
  const endedP = waitFor(s, 'bot:status', (x) => x.state === 'disconnected');
  fakeBot.emit('kicked', JSON.stringify({ text: 'You are banned', extra: [{ text: ' (test)' }] }));
  fakeBot.emit('end', 'kicked');
  const ended = await endedP;
  check('kick handled without crashing', ended.state === 'disconnected');
  check('kick reason captured', ended.lastDisconnect && ended.lastDisconnect.kind === 'kicked' && ended.lastDisconnect.reason === 'You are banned (test)', JSON.stringify(ended.lastDisconnect));
  check('kick notification sent', Boolean(await notifyP));
  check('controls reset after disconnect', Object.values(manager.movement.snapshot()).every((v) => v === false));
  manager.lastAttemptAt = Date.now(); // pretend an attempt just happened
  const tooSoon = await ask(s, 'bot:connect');
  check('immediate reconnect respects cooldown', tooSoon.ok === false && /wait/i.test(tooSoon.error), JSON.stringify(tooSoon));
  const back = waitFor(s, 'bot:status', (x) => x.state === 'connected', 12000);
  check('reconnect scheduled', (await ask(s, 'bot:reconnect')).ok === true);
  check('second reconnect refused while one is pending', (await ask(s, 'bot:reconnect')).ok === false);
  check('reconnect brings the bot back', (await back).state === 'connected');

  section('Disconnect');
  const downP = waitFor(s, 'bot:status', (x) => x.state === 'disconnected');
  check('disconnect accepted', (await ask(s, 'bot:disconnect')).ok === true);
  const down = await downP;
  check('manual disconnect recorded', down.lastDisconnect && down.lastDisconnect.kind === 'manual');
  check('no uptime after disconnect', down.connectedSince === null);

  section('Failure handling');
  const failManager = new BotManager({ config, logger: new Logger(50), createBot: () => { throw new Error('boom'); } });
  const failRes = failManager.connect();
  check('createBot failure handled', failRes.ok === false && failManager.state === 'disconnected');
  failManager.shutdown();
  const refused = new BotManager({ config, logger: new Logger(50), createBot: () => { const b = new EventEmitter(); b.end = () => {}; setImmediate(() => { const e = new Error('x'); e.code = 'ECONNREFUSED'; b.emit('error', e); b.emit('end', 'error'); }); return b; } });
  const seen = []; refused.on('notify', (n) => seen.push(n));
  refused.connect(); await sleep(100);
  check('ECONNREFUSED gives a friendly message', refused.state === 'disconnected' && /offline or the port is wrong/.test(refused.lastError || ''), refused.lastError);
  check('error notification emitted', seen.some((n) => n.level === 'error'));
  refused.shutdown();

  section('Settings file');
  const fs = require('fs'); const os = require('os'); const path = require('path');
  const { loadSettings, saveSettings } = require('../src/utils/settings');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ender-settings-'));
  const file = path.join(dir, 'nested', 'settings.json');
  check('missing file falls back to defaults', loadSettings(file) === null);
  saveSettings(file, { host: 'mc.example.com', port: 25570, username: 'Bot_One', password: 'must-not-be-saved', version: '1.8' });
  const onDisk = fs.readFileSync(file, 'utf8');
  check('save + load round-trips', JSON.stringify(loadSettings(file)) === JSON.stringify({ host: 'mc.example.com', port: 25570, username: 'Bot_One' }));
  check('nothing but host / port / username is written', !onDisk.includes('must-not-be-saved') && !onDisk.includes('1.8'));
  fs.writeFileSync(file, '{ not json');
  check('corrupt file falls back to defaults', loadSettings(file) === null);
  fs.writeFileSync(file, JSON.stringify({ host: 'bad host!', port: 1, username: 'Ender' }));
  check('invalid saved values are ignored', loadSettings(file) === null);
  fs.rmSync(dir, { recursive: true, force: true });

  s.close();
  manager.shutdown();
  await server.stop();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => { console.error('\nTest run crashed:', err); process.exit(1); });
