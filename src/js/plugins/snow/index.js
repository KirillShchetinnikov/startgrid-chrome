import { $createElement } from '../../utils/index';

export function letItSnow() {
  const currentDate = new Date();
  const month = currentDate.getMonth();
  const year = currentDate.getFullYear();
  const startDate = new Date(([0, 1].includes(month) ? year - 1 : year), 11, 5); // December 5
  const endDate = new Date((month === 11 ? year + 1 : year), 1, 20); // February 20

  if (currentDate >= startDate && currentDate < endDate) {
    let snowActive = localStorage.getItem('let_it_snow') === 'true';

    const button = $createElement('button', {
      class: 'circ-btn let-it-snow-btn' + (snowActive ? ' is-active' : ''),
      'aria-label': 'Let it snow'
    }, {
      html: '<svg width="20" height="20"><use xlink:href="/img/symbol.svg#snow"/></svg>'
    });

    if (month === 11) {
      button.classList.add('has-hat');
    }

    window.aside_controls.append(button);

    button.addEventListener('click', () => {
      if (snowActive) {
        localStorage.removeItem('let_it_snow');
      } else {
        localStorage.setItem('let_it_snow', true);
      }
      snowActive = !snowActive;
      button.classList.toggle('is-active', snowActive);
      toggleSnowflake();
    });

    snowActive && window.requestIdleCallback(() => {
      toggleSnowflake();
    });
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
