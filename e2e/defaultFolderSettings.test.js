import { afterEach, describe, expect, it, jest } from '@jest/globals';

describe('default folder settings', () => {
  afterEach(() => {
    delete global.browser;
    jest.resetModules();
  });

  function loadModule() {
    global.browser = { bookmarks: {} };
    return import('../src/js/defaultFolderSettings');
  }

  it('stores a local folder ID when sync is disabled', async() => {
    const { updateDefaultFolder } = await loadModule();
    const settings = {
      $: { enable_sync: false },
      updateKey: jest.fn().mockResolvedValue(),
      updateAll: jest.fn().mockResolvedValue()
    };

    await updateDefaultFolder(settings, '42');

    expect(settings.updateKey).toHaveBeenCalledWith('default_folder_id', '42');
    expect(settings.updateAll).not.toHaveBeenCalled();
  });

  it('stores an ID and portable path when sync is enabled', async() => {
    const { updateDefaultFolder } = await loadModule();
    const settings = {
      $: { enable_sync: true },
      updateKey: jest.fn().mockResolvedValue(),
      updateAll: jest.fn().mockResolvedValue()
    };
    const folders = [{
      id: '1',
      title: 'Bookmarks bar',
      index: 0,
      folderType: 'bookmarks-bar',
      children: [{ id: '42', title: 'Work', index: 0, children: [] }]
    }];

    await updateDefaultFolder(settings, '42', folders);

    expect(settings.updateKey).not.toHaveBeenCalled();
    expect(settings.updateAll).toHaveBeenCalledWith({
      sync_default_folder_id: '42',
      sync_default_folder_path: [
        { title: 'Bookmarks bar', index: 0, folderType: 'bookmarks-bar' },
        { title: 'Work', index: 0 }
      ]
    });
  });
});
