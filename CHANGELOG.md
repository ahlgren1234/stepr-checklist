# Changelog

All notable changes to `@stepr/checklist` are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the
project follows [Semantic Versioning](https://semver.org/). While the version
is 0.x, a minor release may contain breaking changes.

## [0.1.0] - 2026-11-14

First public release.

### Added

- `createChecklist(options)`: an accessible onboarding checklist widget for
  any framework, or none. Steps with `onClick` are native buttons; steps
  without are plain text. Activating a step never completes it. Your app calls
  `complete(id)` when the work is actually done.
- `createChecklistController(options)`: the DOM-free state controller the
  widget is built on, with `complete`, `uncomplete`, `reset`, `click`,
  `isCompleted`, `getProgress`, `getState` and `subscribe`.
- Optional `localStorage` persistence via `storageKey`, with versioned data
  and silent fallback to memory when storage is unavailable or invalid.
- A default stylesheet, injected once and themeable through twelve
  `--stepr-checklist-*` CSS custom properties, also exported as `checklistCss`
  for use with `injectStyles: false` (strict CSP, shadow DOM).
- Accessibility: a labelled region and heading, completion state in each
  step's accessible name, a polite live region for progress, a labelled
  `<progress>` bar, a visible `:focus-visible` outline, 44px targets, no
  transitions under `prefers-reduced-motion`, and default state markers with
  at least 3:1 non-text contrast.
- `messages` option for localizing the widget's text.
- ESM-only build with TypeScript declarations and no runtime dependencies.

### Known limitations

- Not yet tested with a screen reader, in forced colors / high contrast mode,
  or on real mobile devices. See the README's
  [Browser support](README.md#browser-support) section.
- Steps are fixed at creation; there is no built-in reset or dismiss UI, and
  no automatic dark theme. See [Limitations](README.md#limitations).

[0.1.0]: https://github.com/ahlgren1234/stepr-checklist/releases/tag/v0.1.0
