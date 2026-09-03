export const CAPTURE_ERROR_CODES = Object.freeze([
  'INVALID_REQUEST',
  'WINDOW_CREATE_FAILED',
  'WINDOW_HAS_NO_TAB',
  'TAB_READ_FAILED',
  'INSERT_CSS_FAILED',
  'WINDOW_UPDATE_FAILED',
  'CAPTURE_FAILED',
  'EMPTY_CAPTURE',
  'TIMEOUT',
  'STORE_FAILED'
]);

export const MAX_CAPTURE_DELAY_MS = 15000;
export const CAPTURE_WORKER_BASE_TIMEOUT_MS = 2000;
export const CAPTURE_WORKER_MAX_TIMEOUT_MS = CAPTURE_WORKER_BASE_TIMEOUT_MS;
export const CAPTURE_CLIENT_SAFETY_MARGIN_MS = 100;
export const CAPTURE_CLIENT_TIMEOUT_MS =
  CAPTURE_WORKER_MAX_TIMEOUT_MS + CAPTURE_CLIENT_SAFETY_MARGIN_MS;

const CLIENT_ERROR_CODES = new Set([
  ...CAPTURE_ERROR_CODES,
  'INVALID_RESPONSE',
  'RUNTIME_ERROR',
  'CLIENT_TIMEOUT'
]);

class CaptureError extends Error {
  constructor(code, cause) {
    super(code);
    this.code = code;
    this.cause = cause;
  }
}

const failure = (id, code) => ({ ok: false, id: String(id ?? ''), code });

function chromeCallback(runtime, code, invoke) {
  return new Promise((resolve, reject) => {
    try {
      invoke(value => {
        const runtimeError = runtime.lastError;
        if (runtimeError) {
          reject(new CaptureError(code, runtimeError));
          return;
        }
        resolve(value);
      });
    } catch (error) {
      reject(new CaptureError(code, error));
    }
  });
}

export function normalizeCaptureResponse(response, expectedId) {
  const id = String(expectedId ?? '');
  if (
    response?.ok === true
    && String(response.id) === id
  ) {
    return { ok: true, id };
  }
  if (
    response?.ok === false
    && String(response.id) === id
    && CLIENT_ERROR_CODES.has(response.code)
  ) {
    return { ok: false, id, code: response.code };
  }
  return failure(id, 'INVALID_RESPONSE');
}

export function normalizeCaptureDelay(value) {
  const delay = Number(value);
  return Number.isFinite(delay)
    ? Math.min(MAX_CAPTURE_DELAY_MS, Math.max(0, delay))
    : 0;
}

export function getCaptureWorkerTimeout(captureDelay) {
  normalizeCaptureDelay(captureDelay);
  return CAPTURE_WORKER_BASE_TIMEOUT_MS;
}

export function requestThumbnailCapture(
  runtime,
  request,
  timeoutMs = CAPTURE_CLIENT_TIMEOUT_MS
) {
  const id = String(request?.id ?? '');
  return new Promise(resolve => {
    let settled = false;
    const settle = result => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => settle(failure(id, 'CLIENT_TIMEOUT')), timeoutMs);

    try {
      runtime.sendMessage({ capture: request }, response => {
        if (runtime.lastError) {
          settle(failure(id, 'RUNTIME_ERROR'));
          return;
        }
        settle(normalizeCaptureResponse(response, id));
      });
    } catch (error) {
      settle(failure(id, 'RUNTIME_ERROR'));
    }
  });
}

