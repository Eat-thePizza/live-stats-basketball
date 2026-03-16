import cv2
import numpy as np
#import intel_extension_for_pytorch as ipex
import torch
from ultralytics import YOLO
#from homographyEstimation import image_estimation

video_path = ""

cap = cv2.VideoCapture("")
fps = cap.get(cv2.CAP_PROP_FPS)

frame_num = 0
condition = True

while condition:
    ret, frame = cap.read()
    if not ret:
        break
    
    if frame_num == 157:
        #image_estimation(ret,frame,"testing")
        condition = False
    frame_num += 1