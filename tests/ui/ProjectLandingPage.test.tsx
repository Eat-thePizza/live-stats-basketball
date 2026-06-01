import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ProjectLandingPage from "@/ui/ProjectLandingPage";

describe("ProjectLandingPage", () => {
  it("renders the three required sections", () => {
    render(<ProjectLandingPage />);
    expect(
      screen.getByRole("heading", { name: /why this project exists/i }),
    ).toBeDefined();
    expect(
      screen.getByRole("heading", { name: /core idea/i }),
    ).toBeDefined();
    expect(
      screen.getByRole("heading", { name: /what i am building/i }),
    ).toBeDefined();
  });

  it("uses first-person 'I', not 'we'", () => {
    const { container } = render(<ProjectLandingPage />);
    const text = container.textContent ?? "";
    expect(/\bwe\b/i.test(text)).toBe(false);
  });

  it("renders Live Stats card linking to ethanliu.ccwu.cc", () => {
    render(<ProjectLandingPage />);
    const link = screen.getByRole("link", { name: /live basketball stats/i });
    expect(link.getAttribute("href")).toBe("https://ethanliu.ccwu.cc");
  });

  it("renders GitHub card linking to the repo", () => {
    render(<ProjectLandingPage />);
    const link = screen.getByRole("link", { name: /github/i });
    expect(link.getAttribute("href")).toBe(
      "https://github.com/Eat-thePizza/live-stats-basketball",
    );
  });

  it("renders YouTube card as disabled with Coming Soon badge", () => {
    render(<ProjectLandingPage />);
    expect(screen.getByText(/youtube demo/i)).toBeDefined();
    expect(screen.getByText(/coming soon/i)).toBeDefined();
    const ytLink = screen.queryByRole("link", { name: /youtube/i });
    expect(ytLink).toBeNull();
  });

  it("renders the Built by Ethan Liu byline", () => {
    render(<ProjectLandingPage />);
    expect(screen.getByText(/built by ethan liu/i)).toBeDefined();
  });

  it("renders the author photo with descriptive alt text", () => {
    render(<ProjectLandingPage />);
    const img = screen.getByAltText(/ethan liu/i) as HTMLImageElement;
    expect(img.src).toMatch(/ethan-v3.*\.png$/);
  });
});
