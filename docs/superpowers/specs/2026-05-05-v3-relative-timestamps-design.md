# SFHS Basketball Stats — v3: Relative Timestamps Design Spec

**Date:** 2026-05-05
**Source of truth:** `requirement-v3.md`
**Relationship:** Delta update to `2026-05-04-web-basketball-stats-design.md` and `2026-05-04-requirements-v2-update-design.md`. No behavior from v1 or v2 is removed; only the additions below apply.

---

## 1. Goal

Add a single continuous **relative game clock** to the app. Tip-off is a deliberate user action that starts the clock at `00:00`; every subsequent command gets a per-entry elapsed timestamp. Downloaded logs carry these timestamps. A new Markdown recap download joins the existing CSV and TXT downloads.

Non-goals:
- No pause / resume (clock runs continuously from tip-off).
- No undo.
- No per-quarter clocks; single game-clock only.
- No CLI grammar changes.
- No changes to parser, event handlers, stats math, or persistence structure beyond the single `commandHistory` shape change.

## 2. Affected modules at a glance

| Module | Change type |
|---|---|
| `src/core/types.ts` | `GameState.commandHistory` element shape changes |
| `src/core/state.ts` | `commandHistory` initialized as empty array of new shape |
| `src/core/executor.ts` | Timestamp each appended history entry; set `startTime` via `Date.now()` |
| `src/core/clock.ts` (NEW) | `now()` and `formatElapsed(tMs)` helpers |
| `src/core/export.ts` | `toGameLogTxt` prefixes post-tip lines; `toCSV` prepends meta row; add `toMarkdownRecap` |
| `src/store/gameStore.ts` | `loadGame` sanity check tolerates the new entry shape |
| `src/ui/App.tsx` | Third download button "Download Recap"; filename pattern same |
| `src/ui/Header.tsx` (+ css) | Live `Clock: MM:SS` readout next to opponent; new `onDownloadRecap` prop |
| `src/ui/CommandHistory.tsx` | Handle new entry shape when rendering (extract `.line`) |
| `src/ui/panels/TimeoutQuarterPanel.tsx` | Tipoff button disables after tip-off, label changes to "Clock Running" |

Tests updated in lockstep; parity tests unaffected (they inspect stats fields, not history shape).

## 3. Detailed behavior

### 3.1 Data model

`commandHistory` changes from `string[]` to `Array<{ line: string; tMs: number | null }>`.

- `line` — raw CLI-grammar string, same as today.
- `tMs` — elapsed milliseconds since tip-off, or `null` if the command was logged before tip-off.

`GameState.startTime` remains `number | null` but now holds `Date.now()` (epoch ms) instead of `performance.now()`. Rationale: `Date.now()` survives page reload and `localStorage` roundtrip cleanly; a monotonic counter would reset on reload and break arithmetic.

`GameState.tipoff` remains `boolean`; semantics unchanged.

No other `GameState` field changes.

### 3.2 Executor timestamp logic

The existing executor signature is `execute(state: GameState, cmd: Command, rawLine: string): GameState`. The `withHistory` step appends `rawLine` to `state.commandHistory` with a freshly computed `tMs`:

```ts
function currentTMs(state: GameState): number | null {
  if (!state.tipoff || state.startTime === null) return null;
  return Math.max(0, Date.now() - state.startTime);
}

const withHistory: GameState = rawLine.trim() === ""
  ? state
  : {
      ...state,
      commandHistory: [
        ...state.commandHistory,
        { line: rawLine, tMs: currentTMs(state) },
      ],
    };
```

The `tip` command branch becomes:
```ts
case "tip": {
  if (withHistory.tipoff) return withHistory; // idempotent; already timestamped
  const now = Date.now();
  const tipped: GameState = { ...withHistory, tipoff: true, startTime: now };
  // The tip command's own history entry was appended via withHistory with
  // tMs: null (tipoff was still false). Re-stamp that last entry to tMs: 0.
  // We hard-code 0 rather than computing Date.now() - now because by definition
  // tip-off is t=0; this avoids any sub-millisecond positive drift.
  const h = [...tipped.commandHistory];
  if (h.length > 0 && h[h.length - 1].line === rawLine) {
    h[h.length - 1] = { ...h[h.length - 1], tMs: 0 };
  }
  return { ...tipped, commandHistory: h };
}
```

