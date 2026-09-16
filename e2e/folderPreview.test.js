import { describe, expect, it } from '@jest/globals';
import { getFolderPreviewCandidates } from '../src/js/folderPreview';

describe('folder preview candidates', () => {
  const site = { id: 'site', url: 'https://example.com' };
  const nested = { id: 'nested', children: [site] };
  const empty = { id: 'empty', children: [] };

  it('prefers direct sites in mixed folders', () => {
    expect(getFolderPreviewCandidates({ children: [nested, site, empty] })).toEqual([site]);
  });

  it('shows direct child folders when there are no direct sites', () => {
    expect(getFolderPreviewCandidates({ children: [nested, empty] })).toEqual([nested, empty]);
  });

  it('uses the same rules at nested levels', () => {
    expect(getFolderPreviewCandidates(nested)).toEqual([site]);
    expect(getFolderPreviewCandidates({ children: [{ children: [nested] }] })[0].children)
      .toEqual([nested]);
  });

  it('leaves empty folders with the default folder icon', () => {
    expect(getFolderPreviewCandidates(empty)).toEqual([]);
    expect(getFolderPreviewCandidates({ id: 'unloaded' })).toEqual([]);
  });
});
