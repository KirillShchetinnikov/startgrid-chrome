export function isWinterDate(currentDate = new Date()) {
  const month = currentDate.getMonth();
  const year = currentDate.getFullYear();
  const startDate = new Date(([0, 1].includes(month) ? year - 1 : year), 11, 5); // December 5
  const endDate = new Date((month === 11 ? year + 1 : year), 1, 20); // February 20

  return currentDate >= startDate && currentDate < endDate;
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
