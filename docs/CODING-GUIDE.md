# Coding guide

How we write code in this project, so every file looks the same and anyone on
the team can read, change and review it.

## Every file

- Starts with a header comment: **WHAT IT DOES / DEPENDS ON / CONTROLS / USED BY**.
- Does one job, and is named after it (`mapFiltersButton.js`, `routeCard.js`).
- Keeps to about 300 lines, comments included. If it grows well past that, split it.

## Every function or method

- Has a comment above it saying what it does, its parameters and what it returns.
- Does one thing, and is named with a verb: `fillPhotos`, `showResults`, `buildStack`.
- Isn't hidden inside another function (a short click handler is fine).

## JavaScript style

| Do | Instead of |
|---|---|
| `for (const room of rooms) { ... }` | `rooms.filter(...).map(...).reduce(...)` chains |
| `if (...) { ... } else { ... }` | `a ? b : c` for anything longer than a word |
| Full names: `building`, `entrance`, `event` | `b`, `e`, `x1` |
| `const` by default, `let` only when it changes | `var` |
| A class when the part remembers things between taps | Many loose variables |
| Arrow functions only for short callbacks: `() => this.setOpen(false)` | Arrow functions everywhere |
| Values from `config.yml` (`CONFIG.pill.floorText`) | Numbers and words typed into the code |
| `escapeHtml(text)` whenever data goes into `innerHTML` | Putting data straight into HTML |

- Change app state only through a `store` action. Never change `store.get()` directly.
- Code in `js/logic/` never touches the page or the map, so you can check it on its own.

## Python style (tools/)

- Plain loops and small functions; each function has a docstring.
- Write data files with `write_json()` from `tools/json_files.py`, so each file keeps its `"//"` note.
- Never type a fact in by hand. Every value comes from a named, official source,
  and a missing fact stays `null` (the app shows "Unknown").

## Checklist for a code review

1. Does the header comment still describe what the file does?
2. Does every new function have a comment?
3. Are the names clear without reading the code around them?
4. Do values and words come from `config.yml`?
5. Does data going into HTML go through `escapeHtml` / `safeUrl`?
6. Does state change only through `store` actions?
7. Did you test it in the browser on a phone-sized screen, and on a computer?
8. For data: is every new fact from an official source, with that source written down?
