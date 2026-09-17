"""
tools/build_rooms.py - make data/rooms.json, the room list the app searches.

WHAT IT DOES : Collects rooms from two sources; nothing is typed in by hand.
               1. Our floor plans (data/floors/*.svg, traced from the evacuation
                  maps posted in each building): each room number label and the
                  smallest shape it sits inside. These rooms have a floor and an
                  outline, so the app can highlight them.
               2. NMSU's official class schedule (Banner, public): every room a
                  class meets in, for the buildings in BANNER_NAMES. These have
                  no floor or outline (NMSU doesn't publish them), so the app
                  takes you to the building without highlighting a room.
               A room found in both is kept once, with its outline.
               Rooms on our plans also get an indoor route (tools/indoor_routes.py):
               the shortest walk from the nearest outside door (floor 1) or
               stairs (other floors) to the room, drawn as arrows in the app.
               Re-run each semester and update TERMS so the schedule rooms stay current.
DEPENDS ON   : Python 3 and internet. data/source/building-extras.json, data/floors/*.svg
WRITES       : data/rooms.json
RUN          : python tools/build_rooms.py
"""

import json
import re
import urllib.request
import xml.etree.ElementTree as ElementTree
from pathlib import Path

from indoor_routes import routes_for_floor, BLOCKING_CLASSES

PROJECT = Path(__file__).resolve().parent.parent
EXTRAS = PROJECT / 'data' / 'source' / 'building-extras.json'
OUTPUT = PROJECT / 'data' / 'rooms.json'
SVG = '{http://www.w3.org/2000/svg}'

# NMSU's public class schedule, one term at a time (term codes: year + 10 spring, 40 fall).
SCHEDULE = ('https://banner.nmsu.edu/pban/bwckctlg.p_disp_listcrse'
            '?term_in={term}&subj_in=%25&crse_in=%25&schd_in=%25')
TERMS = ['202640', '202710']  # Fall 2026, Spring 2027

# How the schedule writes each building's name -> our building id (property number).
BANNER_NAMES = {
    'Hardman/Jacob UG Learning Ctr': '323',
    'Zuhl Library': '461',
    'Science Hall': '391',
    'Business Complex Building': '386',
    'Jett Hall': '189',
    'Breland Hall': '184',
    'John Whitlock Hernandez Hall': '397',
    'Clara Belle Williams Hall': '364',
    "O'Donnell Hall": '287',
    'Music Building': '389',
    'Chemistry Building': '187',
    'Foster Hall': '34',
    'Domenici Hall': '249',
    'Milton Hall': '83',
    'Gerald Thomas Hall': '244',
    'Health and Social Services Bui': '590',
    'Gardiner Hall': '188',
    'Engineering Complex III': '541',
    'Devasthali Hall': '657',
    'Communication Sciences Bldg': '365',
    'Guthrie Hall': '288',
    'Skeen Hall': '551',
    'Center for the Arts': '631',
}

# A room number: optional letter, three digits, optional letter. "Help Desk 105" ends with one.
ROOM_NUMBER = re.compile(r'(?:^|\s)([A-Z]?\d{3}[A-Z]?)$')
# Shapes that are rooms. "void" (open to below) and the outside walls ("floor") are not.
ROOM_CLASSES = {'room', 'big', 'ours', 'core'}


def shape_points(element):
    """Corner points of a <rect> or <polygon>, as [[x, y], ...]."""
    if element.tag == SVG + 'rect':
        x, y = float(element.get('x')), float(element.get('y'))
        w, h = float(element.get('width')), float(element.get('height'))
        return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]
    numbers = [float(n) for n in re.split(r'[\s,]+', element.get('points').strip())]
    return [numbers[i:i + 2] for i in range(0, len(numbers), 2)]


def contains(points, x, y):
    """Is point (x, y) inside the polygon? (standard ray-casting test)"""
    inside = False
    for (x1, y1), (x2, y2) in zip(points, points[1:] + points[:1]):
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            inside = not inside
    return inside


def area(points):
    """Area of a polygon (shoelace formula)."""
    return abs(sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(points, points[1:] + points[:1]))) / 2


