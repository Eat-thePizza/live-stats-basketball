Here’s a clean **GitHub-style `README.md`** based on your documentation. I reorganized it so people can quickly understand the project, install it, and use the commands.

---

# Basketball Stats Tracker (Terminal Program)

A **Python terminal-based basketball stat tracking program** designed for live game input. The program records play-by-play events and automatically calculates detailed team and player statistics.

It is optimized for **fast keyboard input during games**, allowing a single person to track an entire game in real time.

---

# Features

The program tracks statistics for **both teams**, including:

### Shooting

* 2 Pointers Made / Attempted (2PM / 2PA)
* 3 Pointers Made / Attempted (3PM / 3PA)
* Free Throws Made / Attempted (FTM / FTA)

### Rebounding

* Offensive Rebounds (OR)
* Defensive Rebounds (DR)

### Possession

* Turnovers (TO)
* Steals (STL)

### Defense & Playmaking

* Assists (AST)
* Blocks (BLK)

### Advanced Game Stats

* Plus/Minus (+/-)
* Points
* Points Off Turnovers
* Second Chance Points
* Missed Layups

Note:
The keyword **`op`** refers to the **opponent**. Individual opponent players are not tracked—only the opponent team as a whole.

---

# Requirements

You must have the following installed:

### Python

Download the latest version of Python:

[https://www.python.org/downloads/](https://www.python.org/downloads/)

### Python Library

Install the `tabulate` library:

```bash
py -m pip install tabulate
```

---

# Installation

1. Download the program file.

2. Move it to your **Downloads folder** (or note where it is saved).

3. Open **Terminal** (Mac/Linux) or **Command Prompt** (Windows).

4. Navigate to the Downloads folder:

```bash
cd downloads
```

---

# Running the Program

Run the script using:

```bash
py practicestats.py
```

You will then begin entering **game events as text commands**.

---

# Ending the Program

To finish the session:

```
exit
```

When the program exits it will:

* Print a **table of all stats**
* Save a **.txt file with the full play-by-play input**
* Ask if you want to create a **CSV file** of the stats

Type:

```
y
```

if you want the CSV exported.

---

# Game Input System

All commands are **typed in lowercase**.

Player names must match the **`roster_stats` dictionary** exactly or the line will be ignored.

---

# Shot Tracking

Format:

```
[PLAYER] [SHOT_TYPE] [make/miss] [assist/block]
```

Examples:

```
jackson two make ayaan
```

Jackson makes a two-point shot assisted by Ayaan.

```
op three miss jackson
```

Opponent misses a three-pointer and Jackson gets the block.

```
devin three make
```

Devin makes a three with no assist.

### Notes

* Only the word **`three`** counts as a three-point attempt.
* Any other shot type counts as a **two pointer**.
* Using **`layup`** allows the program to track **missed layups**.

Example:

```
jackson layup miss
```

Miss detection is flexible.
Typing something like `omiss` will still count as a miss.

---

# Free Throws

Format:

```
[PLAYER] ft [make/miss...]
```

Examples:

```
op ft make miss
```

Opponent makes the first free throw and misses the second.

```
jackson ft make make make
```

Jackson makes all three free throws.

```
jackson ft make
```

Jackson makes a single free throw.

Notes:

* The middle keyword must be **`ft`**
* Free throws can be separated by substitutions if needed.

Example:

```
jackson ft make
-s devin max
jackson ft make
```

---

# Turnovers and Steals

Format:

```
[PLAYER] to [STEAL_PLAYER]
```

Examples:

```
op to jackson
```

Opponent turnover, Jackson steal.

```
op to
```

Opponent turnover with **no steal credited**.

Turnovers include:

* Bad passes
* Bad dribbles
* Offensive fouls
* Jump balls where possession is lost

---

# Rebounds

Format:

```
[PLAYER] or
```

or

```
[PLAYER] dr
```

Examples:

```
jackson or
```

Offensive rebound.

```
jackson dr
```

Defensive rebound.

Notes:

* Defensive rebounds from missed final free throws count.
* Tip-ins count as both a **rebound and a shot attempt**.

Example sequence:

```
jackson two miss
devin or
devin two make
```

---

# Team Rebounds (No Player)

Sometimes nobody clearly grabs the rebound.

Format:

```
-p sf
```

or

```
-p op
```

Meaning the possession goes to **Saint Francis** or the **Opponent**.

---

# Lineups

Used to track **plus/minus**.

Format:

```
-l player1 player2 player3 player4 player5
```

Example:

```
-l west devin james jackson ayaan
```

This sets the **current lineup on the court**.

Typically done:

* At the start of quarters
* After timeouts

---

# Substitutions

Format:

```
-s player_in player_out
```

Example:

```
-s john james
```

John substitutes in for James.

Substitutions usually happen during:

* Free throws
* Sideline out-of-bounds
* Baseline out-of-bounds

---

# Timeouts

Simply type:

```
-t
```

This is mainly used as a **reminder to check or re-enter the lineup after a timeout**.

---

# Quarter Breaks

At the end of a quarter type:

```
---
```

This marks the quarter break in the log file.

---

# Output Files

After the game the program produces:

### Stats Table

Displayed directly in the terminal.

### Game Log (.txt)

Contains **every command entered** during the game.

### CSV File (Optional)

A spreadsheet-friendly version of the final statistics.

---

If you'd like, I can also help you add sections that make this look **much more professional on GitHub**, like:

* **Example full game input**
* **Screenshot of output table**
* **Future improvements**
* **Contribution guide**

Those make projects look way stronger when people visit the repo.
