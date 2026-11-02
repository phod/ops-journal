# Tokeniser Editor, increment 1: paste, hats, edit, copy out

Date: 2026-11-02
Status: approved for planning
Visual reference: `.mocks/tokeniser-increment-1-v2.html` (gitignored, local to the author's machine). Behaviour described here is what the mock does unless stated otherwise.

## Intent

Engineers routinely need to change a few fragments of a long command: a UUID buried in a curl URL, a header value, a flag. In a terminal that means crawling across five wrapped lines with the cursor. Pasting into a text editor is better but still slow and mouse-bound.

The Tokeniser Editor is a global-hotkey overlay. You paste a command, every editable fragment gets a small letter above it (a "hat", borrowed from Cursorless), you type the letter and that fragment opens for editing with its text already selected. Enter puts the whole command on the clipboard and closes the overlay, ready to paste back into the terminal.

This document covers increment 1 only. Variables, value profiles, history, saved commands, subdivide and any action grammar are deliberately out of scope and are listed under non-goals so the builder does not design toward them prematurely.

## Goals

- Open an empty, focused overlay with one hotkey, paste a command, and be editing within a second.
- Jump straight to a fragment by typing its hat. No action key first. A hat is the only verb.
- Still work as an ordinary text editor for anything hats don't cover.
- Get the result out: copy and close with one key, or copy and stay.
- Match the look and wiring of the existing Toolkit overlay so it feels native to the app.

## Non-goals (this increment)

- Variables, profiles of values, history, saved commands, notes.
- Subdivide, delete-token, or any multi-verb grammar.
- Persisting the text across app restarts. (Amended after increment 1: the text now persists in memory across hide/show, see "Opening and closing". The original increment reopened empty.)
- Undo across modes. Native undo inside the text mode editor is fine; there is no undo for hat edits.
- Linking to an Investigation or writing anything to the database.

## Anti-goals

- Hats that become a chore: two-letter hats on everything, hats that flicker, or hats on tokens nobody edits (flags, `curl`).
- Any stray keystroke destroying the pasted text. Opening a token for editing must preserve its text.
- A modal UI the user has to learn before it is useful. The status strip must always say what the next key does.

## Constraints

- Electron app, React renderer, Tailwind, TypeScript. Follow the patterns the Toolkit overlay already uses. The relevant files are named in "Wiring" below.
- Tests are required for every change (project rule). Vitest with jsdom for renderer code, node environment for `src/main`.
- Keep the dev loop intact: `npm run dev`, `npm test`.
- macOS is the target platform.

## Behaviour

### Opening and closing

- Default hotkey `CommandOrControl+Shift+L`, user-configurable like the other hotkeys, and listed in the tray menu as "Open Tokeniser" / "Close Tokeniser".
- The hotkey toggles the overlay. On show, the window takes focus and the renderer is told it has been shown so it can refocus the active control. The text and mode persist in memory across hide/show, so the user can paste, close to do something else, reopen and continue; a token edit that was open when the overlay hid is cancelled. Only the first opening after launch starts empty. (Amended after increment 1, which reset to empty on every show.)
- Window: frameless, transparent, always on top, visible on all workspaces, resizable, remembers its bounds in its own bounds file. Default size 820×380, centred horizontally, 80px from the top of the primary display when there are no saved bounds. Identical to the Toolkit window construction.
- The "opaque overlay" setting is respected the same way the Toolkit respects it.
- Escape in hats mode or the empty state hides the overlay without copying.

### Paste

- `Cmd+V` in the empty state or hats mode loads the clipboard text, replacing anything already present. Trailing newlines are trimmed; `\r\n` is normalised to `\n`.
- The pasted text is tokenised (below) and shown in hats mode.
- Paste inside text mode is ordinary textarea paste.
- **Author's call:** in the empty state and hats mode the renderer handles `Cmd+V` on `keydown` and reads the clipboard through an IPC call (`tokeniser:readClipboard`, Electron `clipboard.readText()`), rather than relying on a DOM `paste` event reaching a non-editable focused element. Same reasoning as the copy path. Text mode keeps the native textarea paste.

### Tokenising

Tokenising is a pure function and must live where both the renderer and tests can import it without Electron (for example `src/shared/tokeniser.ts`).

1. Split the text on runs of word delimiters, keeping the delimiter runs as their own non-target tokens so the text round-trips byte for byte. Delimiters: whitespace (including newlines), `/ = & ? : , ' " { } [ ]`. Dots, hyphens, underscores and `@` are **not** delimiters, so a JWT, a hostname, a UUID and `user@host` each stay as one token.
2. A non-delimiter token is a **target** (gets a hat) unless it is a flag matching `^-{1,2}[A-Za-z][\w-]*$` or a lone backslash line continuation. Flags are rendered muted; backslashes dimmer still.
3. The concatenation of all token texts equals the original string. This is a test.

### Hats

- 26 or fewer targets: single letters `a`…`z` in document order.
- More than 26 targets: a prefix-free two-tier scheme. The 19 highest-scoring targets get single letters from `asdfghjklqwertyuiop`. Every other target gets a two-letter hat whose first letter is from `zxcvbnm` and second letter from `a`…`z`, assigned in document order. Capacity is 19 + 182. **Author's call:** targets beyond that get no hat. They are still editable by double-click or in text mode, and the target count in the title bar reads "201 of N hatted" so the user knows why. Hats are never three letters.
- Score (higher is more likely to be edited): UUID 100; JWT-looking (`^eyJ`) or longer than 32 characters 90; number 80; `true`/`false`/`null` 70; SCREAMING_CASE identifiers 20; command words and protocol/content-type words (`curl docker kubectl aws gcloud run GET POST PUT DELETE http https application json`) 5; everything else 40 plus length capped at 20. Ties keep document order.
- Hats are always visible, dim grey, positioned above the first character of the token. Line height is increased to make room (about 2.5).
- When the user has typed the first letter of a two-letter hat, hats that do not start with that letter fade to near-invisible and matching hats light up amber with the pending second letter emphasised. Escape clears the pending letter.
- A letter that matches no hat shows a brief toast and clears the pending buffer.

### Hats mode: editing a token

- Typing a complete hat opens that token for editing in place: the token is replaced by an inline text input containing the token's text, **fully selected**. The keystroke that completed the hat must be prevented from reaching the input (this bug is easy to introduce and must have a test).
- Typing replaces the selection. An arrow key collapses the selection for a tweak. The input grows with its content.
- **Author's call:** the inline editor wraps within the text flow like any other token, so editing a 150-character JWT never causes horizontal scrolling. The mock uses a single-line `<input>` sized in `ch`, which does overflow; the implementation should use a wrapping control instead (an inline `contenteditable` span or an auto-sizing textarea, builder's choice). Select-all on open, Enter to commit and Escape to cancel are unchanged.
- Enter commits. Escape cancels and restores the token. Blur also cancels.
- Commit replaces the token's text in the full string and **rescans**: the whole string goes back through the tokeniser. Words added inside the edit get their own hats; a token emptied out loses its hat. The status strip toasts the new target count when it changed.
- If a token is emptied out entirely, one adjacent whitespace run is collapsed so the string does not keep a double space. (The mock does not do this; the implementation should.) **Author's call on the exact rule:** when the emptied token is bordered on both sides by whitespace runs and neither run contains a newline, remove the run that follows the token. In every other case (a newline on either side, a delimiter other than whitespace on either side, or start/end of text) leave the whitespace alone. This keeps `\`-continued lines and indentation intact and only fixes the plain `word  word` case. Edited ranges after the removed run shift by its length.
- Edited fragments are shown with an amber underline. The underline tracks **character ranges**, not tokens, so it survives a rescan and covers all the tokens an edit produced. Ranges after an edit shift by the edit's length delta. Leaving text mode clears all ranges.
- Double-click on a target token is the mouse equivalent of typing its hat.

