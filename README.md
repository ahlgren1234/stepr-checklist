# stepr-checklist

Lightweight, framework-agnostic onboarding checklist widget for the web.

> **Status: pre-release.** The package is `private` and not published. The
> checklist widget, state controller, optional persistence and a local demo
> exist. The public API is **provisional** — expect breaking changes until
> v0.1.0.

`@stepr/checklist` is a small, dependency-free onboarding checklist widget
that works with any framework, or none. Steps are native buttons. Your app
decides when a step is complete, and progress can optionally be saved in
`localStorage`.

- [Demo](#demo) · [Quick start](#quick-start) · [Widget](#checklist-widget) ·
  [Controller](#checklist-controller) · [Persistence](#persistence) ·
  [Examples](#examples) · [Stepr integration](#starting-a-stepr-tour-from-a-step)
  · [Limitations](#limitations) · [Browser support](#browser-support)

## Demo

The [`demo/`](demo/) folder has an interactive page with no framework. It
shows a made-up app whose onboarding steps are completed by app events,
programmatic completion, `reset()`, `destroy()`, opt-in persistence, themes, a
[Stepr](https://github.com/ahlgren1234/stepr) tour started from a step, and
the README examples with copy buttons.

```sh
pnpm install
pnpm demo # builds dist/, then serves http://localhost:4173/demo/
```

The demo imports the **built package** (`dist/`) through an import map, using
the same `import … from '@stepr/checklist'` as the examples. Stepr is a
`devDependency` used only by the demo. It is not a dependency of the package.
`pnpm test:built` runs the demo and the README examples against `dist/` in
jsdom. The demo isn't deployed anywhere. The local server
([`scripts/serve-demo.mjs`](scripts/serve-demo.mjs)) listens on `127.0.0.1`
only, and serves just the `.html`, `.css` and `.js` files in `demo/`, `dist/`
and `node_modules/stepr/dist/`. It refuses every other path, including
`.git`, `.env` and config files.

## Quick start

The package isn't published yet. To try it in another project, build a tarball
with `pnpm build && pnpm pack` and install the resulting
`stepr-checklist-0.0.0.tgz`. With a bundler, `import` it as usual. Without
one, map the package name in an [import map][import-maps] and serve the page
over HTTP, because ES modules don't load from `file://`:

<!-- example: quickstart -->

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Checklist</title>
    <script type="importmap">
      {
        "imports": {
          "@stepr/checklist": "/node_modules/@stepr/checklist/dist/index.js"
        }
      }
    </script>
  </head>
  <body>
    <div id="onboarding"></div>
    <script type="module">
      import { createChecklist } from '@stepr/checklist';

      createChecklist({
        container: '#onboarding',
        title: 'Get started',
        steps: [
          {
            id: 'profile',
            label: 'Complete your profile',
            onClick: (step, checklist) => checklist.complete(step.id),
          },
          { id: 'docs', label: 'Read the docs' },
        ],
      });
    </script>
  </body>
</html>
```

[import-maps]: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/importmap

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

What has been verified: the structure above (roles, names, live region,
focus retention) is covered by jsdom tests, and keyboard operation and focus
retention were checked in Playwright's bundled browsers (see
[Browser support](#browser-support)). It has **not** been tested with a screen
reader, and the widget hasn't been audited against WCAG. See
[docs/manual-testing.md](docs/manual-testing.md) for the manual keyboard and
screen-reader test.

### Styling

The default stylesheet is inserted once at the start of `<head>` (so your own
rules of equal specificity win) and uses BEM-style classes such as
`.stepr-checklist`, `.stepr-checklist__step` and `.stepr-checklist__action`;
completed steps have a `data-completed` attribute. Theme it with these custom
properties on `.stepr-checklist` or any ancestor:

| Property                              | Default   | Used for                                        |
| ------------------------------------- | --------- | ----------------------------------------------- |
| `--stepr-checklist-accent`            | `#2563eb` | Completed marker, progress bar (`accent-color`) |
| `--stepr-checklist-accent-foreground` | `#ffffff` | Check mark glyph                                |
| `--stepr-checklist-background`        | `#ffffff` | Widget background                               |
| `--stepr-checklist-foreground`        | `#1f2937` | Text                                            |
| `--stepr-checklist-muted`             | `#4b5563` | Progress text, completed labels                 |
| `--stepr-checklist-border`            | `#d1d5db` | Widget border, incomplete marker ring           |
| `--stepr-checklist-hover`             | `#f3f4f6` | Step background on hover                        |
| `--stepr-checklist-focus`             | `#2563eb` | Focus outline                                   |
| `--stepr-checklist-radius`            | `0.5rem`  | Widget corner radius (steps use 75% of it)      |
| `--stepr-checklist-padding`           | `1rem`    | Widget padding                                  |
| `--stepr-checklist-gap`               | `0.5rem`  | Spacing between parts (steps use half of it)    |
| `--stepr-checklist-font-family`       | `inherit` | Font                                            |

<!-- example: theme -->

```css
/* <div id="onboarding" class="theme-violet"></div> */
.theme-violet {
  --stepr-checklist-accent: #6d28d9;
  --stepr-checklist-focus: #6d28d9;
  --stepr-checklist-background: #faf5ff;
  --stepr-checklist-hover: #f3e8ff;
  --stepr-checklist-border: #8b5cf6;
  --stepr-checklist-radius: 1rem;
}
```

With `injectStyles: false`, include the exported `checklistCss` string (or
your own styles) yourself, for example in a `<style>` with a CSP nonce or a
shadow root. Check contrast when you change colors: the default border
(`#d1d5db` on white, about 1.5:1) is also the incomplete marker's ring, which is
below the 3:1 that WCAG 1.4.11 asks of non-text indicators. A step's state is
also conveyed by its accessible name and the progress text; visually it is
shown only by the marker and the muted label color.

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

## Examples

All examples are plain JavaScript. They also work unchanged as TypeScript,
since the package ships its own types. Placeholders such as
`openProfileForm` stand for your app's code. `pnpm test:built` runs each of
these blocks against the built package, and checks that the demo shows the
same text.

### Completing steps from your app

<!-- example: app-events -->

```js
import { createChecklist } from '@stepr/checklist';

const checklist = createChecklist({
  container: '#onboarding',
  title: 'Get started',
  steps: [
    {
      id: 'profile',
      label: 'Complete your profile',
      onClick: () => openProfileForm(), // opening the form does not complete it
    },
    { id: 'verify', label: 'Verify your email address' }, // text only
  ],
  onChange: ({ progress }) => {
    if (progress.completed === progress.total) showAllDoneMessage();
  },
});

// Complete steps when the work is actually done, from anywhere in your app:
onProfileSaved(() => checklist.complete('profile'));
onEmailVerified(() => checklist.complete('verify'));
```

If a step's `onClick` moves focus, for example into a form, move it back
afterwards (the demo returns it to the step that opened the form). The widget
doesn't manage focus outside itself.

### Persistence, reset and cleanup

<!-- example: persistence -->

```js
import { createChecklist } from '@stepr/checklist';

const checklist = createChecklist({
  container: '#onboarding',
  title: 'Get started',
  steps: [
    { id: 'profile', label: 'Complete your profile' },
    { id: 'invite', label: 'Invite a teammate' },
  ],
  storageKey: 'my-app:onboarding', // restored on creation, saved on change
});

checklist.complete('invite'); // true, and saved
checklist.complete('invite'); // false: already complete, nothing saved
checklist.getProgress(); // { completed: 1, total: 2 }

checklist.reset(); // marks every step incomplete, and saves that
checklist.destroy(); // removes the widget; saved progress is kept
localStorage.removeItem('my-app:onboarding'); // forget saved progress
```

### Starting a Stepr tour from a step

[Stepr](https://github.com/ahlgren1234/stepr) is a separate tour library.
`@stepr/checklist` doesn't import it or depend on it. Install it yourself
(`npm install stepr`) if you want tours, and connect the two in your app:

<!-- example: stepr -->

```js
import { createChecklist } from '@stepr/checklist';
import { createTour } from 'stepr';

const tour = createTour({
  steps: [
    { target: '#new-project', title: 'Projects', description: 'Start here.' },
    { target: '#invite', title: 'Invite your team' },
  ],
  onComplete: () => checklist.complete('tour'), // finished: tick it off
  onExit: () => {}, // closed early: the step stays incomplete
});

const checklist = createChecklist({
  container: '#onboarding',
  title: 'Get started',
  steps: [
    {
      id: 'tour',
      label: 'Take the product tour',
      onClick: () => {
        if (!tour.start()) console.warn('No tour target is visible');
      },
    },
  ],
});
```

- The step's `onClick` starts the tour. Only the tour's `onComplete`, which
  runs when the user passes the last step, completes the checklist step.
  Close or Escape calls `onExit` and leaves the step open, so the user can
  retry.
- `tour.start()` returns `false` when none of the tour's targets is rendered.
  Handle that case, for example by completing the step anyway or showing help.
- When the tour ends, Stepr returns focus to the element that was focused
  before `start()`. For a step activated from the keyboard, that is the step's
  button.
- Stepr has its own accessibility notes and limitations; see its README. The
  pairing was exercised in the demo with Stepr 0.1.0.

## Limitations

- **Pre-release and unpublished.** The API may change before v0.1.0.
- **Steps are fixed at creation.** To add, remove or relabel steps, `destroy()`
  the widget and create a new one. Labels are plain text; there are no
  descriptions, icons or links inside steps.
- **No built-in reset, dismiss, collapse or "hide when done" UI.** Use the API
  (as the demo does) and your own controls.
- **Default text is English.** Override it with `messages`.
- **Light default theme only.** There is no automatic dark mode; use the
  custom properties. See the contrast note under [Styling](#styling).
- **Shadow DOM:** the default stylesheet goes into the document's `<head>`, so
  it doesn't reach a widget inside a shadow root. Use `injectStyles: false` and
  add `checklistCss` to the shadow root yourself. A string `container` is
  resolved with `document.querySelector` and doesn't look inside shadow roots.
- **Element ids** are `stepr-checklist-<n>`, counted per copy of the package.
  Two separately bundled copies on one page could produce duplicate ids.
- **Persistence** is `localStorage` only: per origin and browser, not synced
  across devices or live across tabs. See [Persistence](#persistence).
- **Page styles can leak in.** The defaults use single-class selectors, so
  your page rules with higher specificity, such as `.sidebar h2 { … }`, also
  restyle the widget's heading and buttons. Scope such rules, as the demo
  does with `.section > h2`.
- **Rendering needs a DOM.** Importing is safe during server-side rendering,
  but there is no server-rendered markup.

## Browser support

No browser support matrix has been tested, so no minimum versions are claimed.
The package is compiled to ES2022 and the widget uses native `<button>`,
`<progress>`, `:focus-visible`, `accent-color`, `clip-path: inset()` and
`Element.toggleAttribute`. Check these against your own support targets. The
no-bundler setup also needs [import maps][import-maps].

Evidence so far (2026-11-14, Linux/WSL2), from an ad-hoc Playwright 1.63
script that is not part of the repository. It used Playwright's bundled
**Chromium 153**, **Firefox 155** and **WebKit 26.6**, which are close to but
not the same as Chrome, Firefox and Safari. In all three, the demo:

- loaded with no console or page errors at 1280, 768, 375 and 320px wide, with
  no horizontal scrolling and step buttons at least 44px tall
- moved Tab focus through the four step buttons in order and skipped the
  text-only step, showing a 2px solid focus outline
- activated steps with Enter and Space, kept focus on the step after
  completing it, and updated the progress text
- completed the Stepr tour step with the keyboard and returned focus to the
  step afterwards. Escape closed the tour early.
- restored persisted progress after a reload and cleared it when turned off
- had no step transition with reduced motion emulated
- copied an example to the clipboard (Chromium only; the other engines weren't
  checked)

Not tested: real Chrome, Edge, Safari or Firefox builds, macOS, Windows,
iOS, Android, touch input, zoom, forced colors / high contrast, and any
screen reader. See [docs/manual-testing.md](docs/manual-testing.md).

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
pnpm test:built     # run the demo and README examples against dist/ (jsdom)
pnpm check:package  # publint + attw + install/import the packed tarball in a clean consumer
pnpm check          # all of the above, as run in CI
pnpm demo           # build, then serve the demo at http://localhost:4173/demo/
```

`pnpm test:built` and `pnpm check:package` require a prior `pnpm build`. CI
runs every check on pull requests and pushes to `main`; it never publishes or
deploys.

## Contributing

Work on a feature branch, run `pnpm check` before opening a pull request, and
reference the relevant issue.
