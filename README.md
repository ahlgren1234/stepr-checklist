# stepr-checklist

Lightweight, framework-agnostic onboarding checklist widget for the web.

> **Status: pre-release scaffolding.** The package is `private` and not published.
> There is no widget functionality yet, and the public API is **provisional** —
> expect breaking changes until v0.1.0.

## Intended scope

`@stepr/checklist` will be a small, dependency-free, customizable onboarding
checklist widget that works with any framework (or none). Planned work is tracked
in GitHub issues: checklist state and controller API, optional `localStorage`
persistence, an accessible DOM renderer, and docs/demo.

The only current export is a placeholder `VERSION` constant used to verify the
build and consumer import path:

```ts
import { VERSION } from '@stepr/checklist';
```

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
