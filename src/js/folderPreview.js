// Prefer site icons; a folder containing only folders previews those folders instead.
export function getFolderPreviewCandidates(folder) {
  const children = folder.children ?? [];
  const bookmarks = children.filter(child => child.url);
  return bookmarks.length ? bookmarks : children;
}