def entrances_on_plan(root, floor):
    """Where you come onto this floor: outside doors on floor 1, stairs on the others."""
    if floor == 1:
        doors = [e for e in root.iter(SVG + 'line') if e.get('class') == 'door']
        return [((float(d.get('x1')) + float(d.get('x2'))) / 2, (float(d.get('y1')) + float(d.get('y2'))) / 2)
                for d in doors]
    entrances = []
    for group in root.iter(SVG + 'g'):
        if group.get('class') != 'stair':
            continue
        xs = [float(line.get(k)) for line in group.iter(SVG + 'line') for k in ('x1', 'x2')]
        ys = [float(line.get(k)) for line in group.iter(SVG + 'line') for k in ('y1', 'y2')]
        entrances.append(((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2))
    return entrances


def rooms_on_plan(svg_file, floor):
    """Every room (number, name, points, indoor route) on one floor plan, plus the plan's viewBox."""
    root = ElementTree.parse(svg_file).getroot()
    shapes = [shape_points(e) for e in root.iter()
              if e.tag in (SVG + 'rect', SVG + 'polygon') and e.get('class') in ROOM_CLASSES]
    texts = [(e.text.strip(), float(e.get('x')), float(e.get('y')), e.get('class'))
             for e in root.iter(SVG + 'text') if e.text]

    rooms = []
    for text, x, y, css_class in texts:
        match = ROOM_NUMBER.search(text)
        if not match or css_class == 'name':
            continue
        around = [points for points in shapes if contains(points, x, y)]
        if not around:
            print('  skipped', text, '(not inside a room shape, e.g. a hallway label)')
            continue
        points = min(around, key=area)
        # A bold name in the same shape ("Lecture Hall") becomes the room's name.
        # Words before the number on the same label ("Help Desk 105") count too.
        names = [t for t, tx, ty, c in texts if c == 'name' and contains(points, tx, ty)]
        words_before = text[:match.start(1)].strip()
        name = ' '.join(names) or words_before
        rooms.append({'number': match.group(1), 'name': name, 'points': points})

    # Indoor routes: the building outline is walkable; rooms, cores and voids are walls.
    shapes_by_class = [(e.get('class'), shape_points(e)) for e in root.iter()
                       if e.tag in (SVG + 'rect', SVG + 'polygon')]
    outlines = [points for css_class, points in shapes_by_class if css_class == 'floor']
    blockers = [points for css_class, points in shapes_by_class if css_class in BLOCKING_CLASSES]
    routes = routes_for_floor(outlines, blockers, entrances_on_plan(root, floor), rooms)
    for room in rooms:
        room['indoorRoute'] = routes.get(room['number'])  # None = no route found
        room['indoorFrom'] = 'door' if floor == 1 else 'stairs'
    return root.get('viewBox'), rooms


def rooms_on_schedule():
    """Every (building id, room number) a class meets in, from NMSU's schedule for TERMS."""
    names = '|'.join(re.escape(name) for name in BANNER_NAMES)
    cell = re.compile(r'CLASS="dddefault">(' + names + r') ([0-9A-Z]+)</td>')
    found = set()
    for term in TERMS:
        print('downloading class schedule for term', term, '(about 15 MB)')
        with urllib.request.urlopen(SCHEDULE.format(term=term), timeout=300) as response:
            page = response.read().decode('utf-8', errors='replace')
        found |= {(BANNER_NAMES[name], number) for name, number in cell.findall(page)}
    return found


def main():
    extras = json.loads(EXTRAS.read_text(encoding='utf-8'))
    output = []
    for building_id, extra in extras.items():
        for floor, plan in extra.get('floorImages', {}).items():
            print(building_id, 'floor', floor, plan)
            view_box, rooms = rooms_on_plan(PROJECT / plan, int(floor))
            for room in rooms:
                output.append({'building': building_id, 'floor': int(floor), 'plan': plan,
                               'viewBox': view_box, **room, 'source': 'floor plan'})

    on_plans = {(room['building'], room['number']) for room in output}
    for building_id, number in sorted(rooms_on_schedule() - on_plans):
        output.append({'building': building_id, 'floor': None, 'plan': None, 'viewBox': None,
                       'number': number, 'name': '', 'points': None, 'indoorRoute': None, 'indoorFrom': None,
                       'source': 'NMSU class schedule'})

    OUTPUT.write_text(json.dumps(output, indent=1), encoding='utf-8')
    print(len(output), 'rooms written to', OUTPUT)


if __name__ == '__main__':
    main()
