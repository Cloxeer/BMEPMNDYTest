/**
 * @file js/logic/hours.js
 * @summary Turns NMSU Dining's opening-hours lines into tidy rows for a food place's page.
 *
 * WHAT IT DOES : NMSU Dining writes hours like "Mon. - Thur.: 7 am - 3 pm". This file splits
 *                each line into its days and its times, tidies the words
 *                ("Mon – Thu", "7 AM – 3 PM", "Closed"), and says whether today is one of
 *                those days, so the page can mark today's row. It never changes the times
 *                themselves; a line it can't read is shown just as NMSU wrote it.
 * DEPENDS ON   : nothing (plain functions, easy to test).
 * USED BY      : js/sheet/buildingSheet.js
 */

// Every way NMSU writes a day, and its number (Sunday = 0, like Date.getDay()).
const DAY_WORDS = [
  ['sunday', 0], ['sundays', 0], ['sun', 0],
  ['monday', 1], ['mondays', 1], ['mon', 1],
  ['tuesday', 2], ['tuesdays', 2], ['tues', 2], ['tue', 2],
  ['wednesday', 3], ['wednesdays', 3], ['wed', 3],
  ['thursday', 4], ['thursdays', 4], ['thurs', 4], ['thur', 4], ['thu', 4],
  ['friday', 5], ['fridays', 5], ['fri', 5],
  ['saturday', 6], ['saturdays', 6], ['sat', 6],
];
const SHORT_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * A day word -> its number, or -1 when it isn't a day.
 * @param {string} word - e.g. "Thur." or "Fridays"
 * @returns {number}
 */
function dayNumber(word) {
  const clean = word.toLowerCase().replace(/[^a-z]/g, '');
  for (const pair of DAY_WORDS) {
    if (pair[0] === clean) {
      return pair[1];
    }
  }
  return -1;
}

/**
 * The days a "Mon. - Thur." or "Friday" part covers, as numbers. Empty when it can't be read.
 * @param {string} text
 * @returns {number[]}
 */
function daysIn(text) {
  const ends = text.split('-');
  if (ends.length === 1) {
    const day = dayNumber(ends[0]);
    return day === -1 ? [] : [day];
  }
  if (ends.length !== 2) {
    return [];
  }
  const first = dayNumber(ends[0]);
  const last = dayNumber(ends[1]);
  if (first === -1 || last === -1) {
    return [];
  }
  const days = [];
  let day = first;
  while (true) {
    days.push(day);
    if (day === last) {
      return days;
    }
    day = (day + 1) % 7; // "Fri. - Sun." wraps past Saturday
  }
}

/**
 * "7 am - 3 pm" -> "7 AM – 3 PM", "CLOSED" -> "Closed". Only the look changes, never the times.
 * @param {string} text
 * @returns {string}
 */
function tidyTimes(text) {
  if (text.trim().toUpperCase() === 'CLOSED') {
    return 'Closed';
  }
  return text
    .replace(/\b(am|pm)\b/gi, (word) => word.toUpperCase())
    .replace(/\s+-\s+/g, ' – ')
    .trim();
}

/**
 * One of NMSU Dining's lines as a row: { days, times, note, isToday }.
 * A line that isn't "days: times" comes back as { days: '', times: the line, note: '', isToday: false }.
 * @param {string} line - e.g. "Mon. - Thur.: 7 am - 3 pm"
 * @param {number} today - today's day number (Date.getDay())
 * @returns {{days: string, times: string, note: string, isToday: boolean}}
 */
export function hoursRow(line, today) {
  const colon = line.indexOf(': ');
  if (colon === -1) {
    return { days: '', times: line, note: '', isToday: false };
  }
  const dayText = line.slice(0, colon);
  let timeText = line.slice(colon + 2);
  const days = daysIn(dayText);
  if (days.length === 0) {
    return { days: '', times: line, note: '', isToday: false };
  }

  // A note in brackets after the times goes on its own small line.
  let note = '';
  const bracket = timeText.indexOf(' (');
  if (bracket !== -1 && timeText.endsWith(')')) {
    note = timeText.slice(bracket + 2, -1);
    timeText = timeText.slice(0, bracket);
  }

  let dayLabel = SHORT_NAMES[days[0]];
  if (days.length > 1) {
    dayLabel += ' – ' + SHORT_NAMES[days[days.length - 1]];
  }
  return { days: dayLabel, times: tidyTimes(timeText), note: note, isToday: days.indexOf(today) !== -1 };
}
