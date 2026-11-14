# stepr-checklist

Lightweight, framework-agnostic onboarding checklist widget for the web.

> **Status: pre-release.** The package is `private` and not published. The
> checklist widget, state controller and optional persistence exist; there is
> no demo site yet. The public API is **provisional** — expect breaking
> changes until v0.1.0.

## Intended scope

`@stepr/checklist` will be a small, dependency-free, customizable onboarding
checklist widget that works with any framework (or none). Planned work is tracked
in GitHub issues: checklist state and controller API, optional `localStorage`
persistence, an accessible DOM widget, and docs/demo.

## Checklist widget

`createChecklist` renders an accessible checklist into an existing element and
returns the [controller API](#checklist-controller) plus `element` and
`destroy()`.

```ts
import { createChecklist } from '@stepr/checklist';

const checklist = createChecklist({
  container: '#onboarding', // or an HTMLElement
  title: 'Get started',
  steps: [
    {
      id: 'profile',
      label: 'Complete your profile',
      onClick: (step, checklist) => {
        openProfileForm(); // activation never completes a step by itself
      },
    },
    { id: 'invite', label: 'Invite a teammate', onClick: openInviteDialog },
    { id: 'docs', label: 'Read the docs' }, // no onClick: rendered as text
  ],
  storageKey: 'my-app:onboarding', // optional, see Persistence
});

// Later, e.g. when the profile form is saved:
checklist.complete('profile');

checklist.destroy(); // removes the widget only
```

| Option         | Default | Description                                                                           |
| -------------- | ------- | ------------------------------------------------------------------------------------- |
| `container`    | —       | `HTMLElement` or CSS selector (`document.querySelector`). The widget is **appended**. |
| `title`        | —       | Heading text and the accessible name of the widget's region. Must be non-empty.       |
| `steps`        | —       | As for the controller. May be empty.                                                  |
| `headingLevel` | `2`     | `1`–`6`; pick the level that fits your page outline.                                  |
| `storageKey`   | —       | Opt-in `localStorage` persistence (see [Persistence](#persistence)).                  |
| `onChange`     | —       | Called after every state change.                                                      |
| `messages`     | English | `{ progress(progress), completed, notCompleted }` text overrides for localization.    |
| `injectStyles` | `true`  | Insert the default stylesheet. Set `false` to style it yourself (e.g. strict CSP).    |

Behavior:

- **Rendering:** a `<section>` labelled by its heading, a progress text
  (`"1 of 3 steps complete"`), a native `<progress>` bar and an `<ol>` of
  steps. Steps with `onClick` are native `<button type="button">`s, so mouse,
  touch, Enter and Space all work; steps without `onClick` are plain text.
  Titles and labels are rendered as text, never HTML.
- **Activation** calls the step's `onClick(step, checklist)` and **never**
  changes completion. Call `checklist.complete(id)` when the task is actually
  done (from `onClick` or anywhere else). Completed steps stay activatable.
- **Updates:** the widget updates its existing nodes in place on every state
  change, so keyboard focus is not lost.
- **Errors:** `createChecklist` throws an `Error` — before touching the DOM — if
  the container is not an element, the selector is invalid or matches nothing,
  the title is empty, `headingLevel` is out of range, or the controller options
  are invalid.
- **Empty steps:** renders the heading, `"No steps"` and an empty progress bar,
  without a list.
- **Instances** are independent; element ids are unique per instance.
- **`destroy()`** removes the widget's own element and state subscription, and
  removes the shared stylesheet when no other widget uses it. Other container
  content is untouched. It is idempotent; the controller methods keep working
  afterwards but nothing is rendered.
- `createChecklist` needs a DOM; importing the package does not.

### Accessibility

- Each step's accessible name includes its state, e.g. "Complete your profile,
  completed" (visually hidden text, customizable via `messages`). The visual
  check mark is hidden from assistive technology.
- The progress text is a polite live region (`role="status"`), so changes are
  announced without moving focus. The `<progress>` bar is labelled by it.
- Focus is shown with a visible `:focus-visible` outline; targets are at least
  44px tall; transitions are disabled under `prefers-reduced-motion`.
- No dialog, ARIA widget roles or custom key handling: only native elements.

See [docs/manual-testing.md](docs/manual-testing.md) for the manual keyboard
and screen-reader smoke test.

### Styling

The default stylesheet is inserted once at the start of `<head>` (so your own
rules of equal specificity win) and uses BEM-style classes such as
`.stepr-checklist`, `.stepr-checklist__step` and `.stepr-checklist__action`;
completed steps have a `data-completed` attribute. Theme it with custom
properties on `.stepr-checklist` or any ancestor:

```css
.stepr-checklist {
  --stepr-checklist-accent: #7c3aed; /* check mark, progress bar */
  --stepr-checklist-accent-foreground: #fff; /* check mark glyph */
  --stepr-checklist-background: #fff;
  --stepr-checklist-foreground: #1f2937;
  --stepr-checklist-muted: #4b5563; /* progress text, completed labels */
  --stepr-checklist-border: #d1d5db;
  --stepr-checklist-hover: #f3f4f6;
  --stepr-checklist-focus: #2563eb; /* focus outline */
  --stepr-checklist-radius: 0.5rem;
  --stepr-checklist-padding: 1rem;
  --stepr-checklist-gap: 0.5rem;
  --stepr-checklist-font-family: inherit;
}
```

With `injectStyles: false`, include the exported `checklistCss` string (or
your own styles) yourself. Keep sufficient contrast when changing colors.

## Checklist controller

The core is a DOM-free state controller that the widget is built on; it can
also be used directly to build your own UI.

```ts
import { createChecklistController } from '@stepr/checklist';

const checklist = createChecklistController({
  steps: [
    {
      id: 'profile',
      label: 'Complete your profile',
      onClick: (step, checklist) => {
        openProfileForm(); // completion is up to you:
        // checklist.complete(step.id);
      },
    },
    { id: 'invite', label: 'Invite a teammate' },
  ],
  onChange: (state) => console.log(state.progress), // { completed, total }
});

checklist.complete('invite'); // true
checklist.getProgress(); // { completed: 1, total: 2 }
const unsubscribe = checklist.subscribe((state) => render(state));
```

| Method            | Behavior                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------- |
| `complete(id)`    | Marks a step complete. Returns `true` if state changed, `false` if it was already complete. |
| `uncomplete(id)`  | Marks a step incomplete. Returns `true` if state changed, `false` if it was not complete.   |
| `reset()`         | Marks every step incomplete. Returns `true` if anything was complete.                       |
| `click(id)`       | Calls the step's `onClick(step, checklist)`, if any. **Never changes completion.**          |
| `isCompleted(id)` | Whether a step is complete.                                                                 |
| `getProgress()`   | `{ completed, total }`.                                                                     |
| `getState()`      | Fresh snapshot: `{ steps: [{ id, label, completed }], progress }`, in definition order.     |
| `subscribe(fn)`   | Calls `fn(state)` after every change. Returns an unsubscribe function.                      |

Behavior details:

- **Step ids** must be non-empty strings, unique within a checklist. Duplicate
  or empty ids throw when the controller is created.
- **Unknown ids** passed to `complete`, `uncomplete`, `click` or `isCompleted`
  throw an `Error` and leave state unchanged.
- **Repeated actions** (completing a complete step, resetting an empty
  checklist, …) are no-ops: they return `false` and send no notification.
- **Empty checklists** are allowed; progress is `{ completed: 0, total: 0 }`.
- **Notifications** are sent synchronously after each actual change: first
  `onChange`, then subscribers in subscription order. Listeners added during a
  notification receive the next one. If listeners throw, the others are still
  called, then the error is rethrown (an `AggregateError` if several threw);
  the state change itself is kept.
- **Instances** are fully independent; there is no shared module state.
- Steps are copied on creation, and snapshots are fresh objects, so mutating
  either does not affect the controller. All steps start incomplete unless
  restored from storage (see below).

## Persistence

Pass `storageKey` to save progress in `localStorage`. Without it, the
controller is memory-only and never touches storage.

```ts
const checklist = createChecklistController({
  steps,
  storageKey: 'my-app:onboarding',
});
```

- **Restoring:** completed step ids are read once, when the controller is
  created. Ids of steps that no longer exist are ignored. Restoring does not
  call `onChange` or subscribers; read the initial state with `getState()`.
- **Saving:** the completed ids are written after every change made by
  `complete`, `uncomplete` or `reset`, before listeners are notified. No-op
  actions and `click` do not write.
- **Format:** `{"v":1,"completed":["id", ...]}` under the exact key you pass.
  Choose an app-specific key to avoid collisions with other scripts on the
  same origin. An empty `storageKey` throws.
- **Failures are non-fatal:** if `localStorage` is unavailable or blocked, the
  stored value is malformed or from an unknown format version, or a write fails
  (e.g. quota exceeded), the checklist silently continues in memory. Malformed
  data is treated as "nothing stored".
- **Scope:** storage is per origin and per browser profile. It is not synced
  across devices, and controllers sharing a key in different tabs do not update
  each other live (the last write wins).
- `localStorage` is only accessed when a controller with a `storageKey` is
  created or changed, never on import, so the package is safe to import during
  server-side rendering.

## Assumptions

- **ESM only.** Published as native ES modules with TypeScript declarations;
  no CommonJS build. CommonJS consumers can use dynamic `import()`.
- **No runtime dependencies.** Development tooling only.
- **Browser-first.** Compiled to ES2022 for modern browsers; Node.js is only used for tooling and tests.
- **Node.js 24** (see `.nvmrc`) and **pnpm** (version pinned via `packageManager`;
  enable with `corepack enable`).
- **TypeScript 6.0.x**, since `typescript-eslint` does not yet support TypeScript 7.
- The build is plain `tsc`; a bundler can be introduced later if needed.

## Development

```sh
corepack enable
pnpm install

pnpm typecheck      # type-check sources and tests
pnpm lint           # ESLint (typescript-eslint, strict type-checked)
pnpm format         # format with Prettier (pnpm format:check to verify)
pnpm test           # run tests with Vitest + jsdom (pnpm test:watch for watch mode)
pnpm build          # compile to dist/ with declarations
pnpm check:package  # publint + attw + install/import the packed tarball in a clean consumer
pnpm check          # all of the above, as run in CI
```

`pnpm check:package` requires a prior `pnpm build`. CI runs every check on pull
requests and pushes to `main`; it never publishes.

## Contributing

Work on a feature branch, run `pnpm check` before opening a pull request, and
reference the relevant issue.
