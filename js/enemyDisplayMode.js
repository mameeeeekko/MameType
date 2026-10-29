// enemyDisplayMode.js
// 敵の下行表示モード（ローマ字 / ひらがな）の設定状態を管理するモジュール

export const ENEMY_DISPLAY_MODE_KEYS = Object.freeze(["roma", "hiragana"]);
export const ENEMY_DISPLAY_MODE_LABELS = Object.freeze(["ローマ字", "ひらがな"]);

export const ENEMY_DISPLAY_MODE_KEY = "enemyDisplayMode";
export const ENEMY_DISPLAY_MODE_CHANGED_EVENT = "mametype-enemy-display-mode-changed";

let currentEnemyDisplayMode = "roma"; // デフォルトは「ローマ字表示」

/**
 * 現在の敵表示モードキーを返す ("roma" | "hiragana")
 */
export function getEnemyDisplayModeKey() {
  return currentEnemyDisplayMode;
}

/**
 * 敵表示モードを変更する。変更済みならカスタムイベントをディスパッチする。
 * @param {string} key - "roma" | "hiragana"
 */
export function setEnemyDisplayMode(key) {
  if (!ENEMY_DISPLAY_MODE_KEYS.includes(key)) {
    console.warn(`[enemyDisplayMode] 無効なキー: ${key}`);
    return;
  }
  if (currentEnemyDisplayMode === key) return;
  const prev = currentEnemyDisplayMode;
  currentEnemyDisplayMode = key;
  try {
    window.dispatchEvent(
      new CustomEvent(ENEMY_DISPLAY_MODE_CHANGED_EVENT, {
        detail: { prev, current: key },
      })
    );
  } catch (e) {
    console.warn("[enemyDisplayMode] イベントディスパッチ失敗:", e);
  }
}

/**
 * localStorage 用に保存値を返す
 */
export function getEnemyDisplayModeForSave() {
  return currentEnemyDisplayMode;
}

/**
 * localStorage から復元した値を適用する（イベントはディスパッチしない）
 * @param {string} key - 保存済みキー
 */
export function loadEnemyDisplayMode(key) {
  if (key && ENEMY_DISPLAY_MODE_KEYS.includes(key)) {
    currentEnemyDisplayMode = key;
  }
}