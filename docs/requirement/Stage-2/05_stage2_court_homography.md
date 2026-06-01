# Stage 2 Phase 5 — Court Homography and Coordinate Mapping

## Goal

Map shooter video coordinates to basketball court coordinates.

## Required open-source project

Use or adapt concepts from:

```text
https://github.com/Purgty/Basketball-Homography
```

## Expected role

Use this project as reference for court keypoint detection, homography computation, video-to-court coordinate projection, 2D court template mapping, and fallback strategy.

## Input

Shooter localization result and court keypoints or calibration points.

## Output

```json
{
  "game_id": "game_001",
  "open_source_reference": "https://github.com/Purgty/Basketball-Homography",
  "shots": [
    {
      "event_id": "evt_000001",
      "clip_id": "shot_000001",
      "raw_command": "+00:41 alden layup make wes",
      "shooter_video_xy": { "x": 512, "y": 420 },
      "court_xy": { "x": 7.2, "y": 22.4 },
      "mapping_method": "homography",
      "mapping_confidence": 0.78,
      "mapping_status": "mapped",
      "warnings": []
    }
  ]
}
```

## Implementation modes

- Preferred: automatic or assisted court-keypoint detection using Basketball-Homography concepts.
- Fallback: manual court calibration if automatic keypoints fail. This is acceptable because it is one-time per game or camera angle, not per shot.

## Acceptance criteria

- GitHub repo URL is explicitly included in implementation docs or code comments
- homography is computed from at least 4 point pairs
- shooter video coordinates are mapped to court coordinates
- mapping confidence/status is recorded
- failed mapping includes clear warning
- original command-history context is preserved
