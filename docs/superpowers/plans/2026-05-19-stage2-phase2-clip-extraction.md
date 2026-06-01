# Stage 2 Phase 2 — Clip Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compute a clip manifest (windows around shot/FT events) from the Phase 1 JSON timeline and physically extract those clips from a full game video. Two entrypoints share a single TypeScript manifest builder; the actual `.mp4` slicing happens in a Python CLI calling `ffmpeg`.

**Architecture:**
- New pure module `src/stage2/clipManifest.ts` builds a `ClipManifest` from a `Stage2Json` plus settings. It contains zero side effects and zero ffmpeg knowledge.
- New React view at hash route `#/games/:gameId/stage2/clips` that loads a Phase 1 JSON file (file picker — same in-memory state used elsewhere is also accepted), lets the user tweak `tipoff_time_sec / clip_before_sec / clip_after_sec / include_free_throws`, previews the manifest, and downloads it as JSON.
- New Python CLI `scripts/stage2/extract_clips.py` reads `(--video, --timeline, --output-dir, --tipoff, --before, --after, --include-free-throws)`, calls `ffmpeg -ss <start> -to <end> -i <video> -c copy <out>`, writes a manifest with `status: "extracted" | "failed" | "skipped"`. Uses only the Python stdlib + system `ffmpeg`.
- Hash router is a tiny ~15-line custom hook (`useHashRoute`) — no new npm deps. Cloudflare Pages serves the existing SPA shell unchanged.

**Tech Stack:** TypeScript, React 18, Vite 5, Vitest, Python ≥3.10 (stdlib only), system `ffmpeg` (already on `$PATH` for the user).

---

## Spec Clarifications (locked decisions)

The Phase 2 spec leaves several details ambiguous. The plan resolves them as follows; flagged as *Open Questions* if the reviewer disagrees.

1. **`video_timestamp` formula.** Spec example shows `elapsed_time_sec=41` and `video_timestamp=51` with `tipoff_time_sec=10`. So `video_timestamp_sec = tipoff_time_sec + elapsed_sec`. Phase 1 JSON's `video_timestamp_sec` field (which currently equals `elapsed_sec`) is **ignored** here — Phase 2 recomputes from the user-provided tipoff offset.
2. **Window math.** `video_start_sec = max(0, video_timestamp_sec − clip_before_sec)`; `video_end_sec = video_timestamp_sec + clip_after_sec`. `duration_sec = video_end_sec − video_start_sec`. (When the start clamp activates near t=0, `duration_sec < clip_before+clip_after`.)
3. **Selection rules.** Default: `event_type ∈ {"shot"}`. With `include_free_throws=true`: `event_type ∈ {"shot", "free_throw"}`. All other events (`turnover`, rebounds, `tip`, `control_or_unknown`) are skipped. Events whose `elapsed_sec === null` are skipped (cannot be located in video).
4. **`clip_id`.** `shot_NNNNNN` (1-based, zero-padded to 6) regardless of source `event_id`. Spec example uses `shot_000001` for `evt_000001`, but renumbering keeps clip ids dense even after we filter out non-shot events.
5. **`clip_path`.** Always `clips/<clip_id>.mp4` (relative). The Python CLI writes into `--output-dir/<clip_id>.mp4` and stores the **relative-to-output-dir** path in the manifest. The browser builder stores the same `clips/<clip_id>.mp4` purely as a planned filename.
6. **`status`.** Values: `"planned"` (browser builder always), `"extracted"`, `"failed"`, `"skipped"` (CLI sets these per clip).
7. **`source_video`.** Browser path: `null` (no video in browser). CLI path: `path.basename(--video)`.
8. **`game_id` source.** Always copy from the input Phase 1 JSON's `game_id`.

---

## File Structure

**Create:**
- `src/stage2/clipManifest.ts` — pure builder + types (re-exports the schema)
- `src/stage2/clipManifestTypes.ts` — types only (decoupled from build logic)
- `tests/stage2/clipManifest.test.ts` — unit tests for builder
- `src/ui/useHashRoute.ts` — custom hook returning current hash path
- `src/ui/ClipsView.tsx` + `ClipsView.module.css` — Phase 2 view
- `tests/ui/ClipsView.test.tsx` — component tests
- `scripts/stage2/extract_clips.py` — Python CLI (ffmpeg subprocess)
- `tests/stage2/extract_clips_py.test.ts` — Vitest spawning Python (no real video; uses `--dry-run`)
- `tests/fixtures/stage2/timeline_for_clips.json` — fixture Phase 1 JSON

**Modify:**
- `src/ui/App.tsx` — read `useHashRoute()` and render `ClipsView` when hash matches `#/games/:gameId/stage2/clips`. The existing live-tracking UI continues to render at `#/` or empty hash.
- `src/ui/Header.tsx` — add an optional `onOpenClipsView` prop wired to a new "Clips" button. Sets `location.hash = "#/games/<id>/stage2/clips"`.
- `package.json` — `stage2:extract-clips` script alias for the Python CLI.

**Don't touch:** `src/stage2/exportJson.ts` (Phase 1 stays frozen).

---

## Schema (locked)

