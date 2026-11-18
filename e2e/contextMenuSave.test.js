import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';

describe('saving a page from the Chrome context menu', () => {
  const pageUrl = 'https://example.org/original';
  const source = { id: 11, title: 'Original page', url: pageUrl };
  let click;

  beforeAll(async() => {
    const event = { addListener: jest.fn() };
    global.browser = {
      runtime: { getURL: path => 'chrome-extension://test/' + path,
        onInstalled: event, onStartup: event, onMessage: event },
      i18n: { getMessage: key => key },
      storage: { local: { get: async() => ({ settings: { close_tab_after_adding_bookmark: true } }) },
        sync: {}, onChanged: event },
      bookmarks: { search: jest.fn(), create: jest.fn(), onCreated: event, onChanged: event,
        onMoved: event, onRemoved: event, onImportBegan: event, onImportEnded: event },
      contextMenus: { onClicked: { addListener: listener => { click = listener; } } },
      action: { onClicked: event },
      notifications: { onClicked: event, create: jest.fn() },
      tabs: { get: jest.fn(), remove: jest.fn(), onCreated: event, onRemoved: event, onUpdated: event }
    };
    await import('../src/js/background');
  });
  beforeEach(() => {
    jest.clearAllMocks();
    browser.bookmarks.search.mockResolvedValue([]);
  });
  afterAll(() => { delete global.browser; });

  it('saves and closes the source tab even when a different tab is active', async() => {
    browser.tabs.get.mockResolvedValue({ ...source, active: false });
    await click({ menuItemId: 'save-8', pageUrl }, source);
    expect(browser.bookmarks.create).toHaveBeenCalledWith({ parentId: '8', title: source.title, url: pageUrl });
    expect(browser.tabs.get).toHaveBeenCalledWith(source.id);
    expect(browser.tabs.remove).toHaveBeenCalledWith(source.id);
  });

  it.each([{ url: 'https://example.org/next' }, { url: pageUrl, pendingUrl: 'https://example.org/next' }])(
    'keeps a source tab that has navigated or started navigating', async current => {
      browser.tabs.get.mockResolvedValue(current);
      await click({ menuItemId: '8', pageUrl }, source);
      expect(browser.bookmarks.create).toHaveBeenCalledTimes(1);
      expect(browser.tabs.remove).not.toHaveBeenCalled();
    }
  );
});
