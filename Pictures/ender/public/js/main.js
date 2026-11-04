import { socket } from './socket.js';
import { state, emit, feed } from './store.js';
import { toast } from './util.js';
import { initNav } from './modules/nav.js';
import { initConnection } from './modules/connection.js';
import { initControls } from './modules/controls.js';
import { initCamera } from './modules/camera.js';
import { initClicks } from './modules/clicks.js';
import { initChat } from './modules/chat.js';
import { initPlayer } from './modules/player.js';
import { initInventory } from './modules/inventory.js';
import { initHotbar } from './modules/hotbar.js';
import { initAuth } from './modules/auth.js';
import { initLogs } from './modules/logs.js';
import { initSettings } from './modules/settings.js';

const CHAT_CAP = 300;
const LOG_CAP = 500;

// ---- server -> browser wiring ------------------------------------------------
socket.on('connect', () => {
  state.online = true;
  emit('online', true);
});

socket.on('disconnect', () => {
  state.online = false;
  emit('online', false);
  toast('error', 'Dashboard offline', 'Lost connection to the dashboard server. Retrying...');
});

socket.on('init', (data) => {
  state.status = data.status;
  state.player = data.player;
  state.inventory = data.inventory;
  state.afk = data.afk;
  state.controls = data.controls || {};
  feed.chat = data.chat || [];
  feed.logs = data.logs || [];
  emit('status', state.status);
  emit('player', state.player);
  emit('inventory', state.inventory);
  emit('afk', state.afk);
  emit('controls', state.controls);
  emit('chatReset');
  emit('logsReset');
});

socket.on('bot:status', (s) => {
  state.status = s;
  if (!s.spawned) { state.player = null; state.inventory = null; emit('player', null); emit('inventory', null); }
  emit('status', s);
});
socket.on('player:update', (p) => { state.player = p; emit('player', p); });
socket.on('inventory:update', (i) => { state.inventory = i; emit('inventory', i); });
socket.on('afk:update', (a) => { state.afk = a; emit('afk', a); });
socket.on('controls:update', (c) => { state.controls = c; emit('controls', c); });

socket.on('chat:message', (m) => {
  feed.chat.push(m);
  if (feed.chat.length > CHAT_CAP) feed.chat.shift();
  emit('chatMessage', m);
});
socket.on('chat:cleared', () => { feed.chat = []; emit('chatReset'); });

socket.on('log:entry', (e) => {
  feed.logs.push(e);
  if (feed.logs.length > LOG_CAP) feed.logs.shift();
  emit('logEntry', e);
});
socket.on('log:cleared', ({ category }) => {
  feed.logs = category ? feed.logs.filter((l) => l.category !== category) : [];
  emit('logsReset');
});

socket.on('notify', (n) => toast(n.level, n.title, n.message));

// ---- UI modules --------------------------------------------------------------
initNav();
initConnection();
initControls();
initCamera();
initClicks();
initChat();
initPlayer();
initInventory();
initHotbar();
initAuth();
initLogs();
initSettings();
