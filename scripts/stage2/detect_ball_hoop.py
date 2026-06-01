#!/usr/bin/env python3
"""detect_ball_hoop.py — Stage 2 Phase 3.

Adapts the open-source baseline:
https://github.com/avishah3/AI-Basketball-Shot-Detection-Tracker

Runs YOLOv8 ball + hoop detection over each clip in a Phase 2 manifest,
saves annotated keyframes, and emits ball_hoop_detections.json.
"""
from __future__ import annotations

import argparse
import sys
import urllib.request
from pathlib import Path

# Helpers live next to this script.
sys.path.insert(0, str(Path(__file__).parent))
import _ball_hoop_core as core  # noqa: E402

UPSTREAM = "https://github.com/avishah3/AI-Basketball-Shot-Detection-Tracker"
DEFAULT_MODEL_URL = (
    "https://raw.githubusercontent.com/avishah3/"
    "AI-Basketball-Shot-Detection-Tracker/master/best.pt"
)
# Label classification.
# The upstream avishah3 model uses class names "Basketball" and "Basketball Hoop".
# We classify hoop FIRST (because "Basketball Hoop" also contains "ball"),
# then fall through to ball. Substring hints are case-insensitive.
HOOP_LABEL_HINTS = ("hoop", "rim")
BALL_LABEL_HINTS = ("ball",)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description=(
            "Stage 2 Phase 3 ball/hoop detector. Adapts " + UPSTREAM
        ),
    )
    p.add_argument("--clip-manifest", required=True)
    p.add_argument("--model-path", default="models/basketball_yolo.pt")
    p.add_argument("--model-url", default=DEFAULT_MODEL_URL)
    p.add_argument("--output", required=True)
    p.add_argument("--debug-dir", default="debug")
    p.add_argument("--ball-conf", type=float, default=0.30)
    p.add_argument("--hoop-conf", type=float, default=0.40)
    p.add_argument("--iou", type=float, default=0.45)
    p.add_argument("--img-size", type=int, default=640)
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Skip inference; emit stub records (used by tests).",
    )
    return p.parse_args()


def ensure_model(path: Path, url: str):
    if path.is_file():
        return path
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with urllib.request.urlopen(url, timeout=60) as r:
            data = r.read()
        path.write_bytes(data)
        return path
    except Exception as e:  # noqa: BLE001
        print(f"warning: model download failed: {e}", file=sys.stderr)
        return None


def run_inference(
    clip: dict,
    model,
    cv2,
    args: argparse.Namespace,
    debug_dir: Path,
) -> dict:
    """Heavy path — only called when --dry-run is False."""
    clip_path = Path(clip["clip_path"])
    if not clip_path.is_file():
        return core.empty_failure_result(clip, f"clip not found: {clip_path}")

    cap = cv2.VideoCapture(str(clip_path))
    if not cap.isOpened():
        return core.empty_failure_result(clip, "cv2 could not open clip")

    ball_track: list[dict] = []
    hoop_dets: list[dict] = []
    total = 0
    frame_idx = 0
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            total += 1
            results = model.predict(
                source=frame,
                conf=min(args.ball_conf, args.hoop_conf),
                iou=args.iou,
                imgsz=args.img_size,
                verbose=False,
            )
            r = results[0]
            names = r.names if hasattr(r, "names") else {}
            if r.boxes is None:
                frame_idx += 1
                continue
            xyxy = r.boxes.xyxy.cpu().numpy()
            confs = r.boxes.conf.cpu().numpy()
            clss = r.boxes.cls.cpu().numpy().astype(int)
            for box, conf, cls in zip(xyxy, confs, clss):
                label = names.get(int(cls), str(cls)).lower()
                cx = int((box[0] + box[2]) / 2)
                cy = int((box[1] + box[3]) / 2)
                # Classify hoop first since "Basketball Hoop" contains "ball".
                if any(h in label for h in HOOP_LABEL_HINTS):
                    if conf >= args.hoop_conf:
                        hoop_dets.append(
                            {
                                "frame": frame_idx,
                                "x": cx,
                                "y": cy,
                                "confidence": float(conf),
                            }
                        )
                elif any(h in label for h in BALL_LABEL_HINTS):
                    if conf >= args.ball_conf:
                        ball_track.append(
                            {
                                "frame": frame_idx,
                                "x": cx,
                                "y": cy,
                                "confidence": round(float(conf), 3),
                            }
                        )
            frame_idx += 1
    finally:
        cap.release()

    ball_track.sort(key=lambda d: d["frame"])
    hoop_center = core.pick_hoop_center(hoop_dets)
    detected_count = len({d["frame"] for d in ball_track})
    usable = core.ball_usable(detected_count, total)

    warnings: list[str] = []
    if hoop_center is None:
        warnings.append("hoop never detected")
    if not usable:
        warnings.append(
            f"ball detection sparse: {detected_count}/{total} frames"
        )

    debug_path = debug_dir / clip["clip_id"]
    if ball_track:
        debug_path.mkdir(parents=True, exist_ok=True)
        cap2 = cv2.VideoCapture(str(clip_path))
        try:
            target_frames = set(core.select_debug_frames(ball_track))
            f = 0
            while target_frames and f <= max(target_frames):
                ok, frame = cap2.read()
                if not ok:
                    break
                if f in target_frames:
                    overlay = frame.copy()
                    for d in ball_track:
                        if d["frame"] != f:
                            continue
                        cv2.circle(overlay, (d["x"], d["y"]), 12, (0, 255, 0), 2)
                    if hoop_center is not None:
                        cv2.circle(overlay, hoop_center, 18, (0, 0, 255), 2)
                    cv2.imwrite(
                        str(debug_path / f"frame_{f:06d}.jpg"), overlay
                    )
                f += 1
        finally:
            cap2.release()

    return {
        "clip_id": clip["clip_id"],
        "event_id": clip.get("event_id", ""),
        "raw_command": clip.get("raw_command", ""),
        "clip_path": clip.get("clip_path", ""),
        "hoop_detected": hoop_center is not None,
        "hoop_center_xy": (
            {"x": hoop_center[0], "y": hoop_center[1]}
            if hoop_center is not None
            else None
        ),
        "ball_detected_frame_count": detected_count,
        "total_frame_count": total,
        "ball_track": ball_track,
        "ball_detection_usable": usable,
        "debug_video_path": str(debug_path) if ball_track else None,
        "warnings": warnings,
    }


