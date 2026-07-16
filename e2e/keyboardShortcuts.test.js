import { describe, expect, it, jest } from '@jest/globals';
import {
  DEFAULT_KEYBOARD_SHORTCUTS,
  KEYBOARD_SHORTCUT_ACTIONS,
  eventMatchesSelectionModifier,
  eventMatchesShortcut,
  formatShortcut,
  initKeyboardShortcuts,
  modifierShortcutFromEvent,
  normalizeKeyboardShortcuts,
  shortcutFromEvent
} from '../src/js/keyboardShortcuts';

describe('keyboard shortcuts', () => {
  it('creates normalized shortcuts from keyboard events', () => {
    const event = { code: 'KeyK', ctrlKey: true, altKey: false, shiftKey: true, metaKey: false };
    expect(shortcutFromEvent(event)).toBe('Ctrl+Shift+KeyK');
    expect(formatShortcut('Shift+Ctrl+KeyK')).toBe('Ctrl + Shift + K');
    expect(eventMatchesShortcut(event, 'Ctrl+Shift+KeyK')).toBe(true);
  });

  it('keeps the search shortcut by default and rejects reserved keys', () => {
    expect(normalizeKeyboardShortcuts({})).toEqual(DEFAULT_KEYBOARD_SHORTCUTS);
    expect(KEYBOARD_SHORTCUT_ACTIONS).toContain('select_all_bookmarks');
    expect(DEFAULT_KEYBOARD_SHORTCUTS.select_all_bookmarks).toBe('');
    expect(DEFAULT_KEYBOARD_SHORTCUTS.select_multiple_bookmarks).toBe('Shift');
    expect(shortcutFromEvent({ code: 'Escape' })).toBe('');
    expect(shortcutFromEvent({ code: 'Tab' })).toBe('');
    expect(normalizeKeyboardShortcuts({
      focus_search: 'KeyK',
      add_bookmark: 'KeyK'
    }).add_bookmark).toBe('');
  });

  it('supports a configurable modifier for selecting multiple bookmarks', () => {
    expect(modifierShortcutFromEvent({ code: 'ShiftLeft' })).toBe('Shift');
    expect(modifierShortcutFromEvent({ code: 'ControlRight' })).toBe('Ctrl');
    expect(modifierShortcutFromEvent({ code: 'KeyK' })).toBe('');
    expect(eventMatchesSelectionModifier({ shiftKey: true }, 'Shift')).toBe(true);
    expect(eventMatchesSelectionModifier({ ctrlKey: true }, 'Ctrl')).toBe(true);
    expect(normalizeKeyboardShortcuts({ select_multiple_bookmarks: 'KeyK' })
      .select_multiple_bookmarks).toBe('');
  });

  it('dispatches actions outside editable controls', () => {
    let handler;
    const target = {
      addEventListener: jest.fn((type, callback) => { handler = callback; }),
      removeEventListener: jest.fn()
    };
    const onAction = jest.fn();
    const destroy = initKeyboardShortcuts({ focus_search: 'Slash' }, onAction, target);
    const event = {
      code: 'Slash',
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      defaultPrevented: false,
      repeat: false,
      target: { tagName: 'BODY' },
      composedPath: () => [{ tagName: 'BODY' }],
      preventDefault: jest.fn()
    };

    handler(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(onAction).toHaveBeenCalledWith('focus_search', event);

    event.composedPath = () => [{ tagName: 'INPUT' }];
    handler(event);
    expect(onAction).toHaveBeenCalledTimes(1);

    destroy();
    expect(target.removeEventListener).toHaveBeenCalledWith('keydown', handler);
  });
});
