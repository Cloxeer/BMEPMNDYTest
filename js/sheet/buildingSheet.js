/**
 * @file js/sheet/buildingSheet.js
 * @summary The full-page building sheet. Every building uses the same layout.
 *
 * WHAT IT DOES : The layout lives in index.html (#building-sheet): floor plan,
 *                photos, about. This file fills in each part for the chosen
 *                building. A part with nothing to show yet gets a short message
 *                from config.yml, so no building's sheet looks different.
 *                  - The floor plan slides, room taps and indoor arrows: ./floorPlan.js
 *                  - Directions: the round button at the bottom (js/bottomBar/directionsButton.js)
 *                  - After directions bring you inside, a green "You've arrived"
 *                    banner shows at the top.
 *                Photos and plans open in one full-screen viewer (./photoViewer.js).
 *                Close the sheet with X or by pulling the crimson header down;
 *                the building stays chosen.
 * DEPENDS ON   : Framework7 (sheet), ../core/config.js, ../core/store.js, ../core/html.js,
 *                ./floorPlan.js, ./photoViewer.js, #building-sheet in index.html.
 * CONTROLS     : #building-sheet.
 * USED BY      : js/main.js
 */

import { CONFIG } from '../core/config.js';
import { store } from '../core/store.js';
import { escapeHtml, safeUrl } from '../core/html.js';
import { FloorPlan } from './floorPlan.js';
import { PhotoViewer } from './photoViewer.js';

export class BuildingSheet {
  /**
   * @param {Framework7} app
   * @param {Object.<string, object>} buildingsById
   * @param {object[]} rooms - data/rooms.json
   * @param {object[]} entrances - data/entrances.json
   * @param {() => void} askDirections - asked after a room on the plan is tapped
   */
  constructor(app, buildingsById, rooms, entrances, askDirections) {
    this.buildingsById = buildingsById;
    this.words = CONFIG.sheet;

    // Pulling the header down closes the sheet; scrolling the content never does.
    this.sheet = app.sheet.create({
      el: '#building-sheet',
      backdrop: false,
      swipeToClose: true,
      swipeHandler: '#building-sheet .bs-head',
    });
    this.sheetElement = document.querySelector('#building-sheet');

    // Every part of the sheet, by name.
    this.title = document.querySelector('#bs-name');
    this.arrivedBanner = document.querySelector('#bs-arrived');
    this.arrivedTitle = document.querySelector('#bs-arrived-title');
    this.arrivedText = document.querySelector('#bs-arrived-text');
    this.photos = document.querySelector('#bs-photos');
    this.photosEmpty = document.querySelector('#bs-photos-empty');
    this.aboutTitle = document.querySelector('#bs-about-title');
    this.credit = document.querySelector('#bs-credit');
    this.description = document.querySelector('#bs-description');
    this.facts = document.querySelector('#bs-facts');
    this.link = document.querySelector('#bs-link');
    this.source = document.querySelector('#bs-source');

    this.shownKey = ''; // "buildingId|floor|room" on screen now
    this.sheetIsOpen = false; // what Framework7 is showing right now

    this.photoViewer = new PhotoViewer(app);
    this.floorPlan = new FloorPlan(app, rooms, entrances, this.photoViewer, askDirections);

    this.photos.addEventListener('click', (event) => this.onPhotoTap(event));
    store.subscribe((state) => this.update(state));

    // Framework7 says "closed" when the closing animation ENDS. That can be after the
    // sheet was already opened again (e.g. a new building picked while it was closing).
    this.sheet.on('closed', () => {
      if (this.sheet.opened) {
        return; // an old close finishing late: ignore it
      }
      this.sheetIsOpen = false;
      if (store.get().sheetOpen) {
        store.closeSheet(); // the user closed it (X or pull-down)
      }
    });
  }

  /* ---------- Photos ---------- */

  /**
   * The photo strip with credits, or a "no photos yet" message.
   * @param {object} building
   */
  fillPhotos(building) {
    const photos = building.photos;
    this.photos.hidden = photos.length === 0;
    this.photosEmpty.hidden = photos.length > 0;
    if (building.category === 'park') {
      this.photosEmpty.textContent = this.words.parkNoPhotosText;
    } else {
      this.photosEmpty.textContent = this.words.noPhotosText;
    }

    let photosHtml = '';
    const credits = [];
    for (let index = 0; index < photos.length; index += 1) {
      const photo = photos[index];
      photosHtml += '<button class="bs-photo" type="button" data-index="' + index + '">' +
        '<img src="' + escapeHtml(photo.file) + '" alt="' + escapeHtml(this.words.photoAltText + ' ' + building.name) +
        '" loading="lazy" /></button>';
      const author = photo.author || this.words.unknownText;
      credits.push(escapeHtml(this.words.photoCreditText + ' ' + author) +
        ', <a href="' + safeUrl(photo.sourceUrl) + '" class="external" target="_blank" rel="noopener">' +
        escapeHtml(photo.license) + '</a>');
    }
    this.photos.innerHTML = photosHtml;
    this.credit.innerHTML = credits.join(' · ');
  }

