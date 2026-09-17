# Better NMSU Maps — Task Tracker

Every request from the product owner, kept here so nothing gets lost.
Status: [ ] todo · [~] in progress · [x] done (verified in browser)

## Ground rules (apply to everything)
- No invented data. Every coordinate, boundary, photo, and fact needs a real, citable source.
- Simple code a first-year CS student can read. Every file + function commented.
- Spacing only on the 4px scale (4/8/12/16/20/24/32/48).
- Mobile first, still right on desktop. Check every page for size and alignment.
- Be careful with tokens.

## 5 Milestones
1. **Correct bounds.** Every NMSU property drawn from real data: main campus, golf course, horse farm, far sites.
2. **Apple-grade map UI.** Squircle corners, a small clean pill, morphing floor pills, no lag.
3. **Floor plans you can trust.** Real building outline, even walls, doors shown, SVG ↔ NMSU plan toggle.
4. **Building info that beats NMSU's.** Real photos plus facts, for 10 buildings.
5. **Wayfinding.** Get from A to B across campus, to the right door, then blue `>>>` chevrons to the room.

## Map / bounds
- [x] No stray bits: detached pieces and holes under 3 acres dropped, strips under ~20 m removed (tools/build_campuses.py)
- [x] Main campus boundary: official NMSU Space Planning layer (replaced the OSM version)
- [x] NMSU Golf Course boundary: inside official **East Campus** (verified against OSM way/50280146)
- [x] Horse Farm boundary: official NMSU Space Planning layer (OSM has none)
- [x] All 33 official properties from NMSU Space Planning (ArcGIS Campus Boundaries); 8 nearby on map, the rest on the Locations page
- [x] Rule: only NMSU places where classes could happen
- [x] Excluded **North Campus** (Toucan, McDonald's, Lorenzo's, Speedway, Pan Am Plaza)
- [x] Excluded **East Campus** (Centennial High School, Farm & Ranch Heritage Museum); golf course drawn on its own from OSM way/50280146
- [x] NMSU's 22 official **Ground Lease** parcels are CUT OUT of the campus shapes (tools/build_campuses.py), so that land shows the real map, muted
- [x] Hid unverified basemap business labels (e.g. the wrong "Campus Bookstore" pin)
- [x] Map fence fits the nearby properties; picking a far site lifts it
- [x] Colour basemap (Liberty), campus highlighted, outside muted
- [x] Building pin drawn in the map layer, so it doesn't lag

## UI
- [x] Pill says "Tap a building" when nothing is chosen; "Info" only when a building is chosen
- [x] Search highlights the typed letters in results
- [x] Search: tapping it lets go of the selected building; results only after typing; one prompt; icon toggles closed
- [x] Selected building badge: white ring becomes a black ring (same size, no jump)
- [x] Building codes match NMSU Registrar (records.nmsu.edu): HJLC, ZL, BL, SH, BC, JH, BD, EC2, EN; Corbett (CC) not on that list
- [x] Map credits start collapsed; "Open on NMSU's official map" link opens
- [x] Pill: smaller, cleaner; orb removed; Info has a ^ that flips when open
- [x] ONE pill that never moves: Info ^ → Floor N ^ while the sheet is open (until X); ^ reveals the other floors stacked above; picking hides them
- [x] Squircle corners via `corner-shape: squircle` (NOT supported on iPhone Safari yet; falls back to rounded)
- [x] Sheet switch: Our plan / Posted map. NMSU does NOT publish floor plans (Space Planning gives them on request only)
- [ ] Add the posted-map photos (data/floors/hjlc-1-posted.jpg, hjlc-2-posted.jpg). Team must add these files
- [ ] Alignment and size pass on EVERY page (map, sheet, menu, schedule, settings, welcome, search)
- [x] Nav: centred title, X to close; Schedule/Settings full page
- [x] Pill sits above the map credits

