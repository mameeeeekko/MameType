// romaUtils.js
// @mametype/roma-engine へのブリッジ / アダプターモジュール
// ライブラリ側の変更（packages/mame-roma-engine/src/）は自動的にMameType本体へ反映されます。

export {
  ROMA_TABLE,
  SYMBOL_TABLE,
  isSmallTsu,
  isSymbol,
  isN,
  isNaRow,
  toHalfWidthAlpha,
  getKana,
  getSokuonCandidates
} from '../packages/mame-roma-engine/src/index.js';

import { getRomajiCandidates as _getRomajiCandidates } from '../packages/mame-roma-engine/src/index.js';

/**
 * ローマ字候補取得（localStorage からの final_n_mode 読み込みを含む互換ラッパー）
 */
export function getRomajiCandidates(kana, prevKana = null, nextKana = null) {
  let mode = 'nn';
  try {
    mode = localStorage.getItem('final_n_mode') || 'nn';
  } catch (e) {
    // localStorage 取得失敗時はデフォルト 'nn'
  }
  return _getRomajiCandidates(kana, prevKana, nextKana, mode);
}
