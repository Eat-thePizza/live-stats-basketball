# SFHS Basketball Stats Web App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the Python CLI `practicestats.py` into a static React+TypeScript web app that preserves every CLI command and behavior, adds a GUI with event-builder panels plus a manual command text box, exports CSV and game-log (.txt) anytime, and deploys to Cloudflare Pages.

**Architecture:** Pure static site. React + Vite + TypeScript. Clean separation between `core/` (pure logic, zero DOM) and `ui/` (React components). Every GUI click builds a CLI-grammar string and routes through the same `parser → executor` code path as the manual text input. Game state persists to `localStorage`. Roster is editable and persisted.

**Tech Stack:** React 18, TypeScript, Vite, Vitest + @testing-library/react, CSS Modules, Cloudflare Pages (static `dist/`).

**Spec:** `docs/superpowers/specs/2026-05-04-web-basketball-stats-design.md`

---

## File Structure

```
.
├── .gitignore
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── src/
│   ├── main.tsx                         # React entry
│   ├── core/
│   │   ├── types.ts                     # Domain types
│   │   ├── roster.ts                    # Default roster + roster helpers
│   │   ├── state.ts                     # Initial GameState, resetGame
│   │   ├── events.ts                    # shots, freeThrows, rebounds, turnovers,
│   │   │                                # lineupChange, subChange, possession
│   │   ├── parser.ts                    # string → Command AST
│   │   ├── executor.ts                  # (Command, GameState) → GameState'
│   │   ├── stats.ts                     # Derived values (percentages, totals, OffRTG)
│   │   └── export.ts                    # toCSV, toGameLogTxt
│   ├── store/
│   │   └── gameStore.ts                 # useReducer + localStorage sync
│   ├── ui/
│   │   ├── App.tsx
│   │   ├── App.module.css
│   │   ├── Header.tsx / .module.css
│   │   ├── Footer.tsx / .module.css
│   │   ├── NewGameModal.tsx / .module.css
│   │   ├── RosterEditor.tsx / .module.css
│   │   ├── StatsTable.tsx / .module.css
│   │   ├── CommandInput.tsx / .module.css
│   │   ├── CommandHistory.tsx / .module.css
│   │   └── panels/
│   │       ├── ShotPanel.tsx / .module.css
│   │       ├── FreeThrowPanel.tsx / .module.css
│   │       ├── ReboundPanel.tsx / .module.css
│   │       ├── TurnoverPanel.tsx / .module.css
│   │       ├── LineupPanel.tsx / .module.css
│   │       ├── PossessionPanel.tsx / .module.css
│   │       └── TimeoutQuarterPanel.tsx / .module.css
│   ├── styles/
│   │   └── theme.css                    # CSS custom properties (SFHS palette)
│   └── assets/
│       ├── logo_main.svg                # copied from project root
│       └── ethan-v3.png                 # copied from project root
├── tests/
│   └── core/
│       ├── parser.test.ts
│       ├── events.test.ts
│       ├── executor.test.ts
│       ├── stats.test.ts
│       ├── export.test.ts
│       └── parity.test.ts               # golden-file parity vs CLI transcripts
└── tests/fixtures/
    └── transcripts/
        ├── simple-2p-make.txt           # sample CLI input
        ├── simple-2p-make.expected.json # expected stats snapshot
        └── ...
```

---

## Task 1: Project scaffolding, git, and CI-ready test harness

**Files:**
- Create: `.gitignore`, `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`, `src/main.tsx`, `src/ui/App.tsx`, `src/ui/App.module.css`

- [ ] **Step 1: Initialize git repository**

```bash
cd /Users/tiliu5/ethan/live-stats-basketball-main
git init
```

Create `.gitignore`:
```
node_modules/
dist/
.DS_Store
*.local
coverage/
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "sfhs-basketball-stats",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.5.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^24.0.0",
    "typescript": "^5.4.0",
    "vite": "^5.3.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 3: Install and create config files**

Run: `npm install`

Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "react-jsx",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src", "tests"]
}
```

Create `vite.config.ts`:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  build: { outDir: "dist" }
});
```

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { environment: "jsdom", globals: true, setupFiles: [] }
});
```

Create `index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SFHS Basketball Stats</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `src/main.tsx`:
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./ui/App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><App /></React.StrictMode>
);
```

