"""
tools/build_routes.py - make the networks directions travel along: walking, biking, driving.

WHAT IT DOES : Downloads every road and path around NMSU Las Cruces from
               OpenStreetMap once, then sorts them into three networks using
               OpenStreetMap's own access tags (nothing is guessed or drawn by hand):
                 walk  : footpaths, steps, campus malls, and streets (sidewalks)
                 bike  : cycleways, paths and streets; footpaths only where
                         bicycles are marked allowed; never steps
                 drive : roads a car may use, keeping one-way streets one-way
               Each network keeps only its biggest connected piece, so every
               route the app finds can really be travelled end to end.
               NMSU publishes no path or road data, so OpenStreetMap (ODbL
               licence, credited on the map) is the source.
DEPENDS ON   : Python 3 and internet (Overpass API).
WRITES       : data/routes/walk.geojson, data/routes/bike.geojson, data/routes/drive.geojson
RUN          : python tools/build_routes.py
"""

import json
import urllib.parse
import urllib.request
from pathlib import Path

PROJECT = Path(__file__).resolve().parent.parent
OUTPUT_FOLDER = PROJECT / 'data' / 'routes'
OVERPASS = 'https://overpass-api.de/api/interpreter'

# south, west, north, east: NMSU Las Cruces and the streets around it
AREA = (32.255, -106.772, 32.295, -106.72)

STREETS = {'primary', 'primary_link', 'secondary', 'secondary_link', 'tertiary', 'tertiary_link',
           'unclassified', 'residential', 'living_street', 'service'}
NO = {'no', 'private'}
YES = {'yes', 'designated', 'permissive'}


def can_walk(tags):
    """OpenStreetMap rules for walking."""
    kind = tags.get('highway')
    if tags.get('foot') in YES:
        return True
    if tags.get('foot') in NO or tags.get('access') in NO:
        return False
    return kind in STREETS | {'footway', 'path', 'pedestrian', 'steps', 'corridor', 'cycleway', 'track'}


def can_bike(tags):
    """OpenStreetMap rules for bicycles."""
    kind = tags.get('highway')
    if kind == 'steps':
        return False
    if tags.get('bicycle') in YES:
        return True
    if tags.get('bicycle') in NO or tags.get('access') in NO:
        return False
    return kind in STREETS | {'cycleway', 'path', 'track'}


def can_drive(tags):
    """OpenStreetMap rules for cars."""
    if tags.get('access') in NO or tags.get('motor_vehicle') in NO or tags.get('motorcar') in NO:
        return False
    return tags.get('highway') in STREETS | {'motorway', 'motorway_link', 'trunk', 'trunk_link'}


def one_way(tags):
    """'yes' (only along the drawn direction), '-1' (only against it) or 'no'."""
    value = tags.get('oneway')
    if value in ('yes', 'true', '1') or (tags.get('junction') == 'roundabout' and value != 'no'):
        return 'yes'
    if value == '-1':
        return '-1'
    return 'no'


def download_ways():
    """Every road and path in AREA with its tags and points."""
    query = ('[out:json][timeout:120];way["highway"](' + ','.join(str(n) for n in AREA) + ');out geom tags;')
    body = urllib.parse.urlencode({'data': query}).encode()
    request = urllib.request.Request(OVERPASS, data=body, headers={'User-Agent': 'BetterNMSUMaps-build/1.0'})
    with urllib.request.urlopen(request, timeout=180) as response:
        elements = json.load(response)['elements']
    return [(way.get('tags', {}), [(round(p['lon'], 7), round(p['lat'], 7)) for p in way['geometry']])
            for way in elements]


def biggest_connected_piece(ways):
    """Keep only the ways in the largest group of connected ways (they share points where they meet)."""
    group_of = {}  # point -> a representative point of its group ("union-find")

    def find(point):
        group_of.setdefault(point, point)
        while group_of[point] != point:
            group_of[point] = group_of[group_of[point]]
            point = group_of[point]
        return point

    for _, points in ways:
        for a, b in zip(points, points[1:]):
            group_of[find(a)] = find(b)

    sizes = {}
    for point in group_of:
        root = find(point)
        sizes[root] = sizes.get(root, 0) + 1
    biggest = max(sizes, key=sizes.get)
    return [way for way in ways if find(way[1][0]) == biggest]


def write_network(name, ways, with_one_way):
    """Save one network. name/highway are used for turn-by-turn wording; oneway only matters for driving."""
    kept = biggest_connected_piece(ways)
    features = []
    for tags, points in kept:
        properties = {'highway': tags.get('highway'), 'name': tags.get('name', '')}
        if with_one_way:
            properties['oneway'] = one_way(tags)
        features.append({'type': 'Feature', 'properties': properties,
                         'geometry': {'type': 'LineString', 'coordinates': points}})
    path = OUTPUT_FOLDER / (name + '.geojson')
    path.write_text(json.dumps({'type': 'FeatureCollection', 'features': features}, separators=(',', ':')),
                    encoding='utf-8')
    print(name + ':', len(kept), 'of', len(ways), 'ways kept (biggest connected piece) ->', path)


def main():
    OUTPUT_FOLDER.mkdir(parents=True, exist_ok=True)
    ways = [way for way in download_ways() if len(way[1]) > 1]
    write_network('walk', [w for w in ways if can_walk(w[0])], with_one_way=False)
    write_network('bike', [w for w in ways if can_bike(w[0])], with_one_way=True)
    write_network('drive', [w for w in ways if can_drive(w[0])], with_one_way=True)


if __name__ == '__main__':
    main()
