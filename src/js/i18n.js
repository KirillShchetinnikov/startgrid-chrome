export const LANGUAGE_OPTIONS = Object.freeze([
  { value: 'auto', titleKey: 'language_browser' },
  { value: 'de', title: 'Deutsch' },
  { value: 'en', title: 'English' },
  { value: 'es', title: 'Español' },
  { value: 'fr', title: 'Français' },
  { value: 'hu', title: 'Magyar' },
  { value: 'ja', title: '日本語' },
  { value: 'ko', title: '한국어' },
  { value: 'pl', title: 'Polski' },
  { value: 'pt_BR', title: 'Português (Brasil)' },
  { value: 'ru', title: 'Русский' },
  { value: 'zh_CN', title: '简体中文' },
  { value: 'zh_TW', title: '繁體中文' }
]);

export const SUPPORTED_LANGUAGES = Object.freeze(
  LANGUAGE_OPTIONS.map(option => option.value)
);

const catalogCache = new Map();
let activeCatalog = null;
let activeLocale = 'en';
let selectedLanguage = 'auto';

function nativeMessage(name, substitutions) {
  return browser.i18n.getMessage(name, substitutions);
}

export function normalizeLocale(locale) {
  const normalized = String(locale || '').replace('-', '_');
  if (SUPPORTED_LANGUAGES.includes(normalized)) return normalized;

  const baseLocale = normalized.split('_')[0];
  if (baseLocale === 'pt') return 'pt_BR';
  if (baseLocale === 'zh') {
    return /(?:TW|HK|MO)$/i.test(normalized) ? 'zh_TW' : 'zh_CN';
  }
  return SUPPORTED_LANGUAGES.includes(baseLocale) ? baseLocale : 'en';
}

function formatMessage(entry, substitutions) {
  if (!entry?.message) return '';
  const values = Array.isArray(substitutions)
    ? substitutions
    : substitutions == null
      ? []
      : [substitutions];

  return Object.entries(entry.placeholders || {}).reduce(
    (message, [name, placeholder]) => {
      const content = placeholder.content.replace(/\$(\d+)/g, (match, index) => {
        return values[Number(index) - 1] ?? '';
      });
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return message.replace(new RegExp(`\\$${escapedName}\\$`, 'gi'), () => content);
    },
    entry.message
  );
}

async function loadCatalog(locale) {
  if (catalogCache.has(locale)) return catalogCache.get(locale);

  const response = await fetch(
    browser.runtime.getURL(`_locales/${locale}/messages.json`)
  );
  if (!response.ok) {
    throw new Error(`Could not load locale ${locale}: HTTP ${response.status}`);
  }
  const catalog = await response.json();
  catalogCache.set(locale, catalog);
  return catalog;
}

export async function initializeI18n({ language } = {}) {
  let requestedLanguage = language;
  if (requestedLanguage == null) {
    const localState = await browser.storage.local.get('settings');
    requestedLanguage = localState.settings?.language;
  }

  selectedLanguage = SUPPORTED_LANGUAGES.includes(requestedLanguage)
    ? requestedLanguage
    : 'auto';

  if (selectedLanguage === 'auto') {
    activeCatalog = null;
    activeLocale = normalizeLocale(nativeMessage('@@ui_locale'));
    return activeLocale;
  }

  try {
    activeCatalog = await loadCatalog(selectedLanguage);
    activeLocale = selectedLanguage;
  } catch (error) {
    console.warn(error);
    selectedLanguage = 'auto';
    activeCatalog = null;
    activeLocale = normalizeLocale(nativeMessage('@@ui_locale'));
  }
  return activeLocale;
}

export function getMessage(name, substitutions) {
  if (name === '@@ui_locale') return activeLocale;
  if (!activeCatalog) return nativeMessage(name, substitutions);

  const entry = activeCatalog[name];
  return entry
    ? formatMessage(entry, substitutions)
    : nativeMessage(name, substitutions);
}

export function getActiveLocale() {
  return activeLocale;
}

export function getSelectedLanguage() {
  return selectedLanguage;
}

export function hasLanguageSettingChanged(changes, areaName) {
  if (areaName !== 'local') return false;
  const settingsChange = changes?.settings;
  if (!settingsChange?.oldValue || !settingsChange?.newValue) return false;
  return settingsChange.oldValue.language !== settingsChange.newValue.language;
}
