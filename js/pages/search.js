/**
 * @file js/pages/search.js
 * @summary The building and room search that drops down under the navbar.
 *
 * WHAT IT DOES : Tapping the search icon lets go of any chosen building and opens
 *                a search field. Results appear once you type, with the typed
 *                letters highlighted. Rooms come first ("SH 205", "118A"), then
 *                buildings. Tapping a result flies to the building and opens its
 *                sheet (on the room's floor, with the room highlighted). Tapping
 *                the search icon again closes search.
 *                What you type is remembered on this device until you delete it
 *                (so "sh" is still there next time); the round x clears it.
 *                What counts as a match is decided in js/logic/searchMatch.js.
 * DEPENDS ON   : ../core/config.js, ../core/store.js, ../core/html.js, ../core/storage.js,
 *                ../logic/searchMatch.js, #search-drop in index.html
 *                (a Framework7 "media list" for the results).
 * CONTROLS     : #search-drop and #search-results.
 * USED BY      : js/main.js
 */

import { CONFIG } from '../core/config.js';
import { store } from '../core/store.js';
import { escapeHtml } from '../core/html.js';
import { readSaved, save, forget } from '../core/storage.js';
import { buildingWords, typedWords, buildingMatches, roomScore } from '../logic/searchMatch.js';

/**
 * Wrap every place a typed word appears in <mark>, e.g. "hall" in "Science Hall".
 * @param {string} text - the text to show
 * @param {string[]} words - the typed words, lowercase
 * @returns {string} safe HTML
 */
function highlight(text, words) {
  // 1. Mark every letter that is part of a typed word.
  const lower = text.toLowerCase();
  const marked = [];
  for (let i = 0; i < text.length; i += 1) {
    marked.push(false);
  }
  for (const word of words) {
    let at = lower.indexOf(word);
    while (at !== -1) {
      for (let i = at; i < at + word.length && i < text.length; i += 1) {
        marked[i] = true;
      }
      at = lower.indexOf(word, at + 1);
    }
  }

  // 2. Build the HTML, opening <mark> where a marked stretch starts and closing it where it ends.
  let html = '';
  for (let i = 0; i < text.length; i += 1) {
    const opens = marked[i] && !marked[i - 1];
    const closes = marked[i] && !marked[i + 1];
    if (opens) {
      html += '<mark class="search-hit">';
    }
    html += escapeHtml(text[i]);
    if (closes) {
      html += '</mark>';
    }
  }
  return html;
}

/**
 * Join the parts that aren't empty with " · ": ["SH", "", "Science Hall"] -> "SH · Science Hall".
 * @param {Array<string|null>} parts
 * @returns {string}
 */
function joinWithDots(parts) {
  const kept = [];
  for (const part of parts) {
    if (part) {
      kept.push(part);
    }
  }
  return kept.join(' · ');
}

export class Search {
  /**
   * @param {object[]} buildings - every building and park, in data file order
   * @param {object[]} rooms - every room, from data/rooms.json
   * @param {Object.<string, object>} buildingsById
   */
  constructor(buildings, rooms, buildingsById) {
    this.buildings = buildings;
    this.rooms = rooms;
    this.buildingsById = buildingsById;
    this.words = CONFIG.search;
    this.drop = document.querySelector('#search-drop');
    this.input = document.querySelector('#search-input');
    this.searchButton = document.querySelector('#search-btn');
    this.results = document.querySelector('#search-results');
    this.list = this.results.querySelector('ul');
    this.clearButton = document.querySelector('#search-clear');
    this.showing = false; // is the drop-down on screen? It always follows state.searching.

    // Each place's searchable words, worked out once each (not on every key press),
    // the first time search is opened.
    this.wordsOf = {};
    this.picks = []; // what tapping each shown result does, by its data-pick number

    this.listen();
    store.subscribe((state) => this.update(state));
  }

  /** Wire the search icon, the field, the round x, and the Escape and Enter keys. */
  /**
   * The rooms arrive a moment after the map (data/rooms.json), so search can find them too.
   * The parks, food and parking lots are already here: js/main.js adds them to the very same
   * list this class was handed, so pushing them again would show every place twice.
   * @param {object[]} rooms
   */
  addRooms(rooms) {
    this.rooms = rooms;
  }

  /**
   * Work out every place's searchable words ahead of time, a few at a time while the phone has
   * nothing else to do, so the first key press doesn't have to do it all at once. Stops by itself
   * when every place is done (it never keeps running).
   */
  readyWordsWhenIdle() {
    const later = window.requestIdleCallback || ((work) => setTimeout(() => work({ timeRemaining: () => 4 }), 50));
    let next = 0;
    const work = (deadline) => {
      while (next < this.buildings.length && deadline.timeRemaining() > 1) {
        const building = this.buildings[next];
        if (!this.wordsOf[building.id]) {
          this.wordsOf[building.id] = buildingWords(building);
        }
        next += 1;
      }
      if (next < this.buildings.length) {
        later(work); // not finished: carry on in the next quiet moment
      }
    };
    later(work);
  }

  /** Work out the searchable words of any place that doesn't have them yet. */
  readyWords() {
    for (const building of this.buildings) {
      if (!this.wordsOf[building.id]) {
        this.wordsOf[building.id] = buildingWords(building);
      }
    }
  }

