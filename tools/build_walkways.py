"""
tools/build_walkways.py - make data/walkways.geojson, the network directions walk along.

WHAT IT DOES : Downloads every walkable way around NMSU Las Cruces from
               OpenStreetMap (footpaths, steps, campus malls, and streets,
               which have sidewalks), then keeps only the biggest connected
               piece, so every route the app finds can actually be walked
               end to end. NMSU publishes no walkway data, so OpenStreetMap
               (ODbL licence, credited on the map) is the source.
DEPENDS ON   : Python 3 and internet (Overpass API).
WRITES       : data/walkways.geojson
RUN          : python tools/build_walkways.py
"""

import json
import urllib.parse
import urllib.request
from pathlib import Path

PROJECT = Path(__file__).resolve().parent.parent
OUTPUT = PROJECT / 'data' / 'walkways.geojson'
OVERPASS = 'https://overpass-api.de/api/interpreter'

# south, west, north, east: NMSU Las Cruces and the streets around it
AREA = (32.255, -106.772, 32.295, -106.72)

# Ways a person can walk on. Motorways and anything marked foot=no / private are left out.
WALKABLE = ('footway|path|pedestrian|steps|corridor|cycleway|track|living_street|'
            'service|residential|unclassified|tertiary|secondary|primary')

QUERY = (
    '[out:json][timeout:90];'
    'way["highway"~"^(' + WALKABLE + ')$"]["foot"!~"no"]["access"!~"^(private|no)$"]'
    '(' + ','.join(str(n) for n in AREA) + ');'
    'out geom;'
)


def download_ways():
    """Every walkable way in AREA, each as a list of (lng, lat) points."""
    body = urllib.parse.urlencode({'data': QUERY}).encode()
    request = urllib.request.Request(OVERPASS, data=body, headers={'User-Agent': 'BetterNMSUMaps-build/1.0'})
    with urllib.request.urlopen(request, timeout=150) as response:
        elements = json.load(response)['elements']
    return [(way['tags'].get('highway'), [(round(p['lon'], 7), round(p['lat'], 7)) for p in way['geometry']])
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


def main():
    ways = download_ways()
    kept = biggest_connected_piece(ways)
    features = [{'type': 'Feature', 'properties': {'highway': kind},
                 'geometry': {'type': 'LineString', 'coordinates': points}}
                for kind, points in kept]
    OUTPUT.write_text(json.dumps({'type': 'FeatureCollection', 'features': features}, separators=(',', ':')),
                      encoding='utf-8')
    print(len(kept), 'of', len(ways), 'ways kept (biggest connected piece) ->', OUTPUT)


if __name__ == '__main__':
    main()
