## Requested Behavior Changes / Refinements

Please update the implementation to reflect the following requirements. These are intentional UX and rules constraints, not cosmetic preferences.

---

### 1. Opponent Name Handling (Start New Game)

- When starting a new game, prompt:
  **"Enter the opponent's name (optional)"**
- Behavior rules:
  - If the input is empty:
    - The opponent should default to `"OP"`.
    - All UI sections (shots, stats, displays) should show `"OP"`.
  - If the user provides a name:
    - That name should be used consistently everywhere instead of `"OP"`:
      - Shot section
      - Statistics section
      - Any labels referencing the opponent
- The opponent name should be part of game state and persisted with the game.

---

### 2. Block Handling (Merge into Shot Flow)

- Remove the standalone **Block section**.
- Integrate **Block** into the **Shot flow** with the following rules:
  - A Block option should appear **only when the opponent shot result is `miss`**.
  - Block should be **optional**, not required.
- Semantically:
  - A block is an attribute of a defensive possession, not a standalone event.
- Statistics should still correctly record blocks per player.

---

### 3. Lineup Requirement on New Game

- When starting a new game:
  - Selecting a **lineup of 5 players is mandatory**.
  - The game **must not start** until exactly 5 players are selected as “on court”.
- UX expectation:
  - This should be a hard requirement, not just a warning.
  - The UI should clearly guide the user to set the lineup before proceeding.

---

### 4. Stat Input Restricted to On-Court Players

- For **all stat entry actions** (shots, rebounds, assists, fouls, blocks, etc.):
  - The selectable player list must include **only players currently on the court**.
- Bench players must never appear as options for live stat entry.
- This rule applies globally and consistently.

---

### 5. Substitution Rules Enforcement

- Substitution logic must enforce basketball legality:
  - **Player In**:
    - Must be a player currently **off the court (bench)**.
  - **Player Out**:
    - Must be a player currently **on the court**.
- Invalid substitutions should be impossible via the UI (not just rejected later).

#### Set Full Lineup
- The **Set Full Lineup** action:
  - Resets the on-court players.
  - Replaces all 5 on-court players in one action.
  - Bench / on-court state must be fully recalculated after this operation.

---

### Notes

- These rules are meant to:
  - Improve realism
  - Prevent invalid states
  - Reduce user error
- Please prioritize **state integrity over flexibility**.
- No new features are requested beyond these constraints; existing design decisions can remain unless they conflict with the above.


