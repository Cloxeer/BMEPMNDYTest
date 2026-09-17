"""
tools/build_buildings.py - builds data/buildings.geojson (the buildings on the map).

WHAT IT DOES : Runs ONCE on a developer's computer (not in the app). For each
               building in BUILDINGS below it downloads NMSU's official record,
               adds photos and any hand-written extras, and writes one file the
               app reads.
DEPENDS ON   : Python 3 and an internet connection. No extra packages.
SOURCES      : NMSU Office of Space Planning "Buildings" layer: name, code,
                 address, year built, number of stories, map position
               NMSU Registrar building abbreviations (records.nmsu.edu): the code
                 students see on schedules, when it differs (see extras)
               data/source/buildings-osm.geojson: floor count when NMSU lists none
               data/source/photos.json: freely licensed photos
               data/source/building-extras.json: floor plans + descriptions
               data/source/entrances.geojson: doors mapped in OpenStreetMap
WRITES       : data/buildings.geojson (one point per building, with its facts)
               data/building-shapes.geojson (NMSU's official outline of each
                 building: used to tell when you've walked inside)
RUN IT       : python tools/build_buildings.py
"""

import json
import math
import re
import urllib.request
from pathlib import Path

# Paths are relative to the project folder, so the script works from any folder.
PROJECT = Path(__file__).resolve().parent.parent
SOURCE = PROJECT / 'data' / 'source'
OUTPUT = PROJECT / 'data' / 'buildings.geojson'
SHAPES_OUTPUT = PROJECT / 'data' / 'building-shapes.geojson'
DOOR_DISTANCE_M = 4  # an OpenStreetMap door within this many metres of NMSU's outline belongs to the building
METRES_PER_DEGREE = 111320
NMSU_BUILDINGS = ('https://services6.arcgis.com/r7ZUBDL24w5VsBnN/arcgis/rest/services/'
                  'buildings_642026_WFL1/FeatureServer/9/query')
REGISTRAR = 'NMSU Registrar building abbreviations (records.nmsu.edu)'

# property number, name shown in the app, name in OpenStreetMap, NMSU map (Concept3D) id, photos.json key
BUILDINGS = [
    ('323', 'Hardman and Jacobs Undergraduate Learning Center', 'Hardman and Jacobs Undergraduate Learning Center', 525521, None),
    ('461', 'Zuhl Library', 'Zuhl Library', 526019, 'Zuhl Library'),
    ('285', 'Corbett Center Student Union', 'Corbett Center Student Union', 526646, None),
    ('278', 'Branson Library', 'Branson Hall Library', 526015, 'Branson Hall Library'),
    ('391', 'Science Hall', 'Science Hall', 525545, None),
    ('386', 'Business Complex', 'Business Complex', 525491, None),
    ('189', 'Jett Hall', 'Jett Hall', 525525, None),
    ('184', 'Breland Hall', 'Breland Hall', 525489, None),
    ('397', 'John Whitlock Hernandez Hall', 'John Whitlock Hernandez Hall / Engineering Complex II', 525527, None),
    ('364', 'Clara Belle Williams Hall', 'Clara Belle Williams Hall', 525497, None),
    # The 15 Las Cruces academic buildings with the most class sections in NMSU's
    # Fall 2026 + Spring 2027 class schedule that weren't listed above (checked one by one
    # against Space Planning, the Registrar list and NMSU's Concept3D map):
    ('287', "O'Donnell Hall", None, 525539, None),
    ('389', 'Music Building', None, 525535, 'Music Building'),
    ('187', 'Chemistry Building', None, 525495, None),
    ('34', 'Foster Hall', None, 525509, 'Foster Hall'),
    ('249', 'Pete V. Domenici Hall', None, 525541, None),
    ('83', 'Milton Hall', None, 525533, None),
    ('244', 'Gerald Thomas Hall', None, 525513, None),
    ('590', 'Health and Social Services Building', None, 525523, None),
    ('188', 'Gardiner Hall', None, 525511, None),
    ('541', 'Engineering Complex III', None, 525505, None),
    ('657', 'Devasthali Hall', None, 525386, None),
    ('365', 'Communication Sciences Building', None, 525499, None),
    ('288', 'Guthrie Hall', None, 525517, None),
    ('551', 'Skeen Hall', None, 525547, 'Skeen Hall'),
    ('631', 'Center for the Arts', None, 525493, 'Center for the Arts'),
]

# Buildings with no classes aren't on the Registrar's list, so their code comes from Space Planning.
NOT_ON_REGISTRAR_LIST = {'285', '657', '365'}


def read_json(name):
    """Read a JSON file from data/source/."""
    with open(SOURCE / name, encoding='utf-8') as f:
        return json.load(f)


def download_official_records():
    """Get NMSU's official record for every building in BUILDINGS, keyed by property number."""
    numbers = ','.join("'" + b[0] + "'" for b in BUILDINGS)
    url = NMSU_BUILDINGS + '?where=Property+IN+(' + numbers + ')&outFields=*&returnGeometry=false&f=json'
    with urllib.request.urlopen(url, timeout=90) as response:
        rows = json.load(response)['features']
    return {row['attributes']['Property']: row['attributes'] for row in rows}


