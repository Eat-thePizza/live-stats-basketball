import cv2
import json
import sys
import numpy as np

from getShots import is_field_goal, show_frame_and_wait, parse_timestamp

#Config
video_file = "SFHS VCHS Testing.mp4"
stats_file = "game_20260706_valley_christian.json"
board_file = "2D_HS_Court.jpg"
name       = "valley_sfhs_points_full"

def marking(event, x, y, flags, img_param):
    global clicked_points
    # Check if the left mouse button was clicked
    if event == cv2.EVENT_LBUTTONDOWN:
        # Record the coordinates
        clicked_points.append((x, y))
        cv2.circle(img_param, (x, y), 6, (75, 250, 75), -1)
        print(f"Point registered at coordinate: X={x}, Y={y}")


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    tipoff_seconds = float(sys.argv[1]) if len(sys.argv) > 1 else 0.0
    f_shot = open(name+".txt","w")

        # ── Load JSON ─────────────────────────────────────────────────────────────
    with open(stats_file, "r") as f:
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

    print(f"Found {len(shots)} field-goal shot(s).  SPACE = next shot  |  Q = quit\n")

    # ── Open video ────────────────────────────────────────────────────────────
    cap = cv2.VideoCapture(video_file)
    if not cap.isOpened():
        print(f"[ERROR] Could not open video: {video_file}")
    court_img = cv2.imread(board_file)
    
    shot_coordinates = []

    cv2.namedWindow("Board Marking")
    cv2.moveWindow("Board Marking",750,400)
    for idx, (shot_time, shot_type, make_miss) in enumerate(shots, start=1):
        fps         = cap.get(cv2.CAP_PROP_FPS) or 30.0
        start_sec   = max(0.0, shot_time - 3)
        start_frame = int(start_sec * fps)
        end_frame   = int(shot_time * fps)

        temp = court_img.copy()
        cv2.setMouseCallback("Board Marking",marking,param=temp)

        clicked_points = []

        cv2.namedWindow(f"Shot #{idx}", cv2.WINDOW_NORMAL)
        cv2.resizeWindow(f"Shot #{idx}",960,540)
        cv2.moveWindow(f"Shot #{idx}",0,0)
        cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
        for fn in range(start_frame, end_frame + 1):
            ret, frame = cap.read()
            if not ret:
                break
            show_frame_and_wait(frame,f"Shot #{idx}",delay=100)
            if fn == end_frame:
                while True:
                    cv2.imshow("Board Marking",temp)

                    # Monitor keyboard events
                    key = cv2.waitKey(1) & 0xFF
                    
                    # 'q' or ESC to quit
                    if key == ord('q') or key == 32:
                        break
                    # 'c' to clear the saved markings
                    elif key == ord('c'):
                        clicked_points.clear()
                        print("Cleared all points.")

        cv2.destroyWindow(f"Shot #{idx}")
        shot_coordinates.append(clicked_points[-1] if len(clicked_points) > 0 else (-1,-1))

    for point in shot_coordinates:
        f_shot.write(str(point)+"\n")

    f_shot.close()


    
    