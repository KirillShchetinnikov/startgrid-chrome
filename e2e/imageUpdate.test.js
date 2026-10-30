import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { openDB } from 'idb';
import ImageDB from '../src/js/api/imageDB';
import { createImageRequestCoalescer, runImageRequest } from '../src/js/imageUpdate';

jest.mock('idb', () => ({ openDB: jest.fn(), deleteDB: jest.fn() }));

describe('persisted image update ownership', () => {
  let records, database;

  beforeEach(() => {
    ImageDB.DB = null;
    records = new Map();
    const store = {
      get: jest.fn(async id => records.get(id)),
      put: jest.fn(async record => { records.set(record.id, record); return record.id; })
    };
    database = { put: jest.fn(async(name, record) => store.put(record)),
      transaction: jest.fn(() => ({ store, done: Promise.resolve() })) };
    openDB.mockResolvedValue(database);
  });

  afterEach(() => {
    ImageDB.DB = null;
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('preserves legacy data when reserving work and commits only the current revision', async() => {
    records.set('a', { id: 'a', blob: 'old image', source: 'local', thumbnailSize: 64 });
    const snapshot = await ImageDB.beginUpdate('a');
    expect(snapshot).toMatchObject({ blob: 'old image', source: 'local', thumbnailSize: 64 });
    expect(snapshot.revision).toEqual(expect.any(String));
    await expect(ImageDB.updateIfUnchanged({ ...snapshot, blob: 'new remote image' }, snapshot.revision))
      .resolves.toBe(true);
    expect(records.get('a')).toMatchObject({ blob: 'new remote image', thumbnailSize: 64 });
    expect(records.get('a').revision).not.toBe(snapshot.revision);
    expect(database.transaction).toHaveBeenCalledWith('images', 'readwrite');
  });

  it('cannot overwrite a newer local image written from another context', async() => {
    const snapshot = await ImageDB.beginUpdate('a');
    await ImageDB.update({ id: 'a', blob: 'user PNG', source: 'local', custom: true });
    const uploaded = records.get('a');
    await expect(ImageDB.updateIfUnchanged({ ...snapshot, blob: 'late remote' }, snapshot.revision))
      .resolves.toBe(false);
    expect(records.get('a')).toBe(uploaded);
  });

  it('rejects obsolete intent before reserving over a newly uploaded image', async() => {
    const old = await ImageDB.beginUpdate('a');
    await ImageDB.update({ id: 'a', blob: 'new user image', source: 'local' });
    const uploaded = records.get('a');
    await expect(ImageDB.beginUpdate('a', { expectedRevision: old.revision })).resolves.toBeNull();
    expect(records.get('a')).toBe(uploaded);
    const reserved = await ImageDB.beginUpdate('a', { expectedRevision: uploaded.revision });
    expect(reserved.blob).toBe('new user image');
  });

  it('invalidates the older of two requests and does not resurrect a removed record', async() => {
    const older = await ImageDB.beginUpdate('a');
    const newer = await ImageDB.beginUpdate('a');
    await expect(ImageDB.updateIfUnchanged({ ...older, blob: 'old' }, older.revision)).resolves.toBe(false);
    records.delete('a');
    await expect(ImageDB.updateIfUnchanged({ ...newer, blob: 'removed' }, newer.revision)).resolves.toBe(false);
    expect(records.has('a')).toBe(false);
  });

  it('cannot commit after its deadline was aborted', async() => {
    const snapshot = await ImageDB.beginUpdate('a');
    const controller = new AbortController();
    controller.abort();
    await expect(ImageDB.updateIfUnchanged({ ...snapshot, blob: 'late' }, snapshot.revision,
      { signal: controller.signal })).resolves.toBe(false);
    expect(records.get('a').blob).toBeUndefined();
  });

  it('aborts the transaction when cancellation arrives after put but before commit', async() => {
    const original = { id: 'a', revision: 'current', blob: 'local image' };
    records.set('a', original);
    const controller = new AbortController();
    let rejectTransaction;
    const transaction = {
      store: {
        get: async() => original,
        put: jest.fn(async() => { controller.abort(); })
      },
      done: new Promise((resolve, reject) => { rejectTransaction = reject; }),
      abort: jest.fn(() => rejectTransaction(new DOMException('Cancelled', 'AbortError')))
    };
    database.transaction = () => transaction;
    const removeListener = jest.spyOn(controller.signal, 'removeEventListener');
    await expect(ImageDB.updateIfUnchanged({ ...original, blob: 'late remote' }, original.revision,
      { signal: controller.signal })).resolves.toBe(false);
    expect(transaction.store.put).toHaveBeenCalledTimes(1);
    expect(transaction.abort).toHaveBeenCalledTimes(1);
    expect(records.get('a')).toBe(original);
    expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function));
  });

  it('rejects failed reservations and conditional writes', async() => {
    const error = new Error('disk full');
    database.transaction = () => ({ store: { get: async() => { throw error; } }, done: Promise.resolve() });
    await expect(ImageDB.beginUpdate('a')).rejects.toBe(error);
    await expect(ImageDB.updateIfUnchanged({ id: 'a' }, 'revision')).rejects.toBe(error);
  });
});

