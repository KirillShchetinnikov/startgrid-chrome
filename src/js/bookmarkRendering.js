// Keep connected tiles (and their focus/selection) when only their data or order changes.
export function reconcileBookmarkGrid(container, fragment) {
  const focused = container.contains(document.activeElement) ? document.activeElement : null;
  const existing = new Map(Array.from(container.children)
    .filter(node => node.matches('.bookmark'))
    .map(node => [node.dataset.id, node]));
  const candidates = Array.from(fragment.children);
  const retainedIds = new Set(candidates.map(node => node.dataset.id));
  for (const node of Array.from(container.children)) {
    if (!node.matches('.bookmark') || !retainedIds.has(node.dataset.id)) node.remove();
  }
  let cursor = container.firstChild;

  for (const candidate of candidates) {
    const previous = existing.get(candidate.dataset.id);
    const node = previous || candidate;
    if (previous) previous.updateFrom(candidate);
    if (node === cursor) cursor = cursor.nextSibling;
    else container.insertBefore(node, cursor);
  }
  while (cursor) {
    const next = cursor.nextSibling;
    cursor.remove();
    cursor = next;
  }
  if (focused?.isConnected && document.activeElement !== focused) focused.focus({ preventScroll: true });
}

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
