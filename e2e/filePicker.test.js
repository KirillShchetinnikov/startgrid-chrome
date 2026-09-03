import { describe, expect, it, jest } from '@jest/globals';
import { $filePicker } from '../src/js/utils';

describe('file picker', () => {
  it('returns null when the native picker is cancelled', async() => {
    global.window = {
      showOpenFilePicker: jest.fn().mockRejectedValue({ name: 'AbortError' })
    };

    await expect($filePicker({})).resolves.toBeNull();
  });

  it('uses a temporary file input when the native picker is unavailable', async() => {
    const listeners = {};
    const input = {
      files: [{ name: 'settings.backup' }],
      addEventListener: jest.fn((name, callback) => { listeners[name] = callback; }),
      click: jest.fn(() => listeners.change()),
      remove: jest.fn()
    };
    global.window = { addEventListener: jest.fn() };
    global.document = {
      createElement: jest.fn(() => input),
      body: { append: jest.fn() }
    };

    await expect($filePicker({
      types: [{ accept: { 'application/json': ['.backup'] } }]
    })).resolves.toEqual({ name: 'settings.backup' });

    expect(input.accept).toBe('.backup');
    expect(input.remove).toHaveBeenCalledTimes(1);
  });
});
