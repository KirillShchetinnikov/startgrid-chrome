import { afterEach, describe, expect, it, jest } from '@jest/globals';

function mockBrowser({ uiLocale = 'en_US', language = 'auto' } = {}) {
  global.browser = {
    i18n: {
      getMessage: jest.fn((key, substitutions) => {
        if (key === '@@ui_locale') return uiLocale;
        return substitutions ? `${key}:${substitutions}` : key;
      })
    },
    runtime: {
      getURL: path => `chrome-extension://test/${path}`
    },
    storage: {
      local: {
        get: jest.fn().mockResolvedValue({ settings: { language } })
      }
    }
  };
}

describe('runtime language selection', () => {
  afterEach(() => {
    delete global.browser;
    delete global.fetch;
    jest.resetModules();
  });

  it('uses the browser language when automatic selection is enabled', async() => {
    mockBrowser({ uiLocale: 'pt_PT' });
    global.fetch = jest.fn();
    const { getActiveLocale, getMessage, initializeI18n } = await import('../src/js/i18n');

    await initializeI18n();

    expect(getActiveLocale()).toBe('pt_BR');
    expect(getMessage('options')).toBe('options');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('loads the selected catalog and applies Chrome placeholders', async() => {
    mockBrowser({ language: 'ru' });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async() => ({
        placeholder_input_search: {
          message: 'Искать в $engine$',
          placeholders: {
            engine: { content: '$1' }
          }
        },
        sync_quota_exceeded: {
          message: 'Использовано $used$ из $limit$',
          placeholders: {
            used: { content: '$1' },
            limit: { content: '$2' }
          }
        }
      })
    });
    const {
      getActiveLocale,
      getMessage,
      getSelectedLanguage,
      initializeI18n
    } = await import('../src/js/i18n');

    await initializeI18n();

    expect(global.fetch).toHaveBeenCalledWith(
      'chrome-extension://test/_locales/ru/messages.json'
    );
    expect(getActiveLocale()).toBe('ru');
    expect(getSelectedLanguage()).toBe('ru');
    expect(getMessage('placeholder_input_search', 'Google')).toBe('Искать в Google');
    expect(getMessage('sync_quota_exceeded', ['7 КБ', '8 КБ']))
      .toBe('Использовано 7 КБ из 8 КБ');
    expect(getMessage('missing_message')).toBe('missing_message');
  });

  it('detects language changes inside the settings record', async() => {
    mockBrowser();
    const { hasLanguageSettingChanged } = await import('../src/js/i18n');
    const changes = {
      settings: {
        oldValue: { language: 'auto' },
        newValue: { language: 'de' }
      }
    };

    expect(hasLanguageSettingChanged(changes, 'local')).toBe(true);
    expect(hasLanguageSettingChanged(changes, 'sync')).toBe(false);
  });
});
