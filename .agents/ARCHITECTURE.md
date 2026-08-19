# Архитектура StartGrid 1.8.0

Статус: проверяемое описание фактической реализации, не ADR
Дата сверки: 29 июля 2026 года
Целевая платформа: Chrome 105+, Manifest V3
Область сверки: отслеживаемые `src/`, `static/`, build-конфигурация и тестовые
границы; игнорируемый результат сборки не считается исходным кодом

## 1. Назначение и правила чтения

Этот файл отвечает на технический вопрос «как сейчас устроен StartGrid». Он не
заменяет продуктовую спецификацию и не утверждает новое поведение. При расхождении:

1. пользовательское поведение определяется `.agents/PRODUCT_SPEC.md`;
2. фактическое техническое состояние проверяется по перечисленным здесь файлам;
3. значимое изменение границы, формата данных или интеграции оформляется отдельным
   ADR до реализации;
4. локальный каталог `.agents/` исключён из git и не попадает в сборку или релиз.

Пути ниже даны относительно корня репозитория. Generated-каталог
`extension_chrome/` создаётся заново и не является местом для ручных исправлений.

## 2. Контекст системы

StartGrid — локальное Chrome Extension без собственного backend и учётной записи.
Его внешние владельцы данных и интеграции:

| Система | Роль | Направление данных |
| --- | --- | --- |
| Chrome Bookmarks | единственный владелец дерева папок, URL, названий и порядка | чтение и запись |
| Chrome Storage Local | полный рабочий объект настроек и служебный кэш | чтение и запись |
| Chrome Storage Sync | необязательная реплика поддерживаемых настроек | чтение и запись |
| IndexedDB расширения | локальные изображения и их метаданные | чтение и запись |
| `localStorage` расширения | локальное состояние UI и статистика использования | чтение и запись |
| Chrome Tabs/Windows | открытие ссылок и временное окно снимка | управление |
| Сетевые провайдеры | фон Bing, подсказки, favicon, изображения по URL | исходящие запросы |

Дерево закладок не копируется в собственное хранилище StartGrid. Локальные
изображения и статистика не имеют серверной реплики.

## 3. Runtime-контексты и точки входа

Расширение состоит из трёх независимых runtime-контекстов и одного раннего bundle.

| Контекст | Исходная точка входа | Выход | Ответственность |
| --- | --- | --- | --- |
| Новая вкладка | `src/js/newtabEntry.js` | `js/newtab.js`, `newtab.html`, `css/newtab.css`, lazy chunks | интерактивная сетка, поиск, навигация, быстрые настройки, модальные действия |
| Полные настройки | `src/js/optionsEntry.js` | `js/options.js`, `options.html`, `css/options.css`, lazy chunks | редактор настроек, разрешения, импорт/экспорт и сброс |
| Service worker | `src/js/background.js` | `background.js` | context menu, события Chrome, сетевые миниатюры, снимки и межконтекстные сообщения |
| Ранняя тема | `src/js/theme.js` | `js/theme.js` | применение light/dark до основного bundle, чтобы не было вспышки темы |

`newtabEntry.js` и `optionsEntry.js` сначала загружают CSS и инициализируют i18n,
затем динамически импортируют крупные orchestrator-модули. `newtab.html` и
`options.html` синхронно подключают `theme.js` в `<head>`. Это намеренная граница
первой отрисовки.

`webpack.config.js` добавляет во все entry и chunks совместимый alias:

```js
if (typeof browser === "undefined") { browser = chrome; }
```

Production-код поэтому использует Promise-oriented имя `browser`, оставаясь
исполняемым в Chrome.

## 4. Высокоуровневые компоненты

### 4.1. Новая вкладка

`src/js/newtab.js` — главный page controller. Он:

- инициализирует settings, тему, локализацию, визуальные эффекты и горячие клавиши;
- связывает `Bookmarks`, модальные окна, context menu, multiple selection,
  быстрые настройки и боковые действия;
- управляет созданием/редактированием закладки и выбранным источником миниатюры;
- открывает ссылки, окна и инкогнито-сценарии;
- завершает отложенное удаление при закрытии страницы;
- рассчитывает каскад и снимает общий экран загрузки.

DOM страницы задаётся в `src/newtab.html`. Постоянные узлы — `#bookmarks`,
`#dial_loading`, `<header>`, `#aside_controls`, `#bg`, модальное окно закладки и
`<vb-context-menu>`. Header и большинство плиток создаются во время исполнения.

### 4.2. Домен закладок

Граница состоит из трёх уровней:

1. `src/js/api/bookmark.js` — тонкий Promise-adapter к `browser.bookmarks`,
   построение дерева папок, flatten и profile-independent folder path;
2. `src/js/components/bookmarks.js` — доменный controller и renderer сетки;
3. `src/js/components/vb-bookmark/index.js` — представление одной плитки как
   customized built-in Web Component `<a is="vb-bookmark">`.

