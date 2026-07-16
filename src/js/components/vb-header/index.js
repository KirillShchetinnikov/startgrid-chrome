import '../vb-select';
import '../vb-popup';
import html from './template.html';
import { $createElement } from '../../utils';
import { getFolders } from '../../api/bookmark';
import { settings } from '../../settings';
import { containsPermissions, requestPermissions } from '../../api/permissions';
import { buildSearchUrl, getEnabledSearchEngines } from '../../searchEngines';
import {
  getCurrentFolderId,
  navigateBack,
  navigateHome,
  navigateToFolder
} from '../../folderNavigation';

class VbHeader extends HTMLElement {
  initialFolderId = null;
  folderId = null;
  backNode = null;
  homeNode = null;
  headerNode = null;
  formNode = null;
  inputNode = null;
  suggestNode = null;
  resetNode = null;
  selectNode = null;
  vbPopup = null;
  vbPopupBtn = null;
  vbPopupContent = null;
  vbPopupActive = false;
  searchEngines = [];
  engineNodes = [];
  engineIndex = 0;
  prevEngineIndex = 0;
  inputValue = '';

  suggestIndex = -1;
  suggestList = [];
  abortController = null;

  connectedCallback() {
    this.#render();
  }

  disconnectedCallback() {
    this.#dettachEvents();
  }

  async #render() {
    this.insertAdjacentHTML('afterbegin', html);
    // initial folder id
    this.initialFolderId = this.getAttribute('initial-folder-id');
    // current folder id
    this.folderId = this.getAttribute('folder-id');

    this.headerNode = this.querySelector('.header');
    // form nodes
    this.formNode = this.querySelector('form');
    this.inputNode = this.querySelector('input');
    this.permSuggestionsNode = this.querySelector('#searchSuggestions');
    this.resetNode = this.querySelector('#searchReset');
    this.buttonSubmitNode = this.querySelector('#searchSubmit');
    // get vb-select-folders component
    this.selectNode = this.querySelector('vb-select-folders');
    this.selectNode.setAttribute('folder-id', this.folderId);
    // get folders list for select component
    this.selectNode.folders = await getFolders();

    // get vb-popup
    this.vbPopup = this.querySelector('vb-popup');
    this.vbPopup.setAttribute('label', browser.i18n.getMessage('toggle_search_popup'));
    this.vbPopupBtn = this.vbPopup.popupTriger;
    this.vbPopupSlotBtn = this.vbPopup.querySelector('[slot="button"]');
    this.vbPopupContent = this.vbPopup.querySelector('[slot="content"]');

    this.#setSearchEngines();
    this.#attachEvents();
    this.hashchange();

    if (settings.$.search_autofocus) {
      this.inputNode.focus();
    }

