# Saint Francis Basketball Stats — Web App Design Spec

**Date:** 2026-05-04
**Source of truth:** `requirement-v1.md`
**Status:** Approved in brainstorming; ready for implementation planning

---

## 1. Goal

Refactor the existing Python CLI (`practicestats.py`) into a web application that:

- Preserves every CLI command and its behavior exactly.
- Provides a GUI with event-builder panels (buttons for every command category) **and** a manual CLI-grammar text input box.
- Deploys as a pure static site on Cloudflare Pages.
- Matches Saint Francis High School (Mountain View, CA) brand aesthetic.
- Supports CSV export and game-log (.txt) export at any time.
- Works responsively across phone, tablet, and desktop with per-breakpoint layout adjustments.

## 2. Architecture

**Pure static site, pure browser app.** No server code, no Workers, no Functions.

- **Language:** TypeScript
- **Framework:** React + Vite
- **Styling:** CSS Modules (Tailwind optional — deferred to implementation planning)
- **State:** React `useReducer` + `localStorage` persistence on every event
- **Hosting:** Cloudflare Pages, static assets only (`dist/` output)
- **Offline:** Fully offline-capable after first load

### Why browser-only

The CLI logic is self-contained (~500 LOC, no I/O beyond prompts and file writes) and ports cleanly to TypeScript. Browser-only hosting gives zero-cost deployment, zero cold starts, offline use during games, and no drift between client and server state.

## 3. Module structure

```
src/
├── core/                    # Pure logic — no DOM, no React
│   ├── types.ts             # Player, RosterStats, GameState, Command
│   ├── state.ts             # Initial state, pure reducer functions
│   ├── events.ts            # shots, freeThrows, rebounds, turnovers,
│   │                        # lineupChange, subChange, possession
│   ├── parser.ts            # Raw CLI string → Command AST
│   ├── executor.ts          # (Command, GameState) → GameState'
│   ├── stats.ts             # Derived values: FG%, team totals, OffRTG
│   └── export.ts            # toCSV, toGameLogTxt
│
├── ui/                      # React components
│   ├── App.tsx
│   ├── panels/
│   │   ├── ShotPanel.tsx
│   │   ├── FreeThrowPanel.tsx
│   │   ├── ReboundPanel.tsx
│   │   ├── TurnoverPanel.tsx
│   │   ├── LineupPanel.tsx
│   │   ├── PossessionPanel.tsx
│   │   └── TimeoutQuarterPanel.tsx
│   ├── StatsTable.tsx
│   ├── CommandInput.tsx
│   ├── CommandHistory.tsx
│   ├── RosterEditor.tsx
│   ├── NewGameModal.tsx
│   ├── Header.tsx           # logo_main.svg, opponent name, actions
│   └── Footer.tsx           # ethan-v3.png + "Powered by Ethan {NAME}"
│
├── store/
│   └── gameStore.ts         # useReducer + localStorage sync
│
└── assets/
    ├── logo_main.svg
    └── ethan-v3.png
```

**Dependency rule:** `ui/` imports from `core/`. `core/` never imports from `ui/`.

**One code path:** Every button click in `panels/` composes a CLI-grammar string, which is parsed by `parser.ts` and executed by `executor.ts` — identical to the path used by the manual text input. This prevents behavior drift.

## 4. Command grammar (preserved verbatim)

| Command | Form | Example |
|---|---|---|
| Shot | `[player] two\|three\|layup make\|miss [assist\|blocker]` | `jackson two make ayaan` |
| Free throws | `[player] ft make\|miss [make\|miss ...]` | `jackson ft make make miss` |
| Rebound | `[player] or\|dr` | `devin or` |
| Turnover | `[player] to [stealer]` | `op to jackson` |
| Lineup set | `-l p1 p2 p3 p4 p5` | `-l wes devin james jackson ayaan` |
| Substitution | `-s in out` | `-s john james` |
| Team possession | `-p sf\|op` | `-p sf` |
| Timeout | `-t` | `-t` |
| Quarter break | `---` | `---` |
| Tipoff | `tip` | `tip` |
| End session | `exit` | `exit` |

Miss detection remains flexible (substring match `mis` or `blocked`). Only the exact word `three` counts as a 3-pointer. Unknown player names cause the command to be silently ignored, matching CLI behavior.

## 5. UI layout (responsive)

### Desktop (≥1024px) — 3 columns
- **Left:** Event-builder panels (Shot / Free Throw / Rebound / Turnover / Lineup / Possession / Timeout+Quarter).
- **Center:** Always-visible stats table (roster stats + team totals + Other Stats: POT, 2nd-chance, missed layups, OffRTG).
- **Right:** Command history, manual CLI text input (sticky bottom), export buttons.

### Tablet (768–1023px) — 2 columns
- Panels on left as a tabbed/accordion group.
- Stats table + history on right.
- Larger touch targets (min 44×44px).

