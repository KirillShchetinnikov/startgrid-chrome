const BACKDROP_SURFACE_SELECTOR = [
  '.bookmark',
  '.bookmark-btn',
  '.header .form-control',
  '.header .back',
  '.suggest',
  '.extension-icon',
  '.aside-controls'
].join(',');

export function forceBackdropPaint(root = document) {
  root.querySelectorAll(BACKDROP_SURFACE_SELECTOR).forEach(element => {
    const style = window.getComputedStyle(element);
    void style.backdropFilter;
    void element.offsetHeight;
  });
}

export function waitForStablePaint({
  forcePaint = forceBackdropPaint,
  requestFrame = callback => window.requestAnimationFrame(callback),
  afterPaint = callback => window.setTimeout(callback, 0)
} = {}) {
  return new Promise(resolve => {
    forcePaint();
    requestFrame(() => {
      forcePaint();
      requestFrame(() => {
        forcePaint();
        afterPaint(resolve);
      });
    });
  });
}

export function waitForOpacityTransition(element, timeout = 400) {
  if (!element) return Promise.resolve();

  return new Promise(resolve => {
    let timeoutId;
    const finish = () => {
      element.removeEventListener('transitionend', handleTransitionEnd);
      window.clearTimeout(timeoutId);
      resolve();
    };
    const handleTransitionEnd = event => {
      if (event.target === element && event.propertyName === 'opacity') finish();
    };

    element.addEventListener('transitionend', handleTransitionEnd);
    timeoutId = window.setTimeout(finish, timeout);
  });
}
