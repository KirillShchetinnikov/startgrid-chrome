import { bootstrap } from './bootstrap';
import { beforeAll, afterAll, describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { mutateStorageWithNavigation } from './navigationSynchronization';

const DEFAULT_BOOKMARKS = [
  { title: 'google', url: 'https://google.com' },
  { title: 'youtube', url: 'https://youtube.com' },
  { title: 'folder', url: '' }
];

async function createSetupBookmark(page, bookmark) {
  await page.waitForFunction(() => {
    const add = document.getElementById('add');
    return Boolean(add?.isConnected);
  });
  await page.evaluate(expectedTitle => {
    const addBeforeCreate = document.getElementById('add');
    window.__setupBookmarkRefresh = {
      eventSeen: false,
      addReplaced: false
    };
    chrome.runtime.onMessage.addListener(request => {
      if (request.bookmarksChanged) {
        window.__setupBookmarkRefresh.eventSeen = true;
      }
    });
    const observer = new MutationObserver(() => {
      const connectedAdd = document.getElementById('add');
      if (
        !addBeforeCreate.isConnected
        && connectedAdd?.isConnected
        && Array.from(document.querySelectorAll('.bookmark__title'))
          .filter(node => node.textContent === expectedTitle).length === 1
      ) {
        window.__setupBookmarkRefresh.addReplaced = true;
        observer.disconnect();
      }
    });
    observer.observe(document.getElementById('bookmarks'), { childList: true });
  }, bookmark.title);

  await page.$eval('#add', add => {
    if (!add.isConnected) throw new Error('Setup add button is detached');
    add.click();
  });
  await page.evaluate(({ title, url }) => {
    document.getElementById('title').value = title;
    document.getElementById('url').value = url;
  }, bookmark);
  await page.$eval('#saveBookmarkBtn', save => save.click());
  await page.waitForFunction(expectedTitle => {
    const state = window.__setupBookmarkRefresh;
    const add = document.getElementById('add');
    return Boolean(
      state?.eventSeen
      && state.addReplaced
      && add?.isConnected
      && Array.from(document.querySelectorAll('.bookmark__title'))
        .filter(node => node.textContent === expectedTitle).length === 1
    );
  }, {}, bookmark.title);
}

async function getActiveSearchEvidence(page, query) {
  if (!page || page.isClosed()) return { targetClosed: true };
  try {
    return await page.evaluate(expected => ({
      targetClosed: false,
      url: location.href,
      readyState: document.readyState,
      hidden: document.hidden,
      hasSearch: document.body.classList.contains('has-search'),
      loadingHidden: document.getElementById('dial_loading')?.hidden,
      headerConnected: Boolean(document.querySelector('vb-header')?.isConnected),
      bookmarksConnected: Boolean(document.getElementById('bookmarks')?.isConnected),
      addConnected: Boolean(document.getElementById('add')?.isConnected),
      exactResultCount: Array.from(document.querySelectorAll('.bookmark__title'))
        .filter(node => node.textContent === expected).length,
      visibleTitles: Array.from(document.querySelectorAll('.bookmark__title'))
        .slice(0, 10)
        .map(node => node.textContent),
      runtimeEvidence: window.__activeSearchEvidence || null,
      persistedRuntimeEvidence: JSON.parse(
        sessionStorage.getItem('active-search-runtime-evidence') || 'null'
      )
    }), query);
  } catch (error) {
    return {
      targetClosed: page.isClosed(),
      evidenceError: error.message
    };
  }
}

async function runActiveSearchPhase(page, label, query, operation, timeout = 6000) {
  let timer;
  try {
    return await Promise.race([
      operation(),
      new Promise((resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error(`phase exceeded ${timeout} ms`)),
          timeout
        );
      })
    ]);
  } catch (error) {
    const evidence = await getActiveSearchEvidence(page, query);
    throw new Error(
      `[active-search:${label}] ${error.message}; evidence=${JSON.stringify(evidence)}`
    );
  } finally {
    clearTimeout(timer);
  }
}

function waitForActiveSearchState(
  page,
  label,
  query,
  predicate,
  predicateArgument = query
) {
  return runActiveSearchPhase(
    page,
    label,
    query,
    () => page.waitForFunction(
      predicate,
      { polling: 100, timeout: 5500 },
      predicateArgument
    )
  );
}

async function getRecursiveCleanupEvidence(page, ids = []) {
  if (!page || page.isClosed()) return { targetClosed: true };
  try {
    return await page.evaluate(recordIds => new Promise(resolve => {
      const request = indexedDB.open('startgrid', 1);
      request.onerror = () => resolve({
        indexedDbError: request.error?.message || 'open failed'
      });
      request.onsuccess = () => {
        const store = request.result.transaction('images').objectStore('images');
        Promise.all(recordIds.map(id => new Promise(done => {
          const get = store.get(id);
          get.onerror = () => done({ id, error: get.error?.message || 'get failed' });
          get.onsuccess = () => done({ id, present: get.result !== undefined });
        }))).then(records => resolve({
          hidden: document.hidden,
          visibilityState: document.visibilityState,
          readyState: document.readyState,
          addConnected: Boolean(document.getElementById('add')?.isConnected),
          loadingHidden: document.getElementById('dial_loading')?.hidden,
          cleanupRootCount: Array.from(document.querySelectorAll('.bookmark__title'))
            .filter(node => node.textContent === 'cleanup-root').length,
          runtimeEvidence: window.__recursiveCleanupEvidence || null,
          records
        }));
      };
    }), ids);
  } catch (error) {
    return {
      targetClosed: page.isClosed(),
      evidenceError: error.message
    };
  }
}

async function runRecursiveCleanupPhase(
  page,
  label,
  ids,
  operation,
  timeout = 6000
) {
  let timer;
  try {
    return await Promise.race([
      operation(),
      new Promise((resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error(`phase exceeded ${timeout} ms`)),
          timeout
        );
      })
    ]);
  } catch (error) {
    const evidence = await getRecursiveCleanupEvidence(page, ids);
    throw new Error(
      `[recursive-cleanup:${label}] ${error.message}; evidence=${JSON.stringify(evidence)}`
    );
  } finally {
    clearTimeout(timer);
  }
}

async function getSnowEvidence(page) {
  if (!page || page.isClosed()) return { targetClosed: true };
  try {
    return await page.evaluate(() => ({
      hidden: document.hidden,
      visibilityState: document.visibilityState,
      readyState: document.readyState,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      instance: Boolean(window.snowInstance),
      instanceDestroyed: window.snowInstance?.destroyed ?? null,
      canvasCount: document.querySelectorAll('canvas').length,
      raf: window.__snowRafEvidence || null,
      mediaChanges: window.__snowMediaChanges || []
    }));
  } catch (error) {
    return {
      targetClosed: page.isClosed(),
      evidenceError: error.message
    };
  }
}

async function runSnowPhase(page, label, operation, timeout = 6000) {
  let timer;
  try {
    return await Promise.race([
      operation(),
      new Promise((resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error(`phase exceeded ${timeout} ms`)),
          timeout
        );
      })
    ]);
  } catch (error) {
    const evidence = await getSnowEvidence(page);
    throw new Error(
      `[reduced-motion:${label}] ${error.message}; evidence=${JSON.stringify(evidence)}`
    );
  } finally {
    clearTimeout(timer);
  }
}

async function getLiteralTitleEvidence(page, expectedTitles = []) {
  if (!page || page.isClosed()) return { targetClosed: true };
  let timer;
  try {
    const evidence = await Promise.race([
      page.evaluate(titles => ({
        targetClosed: false,
        hidden: document.hidden,
        readyState: document.readyState,
        addConnected: Boolean(document.getElementById('add')?.isConnected),
        loadingHidden: document.getElementById('dial_loading')?.hidden,
        modalClass: document.getElementById('modal')?.className,
        modalDisplay: document.getElementById('modal')
          ? getComputedStyle(document.getElementById('modal')).display
          : null,
        modalOpen: document.getElementById('modal')?.instance?._isOpen,
        modalTransitioning: document.getElementById('modal')?.instance?._isTransitiong,
        modalLifecycle: window.__literalModalLifecycle || null,
        activeElementId: document.activeElement?.id,
        formAction: document.getElementById('formBookmark')?.dataset.action,
        inputTitle: document.getElementById('title')?.value,
        matchingTitles: titles.map(title => Array.from(
          document.querySelectorAll('.bookmark__title')
        ).filter(node => node.textContent === title).map(node => ({
          id: node.closest('.bookmark')?.dataset.id,
          childElements: node.children.length,
          bookmarkHidden: node.closest('.bookmark')?.hidden
        }))),
        injectedImageCount: document.querySelectorAll('.bookmark__title img').length,
        popupResolveConnected: Boolean(
          document.querySelector('#popup [data-popup="resolve"]')?.isConnected
        ),
        popupClass: document.getElementById('popup')?.className,
        popupResolveFocused: (
          document.activeElement
          === document.querySelector('#popup [data-popup="resolve"]')
        ),
        deleteConfirmClickSeen: window.__literalDeleteConfirm?.clickSeen ?? false,
        toastTexts: Array.from(document.querySelectorAll('.toast__message'))
          .map(node => node.textContent)
      }), expectedTitles),
      new Promise(resolve => {
        timer = setTimeout(
          () => resolve({ targetClosed: false, evidenceTimeout: true }),
          750
        );
      })
    ]);
    return {
      ...evidence,
      dialogs: page.__literalTitleDialogs || []
    };
  } catch (error) {
    return {
      targetClosed: page.isClosed(),
      evidenceError: error.message,
      dialogs: page.__literalTitleDialogs || []
    };
  } finally {
    clearTimeout(timer);
  }
}

