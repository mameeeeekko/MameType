// typingLogic.js
// =====================================================
// タイピング判定・ローマ字生成ロジック
// rendererからもinputCoreからも使う
// =====================================================

import {
  getKana,
  getRomajiCandidates,
  getSokuonCandidates,
  isSmallTsu,
  isSymbol,
  SYMBOL_TABLE
} from "./romaUtils.js";
import { getCandidatesForKana } from "./inputCore.js";

export function getDisplayFullRoma({ text, pos, typed, inputedRomaji }) {

  let result = inputedRomaji;
  let i = pos;

  while (i < text.length) {

    const kana = getKana(text, i);

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

    // 記号
    if (isSymbol(kana)) {
      result += SYMBOL_TABLE[kana];
      i += kana.length;
      continue;
    }

    // 促音
    if (isSmallTsu(kana)) {
      const nextKana = getKana(text, i + 1);
      const candidates = getSokuonCandidates(nextKana);

      let sel =
        typed
          ? candidates.find(r => r.startsWith(typed)) || candidates[0]
          : candidates[0];

      result += sel;

      i += (sel.length > 1 && sel !== "ltu" && sel !== "xtu")
        ? kana.length + nextKana.length
        : kana.length;

      continue;
    }

    // 通常かな
    const prevKana = i > 0 ? getKana(text, i - 1) : null;
    const nextKana = getKana(text, i + kana.length);
    const candidates = getRomajiCandidates(kana, prevKana, nextKana);

    let sel =
      typed
        ? candidates.find(r => r.startsWith(typed)) || candidates[0]
        : candidates[0];

    result += sel;
    i += kana.length;
  }

  return result;
}

// ===============================
// ベースローマ字生成
// ===============================
export function buildBaseRomaji(text) {
  let result = "";
  let i = 0;

  while (i < text.length) {
    const kana = getKana(text, i);
    const candidates = getCandidatesForKana(text, i) || [];
    result += candidates[0] || kana;
    i += kana.length;
  }

  return result;
}

// ===============================
// 残りローマ字（動的）
// ===============================
export function buildRemainingRomajiDynamic(text, pos, typed) {
  let result = "";
  let i = pos;
  let remainingTyped = typed;

  while (i < text.length) {
    const kana = getKana(text, i);
    if (!kana) break;

    const candidates = getCandidatesForKana(text, i) || [];

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

        for (let c of candidates) {
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

// ===============================
// 敵用表示ローマ字
// ===============================
export function getDisplayRomaForEnemy(enemy, getDisplayFullRoma) {
  return getDisplayFullRoma({
    text: enemy.text,
    pos: enemy.pos,
    typed: enemy.typed || "",
    inputedRomaji: enemy.inputedRomaji || ""
  });
}