import { describe, expect, it } from '@jest/globals';
import { getBackgroundEntranceKeyframes } from '../src/js/backgroundEntrance';

describe('background entrance effects', () => {
  it.each(['zoom', 'blur', 'slide'])('creates keyframes for %s', effect => {
    const keyframes = getBackgroundEntranceKeyframes(effect);

    expect(keyframes).toHaveLength(2);
    expect(keyframes[0].opacity).toBe(0);
    expect(keyframes[1]).toMatchObject({ opacity: 1, transform: 'none' });
  });

  it('does not animate the none effect', () => {
    expect(getBackgroundEntranceKeyframes('none')).toBeNull();
  });
});
