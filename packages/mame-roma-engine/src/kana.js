/**
 * @file kana.js
 * Kana identification, slicing, and classification utilities.
 */

import { ROMA_TABLE, SYMBOL_TABLE } from './table.js';

export const isSmallTsu = kana => kana === 'っ';
export const isSymbol = kana => kana in SYMBOL_TABLE;
export const isN = kana => kana === 'ん';
export const isNaRow = kana => ['な', 'に', 'ぬ', 'ね', 'の'].includes(kana);

/**
 * Extracts the kana at the specified position.
 * Prioritizes 2-character contracted sounds (拗音 e.g. "しゃ") if registered in ROMA_TABLE.
 *
 * @param {string} text - Target text
 * @param {number} pos - Position index
 * @returns {string|null} Kana unit or null if out of bounds
 */
export function getKana(text, pos) {
  if (!text || pos >= text.length) return null;

  const two = text.slice(pos, pos + 2);
  if (ROMA_TABLE[two]) return two;

  return text[pos];
}

