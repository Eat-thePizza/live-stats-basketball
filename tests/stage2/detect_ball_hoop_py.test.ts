import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
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
          "--clip-manifest",
          manifest,
          "--output",
          outPath,
          "--debug-dir",
          join(tmp, "debug"),
          "--dry-run",
        ],
        { cwd: repoRoot },
      );
      const data = JSON.parse(readFileSync(outPath, "utf-8"));
      expect(data.game_id).toBe("game_test");
      expect(data.source_manifest).toContain(
        "clip_manifest_for_detection.json",
      );
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
          "--clip-manifest",
          "/nonexistent.json",
          "--output",
          "/tmp/never.json",
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
          "--clip-manifest",
          manifest,
          "--output",
          outPath,
          "--debug-dir",
          join(tmp, "debug"),
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
