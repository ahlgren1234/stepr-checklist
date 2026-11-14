// Builds the GitHub Pages site (scripts/build-pages.mjs) into a temporary
// directory and checks that every page, stylesheet, script and module it
// references exists inside the site, resolved under the real base path.
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '..', '..');
const base = 'https://ahlgren1234.github.io/stepr-checklist/';
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  version: string;
};

let site = '';
beforeAll(() => {
  site = mkdtempSync(join(tmpdir(), 'stepr-checklist-pages-'));
  execFileSync(
    process.execPath,
    [join(root, 'scripts/build-pages.mjs'), site],
    {
      stdio: 'pipe',
    },
  );
});
afterAll(() => {
  rmSync(site, { recursive: true, force: true });
});

const files = (dir: string): string[] =>
  readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) =>
      relative(site, join(d.parentPath, d.name)).replaceAll('\\', '/'),
    )
    .sort();

/** The site file a URL points at, or throws if it is outside the site. */
const fileFor = (url: URL): string => {
  expect(url.href.startsWith(base), `${url.href} is outside ${base}`).toBe(
    true,
  );
  const path = decodeURIComponent(
    url.pathname.slice(new URL(base).pathname.length),
  );
  return path === '' || path.endsWith('/') ? `${path}index.html` : path;
};

const specifiers = (code: string): string[] =>
  [
    ...code.matchAll(
      /^\s*(?:import|export)\s+(?:[\w$*{},\s]+?\s+from\s+)?['"]([^'"]+)['"]/gm,
    ),
  ].map(([, s]) => s ?? '');

/**
 * Follows a page's stylesheets, scripts, import map and the whole static
 * module graph, returning every site file the page loads.
 */
const crawl = (page: string): Set<string> => {
  const pageUrl = new URL(page === 'index.html' ? '' : page, base);
  const doc = new DOMParser().parseFromString(
    readFileSync(join(site, page), 'utf8'),
    'text/html',
  );
  const { imports = {} } = JSON.parse(
    doc.querySelector('script[type="importmap"]')?.textContent ?? '{}',
  ) as { imports?: Record<string, string> };

  const loaded = new Set<string>();
  const pending: [string, URL][] = [];
  const resolveSpecifier = (spec: string, from: URL): URL => {
    const mapped = imports[spec];
    if (mapped) return new URL(mapped, pageUrl);
    if (!/^\.{0,2}\//.test(spec)) throw new Error(`unmapped import ${spec}`);
    return new URL(spec, from);
  };

  for (const link of doc.querySelectorAll('link[rel="stylesheet"]')) {
    loaded.add(fileFor(new URL(link.getAttribute('href') ?? '', pageUrl)));
  }
  for (const script of doc.querySelectorAll('script[type="module"]')) {
    const src = script.getAttribute('src');
    if (src) {
      const url = new URL(src, pageUrl);
      pending.push([fileFor(url), url]);
    } else {
      for (const spec of specifiers(script.textContent)) {
        const url = resolveSpecifier(spec, pageUrl);
        pending.push([fileFor(url), url]);
      }
    }
  }
  while (pending.length > 0) {
    const [file, url] = pending.pop() ?? ['', pageUrl];
    if (loaded.has(file)) continue;
    loaded.add(file);
    expect(existsSync(join(site, file)), `${page} → ${file}`).toBe(true);
    for (const spec of specifiers(readFileSync(join(site, file), 'utf8'))) {
      const next = resolveSpecifier(spec, url);
      pending.push([fileFor(next), next]);
    }
  }
  for (const file of loaded) {
    expect(existsSync(join(site, file)), `${page} → ${file}`).toBe(true);
  }
  return loaded;
};

describe('GitHub Pages site', () => {
  it('contains the demo, the built package and Stepr, and nothing else', () => {
    const dist = readdirSync(join(root, 'dist')).filter((f) =>
      f.endsWith('.js'),
    );
    expect(files(site)).toEqual(
      [
        'demo.css',
        'index.html',
        'main.js',
        'smoke.html',
        ...dist.map((f) => `dist/${f}`),
        'vendor/stepr/LICENSE',
        'vendor/stepr/dom.js',
        'vendor/stepr/index.js',
        'vendor/stepr/spotlight.js',
        'vendor/stepr/tooltip.js',
        'vendor/stepr/tour.js',
      ].sort(),
    );
  });

  it('copies the built package unchanged', () => {
    for (const file of files(join(site, 'dist'))) {
      expect(readFileSync(join(site, file), 'utf8')).toBe(
        readFileSync(join(root, file), 'utf8'),
      );
    }
  });

  it('serves the demo page with all of its assets under the base path', () => {
    const loaded = crawl('index.html');
    expect([...loaded].sort()).toEqual(
      expect.arrayContaining([
        'demo.css',
        'main.js',
        'dist/index.js',
        'dist/widget.js',
        'vendor/stepr/index.js',
        'vendor/stepr/tour.js',
      ]),
    );
  });

  it('serves the smoke page with all of its modules under the base path', () => {
    expect(crawl('smoke.html')).toContain('dist/widget.js');
  });

  it('keeps no paths that leave the site or point into node_modules', () => {
    for (const page of ['index.html', 'smoke.html']) {
      const html = readFileSync(join(site, page), 'utf8');
      expect(html).not.toMatch(/(?:src|href)="\.\.\//);
      expect(html).not.toMatch(/["']\.\.\/(?:dist|node_modules)\//);
      expect(html).not.toContain('node_modules/stepr');
    }
  });

  it('shows the released version in the demo badge', () => {
    const doc = new DOMParser().parseFromString(
      readFileSync(join(site, 'index.html'), 'utf8'),
      'text/html',
    );
    expect(doc.querySelector('.badge')?.textContent).toBe(`v${pkg.version}`);
  });
});
