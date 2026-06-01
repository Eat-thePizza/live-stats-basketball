# Stage 2 Phase 6 — Shot Chart, Heatmap, and Halftime Report

## Goal

Generate coaching-friendly visual outputs from Stage 2 mapped shots.

## Input

Court-mapped shots.

## Output

1. shot chart data
2. heatmap data
3. zone summary
4. halftime report data

Example enriched shot:

```json
{
  "event_id": "evt_000001",
  "raw_command": "+00:41 alden layup make wes",
  "team": "wes",
  "player": "alden",
  "result": "make",
  "court_xy": { "x": 7.2, "y": 22.4 },
  "zone": "left_midrange",
  "localization_method": "open_source_cv_plus_homography",
  "manual_correction_used": false
}
```

## UI route

```text
/games/:gameId/stage2/shot-chart
```

## UI requirements

- show shot chart on court diagram
- show heatmap
- show made vs missed shots differently
- show AI-estimated vs manually-corrected shots differently
- tooltip should include raw command-history line
- filter by team, player, result, and shot type
- show zone summary
- show halftime report summary

## Acceptance criteria

- shot chart renders from court coordinates
- heatmap renders from shot attempts
- zone summary is computed
- halftime report is generated
- raw command-history context is visible in tooltips or detail panel
- AI-derived vs manual-corrected data is visually distinguished
