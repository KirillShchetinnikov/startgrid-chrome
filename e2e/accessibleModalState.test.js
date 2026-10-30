import { afterEach, describe, expect, it } from '@jest/globals';
import { makeModalAccessible } from '../src/js/accessibleModal';

const originalDocument = global.document;

class Element extends EventTarget {
  inert = false;
  classList = { contains: () => false };
  controls = [];
  querySelector() { return this.controls[0]; }
  querySelectorAll() { return this.controls; }
  contains(element) { return element === this || this.controls.includes(element); }
  focus() { global.document.activeElement = this; }
}

afterEach(() => { global.document = originalDocument; });

describe('nested modal inert state', () => {
  it('restores previous inert values while the outer modal stays open', () => {
    const app = new Element();
    const outer = new Element();
    const inner = new Element();
    const previouslyInert = new Element();
    previouslyInert.inert = true;
    global.document = { activeElement: app, body: { children: [app, outer, inner, previouslyInert] } };
    makeModalAccessible(outer);
    makeModalAccessible(inner);

    outer.dispatchEvent(new Event('gmodal:open'));
    expect(app.inert).toBe(true);
    expect(inner.inert).toBe(true);
    inner.dispatchEvent(new Event('gmodal:open'));
    expect(inner.inert).toBe(false);
    expect(outer.inert).toBe(true);
    inner.dispatchEvent(new Event('gmodal:close'));
    expect(app.inert).toBe(true);
    expect(outer.inert).toBe(false);
    expect(inner.inert).toBe(true);
    expect(previouslyInert.inert).toBe(true);
    // Cleanup can close twice; it must not release the outer modal's lock.
    inner.dispatchEvent(new Event('gmodal:close'));
    expect(app.inert).toBe(true);
    outer.dispatchEvent(new Event('gmodal:close'));
    expect(app.inert).toBe(false);
    expect(inner.inert).toBe(false);
    expect(previouslyInert.inert).toBe(true);
  });

  it('releases locks when the outer modal closes before the inner modal', () => {
    const app = new Element();
    const outer = new Element();
    const inner = new Element();
    const previouslyInert = new Element();
    previouslyInert.inert = true;
    global.document = { activeElement: app, body: { children: [app, outer, inner, previouslyInert] } };
    makeModalAccessible(outer);
    makeModalAccessible(inner);
    outer.dispatchEvent(new Event('gmodal:open'));
    inner.dispatchEvent(new Event('gmodal:open'));
    outer.dispatchEvent(new Event('gmodal:close'));
    expect(app.inert).toBe(true);
    expect(inner.inert).toBe(false);
    expect(outer.inert).toBe(true);
    inner.dispatchEvent(new Event('gmodal:close'));
    expect(app.inert).toBe(false);
    expect(outer.inert).toBe(false);
    expect(inner.inert).toBe(false);
    expect(previouslyInert.inert).toBe(true);
  });
});
