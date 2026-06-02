import cv2
import json
import sys
import torch
import intel_extension_for_pytorch as ipex
from ultralytics import YOLO

from homographyEstimation import TacticalViewConverter, filter_tracked_objects

# ── Config ────────────────────────────────────────────────────────────────────
jsoninfo        = "game_20260519_valley_christian.json"
film            = "SFHS VCHS Testing.mp4"
model_path      = "pmodel 621141.pt"
court_keypoints = "court_keypoint_detector.pt"
PRE_ROLL        = 3.0   # max seconds before shot timestamp to search backwards from
SHOT_OFFSET     = 0.3   # seconds before the timestamp to begin the backwards scan
FALLBACK_OFFSET = 1.5   # seconds before shot timestamp to use as fallback frame

# YOLO class indices
CLASS_BALL   = 0
CLASS_PLAYER = 2
# ─────────────────────────────────────────────────────────────────────────────


def load_model(path: str):
    """Load the YOLO model and move it to Intel XPU via IPEX."""
    model = YOLO(path)
    model.model = model.model.to(torch.device("xpu"))
    model.model = ipex.optimize(model.model)
    return model


def parse_timestamp(ts: str) -> float:
    """Convert '+MM:SS' to seconds (float)."""
    ts = ts.lstrip("+")
    parts = ts.split(":")
    if len(parts) != 2:
        raise ValueError(f"Unexpected timestamp format: '{ts}'  (expected +MM:SS)")
    minutes, seconds = parts
    return int(minutes) * 60 + int(seconds)


def is_field_goal(raw_command: str) -> bool:
    """
    Return True if the command describes a made or missed FIELD GOAL.
    Rules:
      - Must contain 'make' or 'miss' (case-insensitive)
      - The third token must NOT be a free-throw indicator (ft / FT etc.)
    """
    lower = raw_command.lower()
    has_result = "make" in lower or "miss" in lower

    tokens = raw_command.split()
    if len(tokens) < 2:
        return False

    is_free_throw = False
    if len(tokens) >= 3:
        shot_type = tokens[2].lower()
        is_free_throw = shot_type == "ft"

    return has_result and not is_free_throw


def iou(box1, box2) -> float:
    """Compute IoU between two (x1, y1, x2, y2) boxes."""
    xi1 = max(box1[0], box2[0])
    yi1 = max(box1[1], box2[1])
    xi2 = min(box1[2], box2[2])
    yi2 = min(box1[3], box2[3])

    inter = max(0, xi2 - xi1) * max(0, yi2 - yi1)
    area1 = (box1[2] - box1[0]) * (box1[3] - box1[1])
    area2 = (box2[2] - box2[0]) * (box2[3] - box2[1])

    return inter / (area1 + area2 - inter + 1e-6)


def run_yolo(model: YOLO, frame):
    """
    Run YOLO on a single frame. Returns (ball_boxes, player_boxes).
    Boxes are lists of [x1, y1, x2, y2].

    Filtering rules:
      Ball   — keep only the single highest-confidence detection (any conf)
      Player — confidence >= PLAYER_CONF_THRESHOLD, capped at MAX_PLAYERS
    """
    PLAYER_CONF_THRESHOLD = 0.2
    MAX_PLAYERS           = 12

    results = model(frame, verbose=False)

    ball_candidates   = []   # (conf, xyxy)
    player_boxes      = []   # xyxy, already filtered
    hoop_boxes        = []

    for result in results:
        if result.boxes is None:
            continue
        for box in result.boxes:
            cls  = int(box.cls[0])
            conf = float(box.conf[0])
            xyxy = box.xyxy[0].tolist()

            if cls == CLASS_BALL:
                ball_candidates.append((conf, xyxy))

            elif cls == CLASS_PLAYER:
                if conf >= PLAYER_CONF_THRESHOLD:
                    player_boxes.append((conf, xyxy))
            
            elif cls == 1:
                hoop_boxes.append((conf, xyxy))

    # Ball: keep only the single highest-confidence detection
    ball_boxes = []
    if ball_candidates:
        best_ball = max(ball_candidates, key=lambda x: x[0])
        ball_boxes = [best_ball[1]]
        #print(f"    Ball detected — conf={best_ball[0]:.3f}  "
              #f"({len(ball_candidates)} candidate(s) before filter)")

    # Players: sort by confidence descending, cap at MAX_PLAYERS
    player_boxes.sort(key=lambda x: x[0], reverse=True)
    player_boxes = [xyxy for _, xyxy in player_boxes[:MAX_PLAYERS]]
    #print(f"    Players kept: {len(player_boxes)}  "
          #f"(conf >= {PLAYER_CONF_THRESHOLD}, cap={MAX_PLAYERS})")
    
    hoop_boxes = [xyxy for _, xyxy in hoop_boxes]

    return ball_boxes, player_boxes, hoop_boxes


