const { writeFileSync, readdirSync } = require('fs');
const { resolve } = require('path');

const DEFAULT_LOCALE = 'en';
const DEFAULT_LOCALE_FILENAME = 'messages.json';
const LOCALES_PATH = resolve('./', 'static/_locales');

function getJSONByLocale(locale) {
  return require(
    `${LOCALES_PATH}/${locale}/${DEFAULT_LOCALE_FILENAME}`
  );
}

function isObject(item) {
  return (item && typeof item === 'object' && !Array.isArray(item));
}

function mergeDeep(target, ...sources) {
  if (!sources.length) return target;
  const source = sources.shift();
  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, {
          [key]: {}
        });
        mergeDeep(target[key], source[key]);
      } else {
        Object.assign(target, {
          [key]: source[key]
        });
      }
    }
  }
  return mergeDeep(target, ...sources);
}

const defaultLocaleJSON = getJSONByLocale(DEFAULT_LOCALE);

function autocompleteLocales(locale) {
  let localeJSON;
  try {
    // get current locale object
    localeJSON = getJSONByLocale(locale);
  } catch (error) {
    // if the current locale object is empty, then there is no local file yet and it needs to be created
    localeJSON = {};
  }

  // delete lines that are not in the default translation file
  Object.keys(localeJSON).forEach((key) => {
    // keys
    if (!Object.prototype.hasOwnProperty.call(defaultLocaleJSON, key)) {
      delete localeJSON[key];
    } else {
      // subkeys
      Object.keys(localeJSON[key]).forEach(subKey => {
        if (!Object.prototype.hasOwnProperty.call(defaultLocaleJSON[key], subKey)) {
          delete localeJSON[key][subKey];
        }
      });
    }
  });

  // merge the default language with the current locale
  const data = mergeDeep(defaultLocaleJSON, localeJSON);

  // update locale file
  const newJSON = `${JSON.stringify(data, null, 2)}\n`;
  writeFileSync(`${LOCALES_PATH}/${locale}/${DEFAULT_LOCALE_FILENAME}`, newJSON);
}



const dirents = readdirSync(LOCALES_PATH, { withFileTypes: true });
dirents
  .reduce((acc, item) => {
    if (item.isDirectory() && item.name !== DEFAULT_LOCALE) {
      acc.push(item.name);
    }
    return acc;
  }, [])
  .forEach(autocompleteLocales);
