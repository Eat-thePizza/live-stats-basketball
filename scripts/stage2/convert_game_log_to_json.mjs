#!/usr/bin/env node
// Convert an existing live-stats game log file (.log/.txt) to Stage 2 JSON.
// Shares the same parser as the browser Download JSON button, via the
// compiled artifact in dist-stage2/.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, basename, extname, dirname } from "node:path";
import { argv, exit, cwd } from "node:process";
import { pathToFileURL, fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Repo root is two levels up from scripts/stage2/.
const repoRoot = resolve(__dirname, "..", "..");

async function loadExporter() {
  const mod = resolve(repoRoot, "dist-stage2", "stage2", "exportJson.js");
  return import(pathToFileURL(mod).href);
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
    console.error(
      "Usage: convert_game_log_to_json.mjs <input.log> [--output <out.json>]",
    );
    exit(2);
  }

  const inputPath = resolve(cwd(), input);
  let raw;
  try {
    raw = readFileSync(inputPath, "utf-8");
  } catch {
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
    ? resolve(cwd(), output)
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
