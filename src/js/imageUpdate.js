export const REMOTE_IMAGE_TIMEOUT_MS = 2000;

// Promises are only shared while the same image intent is in flight. A newer
// persisted edit gets its own operation and cannot join an obsolete request.
export function createImageRequestCoalescer(execute) {
  const pending = new Map();
  return request => {
    const key = JSON.stringify([String(request.id), request.source || 'url', request.url,
      request.sourceUrl || request.url, request.sourceOverride ?? null, Boolean(request.temporary)]);
    const previous = pending.get(key);
    if (previous && (!Object.hasOwn(request, 'expectedRevision')
      || request.expectedRevision === previous.expectedRevision
      || request.expectedRevision === previous.reservedRevision)) return previous.promise;

    const entry = { expectedRevision: request.expectedRevision, reservedRevision: undefined };
    entry.promise = Promise.resolve().then(() => execute(request, revision => {
      entry.reservedRevision = revision;
    })).finally(() => {
      if (pending.get(key) === entry) pending.delete(key);
    });
    pending.set(key, entry);
    return entry.promise;
  };
}

export async function runImageRequest(operation, parentSignal, timeoutMs = REMOTE_IMAGE_TIMEOUT_MS) {
  const controller = new AbortController();
  const cancel = () => controller.abort(parentSignal.reason);
  parentSignal?.addEventListener('abort', cancel, { once: true });
  const timeout = new Error('Image request timed out');
  timeout.code = 'TIMEOUT';
  const timer = setTimeout(() => controller.abort(timeout), timeoutMs);
  const aborted = new Promise((resolve, reject) => {
    controller.signal.addEventListener('abort', () => reject(controller.signal.reason), { once: true });
  });
  try {
    if (parentSignal?.aborted) cancel();
    const request = Promise.resolve().then(() => {
      controller.signal.throwIfAborted();
      return operation(controller.signal);
    });
    return await Promise.race([request, aborted]);
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener('abort', cancel);
  }
}
