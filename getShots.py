import cv2
import json
import sys
import torch
import intel_extension_for_pytorch as ipex
from ultralytics import YOLO
import time

from homographyEstimation import TacticalViewConverter, filter_tracked_objects

# ── Config ────────────────────────────────────────────────────────────────────
# Directories
jsoninfo        = "game_20260519_valley_christian.json"
film            = "SFHS VCHS Testing.mp4"
model_path      = "pmodel 63-1138a.pt"
court_keypoints = "court_keypoint_detector.pt"
court_image     = "2D_HS_Court.jpg"
shot_chart_name = "shotChartTesting.jpg"

#Timing Information Adjustments
PRE_ROLL        = [2.8,3.1,3.4]   # max seconds before shot timestamp to search backwards from
SHOT_OFFSET     = [0.2,0.5,1.2]   # seconds before the timestamp to begin the backwards scan
FALLBACK_OFFSET = [1.6,2.0,2.5]   # seconds before shot timestamp to use as fallback frame

# YOLO class indices
CLASS_BALL   = 0
CLASS_HOOP   = 1
CLASS_PLAYER = 2
CLASS_REF    = 3

# Time Data
frame_time = []
homography_time = []
total_time = []
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


def intersection(pbox, bbox) -> float:
    """Compute intersection between two (x1, y1, x2, y2) boxes."""
    bx1, by1, bx2, by2 = bbox
    px1, py1, px2, py2 = pbox

    ball_area = (by2-by1) * (bx2-bx1)

    inter_x = min(px2,bx2) - max(px1,bx1)
    inter_y = min(py2,by2) - max(py1,by1)
    if inter_x > 0 and inter_y > 0:
        intersection_area = inter_x * inter_y
    else:
        intersection_area = 0

    return intersection_area / ball_area


