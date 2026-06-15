SHOT CHART METRICS

Categories:
- Absolute Perfection (AP): the shot on the 2D board is in the exact spot according to human vision (maybe a few pixels off); 
    if a human were to create a shot chart, they would mark the same spot
    Practically, this is pretty much the perfect spot

- Distance Marginal Error (DME): the distance of the shot placement is slightly off from the actual point of the shot;
    this is usually due to minor homography estimation errors of where a player's feet actually are;
    if a human were to create a shot chart, their circle and this circle will be a few pixels off from intersecting
    Practically, this tells you the correct information; just the dot is slightly off

- Algorithmic Marginal Error (AME): the distance of the shot placement is slightly off from the actual point of the shot;
    however, now this is generated from an inaccurate frame of the shot release;
    if a human were to create a shot chart, their circle will be in a similar region
    Practically, this tells you the general correct information, but it got a little lucky with the frame

- Complete Error (CE): the shot is completely off from the actual point of shot; 
    this include either a completely incorrect frame or a frame where the ball latched onto the wrong player's bounding box;
    if a human were to create a shot chart, their circle wouldn't even be close
    Practically, this tells you the wrong story

Key Metrics (# indicates number of)
- Region Accuracy (RA): how many of the shot placements are in the general region
    #Shots In Region / #Total Shots
    #Shots In Region = #Absolute Perfection + #Distance Marginal Error + #Algorithmic Marginal Error
    Practically, this tells you enough information about the shot already

- Shot Finder Accuracy (SFA): how many of the shot placements are incredibly close AND have the correct frame for shot release
    #Close Shots & Correct Frame / #Total Shots
    #Close Shots & Correct Frame = #Absolute Perfection + #Distance Marginal Error
    Practically, this tells you enough information AND it says the model got the logic correct

- Shot Perfection Accuracy (SPA): how many of the shot placements are picture perfect
    #Absolute Perfection / #Total Shots
    Practically, this is a dude seeking perfection; that's it

LATEST METRICS
- Updated 6/15
- 24 Total Shots from "SFHS VCHS Testing.mp4" (Q1 of Valley Christian @ Saint Francis 2026)

AP : 8
DME: 7
AME: 5
CE : 4

RA : 0.8333
SFA: 0.6250
SPA: 0.3333
