import { settings } from '../settings';
import { getMessage } from '../i18n';

export function initPerformanceModeControl(container) {
  const fieldset = document.createElement('fieldset');
  fieldset.className = 'performance-mode';
  const legend = document.createElement('legend');
  legend.textContent = getMessage('performance_mode');
  fieldset.append(legend);
  const choices = document.createElement('select');
  choices.className = 'performance-mode__choices';
  choices.id = 'performance_mode';
  choices.name = 'performance_mode';
  choices.setAttribute('aria-label', getMessage('performance_mode'));
  ['full', 'fast'].forEach(mode => {
    const option = document.createElement('option');
    option.value = mode;
    option.selected = settings.$.performance_mode === mode;
    option.textContent = getMessage(`performance_mode_${mode}`);
    choices.append(option);
  });
  const description = document.createElement('p');
  description.id = 'performance-mode-description';
  description.textContent = getMessage('performance_mode_description');
  fieldset.setAttribute('aria-describedby', description.id);
  const details = document.createElement('details');
  details.className = 'performance-mode__details';
  const summary = document.createElement('summary');
  summary.textContent = getMessage('performance_mode_details');
  details.append(summary, description);
  fieldset.append(choices, details);
  container.replaceChildren(fieldset);
  fieldset.addEventListener('change', async event => {
    if (event.target.name !== 'performance_mode') return;
    fieldset.disabled = true;
    try {
      await settings.updateKey('performance_mode', event.target.value);
      window.location.reload();
    } catch (error) {
      fieldset.disabled = false;
      choices.value = settings.$.performance_mode;
      console.warn('Could not save performance mode', error);
    }
  });
}
