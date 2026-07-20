import { readFileSync } from 'node:fs';
import { describe, expect, it, jest } from '@jest/globals';
import { waitForStablePaint } from '../src/js/pageReveal';

describe('page reveal', () => {
  it('prepares backdrop layers across two rendered frames', async () => {
    const order = [];
    const frames = [];
    const forcePaint = jest.fn(() => order.push('paint'));
    const requestFrame = jest.fn(callback => frames.push(callback));
    const afterPaint = jest.fn(callback => {
      order.push('after-paint');
      callback();
    });

    const ready = waitForStablePaint({ forcePaint, requestFrame, afterPaint });
    expect(order).toEqual(['paint']);

    order.push('frame-1');
    frames.shift()();
    order.push('frame-2');
    frames.shift()();
    await ready;

    expect(order).toEqual([
      'paint',
      'frame-1',
      'paint',
      'frame-2',
      'paint',
      'after-paint'
    ]);
  });

  it('reveals a prepainted page by fading only the curtain', () => {
    const css = readFileSync('src/css/pages/_newtab.css', 'utf8');

    expect(css).toMatch(/\.page-loading \.page-reveal\s*\{[^}]*opacity:\s*0\.999/s);
    expect(css).toMatch(/\.page-revealing \.page-reveal\s*\{[^}]*opacity:\s*0/s);
    expect(css).not.toMatch(/\.page-loading \.app/);
    expect(css).not.toMatch(/\.page-ready \.app/);
  });

  it('loads page styles before the deferred application modules', () => {
    const newtabEntry = readFileSync('src/js/newtabEntry.js', 'utf8');
    const newtabModule = readFileSync('src/js/newtab.js', 'utf8');
    const optionsEntry = readFileSync('src/js/optionsEntry.js', 'utf8');
    const optionsModule = readFileSync('src/js/options.js', 'utf8');

    expect(newtabEntry).toMatch(/^import '\.\.\/css\/newtab\.css';/);
    expect(newtabModule).not.toMatch(/import '\.\.\/css\/newtab\.css'/);
    expect(optionsEntry).toMatch(/^import '\.\.\/css\/options\.css';/);
    expect(optionsModule).not.toMatch(/import '\.\.\/css\/options\.css'/);
  });
});