  listen() {
    // One listener for every result row (rows are remade on each key press).
    this.list.addEventListener('click', (event) => {
      const row = event.target.closest('[data-pick]');
      if (row) {
        event.preventDefault();
        this.picks[Number(row.dataset.pick)](); // choosing a result also ends search
      }
    });
    this.searchButton.addEventListener('click', () => {
      if (store.get().searching) {
        store.endSearch();
      } else {
        store.startSearch();
      }
    });
    this.input.addEventListener('input', () => {
      this.saveText(this.input.value);
      this.clearButton.hidden = !this.input.value;
      this.showResults(this.input.value);
    });
    this.clearButton.addEventListener('click', (event) => {
      event.preventDefault(); // it sits inside the field's <label>
      this.saveText('');
      this.fill('');
      this.input.focus();
    });
    this.input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        store.endSearch();
      }
      if (event.key === 'Enter') {
        const firstResult = this.list.querySelector('a');
        if (firstResult) {
          firstResult.click();
        }
      }
    });
  }

  /* ---------- Result rows ---------- */

  /**
   * One result row's HTML: a bold title, a grey subtitle, and a chevron.
   * Tapping it runs this.picks[index] (one listener for the whole list, in listen()).
   * @param {string} title
   * @param {string} subtitle
   * @param {string[]} typed - the typed words, for highlighting
   * @param {number} index - its place in this.picks
   * @returns {string}
   */
  resultRow(title, subtitle, typed, index) {
    return '<li><a href="#" class="item-link item-content" data-pick="' + index + '"><div class="item-inner">' +
      '<div class="item-title-row"><div class="item-title">' + highlight(title, typed) + '</div></div>' +
      '<div class="item-subtitle">' + highlight(subtitle, typed) + '</div>' +
      '</div></a></li>';
  }

  /**
   * A row for a room: "Room 225" / "Floor 2 · Classroom · HJLC · Hardman and Jacobs …".
   * @param {object} room
   * @param {string[]} typed
   * @returns {string}
   */
  roomRow(room, typed) {
    const building = this.buildingsById[room.building];
    let floor = '';
    if (room.floor) {
      floor = CONFIG.pill.floorText + ' ' + room.floor;
    }
    // The floor goes first, so it isn't the part cut off on a narrow screen.
    const subtitle = joinWithDots([floor, room.name, building.code, building.name]);
    this.picks.push(() => store.selectRoom(building, room, 'search'));
    return this.resultRow(this.words.roomText + ' ' + room.number, subtitle, typed, this.picks.length - 1);
  }

  /**
   * A row for a building: its name / "code · address".
   * @param {object} building
   * @param {string[]} typed
   * @returns {string}
   */
  buildingRow(building, typed) {
    const subtitle = joinWithDots([building.code, building.address]);
    this.picks.push(() => store.selectBuilding(building, 'search'));
    return this.resultRow(building.name, subtitle, typed, this.picks.length - 1);
  }

  /**
   * Show the results for the typed text. Nothing typed = no results panel.
   * Only the rows that fit (maxResults) are made; searching stops once there are enough.
   * @param {string} text
   */
  showResults(text) {
    this.readyWords();
    const typed = typedWords(text);
    this.picks = [];
    this.results.hidden = typed.length === 0;
    if (typed.length === 0) {
      this.list.innerHTML = '';
      return;
    }

    // Rooms: exact room numbers first, then rooms whose number starts with what was typed.
    const exactRooms = [];
    const partialRooms = [];
    for (const room of this.rooms) {
      const score = roomScore(typed, room, this.buildingsById[room.building], this.wordsOf[room.building]);
      if (score === 2) {
        exactRooms.push(room);
      } else if (score === 1) {
        partialRooms.push(room);
      }
    }

    const max = this.words.maxResults;
    let html = '';
    let count = 0;
    for (const room of exactRooms.concat(partialRooms)) {
      if (count === max) {
        break;
      }
      html += this.roomRow(room, typed);
      count += 1;
    }
    for (const building of this.buildings) {
      if (count === max) {
        break; // enough rows: no need to look further
      }
      if (buildingMatches(typed, this.wordsOf[building.id])) {
        html += this.buildingRow(building, typed);
        count += 1;
      }
    }

    if (count === 0) {
      html = '<li class="search-empty">' + escapeHtml(this.words.noMatchText + ' "' + text.trim() + '"') + '</li>';
    }
    this.list.innerHTML = html;
  }

  /* ---------- Remembering what was typed ---------- */

  /** @returns {string} the text saved last time, or '' */
  savedText() {
    return readSaved(this.words.storageKey) || '';
  }

  /** @param {string} text - remember it; an empty field forgets */
  saveText(text) {
    if (text) {
      save(this.words.storageKey, text);
    } else {
      forget(this.words.storageKey);
    }
  }

  /** @param {string} text - put text in the field and show its results */
  fill(text) {
    this.input.value = text;
    this.clearButton.hidden = !text;
    this.showResults(text);
  }

  /**
   * Open or close the drop-down to match the state.
   * The store decides whether search is open (a result, the map, the icon or Escape can close it).
   * @param {object} state
   */
  update(state) {
    if (state.searching === this.showing) {
      return;
    }
    this.showing = state.searching;
    this.drop.classList.toggle('is-open', this.showing);
    this.drop.setAttribute('aria-hidden', String(!this.showing));
    this.searchButton.setAttribute('aria-expanded', String(this.showing));

    if (!this.showing) {
      this.fill(''); // closing just hides the results
      this.input.blur();
      return;
    }
    // Opening brings back what was typed last time.
    this.fill(this.savedText());
    setTimeout(() => {
      this.input.focus();
      this.input.setSelectionRange(this.input.value.length, this.input.value.length); // cursor after the remembered text
    }, this.words.focusDelay);
  }
}

