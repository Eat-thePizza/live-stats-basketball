# Stage 2 Phase 8 — Evaluation and Portfolio Evidence

## Goal

Evaluate the Stage 2 pipeline and generate evidence for portfolio/application use.

## Input

All Stage 2 outputs:

```text
parsed command-history timeline
clip manifest
ball/hoop detections
shooter localization
court mapping
shot chart data
manual corrections if any
SnapFind optional candidate results
```

## Output

Evaluation report:

```json
{
  "game_id": "game_001",
  "stage": "Stage 2",
  "counts": {
    "command_history_events": 42,
    "shot_events": 18,
    "clips_created": 18,
    "ball_hoop_success": 12,
    "shooter_auto_localized": 10,
    "manual_review_required": 8,
    "court_mapped": 16
  }
}
```

## Required metrics

- number of command-history events parsed
- number of shot events found
- number of clips created
- ball/hoop detection usable rate
- shooter auto-localization rate
- manual fallback rate
- court mapping success rate
- shot zone accuracy on reviewed sample
- average processing time per clip

## UI route

```text
/games/:gameId/stage2/evaluation
```

## Acceptance criteria

- evaluation page displays success/failure metrics
- open-source project URLs are listed
- SnapFind local path is listed as optional helper
- manual fallback rate is visible
- portfolio summary can be exported
- final output does not overclaim full automation
