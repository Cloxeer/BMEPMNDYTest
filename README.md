# Better NMSU Maps

A fast, no-login, Apple-style interactive map of the NMSU Las Cruces campus.
Built by **The Brainy Bunch** for CS 371.

- **Map engine:** [MapLibre GL](https://maplibre.org/) (drag, pinch-zoom)
- **Basemap:** [OpenFreeMap](https://openfreemap.org/) **Liberty** — full-colour vector tiles, **free, no API key**
- **Campus highlight:** the **real** NMSU boundary (93 points) from OpenStreetMap relation 13399173 — campus keeps full colour, everything outside is washed back. No hand-drawn shapes anywhere.
- **UI kit:** [Framework7](https://framework7.io/) iOS theme (navbar, menu, popups, sheet)
- **No build step.** Plain HTML + CSS + JavaScript modules, loaded from a CDN.

## What works now

- Full-page crimson **welcome** screen (shown once per browser session)
- Clean, draggable, pinch-zoom campus map
- Solid crimson iOS navbar: hamburger menu · **Campus** · search
- Full-screen fade **menu** (Map / Schedule / Settings)
- **One building wired end-to-end:** Hardman & Jacobs (HJLC) is outlined in
  crimson. Tap it → a crimson pin drops, the map flies in, and a **full-page
  floor viewer** slides up. The bottom pill morphs into a **Floor 1 / Floor 2**
  selector. Closing keeps the building selected; tap the pill to reopen.

## Floor plans

Floors 1 and 2 of Hardman & Jacobs ship as clean **SVG floor plans**
(`data/floors/hjlc-1.svg`, `hjlc-2.svg`) traced from the building's evacuation
maps — they're tiny, crisp at any zoom, and work offline.

Want to use real photos instead? Drop `hjlc-1.jpg` / `hjlc-2.jpg` in `data/floors/`
and change the `floorImages` paths in `data/buildings.geojson`. Any image type works.

## File guide

```
index.html               The whole screen (Framework7 markup + #map + pill)
styles/app.css           Theme color, map sizing, the orb/pill/menu/sheet styles
js/config.js             Map settings (center, zoom, bounds, basemap style)
js/store.js              Tiny shared state (what's selected, sheet open, etc.)
js/map.js                Draws the map, the campus places and the building badges
js/buildingSheet.js      The full-page building sheet (plan, photos, facts)
js/pill.js               The one bottom pill: Info, then floor picker
js/locations.js          The Locations page (every NMSU place)
js/search.js             The drop-down building search
js/app.js                Starts everything and wires the menu/welcome
data/buildings.geojson   The buildings we currently show (+ description, links)
data/campuses.geojson        NMSU class places (built by tools/build_campuses.py)
data/campus-labels.geojson   one name label per place (built)
data/outside-mask.geojson    everything that isn't a class place, faded (built)
data/source/                 raw inputs: NMSU Space Planning boundaries + ground-lease
                             parcels, and the golf course outline (OSM way/50280146)
tools/build_campuses.py      turns data/source/ into the 3 built files above
data/floors/             Floor plans (SVG, redrawn from posted evacuation maps)
```

Gathered from OpenStreetMap, ready for the next phase (not wired up yet):

```
data/buildings-osm.geojson  15 real building footprints (12 ids from OSM `ref`)
data/paths.geojson          708 walking ways — the campus footpath network
data/entrances.geojson      49 entrance nodes (all plain `entrance=yes`;
                            OSM has NO wheelchair or door-ref data here)
```

Every file starts with a comment (what it does / depends on / controls) and every
function has a comment above it.

## Add another building

Copy the HJLC feature in `data/buildings.geojson`, then change: `id`, `name`,
`aka`, `address`, the polygon `coordinates` (draw it at <https://geojson.io>),
`floors`, and the `floorImages` paths. No code changes needed.

## Run locally

ES modules need a web server (opening the file directly won't work):

```bash
python -m http.server 8000
```

Open <http://localhost:8000>.

## Put it on your phone (GitHub Pages)

```bash
git add .
git commit -m "Update map"
git push
```

Then GitHub → **Settings → Pages → Source: Deploy from a branch → `main` / `/root`**.
Open the shown URL (e.g. `https://cloxeer.github.io/BetterNMSUMapTest/`) on your phone.

## Rebuild the campus shapes

Only needed if the files in `data/source/` change. The script cuts NMSU's leased-out
parcels out of the campus shapes, drops non-class places (East/North Campus), and
removes thin leftover strips, so the app itself never does geometry math.

```bash
python -m pip install --user shapely
python tools/build_campuses.py
```
