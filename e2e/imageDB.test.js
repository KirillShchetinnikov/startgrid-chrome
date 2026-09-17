import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { openDB } from 'idb';
import ImageDB from '../src/js/api/imageDB';

jest.mock('idb', () => ({ openDB: jest.fn(), deleteDB: jest.fn() }));

describe('image reads by bookmark IDs', () => {
  beforeEach(() => {
    ImageDB.DB = null;
    jest.clearAllMocks();
  });

  afterEach(() => {
    ImageDB.DB = null;
    jest.restoreAllMocks();
  });

  it('does not open the database for an empty list', async() => {
    await expect(ImageDB.getAllByIds([])).resolves.toEqual([]);
    expect(openDB).not.toHaveBeenCalled();
  });

  it('reads only requested keys, omitting missing records and duplicate IDs', async() => {
    const records = new Map([
      ['a', { id: 'a', blob: 'image-a' }],
      ['b', { id: 'b', source: 'favicon' }],
      ['unrelated', { id: 'unrelated', blob: 'unused' }],
      ['background', { id: 'background', blob: 'large-background' }]
    ]);
    const get = jest.fn(key => Promise.resolve(records.get(key)));
    const transaction = jest.fn(() => ({ store: { get }, done: Promise.resolve() }));
    openDB.mockResolvedValue({ transaction });

    await expect(ImageDB.getAllByIds(['b', 'missing', 'a', 'b'])).resolves.toEqual([
      records.get('b'), records.get('a')
    ]);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(transaction).toHaveBeenCalledWith('images', 'readonly');
    expect(get.mock.calls).toEqual([['b'], ['missing'], ['a']]);
  });

  it('preserves the distinction between numeric and string keys', async() => {
    const records = new Map([[1, { id: 1 }], ['1', { id: '1' }]]);
    openDB.mockResolvedValue({
      transaction: () => ({
        store: { get: key => Promise.resolve(records.get(key)) },
        done: Promise.resolve()
      })
    });
    await expect(ImageDB.getAllByIds([1, '1'])).resolves.toEqual([{ id: 1 }, { id: '1' }]);
  });

  it('handles request and transaction failures without unhandled rejections', async() => {
    const error = new Error('database read failed');
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    openDB.mockResolvedValue({
      transaction: () => ({
        store: { get: () => Promise.reject(error) },
        done: Promise.reject(error)
      })
    });
    await expect(ImageDB.getAllByIds(['a'])).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(error);
  });
});
