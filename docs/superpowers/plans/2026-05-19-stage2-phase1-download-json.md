# Stage 2 Phase 1 — Download JSON Game Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `Download JSON` button to the existing live-stats web UI and a Node CLI script that converts an existing `.log/.txt` game-log file into the same Stage 2 JSON schema, sharing one parser across both entrypoints.

**Architecture:**
- New pure module `src/stage2/exportJson.ts` produces the Stage 2 JSON object from a `GameState` (browser path) and from a list of raw command lines (CLI path), so both entrypoints use exactly one parser/normalizer.
- Browser wires a new `Download JSON` button through `Header.tsx` → `App.tsx`, mirroring `handleDownloadCSV / handleDownloadLog / handleDownloadRecap`.
- CLI lives at `scripts/stage2/convert_game_log_to_json.mjs` (Node 18+, no external deps; imports the shared module via Vitest-compatible `tsx` is **not** allowed — instead we ship a small parser-runner that imports the shared TS through `vite-node` only if available, falling back to a JS twin file). Simplest acceptable design: rebuild via `tsc` to a `dist-stage2/` ES-module and have the CLI import that. We use `tsc --project tsconfig.stage2.json` to emit ES output to `dist-stage2/`, and the CLI imports `dist-stage2/stage2/exportJson.js`. Build runs as part of `npm run stage2:build`.
- All parsing is deterministic — no `parse_confidence`, `warnings` only on commands the converter cannot interpret.

**Tech Stack:** TypeScript, React 18, Vite 5, Vitest, Node ≥18 (built-in `node:fs`, `node:path`, `node:process`).

---

## File Structure

**Create:**
- `src/stage2/exportJson.ts` — pure conversion logic (game-state→json, lines→json, single parser)
- `src/stage2/types.ts` — TypeScript types for the Stage 2 JSON schema
- `tests/stage2/exportJson.test.ts` — unit tests for parser + builder
- `tests/stage2/cli.test.ts` — integration test for the CLI script
- `scripts/stage2/convert_game_log_to_json.mjs` — Node CLI entry
- `tsconfig.stage2.json` — emits `dist-stage2/` ES modules for the CLI
- `tests/fixtures/stage2/game_20260118_mountain_view.log` — fixture log file
- `tests/fixtures/stage2/game_20260118_mountain_view.expected.json` — expected output for fixture

**Modify:**
- `src/ui/Header.tsx` — add `onDownloadJSON` prop + button in the existing button row
- `src/ui/App.tsx` — wire `handleDownloadJSON` (uses `toStage2Json` + existing `downloadFile`)
- `package.json` — add scripts: `stage2:build`, `stage2:convert`
- `.gitignore` — ignore `dist-stage2/`
- `tests/ui/Header.test.tsx` — assert the new button renders and fires its callback

**Don't touch:** `src/core/parser.ts` (parses **commands** for runtime execution; Stage 2 has different normalization rules — `3 → three`, `ft → free_throw`, `to`-with-stealer for opponent → `related_player`). Spec is explicit that confidence/inference is out of scope, so the Stage 2 parser is deliberately separate.

---

## JSON Schema (locked)

```ts
export interface Stage2Json {
  game_id: string;             // e.g. "game_20260118_mountain_view"
  source: "web_ui_command_history";
  export_type: "stage2_json_game_log";
  exported_at: string;         // ISO-8601 UTC
  game_context: {
    game_date: string;         // YYYY-MM-DD
    opponent: string | null;   // raw display name, may be ""
    opponent_alias: "op";
    home_team_label: "sf";
  };
  commands: Array<{
    command_index: number;
    raw_command: string;       // verbatim, including "+MM:SS " prefix when present
  }>;
  events: Stage2Event[];
}

export interface Stage2Event {
  event_id: string;            // "evt_000001" (1-based, zero-padded to 6)
  command_index: number;
  raw_command: string;
  clock_text: string | null;   // "+MM:SS" or null when absent
  elapsed_sec: number | null;
  video_timestamp_sec: number | null;
  event_type:
    | "shot"
    | "free_throw"
    | "turnover"
    | "offensive_rebound"
    | "defensive_rebound"
    | "rebound"
    | "tip"
    | "control_or_unknown";
  team: "home" | "op" | null;  // home === sf
  player: string | null;
  shot_type: "two" | "three" | "layup" | "free_throw" | null;
  result: "make" | "miss" | null;
  assist_player: string | null;
  related_player: string | null;
  warnings: string[];
}
```

> **Note on `team` for home:** Spec §"Output JSON Schema" example uses `"team": "home"`. Some examples use `"team": "sf"`. We standardize on `"home"` for sf-side rows and `"op"` for opponent-side rows, matching the §"Home Team Shot With Shooter and Assist" example which is the most explicit. `home_team_label: "sf"` documents the alias.

---

## Command Parsing Rules (canonical for Stage 2)

For each raw line:

1. Strip optional leading `N. ` (CLI may receive `21. +00:07 wes three make max`).
2. Trim trailing whitespace.
3. If the trimmed line begins with `+MM:SS`, capture `clock_text` and `elapsed_sec = MM*60 + SS`. Strip prefix → `body`.
4. Else `clock_text = null`, `elapsed_sec = null`, `body = trimmed`.
5. `video_timestamp_sec = elapsed_sec` (no offset yet).
6. Tokenize `body` on whitespace.

Then dispatch on tokens:

