import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Footer from "@/ui/Footer";

describe("Footer", () => {
  it("renders the portrait and the credit text", () => {
    render(<Footer />);
    expect(screen.getByAltText(/ethan/i)).toBeDefined();
    expect(screen.getByText(/built by ethan liu/i)).toBeDefined();
  });

  it("includes a Project Information link to the in-app #/project hash route", () => {
    render(<Footer />);
    const link = screen.getByRole("link", { name: /project information/i }) as HTMLAnchorElement;
    // Relative link — same host, just a hash route.
    expect(link.getAttribute("href")).toBe("#/project");
    // Same-tab navigation (no _blank): hash routes change view in place.
    expect(link.target).toBe("");
    // Visible text label, not just an aria-label.
    expect(link.textContent?.toLowerCase()).toContain("project information");
  });
});
