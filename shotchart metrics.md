Shot Chart Metrics

DISTANCE CATEGORIES
- Absolute Perfection (AP): The spot is spot on; a human probably would've marked it there
    The centers are 20 pixels or less apart distance wise
    Practically, This is the gold standard
- Marginal Error (ME): This spot is really close; a tiny bit off from where a human marks
    The centers are 50 pixels or less apart distance wise OR in the same shot type region
    Practically, This is very usable for a coach to analyze
- Complete Error (CE): This spot is really off; completely wrong
    The centers are more than 50 pixels apart and not in the same shot type region
    Practically, This is misleading for a coach

FRAME FIND CATEGORIES
- Acceptable Shot Frame (ASF): This frame is within the shooting motion with the correct player
    Classified as Absolute Perfection
- Homography Error Frame (HEF): This frame is within the shooting motion with the correct player
    Classified as Marginal Error or Complete Error because of Homography Positioning
- Player Error Frame (PEF): This frame is within the shooting motion with the incorrect player
    Classified as Marginal Error or Complete Error because the ball attached itself to the wrong player
- Complete Error Frame (CEF): This frame is not within the shooting motion
    Classified as Marginal Error or Complete Error because of the wrong frame

METRICS
- Region Accuracy (RA): Shots that fell into the correct region
    = (AP + ME)/(Total)
    Practically, this is very usable for coaches to tell the story already
- Shot Finder Accuracy (SFA): Shots where the program found the correct frame
    = (ASF + HEF + PEF)/(Total)
    Practically, the program found the correct frame of the shot
- Player Identification Accuracy (PIA): Shots where the program correctly assigned the ball to the right player
    = (ASF + HEF)/(Total)
    Practically, the program found the correct player and frame for the shot, signaling a successful algorithm run
- Perfection Accuracy (PA): Shots that are absolutely picture perfect
    = (AP)/(Total)
    Practically, this is just a flex

Metric Results: (6/23)
Region Accuracy:                0.8333
Shot Finder Accuracy:           0.7500
Player Identification Accuracy: 0.6667
Perfection Accuracy:            0.3750



Metric Results: 
Absolute Perfection: 36
Marginal Error: 45
Complete Error: 14
------------
Acceptable Shot Frame: 35
Homography Error Frame: 39
Player Error Frame: 7
Complete Error Frame: 14
Shot 1: ap, asf
Shot 2: ap, asf
Shot 3: me, hef
Shot 4: me, hef
Shot 5: ap, asf
Shot 6: ap, asf
Shot 7: ap, asf
Shot 8: me, hef
Shot 9: ap, asf
Shot 10: ap, asf
Shot 11: ce, pef
Shot 12: me, hef
Shot 13: ap, asf
Shot 14: me, hef
Shot 15: ap, asf
Shot 16: ap, asf
Shot 17: me, hef
Shot 18: ce, cef
Shot 19: ap, asf
Shot 20: ce, cef
Shot 21: me, hef
Shot 22: me, hef
Shot 23: me, hef
Shot 24: me, hef
Shot 25: me, hef
Shot 26: me, hef
Shot 27: me, cef
Shot 28: ce, cef
Shot 29: ce, cef
Shot 30: ap, asf
Shot 31: me, hef
Shot 32: me, hef
Shot 33: ce, cef
Shot 34: ce, cef
Shot 35: me, hef
Shot 36: me, hef
Shot 37: ap, asf
Shot 38: ap, asf
Shot 39: me, hef
Shot 40: ce, pef
Shot 41: me, pef
Shot 42: ap, asf
Shot 43: ap, asf
Shot 44: ap, asf
Shot 45: me, hef
Shot 46: me, hef
Shot 47: ce, pef
Shot 48: ap, asf
Shot 49: me, cef
Shot 50: me, hef
Shot 51: ap, asf
Shot 52: me, hef
Shot 53: me, hef
Shot 54: me, hef
Shot 55: ce, cef
Shot 56: ap, asf
Shot 57: me, hef
Shot 58: me, pef
Shot 59: ap, asf
Shot 60: me, hef
Shot 61: me, hef
Shot 62: ap, asf
Shot 63: me, hef
Shot 64: ce, pef
Shot 65: me, hef
Shot 66: me, hef
Shot 67: ap, asf
Shot 68: me, hef
Shot 69: me, hef
Shot 70: me, hef
Shot 71: me, cef
Shot 72: ce, cef
Shot 73: ap, asf
Shot 74: me, hef
Shot 75: ap, asf
Shot 76: ap, asf
Shot 77: me, hef
Shot 78: ce, cef
Shot 79: me, hef
Shot 80: ap, asf
Shot 81: ap, asf
Shot 82: ap, asf
Shot 83: ap, asf
Shot 84: ap, cef
Shot 85: ap, asf
Shot 86: me, pef
Shot 87: ap, asf
Shot 88: me, hef
Shot 89: ap, asf
Shot 90: me, hef
Shot 91: ce, cef
Shot 92: me, hef
Shot 93: me, hef
Shot 94: ap, asf
Shot 95: ap, asf