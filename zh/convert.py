#!/usr/bin/env python3
"""
Convert vi2zhwikitxt.txt to vi2zhdict.txt format.

Input format: vietnamese\tchinese_chars\tdefinition
Output format: vietnamese : definition
"""

import re
import sys


def parse_line(line):
    """
    Parse a tab-separated line into components.

    Returns: (vietnamese_term, chinese_chars, definition) or None if invalid
    """
    parts = line.split('\t')
    if len(parts) < 3:
        return None

    vietnamese = parts[0].strip()
    chinese_chars = parts[1].strip()
    definition = parts[2].strip()

    if not vietnamese or not definition:
        return None

    return vietnamese, chinese_chars, definition


def clean_definition(text):
    """
    Clean HTML and wiki markup from definition text.

    Returns: cleaned definition string
    """
    if not text:
        return ""

    # Remove [Category:...] and [分類:...] patterns (including malformed ones with ]])
    text = re.sub(r'\[Category:[^\]]*\]+', '', text)
    text = re.sub(r'\[分類:[^\]]*\]+', '', text)

    # Remove [hy:漢字], 词类:, 词源: patterns and similar
    text = re.sub(r'\[hy:漢字\]', '', text)
    text = re.sub(r'词类:\s*[^\n<;]*', '', text)
    text = re.sub(r'词源:\s*[^\n]*', '', text)

    # Remove literal "字:" and "漢字:" patterns
    text = re.sub(r'字:\s*', '', text)
    text = re.sub(r'漢字:\s*', '', text)
    text = re.sub(r'字喃:\s*', '', text)

    # Extract text from [[...]] wiki links (keep inner text)
    text = re.sub(r'\[\[([^\]]+)\]\]', r'\1', text)

    # Remove :: prefix markers
    text = re.sub(r'::', '', text)

    # Split on <br />, <br>, or <br/> tags FIRST before other cleanup
    items = re.split(r'<br\s*/?>', text, flags=re.IGNORECASE)

    # Clean each item
    cleaned_items = []
    for item in items:
        item = item.strip()

        # Remove numbering (1. , 2. , etc.)
        item = re.sub(r'^\d+\.\s*', '', item)

        # Remove />n. patterns (malformed HTML/numbering)
        item = re.sub(r'/>\s*\d+\.\s*', '', item)

        # Remove standalone />
        item = re.sub(r'/>\s*', '', item)

        # Remove literal "br />" and standalone "br" text (in case it appears in content)
        item = item.replace('br />', '')
        # Only remove "br" if it's standalone (not part of a word)
        if item.strip() == 'br':
            item = ''

        # Remove standalone square brackets
        item = re.sub(r'^\]\s*', '', item)
        item = re.sub(r'\s*\]$', '', item)

        # Remove any remaining standalone brackets in the middle
        item = item.replace(']', '')

        # Remove leading/trailing punctuation artifacts
        item = item.strip()

        # Skip empty items, "---", and other meaningless entries
        if not item or item == '---' or item == '-':
            continue

        cleaned_items.append(item)

    # Join items with semicolons
    result = '; '.join(cleaned_items)

    # Normalize whitespace (multiple spaces to single space)
    result = re.sub(r'\s+', ' ', result)

    # Remove multiple semicolons
    result = re.sub(r';\s*;+', ';', result)

    # Final cleanup: remove any remaining problematic patterns
    result = result.strip()
    result = result.strip(';').strip()

    return result


def main():
    """Main conversion function."""
    input_file = 'vi2zhwikitxt.txt'
    output_file = 'dict.txt'

    print(f"Converting {input_file} to {output_file}...")

    total_lines = 0
    converted_lines = 0
    skipped_lines = 0

    try:
        with open(input_file, 'r', encoding='utf-8') as infile, \
             open(output_file, 'w', encoding='utf-8') as outfile:

            for line_num, line in enumerate(infile, 1):
                total_lines += 1

                # Skip empty lines
                if not line.strip():
                    skipped_lines += 1
                    continue

                # Parse the line
                parsed = parse_line(line)
                if not parsed:
                    skipped_lines += 1
                    continue

                vietnamese, chinese_chars, definition = parsed

                # Clean the definition
                cleaned_def = clean_definition(definition)

                # Skip if cleaned definition is empty
                if not cleaned_def:
                    skipped_lines += 1
                    continue

                # Write output in vnedict.txt format
                outfile.write(f"{vietnamese} : {cleaned_def}\n")
                converted_lines += 1

        # Print statistics
        print(f"\nConversion complete!")
        print(f"Total lines processed: {total_lines}")
        print(f"Successfully converted: {converted_lines}")
        print(f"Skipped (empty/invalid): {skipped_lines}")
        print(f"\nOutput written to: {output_file}")

    except FileNotFoundError:
        print(f"Error: Could not find input file '{input_file}'", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error during conversion: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
