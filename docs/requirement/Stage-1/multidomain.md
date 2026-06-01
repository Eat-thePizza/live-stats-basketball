Implement multi-domain support with different homepages.

This is a high school personal project, so keep tone consistent with a single author (first-person “I”), but the UI itself should stay clean and neutral.

---

## 1. Multi-domain behavior

The app must support multiple hostnames and render different homepages:

### Domain mapping

1. ethanliu.ccwu.cc
   - This should behave exactly the same as today.
   - It should load the existing basketball stats web app (no changes).
   - This remains the primary “Live Basketball Stat” tool.

2. ethanliu.cc.cd
   - This should render a new project landing page (NOT the stats UI).
   - This is a static-style introduction page describing the project.

Use a simple hostname-based switch:

- Read from window.location.hostname
- Do not introduce heavy routing libraries
- Do not refactor the entire app architecture

---

## 2. Project landing page (ethanliu.cc.cd)

Create a new React view/component:

Example:
- ProjectLandingPage.tsx

This page should NOT reuse the stats UI layout.

---

### 2.1 Content structure

Include sections:

1. Why this project exists
2. Core idea
3. What I am building

Use first-person singular ("I"), not "we".

---

### 2.2 Main entry section

Add 3 entry cards:

1. Live Basketball Stats
   - Link: https://ethanliu.ccwu.cc
   - Description: Track games live and export stats

2. GitHub
   - Link: https://github.com/Eat-thePizza/live-stats-basketball
   - Description: View the source code and implementation

3. YouTube Demo
   - Description: Demo video (upcoming)
   - Label: Coming Soon

---

### 2.3 Icons

Each entry must have an icon:

- Basketball icon → Live Stats
- GitHub icon → GitHub
- Play icon → YouTube

---

## 3. Visual design

- Clean, minimal layout
- Similar to sfhs.com style
- Centered content
- Clear typography

---

## 4. Author branding

- Use ethan-v3.png prominently
- Add label: Built by Ethan Liu

---

## 5. Routing behavior

- Detect hostname in App.tsx
- Render:
  - MainApp for stats
  - ProjectLandingPage for intro

Do NOT break existing routes.

---

## 6. Constraints

- Minimal changes
- No new heavy dependencies
- Preserve existing functionality

---

## 7. Deliverables

Show:
- Files changed
- Hostname logic
- Example URLs behavior