def annotate_frame(frame, ball_boxes, player_boxes, hoop_boxes, iou_scores: list, frame_number: int, label: str = ""):
    """
    Draw boxes and IoU overlays onto frame in-place. Returns the frame.
    iou_scores is a list of (p_idx, b_idx, score) tuples.
    """
    for xyxy in ball_boxes:
        x1, y1, x2, y2 = map(int, xyxy)
        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
        cv2.putText(frame, "ball", (x1, y1 - 4),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)

    i = 0
    for xyxy in player_boxes:
        x1, y1, x2, y2 = map(int, xyxy)
        cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 100, 0), 2)
        cv2.putText(frame, f"player {i}", (x1, y1 - 4),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 100, 0), 1)
        i+=1
    
    for xyxy in hoop_boxes:
        x1, y1, x2, y2 = map(int, xyxy)
        cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 0, 255), 2)
        cv2.putText(frame, "HOOP", (x1, y1 - 4),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 255), 1)
    
    """
    overlay_y = 20
    for p_idx, b_idx, score in iou_scores:
        text = f"P{p_idx}<->B{b_idx} IoU:{score:.3f}"
        cv2.putText(frame, text, (10, overlay_y),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 255), 2)
        overlay_y += 22

    if label:
        cv2.putText(frame, label, (10, overlay_y + 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
    """

    return frame


