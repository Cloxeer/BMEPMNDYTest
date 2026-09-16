/**
 * @file js/config.js
 * @summary Loads config.yml, the one file that holds every changeable value.
 *
 * WHAT IT DOES : (1) downloads config.yml (never from cache, so edits show on refresh),
 *                (2) turns it into the CONFIG object the JavaScript reads,
 *                (3) turns every value into a CSS variable the stylesheet reads,
 *                    e.g. pill.height -> --pill-height, theme.textMuted -> --theme-text-muted.
 * DEPENDS ON   : js-yaml (global `jsyaml`, loaded in index.html), config.yml.
 * CONTROLS     : CONFIG, and the CSS variables on the <html> element.
 * USED BY      : every other js/ file (they read CONFIG), styles/app.css (reads the variables).
 */

/** Filled by loadConfig(). Other files import this and read it after start-up. */
export const CONFIG = {};

/**
 * "textMuted" -> "text-muted" (CSS variable names use dashes).
 * @param {string} name
 * @returns {string}
 */
function toKebabCase(name) {
  return name.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase());
}

/**
 * Put every plain value from config.yml onto <html> as a CSS variable.
 * Lists (like map.center) are skipped because CSS can't use them.
 * @param {object} section - one section of config.yml, or part of one
 * @param {string} prefix - the variable name so far, e.g. "--pill"
 */
function setCssVariables(section, prefix) {
  Object.entries(section).forEach(([key, value]) => {
    const name = prefix + '-' + toKebabCase(key);
    if (Array.isArray(value)) return;
    if (typeof value === 'object' && value !== null) setCssVariables(value, name);
    else document.documentElement.style.setProperty(name, String(value));
  });
}

/**
 * Load config.yml and apply it. Call this before starting anything else.
 * @throws {Error} with the file's line number when config.yml has a typo
 */
export async function loadConfig() {
  // 'no-cache' still uses the browser's copy, but checks with the server first,
  // so a saved edit shows up on the next refresh.
  const response = await fetch('config.yml', { cache: 'no-cache' });
  if (!response.ok) throw new Error('Could not load config.yml (' + response.status + ')');

  // jsyaml.load throws a readable message such as "... at line 12, column 3".
  Object.assign(CONFIG, jsyaml.load(await response.text()));

  Object.entries(CONFIG).forEach(([section, values]) => setCssVariables(values, '--' + toKebabCase(section)));
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.setAttribute('content', CONFIG.theme.crimson);
  document.documentElement.classList.add('config-ready');
}
