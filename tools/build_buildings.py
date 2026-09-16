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
RUN IT       : python tools/build_buildings.py
"""

import json
import re
import urllib.request
from pathlib import Path

# Paths are relative to the project folder, so the script works from any folder.
PROJECT = Path(__file__).resolve().parent.parent
SOURCE = PROJECT / 'data' / 'source'
OUTPUT = PROJECT / 'data' / 'buildings.geojson'
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
]

# Buildings with no classes aren't on the Registrar's list, so their code comes from Space Planning.
NOT_ON_REGISTRAR_LIST = {'285'}


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

    features = []
    for number, name, osm_name, map_id, photo_key in BUILDINGS:
        record = official[number]
        extra = extras.get(number, {})
        floors, floors_source = floor_count(record, osm.get(osm_name, {}))
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
            'floorImages': extra.get('floorImages', {}),  # floor number -> our redrawn plan
            'postedImages': extra.get('postedImages', {}),  # floor number -> photo of the posted map
            'description': extra.get('description', []),  # paragraphs
        }
        building['codeSource'] = ('NMSU Space Planning (not on the Registrar list)'
                                  if number in NOT_ON_REGISTRAR_LIST else REGISTRAR)

        position = [round(record['Longitude'], 7), round(record['Latitude'], 7)]
        features.append({'type': 'Feature', 'properties': building,
                         'geometry': {'type': 'Point', 'coordinates': position}})
        print(f"{number} {building['code']:5} {name} ({floors} floors)")

    with open(OUTPUT, 'w', encoding='utf-8') as f:
        json.dump({'type': 'FeatureCollection', 'features': features}, f, indent=1, ensure_ascii=False)
    print(len(features), 'buildings written to', OUTPUT)


if __name__ == '__main__':
    main()
