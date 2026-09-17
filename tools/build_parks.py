"""
tools/build_parks.py - make data/parks.geojson and data/park-shapes.geojson (the green "Parks" on the map).

WHAT IT DOES : Reads data/source/parks.json: 5 outdoor spaces on the main campus,
               each checked on NMSU's official campus map (map.nmsu.edu, Concept3D),
               with the OpenStreetMap outline that matches it (if there is one).
               Writes each park in the same shape as a building record (so the
               map, search, sheet and directions all work the same), with
               category "park". Its outline is downloaded from OpenStreetMap; a
               park with no outline gets a small circle around its official
               point, used only to tell when you've arrived.
DEPENDS ON   : Python 3 and internet (OpenStreetMap API).
WRITES       : data/parks.geojson, data/park-shapes.geojson
RUN          : python tools/build_parks.py
"""

import json
import math
import urllib.request
from pathlib import Path

PROJECT = Path(__file__).resolve().parent.parent
SOURCE = PROJECT / 'data' / 'source' / 'parks.json'
PARKS_OUTPUT = PROJECT / 'data' / 'parks.geojson'
SHAPES_OUTPUT = PROJECT / 'data' / 'park-shapes.geojson'
ARRIVAL_RADIUS_M = 25  # size of the arrival circle for a park OpenStreetMap has no outline for


def download_outline(kind, osm_id):
    """The outline (GeoJSON Polygon) of one OpenStreetMap way, from OpenStreetMap's own API."""
    if kind != 'way':
        raise ValueError('Only way outlines are supported; add relation support if a park needs it.')
    url = f'https://api.openstreetmap.org/api/0.6/way/{osm_id}/full.json'
    request = urllib.request.Request(url, headers={'User-Agent': 'BetterNMSUMaps-build/1.0'})
    with urllib.request.urlopen(request, timeout=60) as response:
        elements = json.load(response)['elements']
    nodes = {e['id']: [e['lon'], e['lat']] for e in elements if e['type'] == 'node'}
    way = next(e for e in elements if e['type'] == 'way')
    return {'type': 'Polygon', 'coordinates': [[nodes[n] for n in way['nodes']]]}


def circle(lng, lat, metres):
    """A 32-point circle around a point, as a GeoJSON Polygon."""
    points = []
    for step in range(33):
        angle = 2 * math.pi * step / 32
        points.append([lng + metres * math.cos(angle) / (111320 * math.cos(math.radians(lat))),
                       lat + metres * math.sin(angle) / 111320])
    return {'type': 'Polygon', 'coordinates': [points]}


def main():
    parks = json.loads(SOURCE.read_text(encoding='utf-8'))
    features, shapes = [], []
    for park in parks:
        park_id = 'park-' + str(park['concept3dId'])
        record = {
            'id': park_id, 'code': '', 'name': park['name'], 'aka': [park['kind']],
            'address': None, 'propertyNumber': None, 'built': None,
            'floors': [], 'floorsSource': '', 'kind': park['kind'],
            'nmsuUrl': 'https://map.nmsu.edu/?id=1888#!m/' + str(park['concept3dId']),
            'photos': [p for p in park['photos'] if p.get('file')],
            'source': "NMSU's official campus map (Concept3D location " + str(park['concept3dId']) + ')',
            'floorImages': {}, 'postedImages': {}, 'description': [], 'doors': [],
            'codeSource': '', 'category': 'park',
        }
        features.append({'type': 'Feature', 'properties': record,
                         'geometry': {'type': 'Point', 'coordinates': [round(park['lng'], 7), round(park['lat'], 7)]}})
        outline = park['osmOutline']
        shape = download_outline(outline['type'], outline['id']) if outline else circle(park['lng'], park['lat'], ARRIVAL_RADIUS_M)
        shapes.append({'type': 'Feature', 'properties': {'id': park_id}, 'geometry': shape})
        print(park_id, park['name'], '(outline from OpenStreetMap)' if outline else '(arrival circle)')

    PARKS_OUTPUT.write_text(json.dumps({'type': 'FeatureCollection', 'features': features}, indent=1, ensure_ascii=False), encoding='utf-8')
    SHAPES_OUTPUT.write_text(json.dumps({'type': 'FeatureCollection', 'features': shapes}, separators=(',', ':')), encoding='utf-8')
    print(len(features), 'parks written to', PARKS_OUTPUT)


if __name__ == '__main__':
    main()
