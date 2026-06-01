# Stage 2 Phase 2 — Clip Extraction from Command History Timeline

## Goal

Use command-history timestamps to extract short video clips around shot events. This phase prepares clips for the open-source computer vision pipeline.

## Input

1. Parsed command-history timeline from Phase 1
2. Full game video
3. Clip settings

```json
{
  "tipoff_time_sec": 10,
  "clip_before_sec": 4,
  "clip_after_sec": 3
}
```
`tipoff_time_sec` is the time when the game starts
`clip_before_sec` is the time before the shot event
`clip_after_sec` is the time after the shot event

## Output

Clip manifest:

```json
{
  "game_id": "game_001",
  "source": "web_ui_command_history",
  "source_video": "game_001.mp4",
  "clips": [
    {
      "clip_id": "shot_000001",
      "event_id": "evt_000001",
      "raw_command": "+00:41 alden layup make wes",
      "elapsed_time_sec": 41,
      "video_timestamp": 51,
      "video_start_sec": 47,
      "video_end_sec": 54,
      "duration_sec": 7,
      "clip_path": "clips/shot_000001.mp4",
      "status": "planned"
    }
  ]
}
```

## Processing command

```bash
python scripts/stage2/extract_clips.py \
  --video game_001.mp4 \
  --timeline parsed_command_history.json \
  --output-dir clips \
  --tipoff 10 \
  --before 4 \
  --after 3
```

 parsed_command_history.json is the output file from Stage 2 Phase 1 

## Clip selection rules

- Default included events: `shot`
- Optional included events: `free_throw`

## UI route

```text
/games/:gameId/stage2/clips
```

## Acceptance criteria

- shot events are selected from command-history timeline
- free throws can be included or excluded
- clip windows are calculated correctly
- clips preserve link back to raw command history line
- clip manifest can be exported/imported
- extracted clips are ready for open-source CV processing
