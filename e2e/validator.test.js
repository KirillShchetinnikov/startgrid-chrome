import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

describe('form validation messages', () => {
  afterEach(() => {
    delete global.browser;
    jest.resetModules();
  });

  it('shows the configured maximum instead of translating an undefined key', async() => {
    global.browser = {
      i18n: {
        getMessage: jest.fn((key, substitution) => {
          return substitution === undefined ? key : `${key}:${substitution}`;
        })
      }
    };
    const { getValidationMessage } = await import('../src/js/plugins/validator');
    const target = {
      dataset: {},
      max: '128',
      min: '16',
      step: '4',
      validity: {
        valid: false,
        rangeOverflow: true
      }
    };

    expect(getValidationMessage(target)).toBe('error_input_maximum:128');
    expect(browser.i18n.getMessage).toHaveBeenCalledWith('error_input_maximum', '128');
    expect(browser.i18n.getMessage).not.toHaveBeenCalledWith(undefined);
  });

  it('covers every native numeric validation failure with a message key', async() => {
    const { getValidationMessageDescriptor } = await import('../src/js/plugins/validator');
    const target = {
      dataset: {},
      max: '128',
      min: '16',
      step: '4'
    };
    const cases = [
      ['rangeOverflow', 'error_input_maximum'],
      ['rangeUnderflow', 'error_input_minimum'],
      ['stepMismatch', 'error_input_step'],
      ['badInput', 'error_input_number'],
      ['valueMissing', 'error_input_required'],
      ['typeMismatch', 'error_input_invalid']
    ];

    cases.forEach(([validityKey, expectedKey]) => {
      target.validity = { [validityKey]: true };
      expect(getValidationMessageDescriptor(target).key).toBe(expectedKey);
    });
  });

  it('allows every whole-pixel individual thumbnail size', () => {
    const newtabHtml = readFileSync('src/newtab.html', 'utf8');
    const thumbnailSizeInput = newtabHtml.match(
      /<input type="number"[^>]+id="thumbnailImageSize"[^>]+>/
    )?.[0];

    expect(thumbnailSizeInput).toContain('step="1"');
  });
});
