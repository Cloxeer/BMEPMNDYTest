"""
tools/build_buildings.py - makes data/buildings.geojson (the buildings on the map).

WHAT IT DOES : Runs on a developer's computer (not in the app). For each building in
               BUILDINGS below it downloads NMSU's official record, adds photos and
               any hand-written extras, and writes the file the app reads.
               It also adds every other occupied main-campus building NMSU's records list
               as academic, office, lab, library, observatory or museum space: the
               "Staff Academic" category (see STAFF_ACADEMIC_USES), and every Las Cruces
               building of the uses in USE_CATEGORIES (athletics, student services, shops,
               greenhouses, barns, warehouses).
DEPENDS ON   : Python 3 and an internet connection. No extra packages. tools/json_files.py
SOURCES      : NMSU campus map (map.nmsu.edu, Concept3D): the description on each building's page
               NMSU Office of Space Planning "Buildings" layer: name, code, address,
                 year built, number of stories, map position, outline
               NMSU Registrar building abbreviations (records.nmsu.edu): the code
                 students see on schedules, when it differs (see building-extras.json)
               data/source/buildings-osm.geojson: floor count when NMSU lists none
               data/source/photos.json: freely licensed photos
               data/source/building-extras.json: floor plans, descriptions, checked extras
               data/source/entrances.geojson: doors mapped in OpenStreetMap
WRITES       : data/buildings.geojson (one point per building, with its facts)
               data/descriptions.json (each building's description; kept apart so the map
                 can open before the longer text has loaded)
               data/building-shapes.geojson (NMSU's official outline of each building:
                 used to tell when you've walked inside)
RUN          : python tools/build_buildings.py
"""

import html
import json
import math
import re
import urllib.request
from pathlib import Path

from json_files import read_json, write_json

# Paths start from the project folder, so the script works from any folder.
PROJECT = Path(__file__).resolve().parent.parent
SOURCE = PROJECT / 'data' / 'source'
OUTPUT = PROJECT / 'data' / 'buildings.geojson'
DESCRIPTIONS_OUTPUT = PROJECT / 'data' / 'descriptions.json'
SHAPES_OUTPUT = PROJECT / 'data' / 'building-shapes.geojson'
DOOR_DISTANCE_M = 4  # an OpenStreetMap door this close (metres) to NMSU's outline belongs to the building
METRES_PER_DEGREE = 111320
NMSU_BUILDINGS = ('https://services6.arcgis.com/r7ZUBDL24w5VsBnN/arcgis/rest/services/'
                  'buildings_642026_WFL1/FeatureServer/9/query')
NMSU_MAP = 'https://api.concept3d.com/locations/{id}?map=1888&key=0001085cc708b9cef47080f064612ca5'
NMSU_MAP_LIST = 'https://api.concept3d.com/locations?map=1888&key=0001085cc708b9cef47080f064612ca5'
SAME_PLACE_METRES = 120  # a campus map point this close to a building, with the same name, is that building
MAP_DESCRIPTION_SOURCE = "NMSU's official campus map (map.nmsu.edu)"
REGISTRAR = 'NMSU Registrar building abbreviations (records.nmsu.edu)'

