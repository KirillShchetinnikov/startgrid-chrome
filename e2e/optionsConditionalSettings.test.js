import { readFileSync } from 'node:fs';
import { describe, expect, it } from '@jest/globals';

describe('conditional settings on the full settings page', () => {
  const source = readFileSync('src/js/options.js', 'utf8');
  const styles = readFileSync('src/css/pages/_options.css', 'utf8');

  it('keeps dependent rows visible while disabling their controls', () => {
    expect(source).toContain("row.classList.toggle('is-disabled', hidden)");
    expect(source).toContain("row.hidden = row.dataset.searchHidden === 'true'");
    expect(source).toContain('control.disabled = true');
    expect(source).not.toContain(
      "row.hidden = row.dataset.conditionHidden === 'true' || row.dataset.searchHidden === 'true'"
    );
    expect(styles).toContain('.tbl.is-disabled');
  });

  it('includes every toolbar appearance control in the dependency', () => {
    expect(source).toMatch(
      /toolbar_background_color:[\s\S]*toolbar_background_opacity:[\s\S]*toolbar_background_blur:/
    );
  });
});
