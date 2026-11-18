import { $customTrigger } from '../../utils';

const EVENTS = {
  OPEN: 'contextmenu:open',
  CLOSE: 'contextmenu:close',
  SELECTION: 'contextmenu:selection'
};

class ContextMenu {
  constructor(menu, options) {
    if (typeof menu === 'string') {
      menu = document.querySelector(menu);
    }
    if (!(menu instanceof HTMLElement)) {
      throw Error('Check the argument of the selector');
    }

    this.menu = menu;

    if (this.menu.active) return;

    this.menu.active = true;

    this.settings = Object.assign({
      tresholdMargin: 10,
      delegateSelector: 'html',
      scrollContainer: window
    }, options);

    this.init();
  }

  init() {
    this.state = false;
    this.trigger = null;

    if (this.settings.scrollContainer !== window) {
      const el = document.querySelector(this.settings.scrollContainer);
      this.scrollContainer = el ? el : window;
    } else {
      this.scrollContainer = window;
    }

    // Menu size
    this.menuWidth = null;
    this.menuHeight = null;

    // Mouse position
    this.menuX = null;
    this.menuY = null;

    this.attachEvents();
  }

  getDOMChildren() {
    this.items = Array.from(this.menu.querySelectorAll('.context-menu__link:not(.is-disabled)'));
  }

  attachEvents() {
    this.handlerTrigger = this.handlerTrigger.bind(this);
    this.handlerClick = this.handlerClick.bind(this);
    this.handlerKeyboard = this.handlerKeyboard.bind(this);
    this.handlerClose = this.handlerClose.bind(this);

    this.scrollContainer.addEventListener('scroll', this.handlerClose);
    window.addEventListener('resize', this.handlerClose);
    document.addEventListener('contextmenu', this.handlerTrigger);
    document.addEventListener('keydown', this.handlerKeyboard);
    document.addEventListener('click', this.handlerClick);
  }

  detachEvents() {
    this.scrollContainer.removeEventListener('scroll', this.handlerClose);
    window.removeEventListener('resize', this.handlerClose);
    document.removeEventListener('contextmenu', this.handlerTrigger);
    document.removeEventListener('keydown', this.handlerKeyboard);
    document.removeEventListener('click', this.handlerClick);
  }

  position(e) {
    this.menu.style.top = 0;
    this.menu.style.left = 0;

    if (!e.clientX && !e.clientY) {
      // trigger by key
      const target = e.target;
      const pos = target.getBoundingClientRect();
      this.menuX = pos.left + window.pageXOffset;
      this.menuY = pos.top + window.pageYOffset;
    } else {
      this.menuX = e.pageX;
      this.menuY = e.pageY;
    }

    this.menuWidth = this.menu.offsetWidth;
    this.menuHeight = this.menu.offsetHeight;

    const windowWidth = document.documentElement.clientWidth + window.pageXOffset;
    const windowHeight = document.documentElement.clientHeight + window.pageYOffset;

    if ((windowWidth - this.menuX) < this.menuWidth) {
      this.menu.style.left = `${windowWidth - this.menuWidth - this.settings.tresholdMargin}px`;
    } else {
      this.menu.style.left = `${this.menuX}px`;
    }

    if ((windowHeight - this.menuY) < this.menuHeight) {
      this.menu.style.top = `${windowHeight - this.menuHeight - this.settings.tresholdMargin}px`;
    } else {
      this.menu.style.top = `${this.menuY}px`;
    }

    const originX = Math.max(0, Math.min(this.menuWidth, this.menuX - parseFloat(this.menu.style.left)));
    const originY = Math.max(0, Math.min(this.menuHeight, this.menuY - parseFloat(this.menu.style.top)));
    this.menu.style.transformOrigin = `${originX}px ${originY}px`;
  }

  handlerClose() {
    this.close();
  }

  handlerKeyboard(e) {
    if (!this.state) return;
    const index = this.items.indexOf(document.activeElement);
    switch (e.key) {
      case 'ArrowDown':
        this.items[(index + 1) % this.items.length]?.focus();
        break;
      case 'ArrowUp':
        this.items[(index - 1 + this.items.length) % this.items.length]?.focus();
        break;
      case 'Home':
        this.items[0]?.focus();
        break;
      case 'End':
        this.items.at(-1)?.focus();
        break;
      case 'Escape':
        this.close(true);
        break;
      case 'Enter':
      case ' ':
        this.select(this.items[index]);
        break;
      case 'Tab':
        this.close(true);
        return;
      default:
        return;
    }
    e.preventDefault();
    e.stopPropagation();
  }

  handlerClick(e) {
    if (!this.state) return;

    const menu = e.target.closest('.context-menu');

    if (!menu) {
      this.close();
      return;
    }

    e.preventDefault();
    const action = e.target.closest('.context-menu__link');
    this.select(action);
  }

  handlerTrigger(e) {
    if (!this.menu || !this.menu.active) return;

    const target = e.target.closest(this.settings.delegateSelector);
    if (target) {
      e.preventDefault();
      this.close();
      this.trigger = target;
      this.open(e);
    } else {
      this.close();
    }
  }

  select(action) {
    if (action && !action.classList.contains('is-disabled')) {
      this.close(true);
      $customTrigger(EVENTS.SELECTION, this.menu, {
        detail: {
          selection: action.dataset.action,
          trigger: this.trigger
        }
      });
    }
  }

  open(e) {
    if (this.state) return;

    this.state = true;
    this.menu.classList.add('context-menu--open');

    $customTrigger(EVENTS.OPEN, this.menu, {
      detail: {
        trigger: this.trigger
      }
    });
    this.position(e);

    this.opener = this.trigger.querySelector('.bookmark__action') || this.trigger;
    this.opener.setAttribute('aria-expanded', 'true');
    this.getDOMChildren();
    this.items[0]?.focus({ preventScroll: true });
  }

  close(restoreFocus = false) {
    if (!this.state) return;

    this.state = false;
    this.menu.classList.remove('context-menu--open');

    this.opener?.setAttribute('aria-expanded', 'false');
    if (restoreFocus) this.opener?.focus({ preventScroll: true });

    $customTrigger(EVENTS.CLOSE, this.menu, {
      detail: {
        trigger: this.trigger
      }
    });
  }

  destroy() {
    if (!this.menu || !this.menu.active) return;

    this.close();
    this.detachEvents();

    delete this.menu.active;
    Object.keys(this).forEach(property => {
      delete this[property];
    });
  }
}

export default ContextMenu;
