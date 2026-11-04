/* global io */
export const socket = io({ transports: ['websocket', 'polling'], reconnectionDelay: 800, reconnectionDelayMax: 4000 });

/** Emits an event and resolves with the server acknowledgement ({ ok, error? }). */
export function request(event, payload) {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) { settled = true; resolve({ ok: false, error: 'The dashboard server did not respond' }); }
    }, 5000);
    const done = (res) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(res && typeof res === 'object' ? res : { ok: false, error: 'No response' });
    };
    if (!socket.connected) { done({ ok: false, error: 'Dashboard server is offline' }); return; }
    if (payload === undefined) socket.emit(event, done);
    else socket.emit(event, payload, done);
  });
}
