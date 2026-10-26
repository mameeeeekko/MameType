/**
 * @file engine.js
 * Core typing judgment logic and stateful session manager.
 */

import { normalizeInputKey } from './normalizer.js';
import { getKana, isSmallTsu, isSymbol, isN, isNaRow } from './kana.js';
import { getCandidatesForKana, getRomajiCandidates } from './candidates.js';
import { getDisplayFullRoma } from './display.js';

/**
 * Result of evaluating a keystroke against current typing state.
 * @typedef {Object} EvaluationResult
 * @property {boolean} success - Whether the key was accepted (either in-progress or completed)
 * @property {boolean} isMiss - Whether the key was a miss (incorrect keystroke)
 * @property {boolean} isComplete - Whether a kana unit was completed by this keystroke
 * @property {boolean} isFinished - Whether the entire target text is completed
 * @property {number} charCount - Number of confirmed characters added (0 if in-progress)
 * @property {string} key - Normalized key string
 * @property {boolean} [ignored] - Whether the keystroke was ignored (e.g. non-typable key)
 * @property {string} typed - Updated unconfirmed buffer
 * @property {string} inputedRomaji - Updated confirmed romaji string
 * @property {number} pos - Updated position index in text
 */

/**
 * Pure function evaluating a single keystroke against a given typing state.
 *
 * @param {string} rawKey - Key string (e.g. 'a', 'K', event.key)
 * @param {Object} state - Current typing state
 * @param {string} state.text - Target text (hiragana / symbols)
 * @param {number} state.pos - Current position index
 * @param {string} state.typed - Currently buffered unconfirmed romaji
 * @param {string} state.inputedRomaji - Cumulative confirmed romaji string
 * @param {Object} [options={}]
 * @param {'nn'|'n'} [options.finalNMode='nn']
 * @returns {EvaluationResult}
 */
