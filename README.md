# Chord Transposer

A lightweight, dependency-free JavaScript plugin for transposing standard chord sheets and ChordPro songs directly in the browser.

Chord Transposer detects the source key, determines whether the song uses a major or minor key, generates the appropriate transpose buttons, and always transposes from the original source text.

## Live Demo

https://obicreo.github.io/chord-transposer/

## Features

- No external dependencies
- Standard chord-over-lyrics text support
- ChordPro support
- Automatic format and source-key detection
- Graceful disabled mode when no source key can be detected
- Major and minor key-button generation
- Extended and jazz chord support
- Slash chords such as `D/F#`
- Alternative chord tokens such as `A/Asus4`
- Numeric slash extensions such as `G6/9`
- Backslash escaping for literal chord-like text
- TAB-line detection that avoids treating tablature as chord lines
- Section directives such as `{start_of_verse: Verse 1}` and `{end_of_verse}`
- Automatic section markup for both standard text and ChordPro display output
- Configurable chord markup tag and class
- Plain-text output mode
- Original-key marker
- Optional previous/next semitone controls
- Initial target-key support
- ChordPro rendered as a readable chord sheet by default
- No cumulative transposition errors

## Project Structure

```text
index.html
demo-standard.html
demo-chordpro.html
styles.css
transpose-core.js
README.md
LICENSE
```

- `index.html` — demo selection page
- `demo-standard.html` — standard text integration example
- `demo-chordpro.html` — ChordPro integration example
- `styles.css` — shared demo styles
- `transpose-core.js` — transposition engine and browser API

## Quick Start

```html
<div id="transposeButtons"></div>

<pre id="song" data-key="G">
Gmaj7                    D/F#
I was walking down a midnight road
Em7                      Cadd9
With an old guitar and a heavy load
</pre>

<script src="transpose-core.js"></script>
<script>
  ChordTransposer.mount({
    songElementId: "song",
    transposeButtonsElementId: "transposeButtons"
  });
</script>
```

The plugin automatically:

- Reads or detects the source key
- Detects whether the song is major or minor
- Generates the appropriate target-key buttons
- Handles button clicks
- Always transposes from the original song
- Updates the active button
- Marks the original key
- Wraps detected chords with configurable HTML markup

## Standard Text Example

```html
<div id="transposeButtons"></div>

<pre id="song">
title: Midnight Road
artist: Alex Carter
key: G

{start_of_verse: Verse 1}
Gmaj7                    D/F#
I was walking down a midnight road
Em7                      Cadd9
With an old guitar and a heavy load
{end_of_verse}
</pre>

<script src="transpose-core.js"></script>
<script>
  ChordTransposer.mount({
    songElementId: "song",
    transposeButtonsElementId: "transposeButtons"
  });
</script>
```

## ChordPro Example

```html
<div id="transposeButtons"></div>

<pre id="song">
{title: Midnight Road}
{artist: Alex Carter}
{key: G}

{start_of_verse: Verse 1}
[Gmaj7]I was walking down a mi[D/F#]dnight road
[Em7]With an old guitar and a heav[Cadd9]y load
{end_of_verse}
</pre>

<script src="transpose-core.js"></script>
<script>
  ChordTransposer.mount({
    songElementId: "song",
    transposeButtonsElementId: "transposeButtons"
  });
</script>
```

Mounted ChordPro content is displayed as a readable chord sheet by default. To keep the raw ChordPro structure visible:

```js
ChordTransposer.mount({
  songElementId: "song",
  transposeButtonsElementId: "transposeButtons",
  showChordProAsText: false
});
```

## Sections

Section directives are recognized in both standard text and ChordPro input:

```text
{start_of_verse: Verse 1}
G            D
Song content
{end_of_verse}
```

When mounted, the section is rendered with semantic wrapper classes derived from the section name. For example, `verse` sections produce a section wrapper and a `verse-title` title element.

Section rendering is enabled by default and does not require a separate mount option.


## Source-Key Detection

The source key is resolved in this order:

1. `sourceKey`
2. The song element's `data-key` attribute
3. A standard metadata line such as `key: Am`
4. A ChordPro directive such as `{key: Am}`
5. The first valid chord found in the song

