import cv2
import json
import sys
import numpy as np

from getShots import is_field_goal, show_frame_and_wait, parse_timestamp, find_best_frame, getShots, getShotInfo

#Config
video_file = "SFHS VCHS Testing.mp4"
stats_file = "game_20260706_valley_christian.json"
board_file = "2D_HS_Court.jpg"
answer_name= "valley_sfhs_points_full"

def findDistance(xy1,xy2):
    x1,y1 = xy1
    x2,y2 = xy2

    dist1 = (x1-x2)**2
    dist2 = (y1-y2)**2
    return round((dist1+dist2)**0.5, 3)

# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    tipoff_seconds = float(sys.argv[1]) if len(sys.argv) > 1 else 0.0
    f_shot = open(answer_name+".txt","r")

    ap = 0
    me = 0
    ce = 0
    results1 = []

    asf = 0
    hef = 0
    pef = 0
    cef = 0
    results2 = []

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
    idx = 1
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
        #print(f"{tokens[2].lower()},",end="")
        idx += 1

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
        cv2.circle(temp,(ax,ay),13,(75,200,120),2)
        cv2.circle(temp,(ax,ay),43,(75,75,200),2)
        cv2.circle(temp,(px,py),7,(250,75,75),-1)

        distance = findDistance((ax,ay),(px,py))
        side1, shot_type1, dist1 = getShotInfo((ax,ay))
        side2, shot_type2, dist2 = getShotInfo((px,py))
        if distance <= 20:
            ap += 1
            results1.append("ap")
            showed = "AP"
        elif distance <= 50 or (shot_type1 == shot_type2):
            me += 1
            results1.append("me")
            showed = "ME"
        else:
            ce += 1
            results1.append("ce")
            showed = "CE"
        
        cv2.putText(temp,showed,(400,250),fontFace=cv2.FONT_HERSHEY_SIMPLEX,fontScale=1.5,color=(255,0,0),thickness=2,lineType=cv2.LINE_AA)

        while True:
            cv2.imshow("Board Marking",temp)
            cv2.imshow(f"Shot #{idx}",frame)
            # Monitor keyboard events
            key = cv2.waitKey(1) & 0xFF
                
            if key == ord("1"):
                asf += 1
                results2.append("asf")
                break
            if key == ord("2"):
                hef += 1
                results2.append("hef")
                break
            if key == ord("3"):
                pef += 1
                results2.append("pef")
                break
            if key == ord("4"):
                cef += 1
                results2.append("cef")
                break
    
        cv2.destroyWindow(f"Shot #{idx}")
    
    cv2.destroyAllWindows()
    total = ap+me+ce

    print("Metric Results: ")
    print(f"Absolute Perfection: {ap}")
    print(f"Marginal Error: {me}")
    print(f"Complete Error: {ce}")
    print("------------")
    print(f"Acceptable Shot Frame: {asf}")
    print(f"Homography Error Frame: {hef}")
    print(f"Player Error Frame: {pef}")
    print(f"Complete Error Frame: {cef}")
    for i in range(len(results1)):
        print(f"Shot {i+1}: {results1[i]}, {results2[i]}")



    
    