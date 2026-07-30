import { readFileSync } from 'node:fs';
import { describe, expect, it } from '@jest/globals';

describe('blocking HTML lint configuration', () => {
  it('does not force a successful exit after HTMLHint', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(packageJson.scripts['lint:html']).toBe('htmlhint src/*.html');
    expect(packageJson.scripts['lint:html']).not.toMatch(/exit\s+0/);
  });
});
