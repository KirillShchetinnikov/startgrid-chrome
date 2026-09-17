import { settings } from '../settings';
import { getMessage } from '../i18n';

export function initPerformanceModeControl(container) {
  const fieldset = document.createElement('fieldset');
  fieldset.className = 'performance-mode';
  const legend = document.createElement('legend');
  legend.textContent = getMessage('performance_mode');
  fieldset.append(legend);
  const choices = document.createElement('div');
  choices.className = 'performance-mode__choices';
  ['full', 'fast'].forEach(mode => {
    const label = document.createElement('label');
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'performance_mode';
    radio.value = mode;
    radio.checked = settings.$.performance_mode === mode;
    const text = document.createElement('span');
    text.textContent = getMessage(`performance_mode_${mode}`);
    label.append(radio, text);
    choices.append(label);
  });
  const description = document.createElement('p');
  description.id = 'performance-mode-description';
  description.textContent = getMessage('performance_mode_description');
  fieldset.setAttribute('aria-describedby', description.id);
  fieldset.append(choices, description);
  container.replaceChildren(fieldset);
  fieldset.addEventListener('change', async event => {
    if (event.target.name !== 'performance_mode') return;
    fieldset.disabled = true;
    try {
      await settings.updateKey('performance_mode', event.target.value);
      window.location.reload();
    } catch (error) {
      fieldset.disabled = false;
      choices.querySelectorAll('input').forEach(input => {
        input.checked = input.value === settings.$.performance_mode;
      });
      console.warn('Could not save performance mode', error);
    }
  });
}