For predictable results, provide `sourceKey`, `data-key`, or a key metadata line.

Detected enharmonic keys are normalized to the plugin's supported 12-key button set. For example, a detected `G#` major source key is represented as `Ab` for key selection while the original chord spelling is preserved when no transposition is applied.

## Configuration

```js
const transposer = ChordTransposer.mount({
  songElementId: "song",
  transposeButtonsElementId: "transposeButtons",
  transposeDownElementId: "transposeDown",
  transposeUpElementId: "transposeUp",
  sourceKey: "G",
  targetKey: "A",
  format: "text",
  enabled: true,
  wrapChords: true,
  chordTag: "span",
  chordClass: "chord",
  showChordProAsText: true,
  showOriginalMark: true,
  buttonClass: "key-button",
  activeClass: "active",
  originalClass: "original",
  onChange(result) {
    console.log(result.targetKey);
  }
});
```

### Mount Options

| Option | Type | Default | Description |
|---|---|---|---|
| `songElementId` | `string` | — | ID of the song element |
| `transposeButtonsElementId` | `string` | — | ID of the key-button container |
| `songElement` | `HTMLElement` | — | Song element instead of an ID |
| `transposeButtonsElement` | `HTMLElement` | — | Button container instead of an ID |
| `transposeDownElementId` | `string` | — | Optional previous-semitone button ID |
| `transposeUpElementId` | `string` | — | Optional next-semitone button ID |
| `sourceText` | `string` | element text | Source song text |
| `sourceKey` | `string` | detected | Explicit source key |
| `targetKey` | `string` | source key | Initial target key |
| `format` | `"text"` or `"chordpro"` | detected | Explicit input format |
| `enabled` | `boolean` | `true` | Enable or disable transposition behavior |
| `wrapChords` | `boolean` | `true` | Enable or disable HTML markup around detected chords |
| `chordTag` | `string` | `"span"` | HTML tag used to wrap detected chords |
| `chordClass` | `string` | — | Optional CSS class applied to wrapped chords |
| `showChordProAsText` | `boolean` | `true` | Render ChordPro as a readable chord sheet |
| `showOriginalMark` | `boolean` | `true` | Mark the original-key button |
| `buttonClass` | `string` | `"key-button"` | Generated button class |
| `activeClass` | `string` | `"active"` | Selected button class |
| `originalClass` | `string` | `"original"` | Original-key button class |
| `onChange` | `function` | — | Runs after a successful key change |

## Disabled Mode

Transposition can be disabled explicitly:

```js
ChordTransposer.mount({
  songElementId: "song",
  transposeButtonsElementId: "transposeButtons",
  enabled: false
});
```

The plugin also fails gracefully when a usable source key cannot be detected. Instead of throwing during normal mounting, it returns a passive controller and leaves the song content usable.

## Returned Controller

```js
const transposer = ChordTransposer.mount({
  songElementId: "song",
  transposeButtonsElementId: "transposeButtons"
});

transposer.selectKey("C");
transposer.reset();
transposer.destroy();

console.log(transposer.sourceKey);
console.log(transposer.targetKey);
console.log(transposer.format);
console.log(transposer.keys);
```

The controller exposes:

- `songElement`
- `buttonsElement`
- `sourceKey`
- `targetKey`
- `format`
- `keys`
- `showOriginalMark`
- `selectKey(key)`
- `reset()`
- `destroy()`

## Initial Target Key and URL Hash

`targetKey` can be used to open a song directly in a selected key. A common browser integration is to store the selected key in the URL hash:

```js
const targetKey = window.location.hash.slice(1);

ChordTransposer.mount({
  songElementId: "song",
  transposeButtonsElementId: "transposeButtons",
  targetKey: targetKey || undefined,
  onChange(result) {
    history.replaceState(null, "", `#${result.targetKey}`);
  }
});
```

Opening a URL ending in `#Em`, for example, initializes the mounted song in `Em` when that target key is valid.

## Plain-Text Output

```js
ChordTransposer.mount({
  songElementId: "song",
  transposeButtonsElementId: "transposeButtons",
  wrapChords: false
});
```