`components/bookmarks.js` отвечает за:

- выбор стартовой/текущей папки и рендер прямых детей;
- поиск по Chrome Bookmarks и четыре режима представления результатов;
- сортировку home/nested наборов;
- drag-and-drop, multiselect и перенос;
- создание, изменение, отложенное удаление и undo;
- загрузку миниатюр из IndexedDB и управление object URLs;
- очередь снимков и пакетное/автоматическое обновление;
- ограничение полноценных миниатюр прямыми детьми домашней папки.

Сортировка отделена в `src/js/bookmarkSorting.js`. Навигация и её history живут в
памяти страницы в `src/js/folderNavigation.js`.

### 4.3. Header, поиск и выбор папки

`src/js/components/vb-header/index.js` — Web Component, который объединяет:

- `vb-select-folders` для дерева папок;
- `vb-popup` для выбора поисковой системы;
- input, reset, submit и список подсказок;
- Back/Home навигацию;
- проверку и запрос optional permissions.

`src/js/searchEngines.js` содержит канонические встроенные системы, правила
нормализации, лимиты пользовательских систем и безопасную подстановку `{query}`.
`src/js/searchSuggestions.js` строит origin patterns, разбирает JSON/XML ответы,
удаляет дубли, ограничивает ответ десятью значениями и делает fallback на Google.

Поиск по закладкам выполняется в page context через Bookmarks API. Сетевые
подсказки идут через service worker, а внешний поиск — через `browser.search` или
Tabs API в зависимости от типа системы.

### 4.4. Полная страница настроек

`src/js/options.js` — page controller настроек. Он:

- инициализирует store и динамически построенный UI;
- связывает значения controls с `settings.updateKey`;
- управляет условной видимостью, поиском и навигацией по шести разделам;
- запрашивает/отзывает clipboard и host permissions;
- управляет локальным фоном в IndexedDB;
- импортирует/экспортирует backup;
- выполняет отдельные local/cache/sync reset flows.

UI строится декларативно:

- `src/js/constants/settingsList.js` — схема полей и разбиение на шесть разделов;
- `src/js/components/displaySettings.js` — HTML renderer схемы;
- `range.js`, `searchEngineSettings.js`, `keyboardShortcutSettings.js` —
  специализированные редакторы.

`settingsList.js` описывает представление и допустимые controls, но не является
источником default values. Defaults, миграция и storage semantics принадлежат
`settings.js`.

### 4.5. Быстрые настройки

`src/js/components/quickDisplaySettings.js` строит runtime-панель на новой вкладке.
Перечень сбрасываемых ключей определён отдельно в `src/js/quickSettings.js`.

Изменения разделяются на:

- style-only — пересчёт CSS custom properties через `UI.calculateStyles`;
- layout/rerender — повторный рендер сетки;
- visibility/state — обновление header, иконки и scroll lock;
- theme — ранний переключатель темы и последующий пересчёт цветов.

Во время движения range/color controls временно меняют `settings.$`; событие
`change` фиксирует значение в storage.

### 4.6. Service worker

`src/js/background.js` регистрирует обработчики:

- `runtime.onInstalled`;
- `bookmarks.onCreated/onChanged/onRemoved/onMoved`;
- `bookmarks.onImportBegan/onImportEnded`;
- `storage.onChanged`;
- `contextMenus.onClicked`;
- `action.onClicked`;
- `notifications.onClicked`;
- `runtime.onMessage`;
- `tabs.onCreated`.

Worker не хранит долгоживущее доменное состояние. Его локальное состояние — Promise
готовности i18n; остальное читается из Chrome storage/Bookmarks/IndexedDB на
запрос. Это соответствует restartable lifecycle Manifest V3, хотя длинный flow
снимка остаётся чувствителен к lifetime worker.

### 4.7. Web Components и UI primitives

| Компонент | Файл | Назначение |
| --- | --- | --- |
| `vb-bookmark` | `components/vb-bookmark/index.js` | плитка ссылки/папки, favicon, preview, overlay |
| `vb-header` | `components/vb-header/index.js` | поиск, engines, folders, Back/Home |
| `vb-select-folders` | `components/vb-select/index.js` | рекурсивный native select дерева |
| `vb-popup` | `components/vb-popup/index.js` | доступный popup container |
| `vb-context-menu` | `components/vb-context-menu/index.js` | bridge низкоуровневого context menu в page events |
| `vb-bookmarks-panel` | `components/vb-bookmarks-panel/index.js` | действия multiple selection |
| `vb-scrollup` | `components/vb-scrollup/index.js` | кнопка прокрутки вверх |

`toast.js`, `confirmPopup.js`, `ripple.js`, `validator.js` и `ui.js` — общие UI
primitives. Они зависят от DOM и i18n, но не владеют данными закладок.

## 5. Направление зависимостей и границы

