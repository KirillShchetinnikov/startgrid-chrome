export const SYNC_QUOTA_ERROR_KEY = 'sync_quota_error';
export const DEFAULT_SYNC_QUOTA_BYTES = 102400;
export const DEFAULT_SYNC_QUOTA_BYTES_PER_ITEM = 8192;

function byteLength(value) {
  return new TextEncoder().encode(value).length;
}

export function getSyncItemBytes(key, value) {
  return byteLength(key) + byteLength(JSON.stringify(value));
}

export function checkSyncQuota({
  key,
  value,
  totalBytes = 0,
  currentItemBytes = 0,
  quotaBytes = DEFAULT_SYNC_QUOTA_BYTES,
  quotaBytesPerItem = DEFAULT_SYNC_QUOTA_BYTES_PER_ITEM
}) {
  return checkSyncQuotaBatch({
    records: { [key]: value },
    totalBytes,
    currentRecordsBytes: currentItemBytes,
    quotaBytes,
    quotaBytesPerItem
  });
}

export function checkSyncQuotaBatch({
  records,
  totalBytes = 0,
  currentRecordsBytes = 0,
  quotaBytes = DEFAULT_SYNC_QUOTA_BYTES,
  quotaBytesPerItem = DEFAULT_SYNC_QUOTA_BYTES_PER_ITEM
}) {
  const itemSizes = Object.entries(records).map(([storageKey, value]) => ({
    storageKey,
    itemBytes: getSyncItemBytes(storageKey, value)
  }));
  const largestItemBytes = Math.max(0, ...itemSizes.map(item => item.itemBytes));
  const newRecordsBytes = itemSizes.reduce((total, item) => total + item.itemBytes, 0);
  const projectedBytes = Math.max(0, totalBytes - currentRecordsBytes) + newRecordsBytes;
  const oversizedItem = itemSizes.find(item => item.itemBytes > quotaBytesPerItem);

  if (oversizedItem) {
    return {
      exceeded: true,
      reason: 'item',
      storageKey: oversizedItem.storageKey,
      usedBytes: oversizedItem.itemBytes,
      limitBytes: quotaBytesPerItem,
      itemBytes: oversizedItem.itemBytes,
      largestItemBytes,
      projectedBytes
    };
  }

  if (projectedBytes > quotaBytes) {
    return {
      exceeded: true,
      reason: 'total',
      usedBytes: projectedBytes,
      limitBytes: quotaBytes,
      itemBytes: largestItemBytes,
      largestItemBytes,
      projectedBytes
    };
  }

  return {
    exceeded: false,
    itemBytes: largestItemBytes,
    largestItemBytes,
    projectedBytes
  };
}

export function isSyncStorageQuotaError(error) {
  const message = String(error?.message || error || '');
  return /QUOTA_BYTES(?:_PER_ITEM)?|quota[^.]*bytes|bytes[^.]*quota/i.test(message);
}
