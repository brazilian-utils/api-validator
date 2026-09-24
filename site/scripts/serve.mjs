#!/usr/bin/env node
/**
 * Serves the built site (out/) the way GitHub Pages does: under the base path, index.html for
 * folders, 404.html for anything else. `npm run preview`, after `npm run build`.
 * Env: SITE_URL (as for the build), PORT (default 4321).
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const OUT = path.resolve('out');
const BASE = new URL(process.env.SITE_URL || 'https://brazilian-utils.github.io/doc').pathname.replace(/\/$/, '');
const PORT = Number(process.env.PORT) || 4321;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.txt': 'text/plain', '.xml': 'application/xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };

http
  .createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(OUT, pathname.startsWith(BASE) ? pathname.slice(BASE.length) : '/__none__');
    if (!file.startsWith(OUT)) return res.writeHead(403).end();
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    // As the host serves them: text compressed, hashed build files cached for good.
    const send = (status, type, body) => {
      const headers = { 'content-type': type };
      if (pathname.includes('/_next/static/')) headers['cache-control'] = 'public, max-age=31536000, immutable';
      if (/^(text\/|application\/(json|javascript|xml))/.test(type) && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '')) {
        headers['content-encoding'] = 'gzip';
        body = zlib.gzipSync(body);
      }
      res.writeHead(status, headers).end(body);
    };
    if (!fs.existsSync(file)) return send(404, 'text/html', fs.readFileSync(path.join(OUT, '404.html')));
    send(200, TYPES[path.extname(file)] ?? 'application/octet-stream', fs.readFileSync(file));
  })
  .listen(PORT, '127.0.0.1', () => console.log(`http://127.0.0.1:${PORT}${BASE}/`));
