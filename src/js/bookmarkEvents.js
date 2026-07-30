export function collectBookmarkSubtreeIds(node, fallbackId) {
  const ids = [];
  const seen = new Set();
  const stack = node ? [node] : [];

  while (stack.length) {
    const current = stack.pop();
    const rawId = current?.id ?? (current === node ? fallbackId : null);
    if (rawId !== null && rawId !== undefined && String(rawId)) {
      const id = String(rawId);
      if (!seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }

    const children = Array.isArray(current?.children) ? current.children : [];
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push(children[index]);
    }
  }

  if (!ids.length && fallbackId !== null && fallbackId !== undefined && String(fallbackId)) {
    ids.push(String(fallbackId));
  }
  return ids;
}

export function createBookmarksChangedEnvelope(eventType, id) {
  return {
    bookmarksChanged: {
      eventType,
      id: eventType === 'imported' ? null : String(id)
    }
  };
}

export function replaceLiteralMarker(template, marker, value) {
  return String(template).replace(marker, () => String(value));
}

export async function runOptionalSideEffectBeforeBroadcast(sideEffect, broadcast) {
  try {
    await sideEffect();
  } catch (error) {
    console.warn('Optional bookmark side effect failed', error);
  }
  return broadcast();
}

export async function completeBookmarkImport({
  clearImportGuard,
  broadcast,
  reconcileContextMenu
}) {
  await clearImportGuard();
  await broadcast(createBookmarksChangedEnvelope('imported', null));
  try {
    await reconcileContextMenu();
  } catch (error) {
    console.warn('Could not rebuild context menu after import', error);
  }
}

export function createBookmarkImportGuard({ readGuard, writeGuard, clearGuard }) {
  let active = false;
  let pendingWrite = Promise.resolve();

  return {
    begin() {
      active = true;
      pendingWrite = Promise.resolve().then(writeGuard);
      return pendingWrite;
    },
    async isActive() {
      if (active) return true;
      return Boolean(await readGuard());
    },
    async complete({ broadcast, reconcileContextMenu }) {
      await completeBookmarkImport({
        clearImportGuard: async() => {
          await pendingWrite.catch(() => undefined);
          await clearGuard();
          active = false;
        },
        broadcast,
        reconcileContextMenu
      });
    }
  };
}

export async function cleanupRemovedBookmark({
  node,
  fallbackId,
  deleteById,
  broadcast
}) {
  const ids = collectBookmarkSubtreeIds(node, fallbackId);
  const results = await Promise.allSettled(ids.map(id => deleteById(id)));
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.warn(`Could not delete thumbnail ${ids[index]}`, result.reason);
    }
  });
  await broadcast();
  return ids;
}

export function createRefreshScheduler(refresh) {
  let scheduled = false;
  let running = false;
  let rerun = false;
  let current = Promise.resolve();

  const run = async() => {
    scheduled = false;
    running = true;
    try {
      do {
        rerun = false;
        await refresh();
      } while (rerun);
    } finally {
      running = false;
    }
  };

  return function scheduleRefresh() {
    if (running) {
      rerun = true;
      return current;
    }
    if (scheduled) return current;

    scheduled = true;
    current = Promise.resolve().then(run);
    return current;
  };
}

export function refreshBookmarkView({
  hasSearch,
  lastSearchQuery,
  search,
  createSpeedDial,
  startFolder
}) {
  if (hasSearch && lastSearchQuery) return search(lastSearchQuery);
  return createSpeedDial(startFolder());
}
