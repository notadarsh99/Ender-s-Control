'use strict';

/**
 * Real-browser test of the dashboard UI (Chromium via Playwright) against the
 * real server and a fake Mineflayer bot, so it runs offline. It also refreshes
 * the screenshots in docs/screenshots/.
 *
 * Playwright is optional and not a dependency of the project. To run this:
 *   npm install --no-save playwright && npx playwright install chromium
 *   npm run test:ui
 */
const fs = require('fs');
const path = require('path');

let playwright;
try {
  playwright = require('playwright');
} catch (_) {
  console.log('Playwright is not installed - skipping the browser test.');
  console.log('Install it with:  npm install --no-save playwright && npx playwright install chromium');
  process.exit(0);
}

const baseConfig = require('../src/config');
const { Logger } = require('../src/utils/logger');
const BotManager = require('../src/bot/BotManager');
const createServer = require('../src/server/app');
const { makeFakeBot, getLastBot, chatMsg } = require('./fake-bot');

const PORT = 38000 + Math.floor(Math.random() * 900);
const URL = `http://127.0.0.1:${PORT}`;
const SHOTS = path.join(__dirname, '..', 'docs', 'screenshots');
const config = { ...baseConfig, dashboard: { host: '127.0.0.1', port: PORT } };

let passed = 0; let failed = 0;
const check = (name, cond, extra = '') => {
  if (cond) { passed += 1; console.log(`  ✓ ${name}`); } else { failed += 1; console.log(`  ✗ ${name} ${extra}`); }
};
const section = (t) => console.log(`\n${t}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Waits until fn() is truthy (or the timeout passes) and returns its last value. */
async function until(fn, timeout = 4000) {
  const end = Date.now() + timeout;
  let value = fn();
  while (!value && Date.now() < end) { await sleep(40); value = fn(); }
  return value;
}

function richBot(opts) {
  const bot = makeFakeBot(opts);
  const slots = bot.inventory.slots;
  slots[9] = { name: 'cobblestone', displayName: 'Cobblestone', count: 64 };
  slots[10] = { name: 'bread', displayName: 'Bread', count: 12 };
  slots[11] = { name: 'oak_log', displayName: 'Oak Log', count: 33 };
  slots[36] = { name: 'diamond_sword', displayName: 'Diamond Sword', count: 1, maxDurability: 1561, durabilityUsed: 300 };
  slots[37] = { name: 'iron_chestplate', displayName: 'Iron Chestplate', count: 1, maxDurability: 240, durabilityUsed: 0 };
  slots[38] = { name: 'torch', displayName: 'Torch', count: 32 };
  slots[39] = { name: 'golden_apple', displayName: 'Golden Apple', count: 3 };
  slots[5] = { name: 'iron_helmet', displayName: 'Iron Helmet', count: 1, maxDurability: 165, durabilityUsed: 40 };
  bot.heldItem = slots[36];
  return bot;
}

/** Screenshot without toasts covering the header and with animations settled. */
async function shot(page, file) {
  await page.evaluate(() => { document.getElementById('toasts').textContent = ''; document.getElementById('pages').scrollTop = 0; });
  await sleep(450);
  await page.screenshot({ path: path.join(SHOTS, file) });
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  const logger = new Logger(500);
  const saved = [];
  const manager = new BotManager({ config, logger, createBot: richBot, persist: (t) => saved.push(t) });
  const server = createServer({ config, manager, logger });
  await server.start();

  const browser = await playwright.chromium.launch();
  const problems = [];
  const watch = (page) => {
    page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()); });
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  };

  try {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 } });
    const page = await ctx.newPage();
    watch(page);
    await page.goto(URL);
    await page.waitForFunction(() => document.getElementById('top-conn').textContent === 'Disconnected');

    section('Page shell');
    check('title', (await page.title()).includes('ENDER CONTROL'));
    const link = page.locator('.footer-link');
    check('footer credit links to the Instagram profile', (await link.getAttribute('href')) === 'https://www.instagram.com/dev_enderhere/');
    check('footer link opens safely in a new tab', (await link.getAttribute('target')) === '_blank' && /noopener/.test(await link.getAttribute('rel')));
    check('footer says "Built by dev_enderhere"', /Built by\s*dev_enderhere/.test((await page.locator('.footer').innerText()).replace(/\s+/g, ' ')));
    const box = await page.locator('.footer').boundingBox();
    check('footer is visible at the bottom of the window', box && box.y + box.height <= 861 && box.y > 700, JSON.stringify(box));
    const docScroll = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    check('the window itself never scrolls (only the page area does)', docScroll <= 1, `${docScroll}px`);
    check('Settings is in the sidebar', (await page.locator('.nav-item[data-page="settings"]').count()) === 1);
    check('controls are disabled while disconnected', await page.locator('#btn-click-left').isDisabled());

    section('Settings page');
    await page.click('.nav-item[data-page="settings"]');
    check('page title changes', (await page.textContent('#page-title')) === 'Settings');
    check('form is pre-filled with the current target', (await page.inputValue('#set-host')) === 'play.digitalvigital.fun' && (await page.inputValue('#set-port')) === '25616' && (await page.inputValue('#set-username')) === 'Ender');
    await shot(page, 'settings.png');

    await page.fill('#set-port', '99999');
    await page.click('#set-save');
    await page.waitForFunction(() => document.getElementById('set-msg').className.includes('err'));
    check('invalid port shows an error and saves nothing', /Port/.test(await page.textContent('#set-msg')) && saved.length === 0);

    await page.fill('#set-host', 'mc.example.com');
    await page.fill('#set-port', '25570');
    await page.fill('#set-username', 'Bot_One');
    await page.click('#set-save');
    await page.waitForFunction(() => document.getElementById('set-msg').className.includes('ok'));
    check('save succeeds', /Saved/.test(await page.textContent('#set-msg')));
    check('server target updated + persisted', manager.getStatus().target.host === 'mc.example.com' && manager.getStatus().target.port === 25570 && saved.length === 1 && saved[0].username === 'Bot_One');
    check('sidebar shows the new username', /Bot_One/.test(await page.textContent('#side-sub')));
    check('overview shows the new server', (await (async () => { await page.click('.nav-item[data-page="overview"]'); return page.textContent('#ov-target'); })()) === 'mc.example.com:25570');

    await page.click('.nav-item[data-page="settings"]');
    await page.click('#set-reset');
    await page.waitForFunction(() => document.getElementById('set-msg').className.includes('ok'));
    check('Defaults button restores the original target', manager.getStatus().target.host === 'play.digitalvigital.fun' && manager.getStatus().target.username === 'Ender' && (await page.inputValue('#set-port')) === '25616');

    await page.fill('#set-host', 'Play.Example.net');
    await page.fill('#set-port', '25565');
    await page.fill('#set-username', 'Ender2');
    await page.click('#set-save-connect');

    section('Connecting');
    await page.waitForFunction(() => document.getElementById('top-conn').textContent === 'Connected', null, { timeout: 8000 });
    check('Save & connect connects with the new target', manager.getStatus().target.host === 'play.example.net' && manager.getStatus().state === 'connected');
    check('jumps to the overview page', (await page.textContent('#page-title')) === 'Overview');
    check('overview shows server / user', (await page.textContent('#ov-target')) === 'play.example.net:25565' && (await page.textContent('#ov-user')) === 'Ender2');
    await page.waitForFunction(() => document.getElementById('ov-health-text').textContent.includes('20'));
    getLastBot().emit('message', chatMsg('<Steve> welcome to the server'), 'chat');
    await page.waitForFunction(() => document.getElementById('ov-chat').textContent.includes('welcome'));
    await shot(page, 'overview.png');
    await page.click('.nav-item[data-page="settings"]');
    check('settings are locked while connected', (await page.locator('#set-host').isDisabled()) && (await page.locator('#set-notice').isVisible()) && (await page.locator('#set-save').isDisabled()));

    const bot = getLastBot();

    section('Movement + camera');
    await page.click('.nav-item[data-page="controls"]');
    check('the long Controls page scrolls inside the page area', await page.evaluate(() => { const el = document.getElementById('pages'); return el.scrollHeight > el.clientHeight; }));
    check('controls are enabled once connected', !(await page.locator('#btn-click-left').isDisabled()));
    await page.keyboard.down('w');
    check('holding W walks forward', await until(() => bot.controls.forward === true));
    await page.keyboard.up('w');
    check('releasing W stops', await until(() => bot.controls.forward === false));
    await page.keyboard.press('Space');
    check('Space jumps', await until(() => 'jump' in bot.controls));
    await page.click('.pad-btn[data-control="sprint"]');
    check('sprint toggles on', await until(() => bot.controls.sprint === true));
    await page.click('#btn-stop-move');
    check('Stop clears every control', await until(() => Object.values(bot.controls).every((v) => v === false)));
    await page.locator('#cam-pad').scrollIntoViewIfNeeded();
    const pad = await page.locator('#cam-pad').boundingBox();
    const cx = pad.x + pad.width / 2; const cy = pad.y + pad.height / 2;
    await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 60, cy + 10, { steps: 6 }); await page.mouse.up();
    check('dragging the camera pad rotates the bot', await until(() => bot.entity.yaw !== 0));
    await page.click('#btn-cam-reset');
    check('camera reset', await until(() => bot.entity.yaw === 0 && bot.entity.pitch === 0));

    section('Clicks');
    bot.cursorEntity = { name: 'zombie', type: 'hostile' };
    await page.click('#btn-click-left');
    check('left click attacks the entity under the crosshair', await until(() => bot.attacked.length === 1));
    await page.waitForFunction(() => /Attacked zombie/.test(document.getElementById('click-result').textContent));
    check('result badge reports it', true);
    bot.cursorEntity = null;
    await sleep(600);
    await page.click('#btn-click-left');
    check('left click with nothing targeted swings the arm', await until(() => bot.swings === 1));
    await page.click('#btn-click-right');
    check('right click uses the held item', await until(() => bot.itemUses === 1));
    bot.cursorBlock = { name: 'stone', face: 1, position: { x: 1, y: 2, z: 3 } };
    const dig = await page.locator('#btn-click-dig').boundingBox();
    await page.mouse.move(dig.x + dig.width / 2, dig.y + dig.height / 2);
    await page.mouse.down();
    check('holding Break block starts digging', await until(() => bot.digCalls.length === 1));
    await page.mouse.up();
    check('releasing Break block stops digging', await until(() => bot.stopDigs >= 1));
    bot.cursorBlock = null;
    await sleep(600);
    bot.cursorEntity = { name: 'cow' };
    await page.locator('#cam-pad').click();
    check('tapping the camera pad is a left click', await until(() => bot.attacked.length === 2));
    const useBefore = bot.itemUses;
    await page.locator('#cam-pad').click({ button: 'right' });
    check('right-clicking the camera pad is a right click', await until(() => bot.itemUses === useBefore + 1));
    bot.cursorEntity = null;

    section('Hotbar');
    await page.keyboard.press('3');
    check('number key 3 holds hotbar slot 3', await until(() => bot.quickBarSlot === 2));
    await page.locator('#hotbar-quick .hb-btn').nth(0).click();
    check('clicking a hotbar slot selects it', await until(() => bot.quickBarSlot === 0));
    await page.waitForFunction(() => document.querySelector('#hotbar-quick .hb-btn.active .hb-key').textContent === '1');
    check('selected slot is highlighted', true);
    await shot(page, 'controls.png');

    section('Inventory control');
    await page.click('.nav-item[data-page="inventory"]');
    check('backpack shows items', (await page.locator('#inv-main .slot .item-tile').count()) === 3);
    await page.click('#inv-main .slot[data-slot="9"]');
    check('clicking an item opens the action bar', await page.locator('#inv-actions').isVisible() && /Cobblestone x64/.test(await page.textContent('#inv-sel-name')));
    await shot(page, 'inventory.png');
    await page.click('#btn-inv-drop1');
    check('Drop 1 drops a single item', await until(() => bot.invCalls.some((c) => c[0] === 'click' && c[1] === 9 && c[2] === 0 && c[3] === 4)));
    await page.click('#inv-main .slot[data-slot="11"]');
    await page.click('#btn-inv-dropall');
    check('Drop stack drops the whole stack', await until(() => bot.invCalls.some((c) => c[0] === 'click' && c[1] === 11 && c[2] === 1 && c[3] === 4)));
    await page.click('#inv-hotbar .slot[data-slot="37"]');
    await page.click('#btn-inv-equip');
    check('Equip puts armor in the right slot', await until(() => bot.invCalls.some((c) => c[0] === 'equip' && c[1] === 'iron_chestplate' && c[2] === 'torso')));
    await page.click('#inv-hotbar .slot[data-slot="38"]');
    await page.click('#btn-inv-offhand');
    check('Off-hand equips to the off-hand', await until(() => bot.invCalls.some((c) => c[0] === 'equip' && c[1] === 'torch' && c[2] === 'off-hand')));
    await page.click('#inv-hotbar .slot[data-slot="39"]');
    await page.click('#btn-inv-select');
    check('Hold selects the hotbar slot', await until(() => bot.quickBarSlot === 3));
    await page.click('#inv-armor .slot[data-slot="5"]');
    check('armor slot offers Unequip, not Equip', (await page.locator('#btn-inv-unequip').isVisible()) && !(await page.locator('#btn-inv-equip').isVisible()));
    await page.click('#btn-inv-unequip');
    check('Unequip takes the armor off', await until(() => bot.invCalls.some((c) => c[0] === 'unequip' && c[1] === 'head')));
    await page.click('#inv-hotbar .slot[data-slot="38"]');
    await page.click('#inv-main .slot[data-slot="12"]');
    check('selecting a slot then another moves / swaps', await until(() => bot.invCalls.some((c) => c[0] === 'move' && c[1] === 38 && c[2] === 12)));
    await page.click('#inv-main .slot[data-slot="10"]');
    await page.keyboard.press('Escape');
    check('Escape cancels the selection', !(await page.locator('#inv-actions').isVisible()));

    section('Idle mode');
    await page.click('.nav-item[data-page="overview"]');
    await page.locator('.switch').click();
    await page.waitForFunction(() => document.getElementById('top-afk').textContent.startsWith('Idle'));
    await page.click('.nav-item[data-page="controls"]');
    check('idle mode disables movement + clicks', (await page.locator('#btn-click-left').isDisabled()) && (await page.locator('.pad-btn[data-control="forward"]').isDisabled()));
    await page.click('.nav-item[data-page="overview"]');
    await page.locator('.switch').click();
    await page.waitForFunction(() => document.getElementById('top-afk').textContent === 'Active');

    section('Mobile layout');
    const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const mobile = await mctx.newPage();
    watch(mobile);
    await mobile.goto(URL);
    await mobile.waitForFunction(() => document.getElementById('top-conn').textContent === 'Connected');
    const overflow = async (name) => {
      const wide = await mobile.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth, document.getElementById('pages').scrollWidth) - window.innerWidth);
      check(`no sideways scrolling on ${name}`, wide <= 1, `overflow ${wide}px`);
    };
    for (const name of ['overview', 'controls', 'chat', 'player', 'inventory', 'auth', 'settings', 'logs']) {
      await mobile.click('#menu-btn');
      await mobile.click(`.nav-item[data-page="${name}"]`);
      await overflow(name);
      if (name === 'overview' || name === 'controls' || name === 'settings') await shot(mobile, `mobile-${name}.png`);
    }
    const mfoot = await mobile.locator('.footer-link').boundingBox();
    check('footer credit is visible on mobile', mfoot && mfoot.y + mfoot.height <= 844 && mfoot.width > 20);
    await mctx.close();

    section('Browser health');
    check('no console errors, CSP violations or page errors', problems.length === 0, problems.slice(0, 3).join(' | '));
    await ctx.close();
  } finally {
    await browser.close();
    manager.shutdown();
    await server.stop();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => { console.error('\nUI test crashed:', err); process.exit(1); });
