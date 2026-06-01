"""Pure helpers for detect_ball_hoop.py.

No torch/opencv imports here so unit tests run in a slim environment.
"""
from __future__ import annotations

import json
import statistics
from pathlib import Path
from typing import Optional, Union


def load_manifest(path: Union[Path, str]) -> dict:
    p = Path(path)
    with p.open() as f:
        return json.load(f)


def write_results(out_path: Union[Path, str], payload: dict) -> None:
    p = Path(out_path)
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("w") as f:
        json.dump(payload, f, indent=2)


def ball_usable(detected: int, total: int) -> bool:
    if total <= 0:
        return False
    threshold = max(5, int(total * 0.05))
    return detected >= threshold


def pick_hoop_center(
    detections: list[dict],
) -> Optional[tuple[int, int]]:
    """Median (x, y) of the highest-confidence hoop detection per frame."""
    if not detections:
        return None
    by_frame: dict[int, dict] = {}
    for d in detections:
        f = d["frame"]
        prev = by_frame.get(f)
        if prev is None or d["confidence"] > prev["confidence"]:
            by_frame[f] = d
    xs = [d["x"] for d in by_frame.values()]
    ys = [d["y"] for d in by_frame.values()]
    return int(statistics.median(xs)), int(statistics.median(ys))


def select_debug_frames(ball_track: list[dict]) -> list[int]:
    if not ball_track:
        return []
    first = ball_track[0]["frame"]
    last = ball_track[-1]["frame"]
    peak = max(ball_track, key=lambda d: d["confidence"])["frame"]
    out: list[int] = []
    for f in (first, peak, last):
        if f not in out:
            out.append(f)
    return out


def stub_result(clip: dict) -> dict:
    return {
        "clip_id": clip["clip_id"],
        "event_id": clip.get("event_id", ""),
        "raw_command": clip.get("raw_command", ""),
        "clip_path": clip.get("clip_path", ""),
        "hoop_detected": False,
        "hoop_center_xy": None,
        "ball_detected_frame_count": 0,
        "total_frame_count": 0,
        "ball_track": [],
        "ball_detection_usable": False,
        "debug_video_path": None,
        "warnings": ["dry-run: inference skipped"],
    }


def empty_failure_result(clip: dict, message: str) -> dict:
    return {
        "clip_id": clip["clip_id"],
        "event_id": clip.get("event_id", ""),
        "raw_command": clip.get("raw_command", ""),
        "clip_path": clip.get("clip_path", ""),
        "hoop_detected": False,
        "hoop_center_xy": None,
        "ball_detected_frame_count": 0,
        "total_frame_count": 0,
        "ball_track": [],
        "ball_detection_usable": False,
        "debug_video_path": None,
        "warnings": [f"clip failed: {message}"],
    }
