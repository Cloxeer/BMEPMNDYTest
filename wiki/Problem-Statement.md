# Problem Statement

[← Back to Home](Home)

## The problem

Every semester, a lot of students show up at NMSU not knowing where their classes are. Your class schedule doesn't say "Science Hall, first floor, down the hall on the left." It says **"SH 118A."** To find that room you have to:

1. Figure out that "SH" means Science Hall (these codes come from the Registrar and aren't always obvious; Hardman and Jacobs is "HJLC").
2. Find Science Hall on a map.
3. Walk there and hope you picked the right door.
4. Wander the halls looking for room numbers.

Campus maps today mostly stop at step 2. They show buildings, but you can't search for a **room**, you don't get a **floor plan**, and there's no help once you're **inside** the building. The floor plans that do exist are the emergency evacuation maps posted on the walls, so you only see them once you're already inside and already lost.

This is worst in the first week of classes, for transfer students, and for anyone who has a class in a building they've never been in. Being late on the first day, or skipping a class because you couldn't find it, is a bad way to start.

## What we're going to build

**Better NMSU Maps** is a website that works like the map apps students already know (Apple Maps, Google Maps), but it's built only for NMSU and it goes all the way to the room. It will run in any phone browser: no login, no download.

### Main features

**1. A clean campus map**
- The map opens on the Las Cruces campus. NMSU's own property is lightly highlighted and everything else is faded, so it's clear what's campus.
- Each building we support gets a round **"i" button** with its name above it. Names hide when they'd overlap and come back when you zoom in.
- Dragging and pinching should feel smooth, even on cheaper phones.

**2. Search by building, code, or room**
- One search box that understands what's actually on your schedule: `SH 118A`, `sh118a`, `118A`, `HJLC 225`, `Science Hall`.
- It forgives small typos ("harmon jacobs" still finds Hardman and Jacobs).
- It remembers what you typed until you clear it, so if you type "SH" and forget the room, it's still there when you come back.

**3. A page for every building**
- Tap a building and the map smoothly flies to it, then a page slides up with:
  - **Floor plan**: a clean redrawn plan ("Our plan") and a photo of the real evacuation map posted in the building ("Posted map"), which you can swipe between. Tap either one to zoom.
  - **Photos**, **a description**, and **facts** (address, building code, year built, number of floors).
  - A link to NMSU's official map.
- Every building page has the same layout. If we don't have something yet, it says so instead of leaving a gap.

**4. Rooms on the floor plan**
- Searching for a room, or tapping one on the floor plan, highlights it in light blue.
- Arrows on the plan show the way from the nearest outside door (first floor) or the nearest stairs (upper floors) to that room.

**5. Directions**
- A "Get directions" button on every building page.
- Choose **walking, biking, or driving**. Each one uses real paths and roads, and one-way streets are respected.
- A turn-by-turn card at the bottom, like Apple Maps: the next turn, how far away it is, time left, and arrival time. Tap it to see every step.
- A beam on your location dot shows which way you're facing.
- When you walk into the building, the app says **"You've arrived"** and opens the floor plan with your room highlighted.
- It asks before ending a trip or switching to a new destination, so a stray tap doesn't lose your route.

**6. Locations page**
- A list of every NMSU location, including sites outside Las Cruces, sorted by distance, so you can jump to any of them.

### Where the information comes from

We don't want to make anything up: a wrong room or a wrong building is worse than no map. So all data will come from official or public sources:

| Information | Source |
|---|---|
| Building outlines, addresses, year built, floors, campus boundaries | NMSU Office of Space Planning (public map data) |
| Building codes like "SH" and "HJLC" | NMSU Registrar's building abbreviation list |
| Room numbers where classes meet | NMSU's public class schedule |
| Floor plans | Evacuation maps posted in each building, photographed and redrawn by our team |
| Walking paths, bike routes, roads | OpenStreetMap |

### Scope: what's in and what's out

**In scope (first version):**
- 10 buildings where many first-year classes are held, starting with Hardman and Jacobs, which will get full floor plans and room arrows.
- The Las Cruces campus map, plus a list of the other NMSU locations.
- Everything above works without an account.

**Out of scope (for now):**
- Accounts, logins, or saving personal class schedules.
- Floor plans for every building on campus (we'll add them as we photograph each building's posted maps).
- Knowing exactly which room you're standing in. Phone GPS can tell you that you're *at* a building, but not which floor or room you're on, so indoor guidance uses the floor plan instead.
- Live data like parking availability or shuttle times.

### How it will be built (short version)

It's a website, so it runs on any phone or computer with a browser. We plan to use free, well-known tools instead of building everything from scratch: **MapLibre** for the map, **Framework7** for the iPhone-style look, and **OpenStreetMap** data for routes. Settings like colors, sizes, and wording will live in one file (`config.yml`), so anyone on the team can change them without digging through code. It will be hosted for free on **GitHub Pages**.

---

## End User Profile

Our main user is **a new NMSU student trying to find a class.**

**Who they are**
- Mostly first-year students, plus transfer students and anyone with a class in a building they've never been to.
- On campus on class days, usually walking between buildings with their phone out.
- They use their **phone** for almost everything and already know apps like Apple Maps and Google Maps.

**What they're good at (capabilities)**
- Using map apps: pinch to zoom, tap a pin, follow turn-by-turn directions.
- Typing short searches quickly with their thumbs.
- Reading their class schedule off myNMSU or Canvas.

**What they struggle with (deficiencies), and why**
- **They don't know the building codes.** "SH," "BD," "EC2," and "HJLC" mean nothing yet, because nobody explains them.
- **They don't know the campus.** They can't picture where buildings are or which door is closest.
- **They get lost *inside* buildings.** Room numbers skip around, suites hide rooms (like 128B inside 128), and upper floors mean finding stairs first.
- **They're short on time.** The break between back-to-back classes is short, and the next class is often across campus.
- **They won't put up with extra steps.** If something needs a login, an app download, or loads slowly, they'll give up and ask someone, or just be late.
- **Their phones vary.** Not everyone has a new iPhone, so it has to run well on older and cheaper phones and on weak campus Wi-Fi.

**What this means for our design**
- Search has to accept exactly what's on the schedule ("SH 118A"), not just building names.
- No login and nothing to install: open the link and go.
- Big, clear, familiar controls that feel like the map apps they already use.
- Fast and smooth on low-end phones.
- The job isn't done at the building. It has to get them to the room.

**Secondary users:** parents and visitors on move-in or orientation days, and returning students with a class in an unfamiliar building. They have the same needs, just less often.

---

## Quantified Value Proposition

Before and after Better NMSU Maps, for a student who has only "SH 118A" from their schedule:

| | Today (typical campus map) | With Better NMSU Maps (our targets) |
|---|---|---|
| Steps from schedule code to the building | Figure out the code yourself, then find the building by name | Type the code as written: **1 search, 1 tap** |
| Seeing the floor plan | Only once you're inside, on the wall | **Before you leave**, on your phone, room highlighted |
| Help inside the building | None | **Arrows from the nearest door or stairs** to the room |
| Getting started | Open the site on a phone and navigate a big map | **No login, no download**: open the link |
| Directions | Separate app, no room info | **Walk, bike, or drive** in the same app, ending at the room |

**Our measurable goals for version 1.0:**
- A student goes from typing a room code to seeing that room highlighted on its floor plan in **under 10 seconds**.
- Search finds a room from the code **exactly as written on the class schedule**, in **100%** of our test cases for supported buildings.
- The map is usable (buildings shown and tappable) within **3 seconds** on a phone with a normal campus connection.
- Dragging and zooming feels smooth: aiming for **60 frames per second** on a mid-range phone.
- **0 wrong buildings or rooms**: everything shown traces back to an official NMSU source or a photo of the posted map.

*These are targets, not measured results yet. Our QA fact & number checker will time them on real phones and record the results (see the Verification and Validation page, coming later). A goal only counts as met once it has been measured.*

**The value in plain words:** less stress on the first day, fewer late or missed classes, and no more asking strangers "where is SH?"

---

## Product Core

> **Better NMSU Maps gets a student from the room code on their schedule to the right room, faster and more clearly than any other campus map.**

Plenty of maps can show where a building is. Our core is **the last part of the trip**:
1. Understanding the code as written (`SH 118A`, `HJLC 225`)
2. Showing the room on a real floor plan
3. Pointing the way from the door to the room

Every feature decision gets checked against this. If a feature doesn't help a student get to their room, it waits.

---

## Minimum Viable Product (v1.0)

The smallest version that's actually useful to a new student:

1. The campus map with the 10 most-used buildings tappable.
2. Search by building name, building code, and room number.
3. A building page with facts and a floor plan for Hardman and Jacobs, with the room highlighted.
4. Walking directions from your location to the building.

Everything else (biking and driving, indoor arrows, photos for every building, the compass beam) builds on top of that.
