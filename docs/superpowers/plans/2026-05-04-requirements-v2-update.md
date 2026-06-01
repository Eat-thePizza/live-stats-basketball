# Requirements v2 Update — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the SFHS Basketball Stats web app to enforce basketball-legal game state per `requirement-v2.md`: opponent name everywhere, block merged back into shot flow, mandatory 5-player starting lineup, stat pickers limited to on-court players, and substitution legality enforced at the UI level.

**Architecture:** The CLI grammar, parser, executor, and event handlers stay unchanged. All changes are concentrated in `src/core/state.ts`, `src/core/stats.ts`, `src/store/gameStore.ts`, and the UI layer (`src/ui/**`). The opponent's display name is carried by the `op` roster entry (single source of truth). Panels receive a required `onCourt: PlayerId[]` prop and filter their pickers accordingly. A new atomic reducer action `NEW_GAME_WITH_LINEUP` guarantees there is never a transient state with an empty lineup.

**Tech Stack:** Unchanged from v1 — React 18, TypeScript, Vite, Vitest, CSS Modules.

**Spec:** `docs/superpowers/specs/2026-05-04-requirements-v2-update-design.md`

---

## File Structure Changes

```
src/core/state.ts                        MODIFY — seed roster[op].displayName
src/core/stats.ts                        MODIFY — displayName from roster lookup
src/store/gameStore.ts                   MODIFY — add NEW_GAME_WITH_LINEUP action
src/ui/App.tsx                           MODIFY — rewire new-game + remove BlockPanel + pass onCourt
src/ui/NewGameModal.tsx                  MODIFY — mandatory 5-player picker, new callback
src/ui/NewGameModal.module.css           MODIFY — lineup-picker styling
src/ui/StatsTable.tsx                    (no code change — gets v2 behavior automatically via stats.ts)
src/ui/panels/ShotPanel.tsx              MODIFY — 6-branch emission; block on opponent-miss
src/ui/panels/FreeThrowPanel.tsx         MODIFY — required onCourt prop
src/ui/panels/ReboundPanel.tsx           MODIFY — required onCourt prop
src/ui/panels/TurnoverPanel.tsx          MODIFY — required onCourt prop
src/ui/panels/LineupPanel.tsx            MODIFY — sub legality
src/ui/panels/types.ts                   MODIFY — add onCourt to PanelProps
src/ui/panels/BlockPanel.tsx             DELETE
src/ui/panels/BlockPanel.module.css      DELETE
tests/ui/panels/BlockPanel.test.tsx      DELETE

tests/core/stats.test.ts                 MODIFY — opponent displayName assertion
tests/store/gameStore.test.ts            MODIFY — add newGameWithLineup test
tests/ui/NewGameModal.test.tsx           MODIFY — mandatory lineup test
tests/ui/panels/ShotPanel.test.tsx       MODIFY — restore block-on-opponent-miss + new branches
tests/ui/panels/FreeThrowPanel.test.tsx  MODIFY — onCourt filter
tests/ui/panels/ReboundPanel.test.tsx    MODIFY — onCourt filter
tests/ui/panels/TurnoverPanel.test.tsx   MODIFY — onCourt filter
tests/ui/panels/LineupPanel.test.tsx     MODIFY — sub in/out filter
tests/ui/App.integration.test.tsx        MODIFY — new-game flow, opponent name flow
```

---

## Task 1: Core — opponent displayName + stats lookup

**Files:**
- Modify: `src/core/state.ts`
- Modify: `src/core/stats.ts`
- Test: `tests/core/state.test.ts` (add one case)
- Test: `tests/core/stats.test.ts` (add one case)

### Background

Today `createInitialState({ opponentName, roster })` stores `opponentName` as a string field and leaves the roster untouched. Under v2 the roster's `op` entry carries the displayed opponent name as its `displayName`. `computePlayerRow` in `stats.ts` derives the display name from the id using a local `capitalizeFirst` helper.

### Changes

**`src/core/state.ts`:** After building `rosterStats`, produce a roster copy whose `op` entry has `displayName` set to:
- the trimmed `args.opponentName` when non-blank, or
- `"OP"` (uppercase) when blank.

The `state.opponentName` field keeps the raw input (possibly empty) as it is today — callers may still read it, but it is no longer authoritative for display.

**`src/core/stats.ts`:** `computePlayerRow(state, playerId)` returns `displayName = state.roster.find(p => p.id === playerId)?.displayName ?? capitalizeFirst(playerId)`. No other changes.

