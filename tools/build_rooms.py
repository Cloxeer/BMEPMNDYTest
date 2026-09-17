"""
tools/build_rooms.py - makes data/rooms.json, the room list the app searches.

WHAT IT DOES : Collects rooms from two sources; nothing is typed in by hand.
               1. Our floor plans (data/floors/*.svg, traced from the evacuation maps
                  posted in each building): each room number label, and the smallest
                  shape it sits inside. These rooms have a floor and an outline, so
                  the app can highlight them.
               2. NMSU's official class schedule (Banner, public): every room a class
                  meets in, for the buildings in BANNER_NAMES. These have no floor or
                  outline (NMSU doesn't publish them), so the app takes you to the
                  building without highlighting a room.
               A room found in both is kept once, with its outline.
               Rooms on our plans also get an indoor route (tools/indoor_routes.py):
               the shortest walk from the nearest outside door (floor 1) or stairs
               (other floors) to the room, drawn as arrows in the app.
               Run it again each semester, and update TERMS, so the schedule rooms stay current.
DEPENDS ON   : Python 3 and internet. tools/json_files.py, tools/indoor_routes.py,
               data/source/building-extras.json, data/floors/*.svg
WRITES       : data/rooms.json
RUN          : python tools/build_rooms.py
"""

import re
import urllib.request
import xml.etree.ElementTree as ElementTree
from pathlib import Path

from indoor_routes import routes_for_floor, BLOCKING_CLASSES
from json_files import NOTE_KEY, read_json, write_json

PROJECT = Path(__file__).resolve().parent.parent
EXTRAS = PROJECT / 'data' / 'source' / 'building-extras.json'
OUTPUT = PROJECT / 'data' / 'rooms.json'
SVG = '{http://www.w3.org/2000/svg}'  # every tag in an SVG file starts with this

# NMSU's public class schedule, one term at a time (term codes: year + 10 for spring, 40 for fall).
SCHEDULE = ('https://banner.nmsu.edu/pban/bwckctlg.p_disp_listcrse'
            '?term_in={term}&subj_in=%25&crse_in=%25&schd_in=%25')
TERMS = ['202640', '202710']  # Fall 2026, Spring 2027

# How the schedule writes each building's name -> our building id (its property number).
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
    'Knox Hall': '368',
    'Kent Hall': '33',
    'Health & Social Services Annex': '619',
    'Engineering Complex I': '363',
    'Biology Annex': '82',
    'William B. Conroy Honors Cente': '35',
    'Theatre Scene Shop': '385',
    'Astronomy Building': '225',
    'Jett Annex': '190',
    'Goddard Hall': '10',
    'Tejada Building, Extension Ann': '245',
    'Food Science, Security, and Sa': '662',
    'Ag Student Learning Center': '683',
    'Fulton Athletic Center (Stadiu': '596',
    'Natatorium': '251',
    'Golf Course Clubhouse': '597',
    'Photovotaic Center': '369',  # the schedule's own spelling
    'Ag. Institute/Police/Parking': '30',
    'Equestrian Building': '465',
    'Fabian Garcia Science Center': '158',
    'James B. Delamater Activity Ce': '321',
    'Rentfrow Gym': '211',
    'Garcia Residence Hall': '275',
}

# A room number: an optional letter, three digits, an optional letter. "Help Desk 105" ends with one.
ROOM_NUMBER = re.compile(r'(?:^|\s)([A-Z]?\d{3}[A-Z]?)$')
# Shapes that are rooms. "void" (open to below) and the outside walls ("floor") are not.
ROOM_CLASSES = {'room', 'big', 'ours', 'core'}

NOTE = [
    'Made by tools/build_rooms.py. Do not edit by hand: change a floor plan or TERMS / BANNER_NAMES in the script,',
    'then run python tools/build_rooms.py',
    'Format: "rooms" is a list. Each room: building (property number), floor, plan (floor plan file), viewBox,',
    'number (e.g. "225"), name, points (its outline on the plan), indoorRoute (the walk to it, or null),',
    'indoorFrom ("door" or "stairs") and source ("floor plan" or "NMSU class schedule").',
    'Rooms from the class schedule have null for floor, plan, viewBox, points, indoorRoute and indoorFrom.',
]


def shape_points(element):
    """The corner points of a <rect> or <polygon>, as [[x, y], ...]."""
    if element.tag == SVG + 'rect':
        x = float(element.get('x'))
        y = float(element.get('y'))
        width = float(element.get('width'))
        height = float(element.get('height'))
        return [[x, y], [x + width, y], [x + width, y + height], [x, y + height]]
    numbers = []
    for text in re.split(r'[\s,]+', element.get('points').strip()):
        numbers.append(float(text))
    points = []
    for i in range(0, len(numbers), 2):
        points.append(numbers[i:i + 2])
    return points


def contains(points, x, y):
    """Is the point (x, y) inside the polygon? (ray casting, like tools/indoor_routes.py)"""
    inside = False
    for i in range(len(points)):
        x1, y1 = points[i]
        x2, y2 = points[(i + 1) % len(points)]
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            inside = not inside
    return inside


