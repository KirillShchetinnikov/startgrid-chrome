import { getMessage } from '../i18n';

export function syncThemeSegments(root = document) {
  root.querySelectorAll('select#color_theme, select#quick_color_theme').forEach(select => {
    let group = select.nextElementSibling;
    if (!group?.classList.contains('theme-segments')) {
      group = document.createElement('fieldset');
      group.className = 'theme-segments';
      const legend = document.createElement('legend');
      legend.className = 'theme-segments__legend';
      legend.textContent = getMessage('color_theme');
      group.append(legend);
      ['light', 'os', 'dark'].forEach(value => {
        const option = [...select.options].find(item => item.value === value);
        if (!option) return;
        const label = document.createElement('label');
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = `${select.id}_segment`;
        radio.value = value;
        const caption = document.createElement('span');
        caption.textContent = option.textContent;
        radio.addEventListener('change', () => {
          if (!radio.checked) return;
          select.value = radio.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
        });
        label.append(radio, caption);
        group.append(label);
      });
      select.hidden = true;
      select.after(group);
    }
    group.querySelectorAll('input').forEach(radio => {
      radio.checked = radio.value === select.value;
      radio.disabled = select.disabled;
    });
  });
}
