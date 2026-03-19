# Ops Journal

A macOS menu-bar app for capturing investigation notes. Lives in the menu bar, stays out of your way, and surfaces instantly via a global hotkey.

## On AI usage

This repository has been fully vibe coded. Expect code
quality to match such a standard.

As a result, contributions are currently not being
accepted, as the author hasn't yet taken the time
to understand the codebase itself.

Planning on stabilising and opening up eventually.

## Attribution

I would like to acknowledge my usage of [React Flow](https://reactflow.dev/) for the Rumour Board.

I have removed the "React Flow" attribution from the render in the Rumour Board for cleanliness, which
is [permitted](https://reactflow.dev/learn/troubleshooting/remove-attribution) as this is a non-commercial,
personal project. But am adding this section as a form of compensation for that.

i.e. ["Props to React Flow!"](https://www.youtube.com/watch?v=hwG89HH0VcM&t=211s)

## Features

- **Global hotkey** (`Cmd+Shift+J`) toggles a frameless always-on-top overlay
- **Investigations** — named containers for a set of journal entries; one is active at a time
- **Journal entries** — timestamped text notes scoped to the active investigation
- **Inline edit and delete** for existing entries
- **Persistent overlay position and size** — the overlay remembers where you left it
- **Configurable hotkey** — change the global shortcut from the Investigation Manager

## Tech Stack

| Concern | Choice |
|---|---|
| Framework | Electron 33 |
| Language | TypeScript |
| UI | React 18 + Tailwind CSS |
| Database | SQLite via `better-sqlite3` |
| Build | `electron-vite` |
| Tests | Vitest + Testing Library |

## Getting Started

**Prerequisites:** Node.js v22+, macOS

```bash
npm install
npm run dev
```

The app starts in the menu bar. No Dock icon will appear.

## Usage

| Action | How |
|---|---|
| Toggle overlay | `Cmd+Shift+J` (default) or click the tray icon |
| Submit a note | Type in the overlay, press `Enter` |
| New line in a note | `Shift+Enter` |
| Dismiss overlay | `Escape` |
| Edit an entry | Hover the entry → click the pencil icon, or double-click the text |
| Delete an entry | Hover the entry → click the trash icon |
| Manage investigations | Click the investigation name in the overlay header, or use the tray menu |
| Change the hotkey | Investigation Manager → Settings section |

## Scripts

```bash
npm run dev          # Build and launch the app (rebuilds native modules for Electron)
npm run build        # Production build
npm test             # Run tests (rebuilds native modules for Node)
npm run test:watch   # Run tests in watch mode
```

> **Note:** `npm test` rebuilds `better-sqlite3` for system Node. `npm run dev` rebuilds it for Electron. Run `npm run dev` after running tests to restore the correct binary.

## Project Structure

```
src/
├── shared/          # Shared TypeScript types (IPC contract)
├── main/            # Electron main process
│   ├── db/          # SQLite layer (migrations, investigations, entries)
│   ├── index.ts     # App entry point
│   ├── windows.ts   # Window creation and management
│   ├── tray.ts      # Menu bar tray icon
│   ├── hotkey.ts    # Global shortcut registration
│   ├── ipc-handlers.ts
│   └── settings.ts  # User settings (hotkey persistence)
├── preload/         # Context bridge (main ↔ renderer)
└── renderer/
    ├── overlay/     # Always-on-top journal overlay
    └── manager/     # Investigation Manager window
```

## Data

SQLite database is stored at `~/Library/Application Support/ops-journal/ops-journal.db`.
Settings (hotkey, overlay position) are stored in the same directory.