| Pattern                                          | event_type           | team   | player | shot_type    | result | assist_player | related_player | Notes |
|--------------------------------------------------|----------------------|--------|--------|--------------|--------|---------------|----------------|-------|
| `tip`                                            | `tip`                | null   | null   | null         | null   | null          | null           |       |
| `---`                                            | `control_or_unknown` | null   | null   | null         | null   | null          | null           | warning: "Preserved current UI control command without Stage 2 semantic interpretation" |
| `-t`, `-p ...`, `-s ...`, `-l ...`               | `control_or_unknown` | null   | null   | null         | null   | null          | null           | same warning |
| `op SHOT RESULT`                                 | `shot`               | `op`   | null   | normalized   | norm   | null          | null           |       |
| `op ft RESULT [RESULT...]`                       | `free_throw`         | `op`   | null   | `free_throw` | norm   | null          | null           | one event per FT result; see "Free throws" below |
| `op or` / `op dr` / `op reb`                     | rebound variant      | `op`   | null   | null         | null   | null          | null           |       |
| `op to`                                          | `turnover`           | `op`   | null   | null         | null   | null          | null           |       |
| `op to PLAYER`                                   | `turnover`           | `op`   | null   | null         | null   | null          | PLAYER         |       |
| `PLAYER SHOT RESULT`                             | `shot`               | `home` | PLAYER | normalized   | norm   | null          | null           |       |
| `PLAYER SHOT RESULT ASSIST`                      | `shot`               | `home` | PLAYER | normalized   | norm   | ASSIST        | null           | when result=`make` only — see below |
| `PLAYER SHOT miss BLOCKER`                       | `shot`               | `home` | PLAYER | normalized   | `miss` | null          | BLOCKER        |       |
| `PLAYER ft RESULT [RESULT...]`                   | `free_throw`         | `home` | PLAYER | `free_throw` | norm   | null          | null           | one event per FT result |
| `PLAYER or` / `PLAYER dr` / `PLAYER reb`         | rebound variant      | `home` | PLAYER | null         | null   | null          | null           |       |
| `PLAYER to`                                      | `turnover`           | `home` | PLAYER | null         | null   | null          | null           |       |
| `PLAYER to STEALER`                              | `turnover`           | `home` | PLAYER | null         | null   | null          | STEALER        |       |
| anything else                                    | `control_or_unknown` | null   | null   | null         | null   | null          | null           | warning: "Unrecognized command" |

**Shot-type normalization:** `two→two`, `three→three`, `3→three`, `layup→layup`, `jumper/midrange/paint/floater/hook→two` (treated as 2-pt shots), `ft→free_throw`.
**Result normalization:** `make/made/score→make`, `miss/missed→miss`. Anything else on a shot line → `warnings: ["Unrecognized result"]`, `result=null`.

**Free throws:** A line like `op ft miss` produces ONE event `free_throw / op / null / miss`. A line like `alex ft make miss make` produces THREE events with the **same** `command_index` and **same** `raw_command`, distinguished by `event_id`. (The original `commands[]` entry is still a single row.)

**Player identity:** Stage 2 Phase 1 has no roster lookup — any non-`op` first token in a non-control line is treated as a player name, lowercase, verbatim.

---

## game_id Derivation

**Browser path** (uses GameState):
- Date: prefer `state.createdAt` formatted as YYYYMMDD in **local time**. Fallback: today.
- Opponent slug: derived from `state.roster.find(p => p.id === "op")?.displayName || state.opponentName`.
  - Lowercase, trim, replace any `[^a-z0-9]+` run with `_`, strip leading/trailing `_`.
  - If empty after sanitization → omit opponent segment.
- Final: `game_${YYYYMMDD}` or `game_${YYYYMMDD}_${slug}`.
- Filename equals `${game_id}.json`.

**CLI path** (uses input filename):
- `path.basename(input, path.extname(input))` → sanitize same way → use as `game_id`. Do not regenerate from current date.
- Default output: same dir as input, same basename, `.json` extension.
- `--output <path>` overrides the output path.

---

## Tests-First Order

Every code-producing task below follows TDD: red → green → commit. Test file paths are absolute under `/Users/tiliu5/proj-e/live-stats`.

---

### Task 1: Add Stage 2 type definitions

**Files:**
- Create: `src/stage2/types.ts`

- [ ] **Step 1: Create the type file**

```ts
// src/stage2/types.ts
export type Stage2EventType =
  | "shot"
  | "free_throw"
  | "turnover"
  | "offensive_rebound"
  | "defensive_rebound"
  | "rebound"
  | "tip"
  | "control_or_unknown";

export type Stage2Team = "home" | "op";
export type Stage2ShotType = "two" | "three" | "layup" | "free_throw";
export type Stage2Result = "make" | "miss";

export interface Stage2Event {
  event_id: string;
  command_index: number;
  raw_command: string;
  clock_text: string | null;
  elapsed_sec: number | null;
  video_timestamp_sec: number | null;
  event_type: Stage2EventType;
  team: Stage2Team | null;
  player: string | null;
  shot_type: Stage2ShotType | null;
  result: Stage2Result | null;
  assist_player: string | null;
  related_player: string | null;
  warnings: string[];
}

export interface Stage2Command {
  command_index: number;
  raw_command: string;
}

export interface Stage2GameContext {
  game_date: string;
  opponent: string | null;
  opponent_alias: "op";
  home_team_label: "sf";
}

export interface Stage2Json {
  game_id: string;
  source: "web_ui_command_history";
  export_type: "stage2_json_game_log";
  exported_at: string;
  game_context: Stage2GameContext;
  commands: Stage2Command[];
  events: Stage2Event[];
}
```

- [ ] **Step 2: Verify type-check passes**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/stage2/types.ts
git commit -m "feat(stage2): add Stage 2 JSON type definitions"
```

---

### Task 2: Write parser tests (red)

**Files:**
- Create: `tests/stage2/exportJson.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/stage2/exportJson.test.ts
import { describe, it, expect } from "vitest";
import {
  parseLineToEvents,
  buildStage2Json,
  buildStage2JsonFromLines,
  sanitizeSlug,
} from "@/stage2/exportJson";

