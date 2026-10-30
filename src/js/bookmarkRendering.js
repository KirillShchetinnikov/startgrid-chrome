// Keep connected tiles (and their focus/selection) when only their data or order changes.
export function reconcileBookmarkGrid(container, candidates) {
  const focused = container.contains(document.activeElement) ? document.activeElement : null;
  const existing = new Map(Array.from(container.children)
    .filter(node => node.matches('.bookmark'))
    .map(node => [node.dataset.id, node]));
  const retainedIds = new Set(candidates.filter(item => !item.nodeType).map(item => String(item.id)));
  const style = getComputedStyle(container);
  const tileHeight = Number.parseFloat(style.getPropertyValue('--bookmark-intrinsic-height')) || 28;
  const columns = Number.parseInt(style.getPropertyValue('--grid-columns'), 10) || 10;
  const immediateTiles = Math.max(200, (Math.ceil(window.innerHeight / tileHeight) + 2) * columns);
  const nodes = [];
  for (const [index, candidate] of candidates.entries()) {
    const previous = candidate.nodeType ? null : existing.get(String(candidate.id));
    const node = previous || (candidate.nodeType ? candidate : document.createElement('a', { is: 'vb-bookmark' }));
    if (!candidate.nodeType) {
      const changed = node.update(candidate);
      const deferred = index >= immediateTiles;
      const deferredChanged = node.classList.contains('bookmark--deferred') !== deferred;
      if (deferredChanged) node.classList.toggle('bookmark--deferred', deferred);
      if (!previous || changed || deferredChanged) node.prepareForDisplay();
    }
    nodes.push(node);
  }

  // Prepare new tiles off-document, then commit without exposing a partial grid.
  for (const node of Array.from(container.children)) {
    if (!node.matches('.bookmark') || !retainedIds.has(node.dataset.id)) node.remove();
  }
  let cursor = container.firstChild;
  for (const node of nodes) {
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