Create `src/ui/App.tsx`:
```tsx
export default function App() {
  return <div>Saint Francis Basketball Stats</div>;
}
```

Copy assets:
```bash
mkdir -p src/assets
cp logo_main.svg src/assets/logo_main.svg
cp ethan-v3.png src/assets/ethan-v3.png
```

- [ ] **Step 4: Verify build and test harness**

Run: `npm run build` → Expected: success, `dist/` created.
Run: `npm run test` → Expected: "no test files found" (exit 0 or clean "no tests").

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + React + TS + Vitest project"
```

---

## Task 2: Core types and default roster

**Files:**
- Create: `src/core/types.ts`, `src/core/roster.ts`
- Test: `tests/core/roster.test.ts`

- [ ] **Step 1: Write failing test for default roster**

`tests/core/roster.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { DEFAULT_ROSTER, isValidPlayerId } from "@/core/roster";

describe("default roster", () => {
  it("includes all 17 CLI players and the opponent", () => {
    const ids = DEFAULT_ROSTER.map(p => p.id);
    expect(ids).toEqual(expect.arrayContaining([
      "devin","alden","wes","max","ayaan","luke","john","james",
      "jackson","yidi","derek","gianni","kingston","zane","zayden","drew","op"
    ]));
    expect(DEFAULT_ROSTER).toHaveLength(17);
  });

  it("isValidPlayerId returns true for roster members", () => {
    expect(isValidPlayerId(DEFAULT_ROSTER, "jackson")).toBe(true);
    expect(isValidPlayerId(DEFAULT_ROSTER, "nobody")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test — verify failure**

Run: `npm run test -- roster`
Expected: FAIL (module not found).

- [ ] **Step 3: Create `src/core/types.ts`**

```ts
export type PlayerId = string;
export interface Player { id: PlayerId; displayName: string; }
export type Roster = Player[];

// Indexed stat array matching the CLI's layout:
// 2PM, 2PA, 3PM, 3PA, OR, DR, TO, STL, AST, BLK, FTM, FTA, +/-, DIFF
export type RosterStats = Record<PlayerId, number[]>;

export interface GameState {
  opponentName: string;
  roster: Roster;
  rosterStats: RosterStats;
  sfPoints: number;
  opPoints: number;
  sfPOT: number;
  opPOT: number;
  sfSP: number;
  opSP: number;
  sfML: number;
  sfPOSS: number;
  opPOSS: number;
  possession: boolean | null;
  previousTurnover: boolean;
  secondChance: boolean;
  lineup: PlayerId[];
  tipoff: boolean;
  startTime: number | null;
  commandHistory: string[]; // raw CLI-grammar strings, oldest first
  createdAt: number;
}

export type ShotType = "two" | "three" | "layup";

export type Command =
  | { kind: "shot"; player: PlayerId; shot: ShotType; made: boolean; assistOrBlock?: PlayerId }
  | { kind: "ft"; player: PlayerId; results: Array<"make" | "miss"> }
  | { kind: "rebound"; player: PlayerId; type: "or" | "dr" }
  | { kind: "turnover"; player: PlayerId; stealer?: PlayerId }
  | { kind: "lineup"; players: PlayerId[] }
  | { kind: "sub"; in: PlayerId; out: PlayerId }
  | { kind: "possession"; team: "sf" | "op" }
  | { kind: "timeout" }
  | { kind: "quarter" }
  | { kind: "tip" }
  | { kind: "noop" };
```

- [ ] **Step 4: Create `src/core/roster.ts`**

```ts
import type { Player, Roster, PlayerId } from "./types";

export const DEFAULT_ROSTER: Roster = [
  { id: "devin",    displayName: "Devin Turner" },
  { id: "alden",    displayName: "Alden Visitacion" },
  { id: "wes",      displayName: "Weston Edwards" },
  { id: "max",      displayName: "Max Sequeira" },
  { id: "ayaan",    displayName: "Ayaan Bawa" },
  { id: "luke",     displayName: "Luke Alexander" },
  { id: "john",     displayName: "John Weaver" },
  { id: "james",    displayName: "James Wilson" },
  { id: "jackson",  displayName: "Jackson Corbett" },
  { id: "yidi",     displayName: "Yidi Qin" },
  { id: "derek",    displayName: "Derek Johnson" },
  { id: "gianni",   displayName: "Gianni Rivas" },
  { id: "kingston", displayName: "Kingston Ng" },
  { id: "zane",     displayName: "Zane Bermudez" },
  { id: "zayden",   displayName: "Zayden Bermudez" },
  { id: "drew",     displayName: "Drew Cumby" },
  { id: "op",       displayName: "Opponent" },
];

export function isValidPlayerId(roster: Roster, id: string): boolean {
  return roster.some(p => p.id === id);
}
```

- [ ] **Step 5: Run test — verify pass**

Run: `npm run test -- roster` → Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(core): add domain types and default roster"
```

---

## Task 3: Initial `GameState` and `resetGame`

**Files:**
- Create: `src/core/state.ts`
- Test: `tests/core/state.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import { DEFAULT_ROSTER } from "@/core/roster";

describe("createInitialState", () => {
  it("zeroes all counters and creates a stat array per roster player", () => {
    const s = createInitialState({ opponentName: "Mitty", roster: DEFAULT_ROSTER });
    expect(s.opponentName).toBe("Mitty");
    expect(s.sfPoints).toBe(0);
    expect(s.opPoints).toBe(0);
    expect(s.possession).toBeNull();
    expect(s.previousTurnover).toBe(false);
    expect(s.secondChance).toBe(false);
    expect(s.lineup).toEqual([]);
    expect(Object.keys(s.rosterStats)).toHaveLength(DEFAULT_ROSTER.length);
    expect(s.rosterStats["jackson"]).toEqual(new Array(14).fill(0));
  });
});
```

- [ ] **Step 2: Run test — verify failure**

Run: `npm run test -- state` → FAIL.

- [ ] **Step 3: Implement `src/core/state.ts`**

```ts
import type { GameState, Roster, RosterStats } from "./types";

export function createInitialState(args: { opponentName: string; roster: Roster }): GameState {
  const rosterStats: RosterStats = {};
  for (const p of args.roster) rosterStats[p.id] = new Array(14).fill(0);
  return {
    opponentName: args.opponentName,
    roster: args.roster,
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

- [ ] **Step 4: Run test — PASS.** Commit:

```bash
git add -A && git commit -m "feat(core): add createInitialState"
```

---

## Task 4: Command parser

**Files:**
- Create: `src/core/parser.ts`
- Test: `tests/core/parser.test.ts`

Parser must mirror the CLI's tokenization in `practicestats.py` exactly. Unknown/ignored lines return `{ kind: "noop" }`.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import { parseCommand } from "@/core/parser";
import { DEFAULT_ROSTER } from "@/core/roster";

const roster = DEFAULT_ROSTER;

describe("parseCommand", () => {
  it("parses a 2-point make with assist", () => {
    expect(parseCommand("jackson two make ayaan", roster))
      .toEqual({ kind: "shot", player: "jackson", shot: "two", made: true, assistOrBlock: "ayaan" });
  });
  it("parses a 3-point miss with blocker", () => {
    expect(parseCommand("op three miss jackson", roster))
      .toEqual({ kind: "shot", player: "op", shot: "three", made: false, assistOrBlock: "jackson" });
  });
  it("parses a layup miss (flexible miss detection: 'omiss')", () => {
    expect(parseCommand("jackson layup omiss", roster))
      .toEqual({ kind: "shot", player: "jackson", shot: "layup", made: false });
  });
  it("parses free throws", () => {
    expect(parseCommand("jackson ft make make miss", roster))
      .toEqual({ kind: "ft", player: "jackson", results: ["make","make","miss"] });
  });
  it("parses rebound", () => {
    expect(parseCommand("devin or", roster)).toEqual({ kind: "rebound", player: "devin", type: "or" });
    expect(parseCommand("devin dr", roster)).toEqual({ kind: "rebound", player: "devin", type: "dr" });
  });
  it("parses turnovers with and without steal", () => {
    expect(parseCommand("op to jackson", roster)).toEqual({ kind: "turnover", player: "op", stealer: "jackson" });
    expect(parseCommand("op to", roster)).toEqual({ kind: "turnover", player: "op" });
  });
  it("parses lineup, sub, possession, timeout, quarter, tip", () => {
    expect(parseCommand("-l wes devin james jackson ayaan", roster).kind).toBe("lineup");
    expect(parseCommand("-s john james", roster)).toEqual({ kind: "sub", in: "john", out: "james" });
    expect(parseCommand("-p sf", roster)).toEqual({ kind: "possession", team: "sf" });
    expect(parseCommand("-p op", roster)).toEqual({ kind: "possession", team: "op" });
    expect(parseCommand("-t", roster)).toEqual({ kind: "timeout" });
    expect(parseCommand("---", roster)).toEqual({ kind: "quarter" });
    expect(parseCommand("tip", roster)).toEqual({ kind: "tip" });
  });
  it("returns noop for blank, unknown player, or malformed lines", () => {
    expect(parseCommand("", roster)).toEqual({ kind: "noop" });
    expect(parseCommand("nobody two make", roster)).toEqual({ kind: "noop" });
    expect(parseCommand("-l nobody", roster)).toEqual({ kind: "noop" });
  });
});
```

- [ ] **Step 2: Run test — FAIL.**

- [ ] **Step 3: Implement `src/core/parser.ts`**

```ts
import type { Command, Roster, ShotType } from "./types";
import { isValidPlayerId } from "./roster";

function isShotType(w: string): w is ShotType {
  return w === "three" || w === "layup" || w === "two" || /* any non-"three" word counts as two */ true;
}

export function parseCommand(line: string, roster: Roster): Command {
  const trimmed = line.trim();
  if (trimmed === "") return { kind: "noop" };
  if (trimmed === "---") return { kind: "quarter" };
  if (trimmed.toLowerCase() === "tip") return { kind: "tip" };

  const chunks = trimmed.split(/\s+/);
  const head = chunks[0];

  if (head === "-t") return { kind: "timeout" };
  if (head === "-p") {
    const team = (chunks[1] ?? "").toLowerCase();
    if (team !== "sf" && team !== "op") return { kind: "noop" };
    return { kind: "possession", team };
  }
  if (head === "-s") {
    const [, inP, outP] = chunks;
    if (!isValidPlayerId(roster, inP) || !isValidPlayerId(roster, outP)) return { kind: "noop" };
    return { kind: "sub", in: inP, out: outP };
  }
  if (head === "-l") {
    const players = chunks.slice(1);
    for (const p of players) if (!isValidPlayerId(roster, p)) return { kind: "noop" };
    return { kind: "lineup", players };
  }

  if (!isValidPlayerId(roster, head)) return { kind: "noop" };

  // turnover: "<player> to [stealer]"
  if (chunks.length >= 2 && chunks[1] === "to") {
    const stealer = chunks[2];
    if (stealer !== undefined && !isValidPlayerId(roster, stealer)) return { kind: "noop" };
    return stealer ? { kind: "turnover", player: head, stealer } : { kind: "turnover", player: head };
  }

  // free throws: "<player> ft make|miss..."
  if (chunks.length >= 3 && chunks.includes("ft")) {
    const idx = chunks.indexOf("ft");
    const results = chunks.slice(idx + 1).map(r => (r.includes("make") ? "make" : "miss")) as Array<"make"|"miss">;
    if (results.length === 0) return { kind: "noop" };
    return { kind: "ft", player: head, results };
  }

  // shot: "<player> <shot> <make|miss|blocked> [assist|blocker]"
  if (chunks.length >= 3) {
    const shotWord = chunks[1];
    const resultWord = chunks[2];
    const fourth = chunks[3];
    const shot: ShotType = shotWord === "three" ? "three" : (shotWord.includes("lay") ? "layup" : "two");
    const made = !(resultWord.includes("mis") || resultWord.includes("blocked"));
    if (fourth !== undefined && !isValidPlayerId(roster, fourth)) return { kind: "noop" };
    return fourth
      ? { kind: "shot", player: head, shot, made, assistOrBlock: fourth }
      : { kind: "shot", player: head, shot, made };
  }

  // rebound: "<player> or|dr"
  if (chunks.length === 2 && (chunks[1] === "or" || chunks[1] === "dr")) {
    return { kind: "rebound", player: head, type: chunks[1] };
  }

  return { kind: "noop" };
}
```

- [ ] **Step 4: Run test — PASS.** Commit:

```bash
git add -A && git commit -m "feat(core): add CLI command parser"
```

---

## Task 5: Event handlers (pure functions over GameState)

**Files:**
- Create: `src/core/events.ts`
- Test: `tests/core/events.test.ts`

Port these from `practicestats.py` as pure functions `(state, args) => state'`. Do NOT mutate; return new state objects.

- [ ] **Step 1: Write failing tests — one per handler**

Cover: `applyShot` (made 2/made 3/missed layup, assist, block, POT, 2nd-chance), `applyFreeThrows`, `applyRebound` (or/dr), `applyTurnover` (with/without steal), `applyLineupChange` (first call sets lineup; subsequent updates +/-), `applySubChange` (+/-), `applyPossession` (sf/op 2nd-chance toggles).

Write at least 12 tests covering these branches. Example:

```ts
import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import { DEFAULT_ROSTER } from "@/core/roster";
import {
  applyShot, applyFreeThrows, applyRebound, applyTurnover,
  applyLineupChange, applySubChange, applyPossession
} from "@/core/events";

const init = () => createInitialState({ opponentName: "", roster: DEFAULT_ROSTER });

describe("applyShot", () => {
  it("made 3 for SF: adds 3 pts, increments 2PM,2PA,3PM,3PA", () => {
    const s = applyShot(init(), { player: "jackson", shot: "three", made: true });
    expect(s.sfPoints).toBe(3);
    expect(s.rosterStats.jackson.slice(0,4)).toEqual([1,1,1,1]);
  });
  it("made 2 for OP with assist-equivalent block credit ignored on make", () => {
    const s = applyShot(init(), { player: "op", shot: "two", made: true });
    expect(s.opPoints).toBe(2);
  });
  it("missed layup for SF increments sfML", () => {
    const s = applyShot(init(), { player: "jackson", shot: "layup", made: false });
    expect(s.sfML).toBe(1);
  });
  // ... etc.
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement `src/core/events.ts`**

Each function takes `GameState` and a specific args object and returns a new `GameState`. Index layout: `[2PM,2PA,3PM,3PA,OR,DR,TO,STL,AST,BLK,FTM,FTA,+/-,DIFF]`.

Port exact semantics from `practicestats.py::shots`, `free_throws`, `rebounds`, `turnovers`, `lineup_change`, `sub_change`, and the `-p` branch. Keep a helper `cloneState(s)` for safe immutable updates (deep-clone `rosterStats` entries that change).

Key parity notes:
- `shots`: on make with `ast_block`, increment AST (`[8]`); on miss with `ast_block`, increment BLK (`[9]`). Points-off-turnovers and second-chance points follow possession flags.
- `free_throws`: iterate results; each "make" adds 1 point and honors POT/2nd-chance flags.
- `rebounds`: OR → `[4]`, DR → `[5]`.
- `turnovers`: `[6]` for the committer; if stealer exists, stealer `[7]`.
- `lineup_change`: first call just seeds `lineup` and returns; otherwise compute plus/minus deltas for outgoing players using `DIFF` (`[13]`), then seed `DIFF` for incoming.
- `sub_change`: same plus/minus math for the single outgoing, seed DIFF for incoming.
- `applyPossession`: replicate the 2nd-chance toggle logic in `-p` branch.

- [ ] **Step 4: Run — PASS.** Commit:

```bash
git add -A && git commit -m "feat(core): port CLI stat handlers as pure functions"
```

---

## Task 6: Executor (Command + GameState → GameState')

**Files:**
- Create: `src/core/executor.ts`
- Test: `tests/core/executor.test.ts`

The executor wires parsed `Command`s to the `events.ts` handlers and also manages possession/turnover/2nd-chance flags and `sfPOSS`/`opPOSS` exactly as the `while True` loop does in `practicestats.py`.

- [ ] **Step 1: Write failing tests covering:**
  - shot by op flips possession and increments opPOSS if previously sf
  - turnover flips flags (`previousTurnover=true`, `secondChance=false`) and updates POSS counters
  - rebound `dr` flips possession and clears flags; `or` sets `secondChance=true`
  - `-p sf`/`-p op` follows CLI's exact logic
  - `tip` sets `tipoff=true` only once and records `startTime`
  - `---` clears `previousTurnover` and `possession`
  - `noop` returns state unchanged

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement `src/core/executor.ts`**

```ts
import type { Command, GameState } from "./types";
import {
  applyShot, applyFreeThrows, applyRebound, applyTurnover,
  applyLineupChange, applySubChange, applyPossession
} from "./events";

export function execute(state: GameState, cmd: Command, rawLine: string): GameState {
  // Always append the raw line to history (except blank noops)
  const withHistory = rawLine.trim() === "" ? state : { ...state, commandHistory: [...state.commandHistory, rawLine] };

  switch (cmd.kind) {
    case "noop":    return withHistory;
    case "tip":     return withHistory.tipoff ? withHistory : { ...withHistory, tipoff: true, startTime: performance.now() };
    case "quarter": return { ...withHistory, previousTurnover: false, possession: null };
    case "timeout": return withHistory; // reminder only
    case "lineup":  return applyLineupChange(withHistory, cmd.players);
    case "sub":     return applySubChange(withHistory, cmd.in, cmd.out);
    case "possession": return applyPossession(withHistory, cmd.team);
    case "rebound":    return applyRebound(withHistory, cmd.player, cmd.type);
    case "turnover":   return applyTurnover(withHistory, cmd.player, cmd.stealer);
    case "ft":         return applyFreeThrows(withHistory, cmd.player, cmd.results);
    case "shot":       return applyShot(withHistory, cmd);
  }
}
```

The per-kind possession/`sfPOSS`/`opPOSS` updates live inside the `apply*` handlers so they stay pure and testable.

- [ ] **Step 4: Run — PASS.** Commit:

```bash
git add -A && git commit -m "feat(core): add executor wiring commands to handlers"
```

---

## Task 7: Derived stats

**Files:**
- Create: `src/core/stats.ts`
- Test: `tests/core/stats.test.ts`

- [ ] **Step 1: Write failing tests** for `computePlayerRow(state, playerId)` returning the CLI row shape:
  `[displayName, "2PM/2PA", 2P%, "3PM/3PA", 3P%, OR, DR, TO, STL, AST, BLK, "FTM/FTA", FT%, "+/-", points]`
  and `computeTeamRow(state)` for the "SF" aggregate row plus OffRTG helpers `computeOffRTG(sfPoints, sfPOSS)`, safe on zero denominators.

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement `src/core/stats.ts`** mirroring `printTable` math exactly.

- [ ] **Step 4: Run — PASS.** Commit:

```bash
git add -A && git commit -m "feat(core): add derived stats helpers"
```

---

## Task 8: CSV and TXT export

**Files:**
- Create: `src/core/export.ts`
- Test: `tests/core/export.test.ts`

- [ ] **Step 1: Write failing tests**
  - `toCSV(state)` returns a string with header row, roster rows in **current roster order**, a blank row before opponent, team-totals row, and opponent row, matching the CLI's CSV layout.
  - `toGameLogTxt(state)` returns `"======================\n"` followed by each command in `commandHistory` joined by `\n`.

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement `src/core/export.ts`** using `computePlayerRow` / `computeTeamRow`. No browser APIs — return strings only. (Blob/download happens in UI.)

- [ ] **Step 4: Run — PASS.** Commit:

```bash
git add -A && git commit -m "feat(core): add CSV and game-log exporters"
```

---

## Task 9: Golden-file parity tests vs CLI transcripts

**Files:**
- Create: `tests/fixtures/transcripts/*.txt`, `*.expected.json`
- Create: `tests/core/parity.test.ts`

Hand-author 3–4 transcripts that exercise most branches:
  1. `simple-shots.txt` — mix of 2P/3P makes/misses, assists, blocks.
  2. `ft-and-rebounds.txt` — free throws, OR/DR, team rebounds.
  3. `lineup-and-subs.txt` — initial lineup, a sub, plus/minus checks.
  4. `full-possession-flow.txt` — POT, 2nd-chance, turnovers, possession flips.

For each, compute the expected final `{ sfPoints, opPoints, sfPOT, opPOT, sfSP, opSP, sfML, rosterStats }` by running `practicestats.py` manually (or hand-calculating) and record it in `<name>.expected.json`.

- [ ] **Step 1: Write `parity.test.ts`** that iterates each transcript, runs each line through `parseCommand` + `execute`, and `expect(stateSnapshot).toMatchObject(expected)`.

- [ ] **Step 2: Run — FAIL** (fixtures missing or mismatches). Fix transcripts/expectations until green.

- [ ] **Step 3: Run — PASS.** Commit:

```bash
git add -A && git commit -m "test(core): add golden-file parity tests vs CLI transcripts"
```

---

## Task 10: Game store + `localStorage` persistence

**Files:**
- Create: `src/store/gameStore.ts`
- Test: `tests/store/gameStore.test.ts`

- [ ] **Step 1: Write failing tests** for:
  - Reducer action `SUBMIT_COMMAND` runs parser+executor and returns new state.
  - `loadGame()` reads `sfhs.game.current` from `localStorage`; returns null if missing/corrupt.
  - `saveGame(state)` writes JSON to `sfhs.game.current`.
  - `loadRoster()`/`saveRoster(roster)` for `sfhs.roster`.

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement `src/store/gameStore.ts`** with a typed reducer, `useGameStore()` hook built on `useReducer` that auto-saves on every dispatch via `useEffect`, and a custom event for imperative saves on unload.

- [ ] **Step 4: Run — PASS.** Commit:

```bash
git add -A && git commit -m "feat(store): add useReducer game store with localStorage sync"
```

---

## Task 11: Theme, Header, Footer

**Files:**
- Create: `src/styles/theme.css`, `src/ui/Header.tsx` + `.module.css`, `src/ui/Footer.tsx` + `.module.css`
- Modify: `src/main.tsx` (import theme), `src/ui/App.tsx` (mount Header/Footer)

- [ ] **Step 1: Create `src/styles/theme.css`** with SFHS palette:

```css
:root {
  --sfhs-maroon: #8B0000;
  --sfhs-maroon-dark: #6B0000;
  --sfhs-white: #FFFFFF;
  --sfhs-gray-900: #2A2A2A;
  --sfhs-gray-700: #4A4A4A;
  --sfhs-gray-300: #C9C9C9;
  --sfhs-gray-100: #E5E5E5;
  --sfhs-bg: #FFFFFF;
  --font-serif: "Merriweather", Georgia, serif;
  --font-sans: "Inter", system-ui, sans-serif;
}
html, body, #root { margin: 0; padding: 0; background: var(--sfhs-bg); color: var(--sfhs-gray-900); font-family: var(--font-sans); }
h1, h2, h3 { font-family: var(--font-serif); }
```

Import in `src/main.tsx` (`import "./styles/theme.css";`).

- [ ] **Step 2: Implement `Header.tsx`** showing `logo_main.svg`, opponent name + date, and placeholder buttons for New Game / Download CSV / Download Game Log. Apply responsive layout via CSS Modules (see Task 15).

- [ ] **Step 3: Implement `Footer.tsx`** showing `ethan-v3.png` and text "Powered by Ethan {NAME}".

- [ ] **Step 4: Smoke test with `@testing-library/react`** that Header renders the logo alt text and Footer renders the footer text.

- [ ] **Step 5: Run tests — PASS.** Commit:

```bash
git add -A && git commit -m "feat(ui): add theme, Header, Footer with SFHS branding"
```

---

## Task 12: New Game modal + Roster Editor

**Files:**
- Create: `src/ui/NewGameModal.tsx` + `.module.css`, `src/ui/RosterEditor.tsx` + `.module.css`
- Test: component tests for each

- [ ] **Step 1: Tests**
  - `NewGameModal` renders opponent input; submit with blank → calls `onConfirm("")`; submit with name → `onConfirm("Mitty")`.
  - `RosterEditor` lists roster (excluding `op` as non-removable), supports add/rename/remove; emits updated roster on save.

- [ ] **Step 2: FAIL → implement → PASS.**

- [ ] **Step 3: Commit.**

```bash
git add -A && git commit -m "feat(ui): add NewGameModal and RosterEditor"
```

---

## Task 13: Stats table, Command input, Command history

**Files:**
- Create: `src/ui/StatsTable.tsx` + `.module.css`, `src/ui/CommandInput.tsx` + `.module.css`, `src/ui/CommandHistory.tsx` + `.module.css`

- [ ] **Step 1: Tests**
  - `StatsTable` renders a row per roster player, SF team totals row, opponent row, and the Other Stats block (POT, 2nd-chance, missed layups, OffRTG).
  - `CommandInput` submits on Enter, calls `onSubmit(line)`, clears input.
  - `CommandHistory` renders entries in order, newest at top.

- [ ] **Step 2: FAIL → implement → PASS.**

- [ ] **Step 3: Commit.**

```bash
git add -A && git commit -m "feat(ui): add StatsTable, CommandInput, CommandHistory"
```

---

## Task 14: Event-builder panels

**Files:**
- Create: `src/ui/panels/{Shot,FreeThrow,Rebound,Turnover,Lineup,Possession,TimeoutQuarter}Panel.tsx` + `.module.css` for each

Each panel composes a CLI-grammar string and calls `onSubmit(line)` — which ultimately reaches `parser → executor`, guaranteeing one code path.

- [ ] **Step 1: Tests per panel** (example, ShotPanel):
  - select player "jackson", shot "two", result "make", assist "ayaan", click Submit → `onSubmit` called with `"jackson two make ayaan"`.
  - LineupPanel: selecting 5 players and clicking Set → `"-l p1 p2 p3 p4 p5"`.
  - TimeoutQuarterPanel: Timeout button → `"-t"`; Quarter Break → `"---"`; Tipoff → `"tip"`.

- [ ] **Step 2: FAIL → implement each panel → PASS.**

- [ ] **Step 3: Commit after each panel** (7 small commits).

---

## Task 15: Responsive layout (phone / tablet / desktop)

**Files:**
- Modify: `src/ui/App.tsx`, `src/ui/App.module.css`

- [ ] **Step 1: Implement layout** using CSS Grid + media queries:
  - `@media (min-width: 1024px)` — 3-column grid: `panels | stats | history`.
  - `@media (min-width: 768px) and (max-width: 1023px)` — 2-column grid; panels group becomes tabbed.
  - `@media (max-width: 767px)` — single column with bottom tab bar (Panels / Stats / History) driven by local `activeTab` state; sticky `CommandInput` at bottom.

- [ ] **Step 2: Add a smoke test** that `App` mounts and renders Header, Footer, StatsTable without throwing.

- [ ] **Step 3: Manual check** via `npm run dev` on three viewport widths (375px, 834px, 1440px).

- [ ] **Step 4: Commit.**

```bash
git add -A && git commit -m "feat(ui): responsive layout for phone, tablet, desktop"
```

---

## Task 16: Wire it all together in `App.tsx`

**Files:**
- Modify: `src/ui/App.tsx`

- [ ] **Step 1: Compose** `useGameStore()`, `NewGameModal` (shown if no saved game), `Header` (with real New Game / Download CSV / Download Game Log actions calling `toCSV`/`toGameLogTxt` and triggering browser downloads via `Blob` + `URL.createObjectURL`), `RosterEditor` (opened from header), panels (each wired to `store.submit(line)`), `CommandInput` (wired to `store.submit`), `CommandHistory` (from `state.commandHistory`), `StatsTable` (from `state`), `Footer`.

- [ ] **Step 2: Add a test** that an end-to-end user flow works:
  - render `<App />`
  - dismiss `NewGameModal` with opponent "Mitty"
  - type `jackson two make ayaan` in `CommandInput` and press Enter
  - assert SF points shows `2` and the command appears in history

- [ ] **Step 3: Run — PASS.** Commit:

```bash
git add -A && git commit -m "feat(ui): wire App to store, panels, and exports"
```

---

## Task 17: Update README and add deployment instructions

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add a "Web App" section** to README covering:
  - Local dev: `npm install`, `npm run dev`.
  - Build: `npm run build` (output in `dist/`).
  - Cloudflare Pages deploy:
    - Connect repo in Cloudflare Pages.
    - Build command: `npm run build`.
    - Output directory: `dist`.
    - Node version: 20.
    - No env vars required.
  - Keyboard users: text input accepts the exact CLI grammar from the original program.

- [ ] **Step 2: Commit.**

```bash
git add README.md && git commit -m "docs: add web app usage and Cloudflare Pages deploy instructions"
```

---

## Task 18: Final verification

- [ ] **Step 1:** `npm run test` — all tests pass.
- [ ] **Step 2:** `npm run build` — clean build, `dist/` produced.
- [ ] **Step 3:** `npm run preview` — manually click through each panel, verify CSV and TXT download, verify New Game clears state, verify roster edits persist across reloads.
- [ ] **Step 4:** Run `practicestats.py` against one of the golden transcripts and compare the printed table to the web app's `StatsTable` for final parity sanity check.
- [ ] **Step 5:** Tag: `git tag v0.1.0 && git commit --allow-empty -m "chore: v0.1.0 web app MVP"`

---

## Out of scope (deferred)

- Undo/redo, season aggregation, shot-chart/video, cloud sync, auth, opponent-player breakdown, phone-landscape-specific optimizations, keyboard shortcuts.
