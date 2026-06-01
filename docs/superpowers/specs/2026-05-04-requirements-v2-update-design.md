# SFHS Basketball Stats — Requirements v2 Update Spec

**Date:** 2026-05-04
**Source of truth:** `requirement-v2.md`
**Relationship:** Delta update to `2026-05-04-web-basketball-stats-design.md`. Nothing in the v1 spec is discarded; only the behaviors described below change.

---

## 1. Goal

Enforce basketball-legal state and invalid-state prevention at the UI level, per `requirement-v2.md`:

1. Opponent name set at new-game, used verbatim everywhere (default: `"OP"`).
2. Block tracking merged back into the Shot flow; standalone BlockPanel removed.
3. Mandatory 5-player starting lineup on new-game.
4. Stat-entry pickers restricted to on-court players only.
5. Substitution legality enforced in the UI (player-in must be on bench; player-out must be on court).

Non-goals:
- No new CLI commands or parser changes. All grammar stays identical.
- No changes to core event handlers, executor, stats math, export format, or persistence format.

## 2. Affected modules at a glance

| Module | Change type |
|---|---|
| `src/core/state.ts` | Honor provided opponent displayName when seeding initial state |
| `src/core/stats.ts` | `displayName` pulled from roster, not derived from id |
| `src/ui/NewGameModal.tsx` (+ test) | New wording; mandatory 5-player picker; new callback signature |
| `src/ui/App.tsx` (+ integration test) | New-game flow submits `-l`; remove BlockPanel wiring; pass on-court list to panels; hydrate gate for legacy games; filename fallback becomes `OP` |
| `src/ui/panels/ShotPanel.tsx` (+ test) | Block merged in on opponent-miss; conditional pickers keyed by shooter team + result |
| `src/ui/panels/BlockPanel.tsx`, `BlockPanel.module.css`, `BlockPanel.test.tsx` | Deleted |
| `src/ui/panels/FreeThrowPanel.tsx` (+ test) | Roster filtered to on-court + `op` |
| `src/ui/panels/ReboundPanel.tsx` (+ test) | Same |
| `src/ui/panels/TurnoverPanel.tsx` (+ test) | Same, both primary and stealer pickers |
| `src/ui/panels/LineupPanel.tsx` (+ test) | Sub: player-in = bench only; player-out = on-court only. Set-full-lineup unchanged |
| `src/ui/StatsTable.tsx` | Uses roster displayName for opponent row |

## 3. Detailed behavior changes

### 3.1 Opponent name (Req 1 + Q3 + Q4 answers)

- NewGameModal label/prompt: `"Enter the opponent's name (optional)"`.
- Blank input:
  - Set `state.roster[op].displayName = "OP"`.
  - All UI surfaces (StatsTable, panels, history display) read the roster entry for display. They will show `"OP"` uniformly.
- Non-blank input: set `state.roster[op].displayName = trimmedInput`.
- Opponent id remains `"op"` (lowercase). Only the display name changes.
- `computePlayerRow` in `src/core/stats.ts` (currently at `stats.ts:55` using a `capitalizeFirst` helper) stops deriving `displayName` as `capitalizeFirst(id)` and instead returns `roster.find(p => p.id === id)?.displayName ?? capitalizeFirst(id)`. The fallback is defense-in-depth; under v2 the roster always contains every referenced id. This makes the StatsTable, CSV, and any other consumer automatically pick up the configured opponent name AND the editable roster player names.
- **Mid-game mutability: no.** Opponent name is set-once at new-game, not editable after. (Approved: Q3=A.)
- **Export filename fallback: `OP`.** The existing `handleDownloadCSV` / `handleDownloadLog` in `src/ui/App.tsx` build filenames as `${state.opponentName || "Stats"}_${YYYY-MM-DD}.csv/.txt`. Change this to derive from the roster entry: `const opLabel = state.roster.find(p => p.id === "op")?.displayName || "OP"; const filename = `${opLabel}_${YYYY-MM-DD}.csv/.txt`;`. That keeps a single source of truth and yields `OP_YYYY-MM-DD` when the user left the name blank. (Approved: Q4=A.)

### 3.1a `createInitialState` signature

The current signature is `createInitialState({ opponentName, roster })`. Under v2 the roster itself carries the opponent's display name on the `op` entry, so `opponentName` is redundant. Rather than thread a second parameter, we:

