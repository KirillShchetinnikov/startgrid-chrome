import { describe, expect, it } from '@jest/globals';
import { isWinterDate, shouldShowSnow } from '../src/js/plugins/snow';

describe('snow display mode', () => {
  it('recognizes the configured winter period', () => {
    expect(isWinterDate(new Date(2026, 11, 5))).toBe(true);
    expect(isWinterDate(new Date(2027, 1, 19, 23, 59))).toBe(true);
    expect(isWinterDate(new Date(2027, 1, 20))).toBe(false);
    expect(isWinterDate(new Date(2026, 6, 16))).toBe(false);
  });

  it('supports always, winter and off modes', () => {
    const summer = new Date(2026, 6, 16);
    const winter = new Date(2026, 11, 20);

    expect(shouldShowSnow('always', summer)).toBe(true);
    expect(shouldShowSnow('winter', winter)).toBe(true);
    expect(shouldShowSnow('winter', summer)).toBe(false);
    expect(shouldShowSnow('off', winter)).toBe(false);
  });
});
