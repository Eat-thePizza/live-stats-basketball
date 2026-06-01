# SFHS Basketball Stats — Build, Test, and Deploy Guide

This document is the single reference for building, testing, packaging, and deploying the Saint Francis Basketball Stats web app to Cloudflare Pages.

Project root: `/Users/tiliu5/ethan/live-stats-basketball-main`

---

## Prerequisites

- **Node.js 20+** and **npm**
  Check with:
  ```bash
  node --version
  npm --version
  ```
- A Cloudflare account (free tier is fine): https://dash.cloudflare.com

First-time setup, install dependencies:

```bash
cd /Users/tiliu5/ethan/live-stats-basketball-main
npm install
```

---

## Local development

Start the Vite dev server with hot reload:

```bash
npm run dev
```

Open the URL printed in the terminal (typically http://localhost:5173).

---

## Running tests

Full suite (one-shot):

```bash
npm run test
```

Expected: **119 tests pass** across 25 test files (core logic, store, UI components, end-to-end integration, and golden-file parity tests against the original CLI).

Watch mode (re-runs on file changes):

```bash
npm run test:watch
```

---

## Production build

Compile, type-check, and bundle into `dist/`:

```bash
npm run build
```

This runs `tsc --noEmit` (strict type-check, no output) followed by `vite build`. Output goes to `dist/`.

Expected output sizes (approx):

```
dist/index.html                    ~0.4 KB
dist/assets/index-*.css            ~10 KB
dist/assets/index-*.js             ~176 KB (56 KB gzipped)
dist/assets/ethan-v3-*.png         ~851 KB
```

Preview the built site locally:

```bash
npm run preview
```

---

## Packaging for Cloudflare Pages (Direct Upload)

Cloudflare Pages' Direct Upload expects a zip whose **contents** (not a wrapper folder) sit at the zip root — i.e. `index.html` and the `assets/` folder must be at the top level.

Build and zip in one sequence:

```bash
cd /Users/tiliu5/ethan/live-stats-basketball-main
npm run build
cd dist
zip -r ../sfhs-basketball-stats.zip .
cd ..
ls -lh sfhs-basketball-stats.zip
```

Result: `sfhs-basketball-stats.zip` at the project root (~880 KB).

---

## Deploying to Cloudflare Pages — Direct Upload (fastest path)

1. Sign in to https://dash.cloudflare.com
2. Left sidebar → **Workers & Pages**.
3. Click **Create** (top right) → **Pages** tab → **Upload assets**.
4. Enter a project name (e.g. `sfhs-basketball-stats`). This becomes the URL: `sfhs-basketball-stats.pages.dev`.
5. Click **Create project**.
6. Drag the zip onto the drop zone, or click **Select from computer** and choose:
   `/Users/tiliu5/ethan/live-stats-basketball-main/sfhs-basketball-stats.zip`
7. Wait for upload/unpack, then click **Deploy site**.
8. In ~30 seconds you'll see **Success! Your project is live** with a URL like
   `https://sfhs-basketball-stats.pages.dev`.

### Subsequent updates

Each deploy is a snapshot. To publish a new version:

1. Rebuild and re-zip locally:
   ```bash
   npm run build
   cd dist && zip -r ../sfhs-basketball-stats.zip . && cd ..
   ```
2. In Cloudflare Pages, open the project → **Create deployment** → **Upload assets** → pick the new zip.
3. Once the deploy finishes, it becomes the production URL. Any past deployment can be promoted again via **Rollback**.

---

## Deploying to Cloudflare Pages — Git integration (optional, auto-deploy on push)

Best if you push this repo to GitHub or GitLab and want automatic deployments.

1. Push the repo to a Git provider.
2. In Cloudflare Pages: **Create project** → **Connect to Git** → select the repo.
3. Configure build:
   - **Framework preset:** None (or Vite if offered)
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. Add environment variable: `NODE_VERSION` = `20`.
5. Save and deploy. Every push to `main` triggers a new production deploy; PR branches get preview URLs automatically.

No other environment variables, bindings, Workers, Functions, KV, or D1 are required — it's a pure static site.

---

## Custom domain (optional)

In the Cloudflare Pages project → **Custom domains** → **Set up a custom domain** → enter e.g. `stats.yourdomain.com`.

- If the domain is already on Cloudflare: provisioning is instant.
- If not: Cloudflare walks you through adding a single CNAME record at your DNS provider.

---

## Troubleshooting

- **Build fails with TS errors**: run `npx tsc --noEmit` and fix reported errors. Strict mode is enforced.
- **Tests fail on Node 25+**: the project's `vitest.config.ts` passes `--no-experimental-webstorage` to work around Node 25's experimental native `localStorage` shadowing jsdom's. If you see "localStorage is not a function" in tests, confirm that flag is still in place.
- **Cloudflare upload complains about folder structure**: ensure the zip was made from INSIDE `dist/` (`cd dist && zip -r ../foo.zip .`) — not from the parent directory. The zip root should contain `index.html`, not a `dist/` folder.
- **Game state doesn't persist**: the app uses `localStorage` per browser/device. Private/incognito tabs will lose state when closed. This is expected.

---

## One-command deploy helper (optional)

If you want a single command that rebuilds and re-zips:

```bash
npm run build && rm -f sfhs-basketball-stats.zip && (cd dist && zip -r ../sfhs-basketball-stats.zip .)
```

Then drag `sfhs-basketball-stats.zip` into the Cloudflare Pages dashboard as above.
