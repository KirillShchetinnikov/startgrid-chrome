import { initUIInteractions } from './components/uiInteractions';
import '../css/newtab.css';
import { initializeI18n } from './i18n';

initUIInteractions();

initializeI18n()
  .catch(error => console.warn('Could not initialize StartGrid language', error))
  .finally(() => import('./newtab'));
