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
    Classified as Marginal Error because of Homography Positioning
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
    = (ASF + HEf)/(Total)
    Practically, the program found the correct player and frame for the shot, signaling a successful algorithm run
- Perfection Accuracy (PA): Shots that are absolutely picture perfect
    = (AP)/(Total)
    Practically, this is just a flex

Metric Results: (6/23)
Region Accuracy:                0.8333
Shot Finder Accuracy:           0.7500
Player Identification Accuracy: 0.6667
Perfection Accuracy:            0.3750



Absolute Perfection: 9
Marginal Error: 11
Complete Error: 4
------------
Acceptable Shot Frame: 10
Homography Error Frame: 6
Player Error Frame: 2
Complete Error Frame: 6
Shot 1: ap, asf
Shot 2: ap, asf
Shot 3: me, hef
Shot 4: ap, asf
Shot 5: me, hef
Shot 6: ap, asf
Shot 7: ce, cef
Shot 8: me, hef
Shot 9: ce, cef
Shot 10: ap, asf
Shot 11: ce, cef
Shot 12: me, hef
Shot 13: ap, asf
Shot 14: me, cef
Shot 15: ap, asf
Shot 16: ap, asf
Shot 17: ap, asf
Shot 18: me, cef
Shot 19: me, asf
Shot 20: me, pef
Shot 21: me, pef
Shot 22: ce, cef
Shot 23: me, hef
Shot 24: me, hef
