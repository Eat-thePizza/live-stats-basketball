answer = "three,two,layup,layup,three,layup,layup,three,three,three,three,three,three,layup,two,two,layup,layup,three,layup,three,layup,two,layup,layup,three,layup,two,layup,three,layup,two,three,layup,layup,three,three,three,three,two,layup,three,layup,layup,three,layup,three,three,three,two,three,three,layup,layup,three,two,layup,layup,layup,layup,layup,two,three,layup,three,layup,layup,two,layup,three,layup,layup,three,layup,three,three,three,layup,three,layup,three,layup,three,three,three,two,three,layup,three,layup,layup,layup,two,two,two"
answer_key = answer.split(",")

layup_distance = {"ap":0,"me":0,"ce":0}
two_distance   = {"ap":0,"me":0,"ce":0}
three_distance = {"ap":0,"me":0,"ce":0}

layup_frame = {"asf":0,"hef":0,"pef":0,"cef":0}
two_frame   = {"asf":0,"hef":0,"pef":0,"cef":0}
three_frame = {"asf":0,"hef":0,"pef":0,"cef":0}

i = 0
while True:
    inputs = input()
    if inputs == "exit":
        break
    
    distance_class = inputs[-7:-5]
    frame_class = inputs[-3:]

    if answer_key[i] == "layup":
        layup_distance[distance_class] += 1
        layup_frame[frame_class] += 1
    elif answer_key[i] == "two":
        two_distance[distance_class] += 1
        two_frame[frame_class] += 1
    else:
        three_distance[distance_class] += 1
        three_frame[frame_class] += 1

    i += 1

print("Table")
print("---------")
print(layup_distance)
print(two_distance)
print(three_distance)
print("----------")
print(layup_frame)
print(two_frame)
print(three_frame)



        


    