## Floor plans
- [x] Redraw HJLC F1/F2 to match the real outline (not rectangles)
- [x] Even wall thickness (one exterior, one interior weight)
- [x] Exits shown where the posted plan shows them
- [x] Tap the plan for full-screen pinch-zoom
- [ ] Room anchors + corridors (needed for wayfinding)

## Building info
- [x] Description / address / property no. (HJLC)
- [~] Photos: free licences exist for only Zuhl, Branson, Goddard (downloaded + credited in data/photos.json). None for HJLC. NMSU's official photos are NOT used (permission unconfirmed). Team photos are the plan
- [x] 10 buildings live: HJLC, Zuhl, Corbett, Branson, Science Hall, Business Complex, Jett, Breland, Hernandez, Clara Belle Williams
- [x] 15 more (most class sections in Fall 2026 + Spring 2027 schedule, academic): O'Donnell, Music, Chemistry, Foster, Domenici, Milton, Gerald Thomas, HSS, Gardiner, EC3, Devasthali, Communication Sciences, Guthrie, Skeen, Center for the Arts
- [ ] Devasthali Hall floor count (NMSU doesn't publish one; count it on site)
- [x] Settings: travel mode, units, reset saved choices, data sources with version, credit; selected badge ring Apple blue; Home = Corbett Center
  - Name, building code, number, address, year built, floors: NMSU Space Planning Buildings layer (Corbett floors from OSM; NMSU doesn't list them)
  - Badge position: NMSU's official building point. Link: each building's page on map.nmsu.edu
- [ ] Floor plans for the other 9 (needs posted evacuation-map photos from the team)
- [ ] Descriptions for the other 9 (not copied from NMSU; team to write or get permission)

## Wayfinding
- [ ] Route A → B on the real footpath network (data/paths.geojson, 708 ways)
- [ ] Show the entrance door to use
- [ ] Blue translucent `>>>` chevrons from the door to the room

## Code quality
- [x] config.yml holds every changeable value; js/core/config.js turns it into CONFIG + CSS variables
- [x] Store has named actions (selectBuilding, closeSheet, ...) instead of raw state patches
- [x] Removed band-aids: global page padding override, !important specificity fights, menu nth-child delays, map.__fence, init-order dependency, orb leftovers
- [x] tools/build_buildings.py rebuilds data/buildings.geojson (byte-identical to before)
- [x] Unused raw data moved to data/source/
- [x] docs/ARCHITECTURE.md and README rewritten to match the real app
- [x] Refactor verified with a before/after snapshot of computed styles, map layers, badge pixels and flows: 0 differences on mobile and desktop
- [x] Code review fixes: search open/closed comes only from the store (tapping the map mid-search now closes it); a late "closed" event can no longer shut a re-opened sheet; pill screen-reader label matches the visible text; all data escaped via js/html.js with https-only links; tools run from any folder
- [x] Move remaining JavaScript-written texts into config.yml
- [x] Pill 12px lower; location button left of the pill
- [x] Sheet opens after the map focuses on the building (0.2s after a tap, 0.3s after search)
- [x] One sheet layout for every building; floor pill for every multi-floor building
- [x] Floor pills glide out of / back into the main pill; label fades between words
- [x] Full-screen floor plan viewer: opens above the sheet, one at a time
- [x] Room search ("SH 118A", "hjlc 225", small typos) from our floor plans + NMSU class schedule
- [x] Chosen room highlighted light blue on its floor plan
- [x] Get directions: walking route with arrows (OpenStreetMap paths), sheet opens on arrival
- [ ] Floors/outlines for schedule-only rooms (needs posted evacuation maps for each building)
- [x] Icon-only directions button; tap a room on the plan; directions to that room
- [x] Turn-by-turn card (next turn, walking time, distance, arrival time)
- [x] Swipeable plan / posted-map slides
- [x] Indoor arrows on our plans from the nearest outside door / stairs (tools/indoor_routes.py)
- [x] Plan / posted map rebuilt on Framework7's Swiper (switch follows the swipe, no flicker)
- [x] Compass beam on the location dot; "To {place}" navbar title; step list; "end your trip?" confirm
- [x] Faster, ease-out flight to a building (650 ms); building names above badges with a Settings switch; 2x pixel-ratio cap for smooth cheaper phones
- [x] Walk / Bike / Drive switch on the directions card (OSM networks, one-way streets respected)
- [x] Search remembers what was typed on this device until cleared
- [x] "Change destination?" prompt when directions are already on
- [x] Posted evacuation-map photos for Hardman and Jacobs floors 1-2
- [x] Map settings button (My location, Turn map with me, Building names, Back to campus; red = on, white = off)
- [x] Directions button moved to the bottom (replaces Map settings when a building is selected); asks before starting; tapping a room asks too
- [x] Faster building fly-in (420 ms) and sheet opening
- [x] Favicon and home-screen icon; Schedule page and Report a problem button removed; building opens faster (320 ms)
- [x] Tappable entrances on floor plans (photo, or a note from us if there isn't one yet)
- [x] 20 more buildings (15 next by class sections, 5 residence halls); 5 campus parks
- [x] Map filters button: Study (crimson), Living (orange), Parks (green); badges use the same colours
- [x] Settings: simpler data note; website version at the bottom
- [x] Code rewritten for first-time coders: folders by part, one class per part, plain loops, "//" format notes in every data file (checked: same screens, same data)
- [x] Locations page (every place on the map) + Other Locations (NMSU properties)
- [x] Compass (Map settings, off at first; tap = Home), Home shows all of main campus
- [x] Food (NMSU Dining) and Parking (NMSU Facilities GIS, 346 lots) categories, off at first, always searchable
- [x] Every NMSU Housing community; every remaining class building that clearly matches NMSU records
- [x] Service worker (Workbox): repeat opens load from the phone; parking outlines load only when needed
- [x] Map filters order by use (Study at the bottom); Staff Academic category (44 buildings, picked from NMSU Space Planning by use)
- [x] Settings > Map filters: choose which rows the button has
- [x] Map settings and Map filters close each other; filter icons on the left; Parking row on top (off); lot sheets show permit color and who can park
- [x] Settings-only categories: Athletics, Student Services, Shops, Greenhouses, Barns, Warehouses (58 buildings, off at first)
- [x] Food hours and phone numbers from NMSU Dining; Westside Bistro (HRTM, Gerald Thomas Hall)
- [ ] Westside Bistro hours: confirm this semester's days with HRTM (NMSU last announced Fridays 11-1 in Feb. 2025)
- [x] NMSU campus map description on every building that has one (156 of 165); Financial Aid building in Student Services
- [x] Classes at the Equestrian Building and Fabian Garcia Science Center now map to NMSU's records
- [x] Settings: at most 6 kinds of places in the Map filters button; switching a kind off lets go of a chosen place of that kind
- [x] Parking at NMSU properties NMSU's parking layer misses: parking areas from OpenStreetMap, marked as such
- [ ] Horse Farm Office: the schedule's name matches no NMSU building record (the Horse Farm barns are on the map)
- [x] Speed on a slow phone (6x slower CPU, measured): map usable 4.4s -> 3.5s first visit, 2.0s on a repeat visit;
      start-up main-thread blocks 2.9s -> 2.1s; badge drawing 227ms -> 22ms; at normal speed, first paint 292ms
- [ ] Floors, year built, code unknown for some new buildings (shown as Unknown until NMSU publishes them)
- [ ] Photos of the residence halls and parks (none freely licensed found)
- [ ] Entrance photos: take one per door and list it under entrancePhotos in data/source/building-extras.json
- [ ] Building photos: no freely licensed photos of the 8 remaining buildings exist online (Commons, Flickr CC checked); needs our own photos
- [ ] Room-level arrival (phones can't detect floor or room indoors; would need indoor positioning hardware)
- [ ] Driving directions (would need parking data and a road router; walking only for now)

## Reviews to write (docs/REVIEW.md)
- [ ] Maps · NMSU campus area · building layout · UI · UX/accessibility (with claims fact-checked)
