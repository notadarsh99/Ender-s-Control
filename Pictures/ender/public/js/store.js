// Tiny shared state + pub/sub so modules stay decoupled.
export const state = {
  online: false, // socket connected to the dashboard server
  status: null,
  player: null,
  inventory: null,
  afk: null,
  controls: {},
  page: 'overview',
};

const listeners = new Map();

export function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
  return () => listeners.get(event).delete(fn);
}

export function emit(event, data) {
  const set = listeners.get(event);
  if (set) set.forEach((fn) => { try { fn(data); } catch (err) { console.error(`[${event}]`, err); } });
}

export const isInWorld = () => Boolean(state.online && state.status && state.status.state === 'connected' && state.status.spawned);
export const canControl = () => isInWorld() && !(state.afk && state.afk.manualIdle);

// Rolling copies of server chat / log history shared by several views.
export const feed = { chat: [], logs: [] };
