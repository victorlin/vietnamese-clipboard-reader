# Vietnamese Clipboard Reader

A tool to look up Vietnamese words from the clipboard in [VNEDICT (Vietnamese-English Dictionary)](http://www.denisowski.org/Vietnamese/vnedict_readme.htm).

Inspired by [Pleco](https://www.pleco.com)'s clipboard reader.

## Usage

    npx serve

## Design specifications

### Interface

- Top bar
    - Input field for pasting text
    - "Read Clipboard" button to load text from system clipboard (doesn't always work)
- Reader
    - Read-only block of loaded text
    - Tooltip for selection
- Bottom bar
    - Navigation buttons (described below)

### Behavior

- Words are defined as sequences of alphabetic characters including Vietnamese diacritics.
- Words can be selected via click or navigation.
- Selecting a word shows the longest match either starting or ending with the word (max length 10 words).
- Words not in the dictionary are still highlighted with a "no definition" tooltip.
- Navigating right finds the longest dictionary entry starting with the word.
- Navigating left finds the longest dictionary entry ending with the word.
- 4 navigation buttons:
    - `←`/`→`: For multi-word selections, jump over the entire phrase to the next/previous word
    - `⇤`/`⇥`: Move through words one at a time, even within multi-word selections

### Keyboard shortcuts

- `←`/`→`: arrow keys
- `⇤`/`⇥`: option + arrow keys

## Technical specifications

- Requires modern browser with Clipboard API support (Chrome 66+, Firefox 63+, Safari 13.1+)
- Clipboard API requires HTTPS or localhost

## File reference

- vnedict.txt: [VNEDICT Vietnamese-English Dictionary (utf-8 text file)](http://www.denisowski.org/Vietnamese/vnedict.txt)
