export function releaseThumbnailUrls(records, retainedRecords = [], revoke = URL.revokeObjectURL) {
  const urls = items => {
    const result = new Set();
    for (const record of items) {
      if (record?.blobUrl) result.add(record.blobUrl);
      for (const child of record?.children || []) {
        if (child.blobUrl) result.add(child.blobUrl);
      }
    }
    return result;
  };
  const retained = urls(retainedRecords);
  for (const url of urls(records)) {
    if (!retained.has(url)) revoke(url);
  }
}
