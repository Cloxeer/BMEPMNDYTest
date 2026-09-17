"""
tools/build_entrances.py - make data/entrances.json, the outside doors you can tap on a floor plan.

WHAT IT DOES : Reads the first-floor plan of every building in
               data/source/building-extras.json and finds each outside door
               (the door gaps marked class="door", with their EXIT / Door label
               from the posted evacuation map). Each door gets an id like
               "323-1-2" (building-floor-door number, left to right in the file).
               If we've taken a photo of that entrance, list it in
               building-extras.json under "entrancePhotos" (id -> file); it's only
               included if the file really exists, so the app never shows a broken photo.
DEPENDS ON   : Python 3 only. data/source/building-extras.json, data/floors/*.svg
WRITES       : data/entrances.json
RUN          : python tools/build_entrances.py
"""

import json
import math
import xml.etree.ElementTree as ElementTree
from pathlib import Path

PROJECT = Path(__file__).resolve().parent.parent
EXTRAS = PROJECT / 'data' / 'source' / 'building-extras.json'
OUTPUT = PROJECT / 'data' / 'entrances.json'
SVG = '{http://www.w3.org/2000/svg}'
LABEL_DISTANCE = 100  # an EXIT / Door label this close (in plan units) belongs to the door


def doors_on_plan(svg_file):
    """Every outside door on one plan: its middle point and its label."""
    root = ElementTree.parse(svg_file).getroot()
    labels = [(e.text.strip(), float(e.get('x')), float(e.get('y')))
              for e in root.iter(SVG + 'text') if e.get('class') == 'exit' and e.text]
    doors = []
    for line in root.iter(SVG + 'line'):
        if line.get('class') != 'door':
            continue
        x = (float(line.get('x1')) + float(line.get('x2'))) / 2
        y = (float(line.get('y1')) + float(line.get('y2'))) / 2
        nearby = [(math.hypot(lx - x, ly - y), text) for text, lx, ly in labels]
        close = [text for distance, text in sorted(nearby) if distance <= LABEL_DISTANCE]
        doors.append({'point': [x, y], 'label': close[0] if close else 'Door'})
    return root.get('viewBox'), doors


def main():
    extras = json.loads(EXTRAS.read_text(encoding='utf-8'))
    output = []
    for building_id, extra in extras.items():
        plan = extra.get('floorImages', {}).get('1')
        if not plan:
            continue
        photos = extra.get('entrancePhotos', {})
        view_box, doors = doors_on_plan(PROJECT / plan)
        for number, door in enumerate(doors, start=1):
            entrance_id = f'{building_id}-1-{number}'
            photo = photos.get(entrance_id)
            if photo and not (PROJECT / photo).exists():
                print('  photo listed but missing, not used:', photo)
                photo = None
            output.append({'id': entrance_id, 'building': building_id, 'floor': 1, 'plan': plan,
                           'viewBox': view_box, 'label': door['label'], 'point': door['point'], 'photo': photo})
    OUTPUT.write_text(json.dumps(output, indent=1), encoding='utf-8')
    print(len(output), 'entrances written to', OUTPUT)


if __name__ == '__main__':
    main()
