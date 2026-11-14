// Minimal static file server for the demo (no dependencies). Serves the
// repository root on localhost so demo/index.html can import ../dist and
// ../node_modules through its import map. Run `pnpm demo`, which builds first.
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const port = Number(process.env.PORT ?? 4173);
const host = '127.0.0.1';

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ts': 'text/plain; charset=utf-8',
};

const send = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
  res.end(body);
};

createServer((req, res) => {
  const { pathname } = new URL(req.url ?? '/', 'http://localhost');
  if (pathname === '/') {
    res.writeHead(302, { location: '/demo/' });
    res.end();
    return;
  }
  let file;
  try {
    file = normalize(join(root, decodeURIComponent(pathname)));
  } catch {
    send(res, 400, 'Bad request');
    return;
  }
  if (file !== root && !file.startsWith(root + sep)) {
    send(res, 403, 'Forbidden');
    return;
  }
  try {
    if (statSync(file).isDirectory()) {
      if (!pathname.endsWith('/')) {
        // Relative URLs in index.html need the trailing slash.
        res.writeHead(301, { location: `${pathname}/` });
        res.end();
        return;
      }
      file = join(file, 'index.html');
    }
    statSync(file);
  } catch {
    send(res, 404, 'Not found');
    return;
  }
  res.writeHead(200, {
    'content-type': types[extname(file)] ?? 'application/octet-stream',
    'cache-control': 'no-store',
  });
  createReadStream(file).pipe(res);
}).listen(port, host, () => {
  console.log(`Demo: http://localhost:${String(port)}/demo/`);
  console.log(`Smoke test: http://localhost:${String(port)}/demo/smoke.html`);
});
