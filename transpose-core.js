/*!
 * Chord Transposer Core v1.0.1
 * https://github.com/obicreo/chord-transposer
 *
 * Copyright 2026 ObiCreo
 * Licensed under the MIT License.
 */

"use strict";

(function (global) {
  const MAJOR_KEYS = [
    "C", "G", "D", "A",
    "E", "B", "F", "Bb",
    "Eb", "Ab", "Db", "Gb"
  ];

  const MINOR_KEYS = [
    "Am", "Em", "Bm", "F#m",
    "C#m", "G#m", "Dm", "Gm",
    "Cm", "Fm", "Bbm", "Ebm"
  ];

  const NOTE_TO_PITCH = new Map([
    ["C", 0], ["B#", 0],
    ["C#", 1], ["Db", 1],
    ["D", 2],
    ["D#", 3], ["Eb", 3],
    ["E", 4], ["Fb", 4],
    ["E#", 5], ["F", 5],
    ["F#", 6], ["Gb", 6],
    ["G", 7],
    ["G#", 8], ["Ab", 8],
    ["A", 9],
    ["A#", 10], ["Bb", 10],
    ["B", 11], ["Cb", 11]
  ]);

  const SHARP_NOTES = [
    "C", "C#", "D", "D#", "E", "F",
    "F#", "G", "G#", "A", "A#", "B"
  ];

  const FLAT_NOTES = [
    "C", "Db", "D", "Eb", "E", "F",
    "Gb", "G", "Ab", "A", "Bb", "B"
  ];

  const FLAT_KEY_NAMES = new Set([
    "F", "Bb", "Eb", "Ab", "Db", "Gb",
    "Dm", "Gm", "Cm", "Fm", "Bbm", "Ebm"
  ]);

  const SEPARATOR_TOKEN_REGEX =
    /^(?:N\.?C\.?|[|:%()\-–—]+)$/iu;

  const ESCAPED_CHARACTER_PREFIX = "\uE000";

  function preserveEscapedCharacters(value) {
    const text = String(value ?? "");
    let result = "";

    for (let i = 0; i < text.length; i += 1) {
      if (text[i] === "\\" && i + 1 < text.length) {
        result += `${ESCAPED_CHARACTER_PREFIX}${text[i + 1]}`;
        i += 1;
        continue;
      }

      result += text[i];
    }

    return result;
  }

  function restoreEscapedCharacters(value) {
    return String(value ?? "").replace(new RegExp(`${ESCAPED_CHARACTER_PREFIX}(.)`, "gu"), "$1");
  }


  /*
   * These are the textual parts commonly used in chord symbols.
   * Numbers, accidentals and punctuation are checked separately.
   */
  const CHORD_WORDS = [
    "major",
    "minor",
    "minmaj",
    "majmin",
    "mmaj",
    "maj",
    "min",
    "dim",
    "aug",
    "sus",
    "add",
    "omit",
    "alt",
    "dom",
    "power",
    "no",
    "mi",
    "m",
    "M"
  ].sort((a, b) => b.length - a.length);

  function normalizeText(text) {
    return String(text ?? "")
      .replace(/\u00a0/g, " ")
      .replace(/\t/g, "    ")
      .replace(/\r\n?/g, "\n");
  }

  function isEscapedAt(text, index) {
    let backslashes = 0;

    for (let i = index - 1; i >= 0 && text[i] === "\\"; i -= 1) {
      backslashes += 1;
    }

    return backslashes % 2 === 1;
  }

  function stripEscapeCharacters(value) {
    const text = String(value ?? "");
    let result = "";

    for (let i = 0; i < text.length; i += 1) {
      if (text[i] === "\\" && i + 1 < text.length) {
        result += text[i + 1];
        i += 1;
        continue;
      }

      result += text[i];
    }

    return result;
  }

  function hasEscapedChordStart(value) {
    const text = String(value ?? "");

    for (let i = 0; i < text.length - 1; i += 1) {
      if (text[i] === "\\" && /[A-Ga-g]/u.test(text[i + 1])) return true;

      if (text[i] === "\\") {
        i += 1;
      }
    }

    return false;
  }

  function normalizeAccidentals(value) {
    return String(value ?? "")
      .replace(/♯/g, "#")
      .replace(/♭/g, "b");
  }

  function normalizeNoteName(value) {
    const normalized = normalizeAccidentals(value).trim();
    const match = normalized.match(/^([A-Ga-g])([#b]?)$/u);

    if (!match) return null;

    return `${match[1].toUpperCase()}${match[2]}`;
  }

  function normalizeKeyName(value) {
    if (!value) return null;

    const cleaned = normalizeAccidentals(value)
      .trim()
      .replace(/\s+/g, "");

    const match = cleaned.match(
      /^([A-G](?:#|b)?)(m|min|minor)?$/i
    );

    if (!match) return null;

    const root = normalizeNoteName(match[1]);
    if (!root) return null;

    return `${root}${match[2] ? "m" : ""}`;
  }

  function keyRoot(key) {
    return key?.replace(/m$/, "") ?? null;
  }

  function isMinorKey(key) {
    return Boolean(key?.endsWith("m"));
  }

  function pitchForRoot(root) {
    return NOTE_TO_PITCH.get(normalizeNoteName(root));
  }

  function resolveSupportedKey(key) {
    const normalized = normalizeKeyName(key);
    if (!normalized) return null;

    const keys = isMinorKey(normalized) ? MINOR_KEYS : MAJOR_KEYS;
    if (keys.includes(normalized)) return normalized;

    const pitch = pitchForRoot(keyRoot(normalized));
    if (pitch === undefined) return null;

    return keys.find((candidate) => pitchForRoot(keyRoot(candidate)) === pitch) ?? null;
  }

  function hasBalancedParentheses(value) {
    let depth = 0;

    for (const character of value) {
      if (character === "(") {
        depth += 1;
      } else if (character === ")") {
        depth -= 1;

        if (depth < 0) {
          return false;
        }
      }
    }

    return depth === 0;
  }

  function isValidChordDescriptor(descriptor) {
    if (!descriptor) return true;

    if (
      /\s/u.test(descriptor) ||
      /[\[\]{}<>="'`\\]/u.test(descriptor) ||
      !hasBalancedParentheses(descriptor)
    ) {
      return false;
    }

    const lower = descriptor.toLowerCase();
    let index = 0;

    while (index < descriptor.length) {
      const character = descriptor[index];
      const lowerCharacter = lower[index];

      if (/[0-9#b+\-/,().Δø°]/u.test(character)) {
        index += 1;
        continue;
      }

      if (/[a-z]/u.test(lowerCharacter)) {
        const matchedWord = CHORD_WORDS.find((word) =>
          lower.startsWith(word.toLowerCase(), index)
        );

        if (!matchedWord) {
          return false;
        }

        index += matchedWord.length;
        continue;
      }

      return false;
    }

    return true;
  }

  function parseChordToken(token) {
    const original = String(token ?? "").trim();

    if (!original) {
      return null;
    }

    const normalized = normalizeAccidentals(original);

    if (SEPARATOR_TOKEN_REGEX.test(normalized)) {
      return {
        type: "separator",
        original,
        normalized
      };
    }

    const alternativeMatch = normalized.match(/^(.+)\/([A-Ga-g](?:#|b)?.+)$/u);

    if (alternativeMatch) {
      const left = parseChordToken(alternativeMatch[1]);
      const right = parseChordToken(alternativeMatch[2]);

      if (left?.type === "chord" && right?.type === "chord") {
        return {
          type: "chordAlternative",
          original,
          normalized,
          left,
          right
        };
      }
    }

    const rootMatch = normalized.match(
      /^([A-Ga-g](?:#|b)?)(.*)$/u
    );

    if (!rootMatch) {
      return null;
    }

    const root = normalizeNoteName(rootMatch[1]);
    if (!root) return null;

    let descriptor = rootMatch[2];
    let bass = null;

    /*
     * A final slash followed by a note is a bass note.
     * Numeric slash notation such as G6/9 stays in descriptor.
     */
    const bassMatch = descriptor.match(
      /\/([A-Ga-g](?:#|b)?)$/u
    );

    if (bassMatch) {
      bass = normalizeNoteName(bassMatch[1]);
      descriptor = descriptor.slice(
        0,
        descriptor.length - bassMatch[0].length
      );
    }

    if (!isValidChordDescriptor(descriptor)) {
      return null;
    }

    return {
      type: "chord",
      original,
      normalized,
      root,
      descriptor,
      bass
    };
  }

  function isLikelyChordToken(token) {
    return parseChordToken(token) !== null;
  }

  function isSectionHeaderToken(value) {
    const normalized = String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ");

    return /^(?:intro|outro|verse(?:\s+\d+|\s+[a-z])?|chorus(?:\s+\d+)?|refrain(?:\s+\d+)?|pre chorus|bridge(?:\s+\d+)?|solo|instrumental|interlude|tag|coda|section(?:\s+\d+)?)$/u.test(
      normalized
    );
  }

  function parseSectionDirective(line) {
    const match = String(line ?? "").match(/^\s*\{\s*(start_of|end_of)_([a-z0-9_]+)(?:\s*:\s*(.*?))?\s*\}\s*$/iu);
    if (!match) return null;

    return {
      action: match[1].toLowerCase() === "start_of" ? "start" : "end",
      name: match[2].toLowerCase(),
      title: match[3]?.trim() ?? ""
    };
  }

  function resolveOptionValue(option, fallback, section) {
    const value = typeof option === "function" ? option(section) : option;
    return value === undefined ? fallback : value;
  }

  function normalizeTagName(value, fallback) {
    const tag = String(value ?? "");
    return /^[a-z][a-z0-9-]*$/iu.test(tag) ? tag : fallback;
  }

  function sectionClassAttribute(value) {
    return value ? ` class="${escapeHtml(value)}"` : "";
  }

  function isTabLine(line) {
    const value = String(line ?? "").trim();
    const match = value.match(/^([EADGBe](?:\|)?[-0-9hHpPbBrRsSxX~/\\().]+)(?:\s+.*)?$/u);
    if (!match) return false;
    return match[1].includes("-");
  }

  function tokenizeChordLine(line) {
    return String(line ?? "")
      .trim()
      .split(/\s+/u)
      .filter(Boolean);
  }

  function parseInlineChordToken(token) {
    const original = String(token ?? "");
    if (!original) return null;
    if (hasEscapedChordStart(original)) return null;
    if (original.includes(ESCAPED_CHARACTER_PREFIX)) return null;

    const match = original.match(/^([("'[{]*)(.*?)([.,;!?:"')\]}]*)$/u);
    if (!match) return null;

    const prefix = match[1];
    const value = match[2];
    const suffix = match[3];

    if (!value || /^[a-g]/u.test(value)) return null;

    const parsed = parseChordToken(value);

    if (parsed?.type === "chord" || parsed?.type === "chordAlternative") {
      return {
        ...parsed,
        original,
        chord: value,
        prefix,
        suffix
      };
    }

    if (/^(?:x\d+|\d+x|×\d+)$/iu.test(value)) {
      return {
        type: "repeat",
        original,
        value,
        prefix,
        suffix
      };
    }

    if (parsed?.type === "separator") {
      return {
        ...parsed,
        original,
        value,
        prefix,
        suffix
      };
    }

    return null;
  }

  function isStrongChordToken(parsed) {
    if (!parsed) return false;
    if (parsed.type === "chordAlternative") return true;
    if (parsed.type !== "chord") return false;

    return (
      parsed.root.length > 1 ||
      Boolean(parsed.descriptor) ||
      Boolean(parsed.bass)
    );
  }

  function analyzeInlineChordLine(line) {
    if (isTabLine(line)) {
      return {
        tokens: [],
        chordCount: 0,
        strongChordCount: 0,
        musicalMarkerCount: 0,
        hasChordLayout: false,
        hasMusicalContext: false
      };
    }

    const source = String(line ?? "");
    const tokens = [];
    const regex = /\S+/gu;
    let match;
    let chordCount = 0;
    let strongChordCount = 0;
    let musicalMarkerCount = 0;
    const chordTokens = [];

    while ((match = regex.exec(source)) !== null) {
      const parsed = parseInlineChordToken(match[0]);

      if (parsed?.type === "chord" || parsed?.type === "chordAlternative") {
        chordCount += 1;
        if (isStrongChordToken(parsed)) strongChordCount += 1;

        chordTokens.push({
          start: match.index,
          end: match.index + match[0].length
        });
      } else if (parsed?.type === "repeat" || parsed?.type === "separator") {
        musicalMarkerCount += 1;
      }

      tokens.push({
        token: match[0],
        start: match.index,
        parsed
      });
    }

    let hasChordLayout = false;

    for (let i = 1; i < chordTokens.length; i += 1) {
      const previous = chordTokens[i - 1];
      const current = chordTokens[i];
      const gap = source.slice(previous.end, current.start);

      if (/ {2,}/u.test(gap)) {
        hasChordLayout = true;
        break;
      }
    }

    return {
      tokens,
      chordCount,
      strongChordCount,
      musicalMarkerCount,
      hasChordLayout,
      hasMusicalContext:
        strongChordCount > 0 ||
        musicalMarkerCount > 0 ||
        hasChordLayout
    };
  }

  function splitSectionPrefix(line) {
    const match = String(line ?? "").match(/^(\s*[^:]+:\s*)(.+)$/u);
    if (!match) return null;

    const label = match[1].replace(/:\s*$/u, "").trim();
    if (!isSectionHeaderToken(label)) return null;

    return {
      prefix: match[1],
      content: match[2]
    };
  }

  function isChordLine(line) {
    if (isTabLine(line)) return false;
    const section = splitSectionPrefix(line);
    const tokens = tokenizeChordLine(section ? section.content : line);

    if (!tokens.length) return false;

    let chordCount = 0;

    for (const token of tokens) {
      const parsed = parseChordToken(token);
      if (!parsed) return false;
      if (parsed.type === "chord" || parsed.type === "chordAlternative") chordCount += 1;
    }

    return chordCount > 0;
  }

  function keyFromChordToken(token) {
    const parsed = parseChordToken(token);

    if (!parsed) return null;

    if (parsed.type === "chordAlternative") {
      return keyFromChordToken(parsed.left.original);
    }

    if (parsed.type !== "chord") return null;

    /*
     * Determine minor quality from the beginning of descriptor.
     * maj, major and M remain major.
     */
    const descriptor = parsed.descriptor;

    const isMinor =
      /^(?:m(?!aj)|min|minor|mi)/u.test(descriptor) ||
      /^[ø°]/u.test(descriptor);

    return `${parsed.root}${isMinor ? "m" : ""}`;
  }

  function detectKeyFromMetadata(text) {
    const normalized = normalizeText(text);

    const patterns = [
      /^\s*key\s*:\s*([A-G](?:#|b|♯|♭)?(?:m|min|minor)?)\s*$/imu,
      /^\s*\{\s*key\s*:\s*([A-G](?:#|b|♯|♭)?(?:m|min|minor)?)\s*\}\s*$/imu,
      /(?:^|\.\s*)Key\s*:\s*([A-G](?:#|b|♯|♭)?(?:m|min|minor)?)(?=\.|$)/imu
    ];

    for (const pattern of patterns) {
      const match = normalized.match(pattern);
      const key = normalizeKeyName(match?.[1]);

      if (key) return key;
    }

    return null;
  }

  function detectKeyFromFirstChord(text) {
    const normalized = normalizeText(text);
    const bracketRegex = /\[([^\]]+)\]/gu;
    let bracketMatch;

    while ((bracketMatch = bracketRegex.exec(normalized)) !== null) {
      if (isEscapedAt(normalized, bracketMatch.index)) continue;

      const content = bracketMatch[1].trim();

      if (!content || isSectionHeaderToken(content)) continue;

      const key = keyFromChordToken(content);
      if (key) return key;
    }

    for (const line of normalized.split("\n")) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#") || isTabLine(line)) continue;

      const analysis = analyzeInlineChordLine(line);
      const fullChordLine = isChordLine(line);

      for (const item of analysis.tokens) {
        const parsed = item.parsed;

        if (parsed?.type !== "chord" && parsed?.type !== "chordAlternative") continue;

        const shouldDetect =
          fullChordLine ||
          isStrongChordToken(parsed) ||
          analysis.hasMusicalContext;

        if (!shouldDetect) continue;

        const key = keyFromChordToken(parsed.chord);
        if (key) return key;
      }
    }

    return null;
  }

  function detectKey(text, options = {}) {
    return (
      normalizeKeyName(options.sourceKey) ??
      detectKeyFromMetadata(text) ??
      detectKeyFromFirstChord(text)
    );
  }

  function detectKeyFromElement(element, options = {}) {
    if (!element) return null;

    return (
      normalizeKeyName(options.sourceKey) ??
      normalizeKeyName(element.dataset?.key) ??
      detectKey(element.textContent ?? "", options)
    );
  }

  function detectFormat(text) {
    const normalized = normalizeText(text);

    const bracketRegex = /\[([^\]]+)\]/gu;
    let match;

    while ((match = bracketRegex.exec(normalized)) !== null) {
      if (isEscapedAt(normalized, match.index)) continue;

      const content = match[1].trim();

      if (isSectionHeaderToken(content)) continue;

      const parsed = parseChordToken(content);
      if (parsed?.type === "chord" || parsed?.type === "chordAlternative") return "chordpro";
    }

    return "text";
  }

  function accidentalPreference(note, targetKey) {
    const normalizedNote = normalizeNoteName(note);

    if (normalizedNote?.includes("b")) {
      return "flat";
    }

    if (normalizedNote?.includes("#")) {
      return "sharp";
    }

    return FLAT_KEY_NAMES.has(targetKey)
      ? "flat"
      : "sharp";
  }

  function transposeRoot(
    root,
    semitones,
    targetKey,
    preference
  ) {
    const pitch = pitchForRoot(root);

    if (pitch === undefined) {
      return root;
    }

    const notes =
      preference === "flat"
        ? FLAT_NOTES
        : preference === "sharp"
          ? SHARP_NOTES
          : FLAT_KEY_NAMES.has(targetKey)
            ? FLAT_NOTES
            : SHARP_NOTES;

    return notes[(pitch + semitones + 120) % 12];
  }

  function transposeChordToken(
    chord,
    semitones,
    targetKey
  ) {
    const parsed = parseChordToken(chord);

    if (!parsed) {
      return chord;
    }

    if (parsed.type === "separator") {
      return chord;
    }

    if (parsed.type === "chordAlternative") {
      const left = transposeChordToken(parsed.left.original, semitones, targetKey);
      const right = transposeChordToken(parsed.right.original, semitones, targetKey);
      return `${left}/${right}`;
    }

    const rootPreference =
      accidentalPreference(
        parsed.root,
        targetKey
      );

    const bassPreference = parsed.bass
      ? accidentalPreference(
        parsed.bass,
        targetKey
      )
      : null;

    const newRoot = transposeRoot(
      parsed.root,
      semitones,
      targetKey,
      rootPreference
    );

    const newBass = parsed.bass
      ? `/${transposeRoot(
        parsed.bass,
        semitones,
        targetKey,
        bassPreference
      )}`
      : "";

    return `${newRoot}${parsed.descriptor}${newBass}`;
  }

  function parseChordProAnchors(line) {
    const lyricCharacters = [];
    const anchors = [];
    let lyricIndex = 0;
    let cursor = 0;

    while (cursor < line.length) {
      if (line[cursor] === "\\" && cursor + 1 < line.length) {
        lyricCharacters.push(`${ESCAPED_CHARACTER_PREFIX}${line[cursor + 1]}`);
        lyricIndex += 1;
        cursor += 2;
        continue;
      }

      if (line[cursor] === "[" && !isEscapedAt(line, cursor)) {
        const closeIndex = line.indexOf("]", cursor + 1);

        if (closeIndex !== -1) {
          const content = line.slice(cursor + 1, closeIndex).trim();
          const parsed = parseChordToken(content);

          if ((parsed?.type === "chord" || parsed?.type === "chordAlternative") && !isSectionHeaderToken(content)) {
            anchors.push({ chord: content, lyricIndex });
            cursor = closeIndex + 1;
            continue;
          }

          const literal = line.slice(cursor, closeIndex + 1);

          for (const character of Array.from(literal)) {
            lyricCharacters.push(character);
            lyricIndex += 1;
          }

          cursor = closeIndex + 1;
          continue;
        }
      }

      const character = Array.from(line.slice(cursor))[0];
      lyricCharacters.push(character);
      lyricIndex += 1;
      cursor += character.length;
    }

    return { lyricCharacters, anchors };
  }

  function renderChordProChordLine(anchors) {
    let result = "";

    for (const anchor of anchors) {
      const targetIndex = Math.max(
        0,
        anchor.lyricIndex
      );

      if (result.length < targetIndex) {
        result += " ".repeat(
          targetIndex - result.length
        );
      } else if (
        result &&
        !result.endsWith(" ")
      ) {
        result += " ";
      }

      result += anchor.chord;
    }

    return result.trimEnd();
  }

  function chordProToDisplayText(text) {
    const lines = normalizeText(text).split("\n");
    const result = [];

    for (const line of lines) {
      const directive = line.match(/^\s*\{\s*([^:}]+)(?:\s*:\s*(.*?))?\s*\}\s*$/u);

      if (directive) {
        const name = directive[1].trim().toLowerCase();
        const value = directive[2]?.trim() ?? "";

        if (name.startsWith("start_of_") || name.startsWith("end_of_")) {
        result.push(line);
        continue;
      }

        if (["title", "artist", "key", "capo", "album", "year", "tempo", "comment"].includes(name)) {
          result.push(`${name}: ${value}`);
          continue;
        }

        result.push(line);
        continue;
      }

      const { lyricCharacters, anchors } = parseChordProAnchors(line);

      if (!anchors.length) {
        result.push(lyricCharacters.join(""));
        continue;
      }

      result.push(renderChordProChordLine(anchors));

      const lyricLine = lyricCharacters.join("");
      if (lyricLine.length > 0) result.push(lyricLine);
    }

    return result.join("\n");
  }

  function rebuildChordProLine(
    lyricCharacters,
    anchors,
    semitones,
    targetKey
  ) {
    const insertions = new Map();

    for (const anchor of anchors) {
      const safeIndex = Math.max(
        0,
        Math.min(
          anchor.lyricIndex,
          lyricCharacters.length
        )
      );

      if (!insertions.has(safeIndex)) {
        insertions.set(safeIndex, []);
      }

      insertions
        .get(safeIndex)
        .push(
          transposeChordToken(
            anchor.chord,
            semitones,
            targetKey
          )
        );
    }

    let result = "";

    for (
      let lyricIndex = 0;
      lyricIndex <= lyricCharacters.length;
      lyricIndex += 1
    ) {
      const chords = insertions.get(lyricIndex);

      if (chords) {
        for (const chord of chords) {
          result += `[${chord}]`;
        }
      }

      if (lyricIndex < lyricCharacters.length) {
        result += lyricCharacters[lyricIndex];
      }
    }

    return result;
  }

  function transposeChordPro(text, semitones, targetKey) {
    return normalizeText(text)
      .split("\n")
      .map((line) => {
        const { lyricCharacters, anchors } = parseChordProAnchors(line);
        if (!anchors.length) return lyricCharacters.join("");
        return rebuildChordProLine(lyricCharacters, anchors, semitones, targetKey);
      })
      .join("\n");
  }

  function rebuildTransposedChordLine(line, semitones, targetKey) {
    if (isTabLine(line)) return line;
    const analysis = analyzeInlineChordLine(line);
    const fullChordLine = isChordLine(line);
    let result = "";
    let cursor = 0;

    for (const item of analysis.tokens) {
      result += line.slice(cursor, item.start);

      const parsed = item.parsed;

      if (parsed?.type === "chord" || parsed?.type === "chordAlternative") {
        const shouldTranspose =
          fullChordLine ||
          isStrongChordToken(parsed) ||
          analysis.hasMusicalContext;

        if (shouldTranspose) {
          result += `${parsed.prefix}${transposeChordToken(parsed.chord, semitones, targetKey)}${parsed.suffix}`;
        } else {
          result += item.token;
        }
      } else {
        result += item.token;
      }

      cursor = item.start + item.token.length;
    }

    result += line.slice(cursor);
    return result;
  }

  function transposeStandardText(
    text,
    semitones,
    targetKey
  ) {
    return normalizeText(text)
      .split("\n")
      .map((line) => {
        return rebuildTransposedChordLine(
          line,
          semitones,
          targetKey
        );
      })
      .join("\n");
  }

  function updateKeyMetadata(
    text,
    targetKey,
    format
  ) {
    let result = normalizeText(text);

    if (format === "chordpro") {
      return result.replace(
        /^(\s*\{\s*key\s*:\s*)([^}]+)(\}\s*)$/imu,
        (match, prefix, value, suffix) =>
          `${prefix}${targetKey}${suffix}`
      );
    }

    result = result.replace(
      /^(\s*key\s*:\s*)([^\n]+)$/imu,
      (match, prefix) =>
        `${prefix}${targetKey}`
    );

    result = result.replace(
      /((?:^|\.\s*)Key\s*:\s*)([A-G](?:#|b|♯|♭)?(?:m|min|minor)?)(?=\.|$)/imu,
      (match, prefix) =>
        `${prefix}${targetKey}`
    );

    return result;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function wrapChord(value, options = {}) {
    const tag = options.chordTag || "span";
    const className = options.chordClass;
    const classAttribute = className ? ` class="${escapeHtml(className)}"` : "";
    return `<${tag}${classAttribute}>${value}</${tag}>`;
  }

  function wrapStandardTextChords(text, options = {}) {
    return normalizeText(text)
      .split("\n")
      .map((line) => {
        if (isTabLine(line)) return escapeHtml(restoreEscapedCharacters(line));
        const analysis = analyzeInlineChordLine(line);
        const fullChordLine = isChordLine(line);
        let result = "";
        let cursor = 0;

        for (const item of analysis.tokens) {
          result += escapeHtml(restoreEscapedCharacters(line.slice(cursor, item.start)));

          const parsed = item.parsed;

          if (parsed?.type === "chord" || parsed?.type === "chordAlternative") {
            const shouldWrap =
              fullChordLine ||
              isStrongChordToken(parsed) ||
              analysis.hasMusicalContext;

            result += shouldWrap
              ? `${escapeHtml(parsed.prefix)}${wrapChord(escapeHtml(parsed.chord), options)}${escapeHtml(parsed.suffix)}`
              : escapeHtml(item.token);
          } else {
            result += escapeHtml(restoreEscapedCharacters(stripEscapeCharacters(item.token)));
          }

          cursor = item.start + item.token.length;
        }

        result += escapeHtml(restoreEscapedCharacters(stripEscapeCharacters(line.slice(cursor))));
        return result;
      })
      .join("\n");
  }

  function wrapChordProChords(text, options = {}) {
    const normalized = normalizeText(text);
    const result = [];
    let cursor = 0;
    const regex = /\[([^\]]+)\]/gu;
    let match;

    while ((match = regex.exec(normalized)) !== null) {
      if (isEscapedAt(normalized, match.index)) {
        result.push(escapeHtml(normalized.slice(cursor, match.index - 1)));
        result.push(escapeHtml(match[0]));
        cursor = match.index + match[0].length;
        continue;
      }

      result.push(escapeHtml(normalized.slice(cursor, match.index)));

      const value = match[1].trim();
      const parsed = parseChordToken(value);

      if ((parsed?.type === "chord" || parsed?.type === "chordAlternative") && !isSectionHeaderToken(value)) {
        result.push(wrapChord(`[${escapeHtml(value)}]`, options));
      } else {
        result.push(escapeHtml(match[0]));
      }

      cursor = match.index + match[0].length;
    }

    result.push(escapeHtml(normalized.slice(cursor)));
    return result.join("");
  }

  function wrapChordMarkup(text, format = "auto", options = {}) {
    const resolvedFormat = format === "text" || format === "chordpro" ? format : detectFormat(text);
    return resolvedFormat === "chordpro" ? wrapChordProChords(text, options) : wrapStandardTextChords(text, options);
  }

  function wrapSongMarkup(text, format = "auto", options = {}) {
    const lines = normalizeText(text).split("\n");
    const result = [];
    const sections = [];

    for (const line of lines) {
      const directive = parseSectionDirective(line);

      if (!directive) {
        result.push(wrapChordMarkup(line, format, options));
        continue;
      }

      if (directive.action === "start") {
        const section = {
          name: directive.name,
          title: directive.title || directive.name.replaceAll("_", " ")
        };

        const tag = normalizeTagName(options.sectionTag, "span");
        const titleTag = normalizeTagName(options.sectionTitleTag, "span");
        const className = resolveOptionValue(options.sectionClass, section.name.replaceAll("_", "-"), section);
        const titleClassName = resolveOptionValue(options.sectionTitleClass, `${section.name.replaceAll("_", "-")}-title`, section);
        const formattedTitle = typeof options.sectionTitleFormatter === "function"
          ? options.sectionTitleFormatter(section.title, section)
          : `[${section.title}]`;

        result.push(`<${tag}${sectionClassAttribute(className)}><${titleTag}${sectionClassAttribute(titleClassName)}>${escapeHtml(formattedTitle)}</${titleTag}>`);
        sections.push({ name: section.name, tag });
        continue;
      }

      const current = sections[sections.length - 1];

      if (!current || current.name !== directive.name) {
        result.push(escapeHtml(line));
        continue;
      }

      result.push(`</${current.tag}>`);
      sections.pop();
    }

    while (sections.length) {
      result.push(`</${sections.pop().tag}>`);
    }

    return result.join("\n");
  }

  function transposeText(text, options = {}) {
    const normalized = normalizeText(text);

    const sourceKey =
      detectKey(normalized, options);

    const targetKey =
      normalizeKeyName(options.targetKey);

    if (!sourceKey) {
      throw new Error(
        "Source key could not be detected."
      );
    }

    if (!targetKey) {
      throw new Error(
        "A valid target key is required."
      );
    }

    const sourcePitch =
      pitchForRoot(keyRoot(sourceKey));

    const targetPitch =
      pitchForRoot(keyRoot(targetKey));

    if (
      sourcePitch === undefined ||
      targetPitch === undefined
    ) {
      throw new Error(
        "Source or target key is invalid."
      );
    }

    const semitones =
      (targetPitch - sourcePitch + 12) % 12;

    const format =
      options.format === "text" ||
        options.format === "chordpro"
        ? options.format
        : detectFormat(normalized);

    let result =
      format === "chordpro"
        ? transposeChordPro(
          normalized,
          semitones,
          targetKey
        )
        : transposeStandardText(
          normalized,
          semitones,
          targetKey
        );

    result = updateKeyMetadata(
      result,
      targetKey,
      format
    );

    const wrapChords = options.wrapChords !== false;

    const outputText = wrapChords ? wrapSongMarkup(result, format, options) : result;

    return {
      text: outputText,
      rawText: result,
      sourceKey,
      targetKey,
      semitones,
      format,
      wrapChords,
      isHtml: wrapChords
    };
  }

  function transposeElement(
    element,
    options = {}
  ) {
    if (!element) {
      throw new Error(
        "A valid DOM element is required."
      );
    }

    const sourceKey =
      normalizeKeyName(options.sourceKey) ??
      normalizeKeyName(element.dataset?.key) ??
      detectKey(
        element.textContent ?? "",
        options
      );

    const result = transposeText(
      element.textContent ?? "",
      {
        ...options,
        sourceKey
      }
    );

    if (options.write !== false) {
      if (result.isHtml) {
        element.innerHTML = result.text;
      } else {
        element.textContent = result.text;
      }

      element.dataset.key =
        result.targetKey;
    }

    return result;
  }


  function resolveElement(reference, label) {
    const element =
      typeof reference === "string"
        ? document.getElementById(reference)
        : reference;

    if (!element) {
      throw new Error(`${label} element could not be found.`);
    }

    return element;
  }

  function resolveOptionalElement(reference) {
    if (!reference) return null;
    return typeof reference === "string" ? document.getElementById(reference) : reference;
  }

  function mount(
    configOrSongReference,
    buttonsReference,
    legacyOptions = {}
  ) {
    const usesConfigObject =
      configOrSongReference &&
      typeof configOrSongReference === "object" &&
      !("nodeType" in configOrSongReference);

    const config = usesConfigObject
      ? configOrSongReference
      : {
        songElementId: configOrSongReference,
        transposeButtonsElementId: buttonsReference,
        ...legacyOptions
      };

    const songReference =
      config.songElement ??
      config.songElementId;

    const buttonsContainerReference =
      config.transposeButtonsElement ??
      config.transposeButtonsElementId;

    const options = config;
    const enabled = options.enabled !== false;

    const songElement =
      resolveElement(songReference, "Song");

    const buttonsElement =
      resolveElement(
        buttonsContainerReference,
        "Buttons"
      );

    const transposeUpElement = 
      resolveOptionalElement(
        options.transposeUpElement ?? options.transposeUpElementId
      );

    const transposeDownElement = 
      resolveOptionalElement(
        options.transposeDownElement ?? options.transposeDownElementId
      );

    const originalText =
      options.sourceText ??
      songElement.textContent ??
      "";

    function createDisabledController(reason = "disabled") {
      buttonsElement.replaceChildren();

      if (transposeUpElement) transposeUpElement.disabled = true;
      if (transposeDownElement) transposeDownElement.disabled = true;

      return {
        songElement,
        buttonsElement,
        enabled: false,
        reason,
        sourceKey: null,
        format: null,
        keys: [],
        showOriginalMark: false,

        get targetKey() {
          return null;
        },

        selectKey() {
          return null;
        },

        transposeBy() {
          return null;
        },

        transposeUp() {
          return null;
        },

        transposeDown() {
          return null;
        },

        reset() {
          return null;
        },

        destroy() {
          buttonsElement.replaceChildren();
        }
      };
    }

    if (!enabled) {
      return createDisabledController("disabled");
    }

    const explicitSourceKey =
      normalizeKeyName(options.sourceKey) ??
      normalizeKeyName(songElement.dataset?.key);

    const detectedSourceKey =
      detectKey(originalText, {
        sourceKey: explicitSourceKey
      });

    const sourceKey = resolveSupportedKey(detectedSourceKey);

    if (!sourceKey) {
      return createDisabledController("source-key-not-detected");
    }

    const format =
      options.format === "text" ||
        options.format === "chordpro"
        ? options.format
        : detectFormat(originalText);

    const keys =
      isMinorKey(sourceKey)
        ? MINOR_KEYS
        : MAJOR_KEYS;

    const buttonClass =
      options.buttonClass || "key-button";

    const activeClass =
      options.activeClass || "active";

    const originalClass =
      options.originalClass || "original";

    const showOriginalMark =
      options.showOriginalMark !== false;

    let selectedKey =
      normalizeKeyName(options.targetKey) ??
      sourceKey;

    function renderSong() {
      const result = transposeText(
        originalText,
        {
          sourceKey,
          targetKey: selectedKey,
          format,
          wrapChords: false
        }
      );

      const showChordProAsText =
        format === "chordpro" &&
        options.showChordProAsText !== false;

      const displayText = showChordProAsText
        ? chordProToDisplayText(result.text)
        : result.text;

      const displayFormat = showChordProAsText
        ? "text"
        : format;

      if (options.wrapChords !== false) {
        songElement.innerHTML = wrapSongMarkup(displayText, displayFormat, options);
      } else {
        songElement.textContent =
          displayText;
      }

      songElement.dataset.key =
        result.targetKey;

      return {
        ...result,
        displayText,
        displayFormat
      };
    }

    function updateButtons() {
      for (const button of buttonsElement.querySelectorAll(
        "[data-transpose-key]"
      )) {
        button.classList.toggle(
          activeClass,
          button.dataset.transposeKey === selectedKey
        );
      }
    }

    function transposeBy(semitones) {
      const amount = Number(semitones);
      if (!Number.isFinite(amount)) return null;

      const currentPitch = pitchForRoot(keyRoot(selectedKey));
      if (currentPitch === undefined) return null;

      const targetPitch = ((currentPitch + amount) % 12 + 12) % 12;
      const targetKey = keys.find((key) => pitchForRoot(keyRoot(key)) === targetPitch);

      if (!targetKey) return null;

      selectedKey = targetKey;

      const result = renderSong();
      updateButtons();

      if (typeof options.onChange === "function") options.onChange(result);

      return result;
    }

    function selectKey(key) {
      const normalizedKey =
        normalizeKeyName(key);

      if (
        !normalizedKey ||
        !keys.includes(normalizedKey)
      ) {
        return null;
      }

      selectedKey = normalizedKey;

      const result = renderSong();
      updateButtons();

      if (typeof options.onChange === "function") {
        options.onChange(result);
      }

      return result;
    }

    const handleTransposeUp = () => transposeBy(1);
    const handleTransposeDown = () => transposeBy(-1);

    if (transposeUpElement) 
      transposeUpElement.addEventListener("click", handleTransposeUp);

    if (transposeDownElement) 
      transposeDownElement.addEventListener("click", handleTransposeDown);

    buttonsElement.replaceChildren();

    for (const key of keys) {
      const button =
        document.createElement("button");

      button.type = "button";
      button.textContent = key;
      button.className = buttonClass;
      button.dataset.transposeKey = key;

      if (
        showOriginalMark &&
        key === sourceKey
      ) {
        button.classList.add(originalClass);
        button.title = "Original key";
      }

      button.addEventListener(
        "click",
        () => selectKey(key)
      );

      buttonsElement.appendChild(button);
    }

    selectKey(selectedKey);

    return {
      songElement,
      buttonsElement,
      enabled: true,
      reason: null,
      sourceKey,
      format,
      keys: [...keys],
      showOriginalMark,

      get targetKey() {
        return selectedKey;
      },

      selectKey,
      transposeBy,

      transposeUp() {
        return transposeBy(1);
      },

      transposeDown() {
        return transposeBy(-1);
      },

      reset() {
        return selectKey(sourceKey);
      },

      destroy() {
        if (transposeUpElement) transposeUpElement.removeEventListener("click", handleTransposeUp);
        if (transposeDownElement) transposeDownElement.removeEventListener("click", handleTransposeDown);

        buttonsElement.replaceChildren();
        songElement.textContent = originalText;
        songElement.dataset.key = sourceKey;
      }
    };
  }

  global.ChordTransposer = {
    MAJOR_KEYS,
    MINOR_KEYS,
    normalizeText,
    normalizeKeyName,
    parseChordToken,
    isMinorKey,
    parseSectionDirective,
    wrapSongMarkup,
    isLikelyChordToken,
    isSectionHeaderToken,
    isChordLine,
    detectKeyFromMetadata,
    detectKeyFromFirstChord,
    detectKey,
    detectKeyFromElement,
    detectFormat,
    escapeHtml,
    wrapChordMarkup,
    parseChordProAnchors,
    rebuildChordProLine,
    renderChordProChordLine,
    chordProToDisplayText,
    transposeChordToken,
    transposeText,
    transposeElement,
    mount
  };
})(
  typeof window !== "undefined"
    ? window
    : globalThis
);
