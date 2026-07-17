const fs = require('fs');
const path = require('path');

const localesRoot = path.resolve(__dirname, '../static/_locales');
const expectedLocales = [
  'de',
  'en',
  'es',
  'fr',
  'hu',
  'ja',
  'ko',
  'pl',
  'pt_BR',
  'ru',
  'zh_CN',
  'zh_TW'
];
const runtimeTokenPattern = /\$[^$\s]+\$|\{[^{}\s]+\}|https?:\/\/[^\s"<>]+|<\/?[a-z]+(?:\s[^>]*)?>/g;

function readLocale(locale) {
  return JSON.parse(
    fs.readFileSync(path.join(localesRoot, locale, 'messages.json'), 'utf8')
  );
}

function runtimeTokens(message) {
  return (message.match(runtimeTokenPattern) || []).sort();
}

describe('extension locales', () => {
  const english = readLocale('en');
  const englishKeys = Object.keys(english);

  test('includes every supported locale', () => {
    const locales = fs.readdirSync(localesRoot)
      .filter(locale => fs.statSync(path.join(localesRoot, locale)).isDirectory())
      .sort();

    expect(locales).toEqual(expectedLocales);
  });

  test.each(expectedLocales)('%s matches the canonical English structure', locale => {
    const messages = readLocale(locale);

    expect(Object.keys(messages)).toEqual(englishKeys);
    englishKeys.forEach(key => {
      expect(messages[key].message.trim()).not.toBe('');
      expect(messages[key].placeholders || {}).toEqual(
        english[key].placeholders || {}
      );
      expect(runtimeTokens(messages[key].message)).toEqual(
        runtimeTokens(english[key].message)
      );
    });
  });

  test.each(expectedLocales)('%s keeps StartGrid branding intact', locale => {
    const messages = readLocale(locale);

    expect(messages.ext_name.message).toBe('StartGrid');
    expect(messages.default_title.message).toBe('StartGrid');
    expect([...messages.ext_desc.message].length).toBeLessThanOrEqual(132);
  });
});