### Steps

- [ ] **Step 1:** Add failing test to `tests/core/state.test.ts`:
  ```ts
  import { DEFAULT_ROSTER } from "@/core/roster";
  import { createInitialState } from "@/core/state";

  it("stores opponent displayName on roster[op] from opponentName input", () => {
    const withName = createInitialState({ opponentName: "Mitty", roster: DEFAULT_ROSTER });
    expect(withName.roster.find(p => p.id === "op")?.displayName).toBe("Mitty");

    const blank = createInitialState({ opponentName: "", roster: DEFAULT_ROSTER });
    expect(blank.roster.find(p => p.id === "op")?.displayName).toBe("OP");

    const padded = createInitialState({ opponentName: "  Bellarmine  ", roster: DEFAULT_ROSTER });
    expect(padded.roster.find(p => p.id === "op")?.displayName).toBe("Bellarmine");
  });
  ```

- [ ] **Step 2:** Add failing test to `tests/core/stats.test.ts`:
  ```ts
  it("computePlayerRow uses roster.displayName for op", () => {
    const s = createInitialState({ opponentName: "Mitty", roster: DEFAULT_ROSTER });
    const row = computePlayerRow(s, "op");
    expect(row.displayName).toBe("Mitty");
  });

  it("computePlayerRow falls back to capitalized id when roster entry missing", () => {
    const s = createInitialState({ opponentName: "", roster: DEFAULT_ROSTER });
    const trimmed = { ...s, roster: s.roster.filter(p => p.id !== "jackson") };
    const row = computePlayerRow(trimmed, "jackson");
    expect(row.displayName).toBe("Jackson");
  });
  ```

- [ ] **Step 3:** Run `npm run test -- state stats` — verify new cases FAIL.

- [ ] **Step 4:** Edit `src/core/state.ts`. At the top of `createInitialState` build a new roster array that overrides the `op` entry's displayName. Keep the signature unchanged.
  ```ts
  export function createInitialState(args: { opponentName: string; roster: Roster }): GameState {
    const trimmedOpName = args.opponentName.trim();
    const opDisplay = trimmedOpName === "" ? "OP" : trimmedOpName;
    const roster: Roster = args.roster.map(p =>
      p.id === "op" ? { ...p, displayName: opDisplay } : p,
    );
    const rosterStats: RosterStats = {};
    for (const p of roster) rosterStats[p.id] = new Array(14).fill(0);
    return {
      opponentName: args.opponentName,
      roster,
      rosterStats,
      sfPoints: 0, opPoints: 0,
      sfPOT: 0, opPOT: 0,
      sfSP: 0, opSP: 0,
      sfML: 0,
      sfPOSS: 0, opPOSS: 0,
      possession: null,
      previousTurnover: false,
      secondChance: false,
      lineup: [],
      tipoff: false,
      startTime: null,
      commandHistory: [],
      createdAt: Date.now(),
    };
  }
  ```

- [ ] **Step 5:** Edit `src/core/stats.ts::computePlayerRow`. Replace the `displayName` line with:
  ```ts
  const displayName = state.roster.find(p => p.id === playerId)?.displayName ?? capitalizeFirst(playerId);
  ```
  Keep `capitalizeFirst` as the fallback helper.

- [ ] **Step 6:** Run `npm run test` — all tests pass.

- [ ] **Step 7:** Run `npx tsc --noEmit` — clean.

- [ ] **Step 8:** Commit:
  ```bash
  git add src/core/state.ts src/core/stats.ts tests/core/state.test.ts tests/core/stats.test.ts
  git commit -m "feat(core): carry opponent display name on roster[op]"
  ```

---

## Task 2: Store — `NEW_GAME_WITH_LINEUP` atomic action

**Files:**
- Modify: `src/store/gameStore.ts`
- Test: `tests/store/gameStore.test.ts` (add one case)

### Changes

Add a new reducer action and a hook method that runs both reset and lineup-seed in one dispatch, avoiding any transient empty-lineup window.

### Steps

- [ ] **Step 1:** Add failing test to `tests/store/gameStore.test.ts`:
  ```ts
  it("newGameWithLineup() resets state and seeds the lineup atomically", () => {
    const { result } = renderHook(() => useGameStore());
    act(() => {
      result.current.newGameWithLineup("Mitty", ["jackson","ayaan","wes","devin","james"]);
    });
    expect(result.current.state.opponentName).toBe("Mitty");
    expect(result.current.state.roster.find(p => p.id === "op")?.displayName).toBe("Mitty");
    expect(result.current.state.lineup).toEqual(["jackson","ayaan","wes","devin","james"]);
  });
  ```

