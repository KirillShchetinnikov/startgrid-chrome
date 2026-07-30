import { afterEach, describe, expect, it, jest } from '@jest/globals';

class FakeNode {
  constructor(tagName = '') {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.attributes = {};
    this.classList = { add: jest.fn() };
    this.style = { setProperty: jest.fn() };
    this._textContent = '';
    this.innerHTML = '';
  }

  set textContent(value) {
    this._textContent = String(value);
    this.children = [];
  }

  get textContent() {
    return this._textContent;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  append(...nodes) {
    nodes.forEach(node => this.appendChild(node));
  }

  prepend(node) {
    if (node?.isFragment) this.children.unshift(...node.children);
    else this.children.unshift(node);
  }

  appendChild(node) {
    if (node?.isFragment) {
      node.children.forEach(child => {
        child.parentNode = this;
        this.children.push(child);
      });
      node.children = [];
    } else {
      this.children.push(node);
      node.parentNode = this;
    }
    return node;
  }

  remove() {
    if (this.parentNode) {
      this.parentNode.children = this.parentNode.children.filter(node => node !== this);
    }
  }

  addEventListener() {}
  removeEventListener() {}
}

function findByClass(node, className) {
  if (node.attributes?.class?.split(' ').includes(className)) return node;
  for (const child of node.children || []) {
    const match = findByClass(child, className);
    if (match) return match;
  }
  return null;
}

describe('safe bookmark text rendering', () => {
  afterEach(() => {
    delete global.document;
    delete global.window;
    delete global.HTMLElement;
    jest.resetModules();
  });

  it('renders untrusted toast content as literal text without creating elements', async() => {
    const body = new FakeNode('body');
    global.document = {
      body,
      createElement: tag => new FakeNode(tag),
      createTextNode: text => {
        const node = new FakeNode('#text');
        node.textContent = text;
        return node;
      },
      createDocumentFragment: () => {
        const fragment = new FakeNode();
        fragment.isFragment = true;
        return fragment;
      }
    };
    global.browser = { i18n: { getMessage: key => key } };

    const { default: Toast } = await import('../src/js/components/toast');
    const malicious = '<img src=x onerror=alert(1)> &amp; $&';
    Toast.show({ message: malicious, hideByClick: false, delay: 0 });
    const message = findByClass(body, 'toast__message');

    expect(message.textContent).toBe(malicious);
    expect(message.children).toHaveLength(0);
  });

  it('replaces only option nodes and preserves customizable-select button content', async() => {
    global.HTMLElement = class {};
    global.window = { customElements: { define: jest.fn() } };
    global.browser = { i18n: { getMessage: key => key } };
    const {
      renderFolderOptions,
      replaceFolderOptions
    } = await import('../src/js/components/vb-select');
    const button = new FakeNode('button');
    button.append(new FakeNode('selectedcontent'));
    const oldOption = new FakeNode('option');
    const select = new FakeNode('select');
    select.append(button, oldOption);
    const documentNode = {
      createElement: tag => new FakeNode(tag),
      createDocumentFragment: () => {
        const fragment = new FakeNode();
        fragment.isFragment = true;
        return fragment;
      }
    };
    const folders = [
      {
        id: 'a',
        parentId: 'root',
        title: '<Root>',
        childrenLength: 1,
        children: [{
          id: 'b',
          parentId: 'a',
          title: 'A &amp; B',
          childrenLength: 0,
          children: []
        }]
      }
    ];

    replaceFolderOptions(select, renderFolderOptions({
      folders,
      folderId: 'b',
      bookmarkId: null,
      documentNode
    }));
    replaceFolderOptions(select, renderFolderOptions({
      folders,
      folderId: 'a',
      bookmarkId: null,
      documentNode
    }));

    expect(select.children[0]).toBe(button);
    expect(select.children.filter(node => node.tagName === 'BUTTON')).toHaveLength(1);
    expect(select.children.filter(node => node.tagName === 'OPTION')).toHaveLength(2);
    expect(button.children[0].tagName).toBe('SELECTEDCONTENT');
    expect(select.children[1].textContent).toBe(' <Root> (1)');
    expect(select.children[1].selected).toBe(true);
    expect(select.children[2].textContent).toBe('\u00a0-\u00a0 A &amp; B (0)');
    expect(select.children[2].selected).toBe(false);
  });
});
