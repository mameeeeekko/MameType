/**
 * @file normalizer.js
 * Character and keystroke normalization utilities.
 */

/**
 * Converts full-width alphanumeric and symbols (！〜～) to half-width characters.
 * @param {string} str
 * @returns {string}
 */
export function toHalfWidthAlpha(str) {
  if (!str) return str;
  return str.replace(/[！-～]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)
  );
}

/**
 * Normalizes an input key from KeyboardEvent (or string) by:
 * 1. Converting full-width characters to half-width.
 * 2. Converting full-width space to half-width space.
 * 3. Normalizing case to lower case.
 * 4. Resolving keyboard quirks (e.g. Mac JIS Shift+^ producing wave dash / overline).
 * 5. Checking against allowed typing keystroke patterns.
 *
 * @param {string} key - Raw key string (e.g. event.key)
 * @returns {{ key: string, isValid: boolean }}
 */
export function normalizeInputKey(key) {
  if (typeof key !== 'string' || key.length === 0) {
    return { key: '', isValid: false };
  }

  let normalized = toHalfWidthAlpha(key);
  if (normalized === '　') normalized = ' ';
  normalized = normalized.toLowerCase();

  // Absorb keyboard layout quirks
  if (normalized === '〜' || normalized === '～' || normalized === '‾') {
    normalized = '~';
  }
  if (normalized === '￥') {
    normalized = '¥';
  }

  // Validate allowed typing characters
  const isValid = /^[a-z0-9.,!?\-\[\]\(\)@%:*+;{}<>=/\\_&|~^$#'"¥ ]$/.test(normalized);

  return { key: normalized, isValid };
}