def run_yolo(model: YOLO, frame):
    """
    Run YOLO on a single frame. Returns (ball_boxes, player_boxes).
    Boxes are lists of [x1, y1, x2, y2].

    Filtering rules:
      Ball   — keep only the single highest-confidence detection (any conf)
      Player — confidence >= PLAYER_CONF_THRESHOLD, capped at MAX_PLAYERS
    """
    PLAYER_CONF_THRESHOLD = 0.2
    MAX_PLAYERS           = 15

    results = model(frame, verbose=False)

    ball_candidates   = []   # (conf, xyxy)
    player_boxes      = []   # xyxy, already filtered
    hoop_boxes        = []

    player_conf = []

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
            
            elif cls == CLASS_HOOP:
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
    #print(f"    Players kept: {len(player_boxes)}  "
          #f"(conf >= {PLAYER_CONF_THRESHOLD}, cap={MAX_PLAYERS})")
    
    if hoop_boxes:
        best_hoop = max(hoop_boxes, key=lambda x: x[0])
        hoop_boxes = [best_hoop[1]]

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
    for player_conf,xyxy in player_boxes:
        x1, y1, x2, y2 = map(int, xyxy)
        cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 100, 0), 2)
        #cv2.putText(frame, f"{i}", (int((x1+x2)/2), y1 - 5),
        #    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 0), 2)
        cv2.putText(frame, f"{i} C {round(player_conf,2)}", (int((x1+x2)/2) - 15, y1 - 5),
            cv2.FONT_HERSHEY_SIMPLEX, 1, (250, 250, 250), 2)
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
                    pre_roll: float = PRE_ROLL[2],
                    shot_offset: float = SHOT_OFFSET[0],
                    fallback_offset: float = FALLBACK_OFFSET[1],
                    verbose=False):
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
    CONTAINMENT_MIN = 0.25
    CONTAINMENT_MAX = 0.85
    MIN_NEEDED = 1

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

        ball_boxes, player_boxes_conf, hoop_boxes = run_yolo(model, frame)
        player_boxes = [xyxy for _, xyxy in player_boxes_conf]

        iou_scores = []
        for p_idx, p_box in enumerate(player_boxes):
            for b_idx, b_box in enumerate(ball_boxes):
                score = intersection(p_box, b_box)
                iou_scores.append((p_idx, b_idx, score))
                if score > 0 and verbose:
                    print(f"  Frame {fn:6d}: player[{p_idx}] ↔ ball[{b_idx}]  Overlap = {score:.4f}")
        
        if verbose:
            temp = annotate_frame(frame.copy(),ball_boxes,player_boxes_conf,hoop_boxes, iou_scores,fn)
            cv2.namedWindow("Frame Testing", cv2.WINDOW_NORMAL)
            cv2.resizeWindow("Frame Testing", 960, 540)
            show_frame_and_wait(temp,"Frame Testing",delay=10)
        

        frame_data[fn] = {
            "frame":        frame.copy(),
            "ball_boxes":   ball_boxes,
            "player_boxes": player_boxes_conf,
            "hoop_boxes":   hoop_boxes,
            "containment_scores":   iou_scores,
        }

    if not frame_data:
        if verbose:
            print("  No frames read.")
        return None, start_frame, False, None
    #cv2.destroyWindow("Frame Testing")

    all_frames = sorted(frame_data.keys())  # ascending

    # ── Pass 2: slide window backwards from end_frame ─────────────────────────
    confirmed_window_start = None

    num_frames = 0
    frame_nums = []
    for fn in range(end_frame, start_frame - 1, -1):
        if fn not in frame_data:
            continue
        
        scores = frame_data[fn]["containment_scores"]
        if not scores:
            continue
        
        for p_idx,b_idx,score in scores:
            if CONTAINMENT_MIN < score < CONTAINMENT_MAX:
                num_frames += 1
                frame_nums.append(fn)
    
    #print(frame_nums)
    if len(frame_nums) >= MIN_NEEDED:
        confirmed_window_start = frame_nums[len(frame_nums)//4]

    # ── Pick the return frame ─────────────────────────────────────────────────
    if confirmed_window_start is not None:
        target_fn       = confirmed_window_start
        found_confirmed = True
    else:
        # Fallback: frame nearest to (shot_sec - fallback_offset) with any ball detection
        fallback_target = int((shot_sec - fallback_offset) * fps)
        if verbose:
            print(f"  ⚠ No confirmed window found. "
                f"Falling back to frame nearest {shot_sec - fallback_offset:.1f}s "
                f"(shot - {fallback_offset}s) with ball detection.")
        target_fn = fallback_target
        found_confirmed = False

    d = frame_data[target_fn]
    annotated = annotate_frame(
        d["frame"].copy(),
        d["ball_boxes"],
        d["player_boxes"],
        d["hoop_boxes"], 
        d["containment_scores"],
        target_fn,
        label="" if found_confirmed else f"Fallback (nearest to -{fallback_offset}s)"
    )

    if verbose:
        status = "confirmed overlap" if found_confirmed else "fallback"
        print(f"  Returning frame {target_fn} [{status}]")

    iou_list = frame_data[target_fn]["containment_scores"]
    ply_idx = 0
    max_iou = 0
    for p_idx, b_idx, score in iou_list:
        if score > max_iou and score < CONTAINMENT_MAX:
            ply_idx = p_idx
            max_iou = score
    if verbose:
        print(f"Locking shot to player index {ply_idx} who has a containment of {max_iou}")

    return annotated, target_fn, found_confirmed, d["frame"], ply_idx


def show_frame_and_wait(frame, window_name: str, delay=0) -> bool:
    """
    Display a single frozen frame. SPACE advances, Q quits.
    Returns False if user pressed Q.
    """
    cv2.imshow(window_name, frame)
    if delay != 0:
        cv2.waitKey(delay)
    else:
        while True:
            key = cv2.waitKey(0) & 0xFF
            if key == ord("q") or key == ord("Q"):
                return False
            if key == ord(" "):
                return True

shotChart = cv2.imread(court_image)
num_shots_frame = 0
def getShots(json_path: str, film_path: str, tipoff_seconds: float, show_frames: bool):
    global num_shots_frame
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
        shots.append((video_time, tokens[2].lower(), tokens[3].lower()))

    if not shots:
        print("No field-goal shots found in the JSON.")
        return

    print(f"Found {len(shots)} field-goal shot(s).  SPACE = next shot  |  Q = quit\n")
    num_shots_frame = len(shots)

    # ── Open video ────────────────────────────────────────────────────────────
    cap = cv2.VideoCapture(film_path)
    if not cap.isOpened():
        print(f"[ERROR] Could not open video: {film_path}")
        return
    
    if show_frames:
        window_name = "Shot Clip"
        cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)

    TESTING_FRAME_SET = []

    for idx, (shot_time, shot_type, make_miss) in enumerate(shots, start=1):
        total_start_time = time.perf_counter()

        if TESTING_FRAME_SET != [] and idx not in TESTING_FRAME_SET:
            continue
        
        print(f"\n[{idx}/{len(shots)}]  {raw}  →  searching backwards from {shot_time:.1f}s")
        print("-" * 60)

        if "lay" in shot_type:
            shot_idx = 0
        elif "thre" in shot_type:
            shot_idx = 2
        else:
            shot_idx = 1

        frame_start_time = time.perf_counter()
        annotated_frame, frame_num, found_confirmed, frame, p_idx = find_best_frame(cap, model, shot_time,
                                                                                    pre_roll=PRE_ROLL[shot_idx],
                                                                                    shot_offset=SHOT_OFFSET[shot_idx],
                                                                                    fallback_offset=FALLBACK_OFFSET[shot_idx],
                                                                                    verbose=show_frames)
        frame_end_time = time.perf_counter()
        frame_time.append(round(frame_end_time-frame_start_time,3))

        if annotated_frame is None:
            continue
        
        if show_frames:
            status = "confirmed overlap" if found_confirmed else f"fallback (nearest -{FALLBACK_OFFSET}s)"
            print(f"  Displaying frame {frame_num} [{status}]  — SPACE to continue, Q to quit")

        homography_start_time = time.perf_counter()
        mapper      = TacticalViewConverter(court_image)
        kps_results = model2(frame, verbose=True)
        ply_results = model(frame, verbose=True)

        last_H, last_good_indices, last_keypoint_list = mapper.compute_homography(kps_results)

        last_player_boxes, last_player_confs, last_player_ids = filter_tracked_objects(
            ply_results, class_id=CLASS_PLAYER, max_objects=15
        )
        last_ball_boxes, last_ball_confs, last_ball_ids = filter_tracked_objects(
            ply_results, class_id=CLASS_BALL, max_objects=1
        )

        last_player_points = mapper.map_centers_from_boxes(last_player_boxes, last_H)
        #last_ball_points  = mapper.map_centers_from_boxes(last_ball_boxes,   last_H)

        if show_frames:
            team_assignments = mapper.assign_teams(frame, last_player_boxes)
            tactical_frame = mapper.draw_tactical(last_player_points, [],
                                        last_good_indices, team_assignments)
            
            tactical_frame = cv2.resize(tactical_frame, (501,300))
            th, tw = tactical_frame.shape[:2]
            annotated_frame[0:th, 0:tw] = tactical_frame

        shot_coordinates = last_player_points[p_idx]
        shot_coordinates[0] = max(shot_coordinates[0],23)
        shot_coordinates[0] = min(shot_coordinates[0],812)
        shot_coordinates[1] = max(shot_coordinates[1],19)
        shot_coordinates[1] = min(shot_coordinates[1],481)

        side, shot_type, dist = getShotInfo(shot_coordinates)
        print(side, shot_type, dist)

        if "mis" in make_miss:
            cv2.circle(shotChart,(int(shot_coordinates[0]),int(shot_coordinates[1])),7,(75,75,250),2)
        else:
            cv2.circle(shotChart,(int(shot_coordinates[0]),int(shot_coordinates[1])),7,(75,250,75),-1)

        homography_end_time = time.perf_counter()
        homography_time.append(round(homography_end_time-homography_start_time,3))

        if show_frames:
            keep_going = show_frame_and_wait(annotated_frame, window_name)
            if not keep_going:
                print("Quit by user.")
                break
        
        total_end_time = time.perf_counter()
        total_time.append(round(total_end_time-total_start_time,3))

    cv2.imwrite(shot_chart_name,shotChart)

    cap.release()
    cv2.destroyAllWindows()
    print("Shot Chart Created!")

