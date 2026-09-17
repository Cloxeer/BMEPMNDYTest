"""
tools/build_places.py - makes data/places.geojson and data/place-shapes.geojson:
                        the places on the map that aren't buildings (parks, food, parking lots).

WHAT IT DOES : Writes every place in the same shape as a building record, so the map,
               search, sheet and directions treat them the same; "category" tells them apart.
                 park    : data/source/parks.json (checked on NMSU's official campus map).
                           Outline from OpenStreetMap when one matches, otherwise a small
                           circle around NMSU's point, used only to tell when you've arrived.
                 food    : data/source/food.json (checked on NMSU's official dining pages).
                           Arrival uses the outline of the building it's inside, when it has one.
                 parking : downloaded from NMSU Facilities GIS (the official "Parking" layer):
                           every lot NMSU maps, with its outline, name and permit colour.
DEPENDS ON   : Python 3, shapely (python -m pip install --user shapely), internet
               (OpenStreetMap API, NMSU Facilities GIS). tools/json_files.py
READS        : data/source/parks.json, data/source/food.json, data/building-shapes.geojson
WRITES       : data/places.geojson, data/place-shapes.geojson (parks and food),
               data/parking-lots.geojson (parking lot outlines: big, so the app loads it only when needed)
RUN          : python tools/build_buildings.py first (food uses its outlines), then python tools/build_places.py
"""

import json
import math
import urllib.request
from pathlib import Path

from shapely.geometry import shape

from json_files import read_json, write_json

PROJECT = Path(__file__).resolve().parent.parent
SOURCE = PROJECT / 'data' / 'source'
PLACES_OUTPUT = PROJECT / 'data' / 'places.geojson'
SHAPES_OUTPUT = PROJECT / 'data' / 'place-shapes.geojson'
PARKING_OUTPUT = PROJECT / 'data' / 'parking-lots.geojson'
BUILDING_SHAPES = PROJECT / 'data' / 'building-shapes.geojson'
ARRIVAL_RADIUS_M = 25  # size of the arrival circle for a place with no outline
METRES_PER_DEGREE = 111320
NMSU_MAP_LINK = 'https://map.nmsu.edu/?id=1888#!m/'
PARKING_LAYER = ('https://services6.arcgis.com/r7ZUBDL24w5VsBnN/arcgis/rest/services/'
                 'roads7252025/FeatureServer/17')

# How NMSU's parking layer writes each campus -> how we show it.
CAMPUS_NAMES = {
    'LAS CRUCES': 'Las Cruces main campus',
    'ALAMOGORDO': 'NMSU Alamogordo',
    'CARLSBAD': 'NMSU Carlsbad',
    'DACC ESPINA': 'DACC Espina campus (Las Cruces)',
    'DACC EAST MESA': 'DACC East Mesa campus (Las Cruces)',
    'DACC SUNLAND PARK': 'DACC Sunland Park',
    'DACC GADSDEN': 'DACC Gadsden (Anthony)',
    'DACC CHAPARRAL': 'DACC Chaparral',
}

PLACES_NOTE = [
    'Made by tools/build_places.py. Do not edit by hand: edit data/source/parks.json or data/source/food.json',
    '(parking lots are downloaded from NMSU Facilities GIS), then run python tools/build_places.py',
    'Format: GeoJSON. One Feature per place: a Point where it is, and properties in the same shape as a building',
    'record in data/buildings.geojson, plus: category ("park", "food" or "parking"), kind (e.g. "Coffee"),',
    'insideName (food: the building it is inside, or null); for parking: permitColor (e.g. "Purple"), permitRule',
    '(who can park, as NMSU writes it, e.g. "South Campus Resident" or "Free Parking") and campus.',
    'A missing fact is null, and the app shows "Unknown" for it: nothing is guessed.',
]
SHAPES_NOTE = [
    'Made by tools/build_places.py. Do not edit by hand.',
    'Format: GeoJSON. One Feature per park or food place: properties {"id", "category", "name"} and its outline.',
    'Directions use it to tell when you have arrived.',
]
PARKING_NOTE = [
    'Made by tools/build_places.py from NMSU Facilities GIS (Parking layer). Do not edit by hand.',
    'Format: GeoJSON. One Feature per parking lot: properties {"id", "category", "name", "permitColor"} and its outline.',
    'Drawn on the map while the Parking filter is on, and used by directions to tell when you have arrived.',
]


