# malware type shit 

A fast, no-login, Apple-style map of New Mexico State University.
Built by **The Brainy Bunch** for CS 371.

- **Map:** [MapLibre GL](https://maplibre.org/) on [OpenFreeMap](https://openfreemap.org/) Liberty tiles (free, no API key)
- **Interface:** [Framework7](https://framework7.io/) iOS components
- **Data:** NMSU Office of Space Planning, NMSU Registrar, OpenStreetMap
- **No build step for the app.** Plain HTML, CSS and JavaScript modules.

How it's put together: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
What's done and what's next: [docs/TASKS.md](docs/TASKS.md).

## What it does

- Welcome screen, once per browser session
- Colour map with NMSU's class places highlighted; everything else faded
- 163 buildings with official facts, including athletics, student services, shops, greenhouses, barns and warehouses (off at first, added in Settings): every Las Cruces building with classes in the schedule that clearly matches NMSU's records, every NMSU Housing community, historic buildings, and every occupied academic, office, lab and research building (Staff Academic); tap a badge to open its sheet
- 12 campus parks and green spaces, 18 places to eat with their hours (NMSU Dining), and all 346 parking lots NMSU maps, with permit colours
- Map filters, most used at the bottom: Study (crimson), Housing (orange), Parks (green), Food (pink), then Staff Academic (teal), Historic (brown) and Parking (indigo), which start off (search always finds them)
- Locations page: every place on the map by category; Other Locations: every NMSU property
- Settings > Map filters: choose which categories have a switch in the Map filters button (Study, Housing, Parks and Food at first)
- Map settings: My location, Turn map with me, Building names, a small compass (tap it to go home), Home
- Opens from the phone's own saved copy after the first visit (fast, and works offline)
- Hardman & Jacobs has floor plans for floors 1–2 (tap to zoom)
- Search by name, address, building code or number, or a room ("SH 118A", "hjlc 225")
- Rooms on our floor plans are highlighted in light blue
- Tap a room on a floor plan to choose it; arrows show the way in from the nearest door or stairs
- Get directions: blue arrows along campus paths, a turn-by-turn card with time and distance; the sheet opens with "You've arrived" when you walk in

## Change how it looks or behaves

Open **`config.yml`**, change a value, save, refresh. Colours, sizes, animation
times and labels are all there, grouped by page. If you make a typo the page
tells you roughly which line to look at.

## Run it on your computer

JavaScript modules need a web server (double-clicking `index.html` won't work):

```bash
python -m http.server 8000
```

Then open <http://localhost:8000>.

## Put it on your phone (GitHub Pages)

```bash
git add .
git commit -m "Describe your change"
git push
```

On GitHub: **Settings → Pages → Deploy from a branch → `main` / `/ (root)`**, then open
`https://cloxeer.github.io/BetterNMSUMapTest/` on your phone.

## Files

```
index.html              every screen
config.yml              every changeable value
js/main.js              starts the app: read this first
js/core/                settings, app state, saving choices, safe HTML, offline support
sw.js                   service worker: keeps the app on the phone
js/logic/               maths and text only (distances, search matching, turns, routes)
js/map/                 the map, badges, your location, compass
js/bottomBar/           the pill, Map settings, Map filters, Directions button
js/directions/          route data, route drawing, turn-by-turn card
js/sheet/               building sheet, floor plans, photo viewer
js/pages/               search, menu, Locations, Settings, welcome, navbar title
styles/                 one stylesheet per part of the screen
data/                   files the app reads (don't edit the built ones by hand)
data/floors/            floor plans (SVG, redrawn from posted evacuation maps)
data/photos/            building photos (licensed; credits in data/source/photos.json)
data/source/            inputs for the tools below
tools/                  scripts that rebuild data/ from official sources
```

Every file starts with a comment saying what it does, what it depends on and what
it controls. Every function has a comment above it. Every data file starts with a
`"//"` note saying how it's formatted. The full list of files is in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md); how we write code is in
[docs/CODING-GUIDE.md](docs/CODING-GUIDE.md).

## Rebuild the data

Only needed when the sources change.

```bash
# Buildings: downloads NMSU's official records (needs internet)
python tools/build_buildings.py

# Campus shapes: needs the shapely package once
python -m pip install --user shapely
python tools/build_campuses.py

# Rooms: floor plans + NMSU class schedule (update TERMS each semester)
python tools/build_rooms.py

# Entrances on the floor plans (no internet needed)
python tools/build_entrances.py

# Parks, food and parking lots (needs internet; run build_buildings.py first)
python tools/build_places.py

# Walking paths for directions (OpenStreetMap)
python tools/build_routes.py
```

**Add a building:** add a row to `BUILDINGS` at the top of `tools/build_buildings.py`
(property number, name, OpenStreetMap name, NMSU map id, photo key) and run it.
Floor plans and descriptions go in `data/source/building-extras.json`.