- [ ] **Step 2:** Run `npm run test -- gameStore` — FAIL.

- [ ] **Step 3:** Edit `src/store/gameStore.ts`:
  - Add to the `Action` union: `| { type: "NEW_GAME_WITH_LINEUP"; opponentName: string; startingLineup: PlayerId[] }`.
  - Import `applyLineupChange` from `@/core/events`.
  - Add a reducer branch:
    ```ts
    case "NEW_GAME_WITH_LINEUP": {
      const fresh = createInitialState({ opponentName: action.opponentName, roster: state.roster });
      return applyLineupChange(fresh, action.startingLineup);
    }
    ```
  - In `useGameStore`, add `newGameWithLineup` to the returned object:
    ```ts
    newGameWithLineup: (opponentName: string, startingLineup: PlayerId[]) =>
      dispatch({ type: "NEW_GAME_WITH_LINEUP", opponentName, startingLineup }),
    ```
  - Export the return-type interface (`UseGameStore`) so TS consumers get completion.

- [ ] **Step 4:** Run `npm run test` — all pass. `npx tsc --noEmit` clean.

- [ ] **Step 5:** Commit:
  ```bash
  git add src/store/gameStore.ts tests/store/gameStore.test.ts
  git commit -m "feat(store): add NEW_GAME_WITH_LINEUP atomic action"
  ```

---

## Task 3: UI — `PanelProps` requires `onCourt`

**Files:**
- Modify: `src/ui/panels/types.ts`

### Changes

Add `onCourt: PlayerId[]` as a required field on `PanelProps`. This task is a type-only change — it WILL produce TS errors in every panel and every test file until Tasks 4–8 update them. That's intentional: doing this first makes the TypeScript compiler a to-do list for us.

### Steps

- [ ] **Step 1:** Edit `src/ui/panels/types.ts`:
  ```ts
  import type { Roster, PlayerId } from "@/core/types";
  export interface PanelProps {
    roster: Roster;
    onCourt: PlayerId[];
    onSubmit: (line: string) => void;
  }
  ```

- [ ] **Step 2:** Run `npx tsc --noEmit` — should report errors in all seven current panels and their tests, plus `App.tsx`. This confirms the scope of the refactor.

- [ ] **Step 3:** Commit the type change in isolation so subsequent commits reference a clear "before" state. The build will be broken between this commit and Task 9. That's OK — subagents execute tasks sequentially, and this is an intermediate state not a release.
  ```bash
  git add src/ui/panels/types.ts
  git commit -m "refactor(ui): require onCourt prop on PanelProps (wip)"
  ```

  Note: `npm run build` will fail until Task 9. Do NOT run it here.

---

## Task 4: UI — ShotPanel merged block flow + onCourt

**Files:**
- Modify: `src/ui/panels/ShotPanel.tsx`
- Test: `tests/ui/panels/ShotPanel.test.tsx`

### Changes

ShotPanel's primary shooter picker shows `[...onCourt SF players, op]`. The secondary picker:
- If shooter is SF and result is `make` → "Assist (optional)", on-court SF players only (exclude `op`).
- If shooter is `op` and result is `miss` → "Blocked by (optional)", on-court SF players only (exclude `op`).
- Otherwise not rendered.

Emission branches (exact 6 from spec section 3.2):
- SF make + assist: `"<shooter> <shot> make <assist>"`
- SF make, no assist: `"<shooter> <shot> make"`
- SF miss: `"<shooter> <shot> miss"`
- op make: `"op <shot> make"`
- op miss + blocker: `"op <shot> miss <blocker>"`
- op miss, no blocker: `"op <shot> miss"`

### Steps

