# Problem Statement

## Problem

New students at NMSU have a hard time finding their classes. The class schedule only gives a building code and room number, like "SH 118A". Students have to figure out what the code means, find the building, and then find the room inside. The campus maps we have used show buildings, but you can't search for a room and there are no floor plans. The only floor plans are the evacuation maps posted inside the buildings, so you don't see them until you are already there.

## What we plan to build

We plan to build a website that works on phones and shows a map of the NMSU campus. It will not need a login or an app download.

Planned features:

- A map of the Las Cruces campus with buttons on the buildings we support. The building name shows above each button.
- A search bar where you can type a building name, a building code, or a room the way it's written on your schedule (SH 118A, HJLC 225).
- A page for each building with its floor plan, a photo of the evacuation map posted in the building, photos, and basic facts (address, code, year built, floors).
- Tapping a room on the floor plan highlights it and shows arrows from the nearest door or stairs to the room.
- Directions from where you are to the building, walking, biking, or driving, with turn-by-turn steps.
- A message when you get to the building.
- A map settings button for things like showing your location, turning the map to the way you're facing, and going back to campus.
- A list of all NMSU locations.
- Filters to show other kinds of places: parks, places to eat, housing and parking lots.

It won't only be for new students. Students who have been here a while can use it to find places they haven't been yet, like places to eat or a park nearby.

The data will come from NMSU (Space Planning for buildings, the Registrar for building codes, the class schedule for room numbers), photos we take of the posted evacuation maps, and OpenStreetMap for paths and roads. We don't want to show anything that isn't from a real source.

For the first version we will do 10 buildings, with Hardman and Jacobs as the first building with full floor plans. We are not doing accounts, saving schedules, or floor plans for every building yet. Phone GPS also can't tell what floor or room you are in, so inside the building the floor plan will do the guiding.

We plan to use MapLibre for the map, Framework7 for the interface, and host it on GitHub Pages.

## End User Profile

Our main user is a new NMSU student (freshman or transfer) trying to find their classes.

- They use their phone for most things and already know how to use apps like Google Maps and Apple Maps.
- They can look up their schedule on myNMSU or Canvas.
- They don't know the building codes yet (SH, BD, HJLC, EC2).
- They don't know the campus or where the entrances are.
- They get lost inside buildings looking for room numbers.
- They don't have a lot of time between classes.
- They won't want to make an account or download an app just to find a room.
- Some have older phones, so it has to run okay on those.

## Quantified Value Proposition

Right now a student has to figure out the building code, find the building, and then search inside for the room. With our website they can type the room from their schedule and see the building and the room on the floor plan in one search.

These are our target numbers. We have not measured them yet, and we will test them on real phones:

- Under 10 seconds from typing a room code to seeing the room highlighted on the floor plan.
- 100% of the rooms on our test list are found when typed like the class schedule.
- 0 rooms shown that don't exist.
- The map loads and is usable in under 3 seconds.
- 0 wrong building codes, addresses, or years built compared to NMSU's records.

## Product Core

Getting a student from the room code on their schedule to the actual room. Other maps stop at the building, ours will show the room and how to get to it.
