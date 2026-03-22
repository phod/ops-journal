# Ops Journal

This repository is for an application called 
"Ops Journal". It is a MacOS Electron app
that is used to assist in tracking information
during operation tasks. e.g. Managing outages,
investigating support tickets, etc. This tracking
is called an "Investigation"

The core features of this app include:
* An overlay where a user can submit data and view
  a running log of their Investigation
* A manager which shows all Investigations, as well
  as settings.
* A details screen where more detailed information
  about an Investigation can be shown.

# Dev loop

```bash
npm run dev          # Build and launch the app (rebuilds native modules for Electron)
npm run build        # Production build
npm test             # Run tests (rebuilds native modules for Node)
npm run test:watch   # Run tests in watch mode
```

> **Note:** `npm test` rebuilds `better-sqlite3` for system Node. `npm run dev` rebuilds it for Electron. Run `npm run dev` after running tests to restore the correct binary.a

# Additional notes

Ensure changes have test coverage
UI mocks should be written to `.mocks`