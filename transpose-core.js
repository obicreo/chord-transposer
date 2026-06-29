/*!
 * Chord Transposer Core v1.0.0
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

  function tokenizeChordLine(line) {
    return String(line ?? "")
      .trim()
      .split(/\s+/u)
      .filter(Boolean);
  }

  function isChordLine(line) {
    const tokens = tokenizeChordLine(line);

    if (!tokens.length) {
      return false;
    }

    let chordCount = 0;

    for (const token of tokens) {
      const parsed = parseChordToken(token);

      if (!parsed) {
        return false;
      }

      if (parsed.type === "chord") {
        chordCount += 1;
      }
    }

    /*
     * A line containing only separators is not considered a chord line.
     */
    return chordCount > 0;
  }

  function keyFromChordToken(token) {
    const parsed = parseChordToken(token);

    if (!parsed || parsed.type !== "chord") {
      return null;
    }

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
      const content = bracketMatch[1].trim();

      if (
        !content ||
        isSectionHeaderToken(content)
      ) {
        continue;
      }

      const key = keyFromChordToken(content);

      if (key) {
        return key;
      }
    }

    for (const line of normalized.split("\n")) {
      const trimmed = line.trim();

      if (
        !trimmed ||
        trimmed.startsWith("#") ||
        trimmed.includes(":") ||
        isSectionHeaderToken(
          trimmed.replace(/^\[|\]$/g, "")
        ) ||
        !isChordLine(line)
      ) {
        continue;
      }

      for (const token of tokenizeChordLine(line)) {
        const key = keyFromChordToken(token);

        if (key) {
          return key;
        }
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

    if (/^\s*\{[^}]+\}\s*$/mu.test(normalized)) {
      return "chordpro";
    }

    const bracketRegex = /\[([^\]]+)\]/gu;
    let match;

    while ((match = bracketRegex.exec(normalized)) !== null) {
      const content = match[1].trim();

      if (
        isSectionHeaderToken(content)
      ) {
        continue;
      }

      const parsed = parseChordToken(content);

      if (parsed?.type === "chord") {
        return "chordpro";
      }
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
      if (line[cursor] === "[") {
        const closeIndex = line.indexOf(
          "]",
          cursor + 1
        );

        if (closeIndex !== -1) {
          const content = line
            .slice(cursor + 1, closeIndex)
            .trim();

          const parsed = parseChordToken(content);

          if (
            parsed?.type === "chord" &&
            !isSectionHeaderToken(content)
          ) {
            anchors.push({
              chord: content,
              lyricIndex
            });

            cursor = closeIndex + 1;
            continue;
          }

          const literal = line.slice(
            cursor,
            closeIndex + 1
          );

          for (const character of Array.from(literal)) {
            lyricCharacters.push(character);
            lyricIndex += 1;
          }

          cursor = closeIndex + 1;
          continue;
        }
      }

      const character = Array.from(
        line.slice(cursor)
      )[0];

      lyricCharacters.push(character);
      lyricIndex += 1;
      cursor += character.length;
    }

    return {
      lyricCharacters,
      anchors
    };
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
      const directive = line.match(
        /^\s*\{\s*([^:}]+)(?:\s*:\s*(.*?))?\s*\}\s*$/u
      );

      if (directive) {
        const name = directive[1]
          .trim()
          .toLowerCase();

        const value =
          directive[2]?.trim() ?? "";

        if (name.startsWith("end_of_")) {
          continue;
        }

        if (name.startsWith("start_of_")) {
          const fallbackLabel = name
            .replace("start_of_", "")
            .replaceAll("_", " ");

          const label =
            value || fallbackLabel;

          result.push(`[${label}]`);
          continue;
        }

        if (
          [
            "title",
            "artist",
            "key",
            "capo",
            "album",
            "year",
            "tempo",
            "comment"
          ].includes(name)
        ) {
          result.push(`${name}: ${value}`);
          continue;
        }

        result.push(line);
        continue;
      }

      const {
        lyricCharacters,
        anchors
      } = parseChordProAnchors(line);

      if (!anchors.length) {
        result.push(line);
        continue;
      }

      result.push(
        renderChordProChordLine(anchors)
      );

      const lyricLine =
        lyricCharacters.join("");

      if (lyricLine.length > 0) {
        result.push(lyricLine);
      }
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

  function transposeChordPro(
    text,
    semitones,
    targetKey
  ) {
    return normalizeText(text)
      .split("\n")
      .map((line) => {
        const {
          lyricCharacters,
          anchors
        } = parseChordProAnchors(line);

        if (!anchors.length) {
          return line;
        }

        return rebuildChordProLine(
          lyricCharacters,
          anchors,
          semitones,
          targetKey
        );
      })
      .join("\n");
  }

  function rebuildTransposedChordLine(
    line,
    semitones,
    targetKey
  ) {
    const tokens = [];
    const regex = /\S+/gu;
    let match;

    while ((match = regex.exec(line)) !== null) {
      tokens.push({
        token: match[0],
        start: match.index
      });
    }

    let result = "";

    for (const item of tokens) {
      const parsed = parseChordToken(item.token);

      const value =
        parsed?.type === "chord"
          ? transposeChordToken(
              item.token,
              semitones,
              targetKey
            )
          : item.token;

      if (result.length < item.start) {
        result += " ".repeat(
          item.start - result.length
        );
      } else if (
        result.length > 0 &&
        !result.endsWith(" ")
      ) {
        result += " ";
      }

      result += value;
    }

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
        if (!isChordLine(line)) {
          return line;
        }

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

  function wrapStandardTextChords(text) {
    return normalizeText(text)
      .split("\n")
      .map((line) => {
        if (!isChordLine(line)) {
          return escapeHtml(line);
        }

        return line.replace(
          /\S+/gu,
          (token) => {
            const parsed = parseChordToken(token);

            if (parsed?.type === "chord") {
              return `<span class="chord">${escapeHtml(token)}</span>`;
            }

            return escapeHtml(token);
          }
        );
      })
      .join("\n");
  }

  function wrapChordProChords(text) {
    const normalized = normalizeText(text);
    const result = [];

    let cursor = 0;
    const regex = /\[([^\]]+)\]/gu;
    let match;

    while ((match = regex.exec(normalized)) !== null) {
      result.push(
        escapeHtml(normalized.slice(cursor, match.index))
      );

      const value = match[1].trim();
      const parsed = parseChordToken(value);

      if (
        parsed?.type === "chord" &&
        !isSectionHeaderToken(value)
      ) {
        result.push(
          `<span class="chord">[${escapeHtml(value)}]</span>`
        );
      } else {
        result.push(escapeHtml(match[0]));
      }

      cursor = match.index + match[0].length;
    }

    result.push(escapeHtml(normalized.slice(cursor)));

    return result.join("");
  }

  function wrapChordMarkup(text, format = "auto") {
    const resolvedFormat =
      format === "text" || format === "chordpro"
        ? format
        : detectFormat(text);

    return resolvedFormat === "chordpro"
      ? wrapChordProChords(text)
      : wrapStandardTextChords(text);
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

    const wrapChords =
      options.wrapChords !== false;

    const outputText = wrapChords
      ? wrapChordMarkup(result, format)
      : result;

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

    const songElement =
      resolveElement(songReference, "Song");

    const buttonsElement =
      resolveElement(
        buttonsContainerReference,
        "Buttons"
      );

    const originalText =
      options.sourceText ??
      songElement.textContent ??
      "";

    const explicitSourceKey =
      normalizeKeyName(options.sourceKey) ??
      normalizeKeyName(songElement.dataset?.key);

    const sourceKey =
      detectKey(originalText, {
        sourceKey: explicitSourceKey
      });

    if (!sourceKey) {
      throw new Error(
        "Source key could not be detected. Add data-key, key:, {key: ...}, or sourceKey."
      );
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
        songElement.innerHTML =
          wrapChordMarkup(
            displayText,
            displayFormat
          );
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
      sourceKey,
      format,
      keys: [...keys],
      showOriginalMark,

      get targetKey() {
        return selectedKey;
      },

      selectKey,

      reset() {
        return selectKey(sourceKey);
      },

      destroy() {
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
