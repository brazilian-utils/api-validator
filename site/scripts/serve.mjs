#!/usr/bin/env node
/**
 * Serves the built site (out/) the way GitHub Pages does: under the base path, index.html for
 * folders, 404.html for anything else. `npm run preview`, after `npm run build`.
 * Env: SITE_URL (as for the build), PORT (default 4321).
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('out');
const BASE = new URL(process.env.SITE_URL || 'https://brazilian-utils.github.io/api-validator').pathname.replace(/\/$/, '');
const PORT = Number(process.env.PORT) || 4321;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.txt': 'text/plain', '.xml': 'application/xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };

http
  .createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(OUT, pathname.startsWith(BASE) ? pathname.slice(BASE.length) : '/__none__');
    if (!file.startsWith(OUT)) return res.writeHead(403).end();
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) return res.writeHead(404, { 'content-type': 'text/html' }).end(fs.readFileSync(path.join(OUT, '404.html')));
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' }).end(fs.readFileSync(file));
  })
  .listen(PORT, '127.0.0.1', () => console.log(`http://127.0.0.1:${PORT}${BASE}/`));
