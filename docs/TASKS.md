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
- [x] Main campus boundary: official NMSU Space Planning layer (replaced the OSM version)
- [x] NMSU Golf Course boundary: inside official **East Campus** (verified against OSM way/50280146)
- [x] Horse Farm boundary: official NMSU Space Planning layer (OSM has none)
- [x] All 33 official properties from NMSU Space Planning (ArcGIS Campus Boundaries); 8 nearby on map, the rest on the Locations page
- [x] Rule: only NMSU places where classes could happen
- [x] Excluded **North Campus** (Toucan, McDonald's, Lorenzo's, Speedway, Pan Am Plaza)
- [x] Excluded **East Campus** (Centennial High School, Farm & Ranch Heritage Museum); golf course drawn on its own from OSM way/50280146
- [x] Faded NMSU's 22 official **Ground Lease** parcels (Arrowhead Park Early College HS, Medical Academy, Executive Office Center confirmed on them)
- [x] Hid unverified basemap business labels (e.g. the wrong "Campus Bookstore" pin)
- [x] Map fence fits the nearby properties; picking a far site lifts it
- [x] Colour basemap (Liberty), campus highlighted, outside muted
- [x] Building pin drawn in the map layer, so it doesn't lag

## UI
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
- [ ] Expand to 10 buildings (15 real footprints already in data/buildings-osm.geojson)

## Wayfinding
- [ ] Route A → B on the real footpath network (data/paths.geojson, 708 ways)
- [ ] Show the entrance door to use
- [ ] Blue translucent `>>>` chevrons from the door to the room

## Reviews to write (docs/REVIEW.md)
- [ ] Maps · NMSU campus area · building layout · UI · UX/accessibility (with claims fact-checked)