Предпочтительное фактическое направление:

```text
entry/page controller
  -> domain controller / Web Components
    -> pure policy modules
    -> api adapters
      -> Chrome APIs / IndexedDB / network
```

Практические границы:

| Граница | Разрешённая ответственность | Не должна становиться владельцем |
| --- | --- | --- |
| `api/*` | вызовы платформы, минимальная адаптация ответа | DOM и пользовательские сценарии |
| pure modules | нормализация, сортировка, timing, quota, appearance | Chrome API и изменяемый DOM |
| Web Components | собственный DOM, attributes/properties и UI events | глобальные настройки и storage |
| page controllers | orchestration пользовательского flow | низкоуровневый формат Chrome API |
| `settings.js` | defaults, migrations, sanitize, local/sync lifecycle | разметка страницы настроек |
| service worker | события браузера и привилегированные операции | долговременное UI-состояние |

Фактические крупные controllers пока частично нарушают идеальную декомпозицию:
`newtab.js`, `components/bookmarks.js`, `options.js` и `background.js` одновременно
решают orchestration и детали отдельных сценариев. Это зафиксированный technical
debt, а не рекомендованный шаблон для новых функций.

## 6. Модель данных и хранение

### 6.1. Chrome Bookmarks

Source of truth — `BookmarkTreeNode` Chrome. StartGrid использует `id`,
`parentId`, `index`, `title`, `url`, `dateAdded` и `children`.

Folder ID стабилен только внутри профиля. Для Sync домашняя папка представляется
массивом сегментов `{title, index, folderType?}`:

- `createFolderSyncPath` строит путь;
- `resolveFolderSyncPath` сначала сопоставляет `folderType`, затем index/title,
  затем title;
- результат сохраняется как локальный `sync_default_folder_id`.

Дублирующиеся имена папок остаются источником неоднозначности fallback-разрешения.

### 6.2. `chrome.storage.local`

| Ключ | Владелец | Содержимое/жизненный цикл |
| --- | --- | --- |
| `settings` | `settings.js` | полный нормализованный объект настроек |
| `sync_quota_error` | `settings.js` | постоянная ошибка квоты: reason, bytes, limit, timestamp |
| `screen` | `components/bookmarks.js` | доступный размер экрана для окна снимка |
| `importingBookmarks` | `background.js` | временный guard массового импорта Chrome |
| `bingImage` | `api/bingImageDay.js` | metadata/cache изображения дня до `expiresAt` |

`clearLocalCache` сохраняет `settings`, очищает остальные local keys и
`localStorage`. IndexedDB при этом не очищается.

### 6.3. Объект настроек

`src/js/settings.js` содержит замороженный `DEFAULTS` и mutable in-memory store
`settings.$`. Публичные операции:

- `init`;
- `updateKey` / `updateAll`;
- `resetKeys`;
- `syncToStorage` / `restoreFromSync`;
- `resetLocal` / `clearLocalCache` / `resetSync`.

Порядок инициализации:

1. прочитать local `settings` и quota error;
2. применить `DEFAULTS`;
3. выполнить rename/shape migrations;
4. нормализовать известные значения;
5. если Sync включён — прочитать четыре sync records;
6. не применять cloud version при незакрытой local quota error;
7. разрешить synced folder path в локальный ID;
8. записать итог в local и in-memory store;
9. при необходимости привести sync records к текущему формату.

Default `page_cascade_duration` в текущем рабочем состоянии равен 650 мс.
Нормализация принимает любое конечное значение 200–1500 мс, поэтому существующее
допустимое значение 660 сохраняется: миграции по значению здесь нет и быть не
должно.

Поля, исключаемые из Sync: `language`, `default_folder_id`,
`sync_default_folder_id`, `enable_sync`. Локальные Blob, `localStorage` и
служебные local keys не входят в settings records.

### 6.4. `chrome.storage.sync`

`src/js/syncSettings.js` разбивает настройки на четыре records:

| Ключ storage | Группа |
| --- | --- |
| `settings` | core/appearance/bookmarks/data settings |
| `settings_search` | engine, engines, result view, navigation search settings |
| `settings_thumbnails` | правила миниатюр и интервал обновления |
| `settings_shortcuts` | keyboard shortcuts |

Перед записью `syncQuota.js` считает UTF-8 размер каждого record и
projected total. Значения лимитов берутся из Chrome API с fallback 102400/8192
байт. При превышении запись не выполняется, а local версия остаётся основной.

### 6.5. IndexedDB

Adapter: `src/js/api/imageDB.js`.

- database: `startgrid`;
- version: `1`;
- object store: `images`;
- keyPath: `id`;
- `autoIncrement: true` при отсутствии явно заданного `id`;
- отдельные индексы отсутствуют.

Запись с `id: "background"`:

```text
{ id, blob, blobThumbnail }
```

Запись миниатюры по Chrome bookmark ID может содержать:

