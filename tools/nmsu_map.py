"""
tools/nmsu_map.py - one place's record on NMSU's official campus map (map.nmsu.edu), kept on disk.

WHAT IT DOES : The "Open on NMSU's official map" page is filled from NMSU's campus map service
               (Concept3D): api.concept3d.com/locations/<id>. That record holds the exact
               description and photos the page shows. This file downloads each record once,
               slowly and politely, and keeps it in data/source/nmsu-map-locations.json, so the
               build tools copy the description and photo links word for word without asking
               NMSU's server again.
               Politeness: one request at a time, a random 4-9 second pause between requests
               (about the pace of a person clicking through the map), an honest User-Agent, and
               a longer wait whenever the server says it is busy. The file is saved after every
               record, so a stopped run carries on where it left off.
DEPENDS ON   : ./json_files.py (read_json / write_json)
CONTROLS     : data/source/nmsu-map-locations.json
USED BY      : tools/build_buildings.py, tools/build_places.py
"""
import datetime
import html
import json
import random
import re
import time
import urllib.error
import urllib.request
from pathlib import Path

from json_files import read_json, write_json

PROJECT = Path(__file__).resolve().parent.parent
CACHE = PROJECT / 'data' / 'source' / 'nmsu-map-locations.json'
CACHE_NOTE = [
    "Records copied from NMSU's official campus map (map.nmsu.edu, run by Concept3D) by tools/nmsu_map.py.",
    'Each key is a campus map id (the number after #!m/ in a map.nmsu.edu link). Each value:',
    '  "name"          the name on NMSU\'s map',
    '  "description"   the description exactly as NMSU\'s map has it (HTML)',
    '  "mediaUrls"     the photos on that page, as NMSU\'s map lists them ("1888/....jpg")',
    '  "mediaTitles"   each photo\'s title; "mediaTypes" each one\'s kind ("image", ...)',
    '  "category"      NMSU\'s map category',
    '  "fetchedOn"     the day it was copied',
    'Delete a record to copy it again; tools/nmsu_map.py only asks NMSU for records missing here.',
]
RECORD_URL = 'https://api.concept3d.com/locations/{id}?map=1888&key=0001085cc708b9cef47080f064612ca5'
PHOTO_URL = 'https://cms.concept3d.com/map/lib/image-cache/i.php?mapId=1888&image={path}&w={width}&h={height}&r=1'  # NMSU's image server sends about twice the width asked for (for sharp phone screens)
PAGE_URL = 'https://map.nmsu.edu/?id=1888#!m/{id}'
USER_AGENT = 'BetterNMSUMaps/1.0 (NMSU CS 371 student project; one request at a time)'
PAUSE_SECONDS = (4, 9)  # a random pause in this range between requests
BUSY_WAIT_SECONDS = 90  # waited (times the attempt number) when the server says it is busy
MAX_TRIES = 5

_records = None  # the cache, read from disk the first time it's needed
_last_request = 0.0  # when we last asked NMSU's server (time.time())


def _load():
    """Read the saved records once."""
    global _records
    if _records is None:
        _records = {}
        if CACHE.exists():
            _records = read_json(CACHE)['locations']
    return _records


def _save():
    """Write every record back to disk (after each new one, so nothing is lost if the run stops)."""
    write_json(CACHE, CACHE_NOTE, {'locations': _records}, 'pretty')


def _wait_politely():
    """Pause so requests are never closer together than a person clicking through the map."""
    pause = random.uniform(PAUSE_SECONDS[0], PAUSE_SECONDS[1])
    left = _last_request + pause - time.time()
    if left > 0:
        time.sleep(left)


def _download(map_id):
    """Ask NMSU's map for one record, slowing down (never hammering) when the server is busy."""
    global _last_request
    for attempt in range(1, MAX_TRIES + 1):
        _wait_politely()
        _last_request = time.time()
        request = urllib.request.Request(RECORD_URL.format(id=map_id), headers={'User-Agent': USER_AGENT})
        try:
            with urllib.request.urlopen(request, timeout=90) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            if error.code == 404:
                return None  # no such place on the map
            if error.code not in (429, 500, 502, 503, 504):
                raise
            wait = BUSY_WAIT_SECONDS * attempt
            retry_after = error.headers.get('Retry-After')
            if retry_after and retry_after.isdigit():
                wait = max(wait, int(retry_after))
            print('   NMSU map busy (' + str(error.code) + '), waiting', wait, 's')
            time.sleep(wait)
        except (urllib.error.URLError, TimeoutError) as error:
            print('   network problem (' + str(error) + '), waiting', BUSY_WAIT_SECONDS * attempt, 's')
            time.sleep(BUSY_WAIT_SECONDS * attempt)
    raise RuntimeError('NMSU map did not answer for ' + str(map_id) + ' after ' + str(MAX_TRIES) + ' tries')


