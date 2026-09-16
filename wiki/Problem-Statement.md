# Problem Statement

[← Back to Home](Home)

## The problem

Every semester a lot of students show up at NMSU and can't find their classes. Your schedule doesn't say "Science Hall, first floor, down the hall on the left." It says **"SH 118A."** So to get there you have to:

1. Figure out that "SH" means Science Hall. Some codes are obvious and some aren't: Hardman and Jacobs Undergraduate Learning Center is "HJLC."
2. Find Science Hall on a map.
3. Walk over and guess which door to use.
4. Walk the halls looking at room numbers until you find it.

The campus maps we've used mostly stop at step 2. They show you the building, but you can't search for a **room**, there's no **floor plan**, and there's no help once you're **inside**. The only floor plans are the evacuation maps on the walls, which means you only see them once you're already inside and already lost.

This hits hardest the first week of classes, for transfer students, and for anyone who has a class in a building they've never been in. Being late on day one, or missing a class because you couldn't find it, is a rough way to start.

## What we're planning to build

**Better NMSU Maps** is going to be a website that works like the map apps everyone already knows (Apple Maps, Google Maps), but made only for NMSU, and it goes all the way to the room. It'll run in any phone browser: no login, no download.

We want it to feel **clean, clear, and Apple-like**: smooth animations, nothing cluttered, and never a screen where you're not sure what to do next.

### Main features

**1. A clean campus map**
- Opens right on the Las Cruces campus. NMSU property gets a light highlight and everything else fades out, so it's obvious what's campus.
- Every building we support gets a round **"i" button** with its name above it. If names would overlap, some hide and come back when you zoom in.
- Dragging and pinching has to feel smooth, even on cheaper phones.

**2. Search that understands your schedule**
- One search box that takes what's actually on your schedule: `SH 118A`, `sh118a`, `118A`, `HJLC 225`, or a building name.
- Small typos are fine ("harmon jacobs" still finds Hardman and Jacobs).
- It remembers what you typed until you clear it. If you type "SH" and forget the room, "SH" is still there when you come back.

**3. A page for every building**
- Tap a building and the map flies to it quickly, then a page slides up with:
  - **Floor plan:** our clean redrawn version ("Our plan") and a photo of the real evacuation map on the wall ("Posted map"). You can swipe between them and tap to zoom.
  - **Photos, a description, and facts** (address, building code, year built, number of floors).
  - A link to NMSU's official map.
- Every building page has the exact same layout. If we don't have something yet, the page says so instead of leaving a blank spot or making something up.

**4. Rooms on the floor plan**
- Search for a room or tap one on the floor plan, and it's highlighted in light blue.
- Arrows on the plan show the way from the nearest outside door (first floor) or the nearest stairs (upper floors) to that room.

**5. Directions**
- A directions button on every building page.
- Pick **walking, biking, or driving**. Each one uses real paths and roads, and one-way streets stay one-way.
- A card at the bottom like Apple Maps: next turn, how far to it, time left, and arrival time. Tap it to see every step.
- Your location dot shows which way you're facing.
- When you walk into the building, it says **"You've arrived"** and opens the floor plan with your room highlighted.
- It asks before ending a trip or switching to a different destination, so one wrong tap doesn't lose your route.

**6. Locations page**
- A list of every NMSU location, including places outside Las Cruces, sorted by distance, so you can jump to any of them.

### Where the information comes from

We're treating this like it's being made for the government and lives are on the line: **nothing gets made up.** Everything comes from an official or public source:

| Information | Source |
|---|---|
| Building outlines, addresses, year built, floors, campus boundaries | NMSU Office of Space Planning (public map data) |
| Building codes like "SH" and "HJLC" | NMSU Registrar's building abbreviation list |
| Room numbers where classes meet | NMSU's public class schedule |
| Floor plans | The evacuation maps posted in each building, which we'll photograph and redraw |
| Walking paths, bike routes, roads | OpenStreetMap |

If two sources disagree, the Registrar wins for building codes (that's what's on student schedules), and NMSU Space Planning wins for everything else about buildings.

### Scope: what's in and what's out

**In scope (first version):**
- **10 buildings** where a lot of first-year classes are held. **Hardman and Jacobs** is our first full building, with floor plans and room arrows.
- The Las Cruces campus map, plus the list of other NMSU locations.
- Only places where classes could actually happen. No high schools and no leased commercial property, even when NMSU owns the land.
- Everything works without an account.

**Out of scope (for now):**
- Accounts, logins, or saving your class schedule.
- Floor plans for every building. We'll add them as we photograph each building's posted maps.
- Knowing exactly which room you're standing in. Being honest here: phone GPS can tell you that you're *at* a building, but not which floor or room you're on. So once you're inside, the floor plan does the guiding.
- Live info like parking availability or shuttle times.

### How we plan to build it (short version)

It's a website, so it works on any phone or computer with a browser. Instead of building everything from scratch we'll use free, well-known tools: **MapLibre** for the map, **Framework7** for the iPhone-style look, and **OpenStreetMap** data for routes. Colors, sizes, animation timing, and wording will all live in one settings file (`config.yml`), so anyone on the team can change something without digging through code. We'll host it for free on **GitHub Pages**.