### Text mode

- A plain textarea over the whole string, same font and line height as hats mode, amber caret. All native behaviour: arrows, selection, `Cmd+A`, `Cmd+C` with a selection, `Cmd+Z`.
- Entering text mode: `Tab` from hats mode; a single click anywhere on the command (caret placed at the click position); `Cmd+A` from hats mode (everything selected); clicking the mode pill in the title bar.
- Leaving text mode: `Tab` or `Escape`. The textarea content is rescanned into hats mode. If it is empty or whitespace, the overlay returns to the empty state.
- Enter in text mode inserts a newline. `Cmd+Enter` copies and closes.
- `Cmd+C` in text mode with nothing selected copies the whole command and stays open. With a selection it is the native copy.

### Getting the command out

- Hats mode `Enter`, or `Cmd+Enter` in either mode: write the full current text to the system clipboard and hide the overlay.
- `Cmd+C` in hats mode: write the full text to the clipboard, stay open, toast "Copied".
- Title bar buttons "copy" and "copy & close" do the same for the mouse.
- Use Electron's `clipboard` module from the main process through an IPC call rather than `navigator.clipboard`, so copying works regardless of renderer focus edge cases.

### Chrome

- Title bar: drag handle, "TOKENISER" label, a mode pill (`hats` amber / `text` blue, hidden in the empty state, clickable to toggle), target count, copy and copy-and-close buttons, the hotkey shown faintly at the right.
- Status strip at the bottom, one line, always present. Contents by state:
  - empty: `⌘V paste · Esc close`
  - hats: `hats — type a letter to edit that token · Tab text mode · ⌘A select all · ⌘C copy · ⏎ copy & close · Esc close`
  - pending second letter: the typed letter, a blinking caret, "second letter…", `Esc cancel`
  - editing token: `editing token · ⏎ commit · Esc cancel`
  - text: `text — edit freely · Tab back to hats · ⌘A select all · ⌘C copy · ⌘⏎ copy & close · Esc hats`
