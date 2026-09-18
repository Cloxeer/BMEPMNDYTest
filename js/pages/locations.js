/**
 * @file js/pages/locations.js
 * @summary The Locations page: every place on our map you can go to, grouped by kind.
 *
 * WHAT IT DOES : One list per category in config.yml (Study, Housing, Parks, Food,
 *                Staff Academic, Historic, Parking), each headed by the category's icon and colour, with
 *                its places A to Z. Each list folds away: tap its title (the arrow turns) to open
 *                or close it, using Framework7's accordion, so the page starts as a short overview. Historic also lists study and living buildings that
 *                have an official historic designation. Tapping a place closes the page, flies the map
 *                there and opens its sheet (even if that category is switched off
 *                in Map filters).
 * DEPENDS ON   : ../core/config.js, ../core/store.js, ../core/html.js,
 *                #locations-popup in index.html (Framework7 lists).
 * CONTROLS     : #places-list.
 * USED BY      : js/pages/menu.js
 */

import { CONFIG } from '../core/config.js';
import { store } from '../core/store.js';
import { escapeHtml, iconHtml } from '../core/html.js';

/**
 * The small grey line under a place's name: "HJLC · 2902 Mcfie Cir." or "Coffee · Corbett Center Student Union".
 * @param {object} place
 * @returns {string}
 */
function subtitleFor(place) {
  const parts = [];
  if (place.code) {
    parts.push(place.code);
  }
  if (place.kind) {
    parts.push(place.kind);
  }
  if (place.permitColor) {
    parts.push(place.permitColor); // parking: its permit color
  }
  if (place.insideName) {
    parts.push(place.insideName);
  } else if (place.campus) {
    parts.push(place.campus);
  } else if (place.address) {
    parts.push(place.address);
  }
  return parts.join(' · ');
}

// One shared sorter: "Lot 9" before "Lot 10". Made once, it sorts about ten times faster than
// localeCompare, which sets up a new sorter on every comparison.
const BY_NAME = new Intl.Collator('en', { numeric: true });
const FIRST_ROWS = 40; // rows made the moment a group opens (more than a tall phone shows)
const ROWS_PER_PIECE = 25; // then this many at a time while the phone is idle

/**
 * Sort places A to Z by name (the list is copied, not changed).
 * @param {object[]} places
 * @returns {object[]}
 */
function sortedByName(places) {
  const copy = places.slice();
  copy.sort((a, b) => BY_NAME.compare(a.name, b.name));
  return copy;
}

export class LocationsPage {
  /**
   * @param {object[]} places - every building and place
   * @param {object} page - the Framework7 popup for this page
   */
  constructor(places, page) {
    this.page = page;
    this.byId = {}; // place id -> place, for the tap listener below

    // Sort every place into its category in one pass (Historic also gets designated buildings).
    const groups = {};
    for (const category of Object.keys(CONFIG.categories)) {
      groups[category] = [];
    }
    for (const place of places) {
      this.byId[place.id] = place;
      if (groups[place.category]) {
        groups[place.category].push(place);
      }
      if (place.historic && place.category !== 'historic' && groups.historic) {
        groups.historic.push(place);
      }
    }

    // Only the titles are made now; a group's rows are made the first time it opens,
    // so opening this page stays instant however many places there are.
    const holder = document.querySelector('#places-list');
    for (const category of Object.keys(groups)) {
      if (groups[category].length > 0) {
        holder.appendChild(this.makeGroup(category, groups[category]));
      }
    }

    // One listener for every row on the page (not one per row).
    holder.addEventListener('click', (event) => {
      const row = event.target.closest('[data-place]');
      if (!row) {
        return;
      }
      event.preventDefault();
      this.page.close();
      store.selectBuilding(this.byId[row.dataset.place], 'search');
    });
  }

  /**
   * One category: a title with its icon and an arrow, then a list of its places that opens and closes.
   * @param {string} category
   * @param {object[]} places - not sorted yet
   * @returns {HTMLElement}
   */
  makeGroup(category, places) {
    const look = CONFIG.categories[category];
    const group = document.createElement('div');
    group.className = 'places-group accordion-item'; // Framework7 opens and closes it, smoothly
    group.style.setProperty('--row-color', look.color);
    group.innerHTML =
      '<a href="#" class="block-title places-title accordion-item-toggle" role="button" aria-expanded="false">' +
      iconHtml(look.icon, look.iconSet) +
      '<span>' + escapeHtml(look.label) + ' (' + places.length + ')</span>' +
      '<i class="icon f7-icons places-arrow" aria-hidden="true">chevron_down</i></a>' +
      '<div class="accordion-item-content"><div class="list media-list inset"><ul></ul></div></div>';
    const list = group.querySelector('ul');
    const toggle = group.querySelector('.accordion-item-toggle');

    // Framework7 tells the item when it opens or closes; screen readers are told too.
    // The first time it opens, its rows are made (sorted A to Z): the first screenful at once,
    // the rest in small pieces after the opening slide, so even Parking (356) opens instantly.
    let sorted = null;
    group.addEventListener('accordion:beforeopen', () => {
      if (sorted === null) {
        sorted = sortedByName(places);
        list.innerHTML = this.rowsHtml(sorted.slice(0, FIRST_ROWS));
      }
    });
    group.addEventListener('accordion:opened', () => this.addRestOfRows(list, sorted));
    group.addEventListener('accordion:open', () => toggle.setAttribute('aria-expanded', 'true'));
    group.addEventListener('accordion:close', () => toggle.setAttribute('aria-expanded', 'false'));
    return group;
  }

  /**
   * Add a group's remaining rows, a few at a time while the phone is idle. Does nothing once
   * every row is there, and never keeps running.
   * @param {HTMLElement} list
   * @param {object[]} sorted - every place in the group, A to Z
   */
  addRestOfRows(list, sorted) {
    const later = window.requestIdleCallback || ((work) => setTimeout(() => work({ timeRemaining: () => 4 }), 16));
    const work = (deadline) => {
      let next = list.childElementCount;
      while (next < sorted.length && deadline.timeRemaining() > 2) {
        list.insertAdjacentHTML('beforeend', this.rowsHtml(sorted.slice(next, next + ROWS_PER_PIECE)));
        next = list.childElementCount;
      }
      if (next < sorted.length) {
        later(work);
      }
    };
    if (list.childElementCount < sorted.length) {
      later(work);
    }
  }

  /**
   * Every row of a group as one piece of HTML (much faster than making them one by one).
   * @param {object[]} places - sorted
   * @returns {string}
   */
  rowsHtml(places) {
    let html = '';
    for (const place of places) {
      html += '<li><a href="#" class="item-link item-content" data-place="' + escapeHtml(place.id) + '">' +
        '<div class="item-inner"><div class="item-title-row"><div class="item-title">' + escapeHtml(place.name) +
        '</div></div><div class="item-subtitle">' + escapeHtml(subtitleFor(place)) + '</div></div></a></li>';
    }
    return html;
  }
}
