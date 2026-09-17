# User Stories

Effort is in Fibonacci numbers, sized against Pictures of entrances (55). We are treating the whole project as about 377. These 12 stories add up to 333; the rest is for stories we add later.

## 1: Pictures of entrances

Story: As a Freshman, I need pictures of the entrances of the building, so I can use them as landmarks for the map entrances.

Elaboration: Since the blueprints for the insides of the buildings have no indication of which entrance you are at we need to have a picture of the entrance, so you could cross reference with the entrance you are at.

Constraints: Photos have to be ones we take ourselves of the real entrance.

Effort Estimation: 55

Acceptance Test: Test every entrance picture that was stored and cross reference them with the real life entrance to make sure they match up and that it is easily recognizable.

## 2: Campus map

Story: As a new student, I want to see the campus map with every building I might have class in marked and named so that I know where things are before my first day.

Elaboration: The map opens on main campus. Each building has a badge with its name above it. Tapping a badge opens that building's page with its address, building code, year built and floors.

Constraints: Works in a phone browser with no login. Building facts come from NMSU's official records.

Effort Estimation: 21

Acceptance Test: Open the site on a phone, tap Hardman and Jacobs, and check the facts match NMSU's records. Drag and zoom and check it doesn't lag.

## 3: Search for my room

Story: As a student, I want to type a room the way it's written on my schedule (like SH 118A) so that I don't have to figure out what the building code means.

Elaboration: Search finds buildings by name, code or address, and rooms like "SH 118A", "sh118a" or "hjlc 225". Small typos still work ("harmon" finds Hardman). Tapping a result goes to the building and its room.

Constraints: Only rooms from NMSU's class schedule or our floor plans. If nothing matches it says so.

Effort Estimation: 34

Acceptance Test: Search SH 118A, sh118a and harmon and check the right results come first. Search a room that doesn't exist and check it says no match.

## 4: Building floor plans

Story: As a student with a class in a building I've never been in, I want to see its floor plan so that I know which way to go once I walk in.

Elaboration: The building page has our floor plan and a photo of the evacuation map posted in the building. You can swipe between them, switch floors and zoom in.

Constraints: Our plans are traced from the posted evacuation maps. A building without a plan says so.

Effort Estimation: 55

Acceptance Test: Open Hardman and Jacobs, swipe between our plan and the posted map, switch to floor 2 and zoom in. Open a building with no plan and check the message shows.

## 5: Directions to class

Story: As a student running late, I want walking directions from where I am to my class so that I get there on time.

Elaboration: The directions button asks before starting, then shows a route on real paths with the next turn, time and distance. You can switch to biking or driving. When you walk in, the building page opens.

Constraints: Needs location permission. Paths and roads come from OpenStreetMap.

Effort Estimation: 55

Acceptance Test: Start directions to Zuhl Library and check a route and steps show. Switch to bike and drive and check the route changes. Walk into the building and check the page opens with "You've arrived".

## 6: Find the room inside

Story: As a student inside a building, I want my room highlighted with arrows to it so that I don't wander the halls looking for it.

Elaboration: Tapping a room on the floor plan highlights it and draws arrows from the nearest door or stairs. It asks if you want directions to that room.

Constraints: Arrows only go through open hallway on the floor plan.

Effort Estimation: 34

Acceptance Test: Open Hardman and Jacobs, tap room 125 and check it's highlighted with arrows from a door. Tap a room on floor 2 and check the arrows start at the stairs.

## 7: Where to park

Story: As a commuter student, I want to see every parking lot with its permit color so that I park where my permit is allowed and don't get a ticket.

Elaboration: Turning on Parking in Map filters colors every lot by its permit (orange all permits, green commuter, crimson faculty/staff, brown free). Tapping a lot shows its name, permit color and who can park there.

Constraints: Lots and permits come from NMSU's official parking map data. Parking is off until you turn it on.

Effort Estimation: 21

Acceptance Test: Turn on Parking, tap a green lot and check it says Commuter Student. Compare five lots with NMSU's parking map.

## 8: Where to eat

Story: As a student with a short break between classes, I want to find the food places on campus so that I can get something to eat nearby.

Elaboration: Food places show on the map and in search (like Subway or La Jefa). Each one says what it is and which building it's inside.

Constraints: Only places NMSU Dining lists as open.

Effort Estimation: 13

Acceptance Test: Search Subway and check it goes to O'Donnell Hall. Check every food place against NMSU Dining's Where to Eat page.

## 9: Find my housing

Story: As a student living on campus, I want to find my residence hall or apartment on the map so that I can find my way home and tell my friends where I live.

Elaboration: Every NMSU Housing community has an orange badge and shows up in search and on the Locations page.

Constraints: Only communities NMSU Housing offers.

Effort Estimation: 8

Acceptance Test: Search Chamisa Village and Vista Del Monte and check both come up in the right place. Compare the list with NMSU Housing's website.

## 10: Choose what the map shows

Story: As a student, I want to choose which kinds of places show on the map so that it only shows what I care about.

Elaboration: The Map filters button turns Study, Housing, Parks, Food, Staff Academic, Historic and Parking on or off. Settings lets you pick which of those are in the button. Map settings has my location, turn map with me, building names, a compass and home.

Constraints: Choices are remembered on your phone only.

Effort Estimation: 21

Acceptance Test: Turn off Study and check its badges hide. Add Parking in Settings and check it shows in the button. Reload and check the choices are still there.

## 11: Fast on campus Wi-Fi

Story: As a student walking between classes on weak Wi-Fi, I want the map to open fast every time so that I'm not stuck waiting while I'm trying to find my room.

Elaboration: After the first visit the app opens from a copy saved on the phone, and it still works with no signal. Big files like parking lots only download when you use them.

Constraints: The first visit needs internet.

Effort Estimation: 8

Acceptance Test: Open the site, close it, turn on airplane mode and open it again. Check the map, search and building pages still work.

## 12: Other NMSU locations

Story: As a visitor, I want a list of all NMSU properties so that I can find places that aren't on main campus.

Elaboration: The menu has an Other Locations page sorted by distance. Tapping one moves the map there.

Constraints: Only official NMSU properties.

Effort Estimation: 8

Acceptance Test: Open Other Locations, check it's sorted by distance, tap Horse Farm and check the map moves there.