- Empty state: centred "Paste a command" with a one-line hint.
- Toasts for paste, copy, rescan count changes and unknown hats. Short, bottom centre, no animation beyond a fade.
- Visual language matches the Toolkit: `bg-gray-900/95`, `rounded-xl`, `border-gray-700/60`, JetBrains Mono, amber (`#fbbf24`) for hats and the edit state, blue (`#93c5fd`) for the text mode pill. No pulsing or glowing.

## Wiring

Mirror the Toolkit overlay. The builder should read these before planning:

- `src/main/windows.ts`: `createToolkitOverlayWindow`, `toggleToolkitOverlay`, `showToolkitOverlay`, `hideToolkitOverlay` and the bounds-file helpers. Add the tokeniser equivalents with their own bounds file (`tokeniser-overlay-bounds.json`). The show path must also send a `tokeniser:shown` event to the renderer so it refocuses.
- `src/main/hotkey.ts`: add a `tokeniserSlot` with `registerTokeniserHotkey` / `reregisterTokeniserHotkey`, and clear it in `unregisterAllHotkeys`.
- `src/main/settings.ts`: `DEFAULT_TOKENISER_HOTKEY`, `tokeniserHotkey` in `Settings` and `DEFAULTS`, getter and setter.
- `src/main/ipc-handlers.ts`: `settings:getTokeniserHotkey`, `settings:setTokeniserHotkey`, `tokeniserOverlay:show`, `tokeniserOverlay:hide`, `tokeniser:copy` (writes to the clipboard), `tokeniser:readClipboard`. Electron here is 45, so `clipboard.writeText` and `readText` return promises and must be awaited; the existing `clipboard handlers` block in `ipc-handlers.test.ts` already mocks them that way.
- `src/main/tray.ts`: menu entry with the current visibility label, like the Toolkit entry. Note the tray currently hard-codes accelerators; follow that.
- `src/main/index.ts`: create the window, register the hotkey, keep the tray label in sync on show/hide.
- `src/preload/index.ts` and `src/shared/ipc-types.ts`: `getTokeniserHotkey`, `setTokeniserHotkey`, `showTokeniserOverlay`, `hideTokeniserOverlay`, `copyToClipboard`, `readClipboard`, `onTokeniserShown`.
- `src/renderer/tokeniser.html`, `src/renderer/tokeniser/{main.tsx,App.tsx,index.css,components/}` and a new `tokeniser` input in `electron.vite.config.ts`.
- `src/renderer/manager/components/HotkeySettings.tsx`: add a "Open Tokeniser" row.
- `src/__tests__/setup.ts`: add the new API functions to `DEFAULT_MOCKS` and the `beforeEach` restore block, or every existing renderer test will break on the first one that touches them.

