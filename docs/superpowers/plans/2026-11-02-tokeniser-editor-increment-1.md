# Tokeniser Editor, increment 1: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A global-hotkey overlay where a pasted command gets a letter "hat" over every editable fragment; typing the letter edits that fragment in place, a plain text mode covers everything else, and Enter copies the result and closes.

**Architecture:** Pure, DOM-free tokenising and hat assignment in `src/shared`, a pure reducer for the overlay's state machine in the renderer, and a thin React `App` that maps keys to reducer actions and IPC effects. Main-process wiring (window, hotkey, settings, IPC, tray) mirrors the existing Toolkit overlay file for file.

**Tech Stack:** Electron 45, React 18, TypeScript, Tailwind, electron-vite, Vitest 4 with jsdom and testing-library.

**Spec:** `docs/superpowers/specs/2026-11-02-tokeniser-editor-increment-1-design.md`

## Global Constraints

- Default hotkey `CommandOrControl+Shift+L`; user-configurable like the other hotkeys.
- Default window 820×380, frameless, transparent, always on top, resizable, own bounds file `tokeniser-overlay-bounds.json`; centred horizontally, y = 80 when no saved bounds.
- Word delimiters: whitespace, `/ = & ? : , ' " { } [ ]`. Dots, hyphens, underscores and `@` are not delimiters.
- Flags `^-{1,2}[A-Za-z][\w-]*$` and a lone `\` get no hat.
- Hats: ≤26 targets → `a`…`z` in order. >26 → top-19 by score from `asdfghjklqwertyuiop`, rest two letters, first from `zxcvbnm`, second from `a`…`z`, document order. Capacity 201; beyond that no hat, never three letters.
- Clipboard reads and writes go through main-process IPC using Electron `clipboard`, awaited (Electron 45 returns promises).
- Every opening starts empty: main sends `tokeniser:shown` on show, renderer resets.
- Main-process and shared test files carry `// @vitest-environment node` (the config's `environmentMatchGlobs` is ignored by Vitest 4).
- No pulsing or glowing animations. Amber `#fbbf24` for hats and editing, blue `#93c5fd` for the text-mode pill. Visual reference: `.mocks/tokeniser-increment-1-v2.html` (local, gitignored).
- Commit messages: no Co-Authored-By trailer (user rule). Commit after each task.

## Review Focus

Inputs the spec implies but no test would otherwise exercise, most likely to bite first:

1. Clipboard is empty or whitespace on `Cmd+V` → stays in the empty state, nothing crashes, no hats. (Task 5 reducer test.)
2. Uppercase letters, digits and punctuation typed in hats mode → ignored, no pending hat buffer, no editor opened. (Task 5 reducer test.)
3. Committing an edit with the value unchanged → no amber underline, no "rescanned" notice. (Task 3 and Task 5 tests.)
4. `Cmd+V` while a token editor is open → pastes into that editor only; the whole command is not replaced. (Task 6 App test.)
5. Hotkey fires while a token is being edited, then fires again → the `tokeniser:shown` event resets to empty even mid-edit. (Task 8 App test.)

---

## File structure

**Create**
- `src/shared/tokeniser.ts` — split text into tokens, rejoin, apply a token edit with whitespace collapse, track edited ranges. No DOM, no Electron.
- `src/shared/hats.ts` — score a token, assign prefix-free hats, look up a hat.
- `src/shared/__tests__/tokeniser.test.ts`, `src/shared/__tests__/hats.test.ts`
- `src/renderer/tokeniser.html`, `src/renderer/tokeniser/main.tsx`, `src/renderer/tokeniser/index.css`
- `src/renderer/tokeniser/state.ts` — reducer: modes `empty | hats | editing | text`, hat buffer, edited ranges, notices.
- `src/renderer/tokeniser/App.tsx` — owns state, keyboard mapping, IPC effects, toast.
- `src/renderer/tokeniser/components/TitleBar.tsx`, `TokenView.tsx`, `InlineEditor.tsx`, `TextView.tsx`, `StatusStrip.tsx`
- `src/renderer/tokeniser/__tests__/state.test.ts`, `App.test.tsx`, `InlineEditor.test.tsx`

**Modify**
- `src/main/settings.ts`, `src/main/hotkey.ts`, `src/main/windows.ts`, `src/main/ipc-handlers.ts`, `src/main/tray.ts`, `src/main/index.ts`
- `src/preload/index.ts`, `src/shared/ipc-types.ts`, `src/__tests__/setup.ts`
- `src/main/__tests__/settings.test.ts`, `src/main/__tests__/ipc-handlers.test.ts`
- `src/renderer/manager/components/HotkeySettings.tsx` and its test
- `electron.vite.config.ts`

---

### Task 1: Tokeniser core

**Files:**
- Create: `src/shared/tokeniser.ts`, `src/shared/__tests__/tokeniser.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface Token { text: string; kind: 'word' | 'delim'; target: boolean; flag: boolean }
  export const WORD_DELIMITERS: RegExp            // /([\/=&?:,'"{}\[\]\s]+)/
  export function tokenise(text: string): Token[]
  export function joinTokens(tokens: Token[]): string
  export function tokenStart(tokens: Token[], index: number): number   // char offset of tokens[index]
  export function normaliseInput(text: string): string                // \r\n → \n, strip trailing newlines
  ```

- [ ] **Step 1: Write the failing tests** in `src/shared/__tests__/tokeniser.test.ts` with `// @vitest-environment node`:

