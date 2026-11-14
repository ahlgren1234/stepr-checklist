# Manual keyboard and screen-reader smoke test

Automated tests (jsdom) cover structure, state and focus retention, but not
real keyboard handling, rendering or assistive-technology output. Run this
short check before releases and after changes to the widget's markup or styles.
It takes about 10 minutes. Record release results in
[releasing.md](releasing.md).

## Setup

1. `pnpm demo`. This builds `dist/` and serves the demo at
   <http://localhost:4173/> (set `PORT` to change the port). Only `demo/`,
   `dist/` and Stepr's `dist/` are served.
2. Open <http://localhost:4173/demo/smoke.html> for the checks below. The page
   is [`demo/smoke.html`](../demo/smoke.html) and imports `../dist/index.js`.
   ES modules don't load from `file://`.
3. Then repeat the keyboard and display checks briefly on the full demo,
   <http://localhost:4173/demo/>, which adds forms, a Stepr tour and theming.

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

## Demo page

- [ ] Activating "Complete your profile" moves focus into the form; saving it
      with <kbd>Enter</kbd> completes the step and returns focus to it.
- [ ] "Take the product tour" opens the Stepr tour with focus on Next;
      finishing it completes the step and returns focus to the step;
      <kbd>Escape</kbd> closes it early and leaves the step incomplete.
- [ ] With a screen reader, the Stepr dialog is announced, and after it closes
      the checklist's progress change is announced once.
- [ ] Each "Copy" button copies its example (or selects it where the Clipboard
      API is unavailable), and the result is announced.
- [ ] The "Midnight" theme keeps the focus outline, markers and progress bar
      visible.
- [ ] On a real phone (iOS Safari and Android Chrome), the checklist appears
      before the app, steps are easy to tap, and the tour tooltip fits.

## Display preferences

- [ ] At 320px width (device emulation or a phone), long labels wrap, there is
      no horizontal scrolling and steps are easy to tap.
- [ ] With 200% browser zoom, the layout remains usable.
- [ ] Incomplete step markers are clearly visible as rings in the default
      theme, also while a step is hovered (default ring `#4b5563`; see the
      README's styling section for the measured ratios).
- [ ] With "reduce motion" enabled in the OS, hovering steps has no transition.
- [ ] In Windows High Contrast / forced colors mode, focus outlines, step
      borders and the progress bar remain visible.
