/**
 * @file js/orb.js
 * @summary A tiny "thinking orb" icon (our own vanilla version of the
 *          libraries.dev thinking-orbs look — no React, no build step).
 *
 * WHAT IT DOES : Builds a small ring of crimson dots that gently animate.
 *                It has three moods: "idle", "solving", and "searching".
 * DEPENDS ON   : styles in styles/app.css (the .orb rules).
 * CONTROLS     : just its own little element.
 * USED BY      : js/pill.js
 */

/**
 * Make one orb element.
 * @param {number} [size=20] - width/height of the orb in pixels
 * @returns {{ el: HTMLElement, setState: (mood: string) => void }}
 */
export function createOrb(size = 20) {
  const el = document.createElement('span');
  el.className = 'orb';
  el.dataset.state = 'idle';
  el.style.setProperty('--orb-size', size + 'px');

  // Eight dots evenly spaced around a circle. CSS positions + animates them.
  const DOTS = 8;
  for (let i = 0; i < DOTS; i++) {
    const dot = document.createElement('span');
    dot.className = 'orb-dot';
    dot.style.setProperty('--i', i);
    dot.style.setProperty('--n', DOTS);
    el.appendChild(dot);
  }

  return {
    el,
    /**
     * Switch the orb's mood.
     * @param {'idle'|'solving'|'searching'} mood
     */
    setState(mood) {
      el.dataset.state = mood;
    },
  };
}
