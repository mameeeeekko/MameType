// enemyModeConfig.js

import { devOverride, applyOverride } from "../dev/devOverride.js";

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
        limit: null,      // 出現上限（null = 無限）
        maxAlive: null,   // 同時出現上限（null = 無限）
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
        survive: null,
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
    },

};

// ===============================
// ステージ条件表示用テキスト
//
//================================

export function buildEndText(end) {
  const lines = [];
  if (!end) return lines;

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
  if (!clear) return lines;

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

// DEVツールのためのステージ取得用関数
export function getStageConfig(stageId) {
  let stage = STAGES[stageId];
  if (!stage) return null;

  // フェーズがある場合は現在のフェーズ（または初期フェーズ）をベースにする仕組みが必要ならここで調整
  // 今回はCore側でフェーズを切り替えるため、オブジェクト全体を返す

  // 全体override
  if (devOverride.stage.global) {
    stage = applyOverride(stage, devOverride.stage.global);
  }

  return stage;
}

// =========================================================================
// ステージ設定リファレンス
// =========================================================================
/*
STAGES = {
  ステージID: {
    // ---------------------------
    // 敵出現設定
    // ---------------------------
    spawn: {
      interval: 2000,   // 出現間隔(ms)
      limit: 10,        // 総出現数上限
                           // null = 無限
      maxAlive: 5       // 同時出現上限
                           // null = 無制限
    },
    // ---------------------------
    // アイテム出現設定（省略可）
    // ---------------------------
    itemSpawn: {
      interval: 5000,   // 出現間隔(ms)
      chance: 0.5,      // 出現確率 0.0 ～ 1.0
      limit: 10,        // 総出現数上限 null = 無限
      maxAlive: 1       // 同時存在数上限 null = 無制限
    },
    // ---------------------------
    // 敵出現テーブル
    // ---------------------------
    enemyTable: [
      { type: "SLIME",  weight: 70 },
      { type: "GOBLIN", weight: 20 },
      { type: "OGRE",   weight: 10 }
    ],
    // enemy type 一覧
    // SLIME GOBLIN OGRE BOSS
    // ※ enemyData.js に定義された敵を追加可能

    // ---------------------------
    // アイテム出現テーブル
    // ---------------------------
    itemTable: [
      { type: "FREEZE", weight: 50 },
      { type: "BOMB",   weight: 50 }
    ],

    // item type 一覧
    //
    // FREEZE      : 敵凍結
    // BOMB        : 単体爆弾
    // BOMB_ALL    : 全体爆弾
    // HEAL_SMALL  : HP少量回復
    // HEAL_FULL   : HP全回復
    // SKILL_CD    : スキルCT短縮
    //
    // ※ itemData.js に定義されたアイテムを追加可能

    // ---------------------------
    // ゲーム終了条件
    // ---------------------------
    endConditions: {
      hpZero: true,              // プレイヤーHP0で終了
      timerMs: 30000,            // 制限時間終了で終了 null = 無効
      killCount: 10,             // 指定撃破数到達で終了 null = 無効
      allSpawnedDefeated: true   // 出現した敵を全滅で終了 spawn.limit と組み合わせて使う
    },
    // ---------------------------
    // クリア条件
    // ---------------------------
    clearConditions: {
      killCount: 10,             // 指定数撃破でクリア
      timerMs: 30000,            // 制限時間以内クリア
      survive: true              // 生存していればクリア
    },
    // ---------------------------
    // 星評価条件
    // ---------------------------
    star: {
      type: "typingSpeed",
      thresholds: [
        100,
        150,
        200,
        250,
        300
      ]
    }
  }
}

===============================
star.type 一覧
===============================
typingSpeed → KPM評価
  thresholds: [100,150,200,250,300]

clearTime → クリア時間評価(ms)
  thresholds: [70000,60000,50000,40000,30000]

accuracy → 正確率評価(0～1)
  thresholds: [0.2,0.4,0.6,0.8,0.9]

killCount → 撃破数評価
  thresholds: [10,20,30,40,50]

composite → 総合評価(0～1)
  thresholds: [0.3,0.5,0.7,0.8,0.9]

timeRemaining → 残り時間率(0～1)

hpRemaining → 残りHP率(0～1)
*/
//===================================================================================

export const STAGES = {

  DAILY: {
    spawn: {
      interval: 2000,
      limit: null,
      maxAlive: null,
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
      killCount: 10,
    },
    star: {
      type: "typingSpeed",
      thresholds: [100,150,200, 250, 300]
    }
  },

  // フェーズテスト用
  PHASE_TEST: {
    phases: [
      {
        name: "",
        spawn: {
          interval: 1500,
          limit: 5,
        },
        enemyTable: [{ type: "SLIME", weight: 100 }],
        phaseConditions: { allSpawnedDefeated: true }
      },
      {
        name: "phase2",
        bgm: "bgm_enemy2", 
        spawn: {
          interval: 800,
          limit: 8,
        },
        enemyTable: [{ type: "GOBLIN", weight: 100 }],
        itemSpawn: {
          interval: 5000,
          chance: 0.9,
          limit: null,
          maxAlive: 1,
        },
        itemTable: [
          { type: "HEAL_SMALL", weight: 10 },
          { type: "FREEZE", weight: 40 },
          { type: "BOMB", weight: 10 },
          { type: "BOMB_ALL", weight: 10 },
          { type: "HEAL_FULL", weight: 10 },
          { type: "SKILL_CD", weight: 20 },
        ],
        phaseConditions: { timerMs: 30000 }
      },
      {
        name: "phase3",
        bgm: "bgm_enemy3", 
        spawn: {
          interval: 2000,
          limit: 1,
        },
        enemyTable: [{ type: "BOSS", weight: 100 }],
        phaseConditions: { allSpawnedDefeated: true }
      }
    ],
    endConditions: {
      hpZero: true,
    },
    clearConditions: {
      killCount: 9, 
    },
    star: {
      type: "typingSpeed",
      thresholds: [100, 200, 300, 400, 500]
    }
  },

  STAGE1: {
    spawn: {
      interval: 2000,
      limit: 10,
      maxAlive: null,
    },
    itemSpawn: {
      interval: 5000,
      chance: 0.9,
      limit: null,
      maxAlive: 1,
    },
    enemyTable: [
      { type: "SLIME", weight: 70 },
      { type: "GOBLIN", weight: 30 }
    ],
    itemTable: [
      { type: "HEAL_SMALL", weight: 10 },
      { type: "FREEZE", weight: 40 },
      { type: "BOMB", weight: 10 },
      { type: "BOMB_ALL", weight: 10 },
      { type: "HEAL_FULL", weight: 10 },
      { type: "SKILL_CD", weight: 20 },
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
    },

  },

  STAGE2: {
    spawn: {
      interval: 1500,
      limit: 27,
      maxAlive: null,
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
      limit: null,
      maxAlive: null,
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

  STAGE4: {
    spawn: {
      interval: 1000,
      limit: null,
      maxAlive: null,
    },
    enemyTable: [
      { type: "SLIME", weight: 40 },
      { type: "GOBLIN", weight: 40 },
      { type: "OGRE", weight: 20 },
      { type: "BOSS", weight: 5 }
    ],
    endConditions: {
        hpZero: true,
        killCount: 15,
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

  BOSS1: {
    spawn: {
      interval: 1000,
      limit: 1,
      maxAlive: null,
    },
    enemyTable: [
      { type: "BOSS", weight: 100 }
    ],
    endConditions: {
        hpZero: true,
        killCount: null,
        allSpawnedDefeated: true,
    },
    clearConditions: {
        timerMs:15000
    },
    star: {
      type: "accuracy",
      thresholds: [0.2, 0.4, 0.6, 0.8, 0.9]
    }
  },
  
};
