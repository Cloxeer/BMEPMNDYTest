/**
 * @file js/core/config.js
 * @summary Loads config.yml, the one file that holds every value you can change.
 *
 * WHAT IT DOES : 1. Downloads config.yml.
 *                2. Copies it into CONFIG, which every other file reads.
 *                3. Turns every value into a CSS variable the stylesheets read,
 *                   e.g. pill.height -> --pill-height, theme.textMuted -> --theme-text-muted.
 * DEPENDS ON   : js-yaml (the global `jsyaml`, loaded in index.html), config.yml.
 * CONTROLS     : CONFIG, and the CSS variables on the <html> element.
 * USED BY      : js/main.js (loads it first), and every file that reads CONFIG.
 */

/** Every setting from config.yml. Empty until loadConfig() has run. */
export const CONFIG = {};

/**
 * Change a name to the dashed style CSS uses: "textMuted" -> "text-muted".
 * @param {string} name
 * @returns {string}
 */
function toDashedName(name) {
  return name.replace(/[A-Z]/g, (capital) => '-' + capital.toLowerCase());
}

/**
 * Put every plain value of one part of config.yml onto <html> as a CSS variable.
 * Lists (like map.center) are skipped, because CSS can't use them.
 * @param {object} section - one section of config.yml, or a part of one
 * @param {string} prefix - the variable name so far, e.g. "--pill"
 */
function addCssVariables(section, prefix) {
  for (const key of Object.keys(section)) {
    const value = section[key];
    const name = prefix + '-' + toDashedName(key);
    if (Array.isArray(value)) {
      continue;
    }
    if (typeof value === 'object' && value !== null) {
      addCssVariables(value, name); // a section inside a section
    } else {
      document.documentElement.style.setProperty(name, String(value));
    }
  }
}

/**
 * Load config.yml and apply it. Run this before anything else starts.
 * @throws {Error} with the line number when config.yml has a typo
 */
export async function loadConfig() {
  // 'no-cache' asks the server for the newest copy, so a saved edit shows up on refresh.
  const response = await fetch('config.yml', { cache: 'no-cache' });
  if (!response.ok) {
    throw new Error('Could not load config.yml (' + response.status + ')');
  }

  // If config.yml has a typo, jsyaml.load throws a message like "... at line 12, column 3".
  const settings = jsyaml.load(await response.text()) || {}; // an empty file gives nothing
  for (const section of Object.keys(settings)) {
    CONFIG[section] = settings[section];
  }

  for (const section of Object.keys(CONFIG)) {
    addCssVariables(CONFIG[section], '--' + toDashedName(section));
  }

  // The browser's address bar colour on phones.
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) {
    themeColor.setAttribute('content', CONFIG.theme.crimson);
  }

  // The page stays hidden until this class is on (styles/base.css), so nothing flashes unstyled.
  document.documentElement.classList.add('config-ready');
}
