import { describe, expect, it } from 'vitest';

import { VERSION } from '../src/index.js';

describe('@stepr/checklist', () => {
  it('exposes a version string', () => {
    expect(VERSION).toBe('0.0.0');
  });
});
