import torch
import intel_extension_for_pytorch as ipex

import cv2
import numpy as np
from ultralytics import YOLO

class TacticalViewConverter:
    def __init__(self, court_image_path):
        self.reference_court_image = cv2.imread(court_image_path)
        if self.reference_court_image is None:
            raise RuntimeError(f"ERROR: Could not load court image at {court_image_path}")

        self.width = 835
        self.height = 500
        
        self.reference_kps = np.array(self._generate_reference_kps(), dtype=np.float32)
        self.reference_court_image = cv2.resize(self.reference_court_image, (self.width, self.height))

        # Team colors for tactical dot drawing
        self.TEAM_COLORS = [
            (255, 165, 0),    # Team 0 — blue
            (75, 75, 255),  # Team 1 — white
        ]
        self.UNKNOWN_COLOR = (128, 128, 128)

    def _generate_reference_kps(self):
        points_pixels = [
            (17, 13)  , (17, 51)  , (17, 183) , (17, 309) , (17, 441) , (17, 483) ,
            (198, 185), (198, 311),
            (417, 11) , (417, 489),
            (817, 13) , (817, 51) , (817, 183), (817, 309), (817, 441), (817, 483),
            (635, 185), (635, 311),
        ]
        return points_pixels

    def compute_homography(self, broadcast_results):
        CONF_THRESHOLD = 0.5
        keypoints = broadcast_results[0].keypoints.data.cpu().numpy()
        keypoint_list = keypoints[0].tolist()

        good_indices = [i for i, (x, y, conf) in enumerate(keypoint_list) if conf >= CONF_THRESHOLD]
        if len(good_indices) < 5:
            raise RuntimeError(f"ERROR: Only {len(good_indices)} keypoints above confidence {CONF_THRESHOLD}. Need >= 5.")

        filtered_broadcast = np.array([[keypoint_list[i][0], keypoint_list[i][1]] for i in good_indices], dtype=np.float32)
        filtered_reference = np.array([self.reference_kps[i] for i in good_indices], dtype=np.float32)

        H, mask = cv2.findHomography(filtered_broadcast, filtered_reference, cv2.RANSAC, 5.0)
        if H is None:
            raise RuntimeError("ERROR: Homography failed.")
        return H, good_indices, keypoint_list

    def map_centers_from_boxes(self, boxes_xyxy, H):
        if boxes_xyxy.size == 0:
            return np.empty((0, 2), dtype=np.float32)

        x1, y1, x2, y2 = boxes_xyxy[:, 0], boxes_xyxy[:, 1], boxes_xyxy[:, 2], boxes_xyxy[:, 3]
        centers = np.stack(((x1 + x2) / 2.0, y2 + (0.000003*((y2-y1)**2)) * (y1-y2)), axis=1).astype(np.float32)
        mapped = cv2.perspectiveTransform(centers.reshape(-1, 1, 2), H).reshape(-1, 2).astype(np.float32)

        return mapped

    # -------------------------------------------------------
    # NEW: extracts dominant HSV color from a player's torso region
    # -------------------------------------------------------
    def getJerseyColor(self, frame, box_xyxy):  
        x1, y1, x2, y2 = int(box_xyxy[0]), int(box_xyxy[1]), int(box_xyxy[2]), int(box_xyxy[3])
        ylow = int(y1 + 0.5*(y2-y1))
        yhigh = int(y1 + 0.6*(y2-y1))

        chunk = frame[ylow:yhigh, x1:x2]

        hsv_chunk = cv2.cvtColor(chunk, cv2.COLOR_BGR2HSV)
        lower_white = np.array([0, 0, 90])
        upper_white = np.array([179, 65, 255])

        mask = cv2.inRange(hsv_chunk, lower_white, upper_white)

        white_pixels = cv2.countNonZero(mask)
        total_pixels = chunk.shape[0] * chunk.shape[1]
        white_percentage = (white_pixels / total_pixels) * 100

        return white_percentage


    def assign_teams(self, frame, player_boxes):
        n = len(player_boxes)
        assignments = np.full(n, -1, dtype=np.int32)
        if n == 0:
            return assignments

        white_pct = []
        for i, box in enumerate(player_boxes):
            white_pct.append((i,self.getJerseyColor(frame, box)))
        white_pct.sort(key=lambda x: x[1],reverse=True)
        print(white_pct)
        for i, wp in white_pct[0:5]:
            assignments[i] = 1

        assignments[assignments == -1] = 0
        print(assignments)
        return assignments

    # -------------------------------------------------------
    # UPDATED: draw_tactical now accepts team_assignments
    # and colors dots by team. Pass None to get old behavior.
    # -------------------------------------------------------
    def draw_tactical(self, mapped_player_points, mapped_ball_points,
                    good_indices=None, team_assignments=None):
        img = self.reference_court_image.copy()

        for i, (x, y) in enumerate(mapped_player_points):
            if team_assignments is not None and i < len(team_assignments):
                team = team_assignments[i]
                color = self.TEAM_COLORS[team] if team in (0, 1) else self.UNKNOWN_COLOR
            else:
                color = (75, 75, 250)  # original red fallback
            cv2.circle(img, (int(x), int(y)), 9, color, -1)

        #for (x, y) in mapped_ball_points:
        #    cv2.circle(img, (int(x), int(y)), 4, (0, 255, 255), -1)

        if good_indices is not None:
            for i in good_indices:
                rx, ry = self.reference_kps[i]
                cv2.circle(img, (int(rx), int(ry)), 6, (0, 255, 0), -1)
                cv2.putText(img, str(i), (int(rx) + 5, int(ry) - 5),
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 1)
        return img

