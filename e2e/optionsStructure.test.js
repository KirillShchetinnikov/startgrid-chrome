import { afterEach, describe, expect, it, jest } from '@jest/globals';

describe('options page structure', () => {
  afterEach(() => {
    delete global.browser;
    jest.resetModules();
  });

  it('organizes every option in one of six stable sections', async() => {
    global.browser = {
      i18n: { getMessage: key => key }
    };

    const { default: settingsList } = await import('../src/js/constants/settingsList');
    expect(settingsList.map(section => section.id)).toEqual([
      'appearance',
      'bookmarks',
      'search',
      'thumbnails',
      'controls',
      'data'
    ]);

    const settings = settingsList.flatMap(section => {
      return section.sections.flatMap(group => group.list);
    });
    const ids = settings.map(setting => setting.id);
    expect(ids).toHaveLength(71);
    expect(new Set(ids).size).toBe(ids.length);

    const sectionFor = id => settingsList.find(section => {
      return section.sections.some(group => group.list.some(setting => setting.id === id));
    })?.id;
    expect(sectionFor('navigation_sort_by')).toBe('search');
    expect(sectionFor('open_bookmarks_newtab')).toBe('bookmarks');
    expect(sectionFor('open_search_newtab')).toBe('search');
    expect(sectionFor('show_toolbar')).toBe('appearance');
    expect(sectionFor('toolbar_background_blur')).toBe('appearance');
    expect(sectionFor('dial_background_blur')).toBe('appearance');
    expect(sectionFor('page_entrance_effect')).toBe('appearance');
    expect(sectionFor('language')).toBe('appearance');
    expect(sectionFor('show_extension_icon')).toBe('appearance');
    expect(sectionFor('keyboard_shortcuts')).toBe('controls');
    expect(sectionFor('restore_sync')).toBe('data');

    const controlsSection = settingsList.find(section => section.id === 'controls');
    expect(controlsSection.sections).toHaveLength(1);
    expect(controlsSection.sections[0].list.map(setting => setting.id))
      .toEqual(['keyboard_shortcuts']);
  });

  it('keeps reset actions in a dedicated danger group', async() => {
    global.browser = {
      i18n: { getMessage: key => key }
    };

    const { default: settingsList } = await import('../src/js/constants/settingsList');
    const dataSection = settingsList.find(section => section.id === 'data');
    const dangerGroup = dataSection.sections.find(group => group.danger);

    expect(dangerGroup.list.map(setting => setting.id)).toEqual([
      'restore_local',
      'restore_sync'
    ]);
  });
});