```ts
// src/stage2/clipManifestTypes.ts
export interface ClipSettings {
  tipoff_time_sec: number;        // ≥ 0
  clip_before_sec: number;        // ≥ 0
  clip_after_sec: number;         // ≥ 0
  include_free_throws?: boolean;  // default false
}

export type ClipStatus = "planned" | "extracted" | "failed" | "skipped";

export interface Clip {
  clip_id: string;                // shot_NNNNNN
  event_id: string;               // from Phase 1 event
  raw_command: string;
  elapsed_time_sec: number;
  video_timestamp: number;        // tipoff + elapsed
  video_start_sec: number;
  video_end_sec: number;
  duration_sec: number;
  clip_path: string;              // clips/<clip_id>.mp4
  status: ClipStatus;
  status_detail?: string;         // CLI-only: ffmpeg stderr summary on failure
}

export interface ClipManifest {
  game_id: string;
  source: "web_ui_command_history";
  source_video: string | null;
  settings: ClipSettings;
  clips: Clip[];
}
```

---

## TDD Order

Each task is red → green → commit. Test paths absolute under `/Users/tiliu5/proj-e/live-stats`.

---

### Task 1: Add ClipManifest types

**Files:**
- Create: `src/stage2/clipManifestTypes.ts`

- [ ] **Step 1: Create the type file**

```ts
export interface ClipSettings {
  tipoff_time_sec: number;
  clip_before_sec: number;
  clip_after_sec: number;
  include_free_throws?: boolean;
}

export type ClipStatus = "planned" | "extracted" | "failed" | "skipped";

export interface Clip {
  clip_id: string;
  event_id: string;
  raw_command: string;
  elapsed_time_sec: number;
  video_timestamp: number;
  video_start_sec: number;
  video_end_sec: number;
  duration_sec: number;
  clip_path: string;
  status: ClipStatus;
  status_detail?: string;
}

export interface ClipManifest {
  game_id: string;
  source: "web_ui_command_history";
  source_video: string | null;
  settings: ClipSettings;
  clips: Clip[];
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/stage2/clipManifestTypes.ts
git commit -m "feat(stage2): add ClipManifest type definitions"
```

---

### Task 2: Builder tests (red)

**Files:**
- Create: `tests/stage2/clipManifest.test.ts`

- [ ] **Step 1: Write tests**

```ts
import { describe, it, expect } from "vitest";
import { buildClipManifest } from "@/stage2/clipManifest";
import type { Stage2Json } from "@/stage2/types";

const baseStage2: Stage2Json = {
  game_id: "game_20260118_mountain_view",
  source: "web_ui_command_history",
  export_type: "stage2_json_game_log",
  exported_at: "2026-01-18T20:15:30.000Z",
  game_context: {
    game_date: "2026-01-18",
    opponent: "Mountain View",
    opponent_alias: "op",
    home_team_label: "sf",
  },
  commands: [],
  events: [
    {
      event_id: "evt_000001", command_index: 0,
      raw_command: "+00:41 alden layup make wes",
      clock_text: "+00:41", elapsed_sec: 41, video_timestamp_sec: 41,
      event_type: "shot", team: "home", player: "alden",
      shot_type: "layup", result: "make",
      assist_player: "wes", related_player: null, warnings: [],
    },
    {
      event_id: "evt_000002", command_index: 1,
      raw_command: "+00:24 op ft make",
      clock_text: "+00:24", elapsed_sec: 24, video_timestamp_sec: 24,
      event_type: "free_throw", team: "op", player: null,
      shot_type: "free_throw", result: "make",
      assist_player: null, related_player: null, warnings: [],
    },
    {
      event_id: "evt_000003", command_index: 2,
      raw_command: "+00:17 op or",
      clock_text: "+00:17", elapsed_sec: 17, video_timestamp_sec: 17,
      event_type: "offensive_rebound", team: "op", player: null,
      shot_type: null, result: null,
      assist_player: null, related_player: null, warnings: [],
    },
  ],
};

describe("buildClipManifest", () => {
  it("includes only shot events by default", () => {
    const manifest = buildClipManifest(baseStage2, {
      tipoff_time_sec: 10, clip_before_sec: 4, clip_after_sec: 3,
    });
    expect(manifest.clips).toHaveLength(1);
    expect(manifest.clips[0].event_id).toBe("evt_000001");
  });

  it("includes free throws when include_free_throws=true", () => {
    const manifest = buildClipManifest(baseStage2, {
      tipoff_time_sec: 10, clip_before_sec: 4, clip_after_sec: 3,
      include_free_throws: true,
    });
    expect(manifest.clips).toHaveLength(2);
    expect(manifest.clips.map(c => c.event_id))
      .toEqual(["evt_000001", "evt_000002"]);
  });

  it("computes video_timestamp = tipoff + elapsed and window math", () => {
    const manifest = buildClipManifest(baseStage2, {
      tipoff_time_sec: 10, clip_before_sec: 4, clip_after_sec: 3,
    });
    const c = manifest.clips[0];
    expect(c.elapsed_time_sec).toBe(41);
    expect(c.video_timestamp).toBe(51);
    expect(c.video_start_sec).toBe(47);
    expect(c.video_end_sec).toBe(54);
    expect(c.duration_sec).toBe(7);
  });

  it("clamps video_start_sec at 0", () => {
    const stage2 = {
      ...baseStage2,
      events: [{ ...baseStage2.events[0], elapsed_sec: 1, video_timestamp_sec: 1 }],
    };
    const manifest = buildClipManifest(stage2, {
      tipoff_time_sec: 0, clip_before_sec: 4, clip_after_sec: 3,
    });
    const c = manifest.clips[0];
    expect(c.video_start_sec).toBe(0);
    expect(c.video_end_sec).toBe(4);
    expect(c.duration_sec).toBe(4); // 4 - 0
  });

  it("renumbers clip_id densely as shot_NNNNNN", () => {
    const stage2 = {
      ...baseStage2,
      events: [
        baseStage2.events[2], // rebound (skipped)
        baseStage2.events[1], // ft (skipped by default)
        baseStage2.events[0], // shot
      ],
    };
    const manifest = buildClipManifest(stage2, {
      tipoff_time_sec: 0, clip_before_sec: 1, clip_after_sec: 1,
    });
    expect(manifest.clips).toHaveLength(1);
    expect(manifest.clips[0].clip_id).toBe("shot_000001");
  });

  it("skips events with null elapsed_sec", () => {
    const stage2 = {
      ...baseStage2,
      events: [{ ...baseStage2.events[0], elapsed_sec: null, video_timestamp_sec: null }],
    };
    const manifest = buildClipManifest(stage2, {
      tipoff_time_sec: 0, clip_before_sec: 1, clip_after_sec: 1,
    });
    expect(manifest.clips).toHaveLength(0);
  });

  it("preserves game_id and copies settings", () => {
    const settings = { tipoff_time_sec: 10, clip_before_sec: 4, clip_after_sec: 3 };
    const manifest = buildClipManifest(baseStage2, settings);
    expect(manifest.game_id).toBe("game_20260118_mountain_view");
    expect(manifest.source).toBe("web_ui_command_history");
    expect(manifest.source_video).toBeNull();
    expect(manifest.settings).toEqual(settings);
  });

  it("sets all clips to status=planned", () => {
    const manifest = buildClipManifest(baseStage2, {
      tipoff_time_sec: 10, clip_before_sec: 4, clip_after_sec: 3,
      include_free_throws: true,
    });
    for (const c of manifest.clips) expect(c.status).toBe("planned");
  });

  it("clip_path is clips/<clip_id>.mp4", () => {
    const manifest = buildClipManifest(baseStage2, {
      tipoff_time_sec: 0, clip_before_sec: 1, clip_after_sec: 1,
    });
    expect(manifest.clips[0].clip_path).toBe("clips/shot_000001.mp4");
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npx vitest run tests/stage2/clipManifest.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Commit (red)**

```bash
git add tests/stage2/clipManifest.test.ts
git commit -m "test(stage2): clip manifest builder tests (red)"
```

---

### Task 3: Implement `clipManifest.ts` (green)

**Files:**
- Create: `src/stage2/clipManifest.ts`

- [ ] **Step 1: Implement**

```ts
import type { Stage2Json, Stage2Event } from "./types";
import type {
  Clip,
  ClipManifest,
  ClipSettings,
} from "./clipManifestTypes";

