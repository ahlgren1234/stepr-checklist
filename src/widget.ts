import {
  createChecklistController,
  type ChecklistController,
  type ChecklistControllerOptions,
  type ChecklistProgress,
  type ChecklistState,
} from './controller.js';
import { checklistCss } from './styles.js';

/** Text used by the widget; override for localization. */
export interface ChecklistMessages {
  /** Visible progress text, also announced politely when progress changes. */
  readonly progress?: (progress: ChecklistProgress) => string;
  /** Screen-reader-only status appended to a completed step's name. */
  readonly completed?: string;
  /** Screen-reader-only status appended to an incomplete step's name. */
  readonly notCompleted?: string;
}

export interface ChecklistOptions extends ChecklistControllerOptions {
  /**
   * Element to render into, or a CSS selector resolved with
   * `document.querySelector`. The widget is appended; existing content is kept.
   */
  readonly container: HTMLElement | string;
  /** Heading text; also the accessible name of the widget's region. */
  readonly title: string;
  /** Heading level for the title. Default: 2. */
  readonly headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Text overrides, e.g. for localization. */
  readonly messages?: ChecklistMessages;
  /**
   * Whether to insert the default stylesheet into the document. Default: true.
   * Set to `false` to supply styles yourself (e.g. under a strict CSP), for
   * example from the exported `checklistCss`.
   */
  readonly injectStyles?: boolean;
}

/** A rendered checklist widget: the controller API plus DOM lifecycle. */
export interface Checklist extends ChecklistController {
  /** The widget's root element (owned by the widget). */
  readonly element: HTMLElement;
  /**
   * Removes the widget's element, stops re-rendering and releases the default
   * stylesheet when no other widget uses it. Other container content is left
   * untouched. Idempotent. State methods keep working afterwards.
   */
  destroy(): void;
}

const defaultProgress = ({ completed, total }: ChecklistProgress): string =>
  total === 0
    ? 'No steps'
    : `${String(completed)} of ${String(total)} ${total === 1 ? 'step' : 'steps'} complete`;

const STYLE_ATTR = 'data-stepr-checklist';
const styleUsers = new WeakMap<
  Document,
  { el: HTMLStyleElement; count: number }
>();

const acquireStyles = (doc: Document): (() => void) => {
  let entry = styleUsers.get(doc);
  if (!entry) {
    const el = doc.createElement('style');
    el.setAttribute(STYLE_ATTR, '');
    el.textContent = checklistCss;
    doc.head.prepend(el);
    entry = { el, count: 0 };
    styleUsers.set(doc, entry);
  }
  entry.count += 1;
  const owned = entry;
  return () => {
    owned.count -= 1;
    if (owned.count === 0) {
      owned.el.remove();
      styleUsers.delete(doc);
    }
  };
};

const resolveContainer = (container: HTMLElement | string): HTMLElement => {
  if (typeof container !== 'string') {
    // Duck-typed so elements from other realms (iframes) are accepted.
    if (
      typeof container === 'object' &&
      (container as Partial<HTMLElement> | null)?.nodeType === 1
    ) {
      return container;
    }
    throw new Error('Checklist container must be an HTMLElement or a selector');
  }
  let found: Element | null;
  try {
    found = document.querySelector(container);
  } catch {
    throw new Error(`Invalid checklist container selector: "${container}"`);
  }
  if (!(found instanceof HTMLElement)) {
    throw new Error(`Checklist container not found: "${container}"`);
  }
  return found;
};

let instanceCount = 0;

/**
 * Renders an accessible checklist into `container`.
 *
 * Steps with an `onClick` render as native buttons; activating one (click,
 * Enter or Space) calls `onClick` and never changes completion. Steps without
 * `onClick` render as plain text. The widget re-renders in place on every
 * state change, so focus is preserved.
 * @throws {Error} If the container is missing or invalid, `title` is empty,
 * or the controller options are invalid (see `createChecklistController`).
 */
export function createChecklist(options: ChecklistOptions): Checklist {
  const { container, title, headingLevel = 2, messages = {} } = options;
  const host = resolveContainer(container);
  if (typeof title !== 'string' || title.trim() === '') {
    throw new Error('Checklist title must be a non-empty string');
  }
  if (![1, 2, 3, 4, 5, 6].includes(headingLevel)) {
    throw new Error('Checklist headingLevel must be an integer from 1 to 6');
  }

  const controllerOptions: ChecklistControllerOptions = {
    steps: options.steps,
    ...(options.onChange && { onChange: options.onChange }),
    ...(options.storageKey !== undefined && { storageKey: options.storageKey }),
  };
  const controller = createChecklistController(controllerOptions);

  const formatProgress = messages.progress ?? defaultProgress;
  const completedText = messages.completed ?? 'completed';
  const notCompletedText = messages.notCompleted ?? 'not completed';

  const doc = host.ownerDocument;
  const el = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className?: string,
  ): HTMLElementTagNameMap[K] => {
    const node = doc.createElement(tag);
    if (className) node.className = `stepr-checklist__${className}`;
    return node;
  };

  instanceCount += 1;
  const id = `stepr-checklist-${String(instanceCount)}`;

  const root = el('section');
  root.className = 'stepr-checklist';
  root.setAttribute('aria-labelledby', `${id}-title`);

  const heading = el(`h${String(headingLevel)}` as 'h2', 'title');
  heading.id = `${id}-title`;
  heading.textContent = title;

  // Visible progress text doubles as a polite live region.
  const progressText = el('p', 'progress-text');
  progressText.id = `${id}-progress`;
  progressText.setAttribute('role', 'status');

  const progressBar = el('progress', 'progress');
  progressBar.setAttribute('aria-labelledby', progressText.id);

  root.append(heading, progressText, progressBar);

  const items = new Map<string, { item: HTMLLIElement; status: HTMLElement }>();
  const { steps } = controller.getState();
  if (steps.length > 0) {
    const list = el('ol', 'steps');
    const definitions = new Map(options.steps.map((step) => [step.id, step]));
    for (const step of steps) {
      const item = el('li', 'step');
      item.dataset['stepId'] = step.id;

      const actionable = definitions.get(step.id)?.onClick !== undefined;
      const body = actionable ? el('button', 'action') : el('span', 'static');
      if (body instanceof HTMLButtonElement) {
        body.type = 'button';
        body.addEventListener('click', () => {
          controller.click(step.id);
        });
      }

      const marker = el('span', 'marker');
      marker.setAttribute('aria-hidden', 'true');
      const label = el('span', 'label');
      label.textContent = step.label;
      const status = el('span', 'visually-hidden');

      body.append(marker, label, status);
      item.append(body);
      list.append(item);
      items.set(step.id, { item, status });
    }
    root.append(list);
  }

  // Updates existing nodes in place; never recreates them, so focus is kept.
  const render = (state: ChecklistState): void => {
    const { completed, total } = state.progress;
    progressText.textContent = formatProgress(state.progress);
    progressBar.max = Math.max(total, 1);
    progressBar.value = completed;
    for (const step of state.steps) {
      const nodes = items.get(step.id);
      if (!nodes) continue;
      nodes.item.toggleAttribute('data-completed', step.completed);
      nodes.status.textContent = `, ${step.completed ? completedText : notCompletedText}`;
    }
  };

  render(controller.getState());
  const unsubscribe = controller.subscribe(render);
  const releaseStyles =
    options.injectStyles === false ? undefined : acquireStyles(doc);
  host.append(root);

  let destroyed = false;
  return {
    ...controller,
    element: root,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unsubscribe();
      root.remove();
      releaseStyles?.();
    },
  };
}
