import cv2
import json
import sys
import numpy as np

from getShots import is_field_goal, show_frame_and_wait, parse_timestamp, find_best_frame, getShots

#Config
video_file = "SFHS VCHS Testing.mp4"
stats_file = "game_20260519_valley_christian.json"
board_file = "2D_HS_Court.jpg"
answer_name= "valley_sfhs_first_points"

# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    tipoff_seconds = float(sys.argv[1]) if len(sys.argv) > 1 else 0.0
    f_shot = open(answer_name+".txt","r")

    ap = 0
    dme = 0
    ame = 0
    ce = 0

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
    
    total_predicted_coordinates = getShots(stats_file,video_file,tipoff_seconds,show_frames=False,benchmark=True)
    L = list(f_shot)

    cv2.namedWindow("Board Marking")
    cv2.moveWindow("Board Marking",750,400)
    for idx, (shot_time, shot_type, make_miss) in enumerate(shots, start=1):
        cv2.namedWindow(f"Shot #{idx}", cv2.WINDOW_NORMAL)
        cv2.resizeWindow(f"Shot #{idx}",960,540)
        cv2.moveWindow(f"Shot #{idx}",0,0)

        pxy, frame = total_predicted_coordinates[idx-1]
        px,py = list(map(int,pxy))
        ax,ay = list(map(int,(L[idx-1])[1:-2].split(", ")))

        temp = court_img.copy()
        cv2.circle(temp,(ax,ay),7,(75,250,75),-1)
        cv2.circle(temp,(px,py),7,(250,75,75),-1)
        while True:
            cv2.imshow("Board Marking",temp)
            cv2.imshow(f"Shot #{idx}",frame)
            # Monitor keyboard events
            key = cv2.waitKey(1) & 0xFF
                    
            if key == ord('q') or key == 32:
                break
                
            if key == ord("1"):
                ap += 1
                break
            if key == ord("2"):
                dme += 1
                break
            if key == ord("3"):
                ame += 1
                break
            if key == ord("4"):
                ce += 1
                break
    
        cv2.destroyWindow(f"Shot #{idx}")
    
    cv2.destroyAllWindows()
    total = ap+dme+ame+ce

    print("Metric Results: ")
    print(f"Absolute Perfection: {ap}")
    print(f"Distance Marginal Error: {dme}")
    print(f"Algorithmic Marginal Error: {ame}")
    print(f"Complete Error: {ce}")
    print("------------")
    print(f"Region Accuracy: {round((ap+dme+ame)/total,4)}")
    print(f"Shot Finder Accuracy: {round((ap+dme)/total,4)}")
    print(f"Shot Perfection Accuracy: {round((ap)/total,4)}")

        
                    
        
        


    
    