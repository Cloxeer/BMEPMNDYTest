# User Stories

Effort is in Fibonacci numbers. We are treating the whole project as about 233.

## 1: Campus map

Story: As a new student, I want to see a map of campus with the buildings marked and named so that I can learn where my classes are.

Elaboration: The map opens on the Las Cruces campus. Buildings we support have a button with the building name above it. You can drag and zoom.

Constraints: Has to work in a phone browser with no login.

Effort Estimation: 21

Acceptance Test: Open the site on a phone. Check that the map shows campus and all 10 buildings have a button. Zoom in and check the names show. Drag and zoom and make sure it doesn't lag.

## 2: Search for a room

Story: As a student, I want to search for a room the way it's written on my schedule (like SH 118A) so that I can find my class without knowing what the building code means.

Elaboration: Search takes building names, building codes, and rooms (SH 118A, sh118a, 118A). Tapping a result goes to that building.

Constraints: Only rooms from NMSU's class schedule or our floor plans show up. If nothing matches it says so.

Effort Estimation: 21

Acceptance Test: Search SH 118A, sh118a, and HJLC 225 and check they find the right room. Search SH 205 (not a real room) and check nothing comes up.

## 3: Building floor plan

Story: As a student with a class in a new building, I want to see the building's floor plan so that I know where to go before I get there.

Elaboration: The building page shows our floor plan and a photo of the evacuation map posted in the building. You can switch floors and zoom in.

Constraints: Floor plans have to come from the posted evacuation maps.

Effort Estimation: 21

Acceptance Test: Open Hardman and Jacobs, switch between our plan and the posted map, switch to floor 2, and zoom in. Open a building without a floor plan and check it says it's not available.

## 4: Directions

Story: As a student walking to class, I want directions to the building so that I get there on time.

Elaboration: The user picks a building and taps the directions button. The app asks if they want directions, then shows a route and turn-by-turn steps. They can pick walking, biking, or driving.

Constraints: Needs location permission. Routes use real paths and roads from OpenStreetMap.

Effort Estimation: 34

Acceptance Test: Start directions to Zuhl Library and check a route shows up with steps. Switch between walk, bike, and drive and check the route changes. End the trip and check it asks first.

## 5: Find the room inside

Story: As a student inside a building, I want to see my room highlighted with a path to it so that I don't have to wander the halls.

Elaboration: Tapping a room on the floor plan highlights it and shows arrows from the nearest door or stairs. It also asks if you want directions to that room.

Constraints: Arrows only go through hallways on the floor plan.

Effort Estimation: 21

Acceptance Test: Open Hardman and Jacobs, tap room 125, and check it's highlighted with arrows from a door. Tap room 228 and check the arrows start at the stairs on floor 2.

## 6: Map settings

Story: As a student using the map, I want to turn on my location and have the map face the way I'm facing so that it's easier to follow while walking.

Elaboration: A map settings button opens options: show my location, turn the map with me, go back to campus, and show building names. Options that are on are red and options that are off are white.

Constraints: Needs location and compass permission on the phone.

Effort Estimation: 13

Acceptance Test: Open map settings and turn on location, check the dot shows and the option is red. Turn on "turn map with me," rotate the phone, and check the map turns. Tap back to campus and check the map goes back. Turn options off and check they go white.

## 7: NMSU locations

Story: As a visitor, I want a list of all NMSU locations so that I can find places that aren't on the main campus.

Elaboration: The menu has a Locations page sorted by distance. Tapping one moves the map there.

Constraints: Only real NMSU locations.

Effort Estimation: 8

Acceptance Test: Open Locations, check it's sorted by distance, tap Horse Farm and check the map moves there.

## 8: Pictures of entrances

Story: As a freshman, I want pictures of the entrances of each building so that I can use them as landmarks to find the right door.

Elaboration: Entrances are marked on the floor plan. Tapping one opens a photo of that entrance. If we don't have a photo yet, it says so.

Constraints: Photos have to be ones we take ourselves of the real entrance.

Effort Estimation: 8

Acceptance Test: Open Hardman and Jacobs floor 1 and tap each entrance marker. Check that it opens the photo for that entrance, or the "we haven't taken a photo of this entrance yet" message if there isn't one.