We're also keeping the code **simple enough for a beginner to follow**: every file will start with a comment saying what it does, and every function will have a comment above it.

---

## End User Profile

Our main user is **a new NMSU student trying to find a class.**

**Who they are**
- Mostly first-year students, plus transfer students and anyone with a class in a building they've never been to.
- On campus on class days, walking between buildings with their phone out.
- They use their **phone** for pretty much everything and already know how to use Apple Maps and Google Maps.

**What they're good at (capabilities)**
- Using map apps: pinch to zoom, tap a pin, follow turn-by-turn directions.
- Typing short searches fast with their thumbs.
- Pulling up their class schedule on myNMSU or Canvas.

**What they struggle with (deficiencies), and why**
- **They don't know the building codes.** "SH," "BD," "EC2," and "HJLC" don't mean anything yet, because nobody really explains them.
- **They don't know campus yet.** They can't picture where buildings are or which door is closest.
- **They get lost inside buildings.** Room numbers jump around, some rooms are inside suites (like 128B inside 128), and upper floors mean finding the stairs first.
- **They're short on time.** The break between back-to-back classes isn't long, and the next class can be across campus.
- **They won't put up with extra steps.** If it needs a login, an app download, or loads slowly, they'll give up and ask someone, or just be late.
- **Not everyone has a new phone.** It has to run well on older and cheaper phones and on spotty campus Wi-Fi.

**What that means for how we design it**
- Search has to take the room exactly how the schedule writes it ("SH 118A"), not just building names.
- No login and nothing to install. Open the link and go.
- Big, clear controls that work like the map apps they already use.
- Fast and smooth on low-end phones.
- The job isn't done at the building. It has to get them to the room.

**Other users:** parents and visitors on move-in and orientation days, and returning students who have a class somewhere new. Same needs, just not as often.

---

## Quantified Value Proposition

Here's the difference we're going for, for a student who only has "SH 118A" from their schedule:

| | Today (typical campus map) | With Better NMSU Maps (our plan) |
|---|---|---|
| From schedule code to the building | Figure out the code yourself, then find the building by name | Type the code as it's written: **1 search, 1 tap** |
| Seeing the floor plan | Only once you're inside, on the wall | **Before you leave**, on your phone, room highlighted |
| Help inside the building | None | **Arrows from the nearest door or stairs** to the room |
| Getting started | Open the site on your phone and dig through a big map | **No login, no download**: open the link |
| Directions | A separate app that doesn't know about rooms | **Walk, bike, or drive** in the same app, ending at the room |

### Our metrics for version 1.0

To be transparent: **these are targets, not results.** We haven't measured any of them yet. Our QA Fact & Number Checker will test each one on real phones and write down the result with the date and the phone used. We only get to say we hit a metric after it's been measured.

| # | Metric | Target | How we'll measure it |
|---|---|---|---|
| 1 | Time from typing a room code to seeing that room highlighted on its floor plan | **Under 10 seconds** | Stopwatch, 5 tries each on an iPhone and a lower-end Android phone, for rooms in Hardman and Jacobs |
| 2 | Room search accuracy | **100%** of test rooms found when typed exactly like the class schedule | A test list of real rooms from NMSU's class schedule for the buildings we support |
| 3 | Rooms that don't exist | **0** fake rooms shown | Search for rooms that aren't in the schedule or on the posted maps (for example "SH 205") and confirm nothing comes up |
| 4 | Time until the map is usable | **Under 3 seconds** until buildings are showing and tappable | Stopwatch from opening the link, on campus Wi-Fi, with a cleared browser cache |
| 5 | Smoothness | Around **60 frames per second** while dragging and zooming | The browser's built-in performance tools on a mid-range phone |
| 6 | Wrong facts | **0** building codes, addresses, years built, or floor counts that don't match NMSU's records | Our QA checker compares every building page to the Registrar list and Space Planning records |

**The value in plain words:** less stress the first week, fewer late or missed classes, and no more asking random people "where is SH?"

---

## Product Core

> **Better NMSU Maps will get a student from the room code on their schedule to the right room, faster and more clearly than any other campus map.**

Lots of maps can show you where a building is. Our core is **the last part of the trip**, the part other maps skip:

1. Understanding the code the way it's written (`SH 118A`, `HJLC 225`)
2. Showing the room on a real floor plan
3. Showing the way from the door to the room

Every feature has to pass one question: **does this help a student get to their room?** If it doesn't, it waits.

---

## Minimum Viable Product (v1.0)

The smallest version that's actually useful to a new student:

1. The campus map with our 10 buildings tappable.
2. Search by building name, building code, and room number.
3. A building page with facts, and a floor plan for Hardman and Jacobs with the room highlighted.
4. Walking directions from where you are to the building.

Everything else (biking and driving, indoor arrows, photos for every building, which way you're facing) gets built on top of that.
