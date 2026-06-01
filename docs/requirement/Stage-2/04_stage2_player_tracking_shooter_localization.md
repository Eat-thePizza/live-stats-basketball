# Stage 2 Phase 4 — Player Tracking and Shooter Localization

## Goal

Estimate shooter location in video coordinates by combining ball/hoop detections with player detection/tracking. Manual clicking is only a fallback.

## Required open-source references

### basketball_analysis

```text
https://github.com/abdullahtarek/basketball_analysis
```

Use for modular basketball video analysis structure, player detection/tracking ideas, ball acquisition logic, and team assignment ideas.

### Ultralytics YOLO Tracking

Use for ByteTrack / BoT-SORT style tracking if available.

## Input

Clip manifest, ball/hoop detection results, and parsed command-history metadata.

## Output

```json
{
  "game_id": "game_001",
  "results": [
    {
      "clip_id": "shot_000001",
      "event_id": "evt_000001",
      "raw_command": "+00:41 alden layup make wes",
      "shooter_video_xy": { "x": 512, "y": 420 },
      "shooter_bbox": { "x1": 470, "y1": 260, "x2": 550, "y2": 420 },
      "release_frame": 41,
      "method": "player_nearest_ball_before_release",
      "confidence": 0.63,
      "requires_manual_review": false,
      "warnings": []
    }
  ]
}
```

## Algorithm requirement

1. Detect players in each short clip.
2. Track players across frames.
3. Estimate release frame using ball trajectory.
4. Find player closest to the ball immediately before release.
5. Use bottom-center of that player bounding box as shooter location.

## UI route

```text
/games/:gameId/stage2/review-shots
```

## Acceptance criteria

- player detection/tracking is attempted before manual fallback
- shooter location is produced for at least some clips
- every result includes method, confidence, and warnings
- low-confidence cases are flagged for review
- original command-history line remains visible in the review UI
