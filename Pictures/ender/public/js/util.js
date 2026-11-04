// Small DOM + formatting helpers. All server-provided text is inserted with
// textContent / text nodes only - never innerHTML - so nothing can inject markup.

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value === null || value === undefined || value === '' ? '-' : String(value);
}

export function pad2(n) { return String(n).padStart(2, '0'); }

export function fmtDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${pad2(Math.floor(total / 3600))}:${pad2(Math.floor((total % 3600) / 60))}:${pad2(total % 60)}`;
}

export function fmtTime(ts) {
  const d = new Date(ts);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

export function fmtAgo(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ago`;
}

export function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

/** Renders text with Minecraft section-sign colour codes into a safe DocumentFragment. */
export function mcFragment(text) {
  const frag = document.createDocumentFragment();
  const COLORS = '0123456789abcdef';
  const fresh = () => ({ color: null, bold: false, italic: false, underline: false, strike: false });
  let fmt = fresh();
  let buf = '';
  const flush = () => {
    if (!buf) return;
    const span = document.createElement('span');
    const cls = [];
    if (fmt.color) cls.push(`mc-${fmt.color}`);
    if (fmt.bold) cls.push('mc-bold');
    if (fmt.italic) cls.push('mc-italic');
    if (fmt.underline) cls.push('mc-underline');
    if (fmt.strike) cls.push('mc-strike');
    span.className = cls.join(' ');
    span.textContent = buf;
    frag.appendChild(span);
    buf = '';
  };
  const str = String(text);
  for (let i = 0; i < str.length; i += 1) {
    const ch = str[i];
    if (ch === '§' && i + 1 < str.length) {
      i += 1;
      const code = str[i].toLowerCase();
      flush();
      if (COLORS.includes(code)) fmt = { ...fresh(), color: code };
      else if (code === 'l') fmt.bold = true;
      else if (code === 'o') fmt.italic = true;
      else if (code === 'n') fmt.underline = true;
      else if (code === 'm') fmt.strike = true;
      else if (code === 'r') fmt = fresh();
      continue;
    }
    buf += ch;
  }
  flush();
  return frag;
}

// ------------------------------------------------------------------ toasts
export function toast(level, title, message = '', ttl = 5200) {
  const host = document.getElementById('toasts');
  if (!host) return;
  const el = document.createElement('div');
  el.className = `toast ${['success', 'info', 'warn', 'error'].includes(level) ? level : 'info'}`;
  const strong = document.createElement('strong');
  strong.textContent = title;
  el.appendChild(strong);
  if (message) {
    const span = document.createElement('span');
    span.textContent = message;
    el.appendChild(span);
  }
  host.appendChild(el);
  while (host.children.length > 5) host.firstChild.remove();
  const close = () => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 320);
  };
  el.addEventListener('click', close);
  setTimeout(close, ttl);
}

let lastErrorToast = { text: '', at: 0 };
/** Shows an error toast, suppressing identical repeats within 2.5s. */
export function errorToast(text) {
  const now = Date.now();
  if (lastErrorToast.text === text && now - lastErrorToast.at < 2500) return;
  lastErrorToast = { text, at: now };
  toast('error', 'Action failed', text);
}
