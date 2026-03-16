
from tabulate import tabulate
import csv
#from homographyEstimation import image_estimation
import cv2
import time

"""
TO ADD FEATURES:
- Lineup Data
- Shot chart

"""

#response = input("Shot Chart Feature or no(y/n): ")
#response = True if response.lower() == "y" else False
response = False

"""
if response:
    cap = cv2.VideoCapture()
    fps = cap.get(cv2.CAP_PROP_FPS)
"""

def shots(player,shot,made,ast_block=None):
    global roster_stats,team_stats, sfPoints, opPoints, sfPOT, opPOT, previous_turnover, sfML, secondchance, sfSP, opSP

    if shot == "three": #Three pointer
        if made: #Make
            if player == "op": #Add points, point off turnovers, second chance points
                opPoints += 3
                if previous_turnover:
                    opPOT += 3
                if secondchance:
                    opSP += 3
            else: #Add points, point off turnovers, second chance points
                sfPoints += 3
                if previous_turnover:
                    sfPOT += 3
                if secondchance:
                    sfSP += 3
            
            #Update roster stats
            roster_stats[player][0] += 1
            roster_stats[player][1] += 1
            roster_stats[player][2] += 1
            roster_stats[player][3] += 1
            if ast_block != None: #If a player gets an assist
                roster_stats[ast_block][8] += 1
        else:
            roster_stats[player][1] += 1
            roster_stats[player][3] += 1
            if ast_block != None: #If a player gets a block
                roster_stats[ast_block][9] += 1
    else:
        if made: #Any two pointer
            if player == "op": #Add points, point off turnovers, second chance points
                opPoints += 2
                if previous_turnover:
                    opPOT += 2
                if secondchance:
                    opSP += 2
            else: #Add points, point off turnovers, second chance points
                sfPoints += 2
                if previous_turnover:
                    sfPOT += 2
                if secondchance:
                    sfSP += 2
            
            roster_stats[player][0] += 1
            roster_stats[player][1] += 1
            if ast_block != None: #If a player gets an assist
                roster_stats[ast_block][8] += 1
        else:
            roster_stats[player][1] += 1
            if ast_block != None: #If a player gets a block
                roster_stats[ast_block][9] += 1
            if "lay" in shot and player != "op": #If it's a missed layup
                sfML += 1

def free_throws(player, ft_results):
    global roster_stats,team_stats, opPoints, sfPoints, sfPOT, opPOT, previous_turnover, sfSP, opSP, secondchance
    for result in ft_results:
        if "make" in result: #Made free throw
            if player == "op": #Add points, point off turnovers, second chance points           
                opPoints += 1
                if previous_turnover:
                    opPOT += 1
                if secondchance:
                    opSP += 1
            else: #Add points, point off turnovers, second chance points
                sfPoints += 1
                if previous_turnover:
                    sfPOT += 1
                if secondchance:
                    sfSP += 1

            roster_stats[player][10] += 1
            roster_stats[player][11] += 1
        else: #Missed free throw
            roster_stats[player][11] += 1

def rebounds(player,type):
    global roster_stats,team_stats
    if type.upper() == "OR": #Offensive rebounds
        roster_stats[player][4] += 1
    else: #Defensive rebounds
        roster_stats[player][5] += 1

def turnovers(player1, steal=None):
    global roster_stats,team_stats
    roster_stats[player1][6] += 1 #Turnover
    if steal != None: #If they got a steal
        if steal in roster_stats:
            roster_stats[steal][7] += 1

