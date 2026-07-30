import { $createElement } from '../../utils';
import { getMessage } from '../../i18n';

export function replaceFolderOptions(selectNode, options) {
  Array.from(selectNode.children)
    .filter(node => node.tagName === 'OPTION')
    .forEach(node => node.remove());
  selectNode.append(options);
}

export function renderFolderOptions({
  folders,
  folderId,
  bookmarkId,
  documentNode = document
}) {
  const options = documentNode.createDocumentFragment();
  const processTree = (tree, pass = 0) => {
    for (const folder of tree) {
      if (
        bookmarkId !== folder.id
        && folder.parentId !== bookmarkId
      ) {
        const prefix = pass > 0 ? `\u00a0${'-'.repeat(pass)}\u00a0` : '';
        const option = documentNode.createElement('option');
        option.value = folder.id;
        option.selected = folder.id === folderId;
        option.textContent = `${prefix} ${folder.title} (${folder.childrenLength})`;
        options.append(option);

        if (folder.children.length) processTree(folder.children, pass + 1);
      }
    }
  };
  processTree(folders);
  return options;
}

class VbSelectFolders extends HTMLElement {
  connectedCallback() {
    this.selectNode = $createElement('select', {
      id: this.selectId,
      name: 'folder',
      class: 'vb-select-folders form-control',
      'aria-label': getMessage('select_folder')
    }, $createElement('button',
      {},
      $createElement('selectedcontent')
    ));

    this.insertAdjacentElement('afterbegin', this.selectNode);
    this.#attachEvents();
  }

  disconnectedCallback() {
    this.#dettachEvents();
  }

  static get observedAttributes() {
    return [
      'folder-id',
      'parent-folder-id',
      'bookmark-id'
    ];
  }

  attributeChangedCallback() {
    this.#getAttributes();
  }

  #getAttributes() {
    this.folderId = this.getAttribute('folder-id');
    this.parentFolderId = this.getAttribute('parent-folder-id') ?? null;
    this.bookmarkId = this.getAttribute('bookmark-id') ?? null;
  }

  get selectId() {
    return this.getAttribute('select-id');
  }

  set folders(arr) {
    if (!this.selectNode) {
      throw new Error('custom item must be in the DOM');
    }

    replaceFolderOptions(this.selectNode, this.#renderOptions(arr));
  }

  set value(value) {
    setTimeout(() => {
      this.selectNode.value = value;
    }, 0);
  }

  get value() {
    return this.selectNode.value;
  }

  set disabled(value) {
    this.selectNode.disabled = value;
  }

  get disabled() {
    return this.selectNode.disabled;
  }

  #renderOptions(folders) {
    const folderId = this.parentFolderId ? this.parentFolderId : this.folderId;
    return renderFolderOptions({
      folders,
      folderId,
      bookmarkId: this.bookmarkId
    });
  }

  #attachEvents() {
    this.handleSelect = this.#onSelect.bind(this);
    this.handleHashChange = this.#hashchange.bind(this);

    this.selectNode.addEventListener('change', this.handleSelect);
    document.addEventListener('changeFolder', this.handleHashChange);
  }

  #dettachEvents() {
    this.selectNode.removeEventListener('change', this.handleSelect);
    document.removeEventListener('changeFolder', this.handleHashChange);
  }

  #hashchange(e) {
    this.value = e?.detail?.folderId;
  }

  #onSelect(e) {
    this.dispatchEvent(
      new CustomEvent('vb:select:change', {
        detail: e.target.value,
        bubbles: true,
        cancelable: true
      })
    );
  }
}

window.customElements.define('vb-select-folders', VbSelectFolders);
