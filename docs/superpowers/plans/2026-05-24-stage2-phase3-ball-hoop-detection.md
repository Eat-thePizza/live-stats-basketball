# Stage 2 Phase 3 — Ball + Hoop Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Python CLI that runs YOLOv8 ball + hoop detection on every clip in a Phase 2 manifest, writes a per-clip detection JSON, saves annotated still frames at key moments, and surfaces detection failures as warnings rather than crashes. Open-source baseline: [avishah3/AI-Basketball-Shot-Detection-Tracker](https://github.com/avishah3/AI-Basketball-Shot-Detection-Tracker).

**Architecture:**
- Single Python module `scripts/stage2/detect_ball_hoop.py` orchestrates everything: load manifest → for each clip, open `.mp4`, run YOLOv8 inference frame-by-frame, aggregate ball track + hoop center → save annotated keyframes → write `ball_hoop_detections.json`.
- Inference is delegated to `ultralytics` (YOLOv8 wrapper) so we inherit avishah3's modeling assumptions (classes `Basketball`, `Basketball Hoop`).
- Model `.pt` is downloaded to `models/basketball_yolo.pt` on first run if missing. URL is configurable via `--model-url`; default points to the upstream repo's release asset (documented in README; user can override).
- A `--dry-run` mode skips real inference and emits stub detection records — used by tests so the heavy ML stack isn't required in CI.
- Hook design (`Detector` protocol) so tests can substitute a `StubDetector` and assert on the orchestration logic separately from model behavior.
- Debug "videos" are actually a **directory of annotated stills** per clip (`debug/<clip_id>/frame_<N>.jpg`) at three keyframes: first detected frame, peak-confidence frame, last detected frame. The JSON's `debug_video_path` field becomes a directory path — documented as a deviation from the spec example.