- [ ] **Step 1:** Replace `tests/ui/panels/ShotPanel.test.tsx` with:
  ```ts
  import { describe, it, expect, vi } from "vitest";
  import { render, screen } from "@testing-library/react";
  import userEvent from "@testing-library/user-event";
  import ShotPanel from "@/ui/panels/ShotPanel";
  import { DEFAULT_ROSTER } from "@/core/roster";

  const onCourt = ["jackson", "ayaan", "wes", "devin", "james"];

  function pickFirst(name: RegExp) {
    return screen.getAllByRole("button", { name })[0];
  }
  function pickLast(name: RegExp) {
    const all = screen.getAllByRole("button", { name });
    return all[all.length - 1];
  }

  describe("ShotPanel (v2)", () => {
    it("SF make with assist emits '<shooter> <shot> make <assist>'", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      render(<ShotPanel roster={DEFAULT_ROSTER} onCourt={onCourt} onSubmit={onSubmit} />);
      await user.click(pickFirst(/^jackson$/i));
      await user.click(screen.getByRole("button", { name: /^two$/i }));
      await user.click(screen.getByRole("button", { name: /^make$/i }));
      await user.click(pickLast(/^ayaan$/i));
      await user.click(screen.getByRole("button", { name: /log shot/i }));
      expect(onSubmit).toHaveBeenCalledWith("jackson two make ayaan");
    });

    it("SF make without assist emits '<shooter> <shot> make'", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      render(<ShotPanel roster={DEFAULT_ROSTER} onCourt={onCourt} onSubmit={onSubmit} />);
      await user.click(pickFirst(/^jackson$/i));
      await user.click(screen.getByRole("button", { name: /^three$/i }));
      await user.click(screen.getByRole("button", { name: /^make$/i }));
      await user.click(screen.getByRole("button", { name: /log shot/i }));
      expect(onSubmit).toHaveBeenCalledWith("jackson three make");
    });

    it("SF miss emits '<shooter> <shot> miss' with no secondary picker shown", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      render(<ShotPanel roster={DEFAULT_ROSTER} onCourt={onCourt} onSubmit={onSubmit} />);
      await user.click(pickFirst(/^jackson$/i));
      await user.click(screen.getByRole("button", { name: /^two$/i }));
      await user.click(screen.getByRole("button", { name: /^miss$/i }));
      expect(screen.queryByText(/assist/i)).toBeNull();
      expect(screen.queryByText(/blocked by/i)).toBeNull();
      await user.click(screen.getByRole("button", { name: /log shot/i }));
      expect(onSubmit).toHaveBeenCalledWith("jackson two miss");
    });

    it("Opponent make emits 'op <shot> make' with no secondary picker", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      render(<ShotPanel roster={DEFAULT_ROSTER} onCourt={onCourt} onSubmit={onSubmit} />);
      await user.click(pickFirst(/^op$/i));
      await user.click(screen.getByRole("button", { name: /^two$/i }));
      await user.click(screen.getByRole("button", { name: /^make$/i }));
      expect(screen.queryByText(/assist/i)).toBeNull();
      expect(screen.queryByText(/blocked by/i)).toBeNull();
      await user.click(screen.getByRole("button", { name: /log shot/i }));
      expect(onSubmit).toHaveBeenCalledWith("op two make");
    });

    it("Opponent miss with blocker emits 'op <shot> miss <blocker>'", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      render(<ShotPanel roster={DEFAULT_ROSTER} onCourt={onCourt} onSubmit={onSubmit} />);
      await user.click(pickFirst(/^op$/i));
      await user.click(screen.getByRole("button", { name: /^three$/i }));
      await user.click(screen.getByRole("button", { name: /^miss$/i }));
      await user.click(pickLast(/^jackson$/i));
      await user.click(screen.getByRole("button", { name: /log shot/i }));
      expect(onSubmit).toHaveBeenCalledWith("op three miss jackson");
    });

    it("Opponent miss without blocker emits 'op <shot> miss'", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      render(<ShotPanel roster={DEFAULT_ROSTER} onCourt={onCourt} onSubmit={onSubmit} />);
      await user.click(pickFirst(/^op$/i));
      await user.click(screen.getByRole("button", { name: /^two$/i }));
      await user.click(screen.getByRole("button", { name: /^miss$/i }));
      await user.click(screen.getByRole("button", { name: /log shot/i }));
      expect(onSubmit).toHaveBeenCalledWith("op two miss");
    });

    it("primary picker shows only on-court SF players plus op", () => {
      render(<ShotPanel roster={DEFAULT_ROSTER} onCourt={onCourt} onSubmit={() => {}} />);
      // 'drew' is in DEFAULT_ROSTER but not onCourt → should not appear as a shooter button
      expect(screen.queryByRole("button", { name: /^drew$/i })).toBeNull();
      // all 5 on-court players AND op should render
      for (const id of [...onCourt, "op"]) {
        expect(screen.getAllByRole("button", { name: new RegExp(`^${id}$`, "i")}).length).toBeGreaterThan(0);
      }
    });
  });
  ```

