import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { $debounce } from '../src/js/utils';

afterEach(() => jest.useRealTimers());

describe('cancelled user input', () => {
  it('cancels a pending input without disabling later input', () => {
    jest.useFakeTimers();
    const apply = jest.fn();
    const input = $debounce(apply, 500);
    input('old query');
    input.cancel();
    jest.advanceTimersByTime(600);
    expect(apply).not.toHaveBeenCalled();
    input('new query');
    jest.advanceTimersByTime(500);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith('new query');
  });
});
