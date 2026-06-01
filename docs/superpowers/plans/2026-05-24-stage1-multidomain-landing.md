# Stage 1 — Multi-domain Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add hostname-based dual-mode rendering. `ethanliu.ccwu.cc` keeps showing the existing basketball stats app unchanged. `ethanliu.cc.cd` renders a new `ProjectLandingPage` (motivation + 3 entry cards + author branding). On localhost, `?view=landing` is the override so I can demo both modes without editing `/etc/hosts`.

**Architecture:**
- New tiny pure helper `src/ui/getViewMode.ts` resolves `(hostname, search) → "stats" | "landing"`. No React, no DOM access — testable as a pure function.
- New `src/ui/ProjectLandingPage.tsx` + `ProjectLandingPage.module.css` — self-contained page; does NOT import anything from the stats app (no `Header`, no `useGameStore`, no panels). Three inline-SVG icons live in the same file.
- `src/ui/App.tsx` becomes a 3-line top-level switch: read mode, branch to `<ProjectLandingPage />` or to the existing `<MainApp />`. The current App body is renamed to `MainApp` to keep the diff small.
- `ethan-v3.png` already lives at the repo root. Move it to `src/assets/` so Vite includes it in the bundle (it's already imported by `Footer.module.css` via the existing logo pipeline path? Verify.) — actually safer to copy into `src/assets/` since the file at the repo root isn't currently imported by anything. The existing `logo_main.svg` lives in `src/assets/` based on the Header import. Pattern: `import authorPhotoUrl from "@/assets/ethan-v3.png"`.

**Tech Stack:** React 18, TypeScript, Vite 5, Vitest. Zero new runtime deps. Inline SVGs for icons.

---

## Spec Clarifications (locked)

1. **Hostname matching is exact + case-insensitive.** `ethanliu.cc.cd` and `ETHANLIU.CC.CD` both → landing. Any other hostname (including `www.ethanliu.cc.cd` if Cloudflare adds www later) → stats. I'll match `hostname === "ethanliu.cc.cd"` literally; if `www.` becomes a thing later we add it to the list.
2. **Localhost override:** `?view=landing` forces landing mode regardless of hostname; `?view=stats` forces stats. No override → hostname-based decision. This applies on every host, not just localhost — it's just most useful there.
3. **`MainApp` rename.** Existing `App.tsx`'s default export currently *is* the stats app. I rename the existing body component to `MainApp`, then make `App` a 3-line dispatcher. This keeps existing tests untouched (they import `App` and the dispatcher will still render `MainApp` by default in jsdom where `hostname === "localhost"`).
4. **Asset placement.** Copy `ethan-v3.png` to `src/assets/ethan-v3.png` so Vite bundles it. The existing `ethan-v3.png` at repo root is left alone (it's referenced from elsewhere — README only, harmless).
5. **No new deps.** Inline SVG icons (basketball / GitHub / play-triangle) live as small components in `ProjectLandingPage.tsx`.
6. **YouTube card.** Render but `aria-disabled` + visual `Coming Soon` badge, no `href`, no click handler. Cursor `not-allowed`.
7. **GitHub URL.** Hard-coded per spec: `https://github.com/Eat-thePizza/live-stats-basketball`.
8. **Live Stats URL.** Hard-coded per spec: `https://ethanliu.ccwu.cc`. Open in same tab (no `target="_blank"`) — simpler, keeps "back" button working for visitors.
9. **`MainApp` test impact.** The current test suite renders `<App />` in jsdom where `window.location.hostname === "localhost"`. The dispatcher's default branch is "stats", so all 226 tests must keep passing without modification.

---

## File Structure

**Create:**
- `src/ui/getViewMode.ts` — pure helper + types
- `src/ui/ProjectLandingPage.tsx` — landing component (sections + cards + icons + branding)
- `src/ui/ProjectLandingPage.module.css` — landing styles
- `tests/ui/getViewMode.test.ts` — pure-function tests
- `tests/ui/ProjectLandingPage.test.tsx` — component render tests
- `src/assets/ethan-v3.png` — copied from repo root

**Modify:**
- `src/ui/App.tsx` — rename body to `MainApp`; add tiny dispatcher
- `tests/ui/App.test.tsx` — already mounts `<App />` at `localhost`; should still pass. Add one test: when `window.location.hostname` is `ethanliu.cc.cd`, App renders the landing page.

**Don't touch:** `src/core/*`, `src/store/*`, `src/stage2/*`, every panel under `src/ui/panels/*`, `Header.tsx`, etc. The stats app is frozen for this phase.

---

## TDD Order

Each task is red → green → commit. All paths absolute under `/Users/tiliu5/proj-e/live-stats`.

---

### Task 1: `getViewMode` pure helper (red → green)

**Files:**
- Create: `tests/ui/getViewMode.test.ts`
- Create: `src/ui/getViewMode.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/ui/getViewMode.test.ts
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
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npx vitest run tests/ui/getViewMode.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
// src/ui/getViewMode.ts
export type ViewMode = "stats" | "landing";

const LANDING_HOSTS = new Set(["ethanliu.cc.cd"]);
const STATS_HOSTS = new Set(["ethanliu.ccwu.cc"]);

/**
 * Resolve which top-level view to render.
 *
 * Priority:
 *   1. `?view=landing` or `?view=stats` query override
 *   2. Hostname lookup (case-insensitive)
 *   3. Default to "stats" so unknown hosts (incl. localhost) keep the
 *      existing app behavior.
 */
export function getViewMode(hostname: string, search: string): ViewMode {
  const params = new URLSearchParams(search);
  const override = params.get("view");
  if (override === "landing" || override === "stats") {
    return override;
  }
  const h = (hostname ?? "").toLowerCase();
  if (LANDING_HOSTS.has(h)) return "landing";
  if (STATS_HOSTS.has(h)) return "stats";
  return "stats";
}
```

- [ ] **Step 4: Run, expect PASS**

Run: `npx vitest run tests/ui/getViewMode.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/ui/getViewMode.ts tests/ui/getViewMode.test.ts
git commit -m "feat(ui): add getViewMode hostname/query resolver"
```

---

### Task 2: Copy author photo into bundled assets

**Files:**
- Create: `src/assets/ethan-v3.png`

- [ ] **Step 1: Copy the file**

```bash
cp ethan-v3.png src/assets/ethan-v3.png
```

- [ ] **Step 2: Commit**

```bash
git add src/assets/ethan-v3.png
git commit -m "chore(assets): bundle ethan-v3.png in src/assets"
```

> Note: `git add` on a binary works fine. Don't worry about LFS — this image is small.

---

### Task 3: ProjectLandingPage component test (red)

**Files:**
- Create: `tests/ui/ProjectLandingPage.test.tsx`

- [ ] **Step 1: Write tests**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ProjectLandingPage from "@/ui/ProjectLandingPage";

describe("ProjectLandingPage", () => {
  it("renders the three required sections", () => {
    render(<ProjectLandingPage />);
    expect(screen.getByRole("heading", { name: /why this project exists/i }))
      .toBeDefined();
    expect(screen.getByRole("heading", { name: /core idea/i })).toBeDefined();
    expect(screen.getByRole("heading", { name: /what i am building/i }))
      .toBeDefined();
  });

  it("uses first-person 'I', not 'we'", () => {
    const { container } = render(<ProjectLandingPage />);
    const text = container.textContent ?? "";
    // "we" must not appear as a standalone pronoun. Allow it inside words
    // like "between" or "view".
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
    const card = screen.getByText(/youtube demo/i).closest("article, a, div");
    expect(card).toBeTruthy();
    expect(screen.getByText(/coming soon/i)).toBeDefined();
    // Should NOT be a link with an href to YouTube yet.
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
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npx vitest run tests/ui/ProjectLandingPage.test.tsx`

- [ ] **Step 3: Commit (red)**

```bash
git add tests/ui/ProjectLandingPage.test.tsx
git commit -m "test(ui): ProjectLandingPage tests (red)"
```

---

### Task 4: Implement ProjectLandingPage (green)

**Files:**
- Create: `src/ui/ProjectLandingPage.tsx`
- Create: `src/ui/ProjectLandingPage.module.css`

- [ ] **Step 1: Component**

```tsx
// src/ui/ProjectLandingPage.tsx
import authorPhotoUrl from "@/assets/ethan-v3.png";
import styles from "./ProjectLandingPage.module.css";

const STATS_URL = "https://ethanliu.ccwu.cc";
const GITHUB_URL = "https://github.com/Eat-thePizza/live-stats-basketball";

function BasketballIcon() {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3v18" />
      <path d="M5.6 5.6c2.4 2.4 3.7 5.7 3.7 9.1 0 1.6-.3 3.1-.8 4.5" />
      <path d="M18.4 5.6c-2.4 2.4-3.7 5.7-3.7 9.1 0 1.6.3 3.1.8 4.5" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56 0-.27-.01-1-.02-1.96-3.2.69-3.87-1.54-3.87-1.54-.52-1.33-1.27-1.69-1.27-1.69-1.04-.71.08-.69.08-.69 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.69 1.25 3.34.96.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.18 1.18.92-.26 1.91-.39 2.89-.39.98 0 1.97.13 2.89.39 2.21-1.49 3.18-1.18 3.18-1.18.62 1.58.23 2.75.11 3.04.74.81 1.18 1.84 1.18 3.1 0 4.43-2.7 5.4-5.27 5.69.41.36.78 1.06.78 2.14 0 1.55-.01 2.8-.01 3.18 0 .31.21.67.8.55C20.22 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8 5.5v13l11-6.5z" />
    </svg>
  );
}

interface CardProps {
  href?: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  comingSoon?: boolean;
}

function Card({ href, title, description, icon, comingSoon }: CardProps) {
  const inner = (
    <>
      <div className={styles.cardIcon}>{icon}</div>
      <div className={styles.cardBody}>
        <h3 className={styles.cardTitle}>{title}</h3>
        <p className={styles.cardDesc}>{description}</p>
      </div>
      {comingSoon && <span className={styles.badge}>Coming Soon</span>}
    </>
  );
  if (href) {
    return (
      <a className={styles.card} href={href}>
        {inner}
      </a>
    );
  }
  return (
    <article
      className={`${styles.card} ${styles.cardDisabled}`}
      aria-disabled="true"
    >
      {inner}
    </article>
  );
}

export default function ProjectLandingPage() {
  return (
    <div className={styles.root}>
      <header className={styles.hero}>
        <img
          className={styles.photo}
          src={authorPhotoUrl}
          alt="Ethan Liu"
        />
        <div className={styles.heroText}>
          <h1 className={styles.title}>Live Basketball Stat &amp; Analysis</h1>
          <p className={styles.byline}>Built by Ethan Liu</p>
        </div>
      </header>

      <section className={styles.section} aria-labelledby="why">
        <h2 id="why">Why this project exists</h2>
        <p>
          I play and watch a lot of high school basketball. The gap between
          a game ending and the data being usable is huge — pure manual
          logging produces no video, and full automated analytics arrive a
          day late. I wanted something a single person can run from the
          bench laptop that produces useful numbers immediately and richer
          video-backed analysis within a short turnaround.
        </p>
      </section>

      <section className={styles.section} aria-labelledby="core-idea">
        <h2 id="core-idea">Core idea</h2>
        <p>
          Stop trying to make the computer understand basketball from
          scratch. A scorekeeper at the bench already understands the game
          — if they type one short command per event, the computer gets a
          clean, time-stamped semantic timeline for free. That timeline
          drives both the live stats and the targeted video analysis, so
          CV only has to look at the seconds that actually matter.
        </p>
      </section>

      <section className={styles.section} aria-labelledby="building">
        <h2 id="building">What I am building</h2>
        <p>
          A live game logger (web + Python CLI), a video pipeline that
          slices clips around shot events and runs open-source detectors
          on them, and a unified UI that ties everything back to the
          original logged play. I'm building it incrementally as a high
          school project — the goal is a tool I'd actually want to use at
          my own school's games.
        </p>
      </section>

      <section className={styles.entries} aria-label="Project entries">
        <Card
          href={STATS_URL}
          title="Live Basketball Stats"
          description="Track games live and export stats."
          icon={<BasketballIcon />}
        />
        <Card
          href={GITHUB_URL}
          title="GitHub"
          description="View the source code and implementation."
          icon={<GitHubIcon />}
        />
        <Card
          title="YouTube Demo"
          description="Demo video (upcoming)."
          icon={<PlayIcon />}
          comingSoon
        />
      </section>

      <footer className={styles.footer}>
        <p>© Ethan Liu</p>
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: CSS**

```css
/* src/ui/ProjectLandingPage.module.css */
.root {
  max-width: 760px;
  margin: 0 auto;
  padding: 3rem 1.5rem 4rem;
  font-family: var(--font-sans);
  color: var(--sfhs-gray-900);
}

.hero {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  margin-bottom: 2.5rem;
}
.photo {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid var(--sfhs-maroon, #6b0016);
  flex-shrink: 0;
}
.heroText { display: flex; flex-direction: column; }
.title {
  margin: 0 0 0.25rem 0;
  font-family: var(--font-serif);
  font-size: 2rem;
  color: var(--sfhs-maroon, #6b0016);
  letter-spacing: -0.01em;
}
.byline {
  margin: 0;
  color: var(--sfhs-gray-700, #555);
  font-size: 0.95rem;
}

.section {
  margin: 0 0 2rem 0;
}
.section h2 {
  margin: 0 0 0.5rem 0;
  font-family: var(--font-serif);
  font-size: 1.25rem;
  color: var(--sfhs-gray-900, #2A2A2A);
}
.section p {
  margin: 0;
  line-height: 1.65;
  color: var(--sfhs-gray-700, #4A4A4A);
}

.entries {
  display: grid;
  gap: 0.75rem;
  margin: 2.5rem 0;
}

.card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.1rem;
  border: 1px solid var(--sfhs-gray-300, #ccc);
  border-radius: 8px;
  background: var(--sfhs-white, #fff);
  text-decoration: none;
  color: inherit;
  transition: border-color 120ms ease, transform 120ms ease;
  position: relative;
}
.card:hover:not(.cardDisabled) {
  border-color: var(--sfhs-maroon, #6b0016);
  transform: translateY(-1px);
}
.cardDisabled {
  opacity: 0.7;
  cursor: not-allowed;
}
.cardIcon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--sfhs-maroon, #6b0016);
}
.icon { width: 100%; height: 100%; }
.cardBody { flex: 1; min-width: 0; }
.cardTitle {
  margin: 0 0 0.15rem 0;
  font-size: 1rem;
  font-weight: 600;
}
.cardDesc {
  margin: 0;
  color: var(--sfhs-gray-700, #555);
  font-size: 0.9rem;
}
.badge {
  align-self: flex-start;
  background: var(--sfhs-gray-100, #eee);
  color: var(--sfhs-gray-700, #555);
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.footer {
  margin-top: 3rem;
  text-align: center;
  color: var(--sfhs-gray-700, #777);
  font-size: 0.85rem;
}

@media (max-width: 600px) {
  .root { padding: 2rem 1rem 3rem; }
  .hero { flex-direction: column; align-items: flex-start; gap: 1rem; }
  .title { font-size: 1.6rem; }
  .photo { width: 80px; height: 80px; }
}
```

- [ ] **Step 3: Run component tests**

Run: `npx vitest run tests/ui/ProjectLandingPage.test.tsx`
Expected: PASS.

- [ ] **Step 4: Run full vitest**

Run: `npx vitest run`
Expected: all tests pass — App tests still see stats mode at localhost.

- [ ] **Step 5: Commit**

```bash
git add src/ui/ProjectLandingPage.tsx src/ui/ProjectLandingPage.module.css
git commit -m "feat(ui): ProjectLandingPage with motivation + 3 entry cards"
```

---

### Task 5: App.tsx hostname dispatcher (red → green)

**Files:**
- Modify: `src/ui/App.tsx`
- Modify: `tests/ui/App.test.tsx`

- [ ] **Step 1: Add new App test (red)**

Add to `tests/ui/App.test.tsx`:

```tsx
it("renders ProjectLandingPage when hostname is ethanliu.cc.cd", () => {
  // jsdom allows mutating window.location via property assignment
  const orig = window.location;
  // @ts-expect-error - re-define for jsdom
  delete (window as any).location;
  (window as any).location = new URL("https://ethanliu.cc.cd/") as any;

  // Re-import App fresh so module-scope reads pick up new location
  // (App reads location at render via getViewMode, so a fresh render works.)
  // We can't reset modules here but the dispatcher reads location each render.
  render(<App />);
  expect(screen.getByText(/built by ethan liu/i)).toBeDefined();

  // restore
  (window as any).location = orig;
});
```

> Note: jsdom 24 lets you reassign `window.location` to a new URL. If this turns out flaky, the simpler alternative is `window.location.hash = ""` and call `getViewMode("ethanliu.cc.cd", "")` directly in a unit test — but the App-level test gives more confidence the dispatcher actually wires through.

Run: `npx vitest run tests/ui/App.test.tsx`
Expected: FAIL (App always renders the stats UI today).

- [ ] **Step 2: Refactor App.tsx**

Open `src/ui/App.tsx`. The current default export is the entire stats app. Rename the component to `MainApp` (function name + default export at the bottom), then add a tiny dispatcher.

Concretely, change:

```tsx
export default function App() {
  // ...all the existing logic...
}
```

to:

```tsx
function MainApp() {
  // ...all the existing logic, unchanged...
}

import { getViewMode } from "./getViewMode";
import ProjectLandingPage from "./ProjectLandingPage";

export default function App() {
  const mode = getViewMode(
    typeof window !== "undefined" ? window.location.hostname : "",
    typeof window !== "undefined" ? window.location.search : "",
  );
  if (mode === "landing") return <ProjectLandingPage />;
  return <MainApp />;
}
```

(Keep imports at the top of the file, not inline — written inline above only for readability. Move them to the top.)

- [ ] **Step 3: Run App tests**

Run: `npx vitest run tests/ui/App.test.tsx`
Expected: PASS.

- [ ] **Step 4: Run full vitest**

Run: `npx vitest run`
Expected: all 226+ tests pass — every existing integration test runs at `localhost` which → stats mode.

- [ ] **Step 5: Commit**

```bash
git add src/ui/App.tsx tests/ui/App.test.tsx
git commit -m "feat(ui): hostname-based dispatcher for stats vs landing"
```

---

### Task 6: Final regression sweep + manual smoke

**Files:** none

- [ ] **Step 1: Type-check + builds**

Run: `npx tsc --noEmit && npx vite build`
Expected: clean, dist/ built.

- [ ] **Step 2: Manual smoke**

```bash
npm run dev
# In a browser, visit:
#   http://localhost:5173                  → stats UI (existing behavior)
#   http://localhost:5173/?view=landing    → landing page
#   http://localhost:5173/?view=stats      → stats UI (forced)
```

Verify visually:
- Landing page shows photo + "Built by Ethan Liu", three sections, three cards.
- Live Stats and GitHub cards are clickable links; YouTube card has Coming Soon badge and is not clickable.
- Stats UI is unchanged at the default URL.

- [ ] **Step 3: Walk acceptance criteria**

Spec:
- ✅ `ethanliu.ccwu.cc` → existing stats app (verified by all 226 existing tests + manual)
- ✅ `ethanliu.cc.cd` → ProjectLandingPage (new App test)
- ✅ Hostname switch via `window.location.hostname`, no router lib
- ✅ ProjectLandingPage doesn't reuse stats UI layout (separate file, no Header/panels imports)
- ✅ Sections: Why this project exists / Core idea / What I am building
- ✅ First-person "I" only — enforced by test
- ✅ 3 entry cards with correct URLs + descriptions
- ✅ Icons: basketball / GitHub / play (inline SVGs)
- ✅ Clean centered layout
- ✅ ethan-v3.png + "Built by Ethan Liu" branding
- ✅ Detection in App.tsx; existing routes preserved
- ✅ No new heavy dependencies

- [ ] **Step 4: Commit any final touch-ups**

```bash
git status
# only commit if there are unstaged tweaks
```

---

## Open Questions / Risks

1. **www subdomain.** If Cloudflare adds `www.ethanliu.cc.cd` later, hostname won't match. Trivial to add; we wait until it's a real situation.
2. **Cloudflare Pages multi-domain config.** Spec assumes both hostnames already point at the same Pages deployment via Cloudflare DNS + Pages custom domains. No code change required on our side — same `dist/` serves both. Document in README under Deploy.
3. **`window.location` reassignment in tests.** jsdom 24 supports it, but if it doesn't behave we fall back to a unit test on `getViewMode` only, plus a snapshot of `<ProjectLandingPage />` and a mock hostname in a fresh `App` test using `vi.stubGlobal`.
4. **Photo size.** `ethan-v3.png` is 851 KB on disk (per the existing build output). At 96×96 displayed, this is overkill — the browser still downloads it all. Out of scope for this phase; address with `vite-plugin-image-optimizer` or a manual resize later.
5. **i18n.** Single English copy for now. If a Chinese version is needed later, lift section copy to a constants file first.

---

## Plan Review Loop

After saving this document, dispatch a `plan-document-reviewer` subagent with:
- Plan path: `docs/superpowers/plans/2026-05-24-stage1-multidomain-landing.md`
- Spec path: `docs/requirement/Stage-1/multidomain.md`

Iterate until ✅ Approved (max 3 cycles).
