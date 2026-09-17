"""
tools/build_routes.py - makes the networks directions travel along: walking, biking and driving.

WHAT IT DOES : Downloads every road and path around NMSU Las Cruces from OpenStreetMap,
               then sorts them into three networks using OpenStreetMap's own access tags
               (nothing is guessed or drawn by hand):
                 walk  : footpaths, steps, campus malls, and streets (sidewalks)
                 bike  : cycleways, paths and streets; footpaths only where bicycles
                         are marked allowed; never steps
                 drive : roads a car may use, keeping one-way streets one-way
               Each network keeps only its biggest connected piece, so every route the
               app finds can really be travelled from end to end.
               NMSU publishes no path or road data, so OpenStreetMap (ODbL licence,
               credited on the map) is the source.
DEPENDS ON   : Python 3 and internet (the Overpass API). tools/json_files.py
WRITES       : data/routes/walk.geojson, data/routes/bike.geojson, data/routes/drive.geojson
RUN          : python tools/build_routes.py
"""

import json
import urllib.parse
import urllib.request
from pathlib import Path

from json_files import write_json

PROJECT = Path(__file__).resolve().parent.parent
OUTPUT_FOLDER = PROJECT / 'data' / 'routes'
OVERPASS = 'https://overpass-api.de/api/interpreter'

# south, west, north, east: NMSU Las Cruces and the streets around it
AREA = (32.255, -106.772, 32.295, -106.72)

STREETS = {'primary', 'primary_link', 'secondary', 'secondary_link', 'tertiary', 'tertiary_link',
           'unclassified', 'residential', 'living_street', 'service'}
NO = {'no', 'private'}
YES = {'yes', 'designated', 'permissive'}


def network_note(name):
    """The "how to format" note at the top of one network file."""
    properties = 'Properties: highway (the OpenStreetMap kind, e.g. "footway") and name (the street name, or "").'
    if name != 'walk':
        properties = ('Properties: highway (the OpenStreetMap kind, e.g. "footway"), name (the street name, or ""),'
                      ' oneway ("yes", "-1" = only against the drawn direction, or "no").')
    return [
        'Made by tools/build_routes.py from OpenStreetMap. Do not edit by hand: run python tools/build_routes.py',
        'Format: GeoJSON. One LineString Feature per road or path you can ' + name + ' on.',
        properties,
    ]


def can_walk(tags):
    """OpenStreetMap's rules for walking."""
    kind = tags.get('highway')
    if tags.get('foot') in YES:
        return True
    if tags.get('foot') in NO or tags.get('access') in NO:
        return False
    return kind in STREETS or kind in {'footway', 'path', 'pedestrian', 'steps', 'corridor', 'cycleway', 'track'}


def can_bike(tags):
    """OpenStreetMap's rules for bicycles."""
    kind = tags.get('highway')
    if kind == 'steps':
        return False
    if tags.get('bicycle') in YES:
        return True
    if tags.get('bicycle') in NO or tags.get('access') in NO:
        return False
    return kind in STREETS or kind in {'cycleway', 'path', 'track'}


def can_drive(tags):
    """OpenStreetMap's rules for cars."""
    if tags.get('access') in NO or tags.get('motor_vehicle') in NO or tags.get('motorcar') in NO:
        return False
    kind = tags.get('highway')
    return kind in STREETS or kind in {'motorway', 'motorway_link', 'trunk', 'trunk_link'}


def one_way(tags):
    """'yes' (only along the drawn direction), '-1' (only against it) or 'no'."""
    value = tags.get('oneway')
    if value in ('yes', 'true', '1'):
        return 'yes'
    if tags.get('junction') == 'roundabout' and value != 'no':
        return 'yes'  # roundabouts are one-way unless tagged otherwise
    if value == '-1':
        return '-1'
    return 'no'


def download_ways():
    """Every road and path in AREA: a list of (tags, points)."""
    area = ','.join(str(number) for number in AREA)
    query = '[out:json][timeout:120];way["highway"](' + area + ');out geom tags;'
    body = urllib.parse.urlencode({'data': query}).encode()
    request = urllib.request.Request(OVERPASS, data=body, headers={'User-Agent': 'BetterNMSUMaps-build/1.0'})
    with urllib.request.urlopen(request, timeout=180) as response:
        elements = json.load(response)['elements']

    ways = []
    for way in elements:
        points = []
        for point in way['geometry']:
            points.append((round(point['lon'], 7), round(point['lat'], 7)))
        ways.append((way.get('tags', {}), points))
    return ways


def find_group(group_of, point):
    """
    Which group a point belongs to ("union-find"). Each point points at another
    point of its group; follow the pointers until a point points at itself.
    Along the way, pointers are shortened so the next search is faster.
    """
    group_of.setdefault(point, point)
    while group_of[point] != point:
        group_of[point] = group_of[group_of[point]]
        point = group_of[point]
    return point


def biggest_connected_piece(ways):
    """Keep only the ways in the largest group of connected ways (ways that meet share a point)."""
    group_of = {}  # point -> another point in its group
    for tags, points in ways:
        for i in range(len(points) - 1):
            # These two points are joined, so their groups become one.
            group_of[find_group(group_of, points[i])] = find_group(group_of, points[i + 1])

    sizes = {}  # group -> how many points it has
    for point in group_of:
        group = find_group(group_of, point)
        sizes[group] = sizes.get(group, 0) + 1
    biggest = max(sizes, key=sizes.get)

    kept = []
    for way in ways:
        if find_group(group_of, way[1][0]) == biggest:
            kept.append(way)
    return kept


def write_network(name, ways, with_one_way):
    """Save one network. name and highway are used for the turn-by-turn words; oneway matters for bikes and cars."""
    kept = biggest_connected_piece(ways)
    features = []
    for tags, points in kept:
        properties = {'highway': tags.get('highway'), 'name': tags.get('name', '')}
        if with_one_way:
            properties['oneway'] = one_way(tags)
        features.append({'type': 'Feature', 'properties': properties, 'geometry': {'type': 'LineString', 'coordinates': points}})
    path = OUTPUT_FOLDER / (name + '.geojson')
    write_json(path, network_note(name), {'type': 'FeatureCollection', 'features': features}, 'compact')
    print(name + ':', len(kept), 'of', len(ways), 'ways kept (biggest connected piece) ->', path)


def main():
    """Download the roads and paths, and write the walk, bike and drive networks."""
    OUTPUT_FOLDER.mkdir(parents=True, exist_ok=True)
    ways = []
    for way in download_ways():
        if len(way[1]) > 1:  # a way needs at least two points
            ways.append(way)

    walk_ways = []
    bike_ways = []
    drive_ways = []
    for way in ways:
        tags = way[0]
        if can_walk(tags):
            walk_ways.append(way)
        if can_bike(tags):
            bike_ways.append(way)
        if can_drive(tags):
            drive_ways.append(way)
    write_network('walk', walk_ways, with_one_way=False)
    write_network('bike', bike_ways, with_one_way=True)
    write_network('drive', drive_ways, with_one_way=True)


if __name__ == '__main__':
    main()