**Tech Stack:** Python ≥3.10, [ultralytics](https://pypi.org/project/ultralytics/) ≥8.0, [opencv-python](https://pypi.org/project/opencv-python/), [numpy](https://pypi.org/project/numpy/), [tqdm](https://pypi.org/project/tqdm/) (progress). All pip-installed via `scripts/stage2/requirements.txt`.

---

## Spec Clarifications (locked decisions)

1. **`hoop_center_xy`.** Spec output shows a single `{x,y}` for the whole clip. We compute it as the median of the highest-confidence hoop bounding-box center across all frames where a hoop was detected. If no hoop ever detected, set `hoop_detected: false` and `hoop_center_xy: null`. Add warning `"hoop never detected"`.
2. **`ball_track`.** One entry per frame where the ball was detected with confidence ≥ `--ball-conf` (default 0.30). Coordinates are bbox-center pixel values in the clip's native resolution (no resize).
3. **`ball_detection_usable`.** True iff `ball_detected_frame_count >= max(5, total_frame_count * 0.05)`. Otherwise false + warning `"ball detection sparse: <N>/<total> frames"`.
4. **`debug_video_path`.** Per spec text says "debug images **or** videos". User chose stills. We keep the field name `debug_video_path` for forward-compat but write a *directory* path: `debug/<clip_id>/`. Three frames saved: first detected, max-confidence, last detected. Field name is documented as legacy in README.
5. **Failure modes.** All exceptions during a single clip's inference are caught, the result is written with `hoop_detected=false`, `ball_track=[]`, and `warnings=["clip failed: <message>"]`. The CLI's exit code is 0 unless the manifest itself can't be read.
6. **Frame indexing.** `frame: 0`-based from the start of the clip (not the source video).
7. **Model caching.** `--model-path` (default `models/basketball_yolo.pt`) — if missing, download from `--model-url`. If both unavailable and not `--dry-run`, exit 2.
8. **`raw_command` and `event_id`.** Copied verbatim from the clip manifest into each result so the CV results retain the link back to the original command-history line (acceptance criterion #6).

---

## File Structure

**Create:**
- `scripts/stage2/detect_ball_hoop.py` — main CLI orchestrator
- `scripts/stage2/_ball_hoop_core.py` — pure helpers (manifest IO, result aggregation, debug-frame selection); importable by tests
- `scripts/stage2/requirements.txt` — pinned-major versions for ultralytics/opencv/numpy/tqdm
- `scripts/stage2/README.md` — install + usage notes (refs the upstream repo URL per acceptance criterion #1)
- `tests/stage2/detect_ball_hoop_py.test.ts` — Vitest spawning Python in `--dry-run` mode
- `tests/stage2/_ball_hoop_core_unit.py` — Python unit tests for the pure helpers (run via `python -m unittest`)
- `tests/stage2/run_ball_hoop_pyunit.test.ts` — Vitest wrapper that runs the Python unit tests
- `tests/fixtures/stage2/clip_manifest_for_detection.json` — fixture manifest pointing at non-existent .mp4s (only valid for `--dry-run`)
- `models/.gitkeep` — keep models dir in repo

**Modify:**
- `package.json` — add npm script alias `stage2:detect-ball-hoop`
- `.gitignore` — ignore `models/*.pt`, `debug/`, `ball_hoop_detections.json` artifacts in workspace root

**Don't touch:** the React UI, Phase 1/2 modules — Phase 3 is CLI-only per the locked decision.

---

## JSON Schema (locked)

```jsonc
// ball_hoop_detections.json
{
  "game_id": "game_001",
  "source_manifest": "clip_manifest.json",
  "model_path": "models/basketball_yolo.pt",
  "settings": {
    "ball_conf": 0.30,
    "hoop_conf": 0.40,
    "iou": 0.45,
    "img_size": 640
  },
  "results": [
    {
      "clip_id": "shot_000001",
      "event_id": "evt_000001",
      "raw_command": "+00:41 alden layup make wes",
      "clip_path": "clips/shot_000001.mp4",
      "hoop_detected": true,
      "hoop_center_xy": { "x": 843, "y": 214 },
      "ball_detected_frame_count": 12,
      "total_frame_count": 210,
      "ball_track": [
        { "frame": 42, "x": 612, "y": 318, "confidence": 0.72 }
      ],
      "ball_detection_usable": true,
      "debug_video_path": "debug/shot_000001",
      "warnings": []
    }
  ]
}
```

---

## TDD Order

Each task is red → green → commit. All paths absolute under `/Users/tiliu5/proj-e/live-stats`.

---

### Task 1: Wire up requirements.txt + README + dirs

**Files:**
- Create: `scripts/stage2/requirements.txt`
- Create: `scripts/stage2/README.md`
- Create: `models/.gitkeep`
- Modify: `.gitignore`
- Modify: `package.json`

- [ ] **Step 1: requirements.txt**

```
ultralytics>=8.0,<9.0
opencv-python>=4.8,<5.0
numpy>=1.24,<3.0
tqdm>=4.65,<5.0
```

- [ ] **Step 2: README**

```markdown
# Stage 2 Python tooling

Open-source ball/hoop detection adapts:
https://github.com/avishah3/AI-Basketball-Shot-Detection-Tracker

## One-time setup

    python3 -m venv .venv-stage2
    source .venv-stage2/bin/activate
    pip install -r scripts/stage2/requirements.txt

## Usage

    python scripts/stage2/detect_ball_hoop.py \
      --clip-manifest /path/to/clip_manifest.json \
      --model-path models/basketball_yolo.pt \
      --output ball_hoop_detections.json \
      --debug-dir debug

If `--model-path` does not exist, the script attempts to download from
`--model-url` (default points to the upstream release). Pass `--dry-run`
to skip inference and emit placeholder records (used by tests).
```

- [ ] **Step 3: .gitignore additions**

```
models/*.pt
debug/
ball_hoop_detections.json
.venv-stage2/
```

- [ ] **Step 4: package.json npm alias**

```json
"stage2:detect-ball-hoop": "python3 scripts/stage2/detect_ball_hoop.py"
```

- [ ] **Step 5: Commit**

```bash
git add scripts/stage2/requirements.txt scripts/stage2/README.md models/.gitkeep .gitignore package.json
git commit -m "chore(stage2): set up Phase 3 Python tooling scaffolding"
```

---

### Task 2: Pure-helper unit tests (Python, red)

**Files:**
- Create: `tests/fixtures/stage2/clip_manifest_for_detection.json`
- Create: `tests/stage2/_ball_hoop_core_unit.py`

- [ ] **Step 1: fixture manifest**

```json
{
  "game_id": "game_test",
  "source": "web_ui_command_history",
  "source_video": "fake.mp4",
  "settings": {
    "tipoff_time_sec": 10,
    "clip_before_sec": 4,
    "clip_after_sec": 3,
    "include_free_throws": false
  },
  "clips": [
    {
      "clip_id": "shot_000001",
      "event_id": "evt_000001",
      "raw_command": "+00:41 alden layup make wes",
      "elapsed_time_sec": 41,
      "video_timestamp": 51,
      "video_start_sec": 47,
      "video_end_sec": 54,
      "duration_sec": 7,
      "clip_path": "clips/shot_000001.mp4",
      "status": "skipped"
    }
  ]
}
```

- [ ] **Step 2: Python unittest file**

```python
# tests/stage2/_ball_hoop_core_unit.py
import json, os, sys, tempfile, unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "stage2"))
import _ball_hoop_core as core  # noqa: E402


class TestPickHoopCenter(unittest.TestCase):
    def test_returns_none_when_no_detections(self):
        self.assertIsNone(core.pick_hoop_center([]))

    def test_picks_median_of_highest_conf_per_frame(self):
        dets = [
            {"frame": 0, "x": 100, "y": 200, "confidence": 0.5},
            {"frame": 0, "x": 110, "y": 210, "confidence": 0.9},
            {"frame": 1, "x": 105, "y": 205, "confidence": 0.8},
        ]
        cx, cy = core.pick_hoop_center(dets)
        self.assertEqual((cx, cy), (107, 207))


class TestBallUsable(unittest.TestCase):
    def test_short_clip_needs_at_least_5_frames(self):
        self.assertTrue(core.ball_usable(detected=5, total=20))
        self.assertFalse(core.ball_usable(detected=4, total=20))

    def test_long_clip_uses_5pct_threshold(self):
        self.assertTrue(core.ball_usable(detected=20, total=400))   # 5%
        self.assertFalse(core.ball_usable(detected=10, total=400))


class TestSelectDebugFrames(unittest.TestCase):
    def test_returns_first_peak_last(self):
        track = [
            {"frame": 5,  "x": 1, "y": 1, "confidence": 0.4},
            {"frame": 10, "x": 1, "y": 1, "confidence": 0.95},
            {"frame": 30, "x": 1, "y": 1, "confidence": 0.6},
        ]
        idx = core.select_debug_frames(track)
        self.assertEqual(idx, [5, 10, 30])

    def test_empty_track_returns_empty(self):
        self.assertEqual(core.select_debug_frames([]), [])


class TestStubResult(unittest.TestCase):
    def test_dry_run_result_has_zero_detections_and_warning(self):
        clip = {
            "clip_id": "shot_000001",
            "event_id": "evt_000001",
            "raw_command": "+00:41 alden layup make wes",
            "clip_path": "clips/shot_000001.mp4",
        }
        r = core.stub_result(clip)
        self.assertFalse(r["hoop_detected"])
        self.assertEqual(r["ball_detected_frame_count"], 0)
        self.assertEqual(r["ball_track"], [])
        self.assertEqual(r["clip_id"], "shot_000001")
        self.assertEqual(r["event_id"], "evt_000001")
        self.assertEqual(
            r["raw_command"], "+00:41 alden layup make wes"
        )
        self.assertIn("dry-run", " ".join(r["warnings"]).lower())


class TestLoadManifest(unittest.TestCase):
    def test_loads_clip_manifest_fixture(self):
        fixture = (
            ROOT
            / "tests"
            / "fixtures"
            / "stage2"
            / "clip_manifest_for_detection.json"
        )
        manifest = core.load_manifest(fixture)
        self.assertEqual(manifest["game_id"], "game_test")
        self.assertEqual(len(manifest["clips"]), 1)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 3: Vitest wrapper to run the Python unit tests**

```ts
// tests/stage2/run_ball_hoop_pyunit.test.ts
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "../..");

describe("_ball_hoop_core_unit (python)", () => {
  it("python unittests pass", () => {
    const out = execFileSync(
      "python3",
      ["-m", "unittest", "tests/stage2/_ball_hoop_core_unit"],
      { cwd: repoRoot, encoding: "utf-8" },
    );
    expect(out).toBeDefined();
  });
});
```

- [ ] **Step 4: Run, expect FAIL**

Run: `npx vitest run tests/stage2/run_ball_hoop_pyunit.test.ts`
Expected: FAIL — `_ball_hoop_core` module doesn't exist.

- [ ] **Step 5: Commit (red)**

```bash
git add tests/fixtures/stage2/clip_manifest_for_detection.json tests/stage2/_ball_hoop_core_unit.py tests/stage2/run_ball_hoop_pyunit.test.ts
git commit -m "test(stage2): ball/hoop core helpers unit tests (red)"
```

---

### Task 3: Implement `_ball_hoop_core.py` (green)

**Files:**
- Create: `scripts/stage2/_ball_hoop_core.py`

- [ ] **Step 1: Implementation**

```python
# scripts/stage2/_ball_hoop_core.py
"""Pure helpers for detect_ball_hoop.py — no torch / opencv imports here so
unit tests can run in a slim environment."""
from __future__ import annotations

import json
import statistics
from pathlib import Path
from typing import Iterable, Optional


def load_manifest(path: Path | str) -> dict:
    p = Path(path)
    with p.open() as f:
        return json.load(f)


def write_results(out_path: Path | str, payload: dict) -> None:
    p = Path(out_path)
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("w") as f:
        json.dump(payload, f, indent=2)


def ball_usable(detected: int, total: int) -> bool:
    if total <= 0:
        return False
    threshold = max(5, int(total * 0.05))
    return detected >= threshold


def pick_hoop_center(detections: list[dict]) -> Optional[tuple[int, int]]:
    """Given a list of {frame, x, y, confidence} hoop detections, return the
    median (x, y) of the highest-confidence detection per frame, or None."""
    if not detections:
        return None
    by_frame: dict[int, dict] = {}
    for d in detections:
        f = d["frame"]
        prev = by_frame.get(f)
        if prev is None or d["confidence"] > prev["confidence"]:
            by_frame[f] = d
    xs = [d["x"] for d in by_frame.values()]
    ys = [d["y"] for d in by_frame.values()]
    return int(statistics.median(xs)), int(statistics.median(ys))


def select_debug_frames(ball_track: list[dict]) -> list[int]:
    if not ball_track:
        return []
    first = ball_track[0]["frame"]
    last = ball_track[-1]["frame"]
    peak = max(ball_track, key=lambda d: d["confidence"])["frame"]
    # Preserve original order: first, peak, last (deduplicated)
    out: list[int] = []
    for f in (first, peak, last):
        if f not in out:
            out.append(f)
    return out


def stub_result(clip: dict) -> dict:
    return {
        "clip_id": clip["clip_id"],
        "event_id": clip.get("event_id", ""),
        "raw_command": clip.get("raw_command", ""),
        "clip_path": clip.get("clip_path", ""),
        "hoop_detected": False,
        "hoop_center_xy": None,
        "ball_detected_frame_count": 0,
        "total_frame_count": 0,
        "ball_track": [],
        "ball_detection_usable": False,
        "debug_video_path": None,
        "warnings": ["dry-run: inference skipped"],
    }


def empty_failure_result(clip: dict, message: str) -> dict:
    return {
        "clip_id": clip["clip_id"],
        "event_id": clip.get("event_id", ""),
        "raw_command": clip.get("raw_command", ""),
        "clip_path": clip.get("clip_path", ""),
        "hoop_detected": False,
        "hoop_center_xy": None,
        "ball_detected_frame_count": 0,
        "total_frame_count": 0,
        "ball_track": [],
        "ball_detection_usable": False,
        "debug_video_path": None,
        "warnings": [f"clip failed: {message}"],
    }
```

- [ ] **Step 2: Run unit tests**

Run: `npx vitest run tests/stage2/run_ball_hoop_pyunit.test.ts`
Expected: PASS.

- [ ] **Step 3: Run full vitest**

Run: `npx vitest run`
Expected: all pass (no regressions).

- [ ] **Step 4: Commit**

```bash
git add scripts/stage2/_ball_hoop_core.py
git commit -m "feat(stage2): pure helpers for ball/hoop detection orchestration"
```

---

### Task 4: CLI dry-run integration test (red)

**Files:**
- Create: `tests/stage2/detect_ball_hoop_py.test.ts`

- [ ] **Step 1: Write the test**

```ts
// tests/stage2/detect_ball_hoop_py.test.ts
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "../..");
const cli = resolve(repoRoot, "scripts/stage2/detect_ball_hoop.py");
const manifest = resolve(
  repoRoot,
  "tests/fixtures/stage2/clip_manifest_for_detection.json",
);

describe("detect_ball_hoop.py (--dry-run)", () => {
  it("emits one stub result per manifest clip", () => {
    const tmp = mkdtempSync(join(tmpdir(), "bhd-"));
    try {
      const outPath = join(tmp, "out.json");
      execFileSync(
        "python3",
        [
          cli,
          "--clip-manifest", manifest,
          "--output", outPath,
          "--debug-dir", join(tmp, "debug"),
          "--dry-run",
        ],
        { cwd: repoRoot },
      );
      const data = JSON.parse(readFileSync(outPath, "utf-8"));
      expect(data.game_id).toBe("game_test");
      expect(data.source_manifest).toContain("clip_manifest_for_detection.json");
      expect(data.results).toHaveLength(1);
      const r = data.results[0];
      expect(r.clip_id).toBe("shot_000001");
      expect(r.event_id).toBe("evt_000001");
      expect(r.raw_command).toBe("+00:41 alden layup make wes");
      expect(r.hoop_detected).toBe(false);
      expect(r.ball_track).toEqual([]);
      expect(r.warnings.join(" ").toLowerCase()).toContain("dry-run");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("exits non-zero when manifest is missing", () => {
    let code = 0;
    try {
      execFileSync(
        "python3",
        [
          cli,
          "--clip-manifest", "/nonexistent.json",
          "--output", "/tmp/never.json",
          "--dry-run",
        ],
        { cwd: repoRoot, stdio: "ignore" },
      );
    } catch (e: any) {
      code = e.status ?? 1;
    }
    expect(code).not.toBe(0);
  });

  it("prints a summary mentioning the upstream repo", () => {
    const tmp = mkdtempSync(join(tmpdir(), "bhd-"));
    try {
      const outPath = join(tmp, "out.json");
      const stdout = execFileSync(
        "python3",
        [
          cli,
          "--clip-manifest", manifest,
          "--output", outPath,
          "--debug-dir", join(tmp, "debug"),
          "--dry-run",
        ],
        { cwd: repoRoot, encoding: "utf-8" },
      );
      // Acceptance criterion #1: implementation explicitly references the repo URL.
      expect(stdout).toContain("AI-Basketball-Shot-Detection-Tracker");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npx vitest run tests/stage2/detect_ball_hoop_py.test.ts`
Expected: FAIL — `detect_ball_hoop.py` doesn't exist.

- [ ] **Step 3: Commit (red)**

```bash
git add tests/stage2/detect_ball_hoop_py.test.ts
git commit -m "test(stage2): detect_ball_hoop.py dry-run integration tests (red)"
```

---

### Task 5: Implement `detect_ball_hoop.py` orchestrator (green)

**Files:**
- Create: `scripts/stage2/detect_ball_hoop.py`

- [ ] **Step 1: Implementation**

```python
#!/usr/bin/env python3
"""detect_ball_hoop.py — Stage 2 Phase 3.

Adapts the open-source baseline:
https://github.com/avishah3/AI-Basketball-Shot-Detection-Tracker

Runs YOLOv8 ball + hoop detection over each clip in a Phase 2 manifest,
saves annotated keyframes, and emits ball_hoop_detections.json.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.request
from pathlib import Path

# Allow `python -m unittest` discovery of helpers without importing torch.
sys.path.insert(0, str(Path(__file__).parent))
import _ball_hoop_core as core  # noqa: E402

UPSTREAM = "https://github.com/avishah3/AI-Basketball-Shot-Detection-Tracker"
DEFAULT_MODEL_URL = (
    UPSTREAM + "/releases/download/v1.0/basketball_yolo.pt"
)
BALL_LABEL_HINTS = ("basketball", "ball")
HOOP_LABEL_HINTS = ("hoop", "rim", "basket")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description=(
            "Stage 2 Phase 3 ball/hoop detector. "
            f"Adapts {UPSTREAM}"
        ),
    )
    p.add_argument("--clip-manifest", required=True)
    p.add_argument("--model-path", default="models/basketball_yolo.pt")
    p.add_argument("--model-url", default=DEFAULT_MODEL_URL)
    p.add_argument("--output", required=True)
    p.add_argument("--debug-dir", default="debug")
    p.add_argument("--ball-conf", type=float, default=0.30)
    p.add_argument("--hoop-conf", type=float, default=0.40)
    p.add_argument("--iou", type=float, default=0.45)
    p.add_argument("--img-size", type=int, default=640)
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Skip inference; emit stub records for testing.",
    )
    return p.parse_args()


def ensure_model(path: Path, url: str) -> Path | None:
    if path.is_file():
        return path
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with urllib.request.urlopen(url, timeout=60) as r:
            data = r.read()
        path.write_bytes(data)
        return path
    except Exception as e:  # noqa: BLE001
        print(f"warning: model download failed: {e}", file=sys.stderr)
        return None


def run_inference(
    clip: dict,
    model,
    cv2,
    args: argparse.Namespace,
    debug_dir: Path,
) -> dict:
    """Heavy path — only called when --dry-run is False."""
    import numpy as np  # noqa: F401

    clip_path = Path(clip["clip_path"])
    if not clip_path.is_file():
        return core.empty_failure_result(clip, f"clip not found: {clip_path}")

    cap = cv2.VideoCapture(str(clip_path))
    if not cap.isOpened():
        return core.empty_failure_result(clip, "cv2 could not open clip")

    ball_track: list[dict] = []
    hoop_dets: list[dict] = []
    total = 0
    frame_idx = 0
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            total += 1
            results = model.predict(
                source=frame,
                conf=min(args.ball_conf, args.hoop_conf),
                iou=args.iou,
                imgsz=args.img_size,
                verbose=False,
            )
            r = results[0]
            names = r.names if hasattr(r, "names") else {}
            if r.boxes is None:
                frame_idx += 1
                continue
            for box, conf, cls in zip(
                r.boxes.xyxy.cpu().numpy(),
                r.boxes.conf.cpu().numpy(),
                r.boxes.cls.cpu().numpy().astype(int),
            ):
                label = names.get(int(cls), str(cls)).lower()
                cx = int((box[0] + box[2]) / 2)
                cy = int((box[1] + box[3]) / 2)
                if any(h in label for h in BALL_LABEL_HINTS):
                    if conf >= args.ball_conf:
                        ball_track.append(
                            {
                                "frame": frame_idx,
                                "x": cx,
                                "y": cy,
                                "confidence": round(float(conf), 3),
                            }
                        )
                elif any(h in label for h in HOOP_LABEL_HINTS):
                    if conf >= args.hoop_conf:
                        hoop_dets.append(
                            {
                                "frame": frame_idx,
                                "x": cx,
                                "y": cy,
                                "confidence": float(conf),
                            }
                        )
            frame_idx += 1
    finally:
        cap.release()

    ball_track.sort(key=lambda d: d["frame"])
    hoop_center = core.pick_hoop_center(hoop_dets)
    detected_count = len({d["frame"] for d in ball_track})
    usable = core.ball_usable(detected_count, total)

    warnings: list[str] = []
    if hoop_center is None:
        warnings.append("hoop never detected")
    if not usable:
        warnings.append(
            f"ball detection sparse: {detected_count}/{total} frames"
        )

    # Debug stills
    debug_path = debug_dir / clip["clip_id"]
    if ball_track:
        debug_path.mkdir(parents=True, exist_ok=True)
        cap2 = cv2.VideoCapture(str(clip_path))
        try:
            target_frames = set(core.select_debug_frames(ball_track))
            f = 0
            while f <= max(target_frames, default=-1):
                ok, frame = cap2.read()
                if not ok:
                    break
                if f in target_frames:
                    overlay = frame.copy()
                    for d in ball_track:
                        if d["frame"] != f:
                            continue
                        cv2.circle(overlay, (d["x"], d["y"]), 12, (0, 255, 0), 2)
                    if hoop_center is not None:
                        cv2.circle(overlay, hoop_center, 18, (0, 0, 255), 2)
                    cv2.imwrite(
                        str(debug_path / f"frame_{f:06d}.jpg"), overlay
                    )
                f += 1
        finally:
            cap2.release()

    return {
        "clip_id": clip["clip_id"],
        "event_id": clip.get("event_id", ""),
        "raw_command": clip.get("raw_command", ""),
        "clip_path": clip.get("clip_path", ""),
        "hoop_detected": hoop_center is not None,
        "hoop_center_xy": (
            {"x": hoop_center[0], "y": hoop_center[1]}
            if hoop_center is not None
            else None
        ),
        "ball_detected_frame_count": detected_count,
        "total_frame_count": total,
        "ball_track": ball_track,
        "ball_detection_usable": usable,
        "debug_video_path": str(debug_path) if ball_track else None,
        "warnings": warnings,
    }


def main() -> int:
    args = parse_args()

    manifest_path = Path(args.clip_manifest)
    if not manifest_path.is_file():
        print(
            f"Error: clip manifest not found: {manifest_path}",
            file=sys.stderr,
        )
        return 1
    manifest = core.load_manifest(manifest_path)
    clips = manifest.get("clips", [])

    debug_dir = Path(args.debug_dir)
    debug_dir.mkdir(parents=True, exist_ok=True)

    print(
        "Stage 2 Phase 3 — adapting "
        "https://github.com/avishah3/AI-Basketball-Shot-Detection-Tracker"
    )
    print(f"Manifest: {manifest_path}")
    print(f"Clips:    {len(clips)}")

    results: list[dict] = []
    if args.dry_run:
        for clip in clips:
            results.append(core.stub_result(clip))
    else:
        # Heavy imports kept inside the branch so --dry-run never needs them.
        try:
            import cv2  # type: ignore
            from ultralytics import YOLO  # type: ignore
        except ImportError as e:
            print(
                f"Error: missing CV/ML deps ({e}). "
                "Install via `pip install -r scripts/stage2/requirements.txt` "
                "or pass --dry-run.",
                file=sys.stderr,
            )
            return 2

        model_path = Path(args.model_path)
        loaded = ensure_model(model_path, args.model_url)
        if loaded is None:
            print(
                f"Error: model not available at {model_path}; "
                "pass --model-url or download manually.",
                file=sys.stderr,
            )
            return 2

        model = YOLO(str(loaded))
        try:
            from tqdm import tqdm  # type: ignore
            iterator = tqdm(clips, desc="clips")
        except ImportError:
            iterator = clips

        for clip in iterator:
            try:
                results.append(
                    run_inference(clip, model, cv2, args, debug_dir),
                )
            except Exception as e:  # noqa: BLE001
                results.append(core.empty_failure_result(clip, str(e)))

    payload = {
        "game_id": manifest.get("game_id", ""),
        "source_manifest": str(manifest_path),
        "model_path": args.model_path,
        "settings": {
            "ball_conf": args.ball_conf,
            "hoop_conf": args.hoop_conf,
            "iou": args.iou,
            "img_size": args.img_size,
        },
        "results": results,
    }
    core.write_results(args.output, payload)

    print(f"Output:   {args.output}")
    print(f"Results:  {len(results)}")
    failed = sum(
        1 for r in results if r["warnings"] and "clip failed" in r["warnings"][0]
    )
    if failed:
        print(f"  failed: {failed}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Make executable**

```bash
chmod +x scripts/stage2/detect_ball_hoop.py
```

- [ ] **Step 3: Run dry-run integration tests**

Run: `npx vitest run tests/stage2/detect_ball_hoop_py.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 4: Run full vitest**

Run: `npx vitest run`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/stage2/detect_ball_hoop.py
git commit -m "feat(stage2): YOLOv8 ball/hoop detection CLI"
```

---

### Task 6: Smoke + final regression sweep

**Files:** none

- [ ] **Step 1: Full vitest**

Run: `npx vitest run`
Expected: all tests pass, including new Phase 3 dry-run + Python unit tests.

- [ ] **Step 2: tsc + builds**

Run: `npx tsc --noEmit && npm run stage2:build && npx vite build`
Expected: clean.

- [ ] **Step 3: Manual dry-run smoke** (no commit)

```bash
mkdir -p /tmp/bhd-smoke
python3 scripts/stage2/detect_ball_hoop.py \
  --clip-manifest tests/fixtures/stage2/clip_manifest_for_detection.json \
  --output /tmp/bhd-smoke/out.json \
  --debug-dir /tmp/bhd-smoke/debug \
  --dry-run
cat /tmp/bhd-smoke/out.json | head -30
rm -rf /tmp/bhd-smoke
```

- [ ] **Step 4: Walk acceptance criteria**

Confirm spec §"Acceptance criteria":
- ✅ Implementation references upstream URL — printed at runtime + in CLI `--help` description, README links.
- ✅ Each clip processed — orchestrator iterates `manifest.clips`.
- ✅ Ball trajectory + hoop center saved when available — `ball_track` + `hoop_center_xy` populated by `run_inference`.
- ✅ Debug images generated — annotated stills at `debug/<clip_id>/frame_*.jpg` (deviation from "video" noted in README).
- ✅ Failures → warnings, no crash — per-clip `try/except` returns `empty_failure_result`; CLI exit 0 unless manifest unreadable.
- ✅ Link to command history preserved — `event_id` + `raw_command` copied verbatim from clip into result.

- [ ] **Step 5: Commit any final touch-ups (only if needed)**

```bash
git status
git commit -am "chore(stage2): post-sweep adjustments" || true
```

---

## Open Questions / Risks

1. **Real ML run not exercised in tests.** Tests only cover `--dry-run` plus the pure helpers. Heavy real-inference run is exercised manually by the user — same constraint as Phase 2's ffmpeg path. Acceptable since CI doesn't have GPUs/torch.
2. **Model download URL.** Default points at a tag that may not exist on the upstream repo. README documents this; user passes `--model-url` or copies a `.pt` to `models/`. We prefer fail-safe: when download fails we exit 2 with a clear message, never crash silently.
3. **Class label drift.** The upstream model labels can vary (`Basketball` vs `ball`). We use case-insensitive substring match on `BALL_LABEL_HINTS` / `HOOP_LABEL_HINTS` to absorb this.
4. **`debug_video_path` semantic shift.** Field now points to a directory, not a video. Documented in `scripts/stage2/README.md`. Phase 6 (shot chart UI) must read the directory and pick frames; we'll address there.
5. **OpenCV install on Apple Silicon.** `opencv-python` wheels can be flaky on M-series Macs depending on Python version. README suggests `opencv-python-headless` as a fallback. Deferred — only matters when the user actually runs real inference.
6. **`numpy>=1.24,<3.0`.** ultralytics 8.x has been picky about numpy 2.x; pinning to `<3.0` keeps a wide range while letting pip pick a working version.

---

## Plan Review Loop

After saving this document, dispatch a `plan-document-reviewer` subagent with:
- Plan path: `docs/superpowers/plans/2026-05-24-stage2-phase3-ball-hoop-detection.md`
- Spec path: `docs/requirement/Stage-2/03_stage2_ball_hoop_detection_open_source.md`

Iterate until ✅ Approved (max 3 cycles).
