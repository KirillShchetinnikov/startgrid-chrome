import { describe, expect, it } from '@jest/globals';
import { matchesSettingsSearch } from '../src/js/settingsSearch';

describe('settings search', () => {
  it('matches every query word regardless of its order', () => {
    expect(matchesSettingsSearch(
      'вкладке поиск',
      'Открыть поиск в новой вкладке'
    )).toBe(true);
  });

  it('matches words found in different parts of the setting hierarchy', () => {
    expect(matchesSettingsSearch(
      'поиск вкладке',
      'Поиск',
      'Поведение',
      'Открывать в новой вкладке'
    )).toBe(true);
  });

  it('normalizes repeated whitespace and letter case', () => {
    expect(matchesSettingsSearch('  НОВОЙ   ВКЛАДКЕ ', 'Открывать в новой вкладке')).toBe(true);
  });

  it('does not match when any query word is absent', () => {
    expect(matchesSettingsSearch('поиск окно', 'Открыть поиск в новой вкладке')).toBe(false);
  });

  it('matches an empty query', () => {
    expect(matchesSettingsSearch('', 'Любая настройка')).toBe(true);
  });
});
