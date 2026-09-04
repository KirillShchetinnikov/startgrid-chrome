import { $createElement } from '../utils';
import { getMessage } from '../i18n';
import { announce } from '../liveAnnouncements';

const Toast = (() => {
  const DEFAULTS = {
    position: 'bottom-left',
    modClass: '',
    hideByClick: true,
    delay: 5000,
    progress: false,
    title: '',
    message: '',
    trustedHtml: null,
    details: [],
    dedupeKey: '',
    action: undefined,
    onClose: undefined,
    onShow: undefined
  };
  const activeToasts = new Map();

  const containers = {
    'top': {
      el: createContainer('top')
    },
    'top-left': {
      el: createContainer('top-left')
    },
    'top-right': {
      el: createContainer('top-right')
    },
    'bottom': {
      el: createContainer('bottom')
    },
    'bottom-left': {
      el: createContainer('bottom-left')
    },
    'bottom-right': {
      el: createContainer('bottom-right')
    }
  };

  function init() {
    const fragment = document.createDocumentFragment();
    Object.keys(containers).forEach(key => fragment.append(containers[key].el));

    document.body.append(fragment);
  }

  function createContainer(position) {
    return $createElement('div', {
      class: `toast-container toast-container${position ? `--${position}` : ''}`
    });
  }

  function show(data) {
    let actionBtn = null;
    let closeBtn = null;
    let clickByManual = false;
    let timer = null;

    const settings = { ...DEFAULTS };

    if (typeof data === 'string') {
      settings.message = data;
    } else {
      Object.assign(settings, data);
    }

    if (settings.dedupeKey && activeToasts.has(settings.dedupeKey)) {
      return activeToasts.get(settings.dedupeKey);
    }
    const details = Array.isArray(settings.details) ? settings.details : [];

    const toast = $createElement('div', {
      class: `toast toast--${settings.position}`
    });
    const contentNode = $createElement('div', { class: 'toast__content' });
    if (settings.title) {
      const titleNode = $createElement('div', { class: 'toast__title' });
      titleNode.textContent = settings.title;
      contentNode.append(titleNode);
    }
    const messageNode = $createElement('div', { class: 'toast__message' });
    if (typeof settings.trustedHtml === 'string') {
      messageNode.innerHTML = settings.trustedHtml;
    } else {
      messageNode.textContent = settings.message;
    }
    contentNode.append(messageNode);
    if (details.length) {
      const detailsNode = $createElement('dl', { class: 'toast__details' });
      details.forEach(detail => {
        const rowNode = $createElement('div', { class: 'toast__detail' });
        const labelNode = $createElement('dt', { class: 'toast__detail-label' });
        const valueNode = $createElement('dd', { class: 'toast__detail-value' });
        labelNode.textContent = detail.label;
        valueNode.textContent = detail.value;
        rowNode.append(labelNode, valueNode);
        detailsNode.append(rowNode);
      });
      contentNode.append(detailsNode);
    }
    toast.append(contentNode);
    const modifierClasses = typeof settings.modClass === 'string'
      ? settings.modClass.trim().split(/\s+/).filter(Boolean)
      : [];
    if (modifierClasses.length) toast.classList.add(...modifierClasses);
    const announcement = [
      settings.title,
      settings.message,
      ...details.map(detail => `${detail.label}: ${detail.value}`)
    ].filter(Boolean).join('. ');
    announce(announcement, modifierClasses.includes('toast--error') ? 'assertive' : 'polite');

    function onActionClick(evt) {
      settings.action?.callback?.(evt, hideToast);
    }
    function hideToast(evt) {
      if (clickByManual) return;

      if (evt) {
        // if (!evt.target.closest('.toast__btn')) return;
        clickByManual = true;
      }

      toast.classList.add('is-deleting');

      closeBtn?.removeEventListener('click', hideToast);
      closeBtn = null;
      actionBtn?.removeEventListener('click', onActionClick);
      actionBtn = null;

      clearTimeout(timer);

      settings.onClose?.();

      setTimeout(() => {
        toast.remove();
        if (settings.dedupeKey) activeToasts.delete(settings.dedupeKey);
      }, 250);
    }

    if (settings.action) {
      actionBtn = $createElement('button', {
        class: 'toast__action',
        'data-action': ''
      }, {
        html: settings.action.html
      });
      if (settings.action.class) {
        actionBtn.classList.add(...settings.action.class);
      }
      toast.append(actionBtn);
      actionBtn.addEventListener('click', onActionClick);
    }

    if (settings.hideByClick) {
      closeBtn = $createElement('button', {
        class: 'toast__btn',
        'aria-label': getMessage('toast_close')
      }, {
        html: '<svg width="20" height="20"><use xlink:href="/img/symbol.svg#close"/></svg>'
      });
      toast.append(closeBtn);
      closeBtn.addEventListener('click', hideToast);
    }

    const container = containers[settings.position];
    settings.position.startsWith('top')
      ? container.el.prepend(toast)
      : container.el.append(toast);

    settings?.onShow?.();

    setTimeout(() => {
      toast.classList.add('toast-enter');
    }, 16);

    if (settings.delay) {
      toast.style.setProperty('--toast-delay', `${settings.delay}ms`);
      settings.progress && toast.classList.add('toast--progress');

      timer = setTimeout(hideToast, settings.delay);
    }

    const api = { element: toast, close: hideToast };
    if (settings.dedupeKey) activeToasts.set(settings.dedupeKey, api);
    return api;
  }

  init();

  return {
    show
  };
})();

export default Toast;
