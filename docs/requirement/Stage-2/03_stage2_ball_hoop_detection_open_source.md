# Stage 2 Phase 3 — Ball and Hoop Detection Using Open Source

## Goal

Detect basketball and hoop/rim in shot clips using an open-source basketball shot detection project.

## Required open-source project

Use or adapt:

```text
https://github.com/avishah3/AI-Basketball-Shot-Detection-Tracker
```

## Expected role

This project should provide the baseline for basketball detection, hoop/rim detection, ball trajectory extraction, shot-clip debug overlays, and detection quality metrics.

## Input

Clip manifest from Phase 2.

## Output

```json
{
  "game_id": "game_001",
  "results": [
    {
      "clip_id": "shot_000001",
      "event_id": "evt_000001",
      "raw_command": "+00:41 alden layup make wes",
      "hoop_detected": true,
      "hoop_center_xy": { "x": 843, "y": 214 },
      "ball_detected_frame_count": 12,
      "total_frame_count": 210,
      "ball_track": [
        { "frame": 42, "x": 612, "y": 318, "confidence": 0.72 }
      ],
      "ball_detection_usable": true,
      "debug_video_path": "debug/shot_000001_ball_hoop.mp4",
      "warnings": []
    }
  ]
}
```

## Processing command

```bash
python scripts/stage2/detect_ball_hoop.py \
  --clip-manifest clip_manifest.json \
  --model-path models/basketball_yolo.pt \
  --output ball_hoop_detections.json \
  --debug-dir debug
```

## Acceptance criteria

- implementation explicitly references the GitHub repo URL above
- each clip can be processed for ball/hoop detections
- ball trajectory and hoop center are saved when available
- debug images or videos are generated
- detection failures include warnings instead of crashing
- results preserve link to the original command-history line
