import '../css/newtab.css';
import { initUIInteractions } from './components/uiInteractions';
import { initializeI18n } from './i18n';

window.addEventListener('pageshow', async() => {
  try {
    await browser.runtime.sendMessage({ protectStartGridTab: true });
  } catch (error) {
    console.warn('Could not request StartGrid tab discard protection', error);
  }
});

initUIInteractions();

initializeI18n()
  .catch(error => console.warn('Could not initialize StartGrid language', error))
  .finally(() => import('./newtab'));