def main() -> int:
    args = parse_args()

    manifest_path = Path(args.clip_manifest)
    if not manifest_path.is_file():
        print(
            f"Error: clip manifest not found: {manifest_path}",
            file=sys.stderr,
        )
        return 1
    manifest = core.load_manifest(manifest_path)
    clips = manifest.get("clips", [])

    debug_dir = Path(args.debug_dir)
    debug_dir.mkdir(parents=True, exist_ok=True)

    print(
        "Stage 2 Phase 3 — adapting "
        "https://github.com/avishah3/AI-Basketball-Shot-Detection-Tracker"
    )
    print(f"Manifest: {manifest_path}")
    print(f"Clips:    {len(clips)}")

    results: list[dict] = []
    if args.dry_run:
        for clip in clips:
            results.append(core.stub_result(clip))
    else:
        try:
            import cv2  # type: ignore
            from ultralytics import YOLO  # type: ignore
        except ImportError as e:
            print(
                f"Error: missing CV/ML deps ({e}). "
                "Install via `pip install -r scripts/stage2/requirements.txt` "
                "or pass --dry-run.",
                file=sys.stderr,
            )
            return 2

        model_path = Path(args.model_path)
        loaded = ensure_model(model_path, args.model_url)
        if loaded is None:
            print(
                f"Error: model not available at {model_path}; "
                "pass --model-url or download manually.",
                file=sys.stderr,
            )
            return 2

        model = YOLO(str(loaded))
        try:
            from tqdm import tqdm  # type: ignore

            iterator = tqdm(clips, desc="clips")
        except ImportError:
            iterator = clips

        for clip in iterator:
            try:
                results.append(
                    run_inference(clip, model, cv2, args, debug_dir),
                )
            except Exception as e:  # noqa: BLE001
                results.append(core.empty_failure_result(clip, str(e)))

    payload = {
        "game_id": manifest.get("game_id", ""),
        "source_manifest": str(manifest_path),
        "model_path": args.model_path,
        "settings": {
            "ball_conf": args.ball_conf,
            "hoop_conf": args.hoop_conf,
            "iou": args.iou,
            "img_size": args.img_size,
        },
        "results": results,
    }
    core.write_results(args.output, payload)

    print(f"Output:   {args.output}")
    print(f"Results:  {len(results)}")
    failed = sum(
        1
        for r in results
        if r["warnings"] and r["warnings"][0].startswith("clip failed")
    )
    if failed:
        print(f"  failed: {failed}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
