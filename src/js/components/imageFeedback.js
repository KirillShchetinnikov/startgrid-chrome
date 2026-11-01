import { getMessage } from '../i18n';

const active = new WeakSet();

export function imageFeedback(host) {
  let status = host.querySelector('.image-feedback');
  if (!status) {
    status = document.createElement('div');
    status.className = 'image-feedback';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    (host.querySelector('.c-upload') || host).append(status);
  }
  return status;
}

// Start synchronously so file pickers and permission requests keep the user gesture.
export function beginImageOperation(host, button, retry) {
  if (active.has(host)) return null;
  active.add(host);
  const status = imageFeedback(host);
  const label = button.textContent;
  const controls = [...host.querySelectorAll('button, input, select')]
    .filter(control => !control.disabled);
  controls.forEach(control => {
    control.disabled = true;
  });
  host.setAttribute('aria-busy', 'true');
  status.dataset.state = 'loading';
  status.textContent = getMessage('image_loading');
  button.textContent = getMessage('image_loading');
  let completed = false;
  return {
    error(message) {
      completed = true;
      status.dataset.state = 'error';
      status.textContent = message;
      if (retry) {
        const retryButton = document.createElement('button');
        retryButton.type = 'button';
        retryButton.className = 'btn btn--clear';
        retryButton.textContent = getMessage('image_retry');
        retryButton.addEventListener('click', retry);
        status.append(retryButton);
      }
    },
    success(name = '') {
      completed = true;
      status.dataset.state = 'success';
      status.textContent = [getMessage('image_ready'), name].filter(Boolean).join(' · ');
    },
    finish() {
      active.delete(host);
      host.removeAttribute('aria-busy');
      controls.forEach(control => {
        control.disabled = false;
      });
      button.textContent = label;
      if (!completed) status.replaceChildren();
    }
  };
}

export function setImagePreview(host, blob) {
  let preview = host.querySelector(':scope > .image-upload-preview');
  if (!preview) {
    preview = document.createElement('img');
    preview.className = 'image-upload-preview';
    preview.alt = '';
    host.append(preview);
  }
  if (preview.dataset.objectUrl) URL.revokeObjectURL(preview.dataset.objectUrl);
  preview.removeAttribute('src');
  delete preview.dataset.objectUrl;
  preview.hidden = !blob;
  if (blob) {
    preview.dataset.objectUrl = URL.createObjectURL(blob);
    preview.src = preview.dataset.objectUrl;
  }
}
