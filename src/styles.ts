/**
 * Default widget styles. Selectors use one or two classes, and the injected
 * `<style>` is inserted at the start of `<head>`, so consumer rules of equal
 * specificity win. Theme through the `--stepr-checklist-*` custom properties
 * on `.stepr-checklist` (or any ancestor).
 */
export const checklistCss = `
.stepr-checklist {
  --_accent: var(--stepr-checklist-accent, #2563eb);
  --_accent-fg: var(--stepr-checklist-accent-foreground, #ffffff);
  --_bg: var(--stepr-checklist-background, #ffffff);
  --_fg: var(--stepr-checklist-foreground, #1f2937);
  --_muted: var(--stepr-checklist-muted, #4b5563);
  --_border: var(--stepr-checklist-border, #d1d5db);
  --_hover: var(--stepr-checklist-hover, #f3f4f6);
  --_focus: var(--stepr-checklist-focus, #2563eb);
  --_radius: var(--stepr-checklist-radius, 0.5rem);
  --_padding: var(--stepr-checklist-padding, 1rem);
  --_gap: var(--stepr-checklist-gap, 0.5rem);
  position: relative;
  box-sizing: border-box;
  max-width: 100%;
  padding: var(--_padding);
  border: 1px solid var(--_border);
  border-radius: var(--_radius);
  background: var(--_bg);
  color: var(--_fg);
  font-family: var(--stepr-checklist-font-family, inherit);
  line-height: 1.4;
  overflow-wrap: anywhere;
}
.stepr-checklist *,
.stepr-checklist *::before,
.stepr-checklist *::after {
  box-sizing: inherit;
}
.stepr-checklist__title {
  margin: 0 0 var(--_gap);
  font-size: 1.125rem;
  line-height: 1.3;
}
.stepr-checklist__progress-text {
  margin: 0 0 var(--_gap);
  color: var(--_muted);
  font-size: 0.875rem;
}
.stepr-checklist__progress {
  display: block;
  width: 100%;
  height: 0.5rem;
  margin: 0 0 var(--_gap);
  accent-color: var(--_accent);
}
.stepr-checklist__steps {
  display: grid;
  gap: calc(var(--_gap) / 2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.stepr-checklist__step {
  margin: 0;
}
.stepr-checklist__action, .stepr-checklist__static {
  display: flex;
  align-items: center;
  gap: var(--_gap);
  width: 100%;
  min-height: 2.75rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid transparent;
  border-radius: calc(var(--_radius) * 0.75);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: start;
}
.stepr-checklist__action {
  cursor: pointer;
  transition: background-color 150ms ease;
}
.stepr-checklist__action:hover {
  background: var(--_hover);
}
.stepr-checklist__action:focus-visible {
  outline: 2px solid var(--_focus);
  outline-offset: 2px;
}
.stepr-checklist__marker {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  border: 2px solid var(--_muted);
  border-radius: 50%;
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1;
}
.stepr-checklist__step[data-completed] .stepr-checklist__marker {
  border-color: var(--_accent);
  background: var(--_accent);
  color: var(--_accent-fg);
}
.stepr-checklist__step[data-completed] .stepr-checklist__marker::after {
  content: '\\2713';
}
.stepr-checklist__step[data-completed] .stepr-checklist__label {
  color: var(--_muted);
}
.stepr-checklist__visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}
@media (prefers-reduced-motion: reduce) {
  .stepr-checklist *,
  .stepr-checklist *::before,
  .stepr-checklist *::after {
    transition: none;
    animation: none;
  }
}
`;
