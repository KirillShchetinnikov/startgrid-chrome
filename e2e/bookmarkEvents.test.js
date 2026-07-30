import { describe, expect, it, jest } from '@jest/globals';
import {
  cleanupRemovedBookmark,
  collectBookmarkSubtreeIds,
  createBookmarkImportGuard,
  createBookmarksChangedEnvelope,
  createRefreshScheduler,
  refreshBookmarkView,
  replaceLiteralMarker,
  runOptionalSideEffectBeforeBroadcast
} from '../src/js/bookmarkEvents';

describe('bookmark worker/page event policies', () => {
  it('collects leaf, deep, duplicate, and fallback IDs in preorder', () => {
    expect(collectBookmarkSubtreeIds({ id: 'leaf', url: 'https://example.com' }))
      .toEqual(['leaf']);
    expect(collectBookmarkSubtreeIds({
      children: [
        { id: 'a', children: [{ id: 'b' }, { id: 'a' }] },
        { children: [{ id: 'c' }] }
      ]
    }, 'root')).toEqual(['root', 'a', 'b', 'c']);
    expect(collectBookmarkSubtreeIds(null, 'fallback')).toEqual(['fallback']);
  });

  it('finishes every idempotent delete before broadcasting', async() => {
    const order = [];
    const deleteById = jest.fn(async id => order.push(`delete:${id}`));
    const broadcast = jest.fn(async() => order.push('broadcast'));
    const node = { id: 'root', children: [{ id: 'child' }] };

    await cleanupRemovedBookmark({ node, deleteById, broadcast });
    await cleanupRemovedBookmark({ node, deleteById, broadcast });

    expect(order.slice(0, 3)).toEqual(['delete:root', 'delete:child', 'broadcast']);
    expect(deleteById).toHaveBeenCalledTimes(4);
    expect(createBookmarksChangedEnvelope('removed', 12)).toEqual({
      bookmarksChanged: { eventType: 'removed', id: '12' }
    });
    expect(createBookmarksChangedEnvelope('imported', 'ignored')).toEqual({
      bookmarksChanged: { eventType: 'imported', id: null }
    });
  });

  it('coalesces bursts and allows at most one rerun during an in-flight refresh', async() => {
    let release;
    const refresh = jest.fn()
      .mockImplementationOnce(() => new Promise(resolve => { release = resolve; }))
      .mockResolvedValue();
    const schedule = createRefreshScheduler(refresh);

    const first = schedule();
    const sameBurst = schedule();
    await Promise.resolve();
    expect(refresh).toHaveBeenCalledTimes(1);

    schedule();
    schedule();
    release();
    await first;
    await sameBurst;
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('repeats the active search instead of replacing it with a folder refresh', async() => {
    const search = jest.fn().mockResolvedValue('search');
    const createSpeedDial = jest.fn().mockResolvedValue('folder');
    const startFolder = jest.fn(() => 'home');

    await expect(refreshBookmarkView({
      hasSearch: true,
      lastSearchQuery: 'literal query',
      search,
      createSpeedDial,
      startFolder
    })).resolves.toBe('search');
    expect(search).toHaveBeenCalledWith('literal query');
    expect(createSpeedDial).not.toHaveBeenCalled();

    await refreshBookmarkView({
      hasSearch: false,
      lastSearchQuery: '',
      search,
      createSpeedDial,
      startFolder
    });
    expect(createSpeedDial).toHaveBeenCalledWith('home');
  });

  it('clears the import guard before one authoritative broadcast and isolates menu failure', async() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const order = [];
    let persisted = false;
    const guard = createBookmarkImportGuard({
      readGuard: async() => persisted,
      writeGuard: async() => {
        order.push('persist');
        persisted = true;
      },
      clearGuard: async() => {
        order.push('clear');
        persisted = false;
      }
    });

    const begin = guard.begin();
    expect(await guard.isActive()).toBe(true);
    await begin;
    const perItemBroadcast = jest.fn();
    for (const event of ['created', 'changed', 'moved']) {
      if (!(await guard.isActive())) perItemBroadcast(event);
    }
    await guard.complete({
      broadcast: jest.fn(async envelope => order.push(`broadcast:${envelope.bookmarksChanged.eventType}`)),
      reconcileContextMenu: async() => {
        order.push('menu');
        throw new Error('menu');
      }
    });

    expect(order).toEqual(['persist', 'clear', 'broadcast:imported', 'menu']);
    expect(perItemBroadcast).not.toHaveBeenCalled();
    expect(await guard.isActive()).toBe(false);
  });

  it.each(['permission', 'favicon'])(
    'broadcasts exactly once after rejected optional %s work',
    async() => {
      jest.spyOn(console, 'warn').mockImplementation(() => {});
      const broadcast = jest.fn().mockResolvedValue();
      await runOptionalSideEffectBeforeBroadcast(
        jest.fn().mockRejectedValue(new Error('optional')),
        broadcast
      );
      expect(broadcast).toHaveBeenCalledTimes(1);
    }
  );

  it('inserts bookmark titles literally even when they contain replacement tokens', () => {
    expect(replaceLiteralMarker(
      'Removed __TITLE__',
      '__TITLE__',
      "$& $` $' $$ <img>"
    )).toBe("Removed $& $` $' $$ <img>");
  });
});
