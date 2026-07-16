import { describe, expect, it } from '@jest/globals';
import {
  checkSyncQuota,
  checkSyncQuotaBatch,
  getSyncItemBytes,
  isSyncStorageQuotaError
} from '../src/js/syncQuota';

describe('Chrome Sync storage quota', () => {
  it('measures the key and JSON value using UTF-8 bytes', () => {
    expect(getSyncItemBytes('settings', { title: 'Поиск' })).toBe(
      Buffer.byteLength('settings') + Buffer.byteLength(JSON.stringify({ title: 'Поиск' }))
    );
  });

  it('detects the per-item quota before writing', () => {
    const result = checkSyncQuota({
      key: 'settings',
      value: { data: 'x'.repeat(8192) }
    });

    expect(result.exceeded).toBe(true);
    expect(result.reason).toBe('item');
    expect(result.usedBytes).toBeGreaterThan(result.limitBytes);
  });

  it('detects the projected total quota while replacing the current item', () => {
    const result = checkSyncQuota({
      key: 'settings',
      value: { data: 'x'.repeat(2000) },
      totalBytes: 101500,
      currentItemBytes: 500,
      quotaBytes: 102400
    });

    expect(result.exceeded).toBe(true);
    expect(result.reason).toBe('total');
    expect(result.projectedBytes).toBeGreaterThan(102400);
  });

  it('checks every split record and their combined projected size', () => {
    const result = checkSyncQuotaBatch({
      records: {
        settings: { data: 'x'.repeat(3000) },
        settings_search: { data: 'x'.repeat(3000) },
        settings_thumbnails: { data: 'x'.repeat(3000) }
      },
      totalBytes: 95000,
      currentRecordsBytes: 1000,
      quotaBytes: 102400
    });

    expect(result.exceeded).toBe(true);
    expect(result.reason).toBe('total');
    expect(result.projectedBytes).toBeGreaterThan(102400);
  });

  it('recognizes browser quota errors without treating write throttling as storage exhaustion', () => {
    expect(isSyncStorageQuotaError(new Error('QUOTA_BYTES_PER_ITEM quota exceeded'))).toBe(true);
    expect(isSyncStorageQuotaError(new Error('MAX_WRITE_OPERATIONS_PER_MINUTE quota exceeded')))
      .toBe(false);
  });
});
