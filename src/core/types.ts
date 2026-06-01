export interface HistoryEntry { line: string; tMs: number | null; }

export type PlayerId = string;
export interface Player { id: PlayerId; displayName: string; }
export type Roster = Player[];

// Indexed stat array matching the CLI's layout:
// 2PM, 2PA, 3PM, 3PA, OR, DR, TO, STL, AST, BLK, FTM, FTA, +/-, DIFF
export type RosterStats = Record<PlayerId, number[]>;

export interface GameState {
  opponentName: string;
  roster: Roster;
  rosterStats: RosterStats;
  sfPoints: number;
  opPoints: number;
  sfPOT: number;
  opPOT: number;
  sfSP: number;
  opSP: number;
  sfML: number;
  opML: number;
  sfPOSS: number;
  opPOSS: number;
  possession: boolean | null;
  previousTurnover: boolean;
  secondChance: boolean;
  lineup: PlayerId[];
  tipoff: boolean;
  startTime: number | null;
  endedAtMs: number | null;
  commandHistory: HistoryEntry[];
  createdAt: number;
}

export type ShotType = "two" | "three" | "layup";

export type Command =
  | { kind: "shot"; player: PlayerId; shot: ShotType; made: boolean; assistOrBlock?: PlayerId }
  | { kind: "ft"; player: PlayerId; results: Array<"make" | "miss"> }
  | { kind: "rebound"; player: PlayerId; type: "or" | "dr" }
  | { kind: "turnover"; player: PlayerId; stealer?: PlayerId }
  | { kind: "lineup"; players: PlayerId[] }
  | { kind: "sub"; in: PlayerId; out: PlayerId }
  | { kind: "possession"; team: "sf" | "op" }
  | { kind: "timeout" }
  | { kind: "quarter" }
  | { kind: "tip" }
  | { kind: "noop" };
