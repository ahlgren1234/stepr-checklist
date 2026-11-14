// Runs the README examples, exactly as written, against the built package.
// Each block is written to a temporary module inside the repository so that
// `import … from '@stepr/checklist'` resolves to dist/ through the package's
// own "exports" (and 'stepr' to the demo's devDependency). Requires
// `pnpm build`; run with `pnpm test:built`.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const root = join(import.meta.dirname, '..', '..');
const tmp = join(import.meta.dirname, '.examples');
const readme = readFileSync(join(root, 'README.md'), 'utf8');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  name: string;
  exports: Record<string, { default: string }>;
};

const examples = new Map(
  [
    ...readme.matchAll(
      /<!-- example: ([\w-]+) -->\n\n```\w+\n([\s\S]*?)\n```/g,
    ),
  ].map(([, name, code]) => [name ?? '', code ?? '']),
);
const example = (name: string): string => {
  const code = examples.get(name);
  if (code === undefined) throw new Error(`README has no "${name}" example`);
  return code;
};

/** Runs `code` as an ES module, as a browser would run the example. */
const run = async (name: string, code: string) => {
  mkdirSync(tmp, { recursive: true });
  const file = join(tmp, `${name}.mjs`);
  writeFileSync(file, code);
  vi.resetModules();
  await import(/* @vite-ignore */ file);
};

// Placeholders the examples call, standing in for app code.
const stubApp = <const N extends string>(...names: N[]) => {
  const fns = {} as Record<N, ReturnType<typeof vi.fn>>;
  for (const name of names) {
    fns[name] = vi.fn();
    vi.stubGlobal(name, fns[name]);
  }
  return fns;
};
/** The callback that the example passed to a stubbed `onSomething(cb)`. */
const callbackOf = (fn: ReturnType<typeof vi.fn>) => {
  const callback: unknown = fn.mock.calls[0]?.[0];
  if (typeof callback !== 'function') throw new Error('No callback passed');
  return callback as () => void;
};

const stepButton = (label: string) => {
  const button = [
    ...document.querySelectorAll<HTMLButtonElement>('#onboarding button'),
  ].find((b) => b.textContent.startsWith(label));
  if (!button) throw new Error(`No step button "${label}"`);
  return button;
};
const isDone = (id: string) =>
  document
    .querySelector(`#onboarding [data-step-id="${id}"]`)
    ?.hasAttribute('data-completed') ?? false;

beforeEach(() => {
  document.body.innerHTML = '<div id="onboarding"></div>';
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
  document.body.replaceChildren();
});

afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe('README examples', () => {
  it('quickstart: maps the package to its built entry point and runs', async () => {
    const page = new DOMParser().parseFromString(
      example('quickstart'),
      'text/html',
    );
    const importMap = JSON.parse(
      page.querySelector('script[type="importmap"]')?.textContent ?? '{}',
    ) as { imports: Record<string, string> };
    const entry = pkg.exports['.']?.default.replace(/^\.\//, '');
    expect(importMap.imports[pkg.name]).toBe(
      `/node_modules/${pkg.name}/${entry ?? ''}`,
    );

    document.body.innerHTML = page.body.innerHTML;
    const script = page.querySelector('script[type="module"]')?.textContent;
    await run('quickstart', script ?? '');
    expect(document.querySelector('#onboarding h2')?.textContent).toBe(
      'Get started',
    );
    stepButton('Complete your profile').click();
    expect(isDone('profile')).toBe(true);
    expect(document.querySelectorAll('#onboarding button')).toHaveLength(1);
  });

  it('app-events: completes steps from app callbacks only', async () => {
    const fns = stubApp(
      'openProfileForm',
      'showAllDoneMessage',
      'onProfileSaved',
      'onEmailVerified',
    );
    await run('app-events', example('app-events'));

    stepButton('Complete your profile').click();
    expect(fns.openProfileForm).toHaveBeenCalledTimes(1);
    expect(isDone('profile')).toBe(false);

    const profileSaved = callbackOf(fns.onProfileSaved);
    const emailVerified = callbackOf(fns.onEmailVerified);
    profileSaved();
    expect(isDone('profile')).toBe(true);
    expect(fns.showAllDoneMessage).not.toHaveBeenCalled();
    emailVerified();
    expect(isDone('verify')).toBe(true);
    expect(fns.showAllDoneMessage).toHaveBeenCalledTimes(1);
  });

  it('persistence: saves on change, keeps data on destroy, then clears', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem');
    await run('persistence', example('persistence'));

    expect(setItem.mock.calls).toEqual([
      ['my-app:onboarding', '{"v":1,"completed":["invite"]}'],
      ['my-app:onboarding', '{"v":1,"completed":[]}'],
    ]);
    expect(removeItem).toHaveBeenCalledWith('my-app:onboarding');
    expect(localStorage.getItem('my-app:onboarding')).toBeNull();
    expect(document.querySelector('#onboarding')?.children).toHaveLength(0);
  });

  describe('stepr', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <button id="new-project">New project</button>
        <button id="invite">Invite</button>
        <div id="onboarding"></div>`;
    });

    it('completes the step when the tour finishes', async () => {
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
        DOMRect.fromRect({ x: 10, y: 10, width: 120, height: 40 }),
      );
      Element.prototype.scrollIntoView = vi.fn();
      await run('stepr', example('stepr'));

      stepButton('Take the product tour').click();
      expect(isDone('tour')).toBe(false);
      const button = (label: string) =>
        [
          ...document.querySelectorAll<HTMLButtonElement>(
            '[data-stepr-tooltip] button',
          ),
        ].find((b) => b.textContent === label);
      button('Next')?.click();
      button('Done')?.click();
      expect(isDone('tour')).toBe(true);
    });

    it('leaves the step open when the tour is closed', async () => {
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
        DOMRect.fromRect({ x: 10, y: 10, width: 120, height: 40 }),
      );
      Element.prototype.scrollIntoView = vi.fn();
      await run('stepr-close', example('stepr'));

      stepButton('Take the product tour').click();
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
      expect(document.querySelector('[data-stepr-tooltip]')).toBeNull();
      expect(isDone('tour')).toBe(false);
    });

    it('warns when no tour target is visible', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await run('stepr-hidden', example('stepr')); // jsdom has no layout
      stepButton('Take the product tour').click();
      expect(warn).toHaveBeenCalledWith('No tour target is visible');
      expect(isDone('tour')).toBe(false);
    });
  });
});
