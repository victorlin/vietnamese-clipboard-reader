# Vietnamese-Chinese Dictionary Converter

This directory contains a conversion script to transform the Vietnamese-Chinese Wiktionary data into a format compatible with the clipboard reader app.

## Files

- `convert.py` - Conversion script
- `vi2zhwikitxt.txt` - Source data (Vietnamese-Chinese from Wiktionary)
- `vi2zhdict.txt` - Output dictionary (ready for app use)

## Usage

```bash
python3 convert.py
```

## What the Script Does

The script converts tab-separated Wiktionary data into the app's dictionary format:

**Input format** (vi2zhwikitxt.txt):
```
vietnamese_term\tchinese_characters\tdefinition_with_markup
```

**Output format** (vi2zhdict.txt):
```
vietnamese_term : cleaned_chinese_definition
```

### Cleaning Operations

The script performs comprehensive cleanup of the source data:

1. **HTML/Wiki Markup Removal**
   - Splits on `<br />`, `<br>`, `<br/>` tags
   - Extracts text from `[[...]]` wiki links
   - Removes `[Category:...]` and `[分類:...]` tags
   - Removes `[hy:漢字]` annotations
   - Strips `词类:`, `词源:` labels
   - Removes `字:`, `漢字:`, `字喃:` prefixes

2. **Formatting**
   - Removes numbered list markers (`1. `, `2. `, etc.)
   - Joins multiple definitions with semicolons (`;`)
   - Normalizes whitespace
   - Removes empty/meaningless entries (`---`, etc.)

3. **Vietnamese Terms**
   - Preserves multi-word phrases (e.g., "học tập", "bắt đầu")
   - Converts to lowercase for dictionary lookup
   - Maintains original spacing and diacritics

## Results

- **25,956 entries** successfully converted
- **0 parsing errors** - all entries compatible with app
- Format matches `vnedict.txt` structure for seamless integration

## Example Conversions

```
du : 游玩; 榆树; 故乡; 边塞
học tập : 學習
bắt đầu : 开始，起始，開頭; ''đứa trẻ bắt đầu tập nói'' 孩子开始学说话
chính trị : 政治
```

## Integration

To use the Vietnamese-Chinese dictionary in the app, update `app.js:10` to load `vi2zhdict.txt` instead of `vnedict.txt`:

```javascript
const response = await fetch('vi2zh/vi2zhdict.txt');
```