def getShotInfo(shot_coordinates): # Output: Shot Location Text; Distance From Hoop; 
    x,y = shot_coordinates
    if x <= 417: #Left Side
        side = "Left"
        distance = ( (x-53)**2 + (y-245) ** 2 ) ** 0.5
        distance = round(distance * (1/11), 1) #dist in ft
        if 11 <= y < 182: #Right Corner OR Right Wing
            if 11 <= x <= 104:
                shot_type = "Right Corner"
            elif 104 < x <= 417:
                shot_type = "Right Wing"
        elif 182 <= y <= 314: #Rim Shots, Paint, or Top
            if 11 <= x <= 104:
                shot_type = "Rim"
            elif 104 < x <= 147:
                shot_type = "Paint"
            elif 147 < x <= 417:
                shot_type = "Top"
        elif 314 < y <= 489: #Left Corner or Left Wing
            if 11 <= x <= 104:
                shot_type = "Left Corner"
            elif 104 < x <= 417:
                shot_type = "Left Wing"

    else: #Right Side
        side = "Right"
        distance = ( (x-786)**2 + (y-245) ** 2 ) ** 0.5
        distance = round(distance * (1/11), 1) #dist in ft
        if 11 <= y < 182: #Left Corner or Wing
            if 731 <= x <= 824: #93
                shot_type = "Left Corner"
            elif 417 <= x < 731:
                shot_type = "Left Wing"
        elif 182 <= y <= 314: #Rim Shots, Paint, or Top
            if 731 <= x <= 824: 
                shot_type = "Rim"
            elif 688 <= x < 731:
                shot_type = "Paint"
            elif 417 <= x < 688:
                shot_type = "Top"
        elif 314 < y <= 489: #Right Corner or Right Wing
            if 731 <= x <= 824:
                shot_type = "Right Corner"
            elif 417 <= x < 731:
                shot_type = "Right Wing"
    
    return (side,shot_type,distance)


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    tipoff = float(sys.argv[1]) if len(sys.argv) > 1 else 0.0
    show_frames = True if (len(sys.argv) > 2 and int(sys.argv[2]) == 1) else False
    getShots(jsoninfo, film, tipoff, show_frames)

    #Timing Results

    sum_total_time = sum(total_time)
    print("TESTING RESULTS TIME")
    print(f"Total execution time: {round(sum_total_time,3)} seconds")
    print()
    print("-"*60)
    for i in range(len(total_time)):
        print(f"Shot {i}: Frame Find {frame_time[i]}; Homography {homography_time[i]}; Total {total_time[i]}")
    print("-"*60)
    print()

    avg_time = sum_total_time/num_shots_frame
    print(f"Average time per shot: {round(avg_time,3)} seconds")

    minutes = int((avg_time * 95) // 60)
    seconds = (avg_time * 95) - minutes * 60
    print(f"Time per 95 shots: {minutes}:{round(seconds)}")
    print(f"Average Frame Find Time: {round(sum(frame_time)/num_shots_frame,3)}")
    print(f"Average Homography Time: {round(sum(homography_time)/num_shots_frame,3)}")
    