def filter_tracked_objects(results, class_id, max_objects=10):
    if results is None or len(results) == 0 or results[0].boxes is None or len(results[0].boxes) == 0:
        return np.empty((0, 4), dtype=np.float32), np.empty((0,), dtype=np.float32), np.empty((0,), dtype=np.int32)

    boxes = results[0].boxes
    try:
        cls = boxes.cls.cpu().numpy().astype(np.int32)
        mask = (cls == class_id)
        if not np.any(mask):
            return np.empty((0, 4), dtype=np.float32), np.empty((0,), dtype=np.float32), np.empty((0,), dtype=np.int32)

        xyxy = boxes.xyxy.cpu().numpy().astype(np.float32)[mask]
        conf = boxes.conf.cpu().numpy().astype(np.float32)[mask]
        ids = boxes.id.cpu().numpy().astype(np.int32)[mask] if boxes.id is not None else np.full((len(xyxy),), -1, dtype=np.int32)

        idx = np.argsort(-conf)[:max_objects]
        return xyxy[idx], conf[idx], ids[idx]

    except (AssertionError, Exception) as e:
        print(f"Warning: Filter error suppressed for class {class_id}: {e}")
        return np.empty((0, 4), dtype=np.float32), np.empty((0,), dtype=np.float32), np.empty((0,), dtype=np.int32)