# Each building: (property number, name shown in the app, name in OpenStreetMap,
#                 NMSU campus map (Concept3D) id, key in photos.json)
# None means "doesn't have one".
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
    # The next 15 by class sections (academic first; Rentfrow Gym replaces "Lucy Bell Ma Hall",
    # which is at NMSU's Gallup campus), then 5 residence halls (Living), checked the same way:
    ('368', 'Knox Hall', None, 525531, None),
    ('33', 'Kent Hall', None, 525529, 'Kent Hall'),
    ('619', 'Health & Social Services Annex', None, 525398, None),
    ('363', 'Engineering Complex I', None, 525507, None),
    ('82', 'Biology Annex', None, 525487, None),
    ('35', 'William B. Conroy Honors Center', None, 525485, 'William B. Conroy Honors Center'),
    ('385', 'Theatre Scene Shop', None, 525468, None),
    ('225', 'Astronomy Building', None, 525366, None),
    ('190', 'Jett Annex', None, 525426, None),
    ('10', 'Goddard Hall', None, 525515, 'Goddard Hall'),
    ('245', 'Tejada Building, Extension Annex', None, 525467, None),
    ('662', 'Food Science, Learning, and Safety Center', None, 895207, None),
    ('683', 'Ag Student Learning Center', None, None, None),
    ('321', 'James B. Delamater Activity Center', None, 525956, None),
    ('211', 'Rentfrow Hall', None, 525543, None),
    ('275', 'Garcia Hall', None, 536447, None),
    ('604', 'Piñon Hall', None, 527939, None),
    ('658', 'Juniper Hall', None, 529217, None),
    ('185', 'Rhodes-Garrett-Hamiel Residence Hall', None, 529216, None),
    ('605', 'Chamisa Village', None, 527969, None),
    # The rest of NMSU Housing's communities (housing.nmsu.edu). Apartment villages made of
    # several buildings are one place on the map: their buildings are listed in COMPLEX_PARTS.
    ('645', 'Chamisa Village II', None, 529224, None),
    ('413F', 'Cervantes Village', None, 529189, None),
    ('462K', 'Vista Del Monte', None, 529228, None),
    ('206', 'Sutherland Village', None, 535321, None),
    ('214', 'Tom Fort Village', None, 536066, None),
    # Every other Las Cruces building with classes in the Fall 2026 + Spring 2027 schedule,
    # where the schedule's name clearly matches NMSU's records:
    ('596', 'Fulton Athletic Center', None, 660843, None),
    ('251', 'Aquatics Center', None, 660950, None),
    ('597', 'Golf Course Clubhouse', None, 660865, None),
    ('369', 'Photovoltaic Center', None, 660870, None),
    ('30', 'Campus Police / Ag Institute', None, 660999, None),
    ('465', 'Equestrian Tack Room', None, 661017, None),  # the schedule's "Equestrian Building" (Registrar code EA, Equitation Building)
    ('158', 'Hort Farm Office & Labs', None, 660981, None),  # the schedule's "Fabian Garcia Science Center" (Registrar code HF)
    # Historic buildings not listed above: on the National Register of Historic Places, or named
    # historic in NMSU's Heritage Preservation Plan (the designations are in building-extras.json).
    ('36', 'Nason House', None, 525431, None),
    ('32', 'Young Hall', None, 526017, None),
    ('56', 'Dove Hall', None, 525503, None),
    ('154', 'Garcia Center', None, 527925, None),
    ('172', 'Hadley Hall', None, 525519, None),
    ('179', "O'Loughlin House", None, 525434, None),
]

# Apartment villages: the first property number (used in BUILDINGS) -> every building in the village.
# Their outline on the map is all their buildings together.
COMPLEX_PARTS = {
    '413F': ['413F', '413G', '415H', '415J', '387B', '387D', '387E'],
    '462K': ['462K', '462M', '462N', '462P', '526Q', '526R', '526S', '526T', '526U', '526V', '526W', '526X'],
}

# Residence halls: shown in the "Living" category (orange). Historic-only buildings: "Historic" (brown).
# Everything else is "Study" (crimson). A study or living building can also be historic: see "historic" in building-extras.json.
LIVING = {'275', '604', '658', '185', '605', '645', '413F', '462K', '206', '214'}
HISTORIC = {'36', '32', '56', '154', '172', '179'}

# Buildings with no classes aren't on the Registrar's list, so their code comes from Space Planning.
# Staff Academic: every other occupied Las Cruces main-campus building whose use in NMSU Space Planning's
# records (Property_C, e.g. "OFFICE-2 STORY") starts with one of these. Picked by the script, not by hand.
STAFF_ACADEMIC_USES = ('ACAD', 'OFFICE', 'LAB', 'LIBRARY', 'OBSERVATORY', 'MUSEUM')
# More categories picked by use: every Las Cruces building (any status) whose Property_C starts with one of these.
USE_CATEGORIES = [
    ('athletics', ('ATHLETIC', 'GYM')),
    ('services', ('RETAIL', 'STUDENT UNION', 'HEALTH CENTER')),
    ('shop', ('SHOP',)),
    ('greenhouse', ('GREEN HOUSE',)),
    ('barn', ('BARN',)),
    ('warehouse', ('WAREHOUSE',)),
]
# Short words in NMSU's building names that are abbreviations, so they stay in capitals ("PSL", not "Psl").
ABBREVIATIONS = {'PSL', 'USDA', 'NMDA', 'VERL', 'HQ', 'FS', 'MTN', 'NMSU', 'SWTDI', 'PGEL'}
SMALL_WORDS = {'AND', 'OF', 'THE', 'FOR'}  # stay lowercase inside a name

