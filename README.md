# stepr-checklist

Lightweight, framework-agnostic onboarding checklist widget for the web.

> **Status: pre-release.** The package is `private` and not published. Only the
> checklist state controller and optional persistence exist so far (no widget
> UI yet), and the public API is **provisional** —
> expect breaking changes until v0.1.0.

## Intended scope

`@stepr/checklist` will be a small, dependency-free, customizable onboarding
checklist widget that works with any framework (or none). Planned work is tracked
in GitHub issues: checklist state and controller API, optional `localStorage`
persistence, an accessible DOM renderer, and docs/demo.

## Checklist controller

The core is a DOM-free state controller. The widget (planned) will be built on
top of it; it can also be used directly.

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
- **Browser-first.** Compiled to ES2022 with DOM typings available for the future
  DOM implementation; Node.js is only used for tooling and tests.
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
pnpm test           # run tests with Vitest (pnpm test:watch for watch mode)
pnpm build          # compile to dist/ with declarations
pnpm check:package  # publint + attw + install/import the packed tarball in a clean consumer
pnpm check          # all of the above, as run in CI
```

`pnpm check:package` requires a prior `pnpm build`. CI runs every check on pull
requests and pushes to `main`; it never publishes.

## Contributing

Work on a feature branch, run `pnpm check` before opening a pull request, and
reference the relevant issue.
