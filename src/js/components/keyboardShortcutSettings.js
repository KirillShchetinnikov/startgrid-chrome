import { $createElement } from '../utils';
import { getMessage } from '../i18n';
import Toast from './toast';
import {
  DEFAULT_KEYBOARD_SHORTCUTS,
  KEYBOARD_SHORTCUT_ACTIONS,
  formatShortcut,
  modifierShortcutFromEvent,
  normalizeKeyboardShortcuts,
  shortcutFromEvent
} from '../keyboardShortcuts';

const message = key => getMessage(key);

export default function initKeyboardShortcutSettings({ container, settings }) {
  let recordingAction = null;

  function render() {
    const shortcuts = normalizeKeyboardShortcuts(settings.$.keyboard_shortcuts);
    const list = $createElement('div', { class: 'shortcut-editor__list' });

    KEYBOARD_SHORTCUT_ACTIONS.forEach(action => {
      const shortcut = shortcuts[action];
      const button = $createElement('button', {
        class: 'shortcut-editor__capture',
        type: 'button',
        'data-shortcut-action': action,
        'aria-label': message('shortcut_change')
      }, shortcut ? formatShortcut(shortcut) : message('shortcut_not_set'));

      const clearButton = $createElement('button', {
        class: 'shortcut-editor__clear',
        type: 'button',
        'data-shortcut-clear': action,
        'aria-label': message('shortcut_clear'),
        title: message('shortcut_clear')
      }, '×');
      clearButton.disabled = !shortcut;

      list.append($createElement('div', { class: 'shortcut-editor__item' },
        $createElement('div', { class: 'shortcut-editor__description' },
          $createElement('strong', {}, message(`shortcut_${action}`))
        ),
        $createElement('div', { class: 'shortcut-editor__controls' }, button, clearButton)
      ));
    });

    const resetButton = $createElement('button', {
      class: 'btn shortcut-editor__reset md-ripple',
      type: 'button',
      'data-shortcut-reset': ''
    }, message('shortcut_reset'));

    container.replaceChildren(list, resetButton);
    recordingAction = null;
  }

  async function save(action, shortcut) {
    const shortcuts = normalizeKeyboardShortcuts(settings.$.keyboard_shortcuts);
    const conflict = Object.entries(shortcuts).find(([otherAction, otherShortcut]) => (
      otherAction !== action && shortcut && otherShortcut === shortcut
    ));
    if (conflict) {
      Toast.show(message('shortcut_conflict'));
      render();
      return;
    }

    shortcuts[action] = shortcut;
    await settings.updateKey('keyboard_shortcuts', shortcuts);
    render();
  }

  container.addEventListener('click', async event => {
    const captureButton = event.target.closest('[data-shortcut-action]');
    if (captureButton) {
      recordingAction = captureButton.dataset.shortcutAction;
      captureButton.textContent = message('shortcut_press_keys');
      captureButton.classList.add('is-recording');
      return;
    }

    const clearButton = event.target.closest('[data-shortcut-clear]');
    if (clearButton) {
      await save(clearButton.dataset.shortcutClear, '');
      return;
    }

    if (event.target.closest('[data-shortcut-reset]')) {
      await settings.updateKey('keyboard_shortcuts', { ...DEFAULT_KEYBOARD_SHORTCUTS });
      render();
    }
  });

  container.addEventListener('keydown', async event => {
    const captureButton = event.target.closest('[data-shortcut-action]');
    if (!captureButton || recordingAction !== captureButton.dataset.shortcutAction) return;

    event.preventDefault();
    event.stopPropagation();
    if (event.code === 'Escape') {
      render();
      return;
    }
    const hasModifier = event.ctrlKey || event.altKey || event.shiftKey || event.metaKey;
    if (['Backspace', 'Delete'].includes(event.code) && !hasModifier) {
      await save(recordingAction, '');
      return;
    }

    if (recordingAction === 'select_multiple_bookmarks') {
      const modifier = modifierShortcutFromEvent(event);
      if (!modifier) {
        Toast.show(message('shortcut_modifier_invalid'));
        return;
      }
      await save(recordingAction, modifier);
      return;
    }

    if (/^(Control|Alt|Shift|Meta)(Left|Right)$/.test(event.code)) return;

    const shortcut = shortcutFromEvent(event);
    if (!shortcut) {
      Toast.show(message('shortcut_invalid'));
      return;
    }
    await save(recordingAction, shortcut);
  });

  container.addEventListener('focusout', event => {
    if (recordingAction && event.target.closest('[data-shortcut-action]')) render();
  });

  render();
  return { render };
}
