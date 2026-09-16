/**
 * @file js/search.js
 * @summary The building and room search that drops down under the navbar.
 *
 * WHAT IT DOES : Tapping the search icon lets go of any selected building and
 *                opens a search field. Results appear only once you type, with
 *                the typed letters highlighted. Rooms come first ("SH 205",
 *                "118A"), then buildings. Tapping a result flies to the
 *                building and opens its sheet (on the room's floor, with the
 *                room highlighted). Tapping the search icon again closes search.
 *                What counts as a match is decided in ./searchMatch.js.
 * DEPENDS ON   : ./config.js, ./store.js, ./html.js, ./searchMatch.js,
 *                #search-drop in index.html (a Framework7 "media list" for the results).
 * CONTROLS     : #search-drop and #search-results.
 * USED BY      : js/app.js
 */

import { CONFIG } from './config.js';
import { store } from './store.js';
import { escapeHtml } from './html.js';
import { buildingWords, typedWords, buildingMatches, roomScore } from './searchMatch.js';

/**
 * Wrap every place a typed word appears in <mark>, e.g. "hall" in "Science Hall".
 * @param {string} text - text to show
 * @param {string[]} words - typed words, lowercase
 * @returns {string} safe HTML
 */
function highlight(text, words) {
  const lower = text.toLowerCase();
  const marked = new Array(text.length).fill(false);
  words.forEach((word) => {
    for (let at = lower.indexOf(word); at !== -1; at = lower.indexOf(word, at + 1)) {
      marked.fill(true, at, at + word.length);
    }
  });

  let html = '';
  for (let i = 0; i < text.length; i += 1) {
    const opens = marked[i] && !marked[i - 1];
    const closes = marked[i] && !marked[i + 1];
    html += (opens ? '<mark class="search-hit">' : '') + escapeHtml(text[i]) + (closes ? '</mark>' : '');
  }
  return html;
}

/**
 * Wire the search drop-down.
 * @param {object[]} buildings - every building, in map order
 * @param {object[]} rooms - every room, from data/rooms.json
 * @param {Object.<string, object>} buildingsById
 */
export function initSearch(buildings, rooms, buildingsById) {
  const drop = document.querySelector('#search-drop');
  const input = document.querySelector('#search-input');
  const searchButton = document.querySelector('#search-btn');
  const results = document.querySelector('#search-results');
  const list = results.querySelector('ul');
  const words = CONFIG.search;

  // Work out each building's words once, not on every key press.
  const wordsOf = Object.fromEntries(buildings.map((building) => [building.id, buildingWords(building)]));

  let showing = false; // is the drop-down on screen? Always follows state.searching.

  /**
   * One result row: bold title, grey subtitle, one chevron.
   * @param {string} title
   * @param {string} subtitle
   * @param {string[]} typed - typed words, for highlighting
   * @param {() => void} onPick
   * @returns {HTMLLIElement}
   */
  function resultRow(title, subtitle, typed, onPick) {
    const row = document.createElement('li');
    row.innerHTML =
      '<a href="#" class="item-link item-content"><div class="item-inner">' +
      '<div class="item-title-row"><div class="item-title">' + highlight(title, typed) + '</div></div>' +
      '<div class="item-subtitle">' + highlight(subtitle, typed) + '</div>' +
      '</div></a>';
    row.querySelector('a').addEventListener('click', (event) => {
      event.preventDefault();
      onPick(); // selecting also ends search
    });
    return row;
  }

  /**
   * A row for a room: "Room 225" / "Floor 2 · Classroom · HJLC · Hardman and Jacobs …".
   * @param {object} room
   * @param {string[]} typed
   * @returns {HTMLLIElement}
   */
  function roomRow(room, typed) {
    const building = buildingsById[room.building];
    const floor = room.floor ? CONFIG.pill.floorText + ' ' + room.floor : '';
    // Floor first, so it isn't the part cut off on a narrow screen.
    const subtitle = [floor, room.name, building.code, building.name].filter(Boolean).join(' · ');
    return resultRow(words.roomText + ' ' + room.number, subtitle, typed,
      () => store.selectRoom(building, room, 'search'));
  }

  /**
   * A row for a building: name / "code · address".
   * @param {object} building
   * @param {string[]} typed
   * @returns {HTMLLIElement}
   */
  function buildingRow(building, typed) {
    const subtitle = [building.code, building.address].filter(Boolean).join(' · ');
    return resultRow(building.name, subtitle, typed, () => store.selectBuilding(building, 'search'));
  }

  /**
   * Show results for the typed text. Nothing typed = no results panel.
   * @param {string} text
   */
  function showResults(text) {
    const typed = typedWords(text);
    list.innerHTML = '';
    results.hidden = typed.length === 0;
    if (!typed.length) return;

    // Rooms: exact room numbers first.
    const roomHits = rooms
      .map((room) => ({ room, score: roomScore(typed, room, buildingsById[room.building], wordsOf[room.building]) }))
      .filter((hit) => hit.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((hit) => roomRow(hit.room, typed));
    const buildingHits = buildings
      .filter((building) => buildingMatches(typed, wordsOf[building.id]))
      .map((building) => buildingRow(building, typed));

    const rows = [...roomHits, ...buildingHits].slice(0, words.maxResults);
    if (!rows.length) {
      const empty = document.createElement('li');
      empty.className = 'search-empty';
      empty.textContent = words.noMatchText + ' "' + text.trim() + '"';
      list.appendChild(empty);
    }
    rows.forEach((row) => list.appendChild(row));
  }

  /** Empty the field and the results. */
  function clear() {
    input.value = '';
    showResults('');
  }

  searchButton.addEventListener('click', () => {
    if (store.get().searching) store.endSearch();
    else store.startSearch();
  });
  input.addEventListener('input', () => showResults(input.value));
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') store.endSearch();
    if (event.key === 'Enter') {
      const firstResult = list.querySelector('a');
      if (firstResult) firstResult.click();
    }
  });

  // The store decides whether search is open; this only shows or hides it.
  // Anything that ends search (a result, the map, the icon, Escape) closes the drop-down.
  store.subscribe((state) => {
    if (state.searching === showing) return;
    showing = state.searching;
    drop.classList.toggle('is-open', showing);
    drop.setAttribute('aria-hidden', String(!showing));
    searchButton.setAttribute('aria-expanded', String(showing));
    clear();
    if (showing) setTimeout(() => input.focus(), CONFIG.search.focusDelay);
    else input.blur();
  });
}
