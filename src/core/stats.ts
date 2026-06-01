import type { GameState, PlayerId } from "./types";

export interface PlayerStatRow {
  displayName: string;
  twoMadeOverAttempted: string;
  twoPct: number;
  threeMadeOverAttempted: string;
  threePct: number;
  or: number;
  dr: number;
  to: number;
  stl: number;
  ast: number;
  blk: number;
  ftMadeOverAttempted: string;
  ftPct: number;
  plusMinus: number;
  points: number;
}

export type TeamStatRow = PlayerStatRow;

export function pct(num: number, den: number): number {
  if (den <= 0) return 0;
  const ratio = num / den;
  const rounded = Math.round(ratio * 1000) / 1000;
  return 100 * rounded;
}

function capitalizeFirst(s: string): string {
  if (s.length === 0) return s;
  return s[0].toUpperCase() + s.slice(1);
}

export function computePlayerRow(state: GameState, playerId: PlayerId): PlayerStatRow {
  const st = state.rosterStats[playerId] ?? [];
  const FGM = st[0] ?? 0;
  const FGA = st[1] ?? 0;
  const TPM = st[2] ?? 0;
  const TPA = st[3] ?? 0;
  const OR  = st[4] ?? 0;
  const DR  = st[5] ?? 0;
  const TO  = st[6] ?? 0;
  const STL = st[7] ?? 0;
  const AST = st[8] ?? 0;
  const BLK = st[9] ?? 0;
  const FTM = st[10] ?? 0;
  const FTA = st[11] ?? 0;
  const storedPM = st[12] ?? 0;
  const seedDiff = st[13] ?? 0;
  // Live +/-: stored value plus the in-progress segment for players on court.
  // OP row never tracks +/- (no lineup tracking on opponent side).
  const onCourt = state.lineup.includes(playerId);
  const liveSegment = onCourt ? (state.sfPoints - state.opPoints) - seedDiff : 0;
  const PM = playerId === "op" ? 0 : storedPM + liveSegment;

  const twoM = FGM - TPM;
  const twoA = FGA - TPA;

  const displayName = state.roster.find(p => p.id === playerId)?.displayName ?? capitalizeFirst(playerId);

  return {
    displayName,
    twoMadeOverAttempted: `${twoM}/${twoA}`,
    twoPct: pct(twoM, twoA),
    threeMadeOverAttempted: `${TPM}/${TPA}`,
    threePct: pct(TPM, TPA),
    or: OR,
    dr: DR,
    to: TO,
    stl: STL,
    ast: AST,
    blk: BLK,
    ftMadeOverAttempted: `${FTM}/${FTA}`,
    ftPct: pct(FTM, FTA),
    plusMinus: PM,
    points: 3 * TPM + 2 * (FGM - TPM) + FTM,
  };
}

export function computeTeamRow(state: GameState): TeamStatRow {
  let FGM = 0, FGA = 0, TPM = 0, TPA = 0;
  let OR = 0, DR = 0, TO = 0, STL = 0, AST = 0, BLK = 0;
  let FTM = 0, FTA = 0;

  for (const p of state.roster) {
    if (p.id === "op") continue;
    const st = state.rosterStats[p.id];
    if (!st) continue;
    FGM += st[0] ?? 0;
    FGA += st[1] ?? 0;
    TPM += st[2] ?? 0;
    TPA += st[3] ?? 0;
    OR  += st[4] ?? 0;
    DR  += st[5] ?? 0;
    TO  += st[6] ?? 0;
    STL += st[7] ?? 0;
    AST += st[8] ?? 0;
    BLK += st[9] ?? 0;
    FTM += st[10] ?? 0;
    FTA += st[11] ?? 0;
  }

  const twoM = FGM - TPM;
  const twoA = FGA - TPA;

  return {
    displayName: "SF",
    twoMadeOverAttempted: `${twoM}/${twoA}`,
    twoPct: pct(twoM, twoA),
    threeMadeOverAttempted: `${TPM}/${TPA}`,
    threePct: pct(TPM, TPA),
    or: OR,
    dr: DR,
    to: TO,
    stl: STL,
    ast: AST,
    blk: BLK,
    ftMadeOverAttempted: `${FTM}/${FTA}`,
    ftPct: pct(FTM, FTA),
    plusMinus: 0,
    points: state.sfPoints,
  };
}

export function computeOffRTG(points: number, poss: number): number {
  if (poss === 0) return 0;
  return Math.round((points / poss) * 100 * 10) / 10;
}
