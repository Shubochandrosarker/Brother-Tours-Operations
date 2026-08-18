import http from 'node:http';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(`Invalid PORT value: ${process.env.PORT}`);
  process.exit(1);
}
const root = resolve(process.cwd(), 'dist/apps/web');
const startedAt = Date.now();
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8',
};

if (!existsSync(join(root, 'index.html'))) {
  console.error(`Build output not found at ${root}. Run npm run build first.`);
  process.exit(1);
}

// The build stamp is the record of what shipped. It drives /healthz and the CSP
// connect-src, so the server can never disagree with the bundle it is serving.
let buildInfo = { app: 'brother-tours-operations-hub', apiBase: '', commit: 'unknown', builtAt: null };
try {
  buildInfo = JSON.parse(readFileSync(join(root, 'build-info.json'), 'utf8'));
} catch {
  console.warn('build-info.json missing — /healthz will not report the API base and CSP connect-src falls back to self only.');
}

const apiOrigin = (() => {
  try { return new URL(buildInfo.apiBase).origin; } catch { return ''; }
})();
const connectSrc = ["'self'", apiOrigin].filter(Boolean).join(' ');
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  `connect-src ${connectSrc}`,
].join('; ');

function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.setHeader('Content-Security-Policy', csp);
  res.setHeader('Vary', 'Accept-Encoding');
}

const server = http.createServer((req, res) => {
  securityHeaders(res);
  const method = req.method || 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Method Not Allowed');
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad Request');
    return;
  }

  if (pathname === '/healthz' || pathname === '/healthz.json') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    if (method === 'HEAD') {
      res.end();
      return;
    }
    res.end(JSON.stringify({
      ok: true,
      app: buildInfo.app || 'brother-tours-operations-hub',
      apiBase: buildInfo.apiBase || '',
      commit: buildInfo.commit || 'unknown',
      builtAt: buildInfo.builtAt || null,
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    }));
    return;
  }

  const safePath = normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, '');
  let file = join(root, safePath === '/' ? 'index.html' : safePath);
  if (!file.startsWith(root)) file = join(root, 'index.html');

  let isAsset = false;
  try {
    if (existsSync(file) && statSync(file).isFile()) isAsset = true;
  } catch { isAsset = false; }

  // A missing hashed chunk must 404. Falling back to index.html here serves HTML
  // under a text/javascript Content-Type, and the app dies on a module parse
  // error with no usable signal about what went wrong.
  if (!isAsset && safePath.startsWith('/assets/')) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end('Not Found');
    return;
  }
  if (!isAsset) file = join(root, 'index.html');

  const type = mime[extname(file).toLowerCase()] || 'application/octet-stream';
  const isImmutable = isAsset && /[\\/]assets[\\/]/.test(file);
  const isStamp = file === join(root, 'build-info.json');
  const cache = isImmutable && !isStamp ? 'public, max-age=31536000, immutable' : 'no-store';
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': cache });
  if (method === 'HEAD') {
    res.end();
  } else {
    createReadStream(file).pipe(res);
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Brother Tours Operations Hub listening on :${port} · api=${buildInfo.apiBase || '(unstamped)'} · commit=${buildInfo.commit}`);
});