def location(map_id):
    """
    One place's record on NMSU's campus map: from disk, or downloaded once (politely) and saved.
    @returns dict with name, description, mediaUrls, mediaTitles, category, fetchedOn; or None if NMSU has no such id
    """
    records = _load()
    key = str(map_id)
    if key not in records:
        page = _download(map_id)
        record = None
        if page:
            record = {
                'name': page.get('name') or '',
                'description': page.get('description') or '',
                'mediaUrls': page.get('mediaUrls') or [],
                'mediaTitles': page.get('mediaTitles') or [],
                'mediaTypes': page.get('mediaUrlTypes') or [],
                'category': page.get('categoryName') or '',
                'fetchedOn': datetime.date.today().isoformat(),
            }
        records[key] = record
        _save()
        print('   copied NMSU map', key, '-', (record or {}).get('name', 'not found'), '(' + str(len(records)) + ' saved)')
    return records[key]


def description(map_id):
    """The description NMSU's map shows for a place, as a list of paragraphs (empty when it has none)."""
    record = location(map_id) if map_id else None
    if not record:
        return []
    text = record['description']
    text = re.sub(r'<br\s*/?>|</p>|</li>|</h\d>', '\n', text)  # line breaks become new paragraphs
    text = re.sub(r'<[^>]+>', '', text)  # drop the rest of the HTML
    text = html.unescape(text).replace('\r', '').replace('\xa0', ' ')
    paragraphs = []
    for line in text.split('\n'):
        line = re.sub(r'[ \t]+', ' ', line).strip()
        line = re.sub(r' ([.,;:!?])', r'\1', line)  # "this website ." -> "this website." (a link's words were dropped)
        if not line:
            continue
        # NMSU's text sometimes breaks a sentence over two lines ("...was only two" / "stories but...").
        # Join them again: same words, one paragraph.
        if paragraphs and line[0].islower() and not re.search(r'[.!?:"”)]$', paragraphs[-1]):
            paragraphs[-1] += ' ' + line
        else:
            paragraphs.append(line)
    return without_footer(paragraphs)


# The lines at the end of most NMSU map descriptions repeat what the page already shows in its
# facts (address, building code, city, property number), in capitals, or are the words of a link
# that can't be followed here. Only these trailing lines are dropped; every sentence above stays.
FOOTER_LINES = [
    re.compile(r'^Property: \S+$'),  # "Property: 126"
    re.compile(r'^[A-Z .]+, NM,? \d{5}$'),  # "LAS CRUCES, NM, 88001"
    re.compile(r'^[A-Z0-9]{1,8}$'),  # the building code, "CP"
    re.compile(r'^\d[\dA-Z-]* [A-Z0-9 .#&\'/-]+$'),  # "1275 STEWART ST"
    re.compile(r'^Building monitor information can be found here\.?$'),  # a link's words, without the link
]


def without_footer(paragraphs):
    """Drop the address/code/property lines at the end of an NMSU description (see FOOTER_LINES)."""
    kept = list(paragraphs)
    while kept and any(pattern.match(kept[-1]) for pattern in FOOTER_LINES):
        kept.pop()
    return kept


def photos(map_ids, place_name):
    """
    Every photo on NMSU's map pages for these ids (no repeats), in the same shape as data/source/photos.json.
    Photos are linked from NMSU's map, not copied into this project.
    """
    found = []
    seen = set()
    for map_id in map_ids:
        record = location(map_id)
        if not record:
            continue
        for path, kind in zip(record['mediaUrls'], _kinds(record)):
            if kind not in ('image', '') or path in seen or not re.search(r'\.(jpe?g|png|gif|webp)$', path, re.I):
                continue
            seen.add(path)
            found.append({
                'file': None,
                'imageUrl': PHOTO_URL.format(path=path, width=800, height=533),
                'thumbUrl': PHOTO_URL.format(path=path, width=320, height=213),
                'sourceUrl': PAGE_URL.format(id=map_id),
                'license': "NMSU's campus map",
                'author': 'New Mexico State University',
                'verifiedHow': 'Listed on NMSU\'s campus map page for "' + record['name'] + '" (map id ' + str(map_id) +
                               '), matched to ' + place_name + ' by name and position.',
            })
    return found


def _kinds(record):
    """Each media item's kind as NMSU's map lists it ("image", "video", ...)."""
    kinds = list(record.get('mediaTypes') or [])
    while len(kinds) < len(record['mediaUrls']):
        kinds.append('')  # not listed: the file name check in photos() decides
    return kinds