  /**
   * A photo in the strip was tapped: open it full screen.
   * @param {MouseEvent} event
   */
  onPhotoTap(event) {
    const photoButton = event.target.closest('.bs-photo');
    const building = this.buildingsById[store.get().selectedId];
    if (!photoButton || !building) {
      return;
    }
    const urls = [];
    for (const photo of building.photos) {
      urls.push(photo.file);
    }
    this.photoViewer.open(urls, Number(photoButton.dataset.index));
  }

  /* ---------- About ---------- */

  /**
   * The list of facts to show: [label, value] pairs.
   * @param {object} building
   * @returns {Array[]}
   */
  factsFor(building) {
    if (building.category === 'park') {
      return [[this.words.typeLabel, building.kind]]; // parks aren't buildings: just their type
    }
    const code = building.code || this.words.unknownText;
    return [
      [this.words.addressLabel, building.address],
      [this.words.buildingLabel, code + ' · ' + this.words.numberText + ' ' + building.propertyNumber],
      [this.words.builtLabel, building.built],
      [this.words.floorsLabel, building.floors.length],
    ];
  }

  /**
   * Where the facts come from, shown in small print.
   * @param {object} building
   * @returns {string}
   */
  sourceTextFor(building) {
    if (building.category === 'park') {
      return this.words.parkSourceText;
    }
    // Name where the floor count comes from, only when it isn't NMSU's own data.
    let floorsNote = '';
    if (building.floorsSource !== 'NMSU Space Planning') {
      floorsNote = ' (' + this.words.floorCountText + ': ' + building.floorsSource + ')';
    }
    return this.words.codeSourceText + ': ' + building.codeSource + '. ' +
      this.words.factsSourceText + floorsNote + '. ' + this.words.plansNoteText;
  }

  /**
   * The description, facts, official link and where the facts come from.
   * @param {object} building
   */
  fillAbout(building) {
    const isPark = building.category === 'park';
    const hasDescription = building.description.length > 0;

    if (isPark) {
      this.aboutTitle.textContent = this.words.parkAboutTitle;
    } else {
      this.aboutTitle.textContent = this.words.aboutTitle;
    }

    let paragraphs = building.description;
    if (!hasDescription && isPark) {
      paragraphs = [this.words.parkNoDescriptionText];
    } else if (!hasDescription) {
      paragraphs = [this.words.noDescriptionText];
    }
    let descriptionHtml = '';
    for (const text of paragraphs) {
      descriptionHtml += '<p>' + escapeHtml(text) + '</p>';
    }
    this.description.innerHTML = descriptionHtml;
    this.description.classList.toggle('muted', !hasDescription);

    let factsHtml = '';
    for (const fact of this.factsFor(building)) {
      const value = fact[1] || this.words.unknownText; // missing facts say "Unknown"
      factsHtml += '<div class="bs-row"><dt>' + escapeHtml(fact[0]) + '</dt><dd>' + escapeHtml(value) + '</dd></div>';
    }
    this.facts.innerHTML = factsHtml;

    this.link.hidden = !building.nmsuUrl; // a brand-new building may not be on NMSU's map yet
    this.link.href = safeUrl(building.nmsuUrl || '');

    this.source.textContent = this.sourceTextFor(building);
  }

  /* ---------- "You've arrived" banner ---------- */

  /**
   * Show the banner after directions brought you inside; hide it otherwise.
   * @param {object} state
   */
  fillArrived(state) {
    this.arrivedBanner.hidden = !state.arrived;
    if (!state.arrived) {
      return;
    }
    const room = state.selectedRoom;
    const building = this.buildingsById[state.selectedId];
    const hasPlans = Object.keys(building.floorImages).length > 0;

    // Only point to things that are really on the sheet.
    let text = ''; // no plan and no room: the title says it all
    if (room && room.indoorRoute) {
      text = this.words.arrivedRoomText + ' ' + room.number + '.';
    } else if (room) {
      text = CONFIG.search.roomText + ' ' + room.number + ': ' + this.words.arrivedNoRoomPlanText;
    } else if (hasPlans) {
      text = this.words.arrivedBuildingText;
    }

    this.arrivedTitle.textContent = this.words.arrivedTitleText + ' ' + building.name;
    this.arrivedText.textContent = text;
  }

  /* ---------- Following the store ---------- */

  /**
   * Show the chosen building, floor and room, and open or close the sheet.
   * @param {object} state
   */
  update(state) {
    const building = this.buildingsById[state.selectedId];
    if (building) {
      let roomNumber = '';
      if (state.selectedRoom) {
        roomNumber = state.selectedRoom.number;
      }
      const key = state.selectedId + '|' + state.activeFloor + '|' + roomNumber;
      if (key !== this.shownKey) {
        const differentBuilding = !this.shownKey.startsWith(state.selectedId + '|');
        if (differentBuilding) {
          this.sheetElement.dataset.category = building.category; // parks hide the floor plan part (styles/sheet.css)
          this.floorPlan.reset();
          this.title.textContent = building.name;
          this.fillPhotos(building);
          this.fillAbout(building);
        }
        this.shownKey = key;
        this.floorPlan.show(building, state.activeFloor, state.selectedRoom);
      }
    }
    this.fillArrived(state);

    // Only open or close when it really changes (opening again would replay the animation).
    if (state.sheetOpen !== this.sheetIsOpen) {
      this.sheetIsOpen = state.sheetOpen;
      if (this.sheetIsOpen) {
        this.sheet.open();
      } else {
        this.sheet.close();
      }
    }
  }
}
