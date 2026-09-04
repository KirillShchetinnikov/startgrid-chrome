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
const thumbnailErrorKeys = [
  'thumbnail_error_title_favicon',
  'thumbnail_error_title_site',
  'thumbnail_error_title_url',
  'thumbnail_error_title_thumbnail',
  'thumbnail_error_site',
  'thumbnail_error_problem',
  'thumbnail_error_problem_invalid_url',
  'thumbnail_error_problem_unsupported_scheme',
  'thumbnail_error_problem_protected_page',
  'thumbnail_error_problem_permission',
  'thumbnail_error_problem_network',
  'thumbnail_error_problem_http',
  'thumbnail_error_problem_not_image',
  'thumbnail_error_problem_no_favicon',
  'thumbnail_error_problem_timeout',
  'thumbnail_error_problem_runtime',
  'thumbnail_error_problem_storage',
  'thumbnail_error_problem_capture',
  'thumbnail_error_problem_unknown',
  'thumbnail_error_reason_invalid_url',
  'thumbnail_error_reason_unsupported_scheme',
  'thumbnail_error_reason_protected_page',
  'thumbnail_error_reason_permission',
  'thumbnail_error_reason_network',
  'thumbnail_error_reason_http',
  'thumbnail_error_reason_not_image',
  'thumbnail_error_reason_no_favicon',
  'thumbnail_error_reason_timeout',
  'thumbnail_error_reason_runtime',
  'thumbnail_error_reason_storage',
  'thumbnail_error_reason_capture',
  'thumbnail_error_reason_unknown'
];

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

  test.each(expectedLocales)('%s includes lifecycle accessible names without placeholders', locale => {
    const messages = readLocale(locale);
    [
      'scroll_to_top',
      'toast_close',
      'notice_thumbnail_capture_failed'
    ].forEach(key => {
      expect(messages[key].message.trim()).not.toBe('');
      expect(messages[key].placeholders).toBeUndefined();
    });
  });

  test.each(expectedLocales)('%s includes thumbnail error details', locale => {
    const messages = readLocale(locale);

    thumbnailErrorKeys.forEach(key => expect(messages[key].message.trim()).not.toBe(''));
  });
});
