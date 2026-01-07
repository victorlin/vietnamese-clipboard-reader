// ===== GLOBAL STATE =====
let englishDictionary = new Map();
let chineseDictionary = new Map();
let chineseEnabled = false;
let showHelp = false;
let currentText = '';
let wordPositions = [];
let currentWordIndex = null;
let currentSelection = null;

// ===== DICTIONARY LOADING =====
function parseDictionary(content, targetMap) {
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) continue;

    const term = trimmed.substring(0, colonIndex).trim().toLowerCase();
    const definition = trimmed.substring(colonIndex + 1).trim();
    targetMap.set(term, definition);
  }
}

async function loadDictionaries() {
  // Load both dictionaries in parallel
  const [enDictFetch, zhDictFetch] = await Promise.all([
    fetch('vnedict.txt'),
    fetch('zh/dict.txt')
  ]);

  const enDictText = await enDictFetch.text();
  const zhDictText = await zhDictFetch.text();

  parseDictionary(enDictText, englishDictionary);
  parseDictionary(zhDictText, chineseDictionary);
}

// ===== DICTIONARY LOOKUP =====
function findLongestMatchStartingWith(text, startIndex) {
  const remainingText = text.substring(startIndex);

  // Match a sequence of words separated by spaces
  const match = remainingText.match(/^[a-zA-ZÀ-ỹ]+(?: +[a-zA-ZÀ-ỹ]+)*/);
  if (!match) return null;

  const sequence = match[0];
  const words = sequence.split(/ +/);

  // Try matches from longest to shortest (up to 10 words)
  const maxWords = Math.min(words.length, 10);
  for (let i = maxWords; i >= 1; i--) {
    const phrase = words.slice(0, i).join(' ').toLowerCase();
    const definition = englishDictionary.get(phrase);
    if (definition) {
      return { word: phrase, definition };
    }
  }
  return null;
}

function findLongestMatchEndingWith(text, endIndex) {
  const textBefore = text.substring(0, endIndex);

  // Match a sequence of words separated by spaces, ending at endIndex
  const match = textBefore.match(/[a-zA-ZÀ-ỹ]+(?: +[a-zA-ZÀ-ỹ]+)*$/);
  if (!match) return null;

  const sequence = match[0];
  const words = sequence.split(/ +/);

  // Try matches from longest to shortest (up to 10 words)
  const maxWords = Math.min(words.length, 10);
  for (let i = maxWords; i >= 1; i--) {
    const phrase = words.slice(-i).join(' ').toLowerCase();
    const definition = englishDictionary.get(phrase);
    if (definition) {
      return { word: phrase, definition };
    }
  }
  return null;
}

// ===== CLIPBOARD READING =====
async function readClipboard() {
  console.log('Reading clipboard…');
  try {
    // Add timeout to prevent hanging indefinitely
    const clipboardPromise = navigator.clipboard.readText();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Clipboard read timeout')), 2000)
    );

    const clipboardText = await Promise.race([clipboardPromise, timeoutPromise]);
    console.log('Clipboard text:', clipboardText?.substring(0, 50) + '…');
    if (clipboardText) {
      if (showHelp) {
        document.getElementById('help-text-header').textContent = 'Your clipboard';
      }

      currentText = clipboardText;
      updateWordPositions();
      render();
    }
  } catch (err) {
    console.error('Failed to read clipboard:', err);
    // Will fail if permission not granted or on timeout
  }
}

