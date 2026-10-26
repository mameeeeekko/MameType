// typingLogic.js
// =====================================================
// タイピング判定・ローマ字生成ロジック
// @mametype/roma-engine へのブリッジ / アダプターモジュール
// ライブラリ側の変更（packages/mame-roma-engine/src/）は自動的にMameType本体へ反映されます。
// =====================================================

export {
  buildBaseRomaji,
  buildRemainingRomajiDynamic
} from '../packages/mame-roma-engine/src/index.js';

import { getDisplayFullRoma as _getDisplayFullRoma } from '../packages/mame-roma-engine/src/index.js';

/**
 * 表示用フルローマ字生成（final_n_mode設定の動的注入に対応）
 */
export function getDisplayFullRoma({ text, pos, typed, inputedRomaji }) {
  let mode = 'nn';
  try {
    mode = localStorage.getItem('final_n_mode') || 'nn';
  } catch (e) {
    // localStorage 取得失敗時はデフォルト 'nn'
  }
  return _getDisplayFullRoma({ text, pos, typed, inputedRomaji, finalNMode: mode });
}

/**
 * 敵用表示ローマ字
 */
export function getDisplayRomaForEnemy(enemy, getDisplayFullRomaFn = getDisplayFullRoma) {
  return getDisplayFullRomaFn({
    text: enemy.text,
    pos: enemy.pos,
    typed: enemy.typed || "",
    inputedRomaji: enemy.inputedRomaji || ""
  });
}
