export const KEYBOARD_SHORTCUT_ACTIONS = Object.freeze([
  'focus_search',
  'add_bookmark',
  'toggle_quick_settings',
  'open_settings',
  'go_home',
  'go_back',
  'select_all_bookmarks',
  'update_thumbnails'
]);

export const DEFAULT_KEYBOARD_SHORTCUTS = Object.freeze({
  focus_search: 'Slash',
  add_bookmark: '',
  toggle_quick_settings: '',
  open_settings: '',
  go_home: '',
  go_back: '',
  select_all_bookmarks: '',
  update_thumbnails: ''
});

const MODIFIERS = ['Ctrl', 'Alt', 'Shift', 'Meta'];
const MODIFIER_CODES = new Set([
  'ControlLeft', 'ControlRight',
  'AltLeft', 'AltRight',
  'ShiftLeft', 'ShiftRight',
  'MetaLeft', 'MetaRight'
]);
const RESERVED_CODES = new Set(['Escape', 'Tab']);

export function shortcutFromEvent(event) {
  if (!event?.code || MODIFIER_CODES.has(event.code) || RESERVED_CODES.has(event.code)) return '';

  const parts = [];
  if (event.ctrlKey) parts.push('Ctrl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  if (event.metaKey) parts.push('Meta');
  parts.push(event.code);
  return parts.join('+');
}

export function normalizeShortcut(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  const parts = value.trim().split('+');
  const code = parts.pop();
  const modifiers = [...new Set(parts.filter(part => MODIFIERS.includes(part)))];
  if (!code || RESERVED_CODES.has(code) || MODIFIER_CODES.has(code)) return '';
  return [...MODIFIERS.filter(modifier => modifiers.includes(modifier)), code].join('+');
}

export function normalizeKeyboardShortcuts(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const used = new Set();
  return KEYBOARD_SHORTCUT_ACTIONS.reduce((shortcuts, action) => {
    const configured = Object.prototype.hasOwnProperty.call(source, action)
      ? source[action]
      : DEFAULT_KEYBOARD_SHORTCUTS[action];
    const shortcut = normalizeShortcut(configured);
    shortcuts[action] = shortcut && !used.has(shortcut) ? shortcut : '';
    if (shortcuts[action]) used.add(shortcuts[action]);
    return shortcuts;
  }, {});
}

export function eventMatchesShortcut(event, shortcut) {
  return Boolean(shortcut) && shortcutFromEvent(event) === normalizeShortcut(shortcut);
}

function isEditableTarget(event) {
  const path = typeof event.composedPath === 'function' ? event.composedPath() : [event.target];
  return path.some(node => (
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(node?.tagName)
    || node?.isContentEditable
  ));
}

export function initKeyboardShortcuts(shortcuts, onAction, target = document) {
  const normalized = normalizeKeyboardShortcuts(shortcuts);
  const handler = event => {
    if (event.defaultPrevented || event.repeat || isEditableTarget(event)) return;

    const action = KEYBOARD_SHORTCUT_ACTIONS.find(actionName => (
      eventMatchesShortcut(event, normalized[actionName])
    ));
    if (!action) return;

    event.preventDefault();
    onAction(action, event);
  };

  target.addEventListener('keydown', handler);
  return () => target.removeEventListener('keydown', handler);
}

const CODE_LABELS = Object.freeze({
  Slash: '/',
  Backslash: '\\',
  Comma: ',',
  Period: '.',
  Semicolon: ';',
  Quote: '\'',
  BracketLeft: '[',
  BracketRight: ']',
  Minus: '-',
  Equal: '=',
  Backquote: '`',
  Space: 'Space'
});

export function formatShortcut(shortcut) {
  const normalized = normalizeShortcut(shortcut);
  if (!normalized) return '';
  const parts = normalized.split('+');
  const code = parts.pop();
  const codeLabel = CODE_LABELS[code]
    || code.replace(/^Key/, '').replace(/^Digit/, '');
  return [...parts, codeLabel].join(' + ');
}