export function evaluateKey(rawKey, state, options = {}) {
  const finalNMode = options.finalNMode || 'nn';
  const { key, isValid } = normalizeInputKey(rawKey);

  let { text = '', pos = 0, typed = '', inputedRomaji = '' } = state;

  if (!isValid) {
    return {
      success: false,
      isMiss: false,
      isComplete: false,
      isFinished: pos >= text.length,
      charCount: 0,
      ignored: true,
      key,
      typed,
      inputedRomaji,
      pos
    };
  }

  if (pos >= text.length) {
    return {
      success: false,
      isMiss: false,
      isComplete: false,
      isFinished: true,
      charCount: 0,
      key,
      typed,
      inputedRomaji,
      pos
    };
  }

  const kana = getKana(text, pos);
  const candidates = getCandidatesForKana(text, pos, { finalNMode });

  // =========================================================
  // 1. Hatsuon ("ん") handling
  // =========================================================
  if (isN(kana)) {
    const nextKana = getKana(text, pos + kana.length);
    const prevKana = pos > 0 ? getKana(text, pos - 1) : null;

    // Word end, after prolonged sound mark, or before symbol
    if (!nextKana || prevKana === 'ー' || isSymbol(nextKana)) {
      if (typed === 'n' && key === 'n') {
        inputedRomaji += 'nn';
        typed = '';
        pos += kana.length;
        const isFinished = pos >= text.length;
        return { success: true, isMiss: false, charCount: 2, isComplete: true, isFinished, key, typed, inputedRomaji, pos };
      }

      if (key === 'n') {
        if (finalNMode === 'n') {
          inputedRomaji += 'n';
          typed = '';
          pos += kana.length;
          const isFinished = pos >= text.length;
          return { success: true, isMiss: false, charCount: 1, isComplete: true, isFinished, key, typed, inputedRomaji, pos };
        } else {
          typed = 'n';
          return { success: true, isMiss: false, charCount: 0, isComplete: false, isFinished: false, key, typed, inputedRomaji, pos };
        }
      }

      return { success: false, isMiss: true, charCount: 0, isComplete: false, isFinished: false, key, typed, inputedRomaji, pos };
    }

    // When typed already holds 'n'
    if (typed === 'n') {
      if (key === 'n') {
        inputedRomaji += 'nn';
        typed = '';
        pos += kana.length;
        const isFinished = pos >= text.length;
        return { success: true, isMiss: false, charCount: 2, isComplete: true, isFinished, key, typed, inputedRomaji, pos };
      }

      // Vowel or 'y' after 'n'
      if (/^[aiueoy]$/.test(key)) {
        const nextCandidates = getRomajiCandidates(nextKana, kana, null, finalNMode);
        const canContinue = nextCandidates.some(c => c.startsWith('n' + key));
        if (canContinue) {
          typed += key;
          return { success: true, isMiss: false, charCount: 0, isComplete: false, isFinished: false, key, typed, inputedRomaji, pos };
        }
      }

      // Check continuation (e.g. nya, nni)
      const nextCandidates = getRomajiCandidates(nextKana, kana, null, finalNMode) || [];
      const canContinue = (key === 'n' && isNaRow(nextKana)) || nextCandidates.some(c => c.startsWith('n' + key));
      if (canContinue) {
        typed += key;
        return { success: true, isMiss: false, charCount: 0, isComplete: false, isFinished: false, key, typed, inputedRomaji, pos };
      }

      // Check auto-forwarding consonant to next kana
      const nextNextCandidates = getRomajiCandidates(nextKana, kana, null, finalNMode) || [];
      const canStartNext = /^[a-z]$/.test(key) && nextNextCandidates.some(c => c.startsWith(key));

      if (canStartNext) {
        inputedRomaji += 'n';
        pos += kana.length;

        // Check if the forwarded key immediately completes the next kana (e.g. "ん" + "い" with "i")
        const nextKanaNow = getKana(text, pos);
        const nextCandidatesNow = getCandidatesForKana(text, pos, { finalNMode }) || [];
        const completesNow = nextCandidatesNow.some(c => c === key);

        if (completesNow && nextKanaNow) {
          inputedRomaji += key;
          pos += nextKanaNow.length;
          typed = '';
          const isFinished = pos >= text.length;
          return { success: true, isMiss: false, charCount: 2, isComplete: true, isFinished, key, typed, inputedRomaji, pos };
        }

        typed = key;
        const isFinished = pos >= text.length;
        return { success: true, isMiss: false, charCount: 1, isComplete: true, isFinished, key, typed, inputedRomaji, pos };
      }

      return { success: false, isMiss: true, charCount: 0, isComplete: false, isFinished: false, key, typed, inputedRomaji, pos };
    }

    // typed is empty, first 'n'
    if (key === 'n') {
      typed = 'n';
      return { success: true, isMiss: false, charCount: 0, isComplete: false, isFinished: false, key, typed, inputedRomaji, pos };
    }
  }

  // =========================================================
  // 2. Sokuon ("っ") handling
  // =========================================================
  if (isSmallTsu(kana)) {
    const nextTyped = typed + key;
    const match = candidates.some(r => r.startsWith(nextTyped));

    if (!match) {
      return { success: false, isMiss: true, charCount: 0, isComplete: false, isFinished: false, key, typed, inputedRomaji, pos };
    }

    typed = nextTyped;
    const complete = candidates.some(r => r === typed);

    if (complete) {
      inputedRomaji += typed;
      const confirmedCharCount = typed.length;
      const nextKana = getKana(text, pos + kana.length);
      pos += kana.length;

      // Consonant doubling consumes both "っ" and the following kana
      if (typed.length > 1 && typed !== 'ltu' && typed !== 'xtu') {
        if (nextKana) pos += nextKana.length;
      }

      typed = '';
      const isFinished = pos >= text.length;
      return { success: true, isMiss: false, charCount: confirmedCharCount, isComplete: true, isFinished, key, typed, inputedRomaji, pos };
    } else {
      return { success: true, isMiss: false, charCount: 0, isComplete: false, isFinished: false, key, typed, inputedRomaji, pos };
    }
  }

  // =========================================================
  // 3. Regular kana and symbol handling
  // =========================================================
  const nextTyped = typed + key;

  if (!candidates || candidates.length === 0) {
    return { success: false, isMiss: true, charCount: 0, isComplete: false, isFinished: false, key, typed, inputedRomaji, pos };
  }

  const match = candidates.some(r => r.startsWith(nextTyped));
  if (!match) {
    return { success: false, isMiss: true, charCount: 0, isComplete: false, isFinished: false, key, typed, inputedRomaji, pos };
  }

  typed = nextTyped;
  const complete = candidates.some(r => r === typed);

  if (complete) {
    inputedRomaji += typed;
    const confirmedCharCount = typed.length;
    const nextKana = getKana(text, pos + kana.length);
    pos += kana.length;

    if (isSmallTsu(kana) && nextKana) {
      const firstChar = typed[0];
      if (typed.length > 1 && firstChar !== 'l' && firstChar !== 'x') {
        pos += nextKana.length;
      }
    }

    typed = '';
    const isFinished = pos >= text.length;
    return { success: true, isMiss: false, charCount: confirmedCharCount, isComplete: true, isFinished, key, typed, inputedRomaji, pos };
  } else {
    return { success: true, isMiss: false, charCount: 0, isComplete: false, isFinished: false, key, typed, inputedRomaji, pos };
  }
}

