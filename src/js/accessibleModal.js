const FOCUSABLE_SELECTOR = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])', 'select:not([disabled])',
  'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])'
].join(', ');

const modalStates = new WeakMap();

function updateInert(state) {
  const top = state.open.at(-1);
  if (!top) {
    state.originalInert.forEach((inert, element) => {
      element.inert = inert;
    });
    state.originalInert.clear();
    return;
  }
  [...document.body.children].forEach(element => {
    if (element.classList.contains('gmodal-backdrop') || element.classList.contains('toast-container')) return;
    if (!state.originalInert.has(element)) state.originalInert.set(element, element.inert);
    element.inert = element !== top.modal;
  });
}

export function makeModalAccessible(modal, { initialFocus } = {}) {
  let returnFocus = null;
  let isOpen = false;
  if (!modalStates.has(document)) modalStates.set(document, { open: [], originalInert: new Map() });
  const state = modalStates.get(document);
  const entry = { modal, focus: () => (initialFocus?.() || modal.querySelector(FOCUSABLE_SELECTOR) || modal).focus() };

  function containFocus(event) {
    if (event.key !== 'Tab') return;
    const controls = [...modal.querySelectorAll(FOCUSABLE_SELECTOR)]
      .filter(element => !element.hidden && element.offsetParent !== null);
    if (!controls.length) return;

    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function open() {
    if (isOpen) return;
    isOpen = true;
    returnFocus = document.activeElement;
    state.open.push(entry);
    updateInert(state);
    modal.addEventListener('keydown', containFocus);
    entry.focus();
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    modal.removeEventListener('keydown', containFocus);
    const wasTop = state.open.at(-1) === entry;
    state.open.splice(state.open.indexOf(entry), 1);
    updateInert(state);
    if (wasTop) {
      const top = state.open.at(-1);
      if (top) {
        if (top.modal.contains(returnFocus)) returnFocus.focus();
        else top.focus();
      } else if (!returnFocus?.closest?.('.gmodal')) returnFocus?.focus?.();
    }
    returnFocus = null;
  }

  modal.addEventListener('gmodal:open', open);
  modal.addEventListener('gmodal:close', close);
  return () => {
    modal.removeEventListener('gmodal:open', open);
    modal.removeEventListener('gmodal:close', close);
    close();
  };
}
