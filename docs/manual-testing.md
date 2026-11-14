# Manual keyboard and screen-reader smoke test

Automated tests (jsdom) cover structure, state and focus retention, but not
real keyboard handling, rendering or assistive-technology output. Run this
short check before releases and after changes to the widget's markup or styles.
It takes about 10 minutes.

## Setup

1. `pnpm build`
2. Save the page below as `smoke.html` in the repository root (it is not
   committed; a demo site is planned separately).
3. Serve the repository root, e.g. `python3 -m http.server 8000`, and open
   <http://localhost:8000/smoke.html>. (ES modules do not load from `file://`.)

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Checklist smoke test</title>
  </head>
  <body>
    <main>
      <h1>Checklist smoke test</h1>
      <button type="button" id="before">Before</button>
      <div id="a"></div>
      <div id="b"></div>
      <button type="button" id="reset">Reset first checklist</button>
    </main>
    <script type="module">
      import { createChecklist } from './dist/index.js';

      const a = createChecklist({
        container: '#a',
        title: 'Get started',
        storageKey: 'smoke:a',
        steps: [
          {
            id: 'profile',
            label: 'Complete your profile',
            onClick: (step, list) => list.complete(step.id),
          },
          {
            id: 'invite',
            label: 'Invite a teammate (logs only, does not complete)',
            onClick: () => console.log('invite activated'),
          },
          { id: 'docs', label: 'Read the docs (not interactive)' },
        ],
      });
      createChecklist({
        container: document.querySelector('#b'),
        title: 'Second checklist',
        steps: [
          {
            id: 'profile',
            label: 'Same id, independent state',
            onClick: (step, list) => list.complete(step.id),
          },
        ],
      });
      document.querySelector('#reset').onclick = () => a.reset();
      window.checklist = a; // for console checks
    </script>
  </body>
</html>
```

## Keyboard (any browser)

- [ ] <kbd>Tab</kbd> from "Before" moves through each **button** step in order,
      then to the second checklist and "Reset". The text-only step is skipped.
- [ ] Every focused step shows a clearly visible focus outline.
- [ ] <kbd>Enter</kbd> and <kbd>Space</kbd> on "Complete your profile" mark it
      complete (check mark, muted label, "1 of 3 steps complete", progress bar
      advances) and **focus stays on the button**.
- [ ] Activating "Invite a teammate" logs to the console and does **not**
      complete it.
- [ ] The second checklist is unaffected by the first, and vice versa.
- [ ] "Reset first checklist" clears it; reload restores state from storage.
- [ ] `checklist.destroy()` in the console removes only the first widget.

## Screen reader

Use at least one pairing, e.g. NVDA + Firefox/Chrome (Windows), VoiceOver +
Safari (macOS/iOS) or TalkBack + Chrome (Android).

- [ ] The widget is reachable as a region / landmark named "Get started", and
      its heading appears in the headings list at the expected level.
- [ ] The step list is announced as a list with 3 items.
- [ ] Steps are announced as buttons with their state, e.g. "Complete your
      profile, not completed, button". The check mark is not announced.
- [ ] After completing a step, the new state is reflected ("…, completed") and
      "1 of 3 steps complete" is announced politely without focus moving.
- [ ] The progress bar is announced with its label and value.
- [ ] Nothing is announced as a dialog.

## Display preferences

- [ ] At 320px width (device emulation or a phone), long labels wrap, there is
      no horizontal scrolling and steps are easy to tap.
- [ ] With 200% browser zoom, the layout remains usable.
- [ ] With "reduce motion" enabled in the OS, hovering steps has no transition.
- [ ] In Windows High Contrast / forced colors mode, focus outlines, step
      borders and the progress bar remain visible.
