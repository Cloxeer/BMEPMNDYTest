# User Stories

[← Back to Home](Home)

These are the things our **users** should be able to do with Better NMSU Maps, not what we as developers want. Every story follows the same format:

> **As a** [type of user], **I want** [to do something] **so that** [the real reason it matters to them].

**How we estimated effort:** Fibonacci numbers (1, 2, 3, 5, 8, 13, 21, 34…). They're relative, so a 21 is a lot more work than an 8, not "21 hours." We're treating the whole project as about **233** points. These are our best guesses right now, and we'll adjust them once we see how our first sprint actually goes.

**How the numbering works:** a top-level story is a big feature (like `4`). A dotted number (like `4.2`) is a smaller piece of that feature.

**How we'll test them:** every story has an acceptance test. Wax (Design & QA) runs them on real phones, and our Fact & Number Checker confirms that any rooms, codes, distances, or times shown are correct.

## Summary

| # | Title | Effort |
|---|---|---|
| 1 | See NMSU on a clear campus map | 21 |
| 2 | Search for a room from my class schedule | 21 |
| 3 | Look at a building's floor plan before I go | 21 |
| 4 | Get directions to a building | 34 |
| 4.1 | Choose walking, biking, or driving | 13 |
| 4.2 | Follow turn-by-turn steps | 13 |
| 4.3 | Know when I've arrived | 8 |
| 5 | Find my way to the room inside the building | 21 |
| 6 | Jump to any NMSU location | 8 |
| 7 | Pick up where I left off | 5 |
| | **Total** | **131** |

