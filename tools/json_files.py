"""
tools/json_files.py - read and write the project's JSON and GeoJSON files.

WHAT IT DOES : JSON has no comments, so every data file starts with a "//" entry:
               a list of lines explaining what the file is and how to format it.
               write_json() always puts that note first; read_json() gives the
               data back (the note is just one more key, which the scripts skip).
DEPENDS ON   : Python 3 only.
USED BY      : every tools/build_*.py script
"""

import json

NOTE_KEY = '//'  # the "comment" entry at the top of every JSON file


def read_json(path):
    """Read a JSON file."""
    with open(path, encoding='utf-8') as file:
        return json.load(file)


def write_json(path, note, data, style):
    """
    Write a JSON object to a file, with its note first.
    path  : where to write
    note  : list of lines explaining the file (goes under "//")
    data  : a dict (its own "//" note, if any, is replaced)
    style : 'pretty'  - one item per line, indented by 1 space (easy to read and edit)
            'compact' - everything on one line with no spaces (big files, made by scripts)
            'spaced'  - one line, with a space after , and :
    """
    output = {NOTE_KEY: note}
    for key in data:
        if key != NOTE_KEY:
            output[key] = data[key]

    if style == 'pretty':
        text = json.dumps(output, indent=1, ensure_ascii=False)
    elif style == 'compact':
        text = json.dumps(output, separators=(',', ':'), ensure_ascii=False)
    elif style == 'spaced':
        text = json.dumps(output, ensure_ascii=False)
    else:
        raise ValueError('style must be pretty, compact or spaced, not ' + str(style))

    with open(path, 'w', encoding='utf-8', newline='\n') as file:
        file.write(text)
