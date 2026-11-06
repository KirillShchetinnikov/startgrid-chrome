export function registerTabDiscardProtection(browser) {
  const pages = ['newtab.html', 'options.html'].map(page => browser.runtime.getURL(page));
  const pageUrl = url => url?.replace(/^extension:/, 'chrome-extension:').split(/[?#]/, 1)[0];
  const isStartGridPage = url => pages.includes(pageUrl(url));
  const session = browser.storage.session;
  const pendingUpdates = new Map();

  function scheduleUpdate(tabId, { removed = false, fromStartGrid = false } = {}) {
    const previous = pendingUpdates.get(tabId);
    const update = (async() => {
      await previous;
      const key = `startgridDiscardProtection:${tabId}`;
      try {
        if (removed) {
          await session.remove(key);
          return;
        }

        const tab = await browser.tabs.get(tabId);
        const managed = (await session.get(key))[key];
        // Chrome can report the virtual URL for the new-tab override.
        const virtualNewTab = ['chrome://newtab/', 'edge://newtab/'].includes(pageUrl(tab.url));
        if (isStartGridPage(tab.url) || (virtualNewTab && (fromStartGrid || managed))) {
          if (tab.autoDiscardable === false) return;
          // Record ownership before changing a tab property that survives navigation.
          await session.set({ [key]: true });
          await browser.tabs.update(tabId, { autoDiscardable: false });
        } else if (managed) {
          if (tab.autoDiscardable === false) {
            await browser.tabs.update(tabId, { autoDiscardable: true });
          }
          await session.remove(key);
        }
      } catch (error) {
        console.warn('Could not update StartGrid tab discard protection', error);
      } finally {
        if (pendingUpdates.get(tabId) === update) pendingUpdates.delete(tabId);
      }
    })();
    pendingUpdates.set(tabId, update);
  }

  function handleTab(tab) {
    if (isStartGridPage(tab.url) || tab.autoDiscardable === false || pendingUpdates.has(tab.id)) {
      scheduleUpdate(tab.id);
    }
  }

  browser.tabs.onCreated.addListener(handleTab);
  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url !== undefined) handleTab(tab);
  });
  browser.tabs.onRemoved.addListener(tabId => scheduleUpdate(tabId, { removed: true }));
  browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request?.protectStartGridTab === true && sender.frameId === 0 && sender.tab?.id != null
      && pageUrl(sender.url) === pages[0]) {
      scheduleUpdate(sender.tab.id, { fromStartGrid: true });
      sendResponse();
    }
  });
  browser.runtime.onInstalled.addListener(async() => {
    try {
      const tabs = await browser.tabs.query({});
      tabs.filter(tab => isStartGridPage(tab.url)).forEach(handleTab);
    } catch (error) {
      console.warn('Could not find open StartGrid tabs', error);
    }
  });
}