*(Stories 4.1–4.3 are part of story 4, so the total counts them instead of story 4's own 34.)*

---

## 1: See NMSU on a clear campus map

**Story:** As a new student, I want to see the NMSU campus on a clean map with every building I might have class in clearly marked and named, so that I can learn my way around campus before my first day.

**Elaboration:** The map should open straight to the Las Cruces campus. NMSU property is lightly highlighted and everything else is faded, so it's obvious what's part of campus. Each supported building gets a tappable "i" button with its name above it. When names would overlap, some hide, and they come back as you zoom in. It needs to feel like the map apps students already use: drag to move, pinch to zoom, smooth the whole time.

**Constraints:** Must work in a phone browser with no login and no download. Must stay smooth on older, cheaper phones. Campus boundaries must come from NMSU's official map data, not be drawn by hand. Building names can be turned off in Settings.

**Effort Estimation:** 21

**Acceptance Test:** Open the site on an iPhone and a low-end Android phone. Check that the map opens on campus, NMSU property is highlighted, and all 10 supported buildings show a button (and, zoomed in, a name). Zoom out until names overlap and confirm some hide and then reappear when zooming back in. Drag and pinch for 30 seconds and confirm there's no stutter or lag. Turn off "Building names" in Settings, then reload, and confirm the names stay hidden.

---

## 2: Search for a room from my class schedule

**Story:** As a student with my class schedule open, I want to type the room exactly the way my schedule shows it (like "SH 118A") and have the app find it, so that I don't have to figure out building codes before I can find my class.

**Elaboration:** Schedules use Registrar codes ("SH" = Science Hall, "HJLC" = Hardman and Jacobs). Search should understand a code plus room (`SH 118A`), code and room typed together (`sh118a`), just a room (`118A`), a building name, and small typos (`harmon jacobs`). Matching letters are highlighted in the results. Tapping a result flies the map to that building and opens its page. Rooms should come from NMSU's public class schedule and our floor plans, so we never list a room that doesn't exist.

**Constraints:** Only rooms found in official sources are listed; if a room isn't found, show "No buildings or rooms match" instead of guessing. Results only appear after the user starts typing.

**Effort Estimation:** 21

**Acceptance Test:** Search `SH 118A`, `sh118a`, `118A`, `HJLC 225`, `hardman jacobs 125`, and `harmon jacobs`, and confirm each finds the correct room or building. Search a room that doesn't exist (`SH 205`) and confirm "No buildings or rooms match" appears. Tap a room result and confirm the map flies to the right building and its page opens on the correct floor.

---

## 3: Look at a building's floor plan before I go

**Story:** As a student with a class in a building I've never been in, I want to see that building's floor plan and a photo of the evacuation map posted inside, so that I know the layout before I walk in.

**Elaboration:** Tapping a building opens a page with a switch between "Our plan" (a clean redrawn plan) and "Posted map" (a photo of the real map on the wall). You can swipe between them. Either one opens full screen with pinch-to-zoom. A floor button at the bottom switches floors. The page also shows photos, a description, and facts (address, building code, year built, floors). Every building page uses the same layout; if something isn't available yet, it says so, for example "If you don't see it here, we haven't taken a photo yet."

**Constraints:** Floor plans must be traced from the posted evacuation maps, not invented. Only one full-screen viewer can be open at a time.

**Effort Estimation:** 21

**Acceptance Test:** Open Hardman and Jacobs. Switch between "Our plan" and "Posted map" by tapping and by swiping, and confirm the switch follows along. Change to floor 2 and confirm both views update. Open a plan full screen, pinch to zoom, and close it. Open a building with no floor plan (Zuhl Library) and confirm it shows the same sections with "not available yet" messages instead of blank space.

---

## 4: Get directions to a building

**Story:** As a student heading to class, I want directions from where I am to the building, so that I get there on time without having to ask anyone.

**Elaboration:** Every building page has a "Get directions" button. The app uses the phone's location and finds the shortest real route along mapped paths and roads, drawn on the map as a blue line with arrows. It updates as the student moves. The navigation bar changes to "To [place]" so it's clear where you're headed. If directions are already running to a different place, the app asks before switching. Ending a trip asks "Are you sure you want to end your trip?" first. Stories 4.1–4.3 break this feature into smaller pieces.

**Constraints:** Needs location permission; if it's denied, explain how to turn it on. Routes may only use real paths and roads from OpenStreetMap. If the user is far from campus, say that directions work on campus.

**Effort Estimation:** 34

**Acceptance Test:** Tap "Get directions" on Zuhl Library, allow location, and confirm a route appears and the title says "To Zuhl Library." While it's running, open Science Hall and tap directions again; confirm the "Change destination?" question appears and that both "Keep current" and "Switch" work. Tap X and confirm the "end your trip?" question. Deny location permission and confirm a helpful message appears.

### 4.1: Choose walking, biking, or driving

**Story:** As a commuter student, I want to switch between walking, biking, and driving directions, so that the route and time fit how I'm actually getting to campus.

**Elaboration:** The directions card has a Walk / Bike / Drive switch. Each mode uses routes allowed for that mode: bikes skip stairs, cars only use roads, and one-way streets stay one-way. The time estimate changes with the mode, and the app remembers the last mode you picked.

**Constraints:** Must not cover the next-turn information. Route rules must come from OpenStreetMap's access information.

**Effort Estimation:** 13

**Acceptance Test:** Start directions, open the card, and switch between Walk, Bike, and Drive. Confirm the route line, steps, and time change each time. Check that a bike route never uses stairs and a driving route never goes the wrong way on a one-way street. Reload the page and confirm the last chosen mode is still selected.

### 4.2: Follow turn-by-turn steps

**Story:** As a student walking to class, I want to see my next turn, how far it is, and when I'll arrive, so that I can keep moving without studying the map.

**Elaboration:** A card at the bottom shows the next turn ("590 ft · Turn right onto Williams Avenue") with an arrow icon, plus total time, distance, and arrival time. Tapping the card expands it to list every step, like Apple Maps. A beam on the location dot shows which way the student is facing.

**Constraints:** Distances in feet and miles by default. The card must fold back up so it doesn't block the map.

**Effort Estimation:** 13

**Acceptance Test:** Start directions from a known spot. Compare the card's first turn and street name to the route drawn on the map. Tap the card, confirm every step is listed in order and ends with "Arrive at …", then tap again to fold it. Rotate the phone and confirm the facing beam turns with it.

### 4.3: Know when I've arrived

**Story:** As a student following directions, I want the app to tell me when I've reached the building and show me where to go next, so that I'm not left guessing at the door.

**Elaboration:** When the student reaches the building's official outline (or gets within a few metres of its wall, since GPS drifts near buildings), directions end and the building page opens with a green "You've arrived" banner, on the floor of their room if they chose one.

**Constraints:** Phone GPS can't tell which floor or room you're in, so arrival is detected at the building level only.

**Effort Estimation:** 8

**Acceptance Test:** Start directions to Hardman and Jacobs room 228 and walk to the building. Confirm the banner appears at the entrance and the floor plan opens on floor 2 with room 228 highlighted. Repeat for a building with no floor plan and confirm the banner doesn't mention a plan.

---

## 5: Find my way to the room inside the building

**Story:** As a student standing inside an unfamiliar building, I want to see my room highlighted on the floor plan with a path to it, so that I can walk straight there instead of wandering the halls.

**Elaboration:** Choosing a room (from search, or by tapping it on the plan) highlights it in light blue. Arrows on the plan show the shortest way through the hallways from the nearest outside door (floor 1) or the nearest stairs (upper floors) to the room. The caption says where the arrows start, for example "Room 228 · Floor 2 · from the nearest stairs."

**Constraints:** Paths may only go through open hallway space on the traced plan, never through rooms or walls. The posted maps don't show room doors, so arrows stop at the edge of the room.

**Effort Estimation:** 21

**Acceptance Test:** Open Hardman and Jacobs, tap Lecture Hall 125 on floor 1, and confirm it turns blue with arrows from an outside door that stay in the hallways. Tap Classroom 228 and confirm the plan switches to floor 2 with arrows starting at the stairs. Compare both paths to the photo of the posted map to confirm they follow real hallways.

---

## 6: Jump to any NMSU location

**Story:** As a parent or visitor, I want a list of every NMSU location sorted by distance, so that I can find the right place even if it isn't on the main campus.

**Elaboration:** The menu has a Locations page listing NMSU sites in two groups, "Las Cruces" and "Around New Mexico," each with its city, size, and distance. Tapping one closes the page and moves the map there.

**Constraints:** Only real NMSU locations from official NMSU property data. No high schools or leased commercial land, since classes aren't held there.

**Effort Estimation:** 8

**Acceptance Test:** Open Menu → Locations and confirm the list is sorted nearest first, with distance on the right. Tap "Horse Farm" and confirm the map moves there. Tap a location outside Las Cruces and confirm the map can move that far.

---

## 7: Pick up where I left off

**Story:** As a returning student, I want the app to remember my last search, my travel mode, and my settings, so that I don't have to redo them every time I open it.

**Elaboration:** If a student types "SH," closes search, and comes back later, "SH" is still there until they clear it with the round x. The last travel mode and the "Building names" setting are also remembered. Everything is saved only on the student's own device, with no account.

**Constraints:** Must still work if the browser blocks storage (for example, private browsing); in that case nothing is remembered, but nothing breaks. No personal data is sent anywhere.

**Effort Estimation:** 5

**Acceptance Test:** Type "sh," close search, and reload the page; confirm "sh" is still there. Clear it with the x, reload, and confirm the box is empty. Type "sdfcv," reload, and confirm it's still there until removed. Switch travel mode to Bike and reload; confirm Bike is still selected. Repeat in a private browsing window and confirm the app works with nothing remembered.