Here `rawLine` is the third parameter of `execute`. The match `h[h.length - 1].line === rawLine` is a belt-and-suspenders check — the previous append site is unconditional on non-blank input, so the last entry IS the tip command; the equality check just guards against future refactors.

All other command branches use the current `withHistory` state (which already appended the entry with `tMs` computed from the *prior* `state.tipoff`/`startTime`). Because `tipoff` and `startTime` only change on the first `tip` command, every other command sees consistent values.

Second `tip` press: state unchanged (existing behavior). The repeat command is logged with a current `tMs` (> 0), making it visible in the log that the user pressed it again.

Pre-tip-off `---` (quarter) and `-t` (timeout) entries get `tMs: null`. Post-tip-off ones get a non-negative elapsed value. No special casing needed.

**System clock skew caveat:** `Date.now()` is the wall clock, not monotonic. If the user's system clock jumps backward between tip-off and a later command, the raw delta would go negative; `Math.max(0, ...)` clamps it. Forward jumps (e.g. NTP correction) show as a temporary burst in `tMs`. For a single local stats app this is acceptable and matches the chosen `Date.now()` for reload survivability.

### 3.3 Clock helper (`src/core/clock.ts`, new)

Pure module, no React:

```ts
export function now(): number { return Date.now(); }

export function formatElapsed(tMs: number | null): string {
  if (tMs === null) return "--:--";
  const safe = Math.max(0, Math.floor(tMs / 1000));
  const mm = Math.floor(safe / 60).toString().padStart(2, "0");
  const ss = (safe % 60).toString().padStart(2, "0");
  return `+${mm}:${ss}`;
}
```

`formatElapsed` returns `--:--` for `null` (pre-tip) and `+MM:SS` for any numeric value. Minutes not capped — a game that runs past 60 minutes shows `+61:23`, which is fine for a local stats app.

The executor deliberately does NOT call `now()` from this module — it calls `Date.now()` directly — because injecting a test double for `now()` is easier than swapping module imports. Tests use `vi.useFakeTimers() + vi.setSystemTime(epoch)` to control `Date.now()`.

### 3.4 Export changes

**TXT (`toGameLogTxt`):** unchanged header line (`======================\n`). Each entry becomes:
- `tMs === null` → `"<line>\n"` (no prefix).
- `tMs >= 0` → `"+MM:SS  <line>\n"` (two spaces).

**CSV (`toCSV`):** prepend exactly one extra row above the existing header row:
- If `state.tipoff === true`: `Game Clock, +MM:SS` using `formatElapsed(Date.now() - state.startTime)`.
- Else: `Game Clock, --:--`.

Rationale for using live elapsed rather than the last entry's `tMs`: the exported file reflects the game clock at export moment, which matches what a scout opening the file mid-game expects.

After the meta row, the rest of the CSV is identical to v2.

**Markdown recap (`toMarkdownRecap(state)`, new):** returns a single string of the form:

```
# <OpponentName> — <YYYY-MM-DD>

**Game Clock at export:** +MM:SS
**Final Score:** SF <sfPoints> — <OpponentName> <opPoints>

## Stats

| Player | 2PM/2PA | 2P% | 3PM/3PA | 3P% | OR | DR | TO | STL | AST | BLK | FTM/FTA | FT% | +/- | Points |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Jackson | 1/2 | 50.0% | 0/0 | 0.0% | 0 | 1 | 0 | 0 | 0 | 0 | 0/0 | 0.0% | 0 | 2 |
...
| SF | ... |
| <OpponentName> | ... |

## Other Stats

- SF Points off turnovers: <sfPOT>
- OP Points off turnovers: <opPOT>
- SF Second Chance Points: <sfSP>
- OP Second Chance Points: <opSP>
- SF Missed Layups: <sfML>
- SF OffRTG: <value>
- OP OffRTG: <value>

## Timeline

| Time | Command |
| --- | --- |
| --:-- | -l jackson ayaan wes devin james |
| +00:00 | tip |
| +00:37 | jackson two make ayaan |
...
```

Rules:
- Opponent name pulled from `state.roster.find(p => p.id === "op")?.displayName ?? "OP"`.
- Date from today's date at export (same pattern as existing filename helper).
- Stats rows produced by reusing `computePlayerRow` and `computeTeamRow`.
- Timeline entries: one per `commandHistory` entry. `Time` column uses `formatElapsed(tMs)`.
- Pipe-escape the `line` field by replacing literal `|` with `\|`. Commands never contain newlines; no other escaping needed.

