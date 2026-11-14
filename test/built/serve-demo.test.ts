// @vitest-environment node
// Starts scripts/serve-demo.mjs and checks that it serves only the demo, the
// built package and Stepr's dist. Raw request paths are sent with node:http,
// because fetch() would normalize `..` before sending. Requires `pnpm build`.
import { spawn, type ChildProcess } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { request } from 'node:http';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '..', '..');
let server: ChildProcess | undefined;
let port = 0;

interface Response {
  status: number;
  type: string | undefined;
  location: string | undefined;
  body: string;
}

const get = (path: string, method = 'GET') =>
  new Promise<Response>((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, method }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => (body += chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode ?? 0,
          type: res.headers['content-type'],
          location: res.headers.location,
          body,
        });
      });
    });
    req.on('error', reject);
    req.end();
  });

beforeAll(async () => {
  const child = spawn(process.execPath, ['scripts/serve-demo.mjs'], {
    cwd: root,
    env: { ...process.env, PORT: '0' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  server = child;
  port = await new Promise<number>((resolve, reject) => {
    let out = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      out += chunk;
      const match = /localhost:(\d+)\//.exec(out);
      if (match) resolve(Number(match[1]));
    });
    child.on('exit', (code) => {
      reject(new Error(`Server exited with ${String(code)}`));
    });
  });
});

afterAll(() => {
  server?.kill();
});

describe('demo server', () => {
  it.each([
    ['/demo/', 'text/html'],
    ['/demo/index.html', 'text/html'],
    ['/demo/smoke.html', 'text/html'],
    ['/demo/main.js', 'text/javascript'],
    ['/demo/demo.css', 'text/css'],
    ['/dist/index.js', 'text/javascript'],
    ['/dist/widget.js', 'text/javascript'],
    ['/node_modules/stepr/dist/index.js', 'text/javascript'],
    ['/node_modules/stepr/dist/tour.js', 'text/javascript'],
    ['/demo/main.js?v=1', 'text/javascript'],
  ])('serves %s', async (path, type) => {
    const res = await get(path);
    expect(res.status).toBe(200);
    expect(res.type).toContain(type);
  });

  it('serves every module the import map points at', async () => {
    const html = readFileSync(join(root, 'demo/index.html'), 'utf8');
    const map = /<script type="importmap">([\s\S]*?)<\/script>/.exec(html);
    const { imports } = JSON.parse(map?.[1] ?? '{}') as {
      imports: Record<string, string>;
    };
    expect(Object.keys(imports)).toEqual(['@stepr/checklist', 'stepr']);
    for (const target of Object.values(imports)) {
      const { pathname } = new URL(target, 'http://x/demo/');
      expect((await get(pathname)).status, pathname).toBe(200);
    }
  });

  it('redirects to the demo', async () => {
    expect(await get('/')).toMatchObject({ status: 302, location: '/demo/' });
    expect(await get('/demo')).toMatchObject({
      status: 301,
      location: '/demo/',
    });
  });

  it.each([
    // Repository contents outside the allowlist
    '/.git/config',
    '/.git/HEAD',
    '/.env',
    '/.nvmrc',
    '/package.json',
    '/pnpm-lock.yaml',
    '/tsconfig.json',
    '/eslint.config.js',
    '/README.md',
    '/src/index.ts',
    '/scripts/serve-demo.mjs',
    '/test/docs.test.ts',
    '/.github/workflows/ci.yml',
    // node_modules beyond Stepr's dist
    '/node_modules/stepr/package.json',
    '/node_modules/typescript/package.json',
    '/node_modules/.pnpm/lock.yaml',
    // Disallowed file types inside allowed directories
    '/dist/index.d.ts',
    '/node_modules/stepr/dist/index.d.ts',
    // Traversal and dot-segments, plain and encoded
    '/demo/../package.json',
    '/demo/../.git/config',
    '/dist/../src/index.ts',
    '/demo/%2e%2e/package.json',
    '/demo/..%2fpackage.json',
    '/demo/..%5cpackage.json',
    '/node_modules/stepr/dist/../package.json',
    '/demo/.hidden.js',
    '/demo/%00.js',
  ])('refuses %s', async (path) => {
    const res = await get(path);
    expect(res.status).toBe(403);
    expect(res.body).not.toContain('"name"');
  });

  it('returns 404 for missing files in allowed directories', async () => {
    expect((await get('/demo/missing.js')).status).toBe(404);
    expect((await get('/dist/missing.js')).status).toBe(404);
  });

  it('rejects malformed paths and other methods', async () => {
    expect((await get('/demo/%E0%A4%A.js')).status).toBe(400);
    expect((await get('/demo/main.js', 'POST')).status).toBe(405);
    const head = await get('/demo/main.js', 'HEAD');
    expect(head.status).toBe(200);
    expect(head.body).toBe('');
  });
});