def find_best_frame(cap: cv2.VideoCapture, model: YOLO, shot_sec: float,
                    pre_roll: float = PRE_ROLL,
                    shot_offset: float = SHOT_OFFSET,
                    fallback_offset: float = FALLBACK_OFFSET):
    """
    Scan backwards from (shot_sec - shot_offset) to find the last moment
    the ball was clearly overlapping a player (i.e. being held before release).

    Strategy:
      1. Collect all frames in [shot_sec - pre_roll, shot_sec - shot_offset],
         running YOLO on each.
      2. Slide a window backwards from the scan end frame.
         A window is "confirmed" if at least MAJORITY_NEED frames within it
         have the ball detected AND max player-ball IoU > IOU_THRESHOLD.
         Frames with no ball detection are ignored when counting.
      3. Return the earliest frame of the first confirmed window (scanning back).
      4. Fallback: if no confirmed window is found, return the frame nearest
         to (shot_sec - fallback_offset) that had any ball detection.

    Returns (annotated_frame, frame_number, found_confirmed, raw_frame)
    """
    IOU_THRESHOLD = 0.03   # tunable — low enough to catch partial overlaps on small ball boxes
    WINDOW_SIZE   = 3
    MAJORITY_NEED = 2

    fps         = cap.get(cv2.CAP_PROP_FPS) or 30.0
    start_sec   = max(0.0, shot_sec - pre_roll)
    start_frame = int(start_sec * fps)
    end_frame   = int((shot_sec - shot_offset) * fps)

    # ── Pass 1: collect YOLO results for every frame in the window ────────────
    print(f"  Scanning frames {start_frame}→{end_frame} "
          f"({start_sec:.1f}s → {shot_sec - shot_offset:.1f}s, backwards search)...")
    cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)

    # frame_number → {frame, ball_boxes, player_boxes, iou_scores, max_iou}
    # max_iou == None means ball was not detected this frame
    frame_data = {}

    for fn in range(start_frame, end_frame + 1):
        ret, frame = cap.read()
        if not ret:
            break

        ball_boxes, player_boxes, hoop_boxes = run_yolo(model, frame)

        iou_scores = []
        for p_idx, p_box in enumerate(player_boxes):
            for b_idx, b_box in enumerate(ball_boxes):
                score = iou(p_box, b_box)
                iou_scores.append((p_idx, b_idx, score))
                if score > 0:
                    print(f"  Frame {fn:6d}: player[{p_idx}] ↔ ball[{b_idx}]  IoU = {score:.4f}")

        # None if no ball detected; otherwise the highest IoU in this frame
        max_iou_this_frame = max((s for _, _, s in iou_scores), default=None) if ball_boxes else None

        frame_data[fn] = {
            "frame":        frame.copy(),
            "ball_boxes":   ball_boxes,
            "player_boxes": player_boxes,
            "hoop_boxes":   hoop_boxes,
            "iou_scores":   iou_scores,
            "max_iou":      max_iou_this_frame,
        }

    if not frame_data:
        print("  No frames read.")
        return None, start_frame, False, None

    all_frames = sorted(frame_data.keys())  # ascending

    # ── Pass 2: slide window backwards from end_frame ─────────────────────────
    confirmed_window_start = None

    for window_end in range(end_frame, start_frame + WINDOW_SIZE - 2, -1):
        window = [fn for fn in range(window_end - WINDOW_SIZE + 1, window_end + 1)
                  if fn in frame_data]

        # Frames in this window where the ball was actually visible
        visible = [fn for fn in window if frame_data[fn]["max_iou"] is not None]

        if len(visible) < MAJORITY_NEED:
            # Not enough ball-visible frames in this window to confirm anything
            continue

        # Of those visible frames, how many exceed the IoU threshold?
        high_iou_count = sum(
            1 for fn in visible
            if frame_data[fn]["max_iou"] > IOU_THRESHOLD
        )

        if high_iou_count >= MAJORITY_NEED:
            confirmed_window_start = window_end - WINDOW_SIZE + 1
            print(f"  ✓ Confirmed window: frames {confirmed_window_start}–{window_end} "
                  f"({high_iou_count}/{len(visible)} visible frames above IoU={IOU_THRESHOLD})")
            break

    # ── Pick the return frame ─────────────────────────────────────────────────
    if confirmed_window_start is not None:
        target_fn       = confirmed_window_start
        found_confirmed = True
    else:
        # Fallback: frame nearest to (shot_sec - fallback_offset) with any ball detection
        fallback_target = int((shot_sec - fallback_offset) * fps)
        print(f"  ⚠ No confirmed window found. "
              f"Falling back to frame nearest {shot_sec - fallback_offset:.1f}s "
              f"(shot - {fallback_offset}s) with ball detection.")
        ball_frames = [fn for fn in all_frames if frame_data[fn]["max_iou"] is not None]
        if not ball_frames:
            print("  ⚠ Ball never detected in this clip.")
            return None, start_frame, False, None
        target_fn       = min(ball_frames, key=lambda fn: abs(fn - fallback_target))
        found_confirmed = False

    d         = frame_data[target_fn]
    annotated = annotate_frame(
        d["frame"].copy(),
        d["ball_boxes"],
        d["player_boxes"],
        d["hoop_boxes"], 
        d["iou_scores"],
        target_fn,
        label="" if found_confirmed else f"Fallback (nearest to -{fallback_offset}s)"
    )

    status = "confirmed overlap" if found_confirmed else "fallback"
    print(f"  Returning frame {target_fn} [{status}]  max_iou={d['max_iou']}")

    iou_list = frame_data[target_fn]["iou_scores"]
    ply_idx = 0
    max_iou = 0
    for p_idx, b_idx, score in iou_list:
        if score > max_iou:
            ply_idx = p_idx
            max_iou = score

    return annotated, target_fn, found_confirmed, d["frame"], ply_idx


def show_frame_and_wait(frame, window_name: str) -> bool:
    """
    Display a single frozen frame. SPACE advances, Q quits.
    Returns False if user pressed Q.
    """
    cv2.imshow(window_name, frame)
    while True:
        key = cv2.waitKey(0) & 0xFF
        if key == ord("q") or key == ord("Q"):
            return False
        if key == ord(" "):
            return True

