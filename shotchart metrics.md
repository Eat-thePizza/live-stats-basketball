SHOT CHART METRICS

Categories:
- Absolute Perfection (AP): the shot on the 2D board is in the exact spot according to human vision (maybe a few pixels off); 
    if a human were to create a shot chart, they would mark the same spot

- Distance Marginal Error (DME): the distance of the shot placement is slightly off from the actual point of the shot;
    this is usually due to minor homography estimation errors or slightly inaccurate bounding boxes;
    if a human were to create a shot chart, their circle and this circle will be a few pixels off from intersecting

- Algorithmic Marginal Error (ABE): the distance of the shot placement is slightly off from the actual point of the shot;
    however, now this is generated from an inaccurate frame of the shot release;
    if a human were to create a shot chart, their circle will be in a similar region

- Complete Error (CE): the shot is completely off from the actual point of shot; not even in the same region
    if a human were to create a shot chart, their circle wouldn't even be close

Key Metrics (# indicates number of)
- Region Accuracy (RA): how many of the shot placements are in the general region
    #Shots In Region / #Total Shots
    #Shots In Region = #Absolute Perfection + #Distance Marginal Error + #Algorithmic Marginal Error

- Shot Finder Accuracy (SFA): how many of the shot placements are incredibly close AND have the correct frame for shot release
    #Close Shots & Correct Frame / #Total Shots
    #Close Shots & Correct Frame = #Absolute Perfection + #Distance Marginal Error

- Shot Perfection Accuracy (SPA): how many of the shot placements are picture perfect
    #Absolute Perfection / #Total Shots

LATEST METRICS
- Updated 6/8
- 24 Total Shots from "SFHS VCHS Testing.mp4" (Q1 of Valley Christian @ Saint Francis 2026)

AP : 14
DME:  3
AME:  5
CE :  2

RA : 0.9167
SFA: 0.7083
SPA: 0.5833
