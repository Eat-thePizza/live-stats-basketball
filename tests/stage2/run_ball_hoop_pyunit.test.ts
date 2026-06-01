import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "../..");

describe("_ball_hoop_core_unit (python)", () => {
  it("python unittests pass", () => {
    // Run via direct file execution so we don't need package __init__.py.
    const stdout = execFileSync(
      "python3",
      ["tests/stage2/_ball_hoop_core_unit.py", "-v"],
      { cwd: repoRoot, encoding: "utf-8" },
    );
    // unittest writes results to stderr by default; just confirm no throw.
    expect(stdout).toBeDefined();
  });
});