shotChart = cv2.imread("court_board.jpg")
def getShots(json_path: str, film_path: str, tipoff_seconds: float):
    """
    Main function.

    Parameters
    ----------
    json_path       : path to the JSON file
    film_path       : path to the video file
    tipoff_seconds  : position in the video (in seconds) of the very first tipoff
    """
    # ── Load YOLO models ──────────────────────────────────────────────────────
    print("Loading YOLO models...")
    model  = load_model(model_path)
    model2 = load_model(court_keypoints)
    print("Models loaded.\n")

    # ── Load JSON ─────────────────────────────────────────────────────────────
    with open(json_path, "r") as f:
        data = json.load(f)

    if isinstance(data, list):
        commands = data
    elif isinstance(data, dict):
        for key in ("commands", "plays", "events", "data"):
            if key in data and isinstance(data[key], list):
                commands = data[key]
                break
        else:
            lists = [v for v in data.values() if isinstance(v, list)]
            if not lists:
                raise ValueError("Could not find a command list in the JSON file.")
            commands = lists[0]
    else:
        raise ValueError("Unexpected JSON structure.")

    # ── Collect field-goal shots ──────────────────────────────────────────────
    shots = []
    for entry in commands:
        raw = entry.get("raw_command", "")
        tokens = raw.split()
        if not tokens:
            continue
        ts_token = tokens[0]
        if not ts_token.startswith("+"):
            continue
        if not is_field_goal(raw):
            continue
        try:
            offset = parse_timestamp(ts_token)
        except ValueError as e:
            print(f"[WARN] Skipping entry — {e}")
            continue
        video_time = tipoff_seconds + offset
        shots.append((video_time, raw, tokens[3].lower()))

    if not shots:
        print("No field-goal shots found in the JSON.")
        return

    print(f"Found {len(shots)} field-goal shot(s).  SPACE = next shot  |  Q = quit\n")

    # ── Open video ────────────────────────────────────────────────────────────
    cap = cv2.VideoCapture(film_path)
    if not cap.isOpened():
        print(f"[ERROR] Could not open video: {film_path}")
        return

    window_name = "Shot Clip"
    cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)

    for idx, (shot_time, raw, make_miss) in enumerate(shots, start=1):
        print(f"\n[{idx}/{len(shots)}]  {raw}  →  searching backwards from {shot_time:.1f}s")
        print("-" * 60)

        annotated_frame, frame_num, found_confirmed, frame, p_idx = find_best_frame(cap, model, shot_time)

        if annotated_frame is None:
            print("  Skipping — no ball detected in clip.")
            continue

        status = "confirmed overlap" if found_confirmed else f"fallback (nearest -{FALLBACK_OFFSET}s)"
        print(f"  Displaying frame {frame_num} [{status}]  — SPACE to continue, Q to quit")

        mapper      = TacticalViewConverter("court_board.jpg")
        kps_results = model2(frame, verbose=True)
        ply_results = model(frame, verbose=True)

        last_H, last_good_indices, last_keypoint_list = mapper.compute_homography(kps_results)

        last_player_boxes, last_player_confs, last_player_ids = filter_tracked_objects(
            ply_results, class_id=CLASS_PLAYER, max_objects=10
        )
        last_ball_boxes, last_ball_confs, last_ball_ids = filter_tracked_objects(
            ply_results, class_id=CLASS_BALL, max_objects=1
        )


        last_player_points = mapper.map_centers_from_boxes(last_player_boxes, last_H)
        last_ball_points   = mapper.map_centers_from_boxes(last_ball_boxes,   last_H)

        team_assignments = mapper.assign_teams(frame, last_player_boxes)
        tactical_frame = mapper.draw_tactical(last_player_points, last_ball_points,
                                      last_good_indices, team_assignments)

        th, tw = tactical_frame.shape[:2]
        annotated_frame[0:th, 0:tw] = tactical_frame

        shot_coordinates = last_player_points[p_idx]
        if "mis" in make_miss:
            cv2.circle(shotChart,(int(shot_coordinates[0]),int(shot_coordinates[1])),4,(25,25,255),-1)
        else:
            cv2.circle(shotChart,(int(shot_coordinates[0]),int(shot_coordinates[1])),4,(25,255,25),-1)

        keep_going = show_frame_and_wait(annotated_frame, window_name)
        if not keep_going:
            print("Quit by user.")
            cv2.imwrite("shotChartTesting.jpg",shotChart)
            break

    cap.release()
    cv2.destroyAllWindows()
    print("\nDone.")


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    tipoff = float(sys.argv[1]) if len(sys.argv) > 1 else 0.0
    getShots(jsoninfo, film, tipoff)