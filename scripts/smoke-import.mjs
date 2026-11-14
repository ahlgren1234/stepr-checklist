// Verifies the packed package can be installed and imported by a clean,
// external consumer (no source-path imports), at runtime and type level.
import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const tsc = require.resolve('typescript/bin/tsc');
const root = mkdtempSync(join(tmpdir(), 'stepr-checklist-smoke-'));
const run = (cmd, args, cwd) =>
  execFileSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

try {
  run('pnpm', ['pack', '--pack-destination', root], process.cwd());
  const tarball = readdirSync(root).find((f) => f.endsWith('.tgz'));
  if (!tarball) throw new Error('pnpm pack produced no tarball');

  const consumer = join(root, 'consumer');
  mkdirSync(consumer);
  execFileSync('npm', ['init', '-y'], {
    cwd: consumer,
    stdio: 'ignore',
    shell: process.platform === 'win32',
  });
  run('npm', ['pkg', 'set', 'type=module'], consumer);
  run(
    'npm',
    ['install', '--no-audit', '--no-fund', '--silent', join(root, tarball)],
    consumer,
  );

  writeFileSync(
    join(consumer, 'index.js'),
    `import { createChecklistController } from '@stepr/checklist';
const checklist = createChecklistController({ steps: [{ id: 'a', label: 'A' }] });
checklist.complete('a');
const { completed, total } = checklist.getProgress();
if (completed !== 1 || total !== 1) throw new Error('unexpected progress');
console.log('runtime import ok');
`,
  );
  run('node', ['index.js'], consumer);

  writeFileSync(
    join(consumer, 'index.ts'),
    `import {
  createChecklistController,
  type ChecklistController,
  type ChecklistStep,
} from '@stepr/checklist';
const steps: ChecklistStep[] = [{ id: 'a', label: 'A' }];
const checklist: ChecklistController = createChecklistController({ steps });
const total: number = checklist.getProgress().total;
export { total };
`,
  );
  run(
    'node',
    [
      tsc,
      '--noEmit',
      '--strict',
      '--module',
      'nodenext',
      '--moduleResolution',
      'nodenext',
      'index.ts',
    ],
    consumer,
  );
  console.log('type import ok');
} finally {
  rmSync(root, { recursive: true, force: true });
}