```text
{
  id,
  blob?,
  custom?,
  source: "favicon" | "local" | "site" | "url",
  sourceUrl?,
  checkedAt?,
  contentHash?,
  etag?,
  lastModified?,
  downloadFavicon?,
  thumbnailSize?
}
```

Старое поле `faviconSize` читается как fallback и удаляется при следующем
сохранении размера. `clearThumbnails()` удаляет всё, кроме `background`.

`ImageDB` перехватывает ошибки и часто возвращает `undefined`/`false`; вызывающий
код обязан считать отсутствие результата ожидаемым error path и не уничтожать
предыдущее пользовательское изображение.

### 6.6. `localStorage`

| Ключ | Значение |
| --- | --- |
| `last_opened_folder_id` | последняя папка текущего устройства |
| `bookmark_usage_counts` | JSON map `{bookmarkId: count}` |
| `update_thumbnails` | guard активного пакетного обновления |
| `options_section` | выбранный раздел options |
| `option_tab_slide` | legacy navigation state, удаляется после миграции |

`localStorage` разделяет origin расширения между newtab/options, но не
синхронизируется и очищается local reset/cache flows.

### 6.7. Память страницы

- `settings.$` — актуальная копия настроек;
- `folderNavigation` — current folder и стек history;
- `Bookmarks.THUMBNAILS_MAP` — IndexedDB metadata плюс временные object URLs;
- `THUMBNAILS_CREATION_QUEUE` — последовательная очередь снимков;
- `bookmarksToDelete` — элементы в окне undo;
- newtab controller — multiple selection и pending modal thumbnail.

Ни одно из этих состояний нельзя считать сохранённым после закрытия страницы.

## 7. Ключевые потоки

### 7.1. Открытие новой вкладки

```text
theme.js in <head>
  -> newtabEntry: CSS + initializeI18n
  -> dynamic import newtab.js
  -> settings.init
  -> await early theme
  -> calculate styles + start background loading
  -> Bookmarks.init: navigation + lazy vb-header + grid
  -> modals/actions/shortcuts/quick settings
  -> calculate cascade
  -> stable paint
  -> remove reveal curtain
  -> optional tile cascade
```

Фон загружается параллельно и ждёт только момент начала reveal перед собственной
анимацией. `pageReveal.js` принуждает Chromium покрасить backdrop surfaces и ждёт
стабильные animation frames. При `prefers-reduced-motion` CSS и JS отключают
декоративные движения.

### 7.2. Навигация и рендер папки

`navigateToFolder` меняет in-memory ID и публикует `folderNavigate`.
`Bookmarks` получает subtree, настраивает drag policy, сортирует детей, загружает
разрешённые thumbnail records и строит плитки. После рендера публикуется
`changeFolder`; header/select/actions синхронизируют состояние.

URL hash поддерживается только как одноразовая legacy-входная точка и затем
удаляется, чтобы новая вкладка не показывала extension URL state.

### 7.3. Создание и изменение закладки

```text
modal -> Validator -> newtab controller
  -> browser.bookmarks create/update/move
  -> thumbnail operation when applicable
  -> updateFolderList DOM event
  -> background bookmarks event
  -> context menu rebuild / thumbnail cleanup / runtime notification
```

Пустой URL создаёт папку. Перемещение за пределы домашней папки удаляет её локальные
thumbnail records. События фонового worker не дублируют активный UI flow, если
новая вкладка является активной.

### 7.4. Удаление и undo

UI сначала скрывает элемент и кладёт его описание в `bookmarksToDelete`.
В течение восьмисекундного toast пользователь может отменить действие.
После закрытия toast выполняются Bookmarks API deletion и очистка изображений.
Если страница закрывается раньше, `beforeunload/pagehide` отправляет
`bookmarksToDelete` worker, который завершает удаление.

Это критический data-integrity flow: изменение порядка очистки, отправки сообщения
и undo требует отдельных тестов.

### 7.5. Поиск

- bookmarks engine: debounce 500 мс → `browser.bookmarks.search` → flat/labeled/
  path/grouped render;
- browser engine: запрос optional `search` → `browser.search.query`;
- external engine: validate template → URL encode query → current/new tab;
- suggestions: page проверяет origins → worker fetch → JSON/XML normalize →
  максимум 10 результатов → Google fallback.

Счётчик request ID отбрасывает устаревшие bookmark search и suggestion responses.

### 7.6. Миниатюры

Поддерживаются четыре source:

- `favicon`: локальный `_favicon` URL Chrome либо direct download;
- `local`: файл/clipboard Blob, автоматическое обновление запрещено;
- `site`: снимок временного окна;
- `url`: remote image с локальным кэшем.

Remote URL/favicon:

```text
page -> runtime remoteThumbnail -> worker fetch
  -> validate image content type
  -> SHA-256 + ETag/Last-Modified
  -> resize when required
  -> IndexedDB
  -> page reloads record and object URL
```