# Buildings full of offices students go to (Financial Aid, the Registrar, Admissions): "Student Services", not "Staff Academic".
SERVICES_BUILDINGS = {'338'}

NOT_ON_REGISTRAR_LIST = {'36', '56', '154', '172', '179', '285', '657', '365', '619', '190', '662', '604', '658', '605', '645', '413F', '462K', '206', '214', '369'}

BUILDINGS_NOTE = [
    'Made by tools/build_buildings.py. Do not edit by hand: add a building to BUILDINGS in the script,',
    'or change data/source/building-extras.json or data/source/photos.json, then run python tools/build_buildings.py',
    'Format: GeoJSON. One Feature per building: a Point where NMSU places it, and properties:',
    'id and propertyNumber (NMSU property number), code, name, aka (other names search finds), address, built (year),',
    'floors ([1, 2, ...], empty when unknown), floorsSource, nmsuUrl, photos, source, category ("study" or "living"),',
    'and descriptionSource. The descriptions themselves are in data/descriptions.json.',
    'floorImages and postedImages (floor -> picture file), doors ([lng, lat] points), codeSource,',
    'historic (an official historic designation, or null), descriptionSource (where the description came from).',
    'category can also be "historic", "staff" (Staff Academic), "services" (Student Services),',
    '"athletics", "services" (Student Services), "shop", "greenhouse", "barn" or "warehouse".',
    'A missing fact is null or empty, and the app shows "Unknown" for it: nothing is guessed.',
]
DESCRIPTIONS_NOTE = [
    'Made by tools/build_buildings.py. Do not edit by hand: edit "description" in data/source/building-extras.json,',
    "or the building's page on NMSU's campus map, then run python tools/build_buildings.py",
    'Format: "descriptions" is {property number: [paragraph, paragraph, ...]}. The app loads it just after the map,',
    'because the map does not need it and it is the longest text in the project.',
]
SHAPES_NOTE = [
    'Made by tools/build_buildings.py. Do not edit by hand.',
    "Format: GeoJSON. One Feature per building: properties {\"id\": property number} and NMSU Space Planning's outline.",
    'Directions use it to tell when you have walked inside.',
]


def download_json(url):
    """Download a JSON answer from a web address."""
    with urllib.request.urlopen(url, timeout=90) as response:
        return json.load(response)


def parts_of(number):
    """Every property number that makes up a building: just itself, or all of an apartment village's buildings."""
    return COMPLEX_PARTS.get(number, [number])


def property_numbers_query(buildings):
    """The ArcGIS search text for every building in a list like BUILDINGS: Property IN ('323','461',...)."""
    quoted = []
    for building in buildings:
        for part in parts_of(building[0]):
            quoted.append("'" + part + "'")
    return 'Property+IN+(' + ','.join(quoted) + ')'


def download_official_records(buildings):
    """NMSU's official record of every building in the list, by property number."""
    url = NMSU_BUILDINGS + '?where=' + property_numbers_query(buildings) + '&outFields=*&returnGeometry=false&f=json'
    records = {}
    for row in download_json(url)['features']:
        # A few properties (e.g. Sutherland Village) have one row per house: keep the first.
        records.setdefault(row['attributes']['Property'], row['attributes'])
    return records


def download_outlines(buildings):
    """NMSU's official outline (polygon) of every building in the list, by property number."""
    url = (NMSU_BUILDINGS + '?where=' + property_numbers_query(buildings) + '&outFields=Property'
           '&returnGeometry=true&outSR=4326&f=geojson')
    shapes_by_property = {}  # property number -> every outline it has
    for feature in download_json(url)['features']:
        shapes_by_property.setdefault(feature['properties']['Property'], []).append(feature['geometry'])

    outlines = {}
    for building in buildings:
        geometries = []
        for part in parts_of(building[0]):
            geometries.extend(shapes_by_property[part])
        outlines[building[0]] = combine_outlines(geometries)
    return outlines


def combine_outlines(geometries):
    """One outline from several: the same geometry when there's one, otherwise a MultiPolygon of them all."""
    if len(geometries) == 1:
        return geometries[0]
    polygons = []
    for geometry in geometries:
        if geometry['type'] == 'Polygon':
            polygons.append(geometry['coordinates'])
        else:
            polygons.extend(geometry['coordinates'])
    return {'type': 'MultiPolygon', 'coordinates': polygons}


