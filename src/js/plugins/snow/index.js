export function isWinterDate(currentDate = new Date()) {
  const month = currentDate.getMonth();
  return month === 11 || month === 0 || month === 1;
}

export function shouldShowSnow(
  mode,
  currentDate = new Date(),
  prefersReducedMotion = false
) {
  if (prefersReducedMotion) return false;
  return mode === 'always' || (mode === 'winter' && isWinterDate(currentDate));
}

export function initSnow(mode, {
  loadSnow = () => import(/* webpackChunkName: "snow" */'./snow.js'),
  now = () => new Date()
} = {}) {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  let destroyed = false;
  let pendingStart = null;

  const cancelPendingStart = () => {
    if (pendingStart === null) return;
    if (window.cancelIdleCallback && pendingStart.type === 'idle') {
      window.cancelIdleCallback(pendingStart.id);
    } else {
      window.clearTimeout(pendingStart.id);
    }
    pendingStart = null;
  };

  const stop = () => {
    cancelPendingStart();
    window.snowInstance?.destroy();
    window.snowInstance = null;
  };

  const startNow = async() => {
    pendingStart = null;
    if (
      destroyed
      || window.snowInstance
      || !shouldShowSnow(mode, now(), media.matches)
    ) return;

    const { default: Snow } = await loadSnow();
    if (
      destroyed
      || window.snowInstance
      || !shouldShowSnow(mode, now(), media.matches)
    ) return;
    window.snowInstance = new Snow({
      total: 30,
      image: '/img/snowflake.webp'
    });
  };

  const start = () => {
    if (
      destroyed
      || pendingStart !== null
      || window.snowInstance
      || !shouldShowSnow(mode, now(), media.matches)
    ) return;

    if (window.requestIdleCallback) {
      pendingStart = { type: 'idle', id: window.requestIdleCallback(startNow) };
    } else {
      pendingStart = { type: 'timeout', id: window.setTimeout(startNow, 0) };
    }
  };

  const handleMotionChange = () => {
    if (media.matches) stop();
    else start();
  };
  media.addEventListener('change', handleMotionChange);
  start();

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      media.removeEventListener('change', handleMotionChange);
      stop();
    }
  };
}
