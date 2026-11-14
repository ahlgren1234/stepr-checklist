// Contrast of the default stylesheet's non-text state indicators (WCAG 2.2
// SC 1.4.11 asks for at least 3:1 against adjacent colors).
import { describe, expect, it } from 'vitest';

import { checklistCss } from '../src/index.js';

/** The declarations of the first rule whose selector is exactly `selector`. */
const rule = (selector: string): string => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(?:^|\\n)${escaped} \\{([^}]*)\\}`).exec(
    checklistCss,
  );
  if (!match?.[1]) throw new Error(`no rule for ${selector}`);
  return match[1];
};

/** Default (fallback) value of an internal `--_name` token, e.g. `#4b5563`. */
const token = (name: string): string => {
  const match = new RegExp(
    `--_${name}: var\\(--stepr-checklist-[a-z-]+, (#[0-9a-f]{6})\\)`,
  ).exec(rule('.stepr-checklist'));
  if (!match?.[1]) throw new Error(`no default for --_${name}`);
  return match[1];
};

/** The internal token a declaration refers to, e.g. `muted`. */
const tokenOf = (selector: string, property: string): string => {
  const match = new RegExp(
    `(?:^|\\s)${property}: (?:\\d+px solid )?var\\(--_([a-z-]+)\\)`,
  ).exec(rule(selector));
  if (!match?.[1]) throw new Error(`no ${property} token for ${selector}`);
  return match[1];
};

const luminance = (hex: string): number => {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
};

describe('default contrast of state indicators', () => {
  // Steps are transparent, so the marker sits on the widget background, or on
  // the hover background while a step button is hovered.
  const backgrounds = { background: token('bg'), hover: token('hover') };

  it('computes WCAG contrast ratios correctly', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#d1d5db', '#ffffff')).toBeCloseTo(1.47, 2);
  });

  it.each(Object.entries(backgrounds))(
    'gives the incomplete marker ring at least 3:1 against the %s',
    (_, background) => {
      const ring = token(tokenOf('.stepr-checklist__marker', 'border'));
      expect(contrast(ring, background)).toBeGreaterThanOrEqual(3);
    },
  );

  it('keeps the light widget border separate from the marker ring', () => {
    expect(tokenOf('.stepr-checklist', 'border')).toBe('border');
    expect(tokenOf('.stepr-checklist__marker', 'border')).not.toBe('border');
  });

  it.each(Object.entries(backgrounds))(
    'gives the completed marker at least 3:1 against the %s',
    (_, background) => {
      const fill = token(
        tokenOf(
          '.stepr-checklist__step[data-completed] .stepr-checklist__marker',
          'background',
        ),
      );
      expect(contrast(fill, background)).toBeGreaterThanOrEqual(3);
    },
  );
});