- [ ] **Step 2:** Run `npm run test -- ShotPanel` — FAIL.

- [ ] **Step 3:** Rewrite `src/ui/panels/ShotPanel.tsx`. The component computes `sfOnCourt = roster.filter(p => onCourt.includes(p.id) && p.id !== "op")` and `shooterOptions = roster.filter(p => onCourt.includes(p.id) || p.id === "op")`. Render:
  - Primary player picker from `shooterOptions`.
  - Shot type row (two/three/layup) as today.
  - Result row (make/miss) as today.
  - Secondary picker: shown only when `(player !== "op" && result === "make")` (label "Assist (optional)") OR `(player === "op" && result === "miss")` (label "Blocked by (optional)"). Its grid is always `sfOnCourt`.
  - When the user changes result or shooter such that the secondary picker would be hidden, clear the secondary selection (follow the existing `handleResult` pattern but also clear on shooter change).
  - Submit builds the string per the 6-branch table and calls `onSubmit`, then resets.

- [ ] **Step 4:** Run `npm run test -- ShotPanel` — PASS (all 7 tests).

- [ ] **Step 5:** Commit:
  ```bash
  git add src/ui/panels/ShotPanel.tsx tests/ui/panels/ShotPanel.test.tsx
  git commit -m "feat(ui): merge block into ShotPanel; filter by on-court"
  ```

---

## Task 5: UI — FreeThrow / Rebound / Turnover panels filtered

**Files:**
- Modify: `src/ui/panels/FreeThrowPanel.tsx`, `ReboundPanel.tsx`, `TurnoverPanel.tsx`
- Test: `tests/ui/panels/FreeThrowPanel.test.tsx`, `ReboundPanel.test.tsx`, `TurnoverPanel.test.tsx`

### Changes

Each of these panels now accepts `onCourt: PlayerId[]` via `PanelProps`. Each panel's player picker(s) show only `onCourt ∪ {op}`. Turnover's stealer picker additionally excludes the currently selected primary.

### Steps

- [ ] **Step 1:** Update each test file to pass `onCourt={["jackson","ayaan","wes","devin","james"]}` to the panel and add one new case per panel asserting a bench player does NOT appear:
  ```ts
  it("does not render bench players", () => {
    render(<Panel roster={DEFAULT_ROSTER} onCourt={["jackson","ayaan","wes","devin","james"]} onSubmit={() => {}} />);
    expect(screen.queryByRole("button", { name: /^drew$/i })).toBeNull();
  });
  ```
  Update existing happy-path assertions to click `pickFirst(/^jackson$/i)` etc. — jackson is in the on-court list above, so these still work.

- [ ] **Step 2:** Run each test file — FAIL.

- [ ] **Step 3:** For each panel source file, add a derived array `const options = roster.filter(p => onCourt.includes(p.id) || p.id === "op");` and use it where the panel currently iterates `roster`.
  - `TurnoverPanel`'s stealer picker: also filter `p.id !== selectedPrimaryId` so the same player can't be both turnover-committer and stealer.

- [ ] **Step 4:** Run tests — PASS.

- [ ] **Step 5:** Commit:
  ```bash
  git add src/ui/panels/FreeThrowPanel.tsx src/ui/panels/ReboundPanel.tsx src/ui/panels/TurnoverPanel.tsx tests/ui/panels/FreeThrowPanel.test.tsx tests/ui/panels/ReboundPanel.test.tsx tests/ui/panels/TurnoverPanel.test.tsx
  git commit -m "feat(ui): filter stat pickers to on-court players"
  ```

---

## Task 6: UI — LineupPanel sub legality

**Files:**
- Modify: `src/ui/panels/LineupPanel.tsx`
- Test: `tests/ui/panels/LineupPanel.test.tsx`

### Changes

- Accept `onCourt: PlayerId[]` via PanelProps.
- **Set Full Lineup sub-section:** unchanged. Continues to show all 16 SF players.
- **Substitution sub-section:**
  - Player In picker: SF players NOT in `onCourt`. Exclude `op`.
  - Player Out picker: SF players IN `onCourt`. Exclude `op`.
  - Sub button disabled until both picked. Emits `-s in out`.

### Steps