async function runLiteralTitlePhase(page, label, titles, operation, timeout = 6000) {
  let timer;
  try {
    return await Promise.race([
      operation(),
      new Promise((resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error(`phase exceeded ${timeout} ms`)),
          timeout
        );
      })
    ]);
  } catch (error) {
    const evidence = await getLiteralTitleEvidence(page, titles);
    throw new Error(
      `[literal-title:${label}] ${error.message}; evidence=${JSON.stringify(evidence)}`
    );
  } finally {
    clearTimeout(timer);
  }
}

async function settleTestCleanup(operation, timeout = 1500) {
  let timer;
  try {
    await Promise.race([
      operation(),
      new Promise(resolve => {
        timer = setTimeout(resolve, timeout);
      })
    ]);
  } catch {
    // Cleanup is best-effort and must not replace the primary test failure.
  } finally {
    clearTimeout(timer);
  }
}

async function getBackgroundUploadEvidence(page) {
  if (!page || page.isClosed()) return { targetClosed: true };
  let timer;
  try {
    return await Promise.race([
      page.evaluate(async() => {
        const requestResult = request => new Promise((resolve, reject) => {
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result);
        });
        const databases = indexedDB.databases
          ? await indexedDB.databases().catch(() => [])
          : [];
        const bundleScripts = [...new Set([
          chrome.runtime.getURL('js/options.js'),
          ...performance.getEntriesByType('resource')
            .map(entry => entry.name)
            .filter(url => url.startsWith(chrome.runtime.getURL('js/')))
        ])];
        const bundleText = (await Promise.all(bundleScripts.map(url => (
          fetch(url).then(response => response.text()).catch(() => '')
        )))).join('\n');
        const evidence = {
          targetClosed: false,
          url: location.href,
          origin: location.origin,
          readyState: document.readyState,
          uploadConnected: Boolean(document.getElementById('bgFile')?.isConnected),
          uploadAccept: document.getElementById('bgFile')?.getAttribute('accept'),
          formUploading: document.getElementById('bgFile')
            ?.closest('form')?.classList.contains('is-upload'),
          previewHidden: document.querySelector('.c-upload__preview')?.hidden,
          previewStyle: document.querySelector('.c-upload__preview-image')
            ?.getAttribute('style'),
          initialPreviewStyle: window.__backgroundUploadLifecycle
            ?.initialPreviewStyle,
          initialPreviewUrl: window.__backgroundUploadLifecycle
            ?.initialPreviewUrl,
          finalPreviewStyle: document.querySelector('.c-upload__preview-image')
            ?.getAttribute('style'),
          finalPreviewUrl: document.querySelector('.c-upload__preview-image')
            ?.style.backgroundImage,
          lifecycle: window.__backgroundUploadLifecycle || null,
          toastTexts: Array.from(document.querySelectorAll('.toast__message'))
            .map(node => node.textContent),
          databases,
          bundleScripts,
          bundleHasPersistenceContract: (
            bundleText.includes('notice_background_save_failed')
            && bundleText.includes('image/svg+xml')
          )
        };
        try {
          const database = await requestResult(indexedDB.open('startgrid', 1));
          const storeNames = Array.from(database.objectStoreNames);
          const transaction = database.transaction('images');
          const store = transaction.objectStore('images');
          const [record, keys] = await Promise.all([
            requestResult(store.get('background')),
            requestResult(store.getAllKeys())
          ]);
          database.close();
          return {
            ...evidence,
            databaseVersion: database.version,
            storeNames,
            keys,
            record: record ? {
              id: record.id,
              blobType: record.blob?.type,
              blobSize: record.blob?.size,
              thumbnailType: record.blobThumbnail?.type,
              thumbnailSize: record.blobThumbnail?.size
            } : null
          };
        } catch (error) {
          return {
            ...evidence,
            databaseError: error.message
          };
        }
      }),
      new Promise(resolve => {
        timer = setTimeout(
          () => resolve({ targetClosed: false, evidenceTimeout: true }),
          750
        );
      })
    ]);
  } catch (error) {
    return {
      targetClosed: page.isClosed(),
      evidenceError: error.message
    };
  } finally {
    clearTimeout(timer);
  }
}

async function runBackgroundUploadPhase(page, label, operation, timeout = 6000) {
  let timer;
  try {
    return await Promise.race([
      operation(),
      new Promise((resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error(`phase exceeded ${timeout} ms`)),
          timeout
        );
      })
    ]);
  } catch (error) {
    const evidence = await getBackgroundUploadEvidence(page);
    throw new Error(
      `[background-upload:${label}] ${error.message}; evidence=${JSON.stringify(evidence)}`
    );
  } finally {
    clearTimeout(timer);
  }
}

async function getLocalizedUiEvidence(page) {
  if (!page || page.isClosed()) return { targetClosed: true };
  let timer;
  try {
    return await Promise.race([
      page.evaluate(() => ({
        targetClosed: false,
        hidden: document.hidden,
        readyState: document.readyState,
        addConnected: Boolean(document.getElementById('add')?.isConnected),
        loadingHidden: document.getElementById('dial_loading')?.hidden,
        scrollLabel: document.querySelector('vb-scrollup')
          ?.shadowRoot?.querySelector('button')?.getAttribute('aria-label'),
        toastLabels: Array.from(document.querySelectorAll('.toast__btn'))
          .map(node => node.getAttribute('aria-label')),
        toastTexts: Array.from(document.querySelectorAll('.toast__message'))
          .map(node => node.textContent),
        toastActions: Array.from(document.querySelectorAll('.toast__action'))
          .map(node => node.textContent),
        formAction: document.getElementById('formBookmark')?.dataset.action,
        inputTitle: document.getElementById('title')?.value
      })),
      new Promise(resolve => {
        timer = setTimeout(
          () => resolve({ targetClosed: false, evidenceTimeout: true }),
          750
        );
      })
    ]);
  } catch (error) {
    return {
      targetClosed: page.isClosed(),
      evidenceError: error.message
    };
  } finally {
    clearTimeout(timer);
  }
}

async function runLocalizedUiPhase(page, label, operation, timeout = 6000) {
  let timer;
  try {
    return await Promise.race([
      operation(),
      new Promise((resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error(`phase exceeded ${timeout} ms`)),
          timeout
        );
      })
    ]);
  } catch (error) {
    const evidence = await getLocalizedUiEvidence(page);
    throw new Error(
      `[localized-ui:${label}] ${error.message}; evidence=${JSON.stringify(evidence)}`
    );
  } finally {
    clearTimeout(timer);
  }
}