describe('in-flight image requests', () => {
  it('shares one operation and reservation, including callers which observed the reserved revision', async() => {
    let finish;
    const execute = jest.fn((request, onReserved) => {
      onReserved('reserved');
      return new Promise(resolve => { finish = resolve; });
    });
    const request = createImageRequestCoalescer(execute);
    const input = { id: 'a', source: 'url', url: 'https://example.com/image', expectedRevision: null };
    const first = request(input);
    const second = request({ ...input });
    await Promise.resolve();
    const third = request({ ...input, expectedRevision: 'reserved' });
    expect(second).toBe(first);
    expect(third).toBe(first);
    expect(execute).toHaveBeenCalledTimes(1);
    finish({ success: true });
    await expect(first).resolves.toEqual({ success: true });
    execute.mockResolvedValueOnce({ success: true });
    await request(input);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('does not join a newer edit to the old intent, and a rejected request does not poison retries', async() => {
    let finishOld;
    const execute = jest.fn()
      .mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }))
      .mockRejectedValueOnce(new Error('cancelled'))
      .mockResolvedValueOnce({ success: true });
    const request = createImageRequestCoalescer(execute);
    const input = { id: 'a', url: 'https://example.com/image', expectedRevision: 'old' };
    const older = request(input);
    await Promise.resolve();
    await expect(request({ ...input, expectedRevision: 'new local' })).rejects.toThrow('cancelled');
    finishOld({ success: true, superseded: true });
    await older;
    await expect(request({ ...input, expectedRevision: 'new local' })).resolves.toEqual({ success: true });
    expect(execute).toHaveBeenCalledTimes(3);
  });
});

describe('remote image deadlines', () => {
  afterEach(() => jest.useRealTimers());

  it('aborts a fetch at the two-second worker deadline even if it ignores cancellation', async() => {
    jest.useFakeTimers();
    let signal;
    const request = runImageRequest(value => { signal = value; return new Promise(() => {}); });
    const rejected = expect(request).rejects.toMatchObject({ code: 'TIMEOUT' });
    await jest.advanceTimersByTimeAsync(2000);
    await rejected;
    expect(signal.aborted).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('propagates mode cancellation and handles a signal already cancelled before work starts', async() => {
    const controller = new AbortController();
    controller.abort(new Error('fast mode'));
    const operation = jest.fn();
    await expect(runImageRequest(operation, controller.signal)).rejects.toThrow('fast mode');
    expect(operation).not.toHaveBeenCalled();
    const active = new AbortController();
    const request = runImageRequest(() => new Promise(() => {}), active.signal);
    active.abort(new Error('changed mode'));
    await expect(request).rejects.toThrow('changed mode');
  });
});
