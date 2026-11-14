# Releasing

`@stepr/checklist` is published to npm **by hand**, by a maintainer, after an
explicit approval. Nothing in this repository publishes automatically: CI
only runs checks, and there are no publish, tag, release or deploy workflows.

## v0.1.0 release candidate status

Prepared for [issue #6](https://github.com/ahlgren1234/stepr-checklist/issues/6).

### Verified

- `pnpm check` passes on Node.js 24: typecheck, ESLint, Prettier, unit tests,
  build, built-package tests, `publint --strict`, `attw --profile esm-only`,
  and an install/import of the packed tarball in a clean npm consumer
  (runtime import without a DOM, and `nodenext` type-checking).
- The tarball (`stepr-checklist-0.1.0.tgz`, about 18 kB) contains only
  `LICENSE`, `README.md`, `package.json` and `dist/` (`.js` and `.d.ts` for
  `index`, `controller`, `storage`, `styles` and `widget`). No sources, tests,
  demo, config, lockfile, `.env` or other private files.
- An ad-hoc install of the tarball in a fresh project on Node.js 26, with
  npm and with pnpm: no dependencies are installed, all three exports load,
  types resolve with `moduleResolution: bundler`, and the widget renders,
  completes a step, injects its stylesheet and cleans up in jsdom.
- Default marker contrast (WCAG 2.2 SC 1.4.11): the incomplete ring is
  7.56:1 on the widget background and 6.87:1 on the hover color, and the
  completed fill is 5.17:1. Measured as computed styles in Playwright's bundled
  Chromium 153, Firefox 155 and WebKit 26.6 on 2026-11-14, and checked in
  `test/styles.test.ts`.

### Manual browser and accessibility checks already performed

All on Linux/WSL2, with an ad-hoc Playwright 1.63 script (not committed),
using Playwright's bundled Chromium 153, Firefox 155 and WebKit 26.6, which
are close to but not the same as the branded browsers:

- 2026-11-14, for PR #11 (94/94 checks in each engine): the demo loads without
  errors at 1280, 768, 375 and 320px with no horizontal scrolling and step
  buttons at least 44px tall; Tab order skips text-only steps and shows a 2px
  focus outline; Enter and Space activate steps and focus stays on the step;
  the Stepr tour works by keyboard and returns focus; persistence survives a
  reload; no step transition under emulated reduced motion; clipboard copy
  (Chromium only).
- 2026-11-14, for this release candidate: the marker contrast measurements
  above, on `demo/smoke.html`, with no console or page errors.

### Not yet checked

From [manual-testing.md](manual-testing.md): any screen reader; branded
Chrome, Edge, Firefox and Safari; macOS, Windows, iOS and Android; touch
input; 200% zoom; forced colors / high contrast. The README states this.

### Open decisions before publishing

1. **npm organization.** `@stepr/checklist` requires an npm organization (or
   user) named `stepr` that the publishing account can publish to. This has
   not been confirmed: the npm CLI was not logged in while preparing the
   release candidate, and `@stepr/checklist` is not on the registry yet.
2. **Repository visibility.** The GitHub repository is private. The npm page
   links to it (`repository`, `homepage`, `bugs`), and npm rewrites the
   README's relative links (`LICENSE`, `CHANGELOG.md`, `demo/`, `docs/`) to
   it. Unless the repository is made public first, those links will 404 for
   npm users.
3. **Screen-reader testing.** Decide whether a screen-reader pass from
   [manual-testing.md](manual-testing.md) is required before v0.1.0, or
   acceptable as a known limitation of an early 0.x release (as currently
   documented).

## Publication checklist

Do these in order. Stop at any failure.

### 1. Approval

- [ ] The release candidate PR has been reviewed and merged into `main`.
- [ ] The open decisions above are resolved.
- [ ] The release date in `CHANGELOG.md` is set (replace `Unreleased`) in the
      release candidate PR or a follow-up PR, and merged.
- [ ] The maintainer has explicitly approved publishing `0.1.0` to npm, for
      example in a comment on issue #6.

### 2. npm account, organization and authentication

- [ ] Your npm account has two-factor authentication enabled for
      authorization and writes (npmjs.com → Account → Two-Factor
      Authentication).
- [ ] The `stepr` organization exists on npm and your account can publish to
      it. Check on npmjs.com (Organizations → `stepr` → Members): you need to
      be an owner or admin, or a member of a team that is allowed to create
      packages in the scope. If the organization doesn't exist, create it
      (free for public packages) under the exact name `stepr`.
- [ ] Log in interactively and confirm the account:

  ```sh
  npm login            # browser-based login, no token stored in the repo
  npm whoami           # expected: your npm username
  npm org ls stepr     # expected: your username with role owner/admin/developer
  ```

- [ ] No npm token is committed anywhere. `git grep -n "_authToken"` returns
      nothing; tokens live only in your user-level `~/.npmrc`.

### 3. Build and inspect from a clean checkout

```sh
git switch main && git pull --ff-only
git status                    # expected: clean
node -v                       # expected: v24.x (see .nvmrc)
pnpm install --frozen-lockfile
pnpm check                    # must pass
mkdir -p ../stepr-release && rm -f ../stepr-release/*.tgz
pnpm pack --pack-destination ../stepr-release   # runs prepack (build)
tar -tzf ../stepr-release/stepr-checklist-0.1.0.tgz
```

- [ ] `pnpm check` passes.
- [ ] The tarball lists exactly `package/LICENSE`, `package/README.md`,
      `package/package.json` and `package/dist/*.js` / `*.d.ts`, and nothing
      else.
- [ ] `tar -xOzf ../stepr-release/stepr-checklist-0.1.0.tgz package/package.json`
      shows `"version": "0.1.0"`, `"license": "MIT"`, no `"private"` field,
      and `"publishConfig": { "access": "public" }`.
- [ ] Dry run of exactly that tarball:

  ```sh
  npm publish ../stepr-release/stepr-checklist-0.1.0.tgz --access public --dry-run
  ```

### 4. Publish (requires the approval in step 1)

```sh
npm publish ../stepr-release/stepr-checklist-0.1.0.tgz --access public
```

Publishing the inspected tarball means the files you checked are the files
that ship. npm asks for a one-time password when 2FA is enabled. `--access
public` is required for the first publish of a scoped package (it is also in
`publishConfig`). Run this once, and don't retry a failed publish blindly:
check `npm view @stepr/checklist versions` first.

### 5. Verify the published package

```sh
npm view @stepr/checklist name version license dist-tags
mkdir /tmp/stepr-verify && cd /tmp/stepr-verify && npm init -y >/dev/null
npm pkg set type=module
npm install @stepr/checklist@0.1.0
node -e "import('@stepr/checklist').then(m => console.log(Object.keys(m)))"
```

- [ ] `dist-tags.latest` is `0.1.0` and the exports are `checklistCss`,
      `createChecklist` and `createChecklistController`.
- [ ] The npm page shows the README, the MIT license and working repository
      links.

### 6. After publishing (each needs its own approval)

- [ ] Tag the published commit: `git tag -a v0.1.0 -m "v0.1.0"` and
      `git push origin v0.1.0`.
- [ ] Create a GitHub release for `v0.1.0` using the `CHANGELOG.md` entry.
- [ ] Close issue #6.

### If something goes wrong

- A published version can never be reused, even after unpublishing. Fix
  forward with `0.1.1`.
- For a broken release, prefer
  `npm deprecate @stepr/checklist@0.1.0 "<reason>"` and publish a fix.
  `npm unpublish` is only possible within 72 hours and under npm's
  unpublish policy, and blocks republishing that version.