- Leave `createInitialState({ opponentName, roster })` signature unchanged for backward compatibility with existing tests.
- On construction, if `opponentName` is non-blank, set `state.roster[op].displayName = opponentName` in the returned state's roster copy. If blank, set it to `"OP"`. This is the single place the opponent's display name is seeded.
- `state.opponentName` remains a string field for filename backup, storage, and tests that inspect it. It holds the raw input (possibly empty).
- The reducer's `NEW_GAME` action already uses `createInitialState`; updating that function suffices.

### 3.2 Block merged into Shot (Req 2)

In `ShotPanel`:

- The secondary picker is one grid that changes identity based on shooter + result:
  - Shooter is **opponent (`op`)** + result is **miss** → `"Blocked by (optional)"` picker, showing **on-court SF players only** (`op` excluded).
  - Shooter is **SF** + result is **make** → `"Assist (optional)"` picker, showing **on-court SF players only** (`op` excluded).
  - All other combinations (SF miss, opponent make) → no secondary picker shown.
- Emission — one rule per shooter×result combination:
  - SF make + assist selected: `"<shooter> <shot> make <assist>"`.
  - SF make + no assist: `"<shooter> <shot> make"`.
  - SF miss: `"<shooter> <shot> miss"` (no secondary picker shown).
  - Opponent make: `"op <shot> make"` (no secondary picker shown).
  - Opponent miss + blocker selected: `"op <shot> miss <blocker>"`.
  - Opponent miss + no blocker: `"op <shot> miss"`.
- The parser already supports all of these shapes; no grammar change.

Standalone `BlockPanel` is removed along with its CSS and test.

### 3.3 Mandatory starting lineup (Req 3)

`NewGameModal` grows one step:

- Section 1 — opponent text input.
- Section 2 — starting lineup picker: a grid of SF roster players (exclude `op`). Selecting a player highlights them. Once 5 are selected, the remaining unselected player buttons are disabled (greyed out, non-clickable) until the user deselects one. This mirrors `LineupPanel`'s existing cap-at-5 UX exactly.
- "Start Game" button is disabled until **exactly 5** are selected. No warning-level enforcement; the button is simply unclickable.
- Callback signature changes:
  ```ts
  onConfirm: (opponentName: string, startingLineup: PlayerId[]) => void;
  ```
- On submit the App handler must apply "reset + seed lineup" atomically so `state.lineup.length === 5` is always true after the modal closes (Section 4 invariant). Because React's `useReducer` dispatches are applied synchronously but React re-renders asynchronously, back-to-back `newGame(name); submit("-l ...")` calls in an event handler DO accumulate within the same render in practice — React batches state updates, and the reducer sees `prev` state pass through both dispatches in order. However, to avoid relying on that batching behavior, we add a single reducer action that performs both steps:
  - New action: `{ type: "NEW_GAME_WITH_LINEUP"; opponentName: string; startingLineup: PlayerId[] }`.
  - Reducer handling: `const fresh = createInitialState({ opponentName, roster: state.roster }); return applyLineupChange(fresh, startingLineup);`.
  - Store hook exposes `newGameWithLineup(opponentName, startingLineup)`.
- App's confirm handler calls the new method exactly once, guaranteeing no transient state exists where lineup is empty.
- If the user clicks Cancel, the modal closes without any state change (same as today).

### 3.4 Stat pickers restricted to on-court (Req 4)

- App.tsx computes `onCourt = state.lineup` (always a `PlayerId[]` of exactly 5 SF ids once the hydrate gate at Section 3.6 has run).
- Each panel receives a new required prop `onCourt: PlayerId[]`. For unit tests that exercise a panel in isolation, the test can pass the full SF roster's ids. In production, App always passes `state.lineup`. The prop is required so no production code path can accidentally render a panel without filtering.
- Filtering rules per panel:
  - **ShotPanel** primary picker: `[...onCourt players, op]`. Shooter can be any of the 5 on-court SF players or the opponent.
  - **ShotPanel** secondary picker (assist or blocker): `on-court SF players` only; `op` excluded.
  - **FreeThrowPanel** player picker: `[...onCourt, op]`.
  - **ReboundPanel** player picker: `[...onCourt, op]`.
  - **TurnoverPanel** primary picker: `[...onCourt, op]`. Stealer picker: `[...onCourt, op]` minus the currently selected primary (same rule as existing "no self-steal").
  - **LineupPanel**: out of scope for this rule — it is the panel that defines what on-court means.
  - **PossessionPanel, TimeoutQuarterPanel**: no player picker, untouched.
