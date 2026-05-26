import cv2
import json
import sys

# ── Config ────────────────────────────────────────────────────────────────────
jsoninfo = "game_20260519_valley_christian.json"
film     = "SFHS VCHS Testing.mp4"
PRE_ROLL = 3.0   # seconds before the shot to start playback
# ─────────────────────────────────────────────────────────────────────────────


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
      - The second word must NOT be a free-throw indicator (ft / FT etc.)
    """
    lower = raw_command.lower()
    has_result = "make" in lower or "miss" in lower

    tokens = raw_command.split()
    if len(tokens) < 2:
        return False

    # First token is the timestamp (+MM:SS), second token is the shot type
    shot_type = tokens[1].lower()
    is_free_throw = shot_type == "ft"

    return has_result and not is_free_throw


def play_clip(cap: cv2.VideoCapture, start_sec: float, window_name: str = "Shot Clip"):
    """
    Seek to start_sec and play until the user presses SPACE (next) or Q (quit).
    Returns False if the user pressed Q, True otherwise.
    """
    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps <= 0:
        fps = 30.0  # fallback

    start_frame = max(0, int(start_sec * fps))
    cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)

    ms_per_frame = int(1000 / fps)

    while True:
        ret, frame = cap.read()
        if not ret:
            break  # end of file — treat as advance

        cv2.imshow(window_name, frame)
        key = cv2.waitKey(ms_per_frame) & 0xFF

        if key == ord("q") or key == ord("Q"):
            return False   # quit signal
        if key == ord(" "):
            return True    # advance to next shot

    return True  # EOF → advance automatically


def getShots(json_path: str, film_path: str, tipoff_seconds: float):
    """
    Main function.

    Parameters
    ----------
    json_path       : path to the JSON file
    film_path       : path to the video file
    tipoff_seconds  : position in the video (in seconds) of the very first tipoff
    """
    # Load JSON
    with open(json_path, "r") as f:
        data = json.load(f)

    # Accept either a bare list or a dict with a key that holds the list
    if isinstance(data, list):
        commands = data
    elif isinstance(data, dict):
        # Try common wrapper keys; fall back to first list value found
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

    # Collect field-goal shots
    shots = []
    for entry in commands:
        raw = entry.get("raw_command", "")
        tokens = raw.split()
        if not tokens:
            continue

        ts_token = tokens[0]
        if not ts_token.startswith("+"):
            continue  # not a timed command

        if not is_field_goal(raw):
            continue

        try:
            offset = parse_timestamp(ts_token)
        except ValueError as e:
            print(f"[WARN] Skipping entry — {e}")
            continue

        video_time = tipoff_seconds + offset
        shots.append((video_time, raw))

    if not shots:
        print("No field-goal shots found in the JSON.")
        return

    print(f"Found {len(shots)} field-goal shot(s).  SPACE = next clip  |  Q = quit\n")

    # Open video
    cap = cv2.VideoCapture(film_path)
    if not cap.isOpened():
        print(f"[ERROR] Could not open video: {film_path}")
        return

    window_name = "Shot Clip"
    cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)

    for idx, (shot_time, raw) in enumerate(shots, start=1):
        clip_start = max(0.0, shot_time - PRE_ROLL)
        print(f"[{idx}/{len(shots)}]  {raw}  →  clip start {clip_start:.1f}s")

        keep_going = play_clip(cap, clip_start, window_name)
        if not keep_going:
            print("Quit by user.")
            break

    cap.release()
    cv2.destroyAllWindows()
    print("Done.")

def iou(box1, box2):
    # boxes are (x1, y1, x2, y2)
    xi1 = max(box1[0], box2[0])
    yi1 = max(box1[1], box2[1])
    xi2 = min(box1[2], box2[2])
    yi2 = min(box1[3], box2[3])

    inter = max(0, xi2 - xi1) * max(0, yi2 - yi1)
    area1 = (box1[2]-box1[0]) * (box1[3]-box1[1])
    area2 = (box2[2]-box2[0]) * (box2[3]-box2[1])

    return inter / (area1 + area2 - inter + 1e-6)


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    # You can pass tipoff time as a command-line argument (seconds), e.g.:
    #   python film_review.py 42.5
    # Otherwise it defaults to 0.0 (start of file = tipoff).
    tipoff = float(sys.argv[1]) if len(sys.argv) > 1 else 0.0
    getShots(jsoninfo, film, tipoff)