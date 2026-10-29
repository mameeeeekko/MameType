// enemyFontSize.js
// 敵の文字サイズ（小・中・大）の設定状態を管理するモジュール

export const ENEMY_FONT_SIZE_KEYS = Object.freeze(["small", "medium", "large", "xlarge"]);
export const ENEMY_FONT_SIZE_LABELS = Object.freeze(["小", "中", "大", "特大"]);
export const ENEMY_FONT_SIZE_PIXELS = Object.freeze({
  small: 17,
  medium: 19,
  large: 21,
  xlarge: 23,
});

export const ENEMY_FONT_SIZE_KEY = "enemyFontSize";
export const ENEMY_FONT_SIZE_CHANGED_EVENT = "mametype-enemy-font-size-changed";

let currentEnemyFontSize = "small"; // デフォルトは「小」（現在の17px）

/**
 * 現在の敵文字サイズキーを返す ("small" | "medium" | "large")
 */
export function getEnemyFontSizeKey() {
  return currentEnemyFontSize;
}

/**
 * 現在の敵文字サイズを px で返す
 */
export function getEnemyFontSize() {
  return ENEMY_FONT_SIZE_PIXELS[currentEnemyFontSize];
}

/**
 * 敵文字サイズを変更する。変更済みならカスタムイベントをディスパッチする。
 * @param {string} key - "small" | "medium" | "large"
 */
export function setEnemyFontSize(key) {
  if (!ENEMY_FONT_SIZE_PIXELS[key]) {
    console.warn(`[enemyFontSize] 無効なキー: ${key}`);
    return;
  }
  if (currentEnemyFontSize === key) return;
  const prev = currentEnemyFontSize;
  currentEnemyFontSize = key;
  try {
    window.dispatchEvent(
      new CustomEvent(ENEMY_FONT_SIZE_CHANGED_EVENT, {
        detail: { prev, current: key, px: ENEMY_FONT_SIZE_PIXELS[key] },
      })
    );
  } catch (e) {
    console.warn("[enemyFontSize] イベントディスパッチ失敗:", e);
  }
}

/**
 * localStorage 用に保存値を返す
 */
export function getEnemyFontSizeForSave() {
  return currentEnemyFontSize;
}

/**
 * localStorage から復元した値を適用する（イベントはディスパッチしない）
 * @param {string} key - 保存済みキー
 */
export function loadEnemyFontSize(key) {
  if (key && ENEMY_FONT_SIZE_PIXELS[key]) {
    currentEnemyFontSize = key;
  }
}
