'use strict';

/**
 * Central configuration. These are the DEFAULTS for the bot's connection
 * target (they can be overridden with environment variables at launch). The
 * address, port and username can also be edited from the dashboard's Settings
 * page while the bot is disconnected; those edits are saved to
 * data/settings.json and take priority over these defaults.
 */
const config = Object.freeze({
  dashboard: {
    host: '127.0.0.1', // never bind anywhere else
    port: Number(process.env.ENDER_PORT) || 3000,
  },
  bot: {
    username: 'Ender',
    host: process.env.ENDER_SERVER_HOST || 'play.digitalvigital.fun',
    port: Number(process.env.ENDER_SERVER_PORT) || 25616,
    version: process.env.ENDER_MC_VERSION || '1.21.11',
    auth: 'offline',
    connectTimeoutMs: 30000,
    afkThresholdMs: 5 * 60 * 1000, // passive "no input for a while" indicator
  },
  limits: {
    chatMaxLength: 256,
    passwordMaxLength: 128,
    logBufferSize: 500,
    chatBufferSize: 300,
  },
});

module.exports = config;