if __name__ == "__main__":

    # -------------------------------------------------------
    # Class ID map:
    #   0 = basketball
    #   1 = hoop
    #   2 = player
    #   3 = referee
    # -------------------------------------------------------

    CLASS_BASKETBALL = 0
    CLASS_PLAYER     = 2

    # -------------------------------------------------------
    # Setup
    # -------------------------------------------------------

    if torch.xpu.is_available():
        DEVICE = "xpu"
        print(f"Intel XPU detected: {torch.xpu.get_device_name()}")
    else:
        DEVICE = "cpu"
        print("XPU not available, falling back to CPU")

    keypoint_model = YOLO("model519711.pt", verbose=True)
    player_model = YOLO("pmodel 527102.pt", verbose=True)

    keypoint_model.to(DEVICE)
    player_model.to(DEVICE)

    keypoint_model.model = ipex.optimize(keypoint_model.model, dtype=torch.float32)

    mapper = TacticalViewConverter("court_template_new.png")

    # -------------------------------------------------------
    # CHANGE 3: create the Kalman filter and tracking state
    # before the video loop.
    #
    # ball_kalman        — the filter object itself
    # ball_kalman_init   — False until the filter gets its first detection.
    #                      We can't update the filter until we have a first
    #                      real position to initialize it with.
    # BALL_CONF_THRESHOLD — only feed detections above this confidence into
    #                      the filter. Below this we treat it as a miss and
    #                      hold the last smoothed position (Option A).
    # -------------------------------------------------------
    ball_kalman = create_ball_kalman()
    ball_kalman_init = False
    BALL_CONF_THRESHOLD = 0.4

    # -------------------------------------------------------
    # Video processing loop
    # -------------------------------------------------------

    video_path = "C:/Users/ethan/Desktop/Basketball Stats Program/GunnTestingTrim.mp4"
    cap = cv2.VideoCapture(video_path)
    ret, frame = cap.read()
    if not ret:
        raise RuntimeError("ERROR: COULD NOT READ FIRST FRAME OF VIDEO.")

    PROCESS_WIDTH  = 1280
    PROCESS_HEIGHT = 720

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter("homography_output-519711.mp4", fourcc, 30, (PROCESS_WIDTH, PROCESS_HEIGHT))

    print("Processing with 50% Ghost Frame optimization + Kalman ball smoothing...")

    frame_count = 0
    last_H             = None
    last_good_indices  = []
    last_keypoint_list = []
    last_player_boxes  = np.empty((0, 4), dtype=np.float32)
    last_player_confs  = np.empty((0,),   dtype=np.float32)
    last_player_ids    = np.empty((0,),   dtype=np.int32)
    last_ball_boxes    = np.empty((0, 4), dtype=np.float32)
    last_ball_confs    = np.empty((0,),   dtype=np.float32)
    last_ball_ids      = np.empty((0,),   dtype=np.int32)
    last_player_points = np.empty((0, 2), dtype=np.float32)
    last_ball_points   = np.empty((0, 2), dtype=np.float32)

    # -------------------------------------------------------
    # CHANGE 4: smoothed ball position holder.
    # This replaces raw last_ball_points for drawing.
    # Starts as None — nothing drawn until filter is initialized.
    # -------------------------------------------------------
    smoothed_ball_point = None

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame_count += 1
        frame = cv2.resize(frame, (PROCESS_WIDTH, PROCESS_HEIGHT))

        if frame_count % 2 != 0:
            kps_results = keypoint_model(frame, verbose=True)
            torch.xpu.synchronize()

            ply_results = None
            try:
                ply_results = player_model.track(frame, persist=True, tracker="botsort.yaml", verbose=True)
                torch.xpu.synchronize()
            except (AssertionError, Exception) as e:
                print(f"Tracker error (ghosting frame {frame_count}): {e}")
                ply_results = None

            if kps_results is not None:
                try:
                    last_H, last_good_indices, last_keypoint_list = mapper.compute_homography(kps_results)

                    if ply_results is not None:
                        last_player_boxes, last_player_confs, last_player_ids = filter_tracked_objects(ply_results, class_id=CLASS_PLAYER,     max_objects=10)
                        last_ball_boxes,   last_ball_confs,   last_ball_ids   = filter_tracked_objects(ply_results, class_id=CLASS_BASKETBALL, max_objects=1)

                    last_player_points = mapper.map_centers_from_boxes(last_player_boxes, last_H)
                    last_ball_points   = mapper.map_centers_from_boxes(last_ball_boxes,   last_H)

                    # ---------------------------------------------------
                    # CHANGE 5: Kalman update on real frames.
                    #
                    # We work in tactical (2D court) coordinates because
                    # that's what you're drawing. The homography has already
                    # been applied by map_centers_from_boxes above, so
                    # last_ball_points is the ball's position on the 2D court.
                    #
                    # If YOLO found the ball with enough confidence:
                    #   - First detection ever: initialize the filter state.
                    #   - Subsequent detections: call update() to correct
                    #     the filter with this new measurement.
                    #
                    # If YOLO missed the ball or confidence is too low:
                    #   - Hold smoothed_ball_point as is (Option A).
                    #   - Do NOT call update() — bad data stays out.
                    # ---------------------------------------------------
                    if len(last_ball_points) > 0 and len(last_ball_confs) > 0 and last_ball_confs[0] >= BALL_CONF_THRESHOLD:
                        bx, by = last_ball_points[0]

                        if not ball_kalman_init:
                            # First confident detection: plant the filter here.
                            # Without this, the filter starts at origin (0,0)
                            # and takes many frames to converge to the real position.
                            ball_kalman.x = np.array([[bx], [by], [0.0], [0.0]], dtype=np.float32)
                            ball_kalman_init = True
                            smoothed_ball_point = (bx, by)
                        else:
                            # Subsequent detections: correct the filter.
                            ball_kalman.update(np.array([[bx], [by]], dtype=np.float32))
                            sx = float(ball_kalman.x[0])
                            sy = float(ball_kalman.x[1])
                            smoothed_ball_point = (sx, sy)
                    # else: ball not found or low confidence — hold smoothed_ball_point unchanged

                except Exception:
                    pass

        # ghost frames fall through here with all last_ values unchanged
        # smoothed_ball_point is also unchanged on ghost frames — Option A behavior

        if last_H is not None:
            tactical_frame = mapper.draw_tactical(last_player_points, last_good_indices)

            # ---------------------------------------------------
            # CHANGE 6: draw smoothed ball position instead of
            # raw last_ball_points.
            #
            # Before: iterated over last_ball_points (raw YOLO output).
            # After:  draws smoothed_ball_point (Kalman output).
            #
            # smoothed_ball_point is None until the first confident
            # detection, so nothing is drawn on early frames where
            # the ball hasn't been found yet.
            # ---------------------------------------------------
            if smoothed_ball_point is not None:
                bx, by = smoothed_ball_point
                cv2.circle(tactical_frame, (int(bx), int(by)), 3, (125, 125, 0), -1)

            for (px, py), pid in zip(last_player_points, last_player_ids):
                if pid != -1:
                    cv2.putText(tactical_frame, f"P{pid}", (int(px) + 5, int(py) - 5),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.3, (0, 0, 0), 1)

            good_set = set(last_good_indices)
            if {0, 1, 2, 3}.issubset(good_set):
                cv2.putText(frame, "Left Side",  (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2)
            elif {10, 11, 12, 13}.issubset(good_set):
                cv2.putText(frame, "Right Side", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2)

            for i in last_good_indices:
                kx, ky, k_conf = last_keypoint_list[i]
                cv2.circle(frame, (int(kx), int(ky)), 5, (0, 255, 0), -1)

            for (x1, y1, x2, y2), score, pid in zip(last_player_boxes, last_player_confs, last_player_ids):
                cv2.rectangle(frame, (int(x1), int(y1)), (int(x2), int(y2)), (255, 0, 0), 2)
                label = f"ID:{pid}" if pid != -1 else f"Player {score:.2f}"
                cv2.putText(frame, label, (int(x1), int(y1) - 5),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

            for (bx1, by1, bx2, by2), b_score, b_id in zip(last_ball_boxes, last_ball_confs, last_ball_ids):
                cv2.rectangle(frame, (int(bx1), int(by1)), (int(bx2), int(by2)), (0, 255, 255), 2)
                cv2.putText(frame, "Ball", (int(bx1), int(by1) - 5),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)

            th, tw = tactical_frame.shape[:2]
            frame[0:th, 0:tw] = tactical_frame

        out.write(frame)

    cap.release()
    out.release()
    print("Video processing complete!")