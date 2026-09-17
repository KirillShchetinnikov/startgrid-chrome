import { describe, expect, it, jest } from '@jest/globals';
import { releaseThumbnailUrls } from '../src/js/bookmarkRendering';

describe('thumbnail URL ownership', () => {
  it('releases unused records and child previews even when no tile displayed their image', () => {
    const revoke = jest.fn();
    releaseThumbnailUrls([
      { blobUrl: 'blob:unused', children: [{ blobUrl: 'blob:preview' }] },
      { blobUrl: 'blob:unused' },
      { source: 'favicon' }, undefined
    ], [], revoke);
    expect(revoke.mock.calls).toEqual([['blob:unused'], ['blob:preview']]);
  });

  it('does not release URLs still owned by the next view', () => {
    const revoke = jest.fn();
    releaseThumbnailUrls([
      { blobUrl: 'blob:old', children: [{ blobUrl: 'blob:kept' }] }
    ], [{ blobUrl: 'blob:kept' }], revoke);
    expect(revoke.mock.calls).toEqual([['blob:old']]);
  });
});
