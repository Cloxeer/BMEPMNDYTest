"""
tools/build_campuses.py - makes the campus shapes the map draws.

WHAT IT DOES : Runs on a developer's computer (not in the app). It takes NMSU's
               official data in data/source/ and writes 3 ready-to-draw files, so the
               app never has to do shape maths:
                 data/campuses.geojson       NMSU class places, with leased land cut out
                 data/campus-labels.geojson  one name label per place
                 data/outside-mask.geojson   everything that is NOT a class place (faded on the map)
DEPENDS ON   : Python 3 + shapely (python -m pip install --user shapely). tools/json_files.py
INPUTS       : data/source/nmsu-campuses.geojson       NMSU Space Planning "Campus Boundaries"
               data/source/nmsu-leased-parcels.geojson NMSU Space Planning parcels marked "Ground Lease"
               data/source/golf-course.geojson         OpenStreetMap way/50280146
RUN          : python tools/build_campuses.py
"""

import math
from pathlib import Path

from shapely.geometry import shape, mapping, box, Polygon
from shapely.ops import unary_union

from json_files import read_json, write_json

# Paths start from the project folder, so the script works from any folder.
DATA = Path(__file__).resolve().parent.parent / 'data'

# Official properties that are not places where NMSU classes happen.
# Each was checked against what is actually on the ground (Sept 2026).
EXCLUDE = {
    'North Campus': "Toucan, McDonald's, Lorenzo's, Speedway, Dollar Tree (commercial).",
    'East Campus': 'Centennial High School + Farm & Ranch Heritage Museum. '
                   'The golf course inside it is added back on its own.',
}

MAIN_CAMPUS = (-106.7494, 32.2744)  # used for the "km from main campus" number
ACRE = 4046.86 / (94200 * 110900)  # one acre in square degrees at Las Cruces' latitude
MIN_PIECE_ACRES = 3  # detached bits and holes smaller than this are just noise on a map
# NMSU's parcel lines and campus lines don't line up exactly, so cutting one out of
# the other leaves long strips only a few metres wide. Shrinking a shape by THIN and
# growing it back by THIN erases anything narrower than 2 x THIN (about 20 m) and
# leaves real shapes unchanged ("mitre" keeps the corners sharp).
THIN = 0.0001  # degrees, about 10 m

CAMPUSES_NOTE = [
    'Made by tools/build_campuses.py. Do not edit by hand: change data/source/, then run python tools/build_campuses.py',
    'Format: GeoJSON, nearest place first. One Feature per NMSU class place: its shape (leased land cut out) and',
    'properties Name, City, Acres, km (straight-line distance from main campus) and source.',
]
LABELS_NOTE = [
    'Made by tools/build_campuses.py. Do not edit by hand.',
    'Format: GeoJSON. One Point Feature per NMSU class place, inside its biggest piece: where the map writes its Name.',
]
OUTSIDE_NOTE = [
    'Made by tools/build_campuses.py. Do not edit by hand.',
    'Format: GeoJSON. One Feature: everything near Las Cruces that is not an NMSU class place (faded on the map).',
]


def km_from_main(point):
    """The straight-line distance in km from main campus to a (lng, lat) point (on a round Earth)."""
    lng, lat = point
    a = math.radians(lat)
    b = math.radians(MAIN_CAMPUS[1])
    d = math.radians(lng - MAIN_CAMPUS[0])
    cosine = min(1, math.sin(a) * math.sin(b) + math.cos(a) * math.cos(b) * math.cos(d))
    return round(6371 * math.acos(cosine), 1)


def pieces_of(geom):
    """The separate polygons of a shape (a MultiPolygon has several, a Polygon just one)."""
    if geom.geom_type == 'MultiPolygon':
        return list(geom.geoms)
    return [geom]


def biggest_piece(geom):
    """The polygon with the largest area (the first one, if two are the same)."""
    return max(pieces_of(geom), key=lambda piece: piece.area)