describe("parseLineToEvents", () => {
  it("parses home shot with assist", () => {
    const events = parseLineToEvents("+02:10 james layup make alden", 0);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      event_type: "shot",
      team: "home",
      player: "james",
      shot_type: "layup",
      result: "make",
      assist_player: "alden",
      clock_text: "+02:10",
      elapsed_sec: 130,
      video_timestamp_sec: 130,
      warnings: [],
    });
  });

  it("parses wes three make max as wes/three/make/max", () => {
    const events = parseLineToEvents("+00:07 wes three make max", 5);
    expect(events[0]).toMatchObject({
      player: "wes",
      shot_type: "three",
      result: "make",
      assist_player: "max",
    });
  });

  it("parses alden layup make wes as alden/layup/make/wes", () => {
    const events = parseLineToEvents("+00:41 alden layup make wes", 9);
    expect(events[0]).toMatchObject({
      player: "alden",
      shot_type: "layup",
      result: "make",
      assist_player: "wes",
    });
  });

  it("parses missed home shot without assist", () => {
    const events = parseLineToEvents("+01:52 ayaan layup miss", 2);
    expect(events[0]).toMatchObject({
      event_type: "shot",
      team: "home",
      player: "ayaan",
      shot_type: "layup",
      result: "miss",
      assist_player: null,
    });
  });

  it("parses opponent three miss", () => {
    const events = parseLineToEvents("+00:12 op three miss", 3);
    expect(events[0]).toMatchObject({
      event_type: "shot",
      team: "op",
      player: null,
      shot_type: "three",
      result: "miss",
    });
  });

  it("parses opponent layup make (no shot result word check)", () => {
    const events = parseLineToEvents("+02:41 op layup make", 1);
    expect(events[0]).toMatchObject({
      event_type: "shot",
      team: "op",
      shot_type: "layup",
      result: "make",
    });
  });

  it("normalizes 3 -> three", () => {
    const events = parseLineToEvents("+00:30 james 3 make", 0);
    expect(events[0].shot_type).toBe("three");
  });

  it("emits one free_throw event per ft result token", () => {
    const events = parseLineToEvents("+00:24 op ft make", 0);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      event_type: "free_throw",
      team: "op",
      shot_type: "free_throw",
      result: "make",
    });
  });

  it("emits multiple events for multi-shot ft line, sharing command_index", () => {
    const events = parseLineToEvents("+00:24 alex ft make miss make", 7);
    expect(events).toHaveLength(3);
    expect(events.map(e => e.result)).toEqual(["make", "miss", "make"]);
    expect(events.every(e => e.command_index === 7)).toBe(true);
    expect(events.every(e => e.raw_command === "+00:24 alex ft make miss make")).toBe(true);
    expect(new Set(events.map(e => e.event_id)).size).toBe(3);
  });

  it("parses home turnover", () => {
    const events = parseLineToEvents("+02:46 alden to", 0);
    expect(events[0]).toMatchObject({
      event_type: "turnover",
      team: "home",
      player: "alden",
      related_player: null,
    });
  });

  it("parses opponent turnover with stealer as related_player", () => {
    const events = parseLineToEvents("+00:51 op to alden", 0);
    expect(events[0]).toMatchObject({
      event_type: "turnover",
      team: "op",
      player: null,
      related_player: "alden",
    });
  });

  it("parses op or as offensive_rebound for op", () => {
    const events = parseLineToEvents("+00:17 op or", 0);
    expect(events[0]).toMatchObject({
      event_type: "offensive_rebound",
      team: "op",
    });
  });

  it("parses tip as event_type tip with no team/player", () => {
    const events = parseLineToEvents("+00:00 tip", 0);
    expect(events[0]).toMatchObject({
      event_type: "tip",
      team: null,
      player: null,
      warnings: [],
    });
  });

  it("preserves UI control --- with warning", () => {
    const events = parseLineToEvents("+02:21 ---", 0);
    expect(events[0]).toMatchObject({
      event_type: "control_or_unknown",
      raw_command: "+02:21 ---",
    });
    expect(events[0].warnings).toContain(
      "Preserved current UI control command without Stage 2 semantic interpretation",
    );
  });

  it("preserves -p op with warning", () => {
    const events = parseLineToEvents("+01:37 -p op", 0);
    expect(events[0].event_type).toBe("control_or_unknown");
    expect(events[0].warnings.length).toBe(1);
  });

  it("strips numbered list prefix like '21. '", () => {
    const events = parseLineToEvents("21. +00:07 wes three make max", 20);
    expect(events[0]).toMatchObject({
      raw_command: "+00:07 wes three make max",
      player: "wes",
      shot_type: "three",
      assist_player: "max",
    });
  });

  it("event_id is zero-padded 6 digits, 1-based", () => {
    const events = parseLineToEvents("+00:00 tip", 0);
    expect(events[0].event_id).toBe("evt_000001");
  });

  it("never emits parse_confidence", () => {
    const events = parseLineToEvents("+00:00 tip", 0);
    expect("parse_confidence" in events[0]).toBe(false);
  });
});

describe("sanitizeSlug", () => {
  it("lowercases and replaces spaces with underscores", () => {
    expect(sanitizeSlug("Mountain View")).toBe("mountain_view");
  });
  it("strips unsafe chars", () => {
    expect(sanitizeSlug("Palo Alto / North!")).toBe("palo_alto_north");
  });
  it("returns empty string for blank input", () => {
    expect(sanitizeSlug("")).toBe("");
    expect(sanitizeSlug("   ")).toBe("");
  });
});

