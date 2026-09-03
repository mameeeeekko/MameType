// devOverride.js
// =====================================================
// デバッグ用「上書きレイヤー」
// 元データは絶対に壊さない
// =====================================================

export const devOverride = {
    stage: {},
    enemy: {},
    skill: {},
    player: {},
    gameState: {},
    exp: {
        multiplier: 1
    },
    achievements: {
        showAll: false
    },
    chain: {},
    other: {},
    map: {
        showAll: false
    },
    spawn: {
        maxAlive: null,
    },
    stars: {
        maxed: false,        // STARS MAX トグルの状態
        backup: null,        // トグルON時に退避した元の星データ（questStars）
        backupEarned: null,  // トグルON時に退避した累計獲得星数（totalStarsEarned）
    },
    unlockAllSkills: false,
};

// 深いマージ（安全用）
export function applyOverride(base, override = {}) {
  const result = { ...base };

  for (const key in override) {
    if (
      typeof override[key] === "object" &&
      !Array.isArray(override[key])
    ) {
      result[key] = {
        ...result[key],
        ...override[key]
      };
    } else {
      result[key] = override[key];
    }
  }

  return result;
}