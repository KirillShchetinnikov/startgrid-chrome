export default class Modal {
  constructor(el) {
    this.body = document.body;
    this.modal = el;
    this.backdrop = null;

    this.activeElement = null;
    this.focusableEls = null;
    this.focusableElFirst = null;
    this.focusableElLast = null;

    this.pageY = 0;
    this.active = false;

    this.classNames = {
      BACKDROP: 'modal-backdrop',
      OPEN: 'modal-open',
      SHOW: 'show',
      FADE: 'fade',
      FIXED: 'fixed'
    };

    this.wrapElem = document.querySelector('main');
    this.duration = 150;

    this.init();
  }

  init() {
    this.modal.setAttribute('tabIndex', -1);

    this.focusableEls = Array.prototype.slice.call(
      this.modal.querySelectorAll('a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex="0"]') // eslint-disable-line max-len
    );

    this.focusableElFirst = this.focusableEls[0];
    this.focusableElLast = this.focusableEls[this.focusableEls.length - 1];

    this.activeElement = document.activeElement;

    this.modal.addEventListener('keydown', this.handleKeyDown.bind(this));
  }

  handleKeyDown(e) {
    const ESC = 27;
    const TAB = 9;
    const focusPrev = () => {
      if (document.activeElement === this.focusableElFirst) {
        e.preventDefault();
        this.focusableElLast.focus();
      }
    };
    const focusNext = () => {
      if (document.activeElement === this.focusableElLast) {
        e.preventDefault();
        this.focusableElFirst.focus();
      }
    };
    switch (e.which) {
      case TAB:
        if (this.focusableEls.length === 1) {
          e.preventDefault();
          break;
        }
        if (e.shiftKey) {
          focusPrev();
        } else {
          focusNext();
        }
        break;
      case ESC:
        this.hide();
        break;
      default: break;
    }
  }

  customEvent(event, target = null) {
    const e = new CustomEvent(`modal.${event}`, {
      detail: {
        target: target
      }
    });
    return e;
  }

  createBackdrop() {
    if (this.backdrop) return;
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'modal-overlay';
    this.body.appendChild(this.backdrop);
  }

  removeBackdrop() {
    if (!this.backdrop) return;
    this.body.removeChild(this.backdrop);
    this.backdrop = null;
  }

  fixWrapper() {
    this.pageY = window.pageYOffset;
    this.wrapElem.classList.add(this.classNames.FIXED);
    this.wrapElem.style.top = `-${this.pageY}px`;
  }

  unfixWrapper() {
    this.wrapElem.style.top = '';
    this.wrapElem.classList.remove(this.classNames.FIXED);
    window.scrollTo(0, this.pageY);
  }

  show(target) {
    if (this.active) return;

    this.fixWrapper();

    const event = this.customEvent('show', target);
    this.modal.dispatchEvent(event);

    this.createBackdrop();
    this.backdrop.classList.add(this.classNames.SHOW);
    this.modal.classList.add(this.classNames.SHOW);
    this.body.classList.add(this.classNames.OPEN);

    this.modal.focus();

    setTimeout(() => {
      this.backdrop.classList.add(this.classNames.FADE);
      this.modal.classList.add(this.classNames.FADE);

      setTimeout(() => {
        this.active = true;
      }, this.duration);
    }, 10);
  }

  hide() {
    if (!this.active) return;

    this.modal.classList.remove(this.classNames.FADE);
    this.backdrop.classList.remove(this.classNames.FADE);

    setTimeout(() => {
      this.body.classList.remove(this.classNames.OPEN);

      this.unfixWrapper();
      this.removeBackdrop();
      this.modal.classList.remove(this.classNames.SHOW);

      const event = this.customEvent('hide');
      this.modal.dispatchEvent(event);

      this.active = false;
    }, this.duration);
  }
}
