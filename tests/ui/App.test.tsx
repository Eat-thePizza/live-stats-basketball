import { describe, it, expect, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "@/ui/App";

const originalLocation = window.location;
afterEach(() => {
  // Restore between tests so the next render sees the default jsdom host.
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: originalLocation,
  });
});

function setHostname(hostname: string, search: string = "") {
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: {
      ...originalLocation,
      hostname,
      host: hostname,
      search,
      href: `https://${hostname}/${search}`,
    },
  });
}

describe("App layout", () => {
  it("mounts Header, Footer, and all three region placeholders", () => {
    render(<App />);
    expect(screen.getByAltText(/saint francis/i)).toBeDefined();
    expect(screen.getByText(/built by ethan liu/i)).toBeDefined();
    expect(screen.getByLabelText(/event panels/i)).toBeDefined();
    expect(screen.getByLabelText(/^stats$/i)).toBeDefined();
    expect(screen.getByLabelText(/history and input/i)).toBeDefined();
  });

  it("has a tab bar for phone layout", async () => {
    const user = userEvent.setup();
    render(<App />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map(t => t.textContent)).toEqual(["Panels", "Stats", "History"]);
    await user.click(tabs[0]);
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
  });

  it("renders ProjectLandingPage when hostname is ethanliu.cc.cd", () => {
    setHostname("ethanliu.cc.cd");
    render(<App />);
    expect(screen.getByText(/built by ethan liu/i)).toBeDefined();
    // Stats UI should NOT be present.
    expect(screen.queryByLabelText(/event panels/i)).toBeNull();
  });

  it("?view=landing forces landing page even on default host", () => {
    setHostname("localhost", "?view=landing");
    render(<App />);
    expect(screen.getByText(/built by ethan liu/i)).toBeDefined();
  });

  it("#/project hash route renders the landing page", () => {
    window.location.hash = "#/project";
    try {
      render(<App />);
      expect(screen.getByText(/why this project exists/i)).toBeDefined();
      // Stats UI should NOT render under #/project.
      expect(screen.queryByLabelText(/event panels/i)).toBeNull();
    } finally {
      window.location.hash = "";
    }
  });
});