Site capture:

```text
page -> request <all_urls> -> runtime capture
  -> worker opens tiny off-screen popup
  -> waits tab complete
  -> scripting.insertCSS disables scroll
  -> resize/focus window
  -> captureVisibleTab
  -> resize Blob -> IndexedDB -> close window
```

Снимки сериализуются page-level очередью. Автообновление проверяется при рендере
домашней папки; отдельного scheduler/alarm нет.

### 7.7. Изменение настройки и Sync

```text
control -> settings.updateKey/updateAll
  -> update in-memory object
  -> storage.local
  -> if enable_sync and key is syncable
     -> sanitize -> split 4 records -> quota check -> storage.sync
```

Включение Sync с непустым cloud storage требует подтверждения перед
`restoreFromSync`. Если cloud пуст, локальная домашняя папка преобразуется в
profile-independent path и текущие настройки записываются в Sync.

### 7.8. Background image

- local file/video хранится как `blob` плюс preview в IndexedDB;
- external URL хранится в settings;
- Bing metadata кэшируется в local storage до следующего дня;
- отсутствие ресурса/permission снимает класс `has-image`, сохраняя тему;
- local MP4 создаётся как muted/autoplay/loop `<video>`.

## 8. Событийные контракты

### 8.1. DOM events внутри newtab

| Событие | Producer | Consumer/смысл |
| --- | --- | --- |
| `folderNavigate` | `folderNavigation.js` | Bookmarks загружает новую папку |
| `changeFolder` | Bookmarks после рендера | header/select/newtab обновляют состояние |
| `updateFolderList` | bookmark mutations | header перечитывает дерево папок |
| `bookmark-removed` | `vb-bookmark` disconnect | освобождение object URLs/cache |
| `vb:search`, `vb:searchreset` | `vb-header` | поиск/сброс Bookmarks и selection |
| `vb:select:change` | `vb-select` | навигация или destination selection |
| `vb:bookmarks:select` | newtab | drag plugin получает selected items |
| `vb-bookmarks-panel:action/close` | action panel | group action/закрытие |
| `vb:contextmenu:open/select` | context menu component | newtab menu orchestration |
| `thumbnails:updating/updated` | Bookmarks | UI guard пакетного обновления |

Имена и payload не типизированы и не централизованы. При изменении producer нужно
найти все consumers поиском по строке события.

### 8.2. Runtime messages page ↔ worker

| Поле request | Направление | Response |
| --- | --- | --- |
| `searchSuggestions` | header → worker | `{suggestions}` |
| `remoteThumbnail` | Bookmarks → worker | `{success, updated?, error?}` |
| `capture` | Bookmarks → worker | `"success"` или warning object |
| `showContextMenuItem` | legacy inbound handler; producer в текущем `src/` отсутствует | без значимого payload |
| `bookmarksToDelete` | page close → worker | fire-and-forget deletion |
| `bookmarksUpdated` | worker → pages | hidden newtab делает reload |

Worker возвращает `true` для сохранения async message channel. Новые messages
должны иметь ровно один ответ или явно документированный fire-and-forget path.

## 9. Chrome APIs и разрешения

### 9.1. Обязательные permissions

| Permission | Фактическое использование |
| --- | --- |
| `bookmarks` | CRUD, search, tree navigation, event listeners |
| `storage` | local/sync settings, cache и события |
| `unlimitedStorage` | запас локальной квоты для Blob/данных расширения |
| `tabs` | открытие/обновление/закрытие, active tab и capture support |
| `notifications` | системные уведомления и click handler |
| `contextMenus` | дерево «сохранить страницу» |
| `scripting` | CSS перед снимком сайта |
| `favicon` | `chrome-extension://.../_favicon/` для локального кэша Chrome |

`action`, `windows`, `runtime` и `i18n` используются как extension APIs без
одноимённых manifest permissions.

### 9.2. Optional permissions

| Permission/origin | Функция | Момент запроса |
| --- | --- | --- |
| `clipboardRead` | вставка локальной миниатюры | переключатель в options; paste использует уже выданное разрешение |
| `search` | browser default search | первая отправка через browser engine |
| provider origins | сетевые подсказки | кнопка рядом с поиском |
| `https://www.bing.com/*` | Bing image of the day | выбор Bing |
| `<all_urls>` | site capture, remote image, direct favicon | включение или действие функции |

Manifest также перечисляет конкретные origins встроенных suggestion providers.
Отказ optional permission должен оставлять закладки, тему и обычный поиск
работоспособными.

Host permissions — широкая зона риска приватности. Любое расширение списка,
фоновый запрос или перенос запроса на install-time требует product/security review.

## 10. Build, runtime и совместимость

### 10.1. Webpack

`webpack.config.js`:

- четыре entry: `newtab`, `options`, `background`, `theme`;
- `HtmlWebpackPlugin` формирует две страницы;
- `MiniCssExtractPlugin` пишет `css/[name].css`;
- `CopyWebpackPlugin` копирует весь `static/`;
- `SVGSpritemapPlugin` собирает `src/icons/**/*.svg` в `img/symbol.svg`;
- Babel обрабатывает JS вне `node_modules`;
- CSS Web Components импортируется строкой через `css-loader`;
- page CSS извлекается отдельными файлами;
- Terser минифицирует production JS без отдельного license file;
- `CleanWebpackPlugin` очищает generated output;
- source maps включены только в development.

Dynamic imports создают lazy chunks в `extension_chrome/js/`. Все chunks должны
получать alias `browser = chrome`; это обеспечивает `BannerPlugin`.

### 10.2. CSS pipeline

`postcss.config.js` применяет:

1. `postcss-import`;
2. `postcss-nesting`;
3. `autoprefixer`;
4. сортировку media queries;
5. `postcss-csso` только в production.

`src/css/newtab.css` и `src/css/options.css` — корни import graph. Theme/layout
tokens принадлежат `base/_vars.css`, runtime-настройки прокидываются через CSS
custom properties из `components/ui.js`.

### 10.3. Chrome 105+

Два независимых контракта должны совпадать:

- `static/manifest.json`: `"minimum_chrome_version": "105"`;
- `package.json` browserslist: `"chrome >= 105"`.

Manifest ограничивает установку/runtime, browserslist управляет Babel и
Autoprefixer. Изменение только одного значения создаёт ложную совместимость.
Связь защищается source-level test в `e2e/pageCascade.test.js`.

Используемые возможности, важные для target: Manifest V3 service worker,
Promise-style Chrome APIs через alias, private class fields, Web Components,
Web Animations, `structured` Blob/IndexedDB flows, `TextEncoder/TextDecoder`,
`crypto.subtle`, `Object.hasOwn` и CSS custom properties.

### 10.4. Static runtime assets

`static/manifest.json`, 12 каталогов `_locales`, PNG icons и runtime SVG/WebP
копируются без transpilation. На дату сверки каждая локаль содержит одинаковые
331 message keys; это число может расти, но множество ключей и placeholders должно
оставаться одинаковым.

## 11. Cross-cutting concerns

### 11.1. Локализация

`i18n.js` поддерживает browser locale (`auto`) и runtime-загрузку выбранного
каталога. При `auto` используется `browser.i18n`; при ручном языке каталог
загружается через `runtime.getURL`. Ошибка возвращает приложение к browser locale.

Смена языка:

- newtab перезагружается по `storage.onChanged`;
- worker переинициализирует i18n и context menu;
- options сохраняет значение и перезагружает страницу.

### 11.2. Доступность

- controls получают `aria-label`, title и native semantics;
- options navigation использует tab/tabpanel, стрелки, Home/End и mobile select;
- popup/search поддерживают клавиатуру и Escape;
- модальное окно ставит фокус в title;
- animations учитывают `prefers-reduced-motion`;
- customized built-in bookmark остаётся ссылкой, action menu — отдельной кнопкой.

Изменение Web Component или generated markup требует keyboard/focus проверки, а
не только snapshot/source assertions.

### 11.3. Темы и отрисовка

Ранняя тема отделена от полного store. `UI.calculateStyles` нормализует значения
представления и пишет custom properties сетки, плитки и toolbar. Общий reveal
скрывает промежуточную отрисовку; фон не должен повторно запускать reveal.

Каскад:

- `pageCascade.js` группирует элементы по item или фактической строке;
- указанная длительность относится ко всему каскаду;
- CSS получает per-item duration/delay;
- при reduced motion animation отключена.

### 11.4. Ошибки и устойчивость

- отсутствующая папка даёт not-found state;
- сетевые миниатюры сохраняют metadata последней проверки даже при ошибке;
- повреждённый фон снимается без падения страницы;
- Sync quota error сохраняется local и показывается постоянным toast;
- импорт settings сначала полностью парсится, затем передаётся store;
- background import guard подавляет каскад событий массового импорта.

Не все adapters бросают исключения одинаково: Chrome wrappers обычно reject,
`ImageDB` чаще логирует и возвращает пустой результат. Это нужно учитывать в
новых error paths.

### 11.5. Безопасность и приватность

- пользовательские search/suggestion templates допускают только HTTP(S) и требуют
  `{query}`;
- поисковая строка кодируется через `encodeURIComponent`;
- remote thumbnail проверяет HTTP status и `image/*`;
- локальные изображения не синхронизируются;
- внешние ссылки настроек используют `noopener noreferrer`;
- HTML локализации и template helpers являются trust boundary: новые данные,
  приходящие из сети или закладок, нельзя вставлять как trusted HTML.

## 12. Архитектурные инварианты