```ts
it('round-trips any input', () => { for (const s of [CURL, DOCKER, 'a  b\n\tc']) expect(joinTokens(tokenise(s))).toBe(s) })
it('splits a UUID out of a URL path', () => {
  const t = tokenise("'https://api.io/v2/customers/3fa85f64-5717-4562-b3fc-2c963f66afa6/orders'")
  expect(t.filter(x => x.target).map(x => x.text)).toEqual(['https', 'api.io', 'v2', 'customers', '3fa85f64-5717-4562-b3fc-2c963f66afa6', 'orders'])
})
it('keeps a JWT, a hostname and user@host whole', ...)      // 'eyJa.eyJb.sig', 'api.acme-platform.io', 'ops@db.internal' each one target
it('gives flags and backslash continuations no hat', () => {
  const t = tokenise('curl -X POST --header x \\\n  -d y')
  expect(t.filter(x => x.flag).map(x => x.text)).toEqual(['-X', '--header', '-d'])
  expect(t.find(x => x.text === '\\')!.target).toBe(false)
  expect(t.find(x => x.text === '\\')!.flag).toBe(false)
})
it('marks delimiter runs as kind delim and never target', ...)
it('tokenStart returns the character offset', () => { const t = tokenise('ab cd'); expect(tokenStart(t, 2)).toBe(3) })
it('normaliseInput converts CRLF and strips trailing newlines', () => { expect(normaliseInput('a\r\nb\n\n')).toBe('a\nb') })
```

Use the curl command from the spec's mock as `CURL` and the docker command as `DOCKER` (copy both verbatim from `.mocks/tokeniser-increment-1-v2.html` / the design doc's hat examples).

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/shared/__tests__/tokeniser.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `src/shared/tokeniser.ts`** with the signatures above. `tokenise` splits with `text.split(WORD_DELIMITERS).filter(Boolean)`; a part is `delim` when it contains no non-delimiter character; a word is a flag when it matches `/^-{1,2}[A-Za-z][\w-]*$/`; `target = kind === 'word' && !flag && text !== '\\'`.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/shared/__tests__/tokeniser.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/tokeniser.ts src/shared/__tests__/tokeniser.test.ts
git commit -m "Add tokeniser core for the Tokeniser Editor"
```

---

### Task 2: Hat assignment

**Files:**
- Create: `src/shared/hats.ts`, `src/shared/__tests__/hats.test.ts`

**Interfaces:**
- Consumes: `Token`, `tokenise` from Task 1.
- Produces:
  ```ts
  export const SINGLE_HATS = 'asdfghjklqwertyuiop'
  export const PAIR_FIRST = 'zxcvbnm'
  export const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'
  export const HAT_CAPACITY = 201
  export function scoreToken(text: string): number
  export function assignHats(tokens: Token[]): (string | null)[]   // parallel to tokens; null for non-targets and overflow
  export function hatLookup(hats: (string | null)[]): Map<string, number>   // hat → token index
  export function hatMatch(hats: (string | null)[], buffer: string): { exact: number | null; hasPrefix: boolean }
  ```

- [ ] **Step 1: Write the failing tests** (`// @vitest-environment node`):

```ts
it('scores by the spec table', () => {
  expect(scoreToken('3fa85f64-5717-4562-b3fc-2c963f66afa6')).toBe(100)
  expect(scoreToken('eyJhbGci.x.y')).toBe(90); expect(scoreToken('x'.repeat(33))).toBe(90)
  expect(scoreToken('8080')).toBe(80); expect(scoreToken('2.14.3')).toBe(80)
  expect(scoreToken('true')).toBe(70); expect(scoreToken('null')).toBe(70)
  expect(scoreToken('DATABASE_URL')).toBe(20)
  expect(scoreToken('curl')).toBe(5); expect(scoreToken('json')).toBe(5)
  expect(scoreToken('orders')).toBe(46)                 // 40 + length 6
  expect(scoreToken('a'.repeat(30))).toBe(60)           // 40 + capped 20
})
it('uses single letters a..z in document order for 26 or fewer targets', () => {
  const t = tokenise('one two three'); expect(assignHats(t).filter(Boolean)).toEqual(['a', 'b', 'c'])
})
it('above 26 targets: top 19 scores get SINGLE_HATS, rest are two letters from PAIR_FIRST', () => {
  const t = tokenise(Array.from({ length: 30 }, (_, i) => i < 5 ? `id-${i}`.padEnd(40, 'x') : `w${i}`).join(' '))
  const hats = assignHats(t).filter((h): h is string => h !== null)
  expect(hats).toHaveLength(30)
  expect(hats.filter(h => h.length === 1)).toHaveLength(19)
  expect(hats.filter(h => h.length === 2).every(h => PAIR_FIRST.includes(h[0]))).toBe(true)
  const longOnes = t.map((tok, i) => tok.text.length === 40 ? assignHats(t)[i] : null).filter(Boolean)
  expect(longOnes.every(h => h!.length === 1)).toBe(true)      // high scorers kept one letter
})
it('is prefix-free', () => { const hats = assignHats(tokenise(DOCKER)).filter(Boolean) as string[]; for (const a of hats) for (const b of hats) if (a !== b) expect(b.startsWith(a)).toBe(false) })
it('assigns null past HAT_CAPACITY targets and never three letters', () => {
  const t = tokenise(Array.from({ length: 210 }, (_, i) => `w${i}`).join(' '))
  const hats = assignHats(t); expect(hats.filter(Boolean)).toHaveLength(201); expect(hats.every(h => h === null || h.length <= 2)).toBe(true)
})
it('hatMatch distinguishes exact, prefix and miss', () => {
  const hats = ['a', null, 'zb', null, 'zc']
  expect(hatMatch(hats, 'a')).toEqual({ exact: 0, hasPrefix: false })
  expect(hatMatch(hats, 'z')).toEqual({ exact: null, hasPrefix: true })
  expect(hatMatch(hats, 'q')).toEqual({ exact: null, hasPrefix: false })
})
```

- [ ] **Step 2: Run to verify failure.** `npx vitest run src/shared/__tests__/hats.test.ts` → FAIL, module not found.

