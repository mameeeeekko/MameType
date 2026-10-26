/**
 * @file run-tests.js
 * Comprehensive unit test suite for @mametype/roma-engine.
 * Runs in Node.js, JavaScriptCore (jsc -m), or modern browsers.
 */

import {
  VERSION,
  TypingSession,
  evaluateKey,
  getKana,
  getCandidatesForKana,
  getDisplayFullRoma,
  toHalfWidthAlpha,
  normalizeInputKey,
  ROMA_TABLE
} from '../src/index.js';

if (typeof console === 'undefined') {
  const p = typeof print === 'function' ? print : () => {};
  globalThis.console = {
    log: p,
    error: p,
    warn: p
  };
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    failed++;
    console.error(`❌ FAIL: ${message}`);
    throw new Error(message);
  } else {
    passed++;
    console.log(`✅ PASS: ${message}`);
  }
}

function test(name, fn) {
  console.log(`\n--- Test: ${name} ---`);
  try {
    fn();
  } catch (e) {
    console.error(`Test threw an error:`, e);
  }
}

// =========================================================
// 1. Basic Kana & Multiple Romaji Variations
// =========================================================
test('Basic Kana: a, i, u, e, o', () => {
  const session = new TypingSession('あいうえお');
  assert(session.input('a').success, 'input "a" succeeds');
  assert(session.input('i').success, 'input "i" succeeds');
  assert(session.input('u').success, 'input "u" succeeds');
  assert(session.input('e').success, 'input "e" succeeds');
  const res = session.input('o');
  assert(res.success && res.isFinished, 'input "o" finishes session');
});

test('Multiple Romaji Variations: si / shi / ci for "し"', () => {
  for (const style of ['si', 'shi', 'ci']) {
    const session = new TypingSession('し');
    for (const char of style) {
      assert(session.input(char).success, `input '${char}' for '${style}' succeeds`);
    }
    assert(session.isFinished, `style '${style}' finishes "し"`);
  }
});

test('Multiple Romaji Variations: ti / chi for "ち", tu / tsu for "つ"', () => {
  for (const style of ['ti', 'chi']) {
    const s = new TypingSession('ち');
    for (const c of style) s.input(c);
    assert(s.isFinished, `style '${style}' finishes "ち"`);
  }
  for (const style of ['tu', 'tsu']) {
    const s = new TypingSession('つ');
    for (const c of style) s.input(c);
    assert(s.isFinished, `style '${style}' finishes "つ"`);
  }
});

test('Multiple Romaji Variations: fu / hu for "ふ", ji / zi for "じ"', () => {
  for (const style of ['fu', 'hu']) {
    const s = new TypingSession('ふ');
    for (const c of style) s.input(c);
    assert(s.isFinished, `style '${style}' finishes "ふ"`);
  }
  for (const style of ['ji', 'zi']) {
    const s = new TypingSession('じ');
    for (const c of style) s.input(c);
    assert(s.isFinished, `style '${style}' finishes "じ"`);
  }
});

// =========================================================
// 2. Contracted Sounds (拗音)
// =========================================================
test('Youon: sha, sya, sixya, silya for "しゃ"', () => {
  for (const style of ['sha', 'sya', 'sixya', 'silya']) {
    const s = new TypingSession('しゃ');
    for (const c of style) s.input(c);
    assert(s.isFinished, `style '${style}' finishes "しゃ"`);
  }
});

test('Youon: cha, tya for "ちゃ"', () => {
  for (const style of ['cha', 'tya', 'chilya']) {
    const s = new TypingSession('ちゃ');
    for (const c of style) s.input(c);
    assert(s.isFinished, `style '${style}' finishes "ちゃ"`);
  }
});

// =========================================================
// 3. Sokuon (促音 "っ")
// =========================================================
test('Sokuon: consonant doubling "かった" -> katta', () => {
  const session = new TypingSession('かった');
  assert(session.input('k').success, 'k');
  assert(session.input('a').success, 'a');
  assert(session.input('t').success, 't (begins sokuon)');
  assert(!session.isFinished, 'not finished yet');
  const res = session.input('t');
  assert(res.success, 'second t');
  const res2 = session.input('a');
  assert(res2.success && res2.isFinished, 'katta finished');
  assert(session.inputedRomaji === 'katta', 'inputedRomaji is katta');
});

test('Sokuon: direct small tsu "かった" -> ka-ltu-ta', () => {
  const session = new TypingSession('かった');
  for (const c of 'kaltuta') {
    assert(session.input(c).success, `input ${c} in kaltuta succeeds`);
  }
  assert(session.isFinished, 'kaltuta finished');
});

// =========================================================
// 4. Hatsuon (撥音 "ん")
// =========================================================
test('Hatsuon: Auto-forward consonant "さんぽ" -> s-a-n-p-o', () => {
  const session = new TypingSession('さんぽ');
  session.input('s');
  session.input('a');
  assert(session.input('n').success, 'first n buffered');
  assert(session.typed === 'n', 'typed is "n"');
  // Next is "p" (consonant of "ぽ")
  const res = session.input('p');
  assert(res.success, 'p forwards n and begins po');
  assert(session.typed === 'p', 'typed is now "p"');
  assert(session.inputedRomaji === 'san', 'confirmed "san"');
  session.input('o');
  assert(session.isFinished, 'sanpo finished');
  assert(session.inputedRomaji === 'sanpo', 'final romaji is sanpo');
});

