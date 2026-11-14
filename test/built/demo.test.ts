// Runs demo/main.js against the built package (dist/) in jsdom.
// Requires `pnpm build`; run with `pnpm test:built`.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const root = join(import.meta.dirname, '..', '..');
const demoHtml = readFileSync(join(root, 'demo/index.html'), 'utf8');
const STORAGE_KEY = 'stepr-checklist-demo:onboarding';

// Specifiers are variables so `pnpm typecheck` doesn't need dist/ to exist.
const importModule = (specifier: string): Promise<Record<string, unknown>> =>
  import(/* @vite-ignore */ specifier) as Promise<Record<string, unknown>>;

/** Loads the demo into a fresh document, as a page load would. */
const loadDemo = async () => {
  const parsed = new DOMParser().parseFromString(demoHtml, 'text/html');
  document.body.innerHTML = parsed.body.innerHTML;
  vi.resetModules();
  await importModule(join(root, 'demo/main.js'));
};

function $(selector: string): HTMLElement;
function $<T extends HTMLElement>(selector: string, type: new () => T): T;
function $(selector: string, type: new () => HTMLElement = HTMLElement) {
  const element = document.querySelector(selector);
  if (!(element instanceof type)) throw new Error(`Missing ${selector}`);
  return element;
}
const click = (selector: string) => {
  $(selector).click();
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
const log = () => $('#event-log').textContent;
const submit = (formSelector: string, value: string) => {
  const form = $(formSelector, HTMLFormElement);
  const input = form.querySelector('input');
  if (input) input.value = value;
  form.requestSubmit();
};

/** Gives every element a layout box so Stepr treats targets as visible. */
const fakeLayout = () => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
    DOMRect.fromRect({ x: 10, y: 10, width: 120, height: 40 }),
  );
  Element.prototype.scrollIntoView = vi.fn();
};
const tourButton = (label: string) => {
  const button = [
    ...document.querySelectorAll<HTMLButtonElement>(
      '[data-stepr-tooltip] button',
    ),
  ].find((b) => b.textContent === label);
  if (!button) throw new Error(`No tour button "${label}"`);
  return button;
};

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  document.body.replaceChildren();
});