- [ ] **Step 3: Implement `src/shared/hats.ts`.** `scoreToken` follows the spec table in order: UUID regex 100; `/^eyJ/` or length > 32 → 90; `/^\d+(\.\d+)*$/` → 80; `true|false|null` → 70; `/^[A-Z][A-Z0-9_]{2,}$/` → 20; the command-word list → 5; else `40 + Math.min(length, 20)`. `assignHats`: collect target indices; if ≤26 map to `ALPHABET`; else stable-sort by score descending, first 19 get `SINGLE_HATS[k]`, remaining in document order get `PAIR_FIRST[floor(k/26)] + ALPHABET[k%26]` while `k < 182`, else null.

- [ ] **Step 4: Run to verify pass.** Same command → PASS.

- [ ] **Step 5: Commit** — `git commit -m "Add hat assignment for the Tokeniser Editor"`

---

### Task 3: Applying a token edit

**Files:**
- Modify: `src/shared/tokeniser.ts`, `src/shared/__tests__/tokeniser.test.ts`

**Interfaces:**
- Produces (added to `tokeniser.ts`):
  ```ts
  export interface EditedRange { start: number; end: number }
  export interface EditResult { text: string; editedRanges: EditedRange[]; start: number; end: number }
  export function applyTokenEdit(tokens: Token[], index: number, value: string, editedRanges: EditedRange[]): EditResult
  export function markEditedTokens(tokens: Token[], ranges: EditedRange[]): boolean[]   // parallel; true only for targets overlapping a range
  ```
  `start`/`end` in `EditResult` are the character range of `value` in the new text (for flashing). An unchanged value returns the same text and the same ranges.

- [ ] **Step 1: Write the failing tests:**

```ts
describe('applyTokenEdit', () => {
  it('replaces the token text and records the edited range', () => {
    const t = tokenise('curl POST x'); const r = applyTokenEdit(t, 2, 'GET', [])
    expect(r.text).toBe('curl GET x'); expect(r.editedRanges).toEqual([{ start: 5, end: 8 }]); expect(r.start).toBe(5); expect(r.end).toBe(8)
  })
  it('shifts later ranges by the length delta', () => {
    const t = tokenise('a b c'); const r = applyTokenEdit(t, 0, 'aaaa', [{ start: 4, end: 5 }])
    expect(r.editedRanges).toEqual([{ start: 7, end: 8 }, { start: 0, end: 4 }])
  })
  it('an unchanged value adds no range', () => { const t = tokenise('a b'); expect(applyTokenEdit(t, 0, 'a', []).editedRanges).toEqual([]) })
  it('emptying a token between two plain space runs removes the following run', () => {
    expect(applyTokenEdit(tokenise('curl -X POST https://x'), 4, '', []).text).toBe('curl -X https://x')
  })
  it('collapses before a backslash continuation when both neighbours are plain spaces', () => {
    expect(applyTokenEdit(tokenise('a POST \\\n  b'), 2, '', []).text).toBe('a \\\n  b')
  })
  it('does not collapse across a newline', () => {
    expect(applyTokenEdit(tokenise('a POST\n  b'), 2, '', []).text).toBe('a \n  b')
  })
  it('does not collapse when a non-space delimiter is adjacent', () => {
    expect(applyTokenEdit(tokenise('a/POST/b'), 2, '', []).text).toBe('a//b')
  })
  it('does not collapse at the start or end of the text', () => {
    expect(applyTokenEdit(tokenise('POST b'), 0, '', []).text).toBe(' b')
  })
})
describe('markEditedTokens', () => {
  it('marks every target overlapping a range and no delimiters', () => {
    const t = tokenise('a --verbose 3'); expect(markEditedTokens(t, [{ start: 0, end: 13 }])).toEqual([true, false, false, false, true])
  })
})
```

- [ ] **Step 2: Run to verify failure.** → FAIL, `applyTokenEdit` is not exported.

- [ ] **Step 3: Implement.** In `applyTokenEdit`: compute `start = tokenStart(tokens, index)`, `oldEnd`, `delta`; when `value === ''` and `tokens[index-1]` and `tokens[index+1]` are both `delim` tokens matching `/^[ \t]+$/`, drop `tokens[index+1]` as well and extend the removed span; shift every range with `r.start >= oldEnd` by the total delta; push `{start, end}` only when `value !== tokens[index].text && value.length > 0`. Build the new text from the modified copy of the token array.

- [ ] **Step 4: Run to verify pass.** → PASS.

- [ ] **Step 5: Commit** — `git commit -m "Apply token edits with whitespace collapse and edited ranges"`

---

### Task 4: Main-process wiring

**Files:**
- Modify: `src/main/settings.ts`, `src/main/hotkey.ts`, `src/main/windows.ts`, `src/main/ipc-handlers.ts`, `src/main/tray.ts`, `src/main/index.ts`, `src/preload/index.ts`, `src/shared/ipc-types.ts`, `src/__tests__/setup.ts`, `electron.vite.config.ts`
- Modify tests: `src/main/__tests__/settings.test.ts`, `src/main/__tests__/ipc-handlers.test.ts`
- Create: `src/renderer/tokeniser.html`, `src/renderer/tokeniser/main.tsx`, `src/renderer/tokeniser/index.css`, `src/renderer/tokeniser/App.tsx` (placeholder rendering the text "Tokeniser"; replaced in Task 6)

**Interfaces:**
- Produces, main:
  ```ts
  // settings.ts
  export const DEFAULT_TOKENISER_HOTKEY = 'CommandOrControl+Shift+L'
  export function getTokeniserHotkey(): string
  export function setTokeniserHotkey(hotkey: string): void
  // hotkey.ts
  export function registerTokeniserHotkey(): void
  export function reregisterTokeniserHotkey(newHotkey: string): boolean
  // windows.ts
  export function createTokeniserOverlayWindow(): BrowserWindow
  export function getTokeniserOverlayWindow(): BrowserWindow | null
  export function toggleTokeniserOverlay(): void
  export function showTokeniserOverlay(): void      // after win.show()/focus(): win.webContents.send('tokeniser:shown')
  export function hideTokeniserOverlay(): void
  ```
  IPC channels: `settings:getTokeniserHotkey`, `settings:setTokeniserHotkey` `{accelerator}` → `reregisterTokeniserHotkey`, `tokeniserOverlay:show`, `tokeniserOverlay:hide`, `tokeniser:copy` `{text}` → `await clipboard.writeText(text)`, `tokeniser:readClipboard` → `clipboard.readText()`.
