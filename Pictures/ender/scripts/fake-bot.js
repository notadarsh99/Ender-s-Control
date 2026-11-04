'use strict';

/** Fake Mineflayer bot shared by the offline tests (npm test, npm run test:ui). */
const EventEmitter = require('events');

let lastBot = null;
function chatMsg(text) { return { toString: () => text, toMotd: () => `§a${text}` }; }
function makeFakeBot(opts) {
  const bot = new EventEmitter();
  Object.assign(bot, {
    username: opts.username, version: opts.version, sent: [], controls: {},
    entity: { position: { x: 10.5, y: 64, z: -20.25 }, yaw: 0, pitch: 0, onGround: true, isInWater: false },
    health: 20, food: 18, foodSaturation: 5, experience: { level: 7, points: 100, progress: 0.4 },
    game: { dimension: 'minecraft:the_nether', gameMode: 'survival', difficulty: 'normal', maxPlayers: 20 },
    players: { Ender: {}, Steve: {} }, player: { ping: 42 }, time: { timeOfDay: 6000 }, isRaining: false, quickBarSlot: 0,
  });
  const sword = { name: 'diamond_sword', displayName: 'Diamond Sword', count: 1, maxDurability: 1561, durabilityUsed: 100 };
  bot.inventory = new EventEmitter();
  bot.inventory.slots = new Array(46).fill(null);
  bot.inventory.slots[36] = sword;
  bot.inventory.slots[9] = { name: 'cobblestone', displayName: 'Cobblestone', count: 64 };
  bot.inventory.slots[5] = { name: 'iron_helmet', displayName: 'Iron Helmet', count: 1 };
  bot.heldItem = sword;
  bot.setControlState = (c, s) => { bot.controls[c] = s; };
  bot.getControlState = (c) => Boolean(bot.controls[c]);
  Object.assign(bot, { cursorEntity: null, cursorBlock: null, attacked: [], swings: 0, digCalls: [], stopDigs: 0, activated: [], itemUses: 0, placed: [] });
  bot.registry = { blocksByName: { cobblestone: {}, stone: {} } };
  bot.entityAtCursor = () => bot.cursorEntity;
  bot.blockAtCursor = () => bot.cursorBlock;
  bot.attack = (e) => { bot.attacked.push(e); };
  bot.swingArm = () => { bot.swings += 1; };
  bot.dig = (block, mode) => new Promise((resolve) => { bot.digCalls.push([block.name, mode]); bot._digDone = resolve; });
  bot.stopDigging = () => { bot.stopDigs += 1; if (bot._digDone) bot._digDone(); };
  bot.activateBlock = async (b) => { bot.activated.push(b.name); };
  bot.activateItem = () => { bot.itemUses += 1; };
  bot.placeBlock = async (ref, face) => { bot.placed.push([ref.name, face.x, face.y, face.z]); };
  bot.look = async (yaw, pitch) => { bot.entity.yaw = yaw; bot.entity.pitch = pitch; };
  bot.chat = (m) => { bot.sent.push(m); };
  bot.invCalls = [];
  bot.setQuickBarSlot = (n) => { bot.quickBarSlot = n; bot.heldItem = bot.inventory.slots[36 + n]; bot.invCalls.push(['select', n]); };
  bot.equip = async (item, dest) => { bot.invCalls.push(['equip', item.name, dest]); };
  bot.unequip = async (dest) => { bot.invCalls.push(['unequip', dest]); };
  bot.clickWindow = async (slot, button, mode) => { bot.invCalls.push(['click', slot, button, mode]); };
  bot.toss = async (type, meta, count) => { bot.invCalls.push(['toss', type, count]); };
  bot.tossStack = async (item) => { bot.invCalls.push(['tossStack', item.name]); };
  bot.moveSlotItem = async (from, to) => {
    bot.invCalls.push(['move', from, to]);
    const a = bot.inventory.slots[from]; bot.inventory.slots[from] = bot.inventory.slots[to]; bot.inventory.slots[to] = a;
  };
  bot.quit = () => setImmediate(() => bot.emit('end', 'disconnect.quitting'));
  bot.end = bot.quit;
  setImmediate(() => {
    bot.emit('login');
    bot.emit('spawn');
    setTimeout(() => bot.emit('message', chatMsg('<Steve> hello Ender'), 'chat'), 60);
  });
  lastBot = bot;
  return bot;
}

module.exports = { makeFakeBot, chatMsg, getLastBot: () => lastBot };
