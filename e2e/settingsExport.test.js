import { describe, expect, it, jest } from '@jest/globals';
import { exportSettings, SETTINGS_EXPORT_FILE_NAME } from '../src/js/settingsExport';

describe('settings export', () => {
  it('writes JSON to the user-selected file when the picker is available', async() => {
    const write = jest.fn();
    const close = jest.fn();
    const showSaveFilePicker = jest.fn().mockResolvedValue({
      createWritable: jest.fn().mockResolvedValue({ write, close })
    });

    await expect(exportSettings({ theme: 'dark' }, { showSaveFilePicker }))
      .resolves.toEqual({ ok: true, method: 'picker' });

    expect(showSaveFilePicker).toHaveBeenCalledWith(expect.objectContaining({
      suggestedName: SETTINGS_EXPORT_FILE_NAME
    }));
    expect(write).toHaveBeenCalledWith(expect.any(Blob));
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('treats picker cancellation as a normal outcome', async() => {
    await expect(exportSettings({}, {
      showSaveFilePicker: jest.fn().mockRejectedValue({ name: 'AbortError' })
    })).resolves.toEqual({ ok: false, cancelled: true });
  });

  it('uses a temporary link and releases its object URL when the picker is unavailable', async() => {
    const link = { click: jest.fn(), remove: jest.fn() };
    const append = jest.fn();
    const createObjectURL = jest.fn(() => 'blob:settings');
    const revokeObjectURL = jest.fn();
    const schedule = jest.fn(callback => callback());

    await expect(exportSettings({ theme: 'dark' }, {
      showSaveFilePicker: null,
      document: { createElement: jest.fn(() => link), body: { append } },
      createObjectURL,
      revokeObjectURL,
      setTimeout: schedule
    })).resolves.toEqual({ ok: true, method: 'download' });

    expect(link).toMatchObject({
      href: 'blob:settings',
      download: SETTINGS_EXPORT_FILE_NAME,
      hidden: true
    });
    expect(append).toHaveBeenCalledWith(link);
    expect(link.click).toHaveBeenCalledTimes(1);
    expect(link.remove).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:settings');
    expect(schedule).toHaveBeenCalledWith(expect.any(Function), 0);
  });
});
