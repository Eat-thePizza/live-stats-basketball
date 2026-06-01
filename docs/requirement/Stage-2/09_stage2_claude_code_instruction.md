# Claude Code Instructions for Stage 2

## Critical naming instruction

Use **Stage 2** exactly and consistently.

Do not use any other stage naming in new routes, files, UI labels, or documentation.

## Read first

1. `00_stage2_open_source_pipeline_overview.md`
2. this file

Then implement phase files in order.

## Implementation order

```text
Phase 1: command history context parser
Phase 2: clip extraction
Phase 3: ball/hoop detection using AI-Basketball-Shot-Detection-Tracker
Phase 4: player tracking and shooter localization using basketball_analysis concepts
Phase 5: court homography using Basketball-Homography concepts
Phase 6: shot chart / heatmap / halftime report
Phase 8: evaluation
Phase 7: optional SnapFind local helper
```

## Required open-source project URLs

```text
https://github.com/avishah3/AI-Basketball-Shot-Detection-Tracker
https://github.com/abdullahtarek/basketball_analysis
https://github.com/Purgty/Basketball-Homography
```

## Required local SnapFind path

```text
/Users/tiliu5/proj-e/snapfind
```

## Existing app assumptions

- React + Vite frontend
- Cloudflare Pages deployment
- existing web UI has command history
- command history is the Stage 2 input context
- heavy processing may run in local Python scripts or an external backend

## Suggested routes

```text
/games/:gameId/stage2/import-command-history
/games/:gameId/stage2/clips
/games/:gameId/stage2/detections
/games/:gameId/stage2/review-shots
/games/:gameId/stage2/court-mapping
/games/:gameId/stage2/shot-chart
/games/:gameId/stage2/evaluation
```

## Suggested source organization

```text
src/stage2/
  commandHistory/
  clipExtraction/
  detections/
  shooterLocalization/
  courtMapping/
  shotChart/
  evaluation/

scripts/stage2/
  extract_clips.py
  detect_ball_hoop.py
  detect_players_and_shooter.py
  map_court_points.py
```

## Important implementation policy

Do not turn Stage 2 into a pure manual annotation tool. The main pipeline must attempt open-source-assisted computer vision first. Manual review is fallback only.

## Definition of done

A user can:

1. reuse/import existing web UI command history
2. parse command-history events with context
3. extract shot clips from video
4. run ball/hoop detection based on open-source project reference
5. run player/shooter localization
6. map shooter location to court coordinates
7. generate shot chart and heatmap
8. optionally use local SnapFind demo at `/Users/tiliu5/proj-e/snapfind`
9. export evaluation summary