def built_years(official, number):
    """The year built, or "1983-1991" for an apartment village whose buildings were built in different years."""
    years = []
    for part in parts_of(number):
        year = official[part]['DateBuilt']
        if year and year not in years:
            years.append(year)
    years.sort()
    if len(years) == 0:
        return None
    if len(years) == 1:
        return years[0]
    return years[0] + '–' + years[-1]


def metres_to_outline(point, geometry):
    """The shortest distance in metres from a [lng, lat] point to the edges of a building outline."""
    if geometry['type'] == 'Polygon':
        rings = geometry['coordinates']
    else:
        rings = []
        for polygon in geometry['coordinates']:
            for ring in polygon:
                rings.append(ring)

    shrink = math.cos(math.radians(point[1]))  # a degree of longitude is shorter away from the equator
    px = point[0] * shrink
    py = point[1]
    best = float('inf')
    for ring in rings:
        for i in range(len(ring) - 1):
            ax = ring[i][0] * shrink
            ay = ring[i][1]
            bx = ring[i + 1][0] * shrink
            by = ring[i + 1][1]
            dx = bx - ax
            dy = by - ay
            along = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / ((dx * dx + dy * dy) or 1)))
            best = min(best, math.hypot(px - (ax + along * dx), py - (ay + along * dy)))
    return best * METRES_PER_DEGREE


def existing_pictures(pictures, number):
    """Keep only the floor pictures whose file is really in the project (a missing one is reported, not listed)."""
    kept = {}
    for floor in pictures:
        file = pictures[floor]
        if (PROJECT / file).exists():
            kept[floor] = file
        else:
            print('  not listed (file not added yet):', file, 'for building', number)
    return kept


def floor_count(record, osm_building):
    """The number of stories from NMSU (e.g. 'ACAD-3 STORY'). If NMSU has none, OpenStreetMap's."""
    match = re.search(r'(\d+)\s*STORY', record['Property_C'] or '')
    if match:
        return int(match.group(1)), 'NMSU Space Planning'
    return int(osm_building.get('levels') or 0), 'OpenStreetMap building:levels'


def other_names(record, number, extra):
    """Every other name search should find: the code, the number, NMSU's description, and extras."""
    names = []
    for name in [record['Address_2'], number, record['Descriptio'].title()] + extra.get('aka', []):
        if name:
            names.append(name)
    return names


def photos_for(photos, photo_key):
    """The building's photos that have a file (photos.json also lists some we couldn't use)."""
    kept = []
    if not photo_key:
        return kept
    for photo in photos.get(photo_key, []):
        if photo.get('file'):
            kept.append(photo)
    return kept


def doors_of(doors, outline):
    """The OpenStreetMap doors that are on this building's outline."""
    kept = []
    for door in doors:
        if metres_to_outline(door, outline) <= DOOR_DISTANCE_M:
            kept.append(door)
    return kept


def simple_name(name):
    """A name with only its letters and numbers, for comparing: "Hort Farm Office & Labs" -> "hortfarmofficelabs"."""
    return re.sub(r'[^a-z0-9]', '', (name or '').lower())


def metres_apart(a, b):
    """Straight-line distance in metres between two [lng, lat] points."""
    shrink = math.cos(math.radians(a[1]))
    return math.hypot((a[0] - b[0]) * shrink, a[1] - b[1]) * METRES_PER_DEGREE


def download_map_places():
    """Every place on NMSU's campus map: [(id, name, [lng, lat]), ...]."""
    places = []
    for place in download_json(NMSU_MAP_LIST):
        if place.get('lat') and place.get('lng'):
            places.append((place['id'], place.get('name') or '', [place['lng'], place['lat']]))
    return places


def find_map_ids(map_places, record, names):
    """
    Every id on NMSU's campus map that is this building: same name, and close enough to be the same place.
    Nothing is guessed: a point with a different name is not used.
    """
    wanted = set()
    for name in names:
        wanted.add(simple_name(name))
    position = [record['Longitude'], record['Latitude']]
    found = []
    for map_id, map_name, map_position in map_places:
        if simple_name(map_name) in wanted and metres_apart(position, map_position) <= SAME_PLACE_METRES:
            found.append(map_id)
    return found


