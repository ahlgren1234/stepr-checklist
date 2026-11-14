// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createChecklist,
  type Checklist,
  type ChecklistOptions,
  type ChecklistStep,
} from '../src/index.js';

const created: Checklist[] = [];

const setup = (overrides: Partial<ChecklistOptions> = {}) => {
  const container = document.createElement('div');
  document.body.append(container);
  const steps: ChecklistStep[] = [
    { id: 'profile', label: 'Complete your profile', onClick: vi.fn() },
    { id: 'invite', label: 'Invite a teammate', onClick: vi.fn() },
    { id: 'docs', label: 'Read the docs' },
  ];
  const checklist = createChecklist({
    container,
    title: 'Get started',
    steps,
    ...overrides,
  });
  created.push(checklist);
  return { checklist, container, steps, root: checklist.element };
};

const q = (root: ParentNode, sel: string): HTMLElement => {
  const found = root.querySelector(sel);
  if (!(found instanceof HTMLElement)) throw new Error(`missing ${sel}`);
  return found;
};

const button = (root: ParentNode, id: string): HTMLButtonElement => {
  const found = q(root, `[data-step-id="${id}"] button`);
  if (!(found instanceof HTMLButtonElement)) throw new Error('not a button');
  return found;
};

const progressBar = (root: ParentNode): HTMLProgressElement => {
  const found = q(root, 'progress');
  if (!(found instanceof HTMLProgressElement)) throw new Error('no progress');
  return found;
};

afterEach(() => {
  for (const checklist of created.splice(0)) checklist.destroy();
  document.body.replaceChildren();
  localStorage.clear();
});

