import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fixture = resolve(__dirname, "../fixtures/stage2/game_20260118_mountain_view.log");
const expectedOut = resolve(__dirname, "../fixtures/stage2/game_20260118_mountain_view.json");
const cli = resolve(__dirname, "../../scripts/stage2/convert_game_log_to_json.mjs");
const repoRoot = resolve(__dirname, "../..");

beforeAll(() => {
  // Ensure CLI build artifact exists.
  execFileSync("npm", ["run", "stage2:build"], {
    cwd: repoRoot,
    stdio: "ignore",
  });
});

describe("convert_game_log_to_json CLI", () => {
  it("converts the fixture log to a sibling .json with the expected schema", () => {
    if (existsSync(expectedOut)) rmSync(expectedOut);
    const stdout = execFileSync("node", [cli, fixture], {
      cwd: repoRoot,
    }).toString();
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
      (e: any) =>
        e.player === "alden" && e.shot_type === "layup" && e.result === "make",
    );
    expect(aldenShot.assist_player).toBe("wes");

    // No parse_confidence anywhere
    for (const e of json.events) {
      expect("parse_confidence" in e).toBe(false);
    }

    rmSync(expectedOut);
  });

  it("supports --output for explicit output path", () => {
    const customOut = resolve(__dirname, "../fixtures/stage2/custom-out.json");
    if (existsSync(customOut)) rmSync(customOut);
    execFileSync("node", [cli, fixture, "--output", customOut], { cwd: repoRoot });
    expect(existsSync(customOut)).toBe(true);
    rmSync(customOut);
  });

  it("strips numbered list prefixes like '21. '", () => {
    const numberedFixture = resolve(__dirname, "../fixtures/stage2/numbered.log");
    const out = resolve(__dirname, "../fixtures/stage2/numbered.json");
    try {
      writeFileSync(
        numberedFixture,
        "1. +02:46 alden to\n21. +00:07 wes three make max\n",
      );
      if (existsSync(out)) rmSync(out);
      execFileSync("node", [cli, numberedFixture], { cwd: repoRoot });
      const json = JSON.parse(readFileSync(out, "utf-8"));
      expect(json.commands[1].raw_command).toBe("+00:07 wes three make max");
      expect(json.events[1].player).toBe("wes");
      expect(json.events[1].assist_player).toBe("max");
    } finally {
      if (existsSync(numberedFixture)) rmSync(numberedFixture);
      if (existsSync(out)) rmSync(out);
    }
  });

  it("exits non-zero when input file is missing", () => {
    let code = 0;
    try {
      execFileSync("node", [cli, "/nonexistent.log"], {
        cwd: repoRoot,
        stdio: "ignore",
      });
    } catch (e: any) {
      code = e.status ?? 1;
    }
    expect(code).not.toBe(0);
  });
});