def area(points):
    """The area of a polygon (the shoelace formula)."""
    total = 0
    for i in range(len(points)):
        x1, y1 = points[i]
        x2, y2 = points[(i + 1) % len(points)]
        total += x1 * y2 - x2 * y1
    return abs(total) / 2


def middle_of_line(line):
    """The middle point of an SVG <line>."""
    x = (float(line.get('x1')) + float(line.get('x2'))) / 2
    y = (float(line.get('y1')) + float(line.get('y2'))) / 2
    return x, y


def entrances_on_plan(root, floor):
    """Where you come onto this floor: the outside doors on floor 1, the stairs on the others."""
    entrances = []
    if floor == 1:
        for line in root.iter(SVG + 'line'):
            if line.get('class') == 'door':
                entrances.append(middle_of_line(line))
        return entrances

    for group in root.iter(SVG + 'g'):
        if group.get('class') != 'stair':
            continue
        # The middle of the box around all the stair's lines.
        xs = []
        ys = []
        for line in group.iter(SVG + 'line'):
            xs.append(float(line.get('x1')))
            xs.append(float(line.get('x2')))
        for line in group.iter(SVG + 'line'):
            ys.append(float(line.get('y1')))
            ys.append(float(line.get('y2')))
        entrances.append(((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2))
    return entrances


def rooms_on_plan(svg_file, floor):
    """Every room (number, name, outline, indoor route) on one floor plan, and the plan's viewBox."""
    root = ElementTree.parse(svg_file).getroot()

    room_shapes = []  # the outline of every shape that is a room
    all_shapes = []  # (class, outline) of every rect and polygon, for indoor routes
    for element in root.iter():
        if element.tag not in (SVG + 'rect', SVG + 'polygon'):
            continue
        all_shapes.append((element.get('class'), shape_points(element)))
        if element.get('class') in ROOM_CLASSES:
            room_shapes.append(shape_points(element))

    texts = []  # (text, x, y, class) of every label
    for element in root.iter(SVG + 'text'):
        if element.text:
            texts.append((element.text.strip(), float(element.get('x')), float(element.get('y')), element.get('class')))

    rooms = []
    for text, x, y, css_class in texts:
        match = ROOM_NUMBER.search(text)
        if not match or css_class == 'name':
            continue
        around = []
        for points in room_shapes:
            if contains(points, x, y):
                around.append(points)
        if not around:
            print('  skipped', text, '(not inside a room shape, e.g. a hallway label)')
            continue
        points = min(around, key=area)  # the smallest shape the number sits in

        # A bold name in the same shape ("Lecture Hall") becomes the room's name.
        # Words before the number on the same label ("Help Desk 105") count too.
        names = []
        for name_text, name_x, name_y, name_class in texts:
            if name_class == 'name' and contains(points, name_x, name_y):
                names.append(name_text)
        words_before = text[:match.start(1)].strip()
        name = ' '.join(names) or words_before
        rooms.append({'number': match.group(1), 'name': name, 'points': points})

    # Indoor routes: the building outline is walkable; rooms, cores and voids are walls.
    outlines = []
    blockers = []
    for css_class, points in all_shapes:
        if css_class == 'floor':
            outlines.append(points)
        if css_class in BLOCKING_CLASSES:
            blockers.append(points)
    routes = routes_for_floor(outlines, blockers, entrances_on_plan(root, floor), rooms)
    for room in rooms:
        room['indoorRoute'] = routes.get(room['number'])  # None = no route found
        if floor == 1:
            room['indoorFrom'] = 'door'
        else:
            room['indoorFrom'] = 'stairs'
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
        for name, number in cell.findall(page):
            found.add((BANNER_NAMES[name], number))
    return found


def main():
    """Collect and write every room from our plans and the class schedule."""
    extras = read_json(EXTRAS)
    output = []
    for building_id in extras:
        if building_id == NOTE_KEY:
            continue
        for floor, plan in extras[building_id].get('floorImages', {}).items():
            print(building_id, 'floor', floor, plan)
            view_box, rooms = rooms_on_plan(PROJECT / plan, int(floor))
            for room in rooms:
                record = {'building': building_id, 'floor': int(floor), 'plan': plan, 'viewBox': view_box}
                record.update(room)  # number, name, points, indoorRoute, indoorFrom
                record['source'] = 'floor plan'
                output.append(record)

    on_plans = set()
    for room in output:
        on_plans.add((room['building'], room['number']))
    for building_id, number in sorted(rooms_on_schedule() - on_plans):
        output.append({'building': building_id, 'floor': None, 'plan': None, 'viewBox': None,
                       'number': number, 'name': '', 'points': None, 'indoorRoute': None, 'indoorFrom': None,
                       'source': 'NMSU class schedule'})

    write_json(OUTPUT, NOTE, {'rooms': output}, 'pretty')
    print(len(output), 'rooms written to', OUTPUT)


if __name__ == '__main__':
    main()