## Tests

Required coverage, at minimum:

Note: `vitest.config.ts` still uses `environmentMatchGlobs`, which the installed Vitest 4 no longer honours, so `src/main` tests currently run under jsdom. Use a `// @vitest-environment node` docblock in the new main-process and tokeniser test files rather than relying on the config.

- Tokeniser (pure, node environment): round-trips the input; splits a UUID out of a URL path; keeps a JWT, a hostname and `user@host` whole; flags and backslash get no hat; 26 or fewer targets get single letters in order; more than 26 targets yields a prefix-free set with the top-scoring 19 as single letters and the rest two letters from the `zxcvbnm` first-letter set; targets past 201 have no hat; score ordering for the listed categories; emptying a token collapses the following space run only in the plain `word  word` case and never across a newline.
- Renderer `App` (jsdom, testing-library): paste renders hats; typing a hat opens an input whose value is the token and is fully selected, and the hat letter did not land in it; Enter commits and rescans so an edit that adds words adds hats; emptying a token removes its hat and collapses the space; a long token's editor wraps rather than widening the pane; Escape cancels; `Cmd+V` in hats mode calls the read-clipboard API and replaces the text; two-letter narrowing dims non-matching hats; Tab enters text mode with the full text and Tab returns with a rescan; `Cmd+A` in hats mode enters text mode with everything selected; `Cmd+C` calls the copy API and does not hide; Enter in hats mode and `Cmd+Enter` in text mode call copy then hide; Escape in hats mode hides without copying; the `tokeniser:shown` event keeps the text, cancels a pending edit and refocuses; status strip text matches each state; the opaque-overlay setting toggles the background class.
- Main: settings default and getter/setter for the tokeniser hotkey; IPC handlers registered for the new channels; `copy` handler writes to the Electron clipboard.
- `HotkeySettings` test: the new row calls the new getter.

## Left to the builder

- Component breakdown inside the renderer (one `App` plus a `TokenView`, `TextView`, `StatusStrip` is a reasonable shape, but not mandated).
- How to compute the caret offset for a single click in hats mode (`document.caretRangeFromPoint` with a fallback to the token start is what the mock does).
- Exact toast timings, hat font size, and spacing. Use the mock as the reference.
- Whether the tokeniser lives in `src/shared` or `src/renderer/tokeniser`; the only requirement is that it has no Electron or DOM dependency.

## Future increments (context only, not scope)

Listed so the builder avoids closing doors, not so they build toward them.

- Variables: pull a token out under a name, with the same text elsewhere linked.
- Profiles: named sets of values across variables that swap together.
- History: an append-only log of every copy-out with timestamp and values, with pinnable, annotatable entries (this is the spec's "save a string state").
- Subdivide a token into sub-tokens; an action grammar (`e`/`v`/`d`/`s` then hat) once there is more than one verb.
