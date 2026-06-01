import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useHashRoute, matchClipsRoute } from "@/ui/useHashRoute";

describe("useHashRoute", () => {
  beforeEach(() => {
    window.location.hash = "";
  });

  it("returns the current hash path without leading #", () => {
    window.location.hash = "#/games/g1/stage2/clips";
    const { result } = renderHook(() => useHashRoute());
    expect(result.current).toBe("/games/g1/stage2/clips");
  });

  it("returns '/' when hash empty", () => {
    const { result } = renderHook(() => useHashRoute());
    expect(result.current).toBe("/");
  });

  it("updates when hash changes", () => {
    const { result } = renderHook(() => useHashRoute());
    expect(result.current).toBe("/");
    act(() => {
      window.location.hash = "#/games/g42/stage2/clips";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(result.current).toBe("/games/g42/stage2/clips");
  });
});

describe("matchProjectRoute", () => {
  it("matches /project (with or without trailing slash)", async () => {
    const { matchProjectRoute } = await import("@/ui/useHashRoute");
    expect(matchProjectRoute("/project")).toBe(true);
    expect(matchProjectRoute("/project/")).toBe(true);
  });
  it("does not match other paths", async () => {
    const { matchProjectRoute } = await import("@/ui/useHashRoute");
    expect(matchProjectRoute("/")).toBe(false);
    expect(matchProjectRoute("/projects")).toBe(false);
    expect(matchProjectRoute("/project/foo")).toBe(false);
  });
});

describe("matchClipsRoute", () => {
  it("matches /games/:gameId/stage2/clips", () => {
    expect(matchClipsRoute("/games/abc123/stage2/clips")).toEqual({
      gameId: "abc123",
    });
  });
  it("matches with trailing slash", () => {
    expect(matchClipsRoute("/games/abc/stage2/clips/")).toEqual({
      gameId: "abc",
    });
  });
  it("returns null for non-clip routes", () => {
    expect(matchClipsRoute("/")).toBeNull();
    expect(matchClipsRoute("/games/abc/stage2/other")).toBeNull();
  });
  it("decodes URI-encoded gameId", () => {
    expect(matchClipsRoute("/games/game_20260118_mountain%20view/stage2/clips"))
      .toEqual({ gameId: "game_20260118_mountain view" });
  });
});
