# Локальная инструкция по проверкам StartGrid

Статус: действующая локальная инструкция
Дата последней проверки окружения: 29 июля 2026 года

## Chromium

Chromium доступен по команде:

```sh
chromium-browser
```

Абсолютный путь в текущем окружении:

```text
/usr/bin/chromium-browser
```

Для Puppeteer и браузерных тестов явно передавать этот исполняемый файл:

```sh
env \
  TMPDIR=/tmp \
  PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
  npm test -- --runInBand
```

Если конкретный инструмент использует переменную `CHROME_BIN`, задавать то же
значение:

```sh
CHROME_BIN=/usr/bin/chromium-browser
```

Не считать Chromium отсутствующим, пока не проверены `command -v
chromium-browser` и запуск с этим путём.

Подтверждённый результат от 29 июля 2026 года: полный набор с указанным
`PUPPETEER_EXECUTABLE_PATH` успешно выполнил 21 test suite и 107 тестов, включая
`e2e/newtab.test.js`.

## Основные команды проекта

```sh
npm run build
npm run lint
env TMPDIR=/tmp npm test -- --runInBand
```

Production-сборка создаётся в игнорируемом каталоге `extension_chrome/`.

## Постоянная тестовая папка расширения

Папка, из которой владелец загружает unpacked StartGrid в Chrome:

```text
C:\Users\kipik\Documents\startgrid-chrome
```

Путь из WSL:

```text
/mnt/c/Users/kipik/Documents/startgrid-chrome
```

После успешного `npm run build` запрос «обновить расширение в тестовой папке»
означает синхронизировать содержимое `extension_chrome/` именно в этот каталог.
`extension_chrome/` является промежуточным build output, а не конечной тестовой
папкой владельца.

## Порядок проверки задачи

1. Запустить узкие тесты изменённой логики.
2. Запустить полный Jest-набор с `TMPDIR=/tmp`.
3. Для `e2e/newtab.test.js` использовать `PUPPETEER_EXECUTABLE_PATH`.
4. Запустить production-сборку.
5. При изменении интерфейса проверить собранные `newtab.html` и `options.html`.
6. Зафиксировать точные команды, число пройденных тестов и все ограничения
   окружения в журнале роли.

Сбой запуска браузера из-за sandbox, display server, Snap или прав файловой системы
считается ограничением окружения только после повторной попытки с явным путём
Chromium и документирования полного текста ошибки.
