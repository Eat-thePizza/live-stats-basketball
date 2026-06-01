## Next Feature: Relative Timestamps
Please switch to **brainstorming + planning mode** (do NOT start coding yet).


##  Relative Timestamp Support in Logs and Downloads

### Current Issue
- Existing logs/exported stats do **not** include timestamps.

### New Requirement
- All log entries in **downloaded logs** must include a timestamp.
- This timestamp is **NOT absolute real-world time**.

### Definition of Timestamp
- Time is **relative to tip-off**
- Tip-off = time zero (`00:00`)
- All subsequent events record elapsed game time since tip-off

### Behavior Rules
- Tip-off must be a deliberate user action:
  - Pressing a “Tip Off” / “Start Game Clock” control
- Timer starts at that moment and runs continuously
- Logs record timestamps such as:
  - `+00:37`
  - `+05:12`
  - `+18:43`

### Scope
- Timestamp is required for:
  - Downloaded logs (TXT / CSV / Markdown)
- Precise real-time sync with quarters is NOT required yet
- This is a single game clock, not per-quarter clocks

Please consider:
- How to introduce this cleanly into the existing state model
- How timestamps should be stored (numeric vs formatted)
- Edge cases (pause, undo, reset game)


## Execution Guidance

For now:
- **Analysis and planning only**
- No coding yet

Do NOT begin implementation until I explicitly approve the plan.

