/**
 * @file candidates.js
 * Romaji candidate generation based on kana context.
 */

import { ROMA_TABLE, SYMBOL_TABLE } from './table.js';
import { toHalfWidthAlpha } from './normalizer.js';
import { getKana, isSmallTsu, isSymbol, isN, isNaRow } from './kana.js';

/**
 * Gets romaji candidates for a single kana.
 *
 * @param {string} kana
 * @param {string|null} [prevKana=null]
 * @param {string|null} [nextKana=null]
 * @param {'nn'|'n'} [finalNMode='nn']
 * @returns {string[]} Array of romaji candidate strings
 */
export function getRomajiCandidates(kana, prevKana = null, nextKana = null, finalNMode = 'nn') {
  if (!kana) return [];

  const normalizedKana = toHalfWidthAlpha(kana);

  if (ROMA_TABLE[normalizedKana]) {
    if (normalizedKana === 'ん') {
      const candidates = [...ROMA_TABLE[normalizedKana]];
      if (finalNMode === 'n') {
        const idx = candidates.indexOf('n');
        if ((!nextKana || prevKana === 'ー' || isSymbol(nextKana)) && idx > -1) {
          candidates.splice(idx, 1);
          candidates.unshift('n');
        }
      } else {
        const idx = candidates.indexOf('nn');
        if (idx > -1) {
          candidates.splice(idx, 1);
          candidates.unshift('nn');
        }
      }
      return candidates;
    }
    return ROMA_TABLE[normalizedKana];
  }

  if (ROMA_TABLE[kana]) return ROMA_TABLE[kana];

  if (/^[!-~]$/.test(normalizedKana)) {
    return [normalizedKana.toLowerCase()];
  }

  return [];
}

/**
 * Gets sokuon (促音 "っ") candidates based on the following kana.
 * Includes consonant doubling (e.g. "kka" for "か") and direct small tsu input ("ltu", "xtu").
 *
 * @param {string|null} nextKana
 * @returns {string[]}
 */
export function getSokuonCandidates(nextKana) {
  const nextRoma = getRomajiCandidates(nextKana);
  const set = new Set();
  if (nextKana && !isSymbol(nextKana)) {
    for (const r of nextRoma) {
      if (r.length > 0) set.add(r[0] + r);
    }
  }
  set.add('ltu');
  set.add('xtu');
  return [...set];
}

/**
 * Gets romaji candidates for the kana at the specified position in text,
 * fully resolving context for sokuon, hatsuon, and symbols.
 *
 * @param {string} text - Full text
 * @param {number} pos - Position index in text
 * @param {Object} [options={}]
 * @param {'nn'|'n'} [options.finalNMode='nn']
 * @returns {string[]}
 */
export function getCandidatesForKana(text, pos, options = {}) {
  const finalNMode = options.finalNMode || 'nn';
  const kana = getKana(text, pos);

  if (!kana) return [];

  // Symbols
  if (isSymbol(kana)) {
    return [SYMBOL_TABLE[kana] ?? kana];
  }

  // Sokuon ("っ")
  if (isSmallTsu(kana)) {
    const nextKana = getKana(text, pos + kana.length);
    return getSokuonCandidates(nextKana);
  }

  // Hatsuon ("ん")
  if (isN(kana)) {
    const nextKana = getKana(text, pos + kana.length);
    const prevKana = pos > 0 ? getKana(text, pos - 1) : null;
    const nextRomaji = nextKana ? getRomajiCandidates(nextKana, kana, null, finalNMode) : [];
    const nextRequiresNn = nextKana && /^[aiueoy]/.test(nextRomaji[0] || '');

    // 1. Word end or immediately after prolonged sound mark
    if (!nextKana || prevKana === 'ー') {
      return finalNMode === 'n' ? ['n'] : ['nn', 'xn'];
    }
    // 2. Next is na-row
    if (isNaRow(nextKana)) {
      return finalNMode === 'n' ? ['n', 'nn', 'xn'] : ['nn', 'xn', 'n'];
    }
    // 3. Next is vowel, y-row, or another 'ん'
    return (nextRequiresNn || isN(nextKana)) ? ['nn', 'xn', 'n'] : ['n', 'nn', 'xn'];
  }

  // Regular kana
  const prevKana = pos > 0 ? getKana(text, pos - 1) : null;
  const nextKana = getKana(text, pos + kana.length);
  return getRomajiCandidates(kana, prevKana, nextKana, finalNMode);
}