describe("buildStage2JsonFromLines", () => {
  it("preserves every line in commands[] in order", () => {
    const json = buildStage2JsonFromLines(
      ["+02:46 alden to", "+02:41 op layup make", "+00:00 tip"],
      { game_id: "game_20260118", game_date: "2026-01-18", opponent: null },
      { exportedAt: "2026-01-18T20:15:30.000Z" },
    );
    expect(json.commands).toHaveLength(3);
    expect(json.commands.map(c => c.command_index)).toEqual([0, 1, 2]);
    expect(json.commands[0].raw_command).toBe("+02:46 alden to");
  });

  it("preserves command order when ft expansion creates extra events", () => {
    const json = buildStage2JsonFromLines(
      ["+00:24 alex ft make miss"],
      { game_id: "g", game_date: "2026-01-18", opponent: null },
      { exportedAt: "2026-01-18T20:15:30.000Z" },
    );
    expect(json.commands).toHaveLength(1);
    expect(json.events).toHaveLength(2);
    expect(json.events.every(e => e.command_index === 0)).toBe(true);
  });

  it("renumbers event_id sequentially across the whole game", () => {
    const json = buildStage2JsonFromLines(
      ["+00:00 tip", "+00:24 alex ft make miss"],
      { game_id: "g", game_date: "2026-01-18", opponent: null },
      { exportedAt: "2026-01-18T20:15:30.000Z" },
    );
    expect(json.events.map(e => e.event_id)).toEqual([
      "evt_000001",
      "evt_000002",
      "evt_000003",
    ]);
  });

  it("sets fixed source/export_type fields", () => {
    const json = buildStage2JsonFromLines(
      [],
      { game_id: "g", game_date: "2026-01-18", opponent: null },
      { exportedAt: "2026-01-18T20:15:30.000Z" },
    );
    expect(json.source).toBe("web_ui_command_history");
    expect(json.export_type).toBe("stage2_json_game_log");
    expect(json.game_context.opponent_alias).toBe("op");
    expect(json.game_context.home_team_label).toBe("sf");
  });
});

