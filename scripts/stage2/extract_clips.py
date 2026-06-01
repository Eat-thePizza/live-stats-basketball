#!/usr/bin/env python3
"""extract_clips.py — slice short clips from a full game video using
the Stage 2 Phase 1 command-history timeline.

Mirrors src/stage2/clipManifest.ts so manifests stay byte-equivalent across
the browser and CLI paths.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Optional


SOURCE = "web_ui_command_history"
DEFAULT_INCLUDED = {"shot"}
FT_INCLUDED = {"shot", "free_throw"}


def pad6(n: int) -> str:
    return f"{n:06d}"


def build_clips(events, settings) -> list[dict]:
    include = FT_INCLUDED if settings["include_free_throws"] else DEFAULT_INCLUDED
    tipoff = max(0, int(settings["tipoff_time_sec"]))
    before = max(0, int(settings["clip_before_sec"]))
    after = max(0, int(settings["clip_after_sec"]))
    clips: list[dict] = []
    n = 1
    for e in events:
        if e.get("event_type") not in include:
            continue
        elapsed = e.get("elapsed_sec")
        if elapsed is None:
            continue
        video_ts = tipoff + int(elapsed)
        start = max(0, video_ts - before)
        end = video_ts + after
        clip_id = f"shot_{pad6(n)}"
        n += 1
        clips.append(
            {
                "clip_id": clip_id,
                "event_id": e["event_id"],
                "raw_command": e["raw_command"],
                "elapsed_time_sec": int(elapsed),
                "video_timestamp": video_ts,
                "video_start_sec": start,
                "video_end_sec": end,
                "duration_sec": end - start,
                "clip_path": f"clips/{clip_id}.mp4",
                "status": "planned",
            }
        )
    return clips


def extract_one(
    video: Path, clip: dict, output_dir: Path
) -> tuple[str, Optional[str]]:
    """Returns (status, status_detail). status: extracted | failed."""
    out_path = output_dir / f"{clip['clip_id']}.mp4"
    cmd = [
        "ffmpeg",
        "-y",
        "-ss", str(clip["video_start_sec"]),
        "-to", str(clip["video_end_sec"]),
        "-i", str(video),
        "-c", "copy",
        str(out_path),
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, check=False)
    except FileNotFoundError:
        return "failed", "ffmpeg not on PATH"
    if proc.returncode == 0 and out_path.exists() and out_path.stat().st_size > 0:
        return "extracted", None
    detail = (proc.stderr or "").strip().splitlines()
    return "failed", detail[-1] if detail else "ffmpeg returned non-zero"


def main() -> int:
    p = argparse.ArgumentParser(description="Stage 2 Phase 2 clip extractor")
    p.add_argument("--video", required=True, help="Path to source video file")
    p.add_argument("--timeline", required=True, help="Phase 1 stage2 JSON")
    p.add_argument(
        "--output-dir", required=True, help="Where to write clips and manifest"
    )
    p.add_argument("--tipoff", type=int, required=True, help="tipoff_time_sec")
    p.add_argument("--before", type=int, required=True, help="clip_before_sec")
    p.add_argument("--after", type=int, required=True, help="clip_after_sec")
    p.add_argument(
        "--include-free-throws",
        action="store_true",
        help="include free_throw events as clips",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="write manifest only; do not call ffmpeg",
    )
    args = p.parse_args()

    timeline_path = Path(args.timeline)
    if not timeline_path.is_file():
        print(
            f"Error: timeline file not found: {timeline_path}", file=sys.stderr
        )
        return 1

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    with timeline_path.open() as f:
        timeline = json.load(f)

    settings = {
        "tipoff_time_sec": args.tipoff,
        "clip_before_sec": args.before,
        "clip_after_sec": args.after,
        "include_free_throws": bool(args.include_free_throws),
    }

    clips = build_clips(timeline.get("events", []), settings)

    video_path = Path(args.video)
    extracted = 0
    failed = 0
    skipped = 0
    for clip in clips:
        if args.dry_run:
            clip["status"] = "skipped"
            skipped += 1
            continue
        status, detail = extract_one(video_path, clip, output_dir)
        clip["status"] = status
        if detail:
            clip["status_detail"] = detail
        if status == "extracted":
            extracted += 1
        elif status == "failed":
            failed += 1
        else:
            skipped += 1

    manifest = {
        "game_id": timeline.get("game_id", ""),
        "source": SOURCE,
        "source_video": video_path.name,
        "settings": settings,
        "clips": clips,
    }
    manifest_path = output_dir / "clip_manifest.json"
    with manifest_path.open("w") as f:
        json.dump(manifest, f, indent=2)

    print("Stage 2 clip extraction summary")
    print(f"Timeline: {timeline_path}")
    print(f"Video:    {video_path}")
    print(f"Output:   {output_dir}")
    print(f"Manifest: {manifest_path}")
    print(f"Clips planned: {len(clips)}")
    print(f"  extracted: {extracted}")
    print(f"  failed:    {failed}")
    print(f"  skipped:   {skipped}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
