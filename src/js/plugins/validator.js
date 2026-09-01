import { getMessage } from '../i18n';

export function getValidationMessageDescriptor(target) {
  const explicitKey = target?.dataset?.errorI18n;
  const validity = target?.validity || {};

  if (validity.valueMissing) {
    return { key: explicitKey || 'error_input_required' };
  }
  if (validity.rangeOverflow) {
    return { key: 'error_input_maximum', substitutions: target.max };
  }
  if (validity.rangeUnderflow) {
    return { key: 'error_input_minimum', substitutions: target.min };
  }
  if (validity.stepMismatch) {
    return { key: 'error_input_step', substitutions: target.step };
  }
  if (validity.badInput) {
    return { key: 'error_input_number' };
  }
  if (validity.typeMismatch) {
    return { key: explicitKey || 'error_input_invalid' };
  }
  return { key: explicitKey || 'error_input_invalid' };
}

export function getValidationMessage(target) {
  const { key, substitutions } = getValidationMessageDescriptor(target);
  return getMessage(key, substitutions)
    || target?.validationMessage
    || getMessage('error_input_invalid')
    || 'Invalid value';
}

export function Validator(form, options = {
  onError: null,
  onSuccess: null
}) {
  function handleInput(e) {
    const { target } = e;
    toggleErrors(target);
  }
  function handleSubmit(e) {
    e.preventDefault();

    if (!form.checkValidity()) {
      for (const item of form.elements) {
        if (!item.willValidate || item.tagName === 'BUTTON') continue;
        toggleErrors(item);
      }

      form.querySelector('.has-error')?.focus();
      options.onError?.(e);
      return;
    }

    options.onSuccess?.(e);
  }
  function handleReset() {
    form.querySelectorAll('.has-error').forEach(item => {
      item.classList.remove('has-error');
      item.removeAttribute('aria-invalid');
      item.errorNode?.remove();
      item.errorNode = null;
    });
  }
  function toggleErrors(target) {
    const isValid = target.validity.valid;
    if (!isValid) {
      if (!target.errorNode) {
        target.errorNode = Object.assign(document.createElement('div'), {
          className: 'error-hint'
        });
        target.errorNode.setAttribute('role', 'alert');
        target.after(target.errorNode);
      }
      target.errorNode.textContent = getValidationMessage(target);
      target.classList.add('has-error');
      target.setAttribute('aria-invalid', 'true');
    } else {
      target.errorNode?.remove();
      target.errorNode = null;
      target.classList.remove('has-error');
      target.removeAttribute('aria-invalid');
    }
    return isValid;
  }

  form.addEventListener('submit', handleSubmit);
  form.addEventListener('input', handleInput);
  form.addEventListener('reset', handleReset);

  return () => {
    form.removeEventListener('submit', handleSubmit);
    form.removeEventListener('input', handleInput);
    form.removeEventListener('reset', handleReset);
  };
}
