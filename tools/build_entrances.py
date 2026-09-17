"""
tools/build_entrances.py - makes data/entrances.json, the outside doors you can tap on a floor plan.

WHAT IT DOES : Reads the first-floor plan of every building in
               data/source/building-extras.json and finds each outside door (the
               door gaps marked class="door", with their EXIT / Door label from the
               posted evacuation map). Each door gets an id like "323-1-2"
               (building - floor - door number, counted in the order they are in the file).
               If we've taken a photo of an entrance, list it in building-extras.json
               under "entrancePhotos" (id -> file). It's only used if the file really
               exists, so the app never shows a broken photo.
DEPENDS ON   : Python 3 only. tools/json_files.py, data/source/building-extras.json, data/floors/*.svg
WRITES       : data/entrances.json
RUN          : python tools/build_entrances.py
"""

import math
import xml.etree.ElementTree as ElementTree
from pathlib import Path

from json_files import NOTE_KEY, read_json, write_json

PROJECT = Path(__file__).resolve().parent.parent
EXTRAS = PROJECT / 'data' / 'source' / 'building-extras.json'
OUTPUT = PROJECT / 'data' / 'entrances.json'
SVG = '{http://www.w3.org/2000/svg}'  # every tag in an SVG file starts with this
LABEL_DISTANCE = 100  # an EXIT / Door label this close (in plan units) belongs to the door

NOTE = [
    'Made by tools/build_entrances.py. Do not edit by hand: change the floor plan or data/source/building-extras.json,',
    'then run python tools/build_entrances.py',
    'Format: "entrances" is a list. Each entrance: id ("building-floor-number"), building (property number), floor,',
    'plan (the floor plan file), viewBox (the plan\'s coordinate box), label ("EXIT" or "Door"),',
    'point ([x, y] on the plan) and photo (a file in data/photos/, or null when we have no photo yet).',
]


def door_labels(root):
    """Every EXIT / Door label on a plan: (text, x, y)."""
    labels = []
    for element in root.iter(SVG + 'text'):
        if element.get('class') == 'exit' and element.text:
            labels.append((element.text.strip(), float(element.get('x')), float(element.get('y'))))
    return labels


def closest_label(labels, x, y):
    """The text of the label closest to (x, y), if it's close enough; otherwise "Door"."""
    best_text = 'Door'
    best_distance = math.inf
    for text, label_x, label_y in labels:
        distance = math.hypot(label_x - x, label_y - y)
        if distance > LABEL_DISTANCE:
            continue
        # Closer wins. Two labels exactly as close: the one first in the alphabet wins.
        if distance < best_distance or (distance == best_distance and text < best_text):
            best_distance = distance
            best_text = text
    return best_text


def doors_on_plan(svg_file):
    """Every outside door on one plan: its middle point and its label. Also returns the plan's viewBox."""
    root = ElementTree.parse(svg_file).getroot()
    labels = door_labels(root)
    doors = []
    for line in root.iter(SVG + 'line'):
        if line.get('class') != 'door':
            continue
        x = (float(line.get('x1')) + float(line.get('x2'))) / 2
        y = (float(line.get('y1')) + float(line.get('y2'))) / 2
        doors.append({'point': [x, y], 'label': closest_label(labels, x, y)})
    return root.get('viewBox'), doors


def main():
    """Find and write every outside door on our first-floor plans."""
    extras = read_json(EXTRAS)
    entrances = []
    for building_id in extras:
        if building_id == NOTE_KEY:
            continue
        extra = extras[building_id]
        plan = extra.get('floorImages', {}).get('1')
        if not plan:
            continue  # no first-floor plan drawn yet
        photos = extra.get('entrancePhotos', {})
        view_box, doors = doors_on_plan(PROJECT / plan)
        number = 0
        for door in doors:
            number += 1
            entrance_id = building_id + '-1-' + str(number)
            photo = photos.get(entrance_id)
            if photo and not (PROJECT / photo).exists():
                print('  photo listed but missing, not used:', photo)
                photo = None
            entrances.append({'id': entrance_id, 'building': building_id, 'floor': 1, 'plan': plan,
                              'viewBox': view_box, 'label': door['label'], 'point': door['point'], 'photo': photo})
    write_json(OUTPUT, NOTE, {'entrances': entrances}, 'pretty')
    print(len(entrances), 'entrances written to', OUTPUT)


if __name__ == '__main__':
    main()
