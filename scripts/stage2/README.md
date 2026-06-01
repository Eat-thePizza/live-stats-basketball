# Stage 2 Python tooling

Open-source ball/hoop detection adapts:
https://github.com/avishah3/AI-Basketball-Shot-Detection-Tracker

## One-time setup

```bash
python3 -m venv .venv-stage2
source .venv-stage2/bin/activate
pip install -r scripts/stage2/requirements.txt
```

## Phase 2 — Clip extraction (no ML deps; needs system ffmpeg)

```bash
python scripts/stage2/extract_clips.py \
  --video /path/to/game.mp4 \
  --timeline game_<id>.json \
  --output-dir clips \
  --tipoff 10 --before 4 --after 3
```

## Phase 3 — Ball + hoop detection

```bash
python scripts/stage2/detect_ball_hoop.py \
  --clip-manifest clips/clip_manifest.json \
  --model-path models/basketball_yolo.pt \
  --output ball_hoop_detections.json \
  --debug-dir debug
```

If `--model-path` does not exist, the script attempts to download from
`--model-url` (default points to the upstream release). Pass `--dry-run`
to skip inference and emit placeholder records (used by tests).

### Notes

- `debug_video_path` in the output JSON is a **directory** of annotated
  still frames (`debug/<clip_id>/frame_NNNNNN.jpg`), not an `.mp4`. The
  field name is preserved for forward-compat with future phases.
- Per-clip exceptions never crash the CLI — they are recorded as
  `warnings: ["clip failed: <message>"]` and the run continues.
- The CLI exits non-zero only when the clip manifest itself cannot be
  read (exit 1) or the model is unavailable in non-dry-run mode (exit 2).
