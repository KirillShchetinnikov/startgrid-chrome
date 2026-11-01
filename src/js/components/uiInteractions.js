export function initUIInteractions() {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const animations = new Map();
  const finishAnimations = () => {
    animations.forEach(({ finish }) => finish());
  };
  reducedMotion.addEventListener('change', finishAnimations);
  new MutationObserver(finishAnimations).observe(document.documentElement, {
    attributes: true, attributeFilter: ['data-performance-mode']
  });

  document.addEventListener('click', event => {
    const summary = event.target.closest('.quick-settings__group-summary');
    if (!summary || reducedMotion.matches
      || document.documentElement.dataset.performanceMode !== 'full') return;
    const details = summary.parentElement;
    event.preventDefault();
    animations.get(details)?.finish();
    const opening = !details.open;
    const from = details.getBoundingClientRect().height;
    details.open = true;
    const to = opening ? details.getBoundingClientRect().height : summary.getBoundingClientRect().height;
    details.style.overflow = 'hidden';
    const animation = details.animate([{ height: `${from}px` }, { height: `${to}px` }], {
      duration: 160, easing: 'ease-out'
    });
    const finish = () => {
      animations.delete(details);
      animation.onfinish = null;
      animation.cancel();
      details.style.removeProperty('overflow');
      details.open = opening;
    };
    animation.onfinish = finish;
    animations.set(details, { finish });
  });

  const tooltip = document.createElement('div');
  tooltip.className = 'ui-tooltip';
  tooltip.id = 'ui-icon-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  tooltip.hidden = true;
  document.body.append(tooltip);
  let active;
  let title;
  let description;
  let timer;
  const hide = () => {
    clearTimeout(timer);
    tooltip.hidden = true;
    if (active) {
      if (title != null) active.setAttribute('title', title);
      if (description == null) active.removeAttribute('aria-describedby');
      else active.setAttribute('aria-describedby', description);
    }
    active = null;
  };
  const show = (target, delay) => {
    const button = target.closest('button[aria-label], button[title], a[aria-label]');
    if (button === active) return;
    hide();
    if (!button || button.disabled || button.matches('.setting-availability-help')
      || button.closest('[data-unavailable-reason]') || button.textContent.trim().length > 1) return;
    active = button;
    title = button.getAttribute('title');
    description = button.getAttribute('aria-describedby');
    const label = title || button.getAttribute('aria-label');
    button.removeAttribute('title');
    timer = setTimeout(() => {
      if (!button.isConnected || !button.getClientRects().length) return hide();
      (button.closest('.gmodal') || document.body).append(tooltip);
      tooltip.inert = false;
      tooltip.textContent = label;
      tooltip.hidden = false;
      const rect = button.getBoundingClientRect();
      const left = Math.max(8, Math.min(rect.left, innerWidth - tooltip.offsetWidth - 8));
      const top = rect.bottom + tooltip.offsetHeight + 8 < innerHeight
        ? rect.bottom + 4 : Math.max(8, rect.top - tooltip.offsetHeight - 4);
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
      button.setAttribute('aria-describedby', [description, tooltip.id].filter(Boolean).join(' '));
    }, delay);
  };
  document.addEventListener('pointerover', event => {
    if (!tooltip.contains(event.target)) show(event.target, 350);
  });
  document.addEventListener('pointerout', event => {
    if (active?.contains(event.target) || tooltip.contains(event.target)) {
      if (active?.contains(event.relatedTarget) || tooltip.contains(event.relatedTarget)) return;
      // Allow crossing the small gap between the button and its tooltip.
      clearTimeout(timer);
      timer = setTimeout(hide, 120);
    }
  });
  tooltip.addEventListener('pointerenter', () => clearTimeout(timer));
  document.addEventListener('focusin', event => show(event.target, 0));
  document.addEventListener('focusout', hide);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') hide();
  });
  document.addEventListener('click', hide);
  document.addEventListener('scroll', hide, true);
  window.addEventListener('resize', hide);
}
