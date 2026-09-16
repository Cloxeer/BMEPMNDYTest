/**
 * @file js/searchMatch.js
 * @summary Decides which buildings and rooms match what was typed. No page code here.
 *
 * WHAT IT DOES : Splits the typed text into words and checks each word:
 *                  - a word with a number can be a room: "205", "118a",
 *                    or code + room stuck together: "sh205"
 *                  - every other word must match the building: its code,
 *                    number, name, address or other names, from the start of a
 *                    word ("sci" finds Science Hall), allowing a small typo in
 *                    longer words ("harmon" finds Hardman)
 *                So "SH 205", "sh205", "118A" and "harmon jacobs 101" all work.
 * DEPENDS ON   : nothing.
 * USED BY      : js/search.js
 */

/**
 * How many single-letter changes turn one word into another (Levenshtein distance).
 * @param {string} a
 * @param {string} b
 * @returns {number} e.g. "harmon" -> "hardman" is 2
 */
function typoDistance(a, b) {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const change = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + change);
    }
    previous = current;
  }
  return previous[b.length];
}

/**
 * Typos allowed for a typed word: none for short words (too many false matches).
 * @param {string} typed
 * @returns {number}
 */
function allowedTypos(typed) {
  if (typed.length >= 6) return 2;
  if (typed.length >= 4) return 1;
  return 0;
}

/**
 * Does one typed word match one word of a building?
 * @param {string} typed - lowercase, e.g. "harmon"
 * @param {string} word - lowercase, e.g. "hardman"
 * @returns {boolean}
 */
function wordMatches(typed, word) {
  if (word.startsWith(typed)) return true;
  const typos = allowedTypos(typed);
  // Compare with the start of the word, a little shorter or longer than what was typed.
  for (let length = typed.length - 1; length <= typed.length + 1; length += 1) {
    if (typos > 0 && typoDistance(typed, word.slice(0, length)) <= typos) return true;
  }
  return false;
}

/**
 * Every searchable word of a building, lowercase.
 * @param {object} building
 * @returns {string[]}
 */
export function buildingWords(building) {
  return [building.code, building.id, building.name, building.address, ...building.aka]
    .join(' ')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * The typed text as lowercase words: "SH 205" -> ["sh", "205"].
 * @param {string} typed
 * @returns {string[]}
 */
export function typedWords(typed) {
  return typed.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/**
 * Does every typed word match this building?
 * @param {string[]} words - from typedWords()
 * @param {string[]} ownWords - from buildingWords()
 * @returns {boolean}
 */
export function buildingMatches(words, ownWords) {
  return words.length > 0 && words.every((typed) => ownWords.some((word) => wordMatches(typed, word)));
}

/**
 * How well a room matches: 2 = exact room number, 1 = start of the number, 0 = no match.
 * One typed word (with a digit) must be the room; the rest must match its building.
 * @param {string[]} words - from typedWords()
 * @param {object} room - a record from data/rooms.json
 * @param {object} building - the room's building
 * @param {string[]} ownWords - buildingWords(building)
 * @returns {number}
 */
export function roomScore(words, room, building, ownWords) {
  const number = room.number.toLowerCase();
  const code = building.code.toLowerCase();
  let best = 0;

  words.forEach((typed, index) => {
    if (!/\d/.test(typed)) return; // rooms are only found by something with a number in it
    // "sh205" = building code + room number typed together
    const roomPart = typed.startsWith(code) && typed.length > code.length ? typed.slice(code.length) : typed;
    if (!number.startsWith(roomPart)) return;

    const others = words.filter((_, i) => i !== index);
    if (others.length && !buildingMatches(others, ownWords)) return;
    best = Math.max(best, roomPart === number ? 2 : 1);
  });
  return best;
}
