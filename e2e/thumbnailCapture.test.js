import { afterEach, describe, expect, it, jest } from '@jest/globals';
import {
  CAPTURE_CLIENT_TIMEOUT_MS,
  CAPTURE_WORKER_MAX_TIMEOUT_MS,
  MAX_CAPTURE_DELAY_MS,
  captureTemporaryThumbnail,
  finalizeCaptureQueueItem,
  getCaptureWorkerTimeout,
  normalizeCaptureDelay,
  normalizeCaptureResponse,
  requestThumbnailCapture,
  runThumbnailCapture,
  settleCaptureQueueEntry
} from '../src/js/thumbnailCapture';

function createBrowser(failureStage) {
  const runtime = { lastError: null };
  const respond = (callback, value, stage) => {
    runtime.lastError = failureStage === stage ? { message: stage } : null;
    callback(value);
    runtime.lastError = null;
  };
  return {
    runtime,
    windows: {
      create: (options, callback) => respond(callback, { id: 4, tabs: [{ id: 5 }] }, 'create'),
      update: (id, options, callback) => respond(callback, { id }, 'windowUpdate'),
      remove: jest.fn((id, callback) => callback?.())
    },
    tabs: {
      update: (id, options, callback) => callback?.(),
      get: (id, callback) => respond(callback, { id, status: 'complete' }, 'tabRead'),
      captureVisibleTab: (id, callback) => respond(
        callback,
        failureStage === 'empty' ? '' : 'data:image/webp;base64,AA==',
        'capture'
      )
    },
    scripting: {
      insertCSS: (options, callback) => respond(callback, undefined, 'css')
    }
  };
}