def lineup_change(new_lineup):
    global roster_stats,team_stats, lineup, sfPoints, opPoints

    if len(lineup) == 0: #Start of the game
        lineup = set(new_lineup)
        return True
    
    guys_in = set()
    guys_out = set()
    for p in new_lineup: #Which guys changed
        if p not in lineup:
            guys_in.add(p)
    for p in lineup:
        if p not in new_lineup:
            guys_out.add(p)
    

    for p in guys_out: #Update Plus Minus
        plus_minus = (sfPoints - opPoints) - (roster_stats[p][13])
        roster_stats[p][12] += plus_minus
        #print(f"{p} came in when the score had a difference of {(roster_stats[p][13])}, score now is {sfPoints} {opPoints}, new +/- is {roster_stats[p][12]}")
    for p in guys_in: #Start of Plus Minus
        roster_stats[p][13] = (sfPoints - opPoints)
    
    lineup = set(new_lineup)
    
def sub_change(sub_in,sub_out):
    global roster_stats,team_stats, lineup, sfPoints, opPoints

    plus_minus = (sfPoints - opPoints) - (roster_stats[sub_out][13])
    roster_stats[sub_out][12] += plus_minus

    #print(f"{sub_out} came in when the score had a difference of {(roster_stats[sub_out][13])}, score now is {sfPoints} {opPoints}, new +/- is {roster_stats[sub_out][12]}")

    roster_stats[sub_in][13] = (sfPoints - opPoints)

    lineup.remove(sub_out)
    lineup.add(sub_in)

#2PM, 2PA, 3PM, 3PA, OR, DR, TO, STL, AST, BLK, FTM, FTA, +/-, DIFF
#  0,   1,   2,   3,  4,  5,  6,   7,    8,  9,  10,  11,  12,   13

#Roster players
roster_stats = {'devin':    [0] * 14, 'alden':    [0] * 14,
                'wes':      [0] * 14, 'max':      [0] * 14,
                'ayaan':    [0] * 14, 'luke':     [0] * 14,
                'john':     [0] * 14, 'james':    [0] * 14,
                'jackson':  [0] * 14, 'yidi':     [0] * 14,
                'derek':    [0] * 14, 'gianni':   [0] * 14, 
                'kingston': [0] * 14, 'zane':     [0] * 14,
                'zayden':   [0] * 14, 'drew':     [0] * 14,
                'op':       [0] * 14
}

names = {'devin': "Devin Turner",
         'alden' : "Alden Visitacion",
         'wes': "Weston Edwards",
         'max': "Max Sequeira",
         'ayaan': "Ayaan Bawa",
         'luke': "Luke Alexander",
         'john': "John Weaver",
         'james': "James Wilson",
         'jackson': "Jackson Corbett",
         'yidi': "Yidi Qin",
         'derek': "Derek Johnson",
         'gianni': "Gianni Rivas",
         'kingston': "Kingston Ng",
         'zane': "Zane Bermudez",
         'zayden': "Zayden Bermudez",
         'drew': "Drew Cumby",
         'op': "Opponent"
         }

fname = ""
opponent_name = input("Opponent facing today: ")
fname = opponent_name
if opponent_name == "":
    names['op'] = opponent_name
    fname = "Stats"

# Create filename with today's date (YYYY-MM-DD)
filename = f"{fname}_{time.strftime('%Y-%m-%d')}.txt"
filename2 = f"{fname}_{time.strftime('%Y-%m-%d')}.txt"
#filename3 = f"plays_{time.strftime('%Y-%m-%d')}.txt"
f = open(filename,"a")
f2 = open(filename2, "a")
#f3 = open(filename3, "a")
f.write("======================\n")
f2.write("======================\n")
#f3.write("======================\n")

tipoff = False
start_time = 0

#OTHER STATS NOT IN THE DICTIONARY
sfPoints = 0
opPoints = 0
sfPOT = 0
opPOT = 0
sfSP = 0
opSP = 0
sfML = 0
sfTOR = 0
sfTDR = 0
sfPOSS = 0
opPOSS = 0

#Booleans
possession = None
previous_turnover = False
secondchance = False

lineup = set()


###############
#PRINTING THE TABLE OF STATS FUNCTION
###############


