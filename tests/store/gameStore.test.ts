import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  STORAGE_KEYS,
  loadGame, saveGame, loadRoster, saveRoster,
  useGameStore,
} from "@/store/gameStore";
import { DEFAULT_ROSTER } from "@/core/roster";
import { createInitialState } from "@/core/state";

beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

describe("storage helpers", () => {
  it("saveGame and loadGame roundtrip", () => {
    const s = createInitialState({ opponentName: "Mitty", roster: DEFAULT_ROSTER });
    saveGame(s);
    const loaded = loadGame();
    expect(loaded?.opponentName).toBe("Mitty");
    expect(loaded?.rosterStats.jackson).toEqual(new Array(14).fill(0));
  });
  it("loadGame returns null when key absent", () => {
    expect(loadGame()).toBeNull();
  });
  it("loadGame returns null on malformed JSON", () => {
    localStorage.setItem(STORAGE_KEYS.game, "{not json");
    expect(loadGame()).toBeNull();
  });
  it("loadGame returns null if object has no rosterStats", () => {
    localStorage.setItem(STORAGE_KEYS.game, JSON.stringify({ foo: 1 }));
    expect(loadGame()).toBeNull();
  });
  it("saveRoster and loadRoster roundtrip", () => {
    saveRoster(DEFAULT_ROSTER);
    expect(loadRoster()?.length).toBe(DEFAULT_ROSTER.length);
  });
  it("loadGame normalizes legacy string[] commandHistory to HistoryEntry[]", () => {
    const legacy = {
      opponentName: "",
      roster: [{ id: "op", displayName: "OP" }],
      rosterStats: {},
      sfPoints: 0, opPoints: 0,
      sfPOT: 0, opPOT: 0,
      sfSP: 0, opSP: 0,
      sfML: 0,
      sfPOSS: 0, opPOSS: 0,
      possession: null,
      previousTurnover: false,
      secondChance: false,
      lineup: [],
      tipoff: false,
      startTime: null,
      commandHistory: ["jackson two make"],
      createdAt: 0,
    };
    localStorage.setItem(STORAGE_KEYS.game, JSON.stringify(legacy));
    const loaded = loadGame();
    expect(loaded?.commandHistory).toEqual([{ line: "jackson two make", tMs: null }]);
  });
});

describe("useGameStore", () => {
  it("initializes with fresh state when localStorage empty", () => {
    const { result } = renderHook(() => useGameStore());
    expect(result.current.state.opponentName).toBe("");
    expect(result.current.state.roster.length).toBe(DEFAULT_ROSTER.length);
  });

  it("submit() runs a command and persists to localStorage", () => {
    const { result } = renderHook(() => useGameStore());
    act(() => { result.current.submit("tip"); });
    act(() => { result.current.submit("jackson three make"); });
    expect(result.current.state.sfPoints).toBe(3);
    const persisted = loadGame();
    expect(persisted?.sfPoints).toBe(3);
  });

  it("newGame() resets game but preserves roster", () => {
    const { result } = renderHook(() => useGameStore());
    act(() => { result.current.submit("jackson three make"); });
    act(() => { result.current.newGame("Bellarmine"); });
    expect(result.current.state.sfPoints).toBe(0);
    expect(result.current.state.opponentName).toBe("Bellarmine");
    expect(result.current.state.roster.length).toBe(DEFAULT_ROSTER.length);
  });

  it("setRoster() keeps existing stats for retained players and drops removed ones", () => {
    const { result } = renderHook(() => useGameStore());
    act(() => { result.current.submit("tip"); });
    act(() => { result.current.submit("jackson three make"); });
    const trimmed = DEFAULT_ROSTER.filter(p => p.id !== "drew");
    act(() => { result.current.setRoster(trimmed); });
    expect(result.current.state.rosterStats.jackson[0]).toBe(1);
    expect(result.current.state.rosterStats.drew).toBeUndefined();
  });

  it("re-mounting the hook restores state from localStorage", () => {
    const first = renderHook(() => useGameStore());
    act(() => { first.result.current.submit("tip"); });
    act(() => { first.result.current.submit("jackson three make"); });
    first.unmount();

    const second = renderHook(() => useGameStore());
    expect(second.result.current.state.sfPoints).toBe(3);
  });

  it("newGameWithLineup() resets state and seeds the lineup atomically", () => {
    const { result } = renderHook(() => useGameStore());
    act(() => {
      result.current.newGameWithLineup("Mitty", ["jackson","ayaan","wes","devin","james"]);
    });
    expect(result.current.state.opponentName).toBe("Mitty");
    expect(result.current.state.roster.find(p => p.id === "op")?.displayName).toBe("Mitty");
    expect(result.current.state.lineup).toEqual(["jackson","ayaan","wes","devin","james"]);
  });

  it("endGame() persists endedAtMs and survives a remount", () => {
    const first = renderHook(() => useGameStore());
    act(() => { first.result.current.submit("tip"); });
    expect(first.result.current.state.tipoff).toBe(true);
    expect(first.result.current.state.endedAtMs).toBeNull();

    act(() => { first.result.current.endGame(123_456); });
    expect(first.result.current.state.endedAtMs).toBe(123_456);
    first.unmount();

    const second = renderHook(() => useGameStore());
    expect(second.result.current.state.endedAtMs).toBe(123_456);
    expect(second.result.current.state.tipoff).toBe(true);
  });

  it("loadGame() backfills missing endedAtMs to null on legacy saves", () => {
    const legacy: any = {
      ...createInitialState({ opponentName: "X", roster: DEFAULT_ROSTER }),
    };
    delete legacy.endedAtMs;
    localStorage.setItem(STORAGE_KEYS.game, JSON.stringify(legacy));
    const loaded = loadGame();
    expect(loaded?.endedAtMs).toBeNull();
  });
});