- Produces, `ElectronAPI` (ipc-types + preload), under a `// Tokeniser` comment:
  ```ts
  getTokeniserHotkey: () => Promise<string>
  setTokeniserHotkey: (accelerator: string) => Promise<boolean>
  showTokeniserOverlay: () => Promise<void>
  hideTokeniserOverlay: () => Promise<void>
  copyToClipboard: (text: string) => Promise<void>
  readClipboard: () => Promise<string>
  onTokeniserShown: (callback: () => void) => () => void      // channel 'tokeniser:shown'
  ```

- [ ] **Step 1: Write failing settings tests** in `settings.test.ts`: import `getTokeniserHotkey, setTokeniserHotkey, DEFAULT_TOKENISER_HOTKEY`; `it('getTokeniserHotkey returns CommandOrControl+Shift+L by default')`, `it('setTokeniserHotkey writes tokeniserHotkey to settings.json and preserves other keys')`. Add `// @vitest-environment node` at the top of the file if absent.

- [ ] **Step 2: Write failing IPC tests** in `ipc-handlers.test.ts`: add `showTokeniserOverlay`, `hideTokeniserOverlay` to `mockWindows`; `reregisterTokeniserHotkey` to `mockHotkey`; `getTokeniserHotkey: vi.fn().mockReturnValue('CmdOrCtrl+Shift+L')` to `mockSettings`; `readText: vi.fn().mockResolvedValue('from clipboard')` to the electron `clipboard` mock. New `describe('tokeniser handlers')`:

```ts
it('settings:getTokeniserHotkey calls the getter', ...)
it('settings:setTokeniserHotkey calls reregisterTokeniserHotkey with the accelerator', ...)
it('tokeniserOverlay:show / hide call the window functions', ...)
it('tokeniser:copy awaits clipboard.writeText with the text', async () => { await invoke('tokeniser:copy', { text: 'curl x' }); expect(clipboard.writeText).toHaveBeenCalledWith('curl x') })
it('tokeniser:readClipboard returns clipboard.readText', async () => { expect(await invoke('tokeniser:readClipboard')).toBe('from clipboard') })
```

- [ ] **Step 3: Run both files to verify failure.** `npx vitest run src/main/__tests__/settings.test.ts src/main/__tests__/ipc-handlers.test.ts` → FAIL.

- [ ] **Step 4: Implement settings, hotkey, IPC.** Follow the toolkit lines exactly: `settings.ts` (field `tokeniserHotkey` in `Settings` and `DEFAULTS`), `hotkey.ts` (a `tokeniserSlot` whose callback is `toggleTokeniserOverlay`, label `'tokeniser hotkey'`, cleared in `unregisterAllHotkeys`), `ipc-handlers.ts` (new `// --- Tokeniser overlay ---` block next to the toolkit one).

- [ ] **Step 5: Implement the window** in `windows.ts`: copy the toolkit block (`toolkitBoundsFilePath` … `hideToolkitOverlay`) with `tokeniser` names, bounds file `tokeniser-overlay-bounds.json`, defaults `width: 820, height: 380`, page `'tokeniser.html'`. Both `toggle` (on the show branch) and `show` end with `win.webContents.send('tokeniser:shown')`. No `capturePreviousFrontApp` call (not needed).

- [ ] **Step 6: Wire tray, index, preload, types, vite, setup.** `tray.ts`: entry `Open Tokeniser`/`Close Tokeniser`, accelerator `'CommandOrControl+Shift+L'`, placed after the Toolkit entry. `index.ts`: `createTokeniserOverlayWindow()`, show/hide → `updateTrayMenu()`, `registerTokeniserHotkey()`. `preload/index.ts` + `ipc-types.ts`: the seven API members above. `electron.vite.config.ts`: `tokeniser: resolve(__dirname, 'src/renderer/tokeniser.html')`. `setup.ts`: add the seven to `DEFAULT_MOCKS` (`getTokeniserHotkey` resolves `'CommandOrControl+Shift+L'`, `setTokeniserHotkey` resolves `true`, `readClipboard` resolves `''`, `onTokeniserShown` returns `() => {}`) and restore the resolved values in the `beforeEach` block.

- [ ] **Step 7: Create the renderer scaffold.** `tokeniser.html` = `toolkit.html` with title `Tokeniser` and script `./tokeniser/main.tsx`; `main.tsx` = toolkit's; `index.css` = toolkit's `index.css`; `App.tsx` placeholder `export default function App() { return <div className="h-screen rounded-xl bg-gray-900 text-gray-300 p-4 text-xs">Tokeniser</div> }`.

- [ ] **Step 8: Verify.** `npx vitest run src/main` → PASS. `npx tsc --noEmit -p tsconfig.node.json && npx tsc --noEmit -p tsconfig.web.json` → no errors. `npm run build` → succeeds and `out/renderer/tokeniser.html` exists.

- [ ] **Step 9: Commit** — `git commit -m "Wire the Tokeniser overlay window, hotkey, settings and IPC"`

---

### Task 5: Renderer state reducer

**Files:**
- Create: `src/renderer/tokeniser/state.ts`, `src/renderer/tokeniser/__tests__/state.test.ts`

