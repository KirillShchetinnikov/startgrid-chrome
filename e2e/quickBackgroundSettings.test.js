import { readFileSync } from 'node:fs';
import { describe, expect, it } from '@jest/globals';

describe('quick background settings', () => {
  it('offers every background mode and applies it immediately', () => {
    const source = readFileSync('src/js/components/quickDisplaySettings.js', 'utf8');

    expect(source).toMatch(/id="quick_background_image"\s+data-setting="background_image"/);
    [
      'background_noimage',
      'background_color',
      'background_external',
      'background_local',
      'background_bing'
    ].forEach(value => {
      expect(source).toContain(`option value="${value}"`);
    });
    expect(source).toMatch(/key === 'background_image'[\s\S]*?await UI\.setBG\(\)/);
    expect(source).toContain('data-setting="background_color"');
    expect(source).toContain('data-quick-background-external-set');
    expect(source).toContain('data-quick-background-external-remove');
    expect(source).toContain('data-quick-background-upload');
    expect(source).toContain('data-quick-background-remove');
    expect(source).not.toContain('data-quick-background-preview');
    expect(source).toMatch(/key === 'background_color'[\s\S]*?await UI\.setBG\(\)/);
  });

  it('uses explicit URL actions and previews the URL background only in full settings', () => {
    const quickSource = readFileSync('src/js/components/quickDisplaySettings.js', 'utf8');
    const displaySource = readFileSync('src/js/components/displaySettings.js', 'utf8');
    const optionsSource = readFileSync('src/js/options.js', 'utf8');

    expect(quickSource).toContain('background_external_note');
    expect(quickSource).toContain('handleExternalBackgroundSave');
    expect(displaySource).toContain('set_background_external');
    expect(displaySource).toContain('delete_background_external');
    expect(displaySource).toContain('preview_external_image');
    expect(displaySource).toContain('delete_local_background');
    expect(displaySource).toContain("getMessage('btn_open')");
    expect(quickSource).toContain("message('btn_open')");
    expect(quickSource).toContain('$filePicker(BACKGROUND_FILE_PICKER_OPTIONS, panel)');
    expect(quickSource).toContain("event.target.closest('.gmodal, .gmodal-backdrop')");
    expect(quickSource).toContain('data-quick-background-confirmation');
    expect(quickSource).toContain('showBackgroundRemovalConfirmation');
    expect(quickSource).toContain("data-quick-background-external-remove]').disabled");
    expect(quickSource).toContain("data-quick-background-remove]').disabled");
    expect(displaySource).toContain('delete_local_background" class="btn btn--clear md-ripple" disabled');
    expect(optionsSource).toContain('syncExternalBackgroundControls');
  });

  it('removes the previous background resource before applying the next one', () => {
    const source = readFileSync('src/js/components/ui.js', 'utf8');

    expect(source).toMatch(/bgEl\.replaceChildren\(\);[\s\S]*?bgEl\.classList\.remove\('is-visible'\)/);
    expect(source).toContain("document.querySelectorAll('.bing-info').forEach(node => node.remove())");
  });
});
