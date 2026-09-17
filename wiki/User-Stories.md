# User Stories

Effort is in Fibonacci numbers, sized against Pictures of entrances (55). The six stories add up to 322.

## 1: Pictures of entrances

Story: As a Freshman, I need pictures of the entrances of the building, so I can use them as landmarks for the map entrances.

Elaboration: Since the blueprints for the insides of the buildings have no indication of which entrance you are at we need to have a picture of the entrance, so you could cross reference with the entrance you are at.

Constraints: Photos have to be ones we take ourselves of the real entrance.

Effort Estimation: 55

Acceptance Test: Test every entrance picture that was stored and cross reference them with the real life entrance to make sure they match up and that it is easily recognizable.

## 2: Campus map

Story: As a new student, I want to see a map of campus with the buildings marked and named so that I can learn where my classes are.

Elaboration: The map opens on the Las Cruces campus. Buildings we support have a button with the building name above it. You can drag and zoom.

Constraints: Has to work in a phone browser with no login.

Effort Estimation: 34

Acceptance Test: Open the site on a phone. Check that the map shows campus and all 10 buildings have a button. Zoom in and check the names show. Drag and zoom and make sure it doesn't lag.

## 3: Search for a room

Story: As a student, I want to search for a room the way it's written on my schedule (like SH 118A) so that I can find my class without knowing what the building code means.

Elaboration: Search takes building names, building codes, and rooms (SH 118A, sh118a, 118A). Tapping a result goes to that building.

Constraints: Only rooms from NMSU's class schedule or our floor plans show up. If nothing matches it says so.

Effort Estimation: 34

Acceptance Test: Search SH 118A, sh118a, and HJLC 225 and check they find the right room. Search SH 205 (not a real room) and check nothing comes up.

## 4: Building floor plan

Story: As a student with a class in a new building, I want to see the building's floor plan so that I know where to go before I get there.

Elaboration: The building page shows our floor plan and a photo of the evacuation map posted in the building. You can switch floors and zoom in.

Constraints: Floor plans have to come from the posted evacuation maps.

Effort Estimation: 55

Acceptance Test: Open Hardman and Jacobs, switch between our plan and the posted map, switch to floor 2, and zoom in. Open a building without a floor plan and check it says it's not available.

## 5: Directions

Story: As a student walking to class, I want directions to the building so that I get there on time.

Elaboration: The user picks a building and taps the directions button. The app asks if they want directions, then shows a route and turn-by-turn steps. They can pick walking, biking, or driving.

Constraints: Needs location permission. Routes use real paths and roads from OpenStreetMap.

Effort Estimation: 89

Acceptance Test: Start directions to Zuhl Library and check a route shows up with steps. Switch between walk, bike, and drive and check the route changes. End the trip and check it asks first.

## 6: Find the room inside

Story: As a student inside a building, I want to see my room highlighted with a path to it so that I don't have to wander the halls.

Elaboration: Tapping a room on the floor plan highlights it and shows arrows from the nearest door or stairs. It also asks if you want directions to that room.

Constraints: Arrows only go through hallways on the floor plan.

Effort Estimation: 55

Acceptance Test: Open Hardman and Jacobs, tap room 125, and check it's highlighted with arrows from a door. Tap room 228 and check the arrows start at the stairs on floor 2.
