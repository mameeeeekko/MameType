// enemyModeConfig.js

// =====================================================
// エネミーモードの「調整用パラメータ」をすべて集約
// =====================================================

export const ENEMY_MODE_CONFIG = {

    // ===============================
    // プレイヤー（固定ステータス）
    // ===============================
    player: {
        level: 1,
        maxHp: 40,
        defense: 0,
        radius: 20
    },
    // ===============================
    // 敵スポーン
    // ===============================
    spawn: {
        interval: 2000,   // 出現間隔(ms)
        limit: null       // 出現上限（null = 無限）
    },
    // ===============================
    // 終了条件
    // ===============================
    // 終了条件
    endConditions: {
        hpZero: true,
        timerMs: null,
        killCount: 5,
        allSpawnedDefeated: false
    },
    //クリア条件
    clearConditions: {
        explain: null,
        killCount: 5,
        timerMs: null
    },
    // ===============================
    // チェインシステム
    // ===============================
    chain: {
        maxBar: 5000,
        decayRate: 0.9, // 1msあたり減少割合
        gainOnKill: 1500, // 敵撃破で増える量
        missPenalty: 600, // ミス1回で減る量
        gainOnType: 300, // 1文字あたりの増加量

        // チェイン倍率テーブル（上から評価）
        multipliers: [
            { count: 100, value: 4.0 },
            { count: 80, value: 3.0 },
            { count: 60, value: 2.5 },
            { count: 50, value: 2.0 },
            { count: 45, value: 1.9 },
            { count: 40, value: 1.8 },
            { count: 35, value: 1.7 },
            { count: 30, value: 1.6 },
            { count: 25, value: 1.5 },
            { count: 20, value: 1.4 },
            { count: 15, value: 1.3 },
            { count: 10, value: 1.2 },
            { count: 3, value: 1.1 }
        ]
    },
    // ===============================
    // スコア計算
    // ===============================
    score: {
        accuracyBase: 0.3, // 0.3〜1.3倍
        chainDivisor: 80, // 50チェインで +1.0倍 
        speedDivisor: 800, // 800KPMで +1.0倍

        clearBonus: 200,
        noMissBonus: 400,
        noDamageBonus: 200,

        // ランク閾値（上から評価）
        rankThresholds: [
            { score: 2000, rank: "S" },
            { score: 1500, rank: "A" },
            { score: 500, rank: "B" },
            { score: 0, rank: "C" }
        ]
    }
};

// ===============================
// ステージ
// star:{
//  type:killCount(キル数), timeRemaining(0-1),hpRemaining(0-1), 
//       accuracy(0-1), clearTime(ms), typingSpeed(100-400), composite(0-1),
//
//================================
export const STAGES = {

  DAILY: {
    spawn: {
      interval: 2000,
      limit: null,
    },
    enemyTable: [
      { type: "SLIME", weight: 50 },
      { type: "GOBLIN", weight: 25 },
      { type: "OGRE", weight: 25 },
    ],
    endConditions: {
      hpZero: true,
      timerMs: 30000,
    },
    clearConditions: {
    },
    star: {
      type: "typingSpeed",
      thresholds: [100,150,200, 250, 300]
    }
  },

  STAGE1: {
    spawn: {
      interval: 2000,
      limit: 10
    },
    enemyTable: [
      { type: "SLIME", weight: 70 },
      { type: "GOBLIN", weight: 30 }
    ],
    endConditions: {
      hpZero: true,
      killCount: 10
    },
    clearConditions: {
      killCount: 10
    },
    star: {
      type: "clearTime",
      thresholds: [70000,60000,50000, 40000, 30000] //ms
    }
  },

  STAGE2: {
    spawn: {
      interval: 1500,
      limit: 8
    },
    enemyTable: [
      { type: "SLIME", weight: 40 },
      { type: "GOBLIN", weight: 40 },
      { type: "OGRE", weight: 20 }
    ],
    endConditions: {
      hpZero: true,
      allSpawnedDefeated: true
    },
    clearConditions: {
      killCount: 5
    },
    star: {
      type: "composite",
      thresholds: [0.3, 0.5, 0.7, 0.8, 0.9]
    }
  },

  STAGE3: {
    spawn: {
      interval: 1500,
      limit: null
    },
    enemyTable: [
      { type: "SLIME", weight: 40 },
      { type: "GOBLIN", weight: 40 },
      { type: "OGRE", weight: 20 },
      { type: "BOSS", weight: 20 }
    ],
    endConditions: {
        timerMs: 30000,
        hpZero: true,
        killCount: 4,
        allSpawnedDefeated: false
    },
    clearConditions: {
        killCount: 4
    },
    star: {
      type: "accuracy",
      thresholds: [0.2, 0.4, 0.6, 0.8, 0.9]
    }
  },
  
};

export function buildEndText(end) {
  const lines = [];

  if (end.timerMs != null) {
    lines.push(`${end.timerMs / 1000}秒で終了`);
  }

  if (end.killCount != null) {
    lines.push(`${end.killCount}体撃破で終了`);
  }

  if (end.allSpawnedDefeated) {
    lines.push("全敵撃破で終了");
  }

  return lines;
}

export function buildClearText(clear) {
  const lines = [];

  if (clear.killCount != null) {
    lines.push(`敵を${clear.killCount}体倒せ`);
  }

  if (clear.timerMs != null) {
    lines.push(`${clear.timerMs / 1000}秒以内にクリア`);
  }

  if (clear.survive != null) {
    lines.push(`生き残れ`);
  }

  return lines;
}

// スター５取得条件
export function buildStarText(star = {}) {
  const lines = [];
  if (!star.type || !star.thresholds) return lines;

  const t = star.thresholds;

  switch (star.type) {

    case "typingSpeed":
      t.forEach((v, i) => {
        lines.push(`★${i+1}: ${v} KPM以上`);
      });
      break;

    case "clearTime":
      t.forEach((v, i) => {
        lines.push(`★${i+1}: ${v/1000}秒以内`);
      });
      break;

    case "accuracy":
      t.forEach((v, i) => {
        lines.push(`★${i+1}: 正確性${Math.round(v*100)}%以上`);
      });
      break;

    case "killCount":
      t.forEach((v, i) => {
        lines.push(`★${i+1}: ${v}体撃破`);
      });
      break;

    case "composite":
      t.forEach((v, i) => {
        lines.push(`★${i+1}: 総合評価 ${Math.round(v*100)}%以上`);
      });
      break;
  }

  return lines;
}
