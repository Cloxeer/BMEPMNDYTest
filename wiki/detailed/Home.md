# Better NMSU Maps

**A fast, clean, no-login campus map for NMSU. Open it on your phone, type what's on your schedule, and get to your class.**

We're **The Brainy Bunch**, a CS 371 team at New Mexico State University.

## What we're building

If you're new at NMSU, your schedule says something like **"SH 118A"** and that's pretty much all you get. You don't know what SH is, you don't know where it is, and once you find the building you still have to find the room. We want to fix that.

Better NMSU Maps is going to be a map website that feels like Apple Maps but is made just for NMSU, and it goes all the way to the room, not just the building:

- Type what's on your schedule (`SH 118A`) and it finds it
- See the building's floor plan with your room highlighted
- Get walking, biking, or driving directions there
- No account, no app download, nothing to set up

One rule we care about a lot: **we don't make anything up.** Every building, room, and number has to come from a real source like NMSU's records or a photo we took of the posted evacuation map. A map that sends someone to the wrong room is worse than no map.

## Team

| Name | Role | What they're responsible for |
|---|---|---|
| Sebastian Salgado | **Technical Lead** | Plans how all the pieces fit together, and walks the team through building each part step by step so everyone understands it. Reviews code before it gets merged. |
| Matthew Holets | **Map & UI** | The map screen: building buttons and names, the building page, search, and the directions card |
| Brock Patten | **Campus Data** | Gathering and checking the data: building outlines, building codes, room lists, and photos of each building's posted evacuation maps |
| Wax Sahm | **Design & QA Tester** | How the app looks and feels, and testing every screen on real phones against our acceptance tests |
| *(name to be added)* | **QA: Fact & Number Checker** | Making sure every fact and number the app shows is correct and actually measures what it says it measures (details below) |

*The Scrum Master will rotate each sprint and will be listed on the Sprints page.*

### What the Fact & Number Checker checks

This role exists because wrong info is the one thing we can't ship. Before anything goes out, they check:

- **Building codes** ("SH", "HJLC") match the **NMSU Registrar's** building abbreviation list.
- **Building facts** (address, year built, number of floors) match **NMSU Office of Space Planning** records.
- **Room numbers** exist in **NMSU's public class schedule** or on the building's posted evacuation map. A room that doesn't exist (for example "SH 205") should **not** show up in search.
- **Floor plans** match the photo of the posted map: same rooms, same labels, same floor.
- **Distances and times** make sense for what they're measuring. A walk across campus should be minutes, not hours. Feet and miles are labeled right. A time estimate has to match the route's distance and the travel speed we say we use.
- **Our metrics** (like "under 10 seconds") get timed on a real phone, written down with the date and phone model, before we say we hit them.

If a number can't be traced back to a source or a real measurement, it gets fixed or taken out.

## Wiki pages

- [Problem Statement](Problem-Statement): the problem, what we plan to build, who it's for (End User Profile), the value it creates (Quantified Value Proposition), and our Product Core
- [User Stories](User-Stories): what users will be able to do, as user stories

**Coming in later assignments:** Domain Model, Sprints, Non-functional Requirements, Software Design, Verification and Validation.
