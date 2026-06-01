import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Header from "@/ui/Header";

const noop = () => {};

describe("Header", () => {
  it("renders the school logo with accessible alt text", () => {
    render(
      <Header
        opponentName=""
        onNewGame={noop}
        onDownloadCSV={noop}
        onDownloadLog={noop}
        onOpenRosterEditor={noop}
      />,
    );
    expect(screen.getByAltText(/saint francis/i)).toBeDefined();
  });

  it("shows opponent name when provided", () => {
    render(
      <Header
        opponentName="Mitty"
        onNewGame={noop}
        onDownloadCSV={noop}
        onDownloadLog={noop}
        onOpenRosterEditor={noop}
      />,
    );
    expect(screen.getByText(/Mitty/)).toBeDefined();
  });

  it("invokes callbacks on button clicks", async () => {
    const user = userEvent.setup();
    const onNewGame = vi.fn();
    const onDownloadCSV = vi.fn();
    const onDownloadLog = vi.fn();
    const onOpenRosterEditor = vi.fn();
    render(
      <Header
        opponentName="Mitty"
        onNewGame={onNewGame}
        onDownloadCSV={onDownloadCSV}
        onDownloadLog={onDownloadLog}
        onOpenRosterEditor={onOpenRosterEditor}
      />,
    );
    await user.click(screen.getByRole("button", { name: /new game/i }));
    await user.click(screen.getByRole("button", { name: /roster/i }));
    await user.click(screen.getByRole("button", { name: /download csv/i }));
    await user.click(screen.getByRole("button", { name: /download log/i }));
    expect(onNewGame).toHaveBeenCalledOnce();
    expect(onOpenRosterEditor).toHaveBeenCalledOnce();
    expect(onDownloadCSV).toHaveBeenCalledOnce();
    expect(onDownloadLog).toHaveBeenCalledOnce();
  });

  it("renders the gameClockLabel when provided", () => {
    render(
      <Header
        opponentName=""
        gameClockLabel="Clock: +00:37"
        onNewGame={noop}
        onDownloadCSV={noop}
        onDownloadLog={noop}
        onOpenRosterEditor={noop}
      />,
    );
    expect(screen.getByText("Clock: +00:37")).toBeDefined();
  });

  it("does not render the clock element when gameClockLabel is undefined", () => {
    render(
      <Header
        opponentName=""
        onNewGame={noop}
        onDownloadCSV={noop}
        onDownloadLog={noop}
        onOpenRosterEditor={noop}
      />,
    );
    expect(screen.queryByText(/Clock:/)).toBeNull();
  });

  it("renders a Download Recap button when onDownloadRecap is provided and calls it", async () => {
    const user = userEvent.setup();
    const onDownloadRecap = vi.fn();
    render(
      <Header
        opponentName=""
        onNewGame={noop}
        onDownloadCSV={noop}
        onDownloadLog={noop}
        onDownloadRecap={onDownloadRecap}
        onOpenRosterEditor={noop}
      />,
    );
    await user.click(screen.getByRole("button", { name: /download recap/i }));
    expect(onDownloadRecap).toHaveBeenCalledOnce();
  });

  it("omits the Download Recap button when onDownloadRecap is not provided", () => {
    render(
      <Header
        opponentName=""
        onNewGame={noop}
        onDownloadCSV={noop}
        onDownloadLog={noop}
        onOpenRosterEditor={noop}
      />,
    );
    expect(screen.queryByRole("button", { name: /download recap/i })).toBeNull();
  });

  it("renders Download JSON button and fires callback", async () => {
    const user = userEvent.setup();
    const onDownloadJSON = vi.fn();
    render(
      <Header
        opponentName="Mitty"
        onNewGame={noop}
        onOpenRosterEditor={noop}
        onDownloadCSV={noop}
        onDownloadLog={noop}
        onDownloadJSON={onDownloadJSON}
      />,
    );
    await user.click(screen.getByRole("button", { name: /download json/i }));
    expect(onDownloadJSON).toHaveBeenCalledOnce();
  });

  it("omits Download JSON button when callback is not provided", () => {
    render(
      <Header
        opponentName=""
        onNewGame={noop}
        onDownloadCSV={noop}
        onDownloadLog={noop}
        onOpenRosterEditor={noop}
      />,
    );
    expect(screen.queryByRole("button", { name: /download json/i })).toBeNull();
  });

  it("renders Clips button and fires callback", async () => {
    const user = userEvent.setup();
    const onOpenClips = vi.fn();
    render(
      <Header
        opponentName=""
        onNewGame={noop}
        onOpenRosterEditor={noop}
        onDownloadCSV={noop}
        onDownloadLog={noop}
        onOpenClips={onOpenClips}
      />,
    );
    await user.click(screen.getByRole("button", { name: /^clips$/i }));
    expect(onOpenClips).toHaveBeenCalledOnce();
  });

  it("omits Clips button when onOpenClips is not provided", () => {
    render(
      <Header
        opponentName=""
        onNewGame={noop}
        onDownloadCSV={noop}
        onDownloadLog={noop}
        onOpenRosterEditor={noop}
      />,
    );
    expect(screen.queryByRole("button", { name: /^clips$/i })).toBeNull();
  });
});
