# Rumour Board — Handover Document

Original spec: `.specs/rumour-board-spec.md`
Original plan: `.specs/rumour-board-plan.md`

## What's done

The core feature is implemented and working. Users can open the "Rumour Board" tab from any investigation's detail view (both the standalone details window and the manager-embedded view), create boards, drag journal entries onto the canvas, add text boxes, upload images, draw arrows between nodes, pan/zoom, and switch between multiple boards. All state auto-saves to SQLite.

### Database (migration 7)

Three new tables in `src/main/db/migrations.ts`:

- `rumour_boards` — one per investigation, stores name and viewport
- `board_nodes` — entry/textbox/image nodes with position and serialised data
- `board_edges` — arrows between nodes

Boards are associated to investigations via FK with `ON DELETE CASCADE`.

### Backend

| File | Role |
|------|------|
| `src/main/db/rumour-boards.ts` | DB repository: list, create, delete, rename, getState, saveState |
| `src/main/ipc-handlers.ts` | `board:*` IPC handlers registered alongside existing handlers |
| `src/preload/index.ts` | IPC bridges exposed on `window.electronAPI` |
| `src/shared/ipc-types.ts` | `ElectronAPI` extended with 7 board methods |
| `src/shared/board-types.ts` | Shared types: `RumourBoard`, `BoardNode`, `BoardEdge`, `BoardState`, `BoardViewport` |

`saveBoardState` uses a SQLite transaction that wipes and re-inserts all nodes/edges for a board — simple and correct for boards of typical size.

### Frontend

All new files live under `src/renderer/details/components/board/`:

| File | Role |
|------|------|
| `RumourBoardView.tsx` | Top-level composition: manages boards list, wires hooks to canvas/sidebar |
| `BoardCanvas.tsx` | React Flow wrapper; handles drag-drop from sidebar, node/edge/viewport events |
| `BoardSelector.tsx` | Tab bar: create, delete (with confirm dialog), double-click rename |
| `BoardSidebar.tsx` | Filtered entry list (draggable cards), text box / upload / screenshot buttons |
| `nodes/EntryNode.tsx` | Renders a journal entry; uses type colours from `entry-types.ts`; shows `[deleted entry]` if entry missing |
| `nodes/TextBoxNode.tsx` | Editable textarea node |
| `nodes/ImageNode.tsx` | Loads image via `getEntryImage` IPC on mount |
| `hooks/useBoardState.ts` | Loads board state from IPC; manages React Flow nodes/edges/viewport; hydrates entry nodes with live entry data |
| `hooks/useBoardAutoSave.ts` | 1-second debounce save; also saves synchronously on unmount if dirty |

The board tab is integrated into both:
- `src/renderer/details/App.tsx` — standalone details window
- `src/renderer/manager/components/InvestigationDetails.tsx` — manager-embedded view

## What's not done

The following items from the spec and implementation plan are outstanding:

### Export integration
- **Board export as image**: The IPC handler `board:saveImage` is wired up and saves images (reusing the existing `saveImage` utility), but there is no UI button to trigger a standalone PNG export of the canvas. React Flow's `getViewport`/`toImage` (or a library like `html-to-image`) would be needed client-side, then the data URL posted via `saveBoardImage` IPC.
- **Export view integration**: `ExportView.tsx` does not yet have a "Boards" section. The plan describes checkboxes per board, with boards rendered as images and embedded into markdown/PDF exports.

### Overlay shortcut
- The plan describes a "Rumour Board" button in the overlay (`src/renderer/overlay/App.tsx`) that opens the details window directly on the board tab. This is not implemented. It would involve calling `openDetails(investigationId)` then sending a `navigate:board` IPC event.

### Image node drag-from-sidebar
- Images uploaded via the sidebar buttons are added at a fixed `{x: 200, y: 200}` position on the canvas. A future improvement would be to drop them at the current canvas centre or let the user choose a position.

### Node resizing
- Width/height are stored in the DB schema and passed through the data model, but React Flow's node resizer (`@xyflow/react` `NodeResizer` component) is not yet attached to any node types. Adding it to `ImageNode` and `TextBoxNode` would allow freeform resizing.

## Known limitations / gotchas

- **`useBoardState` viewport initialisation**: The viewport is loaded from IPC on mount and passed as `defaultViewport` to React Flow. React Flow treats `defaultViewport` as uncontrolled — if the user navigates away and back, the viewport resets to the saved value correctly. However, `onMoveEnd` is used rather than `onMove` to avoid excessive dirty-marking during panning; this means the very last pan position may not be captured if the user navigates away mid-pan without releasing.
- **Manager-embedded board height**: The board in `InvestigationDetails.tsx` uses an inline `style={{ height: '60vh' }}` as a pragmatic fix because the manager panel doesn't have a fixed height container. This is a rough approximation and may need adjusting if the manager layout changes.
- **Entry hydration on first load**: `useBoardState` re-hydrates entry node data when `allEntries` changes. This works correctly but fires on every re-render where `allEntries` is a new array reference. Memoising the entries array in the parent component would prevent unnecessary work.
