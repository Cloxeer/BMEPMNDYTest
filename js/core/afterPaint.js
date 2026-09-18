/**
 * @file js/core/afterPaint.js
 * @summary Run some work just after the screen has shown the result of a tap.
 *
 * WHAT IT DOES : A tap should change the screen within 10 ms, even on a slow phone. Some of
 *                the work a tap starts (flying the map, filling a page that slides up later)
 *                doesn't need to be in that first picture. afterNextPaint() waits until the
 *                browser has painted the next frame, then runs the work straight away.
 *                  requestAnimationFrame -> "just before the next paint"
 *                  setTimeout(..., 0)    -> "as soon as that paint is done"
 * DEPENDS ON   : nothing.
 * USED BY      : js/map/campusMap.js, js/sheet/buildingSheet.js, js/pages/search.js
 */

/**
 * @param {() => void} work - runs once, right after the next frame is on screen
 */
export function afterNextPaint(work) {
  requestAnimationFrame(() => setTimeout(work, 0));
}
