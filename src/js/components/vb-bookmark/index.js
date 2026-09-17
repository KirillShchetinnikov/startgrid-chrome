// import styles from '../../../css/components/_bookmark.css';
import { $createElement, faviconURL } from '../../utils';
import { getMessage } from '../../i18n';
import { SVG_LOADER } from '../../constants';

const imageObserver = typeof IntersectionObserver === 'function'
  ? new IntersectionObserver(entries => {
    entries.forEach(({ target, isIntersecting }) => {
      if (isIntersecting) target.loadImages();
    });
  }, { rootMargin: '300px' })
  : null;

const DISPLAY_ATTRIBUTES = [
  'href', 'title', 'image', 'is-folder', 'is-custom-image', 'open-newtab',
  'thumbnail-source', 'style', 'data-title-position', 'usage-count',
  'has-title', 'has-favicon', 'has-folder-preview', 'is-dnd'
];
const STRUCTURAL_ATTRIBUTES = new Set([
  'is-folder', 'is-custom-image', 'open-newtab', 'usage-count',
  'has-title', 'has-favicon', 'has-folder-preview', 'is-dnd'
]);

class VbBookmark extends HTMLAnchorElement {
  #isRendered = false;
  #imagesLoaded = false;
  #overlayEl = null;
  #_folderChildren = [];
  #iconMap = {
    chrome: '/img/chrome.svg',
    edge: '/img/edge.svg',
    file: '/img/file-open.svg',
    default: '/img/protocol.svg'
  };

  constructor() {
    super();
  }

  connectedCallback() {
    if (!this.#isRendered) {
      this.#render();
      this.#isRendered = true;
    }
    if (!this.#imagesLoaded) {
      if (imageObserver) imageObserver.observe(this);
      else this.loadImages();
    }
  }

  disconnectedCallback() {
    imageObserver?.unobserve(this);
    // insertBefore during sorting also disconnects custom elements temporarily.
    queueMicrotask(() => {
      if (!this.isConnected) {
        document.dispatchEvent(new CustomEvent('bookmark-removed', {
          detail: { id: this.id, image: this.image }
        }));
      }
    });
  }

  loadImages() {
    if (this.#imagesLoaded || !this.isConnected) return;
    this.#imagesLoaded = true;
    imageObserver?.unobserve(this);
    const thumbnail = this.querySelector('[data-thumb]');
    if (this.image) {
      thumbnail.style.backgroundImage = `url('${this.image}')`;
    } else if (this.isFolder) {
      thumbnail.querySelectorAll('.bookmark__img--children').forEach((node, index) => {
        const child = this.folderChidlren[index];
        if (!child || child.isFolder) return;
        node.style.backgroundImage = `url('${child.image || this.#getLogoUrl(child.url)}')`;
      });
    } else {
      thumbnail.style.backgroundImage = `url('${this.#getLogoUrl(this.url)}')`;
    }
    this.#updateFavicon();
  }

  updateFrom(next) {
    const changed = DISPLAY_ATTRIBUTES.filter(name => this.getAttribute(name) !== next.getAttribute(name));
    const childrenChanged = JSON.stringify(this.folderChidlren) !== JSON.stringify(next.folderChidlren);
    const rebuild = changed.some(name => STRUCTURAL_ATTRIBUTES.has(name))
      || childrenChanged || this.searchFolderLabel !== next.searchFolderLabel;
    this.parentId = next.parentId;
    this.folderChidlren = next.folderChidlren;
    this.searchFolderLabel = next.searchFolderLabel;
    if (rebuild) this.#isRendered = false;
    changed.forEach(name => {
      const value = next.getAttribute(name);
      if (value === null) this.removeAttribute(name);
      else this.setAttribute(name, value);
    });
    if (rebuild) {
      this.#render();
      this.#isRendered = true;
    }
  }

  static get observedAttributes() {
    return [
      'href',
      'title',
      'image',
      'has-overlay',
      'thumbnail-source'
    ];
  }

  get #hasChildren() {
    return Boolean(this.#_folderChildren.length);
  }

  #toggleOverlay(isActive) {
    if (isActive) {
      this.#overlayEl = $createElement('div', {
        class: 'bookmark__overlay'
      }, {
        html: SVG_LOADER
      });
      this.appendChild(this.#overlayEl);
    } else {
      this.#overlayEl?.remove();
    }
  }

  #updateLogo() {
    if (!this.#imagesLoaded) return;
    const imageEl = this.querySelector('.bookmark__img');
    imageEl.className = 'bookmark__img bookmark__img--logo bookmark__img--sized';
    imageEl.style.backgroundImage = `url('${this.#getLogoUrl(this.url)}')`;
  }

  #updateFavicon() {
    if (this.#imagesLoaded && this.hasFavicon) {
      const faviconEl = this.querySelector('.bookmark__favicon');
      if (faviconEl) faviconEl.src = this.isFolder ? '/img/folder.svg' : this.#getFaviconUrl();
    }
  }

  attributeChangedCallback(attr, oldValue, newValue) {
    if (!this.#isRendered) return;
    if (oldValue === newValue) return;

    if (attr === 'has-overlay') this.#toggleOverlay(this.hasOverlay);
    if (attr === 'title') {
      const titleEl = this.querySelector('.bookmark__title');
      if (titleEl) {
        titleEl.textContent = newValue;
      }
    }
    if (['image', 'thumbnail-source'].includes(attr)) {
      const imageEl = this.querySelector('[data-thumb]');
      const newThumbnail = this.#createBookmarkThumbnail();
      imageEl.replaceWith(newThumbnail);
    }
    if (
      attr === 'href' &&
      !this.isFolder
    ) {
      if (!this.image) {
        this.#updateLogo();
      }
      this.#updateFavicon();
    }
  }

  #renderFolderPreview() {
    if (this.#hasChildren) {
      const fragment = document.createDocumentFragment();
      const bookmark = $createElement('div', { class: 'bookmark__img bookmark__img--children' });

      this.#_folderChildren.forEach(child => {
        const el = bookmark.cloneNode(true);
        if (child.isFolder) {
          el.classList.add('bookmark__img--folder');
        } else if (child.image) {
          el.classList.add('bookmark__img--contain');
          if (this.#imagesLoaded) el.style.backgroundImage = `url('${child.image}')`;
        } else {
          el.classList.add('bookmark__img--logo');
          if (this.#imagesLoaded) el.style.backgroundImage = `url('${this.#getLogoUrl(child.url)}')`;
        }
        fragment.appendChild(el);
      });

      return fragment;
    }
    return null;
  }

  #createContextButton() {
    return $createElement('button', {
      type: 'button',
      class: 'bookmark__action',
      'aria-label': getMessage('bookmark_context')
    });
  }

  #createUsageCount() {
    return $createElement('span', {
      class: 'bookmark__usage-count',
      title: getMessage('usage_count_label', String(this.usageCount)),
      'aria-label': getMessage('usage_count_label', String(this.usageCount))
    }, String(this.usageCount));
  }

  #createBookmarkCaption() {
    const caption = $createElement('div', {
      class: 'bookmark__caption'
    });
    if (this.hasFavicon) {
      const favicon = $createElement('img', {
        class: 'bookmark__favicon',
        width: 16,
        height: 16,
        ...(this.#imagesLoaded && { src: this.isFolder ? '/img/folder.svg' : this.#getFaviconUrl() }),
        decoding: 'async',
        alt: ''
      });
      caption.appendChild(favicon);
    }

    const title = $createElement('span', {
      class: 'bookmark__title'
    }, this.title);

    caption.appendChild(title);

    return caption;
  }

  #createBookmarkThumbnail() {
    const thumbnail = $createElement('div', { 'data-thumb': '', class: 'bookmark__img' });

    const isFavicon = this.thumbnailSource === 'favicon';
    if (this.image) {
      thumbnail.classList.add('bookmark__img--sized');
      thumbnail.classList.toggle('bookmark__img--logo', isFavicon);
      thumbnail.classList.toggle('bookmark__img--contain', !isFavicon && (this.isCustomImage || this.isFolder));
      if (this.#imagesLoaded) thumbnail.style.backgroundImage = `url('${this.image}')`;
    } else if (this.isFolder) {
      if (this.hasFolderPreview) {
        thumbnail.classList.add('bookmark__summary-folder');
        const children = this.#renderFolderPreview();
        if (children) {
          thumbnail.appendChild(children);
        } else {
          thumbnail.classList.add('bookmark__img--folder');
        }
      } else {
        thumbnail.classList.add('bookmark__img--folder');
      }
    } else {
      thumbnail.classList.add('bookmark__img--logo');
      thumbnail.classList.add('bookmark__img--sized');
      if (this.#imagesLoaded) thumbnail.style.backgroundImage = `url('${this.#getLogoUrl(this.url)}')`;
    }

    return thumbnail;
  }

  #render() {
    this.innerHTML = '';
    this.classList.add('bookmark');
    if (this.openNewTab && !this.isFolder) {
      this.setAttribute('target', '_blank');
    } else {
      this.removeAttribute('target');
    }

    this.append(
      this.#createContextButton(),
      this.#createBookmarkThumbnail()
    );

    if (this.usageCount !== null && !this.isFolder) {
      this.append(this.#createUsageCount());
    }

    if (this.hasTitle) {
      this.append(this.#createBookmarkCaption());
    }

    if (this.searchFolderLabel) {
      this.append($createElement('span', {
        class: 'bookmark__folder-path',
        title: this.searchFolderLabel
      }, this.searchFolderLabel));
    }

    if (this.isDND) {
      this.append($createElement('div', {
        class: 'dropzone-bookmark',
        'data-id': this.id
      }));
    }
    if (this.hasOverlay) this.#toggleOverlay(true);
  }

  #canDisplayLogo(url) {
    const urlLink = url ?? this.url;
    return /^https?:\/\/.+/.test(urlLink);
  }

  #getDefaultIconForUrl(url) {
    const key = url.match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase();
    return this.#iconMap[key] ?? this.#iconMap.default;
  }

  #getLogoUrl(url) {
    if (!this.#canDisplayLogo(url)) {
      return this.#getDefaultIconForUrl(url);
    }

    const configuredSize = Number.parseInt(
      getComputedStyle(this).getPropertyValue('--bookmark-thumbnail-size'),
      10
    );
    return faviconURL(url, Number.isFinite(configuredSize) ? configuredSize : 32);
  }

  #getFaviconUrl(url = this.url) {
    if (!this.#canDisplayLogo(url)) {
      return this.#getDefaultIconForUrl(url);
    }
    return faviconURL(url);
  }

  get hasOverlay() {
    return this.hasAttribute('has-overlay');
  }
  set hasOverlay(value) {
    if (value) {
      this.setAttribute('has-overlay', '');
    } else {
      this.removeAttribute('has-overlay');
    }
  }

  get isFolder() {
    return this.hasAttribute('is-folder');
  }
  set isFolder(value) {
    if (value) {
      this.setAttribute('is-folder', '');
    } else {
      this.removeAttribute('is-folder');
    }
  }

  get id() {
    return this.getAttribute('data-id');
  }
  set id(value) {
    if (value) {
      this.setAttribute('id', `vb-${value}`);
      this.setAttribute('data-id', value);
    }
  }

  get url() {
    return this.getAttribute('href');
  }
  set url(value) {
    if (value) {
      this.setAttribute('href', value);
    }
  }

  get title() {
    return this.getAttribute('title') || ``;
  }
  set title(value) {
    this.setAttribute('title', value || '');
  }

  get image() {
    return this.getAttribute('image');
  }
  set image(value) {
    if (value) {
      this.setAttribute('image', value);
    } else {
      this.removeAttribute('image', value);
    }
  }
  get thumbnailSource() {
    return this.getAttribute('thumbnail-source') || 'favicon';
  }
  set thumbnailSource(value) {
    if (value) {
      this.setAttribute('thumbnail-source', value);
    } else {
      this.removeAttribute('thumbnail-source');
    }
  }

  get thumbnailSize() {
    const value = Number.parseInt(this.style.getPropertyValue('--bookmark-thumbnail-size'), 10);
    return Number.isFinite(value) ? value : null;
  }

  get titleSize() {
    const value = Number.parseInt(this.style.getPropertyValue('--bookmark-title-size'), 10);
    return Number.isFinite(value) ? value : null;
  }
  set titleSize(value) {
    const size = Number.parseInt(value, 10);
    if (Number.isFinite(size)) {
      this.style.setProperty('--bookmark-title-size', `${size}px`);
    } else {
      this.style.removeProperty('--bookmark-title-size');
    }
  }

  get titlePosition() {
    return this.getAttribute('data-title-position') || 'inside';
  }
  set titlePosition(value) {
    if (value === 'outside') {
      this.setAttribute('data-title-position', 'outside');
    } else {
      this.setAttribute('data-title-position', 'inside');
    }
  }

  get usageCount() {
    const value = Number.parseInt(this.getAttribute('usage-count'), 10);
    return Number.isFinite(value) ? value : null;
  }
  set usageCount(value) {
    const count = Number.parseInt(value, 10);
    if (Number.isFinite(count)) {
      this.setAttribute('usage-count', String(Math.max(0, count)));
    } else {
      this.removeAttribute('usage-count');
    }
  }
  set thumbnailSize(value) {
    const size = Number.parseInt(value, 10);
    if (Number.isFinite(size)) {
      this.style.setProperty('--bookmark-thumbnail-size', `${size}px`);
    } else {
      this.style.removeProperty('--bookmark-thumbnail-size');
    }
  }

  get isCustomImage() {
    return this.hasAttribute('is-custom-image');
  }
  set isCustomImage(value) {
    if (value) {
      this.setAttribute('is-custom-image', '');
    } else {
      this.removeAttribute('is-custom-image');
    }
  }

  get openNewTab() {
    return this.hasAttribute('open-newtab');
  }
  set openNewTab(value) {
    if (value) {
      this.setAttribute('open-newtab', '');
    } else {
      this.removeAttribute('open-newtab');
    }
  }

  get hasTitle() {
    return this.hasAttribute('has-title');
  }
  set hasTitle(value) {
    if (value) {
      this.setAttribute('has-title', '');
    } else {
      this.removeAttribute('has-title');
    }
  }

  get hasFavicon() {
    return this.hasAttribute('has-favicon');
  }
  set hasFavicon(value) {
    if (value) {
      this.setAttribute('has-favicon', '');
    } else {
      this.removeAttribute('has-favicon');
    }
  }

  get isDND() {
    return this.hasAttribute('is-dnd');
  }
  set isDND(value) {
    if (value) {
      this.setAttribute('is-dnd', '');
    } else {
      this.removeAttribute('is-dnd');
    }
  }

  get hasFolderPreview() {
    return this.hasAttribute('has-folder-preview');
  }
  set hasFolderPreview(value) {
    if (value) {
      this.setAttribute('has-folder-preview', '');
    } else {
      this.removeAttribute('has-folder-preview');
    }
  }

  get folderChidlren() {
    return this.#_folderChildren;
  }
  set folderChidlren(children) {
    this.#_folderChildren = children;
  }
}

window.customElements.define('vb-bookmark', VbBookmark, { extends: 'a' });
