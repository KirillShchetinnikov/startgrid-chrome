export const BOOKMARK_TITLE_FONTS = Object.freeze({
  default: 'var(--font-family)',
  arial: 'Arial, Helvetica, sans-serif',
  verdana: 'Verdana, Geneva, sans-serif',
  georgia: 'Georgia, "Times New Roman", serif',
  times: '"Times New Roman", Times, serif',
  monospace: '"Courier New", Courier, monospace'
});

export function normalizeBookmarkTitleFont(value) {
  return Object.hasOwn(BOOKMARK_TITLE_FONTS, value) ? value : 'default';
}

export function bookmarkTitleFontOptions(defaultTitle) {
  return [
    { value: 'default', title: defaultTitle },
    { value: 'arial', title: 'Arial' },
    { value: 'verdana', title: 'Verdana' },
    { value: 'georgia', title: 'Georgia' },
    { value: 'times', title: 'Times New Roman' },
    { value: 'monospace', title: 'Courier New' }
  ];
}