describe('createChecklist rendering', () => {
  it('renders a labelled region with heading, progress and an ordered list', () => {
    const { root, container } = setup();

    expect(root.parentElement).toBe(container);
    expect(root.tagName).toBe('SECTION');
    const heading = q(root, 'h2');
    expect(heading.textContent).toBe('Get started');
    expect(root.getAttribute('aria-labelledby')).toBe(heading.id);

    const status = q(root, '[role="status"]');
    expect(status.textContent).toBe('0 of 3 steps complete');
    const progress = progressBar(root);
    expect(progress.max).toBe(3);
    expect(progress.value).toBe(0);
    expect(progress.getAttribute('aria-labelledby')).toBe(status.id);

    const items = root.querySelectorAll('ol > li');
    expect(items).toHaveLength(3);
  });

  it('uses native buttons for steps with onClick and plain text otherwise', () => {
    const { root } = setup();

    const profile = button(root, 'profile');
    expect(profile.type).toBe('button');
    expect(profile.textContent).toBe('Complete your profile, not completed');
    expect(q(profile, '[aria-hidden="true"]').textContent).toBe('');
    expect(root.querySelector('[data-step-id="docs"] button')).toBeNull();
    expect(q(root, '[data-step-id="docs"]').textContent).toBe(
      'Read the docs, not completed',
    );
    expect(root.querySelector('[role="dialog"], [aria-modal]')).toBeNull();
  });

  it('renders labels and title as text, not HTML', () => {
    const { root } = setup({
      title: '<img src=x onerror=alert(1)>',
      steps: [{ id: 'a', label: '<b>bold</b>' }],
    });
    expect(root.querySelector('img, b')).toBeNull();
    expect(q(root, 'h2').textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('supports a selector container and a custom heading level', () => {
    document.body.innerHTML = '<main><div id="onboarding"></div></main>';
    const checklist = createChecklist({
      container: '#onboarding',
      title: 'Setup',
      headingLevel: 3,
      steps: [],
    });
    created.push(checklist);
    expect(checklist.element.parentElement?.id).toBe('onboarding');
    expect(checklist.element.querySelector('h3')?.textContent).toBe('Setup');
  });

  it('renders an empty checklist without a list', () => {
    const { root } = setup({ steps: [] });
    expect(root.querySelector('ol')).toBeNull();
    expect(q(root, '[role="status"]').textContent).toBe('No steps');
    expect(progressBar(root).value).toBe(0);
  });

  it('applies custom messages', () => {
    const { root, checklist } = setup({
      messages: {
        progress: ({ completed, total }) =>
          `${String(completed)}/${String(total)} klart`,
        completed: 'klar',
        notCompleted: 'inte klar',
      },
    });
    checklist.complete('profile');
    expect(q(root, '[role="status"]').textContent).toBe('1/3 klart');
    expect(button(root, 'profile').textContent).toBe(
      'Complete your profile, klar',
    );
    expect(button(root, 'invite').textContent).toBe(
      'Invite a teammate, inte klar',
    );
  });
});

describe('createChecklist errors', () => {
  it.each([
    ['#missing', /not found/],
    ['[[invalid', /Invalid checklist container selector/],
  ])('rejects container %s', (container, message) => {
    expect(() => createChecklist({ container, title: 'T', steps: [] })).toThrow(
      message,
    );
  });

  it('rejects a non-element container and an empty title', () => {
    expect(() =>
      createChecklist({
        container: null as unknown as HTMLElement,
        title: 'T',
        steps: [],
      }),
    ).toThrow(/HTMLElement or a selector/);
    expect(() =>
      createChecklist({ container: document.body, title: ' ', steps: [] }),
    ).toThrow(/title/);
  });

  it('leaves the DOM untouched when controller options are invalid', () => {
    expect(() =>
      createChecklist({
        container: document.body,
        title: 'T',
        steps: [
          { id: 'a', label: 'A' },
          { id: 'a', label: 'B' },
        ],
      }),
    ).toThrow(/Duplicate/);
    expect(document.body.children).toHaveLength(0);
    expect(document.head.querySelector('style')).toBeNull();
  });
});

describe('createChecklist interaction and state', () => {
  it('calls onClick on activation without completing the step', () => {
    const { root, steps, checklist } = setup();
    button(root, 'profile').click();

    expect(steps[0]?.onClick).toHaveBeenCalledOnce();
    const [step, controller] =
      vi.mocked(steps[0]?.onClick)?.mock.calls[0] ?? [];
    expect(step).toEqual({
      id: 'profile',
      label: 'Complete your profile',
      completed: false,
    });
    expect(typeof controller?.complete).toBe('function');
    expect(checklist.isCompleted('profile')).toBe(false);
    expect(
      q(root, '[data-step-id="profile"]').hasAttribute('data-completed'),
    ).toBe(false);
  });

  it('re-renders on state changes and keeps focus on the active button', () => {
    const { root, checklist } = setup({
      steps: [
        {
          id: 'profile',
          label: 'Complete your profile',
          onClick: (step, list) => list.complete(step.id),
        },
        { id: 'invite', label: 'Invite a teammate' },
      ],
    });
    const profile = button(root, 'profile');
    profile.focus();
    profile.click();

    expect(document.activeElement).toBe(profile);
    expect(button(root, 'profile')).toBe(profile);
    expect(profile.textContent).toBe('Complete your profile, completed');
    expect(
      q(root, '[data-step-id="profile"]').hasAttribute('data-completed'),
    ).toBe(true);
    expect(q(root, '[role="status"]').textContent).toBe(
      '1 of 2 steps complete',
    );
    expect(progressBar(root).value).toBe(1);

    checklist.reset();
    expect(document.activeElement).toBe(profile);
    expect(profile.textContent).toBe('Complete your profile, not completed');
    expect(q(root, '[role="status"]').textContent).toBe(
      '0 of 2 steps complete',
    );
  });

  it('exposes the controller API and onChange', () => {
    const onChange = vi.fn();
    const { checklist } = setup({ onChange });
    expect(checklist.complete('invite')).toBe(true);
    expect(checklist.uncomplete('invite')).toBe(true);
    expect(checklist.complete('docs')).toBe(true);
    expect(checklist.getProgress()).toEqual({ completed: 1, total: 3 });
    expect(checklist.getState().steps.map((s) => s.completed)).toEqual([
      false,
      false,
      true,
    ]);
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it('restores and saves state with storageKey', () => {
    localStorage.setItem('k', JSON.stringify({ v: 1, completed: ['invite'] }));
    const { root, checklist } = setup({ storageKey: 'k' });

    expect(q(root, '[role="status"]').textContent).toBe(
      '1 of 3 steps complete',
    );
    expect(button(root, 'invite').textContent).toBe(
      'Invite a teammate, completed',
    );

    checklist.complete('profile');
    expect(JSON.parse(localStorage.getItem('k') ?? '')).toEqual({
      v: 1,
      completed: ['invite', 'profile'],
    });
  });

  it('keeps multiple instances independent with unique ids', () => {
    const a = setup();
    const b = setup();
    a.checklist.complete('profile');

    expect(b.checklist.isCompleted('profile')).toBe(false);
    expect(q(b.root, '[role="status"]').textContent).toBe(
      '0 of 3 steps complete',
    );
    const ids = [...document.querySelectorAll('[id]')].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('createChecklist styles and destroy', () => {
  it('shares one stylesheet and removes it with the last instance', () => {
    const a = setup();
    const b = setup();
    const styles = () =>
      document.head.querySelectorAll('style[data-stepr-checklist]');
    expect(styles()).toHaveLength(1);
    expect(document.head.firstElementChild).toBe(styles()[0]);

    a.checklist.destroy();
    expect(styles()).toHaveLength(1);
    b.checklist.destroy();
    expect(styles()).toHaveLength(0);
  });

  it('does not inject styles when injectStyles is false', () => {
    setup({ injectStyles: false });
    expect(document.head.querySelector('style')).toBeNull();
  });

  it('removes only its own element and stops rendering', () => {
    const container = document.createElement('div');
    container.innerHTML = '<p id="before">before</p>';
    document.body.append(container);
    const checklist = createChecklist({
      container,
      title: 'T',
      steps: [{ id: 'a', label: 'A' }],
    });
    container.insertAdjacentHTML('beforeend', '<p id="after">after</p>');
    const root = checklist.element;

    checklist.destroy();
    checklist.destroy();

    expect([...container.children].map((el) => el.id)).toEqual([
      'before',
      'after',
    ]);
    expect(root.isConnected).toBe(false);
    expect(checklist.complete('a')).toBe(true);
    expect(q(root, '[role="status"]').textContent).toBe('0 of 1 step complete');
  });
});
