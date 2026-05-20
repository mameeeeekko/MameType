// devOverride.js
// =====================================================
// デバッグ用「上書きレイヤー」
// 元データは絶対に壊さない
// =====================================================

export const devOverride = {
    stage: {},
    enemy: {},
    player: {},
    gameState: {},
    exp: {
        multiplier: 1
    },
    chain: {},
    other: {},
    map: {
        showAll: false
    },
    spawn: {
        maxAlive: null,
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