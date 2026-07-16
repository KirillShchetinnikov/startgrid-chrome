export function isWinterDate(currentDate = new Date()) {
  const month = currentDate.getMonth();
  return month === 11 || month === 0 || month === 1;
}

export function shouldShowSnow(mode, currentDate = new Date()) {
  return mode === 'always' || (mode === 'winter' && isWinterDate(currentDate));
}

export function initSnow(mode) {
  if (!shouldShowSnow(mode)) return;

  const start = () => toggleSnowflake();
  if (window.requestIdleCallback) {
    window.requestIdleCallback(start);
  } else {
    window.setTimeout(start, 0);
  }
}

function toggleSnowflake() {
  if (window.snowInstance) {
    window.snowInstance.destroy();
    window.snowInstance = null;
    return;
  }

  import(/* webpackChunkName: "snow" */'./snow.js').then(({ default: Snow }) => {
    window.snowInstance = new Snow({
      total: 30,
      image: '/img/snowflake.webp'
    });
  });
}
