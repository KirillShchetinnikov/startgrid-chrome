const FOCUSABLE_SELECTOR = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])', 'select:not([disabled])',
  'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])'
].join(', ');

export function makeModalAccessible(modal, { initialFocus } = {}) {
  let returnFocus = null;
  let inertElements = [];

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
    returnFocus = document.activeElement;
    inertElements = [...document.body.children].filter(element => {
      return element !== modal
        && !element.classList.contains('gmodal-backdrop')
        && !element.classList.contains('toast-container');
    });
    inertElements.forEach(element => {
      element.inert = true;
    });
    modal.addEventListener('keydown', containFocus);
    (initialFocus?.() || modal.querySelector(FOCUSABLE_SELECTOR))?.focus();
  }

  function close() {
    modal.removeEventListener('keydown', containFocus);
    inertElements.forEach(element => {
      element.inert = false;
    });
    inertElements = [];
    returnFocus?.focus?.();
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