- Bench players never appear for stat entry. Confirmed by tests.

### 3.5 Substitution legality (Req 5)

In `LineupPanel`:

- **Set Full Lineup** sub-section: unchanged. Continues to show all 16 SF players; picks exactly 5; emits `-l p1 p2 p3 p4 p5`. The executor's `applyLineupChange` already fully recalculates plus/minus, so the "bench/on-court fully recalculated" requirement is already met semantically.
- **Substitution** sub-section:
  - Player In picker: SF players **not in** `state.lineup`. Under v2 the hydrate gate guarantees `state.lineup.length === 5` while this panel is rendered, so no special-case for an under-5 lineup is needed.
  - Player Out picker: SF players **in** `state.lineup`.
  - Both grids exclude `op`.
  - The "Sub" button is disabled until both sides are selected. On submit emits `-s in out`.
- This makes illegal subs impossible at the UI level, matching v2's "not just rejected later" clause.

### 3.6 Hydrate gate for legacy games (Q2=A answer)

App.tsx opens NewGameModal on mount when **either**:
- No saved game exists (`loadGame() === null`), **or**
- A saved game exists but `state.lineup.length !== 5`.

This covers legacy games that pre-date v2. A legacy game being re-seeded will lose its prior stats, consistent with "new game = set lineup" (Approved: Q2=A). No migration path is implemented; users either finish their game before updating or accept the reset.

### 3.7 Quarter-break preservation (Q1=yes)

The executor currently preserves `state.lineup` through the `---` quarter break. This remains unchanged; pickers continue to work across quarters.

## 4. Contracts and invariants

- **The CLI grammar is unchanged.** No parser or executor edits.
- **A valid v2 game state always has `state.lineup.length === 5`** after the NewGameModal completes. This is now a UI-enforced invariant, not a runtime-checked one.
- **`state.roster[op].displayName`** is the single source of truth for the opponent's visible name; UI reads only from there, not from any external "opponent name" store.
- **On-court list is always exactly `state.lineup`.** Panels receive it as a required `onCourt` prop and never derive it from anywhere else. App is the only production caller and always passes `state.lineup`.
- **Bench = roster SF players \ `state.lineup`**, computed once per render at the panel level.

## 5. Testing strategy

TDD, red → green → refactor.

- **Unit/core:**
  - `stats.test.ts` — add case asserting `computePlayerRow` uses roster displayName (e.g., a roster with `{id: "op", displayName: "Mitty"}` produces a row with `displayName: "Mitty"`).
  - `state.test.ts` — no change required; the existing test uses `DEFAULT_ROSTER` which has `op → "Opponent"`. Optionally add a test asserting that a custom opponent displayName in roster survives `createInitialState`.
- **Component:**
  - `NewGameModal.test.tsx` — update to assert new prompt wording, lineup picker behavior, 5-selected-required rule, new callback signature.
  - `ShotPanel.test.tsx` — update to cover: opponent-miss shows "Blocked by" picker (on-court SF only); SF-make shows "Assist"; other combos show no secondary picker.
  - `FreeThrowPanel`, `ReboundPanel`, `TurnoverPanel` tests — add a case where `onCourt` prop restricts the grid.
  - `LineupPanel.test.tsx` — Sub picker filters in/out correctly.
  - `BlockPanel.test.tsx` — deleted.
- **Integration:**
  - `App.integration.test.tsx` — update the new-game flow to also pick 5 starting players; submit a shot; verify the on-court filtering actually excludes a bench player in a panel grid.
  - Add an assertion that setting a non-blank opponent name in the modal flows through to StatsTable (opponent row displayName) AND to the filename passed to `downloadFile` (via a spy on `URL.createObjectURL` or a module-level mock of `downloadFile`).

All 122 currently-passing tests must either continue to pass or be edited to reflect the new behavior. No test is deleted except `BlockPanel.test.tsx`.

## 6. Migration and deploy

- README and DEPLOYMENT.md do not need edits; the build and deploy steps are unchanged.
- After implementation: regenerate `sfhs-basketball-stats.zip` and redeploy to Cloudflare Pages.

## 7. Open items deferred out of scope

- Editing the opponent name mid-game (intentionally excluded per Q3=A).
- A dedicated "Set Starting Lineup" modal for preserving prior stats on legacy games (intentionally excluded per Q2=A).
- Post-timeout lineup prompt (v1 executor appends `-t` and shows a reminder; v2 does not require more than that).
- Phone-layout polish for the enlarged NewGameModal.