def download_outlines():
    """NMSU's official outline (polygon) of every building in BUILDINGS, keyed by property number."""
    numbers = ','.join("'" + b[0] + "'" for b in BUILDINGS)
    url = (NMSU_BUILDINGS + '?where=Property+IN+(' + numbers + ')&outFields=Property'
           '&returnGeometry=true&outSR=4326&f=geojson')
    with urllib.request.urlopen(url, timeout=90) as response:
        features = json.load(response)['features']
    return {f['properties']['Property']: f['geometry'] for f in features}


def metres_to_outline(point, geometry):
    """Shortest distance in metres from a [lng, lat] point to a building outline's edges."""
    rings = geometry['coordinates'] if geometry['type'] == 'Polygon' else [r for p in geometry['coordinates'] for r in p]
    shrink = math.cos(math.radians(point[1]))  # a degree of longitude is shorter away from the equator
    px, py = point[0] * shrink, point[1]
    best = float('inf')
    for ring in rings:
        for (ax, ay), (bx, by) in zip(ring, ring[1:]):
            ax, bx = ax * shrink, bx * shrink
            dx, dy = bx - ax, by - ay
            t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / ((dx * dx + dy * dy) or 1)))
            best = min(best, math.hypot(px - (ax + t * dx), py - (ay + t * dy)))
    return best * METRES_PER_DEGREE


def existing_pictures(pictures, number):
    """Keep only floor pictures whose file is really in the project (a missing one is reported, not listed)."""
    kept = {}
    for floor, file in pictures.items():
        if (PROJECT / file).exists():
            kept[floor] = file
        else:
            print('  not listed (file not added yet):', file, 'for building', number)
    return kept


def floor_count(record, osm_building):
    """Stories from NMSU (e.g. 'ACAD-3 STORY'); if NMSU has none, use OpenStreetMap."""
    match = re.search(r'(\d+)\s*STORY', record['Property_C'] or '')
    if match:
        return int(match.group(1)), 'NMSU Space Planning'
    return int(osm_building.get('levels') or 0), 'OpenStreetMap building:levels'


def main():
    official = download_official_records()
    osm = {f['properties'].get('name'): f['properties'] for f in read_json('buildings-osm.geojson')['features']}
    photos = read_json('photos.json')
    extras = read_json('building-extras.json')
    outlines = download_outlines()
    doors = [f['geometry']['coordinates'] for f in read_json('entrances.geojson')['features']]
    shapes = []

    features = []
    for number, name, osm_name, map_id, photo_key in BUILDINGS:
        record = official[number]
        extra = extras.get(number, {})
        floors, floors_source = floor_count(record, osm.get(osm_name, {}))
        if 'floors' in extra:  # checked by hand when NMSU lists no story count (see building-extras.json)
            floors, floors_source = extra['floors'] or 0, extra['floorsSource']
        if floors == 0:
            print('WARNING: no floor count for', number, name)

        building = {
            'id': number,
            'code': extra.get('code', record['Address_2']),
            'name': name,
            'aka': [record['Address_2'], number, record['Descriptio'].title()] + extra.get('aka', []),
            'address': record['Address_1'].title() + ', Las Cruces, NM ' + record['Zip_Code'],
            'propertyNumber': number,
            'built': record['DateBuilt'],
            'floors': list(range(1, floors + 1)),
            'floorsSource': floors_source,
            'nmsuUrl': 'https://map.nmsu.edu/?id=1888#!m/' + str(map_id),
            'photos': [p for p in photos.get(photo_key, []) if p.get('file')] if photo_key else [],
            'source': 'NMSU Office of Space Planning, Buildings layer (property ' + number + ')',
            # Every building has the same fields, so every sheet looks the same.
            # Empty means "not added yet"; the app shows a message instead.
            'floorImages': existing_pictures(extra.get('floorImages', {}), number),  # floor -> our redrawn plan
            'postedImages': existing_pictures(extra.get('postedImages', {}), number),  # floor -> photo of the posted map
            'description': extra.get('description', []),  # paragraphs
            # Where directions lead: mapped doors on this building (empty = walk to its centre).
            'doors': [d for d in doors if metres_to_outline(d, outlines[number]) <= DOOR_DISTANCE_M],
        }
        building['codeSource'] = ('NMSU Space Planning (not on the Registrar list)'
                                  if number in NOT_ON_REGISTRAR_LIST else REGISTRAR)

        shapes.append({'type': 'Feature', 'properties': {'id': number}, 'geometry': outlines[number]})
        position = [round(record['Longitude'], 7), round(record['Latitude'], 7)]
        features.append({'type': 'Feature', 'properties': building,
                         'geometry': {'type': 'Point', 'coordinates': position}})
        print(f"{number} {building['code']:5} {name} ({floors} floors, {len(building['doors'])} doors)")

    with open(OUTPUT, 'w', encoding='utf-8') as f:
        json.dump({'type': 'FeatureCollection', 'features': features}, f, indent=1, ensure_ascii=False)
    print(len(features), 'buildings written to', OUTPUT)
    with open(SHAPES_OUTPUT, 'w', encoding='utf-8') as f:
        json.dump({'type': 'FeatureCollection', 'features': shapes}, f, separators=(',', ':'))
    print(len(shapes), 'outlines written to', SHAPES_OUTPUT)


if __name__ == '__main__':
    main()
