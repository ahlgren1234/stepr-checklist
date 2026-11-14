// Assembles the static GitHub Pages site for the demo (no bundler, no
// dependencies). Run `pnpm build:pages`, which builds dist/ first.
//
// Output (default `_site/`, or the directory given as the first argument):
//   index.html, smoke.html, main.js, demo.css  ← demo/
//   dist/*.js                                   ← dist/ (the built package)
//   vendor/stepr/*.js, vendor/stepr/LICENSE     ← stepr's dist (demo only)
//
// The demo pages live in demo/ and reach the package and Stepr with `../`
// paths, which work with the local server (`pnpm demo`). Here the pages move
// to the site root, so those paths are rewritten to `./dist/` and
// `./vendor/stepr/`. Every path stays relative, so the site works under any
// base path, such as https://ahlgren1234.github.io/stepr-checklist/.
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, process.argv[2] ?? '_site');
const demo = join(root, 'demo');
const dist = join(root, 'dist');
const stepr = realpathSync(join(root, 'node_modules', 'stepr'));

if (!existsSync(join(dist, 'index.js'))) {
  throw new Error('dist/index.js is missing: run `pnpm build` first');
}

/** Each rewrite must match exactly `count` times, so drift fails loudly. */
const rewrites = {
  'index.html': [
    ['"../dist/index.js"', '"./dist/index.js"', 1],
    ['"../node_modules/stepr/dist/index.js"', '"./vendor/stepr/index.js"', 1],
  ],
  'smoke.html': [["'../dist/index.js'", "'./dist/index.js'", 1]],
};

const jsFiles = (dir) => readdirSync(dir).filter((f) => f.endsWith('.js'));

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'dist'), { recursive: true });
mkdirSync(join(out, 'vendor', 'stepr'), { recursive: true });

for (const file of readdirSync(demo)) {
  if (!/\.(html|css|js)$/.test(file)) continue;
  let text = readFileSync(join(demo, file), 'utf8');
  for (const [from, to, count] of rewrites[file] ?? []) {
    const found = text.split(from).length - 1;
    if (found !== count) {
      throw new Error(`${file}: expected ${from} ${count}x, found ${found}x`);
    }
    text = text.replaceAll(from, to);
  }
  writeFileSync(join(out, file), text);
}

for (const file of jsFiles(dist)) {
  copyFileSync(join(dist, file), join(out, 'dist', file));
}
for (const file of jsFiles(join(stepr, 'dist'))) {
  copyFileSync(join(stepr, 'dist', file), join(out, 'vendor', 'stepr', file));
}
copyFileSync(join(stepr, 'LICENSE'), join(out, 'vendor', 'stepr', 'LICENSE'));

console.log(`Pages site written to ${out}`);
