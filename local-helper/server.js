#!/usr/bin/env node
/* recuter local helper — a tiny, zero-dependency file writer.
 *
 * recuter.com (or http://localhost) sends the generated files here and this
 * writes them into a folder you choose — no browser folder-permission prompt,
 * works in any browser, and you keep everything organized on disk.
 *
 *   node server.js
 *   RECUTER_OUT="$HOME/Documents/Job Applications" node server.js
 *
 * Files land in: <RECUTER_OUT>/<Company>/<filename>
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = Number(process.env.RECUTER_PORT || 4567);
const OUT = process.env.RECUTER_OUT
  ? path.resolve(process.env.RECUTER_OUT)
  : path.join(os.homedir(), 'recuter-applications');

// Origins allowed to talk to the helper. Add your own with RECUTER_ALLOW.
const ALLOWED = new Set(
  [
    'https://recuter.com',
    'https://www.recuter.com',
    'http://localhost:8080',
    'http://127.0.0.1:8080',
    'http://localhost:5500',
    ...(process.env.RECUTER_ALLOW ? process.env.RECUTER_ALLOW.split(',') : []),
  ].map((s) => s.trim()),
);

function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && (ALLOWED.has(origin) || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function send(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

function sanitizeSeg(s) {
  return String(s || '').replace(/[\\/:*?"<>|]+/g, '').replace(/\.+$/, '').trim() || 'Application';
}

const server = http.createServer((req, res) => {
  cors(req, res);

  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  if (req.method === 'GET' && (req.url === '/' || req.url === '/ping')) {
    return send(res, 200, { ok: true, service: 'recuter-helper', folder: OUT });
  }

  if (req.method === 'POST' && req.url === '/save') {
    let body = '';
    req.on('data', (c) => {
      body += c;
      if (body.length > 30 * 1024 * 1024) req.destroy(); // 30MB guard
    });
    req.on('end', () => {
      let payload;
      try { payload = JSON.parse(body); } catch { return send(res, 400, { error: 'invalid JSON' }); }
      const files = Array.isArray(payload.files) ? payload.files : [];
      if (!files.length) return send(res, 400, { error: 'no files' });

      // Group by company when the filename encodes it ("Name - Resume - Company.ext").
      const companyOf = (name) => {
        const m = /-\s*([^-.]+)\.[a-z0-9]+$/i.exec(name);
        return sanitizeSeg(m ? m[1] : payload.company);
      };

      try {
        let written = [];
        let folder = OUT;
        for (const f of files) {
          if (!f.name || typeof f.base64 !== 'string') continue;
          const dir = path.join(OUT, companyOf(f.name));
          fs.mkdirSync(dir, { recursive: true });
          const safeName = path.basename(sanitizeSeg(f.name.replace(/\.[a-z0-9]+$/i, '')) + path.extname(f.name));
          const dest = path.join(dir, safeName);
          fs.writeFileSync(dest, Buffer.from(f.base64, 'base64'));
          written.push(dest);
          folder = dir;
        }
        console.log(`✓ wrote ${written.length} file(s) to ${folder}`);
        return send(res, 200, { ok: true, folder, written });
      } catch (err) {
        console.error(err);
        return send(res, 500, { error: String(err.message || err) });
      }
    });
    return;
  }

  send(res, 404, { error: 'not found' });
});

fs.mkdirSync(OUT, { recursive: true });
server.listen(PORT, '127.0.0.1', () => {
  console.log(`recuter helper listening on http://127.0.0.1:${PORT}`);
  console.log(`saving applications under: ${OUT}`);
  console.log('leave this running while you use recuter.com, then Ctrl+C to stop.');
});