def clean_up(geom):
    """
    Tidy a shape after cutting leased land out of it:
    1. erase strips narrower than about 20 m,
    2. fill small holes,
    3. drop small detached pieces (the biggest piece is always kept, so tiny
       stand-alone sites like Hillsboro don't disappear).
    """
    thin_free = geom.buffer(-THIN, join_style='mitre').buffer(THIN, join_style='mitre')
    # Safety net: only use the result if it didn't grow. (Shrink-then-grow can
    # misbehave on very small or oddly shaped sites; those keep their outline.)
    if not thin_free.is_empty and thin_free.area <= geom.area * 1.0001:
        geom = thin_free

    min_area = MIN_PIECE_ACRES * ACRE
    parts = []
    for part in pieces_of(geom):
        big_holes = []
        for hole in part.interiors:
            if Polygon(hole).area >= min_area:
                big_holes.append(hole)
        parts.append(Polygon(part.exterior, big_holes))

    biggest = max(parts, key=lambda part: part.area)
    kept = []
    for part in parts:
        if part is biggest or part.area >= min_area:
            kept.append(part)
    return unary_union(kept)


def main():
    """Cut, tidy and write every campus shape."""
    official = read_json(DATA / 'source' / 'nmsu-campuses.geojson')['features']
    golf = read_json(DATA / 'source' / 'golf-course.geojson')['features']
    leased_shapes = []
    for feature in read_json(DATA / 'source' / 'nmsu-leased-parcels.geojson')['features']:
        leased_shapes.append(shape(feature['geometry']))
    leased = unary_union(leased_shapes)

    places = []
    labels = []
    for feature in official + golf:
        name = feature['properties']['Name']
        if name in EXCLUDE:
            print('excluded  ', name)
            continue

        # Cut out any land NMSU leases to others (charter schools, offices...).
        geom = shape(feature['geometry']).buffer(0).difference(leased)
        if geom.is_empty:
            print('empty after removing leased land:', name)
            continue
        geom = clean_up(geom)

        # One label, placed inside the biggest piece of the place.
        spot = biggest_piece(geom).representative_point()
        km = km_from_main((spot.x, spot.y))

        properties = {
            'Name': name,
            'City': feature['properties'].get('City'),
            'Acres': feature['properties'].get('Acres'),
            'km': km,
            'source': feature['properties'].get('source'),
        }
        places.append({'type': 'Feature', 'properties': properties, 'geometry': mapping(geom)})
        labels.append({'type': 'Feature', 'properties': {'Name': name},
                       'geometry': {'type': 'Point', 'coordinates': [round(spot.x, 6), round(spot.y, 6)]}})
        print('kept', format(km, '6.1f'), 'km ', name)

    places.sort(key=lambda place: place['properties']['km'])  # nearest first

    # Everything within about 1 degree of campus that is not a class place gets faded.
    # (MapLibre can't cut holes in a world-sized shape, so the box stays local.)
    lng, lat = MAIN_CAMPUS
    area = box(lng - 1, lat - 1, lng + 1, lat + 1)
    place_shapes = []
    for place in places:
        place_shapes.append(shape(place['geometry']))
    outside = area.difference(unary_union(place_shapes))

    write_json(DATA / 'campuses.geojson', CAMPUSES_NOTE, {'type': 'FeatureCollection', 'features': places}, 'spaced')
    write_json(DATA / 'campus-labels.geojson', LABELS_NOTE, {'type': 'FeatureCollection', 'features': labels}, 'spaced')
    outside_feature = {'type': 'Feature', 'properties': {}, 'geometry': mapping(outside)}
    write_json(DATA / 'outside-mask.geojson', OUTSIDE_NOTE, {'type': 'FeatureCollection', 'features': [outside_feature]}, 'spaced')
    print(len(places), 'places written')


if __name__ == '__main__':
    main()