test('Hatsuon: Next vowel support: "かんい"', () => {
  // Pattern 1: standard k-a-n-n-i
  const s1 = new TypingSession('かんい');
  s1.input('k');
  s1.input('a');
  s1.input('n');
  s1.input('n');
  s1.input('i');
  assert(s1.isFinished, 'kanni finishes かんい');

  // Pattern 2: MameType specific 1-stroke auto-completion k-a-n-i
  const s2 = new TypingSession('かんい');
  s2.input('k');
  s2.input('a');
  s2.input('n');
  const res = s2.input('i');
  assert(res.success && s2.isFinished, 'kani also completes かんい via 1-stroke auto-completion');
});

test('Hatsuon: Next is na-row requires "nn": "あんな"', () => {
  const session = new TypingSession('あんな');
  session.input('a');
  session.input('n');
  assert(session.typed === 'n', 'first n buffered');
  // Second 'n' completes 'ん'
  session.input('n');
  assert(session.inputedRomaji === 'ann', 'ann confirmed');
  // Then 'na' for 'な'
  session.input('n');
  session.input('a');
  assert(session.isFinished, 'anna finished');
});

test('Hatsuon: Word-final "ん" with finalNMode="nn" and "n"', () => {
  // mode="nn"
  const s1 = new TypingSession('ほん', { finalNMode: 'nn' });
  s1.input('h');
  s1.input('o');
  s1.input('n');
  assert(!s1.isFinished, 'single n does not finish with finalNMode=nn');
  s1.input('n');
  assert(s1.isFinished, 'double nn finishes with finalNMode=nn');

  // mode="n"
  const s2 = new TypingSession('ほん', { finalNMode: 'n' });
  s2.input('h');
  s2.input('o');
  const res = s2.input('n');
  assert(res.isFinished, 'single n finishes with finalNMode=n');
});

test('Hatsuon: n followed by immediate 1-stroke completion "ん" + "い"', () => {
  // Testing engine.js L161-177: completesNow check
  const state = { text: 'んい', pos: 0, typed: 'n', inputedRomaji: '' };
  const res = evaluateKey('i', state);
  assert(res.success && res.isFinished, 'i completes both ん and い');
  assert(res.charCount === 2, '2 chars confirmed');
  assert(res.inputedRomaji === 'ni', 'inputedRomaji is "ni"');
});

// =========================================================
// 5. Symbols, Full-width & Keyboard Quirks
// =========================================================
test('Symbols & Full-width normalization', () => {
  // Zenkaku digits
  const s1 = new TypingSession('１２３');
  for (const c of '123') s1.input(c);
  assert(s1.isFinished, 'half-width 123 matches full-width １２３');

  // Arrow symbol "→"
  const s2 = new TypingSession('→');
  s2.input('-');
  assert(!s2.isFinished, '- entered');
  s2.input('>');
  assert(s2.isFinished, '-> finishes →');

  // Mac JIS Shift+^ quirks
  const s3 = new TypingSession('~');
  assert(s3.input('〜').success && s3.isFinished, 'wave dash 〜 matches ~');

  const s4 = new TypingSession('~');
  assert(s4.input('‾').success && s4.isFinished, 'overline ‾ matches ~');

  // Full-width yen
  const s5 = new TypingSession('¥');
  assert(s5.input('￥').success && s5.isFinished, 'full-width ￥ matches ¥');
});

// =========================================================
// 6. Dynamic Display Sync
// =========================================================
test('Display Romaji dynamically updates with user input', () => {
  const session = new TypingSession('し');
  assert(session.getDisplayRoma() === 'si', 'initial default display is "si"');
  session.input('s');
  session.input('h');
  assert(session.getDisplayRoma() === 'shi', 'after typing "sh", display updates to "shi"');
  session.input('i');
  assert(session.isFinished, 'shi finishes');
});

// =========================================================
// 7. Error & Buffer Handling
// =========================================================
test('Miss typing preserves buffer', () => {
  const session = new TypingSession('とうきょう');
  session.input('t');
  assert(session.typed === 't', 'typed is "t"');
  const miss = session.input('x');
  assert(miss.isMiss, 'typing "x" is miss');
  assert(session.typed === 't', 'buffer "t" is preserved after miss');
  assert(session.input('o').success, 'typing "o" completes "to"');
  assert(session.inputedRomaji === 'to', 'confirmed "to"');
});

// =========================================================
// 8. Version Management
// =========================================================
test('Version Constant', () => {
  assert(typeof VERSION === 'string', 'VERSION is exported as string');
  assert(VERSION === '1.0.0', 'VERSION equals "1.0.0"');
});

console.log(`\n========================================`);
console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
console.log(`========================================`);

if (failed > 0) {
  throw new Error(`${failed} tests failed`);
}
