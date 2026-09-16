"""
tools/build_campuses.py - builds the campus shapes the map draws.

WHAT IT DOES : Runs ONCE on a developer's computer (not in the app). It takes
               NMSU's official data in data/source/ and writes 3 ready-to-draw
               files, so the app never has to do geometry math:
                 data/campuses.geojson       NMSU class places, with leased land cut out
                 data/campus-labels.geojson  one name label per place
                 data/outside-mask.geojson   everything that is NOT a class place
DEPENDS ON   : Python 3 + shapely  (python -m pip install --user shapely)
INPUTS       : data/source/nmsu-campuses.geojson       NMSU Space Planning "Campus Boundaries"
               data/source/nmsu-leased-parcels.geojson NMSU Space Planning parcels marked "Ground Lease"
               data/source/golf-course.geojson         OpenStreetMap way/50280146
RUN IT       : python tools/build_campuses.py
"""

import json
import math
from shapely.geometry import shape, mapping, box, Polygon
from shapely.ops import unary_union

DATA = 'data/'

# Official properties that are not places where NMSU classes happen.
# Each was checked against what is actually on the ground (Sept 2026).
EXCLUDE = {
    'North Campus': "Toucan, McDonald's, Lorenzo's, Speedway, Dollar Tree (commercial).",
    'East Campus': 'Centennial High School + Farm & Ranch Heritage Museum. '
                   'The golf course inside it is added back on its own.',
}

MAIN_CAMPUS = (-106.7494, 32.2744)  # used for the "km from main campus" number
ACRE = 4046.86 / (94200 * 110900)  # one acre in square degrees at Las Cruces' latitude
MIN_PIECE_ACRES = 3  # detached bits / holes smaller than this are noise on a map
# NMSU's parcel lines and campus lines don't line up exactly, so cutting one out
# of the other leaves long strips only a few metres wide. Shrinking a shape by
# THIN and growing it back by THIN erases anything narrower than 2 x THIN
# (~20 m) and leaves real shapes unchanged ("mitre" keeps corners sharp).
THIN = 0.0001  # degrees, about 10 m


def load(name):
    """Read a GeoJSON file from data/."""
    with open(DATA + name, encoding='utf-8') as f:
        return json.load(f)


def km_from_main(point):
    """Straight-line distance in km from main campus to a (lng, lat) point."""
    lng, lat = point
    a, b = math.radians(lat), math.radians(MAIN_CAMPUS[1])
    d = math.radians(lng - MAIN_CAMPUS[0])
    return round(6371 * math.acos(min(1, math.sin(a) * math.sin(b) + math.cos(a) * math.cos(b) * math.cos(d))), 1)


def clean_up(geom):
    """Tidy a shape after cutting leased land out of it:
    1. erase strips narrower than ~20 m,
    2. fill small holes,
    3. drop small detached pieces (the biggest piece is always kept, so tiny
       stand-alone sites like Hillsboro don't disappear)."""
    thin_free = geom.buffer(-THIN, join_style='mitre').buffer(THIN, join_style='mitre')
    # Safety net: only accept the result if it didn't grow. (Shrink-then-grow
    # can misbehave on very small or oddly shaped sites; those keep their outline.)
    if not thin_free.is_empty and thin_free.area <= geom.area * 1.0001:
        geom = thin_free
    parts = list(geom.geoms) if geom.geom_type == 'MultiPolygon' else [geom]
    min_area = MIN_PIECE_ACRES * ACRE
    parts = [Polygon(p.exterior, [h for h in p.interiors if Polygon(h).area >= min_area]) for p in parts]
    biggest = max(parts, key=lambda p: p.area)
    return unary_union([p for p in parts if p is biggest or p.area >= min_area])


def main():
    official = load('source/nmsu-campuses.geojson')['features']
    golf = load('source/golf-course.geojson')['features']
    leased = unary_union([shape(f['geometry']) for f in load('source/nmsu-leased-parcels.geojson')['features']])

    places, labels = [], []
    for f in official + golf:
        name = f['properties']['Name']
        if name in EXCLUDE:
            print('excluded  ', name)
            continue

        # Cut out any land NMSU leases to others (charter schools, offices...).
        geom = shape(f['geometry']).buffer(0).difference(leased)
        if geom.is_empty:
            print('empty after removing leased land:', name)
            continue
        geom = clean_up(geom)

        # One label, placed inside the biggest piece of the place.
        biggest = max(geom.geoms, key=lambda p: p.area) if geom.geom_type == 'MultiPolygon' else geom
        spot = biggest.representative_point()
        km = km_from_main((spot.x, spot.y))

        props = {
            'Name': name,
            'City': f['properties'].get('City'),
            'Acres': f['properties'].get('Acres'),
            'km': km,
            'source': f['properties'].get('source'),
        }
        places.append({'type': 'Feature', 'properties': props, 'geometry': mapping(geom)})
        labels.append({'type': 'Feature', 'properties': {'Name': name},
                       'geometry': {'type': 'Point', 'coordinates': [round(spot.x, 6), round(spot.y, 6)]}})
        print(f'kept {km:6.1f} km  {name}')

    places.sort(key=lambda f: f['properties']['km'])

    # Everything within ~1 degree of campus that is not a class place gets faded.
    # (MapLibre can't cut holes in a world-sized shape, so the box is local.)
    lng, lat = MAIN_CAMPUS
    area = box(lng - 1, lat - 1, lng + 1, lat + 1)
    outside = area.difference(unary_union([shape(p['geometry']) for p in places]))

    def write(name, features):
        with open(DATA + name, 'w', encoding='utf-8') as f:
            json.dump({'type': 'FeatureCollection', 'features': features}, f)

    write('campuses.geojson', places)
    write('campus-labels.geojson', labels)
    write('outside-mask.geojson', [{'type': 'Feature', 'properties': {}, 'geometry': mapping(outside)}])
    print(len(places), 'places written')


if __name__ == '__main__':
    main()