describe('StartGrid bookmark tests', () => {
  let extPage, browser, extensionUrl;

  beforeAll(async() => {
    const context = await bootstrap({ launchAttempts: 2 });
    extPage = context.extPage;
    browser = context.browser;
    extensionUrl = context.extensionUrl;

    for (const bookmark of DEFAULT_BOOKMARKS) {
      await createSetupBookmark(extPage, bookmark);
    }
  });

  // for example
  it('should be a title', async() => {
    // 3. When the user goes to the chrome extension
    await extPage.bringToFront();
    const titleText = await extPage.evaluate(() => document.title);
    expect(titleText).toEqual('StartGrid');
  });

  it('refreshes a visible newtab after a mutation from another extension page', async() => {
    const controlPage = await browser.newPage();
    await controlPage.goto(extensionUrl, { waitUntil: 'load' });
    await extPage.bringToFront();
    expect(await extPage.evaluate(() => document.hidden)).toBe(false);
    const parentId = await extPage.$eval('#bookmarks', node => node.dataset.folder);
    const title = `external-${Date.now()}`;

    await controlPage.evaluate(({ parentId, title }) => new Promise((resolve, reject) => {
      chrome.bookmarks.create({
        parentId,
        title,
        url: 'https://example.com/external'
      }, bookmark => chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(bookmark));
    }), { parentId, title });

    await extPage.waitForFunction(expected => (
      Array.from(document.querySelectorAll('.bookmark__title'))
        .some(node => node.textContent === expected)
    ), {}, title);
    await controlPage.close();
  });

  it('reloads a hidden newtab for an import-complete envelope', async() => {
    const controlPage = await browser.newPage();
    await controlPage.goto(extensionUrl, { waitUntil: 'load' });
    await extPage.evaluate(() => {
      window.__hiddenReloadSentinel = 'before-import';
    });
    await controlPage.bringToFront();
    expect(await extPage.evaluate(() => document.hidden)).toBe(true);
    const workerTarget = browser.targets().find(target => target.type() === 'service_worker');
    const worker = await workerTarget.worker();
    await worker.evaluate(() => new Promise(resolve => {
      chrome.runtime.sendMessage({
        bookmarksChanged: { eventType: 'imported', id: null }
      }, () => resolve());
    }));
    await extPage.waitForFunction(() => window.__hiddenReloadSentinel === undefined);
    await extPage.bringToFront();
    await extPage.waitForSelector('#add');
    await controlPage.close();
  });

  it('keeps one tile after its own create event is authoritatively refreshed', async() => {
    const title = `own-${Date.now()}`;
    await extPage.evaluate(expected => {
      window.__ownBookmarkChanged = false;
      window.__ownRefreshObserved = false;
      chrome.runtime.onMessage.addListener(request => {
        if (request.bookmarksChanged) window.__ownBookmarkChanged = true;
      });
      new MutationObserver(records => {
        if (!window.__ownBookmarkChanged) return;
        const removedOwnTile = records.some(record => (
          Array.from(record.removedNodes).some(node => (
            node.nodeType === Node.ELEMENT_NODE
            && (
              node.querySelector?.('.bookmark__title')?.textContent === expected
              || node.matches?.('.bookmark')
                && node.querySelector?.('.bookmark__title')?.textContent === expected
            )
          ))
        ));
        if (removedOwnTile) window.__ownRefreshObserved = true;
      }).observe(document.getElementById('bookmarks'), { childList: true });
    }, title);
    await extPage.click('#add');
    await extPage.evaluate(value => {
      document.getElementById('title').value = value;
      document.getElementById('url').value = 'https://example.com/own';
    }, title);
    await extPage.click('#saveBookmarkBtn');

    await extPage.waitForFunction(expected => (
      window.__ownBookmarkChanged
      && window.__ownRefreshObserved
      && Array.from(document.querySelectorAll('.bookmark__title'))
        .filter(node => node.textContent === expected).length === 1
    ), {}, title);
    expect(await extPage.$$eval(
      '.bookmark__title',
      (nodes, expected) => nodes.filter(node => node.textContent === expected).length,
      title
    )).toBe(1);
  });

  it('repeats an active bookmark search after an external mutation', async() => {
    let extensionWorker;
    let createdBookmarkId = null;
    const query = `active-search-${Date.now()}`;
    try {
      await runActiveSearchPhase(
        extPage,
        'visible-ready',
        query,
        async() => {
          await extPage.bringToFront();
          await extPage.waitForFunction(() => (
            !document.hidden
            && document.querySelector('vb-header')?.isConnected
            && document.getElementById('bookmarks')?.isConnected
          ), { polling: 100, timeout: 5500 });
        }
      );
      extensionWorker = await runActiveSearchPhase(
        extPage,
        'connect-service-worker',
        query,
        () => {
          const target = browser.targets()
            .find(item => item.type() === 'service_worker');
          if (!target) throw new Error('extension service worker target not found');
          return target.worker();
        }
      );
      const parentId = await runActiveSearchPhase(
        extPage,
        'read-parent',
        query,
        () => extPage.$eval('#bookmarks', node => node.dataset.folder)
      );
      await runActiveSearchPhase(
        extPage,
        'dispatch-search',
        query,
        () => extPage.evaluate(search => {
          window.__activeSearchEvidence = {
            runtimeMessages: 0,
            lastEnvelope: null,
            hiddenAtLastEnvelope: null,
            visibilityStateAtLastEnvelope: null,
            visibilityChanges: [],
            resultRenderObserved: false,
            resultNodeDisconnected: false
          };
          sessionStorage.removeItem('active-search-runtime-evidence');
          document.addEventListener('visibilitychange', () => {
            window.__activeSearchEvidence?.visibilityChanges.push({
              hidden: document.hidden,
              visibilityState: document.visibilityState
            });
          });
          chrome.runtime.onMessage.addListener(request => {
            if (request.bookmarksChanged) {
              window.__activeSearchEvidence.runtimeMessages += 1;
              window.__activeSearchEvidence.lastEnvelope = request.bookmarksChanged;
              window.__activeSearchEvidence.hiddenAtLastEnvelope = document.hidden;
              window.__activeSearchEvidence.visibilityStateAtLastEnvelope =
                document.visibilityState;
              sessionStorage.setItem(
                'active-search-runtime-evidence',
                JSON.stringify(window.__activeSearchEvidence)
              );
            }
          });
          document.querySelector('vb-header').dispatchEvent(new CustomEvent('vb:search', {
            detail: { search, isBookmarksEngine: true }
          }));
        }, query)
      );
      await waitForActiveSearchState(
        extPage,
        'initial-search-ready',
        query,
        () => (
          document.body.classList.contains('has-search')
          && document.getElementById('dial_loading')?.hidden
          && Boolean(document.querySelector('.empty-search'))
        )
      );
      await runActiveSearchPhase(
        extPage,
        'observe-result-render',
        query,
        () => extPage.evaluate(expected => {
          const emptySearch = document.querySelector('.empty-search');
          const observer = new MutationObserver(() => {
            const exactResult = Array.from(document.querySelectorAll('.bookmark__title'))
              .filter(node => node.textContent === expected).length === 1;
            if (!emptySearch?.isConnected && exactResult) {
              window.__activeSearchEvidence.resultRenderObserved = true;
              observer.disconnect();
            }
          });
          observer.observe(document.getElementById('bookmarks'), { childList: true });
        }, query)
      );

      await runActiveSearchPhase(
        extPage,
        'pre-mutation-visible',
        query,
        () => extPage.evaluate(() => {
          if (document.hidden || document.visibilityState !== 'visible') {
            throw new Error(
              `newtab lost visibility before mutation: ${document.visibilityState}`
            );
          }
          window.__activeSearchEvidence.preMutationVisibility = {
            hidden: document.hidden,
            visibilityState: document.visibilityState
          };
        })
      );
      const createdBookmark = await runActiveSearchPhase(
        extPage,
        'service-worker-create',
        query,
        () => extensionWorker.evaluate(({ parentId, query }) => new Promise((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error('bookmarks.create callback timeout')),
            5000
          );
          chrome.bookmarks.create({
            parentId,
            title: query,
            url: 'https://example.com/search-refresh'
          }, bookmark => {
            clearTimeout(timeout);
            if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
            else resolve(bookmark);
          });
        }), { parentId, query })
      );
      createdBookmarkId = createdBookmark.id;
      await waitForActiveSearchState(
        extPage,
        'bookmark-envelope-received',
        query,
        expected => (
          document.hidden
          || (
            window.__activeSearchEvidence?.runtimeMessages > 0
            && window.__activeSearchEvidence?.lastEnvelope?.eventType === 'created'
            && String(window.__activeSearchEvidence?.lastEnvelope?.id) === expected
          )
          || JSON.parse(
            sessionStorage.getItem('active-search-runtime-evidence') || 'null'
          )?.lastEnvelope?.id !== undefined
            && String(JSON.parse(
              sessionStorage.getItem('active-search-runtime-evidence') || 'null'
            ).lastEnvelope.id) === String(expected)
        ),
        createdBookmarkId
      );
      await runActiveSearchPhase(
        extPage,
        'bookmark-envelope-visible',
        query,
        () => extPage.evaluate(expected => {
          const evidence = window.__activeSearchEvidence
            || JSON.parse(
              sessionStorage.getItem('active-search-runtime-evidence') || 'null'
            );
          if (document.hidden || document.visibilityState !== 'visible') {
            throw new Error('newtab was hidden during bookmark event');
          }
          if (
            !evidence
            || evidence.hiddenAtLastEnvelope !== false
            || evidence.visibilityStateAtLastEnvelope !== 'visible'
            || evidence.lastEnvelope?.eventType !== 'created'
            || String(evidence.lastEnvelope?.id) !== String(expected)
          ) {
            throw new Error(
              `bookmark envelope visibility mismatch: ${JSON.stringify(evidence)}`
            );
          }
        }, createdBookmarkId)
      );
      await waitForActiveSearchState(
        extPage,
        'authoritative-result',
        query,
        expected => (
          !document.hidden
          && document.body.classList.contains('has-search')
          && document.getElementById('dial_loading')?.hidden
          && window.__activeSearchEvidence?.resultRenderObserved
          && Array.from(document.querySelectorAll('.bookmark__title'))
            .filter(node => node.textContent === expected).length === 1
        )
      );

      await runActiveSearchPhase(
        extPage,
        'dispatch-reset',
        query,
        () => extPage.evaluate(expected => {
          const resultNode = Array.from(document.querySelectorAll('.bookmark__title'))
            .find(node => node.textContent === expected)?.closest('.bookmark');
          const observer = new MutationObserver(() => {
            if (resultNode && !resultNode.isConnected) {
              window.__activeSearchEvidence.resultNodeDisconnected = true;
              observer.disconnect();
            }
          });
          observer.observe(document.getElementById('bookmarks'), { childList: true });
          document.querySelector('vb-header').dispatchEvent(new CustomEvent('vb:searchreset'));
        }, query)
      );
      await waitForActiveSearchState(
        extPage,
        'authoritative-reset',
        query,
        () => (
          !document.body.classList.contains('has-search')
          && document.getElementById('dial_loading')?.hidden
          && document.getElementById('add')?.isConnected
          && window.__activeSearchEvidence?.resultNodeDisconnected
        )
      );
    } finally {
      if (!extPage.isClosed()) {
        await extPage.evaluate(() => {
          if (document.body.classList.contains('has-search')) {
            document.querySelector('vb-header')?.dispatchEvent(
              new CustomEvent('vb:searchreset')
            );
          }
        }).catch(() => undefined);
        await extPage.bringToFront().catch(() => undefined);
        await extPage.waitForFunction(() => (
          !document.body.classList.contains('has-search')
          && document.getElementById('dial_loading')?.hidden
          && document.getElementById('add')?.isConnected
        ), { polling: 100, timeout: 3000 }).catch(() => undefined);
      }
      if (createdBookmarkId) {
        if (!extensionWorker) {
          const workerTarget = browser.targets()
            .find(item => item.type() === 'service_worker');
          extensionWorker = await workerTarget?.worker().catch(() => null);
        }
        await extensionWorker?.evaluate(bookmarkId => new Promise(resolve => {
          chrome.bookmarks.remove(bookmarkId, () => resolve());
        }), createdBookmarkId).catch(() => undefined);
        if (!extPage.isClosed()) {
          await extPage.waitForFunction(expected => (
            document.getElementById('add')?.isConnected
            && !Array.from(document.querySelectorAll('.bookmark__title'))
              .some(node => node.textContent === expected)
          ), { polling: 100, timeout: 3000 }, query).catch(() => undefined);
        }
      }
    }
  });

  it('cleans every seeded IndexedDB record after an external recursive removal', async() => {
    let extensionWorker;
    let ids = [];
    try {
      await runRecursiveCleanupPhase(
        extPage,
        'visible-ready',
        ids,
        async() => {
          await extPage.bringToFront();
          await extPage.waitForFunction(() => (
            !document.hidden
            && document.visibilityState === 'visible'
            && document.getElementById('add')?.isConnected
            && document.getElementById('dial_loading')?.hidden
          ), { polling: 100, timeout: 5500 });
        }
      );
      extensionWorker = await runRecursiveCleanupPhase(
        extPage,
        'connect-service-worker',
        ids,
        () => {
          const target = browser.targets()
            .find(item => item.type() === 'service_worker');
          if (!target) throw new Error('extension service worker target not found');
          return target.worker();
        }
      );
      const parentId = await runRecursiveCleanupPhase(
        extPage,
        'read-parent',
        ids,
        () => extPage.$eval('#bookmarks', node => node.dataset.folder)
      );
      await runRecursiveCleanupPhase(
        extPage,
        'observe-child-envelope-and-render',
        ids,
        () => extPage.evaluate(() => {
          window.__recursiveCleanupEvidence = {
            sequence: 0,
            envelopes: [],
            renders: []
          };
          chrome.runtime.onMessage.addListener(request => {
            if (!request.bookmarksChanged) return;
            const evidence = window.__recursiveCleanupEvidence;
            evidence.sequence += 1;
            evidence.envelopes.push({
              sequence: evidence.sequence,
              eventType: request.bookmarksChanged.eventType,
              id: String(request.bookmarksChanged.id),
              hidden: document.hidden,
              visibilityState: document.visibilityState
            });
          });
          new MutationObserver(() => {
            const evidence = window.__recursiveCleanupEvidence;
            evidence.sequence += 1;
            evidence.renders.push({
              sequence: evidence.sequence,
              hidden: document.hidden,
              addConnected: Boolean(document.getElementById('add')?.isConnected),
              cleanupRootCount: Array.from(
                document.querySelectorAll('.bookmark__title')
              ).filter(node => node.textContent === 'cleanup-root').length
            });
          }).observe(document.getElementById('bookmarks'), { childList: true });
        })
      );
      ids = await runRecursiveCleanupPhase(
        extPage,
        'service-worker-create-subtree',
        ids,
        () => extensionWorker.evaluate(parent => new Promise((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error('recursive create callback timeout')),
            5000
          );
          chrome.bookmarks.create({ parentId: parent, title: 'cleanup-root' }, folder => {
            if (chrome.runtime.lastError) {
              clearTimeout(timeout);
              reject(chrome.runtime.lastError);
              return;
            }
            chrome.bookmarks.create({
              parentId: folder.id,
              title: 'cleanup-child',
              url: 'https://example.com/cleanup'
            }, child => {
              clearTimeout(timeout);
              if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
              else resolve([folder.id, child.id]);
            });
          });
        }), parentId)
      );
      await runRecursiveCleanupPhase(
        extPage,
        'exact-child-created-envelope',
        ids,
        () => extPage.waitForFunction(childId => {
          const envelope = window.__recursiveCleanupEvidence?.envelopes
            .find(item => (
              item.eventType === 'created'
              && String(item.id) === String(childId)
            ));
          return Boolean(
            envelope
            && envelope.hidden === false
            && envelope.visibilityState === 'visible'
            && !document.hidden
          );
        }, { polling: 100, timeout: 5500 }, ids[1])
      );
      await runRecursiveCleanupPhase(
        extPage,
        'child-authoritative-visible-stable',
        ids,
        () => extPage.waitForFunction(childId => {
          const evidence = window.__recursiveCleanupEvidence;
          const childEnvelope = evidence?.envelopes.find(item => (
            item.eventType === 'created'
            && String(item.id) === String(childId)
          ));
          const laterAuthoritativeRender = evidence?.renders.some(render => (
            render.sequence > childEnvelope?.sequence
            && render.hidden === false
            && render.addConnected
            && render.cleanupRootCount === 1
          ));
          return Boolean(
            childEnvelope
            && laterAuthoritativeRender
            && !document.hidden
            && document.visibilityState === 'visible'
            && document.getElementById('add')?.isConnected
            && document.getElementById('dial_loading')?.hidden
            && Array.from(document.querySelectorAll('.bookmark__title'))
              .filter(node => node.textContent === 'cleanup-root').length === 1
          );
        }, { polling: 100, timeout: 5500 }, ids[1])
      );
      await runRecursiveCleanupPhase(
        extPage,
        'seed-indexeddb',
        ids,
        () => extPage.evaluate(recordIds => new Promise((resolve, reject) => {
          if (document.hidden || document.visibilityState !== 'visible') {
            reject(new Error('newtab hidden before IndexedDB seed'));
            return;
          }
          const request = indexedDB.open('startgrid', 1);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const transaction = request.result.transaction('images', 'readwrite');
            recordIds.forEach(id => {
              transaction.objectStore('images').put({ id, blob: new Blob(['x']) });
            });
            transaction.oncomplete = resolve;
            transaction.onerror = () => reject(transaction.error);
          };
        }), ids)
      );
      await runRecursiveCleanupPhase(
        extPage,
        'seed-visible-verified',
        ids,
        async() => {
          const evidence = await getRecursiveCleanupEvidence(extPage, ids);
          if (
            evidence.hidden
            || evidence.visibilityState !== 'visible'
            || evidence.records?.some(record => record.present !== true)
          ) {
            throw new Error(`seed verification failed: ${JSON.stringify(evidence)}`);
          }
        }
      );
      await runRecursiveCleanupPhase(
        extPage,
        'pre-remove-visible',
        ids,
        () => extPage.evaluate(() => {
          if (document.hidden || document.visibilityState !== 'visible') {
            throw new Error('newtab hidden before recursive remove');
          }
        })
      );
      await runRecursiveCleanupPhase(
        extPage,
        'service-worker-remove-tree',
        ids,
        () => extensionWorker.evaluate(folderId => new Promise((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error('removeTree callback timeout')),
            5000
          );
          chrome.bookmarks.removeTree(folderId, () => {
            clearTimeout(timeout);
            if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
            else resolve();
          });
        }), ids[0])
      );
      await runRecursiveCleanupPhase(
        extPage,
        'recursive-idb-cleanup',
        ids,
        () => extPage.waitForFunction(recordIds => new Promise(resolve => {
          if (document.hidden || document.visibilityState !== 'visible') {
            resolve(false);
            return;
          }
          const request = indexedDB.open('startgrid', 1);
          request.onsuccess = () => {
            const store = request.result.transaction('images').objectStore('images');
            Promise.all(recordIds.map(id => new Promise(done => {
              const get = store.get(id);
              get.onsuccess = () => done(get.result);
            }))).then(records => resolve(
              records.every(record => record === undefined)
              && document.getElementById('add')?.isConnected
              && !Array.from(document.querySelectorAll('.bookmark__title'))
                .some(node => node.textContent === 'cleanup-root')
            ));
          };
        }), { polling: 100, timeout: 5500 }, ids)
      );
    } finally {
      if (!extensionWorker) {
        const target = browser.targets()
          .find(item => item.type() === 'service_worker');
        extensionWorker = await target?.worker().catch(() => null);
      }
      if (ids[0]) {
        await extensionWorker?.evaluate(folderId => new Promise(resolve => {
          chrome.bookmarks.removeTree(folderId, () => resolve());
        }), ids[0]).catch(() => undefined);
      }
      if (!extPage.isClosed()) {
        await extPage.bringToFront().catch(() => undefined);
        if (ids.length) {
          await extPage.evaluate(recordIds => new Promise(resolve => {
            const request = indexedDB.open('startgrid', 1);
            request.onerror = () => resolve();
            request.onsuccess = () => {
              const transaction = request.result.transaction('images', 'readwrite');
              recordIds.forEach(id => transaction.objectStore('images').delete(id));
              transaction.oncomplete = resolve;
              transaction.onerror = resolve;
            };
          }), ids).catch(() => undefined);
        }
        await extPage.waitForFunction(() => (
          !document.hidden
          && document.getElementById('add')?.isConnected
          && document.getElementById('dial_loading')?.hidden
          && !Array.from(document.querySelectorAll('.bookmark__title'))
            .some(node => node.textContent === 'cleanup-root')
        ), { polling: 100, timeout: 3000 }).catch(() => undefined);
      }
    }
  });

  it('renders malicious titles literally and preserves entities through edit-save', async() => {
    const title = '<img src=x onerror=alert(1)> &amp; $&';
    const editedTitle = '$& $` $\' $$ <img> A &amp; B';
    const bookmarkUrl = 'https://example.com/literal';
    const titles = [title, editedTitle];
    const suspiciousRequests = [];
    const unexpectedDialogs = [];
    const captureSuspiciousRequest = request => {
      if (new URL(request.url()).pathname === '/x') {
        suspiciousRequests.push(request.url());
      }
    };
    const dismissUnexpectedDialog = dialog => {
      unexpectedDialogs.push({
        type: dialog.type(),
        message: dialog.message()
      });
      dialog.dismiss().catch(() => undefined);
    };
    extPage.__literalTitleDialogs = unexpectedDialogs;
    extPage.on('dialog', dismissUnexpectedDialog);
    extPage.on('request', captureSuspiciousRequest);

    try {
      await runLiteralTitlePhase(
        extPage,
        'stable-visible-page',
        titles,
        async() => {
          await extPage.bringToFront();
          await extPage.waitForFunction(() => (
            !document.hidden
            && document.getElementById('add')?.isConnected
            && document.getElementById('dial_loading')?.hidden
          ), { polling: 100, timeout: 5500 });
        }
      );
      await runLiteralTitlePhase(
        extPage,
        'open-create-form',
        titles,
        async() => {
          await extPage.$eval('#add', add => {
            if (!add.isConnected) throw new Error('Add button is detached');
            add.click();
          });
          await extPage.waitForFunction(() => (
            document.getElementById('formBookmark')?.dataset.action === 'New'
            && document.getElementById('title')?.isConnected
          ), { polling: 100, timeout: 5500 });
        }
      );
      await runLiteralTitlePhase(
        extPage,
        'create-bookmark',
        titles,
        async() => {
          await extPage.evaluate(({ value, url }) => {
            window.__literalModalLifecycle = {
              createClosed: false,
              editOpened: false
            };
            document.getElementById('modal').addEventListener(
              'gmodal:close',
              () => {
                window.__literalModalLifecycle.createClosed = true;
              },
              { once: true }
            );
            document.getElementById('title').value = value;
            document.getElementById('url').value = url;
          }, { value: title, url: bookmarkUrl });
          await extPage.click('#saveBookmarkBtn');
          await extPage.waitForFunction(expected => {
            const modal = document.getElementById('modal');
            return (
              Array.from(document.querySelectorAll('.bookmark__title'))
                .some(node => node.textContent === expected)
              && modal?.instance?._isOpen === false
              && modal.instance._isTransitiong === false
              && document.getElementById('add')?.isConnected
              && document.getElementById('dial_loading')?.hidden
            );
          }, { polling: 100, timeout: 5500 }, title);
        }
      );
      const rendered = await runLiteralTitlePhase(
        extPage,
        'verify-literal-render',
        titles,
        () => extPage.$$eval('.bookmark__title', (nodes, expected) => {
          const node = nodes.find(item => item.textContent === expected);
          return {
            text: node?.textContent,
            childElements: node?.children.length,
            injectedImages: document.querySelectorAll('.bookmark__title img').length
          };
        }, title)
      );
      expect(rendered).toEqual({
        text: title,
        childElements: 0,
        injectedImages: 0
      });
      expect(unexpectedDialogs).toEqual([]);
      expect(suspiciousRequests).toEqual([]);

      await runLiteralTitlePhase(
        extPage,
        'create-modal-fully-closed',
        titles,
        () => extPage.waitForFunction(() => {
          const modal = document.getElementById('modal');
          return (
            window.__literalModalLifecycle?.createClosed === true
            && modal?.instance?._isOpen === false
            && modal.instance._isTransitiong === false
            && !modal.classList.contains('is-shown')
            && getComputedStyle(modal).display === 'none'
            && !modal.contains(document.activeElement)
            && document.getElementById('add')?.isConnected
          );
        }, { polling: 50, timeout: 5500 })
      );
      await runLiteralTitlePhase(
        extPage,
        'open-edit-form',
        titles,
        async() => {
          const expectedEditId = await extPage.evaluate(currentTitle => {
            const titleNode = Array.from(document.querySelectorAll('.bookmark__title'))
              .find(node => node.textContent === currentTitle);
            if (!titleNode) throw new Error('Literal bookmark tile is missing');
            const modal = document.getElementById('modal');
            modal.addEventListener(
              'gmodal:open',
              () => {
                window.__literalModalLifecycle.editOpened = true;
              },
              { once: true }
            );
            const bookmarkId = titleNode.closest('.bookmark').dataset.id;
            document.getElementById('context-menu').dispatchEvent(new CustomEvent(
              'vb:contextmenu:select',
              {
                detail: {
                  trigger: titleNode.closest('.bookmark'),
                  selection: 'edit'
                }
              }
            ));
            return bookmarkId;
          }, title);
          await extPage.waitForFunction(({ expectedId, expectedTitle }) => {
            const modal = document.getElementById('modal');
            const titleInput = document.getElementById('title');
            return (
              window.__literalModalLifecycle?.editOpened === true
              && modal?.instance?._isOpen === true
              && modal.instance._isTransitiong === false
              && modal.classList.contains('is-shown')
              && getComputedStyle(modal).display !== 'none'
              && titleInput?.value === expectedTitle
              && titleInput.getBoundingClientRect().width > 0
              && titleInput.getBoundingClientRect().height > 0
              && document.activeElement === titleInput
              && document.getElementById('formBookmark')?.dataset.action
                === expectedId
            );
          }, { polling: 50, timeout: 5500 }, {
            expectedId: expectedEditId,
            expectedTitle: title
          });
        }
      );
      await runLiteralTitlePhase(
        extPage,
        'save-edited-title',
        titles,
        async() => {
          await extPage.evaluate(value => {
            document.getElementById('title').value = value;
          }, editedTitle);
          await extPage.click('#saveBookmarkBtn');
          await extPage.waitForFunction(expected => (
            Array.from(document.querySelectorAll('.bookmark__title'))
              .some(node => node.textContent === expected && node.children.length === 0)
          ), { polling: 100, timeout: 5500 }, editedTitle);
          await extPage.waitForFunction(expected => {
            const modal = document.getElementById('modal');
            return (
              Array.from(document.querySelectorAll('.bookmark__title'))
                .some(node => node.textContent === expected && node.children.length === 0)
              && modal?.instance?._isOpen === false
              && modal.instance._isTransitiong === false
              && document.getElementById('add')?.isConnected
              && document.getElementById('dial_loading')?.hidden
            );
          }, { polling: 100, timeout: 5500 }, editedTitle);
        }
      );
      expect(unexpectedDialogs).toEqual([]);
      expect(suspiciousRequests).toEqual([]);

      await runLiteralTitlePhase(
        extPage,
        'open-delete-confirmation',
        titles,
        async() => {
          await extPage.evaluate(currentTitle => {
            const titleNode = Array.from(document.querySelectorAll('.bookmark__title'))
              .find(node => node.textContent === currentTitle);
            if (!titleNode) throw new Error('Edited bookmark tile is missing');
            document.getElementById('context-menu').dispatchEvent(new CustomEvent(
              'vb:contextmenu:select',
              {
                detail: {
                  trigger: titleNode.closest('.bookmark'),
                  selection: 'remove'
                }
              }
            ));
          }, editedTitle);
          await extPage.waitForFunction(() => {
            const popup = document.getElementById('popup');
            const resolveControl = popup?.querySelector('[data-popup="resolve"]');
            return (
              popup?.classList.contains('is-shown')
              && resolveControl?.isConnected
              && document.activeElement === resolveControl
              && resolveControl.getBoundingClientRect().width > 0
              && resolveControl.getBoundingClientRect().height > 0
            );
          }, { polling: 50, timeout: 5500 });
          await extPage.evaluate(() => {
            const resolveControl = document.querySelector(
              '#popup [data-popup="resolve"]'
            );
            window.__literalDeleteConfirm = { clickSeen: false };
            resolveControl.addEventListener('click', () => {
              window.__literalDeleteConfirm.clickSeen = true;
            }, { once: true });
          });
        }
      );
      await runLiteralTitlePhase(
        extPage,
        'activate-delete-confirmation',
        titles,
        async() => {
          await extPage.click('#popup [data-popup="resolve"]');
          await extPage.waitForFunction(
            () => window.__literalDeleteConfirm?.clickSeen === true,
            { polling: 50, timeout: 1500 }
          );
        },
        2000
      );
      const deleteToast = await runLiteralTitlePhase(
        extPage,
        'await-hidden-tile-and-toast',
        titles,
        async() => {
          await extPage.waitForFunction(expected => {
            const titleNode = Array.from(document.querySelectorAll('.bookmark__title'))
              .find(node => node.textContent === expected);
            return (
              !document.getElementById('popup')
              && titleNode?.closest('.bookmark')?.hidden === true
              && Array.from(document.querySelectorAll('.toast__message'))
                .some(node => node.textContent.includes(expected))
            );
          }, { polling: 100, timeout: 5500 }, editedTitle);
          return extPage.$$eval('.toast__message', (nodes, expected) => {
            const node = nodes.find(item => item.textContent.includes(expected));
            return { text: node?.textContent, childElements: node?.children.length };
          }, editedTitle);
        }
      );
      expect(deleteToast.text).toContain(editedTitle);
      expect(deleteToast.childElements).toBe(0);
      expect(unexpectedDialogs).toEqual([]);
      expect(suspiciousRequests).toEqual([]);
    } finally {
      extPage.off('request', captureSuspiciousRequest);
      if (!extPage.isClosed()) {
        await settleTestCleanup(() => extPage.bringToFront());
        await settleTestCleanup(
          () => extPage.evaluate(({ url, expectedTitles }) => new Promise(resolve => {
            chrome.bookmarks.search({ url }, results => {
              const ids = results
                .filter(bookmark => expectedTitles.includes(bookmark.title))
                .map(bookmark => bookmark.id);
              if (!ids.length) {
                resolve();
                return;
              }
              let remaining = ids.length;
              ids.forEach(id => chrome.bookmarks.remove(id, () => {
                remaining -= 1;
                if (!remaining) resolve();
              }));
            });
          }), { url: bookmarkUrl, expectedTitles: titles }),
          2500
        );
        await settleTestCleanup(
          () => extPage.reload({ waitUntil: 'load', timeout: 5500 }),
          6000
        );
        await settleTestCleanup(
          () => extPage.waitForFunction(() => (
            !document.hidden
            && document.getElementById('add')?.isConnected
            && document.getElementById('dial_loading')?.hidden
          ), { polling: 100, timeout: 5500 }),
          6000
        );
      }
      extPage.off('dialog', dismissUnexpectedDialog);
      delete extPage.__literalTitleDialogs;
    }
  });

  it('starts and destroys the real snow canvas on live reduced-motion changes', async() => {
    let isolatedBrowser;
    let snowPage;
    try {
      const isolatedContext = await bootstrap({
        devtools: false,
        launchTimeout: 10000,
        targetTimeout: 10000,
        navigationTimeout: 5500,
        openExtensionPage: false
      });
      isolatedBrowser = isolatedContext.browser;
      await runSnowPhase(
        undefined,
        'await-isolated-install-settings',
        () => isolatedContext.worker.evaluate(async() => {
          const readSettings = () => new Promise((resolve, reject) => {
            chrome.storage.local.get('settings', state => {
              if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
              else resolve(state.settings);
            });
          });
          const delay = milliseconds => new Promise(
            resolve => setTimeout(resolve, milliseconds)
          );
          const deadline = Date.now() + 5000;
          let lastSerialized;
          let stableSince;
          let lastSettings;

          while (Date.now() < deadline) {
            lastSettings = await readSettings();
            const initialized = (
              lastSettings?.language === 'auto'
              && lastSettings?.color_theme === 'os'
              && lastSettings?.snow_mode === 'winter'
              && lastSettings?.page_cascade_duration === 650
              && lastSettings?.dial_width === 70
              && lastSettings?.enable_sync === true
              && lastSettings?.search_engine === 'bookmarks'
              && typeof lastSettings?.keyboard_shortcuts === 'object'
            );
            const serialized = JSON.stringify(lastSettings);
            if (initialized && serialized === lastSerialized) {
              stableSince ??= Date.now();
              if (Date.now() - stableSince >= 300) {
                return {
                  keyCount: Object.keys(lastSettings).length,
                  stableFor: Date.now() - stableSince
                };
              }
            } else {
              stableSince = undefined;
              lastSerialized = serialized;
            }
            await delay(100);
          }

          throw new Error(`install settings did not stabilize: ${JSON.stringify({
            keyCount: Object.keys(lastSettings || {}).length,
            enable_sync: lastSettings?.enable_sync,
            snow_mode: lastSettings?.snow_mode,
            page_cascade_duration: lastSettings?.page_cascade_duration,
            dial_width: lastSettings?.dial_width
          })}`);
        }),
        6000
      );
      await runSnowPhase(
        undefined,
        'establish-isolated-local-always-with-sync-disabled',
        () => isolatedContext.worker.evaluate(() => new Promise((resolve, reject) => {
          chrome.storage.local.get('settings', state => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
              return;
            }
            chrome.storage.local.set({
              settings: {
                ...(state.settings || {}),
                enable_sync: false,
                snow_mode: 'always'
              }
            }, () => (
              chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve()
            ));
          });
        }))
      );
      await runSnowPhase(
        undefined,
        'verify-isolated-worker-settings',
        () => isolatedContext.worker.evaluate(() => new Promise((resolve, reject) => {
          chrome.storage.local.get('settings', state => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
              return;
            }
            if (
              state.settings?.enable_sync !== false
              || state.settings?.snow_mode !== 'always'
            ) {
              reject(new Error(
                `unexpected isolated worker settings: ${JSON.stringify({
                  enable_sync: state.settings?.enable_sync,
                  snow_mode: state.settings?.snow_mode
                })}`
              ));
              return;
            }
            resolve();
          });
        }))
      );
      snowPage = await runSnowPhase(
        undefined,
        'open-dedicated-page',
        () => isolatedBrowser.newPage()
      );
      await runSnowPhase(
        snowPage,
        'pre-navigation-reduce-emulation',
        () => snowPage.emulateMediaFeatures([{
          name: 'prefers-reduced-motion',
          value: 'reduce'
        }])
      );
      await runSnowPhase(
        snowPage,
        'first-navigation-under-reduce',
        () => snowPage.goto(
          isolatedContext.extensionUrl,
          { waitUntil: 'load', timeout: 5500 }
        )
      );
      await runSnowPhase(
        snowPage,
        'effective-always-setting',
        () => snowPage.evaluate(() => new Promise((resolve, reject) => {
          chrome.storage.local.get('settings', state => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
              return;
            }
            if (
              state.settings?.enable_sync !== false
              || state.settings?.snow_mode !== 'always'
            ) {
              reject(new Error(
                `unexpected effective settings: ${JSON.stringify({
                  enable_sync: state.settings?.enable_sync,
                  snow_mode: state.settings?.snow_mode
                })}`
              ));
              return;
            }
            resolve();
          });
        }))
      );
      await runSnowPhase(
        snowPage,
        'reduced-initial-state',
        () => snowPage.waitForFunction(() => (
          !document.hidden
          && matchMedia('(prefers-reduced-motion: reduce)').matches
          && !window.snowInstance
          && document.querySelectorAll('canvas').length === 0
        ), { polling: 100, timeout: 5500 })
      );
      await runSnowPhase(
        snowPage,
        'instrument-live-lifecycle',
        () => snowPage.evaluate(() => {
          const originalRequest = window.requestAnimationFrame.bind(window);
          const originalCancel = window.cancelAnimationFrame.bind(window);
          window.__snowRafEvidence = {
            requested: [],
            cancelled: []
          };
          window.requestAnimationFrame = callback => {
            const id = originalRequest(callback);
            window.__snowRafEvidence.requested.push(id);
            return id;
          };
          window.cancelAnimationFrame = id => {
            window.__snowRafEvidence.cancelled.push(id);
            return originalCancel(id);
          };
          window.__snowMediaChanges = [];
          matchMedia('(prefers-reduced-motion: reduce)')
            .addEventListener('change', event => {
              window.__snowMediaChanges.push({
                matches: event.matches,
                hidden: document.hidden
              });
            });
        })
      );
      await runSnowPhase(
        snowPage,
        'no-preference-emulation',
        () => snowPage.emulateMediaFeatures([{
          name: 'prefers-reduced-motion',
          value: 'no-preference'
        }])
      );
      await runSnowPhase(
        snowPage,
        'no-preference-signal',
        () => snowPage.waitForFunction(() => (
          !matchMedia('(prefers-reduced-motion: reduce)').matches
          && window.__snowMediaChanges?.some(change => (
            change.matches === false && change.hidden === false
          ))
        ), { polling: 100, timeout: 5500 })
      );
      await runSnowPhase(
        snowPage,
        'no-preference-start',
        () => snowPage.waitForFunction(() => (
          Boolean(window.snowInstance)
          && window.snowInstance.destroyed === false
          && document.querySelectorAll('canvas').length === 1
          && window.__snowRafEvidence?.requested.length > 0
        ), { polling: 100, timeout: 5500 })
      );
      await runSnowPhase(
        snowPage,
        'live-reduce-emulation',
        () => snowPage.emulateMediaFeatures([{
          name: 'prefers-reduced-motion',
          value: 'reduce'
        }])
      );
      await runSnowPhase(
        snowPage,
        'live-reduce-signal',
        () => snowPage.waitForFunction(() => (
          matchMedia('(prefers-reduced-motion: reduce)').matches
          && window.__snowMediaChanges?.at(-1)?.matches === true
          && window.__snowMediaChanges.at(-1).hidden === false
        ), { polling: 100, timeout: 5500 })
      );
      await runSnowPhase(
        snowPage,
        'live-reduce-destroy',
        () => snowPage.waitForFunction(previousCancelled => (
          matchMedia('(prefers-reduced-motion: reduce)').matches
          && window.__snowMediaChanges?.at(-1)?.matches === true
          && !window.snowInstance
          && document.querySelectorAll('canvas').length === 0
        ), { polling: 100, timeout: 5500 })
      );
      await runSnowPhase(
        snowPage,
        'stable-live-reduce',
        () => snowPage.waitForFunction(() => {
          const stable = (
            matchMedia('(prefers-reduced-motion: reduce)').matches
            && window.__snowMediaChanges?.at(-1)?.matches === true
            && !window.snowInstance
            && document.querySelectorAll('canvas').length === 0
          );
          if (!stable) {
            window.__stableReducedSince = undefined;
            return false;
          }
          window.__stableReducedSince ??= performance.now();
          return performance.now() - window.__stableReducedSince >= 750;
        }, { polling: 100, timeout: 5500 })
      );
    } finally {
      if (snowPage && !snowPage.isClosed()) {
        await snowPage.emulateMediaFeatures([{
          name: 'prefers-reduced-motion',
          value: 'reduce'
        }]).catch(() => undefined);
      }
      await isolatedBrowser?.close().catch(() => undefined);
      if (!extPage.isClosed()) {
        await extPage.bringToFront().catch(() => undefined);
        await extPage.waitForFunction(() => (
          !document.hidden
          && document.getElementById('add')?.isConnected
        ), { polling: 100, timeout: 3000 }).catch(() => undefined);
      }
    }
  });

  it('accepts and persists a real SVG background through the options page', async() => {
    let optionsPage;
    let previousBackgroundImage;
    try {
      optionsPage = await browser.newPage();
      await optionsPage.evaluateOnNewDocument(svg => {
        window.showOpenFilePicker = async() => [{
          getFile: async() => new File([svg], 'background.svg', {
            type: 'image/svg+xml'
          })
        }];
      }, readFileSync('e2e/fixtures/background.svg', 'utf8'));
      await runBackgroundUploadPhase(
        optionsPage,
        'open-options-page',
        async() => {
          await optionsPage.goto(
            extensionUrl.replace('newtab.html', 'options.html'),
            { waitUntil: 'load', timeout: 5500 }
          );
          await optionsPage.waitForFunction(() => {
            const upload = document.getElementById('bgFile');
            return (
              upload?.isConnected
              && upload.getAttribute('accept')?.split(/\s*,\s*/).includes('.svg')
            );
          }, { polling: 100, timeout: 5500 });
          previousBackgroundImage = await optionsPage.$eval(
            '#background_image',
            input => input.value
          );
          await optionsPage.$eval('#background_image', input => {
            input.value = 'background_local';
            input.dispatchEvent(new Event('change', { bubbles: true }));
          });
          await optionsPage.waitForFunction(() => {
            const section = document.getElementById('background_local');
            const upload = document.getElementById('bgFile');
            return (
              section?.hidden === false
              && upload?.getBoundingClientRect().width > 0
              && upload.getBoundingClientRect().height > 0
            );
          }, { polling: 100, timeout: 5500 });
        }
      );
      await runBackgroundUploadPhase(
        optionsPage,
        'snapshot-background-record',
        () => optionsPage.evaluate(() => new Promise((resolve, reject) => {
          const request = indexedDB.open('startgrid', 1);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const get = request.result.transaction('images')
              .objectStore('images').get('background');
            get.onerror = () => reject(get.error);
            get.onsuccess = () => {
              window.__backgroundUploadSnapshot = get.result;
              resolve(Boolean(get.result));
            };
          };
        }))
      );
      await runBackgroundUploadPhase(
        optionsPage,
        'upload-and-preview',
        async() => {
          await optionsPage.evaluate(() => {
            const form = document.getElementById('bgFile').closest('form');
            const preview = document.getElementById('preview_upload');
            const initialPreviewImage = preview.querySelector(
              '.c-upload__preview-image'
            );
            window.__backgroundUploadLifecycle = {
              uploadingSeen: form.classList.contains('is-upload'),
              previewChanged: false,
              initialPreviewStyle: initialPreviewImage?.getAttribute('style') || '',
              initialPreviewUrl: initialPreviewImage?.style.backgroundImage || '',
              finalPreviewStyle: initialPreviewImage?.getAttribute('style') || '',
              finalPreviewUrl: initialPreviewImage?.style.backgroundImage || '',
              toastTexts: []
            };
            const observer = new MutationObserver(records => {
              if (form.classList.contains('is-upload')) {
                window.__backgroundUploadLifecycle.uploadingSeen = true;
              }
              const previewMutated = records.some(record => (
                preview.contains(record.target)
                && (
                  record.type === 'childList'
                  || (
                    record.type === 'attributes'
                    && record.attributeName === 'style'
                  )
                )
              ));
              if (previewMutated) {
                const previewImage = preview.querySelector(
                  '.c-upload__preview-image'
                );
                const finalStyle = previewImage?.getAttribute('style') || '';
                const finalUrl = previewImage?.style.backgroundImage || '';
                window.__backgroundUploadLifecycle.finalPreviewStyle = finalStyle;
                window.__backgroundUploadLifecycle.finalPreviewUrl = finalUrl;
                window.__backgroundUploadLifecycle.previewChanged = (
                  finalUrl.includes('blob:')
                  && finalStyle
                    !== window.__backgroundUploadLifecycle.initialPreviewStyle
                  && finalUrl
                    !== window.__backgroundUploadLifecycle.initialPreviewUrl
                );
              }
              window.__backgroundUploadLifecycle.toastTexts = Array.from(
                document.querySelectorAll('.toast__message')
              ).map(node => node.textContent);
            });
            observer.observe(form, { attributes: true, attributeFilter: ['class'] });
            observer.observe(preview, {
              childList: true,
              subtree: true,
              attributes: true,
              attributeFilter: ['style']
            });
            observer.observe(document.body, {
              childList: true,
              subtree: true
            });
            window.__backgroundUploadLifecycle.disconnect = () => observer.disconnect();
          });
          await optionsPage.click('#bgFile');
          const uploadOutcomeHandle = await optionsPage.waitForFunction(({
            expectedError,
            expectedSuccess
          }) => {
            const previewImage = document.querySelector('.c-upload__preview-image');
            const finalStyle = previewImage?.getAttribute('style') || '';
            const finalUrl = previewImage?.style.backgroundImage || '';
            const lifecycle = window.__backgroundUploadLifecycle;
            const toastTexts = lifecycle?.toastTexts || [];
            if (toastTexts.includes(expectedError)) {
              return {
                status: 'error',
                toastTexts
              };
            }
            if (
              lifecycle?.uploadingSeen === true
              && lifecycle.previewChanged === true
              && document.querySelector('.c-upload__preview')?.hidden === false
              && finalUrl.includes('blob:')
              && finalStyle !== lifecycle.initialPreviewStyle
              && finalUrl !== lifecycle.initialPreviewUrl
              && !document.getElementById('bgFile')
                ?.closest('form')?.classList.contains('is-upload')
              && toastTexts.includes(expectedSuccess)
            ) {
              return {
                status: 'success',
                finalStyle,
                finalUrl,
                toastTexts
              };
            }
            return false;
          }, { polling: 100, timeout: 5500 }, {
            expectedError: await optionsPage.evaluate(
              () => chrome.i18n.getMessage('notice_background_save_failed')
            ),
            expectedSuccess: await optionsPage.evaluate(
              () => chrome.i18n.getMessage('notice_bg_image_updated')
            )
          });
          const uploadOutcome = await uploadOutcomeHandle.jsonValue();
          await uploadOutcomeHandle.dispose();
          if (uploadOutcome.status === 'error') {
            throw new Error(
              `background upload reported failure: ${JSON.stringify(uploadOutcome)}`
            );
          }
          await optionsPage.evaluate(() => {
            window.__backgroundUploadLifecycle?.disconnect?.();
          });
        }
      );
      const storedRecord = await runBackgroundUploadPhase(
        optionsPage,
        'persisted-background-record',
        async() => {
          await optionsPage.waitForFunction(() => new Promise(resolve => {
            const request = indexedDB.open('startgrid', 1);
            request.onerror = () => resolve(false);
            request.onsuccess = () => {
              const get = request.result.transaction('images')
                .objectStore('images').get('background');
              get.onerror = () => resolve(false);
              get.onsuccess = () => resolve(
                get.result?.id === 'background'
                && get.result?.blob?.type === 'image/svg+xml'
                && get.result.blob.size > 0
                && get.result?.blobThumbnail?.size > 0
              );
            };
          }), { polling: 100, timeout: 5500 });
          return getBackgroundUploadEvidence(optionsPage);
        }
      );
      expect(storedRecord.record).toEqual(expect.objectContaining({
        id: 'background',
        blobType: 'image/svg+xml'
      }));
      expect(storedRecord.record.blobSize).toBeGreaterThan(0);
      expect(storedRecord.record.thumbnailSize).toBeGreaterThan(0);
    } finally {
      if (optionsPage && !optionsPage.isClosed()) {
        await settleTestCleanup(
          () => optionsPage.evaluate(() => new Promise(resolve => {
            const request = indexedDB.open('startgrid', 1);
            request.onerror = () => resolve();
            request.onsuccess = () => {
              const transaction = request.result.transaction('images', 'readwrite');
              const store = transaction.objectStore('images');
              if (window.__backgroundUploadSnapshot) {
                store.put(window.__backgroundUploadSnapshot);
              } else {
                store.delete('background');
              }
              transaction.oncomplete = resolve;
              transaction.onerror = resolve;
            };
          })),
          2500
        );
        if (previousBackgroundImage) {
          await settleTestCleanup(
            () => optionsPage.$eval('#background_image', (input, value) => {
              input.value = value;
              input.dispatchEvent(new Event('change', { bubbles: true }));
            }, previousBackgroundImage)
          );
        }
        await settleTestCleanup(() => optionsPage.close(), 2500);
      }
      if (!extPage.isClosed()) {
        await settleTestCleanup(() => extPage.bringToFront());
      }
    }
  });

  it('uses non-English accessible names in rendered scroll and toast controls', async() => {
    const messages = JSON.parse(
      readFileSync('static/_locales/de/messages.json', 'utf8')
    );
    const title = `de-toast-${Date.now()}`;
    const bookmarkUrl = 'https://example.com/de-toast';
    const deleteMessage = messages.notice_bookmark_removed.message
      .replace(/<[^>]+>/g, '')
      .replace('$title$', title);
    let settingsSnapshot;
    try {
      await runLocalizedUiPhase(
        extPage,
        'stable-visible-page',
        async() => {
          await extPage.bringToFront();
          await extPage.waitForFunction(() => (
            !document.hidden
            && document.getElementById('add')?.isConnected
            && document.getElementById('dial_loading')?.hidden
          ), { polling: 100, timeout: 5500 });
        }
      );
      settingsSnapshot = await runLocalizedUiPhase(
        extPage,
        'snapshot-settings',
        () => extPage.evaluate(() => new Promise((resolve, reject) => {
          chrome.storage.local.get('settings', result => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
              return;
            }
            resolve({
              hasSettings: Object.hasOwn(result, 'settings'),
              settings: result.settings
            });
          });
        }))
      );
      await runLocalizedUiPhase(
        extPage,
        'set-german-language-and-navigate',
        () => mutateStorageWithNavigation(
          extPage,
          () => extPage.evaluate(settingsState => new Promise((resolve, reject) => {
            chrome.storage.local.set({
              settings: {
                ...settingsState,
                enable_sync: false,
                language: 'de'
              }
            }, () => (
              chrome.runtime.lastError
                ? reject(chrome.runtime.lastError)
                : resolve()
            ));
          }), settingsSnapshot.settings)
        ),
        8500
      );
      await runLocalizedUiPhase(
        extPage,
        'german-ui-ready',
        async() => {
          await extPage.waitForFunction(expected => (
            !document.hidden
            && document.getElementById('add')?.isConnected
            && document.getElementById('dial_loading')?.hidden
            && document.querySelector('vb-scrollup')
              ?.shadowRoot?.querySelector('button')?.getAttribute('aria-label')
              === expected
          ), { polling: 100, timeout: 5500 }, messages.scroll_to_top.message);
        }
      );
      const scrollLabel = await extPage.$eval(
        'vb-scrollup',
        node => node.shadowRoot.querySelector('button').getAttribute('aria-label')
      );
      expect(scrollLabel).toBe(messages.scroll_to_top.message);

      await runLocalizedUiPhase(
        extPage,
        'create-bookmark',
        async() => {
          await extPage.$eval('#add', add => {
            if (!add.isConnected) throw new Error('Add button is detached');
            add.click();
          });
          await extPage.waitForFunction(() => (
            document.getElementById('formBookmark')?.dataset.action === 'New'
            && document.getElementById('modal')?.instance?._isOpen === true
            && document.getElementById('modal')?.instance?._isTransitiong === false
            && getComputedStyle(document.getElementById('modal')).display === 'block'
          ), { polling: 100, timeout: 5500 });
          await extPage.evaluate(({ value, url }) => {
            const titleInput = document.getElementById('title');
            const urlInput = document.getElementById('url');
            titleInput.value = value;
            urlInput.value = url;
            titleInput.dispatchEvent(new Event('input', { bubbles: true }));
            urlInput.dispatchEvent(new Event('input', { bubbles: true }));
          }, { value: title, url: bookmarkUrl });
          await extPage.waitForFunction(
            () => document.getElementById('formBookmark')?.checkValidity() === true,
            { polling: 100, timeout: 5500 }
          );
          await extPage.click('#saveBookmarkBtn');
          await extPage.waitForFunction(expected => (
            Array.from(document.querySelectorAll('.bookmark__title'))
              .some(node => node.textContent === expected)
          ), { polling: 100, timeout: 5500 }, title);
          await extPage.waitForFunction(expected => {
            const modal = document.getElementById('modal');
            return (
              Array.from(document.querySelectorAll('.bookmark__title'))
                .some(node => node.textContent === expected)
              && modal?.instance?._isOpen === false
              && modal.instance._isTransitiong === false
              && document.getElementById('add')?.isConnected
              && document.getElementById('dial_loading')?.hidden
            );
          }, { polling: 100, timeout: 5500 }, title);
        }
      );
      await runLocalizedUiPhase(
        extPage,
        'localized-closeable-toast',
        async() => {
          await extPage.evaluate(expected => {
            const titleNode = Array.from(document.querySelectorAll('.bookmark__title'))
              .find(node => node.textContent === expected);
            if (!titleNode) throw new Error('German test bookmark is missing');
            document.getElementById('context-menu').dispatchEvent(new CustomEvent(
              'vb:contextmenu:select',
              {
                detail: {
                  trigger: titleNode.closest('.bookmark'),
                  selection: 'copy_link'
                }
              }
            ));
          }, title);
          await extPage.waitForFunction(({ expectedLabel, expectedMessage }) => {
            const message = Array.from(document.querySelectorAll('.toast__message'))
              .find(node => node.textContent === expectedMessage);
            return (
              message?.closest('.toast')
                ?.querySelector('.toast__btn')?.getAttribute('aria-label')
              === expectedLabel
            );
          }, { polling: 100, timeout: 5500 }, {
            expectedLabel: messages.toast_close.message,
            expectedMessage: messages.notice_link_copied.message
          });
          await extPage.evaluate(expectedMessage => {
            const message = Array.from(document.querySelectorAll('.toast__message'))
              .find(node => node.textContent === expectedMessage);
            message.closest('.toast').querySelector('.toast__btn').click();
          }, messages.notice_link_copied.message);
          await extPage.waitForFunction(expectedMessage => (
            !Array.from(document.querySelectorAll('.toast__message'))
              .some(node => node.textContent === expectedMessage)
          ), { polling: 100, timeout: 1500 }, messages.notice_link_copied.message);
        }
      );
      await runLocalizedUiPhase(
        extPage,
        'delete-and-localized-toast',
        async() => {
          await extPage.evaluate(expected => {
            const titleNode = Array.from(document.querySelectorAll('.bookmark__title'))
              .find(node => node.textContent === expected);
            if (!titleNode) throw new Error('German test bookmark is missing');
            document.getElementById('context-menu').dispatchEvent(new CustomEvent(
              'vb:contextmenu:select',
              {
                detail: {
                  trigger: titleNode.closest('.bookmark'),
                  selection: 'remove'
                }
              }
            ));
          }, title);
          await extPage.waitForFunction(() => {
            const popup = document.getElementById('popup');
            const resolveControl = popup?.querySelector('[data-popup="resolve"]');
            return (
              popup?.classList.contains('is-shown')
              && document.activeElement === resolveControl
            );
          }, { polling: 50, timeout: 5500 });
          await extPage.click('#popup [data-popup="resolve"]');
          await extPage.waitForFunction(({
            expectedAction,
            expectedMessage,
            expectedTitle
          }) => {
            const titleNode = Array.from(document.querySelectorAll('.bookmark__title'))
              .find(node => node.textContent === expectedTitle);
            const message = Array.from(document.querySelectorAll('.toast__message'))
              .find(node => node.textContent === expectedMessage);
            return (
              titleNode?.closest('.bookmark')?.hidden === true
              && message?.closest('.toast')
                ?.querySelector('.toast__action')?.textContent === expectedAction
              && !message.closest('.toast').querySelector('.toast__btn')
            );
          }, { polling: 100, timeout: 5500 }, {
            expectedAction: messages.undo.message,
            expectedMessage: deleteMessage,
            expectedTitle: title
          });
        }
      );
    } finally {
      if (!extPage.isClosed()) {
        await settleTestCleanup(() => extPage.bringToFront());
        await settleTestCleanup(
          () => extPage.evaluate(({ url, expectedTitle }) => new Promise(resolve => {
            chrome.bookmarks.search({ url }, results => {
              const ids = results
                .filter(bookmark => bookmark.title === expectedTitle)
                .map(bookmark => bookmark.id);
              if (!ids.length) {
                resolve();
                return;
              }
              let remaining = ids.length;
              ids.forEach(id => chrome.bookmarks.remove(id, () => {
                remaining -= 1;
                if (!remaining) resolve();
              }));
            });
          }), { url: bookmarkUrl, expectedTitle: title }),
          2500
        );
        if (settingsSnapshot) {
          await settleTestCleanup(
            () => mutateStorageWithNavigation(
              extPage,
              () => extPage.evaluate(snapshot => new Promise((resolve, reject) => {
                const method = snapshot.hasSettings ? 'set' : 'remove';
                const argument = snapshot.hasSettings
                  ? { settings: snapshot.settings }
                  : 'settings';
                chrome.storage.local[method](argument, () => (
                  chrome.runtime.lastError
                    ? reject(chrome.runtime.lastError)
                    : resolve()
                ));
              }), settingsSnapshot)
            ),
            8500
          );
        }
        await settleTestCleanup(
          () => extPage.waitForFunction(() => (
            !document.hidden
            && document.getElementById('add')?.isConnected
            && document.getElementById('dial_loading')?.hidden
          ), { polling: 100, timeout: 5500 }),
          6000
        );
      }
    }
  });

  afterAll(async() => {
    await browser?.close();
  });
});