- [ ] **Step 1:** Update `tests/ui/panels/LineupPanel.test.tsx`:
  - Pass `onCourt={["jackson","ayaan","wes","devin","james"]}`.
  - Add a test asserting the Sub "Player In" group does NOT show any of jackson/ayaan/wes/devin/james and DOES show at least `drew`.
  - Add a test asserting the Sub "Player Out" group shows jackson/ayaan/wes/devin/james and does NOT show `drew`.
  - Keep the existing "Set Full Lineup" tests working (they use `roster`, not `onCourt`).

- [ ] **Step 2:** Run `npm run test -- LineupPanel` — FAIL.

- [ ] **Step 3:** Edit `src/ui/panels/LineupPanel.tsx`. Derive `subIn = roster.filter(p => p.id !== "op" && !onCourt.includes(p.id))` and `subOut = roster.filter(p => p.id !== "op" && onCourt.includes(p.id))` and use those in the Sub sub-section grids. Set Full Lineup is unchanged.

- [ ] **Step 4:** Run tests — PASS.

- [ ] **Step 5:** Commit:
  ```bash
  git add src/ui/panels/LineupPanel.tsx tests/ui/panels/LineupPanel.test.tsx
  git commit -m "feat(ui): enforce substitution legality in LineupPanel"
  ```

---

## Task 7: UI — NewGameModal mandatory starting lineup

**Files:**
- Modify: `src/ui/NewGameModal.tsx`
- Modify: `src/ui/NewGameModal.module.css`
- Test: `tests/ui/NewGameModal.test.tsx`

### Changes

New callback signature: `onConfirm: (opponentName: string, startingLineup: PlayerId[]) => void`.

Modal now has two sections:
- Opponent text input (prompt: `"Enter the opponent's name (optional)"`).
- Starting lineup picker: 16 SF player buttons. Selected ones are highlighted. Once 5 are selected, unselected buttons become disabled (`disabled` attribute, visibly greyed). Selecting an already-selected button deselects it.

"Start Game" button is disabled until `lineup.length === 5`.

The modal needs access to the current roster to render the 16 SF buttons. Add a new required prop `roster: Roster`.

### Steps

- [ ] **Step 1:** Rewrite `tests/ui/NewGameModal.test.tsx` with cases covering:
  - Renders nothing when closed (existing).
  - Renders the new prompt text `/enter the opponent's name \(optional\)/i`.
  - Start Game button is disabled when 0 players selected.
  - Start Game button stays disabled at 4 players selected.
  - Selecting a 6th player: the button is disabled (no click → no selection change). Confirm by asserting that clicking a non-selected button while 5 are selected doesn't cause it to become selected; specifically, the button has the `disabled` attribute.
  - Clicking Start Game with 5 selected and no opponent text calls `onConfirm("", [id1,id2,id3,id4,id5])`.
  - Clicking Start Game with 5 selected and typed opponent name calls `onConfirm("Mitty", [..5 ids..])`.
  - Cancel still fires `onCancel`.
  - Escape key fires `onCancel`.

  Use `DEFAULT_ROSTER` and pick the first 5 SF ids. Assert the Start Game button's `disabled` attribute via `(submitBtn as HTMLButtonElement).disabled`.

- [ ] **Step 2:** Run the tests — FAIL.

- [ ] **Step 3:** Rewrite `src/ui/NewGameModal.tsx`. Major points:
  - Import `Roster, PlayerId` from `@/core/types`.
  - New interface:
    ```ts
    export interface NewGameModalProps {
      open: boolean;
      roster: Roster;
      onConfirm: (opponentName: string, startingLineup: PlayerId[]) => void;
      onCancel: () => void;
    }
    ```
  - Internal state: `name: string`, `lineup: Set<PlayerId>` (or `PlayerId[]`; pick one and be consistent).
  - Render order: prompt label, text input (auto-focused), lineup-picker header "Starting Lineup (5 required)", grid of SF-only buttons (exclude `op`), then "Start Game" and "Cancel" buttons. Start Game is disabled unless `lineup.size === 5`.
  - Clicking a selected player toggles it off. Clicking an unselected player: only if `lineup.size < 5`, add it; otherwise no-op (button is also `disabled`).
  - On submit: `onConfirm(name.trim(), [...lineup])`. Ordering within the array can be SF-roster order (natural) — do `roster.filter(p => lineup.has(p.id)).map(p => p.id)` to produce a stable order.
  - Keep Enter submitting (but ONLY when Start Game is enabled) and Escape cancelling.
  - Reset internal state on `open` transition `false → true`.