// ===== WORD POSITION CALCULATION =====
function updateWordPositions() {
  wordPositions = [];
  // Match all sequences of alphabetic characters (including Vietnamese)
  const regex = /[a-zA-ZÀ-ỹ]+/g;
  let match;

  while ((match = regex.exec(currentText)) !== null) {
    wordPositions.push({
      word: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  currentWordIndex = null;
  currentSelection = null;
}

// ===== SELECTION LOGIC =====
function updateSelection(direction) {
  if (wordPositions.length === 0 || !currentText) {
    currentSelection = null;
    return;
  }

  const wordPos = wordPositions[currentWordIndex];
  if (!wordPos) {
    currentSelection = null;
    return;
  }

  let match;
  let startIndex;

  if (direction === 'right') {
    match = findLongestMatchStartingWith(currentText, wordPos.startIndex);
    if (match) {
      startIndex = wordPos.startIndex;
    }
  } else if (direction === 'left') {
    match = findLongestMatchEndingWith(currentText, wordPos.endIndex);
    if (match) {
      // Search backwards to find where the match actually starts in the original text
      // We need to account for stripped punctuation
      const wordsInMatch = match.word.split(/\s+/);

      // Find the actual start by searching for the match pattern
      let searchPos = wordPos.endIndex;
      for (let i = wordsInMatch.length - 1; i >= 0; i--) {
        const word = wordsInMatch[i];
        // Search backwards for this word (case-insensitive)
        const searchText = currentText.substring(0, searchPos).toLowerCase();
        const wordIndex = searchText.lastIndexOf(word);
        if (wordIndex !== -1) {
          if (i === 0) {
            startIndex = wordIndex;
          }
          searchPos = wordIndex;
        }
      }
    }
  }

  if (match) {
    currentSelection = {
      word: match.word,
      definition: match.definition,
      startIndex: startIndex,
      endIndex: startIndex + match.word.length,
    };
  } else {
    const noMatches = findConsecutiveWordsWithNoMatch(currentWordIndex, direction);
    currentSelection = {
      word: noMatches.text,
      definition: null,
      startIndex: noMatches.startIndex,
      endIndex: noMatches.endIndex,
    };
  }
}

/**
 * Finds all consecutive words without dictionary entries, starting from the given word index.
 * Scans in the specified direction until hitting a word with a valid dictionary entry.
 *
 * @param {number} startWordIndex - Index in wordPositions array to start from
 * @param {string} direction - Either 'right' (forward) or 'left' (backward)
 * @returns {Object} Object containing:
 *   - text: The actual substring from currentText (preserving punctuation/spacing)
 *   - startIndex: Character position where the sequence starts
 *   - endIndex: Character position where the sequence ends
 */
function findConsecutiveWordsWithNoMatch(startWordIndex, direction) {
  let startIndex, endIndex;

  if (direction === 'right') {
    startIndex = wordPositions[startWordIndex].startIndex;
    for (let i = startWordIndex; i < wordPositions.length; i++) {
      const wordPos = wordPositions[i];

      // Stop at match
      if (findLongestMatchStartingWith(currentText, wordPos.startIndex)) {
        break;
      }

      endIndex = wordPos.endIndex;
    }
  } else if (direction === 'left') {
    endIndex = wordPositions[startWordIndex].endIndex;
    for (let i = startWordIndex; i >= 0; i--) {
      const wordPos = wordPositions[i];

      // Stop at match
      if (findLongestMatchEndingWith(currentText, wordPos.endIndex)) {
        break;
      }

      startIndex = wordPos.startIndex;
    }
  }

  return {
    text: currentText.substring(startIndex, endIndex),
    startIndex: startIndex,
    endIndex: endIndex,
  };
}

// ===== RENDERING =====
function render() {
  const textDisplay = document.getElementById('text-display');
  const tooltip = document.getElementById('tooltip');

  // Render text with highlight
  if (!currentText) {
    textDisplay.textContent = '';
    tooltip.classList.add('hidden');
    return;
  }

  if (currentSelection) {
    const before = currentText.substring(0, currentSelection.startIndex);
    const highlighted = currentText.substring(currentSelection.startIndex, currentSelection.endIndex);
    const after = currentText.substring(currentSelection.endIndex);

    textDisplay.innerHTML =
      escapeHtml(before) +
      '<span class="highlight">' + escapeHtml(highlighted) + '</span>' +
      escapeHtml(after);

    const englishDefinition = currentSelection.definition
      ? escapeHtml(currentSelection.definition)
      : '<em>no definition</em>';

    // Check for Chinese dictionary entry (exact match only)
    const chineseDefinition = chineseEnabled ? chineseDictionary.get(currentSelection.word.toLowerCase()) : null;

    tooltip.innerHTML =
      '<div class="word">' + escapeHtml(currentSelection.word) + '</div>' +
      '<div>' + englishDefinition + '</div>' +
      (chineseDefinition ? '<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border-color-light);">' +
        escapeHtml(chineseDefinition) + '</div>' : '');
    tooltip.classList.remove('hidden');

    // Position tooltip below the highlighted text
    requestAnimationFrame(() => {
      const highlightElement = textDisplay.querySelector('.highlight');
      if (highlightElement) {
        const highlightRect = highlightElement.getBoundingClientRect();
        const readerRect = document.getElementById('reader').getBoundingClientRect();

        // Position below the highlight, accounting for scroll position
        const reader = document.getElementById('reader');
        tooltip.style.top = (highlightRect.bottom - readerRect.top + reader.scrollTop + 5) + 'px';
      }
    });
  } else {
    textDisplay.textContent = currentText;
    tooltip.classList.add('hidden');
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Helper function to get text offset in the element
function getTextOffsetFromPoint(element, x, y) {
  let charIndex = 0;
  let clickedNode = null;
  let clickedOffset = 0;

  if (document.caretPositionFromPoint) {
    // Firefox
    const position = document.caretPositionFromPoint(x, y);
    if (position) {
      clickedNode = position.offsetNode;
      clickedOffset = position.offset;
    }
  } else if (document.caretRangeFromPoint) {
    // Chrome/Safari
    const range = document.caretRangeFromPoint(x, y);
    if (range) {
      clickedNode = range.startContainer;
      clickedOffset = range.startOffset;
    }
  }

  if (!clickedNode) return 0;

  // Walk the DOM tree and count characters until we reach the clicked node
  function walkTree(node) {
    if (node === clickedNode) {
      charIndex += clickedOffset;
      return true; // Found it
    }

    if (node.nodeType === Node.TEXT_NODE) {
      charIndex += node.textContent.length;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      for (let child of node.childNodes) {
        if (walkTree(child)) return true;
      }
    }

    return false;
  }

  walkTree(element);
  return charIndex;
}

// ===== EVENT HANDLERS =====
function handleTextClick(event) {
  if (!currentText) return;

  const textDisplay = document.getElementById('text-display');

  // If click is outside text-display, clear selection
  if (!textDisplay.contains(event.target) && event.target !== textDisplay) {
    currentSelection = null;
    currentWordIndex = null;
    render();
    return;
  }

  // Use browser API to find the exact character position from click coordinates
  const charIndex = getTextOffsetFromPoint(textDisplay, event.clientX, event.clientY);

  // Find word boundaries (alphabetic characters only)
  let wordStart = charIndex;
  while (wordStart > 0 && /[a-zA-ZÀ-ỹ]/.test(currentText[wordStart - 1])) {
    wordStart--;
  }

  let wordEnd = charIndex;
  while (wordEnd < currentText.length && /[a-zA-ZÀ-ỹ]/.test(currentText[wordEnd])) {
    wordEnd++;
  }

  // If no word was found (clicked on whitespace), clear selection
  if (wordStart === wordEnd) {
    currentSelection = null;
    currentWordIndex = null;
    render();
    return;
  }

  // Try both directions and pick the longest match
  const matchStarting = findLongestMatchStartingWith(currentText, wordStart);
  const matchEnding = findLongestMatchEndingWith(currentText, wordEnd);

  let match = null;
  let startIndex = wordStart;

  if (matchStarting && matchEnding) {
    // Pick whichever match is longer (more words)
    const startingWordCount = matchStarting.word.split(/\s+/).length;
    const endingWordCount = matchEnding.word.split(/\s+/).length;

    if (endingWordCount > startingWordCount) {
      match = matchEnding;
      startIndex = wordEnd - matchEnding.word.length;
    } else {
      match = matchStarting;
      startIndex = wordStart;
    }
  } else if (matchStarting) {
    match = matchStarting;
    startIndex = wordStart;
  } else if (matchEnding) {
    match = matchEnding;
    startIndex = wordEnd - matchEnding.word.length;
  }

  if (match) {
    currentSelection = {
      word: match.word,
      definition: match.definition,
      startIndex: startIndex,
      endIndex: startIndex + match.word.length,
    };

    // Update currentWordIndex to match this selection
    const matchingIndex = wordPositions.findIndex(wp => wp.startIndex === startIndex);
    if (matchingIndex !== -1) {
      currentWordIndex = matchingIndex;
    }
  } else {
    const clickedWordIndex = wordPositions.findIndex(wp => wp.startIndex === wordStart);
    if (clickedWordIndex !== -1) {
      currentWordIndex = clickedWordIndex;
      const noMatches = findConsecutiveWordsWithNoMatch(clickedWordIndex, 'right');
      currentSelection = {
        word: noMatches.text,
        definition: null,
        startIndex: noMatches.startIndex,
        endIndex: noMatches.endIndex,
      };
    } else {
      // Fallback to just the clicked word if not found in wordPositions
      const clickedWord = currentText.substring(wordStart, wordEnd);
      currentSelection = {
        word: clickedWord,
        definition: null,
        startIndex: wordStart,
        endIndex: wordEnd,
      };
    }
  }

  console.log(`Clicked on "${currentSelection.word}"`);
  render();
}

function handleResizeSelection(direction) {
  if (wordPositions.length === 0) return;

  // Initialize to first word if nothing selected
  if (currentWordIndex === null) {
    currentWordIndex = 0;
    updateSelection('right');
    render();
    return;
  }

  if (!currentSelection) return;

  let newStartIndex = currentSelection.startIndex;
  let newEndIndex = currentSelection.endIndex;

  if (direction === 'right') {
    // Increase by 1 word
    const nextWord = wordPositions.find(wp => wp.startIndex >= currentSelection.endIndex);
    if (nextWord) {
      newEndIndex = nextWord.endIndex;
    }
  } else if (direction === 'left') {
    // Decrease by 1 word
    const wordsInSelection = wordPositions.filter(
      wp => wp.startIndex >= currentSelection.startIndex && wp.endIndex <= currentSelection.endIndex
    );

    if (wordsInSelection.length > 1) {
      newEndIndex = wordsInSelection[wordsInSelection.length - 2].endIndex;
    }
  }

  const selectedText = currentText.substring(newStartIndex, newEndIndex);
  const phrase = selectedText.split(/[^a-zA-ZÀ-ỹ]+/).filter(w => w).join(' ').toLowerCase();
  const definition = englishDictionary.get(phrase);

  currentSelection = {
    word: phrase,
    definition: definition || null,
    startIndex: newStartIndex,
    endIndex: newEndIndex,
  };

  console.log(`Resized selection to "${phrase}" (${direction})`);
  render();
}

function handleNavigate(direction) {
  if (wordPositions.length === 0) return;

  // Initialize to first word if nothing selected
  let wasNull = false;
  if (currentWordIndex === null) {
    wasNull = true;
    currentWordIndex = 0;
  }

  const oldWordIndex = currentWordIndex;

  // Only navigate if we weren't starting from null
  if (!wasNull) {
    // Check if current selection is multi-word
    const isMultiWord = currentSelection && currentSelection.word.split(/\s+/).length > 1;

    if (!isMultiWord) {
      // Single word or no selection - use simple increment
      if (direction === 'right') {
        if (currentWordIndex < wordPositions.length - 1) {
          currentWordIndex = currentWordIndex + 1;
        }
      } else if (direction === 'left') {
        if (currentWordIndex > 0) {
          currentWordIndex = currentWordIndex - 1;
        }
      }
    } else {
      // Multi-word selection - skip to next word outside selection
      if (direction === 'right') {
        // Find first word that starts after current selection ends
        for (let i = currentWordIndex + 1; i < wordPositions.length; i++) {
          if (wordPositions[i].startIndex >= currentSelection.endIndex) {
            currentWordIndex = i;
            break;
          }
        }
      } else if (direction === 'left') {
        // Find last word that ends before current selection starts
        for (let i = currentWordIndex - 1; i >= 0; i--) {
          if (wordPositions[i].endIndex <= currentSelection.startIndex) {
            currentWordIndex = i;
            break;
          }
        }
      }
    }
  }

  updateSelection(direction);

  // After finding the selection, align currentWordIndex to the start of the matched phrase
  if (currentSelection) {
    const matchingIndex = wordPositions.findIndex(wp => wp.startIndex === currentSelection.startIndex);
    if (matchingIndex !== -1) {
      currentWordIndex = matchingIndex;
    }
  }

  console.log(`Navigating from ${oldWordIndex} to ${currentWordIndex}.`);
  render();
}

function handleKeyDown(event) {
  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    if (event.altKey) {
      handleResizeSelection('left');
    } else {
      handleNavigate('left');
    }
  } else if (event.key === 'ArrowRight') {
    event.preventDefault();
    if (event.altKey) {
      handleResizeSelection('right');
    } else {
      handleNavigate('right');
    }
  }
}

function handlePaste(event) {
  console.log('Pasting text…');
  const pastedText = event.clipboardData.getData('text');
  if (pastedText) {
    console.log('Pasted text: "', pastedText.substring(0, 50) + '"…');

    if (showHelp) {
      document.getElementById('help-text-header').textContent = 'Your clipboard';
    }

    currentText = pastedText;
    updateWordPositions();
    render();
    // Clear the input field
    event.target.value = '';
  }
}

function handleToggleChinese() {
  chineseEnabled = !chineseEnabled;
  updateToggleButton();
  render();
}

function updateToggleButton() {
  const button = document.getElementById('toggle-chinese');
  button.classList.toggle('inactive', !chineseEnabled);
}

function handleToggleHelp() {
  const tooltip = document.getElementById('tooltip');
  const helpContent = document.getElementById('help-content');
  const helpTextHeader = document.getElementById('help-text-header');
  const exampleText = 'Người ta tạo ra vận mệnh chứ không phải vận mệnh tạo ra con người.';

  // Toggle help
  showHelp = !showHelp;
  helpContent.classList.toggle('hidden');

  // Hide tooltip
  tooltip.classList.add('hidden');

  if (showHelp) {
    if (!currentText) {
      currentText = exampleText;
      updateWordPositions();
      render();
      helpTextHeader.textContent = 'Example';
    } else {
      helpTextHeader.textContent = 'Your clipboard';
    }
  } else {
    if (currentText === exampleText) {
      currentText = '';
      updateWordPositions();
      render();
    }
  }
}

// ===== INITIALIZATION =====
async function init() {
  console.log('Initializing app…');
  try {
    await loadDictionaries();
    console.log('Dictionaries loaded successfully.');

    // Set up event listeners
    console.log('Setting up event listeners…');
    document.getElementById('paste-input').addEventListener('paste', handlePaste);
    document.getElementById('load-button').addEventListener('click', readClipboard);
    document.getElementById('reader').addEventListener('click', handleTextClick);
    document.getElementById('nav-left').addEventListener('click', () => handleNavigate('left'));
    document.getElementById('nav-right').addEventListener('click', () => handleNavigate('right'));
    document.getElementById('nav-within-left').addEventListener('click', () => handleResizeSelection('left'));
    document.getElementById('nav-within-right').addEventListener('click', () => handleResizeSelection('right'));
    document.getElementById('toggle-chinese').addEventListener('click', handleToggleChinese);
    document.getElementById('help-button').addEventListener('click', handleToggleHelp);
    window.addEventListener('keydown', handleKeyDown);
    console.log('Event listeners set up.');

    // Set initial toggle button state
    updateToggleButton();

    // Show app, hide loading
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    console.log('App initialized successfully.');
  } catch (err) {
    console.error('Initialization error:', err);
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('error').textContent = 'Error: ' + err.message;
    document.getElementById('error').classList.remove('hidden');
  }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