### Phone (<768px) — single column
- Bottom tab bar: **Panels / Stats / History**.
- Sticky command input at bottom.
- Panels use dropdown player pickers instead of wide grids.

### Header
- `logo_main.svg` top-left (prominent).
- Opponent name + date centered.
- Actions right-aligned: **New Game**, **Download CSV**, **Download Game Log (.txt)**.

### Footer
- Centered: `ethan-v3.png` + text "Powered by Ethan {NAME}".

## 6. Visual style — Classic Collegiate (SFHS)

- **Primary:** Maroon `#8B0000` (refined against `logo_main.svg`).
- **Background:** White `#FFFFFF`.
- **Neutrals:** Dark gray `#4A4A4A` (text), light gray `#E5E5E5` (borders/dividers).
- **Accent rules:** Thin maroon horizontal rules, maroon table header row, maroon button fill on primary actions.
- **Typography:** Serif headings (e.g., Merriweather), sans-serif body (e.g., Inter).
- **Feel:** Institutional, clean, broadcast-neutral.

## 7. Event-builder panels (button UI)

Each panel assembles a CLI string under the hood. Example — Shot panel:

1. Player picker (roster dropdown or grid; includes `op`).
2. Shot type buttons: `two | three | layup`.
3. Result buttons: `make | miss`.
4. Optional assist/blocker picker.
5. **Submit** → produces e.g. `jackson two make ayaan` → parsed → executed → added to history.

Analogous flows for every other command. The user can always drop into the manual text box for edge cases or speed.

## 8. State, persistence, and lifecycle

- `GameState` structure mirrors the CLI globals: `rosterStats`, `sfPoints`, `opPoints`, `sfPOT`, `opPOT`, `sfSP`, `opSP`, `sfML`, `sfPOSS`, `opPOSS`, `possession`, `previousTurnover`, `secondChance`, `lineup`, `commandHistory`, `tipoff`, `startTime`, `opponentName`.
- **Auto-save:** After every executed command, serialize `GameState` to `localStorage` under `sfhs.game.current`.
- **Restore:** On load, if `sfhs.game.current` exists, resume that game silently.
- **New Game modal** (shown on first load if no saved game, and via the header button): asks for opponent name; blank falls back to `Stats`. Confirming clears `sfhs.game.current` and initializes a fresh state. Roster is **not** cleared by New Game.

## 9. Roster management

- `localStorage` key: `sfhs.roster` — editable list of `{ id, displayName }` entries plus the fixed `op` entry.
- Seeded on first run with the existing 17 names from the CLI.
- **Roster Editor UI:** Accessible from the header, usable pre-game (before first stat-producing command). Supports add, rename, remove. `op` is not editable or removable.
- Stat keys use the `id` (lowercase short name), matching the CLI dictionary keys.
- CSV export row order uses the current roster order.

## 10. Export

### CSV (anytime)
Same columns and formatting as the CLI's CSV output:
`Player, 2PM/2PA, 2P%, 3PM/3PA, 3P%, OR, DR, TO, STL, AST, BLK, FTM/FTA, FT%, +/-, Points`
Plus team totals and opponent row, in the configured roster order. Filename: `{opponent|Stats}_{YYYY-MM-DD}.csv`.

### Game log (.txt, anytime)
Every command typed/clicked, in order, with quarter-break separators (`---`) and the session header (`======================`). Filename: `{opponent|Stats}_{YYYY-MM-DD}.txt`.

Both buttons are visible in the header at all times and generate fresh snapshots on click.

## 11. Testing strategy

- **Unit tests** on every `core/` function (parser, each event handler, executor, stats, export).
- **Golden-file parity tests:** Capture sample CLI transcripts (sequences of commands); run them through the TS executor; diff the resulting stats table against the Python CLI's output to prove behavior parity.
- **Component smoke tests** for each panel (click flows produce the expected CLI string).
- No e2e browser automation for v1.

## 12. Deployment (Cloudflare Pages)

- Build command: `npm run build`
- Output directory: `dist`
- Node version: 20 (set in Pages project settings)
- No environment variables required.
- No Functions / Workers / KV / D1.
- `README.md` updated with a "Deploy" section showing the Cloudflare Pages settings and a local `npm run dev` quickstart.

## 13. Out of scope (v1)

- Multi-game history / season aggregation.
- Opponent-player tracking (stays team-level like the CLI).
- Shot chart / video features (the commented-out CV2 code in `practicestats.py`).
- Undo/redo (could be added later; command history is append-only for now).
- Authentication, multi-user sync, cloud saves.

## 14. Open items deferred to implementation planning

- CSS Modules vs Tailwind.
- Exact font choices (Merriweather/Inter are placeholders; final choice pending logo palette check).
- Keyboard shortcuts in the web UI for power users.