**Interfaces:**
- Consumes: Task 1–3 (`tokenise`, `normaliseInput`, `joinTokens`, `applyTokenEdit`, `markEditedTokens`, `EditedRange`, `Token`) and Task 2 (`assignHats`, `hatMatch`).
- Produces:
  ```ts
  export type Mode = 'empty' | 'hats' | 'editing' | 'text'
  export interface TokeniserState {
    mode: Mode
    tokens: Token[]
    hats: (string | null)[]
    edited: boolean[]
    editedRanges: EditedRange[]
    hatBuf: string
    editingIndex: number | null
    textDraft: string                      // textarea content while mode === 'text'
    textSelection: 'all' | number | null   // what to select/where to put the caret on entering text mode
    flashRange: { start: number; end: number } | null
    notice: string | null                  // one-shot toast text; App clears with 'clearNotice'
    targetCount: number
    hattedCount: number
  }
  export type Action =
    | { type: 'reset' }
    | { type: 'load'; text: string }                        // paste or leaveText content
    | { type: 'hatKey'; key: string }
    | { type: 'clearHatBuf' }
    | { type: 'beginEdit'; index: number }
    | { type: 'commitEdit'; value: string }
    | { type: 'cancelEdit' }
    | { type: 'enterText'; selection: 'all' | number | null }
    | { type: 'leaveText'; text: string }
    | { type: 'notice'; text: string }                      // App-originated toast, e.g. "Copied"
    | { type: 'clearNotice' }
  export const initialState: TokeniserState
  export function reduce(state: TokeniserState, action: Action): TokeniserState
  export function currentText(state: TokeniserState): string     // textDraft in text mode, else joinTokens
  ```

- [ ] **Step 1: Write the failing tests** (jsdom default is fine; nothing touches the DOM):

```ts
const loaded = reduce(initialState, { type: 'load', text: 'curl -X POST https://api.io/x \r\n' })
it('load tokenises, assigns hats, enters hats mode and notices the target count', () => {
  expect(loaded.mode).toBe('hats'); expect(loaded.targetCount).toBe(5); expect(loaded.hats.filter(Boolean)).toEqual(['a','b','c','d','e']); expect(loaded.notice).toMatch(/5 targets/)
})
it('load with empty or whitespace text stays empty', () => { expect(reduce(initialState, { type: 'load', text: '  \n' }).mode).toBe('empty') })
it('hatKey with an exact hat enters editing for that token', () => { const s = reduce(loaded, { type: 'hatKey', key: 'c' }); expect(s.mode).toBe('editing'); expect(s.tokens[s.editingIndex!].text).toBe('https') })
it('hatKey with a prefix sets hatBuf; a second key resolves it', () => { /* build 30-target state, press PAIR_FIRST[0] then the second letter */ })
it('hatKey with no match clears hatBuf and notices', () => { const s = reduce(loaded, { type: 'hatKey', key: 'q' }); expect(s.hatBuf).toBe(''); expect(s.notice).toMatch(/No hat/) })
it('ignores uppercase, digits and punctuation', () => { for (const k of ['A', '1', '-', ' ']) expect(reduce(loaded, { type: 'hatKey', key: k })).toBe(loaded) })
it('commitEdit rescans: added words get hats and the notice reports the delta', () => {
  const s = reduce(reduce(loaded, { type: 'beginEdit', index: 4 }), { type: 'commitEdit', value: 'POST --retry 3' })
  expect(s.mode).toBe('hats'); expect(s.targetCount).toBe(6); expect(s.notice).toMatch(/\+1/); expect(s.edited.filter(Boolean)).toHaveLength(2)
})
it('commitEdit with an unchanged value marks nothing and gives no rescan notice', ...)
it('commitEdit that empties the last target can drop to empty mode', () => { const one = reduce(initialState, { type: 'load', text: 'x' }); expect(reduce(reduce(one, { type: 'beginEdit', index: 0 }), { type: 'commitEdit', value: '' }).mode).toBe('empty') })
it('cancelEdit returns to hats with tokens unchanged', ...)
it('enterText copies the text into textDraft with the requested selection', () => { const s = reduce(loaded, { type: 'enterText', selection: 'all' }); expect(s.mode).toBe('text'); expect(s.textDraft).toBe(currentText(loaded)); expect(s.textSelection).toBe('all') })
it('leaveText rescans the draft and clears edited ranges', () => { const s = reduce(reduce(loaded, { type: 'enterText', selection: null }), { type: 'leaveText', text: 'a b' }); expect(s.mode).toBe('hats'); expect(s.targetCount).toBe(2); expect(s.editedRanges).toEqual([]) })
it('leaveText with empty text returns to empty', ...)
it('reset returns to initialState from any mode', () => { expect(reduce(reduce(loaded, { type: 'beginEdit', index: 0 }), { type: 'reset' })).toEqual(initialState) })
it('notice sets the toast text and clearNotice clears it', () => { expect(reduce(loaded, { type: 'notice', text: 'Copied' }).notice).toBe('Copied'); expect(reduce(loaded, { type: 'clearNotice' }).notice).toBeNull() })
it('hattedCount is capped at 201 and the load notice says "201 of N hatted" when exceeded', ...)
```

- [ ] **Step 2: Run to verify failure.** `npx vitest run src/renderer/tokeniser/__tests__/state.test.ts` → FAIL.

- [ ] **Step 3: Implement `state.ts`.** One private helper `rescan(text, editedRanges, prevTargetCount?)` builds tokens/hats/edited/counts and the notice; `load` and `leaveText` call it with `normaliseInput` and fresh ranges; `commitEdit` calls `applyTokenEdit` then `rescan` with the returned ranges and sets `flashRange`. `hatKey` only acts on `/^[a-z]$/` keys and uses `hatMatch` on `hatBuf + key`.

- [ ] **Step 4: Run to verify pass.** → PASS.

- [ ] **Step 5: Commit** — `git commit -m "Add the Tokeniser overlay state reducer"`

---

### Task 6: Hats mode UI

