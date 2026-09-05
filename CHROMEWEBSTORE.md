# Chrome Web Store Listing — StartGrid

> Last Updated: 2026-09-04

## Store Listing

**Extension Name**

StartGrid

**Short Description**

Customizable visual bookmarks on every new tab, using your existing Chrome bookmark tree.

**Detailed Description**

StartGrid replaces Chrome's new tab with a visual, customizable view of your existing bookmarks and folders.

Organize, open, edit, move, and search bookmarks without creating a separate account. Use grouped quick settings to choose the start folder, grid layout, theme, background, tile appearance, and interface controls without leaving the new tab. Settings can be backed up as a JSON file and optionally synchronized with Chrome Sync.

Open a new tab to use StartGrid. Select a folder, open a bookmark, or use the search bar. Chrome's Back and Forward buttons navigate between folders opened in StartGrid. Use the tile menu to edit a bookmark or its thumbnail, and open Settings to personalize the page.

StartGrid keeps bookmarks in Chrome's bookmark system. It stores settings and locally chosen images in Chrome storage. Network access is used only for user-enabled features such as web-page thumbnails, favicon downloads, search suggestions, and Bing's daily image.

For support and feedback, use the project issue tracker.

**Category**

Productivity

**Single Purpose**

Replace the new tab page with a customizable visual interface for Chrome bookmarks.

**Primary Language**

English

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|------------|--------|----------|
| Store Icon | 128×128 PNG | ✅ Ready | `static/icons/icon128.png` |
| Screenshot 1 | 1280×800 or 640×400 | ⬜ Not created | |
| Screenshot 2 | 1280×800 or 640×400 | ⬜ Not created | |
| Small Promo Tile | 440×280 | ⬜ Not created | |

### Screenshot Notes

Show a populated new-tab grid with the folder picker and search bar, a new-tab view with the redesigned grouped quick-settings panel open, then the full settings page demonstrating visual customization and thumbnail controls.

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| `bookmarks` | permissions | Reads and changes the user's existing bookmark tree when they browse, create, edit, move, or remove bookmarks in StartGrid. |
| `storage` | permissions | Saves StartGrid settings and the state needed to display them on new tabs. |
| `unlimitedStorage` | permissions | Stores locally selected backgrounds and bookmark thumbnail images without a small storage-quota limit. |
| `tabs` | permissions | Opens bookmarks and prepares a user-requested site thumbnail. |
| `scripting` | permissions | Temporarily prepares a page only when the user requests a site thumbnail. |
| `favicon` | permissions | Displays favicon images from Chrome's local favicon cache. |
| `notifications` | permissions | Shows status messages for user-initiated background actions. |
| `contextMenus` | permissions | Adds the optional bookmark-saving action to Chrome's context menu. |
| `clipboardRead` | optional permissions | Reads an image from the clipboard only after the user chooses to paste it as a bookmark thumbnail. |
| `search` | optional permissions | Runs a search with Chrome's selected search engine when the user chooses that provider. |
| Search-suggestion domains | optional host permissions | Fetches suggestions only after the user enables search suggestions. |
| `https://www.bing.com/*` and `https://api.bing.com/*` | optional host permissions | Loads Bing's daily image only when the user selects it as the background. |
| `<all_urls>` | optional host permissions | Creates a site thumbnail, downloads a favicon, or fetches a thumbnail image only after the user initiates the feature and grants access. |

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** No. StartGrid does not transmit data to a developer-operated server. User-requested web features communicate directly with the selected website or search provider.

### Data Use Certification

- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Privacy Policy

**Privacy Policy URL**

Not published yet — required before Chrome Web Store submission.

## Distribution

**Visibility**: Public
**Regions**: All regions

## Developer Info

**Publisher Name**

Kirill Shchetinnikov

**Contact Email**

To be provided before Chrome Web Store submission.

**Support URL / Email**

https://github.com/KirillShchetinnikov/startgrid-chrome/issues

**Homepage URL**

https://github.com/KirillShchetinnikov/startgrid-chrome

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 2.0.0 | 2026-09-05 | Improved file backup, grouped quick settings with start-folder controls, background personalization with explicit URL actions, synchronization choices, global and per-bookmark thumbnail sources, thumbnail updates, detailed error feedback, protected-page handling, and accessibility. | Draft |

## Review Notes

### Known Issues / Limitations

The privacy-policy URL, public contact email, and store screenshots must be provided before Chrome Web Store submission.
