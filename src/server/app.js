'use strict';

const http = require('http');
const path = require('path');
const express = require('express');
const { Server } = require('socket.io');
const registerSockets = require('./socket');

/**
 * Builds the HTTP + Socket.IO server. Bound to loopback only; requests whose
 * Host or Origin header is not the local dashboard are rejected, which also
 * blocks DNS-rebinding and cross-site WebSocket hijacking.
 */
function createServer({ config, manager, logger }) {
  const { host, port } = config.dashboard;
  const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  const allowedOrigins = new Set([`http://127.0.0.1:${port}`, `http://localhost:${port}`]);

  const app = express();
  app.disable('x-powered-by');

  app.use((req, res, next) => {
    if (!allowedHosts.has(String(req.headers.host || '').toLowerCase())) {
      return res.status(403).type('text/plain').send('Forbidden host');
    }
    res.setHeader('Content-Security-Policy', [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self'",
      "img-src 'self' data:",
      `connect-src 'self' ws://127.0.0.1:${port} ws://localhost:${port}`,
      "object-src 'none'",
      "base-uri 'none'",
      "frame-ancestors 'none'",
      "form-action 'none'",
    ].join('; '));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    return next();
  });

  app.get('/api/health', (_req, res) => res.json({ ok: true, name: 'ender-control' }));
  app.use(express.static(path.join(__dirname, '..', '..', 'public'), { index: 'index.html' }));
  app.use((_req, res) => res.status(404).type('text/plain').send('Not found'));

  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    serveClient: true,
    cors: { origin: false },
    maxHttpBufferSize: 10 * 1024, // inbound payloads are tiny; reject anything large
    allowRequest: (req, callback) => {
      const origin = req.headers.origin;
      const hostHeader = String(req.headers.host || '').toLowerCase();
      const originOk = !origin || allowedOrigins.has(origin);
      callback(null, originOk && allowedHosts.has(hostHeader));
    },
  });

  registerSockets(io, manager, logger, config);

  return {
    app,
    httpServer,
    io,
    start() {
      return new Promise((resolve, reject) => {
        httpServer.once('error', reject);
        httpServer.listen(port, host, () => {
          httpServer.removeListener('error', reject);
          resolve(httpServer.address());
        });
      });
    },
    stop() {
      return new Promise((resolve) => {
        io.close(() => resolve());
      });
    },
  };
}

module.exports = createServer;