def printTable(csv_option):
    global roster_stats, lineup

    for p in lineup: #Final update of plus minus
        plus_minus = (sfPoints - opPoints) - (roster_stats[p][13])
        roster_stats[p][12] += plus_minus
        #print(f"{p} came in when the score had a difference of {(roster_stats[p][13])}, score now is {sfPoints} {opPoints}, new +/- is {roster_stats[p][12]}")
        roster_stats[p][13] = sfPoints - opPoints

    # Build rows for tabulate
    table = []

    team_stats = [0] * 13
    for player, stats in roster_stats.items():
        FGM, FGA, TPM, TPA, OR, DR, TO, STL, AST, BLK, FTM, FTA, PM, temp = stats
        
        # Safe percentage calculations  
        fg_pct = 100 * (round((FGM-TPM) / (FGA-TPA), 3) if (FGA-TPA) > 0 else 0)
        tp_pct = 100 * (round(TPM / TPA, 3) if TPA > 0 else 0)
        ft_pct = 100 * (round(FTM / FTA, 3) if FTA > 0 else 0)

        pts = 3*TPM + 2*(FGM-TPM) + 1*FTM
        
        row = [player[0].upper()+player[1:], f"{FGM-TPM}/{FGA-TPA}", fg_pct, f"{TPM}/{TPA}", tp_pct, OR, DR, TO, STL, AST, BLK, f"{FTM}/{FTA}", ft_pct, f"{PM}", pts]
        table.append(row)

        if player != "op":
            team_stats[0] += FGM
            team_stats[1] += FGA
            team_stats[2] += TPM
            team_stats[3] += TPA
            team_stats[4] += OR
            team_stats[5] += DR
            team_stats[6] += TO
            team_stats[7] += STL
            team_stats[8] += AST
            team_stats[9] += BLK
            team_stats[10] += FTM
            team_stats[11] += FTA

    FGM, FGA, TPM, TPA, OR, DR, TO, STL, AST, BLK, FTM, FTA, PM = team_stats
    fg_pct = 100 * (round((FGM-TPM) / (FGA-TPA), 3) if (FGA-TPA) > 0 else 0)
    tp_pct = 100 * (round(TPM / TPA, 3) if TPA > 0 else 0)
    ft_pct = 100 * (round(FTM / FTA, 3) if FTA > 0 else 0)

    row = ["SF", f"{FGM-TPM}/{FGA-TPA}", fg_pct, f"{TPM}/{TPA}", tp_pct, OR, DR, TO, STL, AST, BLK, f"{FTM}/{FTA}", ft_pct, 0, sfPoints]

    # Define headers
    headers = ["Player", "2PM/2PA","2P%", "3PM/3PA", "3P%", "OR", "DR", "TO", "STL","AST","BLK","FTM/FTA","FT%","+/-","Points"]

    # Print nicely
    print(tabulate(table[:-1], headers=headers, tablefmt="grid"))
    print()
    print(tabulate([row,table[-1]], headers=headers, tablefmt="grid"))
    print("=========== Other Stats ==============")
    print(f"SF Points off turnovers: {sfPOT}")
    print(f"OP Points off turnovers: {opPOT}")
    print("")
    print(f"SF Second Chance Points: {sfSP}")
    print(f"OP Second Chance Points: {opSP}")
    print("")
    print(f"SF Missed Layups: {sfML}")
    print("")
    print(f"SF OffRTG: {round(sfPoints/sfPOSS*100,1)}")
    print(f"OP OffRTG: {round(opPoints/opPOSS*100,1)}")

    if csv_option:
        csvinput = input("CSV(y/n): ")
        if csvinput.lower() == "y":
            from datetime import datetime
            timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
            filename = f"stats_{timestamp}.csv"

            new_table = []
            order = "gianni zane alden devin luke wes james kingston max john jackson ayaan derek zayden drew yidi op"
            for name in order.split():
                for tab in table:
                    if tab[0].lower() == name:
                        new_table.append(tab)
                        break

            with open(filename,"a",newline="") as file:
                writer = csv.writer(file)
                writer.writerow(headers)
                for tab in new_table:
                    if tab[0].lower() == 'op':
                        writer.writerow([])
                        continue
                    writer.writerow(tab)
                writer.writerow([])
                writer.writerow(row)
                writer.writerow(new_table[-1])