def download_json(url):
    """Download a JSON answer from a web address."""
    request = urllib.request.Request(url, headers={'User-Agent': 'BetterNMSUMaps-build/1.0'})
    with urllib.request.urlopen(request, timeout=90) as response:
        return json.load(response)


def osm_outline(osm_id):
    """The outline (a GeoJSON Polygon) of one OpenStreetMap way, from OpenStreetMap's own API."""
    elements = download_json('https://api.openstreetmap.org/api/0.6/way/' + str(osm_id) + '/full.json')['elements']
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


def place_record(place_id, category, name, kind, source):
    """A place in the same shape as a building record. Callers fill in anything more it has."""
    return {
        'id': place_id,
        'code': '',
        'name': name,
        'aka': [],
        'address': None,
        'propertyNumber': None,
        'built': None,
        'floors': [],
        'floorsSource': '',
        'kind': kind,
        'nmsuUrl': None,
        'photos': [],
        'source': source,
        'floorImages': {},
        'postedImages': {},
        'description': [],
        'doors': [],
        'codeSource': '',
        'category': category,
        'insideName': None,
        'permitColor': None,
        'permitRule': None,
        'campus': None,
    }


def usable_photos(photos):
    """The photos that have a file (the source lists some we couldn't use)."""
    kept = []
    for photo in photos:
        if photo.get('file'):
            kept.append(photo)
    return kept


def feature(record, lng, lat):
    """A GeoJSON point Feature for one place."""
    return {'type': 'Feature', 'properties': record,
            'geometry': {'type': 'Point', 'coordinates': [round(lng, 7), round(lat, 7)]}}


def shape_feature(record, geometry):
    """A GeoJSON outline Feature for one place (parking lots also keep their permit color, to draw them in it)."""
    properties = {'id': record['id'], 'category': record['category'], 'name': record['name']}
    if record['category'] == 'parking':
        properties['permitColor'] = record['permitColor']
    return {'type': 'Feature', 'properties': properties, 'geometry': geometry}


def build_parks(features, shapes):
    """Every park in data/source/parks.json."""
    for park in read_json(SOURCE / 'parks.json')['parks']:
        map_id = str(park['concept3dId'])
        record = place_record('park-' + map_id, 'park', park['name'], park['kind'], '')
        record['aka'] = [park['kind']]
        record['nmsuUrl'] = NMSU_MAP_LINK + map_id
        record['photos'] = usable_photos(park['photos'])

        outline = park['osmOutline']
        if outline:
            if outline['type'] != 'way':
                raise ValueError('Only OpenStreetMap ways are supported; add relation support if a park needs it.')
            geometry = osm_outline(outline['id'])
            record['source'] = ("Location from NMSU's official campus map (map.nmsu.edu). "
                                'Outline from OpenStreetMap (way ' + str(outline['id']) + ').')
        else:
            geometry = circle(park['lng'], park['lat'], ARRIVAL_RADIUS_M)
            record['source'] = "Location from NMSU's official campus map (map.nmsu.edu)."
        features.append(feature(record, park['lng'], park['lat']))
        shapes.append(shape_feature(record, geometry))
    print('parks done')