### 3.5 UI — live clock

**Header.tsx** gains one prop: `gameClockLabel: string` (a pre-formatted "Clock: --:--" or "Clock: MM:SS"). Why a pre-formatted string as a prop rather than raw ms: Header stays React-pure, and the ticking hook lives in `App.tsx` where all other store wiring lives.

**App.tsx** adds local state `clockTick: number` whose only purpose is to force a re-render every second while the clock is running. Implementation:

```ts
const [clockTick, setClockTick] = useState(0);
useEffect(() => {
  if (!state.tipoff) return;
  const id = setInterval(() => setClockTick((t) => t + 1), 1000);
  return () => clearInterval(id);
}, [state.tipoff]);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _tick = clockTick; // ensures re-render on tick
```

Dependency is `[state.tipoff]` only — no dependency on `clockTick` itself. The interval is cleared on unmount and whenever `tipoff` flips back to false (e.g. after New Game).

On each render App computes:
```ts
const elapsed = state.tipoff && state.startTime ? Date.now() - state.startTime : null;
const gameClockLabel = "Clock: " + formatElapsed(elapsed);
```

and passes `gameClockLabel` to `<Header>`.

**Edge case — reload after tip-off:** `Date.now() - state.startTime` correctly represents real elapsed time, because `startTime` is epoch ms and survives `localStorage` roundtrip.

**Edge case — New Game while clock is running:** New Game (via either `newGame` or `newGameWithLineup`) resets state via `createInitialState`, which produces `tipoff: false, startTime: null, commandHistory: []`. The `useEffect` dependency `state.tipoff` flips to false; the interval is cleaned up automatically. Header label reverts to `Clock: --:--`.

### 3.6 UI — Tipoff button disabled-after-press

**TimeoutQuarterPanel.tsx** gains one prop: `tipoffDone: boolean`. When true, the Tipoff button is disabled and its label changes to "Clock Running". Passed from App as `tipoffDone={state.tipoff}`.

### 3.7 UI — Download Recap button

**Header.tsx** gains one more prop: `onDownloadRecap: () => void`. A third button in the header alongside Download CSV and Download Log.

**App.tsx** adds `handleDownloadRecap`, mirroring the existing `handleDownloadCSV`/`handleDownloadLog` helpers:

```ts
const handleDownloadRecap = () => {
  const opLabel = state.roster.find(p => p.id === "op")?.displayName || "OP";
  downloadFile(`${opLabel}_${todayStr()}.md`, toMarkdownRecap(state), "text/markdown");
};
```

The filename pattern `{opLabel}_{YYYY-MM-DD}.md` matches the existing v2 CSV/TXT pattern (see v2 spec section 3.1, export filename fallback).

### 3.8 UI — CommandHistory shape change

`CommandHistory.tsx` renders `history: Array<{ line: string; tMs: number | null }>` instead of `string[]`. Rendering uses the `.line` field. Pre-formatting time on-screen is NOT required by v3; we'll still prepend `formatElapsed(tMs) + "  "` visually for parity with the log output — minimal extra work and it's nice UX.

### 3.9 Persistence

`loadGame()` in `src/store/gameStore.ts` currently accepts any object with a `rosterStats` field. The stricter shape of `commandHistory` is not checked at load time — if a stale v2 save is loaded, its history entries will be plain strings. We guard against runtime errors in `CommandHistory.tsx` and exporters with a normalizer:

```ts
function normalizeEntry(e: unknown): { line: string; tMs: number | null } {
  if (typeof e === "string") return { line: e, tMs: null };
  if (e && typeof e === "object" && "line" in e) return e as any;
  return { line: String(e ?? ""), tMs: null };
}
```

This normalizer lives next to `loadGame` and is applied there once, so downstream code can trust the shape. Any v2 save hydrating under v3 thus shows timestamps as `--:--` for pre-v3 entries.

## 4. Contracts and invariants

