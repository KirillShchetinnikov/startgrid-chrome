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
});