- [ ] **Step 4:** Update `src/ui/NewGameModal.module.css` to add a `.lineupGrid` style with grid-template-columns around 3–4 columns for comfortable clicking. Keep the existing dialog styling.

- [ ] **Step 5:** Run the tests — PASS.

- [ ] **Step 6:** Commit:
  ```bash
  git add src/ui/NewGameModal.tsx src/ui/NewGameModal.module.css tests/ui/NewGameModal.test.tsx
  git commit -m "feat(ui): mandatory 5-player starting lineup in NewGameModal"
  ```

---

## Task 8: UI — Remove standalone BlockPanel

**Files:**
- Delete: `src/ui/panels/BlockPanel.tsx`
- Delete: `src/ui/panels/BlockPanel.module.css`
- Delete: `tests/ui/panels/BlockPanel.test.tsx`

### Steps

- [ ] **Step 1:** Remove the three files:
  ```bash
  git rm src/ui/panels/BlockPanel.tsx src/ui/panels/BlockPanel.module.css tests/ui/panels/BlockPanel.test.tsx
  ```

- [ ] **Step 2:** Run `npm run test` — the only failures should now be integration tests and App.test that still reference BlockPanel; that's addressed in Task 9.

- [ ] **Step 3:** Commit:
  ```bash
  git commit -m "refactor(ui): remove standalone BlockPanel (merged into ShotPanel)"
  ```

---

## Task 9: UI — Wire App to v2 (new-game + onCourt + no BlockPanel + filename)

**Files:**
- Modify: `src/ui/App.tsx`
- Test: `tests/ui/App.integration.test.tsx`
- Test: `tests/ui/App.test.tsx` (adjust if it currently references BlockPanel)

### Changes

- Remove `import BlockPanel` and the `<details>Block</details>` entry from the panels slot.
- Replace the `newGame(...)` call inside the NewGameModal confirm handler with `newGameWithLineup(opponentName, startingLineup)`.
- Pass `roster={state.roster}` to `<NewGameModal ... />`.
- Compute `const onCourt = state.lineup;` once per render. Pass `onCourt={onCourt}` to every panel.
- Update the hydrate gate so the modal opens if there is no saved game OR `state.lineup.length !== 5`:
  ```ts
  const [newGameOpen, setNewGameOpen] = useState<boolean>(() => {
    const loaded = loadGame();
    return loaded === null || loaded.lineup.length !== 5;
  });
  ```
  Also re-open the modal reactively if `state.lineup` is not 5 AFTER a hydrate — in practice the initializer covers this since `loadGame()` is called once; the only way `state.lineup.length` drops below 5 during a session is a SET_ROSTER or some unusual mutation, which we don't need to handle defensively here.
- Change the download filename source from `state.opponentName || "Stats"` to the opponent's displayName on the roster, falling back to `"OP"`:
  ```ts
  const opLabel = state.roster.find(p => p.id === "op")?.displayName || "OP";
  downloadFile(`${opLabel}_${todayStr()}.csv`, toCSV(state), "text/csv");
  ```

### Steps

- [ ] **Step 1:** Update `tests/ui/App.integration.test.tsx` to add a helper that:
  ```ts
  async function completeNewGameModal(user: ReturnType<typeof userEvent.setup>, opts: { name?: string; lineup?: string[] } = {}) {
    const { name = "", lineup = ["jackson","ayaan","wes","devin","james"] } = opts;
    if (name) await user.type(screen.getByLabelText(/opponent/i), name);
    for (const id of lineup) {
      // starting-lineup grid buttons, distinct from later panel buttons
      await user.click(screen.getAllByRole("button", { name: new RegExp(`^${id}$`, "i") })[0]);
    }
    await user.click(screen.getByRole("button", { name: /start game/i }));
  }
  ```

  Replace both existing integration tests' `click(start game)` with `await completeNewGameModal(user);`.

  Add a new test:
  ```ts
  it("opponent name flows to StatsTable and download filename", async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    // Intercept anchor clicks by capturing the created anchor's download attribute
    const clicks: string[] = [];
    const origAppend = document.body.appendChild.bind(document.body);
    vi.spyOn(document.body, "appendChild").mockImplementation((node: any) => {
      if (node.tagName === "A") {
        const origClick = node.click.bind(node);
        node.click = () => { clicks.push(node.download); origClick(); };
      }
      return origAppend(node);
    });

    render(<App />);
    await completeNewGameModal(user, { name: "Mitty" });

    // StatsTable opponent row label should be "Mitty"
    expect(screen.getByRole("row", { name: /mitty/i })).toBeDefined();

    // Trigger CSV download
    await user.click(screen.getByRole("button", { name: /download csv/i }));
    expect(clicks.some(n => n.startsWith("Mitty_") && n.endsWith(".csv"))).toBe(true);

    createObjectURL.mockRestore();
    revoke.mockRestore();
  });
  ```

  Also add a test that a bench player doesn't appear in a panel grid:
  ```ts
  it("bench players are not selectable in the Rebound panel", async () => {
    const user = userEvent.setup();
    render(<App />);
    await completeNewGameModal(user, { lineup: ["jackson","ayaan","wes","devin","james"] });
    // 'drew' is on bench and must not be clickable anywhere in the panels slot
    const panelsRegion = screen.getByLabelText(/event panels/i);
    const drewButtons = panelsRegion.querySelectorAll("button");
    for (const btn of drewButtons) {
      expect(btn.textContent?.toLowerCase()).not.toBe("drew");
    }
  });
  ```