1. Chrome Bookmarks остаётся единственным владельцем дерева.
2. CRUD в UI изменяет реальные закладки Chrome.
3. Полные миниатюры разрешены только прямым детям настроенной домашней папки.
4. Уход элемента из домашней папки очищает его thumbnail record.
5. `background` record не удаляется операцией очистки миниатюр.
6. Local Blob и usage counts никогда не попадают в Chrome Sync.
7. Local settings записываются до попытки Sync.
8. Ошибка квоты не заменяет более новые local settings облачной версией.
9. Миграция выполняется до sanitize, а неизвестное допустимое сохранённое значение
   не переписывается без явной migration policy.
10. Default каскада для нового/сброшенного профиля — 650 мс; сохранённые 200–1500
    мс, включая 660, остаются без value migration.
11. Manifest и browserslist совместно задают Chrome 105+.
12. Optional permission запрашивается в контексте функции; отказ не ломает base
    bookmark flow.
13. Ручной язык одинаково применяется к newtab, options, worker notifications и
    context menu.
14. Декоративные animations отключаются при reduced motion.
15. Generated `extension_chrome/` никогда не редактируется как source of truth.

## 13. Риски и technical debt

### Высокая связность

Крупные модули `components/bookmarks.js`, `newtab.js`, `options.js` и
`background.js` содержат много независимых сценариев и изменяемого состояния.
Локальное изменение может затронуть рендер, storage и platform events одновременно.
Рекомендуемая эволюция — выносить pure policy/use-case functions с отдельными
тестами, не переписывая весь controller за один change.

### Неявные контракты

DOM events, runtime messages, dataset attributes и IndexedDB records не имеют
единой schema/version validation. Ошибка имени выявляется только runtime-тестом.
Новая граница должна централизовать constants и документировать payload.

### Service worker и callback flows

Снимок использует callbacks, polling, timers и внешнее окно внутри MV3 worker.
Рестарт worker или закрытие окна может оставить caller без ожидаемого ответа.
Любое изменение capture flow требует проверки timeout, cleanup окна и повторного
запуска.

### Полиморфный IndexedDB record

Background и thumbnails делят один store без index/schema validation. Метаданные
эволюционируют ad hoc, а ошибки adapter часто подавляются. При следующем изменении
формата нужна версия DB, миграция и negative tests.

### Fragmented local state

Рабочее состояние распределено между Chrome local storage и `localStorage`.
Операции reset/cache должны явно проверять, какие данные сохраняются. Добавление
нового local key требует обновить этот документ и reset tests.

### Sync folder resolution

Путь по title/index переносим между профилями, но неоднозначен при одинаковых
названиях и изменённом порядке. Нельзя синхронизировать raw Chrome ID как замену.

### Сетевые интеграции

Форматы suggestion providers и Bing не контролируются проектом. Парсеры и fallback
должны принимать пустые/изменённые ответы без блокировки поиска. `<all_urls>` —
особо чувствительное optional permission.

### Тестовый перекос

Каталог называется `e2e`, но большая часть suite — unit/source-structure tests.
Только `newtab.test.js` поднимает собранное расширение в Chromium, и его сценарий
узок. Критические mutation/undo/permissions/capture/Sync flows требуют расширения
реального browser coverage по мере изменения.

### Tooling debt

`api/storage.js` содержит устаревший комментарий Manifest V2 и смешивает
callback/Promise compatibility. HTML lint script принудительно возвращает code 0,
поэтому HTMLHint сейчас информативен, но не блокирует gate.

## 14. Стратегия тестирования

### 14.1. Фактическая структура

Jest root — `e2e/`, timeout 60 секунд, Babel transform использует `.babelrc`.
Отслеживается 21 test suite плюс `bootstrap.js`.

Типы проверок:

| Уровень | Файлы/область |
| --- | --- |
| Pure unit | sorting, cascade, reveal helpers, appearance, shortcuts, engines, suggestions, quota, sync split, favicon policy, snow |
| Mocked module/DOM | i18n, header visibility, options structure, quick reset, settings Sync |
| Source/contract assertions | manifest/browserslist/defaults, CSS theme/reveal, locale key parity |
| Browser smoke | `newtab.test.js` через Puppeteer и unpacked production build |

Puppeteer bootstrap загружает `extension_chrome/`, ждёт MV3 service worker,
вычисляет extension ID и открывает `newtab.html`. Поэтому browser suite требует
свежего `npm run build`.

### 14.2. Обязательная пирамида для изменений

1. Pure policy — unit test без Chrome/DOM.
2. Storage/API boundary — mocks с success, denial, quota/error.
3. Page integration — DOM event и state transition.
4. Собранное расширение — Chromium smoke для пользовательского сценария.
5. Ручная проверка — permissions, keyboard/focus, light/dark и узкое окно, когда
   сценарий затронут.

### 14.3. Команды gate

