import { $, setText, fmtDuration, fmtTime, fmtAgo, mcFragment } from '../util.js';
import { state, on, feed } from '../store.js';
import { request } from '../socket.js';
import { toast, errorToast } from '../util.js';

const STATE_LABEL = {
  disconnected: 'Disconnected', connecting: 'Connecting...', connected: 'Connected', disconnecting: 'Disconnecting...',
};
const AUTH_LABEL = {
  unknown: 'Unknown', required: 'Login required', command_sent: 'Command sent', authenticated: 'Logged in',
};
const AFK_LABEL = { active: 'Active', idle: 'Idle (manual)', afk: 'AFK' };

let skew = 0; // browser clock minus server clock

function effectiveState() {
  const s = state.status;
  if (!state.online) return { key: 'disconnected', label: 'Dashboard offline' };
  if (!s) return { key: 'disconnected', label: 'Loading...' };
  if (s.reconnectPending && s.state === 'disconnected') return { key: 'connecting', label: 'Reconnecting...' };
  return { key: s.state, label: STATE_LABEL[s.state] || s.state };
}

function renderAlert() {
  const el = $('#ov-alert');
  const s = state.status;
  let text = '';
  let info = false;
  if (!state.online) text = 'Lost connection to the dashboard server. Retrying...';
  else if (s && s.state === 'disconnected') {
    if (s.reconnectPending) { text = 'Reconnecting shortly (waiting out the server rate limit)...'; info = true; }
    else if (s.lastDisconnect && s.lastDisconnect.kind !== 'manual') {
      const prefix = { kicked: 'Kicked', lost: 'Connection lost', failed: 'Could not connect' }[s.lastDisconnect.kind] || 'Disconnected';
      text = `${prefix}: ${s.lastDisconnect.reason}`;
    } else if (s.lastError) text = s.lastError;
  } else if (s && s.state === 'connecting') { text = 'Joining the server...'; info = true; }
  el.hidden = !text;
  el.classList.toggle('info', info);
  el.textContent = text;
}

function renderStatus() {
  const s = state.status;
  const eff = effectiveState();

  $('#side-dot').dataset.state = eff.key;
  setText('side-state', eff.label);
  $('#pill-conn').dataset.state = eff.key;
  setText('top-conn', eff.label);
  const tag = $('#ov-state-tag');
  tag.dataset.state = eff.key;
  tag.textContent = eff.label;
  setText('ov-state', eff.label);

  if (s) {
    setText('ov-auth', s.spawned ? (AUTH_LABEL[s.authStatus] || s.authStatus) : 'Not in world');
    setText('ov-user', s.target.username);
    setText('side-sub', `${s.target.username} \u00b7 127.0.0.1 only`);
    setText('ov-target', `${s.target.host}:${s.target.port}`);
    setText('ov-version', s.server && s.server.version ? s.server.version : s.target.version);
    setText('ov-ping', s.server && s.server.ping !== null && s.server.ping !== undefined ? `${s.server.ping} ms` : '-');
    setText('ov-players', s.server ? s.server.playersVisible : '-');
    setText('ov-gamemode', s.server ? s.server.gameMode : '-');
    setText('ov-difficulty', s.server ? s.server.difficulty : '-');
    skew = Date.now() - s.serverTime;
  }

  const st = s ? s.state : 'disconnected';
  const pending = Boolean(s && s.reconnectPending);
  const online = state.online && Boolean(s);
  $('#btn-connect').disabled = !online || st !== 'disconnected' || pending;
  $('#btn-disconnect').disabled = !online || !(st === 'connecting' || st === 'connected' || pending);
  $('#btn-reconnect').disabled = !online || !(st === 'connected' || st === 'disconnected') || pending;
  renderAlert();
  renderUptime();
}

function renderUptime() {
  const s = state.status;
  const text = s && s.connectedSince ? fmtDuration(Date.now() - skew - s.connectedSince) : '--:--:--';
  setText('top-uptime', text);
  setText('ov-uptime', text);
}