Direct API usage:

```js
const result = ChordTransposer.transposeText(songText, {
  sourceKey: "G",
  targetKey: "A",
  format: "text",
  wrapChords: false
});

console.log(result.rawText);
```

## Direct Element Transposition

```js
const result = ChordTransposer.transposeElement(
  document.getElementById("song"),
  { targetKey: "A" }
);
```

Prevent writing back to the element:

```js
const result = ChordTransposer.transposeElement(
  document.getElementById("song"),
  {
    targetKey: "A",
    write: false
  }
);
```

## Result Object

`transposeText()` and `transposeElement()` return:

```js
{
  text,
  rawText,
  sourceKey,
  targetKey,
  semitones,
  format,
  wrapChords,
  isHtml
}
```

Mounted results also include `displayText` and `displayFormat`.

## Styling

```css
.chord {
  color: #36b9f5;
  font-weight: 800;
}

.key-button {
  border: 2px solid #36b9f5;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.key-button.active {
  background: #36b9f5;
  color: #07151d;
}

.key-button.original::after {
  content: " •";
}
```

Disable the original-key marker:

```js
ChordTransposer.mount({
  songElementId: "song",
  transposeButtonsElementId: "transposeButtons",
  showOriginalMark: false
});
```

## Escaping Literal Chord-Like Text

Use a backslash to escape the next character when text should remain literal instead of being parsed as chord syntax.

For example:

```text
\[A]
```

The escape marker is preserved internally while parsing and removed in the final rendered output.

## Tablature Detection

TAB lines are excluded from normal chord-line parsing. Typical lines such as:

```text
e------------------------------
B------------------------------
G------------2-----------------
D-------2-3----3-2-0-2---------
A----0-------------------------
E------------------------------
```

remain tablature instead of being wrapped or transposed as chord text. Trailing annotations on TAB lines are also tolerated.

## Supported Chord Examples

```text
C
Cm
C7
Cmaj7
CmMaj7
CminMaj9
Cmaj7(#11)
C13(b9,#11)
C7(#9#5)
C7(b9b13)
C7alt
C7sus4
C13(sus4)
Cadd9
C7(no3)
C7(omit5)
Cdim7
Caug7
CΔ7
Cø7
C°7
C6/9
D13(b9)/F#
A/Asus4
```

The parser also recognizes separator tokens such as `|`, `:`, `%`, `N.C.`, `-`, `–`, and `—`.

## Public API

```js
ChordTransposer.MAJOR_KEYS;
ChordTransposer.MINOR_KEYS;

ChordTransposer.normalizeText(text);
ChordTransposer.normalizeKeyName(key);
ChordTransposer.parseChordToken(chord);
ChordTransposer.isMinorKey(key);
ChordTransposer.isLikelyChordToken(token);
ChordTransposer.isSectionHeaderToken(value);
ChordTransposer.isChordLine(line);

ChordTransposer.detectKeyFromMetadata(text);
ChordTransposer.detectKeyFromFirstChord(text);
ChordTransposer.detectKey(text, options);
ChordTransposer.detectKeyFromElement(element, options);
ChordTransposer.detectFormat(text);

ChordTransposer.escapeHtml(value);
ChordTransposer.wrapChordMarkup(text, format);
ChordTransposer.wrapSongMarkup(text, format, options);
ChordTransposer.parseChordProAnchors(line);
ChordTransposer.rebuildChordProLine(lyricCharacters, anchors, semitones, targetKey);
ChordTransposer.renderChordProChordLine(anchors);
ChordTransposer.chordProToDisplayText(text);
ChordTransposer.transposeChordToken(chord, semitones, targetKey);
ChordTransposer.transposeText(text, options);
ChordTransposer.transposeElement(element, options);
ChordTransposer.mount(options);
```

## Browser Support

Chord Transposer targets modern browsers with support for:

- ES6 syntax
- `Map`
- Optional chaining
- Nullish coalescing
- Unicode regular expressions
- `String.prototype.replaceAll()`

## Demos

Open `index.html` to choose between:

- Standard Text Demo
- ChordPro Demo

## License

Licensed under the MIT License.

Copyright © 2026 ObiCreo