def map_description(map_id):
    """The description NMSU's campus map shows for a building, as paragraphs. Empty when it has none."""
    if not map_id:
        return []
    page = download_json(NMSU_MAP.format(id=map_id))
    text = page.get('description') or ''
    text = re.sub(r'<br\s*/?>|</p>', '\n', text)  # line breaks become new paragraphs
    text = re.sub(r'<[^>]+>', '', text)  # drop the rest of the HTML
    text = html.unescape(text).replace('\r', '')
    paragraphs = []
    for line in text.split('\n'):
        line = line.strip()
        if line:
            paragraphs.append(line)
    return paragraphs


def display_name(description):
    """NMSU's building name in capitals -> how we show it: "PSL, CLINTON P. ANDERSON HALL" -> "PSL, Clinton P. Anderson Hall"."""
    words = []
    for word in description.split(' '):
        letters = word.strip('(),"&.').upper()
        if letters in ABBREVIATIONS:
            words.append(word.upper())
        elif letters in SMALL_WORDS and len(words) > 0:
            words.append(word.lower())
        else:
            parts = []
            for part in word.replace('-', '/-/').split('/'):  # "HOUSE/MAIN" -> "House/Main", "FARM-HORSE" -> "Farm-Horse"
                parts.append(capitalize_first_letter(part))
            words.append('/'.join(parts).replace('/-/', '-'))
    return ' '.join(words)


def capitalize_first_letter(word):
    """ "(CHILDREN'S" -> "(Children's": only the first letter is a capital, even after a bracket or quote."""
    lower = word.lower()
    for i in range(len(lower)):
        if lower[i].isalpha():
            return lower[:i] + lower[i].upper() + lower[i + 1:]
    return lower


def find_staff_academic():
    """Every occupied Las Cruces main-campus building used for academics, offices, labs, libraries,
    observatories or museums that isn't already in BUILDINGS: [(property number, name, None, None, None), ...]."""
    listed = set()
    for building in BUILDINGS:
        for part in parts_of(building[0]):
            listed.add(part)
    where = "Campus%3D'LAS+CRUCES'+AND+Type%3D'Main'+AND+Status%3D'OCCUPIED'"
    url = NMSU_BUILDINGS + '?where=' + where + '&outFields=Property,Descriptio,Property_C&returnGeometry=false&f=json'
    found = []
    seen = set()
    for row in download_json(url)['features']:
        record = row['attributes']
        number = record['Property']
        use = (record['Property_C'] or '').split('-')[0].strip()
        if number in listed or number in seen or use not in STAFF_ACADEMIC_USES:
            continue
        seen.add(number)
        found.append((number, display_name(record['Descriptio']), None, None, None))
    return found


def use_of(record):
    """A building's use, from NMSU's records: "OFFICE-2 STORY" -> "OFFICE"."""
    return (record['Property_C'] or '').split('-')[0].strip()


def find_by_use(already_listed):
    """Every Las Cruces building whose use is in USE_CATEGORIES and isn't listed yet.
    Returns ([(property number, name, None, None, None), ...], {property number: category})."""
    url = NMSU_BUILDINGS + "?where=Campus%3D'LAS+CRUCES'&outFields=Property,Descriptio,Property_C&returnGeometry=false&f=json"
    found = []
    categories = {}
    for row in download_json(url)['features']:
        record = row['attributes']
        number = record['Property']
        if not number or number in already_listed or number in categories:
            continue
        for category, uses in USE_CATEGORIES:
            if use_of(record) in uses:
                categories[number] = category
                found.append((number, display_name(record['Descriptio']), None, None, None))
    return found, categories