const DEFAULT_INCLUDED: Stage2Event["event_type"][] = ["shot"];
const FT_INCLUDED: Stage2Event["event_type"][] = ["shot", "free_throw"];

function pad6(n: number): string {
  return n.toString().padStart(6, "0");
}

export function buildClipManifest(
  json: Stage2Json,
  settings: ClipSettings,
  opts: { source_video?: string | null } = {},
): ClipManifest {
  const include = settings.include_free_throws ? FT_INCLUDED : DEFAULT_INCLUDED;
  const tipoff = Math.max(0, settings.tipoff_time_sec);
  const before = Math.max(0, settings.clip_before_sec);
  const after = Math.max(0, settings.clip_after_sec);

  const clips: Clip[] = [];
  let n = 1;
  for (const e of json.events) {
    if (!include.includes(e.event_type)) continue;
    if (e.elapsed_sec === null || e.elapsed_sec === undefined) continue;
    const elapsed_time_sec = e.elapsed_sec;
    const video_timestamp = tipoff + elapsed_time_sec;
    const video_start_sec = Math.max(0, video_timestamp - before);
    const video_end_sec = video_timestamp + after;
    const duration_sec = video_end_sec - video_start_sec;
    const clip_id = `shot_${pad6(n++)}`;
    clips.push({
      clip_id,
      event_id: e.event_id,
      raw_command: e.raw_command,
      elapsed_time_sec,
      video_timestamp,
      video_start_sec,
      video_end_sec,
      duration_sec,
      clip_path: `clips/${clip_id}.mp4`,
      status: "planned",
    });
  }

  return {
    game_id: json.game_id,
    source: "web_ui_command_history",
    source_video: opts.source_video ?? null,
    settings: {
      tipoff_time_sec: tipoff,
      clip_before_sec: before,
      clip_after_sec: after,
      include_free_throws: !!settings.include_free_throws,
    },
    clips,
  };
}

export type { Clip, ClipManifest, ClipSettings, ClipStatus } from "./clipManifestTypes";
```

- [ ] **Step 2: Verify tests + regression**

Run: `npx vitest run tests/stage2/clipManifest.test.ts`
Run: `npx vitest run`
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add src/stage2/clipManifest.ts
git commit -m "feat(stage2): implement clip manifest builder"
```

---

### Task 4: Hash route hook + tests

