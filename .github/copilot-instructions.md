# GitHub Copilot Instructions for Guillermo

## Project Overview

Guillermo is a desktop application for managing the Signario database (Spanish Sign Language dictionary). It's built with Electron and provides visual annotation features, dictionary entry editing, and metadata management.

## Technology Stack

- **Framework**: Electron 18.x
- **Frontend**: React 18.x
- **Build Tools**: Parcel (bundler), electron-builder (packaging)
- **Styling**: Tailwind CSS with typography plugin
- **Database**: better-sqlite3
- **Custom Component**: Signotator (local dependency for sign language notation)

## Project Structure

```
src/
├── main.js           # Electron main process
├── merge_db.js       # Database merge utilities
├── common/
│   ├── front.js      # Shared frontend utilities (debounce, useLocalStorage)
│   ├── back.js       # Shared backend/DB utilities (getDB, initDB)
│   └── style.css     # Tailwind base styles with custom layers
├── table/            # Table view window
│   ├── front.js      # React components for table/list view
│   ├── back.js       # IPC handlers for table operations
│   └── index.html    # Entry point
└── detail/           # Detail view window
    ├── front.js      # React components for detail view
    ├── back.js       # IPC handlers for detail operations
    └── index.html    # Entry point
```

## Development Workflow

### Installation & Setup
```bash
npm install              # Install dependencies
```

### Building & Running
```bash
make frontend           # Build frontend assets (table + detail views)
npm start               # Launch in development mode
make build              # Build distributable app (Windows + Linux)
```

### Build Targets
- **table**: Table view built from `src/table/index.html`
- **detail**: Detail view built from `src/detail/index.html`
- Outputs to `dist/table/` and `dist/detail/` respectively

## Coding Conventions

### JavaScript/React
- Use modern ES6+ syntax with imports/exports
- React hooks (useState, useEffect, useRef, custom hooks)
- Functional components preferred
- IPC communication pattern: frontend calls `back.methodName()` to communicate with Electron main process

### File Organization
- **front.js**: React components and frontend logic
- **back.js**: IPC handlers and backend logic
- **index.html**: Entry point with minimal HTML structure

### Styling
- Use Tailwind CSS utility classes
- PostCSS with nesting support
- Configuration in `tailwind.config.js` and `.postcssrc`
- Common styles in `src/common/style.css` using Tailwind's `@layer` directive
- Custom color scheme: primary (amber), secondary (violet), gray (zinc)
- Signotator integration with custom color variables

### Database
- SQLite3 via better-sqlite3
- Database initialization in `src/common/back.js` using `initDB()`
- Database migrations using `user_version` pragma
- Export/import functionality in main.js
- Database stored in `app.getPath('userData')/signario.db`

## Important Notes

1. **Signotator Dependency**: The project depends on a local `signotator` package (sign language notation component) located at `../signotator`

2. **Multilingual**: Project includes Spanish language strings - maintain bilingual documentation where applicable

3. **Build Process**: 
   - Frontend must be built before packaging
   - Parcel builds with `--no-cache` and `--no-optimize` flags in development
   - Production builds set `NODE_ENV=production`
   - Tailwind processes classes from both local and signotator source files

4. **IPC Pattern**: Communication between frontend and backend uses Electron's IPC:
   - Frontend: `window.back.methodName()` or direct `back.methodName()`
   - Backend: Exposed via `contextBridge` or preload scripts
   - Common utilities in `src/common/front.js` (debounce, useLocalStorage)

5. **Data Persistence**: 
   - User preferences stored in `app.getPath('userData')/preferencias.json`
   - Database in `app.getPath('userData')/signario.db`
   - LocalStorage used for UI state (e.g., table pagination)

6. **React Patterns**:
   - Custom hooks: `useLocalStorage` for persistent state
   - Utility functions: `debounce` for delayed execution
   - All components use React 18 modern APIs

## Testing & Validation

- Test both table and detail views when making changes
- Verify database operations work correctly
- Check that video directory management functions properly
- Test export/import/merge database functionality

## Dependencies to Watch

- Keep Electron version compatible with better-sqlite3
- Signotator is a local dependency - changes may require coordination
- React and React-DOM versions must match

## Common Tasks

### Adding a New Feature
1. Determine if it's table-view or detail-view specific
2. Add React components in appropriate `front.js`
3. Add IPC handlers in corresponding `back.js` if backend access needed
4. Update UI in `index.html` if structural changes needed
5. Rebuild with `make frontend` and test with `npm start`

### Modifying Database Schema
1. Update initialization in `src/common/back.js`
2. Consider migration path for existing databases
3. Update export/import logic in `src/main.js` if needed

### Styling Changes
1. Use Tailwind utilities in React components
2. Rebuild frontend to apply changes
3. Custom styles go in component files using PostCSS nesting if needed
