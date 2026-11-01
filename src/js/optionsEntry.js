import '../css/options.css';
import { initUIInteractions } from './components/uiInteractions';
import { initializeI18n } from './i18n';

initUIInteractions();

initializeI18n()
  .catch(error => console.warn('Could not initialize StartGrid language', error))
  .finally(() => import('./options'));