**Files:**
- Create: `src/ui/useHashRoute.ts`
- Create: `tests/ui/useHashRoute.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useHashRoute } from "@/ui/useHashRoute";

describe("useHashRoute", () => {
  beforeEach(() => {
    window.location.hash = "";
  });

  it("returns the current hash path without leading #", () => {
    window.location.hash = "#/games/g1/stage2/clips";
    const { result } = renderHook(() => useHashRoute());
    expect(result.current).toBe("/games/g1/stage2/clips");
  });

  it("returns '/' when hash empty", () => {
    const { result } = renderHook(() => useHashRoute());
    expect(result.current).toBe("/");
  });

  it("updates when hash changes", () => {
    const { result } = renderHook(() => useHashRoute());
    expect(result.current).toBe("/");
    act(() => {
      window.location.hash = "#/games/g42/stage2/clips";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(result.current).toBe("/games/g42/stage2/clips");
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npx vitest run tests/ui/useHashRoute.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/ui/useHashRoute.ts
import { useEffect, useState } from "react";

function readHash(): string {
  const h = window.location.hash;
  if (!h || h === "#") return "/";
  return h.startsWith("#") ? h.slice(1) : h;
}

export function useHashRoute(): string {
  const [path, setPath] = useState<string>(() => readHash());
  useEffect(() => {
    const onChange = () => setPath(readHash());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return path;
}

export function matchClipsRoute(path: string): { gameId: string } | null {
  const m = path.match(/^\/games\/([^/]+)\/stage2\/clips\/?$/);
  return m ? { gameId: decodeURIComponent(m[1]) } : null;
}
```

- [ ] **Step 4: Verify tests pass**

Run: `npx vitest run tests/ui/useHashRoute.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/useHashRoute.ts tests/ui/useHashRoute.test.tsx
git commit -m "feat(ui): add hash-based route hook for stage 2 views"
```

---

### Task 5: ClipsView component (red)

**Files:**
- Create: `tests/ui/ClipsView.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ClipsView from "@/ui/ClipsView";

const sampleStage2 = {
  game_id: "game_20260118_mountain_view",
  source: "web_ui_command_history",
  export_type: "stage2_json_game_log",
  exported_at: "2026-01-18T20:15:30.000Z",
  game_context: {
    game_date: "2026-01-18", opponent: "Mountain View",
    opponent_alias: "op", home_team_label: "sf",
  },
  commands: [],
  events: [
    {
      event_id: "evt_000001", command_index: 0,
      raw_command: "+00:41 alden layup make wes",
      clock_text: "+00:41", elapsed_sec: 41, video_timestamp_sec: 41,
      event_type: "shot", team: "home", player: "alden",
      shot_type: "layup", result: "make",
      assist_player: "wes", related_player: null, warnings: [],
    },
    {
      event_id: "evt_000002", command_index: 1,
      raw_command: "+00:24 op ft make",
      clock_text: "+00:24", elapsed_sec: 24, video_timestamp_sec: 24,
      event_type: "free_throw", team: "op", player: null,
      shot_type: "free_throw", result: "make",
      assist_player: null, related_player: null, warnings: [],
    },
  ],
};

describe("ClipsView", () => {
  it("renders empty state when no timeline loaded", () => {
    render(<ClipsView gameId="game_x" />);
    expect(screen.getByText(/load.*timeline/i)).toBeDefined();
  });

  it("loads a timeline JSON via the file input and shows clip count", async () => {
    const user = userEvent.setup();
    render(<ClipsView gameId="game_20260118_mountain_view" />);
    const file = new File(
      [JSON.stringify(sampleStage2)],
      "timeline.json",
      { type: "application/json" },
    );
    const input = screen.getByLabelText(/timeline json/i) as HTMLInputElement;
    await user.upload(input, file);
    expect(await screen.findByText(/1 clip/i)).toBeDefined();
  });

  it("toggling include free throws updates clip count", async () => {
    const user = userEvent.setup();
    render(<ClipsView gameId="game_20260118_mountain_view" />);
    const file = new File(
      [JSON.stringify(sampleStage2)],
      "timeline.json",
      { type: "application/json" },
    );
    await user.upload(screen.getByLabelText(/timeline json/i), file);
    expect(await screen.findByText(/1 clip/i)).toBeDefined();
    await user.click(screen.getByLabelText(/include free throws/i));
    expect(await screen.findByText(/2 clips/i)).toBeDefined();
  });

  it("download manifest button is disabled until timeline loaded", () => {
    render(<ClipsView gameId="game_x" />);
    const btn = screen.getByRole("button", { name: /download manifest/i });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npx vitest run tests/ui/ClipsView.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Commit (red)**

```bash
git add tests/ui/ClipsView.test.tsx
git commit -m "test(stage2): clips view tests (red)"
```

---

### Task 6: Implement ClipsView (green)

**Files:**
- Create: `src/ui/ClipsView.tsx`
- Create: `src/ui/ClipsView.module.css`

- [ ] **Step 1: Implement the view**

```tsx
// src/ui/ClipsView.tsx
import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { buildClipManifest } from "@/stage2/clipManifest";
import type { ClipSettings } from "@/stage2/clipManifestTypes";
import type { Stage2Json } from "@/stage2/types";
import styles from "./ClipsView.module.css";