    this.permSuggestionsNode.dataset.tooltip = browser.i18n.getMessage('search_suggestions_permission_tooltip');
    this.#suggestPermissionButtonVisibility();
  }

  get isBookmarksEngine() {
    return settings.$.search_engine === 'bookmarks';
  }

  get isBrowserEngine() {
    return settings.$.search_engine === 'browser';
  }

  set engine(engineId) {
    this.engineNodes[this.prevEngineIndex]?.classList.remove('is-active');
    const engineObject = this.searchEngines.find((searchEngine, index) => {
      if (searchEngine.id === engineId) {
        this.engineIndex = index;
        return true;
      }
      return false;
    });
    if (!engineObject) return;
    this.engineNodes[this.engineIndex].classList.add('is-active');

    const symbol = engineObject.kind === 'bookmarks'
      ? 'bookmarks'
      : engineObject.kind === 'browser' ? 'web_search' : 'search';
    this.vbPopupSlotBtn.innerHTML = /* html */`<svg width="16" height="16"><use xlink:href="/img/symbol.svg#${symbol}"/></svg>`;

    const placeholderEngine = engineObject.kind === 'bookmarks'
      ? browser.i18n.getMessage('placeholder_input_search_bookmarks')
      : engineObject.title;

    settings
      .updateKey('search_engine', engineId)
      .then(() => {
        this.inputNode.placeholder = engineObject.kind !== 'browser'
          ? browser.i18n.getMessage('placeholder_input_search', [placeholderEngine])
          : browser.i18n.getMessage('search');

        this.buttonSubmitNode.hidden = this.isBookmarksEngine;

        if (!this.isBookmarksEngine) {
          if (!this.suggestNode) {
            this.suggestNode = $createElement('div', {
              id: 'suggest',
              class: 'suggest',
              hidden: 'hidden'
            });
            this.formNode.append(this.suggestNode);
          }
        } else {
          this.suggestNode?.remove();
          this.suggestNode = null;
        }

        // when switching engines
        // if search is active, we will display the actual results when the bookmark search returns
        // if we leave the search for bookmarks on the engine, then we need to reset the search results by bookmarks
        if (this.inputNode.value.trim()) {
          this.dispatchEvent(
            new CustomEvent('vb:search', {
              detail: {
                search: this.inputNode.value,
                isBookmarksEngine: this.isBookmarksEngine
              },
              bubbles: true,
              cancelable: true
            })
          );
        }

        this.hashchange();
      });
  }

  async #suggestPermissionButtonVisibility() {
    const shouldCheckPermission = this.isBookmarksEngine;

    if (shouldCheckPermission) {
      this.permSuggestionsNode.hidden = true;
      return;
    }

    const hasSuggestPermission = await containsPermissions({
      origins: ['https://google.com/*']
    });

    this.permSuggestionsNode.hidden = hasSuggestPermission;

    this.inputNode.classList.toggle('lg-offset', !this.permSuggestionsNode.hidden);
  }

  #setSearchEngines() {
    this.searchEngines = getEnabledSearchEngines(
      settings.$.search_engines,
      key => browser.i18n.getMessage(key)
    );
    this.vbPopupContent.replaceChildren(...this.searchEngines.map(engine => {
      const className = 'header__engine-item' + (
        engine.id === settings.$.search_engine ? ' is-active' : ''
      );
      return $createElement('div', {
        class: className,
        'data-engine': engine.id
      }, engine.title);
    }));
    this.engineNodes = Array.from(this.vbPopupContent.children);
    this.engine = this.searchEngines.some(engine => engine.id === settings.$.search_engine)
      ? settings.$.search_engine
      : this.searchEngines[0].id;
  }

  #attachEvents() {
    this.handleInput = this.handleInput.bind(this);
    this.inputNode.addEventListener('input', this.handleInput);
    this.permSuggestionsNode.addEventListener('click', this.handleSuggestPermission);

    this.handleReset = this.handleReset.bind(this);
    this.resetNode.addEventListener('click', this.handleReset);

    this.handleSelectHash = this.handleSelectHash.bind(this);
    this.selectNode.addEventListener('vb:select:change', this.handleSelectHash);

    this.handleSubmit = this.handleSubmit.bind(this);
    this.formNode.addEventListener('submit', this.handleSubmit);

    this.handleClickEngine = this.handleClickEngine.bind(this);
    this.vbPopupContent.addEventListener('click', this.handleClickEngine);

    this.handleKeydownEngine = this.handleKeydownEngine.bind(this);
    this.vbPopup.addEventListener('keydown', this.handleKeydownEngine);

    this.handlePopupState = this.handlePopupState.bind(this);
    this.vbPopup.addEventListener('vb:popup:open', this.handlePopupState);
    this.vbPopup.addEventListener('vb:popup:close', this.handlePopupState);

    // listen for folder change event
    this.handleHash = this.hashchange.bind(this);
    document.addEventListener('changeFolder', this.handleHash);

    // listen for folders update event
    this.handleUpdateFolders = this.handleUpdateFolders.bind(this);
    document.addEventListener('updateFolderList', this.handleUpdateFolders);

    this.handleKeydown = this.handleKeydown.bind(this);
    this.inputNode.addEventListener('keydown', this.handleKeydown);

    this.handleClickSuggest = this.handleClickSuggest.bind(this);
    this.formNode.addEventListener('click', this.handleClickSuggest);

    this.handleDocumentKeydown = this.handleDocumentKeydown.bind(this);
    document.addEventListener('keydown', this.handleDocumentKeydown);

    this.handleDocClick = this.handleDocClick.bind(this);
    document.addEventListener('click', this.handleDocClick);
  }

  #dettachEvents() {
    this.inputNode.removeEventListener('input', this.handleInput);
    this.permSuggestionsNode.removeEventListener('click', this.handleSuggestPermission);
    this.resetNode.removeEventListener('click', this.handleReset);
    this.selectNode.removeEventListener('vb:select:change', this.handleSelectHash);
    this.formNode.removeEventListener('submit', this.handleSubmit);
    this.vbPopupContent.removeEventListener('click', this.handleClickEngine);
    this.vbPopup.removeEventListener('keydown', this.handleKeydownEngine);
    this.vbPopup.removeEventListener('vb:popup:open', this.handlePopupState);
    this.vbPopup.removeEventListener('vb:popup:close', this.handlePopupState);
    this.inputNode.removeEventListener('keydown', this.handleKeydown);
    this.formNode.removeEventListener('click', this.handleClickSuggest);
    document.removeEventListener('changeFolder', this.handleHash);
    document.removeEventListener('updateFolderList', this.handleUpdateFolders);
    document.removeEventListener('keydown', this.handleEscape);
    document.removeEventListener('click', this.handleDocClick);
  }

  handleSuggestPermission = async() => {
    if (!this.isBookmarksEngine) {
      const permissions = await requestPermissions({ origins: ['https://google.com/*'] });

      if (permissions) {
        this.#suggestPermissionButtonVisibility();
      }
    }
  };

  async handleUpdateFolders() {
    if (this.selectNode) {
      this.selectNode.folders = await getFolders();
    }
  }

  handlePopupState({ type }) {
    this.vbPopupActive = type === 'vb:popup:open';
  }

  hashchange() {
    const folderId = getCurrentFolderId() || this.initialFolderId;

    const isNestedFolder = folderId !== this.initialFolderId;
    const isBookmarkSearch = this.isBookmarksEngine && Boolean(this.inputNode.value.trim());

    if (isNestedFolder) {
      if (!this.backNode) {
        const backLabel = browser.i18n.getMessage('history_back');
        this.backNode = $createElement(
          'button',
          {
            class: 'back',
            'aria-label': backLabel,
            title: backLabel
          },
          {
            html: `<svg width="20" height="20"><use xlink:href="/img/symbol.svg#arrow_back"/></svg>`
          }
        );
        this.handleBack = this.handleBack.bind(this);
        this.headerNode.insertAdjacentElement('afterbegin', this.backNode);
        this.backNode.addEventListener('click', this.handleBack);
      }
    } else if (this.backNode) {
      this.backNode.removeEventListener('click', this.handleBack);
      this.backNode.remove();
      this.backNode = null;
    }

    if (isNestedFolder || isBookmarkSearch) {
      if (!this.homeNode) {
        const homeLabel = browser.i18n.getMessage('default_folder_home');
        this.homeNode = $createElement(
          'button',
          {
            class: 'back',
            'aria-label': homeLabel,
            title: homeLabel
          },
          {
            html: `<svg width="20" height="20"><use xlink:href="/img/symbol.svg#home"/></svg>`
          }
        );
        this.handleHome = this.handleHome.bind(this);
        if (this.backNode) {
          this.backNode.insertAdjacentElement('afterend', this.homeNode);
        } else {
          this.headerNode.insertAdjacentElement('afterbegin', this.homeNode);
        }
        this.homeNode.addEventListener('click', this.handleHome);
      }
    } else if (this.homeNode) {
      this.homeNode.removeEventListener('click', this.handleHome);
      this.homeNode.remove();
      this.homeNode = null;
    }

    if (this.backNode && this.homeNode) {
      this.backNode.insertAdjacentElement('afterend', this.homeNode);
    }

    this.selectNode.setAttribute('folder-id', folderId);
  }

  handleKeydownEngine(e) {
    switch (e.code) {
      case 'ArrowUp':
        e.preventDefault();
        this.prevEngineIndex = this.engineIndex;
        this.engineIndex = this.engineIndex - 1;
        if (this.engineIndex < 0) {
          this.engineIndex = this.engineNodes.length - 1;
        }
        this.engine = this.searchEngines[this.engineIndex].id;
        break;
      case 'ArrowDown':
        e.preventDefault();
        this.prevEngineIndex = this.engineIndex;
        this.engineIndex = (this.engineIndex + 1) % this.engineNodes.length;
        this.engine = this.searchEngines[this.engineIndex].id;
        break;
      case 'Enter':
      case 'Space':
        if (this.vbPopupActive) {
          this.inputNode.focus();
        }
        break;
    }
  }

  async handleSubmit(e) {
    e.preventDefault();
    if (this.isBookmarksEngine || !this.inputNode.value.trim()) {
      this.inputNode.focus();
      return;
    }
    if (this.isBrowserEngine) {
      const searchPermission = await requestPermissions({ permissions: ['search'] });

      if (searchPermission) {
        browser.search.query({
          text: this.inputNode.value.trim(),
          disposition: settings.$.open_link_newtab ? 'NEW_TAB' : 'CURRENT_TAB'
        });
      }
      return;
    }

    const engine = this.searchEngines.find(item => item.id === settings.$.search_engine);
    const url = buildSearchUrl(engine?.url, this.inputNode.value.trim());
    if (!url) return;

    const openSearch = settings.$.open_link_newtab
      ? browser.tabs.create
      : browser.tabs.update;
    openSearch({ url });
  }

  handleClickEngine(e) {
    const target = e.target.closest('.header__engine-item');
    if (!target) return;

    this.prevEngineIndex = this.engineNodes.findIndex(engineNode => {
      return engineNode.classList.contains('is-active');
    });
    this.engine = target.dataset.engine;
    this.#suggestPermissionButtonVisibility();
    this.vbPopup.hide();
    this.inputNode.focus();
  }

  handleSelectHash(e) {
    navigateToFolder(e.detail);
  }

  handleBack() {
    navigateBack(this.initialFolderId);
  }

  handleHome() {
    const forceNavigation = this.isBookmarksEngine && Boolean(this.inputNode.value.trim());
    if (forceNavigation) this.clearBookmarkSearch();
    navigateHome(settings.defaultFolderId, forceNavigation);
  }

  clearBookmarkSearch() {
    if (!this.isBookmarksEngine || !this.inputNode.value) return;

    this.inputNode.value = '';
    this.inputValue = '';
    this.closeSuggest();
    this.resetNode.classList.remove('is-show');
    this.hashchange();
  }

  handleReset() {
    const isBookmarksEngine = this.isBookmarksEngine;
    this.clearBookmarkSearch();

    if (isBookmarksEngine) {
      this.inputNode.dispatchEvent(
        new CustomEvent('vb:searchreset', {
          bubbles: true,
          cancelable: true
        })
      );
    } else {
      this.inputNode.value = '';
      this.inputValue = '';
      this.closeSuggest();
      this.resetNode.classList.remove('is-show');
    }

    this.inputNode.focus();
  }

  handleInput(e) {
    const search = e.target.value;
    if (this.isBookmarksEngine) {
      this.dispatchEvent(
        new CustomEvent('vb:search', {
          detail: {
            search,
            isBookmarksEngine: this.isBookmarksEngine
          },
          bubbles: true,
          cancelable: true
        })
      );
    } else {
      this.inputValue = e.target.value;
      this.permSuggestionsNode.hidden && this.suggestSearch(e.target.value.trim());
    }

    this.resetNode.classList.toggle('is-show', search.trim().length);
    this.hashchange();
  }

  handleDocumentKeydown(e) {
    if (e.code === 'Escape' && this.suggestList.length) {
      this.closeSuggest();
    } else if (
      e.code === 'Slash' &&
      this.getActiveElement()?.tagName !== 'INPUT'
    ) {
      e.preventDefault();
      this.inputNode.focus();
    }
  }

  handleDocClick(e) {
    if (!e.target.closest('#searchForm')) {
      this.closeSuggest();
    }
  }

  handleKeydown(e) {
    if (!this.suggestList.length) return true;

    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowDown':
        this.gotoSuggest(e);
        break;
      case 'Enter': this.handleEnterSuggest(e); break;
    }
  }

  getActiveElement() {
    let el = document.activeElement;
    while (el && el.shadowRoot && el.shadowRoot.activeElement) {
      el = el.shadowRoot.activeElement;
    }
    return el;
  }

  async suggestSearch(query) {
    this.suggestIndex = -1;
    if (this.abortController) {
      this.abortController.abort();
    }
    if (query.length > 0) {
      try {
        this.suggestList = await this.suggestRequest(query);
      } catch (error) {}
    } else {
      this.suggestList = [];
      this.suggestIndex = -1;
    }

    this.suggestNode.innerHTML = this.suggestList.map((suggest, index) => {
      return `<div data-suggest="${index}">${suggest}</div>`;
    }).join('');
    this.suggestNode.hidden = !this.suggestList.length;
  }

  suggestRequest(query) {
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    return fetch(`https://google.com/complete/search?output=toolbar&q=${query}`, { signal })
      .then(response => {
        if (response.ok) {
          return response.text();
        }
        throw new Error(response.statusText);
      })
      .then(str => {
        const xmlDOM = new DOMParser().parseFromString(str, 'text/xml');
        const suggestions = Array
          .from(xmlDOM.querySelectorAll('[data]'))
          .map(suggestion => suggestion.getAttribute('data'));

        return suggestions;
      });
  }

  gotoSuggest(e) {
    e.preventDefault();
    const suggestedList = Array.from(this.suggestNode.querySelectorAll('[data-suggest]'));
    const prevIndex = this.suggestIndex;

    this.suggestIndex = e.key === 'ArrowUp'
      ? this.suggestIndex - 1
      : this.suggestIndex + 1;

    if (this.suggestIndex > this.suggestList.length - 1) {
      this.suggestIndex = -1;
    } else if (this.suggestIndex < -1) {
      this.suggestIndex = this.suggestList.length - 1;
    }

    this.inputNode.value = this.suggestIndex < 0
      ? this.inputValue
      : this.suggestList[this.suggestIndex];

    suggestedList[prevIndex]?.classList.remove('is-active');
    suggestedList[this.suggestIndex]?.classList.add('is-active');
  }

  handleEnterSuggest(e) {
    if (this.suggestIndex > -1) {
      e.preventDefault();
      this.inputNode.value = this.suggestList[this.suggestIndex];
      this.inputNode.focus();
      this.handleSubmit(new Event('submit'));
    }
    this.closeSuggest();
  }

  handleClickSuggest(e) {
    const target = e.target.closest('[data-suggest]');
    if (!target) return true;

    e.preventDefault();
    const selectedIndex = parseInt(target.dataset.suggest);
    this.inputNode.value = this.suggestList[selectedIndex];
    this.inputNode.focus();
    this.handleSubmit(new Event('submit'));
    this.closeSuggest();
  }

  closeSuggest() {
    if (!this.suggestNode || this.suggestNode.hidden) {
      return;
    }

    this.suggestNode.hidden = true;
    this.suggestList = [];
    this.suggestIndex = -1;
  }
}

window.customElements.define('vb-header', VbHeader);