def build_food(features, shapes):
    """Every food place in data/source/food.json. Arrival uses the outline of the building it's inside."""
    building_outlines = {}
    for outline in read_json(BUILDING_SHAPES)['features']:
        building_outlines[outline['properties']['id']] = outline['geometry']

    for food in read_json(SOURCE / 'food.json')['food']:
        record = place_record(food['id'], 'food', food['name'], food['kind'], food['sourceText'])
        record['aka'] = food['searchNames']
        record['photos'] = usable_photos(food.get('photos', []))
        if food.get('concept3dId'):
            record['nmsuUrl'] = NMSU_MAP_LINK + str(food['concept3dId'])
        inside = food.get('insideBuilding')
        if inside:
            record['insideName'] = inside['name']

        if inside and inside['propertyNumber'] in building_outlines:
            geometry = building_outlines[inside['propertyNumber']]
        else:
            geometry = circle(food['lng'], food['lat'], ARRIVAL_RADIUS_M)
        features.append(feature(record, food['lng'], food['lat']))
        shapes.append(shape_feature(record, geometry))
    print('food done')


def parking_name(lot_name):
    """ "LOT 79H" -> "Lot 79H". A lot with no published name is just called a parking lot."""
    if not lot_name:
        return 'Parking lot'
    words = []
    for word in lot_name.split():
        if any(character.isdigit() for character in word):
            words.append(word)  # lot numbers like 79H stay as they are
        else:
            words.append(word.capitalize())
    return ' '.join(words)


def permit_color(properties):
    """The lot's permit color as NMSU's layer writes it ("Purple", "Orange", ...), or None when it gives none."""
    color = properties.get('TYPE')
    if not color or color == 'No Type':
        return None
    return color


def permit_rule(properties):
    """Who can park, as NMSU's layer writes it ("All Permits Valid", "Commuter Student", "Free Parking", ...), or None."""
    rule = properties.get('COMMENTS')
    if not rule or rule == 'N/A':
        return None
    return rule


def build_parking(features, lot_shapes):
    """Every parking lot in NMSU Facilities GIS's official Parking layer."""
    url = PARKING_LAYER + '/query?where=1%3D1&outFields=OBJECTID,LotName,TYPE,COMMENTS,CAMPUS,FULLADDR,BLDG_CITY&outSR=4326&f=geojson'
    lots = download_json(url)['features']
    for lot in lots:
        properties = lot['properties']
        name = parking_name(properties.get('LotName'))
        record = place_record('parking-' + str(properties['OBJECTID']), 'parking', name, 'Parking lot',
                              'Lot outline, name and permit from NMSU Facilities GIS (Parking layer).')
        record['permitColor'] = permit_color(properties)
        record['permitRule'] = permit_rule(properties)
        campus = CAMPUS_NAMES.get(properties.get('CAMPUS'))
        if properties.get('FULLADDR') and properties.get('BLDG_CITY'):
            record['address'] = properties['FULLADDR'].title() + ', ' + properties['BLDG_CITY'].title() + ', NM'
        if campus:
            record['aka'] = [campus]
            record['campus'] = campus

        spot = shape(lot['geometry']).representative_point()  # a point that is always inside the lot
        features.append(feature(record, spot.x, spot.y))
        lot_shapes.append(shape_feature(record, lot['geometry']))
    print(len(lots), 'parking lots done')


def main():
    """Write every park, food place and parking lot, and their outlines."""
    features = []
    shapes = []
    lot_shapes = []
    build_parks(features, shapes)
    build_food(features, shapes)
    build_parking(features, lot_shapes)
    write_json(PLACES_OUTPUT, PLACES_NOTE, {'type': 'FeatureCollection', 'features': features}, 'compact')
    write_json(SHAPES_OUTPUT, SHAPES_NOTE, {'type': 'FeatureCollection', 'features': shapes}, 'compact')
    write_json(PARKING_OUTPUT, PARKING_NOTE, {'type': 'FeatureCollection', 'features': lot_shapes}, 'compact')
    print(len(features), 'places written to', PLACES_OUTPUT)


if __name__ == '__main__':
    main()
