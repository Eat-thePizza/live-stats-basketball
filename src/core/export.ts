import type { GameState } from "./types";
import { computePlayerRow, computeTeamRow, computeOffRTG, type PlayerStatRow } from "./stats";
import { formatElapsed } from "./clock";

const CSV_HEADER = [
  "Player",
  "2PM/2PA",
  "2P%",
  "3PM/3PA",
  "3P%",
  "OR",
  "DR",
  "TO",
  "STL",
  "AST",
  "BLK",
  "FTM/FTA",
  "FT%",
  "+/-",
  "Points",
];

function csvCell(value: string | number): string {
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowToCells(row: PlayerStatRow): string[] {
  return [
    row.displayName,
    row.twoMadeOverAttempted,
    String(row.twoPct),
    row.threeMadeOverAttempted,
    String(row.threePct),
    String(row.or),
    String(row.dr),
    String(row.to),
    String(row.stl),
    String(row.ast),
    String(row.blk),
    row.ftMadeOverAttempted,
    String(row.ftPct),
    String(row.plusMinus),
    String(row.points),
  ];
}

function toCSVLine(cells: string[]): string {
  return cells.map(csvCell).join(",");
}

function currentGameClockLabel(state: GameState): string {
  if (state.tipoff && state.startTime !== null) {
    return formatElapsed(Date.now() - state.startTime);
  }
  return formatElapsed(null);
}

function todayDateStr(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function opponentDisplayName(state: GameState): string {
  return state.roster.find(p => p.id === "op")?.displayName ?? "OP";
}

export function toCSV(state: GameState): string {
  const lines: string[] = [];
  lines.push(toCSVLine(["Game Clock", currentGameClockLabel(state)]));
  lines.push(toCSVLine(CSV_HEADER));

  for (const p of state.roster) {
    if (p.id === "op") continue;
    const row = computePlayerRow(state, p.id);
    lines.push(toCSVLine(rowToCells(row)));
  }

  lines.push("");

  const teamRow = computeTeamRow(state);
  lines.push(toCSVLine(rowToCells(teamRow)));

  const opRow = computePlayerRow(state, "op");
  lines.push(toCSVLine(rowToCells(opRow)));

  return lines.join("\r\n") + "\r\n";
}

export function toGameLogTxt(state: GameState): string {
  const lines: string[] = ["======================"];
  for (const entry of state.commandHistory) {
    if (entry.tMs === null) {
      lines.push(entry.line);
    } else {
      lines.push(`${formatElapsed(entry.tMs)}  ${entry.line}`);
    }
  }
  return lines.join("\n") + "\n";
}

function mdRow(cells: string[]): string {
  return `| ${cells.join(" | ")} |`;
}

function pipeEscape(s: string): string {
  return s.replace(/\|/g, "\\|");
}

export function toMarkdownRecap(state: GameState): string {
  const opName = opponentDisplayName(state);
  const date = todayDateStr();
  const lines: string[] = [];

  lines.push(`# ${opName} — ${date}`);
  lines.push("");
  lines.push(`**Game Clock at export:** ${currentGameClockLabel(state)}`);
  lines.push(`**Final Score:** SF ${state.sfPoints} — ${opName} ${state.opPoints}`);
  lines.push("");
  lines.push("## Stats");
  lines.push("");
  lines.push(mdRow(CSV_HEADER));
  lines.push(mdRow(CSV_HEADER.map(() => "---")));
  for (const p of state.roster) {
    if (p.id === "op") continue;
    lines.push(mdRow(rowToCells(computePlayerRow(state, p.id))));
  }
  lines.push(mdRow(rowToCells(computeTeamRow(state))));
  lines.push(mdRow(rowToCells(computePlayerRow(state, "op"))));
  lines.push("");
  lines.push("## Other Stats");
  lines.push("");
  lines.push(`- SF Points off turnovers: ${state.sfPOT}`);
  lines.push(`- OP Points off turnovers: ${state.opPOT}`);
  lines.push(`- SF Second Chance Points: ${state.sfSP}`);
  lines.push(`- OP Second Chance Points: ${state.opSP}`);
  lines.push(`- SF Missed Layups: ${state.sfML}`);
  lines.push(`- OP Missed Layups: ${state.opML}`);
  lines.push(`- SF OffRTG: ${computeOffRTG(state.sfPoints, state.sfPOSS)}`);
  lines.push(`- OP OffRTG: ${computeOffRTG(state.opPoints, state.opPOSS)}`);
  lines.push("");
  lines.push("## Timeline");
  lines.push("");
  lines.push(mdRow(["Time", "Command"]));
  lines.push(mdRow(["---", "---"]));
  for (const entry of state.commandHistory) {
    lines.push(mdRow([formatElapsed(entry.tMs), pipeEscape(entry.line)]));
  }

  return lines.join("\n") + "\n";
}