interface ClipsViewProps {
  gameId: string;
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function ClipsView({ gameId }: ClipsViewProps) {
  const [timeline, setTimeline] = useState<Stage2Json | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<ClipSettings>({
    tipoff_time_sec: 10,
    clip_before_sec: 4,
    clip_after_sec: 3,
    include_free_throws: false,
  });
  const inputRef = useRef<HTMLInputElement>(null);

  const manifest = useMemo(
    () => (timeline ? buildClipManifest(timeline, settings) : null),
    [timeline, settings],
  );

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const text = await f.text();
      const json = JSON.parse(text) as Stage2Json;
      if (json?.export_type !== "stage2_json_game_log") {
        throw new Error("Not a Stage 2 JSON file");
      }
      setTimeline(json);
    } catch (err) {
      setError((err as Error).message);
      setTimeline(null);
    }
  };

  const onDownload = () => {
    if (!manifest) return;
    downloadJson(`${manifest.game_id}.clips.json`, manifest);
  };

  const update = (k: keyof ClipSettings, v: number | boolean) =>
    setSettings(s => ({ ...s, [k]: v }));

  const clipCount = manifest?.clips.length ?? 0;
  const clipNoun = clipCount === 1 ? "clip" : "clips";

  return (
    <div className={styles.root}>
      <h2 className={styles.title}>Stage 2 Clip Extraction</h2>
      <p className={styles.gameId}>Game: <code>{gameId}</code></p>

      <div className={styles.fieldRow}>
        <label htmlFor="timeline-file" className={styles.label}>
          Timeline JSON
        </label>
        <input
          id="timeline-file"
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          onChange={onFile}
        />
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}

      <fieldset className={styles.fieldset}>
        <legend>Clip settings</legend>
        <label>
          Tipoff time (sec)
          <input
            type="number"
            min={0}
            value={settings.tipoff_time_sec}
            onChange={e => update("tipoff_time_sec", Number(e.target.value))}
          />
        </label>
        <label>
          Before (sec)
          <input
            type="number"
            min={0}
            value={settings.clip_before_sec}
            onChange={e => update("clip_before_sec", Number(e.target.value))}
          />
        </label>
        <label>
          After (sec)
          <input
            type="number"
            min={0}
            value={settings.clip_after_sec}
            onChange={e => update("clip_after_sec", Number(e.target.value))}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={!!settings.include_free_throws}
            onChange={e => update("include_free_throws", e.target.checked)}
          />
          Include free throws
        </label>
      </fieldset>

      {timeline === null ? (
        <p className={styles.empty}>Load a timeline JSON to compute clips.</p>
      ) : (
        <p className={styles.summary}>
          {clipCount} {clipNoun} planned.
        </p>
      )}

      {manifest && manifest.clips.length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>clip_id</th>
              <th>event</th>
              <th>start</th>
              <th>end</th>
              <th>duration</th>
            </tr>
          </thead>
          <tbody>
            {manifest.clips.map(c => (
              <tr key={c.clip_id}>
                <td>{c.clip_id}</td>
                <td>{c.raw_command}</td>
                <td>{c.video_start_sec}</td>
                <td>{c.video_end_sec}</td>
                <td>{c.duration_sec}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          onClick={onDownload}
          disabled={manifest === null}
        >
          Download manifest
        </button>
        <a className={styles.back} href="#/">← Back to live tracking</a>
      </div>
    </div>
  );
}
```

```css
/* src/ui/ClipsView.module.css */
.root { padding: 1rem 1.5rem; max-width: 900px; margin: 0 auto; }
.title { color: var(--sfhs-maroon, #6b0016); margin-top: 0; }
.gameId { color: var(--sfhs-gray-700, #555); }
.fieldRow { display: flex; gap: 0.75rem; align-items: center; margin: 0.5rem 0; }
.label { font-weight: 600; }
.fieldset { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0.5rem 1rem; margin: 1rem 0; padding: 0.75rem; border: 1px solid var(--sfhs-gray-300, #ccc); border-radius: 4px; }
.fieldset label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.9rem; }
.fieldset input[type="number"] { width: 100%; padding: 0.3rem; }
.empty { color: var(--sfhs-gray-700, #555); font-style: italic; }
.error { color: #b00020; }
.summary { font-weight: 600; }
.table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
.table th, .table td { padding: 0.3rem 0.5rem; text-align: left; border-bottom: 1px solid var(--sfhs-gray-300, #ccc); }
.actions { display: flex; gap: 1rem; align-items: center; margin-top: 1rem; }
.actions button { background: var(--sfhs-maroon, #6b0016); color: #fff; border: none; padding: 0.5rem 0.9rem; border-radius: 4px; font-weight: 600; cursor: pointer; }
.actions button:disabled { opacity: 0.5; cursor: not-allowed; }
.back { color: var(--sfhs-maroon, #6b0016); text-decoration: none; }
.back:hover { text-decoration: underline; }
```

- [ ] **Step 2: Verify tests + regression**

Run: `npx vitest run tests/ui/ClipsView.test.tsx`
Run: `npx vitest run`
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add src/ui/ClipsView.tsx src/ui/ClipsView.module.css
git commit -m "feat(stage2): ClipsView component for browser manifest preview"
```

---

### Task 7: Wire ClipsView into App via hash route

**Files:**
- Modify: `src/ui/App.tsx`
- Modify: `src/ui/Header.tsx`
- Modify: `tests/ui/Header.test.tsx`

- [ ] **Step 1: Header test (red) for the Clips button**

Add a test that asserts a `Clips` button renders when `onOpenClips` is provided and fires the callback.

```tsx
it("renders Clips button and fires callback", async () => {
  const user = userEvent.setup();
  const onOpenClips = vi.fn();
  render(
    <Header
      opponentName=""
      onNewGame={noop}
      onOpenRosterEditor={noop}
      onDownloadCSV={noop}
      onDownloadLog={noop}
      onOpenClips={onOpenClips}
    />,
  );
  await user.click(screen.getByRole("button", { name: /^clips$/i }));
  expect(onOpenClips).toHaveBeenCalledOnce();
});
```

Run: `npx vitest run tests/ui/Header.test.tsx`
Expected: FAIL.

- [ ] **Step 2: Add `onOpenClips` prop + button to `Header.tsx`**

After the Download buttons, add:

```tsx
{onOpenClips !== undefined && (
  <button
    type="button"
    className={`${styles.btn} ${styles.btnSecondary}`}
    onClick={onOpenClips}
  >
    Clips
  </button>
)}
```

Add `onOpenClips?: () => void` to `HeaderProps`, destructure it.

Run Header tests: PASS.

- [ ] **Step 3: Wire route in `App.tsx`**

```tsx
import { useHashRoute, matchClipsRoute } from "./useHashRoute";
import ClipsView from "./ClipsView";
// ...inside App():
const route = useHashRoute();
const clipsRoute = matchClipsRoute(route);

const openClips = () => {
  // Use the export's game_id derivation by reusing buildStage2Json's id logic.
  // Cheap: borrow the same util.
  const json = buildStage2Json(state);
  window.location.hash = `#/games/${encodeURIComponent(json.game_id)}/stage2/clips`;
};

if (clipsRoute) {
  return <ClipsView gameId={clipsRoute.gameId} />;
}
```

Pass `onOpenClips={openClips}` to `<Header />`.

- [ ] **Step 4: Type-check + full vitest**

Run: `npx tsc --noEmit && npx vitest run`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/ui/App.tsx src/ui/Header.tsx tests/ui/Header.test.tsx
git commit -m "feat(stage2): hash-routed Clips view + Clips header button"
```

---

### Task 8: Python CLI test (red)

**Files:**
- Create: `tests/fixtures/stage2/timeline_for_clips.json`
- Create: `tests/stage2/extract_clips_py.test.ts`

- [ ] **Step 1: Create fixture timeline**

```json
{
  "game_id": "game_test",
  "source": "web_ui_command_history",
  "export_type": "stage2_json_game_log",
  "exported_at": "2026-01-18T00:00:00.000Z",
  "game_context": {
    "game_date": "2026-01-18", "opponent": null,
    "opponent_alias": "op", "home_team_label": "sf"
  },
  "commands": [],
  "events": [
    {
      "event_id": "evt_000001", "command_index": 0,
      "raw_command": "+00:41 alden layup make wes",
      "clock_text": "+00:41", "elapsed_sec": 41, "video_timestamp_sec": 41,
      "event_type": "shot", "team": "home", "player": "alden",
      "shot_type": "layup", "result": "make",
      "assist_player": "wes", "related_player": null, "warnings": []
    },
    {
      "event_id": "evt_000002", "command_index": 1,
      "raw_command": "+00:24 op ft make",
      "clock_text": "+00:24", "elapsed_sec": 24, "video_timestamp_sec": 24,
      "event_type": "free_throw", "team": "op", "player": null,
      "shot_type": "free_throw", "result": "make",
      "assist_player": null, "related_player": null, "warnings": []
    }
  ]
}
```

- [ ] **Step 2: Write CLI test**

The test runs the Python script in `--dry-run` mode (no real video required) and asserts the manifest the CLI emits matches what the TS builder emits.

```ts
// tests/stage2/extract_clips_py.test.ts
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, rmSync, mkdtempSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "../..");
const cli = resolve(repoRoot, "scripts/stage2/extract_clips.py");
const timeline = resolve(repoRoot, "tests/fixtures/stage2/timeline_for_clips.json");

describe("extract_clips.py", () => {
  it("dry-run produces manifest matching the TS builder (shots only)", () => {
    const out = mkdtempSync(join(tmpdir(), "clips-"));
    try {
      execFileSync("python3", [
        cli,
        "--video", "fake.mp4",
        "--timeline", timeline,
        "--output-dir", out,
        "--tipoff", "10",
        "--before", "4",
        "--after", "3",
        "--dry-run",
      ], { cwd: repoRoot });

      const manifestPath = join(out, "clip_manifest.json");
      expect(existsSync(manifestPath)).toBe(true);
      const m = JSON.parse(readFileSync(manifestPath, "utf-8"));
      expect(m.game_id).toBe("game_test");
      expect(m.source).toBe("web_ui_command_history");
      expect(m.source_video).toBe("fake.mp4");
      expect(m.clips).toHaveLength(1);
      const c = m.clips[0];
      expect(c.clip_id).toBe("shot_000001");
      expect(c.event_id).toBe("evt_000001");
      expect(c.video_timestamp).toBe(51);
      expect(c.video_start_sec).toBe(47);
      expect(c.video_end_sec).toBe(54);
      expect(c.duration_sec).toBe(7);
      expect(c.status).toBe("skipped"); // dry-run never extracts
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  it("--include-free-throws includes ft events", () => {
    const out = mkdtempSync(join(tmpdir(), "clips-"));
    try {
      execFileSync("python3", [
        cli,
        "--video", "fake.mp4",
        "--timeline", timeline,
        "--output-dir", out,
        "--tipoff", "10",
        "--before", "4",
        "--after", "3",
        "--include-free-throws",
        "--dry-run",
      ], { cwd: repoRoot });
      const m = JSON.parse(readFileSync(join(out, "clip_manifest.json"), "utf-8"));
      expect(m.clips).toHaveLength(2);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  it("exits non-zero when timeline file is missing", () => {
    const out = mkdtempSync(join(tmpdir(), "clips-"));
    let code = 0;
    try {
      execFileSync("python3", [
        cli, "--video", "x.mp4", "--timeline", "/nope.json",
        "--output-dir", out, "--tipoff", "0", "--before", "1", "--after", "1",
        "--dry-run",
      ], { stdio: "ignore", cwd: repoRoot });
    } catch (e: any) {
      code = e.status ?? 1;
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
    expect(code).not.toBe(0);
  });
});
```

- [ ] **Step 3: Run, expect FAIL**

Run: `npx vitest run tests/stage2/extract_clips_py.test.ts`
Expected: FAIL — script doesn't exist.

- [ ] **Step 4: Commit (red)**

```bash
git add tests/fixtures/stage2/timeline_for_clips.json tests/stage2/extract_clips_py.test.ts
git commit -m "test(stage2): python CLI clip extraction tests (red)"
```

---

### Task 9: Implement Python CLI

**Files:**
- Create: `scripts/stage2/extract_clips.py`
- Modify: `package.json`

- [ ] **Step 1: Write the script**

```python
#!/usr/bin/env python3
"""extract_clips.py — slice short clips from a full game video using
the Stage 2 Phase 1 command-history timeline.

Mirrors src/stage2/clipManifest.ts so manifests stay byte-equivalent across
the browser and CLI paths.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Iterable, Optional


SOURCE = "web_ui_command_history"
DEFAULT_INCLUDED = {"shot"}
FT_INCLUDED = {"shot", "free_throw"}


def pad6(n: int) -> str:
    return f"{n:06d}"


def build_clips(events, settings) -> list[dict]:
    include = FT_INCLUDED if settings["include_free_throws"] else DEFAULT_INCLUDED
    tipoff = max(0, int(settings["tipoff_time_sec"]))
    before = max(0, int(settings["clip_before_sec"]))
    after = max(0, int(settings["clip_after_sec"]))
    clips: list[dict] = []
    n = 1
    for e in events:
        if e.get("event_type") not in include:
            continue
        elapsed = e.get("elapsed_sec")
        if elapsed is None:
            continue
        video_ts = tipoff + int(elapsed)
        start = max(0, video_ts - before)
        end = video_ts + after
        clip_id = f"shot_{pad6(n)}"
        n += 1
        clips.append({
            "clip_id": clip_id,
            "event_id": e["event_id"],
            "raw_command": e["raw_command"],
            "elapsed_time_sec": int(elapsed),
            "video_timestamp": video_ts,
            "video_start_sec": start,
            "video_end_sec": end,
            "duration_sec": end - start,
            "clip_path": f"clips/{clip_id}.mp4",
            "status": "planned",
        })
    return clips


def extract_one(video: Path, clip: dict, output_dir: Path) -> tuple[str, Optional[str]]:
    """Returns (status, status_detail). status: extracted | failed | skipped."""
    out_path = output_dir / f"{clip['clip_id']}.mp4"
    cmd = [
        "ffmpeg", "-y",
        "-ss", str(clip["video_start_sec"]),
        "-to", str(clip["video_end_sec"]),
        "-i", str(video),
        "-c", "copy",
        str(out_path),
    ]
    try:
        proc = subprocess.run(
            cmd, capture_output=True, text=True, check=False,
        )
    except FileNotFoundError:
        return "failed", "ffmpeg not on PATH"
    if proc.returncode == 0 and out_path.exists() and out_path.stat().st_size > 0:
        return "extracted", None
    return "failed", (proc.stderr or "").splitlines()[-1] if proc.stderr else "unknown"


def main() -> int:
    p = argparse.ArgumentParser(description="Stage 2 Phase 2 clip extractor")
    p.add_argument("--video", required=True, help="Path to source video file")
    p.add_argument("--timeline", required=True, help="Phase 1 stage2 JSON")
    p.add_argument("--output-dir", required=True, help="Where to write clips and manifest")
    p.add_argument("--tipoff", type=int, required=True, help="tipoff_time_sec")
    p.add_argument("--before", type=int, required=True, help="clip_before_sec")
    p.add_argument("--after", type=int, required=True, help="clip_after_sec")
    p.add_argument("--include-free-throws", action="store_true",
                   help="include free_throw events as clips")
    p.add_argument("--dry-run", action="store_true",
                   help="write manifest only; do not call ffmpeg")
    args = p.parse_args()

    timeline_path = Path(args.timeline)
    if not timeline_path.is_file():
        print(f"Error: timeline file not found: {timeline_path}", file=sys.stderr)
        return 1

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    with timeline_path.open() as f:
        timeline = json.load(f)

    settings = {
        "tipoff_time_sec": args.tipoff,
        "clip_before_sec": args.before,
        "clip_after_sec": args.after,
        "include_free_throws": bool(args.include_free_throws),
    }

    clips = build_clips(timeline.get("events", []), settings)

    video_path = Path(args.video)
    extracted = 0
    failed = 0
    skipped = 0
    for clip in clips:
        if args.dry_run:
            clip["status"] = "skipped"
            skipped += 1
            continue
        status, detail = extract_one(video_path, clip, output_dir)
        clip["status"] = status
        if detail:
            clip["status_detail"] = detail
        if status == "extracted":
            extracted += 1
        elif status == "failed":
            failed += 1
        else:
            skipped += 1

    manifest = {
        "game_id": timeline.get("game_id", ""),
        "source": SOURCE,
        "source_video": video_path.name,
        "settings": settings,
        "clips": clips,
    }
    manifest_path = output_dir / "clip_manifest.json"
    with manifest_path.open("w") as f:
        json.dump(manifest, f, indent=2)

    print("Stage 2 clip extraction summary")
    print(f"Timeline: {timeline_path}")
    print(f"Video:    {video_path}")
    print(f"Output:   {output_dir}")
    print(f"Manifest: {manifest_path}")
    print(f"Clips planned: {len(clips)}")
    print(f"  extracted: {extracted}")
    print(f"  failed:    {failed}")
    print(f"  skipped:   {skipped}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Add npm alias**

In `package.json`:

```json
"stage2:extract-clips": "python3 scripts/stage2/extract_clips.py"
```

- [ ] **Step 3: Verify CLI tests pass**

Run: `npx vitest run tests/stage2/extract_clips_py.test.ts`
Expected: PASS.

- [ ] **Step 4: Verify byte equivalence with TS builder**

Add a *separate* assertion to `tests/stage2/extract_clips_py.test.ts` that compares the CLI dry-run output to the TS builder output for the same fixture, ignoring `status` and `source_video` (which are CLI-specific):

```ts
it("matches the TS builder output (shape + windows)", () => {
  const out = mkdtempSync(join(tmpdir(), "clips-"));
  try {
    execFileSync("python3", [
      cli, "--video", "fake.mp4", "--timeline", timeline,
      "--output-dir", out, "--tipoff", "10", "--before", "4", "--after", "3",
      "--dry-run",
    ], { cwd: repoRoot });
    const cliManifest = JSON.parse(
      readFileSync(join(out, "clip_manifest.json"), "utf-8"),
    );
    // Reproduce in TS:
    // (load same fixture, run buildClipManifest)
    const tlJson = JSON.parse(readFileSync(timeline, "utf-8"));
    // Avoid module-load order issues by importing dynamically here.
    // Note: vite/vitest handles tsconfig path aliases.
    return import("@/stage2/clipManifest").then(({ buildClipManifest }) => {
      const tsManifest = buildClipManifest(tlJson, {
        tipoff_time_sec: 10, clip_before_sec: 4, clip_after_sec: 3,
      });
      // Compare clip windows
      expect(cliManifest.clips.map((c: any) => ({
        clip_id: c.clip_id, event_id: c.event_id,
        video_timestamp: c.video_timestamp,
        video_start_sec: c.video_start_sec,
        video_end_sec: c.video_end_sec,
        duration_sec: c.duration_sec,
      }))).toEqual(tsManifest.clips.map(c => ({
        clip_id: c.clip_id, event_id: c.event_id,
        video_timestamp: c.video_timestamp,
        video_start_sec: c.video_start_sec,
        video_end_sec: c.video_end_sec,
        duration_sec: c.duration_sec,
      })));
    });
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
```

- [ ] **Step 5: Commit**

```bash
git add scripts/stage2/extract_clips.py package.json tests/stage2/extract_clips_py.test.ts
git commit -m "feat(stage2): python CLI to extract clips with ffmpeg"
```

---

### Task 10: Final regression sweep + smoke

**Files:** none

- [ ] **Step 1: Full vitest**

Run: `npx vitest run`
Expected: all 196 + new tests pass.

- [ ] **Step 2: Type-check + builds**

Run: `npx tsc --noEmit && npm run stage2:build && npx vite build`
Expected: all clean.

- [ ] **Step 3: Manual browser smoke** (optional, no commit)

```bash
npm run dev
# Open http://localhost:5173, click Clips button → should navigate to
# #/games/<game_id>/stage2/clips. Upload tests/fixtures/stage2/timeline_for_clips.json.
# Confirm 1 clip shown by default, 2 with FT toggle.
# Click Download manifest → JSON downloads.
```

- [ ] **Step 4: Manual CLI smoke** (optional, no commit; needs a real video)

```bash
python3 scripts/stage2/extract_clips.py \
  --video <path/to/game.mp4> \
  --timeline tests/fixtures/stage2/timeline_for_clips.json \
  --output-dir /tmp/clips-smoke \
  --tipoff 10 --before 4 --after 3
ls /tmp/clips-smoke
cat /tmp/clips-smoke/clip_manifest.json | head -30
rm -rf /tmp/clips-smoke
```

- [ ] **Step 5: Walk acceptance criteria**

Confirm each bullet from spec §"Acceptance criteria":
- shot events selected from timeline
- free throws includable/excludable
- clip windows correct
- clip → raw_command preserved
- manifest export/import (browser downloads JSON; CLI writes manifest; both consume the same Phase 1 JSON)
- clips ready for CV: `clips/shot_NNNNNN.mp4` files exist after a non-dry CLI run

---

## Open Questions / Risks

1. **Empty events.** If `--dry-run` is omitted but no shot events exist, the CLI writes a manifest with `clips: []` and exits 0. Acceptable.
2. **`-c copy` keyframe alignment.** Stream-copy may produce clips that start slightly before the requested `-ss` because ffmpeg snaps to the nearest keyframe. For Phase 2 this is fine — downstream CV pipelines re-detect events frame-by-frame. If we ever need exact cuts, switch to `-c:v libx264 -c:a aac` (re-encode, slower).
3. **Negative `tipoff`.** Spec doesn't restrict to non-negative. We clamp to 0 in both builders to keep `video_timestamp >= elapsed_sec`. Reviewer can argue.
4. **Browser cannot read the video.** That's by design — the user picked "manifest only". Real slicing happens via the Python CLI.
5. **Python availability in CI.** The Vitest test spawns `python3`. If your CI runner doesn't have Python, the test will fail. Mitigation: skip-on-missing using `which`. We can add `if (which python3) describe(...)` later if it bites.

---

## Plan Review Loop

After saving this document, dispatch a `plan-document-reviewer` subagent with:
- Plan path: `docs/superpowers/plans/2026-05-19-stage2-phase2-clip-extraction.md`
- Spec path: `docs/requirement/Stage-2/02_stage2_clip_extraction.md`

Iterate until ✅ Approved (max 3 cycles).
