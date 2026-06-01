"""
model_testing.py
YOLO v26n Basketball Detection — IPEX/XPU Inference
Draws bounding boxes for: ball (yellow), hoop (blue), player (purple), referee (red)
Skips every other frame for output video.
"""

import cv2
import torch
import intel_extension_for_pytorch as ipex
from ultralytics import YOLO
from pathlib import Path

# ─────────────────────────────────────────────
#  CONFIG — edit these three before running
# ─────────────────────────────────────────────
INPUT_VIDEO    = "C:/Users/ethan/Downloads/GunnTestingTrim.mp4"
MODEL_LOCATION = "C:/Users/ethan/Desktop/Basketball Stats Program/pmodel 527102.pt"
OUTPUT_DIR     = "C:/Users/ethan/Desktop/Basketball Stats Program/"
# ─────────────────────────────────────────────

# Detection settings
CONFIDENCE_THRESHOLD = 0.5
BOX_THICKNESS        = 1
FONT                 = cv2.FONT_HERSHEY_SIMPLEX
FONT_SCALE           = 0.5
FONT_THICKNESS       = 1

# Class index → (label, BGR color)
CLASS_CONFIG = {
    0: ("ball",     (0,   255, 255)),   # yellow
    1: ("hoop",     (255, 128,   0)),   # blue
    2: ("player",   (180,   0, 180)),   # purple
    3: ("referee",  (0,     0, 255)),   # red
}


def setup_device() -> torch.device:
    """Prefer XPU (Intel GPU) via IPEX, fall back to CPU."""
    if hasattr(torch, "xpu") and torch.xpu.is_available():
        device = torch.device("xpu")
        print(f"[device] Using Intel XPU: {torch.xpu.get_device_name(0)}")
    else:
        device = torch.device("cpu")
        print("[device] XPU not available — falling back to CPU")
    return device


def load_model(model_path: str, device: torch.device) -> YOLO:
    """Load YOLO model and apply IPEX optimisation for XPU."""
    print(f"[model] Loading weights from: {model_path}")
    model = YOLO(model_path)

    if device.type == "xpu":
        # Move underlying PyTorch model to XPU and optimise with IPEX
        model.model = model.model.to(device)
        model.model = ipex.optimize(model.model)
        print("[model] IPEX optimisation applied on XPU")
    else:
        print("[model] Running on CPU (no IPEX optimisation)")

    return model


def draw_detections(frame, results) -> None:
    """Draw bounding boxes + labels on frame in-place."""
    for box in results[0].boxes:
        conf = float(box.conf[0])
        cls_id = int(box.cls[0])

        if conf < CONFIDENCE_THRESHOLD and cls_id != 0:
            continue
        if cls_id not in CLASS_CONFIG:
            continue

        label_name, color = CLASS_CONFIG[cls_id]
        x1, y1, x2, y2   = map(int, box.xyxy[0])

        # Bounding box
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, BOX_THICKNESS)

        # Label: "class  conf%"
        text = f"{label_name}  {conf:.0%}"
        (tw, th), baseline = cv2.getTextSize(
            text, FONT, FONT_SCALE, FONT_THICKNESS
        )

        # Filled background chip for readability
        chip_y1 = max(y1 - th - baseline - 4, 0)
        chip_y2 = max(y1, th + baseline + 4)
        cv2.rectangle(
            frame,
            (x1, chip_y1),
            (x1 + tw + 6, chip_y2),
            color,
            cv2.FILLED,
        )

        # Choose black or white text for contrast
        brightness = 0.299 * color[2] + 0.587 * color[1] + 0.114 * color[0]
        text_color = (0, 0, 0) if brightness > 128 else (255, 255, 255)

        cv2.putText(
            frame,
            text,
            (x1 + 3, chip_y2 - baseline - 2),
            FONT,
            FONT_SCALE,
            text_color,
            FONT_THICKNESS,
            cv2.LINE_AA,
        )


def run_inference(model: YOLO, device: torch.device) -> None:
    """Main loop: read frames, run YOLO, write annotated output."""
    cap = cv2.VideoCapture(INPUT_VIDEO)
    if not cap.isOpened():
        raise FileNotFoundError(f"Cannot open video: {INPUT_VIDEO}")

    # Output path
    output_path = Path(OUTPUT_DIR)
    output_path.mkdir(parents=True, exist_ok=True)
    input_stem  = Path(INPUT_VIDEO).stem
    out_file    = output_path / f"{input_stem}_annotated.mp4"

    # Video writer — preserve original resolution but ~half the frame rate
    src_w   = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    src_h   = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    src_fps = cap.get(cv2.CAP_PROP_FPS)
    out_fps = max(src_fps / 2, 1)          # half speed because we skip every other frame

    fourcc  = cv2.VideoWriter_fourcc(*"mp4v")
    writer  = cv2.VideoWriter(str(out_file), fourcc, out_fps, (src_w, src_h))

    print(f"[video] Source : {INPUT_VIDEO}  ({src_w}x{src_h} @ {src_fps:.1f} fps)")
    print(f"[video] Output : {out_file}  (writing @ {out_fps:.1f} fps)")

    frame_count = 0
    written     = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame_count += 1

        # Skip every other frame
        if frame_count % 2 != 0:
            continue

        # Run YOLO inference
        results = model(
            frame,
            device=device,
            verbose=True,
        )

        draw_detections(frame, results)
        writer.write(frame)
        written += 1

        #if written % 100 == 0:
        #    print(f"  … {written} frames written (source frame {frame_count})")

    cap.release()
    writer.release()
    print(f"\n[done] {written} frames written → {out_file}")


def main() -> None:
    device = setup_device()
    model  = load_model(MODEL_LOCATION, device)
    run_inference(model, device)


if __name__ == "__main__":
    main()