export async function runThumbnailCapture({
  browserApi,
  request,
  screen = {},
  captureDelay = 500,
  timeoutMs,
  storeCapture,
  cleanupCapture
}) {
  const id = String(request?.id ?? '');
  const delay = normalizeCaptureDelay(captureDelay);
  const operationTimeout = timeoutMs === undefined
    ? getCaptureWorkerTimeout(delay)
    : Math.min(
      CAPTURE_WORKER_MAX_TIMEOUT_MS,
      Math.max(1, Number(timeoutMs) || CAPTURE_WORKER_BASE_TIMEOUT_MS)
    );
  const availWidth = Number.isFinite(Number(screen.availWidth))
    ? Number(screen.availWidth)
    : 1170;
  const availHeight = Number.isFinite(Number(screen.availHeight))
    ? Number(screen.availHeight)
    : 720;
  let parsedUrl;
  try {
    parsedUrl = new URL(request?.captureUrl);
  } catch (error) {
    return failure(id, 'INVALID_REQUEST');
  }
  if (!id || !['http:', 'https:'].includes(parsedUrl.protocol)) {
    return failure(id, 'INVALID_REQUEST');
  }

  let windowId = null;
  let windowClosed = false;
  let stopped = false;
  const timers = new Set();
  const wait = delay => new Promise(resolve => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      resolve();
    }, delay);
    timers.add(timer);
  });
  const closeWindow = () => {
    if (windowId === null || windowClosed) return;
    windowClosed = true;
    try {
      browserApi.windows.remove(windowId, () => browserApi.runtime.lastError);
    } catch (error) {}
  };
  const assertActive = () => {
    if (stopped) {
      closeWindow();
      throw new CaptureError('TIMEOUT');
    }
  };

  const operation = async() => {
    const createdWindow = await chromeCallback(
      browserApi.runtime,
      'WINDOW_CREATE_FAILED',
      callback => browserApi.windows.create({
        url: parsedUrl.href,
        state: 'normal',
        left: 1e5,
        top: 1e5,
        width: 1,
        height: 1,
        type: 'popup'
      }, callback)
    );
    windowId = createdWindow?.id ?? null;
    assertActive();
    const tab = createdWindow?.tabs?.[0];
    if (!tab?.id) throw new CaptureError('WINDOW_HAS_NO_TAB');

    try {
      browserApi.tabs.update(tab.id, { muted: true }, () => browserApi.runtime.lastError);
    } catch (error) {}

    let tabInfo;
    do {
      assertActive();
      tabInfo = await chromeCallback(
        browserApi.runtime,
        'TAB_READ_FAILED',
        callback => browserApi.tabs.get(tab.id, callback)
      );
      if (tabInfo?.status !== 'complete') await wait(300);
    } while (tabInfo?.status !== 'complete');

    await chromeCallback(
      browserApi.runtime,
      'INSERT_CSS_FAILED',
      callback => browserApi.scripting.insertCSS({
        target: { tabId: tab.id },
        css: 'html, body { overflow-y: hidden !important; }'
      }, callback)
    );
    assertActive();

    await chromeCallback(
      browserApi.runtime,
      'WINDOW_UPDATE_FAILED',
      callback => browserApi.windows.update(windowId, {
        left: Math.max(0, availWidth - 1170),
        top: Math.max(0, availHeight - 720),
        width: 1170,
        height: 720,
        focused: true
      }, callback)
    );
    await wait(delay);
    assertActive();

    const dataUrl = await chromeCallback(
      browserApi.runtime,
      'CAPTURE_FAILED',
      callback => browserApi.tabs.captureVisibleTab(windowId, callback)
    );
    if (!dataUrl) throw new CaptureError('EMPTY_CAPTURE');
    assertActive();

    let stored;
    try {
      stored = await storeCapture(dataUrl);
    } catch (error) {
      throw new CaptureError('STORE_FAILED', error);
    }
    if (stored === false || stored === undefined) throw new CaptureError('STORE_FAILED');
    assertActive();
    return { ok: true, id };
  };

  const timeout = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new CaptureError('TIMEOUT')), operationTimeout);
    timers.add(timer);
  });

  const captureOperation = operation().catch(async error => {
    if (stopped && cleanupCapture) {
      await cleanupCapture().catch(cleanupError => {
        console.warn('Could not clean up a late thumbnail capture', cleanupError);
      });
    }
    throw error;
  });

  try {
    return await Promise.race([captureOperation, timeout]);
  } catch (error) {
    const code = CAPTURE_ERROR_CODES.includes(error?.code) ? error.code : 'STORE_FAILED';
    console.warn(`Thumbnail capture failed: ${code}`, error?.cause || error);
    if (cleanupCapture) {
      await cleanupCapture().catch(cleanupError => {
        console.warn('Could not clean up a failed thumbnail capture', cleanupError);
      });
    }
    return failure(id, code);
  } finally {
    stopped = true;
    timers.forEach(timer => clearTimeout(timer));
    timers.clear();
    closeWindow();
  }
}

export async function captureTemporaryThumbnail({
  id,
  requestCapture,
  readRecord,
  deleteRecord
}) {
  try {
    const response = await requestCapture();
    if (!response?.ok) return null;
    const image = await readRecord(id);
    return image?.blob || null;
  } finally {
    await deleteRecord(id);
  }
}

export async function settleCaptureQueueEntry({
  initialResult,
  execute,
  onFailure,
  finalize
}) {
  let result = initialResult;
  try {
    result = await execute(result);
  } catch (error) {
    await onFailure(error);
  } finally {
    await finalize(result);
  }
  return result;
}

export function finalizeCaptureQueueItem({
  bookmark,
  queue,
  response,
  resolve,
  runNext,
  onOverlayError = error => console.warn('Could not remove thumbnail overlay', error)
}) {
  try {
    bookmark.hasOverlay = false;
  } catch (error) {
    onOverlayError(error);
  }
  queue.shift();
  resolve(response);
  if (queue.length) runNext();
}