**Files:**
- Create: `src/renderer/tokeniser/components/TitleBar.tsx`, `TokenView.tsx`, `InlineEditor.tsx`, `StatusStrip.tsx`
- Create: `src/renderer/tokeniser/__tests__/InlineEditor.test.tsx`, `src/renderer/tokeniser/__tests__/App.test.tsx`
- Modify: `src/renderer/tokeniser/App.tsx` (replace placeholder), `src/renderer/tokeniser/index.css`

**Interfaces:**
- Consumes: Task 5 reducer; `window.electronAPI.readClipboard`, `copyToClipboard`, `hideTokeniserOverlay`, `onTokeniserShown`, `getOpaqueOverlay`, `onOpaqueOverlayChanged`.
- Produces:
  ```tsx
  // InlineEditor.tsx — a contenteditable span so the edit wraps in the text flow
  export function InlineEditor(props: { initialValue: string; onCommit: (value: string) => void; onCancel: () => void }): JSX.Element
  // TokenView.tsx
  export function TokenView(props: {
    tokens: Token[]; hats: (string | null)[]; edited: boolean[]; hatBuf: string
    editingIndex: number | null; flashRange: { start: number; end: number } | null
    onCommit: (value: string) => void; onCancel: () => void
    onTokenDoubleClick: (index: number) => void; onTextClick: (offset: number) => void
  }): JSX.Element
  // StatusStrip.tsx
  export function StatusStrip(props: { mode: Mode; hatBuf: string }): JSX.Element
  // TitleBar.tsx
  export function TitleBar(props: { mode: Mode; targetCount: number; hattedCount: number; onToggleMode: () => void; onCopy: () => void; onCopyClose: () => void }): JSX.Element
  ```
  Test hooks: each target token span has `data-testid="token"` and `data-hat="<hat>"`; the hat label has `data-testid="hat"`; the editor has `role="textbox"` and `data-testid="inline-editor"`; the status strip has `data-testid="status-strip"`; the toast has `data-testid="toast"`.

- [ ] **Step 1: Write failing `InlineEditor` tests:**

```ts
it('renders the value and selects all of it on mount', () => {
  render(<InlineEditor initialValue="abc123" onCommit={vi.fn()} onCancel={vi.fn()} />)
  const ed = screen.getByTestId('inline-editor'); expect(ed).toHaveTextContent('abc123'); expect(document.activeElement).toBe(ed)
  const sel = window.getSelection()!; expect(sel.toString() === 'abc123' || (sel.anchorOffset === 0 && sel.focusOffset === 6)).toBe(true)
})
it('Enter commits the current text without inserting a newline', ...)   // fireEvent.keyDown(ed, { key: 'Enter' }) → onCommit('abc123'); ed.textContent has no '\n'
it('Escape and blur call onCancel', ...)
it('a paste inserts plain text only', ...)   // fireEvent.paste with clipboardData getData → textContent, no HTML
it('wraps: has the same white-space and word-break classes as the token view', () => { expect(ed.className).toMatch(/break-all/) })
```

- [ ] **Step 2: Write failing `App` tests** (paste is driven by `Cmd+V` keydown and the mocked `readClipboard`):

```ts
beforeEach(() => { window.electronAPI.readClipboard = vi.fn().mockResolvedValue(CURL) })
async function paste() { fireEvent.keyDown(screen.getByTestId('overlay'), { key: 'v', metaKey: true }); await screen.findAllByTestId('token') }

it('starts empty with the paste hint and the empty status strip', () => { render(<App />); expect(screen.getByText('Paste a command')).toBeInTheDocument(); expect(screen.getByTestId('status-strip')).toHaveTextContent('⌘V paste') })
it('Cmd+V reads the clipboard and renders hats', async () => { render(<App />); await paste(); expect(window.electronAPI.readClipboard).toHaveBeenCalled(); expect(screen.getAllByTestId('hat')[0]).toHaveTextContent('a') })
it('typing a hat opens the editor with the token text selected and the hat letter not inserted', async () => {
  render(<App />); await paste(); fireEvent.keyDown(overlay(), { key: 'g' })   // 'g' = 7th target: the tenant UUID in CURL
  const ed = await screen.findByTestId('inline-editor'); expect(ed).toHaveTextContent('8f1c2d3e-4b5a-4c6d-9e7f-0a1b2c3d4e5f'); expect(ed.textContent).not.toBe('g')
})
it('Enter commits and rescans so added words get hats', async () => { /* open hat 'b' (POST), set textContent 'POST --retry 3', keyDown Enter → hats count grows by 1, status strip back to hats text */ })
it('emptying a token removes its hat and collapses the space', ...)
it('Escape cancels an edit and leaves the text unchanged', ...)
it('first letter of a two-letter hat dims non-matching hats', async () => { /* readClipboard resolves DOCKER; keyDown 'z'; hats not starting with z have class "miss"; strip shows "second letter" */ })
it('double-click on a token opens its editor', ...)
it('Cmd+V while editing does not replace the command', async () => { /* open editor, keyDown v+meta on the editor → readClipboard not called again, editor still present */ })
it('status strip shows the hats-mode keys', async () => { render(<App />); await paste(); expect(screen.getByTestId('status-strip')).toHaveTextContent('type a letter to edit that token') })
it('respects the opaque overlay setting', async () => { window.electronAPI.getOpaqueOverlay = vi.fn().mockResolvedValue(true); render(<App />); await waitFor(() => expect(screen.getByTestId('overlay').className).toMatch(/bg-gray-900\/95/)) })
```

- [ ] **Step 3: Run to verify failure.** `npx vitest run src/renderer/tokeniser` → FAIL.