def main():
    """Download, combine and write every building."""
    staff_academic = find_staff_academic()
    staff_numbers = set()
    listed = set()
    for building in BUILDINGS + staff_academic:
        for part in parts_of(building[0]):
            listed.add(part)
    for building in staff_academic:
        staff_numbers.add(building[0])
    by_use, use_categories = find_by_use(listed)
    buildings = BUILDINGS + staff_academic + by_use
    official = download_official_records(buildings)
    map_places = download_map_places()
    osm = {}
    for feature in read_json(SOURCE / 'buildings-osm.geojson')['features']:
        osm[feature['properties'].get('name')] = feature['properties']
    photos = read_json(SOURCE / 'photos.json')
    extras = read_json(SOURCE / 'building-extras.json')
    outlines = download_outlines(buildings)
    doors = []
    for feature in read_json(SOURCE / 'entrances.geojson')['features']:
        doors.append(feature['geometry']['coordinates'])

    features = []
    shapes = []
    descriptions = {}
    for number, name, osm_name, map_id, photo_key in buildings:
        record = official[number]
        extra = extras.get(number, {})
        floors, floors_source = floor_count(record, osm.get(osm_name, {}))
        if 'floors' in extra:  # checked by hand when NMSU lists no story count (see building-extras.json)
            floors = extra['floors'] or 0
            floors_source = extra['floorsSource']
        if floors == 0:
            print('WARNING: no floor count for', number, name)

        # NMSU's campus map: the id listed above, plus any point with this building's name at this spot.
        # The description comes from the first one that has one.
        map_ids = []
        if map_id:
            map_ids.append(map_id)
        for other_id in find_map_ids(map_places, record, [name, record['Descriptio']]):
            if other_id not in map_ids:
                map_ids.append(other_id)

        description = extra.get('description', [])
        description_source = None
        for candidate in map_ids:
            if description:
                break
            description = map_description(candidate)
            if description:
                description_source = MAP_DESCRIPTION_SOURCE
                map_ids = [candidate] + map_ids  # link to the page the description came from

        nmsu_url = None  # None: not on NMSU's campus map yet
        if map_ids:
            nmsu_url = 'https://map.nmsu.edu/?id=1888#!m/' + str(map_ids[0])
        category = 'study'  # colour and Map filters group
        if number in LIVING:
            category = 'living'
        elif number in HISTORIC:
            category = 'historic'
        elif number in SERVICES_BUILDINGS:
            category = 'services'
        elif number in staff_numbers:
            category = 'staff'
        elif number in use_categories:
            category = use_categories[number]

        # Every building has the same fields, so every sheet looks the same.
        # Empty means "not added yet"; the app shows a message instead.
        building = {
            'id': number,
            'code': extra.get('code', record['Address_2']),
            'name': name,
            'aka': other_names(record, number, extra),
            'address': record['Address_1'].title() + ', Las Cruces, NM ' + record['Zip_Code'],
            'propertyNumber': number,
            'built': built_years(official, number),
            'floors': list(range(1, floors + 1)),
            'floorsSource': floors_source,
            'nmsuUrl': nmsu_url,
            'photos': photos_for(photos, photo_key),
            'source': 'NMSU Office of Space Planning, Buildings layer (property ' + number + ')',
            'category': category,
            'floorImages': existing_pictures(extra.get('floorImages', {}), number),  # floor -> our redrawn plan
            'postedImages': existing_pictures(extra.get('postedImages', {}), number),  # floor -> photo of the posted map
            'descriptionSource': description_source,
            'doors': doors_of(doors, outlines[number]),  # where directions lead (empty = the nearest path)
            'historic': extra.get('historic'),  # an official historic designation, or None
        }
        if not building['code'] or building['code'] == 'N/A':
            building['code'] = None
            building['codeSource'] = 'Not published by NMSU yet'
        elif number in staff_numbers or number in use_categories:
            building['codeSource'] = 'NMSU Space Planning'
        elif number in NOT_ON_REGISTRAR_LIST:
            building['codeSource'] = 'NMSU Space Planning (not on the Registrar list)'
        else:
            building['codeSource'] = REGISTRAR

        descriptions[number] = description  # paragraphs, written to their own file below
        shapes.append({'type': 'Feature', 'properties': {'id': number}, 'geometry': outlines[number]})
        position = [round(record['Longitude'], 7), round(record['Latitude'], 7)]
        features.append({'type': 'Feature', 'properties': building, 'geometry': {'type': 'Point', 'coordinates': position}})
        note = ''
        if not description:
            note = ' (no description on NMSU\'s campus map)'
        print(number, (building['code'] or '-').ljust(5), name, '(' + str(floors) + ' floors, ' + str(len(building['doors'])) + ' doors)' + note)

    write_json(OUTPUT, BUILDINGS_NOTE, {'type': 'FeatureCollection', 'features': features}, 'pretty')
    print(len(features), 'buildings written to', OUTPUT)
    write_json(DESCRIPTIONS_OUTPUT, DESCRIPTIONS_NOTE, {'descriptions': descriptions}, 'pretty')
    print(len(descriptions), 'descriptions written to', DESCRIPTIONS_OUTPUT)
    write_json(SHAPES_OUTPUT, SHAPES_NOTE, {'type': 'FeatureCollection', 'features': shapes}, 'compact')
    print(len(shapes), 'outlines written to', SHAPES_OUTPUT)


if __name__ == '__main__':
    main()