function renderAfk() {
  const a = state.afk;
  if (!a) return;
  $('#pill-afk').dataset.state = a.status;
  setText('top-afk', AFK_LABEL[a.status]);
  const tag = $('#afk-tag');
  tag.dataset.state = a.status;
  tag.textContent = AFK_LABEL[a.status];
  $('#idle-toggle').checked = a.manualIdle;
  const mins = Math.round(a.thresholdMs / 60000);
  $('#afk-hint').textContent = a.manualIdle
    ? 'Idle mode is on: Ender is held still and movement / camera input is blocked.'
    : `Marked AFK after ${mins} minutes without input from you. Idle mode holds Ender still and blocks movement until you turn it off.`;
  $('#afk-idle-for').textContent = a.manualIdle ? 'Idle mode active' : `Last input: ${fmtAgo(a.idleForMs + (Date.now() - (a._at || Date.now())))}`;
}

function renderVitals() {
  const p = state.player;
  const set = (bar, text, value, max, label) => {
    $(bar).style.width = value === null ? '0%' : `${Math.max(0, Math.min(100, (value / max) * 100))}%`;
    setText(text, value === null ? '-' : label);
  };
  if (!p) {
    set('#ov-health-bar', 'ov-health-text', null);
    set('#ov-food-bar', 'ov-food-text', null);
    setText('ov-xp', '-'); setText('ov-pos', '-'); setText('ov-dim', '-');
    return;
  }
  set('#ov-health-bar', 'ov-health-text', p.health, p.maxHealth, `${p.health} / ${p.maxHealth}`);
  $('#ov-health-bar').classList.toggle('low', p.health <= 6);
  set('#ov-food-bar', 'ov-food-text', p.food, 20, `${p.food} / 20`);
  setText('ov-xp', `Level ${p.xpLevel}`);
  setText('ov-pos', `${Math.round(p.position.x)}, ${Math.round(p.position.y)}, ${Math.round(p.position.z)}`);
  setText('ov-dim', p.dimension);
}

export function initConnection() {
  const run = async (event) => {
    const res = await request(event);
    if (!res.ok) errorToast(res.error);
  };
  $('#btn-connect').addEventListener('click', () => run('bot:connect'));
  $('#btn-disconnect').addEventListener('click', () => run('bot:disconnect'));
  $('#btn-reconnect').addEventListener('click', () => run('bot:reconnect'));

  $('#idle-toggle').addEventListener('change', async (e) => {
    const enabled = e.target.checked;
    const res = await request('idle:set', { enabled });
    if (!res.ok) { e.target.checked = !enabled; errorToast(res.error); }
  });

  on('status', renderStatus);
  on('online', () => { renderStatus(); renderAfk(); });
  on('afk', () => { if (state.afk) state.afk._at = Date.now(); renderAfk(); });
  on('player', renderVitals);
  on('chatMessage', renderRecentChat);
  on('chatReset', renderRecentChat);
  on('logEntry', renderRecentLogs);
  on('logsReset', renderRecentLogs);

  setInterval(() => { renderUptime(); renderAfk(); }, 1000);
  renderStatus();
  renderVitals();
}

// ---- overview mini feeds ---------------------------------------------------
function renderRecentChat() {
  const host = $('#ov-chat');
  host.textContent = '';
  const recent = feed.chat.slice(-6);
  if (!recent.length) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = 'No messages yet.';
    host.appendChild(p);
    return;
  }
  for (const m of recent) {
    const row = document.createElement('div');
    row.className = 'row';
    const t = document.createElement('time');
    t.textContent = fmtTime(m.ts);
    const span = document.createElement('span');
    span.appendChild(mcFragment(m.motd || m.text));
    row.append(t, span);
    host.appendChild(row);
  }
  host.scrollTop = host.scrollHeight;
}

function renderRecentLogs() {
  const host = $('#ov-logs');
  host.textContent = '';
  const recent = feed.logs.filter((l) => l.category !== 'chat').slice(-6);
  if (!recent.length) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = 'No activity yet.';
    host.appendChild(p);
    return;
  }
  for (const l of recent) {
    const row = document.createElement('div');
    row.className = 'row';
    const t = document.createElement('time');
    t.textContent = fmtTime(l.ts);
    const span = document.createElement('span');
    span.textContent = l.message;
    row.append(t, span);
    host.appendChild(row);
  }
  host.scrollTop = host.scrollHeight;
}

export { toast };
