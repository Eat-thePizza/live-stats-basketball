# Basketball Stats System — Change Request (for Claude Code)

## Context
This basketball statistics system was designed previously, and all design / process documentation exists under:

```
docs/superpower/
```

The following are required product and UI behavior updates.

---

## 1. Collapsible Left Panel (PC Only)

### Requirement
- The **left-most panel** (containing items like `Shot`, `Free Throws`, `Rebound`) must be **collapsible**.
- Default state: **collapsed** on PC.

### Behavior
- When collapsed:
  - The **middle stats table panel should expand** to take the space of both:
    - left panel
    - middle panel
  - Result: stats table should be fully visible **without horizontal scrolling**.

### Scope
- ✅ Applies to: **PC / desktop only**
- ❌ Does NOT apply to: **iPad version (no changes needed)**

---

## 2. Command Input Display Behavior

### Current Issue
- Commands entered via:
  - "type a command"
  - or input in sections like `Shot`
- Are currently displayed **above the input box**.

### Required Change
- Commands should be displayed:
  - **Below the input box**
  - In **reverse chronological order (latest first)**

---

## 3. Highlight Active Players in Stats Table

### Requirement
- All **players currently on the court (on-court players)** must be:
  - **Visually highlighted** in the statistics table

### Suggested Behavior
- Highlight style could include:
  - background color
  - bold text
  - border

---

## 4. "Other Stats" Section Redesign

### Requirement
- The **Other Stats** section (below main stats table):
  - Should be converted into the **same tabular format** as the main stats table

### Field Change
- Replace label:
  - `op`
- With:
  - **Opponent name (if provided by user)**

---

## 5. Add "End Game" Button

### Location
- Left panel, under:
  - `Timeout`
  - `Quarter`

### Behavior
- Add button: **End Game**
- Initial state: **disabled**

### Enable Condition
- Only enabled **after tipoff has occurred**

---

## 6. Default Roster Option in New Game Flow

### Requirement
- During **New Game setup**:
  - Add option: **"Default Roster"** (toggle / checkbox)

### Behavior
- Default: **enabled**
  - Uses the current default roster automatically

- If disabled:
  - User must **manually input roster**
  - Only after roster input, user can proceed

---

## Notes for Implementation

- Ensure responsive behavior between PC and iPad remains clean and separated
- Avoid breaking existing workflows in `docs/superpower`
- UI consistency with existing table and panel systems is important

---

## Deliverable Expectations

- Update UI components accordingly
- Ensure state management reflects new conditions (tipoff, roster selection, etc.)
- Add necessary validations for user inputs