"""
=======================
    MAIN WHILE LOOP    
=======================
"""

print("Input the Starting Lineup for the game")
while True:
    line = input()

    if line == "exit":
        break

    f.write(line+"\n") #saves all
    
    if line.lower() == "tip" and tipoff != True:
        tipoff = True
        start_time = time.perf_counter()
        f2.write("TIP TIME " + str(start_time) +"\n")
    

    if "---" in line:
        previous_turnover = False
        possession = None
        printTable(False)
        print("Don't forget to input the lineup coming out: ")
        continue
    if line == "":
        continue

    chunks = line.split()


    """
    ---------
    ALL THE "-" COMMANDS
    -l for setting lineups
    -s for substitutions
    -p for possession
    -t for timeout
    ----------
    """

    if chunks[0] == "-l": #Putting a whole new lineup on the floor
        flag = False
        for p in chunks[1:]:
            if p not in roster_stats:
                flag = True
                break
        if flag:
            continue
        try:
            lineup_change(chunks[1:])
            #f3.write("New Lineup for the Lancers: ")
            """
            for i in range(1,6):
                ath = chunks[i]
                if i != 5:
                    f3.write(names[ath] + ", ")
                else:
                    f3.write(names[ath] + "\n")
            """
        except:
            print("N/A")
        
        continue
    elif chunks[0] == "-s": #Substituting player A for player B
        if (chunks[1] not in roster_stats) or (chunks[2] not in roster_stats):
            continue
        try:
            sub_change(chunks[1],chunks[2])
            #f3.write(names[chunks[1]]+" comes in for "+names[chunks[2]])
        except:
            print("N/A")

        continue
    elif chunks[0] == "-p": #Team Offensive Rebounds and Defensive Rebounds
        team_poss = chunks[1].lower()
        if team_poss == "op":
            if possession == False:
                secondchance = True
            elif possession == True:
                possession = False
                secondchance = False
                opPOSS += 1
                #print("Opponent's possession: ", opPOSS)
            
            #f3.write("Possession goes to "+names['op']+"\n")
        else:
            if possession == True:
                secondchance = True
            elif possession == False:
                possession = True
                secondchance = False
                sfPOSS += 1
                #print("Saint Francis possession: ", sfPOSS)
            
            #f3.write("Possession goes to Saint Francis\n")
        
        #print(f"Possession: {possession}; Previous Turnover: {previous_turnover}; Second Chance: {secondchance}")
        continue
    elif chunks[0] == "-t":
        print("Don't forget to input the lineup after the timeout: ")

        #f3.write("Timeout called")
        """
        if len(chunks) == 2:
            f3.write(" by ")
            if chunks[1] == 'sf':
                f3.write("Saint Francis\n")
            else:
                f3.write(names['op']+"\n")
        """
        continue

    if chunks[0] not in roster_stats or (len(chunks) == 4 and "ft" not in chunks and chunks[3] not in roster_stats):
        continue
    
    """
    -------------
    ALL NORMAL STATS
    to: turnovers
    shots
    rebounds
    --------------
    """

    if "to" in chunks: #Turnovers
        if chunks[0] == "op" and possession == True:
            opPOSS += 1
            #print("Opponent's possession: ", opPOSS)
        elif chunks[0] != "op" and possession == False:
            sfPOSS += 1
            #print("Saint Francis Possession: ", sfPOSS)
        
        possession = True if chunks[0] == "op" else False
        if possession:
            sfPOSS += 1
            #print("Saint Francis Possession: ", sfPOSS)
        else:
            opPOSS += 1
            #print("Opponent's possession: ", opPOSS)
        previous_turnover = True
        secondchance = False
        if len(chunks) == 3:
            turnovers(chunks[0],chunks[2])
            #f3.write(names[chunks[0]]+" commits the turnover (stolen by "+names[chunks[2]]+")")
        else:
            turnovers(chunks[0])
            #f3.write(names[chunks[0]]+" commits the turnover")
    elif len(chunks) >= 3: #Shots
        if chunks[0].lower() == "op" and possession == True: #Check if it's the other team shooting
            possession = False
            opPOSS += 1
            #print("Opponent's possession: ", opPOSS)
            previous_turnover = False
            secondchance = False
        elif chunks[0].lower() != "op" and possession == False: #Check if it's the other team shooting
            possession = True
            sfPOSS += 1
            #print("Saint Francis Possession: ", sfPOSS)
            previous_turnover = False
            secondchance = False
        
        #print(f"Possession: {possession}; Previous Turnover: {previous_turnover}; Second Chance: {secondchance}")
        
        if "ft" in chunks:
            free_throws(chunks[0],chunks[2:])
            #f3.write(names[chunks[0]]+ "makes the free throw")
        elif "mis" in chunks[2] or "blocked" in chunks[2]:
            if len(chunks) == 4:
                shots(chunks[0],chunks[1],False,chunks[3]) #Block
                #if chunks[1] == "three":
                    #f3.write(names[chunks[0]]+"'s three pointer is blocked ("+chunks[3]+")\n")
            else:
                shots(chunks[0],chunks[1],False)
        else:
            if len(chunks) == 4:
                shots(chunks[0],chunks[1],True,chunks[3]) #Assist
            else:
                shots(chunks[0],chunks[1],True)
        
        if tipoff and "ft" not in chunks:
            shot_time = time.perf_counter() - start_time
            f2.write(str(shot_time)+" "+chunks[1]+"\n")

    else: #Rebounds
        rebounds(chunks[0],chunks[1])
        if chunks[1] == "dr":
            possession = False if chunks[0] == "op" else True
            if possession == False:
                opPOSS += 1
                #print("Opponent's possession: ", opPOSS)
            else:
                sfPOSS += 1
                #print("Saint Francis Possession: ", sfPOSS)
            
            previous_turnover = False
            secondchance = False
        else:
            secondchance = True
        
        #print(f"Possession: {possession}; Previous Turnover: {previous_turnover}; Second Chance: {secondchance}")
    
