# Better NMSU Maps

A fast, no-login, Apple-style interactive map of the NMSU Las Cruces campus.
Built by **The Brainy Bunch** for CS 371.

- **Map engine:** [MapLibre GL](https://maplibre.org/) (drag, pinch-zoom)
- **Basemap:** [OpenFreeMap](https://openfreemap.org/) Positron — clean vector tiles, **free, no API key**
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

## ⚠️ Add the two floor-plan photos (one manual step)

The code looks for these two files — just drop your photos in with these exact names:

```
data/floors/hjlc-1.jpg   ← Hardman & Jacobs, Floor 1
data/floors/hjlc-2.jpg   ← Hardman & Jacobs, Floor 2
```

Until they exist you'll see a "Floor plan photo not added yet" placeholder (that's
normal). Any image format works if you also change the filename in
`data/buildings.geojson` (the `floorImages` field).

## File guide

```
index.html               The whole screen (Framework7 markup + #map + pill)
styles/app.css           Theme color, map sizing, the orb/pill/menu/sheet styles
js/config.js             Map settings (center, zoom, bounds, basemap style)
js/store.js              Tiny shared state (what's selected, sheet open, etc.)
js/map.js                Builds the map + outlines buildings + the pin
js/buildingSheet.js      The full-page floor viewer
js/pill.js               The bottom orb pill + floor selector
js/orb.js                The little animated "thinking orb" icon
js/search.js             The drop-down building search
js/app.js                Starts everything and wires the menu/welcome
data/buildings.geojson   Building shapes + info (the one data file)
data/floors/             Floor-plan photos go here
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
