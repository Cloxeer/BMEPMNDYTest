"""
tools/build_parks.py - makes data/parks.geojson and data/park-shapes.geojson (the green Parks on the map).

WHAT IT DOES : Reads data/source/parks.json: the outdoor spaces on main campus,
               each checked on NMSU's official campus map (map.nmsu.edu), with the
               OpenStreetMap outline that matches it (if there is one).
               Writes each park in the same shape as a building record, so the map,
               search, sheet and directions all work the same; its category is "park".
               A park's outline is downloaded from OpenStreetMap. A park with no
               outline gets a small circle around its official point, used only to
               tell when you've arrived.
DEPENDS ON   : Python 3 and internet (the OpenStreetMap API). tools/json_files.py
WRITES       : data/parks.geojson, data/park-shapes.geojson
RUN          : python tools/build_parks.py
"""

import json
import math
import urllib.request
from pathlib import Path

from json_files import read_json, write_json

PROJECT = Path(__file__).resolve().parent.parent
SOURCE = PROJECT / 'data' / 'source' / 'parks.json'
PARKS_OUTPUT = PROJECT / 'data' / 'parks.geojson'
SHAPES_OUTPUT = PROJECT / 'data' / 'park-shapes.geojson'
ARRIVAL_RADIUS_M = 25  # size of the arrival circle for a park OpenStreetMap has no outline for
METRES_PER_DEGREE = 111320

PARKS_NOTE = [
    'Made by tools/build_parks.py. Do not edit by hand: edit data/source/parks.json, then run python tools/build_parks.py',
    'Format: GeoJSON. One Feature per park: a Point where the park is, and properties in the same shape as a building',
    'record in data/buildings.geojson, with "category": "park" and "kind" (e.g. "Outdoor Spaces").',
]
SHAPES_NOTE = [
    'Made by tools/build_parks.py. Do not edit by hand.',
    'Format: GeoJSON. One Feature per park: properties {"id": "park-<NMSU map id>"} and its outline (a Polygon).',
    'Directions use it to tell when you have arrived.',
]


def download_outline(osm_id):
    """The outline (a GeoJSON Polygon) of one OpenStreetMap way, from OpenStreetMap's own API."""
    url = 'https://api.openstreetmap.org/api/0.6/way/' + str(osm_id) + '/full.json'
    request = urllib.request.Request(url, headers={'User-Agent': 'BetterNMSUMaps-build/1.0'})
    with urllib.request.urlopen(request, timeout=60) as response:
        elements = json.load(response)['elements']

    # The answer lists the way's points ("nodes") and the way itself, which names its nodes in order.
    points = {}
    way = None
    for element in elements:
        if element['type'] == 'node':
            points[element['id']] = [element['lon'], element['lat']]
        elif element['type'] == 'way' and way is None:
            way = element
    ring = []
    for node_id in way['nodes']:
        ring.append(points[node_id])
    return {'type': 'Polygon', 'coordinates': [ring]}


def circle(lng, lat, metres):
    """A circle of 32 points (33 with the closing point) around a place, as a GeoJSON Polygon."""
    ring = []
    for step in range(33):
        angle = 2 * math.pi * step / 32
        east = metres * math.cos(angle) / (METRES_PER_DEGREE * math.cos(math.radians(lat)))
        north = metres * math.sin(angle) / METRES_PER_DEGREE
        ring.append([lng + east, lat + north])
    return {'type': 'Polygon', 'coordinates': [ring]}


def park_record(park):
    """One park, in the same shape as a building record (so the app treats it the same)."""
    photos = []
    for photo in park['photos']:
        if photo.get('file'):
            photos.append(photo)
    return {
        'id': 'park-' + str(park['concept3dId']),
        'code': '',
        'name': park['name'],
        'aka': [park['kind']],
        'address': None,
        'propertyNumber': None,
        'built': None,
        'floors': [],
        'floorsSource': '',
        'kind': park['kind'],
        'nmsuUrl': 'https://map.nmsu.edu/?id=1888#!m/' + str(park['concept3dId']),
        'photos': photos,
        'source': "NMSU's official campus map (Concept3D location " + str(park['concept3dId']) + ')',
        'floorImages': {},
        'postedImages': {},
        'description': [],
        'doors': [],
        'codeSource': '',
        'category': 'park',
    }


def main():
    """Write every park and its outline."""
    parks = read_json(SOURCE)['parks']
    features = []
    shapes = []
    for park in parks:
        record = park_record(park)
        position = [round(park['lng'], 7), round(park['lat'], 7)]
        features.append({'type': 'Feature', 'properties': record, 'geometry': {'type': 'Point', 'coordinates': position}})

        outline = park['osmOutline']
        if outline:
            if outline['type'] != 'way':
                raise ValueError('Only OpenStreetMap ways are supported; add relation support if a park needs it.')
            shape = download_outline(outline['id'])
            print(record['id'], park['name'], '(outline from OpenStreetMap)')
        else:
            shape = circle(park['lng'], park['lat'], ARRIVAL_RADIUS_M)
            print(record['id'], park['name'], '(arrival circle)')
        shapes.append({'type': 'Feature', 'properties': {'id': record['id']}, 'geometry': shape})

    write_json(PARKS_OUTPUT, PARKS_NOTE, {'type': 'FeatureCollection', 'features': features}, 'pretty')
    write_json(SHAPES_OUTPUT, SHAPES_NOTE, {'type': 'FeatureCollection', 'features': shapes}, 'compact')
    print(len(features), 'parks written to', PARKS_OUTPUT)


if __name__ == '__main__':
    main()
