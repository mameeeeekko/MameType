/**
 * @file display.js
 * Dynamic Romaji string generation for display rendering.
 */

import { SYMBOL_TABLE } from './table.js';
import { getKana, isSmallTsu, isSymbol } from './kana.js';
import { getCandidatesForKana, getSokuonCandidates } from './candidates.js';

/**
 * Builds the full romaji display string corresponding to text,
 * dynamically reflecting typed buffer and user choices.
 *
 * @param {Object} params
 * @param {string} params.text - Target text
 * @param {number} params.pos - Current position index
 * @param {string} params.typed - Currently typed unconfirmed buffer
 * @param {string} params.inputedRomaji - Confirmed romaji string so far
 * @param {'nn'|'n'} [params.finalNMode='nn']
 * @returns {string}
 */
export function getDisplayFullRoma({ text, pos = 0, typed = '', inputedRomaji = '', finalNMode = 'nn' }) {
  if (!text) return '';

  let result = inputedRomaji || '';
  let i = pos;

  while (i < text.length) {
    const kana = getKana(text, i);
    if (!kana) break;

    if (kana === '\r') {
      i += 1;
      continue;
    }

    if (kana === '\n') {
      result += ' ';
      i += 1;
      while (i < text.length && (text[i] === '\n' || text[i] === '\r' || text[i] === ' ' || text[i] === '　')) {
        i += 1;
      }
      continue;
    }

    // Symbols
    if (isSymbol(kana)) {
      result += SYMBOL_TABLE[kana] ?? kana;
      i += kana.length;
      continue;
    }

    // Sokuon ("っ")
    if (isSmallTsu(kana)) {
      const nextKana = getKana(text, i + kana.length);
      const candidates = getSokuonCandidates(nextKana);

      const sel = (typed && i === pos)
        ? (candidates.find(r => r.startsWith(typed)) || candidates[0])
        : candidates[0];

      result += sel;

      i += (sel.length > 1 && sel !== 'ltu' && sel !== 'xtu' && nextKana)
        ? kana.length + nextKana.length
        : kana.length;

      continue;
    }

    // Regular kana & hatsuon
    const candidates = getCandidatesForKana(text, i, { finalNMode }) || [];
    if (candidates.length === 0) {
      result += kana;
      i += kana.length;
      continue;
    }

    const sel = (typed && i === pos)
      ? (candidates.find(r => r.startsWith(typed)) || candidates[0])
      : candidates[0];

    result += sel ?? kana;
    i += kana.length;
  }

  return result;
}

/**
 * Builds standard default romaji string for the given text.
 *
 * @param {string} text
 * @param {Object} [options={}]
 * @returns {string}
 */
export function buildBaseRomaji(text, options = {}) {
  let result = '';
  let i = 0;

  while (i < text.length) {
    const kana = getKana(text, i);
    if (!kana) break;
    const candidates = getCandidatesForKana(text, i, options) || [];
    result += candidates[0] || kana;
    i += kana.length;
  }

  return result;
}

/**
 * Dynamically builds the remaining romaji string from pos and typed buffer.
 *
 * @param {string} text
 * @param {number} pos
 * @param {string} typed
 * @param {Object} [options={}]
 * @returns {string}
 */
export function buildRemainingRomajiDynamic(text, pos, typed, options = {}) {
  let result = '';
  let i = pos;
  let remainingTyped = typed;

  while (i < text.length) {
    const kana = getKana(text, i);
    if (!kana) break;

    const candidates = getCandidatesForKana(text, i, options) || [];

    if (candidates.length === 0) {
      result += kana;
      i += kana.length;
      continue;
    }

    let romaji = candidates[0];

    while (remainingTyped.length > 0) {
      if (remainingTyped.startsWith(romaji[0])) {
        remainingTyped = remainingTyped.slice(1);
        romaji = romaji.slice(1);
      } else {
        let found = false;
        for (const c of candidates) {
          if (remainingTyped.startsWith(c[0])) {
            romaji = c;
            found = true;
            break;
          }
        }
        if (!found) break;
      }
    }

    result += romaji;
    i += kana.length;
  }

  return result;
}

