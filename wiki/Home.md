# Better NMSU Maps

**A fast, simple campus map for New Mexico State University students. No login, no app store, just open it on your phone and find your class.**

We're **The Brainy Bunch**, a CS 371 team at NMSU. Our project is a map website made for the way students actually get around campus: on a phone, in a hurry, usually with only a building code and a room number from their class schedule.

## The idea in one paragraph

When you're new at NMSU, your schedule says something like **"SH 118A"** and you have about ten minutes to find it. Most campus maps can show you where a building is, but they can't take you from that code to the right room. Better NMSU Maps will let you type what's on your schedule, see the building on a clean map, open its floor plan with your room highlighted, and get step-by-step directions there, walking, biking, or driving.

## Team

| Name | Role | What they're responsible for |
|---|---|---|
| Sebastian Salgado | **Technical Lead** | Overall architecture and how the pieces fit together; walks the team through building each part step by step and reviews everyone's code before it's merged |
| Matthew Holets | **Map & UI Developer** | The map screen: building buttons and names, the building page, the search box, and the directions card |
| Brock Patten | **Campus Data** | Collecting and checking campus data: building outlines, codes, room lists, and photos of each building's posted evacuation maps |
| Wax Sahm | **Design & QA Tester** | How the app looks and feels (colors, spacing, animations), and testing every screen on real phones against our acceptance tests |
| *(name to be added)* | **QA: Fact & Number Checker** | Making sure every fact and number the app shows is correct and comes from a real source (details below) |

*(Scrum master will rotate each sprint and be listed on the Sprints page.)*

### What the Fact & Number Checker checks

A map that shows a wrong room or building is worse than no map, so one person's job is to catch wrong information before users see it. For every release they will check:

- **Building codes** (e.g., "SH", "HJLC") match the **NMSU Registrar's** building abbreviation list.
- **Building facts** (address, year built, number of floors) match **NMSU Space Planning's** records.
- **Room numbers** shown in search exist in **NMSU's public class schedule** or on the building's posted evacuation map. Rooms that don't exist (like "SH 205") must *not* show up.
- **Floor plans** match the photo of the posted map: same rooms, same labels, on the same floor.
- **Distances and times** make sense for what's being measured: a walk across campus should be minutes, not hours; feet and miles are labeled correctly; driving is faster than walking for the same trip.
- **Our own goals** (like "under 10 seconds") are actually timed with a stopwatch on a real phone before we claim we met them, and written down with the date and phone used.

If a number can't be traced to a source or a real measurement, it gets fixed or removed.

## Wiki pages

- [Problem Statement](Problem-Statement): what we're building and why, who it's for (End User Profile), the value it creates, and our product core
- [User Stories](User-Stories): what users will be able to do, written as user stories

**Coming in later assignments:** Domain Model, Sprints, Non-functional Requirements, Software Design, Verification and Validation.
