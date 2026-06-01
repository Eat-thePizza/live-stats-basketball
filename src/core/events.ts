import type { GameState, PlayerId, RosterStats, ShotType } from "./types";

function cloneState(s: GameState): GameState {
  const rosterStats: RosterStats = {};
  for (const k in s.rosterStats) rosterStats[k] = [...s.rosterStats[k]];
  return { ...s, rosterStats, lineup: [...s.lineup] };
}

export function applyShot(
  state: GameState,
  args: { player: PlayerId; shot: ShotType; made: boolean; assistOrBlock?: PlayerId }
): GameState {
  const s = cloneState(state);
  const { player, shot, made, assistOrBlock } = args;

  // Main-loop possession update that happens BEFORE shots() in Python
  if (player === "op" && s.possession === true) {
    s.possession = false;
    s.opPOSS += 1;
    s.previousTurnover = false;
    s.secondChance = false;
  } else if (player !== "op" && s.possession === false) {
    s.possession = true;
    s.sfPOSS += 1;
    s.previousTurnover = false;
    s.secondChance = false;
  }

  if (shot === "three") {
    if (made) {
      if (player === "op") {
        s.opPoints += 3;
        if (s.previousTurnover) s.opPOT += 3;
        if (s.secondChance) s.opSP += 3;
      } else {
        s.sfPoints += 3;
        if (s.previousTurnover) s.sfPOT += 3;
        if (s.secondChance) s.sfSP += 3;
      }
      s.rosterStats[player][0] += 1;
      s.rosterStats[player][1] += 1;
      s.rosterStats[player][2] += 1;
      s.rosterStats[player][3] += 1;
      if (assistOrBlock !== undefined && assistOrBlock !== null) {
        s.rosterStats[assistOrBlock][8] += 1;
      }
    } else {
      s.rosterStats[player][1] += 1;
      s.rosterStats[player][3] += 1;
      if (assistOrBlock !== undefined && assistOrBlock !== null) {
        s.rosterStats[assistOrBlock][9] += 1;
      }
    }
  } else {
    if (made) {
      if (player === "op") {
        s.opPoints += 2;
        if (s.previousTurnover) s.opPOT += 2;
        if (s.secondChance) s.opSP += 2;
      } else {
        s.sfPoints += 2;
        if (s.previousTurnover) s.sfPOT += 2;
        if (s.secondChance) s.sfSP += 2;
      }
      s.rosterStats[player][0] += 1;
      s.rosterStats[player][1] += 1;
      if (assistOrBlock !== undefined && assistOrBlock !== null) {
        s.rosterStats[assistOrBlock][8] += 1;
      }
    } else {
      s.rosterStats[player][1] += 1;
      if (assistOrBlock !== undefined && assistOrBlock !== null) {
        s.rosterStats[assistOrBlock][9] += 1;
      }
      if (shot === "layup") {
        if (player === "op") s.opML = (s.opML ?? 0) + 1;
        else s.sfML = (s.sfML ?? 0) + 1;
      }
    }
  }

  return s;
}

export function applyFreeThrows(
  state: GameState,
  player: PlayerId,
  results: Array<"make" | "miss">
): GameState {
  const s = cloneState(state);
  for (const result of results) {
    if (result === "make") {
      if (player === "op") {
        s.opPoints += 1;
        if (s.previousTurnover) s.opPOT += 1;
        if (s.secondChance) s.opSP += 1;
      } else {
        s.sfPoints += 1;
        if (s.previousTurnover) s.sfPOT += 1;
        if (s.secondChance) s.sfSP += 1;
      }
      s.rosterStats[player][10] += 1;
      s.rosterStats[player][11] += 1;
    } else {
      s.rosterStats[player][11] += 1;
    }
  }
  return s;
}

export function applyRebound(
  state: GameState,
  player: PlayerId,
  type: "or" | "dr"
): GameState {
  const s = cloneState(state);
  if (type === "dr") {
    s.rosterStats[player][5] += 1;
    s.possession = player !== "op";
    if (s.possession === false) {
      s.opPOSS += 1;
    } else {
      s.sfPOSS += 1;
    }
    s.previousTurnover = false;
    s.secondChance = false;
  } else {
    s.rosterStats[player][4] += 1;
    s.secondChance = true;
  }
  return s;
}

export function applyTurnover(
  state: GameState,
  player: PlayerId,
  stealer?: PlayerId
): GameState {
  const s = cloneState(state);

  // Main-loop possession math (includes Python's apparent double-increment bug)
  if (player === "op" && s.possession === true) {
    s.opPOSS += 1;
  } else if (player !== "op" && s.possession === false) {
    s.sfPOSS += 1;
  }

  s.possession = player === "op";
  if (s.possession) {
    s.sfPOSS += 1;
  } else {
    s.opPOSS += 1;
  }
  s.previousTurnover = true;
  s.secondChance = false;

  // turnovers() stat increments
  s.rosterStats[player][6] += 1;
  if (stealer !== undefined && stealer !== null && stealer in s.rosterStats) {
    s.rosterStats[stealer][7] += 1;
  }

  return s;
}

export function applyLineupChange(
  state: GameState,
  players: PlayerId[]
): GameState {
  const s = cloneState(state);
  if (s.lineup.length === 0) {
    s.lineup = [...players];
    return s;
  }
  const incoming = new Set(players);
  const current = new Set(s.lineup);
  const guysOut = s.lineup.filter(p => !incoming.has(p));
  const guysIn = players.filter(p => !current.has(p));

  for (const p of guysOut) {
    const plusMinus = (s.sfPoints - s.opPoints) - s.rosterStats[p][13];
    s.rosterStats[p][12] += plusMinus;
  }
  for (const p of guysIn) {
    s.rosterStats[p][13] = s.sfPoints - s.opPoints;
  }
  s.lineup = [...players];
  return s;
}

export function applySubChange(
  state: GameState,
  inP: PlayerId,
  outP: PlayerId
): GameState {
  const s = cloneState(state);
  const plusMinus = (s.sfPoints - s.opPoints) - s.rosterStats[outP][13];
  s.rosterStats[outP][12] += plusMinus;
  s.rosterStats[inP][13] = s.sfPoints - s.opPoints;
  s.lineup = s.lineup.filter(p => p !== outP);
  if (!s.lineup.includes(inP)) s.lineup.push(inP);
  return s;
}

export function applyPossession(
  state: GameState,
  team: "sf" | "op"
): GameState {
  const s = cloneState(state);
  if (team === "op") {
    if (s.possession === false) {
      s.secondChance = true;
    } else if (s.possession === true) {
      s.possession = false;
      s.secondChance = false;
      s.opPOSS += 1;
    }
  } else {
    if (s.possession === true) {
      s.secondChance = true;
    } else if (s.possession === false) {
      s.possession = true;
      s.secondChance = false;
      s.sfPOSS += 1;
    }
  }
  return s;
}
