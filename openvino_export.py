from ultralytics import YOLO

# 1. Load your standard PyTorch model
model = YOLO("kmodel 0719-0548p.pt")

# 2. Export it to FP16 OpenVINO format
# This saves a folder named "yolo26s_openvino_model" into your directory
model.export(format="openvino", half=True, dynamic=True)

print("Export complete! You can now close this script.")
