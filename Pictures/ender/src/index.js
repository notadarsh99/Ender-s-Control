'use strict';

const path = require('path');
const config = require('./config');
const { Logger } = require('./utils/logger');
const BotManager = require('./bot/BotManager');
const createServer = require('./server/app');
const { loadSettings, saveSettings } = require('./utils/settings');

const SETTINGS_FILE = path.join(__dirname, '..', 'data', 'settings.json');

async function main() {
  const logger = new Logger(config.limits.logBufferSize);
  const manager = new BotManager({
    config,
    logger,
    initialTarget: loadSettings(SETTINGS_FILE),
    persist: (target) => saveSettings(SETTINGS_FILE, target),
  });
  const server = createServer({ config, manager, logger });

  logger.info('system', 'ENDER CONTROL starting');

  let address;
  try {
    address = await server.start();
  } catch (err) {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n  Port ${config.dashboard.port} is already in use. Start with another port, e.g.:\n  ENDER_PORT=3100 npm start\n`);
    } else {
      console.error('Failed to start dashboard:', err.message);
    }
    process.exit(1);
  }

  const url = `http://127.0.0.1:${address.port}`;
  logger.info('system', `Dashboard listening on ${url}`);
  console.log('\n  ENDER CONTROL is running');
  console.log(`  Dashboard : ${url}`);
  const t = manager.getStatus().target;
  console.log(`  Target    : ${t.username} @ ${t.host}:${t.port} (MC ${t.version})`);
  console.log('  Press Ctrl+C to stop\n');

  // Errors from the bot must never take the dashboard down.
  process.on('uncaughtException', (err) => {
    logger.error('error', `Uncaught exception: ${err.message}`);
    console.error('Uncaught exception:', err);
  });
  process.on('unhandledRejection', (reason) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    logger.error('error', `Unhandled rejection: ${message}`);
    console.error('Unhandled rejection:', reason);
  });

  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    console.log('\n  Shutting down...');
    manager.shutdown();
    await server.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main();
