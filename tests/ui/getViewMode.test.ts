import { describe, it, expect } from "vitest";
import { getViewMode } from "@/ui/getViewMode";

describe("getViewMode", () => {
  it("returns 'stats' for the primary stats hostname", () => {
    expect(getViewMode("ethanliu.ccwu.cc", "")).toBe("stats");
  });

  it("returns 'landing' for the landing hostname", () => {
    expect(getViewMode("ethanliu.cc.cd", "")).toBe("landing");
  });

  it("hostname match is case-insensitive", () => {
    expect(getViewMode("ETHANLIU.CC.CD", "")).toBe("landing");
    expect(getViewMode("EthanLiu.CcWu.Cc", "")).toBe("stats");
  });

  it("defaults to 'stats' for unknown hostnames", () => {
    expect(getViewMode("localhost", "")).toBe("stats");
    expect(getViewMode("127.0.0.1", "")).toBe("stats");
    expect(getViewMode("example.com", "")).toBe("stats");
  });

  it("?view=landing overrides hostname to landing", () => {
    expect(getViewMode("localhost", "?view=landing")).toBe("landing");
    expect(getViewMode("ethanliu.ccwu.cc", "?view=landing")).toBe("landing");
  });

  it("?view=stats overrides hostname to stats", () => {
    expect(getViewMode("ethanliu.cc.cd", "?view=stats")).toBe("stats");
  });

  it("ignores other query params", () => {
    expect(getViewMode("ethanliu.cc.cd", "?foo=bar")).toBe("landing");
    expect(getViewMode("localhost", "?view=garbage")).toBe("stats");
  });
});