- `state.tipoff === true ⟹ state.startTime !== null`. Both are set together on the first `tip` command and are only cleared by New Game reset (via `createInitialState`). Never partially set.
- Every entry in `state.commandHistory` has shape `{ line: string; tMs: number | null }`. Enforced by the executor's single append site and the hydrate normalizer.
- `tMs` is non-negative when non-null (executor clamps with `Math.max(0, ...)`).
- `formatElapsed(null)` is the only source of the string `"--:--"` in the app.
- Clock ticks in the UI are purely derived from `state.startTime` and current `Date.now()`; no separately-stored "current elapsed" value anywhere.

## 5. Testing strategy

TDD, red → green → refactor.

### 5.1 Unit / core

- `tests/core/clock.test.ts` (new): `formatElapsed` cases — `0 → +00:00`, `37_000 → +00:37`, `312_000 → +05:12`, `1_123_000 → +18:43`, negative clamps to `+00:00`, `null → --:--`.

- `tests/core/executor.test.ts` (extend):
  - "pre-tip command gets tMs: null": dispatch any command before tip, assert history entry is `{ line, tMs: null }`.
  - "tip command entry has tMs: 0 and sets startTime":
    ```ts
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026,4,5,18,0,0));
    const s = execute(init(), parseCommand("tip", roster), "tip");
    expect(s.tipoff).toBe(true);
    expect(s.startTime).toBe(Date.now());
    expect(s.commandHistory.at(-1)).toEqual({ line: "tip", tMs: 0 });
    ```
  - "post-tip command carries the exact elapsed tMs":
    ```ts
    let s = execute(init(), parseCommand("tip", roster), "tip");
    vi.advanceTimersByTime(5_120);
    s = execute(s, parseCommand("jackson two make ayaan", s.roster), "jackson two make ayaan");
    expect(s.commandHistory.at(-1)?.tMs).toBe(5_120);
    ```
  - "second tip press is a no-op for state but still logged": confirm `startTime` unchanged after a second tip, and a new history entry exists.

- `tests/core/export.test.ts` (extend):
  - `toGameLogTxt`: pre-tip entry → no prefix; post-tip entry → starts with `+MM:SS  `.
  - `toCSV`: first row is `Game Clock, --:--` pre-tip; `Game Clock, +MM:SS` post-tip.
  - `toMarkdownRecap`: snapshot test against a small hand-authored state; asserts the presence of the four top-level sections (`# header`, `## Stats`, `## Other Stats`, `## Timeline`) and the correct opponent display name in the title.

- `tests/core/state.test.ts`: no change (initial history is an empty array either way).

### 5.2 Store

- `tests/store/gameStore.test.ts` (extend): a test that a legacy v2 localStorage blob with `commandHistory: string[]` normalizes on load so every entry has `tMs: null`.

### 5.3 Component

- `tests/ui/Header.test.tsx`: renders `Clock: --:--` when `tipoffDone=false` equivalent (i.e. when `gameClockLabel="Clock: --:--"`). Renders `Clock: +05:12` when passed that label. Download Recap button calls `onDownloadRecap`.

- `tests/ui/panels/TimeoutQuarterPanel.test.tsx`: Tipoff button disabled and labeled "Clock Running" when `tipoffDone=true`. Emits `tip` when enabled and clicked.

- `tests/ui/CommandHistory.test.tsx`: renders entries of the new shape; visually prefixes `+MM:SS` or `--:--` before the line.

### 5.4 Integration

- `tests/ui/App.integration.test.tsx`:
  - Full flow: new game → click Tip Off in TimeoutQuarterPanel → submit a shot → click Download Log → assert the captured TXT content has a `+00:00  tip` line and a post-tip shot line with a `+MM:SS ` prefix. Use `vi.useFakeTimers() + vi.setSystemTime()` and intercept the download as the v2 tests already do.
  - Header shows "Clock: +00:00" immediately after tip-off; advance fake timers by 5s and assert "Clock: +00:05".

### 5.5 Parity

Unchanged. The golden-file parity tests inspect only stat counters, not history entries. No edits to `tests/core/parity.test.ts` or the fixtures.

## 6. Migration and deploy

- No data migration required beyond the single-line hydrate normalizer in `gameStore.ts`.
- Rebuild the deploy zip after implementation; Cloudflare Pages redeployment is a drag-and-drop.

## 7. Out of scope (explicit)

- Pause / resume controls.
- Undo of the last command.
- Per-quarter clocks, sync to real basketball-period time.
- Absolute wall-clock timestamps.
- Editing entries after the fact.
