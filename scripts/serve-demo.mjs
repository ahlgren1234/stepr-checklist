// Minimal static file server for the demo (no dependencies), bound to
// 127.0.0.1. Run `pnpm demo`, which builds dist/ first.
//
// It serves only what the demo needs, from an allowlist of directories:
//   /demo/                     → demo/        (the pages, script and styles)
//   /dist/                     → dist/        (the built package)
//   /node_modules/stepr/dist/  → stepr's dist (the tour library, demo only)
// and only .html, .css and .js files in them. Everything else in the
// repository (.git, .env, package and config files, sources, other
// node_modules) is refused, as are dot-segments, encoded traversal and
// symlinks that lead outside an allowed directory.
//
// PORT=0 picks a free port; the actual URL is printed on startup.
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const port = Number(process.env.PORT ?? 4173);
const host = '127.0.0.1';

const areas = [
  { prefix: '/demo/', dir: join(root, 'demo') },
  { prefix: '/dist/', dir: join(root, 'dist') },
  {
    prefix: '/node_modules/stepr/dist/',
    dir: join(root, 'node_modules', 'stepr', 'dist'),
  },
];

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

const redirects = { '/': '/demo/', '/demo': '/demo/' };

/**
 * Maps a request path to a file inside an allowed directory, or to the
 * response to send instead.
 * @returns {Promise<{ file: string } | { status: number, location?: string }>}
 */
async function resolveRequest(rawPath) {
  const location = redirects[rawPath];
  if (location) return { status: rawPath === '/' ? 302 : 301, location };

  let path;
  try {
    path = decodeURIComponent(rawPath);
  } catch {
    return { status: 400 };
  }
  // Checked after decoding, so %2e%2e, %2f and %5c can't sneak past.
  const segments = path.split(/[/\\]/);
  if (path.includes('\0') || segments.some((s) => s.startsWith('.'))) {
    return { status: 403 };
  }

  const area = areas.find((a) => path.startsWith(a.prefix));
  if (!area) return { status: 403 };
  let relative = path.slice(area.prefix.length);
  if (relative === '' || relative.endsWith('/')) relative += 'index.html';
  if (!Object.hasOwn(types, extname(relative))) return { status: 403 };

  try {
    // Resolve symlinks (pnpm links node_modules/stepr into .pnpm) and make
    // sure the real file is still inside the allowed directory.
    const [realDir, realFile] = await Promise.all([
      realpath(area.dir),
      realpath(join(area.dir, relative)),
    ]);
    if (!realFile.startsWith(realDir + sep)) return { status: 403 };
    if (!(await stat(realFile)).isFile()) return { status: 404 };
    return { file: realFile };
  } catch {
    return { status: 404 };
  }
}

const messages = {
  400: 'Bad request',
  403: 'Forbidden',
  404: 'Not found',
  405: 'Method not allowed',
};

const server = createServer((req, res) => {
  void (async () => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { allow: 'GET, HEAD' });
      res.end(messages[405]);
      return;
    }
    // Only the path is used; the query string and fragment are ignored.
    const rawPath = (req.url ?? '/').split(/[?#]/)[0] || '/';
    const result = await resolveRequest(rawPath);
    if ('file' in result) {
      res.writeHead(200, {
        'content-type': types[extname(result.file)],
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      });
      if (req.method === 'HEAD') res.end();
      else createReadStream(result.file).pipe(res);
      return;
    }
    const headers = { 'content-type': 'text/plain; charset=utf-8' };
    if (result.location) headers.location = result.location;
    res.writeHead(result.status, headers);
    res.end(messages[result.status] ?? '');
  })();
});

server.listen(port, host, () => {
  const address = server.address();
  const actual = typeof address === 'object' && address ? address.port : port;
  console.log(`Demo: http://localhost:${String(actual)}/demo/`);
  console.log(`Smoke test: http://localhost:${String(actual)}/demo/smoke.html`);
});
