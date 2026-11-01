import { get, update } from '../api/bookmark';
import { getMessage } from '../i18n';
import { announce } from '../liveAnnouncements';

let closeEditor;

export function startInlineRename(tile) {
  if (!tile?.isConnected || !tile.matches('.bookmark') || tile.closest('.has-dragging')) return;
  if (closeEditor?.() === false) return;
  const id = tile.dataset.id;
  const original = tile.title;
  const editor = document.createElement('form');
  editor.className = 'inline-rename';
  editor.setAttribute('aria-label', getMessage('rename_title'));
  const input = document.createElement('input');
  input.className = 'form-control';
  input.value = original;
  input.required = true;
  input.setAttribute('aria-label', getMessage('label_title'));
  input.setAttribute('aria-describedby', 'inline-rename-help inline-rename-error');
  const hint = document.createElement('small');
  hint.id = 'inline-rename-help';
  hint.textContent = getMessage('rename_hint');
  const error = document.createElement('p');
  error.id = 'inline-rename-error';
  error.setAttribute('role', 'alert');
  const actions = document.createElement('div');
  actions.className = 'inline-rename__actions';
  const save = document.createElement('button');
  save.className = 'btn';
  save.type = 'submit';
  save.textContent = getMessage('btn_save');
  const cancel = document.createElement('button');
  cancel.className = 'btn btn--clear';
  cancel.type = 'button';
  cancel.textContent = getMessage('btn_close');
  actions.append(save, cancel);
  editor.append(input, hint, error, actions);
  document.body.append(editor);
  let pending = false;
  const position = () => {
    if (!tile.isConnected) return close();
    const rect = tile.getBoundingClientRect();
    editor.style.width = `${Math.min(Math.max(rect.width, 260), innerWidth - 16)}px`;
    editor.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - editor.offsetWidth - 8))}px`;
    editor.style.top = `${Math.max(8, Math.min(rect.bottom - 32, innerHeight - editor.offsetHeight - 8))}px`;
  };
  const close = () => {
    if (pending) return false;
    editor.remove();
    document.removeEventListener('scroll', position, true);
    document.removeEventListener('gmodal:beforeopen', close);
    window.removeEventListener('resize', position);
    observer.disconnect();
    closeEditor = null;
    if (tile.isConnected) tile.focus({ preventScroll: true });
    return true;
  };
  const observer = new MutationObserver(() => {
    if (!tile.isConnected) close();
  });
  observer.observe(tile.parentElement, { childList: true });
  closeEditor = close;
  document.addEventListener('scroll', position, true);
  document.addEventListener('gmodal:beforeopen', close);
  window.addEventListener('resize', position);
  cancel.addEventListener('click', close);
  editor.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
    if (event.key === 'Enter' && event.isComposing) event.preventDefault();
  });
  editor.addEventListener('submit', async event => {
    event.preventDefault();
    if (pending) return;
    const title = input.value.trim();
    if (!title) {
      error.textContent = getMessage('error_input_required');
      input.focus();
      return;
    }
    if (title === original) return close();
    pending = true;
    save.disabled = true;
    cancel.disabled = true;
    input.readOnly = true;
    editor.setAttribute('aria-busy', 'true');
    let saved = false;
    try {
      const [current] = await get(id);
      if (!current || current.title !== original) {
        error.textContent = getMessage('rename_conflict');
        return;
      }
      await update(id, { title });
      tile.title = title;
      saved = true;
      announce(getMessage('image_ready'));
    } catch {
      error.textContent = getMessage('rename_failed');
    } finally {
      pending = false;
      save.disabled = false;
      cancel.disabled = false;
      input.readOnly = false;
      editor.removeAttribute('aria-busy');
      if (saved || !tile.isConnected) close();
      else {
        position(); input.focus();
      }
    }
  });
  position();
  input.focus();
  input.select();
}

export function initInlineRename({ isShortcutReserved = () => false } = {}) {
  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.key !== 'F2' || event.repeat || isShortcutReserved()
      || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
    const tile = event.target.closest('.bookmark');
    if (!tile || document.querySelector('.gmodal.is-shown')) return;
    event.preventDefault();
    startInlineRename(tile);
  });
}
