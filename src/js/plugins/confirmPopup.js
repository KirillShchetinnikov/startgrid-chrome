import Gmodal from 'glory-modal';
import { $createElement } from '../utils';
import { getMessage } from '../i18n';
import { makeModalAccessible } from '../accessibleModal';

function createTemplate(choices = null) {
  const containerClass = choices ? ' gmodal__container--choices' : '';
  const actionButtons = choices
    ? choices.map(choice => /* html */`<button type="button" class="btn md-ripple"
        data-popup="resolve" data-popup-value="${choice.value}">${choice.text}</button>`).join('')
    : '<button type="button" class="btn md-ripple" data-popup="resolve">Ok</button>';

  return /* html */`<div class="gmodal__container gmodal__container--popup${containerClass} has-center">
  <div class="gmodal__dialog" role="dialog" aria-modal="true" aria-labelledby="popupTitle">
    <div class="gmodal__header">
      <h2 class="gmodal__title" id="popupTitle">${getMessage('ext_name')}</h2>
      <button type="button" class="gmodal__close md-ripple" data-popup="reject" data-ripple-center>
        <svg version="1.1" width="24" height="24" viewBox="0 0 24 24" fill="#000">
          <path d="M18.984 6.422l-5.578 5.578 5.578 5.578-1.406 1.406-5.578-5.578-5.578 5.578-1.406-1.406 5.578-5.578-5.578-5.578 1.406-1.406 5.578 5.578 5.578-5.578z"></path>
        </svg>
      </button>
    </div>
    <div class="gmodal__body" id="popupBody"></div>
    <div class="gmodal__footer text-right">
      <button type="button" class="btn btn--clear md-ripple" data-popup="reject">${getMessage('btn_close')}</button>
      ${actionButtons}
    </div>
  </div>
</div>`;
}

function confirmPopup(message, { choices = null } = {}) {
  let result = false;
  const popupEl = $createElement('div',
    {
      class: 'gmodal gmodal--popup',
      id: 'popup'
    },
    {
      html: createTemplate(choices)
    }
  );
  document.body.appendChild(popupEl);

  const popupBody = document.getElementById('popupBody');
  const controls = Array.from(popupEl.querySelectorAll('[data-popup]'));
  const resolveControl = popupEl.querySelector('[data-popup="resolve"]');
  const popupInstance = new Gmodal(popupEl, {
    closeBackdrop: false
  });
  const removeAccessibility = makeModalAccessible(popupEl, {
    initialFocus: () => resolveControl
  });
  popupInstance.element.addEventListener('gmodal:open', () => {
    resolveControl.focus();
  });

  popupBody.textContent = message;
  popupInstance.open();

  return new Promise((resolve) => {
    const handleClick = function() {
      const target = this.dataset.popup;
      result = target === 'resolve'
        ? (choices ? this.dataset.popupValue : true)
        : false;
      popupInstance.close();
    };

    const closePopup = function() {
      controls.forEach(control => {
        control.removeEventListener('click', handleClick);
      });

      popupInstance.element.removeEventListener('gmodal:close', closePopup);
      resolve(result);
      result = false;
      popupInstance.destroy();
      removeAccessibility();
      popupEl.remove();
    };
    controls.forEach(control => {
      control.addEventListener('click', handleClick);
    });
    popupInstance.element.addEventListener('gmodal:close', closePopup);
  });
}

export default confirmPopup;