describe("buildStage2Json (from GameState)", () => {
  it("produces game_id with sanitized opponent slug", () => {
    // we test this end-to-end in a separate task with a real GameState fixture
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/stage2/exportJson.test.ts`
Expected: FAIL — module `@/stage2/exportJson` does not exist.

- [ ] **Step 3: Commit (red phase)**

```bash
git add tests/stage2/exportJson.test.ts
git commit -m "test(stage2): add exportJson parser tests (red)"
```

---

### Task 3: Implement `src/stage2/exportJson.ts` (green)

**Files:**
- Create: `src/stage2/exportJson.ts`

- [ ] **Step 1: Implement the module**

```ts
// src/stage2/exportJson.ts
import type { GameState } from "@/core/types";
import type {
  Stage2Event,
  Stage2EventType,
  Stage2Json,
  Stage2Result,
  Stage2ShotType,
  Stage2Team,
} from "./types";

// ---------- public API ----------

export interface BuildContext {
  game_id: string;
  game_date: string;     // YYYY-MM-DD
  opponent: string | null;
}

export interface BuildOptions {
  exportedAt?: string;   // ISO; defaults to new Date().toISOString()
}

export function buildStage2JsonFromLines(
  rawLines: string[],
  ctx: BuildContext,
  opts: BuildOptions = {},
): Stage2Json {
  const lines = rawLines.map(l => stripListPrefix(l).trimEnd());
  const commands = lines.map((raw_command, i) => ({ command_index: i, raw_command }));

  const events: Stage2Event[] = [];
  let counter = 1;
  for (let i = 0; i < lines.length; i++) {
    const parsed = parseLineToEvents(lines[i], i);
    for (const e of parsed) {
      events.push({ ...e, event_id: padEventId(counter++) });
    }
  }

  return {
    game_id: ctx.game_id,
    source: "web_ui_command_history",
    export_type: "stage2_json_game_log",
    exported_at: opts.exportedAt ?? new Date().toISOString(),
    game_context: {
      game_date: ctx.game_date,
      opponent: ctx.opponent,
      opponent_alias: "op",
      home_team_label: "sf",
    },
    commands,
    events,
  };
}

export function buildStage2Json(state: GameState, opts: BuildOptions = {}): Stage2Json {
  const lines = state.commandHistory.map(h => formatHistoryLine(h));
  const date = formatLocalDate(state.createdAt ?? Date.now());
  const opponentDisplay =
    state.roster.find(p => p.id === "op")?.displayName ||
    state.opponentName ||
    "";
  const slug = sanitizeSlug(opponentDisplay);
  const compactDate = date.replace(/-/g, "");
  const game_id = slug ? `game_${compactDate}_${slug}` : `game_${compactDate}`;
  return buildStage2JsonFromLines(
    lines,
    {
      game_id,
      game_date: date,
      opponent: opponentDisplay || null,
    },
    opts,
  );
}

export function deriveGameIdFromFilename(basenameNoExt: string): string {
  const slug = sanitizeSlug(basenameNoExt);
  // CLI rule: preserve filename-derived id verbatim after sanitization
  return slug;
}

// ---------- parsing ----------

const CTRL_WARNING =
  "Preserved current UI control command without Stage 2 semantic interpretation";

export function parseLineToEvents(rawInput: string, command_index: number): Stage2Event[] {
  const raw_command = stripListPrefix(rawInput).trimEnd();

  // Split off optional +MM:SS prefix.
  const clockMatch = raw_command.match(/^\+(\d{1,2}):(\d{2})(?:\s+(.*))?$/);
  let clock_text: string | null = null;
  let elapsed_sec: number | null = null;
  let body: string;
  if (clockMatch) {
    const mm = parseInt(clockMatch[1], 10);
    const ss = parseInt(clockMatch[2], 10);
    clock_text = `+${pad2(mm)}:${pad2(ss)}`;
    elapsed_sec = mm * 60 + ss;
    body = (clockMatch[3] ?? "").trim();
  } else {
    body = raw_command.trim();
  }

  const baseFields = {
    command_index,
    raw_command,
    clock_text,
    elapsed_sec,
    video_timestamp_sec: elapsed_sec,
  };

  const tokens = body.length === 0 ? [] : body.split(/\s+/);
  if (tokens.length === 0) {
    return [makeEvent(baseFields, {
      event_type: "control_or_unknown",
      warnings: [CTRL_WARNING],
    })];
  }

  // Special tokens
  if (tokens.length === 1 && tokens[0] === "tip") {
    return [makeEvent(baseFields, { event_type: "tip" })];
  }
  if (tokens[0] === "---" || tokens[0].startsWith("-")) {
    return [makeEvent(baseFields, {
      event_type: "control_or_unknown",
      warnings: [CTRL_WARNING],
    })];
  }

  const isOp = tokens[0] === "op";
  const team: Stage2Team = isOp ? "op" : "home";
  const player: string | null = isOp ? null : tokens[0];
  const rest = tokens.slice(1);

  // Rebound
  if (rest.length === 1 && (rest[0] === "or" || rest[0] === "dr" || rest[0] === "reb")) {
    const evType: Stage2EventType =
      rest[0] === "or" ? "offensive_rebound" :
      rest[0] === "dr" ? "defensive_rebound" : "rebound";
    return [makeEvent(baseFields, { event_type: evType, team, player })];
  }

  // Turnover
  if (rest[0] === "to") {
    const related = rest[1] ?? null;
    return [makeEvent(baseFields, {
      event_type: "turnover",
      team,
      player,
      related_player: related,
    })];
  }

  // Free throws: PLAYER ft RESULT [RESULT...]
  if (rest[0] === "ft") {
    const results = rest.slice(1);
    if (results.length === 0) {
      return [makeEvent(baseFields, {
        event_type: "control_or_unknown",
        warnings: ["Unrecognized command"],
      })];
    }
    return results.map(r => {
      const norm = normalizeResult(r);
      return makeEvent(baseFields, {
        event_type: "free_throw",
        team,
        player,
        shot_type: "free_throw",
        result: norm.result,
        warnings: norm.warning ? [norm.warning] : [],
      });
    });
  }

  // Shot: PLAYER SHOT RESULT [ASSIST_OR_BLOCKER]
  if (rest.length >= 2) {
    const shotTok = rest[0];
    const resultTok = rest[1];
    const fourth = rest[2] ?? null;
    const shot_type = normalizeShotType(shotTok);
    if (shot_type === null) {
      return [makeEvent(baseFields, {
        event_type: "control_or_unknown",
        warnings: ["Unrecognized command"],
      })];
    }
    const norm = normalizeResult(resultTok);
    let assist_player: string | null = null;
    let related_player: string | null = null;
    if (fourth) {
      if (norm.result === "make") assist_player = fourth;
      else related_player = fourth; // blocker on a miss
    }
    return [makeEvent(baseFields, {
      event_type: "shot",
      team,
      player,
      shot_type,
      result: norm.result,
      assist_player,
      related_player,
      warnings: norm.warning ? [norm.warning] : [],
    })];
  }

  return [makeEvent(baseFields, {
    event_type: "control_or_unknown",
    warnings: ["Unrecognized command"],
  })];
}

// ---------- helpers ----------

function makeEvent(
  base: Pick<Stage2Event, "command_index" | "raw_command" | "clock_text" | "elapsed_sec" | "video_timestamp_sec">,
  overrides: Partial<Stage2Event> & Pick<Stage2Event, "event_type">,
): Stage2Event {
  return {
    event_id: "evt_000000", // overwritten by buildStage2JsonFromLines
    ...base,
    team: null,
    player: null,
    shot_type: null,
    result: null,
    assist_player: null,
    related_player: null,
    warnings: [],
    ...overrides,
  };
}

function normalizeShotType(tok: string): Stage2ShotType | null {
  switch (tok) {
    case "two": return "two";
    case "three": return "three";
    case "3": return "three";
    case "layup": return "layup";
    case "jumper":
    case "midrange":
    case "paint":
    case "floater":
    case "hook":
      return "two";
    case "ft":
      return "free_throw";
    default:
      return null;
  }
}

function normalizeResult(tok: string): { result: Stage2Result | null; warning: string | null } {
  switch (tok) {
    case "make":
    case "made":
    case "score":
      return { result: "make", warning: null };
    case "miss":
    case "missed":
      return { result: "miss", warning: null };
    default:
      return { result: null, warning: "Unrecognized result" };
  }
}

function stripListPrefix(s: string): string {
  return s.replace(/^\s*\d+\.\s+/, "");
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function padEventId(n: number): string {
  return `evt_${n.toString().padStart(6, "0")}`;
}

function formatHistoryLine(entry: { line: string; tMs: number | null }): string {
  // GameState.commandHistory may have tMs separate from raw line. Stage 2 needs
  // the "+MM:SS body" form. The runtime UI list already prepends formatElapsed,
  // so use the same convention.
  if (entry.tMs === null) return entry.line;
  return `${formatElapsed(entry.tMs)} ${entry.line}`;
}

// Small local copy to avoid pulling clock.ts into the bundled CLI build.
function formatElapsed(tMs: number | null): string {
  if (tMs === null) return "--:--";
  const safe = Math.max(0, Math.floor(tMs / 1000));
  const mm = Math.floor(safe / 60).toString().padStart(2, "0");
  const ss = (safe % 60).toString().padStart(2, "0");
  return `+${mm}:${ss}`;
}

function formatLocalDate(ts: number): string {
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  return `${yyyy}-${mm}-${dd}`;
}

export function sanitizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx vitest run tests/stage2/exportJson.test.ts`
Expected: PASS (all 22+ assertions).

- [ ] **Step 3: Run the whole suite to confirm no regressions**

Run: `npx vitest run`
Expected: all existing tests still pass.

- [ ] **Step 4: Commit**

```bash
git add src/stage2/exportJson.ts
git commit -m "feat(stage2): implement Stage 2 JSON parser and builder"
```

---

### Task 4: Wire `Download JSON` button into Header

**Files:**
- Modify: `src/ui/Header.tsx`
- Modify: `tests/ui/Header.test.tsx`

- [ ] **Step 1: Extend Header test (red)**

Add a test asserting the new button renders and calls `onDownloadJSON`.

```ts
// inside tests/ui/Header.test.tsx, add a new test
it("renders Download JSON button and fires callback", async () => {
  const user = userEvent.setup();
  const onDownloadJSON = vi.fn();
  render(
    <Header
      opponentName="Mitty"
      onNewGame={() => {}}
      onOpenRosterEditor={() => {}}
      onDownloadCSV={() => {}}
      onDownloadLog={() => {}}
      onDownloadJSON={onDownloadJSON}
    />,
  );
  await user.click(screen.getByRole("button", { name: /download json/i }));
  expect(onDownloadJSON).toHaveBeenCalledOnce();
});
```

Run: `npx vitest run tests/ui/Header.test.tsx`
Expected: FAIL — `onDownloadJSON` not in props / button not found.

- [ ] **Step 2: Add the prop and button**

In `src/ui/Header.tsx`:
- Add `onDownloadJSON?: () => void;` to `HeaderProps`.
- Destructure `onDownloadJSON` in the component signature.
- After the existing `Download Recap` block, add:

```tsx
{onDownloadJSON !== undefined && (
  <button
    type="button"
    className={`${styles.btn} ${styles.btnSecondary}`}
    onClick={onDownloadJSON}
  >
    Download JSON
  </button>
)}
```

- [ ] **Step 3: Verify Header tests pass**

Run: `npx vitest run tests/ui/Header.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/ui/Header.tsx tests/ui/Header.test.tsx
git commit -m "feat(ui): add Download JSON button to header"
```

---

### Task 5: Wire `handleDownloadJSON` into App

**Files:**
- Modify: `src/ui/App.tsx`

- [ ] **Step 1: Add handler and pass it to Header**

In `App.tsx`, after `handleDownloadRecap`:

```tsx
const handleDownloadJSON = () => {
  const json = buildStage2Json(state);
  downloadFile(`${json.game_id}.json`, JSON.stringify(json, null, 2), "application/json");
};
```

Add the import at the top:

```tsx
import { buildStage2Json } from "@/stage2/exportJson";
```

Pass it to `Header`:

```tsx
<Header
  ...
  onDownloadJSON={handleDownloadJSON}
/>
```

- [ ] **Step 2: Manual sanity build**

Run: `npx tsc --noEmit && npx vite build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/ui/App.tsx
git commit -m "feat(ui): wire Download JSON to App"
```

---

### Task 6: Add an integration test that the browser path produces correct JSON

**Files:**
- Create: `tests/stage2/browserExport.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/stage2/browserExport.test.ts
import { describe, it, expect } from "vitest";
import { buildStage2Json } from "@/stage2/exportJson";
import { createInitialState } from "@/core/state";
import { DEFAULT_ROSTER } from "@/core/roster";
import { execute } from "@/core/executor";
import { parseCommand } from "@/core/parser";

describe("buildStage2Json (browser path)", () => {
  it("derives game_id from sanitized opponent display name", () => {
    const state = createInitialState({
      opponentName: "Mountain View",
      roster: DEFAULT_ROSTER,
    });
    const json = buildStage2Json(state, { exportedAt: "2026-01-18T20:15:30.000Z" });
    expect(json.game_id).toMatch(/^game_\d{8}_mountain_view$/);
    expect(json.game_context.opponent).toBe("Mountain View");
  });

  it("falls back to date-only id when opponent is blank", () => {
    const state = createInitialState({ opponentName: "", roster: DEFAULT_ROSTER });
    const json = buildStage2Json(state, { exportedAt: "2026-01-18T20:15:30.000Z" });
    expect(json.game_id).toMatch(/^game_\d{8}$/);
  });

  it("converts a small command-history sequence end-to-end", () => {
    let state = createInitialState({ opponentName: "Mitty", roster: DEFAULT_ROSTER });
    state = { ...state, lineup: ["jackson", "ayaan", "alden", "wes", "max"] };
    const inputs = ["tip", "jackson two make ayaan", "op three miss", "wes or"];
    for (const line of inputs) {
      state = execute(state, parseCommand(line, state.roster), line);
    }
    const json = buildStage2Json(state, { exportedAt: "2026-01-18T20:15:30.000Z" });
    expect(json.commands.length).toBe(state.commandHistory.length);
    expect(json.events.length).toBeGreaterThanOrEqual(state.commandHistory.length);
    expect(json.events[0].event_type).toBe("tip");
    expect(json.events.find(e => e.event_type === "shot" && e.player === "jackson")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run and verify**

Run: `npx vitest run tests/stage2/browserExport.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/stage2/browserExport.test.ts
git commit -m "test(stage2): integration test for browser-path JSON export"
```

---

### Task 7: Set up CLI build pipeline

**Files:**
- Create: `tsconfig.stage2.json`
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Create `tsconfig.stage2.json`**

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "outDir": "dist-stage2",
    "rootDir": "src",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "declaration": false,
    "sourceMap": false,
    "isolatedModules": false,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src/stage2/**/*", "src/core/types.ts"]
}
```

> Note: only `types.ts` needs to be included from `src/core` because `exportJson.ts` only imports `GameState` as a `type`. If TS still fails, mark the import as `import type` and rely on type erasure — no runtime dependency on `src/core/*` is added.

- [ ] **Step 2: Append `dist-stage2/` to `.gitignore`**

```
dist-stage2/
```

- [ ] **Step 3: Add npm scripts**

In `package.json`:

```json
"scripts": {
  ...
  "stage2:build": "tsc -p tsconfig.stage2.json",
  "stage2:convert": "node scripts/stage2/convert_game_log_to_json.mjs"
}
```

- [ ] **Step 4: Verify the build emits a runnable ES module**

Run: `npm run stage2:build && node -e "import('./dist-stage2/stage2/exportJson.js').then(m => console.log(typeof m.buildStage2JsonFromLines))"`
Expected output: `function`.

- [ ] **Step 5: Commit**

```bash
git add tsconfig.stage2.json package.json .gitignore
git commit -m "chore(stage2): add CLI build pipeline (tsconfig.stage2.json)"
```

---

### Task 8: Write CLI test (red)

**Files:**
- Create: `tests/fixtures/stage2/game_20260118_mountain_view.log`
- Create: `tests/stage2/cli.test.ts`

- [ ] **Step 1: Create the fixture log**

Contents of `tests/fixtures/stage2/game_20260118_mountain_view.log` (copy verbatim, no leading list numbers):

```
+02:46 alden to
+02:41 op layup make
+02:33 james three make
+02:21 ---
+02:10 james layup make alden
+01:59 op two make
+01:52 ayaan layup miss
+01:43 op three make
+01:37 -p op
+01:36 -p op
+01:19 -t
+01:12 -s ayaan john
+01:05 -p op
+01:02 max to
+00:51 op to alden
+00:41 alden layup make wes
+00:26 op ft miss
+00:24 op ft make
+00:17 op or
+00:12 op three miss
+00:07 wes three make max
+00:00 tip
```

- [ ] **Step 2: Write the CLI test**

```ts
// tests/stage2/cli.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const fixture = resolve(__dirname, "../fixtures/stage2/game_20260118_mountain_view.log");
const expectedOut = resolve(__dirname, "../fixtures/stage2/game_20260118_mountain_view.json");
const cli = resolve(__dirname, "../../scripts/stage2/convert_game_log_to_json.mjs");

beforeAll(() => {
  // Ensure the build artifact exists before the CLI test runs.
  execFileSync("npm", ["run", "stage2:build"], { stdio: "ignore" });
});

describe("convert_game_log_to_json CLI", () => {
  it("converts the fixture file to a sibling .json with the expected schema", () => {
    if (existsSync(expectedOut)) rmSync(expectedOut);
    const stdout = execFileSync("node", [cli, fixture]).toString();
    expect(stdout).toMatch(/Converted game log to Stage 2 JSON/);
    expect(stdout).toMatch(/Game ID: game_20260118_mountain_view/);
    expect(existsSync(expectedOut)).toBe(true);
    const json = JSON.parse(readFileSync(expectedOut, "utf-8"));
    expect(json.game_id).toBe("game_20260118_mountain_view");
    expect(json.source).toBe("web_ui_command_history");
    expect(json.export_type).toBe("stage2_json_game_log");
    expect(json.commands).toHaveLength(22);
    // wes three make max sanity
    const wesShot = json.events.find(
      (e: any) => e.player === "wes" && e.shot_type === "three",
    );
    expect(wesShot.assist_player).toBe("max");
    expect(wesShot.result).toBe("make");
    // alden layup make wes sanity
    const aldenShot = json.events.find(
      (e: any) => e.player === "alden" && e.shot_type === "layup" && e.result === "make",
    );
    expect(aldenShot.assist_player).toBe("wes");
    // No parse_confidence anywhere
    for (const e of json.events) expect("parse_confidence" in e).toBe(false);
    // Cleanup so subsequent runs are deterministic
    rmSync(expectedOut);
  });

  it("supports --output for explicit output path", () => {
    const customOut = resolve(__dirname, "../fixtures/stage2/custom-out.json");
    if (existsSync(customOut)) rmSync(customOut);
    execFileSync("node", [cli, fixture, "--output", customOut]);
    expect(existsSync(customOut)).toBe(true);
    rmSync(customOut);
  });

  it("strips numbered list prefixes like '21. '", () => {
    const numberedFixture = resolve(__dirname, "../fixtures/stage2/numbered.log");
    const out = resolve(__dirname, "../fixtures/stage2/numbered.json");
    require("node:fs").writeFileSync(
      numberedFixture,
      "1. +02:46 alden to\n21. +00:07 wes three make max\n",
    );
    if (existsSync(out)) rmSync(out);
    execFileSync("node", [cli, numberedFixture]);
    const json = JSON.parse(readFileSync(out, "utf-8"));
    expect(json.commands[1].raw_command).toBe("+00:07 wes three make max");
    expect(json.events[1].player).toBe("wes");
    expect(json.events[1].assist_player).toBe("max");
    rmSync(numberedFixture);
    rmSync(out);
  });

  it("exits non-zero when input file is missing", () => {
    let code = 0;
    try {
      execFileSync("node", [cli, "/nonexistent.log"], { stdio: "ignore" });
    } catch (e: any) {
      code = e.status ?? 1;
    }
    expect(code).not.toBe(0);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run tests/stage2/cli.test.ts`
Expected: FAIL — CLI script does not exist yet.

- [ ] **Step 4: Commit**

```bash
git add tests/fixtures/stage2 tests/stage2/cli.test.ts
git commit -m "test(stage2): CLI conversion tests + fixture log (red)"
```

---

### Task 9: Implement the CLI script (green)

**Files:**
- Create: `scripts/stage2/convert_game_log_to_json.mjs`

- [ ] **Step 1: Write the CLI**

```js
// scripts/stage2/convert_game_log_to_json.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, basename, extname, dirname } from "node:path";
import { argv, exit } from "node:process";
import { pathToFileURL } from "node:url";

async function loadExporter() {
  // Prefer pre-built ES module under dist-stage2/.
  const url = pathToFileURL(
    resolve(process.cwd(), "dist-stage2", "stage2", "exportJson.js"),
  ).href;
  return import(url);
}

function parseArgs(args) {
  const out = { input: null, output: null };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--output" || a === "-o") {
      out.output = args[++i] ?? null;
    } else if (!out.input) {
      out.input = a;
    }
  }
  return out;
}

function deriveGameDateFromGameId(game_id) {
  const m = game_id.match(/(\d{8})/);
  if (!m) return new Date().toISOString().slice(0, 10);
  const s = m[1];
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

async function main() {
  const { input, output } = parseArgs(argv.slice(2));
  if (!input) {
    console.error("Usage: convert_game_log_to_json.mjs <input.log> [--output <out.json>]");
    exit(2);
  }

  const inputPath = resolve(process.cwd(), input);
  let raw;
  try {
    raw = readFileSync(inputPath, "utf-8");
  } catch (e) {
    console.error(`Error: cannot read input file: ${inputPath}`);
    exit(1);
  }

  const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);

  const { buildStage2JsonFromLines, deriveGameIdFromFilename } = await loadExporter();
  const base = basename(inputPath, extname(inputPath));
  const game_id = deriveGameIdFromFilename(base) || base;
  const game_date = deriveGameDateFromGameId(game_id);

  const json = buildStage2JsonFromLines(
    lines,
    { game_id, game_date, opponent: null },
    { exportedAt: new Date().toISOString() },
  );

  const outPath = output
    ? resolve(process.cwd(), output)
    : resolve(dirname(inputPath), `${base}.json`);

  writeFileSync(outPath, JSON.stringify(json, null, 2));

  const warnings = json.events.reduce((n, e) => n + e.warnings.length, 0);
  console.log("Converted game log to Stage 2 JSON");
  console.log(`Input:  ${inputPath}`);
  console.log(`Output: ${outPath}`);
  console.log(`Game ID: ${json.game_id}`);
  console.log(`Commands: ${json.commands.length}`);
  console.log(`Events: ${json.events.length}`);
  console.log(`Warnings: ${warnings}`);
}

main().catch(err => {
  console.error(err?.message ?? err);
  exit(1);
});
```

- [ ] **Step 2: Build and run the CLI tests**

Run: `npm run stage2:build && npx vitest run tests/stage2/cli.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add scripts/stage2/convert_game_log_to_json.mjs
git commit -m "feat(stage2): CLI to convert game log file to Stage 2 JSON"
```

---

### Task 10: Final regression sweep + production build

**Files:** none

- [ ] **Step 1: Full vitest run**

Run: `npx vitest run`
Expected: all tests pass (existing 162 + new Stage 2 tests).

- [ ] **Step 2: Full type check**

Run: `npx tsc --noEmit && npm run stage2:build`
Expected: both succeed.

- [ ] **Step 3: Vite production build**

Run: `npx vite build`
Expected: bundle builds successfully and includes the new button.

- [ ] **Step 4: Manual smoke (optional, don't commit binaries)**

```bash
node scripts/stage2/convert_game_log_to_json.mjs tests/fixtures/stage2/game_20260118_mountain_view.log
cat tests/fixtures/stage2/game_20260118_mountain_view.json | head -40
rm tests/fixtures/stage2/game_20260118_mountain_view.json
```

- [ ] **Step 5: Verification — every acceptance criterion in the spec**

Walk through `docs/requirement/Stage-2/01_stage2_command_history_context_parser.md` UI Acceptance Criteria and CLI Acceptance Criteria sections; confirm each one is satisfied by tests or by the code itself.

- [ ] **Step 6: Commit any final touch-ups**

```bash
git status
# Only commit if there are pending changes that don't belong to earlier tasks.
```

---

## Open Questions / Risks

1. **`createdAt` on legacy saves.** Older `localStorage` saves may not have `createdAt`. `gameStore.loadGame` doesn't backfill it. The plan handles this with `state.createdAt ?? Date.now()` in `buildStage2Json`. Acceptable: a freshly imported old save exports today's date instead of the original game date. Spec says "comes from game date"; for a legacy save we don't have a better source.

2. **Block-on-miss vs assist-on-make.** Spec is silent on the fourth token of a *missed* shot, but `src/core/parser.ts` treats it as a blocker (rosterStats[9]++). To preserve information, the Stage 2 parser puts the fourth token in `related_player` on a miss and `assist_player` on a make. This is a forward-compatible choice; revisit if the reviewer disagrees.

3. **Free-throw event splitting.** Splitting `alex ft make miss make` into 3 events keeps the `events` array semantically clean for shot-chart use cases, while `commands[]` still has a single row. If the reviewer prefers 1:1 mapping between commands and events, switch the FT branch to emit one combined event with a `results: ["make","miss","make"]` array — but that breaks the locked schema's `result: "make" | "miss"` field shape, so we keep splitting.

4. **CLI dependency on a build step.** The CLI imports a compiled artifact from `dist-stage2/`. Alternatives considered: (a) `tsx` runtime — adds a dev dep; (b) duplicate parser in JS — violates "share parsing logic". Build-step approach keeps zero new runtime deps and is testable.

---

## Plan Review Loop

After saving this document, dispatch a `plan-document-reviewer` subagent with:
- Plan path: `docs/superpowers/plans/2026-05-19-stage2-phase1-download-json.md`
- Spec path: `docs/requirement/Stage-2/01_stage2_command_history_context_parser.md`

Iterate until ✅ Approved (max 3 cycles).
