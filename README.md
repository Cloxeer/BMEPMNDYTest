# Better NMSU Maps

A fast, no-login, Apple-style interactive map of the NMSU Las Cruces campus.
Built by **The Brainy Bunch** for CS 371.

- **Map engine:** [MapLibre GL](https://maplibre.org/) (GPU, draggable, pinch-zoom)
- **UI kit:** [Framework7](https://framework7.io/) in its iOS theme (navbar, side menu, popups, searchbar)
- **No build step.** Plain HTML + CSS + JavaScript modules. Everything loads from a CDN.

## What works right now (v1 — the map shell)

- Draggable, pinch-zoomable campus map
- iOS navbar: hamburger menu · **Campus** title · search
- Slide-in menu: **Map / Schedule / Settings**
- First-visit **welcome screen** (remembered per session, so it won't nag you)

Coming next: building pins → info sheet, and live search over `data/buildings.json`.

## File guide

```
index.html          The whole screen (Framework7 markup + the #map box)
styles/app.css      Tiny: NMSU crimson theme + map sizing (no hand-built UI)
js/config.js        All tweakable settings (map center, zoom, campus bounds, tiles)
js/map.js           Builds the MapLibre map
js/app.js           Starts Framework7 + the map, runs the welcome flow
data/buildings.json Building data (used for pins + search in the next step)
```

Every file starts with a comment saying what it does, what it depends on, and
what it controls. Every function has a comment above it.

> **Note:** building coordinates in `buildings.json` are approximate placeholders
> (`"verified": false`). Fix them by dropping a pin in Google Maps and pasting the
> real `lng`/`lat` — no code changes needed.

## Run it locally

ES modules need a web server (opening the file directly won't work). From this folder:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000> in your browser.

## Put it on your phone (GitHub Pages)

1. Push this folder to the repo (see commands your teammate ran, or below).
2. On GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, pick **main** / **/ (root)**, Save.
3. Wait ~1 minute, then open the shown URL (e.g. `https://cloxeer.github.io/BetterNMSUMapTest/`) on your phone.

```bash
git add .
git commit -m "Add v1 map shell"
git push
```