```sh
npm run lint
env TMPDIR=/tmp \
  PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
  npm test -- --runInBand
npm run build
```

Для browser/UI изменений после build проверяются собранные `newtab.html` и
`options.html`. Число suite/tests фиксируется в журнале QA, а не в этой
архитектурной базе.

### 14.4. Матрица риска

| Изменение | Минимальная обязательная проверка |
| --- | --- |
| default/migration setting | новый профиль, существующий профиль, reset, Sync |
| Bookmarks mutation | create/update/move/delete/undo и реальное дерево Chrome |
| thumbnail schema/source | IndexedDB old/new record, permission denial, cleanup |
| runtime message | response, runtime error, caller cleanup, worker restart risk |
| optional permission | grant и deny, base flow после отказа |
| theme/reveal/cascade | light/dark, background/no background, reduced motion |
| locale/user text | все 12 key sets/placeholders и runtime language |
| build target | manifest + browserslist + production build in target Chromium |

## 15. Карта production-модулей

### Entrypoints и pages

- `src/js/newtabEntry.js`, `src/js/newtab.js`, `src/newtab.html`;
- `src/js/optionsEntry.js`, `src/js/options.js`, `src/options.html`;
- `src/js/background.js`;
- `src/js/theme.js`.

### Platform adapters

- `api/bookmark.js` — Bookmarks API и folder sync paths;
- `api/storage.js` — local/sync wrappers;
- `api/imageDB.js` — IndexedDB;
- `api/permissions.js` — optional permissions;
- `api/bingImageDay.js` — Bing metadata/cache;
- `api/remoteThumbnail.js` — staleness и Blob hash;
- `api/faviconPreferences.js` — source/size preference policy.

### Settings, Sync и policies

- `settings.js` — defaults/migrations/store;
- `syncSettings.js`, `syncQuota.js` — records и quota;
- `constants/settingsList.js` — options schema;
- `quickSettings.js` — quick reset allowlist;
- `searchEngines.js`, `searchSuggestions.js`;
- `keyboardShortcuts.js`;
- `bookmarkSorting.js`;
- `folderNavigation.js`;
- `mainPageScroll.js`;
- `pageCascade.js`, `pageReveal.js`, `backgroundEntrance.js`;
- `tileAppearance.js`;
- `constants/index.js`.

### Domain/UI controllers

- `components/bookmarks.js`;
- `components/ui.js`;
- `components/displaySettings.js`;
- `components/quickDisplaySettings.js`;
- `components/searchEngineSettings.js`;
- `components/keyboardShortcutSettings.js`;
- `components/range.js`, `components/ripple.js`, `components/toast.js`.

### Web Components

- `components/vb-bookmark/`;
- `components/vb-header/`;
- `components/vb-select/`;
- `components/vb-popup/`;
- `components/vb-context-menu/`;
- `components/vb-bookmarks-panel/`;
- `components/vb-scrollup/`.

### Plugins/utilities

- `plugins/browserContextMenu.js`;
- `plugins/confirmPopup.js`;
- `plugins/dragSortify/`;
- `plugins/localization.js`;
- `plugins/snow/`;
- `plugins/validator.js`;
- `utils/index.js`;
- `state.js`.

### Styles/assets/runtime static

- `src/css/base/` — variables, reset/base, utilities;
- `src/css/pages/` — newtab/options layout;
- `src/css/components/` — component styles;
- `src/icons/` — source SVG spritemap;
- `static/manifest.json`;
- `static/_locales/{12 locales}/messages.json`;
- `static/icons/`, `static/img/`.

### Build/test configuration

- `webpack.config.js`, `postcss.config.js`, `.babelrc`;
- `.eslintrc`, `.stylelintrc`, `.htmlhintrc`;
- `package.json`, `package-lock.json`;
- `jest.config.js`, `e2e/bootstrap.js`, `e2e/*.test.js`.

## 16. Правила безопасной эволюции

- Не добавлять прямые Chrome API calls в pure policy modules.
- Не читать IndexedDB напрямую вне `ImageDB`.
- Не добавлять default только в UI schema: default и sanitize принадлежат
  `settings.js`.
- Для нового syncable ключа определить record group, quota behavior и local-only
  исключения.
- Для нового thumbnail field определить backward compatibility и очистку.
- Для нового runtime/DOM event записать producer, consumers и payload.
- Для нового optional integration определить grant, deny и revoke behavior.
- Для изменения Chrome target одновременно менять manifest, browserslist и test.
- Для изменения default отличать новый профиль от value migration существующего.
- Не включать `.agents/`, тестовые fixtures или generated artifacts в production
  dependency graph.

## 17. История реализации 1.8.1

Исторический Architecture/Development/Review/QA-контракт завершённого релиза
1.8.1 не входит в обязательный контекст новых задач. Его стабильные решения
интегрированы в разделы 6–14; подробная хронология доступна в истории Git.
