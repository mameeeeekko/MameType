// difficulties.js
export const DIFFICULTIES = {
  easy: {
    id: "easy",
    name: "EASY",

    // 通常モード専用
    basic: {
      min: 2,
      max: 7
    },

    // エネミーモード専用
    enemy: {
      spawnRate: 1.3,
      enemySpeed: 0.8,
      damageMultiplier: 0.7,
      chainDecay: 0.7,
      scoreMultiplier: 0.8,

      scoreBonus: {
        clearBonus: 0.1,   // +0.10倍
        noMissBonus: 0.2,  // +0.20倍
        noDamageBonus: 0.1  // +0.10倍
      }
    }
  },

  normal: {
    id: "normal",
    name: "NORMAL",

    basic: {
      min: 9,
      max: 20
    },

    enemy: {
      spawnRate: 1.0,
      enemySpeed: 1.0,
      damageMultiplier: 1.0,
      chainDecay: 1.0,
      scoreMultiplier: 1.0,

      scoreBonus: {
        clearBonus: 0.2,   // +0.20倍 (基準値)
        noMissBonus: 0.4,  // +0.40倍 (基準値)
        noDamageBonus: 0.2  // +0.20倍 (基準値)
      }
    }
  },

  hard: {
    id: "hard",
    name: "HARD",

    basic: {
      min: 12,
      max: 999
    },

    enemy: {
      spawnRate: 0.7,
      enemySpeed: 1.2,
      damageMultiplier: 1.3,
      chainDecay: 1.3,
      scoreMultiplier: 1.2,

      scoreBonus: {
        clearBonus: 0.3,   // +0.30倍
        noMissBonus: 0.6,  // +0.60倍
        noDamageBonus: 0.3  // +0.30倍
      }
    }
  }
};

const STORAGE_KEYS = {
  free: "difficulty_free",
  daily: "difficulty_daily",
  quest: "difficulty_quest",
  "free-enemy": "difficulty_free_enemy" // ★追加
};

const currentDifficultyMap = {
  free: getDifficulty(localStorage.getItem(STORAGE_KEYS.free) || "normal"),
  daily: getDifficulty(localStorage.getItem(STORAGE_KEYS.daily) || "normal"),
  quest: getDifficulty(localStorage.getItem(STORAGE_KEYS.quest) || "normal"),
  "free-enemy": getDifficulty(localStorage.getItem(STORAGE_KEYS["free-enemy"]) || "normal"), // ★追加
};

//共通取得
export function getDifficulty(id) {
  return DIFFICULTIES[id] ?? DIFFICULTIES.normal;
}

export function getDifficultyById(id) {
  return DIFFICULTIES[id] || DIFFICULTIES.normal;
}

// ===============================
// クエスト用：現在難易度（完全一元管理）
// ===============================

const STORAGE_KEY = "questDifficulty";

// ★ 初期化時に1回だけ読む
let currentDifficulty = getDifficulty(
  localStorage.getItem(STORAGE_KEY) || "normal"
);

// -------------------------------
// 現在の難易度取得
// -------------------------------
export function getCurrentDifficulty(scope = "free") {
  return currentDifficultyMap[scope] ?? DIFFICULTIES.normal;
}

// -------------------------------
// 難易度変更
// -------------------------------
export function setCurrentDifficulty(id, scope = "free") {
  const diff = getDifficulty(id);

  currentDifficultyMap[scope] = diff;
  localStorage.setItem(STORAGE_KEYS[scope], diff.id);
}


// -------------------------------
// 難易度説明関数
// -------------------------------
export function getDifficultyDescription(diff, mode) {

    if (mode === "standard" || mode === "timeattack") {
      return `
文字数 ${diff.basic.min}～${diff.basic.max === 999 ? "∞" : diff.basic.max}
`;
    }

        if (mode === "enemy") {

          return `
          敵出現間隔 ${(diff.enemy.spawnRate * 100).toFixed(0)}%  / 敵速度 ${(diff.enemy.enemySpeed * 100).toFixed(0)}%  / 被ダメージ ${(diff.enemy.damageMultiplier * 100).toFixed(0)}%  / Chain減衰 ${(diff.enemy.chainDecay * 100).toFixed(0)}%  / Score ×${diff.enemy.scoreMultiplier.toFixed(1)}

          CLEAR +${(diff.enemy.scoreBonus.clearBonus * 100).toFixed(0)}%  / NO MISS +${(diff.enemy.scoreBonus.noMissBonus * 100).toFixed(0)}%  / NO DMG +${(diff.enemy.scoreBonus.noDamageBonus * 100).toFixed(0)}%
          `;
        }

          return "";
  }