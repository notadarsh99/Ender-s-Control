'use strict';

const DIMENSIONS = {
  overworld: 'Overworld',
  the_nether: 'The Nether',
  nether: 'The Nether',
  the_end: 'The End',
  end: 'The End',
};

const deg = (rad) => (rad * 180) / Math.PI;
const round = (n, d = 2) => (Number.isFinite(n) ? Number(n.toFixed(d)) : null);

function dimensionName(raw) {
  if (!raw) return 'Unknown';
  const key = String(raw).replace(/^minecraft:/, '');
  return DIMENSIONS[key] || key;
}

function compass(heading) {
  const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return names[Math.round(heading / 45) % 8];
}

function statusOf(bot) {
  if (bot.health !== undefined && bot.health <= 0) return 'Dead';
  if (bot.isSleeping) return 'Sleeping';
  const e = bot.entity;
  if (!e) return 'Unknown';
  if (e.isInWater) return 'Swimming';
  if (e.isInLava) return 'In lava';
  if (!e.onGround) return 'Airborne';
  return 'Standing';
}

/** Builds a plain-JSON snapshot of the bot's vitals and position. */
function playerSnapshot(bot, controls) {
  if (!bot || !bot.entity) return null;
  const e = bot.entity;
  const yawDeg = deg(e.yaw);
  const heading = (((360 - yawDeg) % 360) + 360) % 360; // 0 = north, 90 = east
  const xp = bot.experience || {};
  return {
    username: bot.username,
    health: round(bot.health, 1),
    maxHealth: 20,
    food: bot.food,
    saturation: round(bot.foodSaturation, 1),
    xpLevel: xp.level || 0,
    xpPoints: xp.points || 0,
    xpProgress: round(xp.progress || 0, 3),
    position: { x: round(e.position.x), y: round(e.position.y), z: round(e.position.z) },
    yaw: round(((yawDeg + 180) % 360 + 360) % 360 - 180, 1),
    pitch: round(deg(e.pitch), 1),
    heading: round(heading, 1),
    facing: compass(heading),
    dimension: dimensionName(bot.game && bot.game.dimension),
    gameMode: bot.game ? bot.game.gameMode : null,
    status: statusOf(bot),
    onGround: Boolean(e.onGround),
    controls: controls || {},
    raining: Boolean(bot.isRaining),
    timeOfDay: bot.time ? bot.time.timeOfDay : null,
  };
}

/** Builds a snapshot of general server information. */
function serverSnapshot(bot) {
  if (!bot) return null;
  const game = bot.game || {};
  const players = bot.players ? Object.keys(bot.players).length : 0;
  return {
    version: bot.version || null,
    gameMode: game.gameMode || null,
    difficulty: game.difficulty || null,
    maxPlayers: game.maxPlayers || null,
    playersVisible: players,
    ping: bot.player && Number.isFinite(bot.player.ping) ? bot.player.ping : null,
    hardcore: Boolean(game.hardcore),
  };
}

module.exports = { playerSnapshot, serverSnapshot, dimensionName };