- [ ] **Step 2:** Update `tests/ui/App.test.tsx` — it may have an assertion against region labels that still works; confirm no BlockPanel reference. If any, remove.

- [ ] **Step 3:** Run `npm run test` — expect App tests to FAIL.

- [ ] **Step 4:** Edit `src/ui/App.tsx`:
  - Remove `import BlockPanel from "./panels/BlockPanel";` and its `<details>` block.
  - Destructure `newGameWithLineup` (new) alongside the existing store hook functions.
  - Add `const onCourt = state.lineup;`.
  - Pass `onCourt={onCourt}` to every remaining panel.
  - Pass `roster={state.roster}` to `<NewGameModal>`. Change `onConfirm` to `(name, lineup) => { newGameWithLineup(name, lineup); setNewGameOpen(false); }`.
  - Update the hydrate gate initializer per spec 3.6.
  - Change `handleDownloadCSV` / `handleDownloadLog` to use `opLabel` as shown above.

- [ ] **Step 5:** Run `npm run test` — all pass.

- [ ] **Step 6:** Run `npx tsc --noEmit` — clean.

- [ ] **Step 7:** Run `npm run build` — succeed.

- [ ] **Step 8:** Commit:
  ```bash
  git add src/ui/App.tsx tests/ui/App.integration.test.tsx tests/ui/App.test.tsx
  git commit -m "feat(ui): wire App to v2 — new-game lineup, onCourt, opponent filename"
  ```

---

## Task 10: Final verification and deploy zip

**Files:** none

### Steps

- [ ] **Step 1:** `npm run test` — all tests pass. Record final count.

- [ ] **Step 2:** `npx tsc --noEmit` — clean.

- [ ] **Step 3:** `npm run build` — clean.

- [ ] **Step 4:** Spot-check the dev server:
  ```bash
  npm run dev
  ```
  In a browser:
  - First load triggers NewGameModal. Leave opponent blank, pick 5, click Start Game. Verify StatsTable shows "OP" as the opponent row.
  - Click the Shot panel: only 5 SF players plus OP show up.
  - Pick `op` + `three` + `miss`. A "Blocked by (optional)" picker appears with 5 SF players (no op). Pick one, click Log Shot. Check stats table for a block credited.
  - Click Download CSV → filename is `OP_YYYY-MM-DD.csv`.
  - Click New Game, type "Mitty", pick 5. Start Game. Header shows `Opponent: Mitty`. StatsTable opponent row shows "Mitty". Download CSV → filename starts with `Mitty_`.
  - LineupPanel → Sub section: "Player In" shows only bench; "Player Out" shows only on-court.

- [ ] **Step 5:** Rebuild the deploy zip:
  ```bash
  npm run build
  rm -f sfhs-basketball-stats.zip
  (cd dist && zip -r ../sfhs-basketball-stats.zip .)
  ls -lh sfhs-basketball-stats.zip
  ```

- [ ] **Step 6:** Tag and commit:
  ```bash
  git tag v0.2.0
  ```

  (The zip is gitignored from v0.1.0 onward.)

---

## Out of scope (explicit non-goals)

- Mid-game opponent name editing — deferred, user chose Q3=A.
- Preserving stats on a legacy game without a 5-player lineup — user chose Q2=A (treat as fresh new-game).
- Any change to CLI grammar, parser, executor, or event handlers.
- Any phone-layout polish for the enlarged NewGameModal.