/**
 * Stateful typing session manager.
 */
export class TypingSession {
  /**
   * @param {string} text - Target text to type (hiragana, symbols, etc.)
   * @param {Object} [options={}]
   * @param {'nn'|'n'} [options.finalNMode='nn']
   */
  constructor(text, options = {}) {
    this.text = text || '';
    this.pos = 0;
    this.typed = '';
    this.inputedRomaji = '';
    this.options = { finalNMode: 'nn', ...options };
    this.isFinished = (this.text.length === 0);
  }

  /**
   * Evaluates a keystroke and updates the session state if valid.
   *
   * @param {string|KeyboardEvent} keyOrEvent
   * @returns {EvaluationResult}
   */
  input(keyOrEvent) {
    const rawKey = typeof keyOrEvent === 'string' ? keyOrEvent : (keyOrEvent?.key ?? '');
    const res = evaluateKey(rawKey, {
      text: this.text,
      pos: this.pos,
      typed: this.typed,
      inputedRomaji: this.inputedRomaji
    }, this.options);

    if (res.success) {
      this.pos = res.pos;
      this.typed = res.typed;
      this.inputedRomaji = res.inputedRomaji;
      this.isFinished = res.isFinished;
    }

    return res;
  }

  /**
   * Returns current full display romaji string.
   * @returns {string}
   */
  getDisplayRoma() {
    return getDisplayFullRoma({
      text: this.text,
      pos: this.pos,
      typed: this.typed,
      inputedRomaji: this.inputedRomaji,
      finalNMode: this.options.finalNMode
    });
  }

  /**
   * Returns current kana at cursor position.
   * @returns {string|null}
   */
  getCurrentKana() {
    return getKana(this.text, this.pos);
  }

  /**
   * Returns current candidates at cursor position.
   * @returns {string[]}
   */
  getCurrentCandidates() {
    return getCandidatesForKana(this.text, this.pos, this.options);
  }

  /**
   * Returns current typing progress details.
   */
  getProgress() {
    return {
      pos: this.pos,
      textLength: this.text.length,
      typedLength: this.inputedRomaji.length + this.typed.length,
      isFinished: this.isFinished
    };
  }

  /**
   * Resets the session with the same or new text.
   * @param {string} [text=this.text]
   */
  reset(text = this.text) {
    this.text = text || '';
    this.pos = 0;
    this.typed = '';
    this.inputedRomaji = '';
    this.isFinished = (this.text.length === 0);
  }
}

