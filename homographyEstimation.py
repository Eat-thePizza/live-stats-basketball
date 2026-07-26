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
            (11, 11)  , (11, 49)  , (11, 185) , (11, 311) , (11, 447) , (11, 489) ,
            (198, 185), (198, 311),
            (417, 11) , (417, 489),
            (823, 11) , (823, 49) , (823, 185), (823, 311), (823, 447), (823, 489),
            (635, 185), (635, 311),
        ]
        return points_pixels
    
    def show_reference(self):
        """
        Draws the reference keypoints and their index labels onto a copy of 
        the court image and displays it in an OpenCV window.
        """
        # Copy the reference image to avoid drawing directly on the cached template
        vis_img = self.reference_court_image.copy()

        # Loop through each keypoint and draw the marker + index label
        for idx, pt in enumerate(self.reference_kps):
            x, y = int(pt[0]), int(pt[1])
            
            # Draw keypoint circle (bright green dot)
            cv2.circle(vis_img, (x, y), radius=5, color=(0, 255, 0), thickness=-1)
            
            if idx <= 9 or idx >= 16:
                # Label keypoint index (red text offset slightly above the point)
                cv2.putText(
                    vis_img, 
                    str(idx), 
                    (x + 10, y - 1), 
                    cv2.FONT_HERSHEY_SIMPLEX, 
                    0.4, 
                    (0, 20, 255), 
                    1, 
                    cv2.LINE_AA
                )
            elif idx <= 15:
                # Label keypoint index (red text offset slightly above the point)
                cv2.putText(
                    vis_img, 
                    str(idx), 
                    (x - 23, y - 1), 
                    cv2.FONT_HERSHEY_SIMPLEX, 
                    0.4, 
                    (0, 20, 255), 
                    1, 
                    cv2.LINE_AA
                )

        # Render the image in a pop-up window
        cv2.imshow("Reference Court Keypoints", vis_img)
        cv2.waitKey(0)
        cv2.destroyAllWindows()

        return vis_img

    def compute_homography(self, broadcast_results):
        CONF_THRESHOLD = 0.50
        keypoint_list = broadcast_results[0].keypoints.data[0].cpu().numpy().tolist()

        good_indices = [i for i, (x, y, conf) in enumerate(keypoint_list) if conf >= CONF_THRESHOLD]
        if len(good_indices) < 5:
            raise RuntimeError(f"ERROR: Only {len(good_indices)} keypoints above confidence {CONF_THRESHOLD}. Need >= 5.")

        filtered_broadcast = np.array([[keypoint_list[i][0], keypoint_list[i][1]] for i in good_indices], dtype=np.float32)
        filtered_reference = np.array([self.reference_kps[i] for i in good_indices], dtype=np.float32)

        H, mask = cv2.findHomography(filtered_broadcast, filtered_reference, cv2.RANSAC, 5.0)
        if H is None:
            raise RuntimeError("ERROR: Homography failed.")
        return H, good_indices, keypoint_list

    def map_centers_from_boxes(self, boxes_xyxy, H, shot_type):
        if boxes_xyxy.size == 0:
            return np.empty((0, 2), dtype=np.float32)

        x1, y1, x2, y2 = boxes_xyxy[:, 0], boxes_xyxy[:, 1], boxes_xyxy[:, 2], boxes_xyxy[:, 3]
        if shot_type == 2:
            centers = np.stack(((x1 + x2) / 2.0, y2 + (0.000000265 *((y2)**2)) * (y1-y2)), axis=1).astype(np.float32)
        else:
            centers = np.stack(((x1 + x2) / 2.0, y2 + 0 * (y1-y2)), axis=1).astype(np.float32)
        mapped = cv2.perspectiveTransform(centers.reshape(-1, 1, 2), H).reshape(-1, 2).astype(np.float32)

        #(0.00025 *(y2))
        #(0.000000265 *((y2)**2))
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