- [ ] **Step 4: Implement the components and `App`.**
  - `App`: `useReducer(reduce, initialState)`; outer `div` `data-testid="overlay" tabIndex={0}` with `onKeyDown`, focused on mount and after every mode change back to `hats`/`empty` (`ref.current?.focus()` in an effect keyed on `state.mode`). Key map in hats/empty mode: `Cmd+V` → `readClipboard().then(text => dispatch load)` (also `preventDefault`); `/^[a-z]$/` (no modifiers) → `preventDefault()` then `dispatch hatKey`; `Escape` with `hatBuf` → `clearHatBuf`, else `hideTokeniserOverlay()`. Toast: render `state.notice` in `data-testid="toast"`, clear with `clearNotice` after 2200ms.
  - `TokenView`: `white-space: pre-wrap; word-break: break-all; line-height: 2.5` on the container (class `cmd` in `index.css`); each token a `span`; targets get `data-testid="token"`, `data-hat`, `class="tok target"` plus `edited` when flagged; the hat is `<span data-testid="hat" class="hat {part|miss}">` positioned absolutely above the first character, two-letter hats rendered as two spans (`h1`, `h2`) so the pending letter can be de-emphasised; delimiters `class="tok delim"`, flags `class="tok flag"`, backslash `class="tok dim"`. The token at `editingIndex` renders `<InlineEditor>` instead of its text. Double-click → `onTokenDoubleClick`. Single click → `onTextClick(offset)` using `document.caretRangeFromPoint` when available, else the clicked token's start (compute offsets from `tokenStart`). Ignore single clicks for 220ms after a double-click as the mock does.
  - `InlineEditor`: `<span contentEditable suppressContentEditableWarning role="textbox" data-testid="inline-editor" className="inline-editor break-all">`; on mount set `textContent`, focus, and select all with `document.getSelection().selectAllChildren(el)`; `onKeyDown`: Enter → `preventDefault`, `onCommit(el.textContent ?? '')`; Escape → `onCancel`; `onBlur` → `onCancel`; `onPaste` → `preventDefault` and `document.execCommand('insertText', false, clipboardData.getData('text'))` with a fallback to appending the text when `execCommand` is unavailable (jsdom).
  - `StatusStrip`: exact copy strings from the spec's "Chrome" section, one line, `<kbd>` elements.
  - `TitleBar`: drag handle, "Tokeniser" label, mode pill (hidden in `empty`, amber `hats`, blue `text`, `onClick=onToggleMode`), `targetCount` text (`"N targets"` or `"201 of N hatted"` when `hattedCount < targetCount`), buttons `copy` and `copy & close` with class `no-drag`.
  - `index.css`: add the `.cmd`, `.tok`, `.hat`, `.inline-editor` rules from the mock (positions, colours, `line-height: 2.5`), no animations except the 0.5s `flash` fade.

- [ ] **Step 5: Run to verify pass.** `npx vitest run src/renderer/tokeniser` → PASS.

- [ ] **Step 6: Commit** — `git commit -m "Add hats mode UI for the Tokeniser overlay"`

---

### Task 7: Text mode

**Files:**
- Create: `src/renderer/tokeniser/components/TextView.tsx`
- Modify: `src/renderer/tokeniser/App.tsx`, `src/renderer/tokeniser/__tests__/App.test.tsx`

**Interfaces:**
- Produces:
  ```tsx
  export function TextView(props: {
    value: string; selection: 'all' | number | null
    onChange: (value: string) => void; onLeave: (value: string) => void
    onCopyClose: (value: string) => void; onCopyStay: (value: string) => void
  }): JSX.Element     // <textarea data-testid="text-editor" spellCheck={false}>
  ```

- [ ] **Step 1: Write failing `App` tests:**

```ts
it('Tab enters text mode with the full text and the text status strip; Tab again rescans back', async () => {
  render(<App />); await paste(); fireEvent.keyDown(overlay(), { key: 'Tab' })
  const ta = await screen.findByTestId('text-editor') as HTMLTextAreaElement; expect(ta.value).toBe(CURL.trim()); expect(screen.getByTestId('status-strip')).toHaveTextContent('edit freely')
  fireEvent.change(ta, { target: { value: 'a b c' } }); fireEvent.keyDown(ta, { key: 'Tab' })
  await waitFor(() => expect(screen.getAllByTestId('hat')).toHaveLength(3))
})
it('Escape in text mode returns to hats, not close', async () => { /* hideTokeniserOverlay not called */ })
it('Cmd+A in hats mode enters text mode with everything selected', async () => { /* ta.selectionStart 0, selectionEnd ta.value.length */ })
it('a single click on the command enters text mode with the caret at that token', async () => { /* click 2nd token → selectionStart === tokenStart */ })
it('clicking the mode pill toggles modes', ...)
it('leaving text mode with empty text returns to the empty state', ...)
it('Cmd+C in text mode with no selection copies the whole text and stays open', async () => { /* copyToClipboard called with ta.value; hide not called */ })
it('Cmd+Enter in text mode copies and hides', ...)
it('plain Enter in text mode is not intercepted', async () => { /* keyDown Enter on ta → copyToClipboard not called, hide not called */ })
```

- [ ] **Step 2: Run to verify failure.** → FAIL.

- [ ] **Step 3: Implement.** `TextView`: on mount and whenever `selection` changes, focus and apply it (`select()` for `'all'`, `setSelectionRange(n, n)` for a number, caret to end for `null`); `onKeyDown`: `Tab`/`Escape` → `preventDefault`, `onLeave(value)`; `Cmd+Enter` → `onCopyClose(value)`; `Cmd+C` with `selectionStart === selectionEnd` → `preventDefault`, `onCopyStay(value)`; everything else native. Class list: same font, `leading-[2.5]`, `break-all`, `caret-amber-400`, transparent background. `App`: `Tab` and `Cmd+A` in hats mode → `enterText` (`null` / `'all'`), `onTextClick(offset)` → `enterText(offset)`; `TextView.onLeave` → `leaveText`.

- [ ] **Step 4: Run to verify pass.** → PASS.

