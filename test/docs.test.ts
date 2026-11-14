// @vitest-environment jsdom
// Keeps the README, the demo and the implementation consistent. Running the
// examples against the built package is in test/built/ (`pnpm test:built`).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { checklistCss } from '../src/index.js';

const root = join(import.meta.dirname, '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const readme = read('README.md');
const demoHtml = new DOMParser().parseFromString(
  read('demo/index.html'),
  'text/html',
);
const pkg = JSON.parse(read('package.json')) as {
  exports: Record<string, { default?: string }>;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  devDependencies: Record<string, string>;
};

/** README code blocks that follow an `<!-- example: name -->` marker. */
const readmeExamples = new Map(
  [
    ...readme.matchAll(
      /<!-- example: ([\w-]+) -->\n\n```\w+\n([\s\S]*?)\n```/g,
    ),
  ].map(([, name, code]) => [name ?? '', code ?? '']),
);

/** `--stepr-checklist-*` properties and their fallbacks in the stylesheet. */
const cssProperties = new Map(
  [
    ...checklistCss.matchAll(/var\((--stepr-checklist-[a-z-]+),\s*([^)]+)\)/g),
  ].map(([, name, fallback]) => [name ?? '', (fallback ?? '').trim()]),
);

describe('README and demo examples', () => {
  const demoBlocks = [
    ...demoHtml.querySelectorAll<HTMLElement>('pre[data-example]'),
  ];

  const names = [...readmeExamples.keys()].sort();

  it('has the same set of examples in both', () => {
    expect(names).toHaveLength(5);
    expect(demoBlocks.map((pre) => pre.dataset['example']).sort()).toEqual(
      names,
    );
  });

  it.each([...readmeExamples])('shows "%s" identically', (name, code) => {
    const pre = demoHtml.querySelector(`pre[data-example="${name}"]`);
    expect(pre?.textContent).toBe(code);
  });

  it('gives every example a copy button', () => {
    const buttons = [...demoHtml.querySelectorAll('[data-copy]')].map((b) =>
      b.getAttribute('data-copy'),
    );
    expect(buttons.sort()).toEqual(names);
  });

  it('uses the theme example in the demo stylesheet', () => {
    expect(read('demo/demo.css')).toContain(readmeExamples.get('theme'));
  });
});

describe('CSS custom properties', () => {
  it('documents every property with its actual default', () => {
    const documented = new Map(
      [
        ...readme.matchAll(/^\| `(--stepr-checklist-[a-z-]+)` +\| `([^`]+)`/gm),
      ].map(([, name, value]) => [name, value]),
    );
    expect(cssProperties.size).toBe(12);
    expect(documented).toEqual(cssProperties);
  });

  it('uses only real properties in the theme examples', () => {
    const used = [
      ...read('demo/demo.css').matchAll(/(--stepr-checklist-[a-z-]+):/g),
    ].map(([, name]) => name ?? '');
    expect(used.length).toBeGreaterThan(0);
    for (const name of used) expect(cssProperties.has(name)).toBe(true);
  });
});

describe('demo wiring', () => {
  const importMap = JSON.parse(
    demoHtml.querySelector('script[type="importmap"]')?.textContent ?? '{}',
  ) as { imports: Record<string, string> };

  it('maps the package name to the built entry point from package.json', () => {
    const entry = pkg.exports['.']?.default;
    expect(entry).toBe('./dist/index.js');
    expect(importMap.imports['@stepr/checklist']).toBe(`.${entry ?? ''}`);
  });

  it('keeps stepr a demo-only devDependency', () => {
    expect(pkg.devDependencies['stepr']).toMatch(/^\d+\.\d+\.\d+$/);
    for (const field of [
      pkg.dependencies,
      pkg.peerDependencies,
      pkg.optionalDependencies,
    ]) {
      expect(field).toBeUndefined();
    }
    for (const file of readdirSync(join(root, 'src'))) {
      expect(read(`src/${file}`)).not.toMatch(/from 'stepr'/);
    }
  });
});
