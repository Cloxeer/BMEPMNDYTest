# Better NMSU Maps

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
- 10 buildings with official facts; tap a badge to open its sheet
- Hardman & Jacobs has floor plans for floors 1–2 (tap to zoom)
- Search by name, address, building code or number
- Locations page: every NMSU place, nearest first

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
styles/app.css          look + animation
js/app.js               starts the app, menu, welcome screen
js/config.js            loads config.yml
js/store.js             app state + the actions that change it
js/html.js              makes data safe to put into HTML
js/map.js               map, campus highlight, building badges
js/buildingSheet.js     building sheet
js/pill.js              bottom pill
js/locate.js            location button next to the pill
js/search.js            search
js/locations.js         Locations page
data/                   files the app reads (don't edit the built ones by hand)
data/floors/            floor plans (SVG, redrawn from posted evacuation maps)
data/photos/            building photos (licensed; credits in data/source/photos.json)
data/source/            raw inputs for the tools below
tools/                  scripts that rebuild data/ from official sources
```

Every file starts with a comment saying what it does, what it depends on and what
it controls. Every function has a comment above it.

## Rebuild the data

Only needed when the sources change.

```bash
# Buildings: downloads NMSU's official records (needs internet)
python tools/build_buildings.py

# Campus shapes: needs the shapely package once
python -m pip install --user shapely
python tools/build_campuses.py
```

**Add a building:** add a row to `BUILDINGS` at the top of `tools/build_buildings.py`
(property number, name, OpenStreetMap name, NMSU map id, photo key) and run it.
Floor plans and descriptions go in `data/source/building-extras.json`.