describe('demo', () => {
  it('imports the built package', async () => {
    await loadDemo();
    const byName = await importModule('@stepr/checklist');
    const dist = await importModule(join(root, 'dist/index.js'));
    expect(byName).toBe(dist);
    expect(
      document.querySelector('style[data-stepr-checklist]')?.textContent,
    ).toBe(dist['checklistCss']);
  });

  it('renders the onboarding checklist and the reference table', async () => {
    await loadDemo();
    expect($('#onboarding h2').textContent).toBe('Get started with Acme');
    expect(document.querySelectorAll('#onboarding li')).toHaveLength(5);
    expect(document.querySelectorAll('#onboarding button')).toHaveLength(4);
    expect($('#setup-pill').textContent).toBe('Setup 0/5');
    expect(document.querySelectorAll('#css-props tr')).toHaveLength(12);
  });

  it('completes a step from the app event, not from opening it', async () => {
    await loadDemo();
    const step = stepButton('Complete your profile');
    step.focus();
    step.click();
    expect($('#panel-profile').hidden).toBe(false);
    expect(document.activeElement).toBe($('#panel-profile input'));
    expect(isDone('profile')).toBe(false);

    submit('#panel-profile', 'Ada');
    expect(isDone('profile')).toBe(true);
    expect($('#panel-profile').hidden).toBe(true);
    expect(document.activeElement).toBe(step);
    expect($('#setup-pill').textContent).toBe('Setup 1/5');
    expect(log()).toContain("complete('profile') → true");
    expect(log()).toContain('1 of 5 complete');
  });

  it('completes steps opened from the app toolbar', async () => {
    await loadDemo();
    click('#app-new-project');
    submit('#panel-project', 'Website');
    expect($('#project-list').textContent).toContain('Website');
    click('#app-invite');
    submit('#panel-invite', 'sam@example.com');
    expect(isDone('project')).toBe(true);
    expect(isDone('invite')).toBe(true);
  });

  it('cancelling a form leaves the step incomplete', async () => {
    await loadDemo();
    stepButton('Invite a teammate').click();
    click('#panel-invite [data-cancel]');
    expect($('#panel-invite').hidden).toBe(true);
    expect(isDone('invite')).toBe(false);
  });

  it('drives the API from the playground', async () => {
    await loadDemo();
    click('#ctl-next');
    expect(isDone('profile')).toBe(true);
    click('#ctl-verify');
    click('#ctl-verify');
    expect(isDone('verify')).toBe(true);
    expect(log()).toContain("complete('verify') → false");
    click('#ctl-reset');
    expect(isDone('profile')).toBe(false);
    expect(log()).toContain('reset() → true');
  });

  it('shows the completion message and starts over', async () => {
    await loadDemo();
    for (let i = 0; i < 5; i += 1) click('#ctl-next');
    expect($('#done-banner').hidden).toBe(false);
    expect(log()).toContain('All steps complete');
    click('#ctl-next');
    expect(log()).toContain('Every step is already complete');

    click('#done-reset');
    expect($('#done-banner').hidden).toBe(true);
    expect(document.activeElement).toBe(stepButton('Complete your profile'));
  });

  it('destroys and re-creates the widget, keeping state', async () => {
    await loadDemo();
    click('#ctl-destroy');
    expect($('#onboarding').children).toHaveLength(0);
    click('#ctl-next'); // the controller keeps working
    expect($('#setup-pill').textContent).toBe('Setup 1/5');
    click('#ctl-destroy');
    expect(isDone('profile')).toBe(true);
    expect(document.querySelectorAll('#onboarding section')).toHaveLength(1);
  });

  it('persists progress with storageKey and restores it on reload', async () => {
    await loadDemo();
    click('#ctl-next');
    const toggle = $('#ctl-persist', HTMLInputElement);
    toggle.click(); // checks it and fires change
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '')).toEqual({
      v: 1,
      completed: ['profile'],
    });
    expect(isDone('profile')).toBe(true);

    await loadDemo();
    expect($('#ctl-persist', HTMLInputElement).checked).toBe(true);
    expect(isDone('profile')).toBe(true);
    expect(log()).toContain('Restored 1 completed step from localStorage');

    $('#ctl-persist').click(); // turn off: clears the saved value
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(isDone('profile')).toBe(true);
  });

  it('starts a Stepr tour and completes the step when it finishes', async () => {
    await loadDemo();
    fakeLayout();
    const step = stepButton('Take the product tour');
    step.focus();
    step.click();
    expect(document.querySelector('[data-stepr-tooltip]')).not.toBeNull();
    expect(isDone('tour')).toBe(false);
    for (const label of ['Next', 'Next', 'Next', 'Done']) {
      tourButton(label).click();
    }
    expect(document.querySelector('[data-stepr-tooltip]')).toBeNull();
    expect(isDone('tour')).toBe(true);
    expect(document.activeElement).toBe(step);
    expect(log()).toContain('Tour finished');
  });

  it('leaves the step open when the tour is closed early', async () => {
    await loadDemo();
    fakeLayout();
    stepButton('Take the product tour').click();
    tourButton('Close').click();
    expect(isDone('tour')).toBe(false);
    expect(log()).toContain('Tour closed early');
  });

  it('reports when no tour target is visible', async () => {
    await loadDemo(); // jsdom has no layout, so Stepr finds no target
    stepButton('Take the product tour').click();
    expect(log()).toContain('tour.start() → false');
    expect(isDone('tour')).toBe(false);
  });

  it('applies a theme class to the container', async () => {
    await loadDemo();
    $('input[name="theme"][value="theme-midnight"]').click();
    expect($('#onboarding').className).toBe('theme-midnight');
  });

  it('copies an example, or selects it without the Clipboard API', async () => {
    await loadDemo();
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    click('[data-copy="stepr"]');
    await vi.waitFor(() => {
      expect($('[data-copy="stepr"]').textContent).toBe('Copied');
    });
    expect(writeText).toHaveBeenCalledWith(
      $('pre[data-example="stepr"]').textContent,
    );

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });
    click('[data-copy="theme"]');
    await vi.waitFor(() => {
      expect($('[data-copy="theme"]').textContent).toBe('Selected');
    });
    expect(getSelection()?.toString()).toBe(
      $('pre[data-example="theme"]').textContent,
    );
  });
});
