/**
 * @file index.js
 * Mame Roma Engine - Japanese Romaji Typing Judgment Library.
 * Extracted from MameType.
 */

export { ROMA_TABLE, SYMBOL_TABLE } from './table.js';
export { toHalfWidthAlpha, normalizeInputKey } from './normalizer.js';
export { getKana, isSmallTsu, isSymbol, isN, isNaRow } from './kana.js';
export { getCandidatesForKana, getRomajiCandidates, getSokuonCandidates } from './candidates.js';
export { getDisplayFullRoma, buildBaseRomaji, buildRemainingRomajiDynamic } from './display.js';
export { evaluateKey, TypingSession } from './engine.js';

