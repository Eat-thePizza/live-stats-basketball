import type { Command, Roster, ShotType } from "./types";
import { isValidPlayerId } from "./roster";

export function parseCommand(line: string, roster: Roster): Command {
  const trimmed = line.trim();
  if (trimmed === "") return { kind: "noop" };
  if (trimmed === "---") return { kind: "quarter" };
  {
    const lower = trimmed.toLowerCase();
    if (lower === "tip" || lower === "tipoff") return { kind: "tip" };
  }

  const chunks = trimmed.split(/\s+/);
  const head = chunks[0];

  if (head === "-t") return { kind: "timeout" };
  if (head === "-p") {
    const team = (chunks[1] ?? "").toLowerCase();
    if (team !== "sf" && team !== "op") return { kind: "noop" };
    return { kind: "possession", team };
  }
  if (head === "-s") {
    const inP = chunks[1];
    const outP = chunks[2];
    if (!inP || !outP || !isValidPlayerId(roster, inP) || !isValidPlayerId(roster, outP)) {
      return { kind: "noop" };
    }
    return { kind: "sub", in: inP, out: outP };
  }
  if (head === "-l") {
    const players = chunks.slice(1);
    if (players.length === 0) return { kind: "noop" };
    for (const p of players) {
      if (!isValidPlayerId(roster, p)) return { kind: "noop" };
    }
    return { kind: "lineup", players };
  }

  if (!isValidPlayerId(roster, head)) return { kind: "noop" };

  // turnover: "<player> to [stealer]"
  if (chunks.length >= 2 && chunks[1] === "to") {
    const stealer = chunks[2];
    if (stealer !== undefined && !isValidPlayerId(roster, stealer)) return { kind: "noop" };
    return stealer
      ? { kind: "turnover", player: head, stealer }
      : { kind: "turnover", player: head };
  }

  // free throws: "<player> ft make|miss..."
  if (chunks.length >= 3 && chunks.includes("ft")) {
    const idx = chunks.indexOf("ft");
    const results = chunks.slice(idx + 1).map(r => (r.includes("make") ? "make" : "miss")) as Array<"make" | "miss">;
    if (results.length === 0) return { kind: "noop" };
    return { kind: "ft", player: head, results };
  }

  // shot: "<player> <shotWord> <resultWord> [assistOrBlock]"
  if (chunks.length >= 3) {
    const shotWord = chunks[1];
    const resultWord = chunks[2];
    const fourth = chunks[3];
    const shot: ShotType =
      shotWord === "three" ? "three" : shotWord.includes("lay") ? "layup" : "two";
    const made = !(resultWord.includes("mis") || resultWord.includes("blocked"));
    if (fourth !== undefined && !isValidPlayerId(roster, fourth)) return { kind: "noop" };
    return fourth
      ? { kind: "shot", player: head, shot, made, assistOrBlock: fourth }
      : { kind: "shot", player: head, shot, made };
  }

  // rebound: exactly 2 tokens, second is "or" or "dr"
  if (chunks.length === 2 && (chunks[1] === "or" || chunks[1] === "dr")) {
    return { kind: "rebound", player: head, type: chunks[1] };
  }

  return { kind: "noop" };
}
