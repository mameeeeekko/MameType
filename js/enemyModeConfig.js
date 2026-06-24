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
        immediateOnClear: false // 敵が全滅した際に即座に次を出すか
    },
    // ===============================
    // 終了条件
    // ===============================
    // 終了条件
    endConditions: {
        hpZero: true,
        timerMs: null,
        killCount: 5,
        allSpawnedDefeated: false,
        failOnMiss: false
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
        accuracyMaxBonus: 0.5, // 0〜0.5倍のボーナス加算
        chainDivisor: 80, // 50チェインで +1.0倍 
        speedDivisor: 800, // 800KPMで +1.0倍

        clearBonus: 0.2,   // +0.2倍 (20%)
        noMissBonus: 0.4,  // +0.4倍 (40%)
        noDamageBonus: 0.2 // +0.2倍 (20%)
    },

};

// ===============================
// ステージ条件表示用テキスト
//
//================================

export function buildEndText(end, playerConfig = null) {
  const lines = [];
  if (!end) return lines;

  if (end.hpZero) {
    lines.push("HPが0になると終了");
  }

  if (end.failOnMiss) {
    lines.push('<span style="color:#ff4d4f;">1回でもミスすると終了</span>');
  }

  if (playerConfig && playerConfig.hpDrainPerSec > 0) {
    lines.push(`<span style="color:#ff4d4f;">毎秒HPが ${Math.floor(playerConfig.hpDrainPerSec)} 減少 (サボタージュ)</span>`);
  }

  if (end.timerMs != null) {
    lines.push(`${Math.round(end.timerMs / 1000)}秒で終了`);
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

  if (clear.noMiss) {
    lines.push("ノーミスでクリアせよ");
  }

  if (clear.timerMs != null) {
    lines.push(`${Math.round(clear.timerMs / 1000)}秒以内にクリア`);
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
        lines.push(`★${i+1}: ${Math.round(v)} KPM以上`);
      });
      break;

    case "clearTime":
      t.forEach((v, i) => {
        lines.push(`★${i+1}: ${Math.round(v/1000)}秒以内`);
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

    case "timeRemaining":
      t.forEach((v, i) => {
        lines.push(`★${i+1}: 残り時間 ${Math.round(v*100)}%以上`);
      });
      break;

    case "hpRemaining":
      t.forEach((v, i) => {
        lines.push(`★${i+1}: 残りHP ${Math.round(v*100)}%以上`);
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
      { type: "SLIME",  weight: 70, pos: { x: 100, y: 100 } }, // pos指定可（省略時はランダム）
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

// =====================================================
// Tier別の敵セット定義 (10ステージごと)
// =====================================================

// --- メイン: 標準セット (Gray多め、徐々に他属性が混ざる) ---
export const ENEMY_TIER_BALANCED = {
    description: "標準構成（Grayタイプ主体）",
    T1:  [{ type: "GRAY_CIRCLE_SMALL", weight: 40 }, { type: "GRAY_SQUARE_SMALL", weight: 30 }, { type: "GRAY_PINWHEEL_SMALL", weight: 20 }, { type: "GRAY_CIRCLE_SMALL_STRIPE", weight: 10 }],
    T2:  [{ type: "GRAY_CIRCLE_NORMAL", weight: 40 }, { type: "GRAY_SQUARE_SMALL_STRIPE", weight: 20 }, { type: "GRAY_PINWHEEL_SMALL_STRIPE", weight: 20 }, { type: "PURPLE_CIRCLE_SMALL", weight: 10 }, { type: "BLUE_PINWHEEL_SMALL", weight: 10 }],
    T3:  [{ type: "GRAY_PINWHEEL_NORMAL", weight: 40 }, { type: "GRAY_SQUARE_NORMAL", weight: 40 }, { type: "PURPLE_SQUARE_NORMAL", weight: 10 }, { type: "BLUE_CIRCLE_NORMAL", weight: 5 }, { type: "GRAY_CIRCLE_SMALL_RING", weight: 5 }],
    T4:  [{ type: "GRAY_SQUARE_LARGE", weight: 40 }, { type: "GRAY_CIRCLE_NORMAL_RING", weight: 10 }, { type: "PINK_CIRCLE_NORMAL", weight: 10 }, { type: "YELLOW_CIRCLE_SMALL", weight: 10 }, { type: "GRAY_PINWHEEL_NORMAL_STRIPE", weight: 25 }, { type: "PURPLE_SQUARE_SMALL_RING", weight: 5 }],
    T5:  [{ type: "GRAY_SQUARE_LARGE_STRIPE", weight: 35 }, { type: "GRAY_CIRCLE_LARGE", weight: 40 }, { type: "PURPLE_PINWHEEL_SMALL", weight: 10 }, { type: "GREEN_SQUARE_SMALL", weight: 10 }, { type: "GRAY_PINWHEEL_NORMAL_RING", weight: 2 }, { type: "BLUE_CIRCLE_NORMAL_RING", weight: 3 }],
    T6:  [{ type: "GRAY_PINWHEEL_NORMAL_RING", weight: 10 }, { type: "GRAY_SQUARE_NORMAL_RING", weight: 10 }, { type: "BLUE_CIRCLE_NORMAL_STRIPE", weight: 20 }, { type: "RED_CIRCLE_SMALL", weight: 10 }, { type: "PURPLE_SQUARE_NORMAL_STRIPE", weight: 20 }, { type: "PINK_SQUARE_NORMAL", weight: 30 }],
    T7:  [{ type: "GRAY_SQUARE_LARGE_RING", weight: 5 }, { type: "GRAY_PINWHEEL_LARGE", weight: 40 }, { type: "PINK_PINWHEEL_LARGE", weight: 10 }, { type: "YELLOW_PINWHEEL_NORMAL", weight: 10 }, { type: "BLUE_SQUARE_LARGE", weight: 5 }, { type: "GRAY_CIRCLE_SMALL", weight: 30 }],
    T8:  [{ type: "GRAY_PINWHEEL_LARGE_RING", weight: 5 }, { type: "GRAY_CIRCLE_LARGE_RING", weight: 5 }, { type: "RED_SQUARE_NORMAL", weight: 10 }, { type: "PURPLE_CIRCLE_LARGE", weight: 10 }, { type: "YELLOW_SQUARE_NORMAL_RING", weight: 5 }, { type: "GRAY_SQUARE_SMALL", weight: 65 }],
    T9:  [{ type: "GRAY_SQUARE_LARGE_RING", weight: 5 }, { type: "RED_PINWHEEL_LARGE", weight: 10 }, { type: "YELLOW_SQUARE_LARGE_RING", weight: 5 }, { type: "GREEN_PINWHEEL_NORMAL_RING", weight: 5 }, { type: "BLUE_PINWHEEL_LARGE_STRIPE", weight: 10 }, { type: "GRAY_PINWHEEL_SMALL", weight: 65 }],
    T10: [{ type: "RED_PINWHEEL_LARGE_RING", weight: 2 }, { type: "GRAY_PINWHEEL_LARGE_RING", weight: 8 }, { type: "PINK_PINWHEEL_LARGE_STRIPE", weight: 10 }, { type: "PURPLE_CIRCLE_LARGE_STRIPE", weight: 10 }, { type: "BLUE_SQUARE_LARGE", weight: 10 }, { type: "GRAY_CIRCLE_NORMAL", weight: 60 }]
};

// --- バリエーション: 英語多め (Purpleの比率が高い) ---
export const ENEMY_TIER_ENGLISH_HEAVY = {
    description: "英語多め（Purpleタイプ混成）",
    T1:  [{ type: "GRAY_CIRCLE_SMALL", weight: 50 }, { type: "PURPLE_CIRCLE_SMALL", weight: 50 }],
    T2:  [{ type: "GRAY_CIRCLE_NORMAL", weight: 25 }, { type: "GRAY_SQUARE_SMALL_STRIPE", weight: 25 }, { type: "PURPLE_PINWHEEL_SMALL", weight: 50 }],
    T3:  [{ type: "GRAY_PINWHEEL_NORMAL", weight: 25 }, { type: "GRAY_SQUARE_NORMAL", weight: 25 }, { type: "PURPLE_SQUARE_NORMAL", weight: 50 }],
    T4:  [{ type: "GRAY_SQUARE_LARGE", weight: 30 }, { type: "GRAY_CIRCLE_NORMAL_RING", weight: 10 }, { type: "PURPLE_SQUARE_SMALL_RING", weight: 20 }, { type: "PURPLE_SQUARE_NORMAL", weight: 40 }],
    T5:  [{ type: "GRAY_SQUARE_LARGE_STRIPE", weight: 25 }, { type: "GRAY_CIRCLE_LARGE", weight: 25 }, { type: "PURPLE_CIRCLE_LARGE", weight: 50 }],
    T6:  [{ type: "GRAY_PINWHEEL_NORMAL_RING", weight: 25 }, { type: "GRAY_SQUARE_NORMAL_RING", weight: 25 }, { type: "PURPLE_CIRCLE_LARGE_STRIPE", weight: 50 }],
    T7:  [{ type: "GRAY_PINWHEEL_LARGE", weight: 30 }, { type: "GRAY_CIRCLE_SMALL", weight: 30 }, { type: "PURPLE_CIRCLE_LARGE_RING", weight: 40 }],
    T8:  [{ type: "GRAY_SQUARE_SMALL", weight: 40 }, { type: "GRAY_PINWHEEL_LARGE_RING", weight: 10 }, { type: "PURPLE_PINWHEEL_LARGE_RING", weight: 50 }],
    T9:  [{ type: "GRAY_PINWHEEL_SMALL", weight: 40 }, { type: "GRAY_SQUARE_LARGE_RING", weight: 10 }, { type: "PURPLE_PINWHEEL_LARGE_STRIPE", weight: 50 }],
    T10: [{ type: "GRAY_CIRCLE_NORMAL", weight: 40 }, { type: "GRAY_PINWHEEL_LARGE_RING", weight: 10 }, { type: "PURPLE_CIRCLE_LARGE_RING", weight: 50 }]
};

// --- バリエーション: 記号多め (Redの比率が高い) ---
export const ENEMY_TIER_SYMBOL_HEAVY = {
    description: "記号多め（Redタイプ混成）",
    T1:  [{ type: "GRAY_CIRCLE_SMALL", weight: 50 }, { type: "RED_CIRCLE_SMALL", weight: 50 }],
    T2:  [{ type: "GRAY_CIRCLE_NORMAL", weight: 25 }, { type: "GRAY_SQUARE_SMALL_STRIPE", weight: 25 }, { type: "RED_PINWHEEL_SMALL", weight: 50 }],
    T3:  [{ type: "GRAY_PINWHEEL_NORMAL", weight: 25 }, { type: "GRAY_SQUARE_NORMAL", weight: 25 }, { type: "RED_SQUARE_NORMAL", weight: 50 }],
    T4:  [{ type: "GRAY_SQUARE_LARGE", weight: 30 }, { type: "GRAY_CIRCLE_NORMAL_RING", weight: 20 }, { type: "RED_CIRCLE_NORMAL", weight: 50 }],
    T5:  [{ type: "GRAY_SQUARE_LARGE_STRIPE", weight: 25 }, { type: "GRAY_CIRCLE_LARGE", weight: 25 }, { type: "RED_PINWHEEL_LARGE", weight: 50 }],
    T6:  [{ type: "GRAY_PINWHEEL_NORMAL_RING", weight: 25 }, { type: "GRAY_SQUARE_NORMAL_RING", weight: 25 }, { type: "RED_PINWHEEL_LARGE_STRIPE", weight: 50 }],
    T7:  [{ type: "GRAY_PINWHEEL_LARGE", weight: 30 }, { type: "GRAY_CIRCLE_SMALL", weight: 20 }, { type: "RED_PINWHEEL_LARGE_RING", weight: 50 }],
    T8:  [{ type: "GRAY_SQUARE_SMALL", weight: 40 }, { type: "GRAY_PINWHEEL_LARGE_RING", weight: 10 }, { type: "RED_CIRCLE_LARGE_RING", weight: 50 }],
    T9:  [{ type: "GRAY_PINWHEEL_SMALL", weight: 40 }, { type: "GRAY_SQUARE_LARGE_RING", weight: 10 }, { type: "RED_PINWHEEL_LARGE_RING", weight: 50 }],
    T10: [{ type: "GRAY_CIRCLE_NORMAL", weight: 30 }, { type: "GRAY_PINWHEEL_LARGE_RING", weight: 10 }, { type: "RED_PINWHEEL_LARGE_RING", weight: 60 }]
};

// --- バリエーション: 擬音多め (Pinkの比率が高い) ---
export const ENEMY_TIER_ONOMATOPOEIA_HEAVY = {
    description: "擬音多め（Pinkタイプ混成）",
    T1:  [{ type: "GRAY_CIRCLE_SMALL", weight: 50 }, { type: "PINK_SQUARE_SMALL", weight: 50 }],
    T2:  [{ type: "GRAY_CIRCLE_NORMAL", weight: 25 }, { type: "GRAY_SQUARE_SMALL_STRIPE", weight: 25 }, { type: "PINK_PINWHEEL_SMALL", weight: 50 }],
    T3:  [{ type: "GRAY_PINWHEEL_NORMAL", weight: 25 }, { type: "GRAY_SQUARE_NORMAL", weight: 25 }, { type: "PINK_CIRCLE_NORMAL", weight: 50 }],
    T4:  [{ type: "GRAY_SQUARE_LARGE", weight: 30 }, { type: "GRAY_CIRCLE_NORMAL_RING", weight: 20 }, { type: "PINK_SQUARE_NORMAL", weight: 50 }],
    T5:  [{ type: "GRAY_SQUARE_LARGE_STRIPE", weight: 25 }, { type: "GRAY_CIRCLE_LARGE", weight: 25 }, { type: "PINK_PINWHEEL_LARGE", weight: 50 }],
    T6:  [{ type: "GRAY_PINWHEEL_NORMAL_RING", weight: 25 }, { type: "GRAY_SQUARE_NORMAL_RING", weight: 25 }, { type: "PINK_PINWHEEL_LARGE_STRIPE", weight: 50 }],
    T7:  [{ type: "GRAY_PINWHEEL_LARGE", weight: 30 }, { type: "GRAY_CIRCLE_SMALL", weight: 30 }, { type: "PINK_PINWHEEL_LARGE_RING", weight: 40 }],
    T8:  [{ type: "GRAY_SQUARE_SMALL", weight: 40 }, { type: "GRAY_PINWHEEL_LARGE_RING", weight: 10 }, { type: "PINK_CIRCLE_LARGE_RING", weight: 50 }],
    T9:  [{ type: "GRAY_PINWHEEL_SMALL", weight: 40 }, { type: "GRAY_SQUARE_LARGE_RING", weight: 10 }, { type: "PINK_PINWHEEL_LARGE_RING", weight: 50 }],
    T10: [{ type: "GRAY_CIRCLE_NORMAL", weight: 40 }, { type: "GRAY_PINWHEEL_LARGE_RING", weight: 10 }, { type: "PINK_PINWHEEL_LARGE_RING", weight: 50 }]
};

// --- バリエーション: 句読点多め (Greenの比率が高い) ---
export const ENEMY_TIER_PUNCTUATION_HEAVY = {
    description: "句読点多め（Greenタイプ混成）",
    T1:  [{ type: "GRAY_CIRCLE_SMALL", weight: 50 }, { type: "GREEN_SQUARE_SMALL", weight: 50 }],
    T2:  [{ type: "GRAY_CIRCLE_NORMAL", weight: 25 }, { type: "GRAY_SQUARE_SMALL_STRIPE", weight: 25 }, { type: "GREEN_PINWHEEL_SMALL", weight: 50 }],
    T3:  [{ type: "GRAY_PINWHEEL_NORMAL", weight: 25 }, { type: "GRAY_SQUARE_NORMAL", weight: 25 }, { type: "GREEN_PINWHEEL_NORMAL", weight: 50 }],
    T4:  [{ type: "GRAY_SQUARE_LARGE", weight: 30 }, { type: "GRAY_CIRCLE_NORMAL_RING", weight: 20 }, { type: "GREEN_SQUARE_NORMAL", weight: 50 }],
    T5:  [{ type: "GRAY_SQUARE_LARGE_STRIPE", weight: 25 }, { type: "GRAY_CIRCLE_LARGE", weight: 25 }, { type: "GREEN_CIRCLE_LARGE", weight: 50 }],
    T6:  [{ type: "GRAY_PINWHEEL_NORMAL_RING", weight: 25 }, { type: "GRAY_SQUARE_NORMAL_RING", weight: 25 }, { type: "GREEN_CIRCLE_LARGE_STRIPE", weight: 50 }],
    T7:  [{ type: "GRAY_PINWHEEL_LARGE", weight: 30 }, { type: "GRAY_CIRCLE_SMALL", weight: 30 }, { type: "GREEN_CIRCLE_LARGE_RING", weight: 40 }],
    T8:  [{ type: "GRAY_SQUARE_SMALL", weight: 40 }, { type: "GRAY_PINWHEEL_LARGE_RING", weight: 10 }, { type: "GREEN_PINWHEEL_LARGE_RING", weight: 50 }],
    T9:  [{ type: "GRAY_PINWHEEL_SMALL", weight: 40 }, { type: "GRAY_SQUARE_LARGE_RING", weight: 10 }, { type: "GREEN_CIRCLE_LARGE_RING", weight: 50 }],
    T10: [{ type: "GRAY_CIRCLE_NORMAL", weight: 40 }, { type: "GRAY_PINWHEEL_LARGE_RING", weight: 10 }, { type: "GREEN_CIRCLE_LARGE_RING", weight: 50 }]
};

// --- バリエーション: 促音多め (Blueの比率が高い) ---
export const ENEMY_TIER_SOKUON_HEAVY = {
    description: "促音多め（Blueタイプ混成）",
    T1:  [{ type: "GRAY_CIRCLE_SMALL", weight: 50 }, { type: "BLUE_PINWHEEL_SMALL", weight: 50 }],
    T2:  [{ type: "GRAY_CIRCLE_NORMAL", weight: 25 }, { type: "GRAY_SQUARE_SMALL_STRIPE", weight: 25 }, { type: "BLUE_CIRCLE_NORMAL", weight: 50 }],
    T3:  [{ type: "GRAY_PINWHEEL_NORMAL", weight: 25 }, { type: "GRAY_SQUARE_NORMAL", weight: 25 }, { type: "BLUE_CIRCLE_NORMAL_STRIPE", weight: 50 }],
    T4:  [{ type: "GRAY_SQUARE_LARGE", weight: 30 }, { type: "GRAY_CIRCLE_NORMAL_RING", weight: 20 }, { type: "BLUE_CIRCLE_NORMAL_RING", weight: 50 }],
    T5:  [{ type: "GRAY_SQUARE_LARGE_STRIPE", weight: 25 }, { type: "GRAY_CIRCLE_LARGE", weight: 25 }, { type: "BLUE_SQUARE_LARGE", weight: 50 }],
    T6:  [{ type: "GRAY_PINWHEEL_NORMAL_RING", weight: 25 }, { type: "GRAY_SQUARE_NORMAL_RING", weight: 25 }, { type: "BLUE_SQUARE_LARGE_STRIPE", weight: 50 }],
    T7:  [{ type: "GRAY_PINWHEEL_LARGE", weight: 30 }, { type: "GRAY_CIRCLE_SMALL", weight: 30 }, { type: "BLUE_PINWHEEL_LARGE", weight: 40 }],
    T8:  [{ type: "GRAY_SQUARE_SMALL", weight: 40 }, { type: "GRAY_PINWHEEL_LARGE_RING", weight: 10 }, { type: "BLUE_SQUARE_LARGE_RING", weight: 50 }],
    T9:  [{ type: "GRAY_PINWHEEL_SMALL", weight: 40 }, { type: "GRAY_SQUARE_LARGE_RING", weight: 10 }, { type: "BLUE_SQUARE_LARGE_RING", weight: 50 }],
    T10: [{ type: "GRAY_CIRCLE_NORMAL", weight: 40 }, { type: "GRAY_PINWHEEL_LARGE_RING", weight: 10 }, { type: "BLUE_SQUARE_LARGE_RING", weight: 50 }]
};

// --- バリエーション: ことわざ多め (Yellowの比率が高い) ---
export const ENEMY_TIER_PROVERB_HEAVY = {
    description: "ことわざ多め（Yellowタイプ混成）",
    T1:  [{ type: "GRAY_CIRCLE_SMALL", weight: 50 }, { type: "YELLOW_CIRCLE_SMALL", weight: 50 }],
    T2:  [{ type: "GRAY_CIRCLE_NORMAL", weight: 25 }, { type: "GRAY_SQUARE_SMALL_STRIPE", weight: 25 }, { type: "YELLOW_PINWHEEL_SMALL", weight: 50 }],
    T3:  [{ type: "GRAY_PINWHEEL_NORMAL", weight: 25 }, { type: "GRAY_SQUARE_NORMAL", weight: 25 }, { type: "YELLOW_PINWHEEL_NORMAL", weight: 50 }],
    T4:  [{ type: "GRAY_SQUARE_LARGE", weight: 30 }, { type: "GRAY_CIRCLE_NORMAL_RING", weight: 20 }, { type: "YELLOW_SQUARE_LARGE", weight: 50 }],
    T5:  [{ type: "GRAY_SQUARE_LARGE_STRIPE", weight: 25 }, { type: "GRAY_CIRCLE_LARGE", weight: 25 }, { type: "YELLOW_CIRCLE_LARGE", weight: 50 }],
    T6:  [{ type: "GRAY_PINWHEEL_NORMAL_RING", weight: 25 }, { type: "GRAY_SQUARE_NORMAL_RING", weight: 25 }, { type: "YELLOW_SQUARE_LARGE_RING", weight: 50 }],
    T7:  [{ type: "GRAY_PINWHEEL_LARGE", weight: 30 }, { type: "GRAY_CIRCLE_SMALL", weight: 30 }, { type: "YELLOW_PINWHEEL_LARGE", weight: 40 }],
    T8:  [{ type: "GRAY_SQUARE_SMALL", weight: 40 }, { type: "GRAY_PINWHEEL_LARGE_RING", weight: 10 }, { type: "YELLOW_SQUARE_LARGE_RING", weight: 50 }],
    T9:  [{ type: "GRAY_PINWHEEL_SMALL", weight: 40 }, { type: "GRAY_SQUARE_LARGE_RING", weight: 10 }, { type: "YELLOW_SQUARE_LARGE_RING", weight: 50 }],
    T10: [{ type: "GRAY_CIRCLE_NORMAL", weight: 40 }, { type: "GRAY_PINWHEEL_LARGE_RING", weight: 10 }, { type: "YELLOW_SQUARE_LARGE_RING", weight: 50 }]
};

// --- バリエーション: 標準（Gray）のみ ---
export const ENEMY_TIER_GRAY_ONLY = {
    description: "標準（Grayタイプ）のみ",
    T1:  [{ type: "GRAY_CIRCLE_SMALL", weight: 100 }],
    T2:  [{ type: "GRAY_CIRCLE_SMALL", weight: 50 }, { type: "GRAY_SQUARE_SMALL", weight: 50 }],
    T3:  [{ type: "GRAY_CIRCLE_NORMAL", weight: 60 }, { type: "GRAY_CIRCLE_SMALL_STRIPE", weight: 40 }],
    T4:  [{ type: "GRAY_CIRCLE_NORMAL", weight: 50 }, { type: "GRAY_SQUARE_SMALL_STRIPE", weight: 50 }],
    T5:  [{ type: "GRAY_PINWHEEL_NORMAL", weight: 85 }, { type: "GRAY_CIRCLE_SMALL_RING", weight: 15 }],
    T6:  [{ type: "GRAY_SQUARE_LARGE", weight: 60 }, { type: "GRAY_PINWHEEL_NORMAL_STRIPE", weight: 40 }],
    T7:  [{ type: "GRAY_SQUARE_LARGE_STRIPE", weight: 80 }, { type: "GRAY_PINWHEEL_NORMAL_RING", weight: 20 }],
    T8:  [{ type: "GRAY_SQUARE_LARGE_STRIPE", weight: 40 }, { type: "GRAY_PINWHEEL_NORMAL_STRIPE", weight: 40 }, { type: "GRAY_SQUARE_LARGE_RING", weight: 20 }],
    T9:  [{ type: "GRAY_SQUARE_LARGE_STRIPE", weight: 40 }, { type: "GRAY_PINWHEEL_NORMAL_STRIPE", weight: 40 }, { type: "GRAY_SQUARE_LARGE_RING", weight: 20 }],
    T10: [{ type: "GRAY_SQUARE_LARGE_RING", weight: 20 }, { type: "GRAY_PINWHEEL_NORMAL_RING", weight: 10 }, { type: "GRAY_SQUARE_LARGE_STRIPE", weight: 70 }]
};

// --- バリエーション: 英語（Purple）のみ ---
export const ENEMY_TIER_PURPLE_ONLY = {
    description: "英語（Purpleタイプ）のみ",
    T1:  [{ type: "PURPLE_CIRCLE_SMALL", weight: 100 }],
    T2:  [{ type: "PURPLE_CIRCLE_SMALL", weight: 60 }, { type: "PURPLE_PINWHEEL_SMALL", weight: 40 }],
    T3:  [{ type: "PURPLE_SQUARE_NORMAL", weight: 70 }, { type: "PURPLE_CIRCLE_SMALL_RING", weight: 30 }],
    T4:  [{ type: "PURPLE_SQUARE_NORMAL_STRIPE", weight: 60 }, { type: "PURPLE_PINWHEEL_SMALL_STRIPE", weight: 40 }],
    T5:  [{ type: "PURPLE_SQUARE_NORMAL_RING", weight: 50 }, { type: "PURPLE_CIRCLE_LARGE", weight: 50 }],
    T6:  [{ type: "PURPLE_CIRCLE_LARGE_STRIPE", weight: 70 }, { type: "PURPLE_PINWHEEL_SMALL_RING", weight: 30 }],
    T7:  [{ type: "PURPLE_CIRCLE_LARGE_RING", weight: 60 }, { type: "PURPLE_SQUARE_NORMAL_RING", weight: 40 }],
    T8:  [{ type: "PURPLE_CIRCLE_LARGE_RING", weight: 80 }, { type: "PURPLE_CIRCLE_LARGE_STRIPE", weight: 20 }],
    T9:  [{ type: "PURPLE_CIRCLE_LARGE_RING", weight: 60 }, { type: "PURPLE_CIRCLE_LARGE_STRIPE", weight: 40 }],
    T10: [{ type: "PURPLE_CIRCLE_LARGE_RING", weight: 50 }, { type: "PURPLE_CIRCLE_LARGE_STRIPE", weight: 30 }, { type: "PURPLE_PINWHEEL_LARGE", weight: 20 }]
};

// --- バリエーション: ことわざ（Yellow）のみ ---
export const ENEMY_TIER_YELLOW_ONLY = {
    description: "ことわざ（Yellowタイプ）のみ",
    T1:  [{ type: "YELLOW_CIRCLE_SMALL", weight: 100 }],
    T2:  [{ type: "YELLOW_CIRCLE_SMALL", weight: 70 }, { type: "YELLOW_CIRCLE_SMALL_STRIPE", weight: 30 }],
    T3:  [{ type: "YELLOW_PINWHEEL_NORMAL", weight: 80 }, { type: "YELLOW_CIRCLE_SMALL_RING", weight: 20 }],
    T4:  [{ type: "YELLOW_PINWHEEL_NORMAL_STRIPE", weight: 70 }, { type: "YELLOW_SQUARE_LARGE", weight: 30 }],
    T5:  [{ type: "YELLOW_SQUARE_LARGE_STRIPE", weight: 60 }, { type: "YELLOW_CIRCLE_LARGE", weight: 40 }],
    T6:  [{ type: "YELLOW_PINWHEEL_NORMAL_RING", weight: 70 }, { type: "YELLOW_SQUARE_LARGE_RING", weight: 30 }],
    T7:  [{ type: "YELLOW_SQUARE_LARGE_RING", weight: 60 }, { type: "YELLOW_PINWHEEL_NORMAL_RING", weight: 40 }],
    T8:  [{ type: "YELLOW_SQUARE_LARGE_RING", weight: 80 }, { type: "YELLOW_CIRCLE_LARGE", weight: 20 }],
    T9:  [{ type: "YELLOW_SQUARE_LARGE_RING", weight: 60 }, { type: "YELLOW_PINWHEEL_NORMAL_STRIPE", weight: 40 }],
    T10: [{ type: "YELLOW_SQUARE_LARGE_RING", weight: 50 }, { type: "YELLOW_PINWHEEL_LARGE_STRIPE", weight: 30 }, { type: "YELLOW_CIRCLE_LARGE", weight: 20 }]
};

// --- バリエーション: 促音（Blue）のみ ---
export const ENEMY_TIER_BLUE_ONLY = {
    description: "促音（Blueタイプ）のみ",
    T1:  [{ type: "BLUE_PINWHEEL_SMALL", weight: 100 }],
    T2:  [{ type: "BLUE_PINWHEEL_SMALL", weight: 60 }, { type: "BLUE_CIRCLE_NORMAL", weight: 40 }],
    T3:  [{ type: "BLUE_CIRCLE_NORMAL_STRIPE", weight: 70 }, { type: "BLUE_PINWHEEL_SMALL_RING", weight: 30 }],
    T4:  [{ type: "BLUE_CIRCLE_NORMAL_RING", weight: 60 }, { type: "BLUE_SQUARE_NORMAL", weight: 40 }],
    T5:  [{ type: "BLUE_SQUARE_NORMAL_RING", weight: 50 }, { type: "BLUE_SQUARE_LARGE", weight: 50 }],
    T6:  [{ type: "BLUE_SQUARE_LARGE_STRIPE", weight: 70 }, { type: "BLUE_CIRCLE_NORMAL_STRIPE", weight: 30 }],
    T7:  [{ type: "BLUE_PINWHEEL_LARGE", weight: 60 }, { type: "BLUE_SQUARE_LARGE_RING", weight: 40 }],
    T8:  [{ type: "BLUE_SQUARE_LARGE_RING", weight: 80 }, { type: "BLUE_PINWHEEL_LARGE", weight: 20 }],
    T9:  [{ type: "BLUE_SQUARE_LARGE_RING", weight: 60 }, { type: "BLUE_SQUARE_LARGE_STRIPE", weight: 40 }],
    T10: [{ type: "BLUE_SQUARE_LARGE_RING", weight: 50 }, { type: "BLUE_SQUARE_LARGE_STRIPE", weight: 30 }, { type: "BLUE_PINWHEEL_LARGE", weight: 20 }]
};

// --- バリエーション: 擬音（Pink）のみ ---
export const ENEMY_TIER_PINK_ONLY = {
    description: "擬音（Pinkタイプ）のみ",
    T1:  [{ type: "PINK_SQUARE_SMALL", weight: 100 }],
    T2:  [{ type: "PINK_SQUARE_SMALL", weight: 60 }, { type: "PINK_PINWHEEL_SMALL", weight: 40 }],
    T3:  [{ type: "PINK_CIRCLE_NORMAL", weight: 70 }, { type: "PINK_SQUARE_SMALL_STRIPE", weight: 30 }],
    T4:  [{ type: "PINK_CIRCLE_NORMAL_STRIPE", weight: 60 }, { type: "PINK_SQUARE_SMALL_RING", weight: 40 }],
    T5:  [{ type: "PINK_CIRCLE_NORMAL_RING", weight: 50 }, { type: "PINK_PINWHEEL_LARGE", weight: 50 }],
    T6:  [{ type: "PINK_PINWHEEL_LARGE_STRIPE", weight: 70 }, { type: "PINK_CIRCLE_NORMAL_STRIPE", weight: 30 }],
    T7:  [{ type: "PINK_PINWHEEL_LARGE_RING", weight: 60 }, { type: "PINK_PINWHEEL_LARGE_STRIPE", weight: 40 }],
    T8:  [{ type: "PINK_PINWHEEL_LARGE_RING", weight: 80 }, { type: "PINK_CIRCLE_NORMAL_RING", weight: 20 }],
    T9:  [{ type: "PINK_PINWHEEL_LARGE_RING", weight: 60 }, { type: "PINK_PINWHEEL_LARGE_STRIPE", weight: 40 }],
    T10: [{ type: "PINK_PINWHEEL_LARGE_RING", weight: 50 }, { type: "PINK_PINWHEEL_LARGE_STRIPE", weight: 30 }, { type: "PINK_CIRCLE_LARGE", weight: 20 }]
};

// --- バリエーション: 句読点（Green）のみ ---
export const ENEMY_TIER_GREEN_ONLY = {
    description: "句読点（Greenタイプ）のみ",
    T1:  [{ type: "GREEN_SQUARE_SMALL", weight: 100 }],
    T2:  [{ type: "GREEN_SQUARE_SMALL", weight: 60 }, { type: "GREEN_SQUARE_SMALL_STRIPE", weight: 40 }],
    T3:  [{ type: "GREEN_PINWHEEL_NORMAL", weight: 70 }, { type: "GREEN_SQUARE_SMALL_RING", weight: 30 }],
    T4:  [{ type: "GREEN_PINWHEEL_NORMAL_STRIPE", weight: 60 }, { type: "GREEN_CIRCLE_NORMAL_RING", weight: 40 }],
    T5:  [{ type: "GREEN_CIRCLE_LARGE", weight: 50 }, { type: "GREEN_PINWHEEL_NORMAL_RING", weight: 50 }],
    T6:  [{ type: "GREEN_CIRCLE_LARGE_STRIPE", weight: 70 }, { type: "GREEN_PINWHEEL_NORMAL_STRIPE", weight: 30 }],
    T7:  [{ type: "GREEN_CIRCLE_LARGE_RING", weight: 60 }, { type: "GREEN_CIRCLE_LARGE_STRIPE", weight: 40 }],
    T8:  [{ type: "GREEN_CIRCLE_LARGE_RING", weight: 80 }, { type: "GREEN_PINWHEEL_NORMAL_RING", weight: 20 }],
    T9:  [{ type: "GREEN_CIRCLE_LARGE_RING", weight: 60 }, { type: "GREEN_CIRCLE_LARGE_STRIPE", weight: 40 }],
    T10: [{ type: "GREEN_CIRCLE_LARGE_RING", weight: 50 }, { type: "GREEN_CIRCLE_LARGE_STRIPE", weight: 30 }, { type: "GREEN_PINWHEEL_LARGE", weight: 20 }]
};

// --- バリエーション: 記号（Red）のみ ---
export const ENEMY_TIER_RED_ONLY = {
    description: "記号（Redタイプ）のみ",
    T1:  [{ type: "RED_CIRCLE_SMALL", weight: 100 }],
    T2:  [{ type: "RED_CIRCLE_SMALL", weight: 60 }, { type: "RED_PINWHEEL_SMALL", weight: 40 }],
    T3:  [{ type: "RED_SQUARE_NORMAL", weight: 70 }, { type: "RED_CIRCLE_SMALL_STRIPE", weight: 30 }],
    T4:  [{ type: "RED_SQUARE_NORMAL_STRIPE", weight: 60 }, { type: "RED_CIRCLE_SMALL_RING", weight: 40 }],
    T5:  [{ type: "RED_SQUARE_NORMAL_RING", weight: 50 }, { type: "RED_PINWHEEL_LARGE", weight: 50 }],
    T6:  [{ type: "RED_PINWHEEL_LARGE_STRIPE", weight: 70 }, { type: "RED_SQUARE_NORMAL_STRIPE", weight: 30 }],
    T7:  [{ type: "RED_PINWHEEL_LARGE_RING", weight: 60 }, { type: "RED_PINWHEEL_LARGE_STRIPE", weight: 40 }],
    T8:  [{ type: "RED_PINWHEEL_LARGE_RING", weight: 80 }, { type: "RED_SQUARE_NORMAL_RING", weight: 20 }],
    T9:  [{ type: "RED_PINWHEEL_LARGE_RING", weight: 60 }, { type: "RED_PINWHEEL_LARGE_STRIPE", weight: 40 }],
    T10: [{ type: "RED_PINWHEEL_LARGE_RING", weight: 50 }, { type: "RED_PINWHEEL_LARGE_STRIPE", weight: 30 }, { type: "RED_CIRCLE_LARGE", weight: 20 }]
};

// --- 属性セットのルックアップテーブル ---
export const TIER_TABLES = {
    ENEMY_TIER_BALANCED,
    ENEMY_TIER_ENGLISH_HEAVY,
    ENEMY_TIER_SYMBOL_HEAVY,
    ENEMY_TIER_ONOMATOPOEIA_HEAVY,
    ENEMY_TIER_PUNCTUATION_HEAVY,
    ENEMY_TIER_SOKUON_HEAVY,
    ENEMY_TIER_PROVERB_HEAVY,
    ENEMY_TIER_GRAY_ONLY,
    ENEMY_TIER_PURPLE_ONLY,
    ENEMY_TIER_YELLOW_ONLY,
    ENEMY_TIER_BLUE_ONLY,
    ENEMY_TIER_PINK_ONLY,
    ENEMY_TIER_GREEN_ONLY,
    ENEMY_TIER_RED_ONLY
};

// 旧名互換用
const ENEMY_TIER_TABLE = ENEMY_TIER_BALANCED;

/**
 * 指定した属性テーブルからTierの敵セットを取得
 */
export function getTierEnemies(tierKey, table = ENEMY_TIER_BALANCED) {
    return table[tierKey] || table.T1;
}

/**
 * 属性セットの説明を取得
 */
export function getTierDescription(table = ENEMY_TIER_BALANCED) {
    const desc = table.description || "不明な属性";
    
    // 標準（Gray）またはそれに準ずる構成の場合はそのまま返す
    if (table === ENEMY_TIER_BALANCED || table === ENEMY_TIER_GRAY_ONLY) {
        return desc;
    }

    const colorMap = {
        "Purple": "#d48df0", // 英語
        "Red":    "#ff4d4f", // 記号
        "Pink":   "#ff85c0", // 擬音
        "Green":  "#73d13d", // 句読点
        "Blue":   "#40a9ff", // 促音
        "Yellow": "#ffec3d"  // ことわざ
    };

    for (const [key, color] of Object.entries(colorMap)) {
        if (desc.includes(key)) {
            return `<span style="color:${color}; font-weight:bold;">${desc}</span>`;
        }
    }

    return desc;
};

const ITEM_TIER_TABLE = {
    T1: [{ type: "HEAL_SMALL", weight: 100 }], // 序盤は回復のみ
    T2: [{ type: "HEAL_SMALL", weight: 50 }, { type: "KILL_SMALL", weight: 50 }],
    T3: [{ type: "HEAL_SMALL", weight: 40 }, { type: "KILL_SMALL", weight: 40 }, { type: "FREEZE_SMALL", weight: 20 }],
    T4: [{ type: "HEAL_MEDIUM", weight: 30 }, { type: "KILL_MEDIUM", weight: 30 }, { type: "FREEZE_MEDIUM", weight: 20 }, { type: "COOLDOWN_SMALL", weight: 20 }],
    T5: [{ type: "HEAL_LARGE", weight: 15 }, { type: "KILL_LARGE", weight: 15 }, { type: "FREEZE_LARGE", weight: 15 }, { type: "COOLDOWN_MEDIUM", weight: 13 },{ type: "HEAL_MEDIUM", weight: 12 }, { type: "KILL_MEDIUM", weight: 13 }, { type: "FREEZE_MEDIUM", weight: 12 },{ type: "KILL_ALL", weight: 5}]
};

function getTierKey(stageNum) {
    return `T${Math.min(10, Math.ceil(stageNum / 10))}`;
}

function getItemTierKey(stageNum) {
    // ステージ30以降は最高ランクのアイテムテーブルを使用
    return `T${Math.min(5, Math.ceil(stageNum / 6))}`;
}

// =====================================================
// ステージ生成ロジック (1-100)
// =====================================================
/**
 * ステージ自動生成リファレンス
 * -----------------------------------------------------
 * 1. ミッションパターン (0-9):
 *    0: 【撃破目標】   - 標準。指定数撃破でクリア。
 *    1: 【生存目標】   - 制限時間まで生存。無限湧き。
 *    2: 【殲滅目標】   - 有限の出現数(limit)を全て倒す。
 *    3: 【電撃戦】     - 短い制限時間 + 短い出現間隔。
 *    4: 【精密防衛】   - 高密度サバイバル。出現数多め。
 *    5: 【タイムアタック】- 時間内に通常より多いノルマを達成。
 *    6: 【サボタージュ】- HP継続減少デバフ + 撃破目標。
 *    7: 【圧倒】       - 同時出現上限(maxAlive)大幅増 + 生存目標。
 *    8: 【精密射撃】   - 1ミスで即終了(failOnMiss) + 少数精鋭を撃破。
 *    9: 【純粋なる試練】- アイテム・スキル使用禁止 + 撃破目標。
 *    - 抽選ルール:
 *        下一桁 1-3: パターン 0-2 (基本・撃破/生存/殲滅)
 *        下一桁 9, 0: パターン 3-9 (応用・高難度/特殊条件)
 * 
 * 1.5 敵構成のアクセント:
 *    - 通常は ENEMY_TIER_BALANCED (標準) を使用。
 *    - 下1桁が 5 , 10のステージ (5, 10, 15, 20, 25...) では、属性混成テーブルからランダムに選択される。
 *
 * 2. 難易度スケーリング (変数 i = ステージ番号):
 *    - 出現間隔: 2400ms - (i * 10ms)  ※下限1200ms
 *    - 撃破目標: 5 + floor(i / 4)
 *    - 制限時間: 30s + (i * 0.3s)
 *    - 同時出現: 3 + floor(i / 25)  ※通常時最大6
 *
 * 3. ステージ/環境設定:
 *    - 背景画像: 1-33:blue, 34-66:green, 67-100:gray
 *    - アイテム: ステージ5で解禁。
 *               出現率: 0.3 + (i * 0.005)
 *               Tier遷移: 6ステージごとにT1→T5へ上昇。
 *
 * 4. エネミーTier定義:
 *    - 10ステージごとに T1 ～ T10 へ自動遷移。
 *    - T1-T2: 小型/標準 (Gray主体)
 *    - T3-T5: 中型/特殊属性 (Purple, Blueなど) 混入開始
 *    - T6-T8: 大型/リング/ストライプ等の高耐久・複雑なワード
 *    - T9-T10: 各属性の最上位個体 + 低確率で超大型
 *
 * 5. スター評価:
 *    - パターンに応じて「KPM/クリア時間/正確性/残りHP/残り時間/総合」から動的に選出。
 */
function generateStage(i, tierTable = ENEMY_TIER_BALANCED) {
    // --- 属性アクセントの決定ロジック ---
    let selectedTable = tierTable;
    
    // 下1桁が5または0のステージを「属性アクセントステージ」とする (例: 5, 10, 15, 20...)
    // かつ、引数で明示的に指定されていない場合のみ自動選択
    if ((i % 10 === 5 || i % 10 === 0) && tierTable === ENEMY_TIER_BALANCED) {
        const accentTables = [
            ENEMY_TIER_ENGLISH_HEAVY,
            ENEMY_TIER_SYMBOL_HEAVY,
            ENEMY_TIER_ONOMATOPOEIA_HEAVY,
            ENEMY_TIER_PUNCTUATION_HEAVY,
            ENEMY_TIER_SOKUON_HEAVY,
            ENEMY_TIER_PROVERB_HEAVY
        ];
        // _ONLY 系を除いた混成テーブルからランダムに選択
        selectedTable = accentTables[Math.floor(Math.random() * accentTables.length)];
    }

    // 以降、selectedTable を使用して生成
    const tier = getTierKey(i);
    const itemTier = getItemTierKey(i);

    // 1. ミッションパターンの決定 (0-9の10種類)
    let pattern;
    const lastDigit = i % 10;
    if (lastDigit >= 1 && lastDigit <= 3) {
        // 下一桁が1-3の場合: ミッションパターン0-2（基本形）を選択
        pattern = Math.floor(Math.random() * 3);
    } else if (lastDigit === 9 || lastDigit === 0) {
        // 下一桁が9-0の場合: ミッションパターン3-9（応用・高難度形）を選択
        pattern = 3 + Math.floor(Math.random() * 7);
    } else {
        // それ以外（4-8）: 全パターンからランダム
        pattern = Math.floor(Math.random() * 10);
    }

    // 難易度の緩やかな上昇計算
    const baseSpawnInterval = Math.max(1200, 2400 - (i * 10)); // 下限を1200msに引き上げ、初期も2400msと余裕を持たせた
    const killGoal = 10 + Math.floor(i / 4); // 討伐目標数
    const timeLimit = 30000 + (i * 1000); // 30秒〜130秒程度
    const maxAlive = Math.min(8, 4 + Math.floor(i / 25)); // 通常ミッションは最大8体までに制限

    // ミッションパターンごとの説明
    const missionDescriptions = [
        { name: "撃破", desc: "指定数の敵を撃破せよ！" },
        { name: "生存", desc: "制限時間まで生き残れ！" },
        { name: "殲滅", desc: "出現する敵を全て殲滅せよ！" },
        { name: "電撃戦", desc: "短時間で敵を撃破せよ！" },
        { name: "精密防衛", desc: "高密度攻撃を防衛せよ！" },
        { name: "タイムアタック", desc: "時間内に指定数撃破せよ！" },
        { name: "サボタージュ", desc: "HP減少の中、敵を撃破せよ！" },
        { name: "圧倒", desc: "大量の敵を捌き切れ！" },
        { name: "精密射撃", desc: "ミスなく敵を撃破せよ！" },
        { name: "純粋なる試練", desc: "アイテム・スキルなしで敵を撃破せよ！" }
    ];

    const currentMission = missionDescriptions[pattern];
    const currentEnemyVariationDescription = getTierDescription(selectedTable);

    let config = {
        bgImage: i <= 33 ? "battle_blue" : i <= 66 ? "battle_green" : "battle_gray",
        spawn: {
            interval: baseSpawnInterval,
            limit: null,
            maxAlive: maxAlive,
            immediateOnClear: false
        },
        enemyTable: getTierEnemies(tier, selectedTable),
        missionName: currentMission.name,
        missionDescription: currentMission.desc,
        enemyVariationDescription: currentEnemyVariationDescription,
    };

    // 2. パターン別の条件設定
    switch (pattern) {
        case 0: // 【撃破目標】指定数倒せばクリア
            config.spawn.limit = Math.floor(killGoal * 1.5);
            config.endConditions = { hpZero: true, killCount: killGoal };
            config.clearConditions = { killCount: killGoal };
            config.spawn.immediateOnClear = true; // 敵がいなくなったら即座に次を出す
            
            // スター：タイピング速度(KPM) または クリア時間
            if (Math.random() > 0.5) {
                config.star = {
                    type: "typingSpeed",
                    thresholds: [
                        60 + (i * 0.8), 90 + (i * 1.0), 120 + (i * 1.2), 150 + (i * 1.4), 180 + (i * 1.6)
                    ]
                };
            } else {
                // 最小スポーン時間 ＋ 最後の敵を倒すための猶予
                const minSpawnTime = (killGoal - 1) * config.spawn.interval;
                const typingBuffer = 1500; // 最低限必要なタイピング時間(ms)
                const minPossibleTime = minSpawnTime + typingBuffer;
                const baseTime = Math.max(minPossibleTime + 10000, killGoal * 4000); 

                config.star = {
                    type: "clearTime",
                    thresholds: [
                        baseTime,
                        Math.max(minPossibleTime + 4000, baseTime * 0.8),
                        Math.max(minPossibleTime + 2000, baseTime * 0.7),
                        Math.max(minPossibleTime + 1000, baseTime * 0.6),
                        Math.max(minPossibleTime + 500, baseTime * 0.5)
                    ]
                };
            }
            break;

        case 1: // 【生存目標】時間まで生き残ればクリア
            config.spawn.limit = null; // 無限湧き
            config.endConditions = { hpZero: true, timerMs: timeLimit };
            config.clearConditions = { survive: true };

            // スター：残りHP率 または 正確性
            if (Math.random() > 0.5) {
                config.star = {
                    type: "hpRemaining",
                    thresholds: [0.3, 0.5, 0.7, 0.85, 0.95]
                };
            } else {
                const accBase = 0.5 + (i * 0.003);
                config.star = {
                    type: "accuracy",
                    thresholds: [
                        Math.min(0.85, accBase), 
                        Math.min(0.88, accBase + 0.05), 
                        Math.min(0.92, accBase + 0.1), 
                        Math.min(0.95, accBase + 0.15), 
                        0.98
                    ]
                };
            }
            break;

        case 2: // 【殲滅目標】出現した敵をすべて倒せばクリア
            const spawnLimit = Math.floor(killGoal * 0.8) + 5;
            config.spawn.limit = spawnLimit;
            config.endConditions = { hpZero: true, allSpawnedDefeated: true };
            config.clearConditions = { killCount: spawnLimit };
            config.spawn.immediateOnClear = true; // 殲滅目標では即時スポーンが効果的

            // スター：総合評価(Composite)
            config.star = {
                type: "composite",
                thresholds: [
                    Math.min(0.5, 0.3 + (i * 0.002)),
                    Math.min(0.6, 0.4 + (i * 0.002)),
                    Math.min(0.7, 0.5 + (i * 0.002)),
                    Math.min(0.8, 0.6 + (i * 0.002)),
                    Math.min(0.9, 0.7 + (i * 0.002))
                ]
            };
            break;

        case 3: // 【電撃戦】極めて短い制限時間内に指定数撃破
            const blitzTime = Math.max(15000, 25000 + (i * 100)); // 非常にタイトな時間
            config.spawn.interval *= 0.7; // 敵がどんどん出る
            config.endConditions = { hpZero: true, timerMs: blitzTime, killCount: killGoal };
            config.clearConditions = { killCount: killGoal };
            config.spawn.immediateOnClear = true;
            
            // スター：残り時間率(timeRemaining) 
            config.star = {
                type: "timeRemaining",
                thresholds: [0.1, 0.25, 0.4, 0.6, 0.75]
            };
            break;

        case 4: // 【精密防衛】高密度サバイバル
            config.spawn.maxAlive += 2; // 増加量を抑制
            config.spawn.interval *= 0.7;
            config.endConditions = { hpZero: true, timerMs: timeLimit * 0.8 };
            config.clearConditions = { survive: true };

            // スター：正確性(Accuracy) ではなく 残りHP率に変更（1ミス終了ルールの親和性のため）
            config.star = {
                type: "hpRemaining",
                thresholds: [
                    0.4, 
                    0.6, 
                    0.75, 
                    0.85, 
                    0.95
                ]
            };
            break;

        case 5: // 【タイムアタック】指定時間内に指定数撃破
            const timeAttackTime = Math.max(20000, 35000 + (i * 150)); // 20秒〜50秒程度
            const timeAttackKillGoal = killGoal + Math.floor(i / 5); // 通常より多めに設定
            config.spawn.interval *= 0.8; // 敵の出現を少し早める
            config.spawn.limit = Math.floor(timeAttackKillGoal * 1.5);
            config.endConditions = { hpZero: true, timerMs: timeAttackTime };
            config.clearConditions = { killCount: timeAttackKillGoal, timerMs: timeAttackTime };
            config.spawn.immediateOnClear = true; // タイムアタックには必須級の機能

            // スター：クリア時間 または タイピング速度
            if (Math.random() > 0.5) {
                const minPossibleTime = (timeAttackKillGoal - 1) * config.spawn.interval + 1500;
                config.star = {
                    type: "clearTime",
                    thresholds: [
                        timeAttackTime,
                        Math.max(minPossibleTime + 4000, timeAttackTime * 0.8),
                        Math.max(minPossibleTime + 2000, timeAttackTime * 0.7),
                        Math.max(minPossibleTime + 1000, timeAttackTime * 0.55),
                        Math.max(minPossibleTime + 500, timeAttackTime * 0.4)
                    ]
                };
            } else {
                config.star = {
                    type: "typingSpeed",
                    thresholds: [ // タイムアタックは特に厳しかったため大幅緩和
                        70 + (i * 1.0), 100 + (i * 1.2), 130 + (i * 1.4), 160 + (i * 1.6), 190 + (i * 1.8)
                    ]
                };
            }
            break;

        case 6: // 【サボタージュ】HPが徐々に減る中、指定数撃破
            const sabotageKillTarget = killGoal + Math.floor(i / 3);
            config.spawn.limit = Math.floor(sabotageKillTarget * 1.5);
            config.endConditions = { hpZero: true, killCount: sabotageKillTarget };
            config.clearConditions = { killCount: sabotageKillTarget };
            config.spawn.immediateOnClear = true;
            
            const hpDrain = 1 + (i * 0.05);
            config.player = { ...ENEMY_MODE_CONFIG.player, hpDrainPerSec: hpDrain };

            // 期待クリア時間（スポーン待ち時間 + タイピング猶予）から不可避なダメージを計算
            const expectedTimeSec = ((sabotageKillTarget - 1) * config.spawn.interval / 1000) + (sabotageKillTarget * 0.5);
            const mandatoryLoss = expectedTimeSec * hpDrain;
            const maxPossibleHp = Math.max(5, ENEMY_MODE_CONFIG.player.maxHp - mandatoryLoss);
            const maxRatio = maxPossibleHp / ENEMY_MODE_CONFIG.player.maxHp;

            config.star = {
                type: "hpRemaining",
                thresholds: [
                    maxRatio * 0.2,
                    maxRatio * 0.4,
                    maxRatio * 0.6,
                    maxRatio * 0.8,
                    maxRatio * 0.95
                ]
            };
            break;

          case 7: // 【圧倒】途方もない数の敵を捌き切れ！ (Overwhelm)
            const overwhelmTime = timeLimit + (i * 500); // 長めの生存時間
            config.spawn.interval *= 0.8; // 出現頻度を抑える (0.7 -> 0.8)
            config.spawn.maxAlive = Math.min(10, maxAlive + 4); // 最大10体に制限
            config.spawn.limit = null; // 無限湧き
            config.endConditions = { hpZero: true, timerMs: overwhelmTime };
            config.clearConditions = { survive: true };

             // 圧倒的な敵を捌くにはタイピング速度が最も重要
            config.star = {
                type: "typingSpeed",
                thresholds: [ // 圧倒も厳しかったため緩和
                    80 + (i * 1.0),
                    120 + (i * 1.2),
                    160 + (i * 1.4),
                    200 + (i * 1.6),
                    240 + (i * 1.8)
                ]
            };
            break;

        case 8: // 【精密射撃】ミスなく敵を撃破 (Precision Shot)
            const precisionKillTarget = killGoal + Math.floor(i / 5);
            config.spawn.limit = precisionKillTarget; // 倒すべき敵は有限
            config.spawn.maxAlive = Math.min(maxAlive, 2 + Math.floor(i / 30)); // さらに少なめに調整
            config.spawn.interval *= 1.2; // 少しゆっくり出現
            config.endConditions = { 
                hpZero: true, 
                allSpawnedDefeated: true,
                failOnMiss: true 
            };
            config.spawn.immediateOnClear = true;
            config.clearConditions = { 
                killCount: precisionKillTarget,
                noMiss: true // クリア条件に「ノーミス」を明示的に追加
            };

            // スター：タイピング速度(KPM) に変更（ミス＝終了のため正確性は常に100%になるため）
            config.star = {
                type: "typingSpeed",
                thresholds: [
                    60 + (i * 1.0), // 精密射撃も緩和
                    90 + (i * 1.2),
                    120 + (i * 1.4),
                    150 + (i * 1.6),
                    180 + (i * 1.8)
                ]
            };
            break;

        case 9: // 【純粋なる試練】アイテム・アクティブスキル禁止 (Pure Trial)
            const pureTrialKillTarget = killGoal + Math.floor(i / 4);
            config.spawn.limit = Math.floor(pureTrialKillTarget * 1.5);
            config.endConditions = { hpZero: true, killCount: pureTrialKillTarget };
            config.clearConditions = { killCount: pureTrialKillTarget };
            config.spawn.immediateOnClear = true;
            config.itemSpawn = null; // アイテム出現禁止
            config.player = { ...ENEMY_MODE_CONFIG.player, disableActiveSkill: true }; // アクティブスキル禁止

            // スター：総合評価 (Composite) - アイテム・スキルなしでの総合力を評価
            config.star = {
                type: "composite",
                thresholds: [
                    Math.min(0.5, 0.3 + (i * 0.003)),
                    Math.min(0.65, 0.45 + (i * 0.003)),
                    Math.min(0.75, 0.55 + (i * 0.003)),
                    Math.min(0.85, 0.65 + (i * 0.003)),
                    Math.min(0.95, 0.75 + (i * 0.003))
                ]
            };
            break;
    }

    // ステージ5からアイテム解禁
    if (i >= 5 && config.itemSpawn !== null) {
        config.itemSpawn = {
            interval: 8000 - (i * 30),
            chance: 0.2 + (i * 0.001), // 徐々にアイテムが出やすくなる
            limit: null,
            maxAlive: 1
        };
        config.itemTable = ITEM_TIER_TABLE[itemTier];
    }

    return config;
}

/**
 * クエストステージの生成・永続化ロジック
 * 初回実行時に生成し、以降は LocalStorage から固定値を読み込む
 */
const QUEST_STAGES_STORAGE_KEY = "QuestStages_Cache";

function initGeneratedStages() {
    if (typeof localStorage === 'undefined') return {}; // 非ブラウザ環境用セーフティ

    const cached = localStorage.getItem(QUEST_STAGES_STORAGE_KEY);
    if (cached) {
        try {
            return JSON.parse(cached);
        } catch (e) {
            console.warn("Quest stage cache corrupted. Regenerating...");
        }
    }

    // キャッシュがない（New Game時など）場合は新規生成して保存
    const newStages = {};
    for (let i = 1; i <= 100; i++) {
        newStages[`STAGE${i}`] = generateStage(i);
    }
    localStorage.setItem(QUEST_STAGES_STORAGE_KEY, JSON.stringify(newStages));
    return newStages;
}

/**
 * メモリ上のステージデータを最新のキャッシュ（または新規生成）で更新する
 */
export function refreshStages() {
    // キャッシュをクリアして再生成
    clearQuestStageCache();
    const newStages = initGeneratedStages();
    
    // エクスポート済みの STAGES オブジェクトの中身を直接更新する
    // (参照を壊さないようにプロパティをコピー)
    for (let i = 1; i <= 100; i++) {
        const key = `STAGE${i}`;
        STAGES[key] = newStages[key];
    }
}

let generatedStages = initGeneratedStages();

/**
 * クエストステージのキャッシュを削除する
 * 「最初から遊ぶ」などのボタンが押された際に実行することを想定
 */
export function clearQuestStageCache() {
    if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(QUEST_STAGES_STORAGE_KEY);
    }
}


// =====================================================
// ステージ設定（個別）
// =====================================================
export const STAGES = {

  // =====================================================
  // デイリー
  // =====================================================

  DAILYtest: {
    bgImage: "battle_gray",
    spawn: {
      interval: 2000,
      limit: null,
      maxAlive: null,
    },
    enemyTable: [
      { type: "GRAY_CIRCLE_NORMAL", weight: 50 },
      { type: "PURPLE_CIRCLE_SMALL", weight: 25 },
      { type: "BLUE_PINWHEEL_SMALL", weight: 25 },
    ],
    endConditions: {
      hpZero: true,
      timerMs: 30000,
    },
    clearConditions: {
      killCount: 5,
    },
    star: {
      type: "typingSpeed",
      thresholds: [100,150,200, 250, 300]
    }
  },

  DAILY: {
    bgImage: "battle_gray",
    spawn: { interval: 2000, limit: null, maxAlive: null, immediateOnClear: false },
        enemyTable: getTierEnemies("T2", ENEMY_TIER_BALANCED),
    endConditions: { hpZero: true, timerMs: 30000 },
    clearConditions: { killCount: 10 },
    star: { type: "typingSpeed", thresholds: [100, 150, 200, 250, 300] }
  },
    ...generatedStages,

  // =====================================================
  // ボスバトル定義
  // =====================================================

  // 第10ステージ後のレベルチェック（中ボス）
  W1_MID_BOSS_1: {
    phases: [
      {
        name: "Security Breach",
        spawn: { interval: 1200, limit: null, maxAlive: 4, immediateOnClear: true },
        enemyTable: getTierEnemies("T1", ENEMY_TIER_BALANCED),
        immediateOnClear: true,
        phaseConditions: { killCount: 10 }
      },
      {
        name: "Adware King Appear",
        bgm: "bgm_enemy2",
        spawn: { interval: 1000, limit: 1, maxAlive: 1 },
        enemyTable: [{ type: "MID_BOSS_1", weight: 100, pos: { x: 830, y: 150 } }], 
        phaseConditions: { killCount: 1 }
      }
    ],
    endConditions: { hpZero: true },
    clearConditions: { killCount: 11 },
    star: { type: "accuracy", thresholds: [0.6, 0.7, 0.8, 0.85, 0.9] }
  },

  // 第20ステージ後のレベルチェック（中ボス）
  W1_MID_BOSS_2: {
    phases: [
      {
        name: "Botnet Invasion",
        spawn: { interval: 1200, limit: 15, maxAlive: 5, immediateOnClear: true },
        enemyTable: getTierEnemies("T2", ENEMY_TIER_BALANCED),
        phaseConditions: { killCount: 15 }
      },
      {
        name: "Botnet Commander",
        bgm: "bgm_enemy2",
        spawn: { interval: 2500, limit: 1, maxAlive: 1 },
        enemyTable: [{ type: "MID_BOSS_2", weight: 100, pos: { x: 830, y: 150 }  }],
        phaseConditions: { killCount: 1 }
      }
    ],
    endConditions: { hpZero: true },
    clearConditions: { killCount: 16 },
    star: { type: "typingSpeed", thresholds: [150, 180, 210, 240, 260] }
  },

  W1_MID_BOSS_3: {
    phases: [
      {
        name: "Botnet Invasion",
        spawn: { interval: 1000, limit: null, maxAlive: 6 },
        enemyTable: getTierEnemies("T3", ENEMY_TIER_BALANCED),
        phaseConditions: { timerMs: 40000}
      },
      {
        name: "Botnet Commander",
        bgm: "bgm_enemy2",
        spawn: { interval: 1000, limit: 1, maxAlive: 1 },
        enemyTable: [{ type: "MID_BOSS_3", weight: 100, pos: { x: 830, y: 150 }  }],
        phaseConditions: { killcount: 1 }
      }
    ],
    endConditions: { hpZero: true },
    clearConditions: { survive: true },
    star: { type: "typingSpeed", thresholds: [150, 180, 210, 240, 260] }
  },

  // 第30ステージ後のワールドボス
  W1_WORLD_BOSS: {
    phases: [
      {
        name: "Gateway Security",
        spawn: { interval: 900, limit: null, maxAlive: 8, immediateOnClear: true },
        enemyTable: getTierEnemies("T3", ENEMY_TIER_BALANCED),
        phaseConditions: { killCount: 20 }
      },
      {
        name: "GATEWAY GUARDIAN",
        bgm: "bgm_enemy3",
        spawn: { interval: 1000, limit: 1, maxAlive: 1 },
        enemyTable: [{ type: "BOSS_1", weight: 100, pos: { x: 830, y: 150 }  }],
        phaseConditions: { killCount: 1 }
      }
    ],
    endConditions: { hpZero: true },
    clearConditions: { survive: true },
    star: { type: "composite", thresholds: [0.5, 0.6, 0.7, 0.8, 0.9] }
  },

// ========================================================
// test
// =========================================================
  // フェーズテスト用
  PHASE_TEST: {
    phases: [
      {
        name: "",
        spawn: {
          interval: 1500,
          limit: 5,
          immediateOnClear: true
        },
        enemyTable: [{ type: "GRAY_CIRCLE_SMALL", weight: 100 }],
        phaseConditions: { allSpawnedDefeated: true }
      },
      {
        name: "phase2",
        bgm: "bgm_enemy2", 
        spawn: {
          interval: 800,
          limit: 8,
        },
        enemyTable: [{ type: "PURPLE_CIRCLE_SMALL", weight: 100 }],
        itemSpawn: {
          interval: 5000,
          chance: 0.9,
          limit: null,
          maxAlive: 1,
        },
        itemTable: [
          { type: "HEAL_SMALL", weight: 5 },
          { type: "COOLDOWN_STOCK", weight: 80 },
          { type: "BOMB", weight: 10 },
          { type: "BOMB_ALL", weight:  5 },
          { type: "HEAL_FULL", weight: 5 },
          { type: "SKILL_CD", weight: 5 },
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

  STAGE1test: {
    spawn: {
      interval: 2000,
      limit: 10,
      maxAlive: null,
      immediateOnClear: true
    },
    itemSpawn: {
      interval: 5000,
      chance: 0.9,
      limit: null,
      maxAlive: 1,
    },
    enemyTable: [
      { type: "GRAY_CIRCLE_SMALL", weight: 70 },
      { type: "GRAY_SQUARE_SMALL", weight: 30 }
    ],
    itemTable: [
      { type: "COOLDOWN_STOCK", weight: 80 },
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

  STAGE2test: {
    spawn: {
      interval: 1500,
      limit: 27,
      maxAlive: null,
      immediateOnClear: true
    },
    enemyTable: [
      { type: "GRAY_CIRCLE_NORMAL", weight: 40 },
      { type: "PURPLE_CIRCLE_SMALL", weight: 40 },
      { type: "GRAY_SQUARE_LARGE", weight: 20 }
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

  STAGE3test: {
    spawn: {
      interval: 1500,
      limit: null,
      maxAlive: null,
    },
    enemyTable: [
      { type: "GRAY_CIRCLE_NORMAL", weight: 40 },
      { type: "PURPLE_SQUARE_NORMAL", weight: 40 },
      { type: "GRAY_SQUARE_LARGE", weight: 20 },
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

  TESTSTAGE: {
    spawn: {
      interval: 1000,
      limit: 1,
      maxAlive: null,
      immediateOnClear: true
    },
    enemyTable: [
    { type: "MID_BOSS_3", weight: 100 },
    ],
    endConditions: {
        hpZero: true,
        killCount: 1,
        allSpawnedDefeated: false
    },
    clearConditions: {
        killCount: 1
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

  WORLD_BOSS_1: {
        bgImage: "battle_red",
        bgm: "bgm_enemy3",
        phases: [
            {
                name: "Warning",
                spawn: { interval: 1000, limit: 10, maxAlive: 5 },
                enemyTable: getTierEnemies("T1", ENEMY_TIER_BALANCED), // Tier 1のザコを使用
                phaseConditions: { killCount: 10 }
            },
            {
                name: "THE BOSS",
                spawn: { interval: 3000, limit: 1, maxAlive: 1 },
                enemyTable: [{ type: "BOSS", weight: 100 }],
                phaseConditions: { allSpawnedDefeated: true }
            }
        ],
        endConditions: { hpZero: true },
        clearConditions: { killCount: 11 },
        star: { type: "accuracy", thresholds: [0.6, 0.7, 0.8, 0.85, 0.9] }
    },
    // 他のボスも同様に Tier テーブルを参照して作成可能
  
};
