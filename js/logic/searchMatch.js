/**
 * @file js/logic/searchMatch.js
 * @summary Decides which buildings and rooms match what was typed. No page code here.
 *
 * WHAT IT DOES : Splits the typed text into words and checks each word:
 *                  - a word with a number in it can be a room: "205", "118a",
 *                    or a building code and room typed together: "sh205"
 *                  - every other word must match the building: its code,
 *                    number, name, address or other names, from the start of a
 *                    word ("sci" finds Science Hall), allowing a small typo in
 *                    longer words ("harmon" finds Hardman)
 *                So "SH 205", "sh205", "118A" and "harmon jacobs 101" all work.
 * DEPENDS ON   : nothing.
 * USED BY      : js/pages/search.js
 */

/**
 * How many single-letter changes turn one word into another (the "Levenshtein distance").
 * It fills in a table row by row: each cell is the cheapest way to turn the
 * start of `a` into the start of `b`.
 * @param {string} a
 * @param {string} b
 * @returns {number} e.g. "harmon" -> "hardman" is 2
 */
function typoDistance(a, b) {
  let previousRow = [];
  for (let j = 0; j <= b.length; j += 1) {
    previousRow.push(j);
  }
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) {
      let change = 1;
      if (a[i - 1] === b[j - 1]) {
        change = 0;
      }
      const remove = previousRow[j] + 1;
      const add = row[j - 1] + 1;
      const swap = previousRow[j - 1] + change;
      row[j] = Math.min(remove, add, swap);
    }
    previousRow = row;
  }
  return previousRow[b.length];
}

/**
 * How many typos are allowed in a typed word. None for short words (too many false matches).
 * @param {string} typed
 * @returns {number}
 */
function allowedTypos(typed) {
  if (typed.length >= 6) {
    return 2;
  }
  if (typed.length >= 4) {
    return 1;
  }
  return 0;
}

/**
 * Does one typed word match one word of a building?
 * @param {string} typed - lowercase, e.g. "harmon"
 * @param {string} word - lowercase, e.g. "hardman"
 * @returns {boolean}
 */
function wordMatches(typed, word) {
  if (word.startsWith(typed)) {
    return true;
  }
  const typos = allowedTypos(typed);
  if (typos === 0) {
    return false;
  }
  // Compare with the start of the word: one letter shorter, the same length, or one letter longer.
  for (let length = typed.length - 1; length <= typed.length + 1; length += 1) {
    if (typoDistance(typed, word.slice(0, length)) <= typos) {
      return true;
    }
  }
  return false;
}

/**
 * Split text into lowercase words of letters and numbers: "SH-205 Hall" -> ["sh", "205", "hall"].
 * @param {string} text
 * @returns {string[]}
 */
function splitIntoWords(text) {
  const words = [];
  for (const word of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (word !== '') {
      words.push(word);
    }
  }
  return words;
}

/**
 * Every searchable word of a building, lowercase.
 * @param {object} building
 * @returns {string[]}
 */
export function buildingWords(building) {
  const parts = [building.code, building.id, building.name, building.address];
  for (const otherName of building.aka) {
    parts.push(otherName);
  }
  return splitIntoWords(parts.join(' '));
}

/**
 * The typed text as lowercase words: "SH 205" -> ["sh", "205"].
 * @param {string} typed
 * @returns {string[]}
 */
export function typedWords(typed) {
  return splitIntoWords(typed);
}

/**
 * Does every typed word match some word of this building?
 * @param {string[]} words - from typedWords()
 * @param {string[]} ownWords - from buildingWords()
 * @returns {boolean}
 */
export function buildingMatches(words, ownWords) {
  if (words.length === 0) {
    return false;
  }
  for (const typed of words) {
    let found = false;
    for (const word of ownWords) {
      if (wordMatches(typed, word)) {
        found = true;
        break;
      }
    }
    if (!found) {
      return false;
    }
  }
  return true;
}

/**
 * How well a room matches: 2 = the exact room number, 1 = the start of it, 0 = no match.
 * One typed word (with a number in it) must be the room; the other words must match its building.
 * @param {string[]} words - from typedWords()
 * @param {object} room - a record from data/rooms.json
 * @param {object} building - the room's building
 * @param {string[]} ownWords - buildingWords(building)
 * @returns {number}
 */
export function roomScore(words, room, building, ownWords) {
  const number = room.number.toLowerCase();
  const code = (building.code || '').toLowerCase(); // some buildings have no code yet
  let best = 0;

  for (let index = 0; index < words.length; index += 1) {
    const typed = words[index];
    if (!/\d/.test(typed)) {
      continue; // rooms are only found by a word with a number in it
    }
    // "sh205" = building code + room number typed together
    let roomPart = typed;
    if (typed.startsWith(code) && typed.length > code.length) {
      roomPart = typed.slice(code.length);
    }
    if (!number.startsWith(roomPart)) {
      continue;
    }

    const otherWords = [];
    for (let other = 0; other < words.length; other += 1) {
      if (other !== index) {
        otherWords.push(words[other]);
      }
    }
    if (otherWords.length > 0 && !buildingMatches(otherWords, ownWords)) {
      continue;
    }

    if (roomPart === number) {
      best = Math.max(best, 2);
    } else {
      best = Math.max(best, 1);
    }
  }
  return best;
}
