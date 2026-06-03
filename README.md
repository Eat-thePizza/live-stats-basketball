# 🏀 Basketball Analytics Suite

A multi-part basketball analytics system combining **real-time stat tracking**, **computer vision shot charting**, and a **web dashboard** — built to support live game analysis and post-game review.

---

## Project Overview

| Component | Description |
|-----------|-------------|
| [Terminal Stat Tracker](#terminal-stat-tracker) | Live play-by-play stat input via typed commands |
| [CV Shot Chart Generator](#cv-shot-chart-generator) | YOLO-based automatic shot chart from game film |
| [Web Dashboard](#web-dashboard) | Online stats viewer at [ethanliu.ccwu.cc](https://ethanliu.ccwu.cc/) |

---

## Terminal Stat Tracker

A Python terminal program for tracking live basketball stats through fast keyboard input. One person can track an entire game in real time, play by play.

### Features

Tracks stats for both your team and the opponent:

- **Shooting** — 2PM/2PA, 3PM/3PA, FTM/FTA
- **Rebounding** — Offensive (OR) and Defensive (DR)
- **Possession** — Turnovers (TO), Steals (STL)
- **Playmaking / Defense** — Assists (AST), Blocks (BLK)
- **Advanced** — Plus/Minus (+/−), Points Off Turnovers, Second Chance Points, Missed Layups

> **Note:** `op` refers to the opponent team. Opponent players are not tracked individually.

### Requirements

- Python — [python.org/downloads](https://www.python.org/downloads/)
- `tabulate` library:

```bash
pip install tabulate
```

### Installation & Setup

```bash
git clone <repo-url>
cd <repo-folder>
pip install tabulate
```

### Running

```bash
python practicestats.py
```

Type commands during the game. When done, type `exit` to end the session.

On exit, the program will:
- Print a full stats table in the terminal
- Save a `.txt` play-by-play log
- Optionally export a `.csv` stats file (type `y` when prompted)

---

### Command Reference

#### Shots

```
[player] [shot_type] [make/miss] [optional: assister or blocker]
```

| Example | Meaning |
|---------|---------|
| `jackson two make ayaan` | Jackson makes a 2, assisted by Ayaan |
| `devin three make` | Devin makes a 3, no assist |
| `op three miss jackson` | Opponent misses a 3, Jackson blocks |
| `jackson layup miss` | Jackson misses a layup (tracked separately) |

> Only `three` counts as a 3-point attempt. All other shot types count as 2s. `layup` enables missed-layup tracking.

#### Free Throws

```
[player] ft [make/miss ...]
```

| Example | Meaning |
|---------|---------|
| `jackson ft make make` | Jackson hits both free throws |
| `op ft make miss` | Opponent makes first, misses second |

Free throws can be split across substitutions:
```
jackson ft make
-s devin max
jackson ft make
```

#### Turnovers & Steals

```
[player] to [optional: stealing player]
```

| Example | Meaning |
|---------|---------|
| `op to jackson` | Opponent turnover, Jackson steal |
| `op to` | Opponent turnover, no steal credited |

#### Rebounds

```
[player] or    ← offensive rebound
[player] dr    ← defensive rebound
```

#### Team Possession (no individual rebounder)

```
-p sf     ← possession to your team
-p op     ← possession to opponent
```

#### Lineups (for Plus/Minus)

```
-l player1 player2 player3 player4 player5
```

Set at the start of each quarter and after timeouts.

#### Substitutions

```
-s player_in player_out
```

#### Other

| Command | Action |
|---------|--------|
| `-t` | Timeout (reminder to re-enter lineup) |
| `---` | Quarter break marker in the log |
| `exit` | End session and export stats |

---

## CV Shot Chart Generator

> ⚠️ **Prototype** — actively in development. Detection is functional but not fully reliable.

An automated shot chart generator that uses computer vision to locate where each shot was taken on the court, using game film and the play-by-play JSON log produced by the stat tracker.

### How It Works

1. Reads field-goal entries from the stat tracker's JSON output (timestamps + make/miss)
2. For each shot, scans backwards in the game film to find the frame where the shooter last held the ball (using YOLO ball-player IoU overlap detection)
3. Applies homography estimation to map the shooter's court position from the camera view onto a 2D court diagram
4. Plots makes (green) and misses (red) on the shot chart image

### Models Used

- `pmodel 621141.pt` — custom YOLO model for ball, player, and hoop detection
- `court_keypoint_detector.pt` — YOLO model for court keypoint detection used in homography estimation

### Dependencies

```bash
pip install ultralytics opencv-python torch intel_extension_for_pytorch
```

> Intel IPEX is used to accelerate inference on Intel XPU hardware. If you're on a different setup, remove the IPEX lines and adjust the device target in `load_model()`.

### Usage

```bash
python getShots.py [tipoff_seconds]
```

- `tipoff_seconds` — the position in the video file (in seconds) where the game tip-off occurs
- Configure `jsoninfo`, `film`, `model_path`, and `court_keypoints` at the top of the file before running

### Output

- An annotated video frame for each shot (navigate with `SPACE`, quit with `Q`)
- `shotChartTesting.jpg` — the completed shot chart saved on quit

### Current Limitations

- Shot location is estimated from the frame with the highest ball-player IoU overlap, which can misidentify the shooter
- Homography accuracy depends on visible court keypoints — poor camera angles or occlusion reduce reliability
- Intel XPU dependency limits out-of-the-box compatibility

---

## Web Dashboard

A web interface for viewing game stats online.

🔗 [ethanliu.ccwu.cc](https://ethanliu.ccwu.cc/)

---

## Roadmap

- [ ] Improve shot chart shooter identification accuracy
- [ ] Add multi-game stat aggregation
- [ ] Web dashboard stat upload from CSV
- [ ] Expand opponent player tracking
- [ ] Cross-platform YOLO device support (CUDA, MPS, CPU fallback)

---

## Project Structure

```
.
├── practicestats.py          # Terminal stat tracker
├── getShots.py               # CV shot chart generator
├── homographyEstimation.py   # Court homography + team assignment utilities
├── court_board.jpg           # 2D court diagram for shot chart output
├── pmodel 621141.pt          # YOLO detection model
├── court_keypoint_detector.pt
└── README.md
```

---

## Author

Ethan Liu — [ethanliu.ccwu.cc](https://ethanliu.ccwu.cc/)
