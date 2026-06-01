import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "@/ui/App";

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.useRealTimers(); });

async function completeNewGameModal(
  user: ReturnType<typeof userEvent.setup>,
  opts: { name?: string; lineup?: string[] } = {},
) {
  const { name = "", lineup = ["jackson", "ayaan", "wes", "devin", "james"] } = opts;
  const dialog = within(screen.getByRole("dialog"));
  if (name) await user.type(dialog.getByLabelText(/opponent/i), name);
  for (const id of lineup) {
    await user.click(dialog.getByRole("button", { name: new RegExp(`^${id}$`, "i") }));
  }
  await user.click(dialog.getByRole("button", { name: /start game/i }));
}

/**
 * Capture every Blob passed to URL.createObjectURL and every anchor's
 * download name at click time. Returns parallel arrays the caller can zip.
 */
function installDownloadSpies() {
  const blobs: Blob[] = [];
  const clicks: { name: string; content: string }[] = [];

  if (!(URL as any).createObjectURL) (URL as any).createObjectURL = () => "";
  if (!(URL as any).revokeObjectURL) (URL as any).revokeObjectURL = () => {};

  const createObjURL = vi.spyOn(URL, "createObjectURL").mockImplementation((b: any) => {
    blobs.push(b as Blob);
    return "blob:test";
  });
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

  const origCreateElement = document.createElement.bind(document);
  const createElSpy = vi.spyOn(document, "createElement").mockImplementation((tag: any) => {
    const el = origCreateElement(tag);
    if (tag === "a") {
      const origClick = el.click.bind(el);
      (el as HTMLAnchorElement).click = () => {
        const name = (el as HTMLAnchorElement).download;
        // Pair with most recent createObjectURL call.
        const blob = blobs[blobs.length - 1];
        const maybeText: any = (blob as any)?._text;
        // We rely on the mocked Blob having _text set below.
        const content = typeof maybeText === "string" ? maybeText : "";
        clicks.push({ name, content });
        origClick();
      };
    }
    return el;
  });

  // Replace globalThis Blob so its string content is recoverable via _text.
  const OrigBlob = (globalThis as any).Blob;
  class SpyBlob extends OrigBlob {
    _text: string;
    constructor(parts: BlobPart[], options?: BlobPropertyBag) {
      super(parts, options);
      this._text = parts.map((p: any) => (typeof p === "string" ? p : "")).join("");
    }
  }
  (globalThis as any).Blob = SpyBlob;

  return {
    clicks,
    restore: () => {
      createObjURL.mockRestore();
      revoke.mockRestore();
      createElSpy.mockRestore();
      (globalThis as any).Blob = OrigBlob;
    },
  };
}

describe("App end-to-end", () => {
  it("new game → submit command via text input → stats update and history shows entry", async () => {
    const user = userEvent.setup();
    render(<App />);

    await completeNewGameModal(user, { name: "Mitty" });

    const input = screen.getByRole("textbox");
    await user.type(input, "jackson two make ayaan");
    await user.keyboard("{Enter}");

    expect(screen.getByText(/jackson two make ayaan/)).toBeDefined();
  });

  it("clicking panel buttons submits the same command path", async () => {
    const user = userEvent.setup();
    render(<App />);
    await completeNewGameModal(user);

    await user.click(screen.getByRole("button", { name: /^timeout$/i }));
    expect(screen.getByText(/-t/)).toBeDefined();
  });

  it("opponent name flows to StatsTable and CSV filename", async () => {
    const user = userEvent.setup();
    const spies = installDownloadSpies();

    render(<App />);
    await completeNewGameModal(user, { name: "Mitty" });

    const statsRegion = screen.getByLabelText(/^stats$/i);
    expect(within(statsRegion).getAllByText(/mitty/i).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /download csv/i }));
    expect(spies.clicks.some(c => c.name.startsWith("Mitty_") && c.name.endsWith(".csv"))).toBe(
      true,
    );

    spies.restore();
  });

  it("bench players are not selectable in the Rebound panel", async () => {
    const user = userEvent.setup();
    render(<App />);
    await completeNewGameModal(user);
    const panelsRegion = screen.getByLabelText(/event panels/i);
    const reboundSummary = Array.from(panelsRegion.querySelectorAll("summary"))
      .find((s) => s.textContent?.toLowerCase() === "rebound");
    expect(reboundSummary).toBeDefined();
    const reboundDetails = reboundSummary!.parentElement as HTMLElement;
    const buttons = reboundDetails.querySelectorAll("button");
    for (const btn of buttons) {
      expect(btn.textContent?.toLowerCase()).not.toBe("drew");
    }
  });

  it("downloaded TXT log includes +MM:SS prefix on post-tip entries", async () => {
    const user = userEvent.setup();
    const spies = installDownloadSpies();

    // Complete modal under real timers so userEvent's internals work.
    render(<App />);
    await completeNewGameModal(user);

    // Freeze wall clock AFTER modal closes, BEFORE the tip click.
    const t0 = Date.now();
    const dateSpy = vi.spyOn(Date, "now");
    dateSpy.mockReturnValue(t0);

    await user.click(screen.getByRole("button", { name: /^tipoff$/i }));

    // Advance wall clock by 37 seconds.
    dateSpy.mockReturnValue(t0 + 37_000);
    const input = screen.getByRole("textbox");
    await user.type(input, "jackson two make ayaan");
    await user.keyboard("{Enter}");

    await user.click(screen.getByRole("button", { name: /download log/i }));
    const txt = spies.clicks[spies.clicks.length - 1]?.content ?? "";
    expect(txt).toContain("+00:00  tip");
    expect(txt).toContain("+00:37  jackson two make ayaan");

    dateSpy.mockRestore();
    spies.restore();
  });

  it("header clock shows --:-- pre-tip and +00:00 after tipoff", async () => {
    const user = userEvent.setup();

    render(<App />);
    await completeNewGameModal(user);

    expect(screen.getByText(/Clock: --:--/)).toBeDefined();

    const t0 = Date.now();
    const dateSpy = vi.spyOn(Date, "now");
    dateSpy.mockReturnValue(t0);

    await user.click(screen.getByRole("button", { name: /^tipoff$/i }));
    expect(screen.getByText(/Clock: \+00:00/)).toBeDefined();

    // Advance the mocked wall clock and force a re-render by clicking a tab.
    dateSpy.mockReturnValue(t0 + 5_000);
    await user.click(screen.getByRole("tab", { name: /stats/i }));
    // Click another tab to force a second render (mobileTab changes both times).
    await user.click(screen.getByRole("tab", { name: /history/i }));
    expect(screen.queryByText(/Clock: \+00:05/)).not.toBeNull();

    dateSpy.mockRestore();
  });
});
