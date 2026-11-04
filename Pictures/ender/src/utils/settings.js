'use strict';

const fs = require('fs');
const path = require('path');
const { validateSettings } = require('./validate');

/**
 * Persists only the connection target (host, port, username) so it survives a
 * restart. Passwords and any other secrets are never written to disk.
 */
function loadSettings(file) {
  try {
    const parsed = validateSettings(JSON.parse(fs.readFileSync(file, 'utf8')));
    return parsed.ok ? parsed.value : null;
  } catch (_) {
    return null; // missing or corrupt file - fall back to defaults
  }
}

function saveSettings(file, target) {
  const { host, port, username } = target;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify({ host, port, username }, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(tmp, file);
}

module.exports = { loadSettings, saveSettings };