describe('thumbnail capture RPC', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('normalizes structured success/failure and rejects malformed responses', () => {
    expect(normalizeCaptureResponse({ ok: true, id: '7' }, 7))
      .toEqual({ ok: true, id: '7' });
    expect(normalizeCaptureResponse({ ok: false, id: '7', code: 'CAPTURE_FAILED' }, 7))
      .toEqual({ ok: false, id: '7', code: 'CAPTURE_FAILED' });
    expect(normalizeCaptureResponse('success', 7))
      .toEqual({ ok: false, id: '7', code: 'INVALID_RESPONSE' });
  });

  it('keeps the client deadline strictly after every normalized worker deadline', () => {
    expect(normalizeCaptureDelay(-1)).toBe(0);
    expect(normalizeCaptureDelay(Number.NaN)).toBe(0);
    expect(normalizeCaptureDelay(MAX_CAPTURE_DELAY_MS)).toBe(MAX_CAPTURE_DELAY_MS);
    expect(normalizeCaptureDelay(MAX_CAPTURE_DELAY_MS + 1)).toBe(MAX_CAPTURE_DELAY_MS);
    expect(getCaptureWorkerTimeout(MAX_CAPTURE_DELAY_MS))
      .toBe(CAPTURE_WORKER_MAX_TIMEOUT_MS);
    expect(CAPTURE_CLIENT_TIMEOUT_MS).toBeGreaterThan(CAPTURE_WORKER_MAX_TIMEOUT_MS);
  });

  it.each([
    ['create', 'WINDOW_CREATE_FAILED'],
    ['tabRead', 'TAB_READ_FAILED'],
    ['css', 'INSERT_CSS_FAILED'],
    ['windowUpdate', 'WINDOW_UPDATE_FAILED'],
    ['capture', 'CAPTURE_FAILED'],
    ['empty', 'EMPTY_CAPTURE']
  ])('maps %s callback failure to %s and closes the popup', async(stage, code) => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const browserApi = createBrowser(stage);
    const result = await runThumbnailCapture({
      browserApi,
      request: { id: '7', captureUrl: 'https://example.com' },
      captureDelay: 0,
      storeCapture: jest.fn().mockResolvedValue('7')
    });

    expect(result).toEqual({ ok: false, id: '7', code });
    if (stage !== 'create') expect(browserApi.windows.remove).toHaveBeenCalledWith(4, expect.any(Function));
  });

  it('handles invalid request, missing tab, store rejection, success, and timeout', async() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const invalid = await runThumbnailCapture({
      browserApi: createBrowser(),
      request: { id: '', captureUrl: 'file:///tmp/a' },
      storeCapture: jest.fn()
    });
    expect(invalid.code).toBe('INVALID_REQUEST');

    const noTabBrowser = createBrowser();
    noTabBrowser.windows.create = (options, callback) => callback({ id: 4, tabs: [] });
    expect((await runThumbnailCapture({
      browserApi: noTabBrowser,
      request: { id: '7', captureUrl: 'https://example.com' },
      storeCapture: jest.fn()
    })).code).toBe('WINDOW_HAS_NO_TAB');

    expect((await runThumbnailCapture({
      browserApi: createBrowser(),
      request: { id: '7', captureUrl: 'https://example.com' },
      captureDelay: 0,
      storeCapture: jest.fn().mockRejectedValue(new Error('db'))
    })).code).toBe('STORE_FAILED');

    expect(await runThumbnailCapture({
      browserApi: createBrowser(),
      request: { id: '7', captureUrl: 'https://example.com' },
      captureDelay: 0,
      storeCapture: jest.fn().mockResolvedValue('7')
    })).toEqual({ ok: true, id: '7' });

    const timeoutBrowser = createBrowser();
    timeoutBrowser.tabs.get = () => {};
    expect((await runThumbnailCapture({
      browserApi: timeoutBrowser,
      request: { id: '7', captureUrl: 'https://example.com' },
      timeoutMs: 1,
      storeCapture: jest.fn()
    })).code).toBe('TIMEOUT');
  });

  it('settles client lastError, empty response, and timeout exactly once', async() => {
    const runtimeError = {
      lastError: null,
      sendMessage(message, callback) {
        this.lastError = { message: 'closed' };
        callback();
        this.lastError = null;
      }
    };
    await expect(requestThumbnailCapture(runtimeError, { id: '8' }, 50))
      .resolves.toEqual({ ok: false, id: '8', code: 'RUNTIME_ERROR' });

    const emptyRuntime = { lastError: null, sendMessage: (message, callback) => callback() };
    await expect(requestThumbnailCapture(emptyRuntime, { id: '8' }, 50))
      .resolves.toEqual({ ok: false, id: '8', code: 'INVALID_RESPONSE' });

    jest.useFakeTimers();
    const callbackHolder = {};
    const pending = requestThumbnailCapture({
      lastError: null,
      sendMessage(message, callback) {
        callbackHolder.callback = callback;
      }
    }, { id: '8' }, 10);
    jest.advanceTimersByTime(10);
    await expect(pending).resolves.toEqual({ ok: false, id: '8', code: 'CLIENT_TIMEOUT' });
    callbackHolder.callback({ ok: true, id: '8' });
  });

  it('does not time out the client when a worker finishes at its deadline', async() => {
    jest.useFakeTimers();
    const pending = requestThumbnailCapture({
      lastError: null,
      sendMessage(message, callback) {
        setTimeout(
          () => callback({ ok: true, id: message.capture.id }),
          CAPTURE_WORKER_MAX_TIMEOUT_MS
        );
      }
    }, { id: 'late', captureUrl: 'https://example.com' });

    jest.advanceTimersByTime(CAPTURE_WORKER_MAX_TIMEOUT_MS);
    await expect(pending).resolves.toEqual({ ok: true, id: 'late' });
  });

  it('deletes a temporary record after late failure and after successful reads', async() => {
    const remove = jest.fn().mockResolvedValue();
    let finishCapture;
    const lateFailure = captureTemporaryThumbnail({
      id: 'pending-1',
      requestCapture: () => new Promise(resolve => { finishCapture = resolve; }),
      readRecord: jest.fn(),
      deleteRecord: remove
    });
    expect(remove).not.toHaveBeenCalled();
    finishCapture({ ok: false, id: 'pending-1', code: 'TIMEOUT' });
    await expect(lateFailure).resolves.toBeNull();
    expect(remove).toHaveBeenCalledWith('pending-1');

    const blob = {};
    await expect(captureTemporaryThumbnail({
      id: 'pending-2',
      requestCapture: async() => ({ ok: true, id: 'pending-2' }),
      readRecord: async() => ({ blob }),
      deleteRecord: remove
    })).resolves.toBe(blob);
    expect(remove).toHaveBeenCalledWith('pending-2');
  });

  it('always finalizes a failed queue entry so the next item can run', async() => {
    const order = [];
    const initialResult = { ok: false, id: 'queued', code: 'INVALID_RESPONSE' };
    await expect(settleCaptureQueueEntry({
      initialResult,
      execute: async() => {
        order.push('execute');
        throw new Error('capture failed');
      },
      onFailure: async() => order.push('failure'),
      finalize: async result => {
        order.push(`finalize:${result.code}`);
        order.push('next');
      }
    })).resolves.toEqual(initialResult);
    expect(order).toEqual([
      'execute',
      'failure',
      'finalize:INVALID_RESPONSE',
      'next'
    ]);
  });

  it('removes the real page overlay, dequeues, resolves, and runs the next item', () => {
    const bookmark = { hasOverlay: true };
    const queue = [{ bookmark }, { bookmark: {} }];
    const resolve = jest.fn();
    const runNext = jest.fn();
    const response = { ok: false, id: 'queued', code: 'TIMEOUT' };

    finalizeCaptureQueueItem({
      bookmark,
      queue,
      response,
      resolve,
      runNext
    });

    expect(bookmark.hasOverlay).toBe(false);
    expect(queue).toHaveLength(1);
    expect(resolve).toHaveBeenCalledWith(response);
    expect(runNext).toHaveBeenCalledTimes(1);
  });

  it('closes a popup that is created after the worker timeout already settled', async() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const browserApi = createBrowser();
    let createCallback;
    let confirmClosed;
    const closed = new Promise(resolve => {
      confirmClosed = resolve;
    });
    browserApi.windows.create = (options, callback) => {
      createCallback = callback;
    };
    browserApi.windows.remove = jest.fn((id, callback) => {
      callback?.();
      confirmClosed();
    });
    const pending = runThumbnailCapture({
      browserApi,
      request: { id: '9', captureUrl: 'https://example.com' },
      timeoutMs: 1,
      storeCapture: jest.fn()
    });

    await expect(pending).resolves.toMatchObject({ ok: false, code: 'TIMEOUT' });
    createCallback({ id: 4, tabs: [{ id: 5 }] });
    await closed;
    expect(browserApi.windows.remove).toHaveBeenCalledWith(4, expect.any(Function));
  });

  it('removes a temporary record again when storage completes after worker timeout', async() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    let releaseStore;
    let record = null;
    let cleanupCalls = 0;
    let confirmLateCleanup;
    const lateCleanup = new Promise(resolve => { confirmLateCleanup = resolve; });
    const result = runThumbnailCapture({
      browserApi: createBrowser(),
      request: { id: 'pending-thumbnail-7', captureUrl: 'https://example.com' },
      captureDelay: 0,
      timeoutMs: 20,
      storeCapture: async() => {
        await new Promise(resolve => { releaseStore = resolve; });
        record = 'stored';
        return 'pending-thumbnail-7';
      },
      cleanupCapture: async() => {
        cleanupCalls += 1;
        record = null;
        if (cleanupCalls === 2) confirmLateCleanup();
      }
    });

    while (!releaseStore) {
      await new Promise(resolve => setTimeout(resolve, 1));
    }
    await expect(result).resolves.toMatchObject({ ok: false, code: 'TIMEOUT' });
    releaseStore();
    await lateCleanup;
    expect(record).toBeNull();
  });

});
