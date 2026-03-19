# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## About

Guillermo is an Electron desktop app for managing the Signario database (Spanish Sign Language dictionary). It provides visual annotation, dictionary entry editing, and metadata management.

## Commands

```bash
npm install          # Install dependencies
make frontend        # Build frontend (table + detail views)
npm start            # Launch in development mode
make build           # Build distributable (Windows portable + Linux AppImage)
make clean           # Remove dist/
```

There are no automated tests. Verify changes by running `npm start` and manually testing the affected views.

## Architecture

The app has two Electron windows, each with its own frontend bundle:

- **Table view** (`src/table/`) — main window listing all signs
- **Detail view** (`src/detail/`) — opened per sign for annotation and editing

Each window follows the same pattern:
- `index.html` — entry point loaded by Electron
- `front.js` — React components (built by Parcel into `dist/<view>/`)
- `back.js` — used as Electron preload script; registers IPC handlers and exposes `back.*` API to the renderer via `contextBridge`

**Main process** (`src/main.js`) initialises the DB, creates windows, sets up the app menu, and handles top-level IPC (open_detail, get_db_path, set_user_name).

**Shared utilities:**
- `src/common/back.js` — `getDB()` / `mainGetDB()` / `initDB()` with SQLite migration logic
- `src/common/front.js` — `debounce` and `useLocalStorage` React hook
- `src/common/style.css` — Tailwind base with custom `@layer` definitions

**IPC pattern:** Renderer calls `back.methodName()` → preload script invokes `ipcRenderer.invoke()` → main process (or preload) handles it and returns a value.

## Database

SQLite via `better-sqlite3`. Stored at `app.getPath('userData')/signario.db`.

Schema migrations use the `user_version` pragma in `initDB()`. Current version: 2.
Tables: `signs` (pre-existing), `flags`, `signFlags`, `config`, `attachments`.

When adding a new migration: bump `user_version`, guard with `if (version < N)`, and add a `createXxx(db)` function.

## Key Dependencies

- **signotator** — local package at `../signotator` (sign language notation component used in the detail view). Changes to it require rebuilding the frontend.
- **Electron 18** — must stay compatible with `better-sqlite3` native bindings.
- **Parcel 2** — bundles frontends; built with `--no-cache --no-optimize --no-content-hash`.
- **Tailwind CSS 3** — scans both local `src/` and `../signotator/src/` for class names (see `tailwind.config.js`).

## Data & Preferences

- `app.getPath('userData')/preferencias.json` — persisted user preferences (`user_name`, `video_dir`, upload credentials)
- `credenciales_signario.example.json` — template for the publish-to-server credentials file

## Save Status Workflow (detail view)

All user-triggered saves in `src/detail/front.js` must go through the save status workflow so the "Guardando... / Todo guardado 👍" message is shown. The pattern:

```js
setSS(2);           // show "Cambios sin guardar" immediately
msgDB.clear();      // cancel any pending message clear
// ... await the save ...
setSS(3);           // show "Todo guardado 👍"
msgDB.run(() => setSS(1));  // clear message after 3.5s
```

For operations with debounced saves (e.g. `updInfo`, `updDefinition`), `setSS(2)` goes before `saveDB.run()` and `setSS(3)` goes inside the debounced callback. For immediate saves (e.g. `mvDefinition`, `setComment`), wrap the `await` call directly.

## Styling

Custom color scheme: primary = amber, secondary = violet, neutral = zinc. Signotator integration uses CSS custom properties for colors. PostCSS nesting is enabled.
