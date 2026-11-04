'use strict';

/**
 * Static verification: JavaScript syntax of every source file, plus a
 * cross-check that every element id the frontend looks up exists in index.html.
 * Run with: npm run check
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
  const p = path.join(dir, d.name);
  if (d.name === 'node_modules') return [];
  return d.isDirectory() ? walk(p) : [p];
});

let failures = 0;
const fail = (msg) => { failures += 1; console.error(`  ✗ ${msg}`); };

// ---- 1. syntax -------------------------------------------------------------
const backend = [...walk(path.join(root, 'src')), ...walk(__dirname)].filter((f) => f.endsWith('.js'));
const frontend = walk(path.join(root, 'public', 'js')).filter((f) => f.endsWith('.js'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ender-check-'));

console.log('Syntax check');
for (const file of backend) {
  const r = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (r.status !== 0) fail(`${path.relative(root, file)}\n${r.stderr}`);
}
for (const file of frontend) {
  const copy = path.join(tmp, `${path.basename(file, '.js')}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.copyFileSync(file, copy); // ES modules: check as .mjs
  const r = spawnSync(process.execPath, ['--check', copy], { encoding: 'utf8' });
  if (r.status !== 0) fail(`${path.relative(root, file)}\n${r.stderr}`);
}
console.log(`  ${backend.length + frontend.length} files checked`);

// ---- 2. element ids --------------------------------------------------------
console.log('Frontend element ids');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
const prefixes = ['set-', 'hotbar-', 'click-', 'ov-', 'pl-', 'inv-', 'auth-', 'chat-', 'log-', 'cam-', 'btn-', 'top-', 'side-', 'yaw-', 'pitch-', 'sens-', 'idle-', 'afk-', 'controls-', 'pill-', 'page-', 'toasts', 'sidebar', 'scrim', 'menu-btn', 'page-title', 'pages', 'nav'];
const referenced = new Set();
for (const file of frontend) {
  const src = fs.readFileSync(file, 'utf8');
  for (const m of src.matchAll(/['"`]#?([a-z][a-z0-9]*(?:-[a-z0-9]+)*)['"`]/g)) {
    const name = m[1];
    if (prefixes.some((p) => name === p || name.startsWith(p))) referenced.add([name, path.relative(root, file)].join('|'));
  }
}
const classOnly = new Set(['chat-card', 'chat-list', 'chat-form', 'log-card', 'log-list', 'log-row', 'log-cat', 'page-title']);
for (const entry of referenced) {
  const [name, file] = entry.split('|');
  if (!ids.has(name) && !classOnly.has(name)) fail(`${file} references #${name} but index.html has no such id`);
}
console.log(`  ${ids.size} ids in HTML, ${referenced.size} references checked`);

// ---- 3. CSP-hostile markup -------------------------------------------------
console.log('CSP hygiene');
if (/\sstyle="/.test(html)) fail('index.html contains an inline style attribute (blocked by the CSP)');
if (/<script(?![^>]*\ssrc=)[^>]*>/.test(html)) fail('index.html contains an inline <script>');
if (/\son[a-z]+="/.test(html)) fail('index.html contains an inline event handler');
console.log('  no inline styles, scripts or handlers');

fs.rmSync(tmp, { recursive: true, force: true });
if (failures) { console.error(`\n${failures} problem(s) found`); process.exit(1); }
console.log('\nAll checks passed');