f.close()
f2.close()
#f3.close()

printTable(True)

"""
if response:
    fshot = open(filename2,"r")
    L = list(fshot)

    starting_index = 0
    for i in range(len(L)-1,-1,-1):
        line = L[i]
        if "======" in line:
            starting_index = i
            break

    tip_time = 0
    tip_flag = True
    inp = input("Would you like to enter in your own tipoff time?: ")
    if inp != "":
        tip_time = float(inp)
        tip_flag = False

    shot_index = 1
    for i in range(starting_index+1,len(L)):
        line = L[i].split()
        if "TIP" in line and tip_flag:
            tip_time = float(line[2])
            continue

        shot_time = float(line[0])
        shot_type = line[1]

        if "layu" in shot_type:
            frame_number = int(fps * shot_time) - int(fps*0.9)
        elif "tw" in shot_type:
            frame_number = int(fps * shot_time) - int(fps*1.0)
        elif "thre" in shot_type:
            frame_number = int(fps * shot_time) - int(fps*1.2)

        
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_number)
        ret, frame = cap.read()

        max_frames = int(fps * 2.5)
        frames_back = 0

        name = "TestingDayShot "+str(shot_index)
        while not(image_estimation(ret,frame,name)) and frames_back < max_frames:
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_number-frames_back)
            ret, frame = cap.read()
            frames_back += 5
        shot_index += 1
"""
