import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, rmSync, mkdtempSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { buildClipManifest } from "@/stage2/clipManifest";
import type { Stage2Json } from "@/stage2/types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "../..");
const cli = resolve(repoRoot, "scripts/stage2/extract_clips.py");
const timeline = resolve(
  repoRoot,
  "tests/fixtures/stage2/timeline_for_clips.json",
);

describe("extract_clips.py", () => {
  it("dry-run produces manifest matching the TS builder (shots only)", () => {
    const out = mkdtempSync(join(tmpdir(), "clips-"));
    try {
      execFileSync(
        "python3",
        [
          cli,
          "--video", "fake.mp4",
          "--timeline", timeline,
          "--output-dir", out,
          "--tipoff", "10",
          "--before", "4",
          "--after", "3",
          "--dry-run",
        ],
        { cwd: repoRoot },
      );
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
      expect(c.status).toBe("skipped");
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  it("--include-free-throws includes ft events", () => {
    const out = mkdtempSync(join(tmpdir(), "clips-"));
    try {
      execFileSync(
        "python3",
        [
          cli,
          "--video", "fake.mp4",
          "--timeline", timeline,
          "--output-dir", out,
          "--tipoff", "10",
          "--before", "4",
          "--after", "3",
          "--include-free-throws",
          "--dry-run",
        ],
        { cwd: repoRoot },
      );
      const m = JSON.parse(
        readFileSync(join(out, "clip_manifest.json"), "utf-8"),
      );
      expect(m.clips).toHaveLength(2);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  it("exits non-zero when timeline file is missing", () => {
    const out = mkdtempSync(join(tmpdir(), "clips-"));
    let code = 0;
    try {
      execFileSync(
        "python3",
        [
          cli,
          "--video", "x.mp4",
          "--timeline", "/nonexistent.json",
          "--output-dir", out,
          "--tipoff", "0",
          "--before", "1",
          "--after", "1",
          "--dry-run",
        ],
        { stdio: "ignore", cwd: repoRoot },
      );
    } catch (e: any) {
      code = e.status ?? 1;
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
    expect(code).not.toBe(0);
  });

  it("matches the TS builder output (shape + windows)", () => {
    const out = mkdtempSync(join(tmpdir(), "clips-"));
    try {
      execFileSync(
        "python3",
        [
          cli,
          "--video", "fake.mp4",
          "--timeline", timeline,
          "--output-dir", out,
          "--tipoff", "10",
          "--before", "4",
          "--after", "3",
          "--dry-run",
        ],
        { cwd: repoRoot },
      );
      const cliManifest = JSON.parse(
        readFileSync(join(out, "clip_manifest.json"), "utf-8"),
      );
      const tlJson = JSON.parse(readFileSync(timeline, "utf-8")) as Stage2Json;
      const tsManifest = buildClipManifest(tlJson, {
        tipoff_time_sec: 10,
        clip_before_sec: 4,
        clip_after_sec: 3,
      });
      const project = (c: any) => ({
        clip_id: c.clip_id,
        event_id: c.event_id,
        video_timestamp: c.video_timestamp,
        video_start_sec: c.video_start_sec,
        video_end_sec: c.video_end_sec,
        duration_sec: c.duration_sec,
        clip_path: c.clip_path,
      });
      expect(cliManifest.clips.map(project)).toEqual(
        tsManifest.clips.map(project),
      );
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
});
