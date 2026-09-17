import { getMessage } from '../i18n';
import { getSettingUnavailableReasons } from '../settingAvailability';
import { isSettingAllowed } from '../performanceMode';

export function describeSettingAvailability(settings, key) {
  return getSettingUnavailableReasons(settings, key)
    .map(([message, dependency]) => getMessage(message, dependency ? [getMessage(dependency)] : undefined))
    .join(' ');
}

export function syncSettingChoices(select, settings, key) {
  if (select?.tagName !== 'SELECT') return '';
  [...select.options].forEach(option => {
    const fastBlocked = !isSettingAllowed(settings, key, option.value);
    const folderBlocked = key === 'home_sort_by' && option.value === 'usage' && settings.show_last_opened_folder;
    option.disabled = fastBlocked || Boolean(folderBlocked);
    option.title = option.disabled
      ? getMessage(fastBlocked ? 'setting_unavailable_fast' : 'setting_unavailable_last_folder') : '';
  });
  return [...select.options].filter(option => option.disabled)
    .map(option => `${option.textContent}: ${option.title}`).join(' ');
}

export function explainUnavailableSetting(row, reason) {
  row.dataset.unavailableReason = reason;
  let help = row.querySelector('.setting-availability-help');
  if (!reason) {
    help?.remove();
    return;
  }
  if (!help) {
    help = document.createElement('button');
    help.type = 'button';
    help.className = 'setting-availability-help';
    help.textContent = '?';
    help.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      help.focus();
    });
    const caption = row.querySelector('.tbl__setting') || row.firstElementChild || row;
    caption.append(help);
  }
  help.disabled = false;
  help.setAttribute('aria-label', reason);
}

export function initAvailabilityTooltips(root) {
  const tooltip = document.createElement('div');
  tooltip.className = 'setting-availability-tooltip';
  tooltip.id = `setting-availability-tooltip-${root.id || 'settings'}`;
  tooltip.setAttribute('role', 'tooltip');
  tooltip.hidden = true;
  document.body.append(tooltip);
  let active;
  const hide = () => {
    active?.querySelector('.setting-availability-help')?.removeAttribute('aria-describedby');
    tooltip.hidden = true;
    active = null;
  };
  const show = event => {
    const row = event.target.closest('[data-unavailable-reason]');
    if (!row?.dataset.unavailableReason) return hide();
    if (active && active !== row) hide();
    active = row;
    tooltip.textContent = row.dataset.unavailableReason;
    tooltip.hidden = false;
    const rect = row.getBoundingClientRect();
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - tooltip.offsetWidth - 8));
    const top = Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - tooltip.offsetHeight - 8));
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    row.querySelector('.setting-availability-help')?.setAttribute('aria-describedby', tooltip.id);
  };
  root.addEventListener('mouseover', show);
  root.addEventListener('focusin', show);
  root.addEventListener('mouseleave', hide);
  root.addEventListener('focusout', hide);
  root.addEventListener('scroll', () => {
    if (active?.contains(document.activeElement)) show({ target: active });
    else hide();
  }, true);
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape') hide();
  });
}
