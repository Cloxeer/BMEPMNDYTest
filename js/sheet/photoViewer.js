/**
 * @file js/sheet/photoViewer.js
 * @summary The full-screen picture viewer with pinch-zoom (photos, floor plans, posted maps).
 *
 * WHAT IT DOES : Opens Framework7's photo browser for a list of pictures.
 *                Only one viewer is open at a time; it's thrown away when it
 *                closes, so the next one starts fresh.
 * DEPENDS ON   : Framework7 (photo browser), ../core/config.js
 * USED BY      : js/sheet/buildingSheet.js, js/sheet/floorPlan.js
 */

import { CONFIG } from '../core/config.js';

export class PhotoViewer {
  /**
   * @param {Framework7} app
   */
  constructor(app) {
    this.app = app;
    this.viewer = null; // the viewer while it's open, otherwise null
  }

  /**
   * Open pictures full screen.
   * @param {string[]} urls
   * @param {number} startAt - which picture to show first (0 = the first)
   */
  open(urls, startAt) {
    if (this.viewer) {
      return; // already open
    }
    this.viewer = this.app.photoBrowser.create({
      photos: urls,
      type: 'standalone',
      theme: CONFIG.sheet.photoViewerTheme,
      toolbar: urls.length > 1, // arrows only when there's more than one picture
    });
    this.viewer.on('closed', () => {
      this.viewer.destroy();
      this.viewer = null;
    });
    this.viewer.open(startAt);
  }
}