- [ ] **Step 5: Commit** — `git commit -m "Add text mode to the Tokeniser overlay"`

---

### Task 8: Copy out, close, and reset on show

**Files:**
- Modify: `src/renderer/tokeniser/App.tsx`, `src/renderer/tokeniser/__tests__/App.test.tsx`

**Interfaces:**
- Consumes: `copyToClipboard`, `hideTokeniserOverlay`, `onTokeniserShown`.

- [ ] **Step 1: Write failing `App` tests:**

```ts
it('Enter in hats mode copies the full text then hides', async () => { render(<App />); await paste(); fireEvent.keyDown(overlay(), { key: 'Enter' }); await waitFor(() => expect(window.electronAPI.copyToClipboard).toHaveBeenCalledWith(CURL.trim())); expect(window.electronAPI.hideTokeniserOverlay).toHaveBeenCalled() })
it('Cmd+Enter in hats mode does the same', ...)
it('Cmd+C in hats mode copies, shows a toast and does not hide', async () => { /* toast has "Copied" */ })
it('the title bar copy buttons call the same two paths', ...)
it('Escape in hats mode hides without copying', ...)
it('Escape in the empty state hides', ...)
it('tokeniser:shown resets to empty, even mid-edit', async () => {
  let shown: () => void = () => {}; window.electronAPI.onTokeniserShown = vi.fn((cb) => { shown = cb; return () => {} })
  render(<App />); await paste(); fireEvent.keyDown(overlay(), { key: 'a' }); await screen.findByTestId('inline-editor')
  act(() => shown()); expect(screen.getByText('Paste a command')).toBeInTheDocument(); expect(screen.queryByTestId('inline-editor')).toBeNull()
})
it('the copy must finish before hide is requested', async () => { /* copyToClipboard returns a pending promise; hide not called until it resolves */ })
```

- [ ] **Step 2: Run to verify failure.** → FAIL.

- [ ] **Step 3: Implement.** `copyAndClose = async () => { await copyToClipboard(currentText(state)); await hideTokeniserOverlay() }`; `copyStay` copies then dispatches `{ type: 'notice', text: 'Copied' }`. Subscribe to `onTokeniserShown` in an effect and dispatch `reset`.

- [ ] **Step 4: Run to verify pass.** `npx vitest run src/renderer/tokeniser` → PASS.

- [ ] **Step 5: Commit** — `git commit -m "Copy out, close and reset-on-show for the Tokeniser overlay"`

---

### Task 9: Settings UI row and tray

**Files:**
- Modify: `src/renderer/manager/components/HotkeySettings.tsx:235-245`, `src/renderer/manager/components/__tests__/HotkeySettings.test.tsx`

- [ ] **Step 1: Update the failing tests.** In `HotkeySettings.test.tsx`: the "loads and displays" test also expects `getTokeniserHotkey` called and `screen.getByText('L')`; the labels test expects `'Open Tokeniser'`; the "Change shortcut" count becomes `6`. Add `window.electronAPI.getTokeniserHotkey = vi.fn().mockResolvedValue('CommandOrControl+Shift+L')` to its `beforeEach`.

- [ ] **Step 2: Run to verify failure.** `npx vitest run src/renderer/manager/components/__tests__/HotkeySettings.test.tsx` → FAIL on the count and label.

- [ ] **Step 3: Implement.** Add a `HotkeyRow` after the Toolkit row: `label="Open Tokeniser"`, `description="Global shortcut to toggle the tokeniser overlay"`, `getter={window.electronAPI.getTokeniserHotkey}`, `setter={window.electronAPI.setTokeniserHotkey}`.

- [ ] **Step 4: Run to verify pass.** → PASS. Then the full suite: `npm test` → all green (note: this rebuilds `better-sqlite3` for Node).

- [ ] **Step 5: Commit** — `git commit -m "Add the Tokeniser hotkey to settings"`

---

### Task 10: Run it

**Files:** none new.

- [ ] **Step 1: Launch.** `npm run dev` (restores the Electron native build). Confirm the tray shows "Open Tokeniser".
- [ ] **Step 2: Walk the spec's round trip** in the real overlay: `⌘⇧L` opens empty and focused; copy a multi-line curl in a terminal, `⌘V` in the overlay shows hats; type a hat, the token is selected and the hat letter is not inserted; change it, Enter, hats rescan; `Tab` into text mode, append a flag, `Tab` back; `⌘C` keeps it open with a toast; `Enter` closes and the terminal receives the edited command on `⌘V`; `⌘⇧L` again opens empty. Also paste a command with more than 26 targets and confirm two-letter hats narrow on the first letter, and open a JWT token's editor and confirm it wraps without horizontal scrolling.
- [ ] **Step 3: Fix anything found**, with a test for each fix, and commit.
- [ ] **Step 4: Final commit** if anything changed: `git commit -m "Tokeniser Editor increment 1: polish from manual run"`

---

## Self-review notes

- Spec coverage: opening/closing (T4, T8), paste (T4 IPC, T5, T6), tokenising (T1), hats incl. capacity and narrowing (T2, T5, T6), editing incl. select-all, preventDefault, rescan, whitespace collapse, edited ranges, wrapping editor (T3, T5, T6), text mode incl. all entry/exit paths and `Cmd+C` semantics (T7), copy-out paths and reset (T8), chrome and status strings (T6), settings row and tray (T4, T9), tests for `setup.ts` mocks (T4), node docblocks (T1–T4).
- Names used consistently: `reduce`, `initialState`, `currentText`, `applyTokenEdit`, `markEditedTokens`, `assignHats`, `hatMatch`, `showTokeniserOverlay`/`hideTokeniserOverlay`, channel `tokeniser:shown`, API `copyToClipboard`/`readClipboard`/`onTokeniserShown`.
- Review Focus items 1–5 each have a named test in T5, T5, T3/T5, T6, T8.
