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
        maxHp: 100,
        defense: 0,
        radius: 20
    },
    // ===============================
    // 敵スポーン
    // ===============================
    spawn: {
        interval: 4000,   // 出現間隔(ms)
        limit: null,      // 出現上限（null = 無限）
        maxAlive: null,   // 同時出現上限（null = 無限）
        immediateOnClear: false, // 敵が全滅した際に即座に次を出すか

        // ★同時出現（マルチスポーン）
        multiCount: 1,    // 1回の出現で同時に出す敵の数（2なら2匹同時 / 1 = 従来どおり1匹）
        multiInterval: 1  // 何回に1回まとめて出すか（2なら「2回に1回」だけ multiCount 匹同時 / 1 = 毎回）
    },
    // ===============================
    // 終了条件
    // ===============================
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
        maxBar: 5500,
        decayRate: 1.0, // 1msあたり減少割合
        gainOnKill: 1500, // 敵撃破で増える量
        missPenalty: 500, // ミス1回で減る量
        gainOnType: 250, // 1文字あたりの増加量

        // チェイン倍率テーブル（上から評価）
        multipliers: [
            { count: 100, value: 5.0 },
            { count: 80, value: 3.5 },
            { count: 60, value: 3.0 },
            { count: 50, value: 2.7 },
            { count: 45, value: 2.4 },
            { count: 40, value: 2.2 },
            { count: 35, value: 2.0 },
            { count: 30, value: 1.8 },
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

export function buildEndText(end, playerConfig = null, defenseConfig = null) {
  const lines = [];

  // ★ 防衛モードの場合、専用の終了条件を表示
  if (defenseConfig) {
    lines.push(`制限時間: ${defenseConfig.timeLimit || '-'}秒`);
    return lines;
  }

  if (!end) return lines;
  if (end.hpZero) {
    lines.push("HPが0になると終了");
  }

  if (end.failOnMissCount) {
    if (end.failOnMissCount === 1) {
      lines.push('<span style="color:#ff4d4f;">1回でもミスすると終了</span>');
    } else {
      lines.push(`<span style="color:#ff4d4f;">${end.failOnMissCount}回ミスすると終了</span>`);
    }
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

export function buildClearText(clear, defenseConfig = null) {
  const lines = [];
  // 明示的にクリア条件が定義されている場合は、まずそれを処理します。
  // そうでない場合、防衛モードでは defenseConfig がクリア条件の主要なソースとなります。
  if (clear) {
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
  }

  // defenseConfig が提供されている場合、常に防衛モード固有のクリア条件を追加します。
  // これにより、'clear' が null/undefined であっても防衛モードのクリア条件が表示されます。
  if (defenseConfig && defenseConfig.totalCharsToType != null) {
    lines.push(`目標文字数: ${defenseConfig.totalCharsToType}`);
  }

  return lines;
}

/**
 * 防衛モードのジャンル表記を整形する（複数タグ対応）
 * @param {string[]} genres - ['empty'] や ['empty', '促音', 'ことわざ'] など
 * @returns {string} 表示用テキスト（例: "標準・促音・ことわざ" / "全ジャンル"）
 */
export function formatDefenseGenres(genres) {
  if (!genres || genres.length === 0) return "標準";
  if (genres.includes("all")) return "全ジャンル";
  return genres.map(g => (g === "empty" ? "標準" : g)).join("・");
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

    case "defenseSurplus":
      t.forEach((v, i) => {
        const surplusWeight = Math.round((star.weights?.surplus ?? 0.7) * 100);
        const accuracyWeight = Math.round((star.weights?.accuracy ?? 0.3) * 100);
        lines.push(`★${i+1}: 総合評価 (タイピング量 ${surplusWeight}% + 正確性 ${accuracyWeight}%) ${Math.round(v * 100)}%以上`);
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


// =====================================================
// Tier別の敵セット定義 (10ステージごと)
// =====================================================

// --- メイン: 標準セット (Gray多め、徐々に他属性が混ざる) ---
export const ENEMY_TIER_BALANCED = {
    description: "標準構成（Grayタイプ主体）",
    T1:  [{ type: "GRAY_CIRCLE_SMALL", weight: 50 }, { type: "GRAY_SQUARE_SMALL", weight: 40 }, { type: "GRAY_PINWHEEL_SMALL", weight: 10 }],
    T2:  [{ type: "GRAY_CIRCLE_NORMAL", weight: 50 }, { type: "GRAY_SQUARE_SMALL_STRIPE", weight: 20 }, { type: "GRAY_PINWHEEL_SMALL", weight: 10 }, { type: "PURPLE_CIRCLE_SMALL", weight: 10 }, { type: "BLUE_CIRCLE_SMALL", weight: 10 }],
    T3:  [{ type: "GRAY_SQUARE_NORMAL", weight: 50 }, { type: "GRAY_PINWHEEL_NORMAL", weight: 20 }, { type: "PURPLE_SQUARE_NORMAL", weight: 15 }, { type: "BLUE_CIRCLE_NORMAL", weight: 10 }, { type: "GRAY_CIRCLE_SMALL_RING", weight: 5 }],
    T4:  [{ type: "GRAY_SQUARE_NORMAL", weight: 40 }, { type: "GRAY_CIRCLE_NORMAL_STRIPE", weight: 20 }, { type: "PINK_CIRCLE_NORMAL", weight: 15 }, { type: "YELLOW_CIRCLE_SMALL", weight: 15 }, { type: "GRAY_PINWHEEL_SMALL", weight: 10 }],
    T5:  [{ type: "GRAY_CIRCLE_NORMAL", weight: 40 }, { type: "GRAY_SQUARE_NORMAL_STRIPE", weight: 20 }, { type: "PURPLE_PINWHEEL_SMALL", weight: 15 }, { type: "GREEN_SQUARE_SMALL", weight: 15 }, { type: "GRAY_SQUARE_LARGE", weight: 10 }],
    T6:  [{ type: "GRAY_SQUARE_LARGE", weight: 20 }, { type: "GRAY_CIRCLE_LARGE", weight: 20 }, { type: "BLUE_CIRCLE_NORMAL_STRIPE", weight: 20 }, { type: "RED_CIRCLE_SMALL", weight: 10 }, { type: "PURPLE_SQUARE_NORMAL", weight: 15 }, { type: "PINK_SQUARE_NORMAL", weight: 15 }],
    T7:  [{ type: "GRAY_PINWHEEL_LARGE", weight: 25 }, { type: "PINK_PINWHEEL_NORMAL", weight: 15 }, { type: "YELLOW_PINWHEEL_NORMAL", weight: 15 }, { type: "BLUE_SQUARE_LARGE", weight: 10 }, { type: "GRAY_CIRCLE_NORMAL", weight: 25 }, { type: "GRAY_CIRCLE_SMALL", weight: 10 }],
    T8:  [{ type: "GRAY_PINWHEEL_LARGE_RING", weight: 5 }, { type: "GRAY_CIRCLE_LARGE_RING", weight: 5 }, { type: "RED_SQUARE_NORMAL", weight: 15 }, { type: "PURPLE_CIRCLE_LARGE", weight: 15 }, { type: "YELLOW_SQUARE_NORMAL_RING", weight: 5 }, { type: "GRAY_SQUARE_NORMAL", weight: 45 }, { type: "GRAY_SQUARE_SMALL", weight: 10 }],
    T9:  [{ type: "GRAY_SQUARE_LARGE_RING", weight: 10 }, { type: "RED_PINWHEEL_LARGE", weight: 10 }, { type: "YELLOW_SQUARE_LARGE_RING", weight: 10 }, { type: "GREEN_CIRCLE_NORMAL_RING", weight: 15 }, { type: "BLUE_PINWHEEL_LARGE_STRIPE", weight: 5 }, { type: "GRAY_CIRCLE_NORMAL", weight: 35 }, { type: "GRAY_PINWHEEL_SMALL", weight: 10 },{ type: "GRAY_PINWHEEL_NORMAL", weight: 10 }, ],
    T10: [{ type: "RED_PINWHEEL_LARGE_RING", weight: 5 }, { type: "GRAY_PINWHEEL_LARGE_RING", weight: 5 }, { type: "GRAY_PINWHEEL_NORMAL_RING", weight: 5 }, { type: "PINK_PINWHEEL_LARGE_STRIPE", weight: 10 }, { type: "PURPLE_CIRCLE_LARGE_STRIPE", weight: 20 }, { type: "BLUE_SQUARE_LARGE", weight: 15 }, { type: "GRAY_CIRCLE_NORMAL", weight: 35 }, { type: "GRAY_CIRCLE_SMALL", weight: 10 }]
};

// --- バリエーション: 英語多め (Purpleの比率が高い) ---
export const ENEMY_TIER_ENGLISH_HEAVY = {
    description: "英語多め（Purpleタイプ混成）",
    T1:  [{ type: "GRAY_CIRCLE_SMALL", weight: 30 }, { type: "GRAY_SQUARE_SMALL", weight: 10 }, { type: "PURPLE_CIRCLE_SMALL", weight: 50 }, { type: "PURPLE_SQUARE_SMALL", weight: 10 }],
    T2:  [{ type: "GRAY_CIRCLE_NORMAL", weight: 20 }, { type: "GRAY_SQUARE_SMALL_STRIPE", weight: 15 }, { type: "PURPLE_PINWHEEL_SMALL", weight: 50 }, { type: "PURPLE_CIRCLE_NORMAL", weight: 15 }],
    T3:  [{ type: "GRAY_PINWHEEL_NORMAL", weight: 15 }, { type: "GRAY_SQUARE_NORMAL", weight: 25 }, { type: "PURPLE_SQUARE_NORMAL", weight: 40 }, { type: "PURPLE_CIRCLE_NORMAL_STRIPE", weight: 20 }],
    T4:  [{ type: "GRAY_SQUARE_NORMAL", weight: 20 }, { type: "GRAY_CIRCLE_NORMAL_RING", weight: 10 }, { type: "PURPLE_SQUARE_SMALL_RING", weight: 10 }, { type: "PURPLE_SQUARE_NORMAL", weight: 40 }, { type: "PURPLE_PINWHEEL_SMALL", weight: 20 }],
    T5:  [{ type: "GRAY_SQUARE_NORMAL_STRIPE", weight: 20 }, { type: "GRAY_CIRCLE_NORMAL", weight: 20 }, { type: "PURPLE_CIRCLE_LARGE", weight: 40 }, { type: "PURPLE_PINWHEEL_NORMAL", weight: 20 }],
    T6:  [{ type: "GRAY_PINWHEEL_NORMAL_RING", weight: 15 }, { type: "GRAY_SQUARE_NORMAL_RING", weight: 15 }, { type: "PURPLE_CIRCLE_LARGE_STRIPE", weight: 50 }, { type: "PURPLE_SQUARE_LARGE", weight: 20 }],
    T7:  [{ type: "GRAY_PINWHEEL_LARGE", weight: 15 }, { type: "GRAY_CIRCLE_NORMAL", weight: 15 }, { type: "PURPLE_CIRCLE_LARGE_RING", weight: 40 }, { type: "PURPLE_PINWHEEL_NORMAL_STRIPE", weight: 30 }],
    T8:  [{ type: "GRAY_SQUARE_NORMAL", weight: 20 }, { type: "GRAY_PINWHEEL_LARGE_RING", weight: 10 }, { type: "PURPLE_PINWHEEL_LARGE_RING", weight: 30 }, { type: "PURPLE_CIRCLE_NORMAL_RING", weight: 30 }, { type: "PURPLE_SQUARE_LARGE", weight: 10 }],
    T9:  [{ type: "GRAY_PINWHEEL_NORMAL", weight: 10 }, { type: "PURPLE_CIRCLE_NORMAL", weight: 30 }, { type: "GRAY_SQUARE_LARGE_RING", weight: 10 }, { type: "PURPLE_PINWHEEL_LARGE_STRIPE", weight: 20 }, { type: "PURPLE_SQUARE_LARGE_RING", weight: 15 }, { type: "PURPLE_SQUARE_NORMAL", weight: 10 }, { type: "GRAY_CIRCLE_NORMAL_RING", weight: 5 }],
    T10: [{ type: "GRAY_CIRCLE_NORMAL", weight: 15 }, { type: "GRAY_PINWHEEL_LARGE_RING", weight: 10 }, { type: "PURPLE_CIRCLE_LARGE_RING", weight: 35 }, { type: "PURPLE_PINWHEEL_LARGE_RING", weight: 20 }, { type: "PURPLE_SQUARE_NORMAL_STRIPE", weight: 10 }, { type: "PURPLE_PINWHEEL_NORMAL", weight: 10 }]
};

// --- バリエーション: 記号多め (Redの比率が高い) ---
export const ENEMY_TIER_SYMBOL_HEAVY = {
    description: "記号多め（Redタイプ混成）",
    T1:  [{ type: "GRAY_CIRCLE_SMALL", weight: 30 }, { type: "GRAY_SQUARE_SMALL", weight: 10 }, { type: "RED_CIRCLE_SMALL", weight: 50 }, { type: "RED_SQUARE_SMALL", weight: 10 }],
    T2:  [{ type: "GRAY_CIRCLE_NORMAL", weight: 20 }, { type: "GRAY_SQUARE_SMALL_STRIPE", weight: 15 }, { type: "RED_PINWHEEL_SMALL", weight: 50 }, { type: "RED_CIRCLE_NORMAL", weight: 15 }],
    T3:  [{ type: "GRAY_PINWHEEL_NORMAL", weight: 15 }, { type: "GRAY_SQUARE_NORMAL", weight: 25 }, { type: "RED_SQUARE_NORMAL", weight: 40 }, { type: "RED_CIRCLE_NORMAL_STRIPE", weight: 20 }],
    T4:  [{ type: "GRAY_SQUARE_NORMAL", weight: 20 }, { type: "GRAY_CIRCLE_NORMAL_RING", weight: 10 }, { type: "RED_SQUARE_SMALL_RING", weight: 10 }, { type: "RED_SQUARE_NORMAL", weight: 40 }, { type: "RED_PINWHEEL_SMALL", weight: 20 }],
    T5:  [{ type: "GRAY_SQUARE_NORMAL_STRIPE", weight: 20 }, { type: "GRAY_CIRCLE_NORMAL", weight: 20 }, { type: "RED_PINWHEEL_LARGE", weight: 40 }, { type: "RED_CIRCLE_NORMAL", weight: 20 }],
    T6:  [{ type: "GRAY_PINWHEEL_NORMAL_RING", weight: 15 }, { type: "GRAY_SQUARE_NORMAL_RING", weight: 15 }, { type: "RED_PINWHEEL_LARGE_STRIPE", weight: 50 }, { type: "RED_SQUARE_LARGE", weight: 20 }],
    T7:  [{ type: "GRAY_PINWHEEL_LARGE", weight: 15 }, { type: "GRAY_CIRCLE_NORMAL", weight: 15 }, { type: "RED_PINWHEEL_LARGE_RING", weight: 40 }, { type: "RED_CIRCLE_NORMAL_STRIPE", weight: 30 }],
    T8:  [{ type: "GRAY_SQUARE_NORMAL", weight: 20 }, { type: "GRAY_PINWHEEL_LARGE_RING", weight: 10 }, { type: "RED_CIRCLE_LARGE_RING", weight: 30 }, { type: "RED_SQUARE_NORMAL_RING", weight: 30 }, { type: "RED_SQUARE_LARGE", weight: 10 }],
    T9:  [{ type: "GRAY_PINWHEEL_NORMAL", weight: 10 }, { type: "RED_SQUARE_NORMAL", weight: 30 }, { type: "GRAY_SQUARE_LARGE_RING", weight: 10 }, { type: "RED_PINWHEEL_LARGE_STRIPE", weight: 25 }, { type: "RED_CIRCLE_LARGE_RING", weight: 15 }, { type: "RED_CIRCLE_NORMAL", weight: 10 }],
    T10: [{ type: "GRAY_CIRCLE_NORMAL", weight: 15 }, { type: "GRAY_PINWHEEL_LARGE_RING", weight: 10 }, { type: "RED_PINWHEEL_LARGE_RING", weight: 35 }, { type: "RED_SQUARE_LARGE_RING", weight: 20 }, { type: "RED_SQUARE_NORMAL_STRIPE", weight: 10 }, { type: "RED_PINWHEEL_NORMAL", weight: 10 }]
};

// --- バリエーション: 擬音多め (Pinkの比率が高い) ---
export const ENEMY_TIER_ONOMATOPOEIA_HEAVY = {
    description: "擬音多め（Pinkタイプ混成）",
    T1:  [{ type: "GRAY_CIRCLE_SMALL", weight: 30 }, { type: "GRAY_SQUARE_SMALL", weight: 10 }, { type: "PINK_SQUARE_SMALL", weight: 50 }, { type: "PINK_CIRCLE_SMALL", weight: 10 }],
    T2:  [{ type: "GRAY_CIRCLE_NORMAL", weight: 20 }, { type: "GRAY_SQUARE_SMALL_STRIPE", weight: 15 }, { type: "PINK_PINWHEEL_SMALL", weight: 50 }, { type: "PINK_SQUARE_NORMAL", weight: 15 }],
    T3:  [{ type: "GRAY_PINWHEEL_NORMAL", weight: 15 }, { type: "GRAY_SQUARE_NORMAL", weight: 25 }, { type: "PINK_CIRCLE_NORMAL", weight: 40 }, { type: "PINK_SQUARE_NORMAL_STRIPE", weight: 20 }],
    T4:  [{ type: "GRAY_SQUARE_NORMAL", weight: 20 }, { type: "GRAY_CIRCLE_NORMAL_RING", weight: 10 }, { type: "PINK_SQUARE_SMALL_RING", weight: 10 }, { type: "PINK_SQUARE_NORMAL", weight: 40 }, { type: "PINK_CIRCLE_SMALL", weight: 20 }],
    T5:  [{ type: "GRAY_SQUARE_NORMAL_STRIPE", weight: 20 }, { type: "GRAY_CIRCLE_NORMAL", weight: 20 }, { type: "PINK_PINWHEEL_LARGE", weight: 40 }, { type: "PINK_CIRCLE_NORMAL", weight: 20 }],
    T6:  [{ type: "GRAY_PINWHEEL_NORMAL_RING", weight: 15 }, { type: "GRAY_SQUARE_NORMAL_RING", weight: 15 }, { type: "PINK_PINWHEEL_LARGE_STRIPE", weight: 50 }, { type: "PINK_CIRCLE_LARGE", weight: 20 }],
    T7:  [{ type: "GRAY_PINWHEEL_LARGE", weight: 15 }, { type: "GRAY_CIRCLE_NORMAL", weight: 15 }, { type: "PINK_PINWHEEL_LARGE_RING", weight: 40 }, { type: "PINK_CIRCLE_NORMAL_STRIPE", weight: 30 }],
    T8:  [{ type: "GRAY_SQUARE_NORMAL", weight: 20 }, { type: "GRAY_PINWHEEL_LARGE_RING", weight: 10 }, { type: "PINK_CIRCLE_LARGE_RING", weight: 30 }, { type: "PINK_SQUARE_NORMAL_RING", weight: 30 }, { type: "PINK_CIRCLE_LARGE", weight: 10 }],
    T9:  [{ type: "GRAY_PINWHEEL_NORMAL", weight: 10 }, { type: "PINK_CIRCLE_NORMAL", weight: 30 }, { type: "GRAY_SQUARE_LARGE_RING", weight: 10 }, { type: "PINK_PINWHEEL_LARGE_STRIPE", weight: 25 }, { type: "PINK_CIRCLE_LARGE_RING", weight: 15 }, { type: "PINK_SQUARE_NORMAL", weight: 10 }],
    T10: [{ type: "GRAY_CIRCLE_NORMAL", weight: 15 }, { type: "GRAY_PINWHEEL_LARGE_RING", weight: 10 }, { type: "PINK_PINWHEEL_LARGE_RING", weight: 35 }, { type: "PINK_CIRCLE_LARGE_RING", weight: 20 }, { type: "PINK_SQUARE_NORMAL_STRIPE", weight: 10 }, { type: "PINK_PINWHEEL_NORMAL", weight: 10 }]
};

// --- バリエーション: 句読点多め (Greenの比率が高い) ---
export const ENEMY_TIER_PUNCTUATION_HEAVY = {
    description: "句読点多め（Greenタイプ混成）",
    T1:  [{ type: "GRAY_CIRCLE_SMALL", weight: 30 }, { type: "GRAY_SQUARE_SMALL", weight: 10 }, { type: "GREEN_SQUARE_SMALL", weight: 50 }, { type: "GREEN_CIRCLE_SMALL", weight: 10 }],
    T2:  [{ type: "GRAY_CIRCLE_NORMAL", weight: 20 }, { type: "GRAY_SQUARE_SMALL_STRIPE", weight: 15 }, { type: "GREEN_PINWHEEL_SMALL", weight: 50 }, { type: "GREEN_SQUARE_NORMAL", weight: 15 }],
    T3:  [{ type: "GRAY_PINWHEEL_NORMAL", weight: 15 }, { type: "GRAY_SQUARE_NORMAL", weight: 25 }, { type: "GREEN_PINWHEEL_NORMAL", weight: 40 }, { type: "GREEN_CIRCLE_NORMAL_STRIPE", weight: 20 }],
    T4:  [{ type: "GRAY_SQUARE_NORMAL", weight: 20 }, { type: "GRAY_CIRCLE_NORMAL_RING", weight: 10 }, { type: "GREEN_SQUARE_SMALL_RING", weight: 10 }, { type: "GREEN_SQUARE_NORMAL", weight: 40 }, { type: "GREEN_PINWHEEL_SMALL", weight: 20 }],
    T5:  [{ type: "GRAY_SQUARE_NORMAL_STRIPE", weight: 20 }, { type: "GRAY_CIRCLE_NORMAL", weight: 20 }, { type: "GREEN_CIRCLE_LARGE", weight: 40 }, { type: "GREEN_PINWHEEL_NORMAL", weight: 20 }],
    T6:  [{ type: "GRAY_PINWHEEL_NORMAL_RING", weight: 15 }, { type: "GRAY_SQUARE_NORMAL_RING", weight: 15 }, { type: "GREEN_CIRCLE_LARGE_STRIPE", weight: 50 }, { type: "GREEN_SQUARE_LARGE", weight: 20 }],
    T7:  [{ type: "GRAY_PINWHEEL_LARGE", weight: 15 }, { type: "GRAY_CIRCLE_NORMAL", weight: 15 }, { type: "GREEN_CIRCLE_LARGE_RING", weight: 40 }, { type: "GREEN_PINWHEEL_NORMAL_STRIPE", weight: 30 }],
    T8:  [{ type: "GRAY_SQUARE_NORMAL", weight: 20 }, { type: "GRAY_PINWHEEL_LARGE_RING", weight: 10 }, { type: "GREEN_PINWHEEL_LARGE_RING", weight: 30 }, { type: "GREEN_SQUARE_NORMAL_RING", weight: 30 }, { type: "GREEN_CIRCLE_LARGE", weight: 10 }],
    T9:  [{ type: "GRAY_PINWHEEL_NORMAL", weight: 10 }, { type: "GREEN_SQUARE_NORMAL", weight: 30 }, { type: "GRAY_SQUARE_LARGE_RING", weight: 10 }, { type: "GREEN_CIRCLE_LARGE_STRIPE", weight: 25 }, { type: "GREEN_PINWHEEL_LARGE_RING", weight: 15 }, { type: "GREEN_CIRCLE_NORMAL", weight: 10 }],
    T10: [{ type: "GRAY_CIRCLE_NORMAL", weight: 15 }, { type: "GRAY_PINWHEEL_LARGE_RING", weight: 10 }, { type: "GREEN_CIRCLE_LARGE_RING", weight: 35 }, { type: "GREEN_SQUARE_LARGE_RING", weight: 20 }, { type: "GREEN_SQUARE_NORMAL_STRIPE", weight: 10 }, { type: "GREEN_PINWHEEL_NORMAL", weight: 10 }]
};

// --- バリエーション: 促音多め (Blueの比率が高い) ---
export const ENEMY_TIER_SOKUON_HEAVY = {
    description: "促音多め（Blueタイプ混成）",
    T1:  [{ type: "GRAY_CIRCLE_SMALL", weight: 30 }, { type: "GRAY_PINWHEEL_SMALL", weight: 10 }, { type: "BLUE_PINWHEEL_SMALL", weight: 50 }, { type: "BLUE_CIRCLE_SMALL", weight: 10 }],
    T2:  [{ type: "GRAY_CIRCLE_NORMAL", weight: 20 }, { type: "GRAY_SQUARE_SMALL_STRIPE", weight: 15 }, { type: "BLUE_CIRCLE_NORMAL", weight: 50 }, { type: "BLUE_PINWHEEL_NORMAL", weight: 15 }],
    T3:  [{ type: "GRAY_PINWHEEL_NORMAL", weight: 15 }, { type: "GRAY_SQUARE_NORMAL", weight: 25 }, { type: "BLUE_CIRCLE_NORMAL_STRIPE", weight: 40 }, { type: "BLUE_SQUARE_NORMAL", weight: 20 }],
    T4:  [{ type: "GRAY_SQUARE_NORMAL", weight: 20 }, { type: "GRAY_CIRCLE_NORMAL_RING", weight: 10 }, { type: "BLUE_CIRCLE_NORMAL_RING", weight: 40 }, { type: "BLUE_PINWHEEL_NORMAL", weight: 30 }],
    T5:  [{ type: "GRAY_SQUARE_NORMAL_STRIPE", weight: 20 }, { type: "GRAY_CIRCLE_NORMAL", weight: 20 }, { type: "BLUE_SQUARE_LARGE", weight: 40 }, { type: "BLUE_CIRCLE_NORMAL_STRIPE", weight: 20 }],
    T6:  [{ type: "GRAY_PINWHEEL_NORMAL_RING", weight: 15 }, { type: "GRAY_SQUARE_NORMAL_RING", weight: 15 }, { type: "BLUE_SQUARE_LARGE_STRIPE", weight: 50 }, { type: "BLUE_CIRCLE_LARGE", weight: 20 }],
    T7:  [{ type: "GRAY_PINWHEEL_LARGE", weight: 15 }, { type: "GRAY_CIRCLE_NORMAL", weight: 15 }, { type: "BLUE_PINWHEEL_LARGE", weight: 40 }, { type: "BLUE_SQUARE_LARGE_RING", weight: 30 }],
    T8:  [{ type: "GRAY_SQUARE_NORMAL", weight: 20 }, { type: "GRAY_PINWHEEL_LARGE_RING", weight: 10 }, { type: "BLUE_SQUARE_LARGE_RING", weight: 30 }, { type: "BLUE_CIRCLE_LARGE_RING", weight: 30 }, { type: "BLUE_PINWHEEL_LARGE", weight: 10 }],
    T9:  [{ type: "GRAY_PINWHEEL_NORMAL", weight: 10 }, { type: "BLUE_SQUARE_NORMAL", weight: 30 }, { type: "GRAY_SQUARE_LARGE_RING", weight: 10 }, { type: "BLUE_SQUARE_LARGE_STRIPE", weight: 25 }, { type: "BLUE_PINWHEEL_LARGE_RING", weight: 15 }, { type: "BLUE_CIRCLE_NORMAL", weight: 10 }],
    T10: [{ type: "GRAY_CIRCLE_NORMAL", weight: 15 }, { type: "GRAY_PINWHEEL_LARGE_RING", weight: 10 }, { type: "BLUE_SQUARE_LARGE_RING", weight: 35 }, { type: "BLUE_CIRCLE_LARGE_RING", weight: 20 }, { type: "BLUE_SQUARE_NORMAL_STRIPE", weight: 10 }, { type: "BLUE_PINWHEEL_NORMAL", weight: 10 }]
};

// --- バリエーション: ことわざ多め (Yellowの比率が高い) ---
export const ENEMY_TIER_PROVERB_HEAVY = {
    description: "ことわざ多め（Yellowタイプ混成）",
    T1:  [{ type: "GRAY_CIRCLE_SMALL", weight: 30 }, { type: "GRAY_SQUARE_SMALL", weight: 10 }, { type: "YELLOW_CIRCLE_NORMAL", weight: 50 }, { type: "YELLOW_SQUARE_NORMAL", weight: 10 }],
    T2:  [{ type: "GRAY_CIRCLE_NORMAL", weight: 20 }, { type: "GRAY_SQUARE_SMALL_STRIPE", weight: 15 }, { type: "YELLOW_PINWHEEL_NORMAL", weight: 50 }, { type: "YELLOW_CIRCLE_NORMAL", weight: 15 }],
    T3:  [{ type: "GRAY_PINWHEEL_NORMAL", weight: 15 }, { type: "GRAY_SQUARE_NORMAL", weight: 25 }, { type: "YELLOW_PINWHEEL_NORMAL", weight: 40 }, { type: "YELLOW_SQUARE_NORMAL_STRIPE", weight: 20 }],
    T4:  [{ type: "GRAY_SQUARE_NORMAL", weight: 20 }, { type: "GRAY_CIRCLE_NORMAL_RING", weight: 10 }, { type: "YELLOW_SQUARE_NORMAL_RING", weight: 10 }, { type: "YELLOW_SQUARE_LARGE", weight: 40 }, { type: "YELLOW_PINWHEEL_NORMAL", weight: 20 }],
    T5:  [{ type: "GRAY_SQUARE_NORMAL_STRIPE", weight: 20 }, { type: "GRAY_CIRCLE_NORMAL", weight: 20 }, { type: "YELLOW_CIRCLE_LARGE", weight: 40 }, { type: "YELLOW_SQUARE_NORMAL", weight: 20 }],
    T6:  [{ type: "GRAY_PINWHEEL_NORMAL_RING", weight: 15 }, { type: "GRAY_SQUARE_NORMAL_RING", weight: 15 }, { type: "YELLOW_SQUARE_LARGE_RING", weight: 50 }, { type: "YELLOW_CIRCLE_LARGE", weight: 20 }],
    T7:  [{ type: "GRAY_PINWHEEL_LARGE", weight: 15 }, { type: "GRAY_CIRCLE_NORMAL", weight: 15 }, { type: "YELLOW_PINWHEEL_LARGE", weight: 40 }, { type: "YELLOW_SQUARE_LARGE_RING", weight: 30 }],
    T8:  [{ type: "GRAY_SQUARE_NORMAL", weight: 20 }, { type: "GRAY_PINWHEEL_LARGE_RING", weight: 10 }, { type: "YELLOW_SQUARE_LARGE_RING", weight: 30 }, { type: "YELLOW_CIRCLE_LARGE_RING", weight: 30 }, { type: "YELLOW_PINWHEEL_LARGE", weight: 10 }],
    T9:  [{ type: "GRAY_PINWHEEL_NORMAL", weight: 10 }, { type: "YELLOW_SQUARE_NORMAL", weight: 30 }, { type: "GRAY_SQUARE_LARGE_RING", weight: 10 }, { type: "YELLOW_SQUARE_LARGE_STRIPE", weight: 25 }, { type: "YELLOW_PINWHEEL_LARGE_RING", weight: 15 }, { type: "YELLOW_CIRCLE_NORMAL", weight: 10 }],
    T10: [{ type: "GRAY_CIRCLE_NORMAL", weight: 15 }, { type: "GRAY_PINWHEEL_LARGE_RING", weight: 10 }, { type: "YELLOW_SQUARE_LARGE_RING", weight: 35 }, { type: "YELLOW_CIRCLE_LARGE_RING", weight: 20 }, { type: "YELLOW_SQUARE_NORMAL_STRIPE", weight: 10 }, { type: "YELLOW_PINWHEEL_NORMAL", weight: 10 }]
};

// --- バリエーション: 標準（Gray）のみ ---
export const ENEMY_TIER_GRAY_ONLY = {
    description: "標準（Grayタイプ）のみ",
    T1:  [{ type: "GRAY_CIRCLE_SMALL", weight: 100 }],
    T2:  [{ type: "GRAY_CIRCLE_SMALL", weight: 50 }, { type: "GRAY_SQUARE_SMALL", weight: 50 }],
    T3:  [{ type: "GRAY_CIRCLE_NORMAL", weight: 60 }, { type: "GRAY_CIRCLE_SMALL_STRIPE", weight: 40 }],
    T4:  [{ type: "GRAY_CIRCLE_NORMAL", weight: 50 }, { type: "GRAY_SQUARE_SMALL_STRIPE", weight: 50 }],
    T5:  [{ type: "GRAY_PINWHEEL_NORMAL", weight: 80 }, { type: "GRAY_CIRCLE_SMALL_RING", weight: 20 }],
    T6:  [{ type: "GRAY_SQUARE_NORMAL", weight: 50 }, { type: "GRAY_PINWHEEL_NORMAL_STRIPE", weight: 30 }, { type: "GRAY_SQUARE_LARGE", weight: 20 }],
    T7:  [{ type: "GRAY_SQUARE_LARGE_STRIPE", weight: 50 }, { type: "GRAY_PINWHEEL_NORMAL_RING", weight: 20 }, { type: "GRAY_SQUARE_LARGE", weight: 30 }],
    T8:  [{ type: "GRAY_SQUARE_LARGE_STRIPE", weight: 30 }, { type: "GRAY_PINWHEEL_NORMAL_STRIPE", weight: 30 }, { type: "GRAY_SQUARE_LARGE_RING", weight: 40 }],
    T9:  [{ type: "GRAY_SQUARE_LARGE_STRIPE", weight: 30 }, { type: "GRAY_PINWHEEL_NORMAL_STRIPE", weight: 30 }, { type: "GRAY_SQUARE_LARGE_RING", weight: 40 }],
    T10: [{ type: "GRAY_SQUARE_LARGE_RING", weight: 30 }, { type: "GRAY_PINWHEEL_NORMAL_RING", weight: 20 }, { type: "GRAY_SQUARE_LARGE_STRIPE", weight: 50 }]
};

// --- バリエーション: 英語（Purple）のみ ---
export const ENEMY_TIER_PURPLE_ONLY = {
    description: "英語（Purpleタイプ）のみ",
    T1:  [{ type: "PURPLE_CIRCLE_SMALL", weight: 100 }],
    T2:  [{ type: "PURPLE_CIRCLE_SMALL", weight: 60 }, { type: "PURPLE_PINWHEEL_SMALL", weight: 40 }],
    T3:  [{ type: "PURPLE_SQUARE_NORMAL", weight: 70 }, { type: "PURPLE_CIRCLE_SMALL_RING", weight: 30 }],
    T4:  [{ type: "PURPLE_SQUARE_NORMAL_STRIPE", weight: 50 }, { type: "PURPLE_PINWHEEL_SMALL_STRIPE", weight: 50 }],
    T5:  [{ type: "PURPLE_SQUARE_NORMAL_RING", weight: 40 }, { type: "PURPLE_CIRCLE_NORMAL", weight: 40 }, { type: "PURPLE_CIRCLE_LARGE", weight: 20 }],
    T6:  [{ type: "PURPLE_CIRCLE_LARGE_STRIPE", weight: 50 }, { type: "PURPLE_PINWHEEL_NORMAL_RING", weight: 30 }, { type: "PURPLE_CIRCLE_LARGE", weight: 20 }],
    T7:  [{ type: "PURPLE_CIRCLE_LARGE_RING", weight: 50 }, { type: "PURPLE_SQUARE_NORMAL_RING", weight: 30 }, { type: "PURPLE_PINWHEEL_LARGE", weight: 20 }],
    T8:  [{ type: "PURPLE_CIRCLE_LARGE_RING", weight: 60 }, { type: "PURPLE_CIRCLE_LARGE_STRIPE", weight: 20 }, { type: "PURPLE_PINWHEEL_LARGE", weight: 20 }],
    T9:  [{ type: "PURPLE_CIRCLE_LARGE_RING", weight: 50 }, { type: "PURPLE_CIRCLE_LARGE_STRIPE", weight: 30 }, { type: "PURPLE_PINWHEEL_LARGE", weight: 20 }],
    T10: [{ type: "PURPLE_CIRCLE_LARGE_RING", weight: 40 }, { type: "PURPLE_CIRCLE_LARGE_STRIPE", weight: 30 }, { type: "PURPLE_PINWHEEL_LARGE", weight: 30 }]
};

// --- バリエーション: ことわざ（Yellow）のみ ---
export const ENEMY_TIER_YELLOW_ONLY = {
    description: "ことわざ（Yellowタイプ）のみ",
    T1:  [{ type: "YELLOW_CIRCLE_SMALL", weight: 100 }],
    T2:  [{ type: "YELLOW_CIRCLE_SMALL", weight: 70 }, { type: "YELLOW_CIRCLE_SMALL_STRIPE", weight: 30 }],
    T3:  [{ type: "YELLOW_PINWHEEL_NORMAL", weight: 80 }, { type: "YELLOW_CIRCLE_SMALL_RING", weight: 20 }],
    T4:  [{ type: "YELLOW_PINWHEEL_NORMAL_STRIPE", weight: 60 }, { type: "YELLOW_SQUARE_NORMAL", weight: 40 }],
    T5:  [{ type: "YELLOW_SQUARE_NORMAL_STRIPE", weight: 50 }, { type: "YELLOW_CIRCLE_NORMAL", weight: 30 }, { type: "YELLOW_SQUARE_LARGE", weight: 20 }],
    T6:  [{ type: "YELLOW_PINWHEEL_NORMAL_RING", weight: 50 }, { type: "YELLOW_SQUARE_LARGE_RING", weight: 20 }, { type: "YELLOW_CIRCLE_LARGE", weight: 30 }],
    T7:  [{ type: "YELLOW_SQUARE_LARGE_RING", weight: 50 }, { type: "YELLOW_PINWHEEL_NORMAL_RING", weight: 30 }, { type: "YELLOW_PINWHEEL_LARGE", weight: 20 }],
    T8:  [{ type: "YELLOW_SQUARE_LARGE_RING", weight: 60 }, { type: "YELLOW_CIRCLE_LARGE", weight: 20 }, { type: "YELLOW_PINWHEEL_LARGE", weight: 20 }],
    T9:  [{ type: "YELLOW_SQUARE_LARGE_RING", weight: 50 }, { type: "YELLOW_PINWHEEL_NORMAL_STRIPE", weight: 30 }, { type: "YELLOW_PINWHEEL_LARGE", weight: 20 }],
    T10: [{ type: "YELLOW_SQUARE_LARGE_RING", weight: 40 }, { type: "YELLOW_PINWHEEL_LARGE_STRIPE", weight: 30 }, { type: "YELLOW_CIRCLE_LARGE", weight: 30 }]
};

// --- バリエーション: 促音（Blue）のみ ---
export const ENEMY_TIER_BLUE_ONLY = {
    description: "促音（Blueタイプ）のみ",
    T1:  [{ type: "BLUE_PINWHEEL_SMALL", weight: 100 }],
    T2:  [{ type: "BLUE_PINWHEEL_SMALL", weight: 60 }, { type: "BLUE_CIRCLE_NORMAL", weight: 40 }],
    T3:  [{ type: "BLUE_CIRCLE_NORMAL_STRIPE", weight: 70 }, { type: "BLUE_PINWHEEL_SMALL_RING", weight: 30 }],
    T4:  [{ type: "BLUE_CIRCLE_NORMAL_RING", weight: 50 }, { type: "BLUE_SQUARE_NORMAL", weight: 50 }],
    T5:  [{ type: "BLUE_SQUARE_NORMAL_RING", weight: 40 }, { type: "BLUE_CIRCLE_NORMAL", weight: 40 }, { type: "BLUE_SQUARE_LARGE", weight: 20 }],
    T6:  [{ type: "BLUE_SQUARE_LARGE_STRIPE", weight: 50 }, { type: "BLUE_CIRCLE_NORMAL_STRIPE", weight: 30 }, { type: "BLUE_SQUARE_LARGE", weight: 20 }],
    T7:  [{ type: "BLUE_PINWHEEL_LARGE", weight: 50 }, { type: "BLUE_SQUARE_LARGE_RING", weight: 30 }, { type: "BLUE_SQUARE_LARGE", weight: 20 }],
    T8:  [{ type: "BLUE_SQUARE_LARGE_RING", weight: 60 }, { type: "BLUE_PINWHEEL_LARGE", weight: 20 }, { type: "BLUE_SQUARE_LARGE", weight: 20 }],
    T9:  [{ type: "BLUE_SQUARE_LARGE_RING", weight: 50 }, { type: "BLUE_SQUARE_LARGE_STRIPE", weight: 30 }, { type: "BLUE_PINWHEEL_LARGE", weight: 20 }],
    T10: [{ type: "BLUE_SQUARE_LARGE_RING", weight: 40 }, { type: "BLUE_SQUARE_LARGE_STRIPE", weight: 30 }, { type: "BLUE_PINWHEEL_LARGE", weight: 30 }]
};

// --- バリエーション: 擬音（Pink）のみ ---
export const ENEMY_TIER_PINK_ONLY = {
    description: "擬音（Pinkタイプ）のみ",
    T1:  [{ type: "PINK_SQUARE_SMALL", weight: 100 }],
    T2:  [{ type: "PINK_SQUARE_SMALL", weight: 60 }, { type: "PINK_PINWHEEL_SMALL", weight: 40 }],
    T3:  [{ type: "PINK_CIRCLE_NORMAL", weight: 70 }, { type: "PINK_SQUARE_SMALL_STRIPE", weight: 30 }],
    T4:  [{ type: "PINK_CIRCLE_NORMAL_STRIPE", weight: 50 }, { type: "PINK_SQUARE_SMALL_RING", weight: 50 }],
    T5:  [{ type: "PINK_CIRCLE_NORMAL_RING", weight: 40 }, { type: "PINK_SQUARE_NORMAL", weight: 40 }, { type: "PINK_PINWHEEL_LARGE", weight: 20 }],
    T6:  [{ type: "PINK_PINWHEEL_LARGE_STRIPE", weight: 50 }, { type: "PINK_CIRCLE_NORMAL_STRIPE", weight: 30 }, { type: "PINK_PINWHEEL_LARGE", weight: 20 }],
    T7:  [{ type: "PINK_PINWHEEL_LARGE_RING", weight: 50 }, { type: "PINK_PINWHEEL_LARGE_STRIPE", weight: 30 }, { type: "PINK_CIRCLE_LARGE", weight: 20 }],
    T8:  [{ type: "PINK_PINWHEEL_LARGE_RING", weight: 60 }, { type: "PINK_CIRCLE_NORMAL_RING", weight: 20 }, { type: "PINK_CIRCLE_LARGE", weight: 20 }],
    T9:  [{ type: "PINK_PINWHEEL_LARGE_RING", weight: 50 }, { type: "PINK_PINWHEEL_LARGE_STRIPE", weight: 30 }, { type: "PINK_CIRCLE_LARGE", weight: 20 }],
    T10: [{ type: "PINK_PINWHEEL_LARGE_RING", weight: 40 }, { type: "PINK_PINWHEEL_LARGE_STRIPE", weight: 30 }, { type: "PINK_CIRCLE_LARGE", weight: 30 }]
};

// --- バリエーション: 句読点（Green）のみ ---
export const ENEMY_TIER_GREEN_ONLY = {
    description: "句読点（Greenタイプ）のみ",
    T1:  [{ type: "GREEN_SQUARE_SMALL", weight: 100 }],
    T2:  [{ type: "GREEN_SQUARE_SMALL", weight: 60 }, { type: "GREEN_SQUARE_SMALL_STRIPE", weight: 40 }],
    T3:  [{ type: "GREEN_PINWHEEL_NORMAL", weight: 70 }, { type: "GREEN_SQUARE_SMALL_RING", weight: 30 }],
    T4:  [{ type: "GREEN_PINWHEEL_NORMAL_STRIPE", weight: 50 }, { type: "GREEN_CIRCLE_NORMAL_RING", weight: 50 }],
    T5:  [{ type: "GREEN_CIRCLE_NORMAL", weight: 40 }, { type: "GREEN_PINWHEEL_NORMAL_RING", weight: 40 }, { type: "GREEN_CIRCLE_LARGE", weight: 20 }],
    T6:  [{ type: "GREEN_CIRCLE_LARGE_STRIPE", weight: 50 }, { type: "GREEN_PINWHEEL_NORMAL_STRIPE", weight: 30 }, { type: "GREEN_CIRCLE_LARGE", weight: 20 }],
    T7:  [{ type: "GREEN_CIRCLE_LARGE_RING", weight: 50 }, { type: "GREEN_CIRCLE_LARGE_STRIPE", weight: 30 }, { type: "GREEN_PINWHEEL_LARGE", weight: 20 }],
    T8:  [{ type: "GREEN_CIRCLE_LARGE_RING", weight: 60 }, { type: "GREEN_PINWHEEL_NORMAL_RING", weight: 20 }, { type: "GREEN_PINWHEEL_LARGE", weight: 20 }],
    T9:  [{ type: "GREEN_CIRCLE_LARGE_RING", weight: 50 }, { type: "GREEN_CIRCLE_LARGE_STRIPE", weight: 30 }, { type: "GREEN_PINWHEEL_LARGE", weight: 20 }],
    T10: [{ type: "GREEN_CIRCLE_LARGE_RING", weight: 40 }, { type: "GREEN_CIRCLE_LARGE_STRIPE", weight: 30 }, { type: "GREEN_PINWHEEL_LARGE", weight: 30 }]
};

// --- バリエーション: 記号（Red）のみ ---
export const ENEMY_TIER_RED_ONLY = {
    description: "記号（Redタイプ）のみ",
    T1:  [{ type: "RED_CIRCLE_SMALL", weight: 100 }],
    T2:  [{ type: "RED_CIRCLE_SMALL", weight: 60 }, { type: "RED_PINWHEEL_SMALL", weight: 40 }],
    T3:  [{ type: "RED_SQUARE_NORMAL", weight: 70 }, { type: "RED_CIRCLE_SMALL_STRIPE", weight: 30 }],
    T4:  [{ type: "RED_SQUARE_NORMAL_STRIPE", weight: 50 }, { type: "RED_CIRCLE_SMALL_RING", weight: 50 }],
    T5:  [{ type: "RED_SQUARE_NORMAL_RING", weight: 40 }, { type: "RED_SQUARE_NORMAL", weight: 40 }, { type: "RED_PINWHEEL_LARGE", weight: 20 }],
    T6:  [{ type: "RED_PINWHEEL_LARGE_STRIPE", weight: 50 }, { type: "RED_SQUARE_NORMAL_STRIPE", weight: 30 }, { type: "RED_PINWHEEL_LARGE", weight: 20 }],
    T7:  [{ type: "RED_PINWHEEL_LARGE_RING", weight: 50 }, { type: "RED_PINWHEEL_LARGE_STRIPE", weight: 30 }, { type: "RED_CIRCLE_LARGE", weight: 20 }],
    T8:  [{ type: "RED_PINWHEEL_LARGE_RING", weight: 60 }, { type: "RED_SQUARE_NORMAL_RING", weight: 20 }, { type: "RED_CIRCLE_LARGE", weight: 20 }],
    T9:  [{ type: "RED_PINWHEEL_LARGE_RING", weight: 50 }, { type: "RED_PINWHEEL_LARGE_STRIPE", weight: 30 }, { type: "RED_CIRCLE_LARGE", weight: 20 }],
    T10: [{ type: "RED_PINWHEEL_LARGE_RING", weight: 40 }, { type: "RED_PINWHEEL_LARGE_STRIPE", weight: 30 }, { type: "RED_CIRCLE_LARGE", weight: 30 }]
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

// 固定砲台の追加重み。T3から出現し、T8以降で頭打ちにする。
// 属性「のみ」の表には混在させない。
const FIXED_TURRET_TIER_ENTRIES = {
    T3:  [{ type: "FIXED_TURRET_LASER_T3", weight: 5 }, { type: "FIXED_TURRET_BULLET_T3", weight: 5 }],
    T4:  [{ type: "FIXED_TURRET_LASER_T4", weight: 5 }, { type: "FIXED_TURRET_BULLET_T4", weight: 5 }],
    T5:  [{ type: "FIXED_TURRET_LASER_T5", weight: 5 }, { type: "FIXED_TURRET_BULLET_T5", weight: 5 }],
    T6:  [{ type: "FIXED_TURRET_LASER_T6", weight: 5 }, { type: "FIXED_TURRET_BULLET_T6", weight: 5 }],
    T7:  [{ type: "FIXED_TURRET_LASER_T7", weight: 5 }, { type: "FIXED_TURRET_BULLET_T7", weight: 5 }],
    T8:  [{ type: "FIXED_TURRET_LASER_T8", weight: 5 }, { type: "FIXED_TURRET_BULLET_T8", weight: 5 }],
    T9:  [{ type: "FIXED_TURRET_LASER_T9", weight: 5 }, { type: "FIXED_TURRET_BULLET_T9", weight: 5 }],
    T10: [{ type: "FIXED_TURRET_LASER_T10", weight: 5 }, { type: "FIXED_TURRET_BULLET_T10", weight: 5 }],
};

function addFixedTurretEntriesToTable(table) {
    if (!table || String(table.description || "").includes("のみ")) return;

    for (const [tierKey, entries] of Object.entries(FIXED_TURRET_TIER_ENTRIES)) {
        const target = table[tierKey];
        if (!Array.isArray(target) || !entries?.length) continue;

        const missing = entries.filter(entry =>
            !target.some(current => current?.type === entry.type)
        );
        if (missing.length > 0) {
            target.push(...missing.map(entry => ({ ...entry })));
        }
    }
}

// 公開Tier表自体にも固定砲台を反映し、getTierEnemies経由だけでなく
// テーブルを直接参照するツールからもT3以降の固定砲台を確認できる。
for (const table of Object.values(TIER_TABLES)) {
    addFixedTurretEntriesToTable(table);
}

// 旧名互換用
const ENEMY_TIER_TABLE = ENEMY_TIER_BALANCED;

/**
 * 指定した属性テーブルからTierの敵セットを取得
 */
export function getTierEnemies(tierKey, table = ENEMY_TIER_BALANCED) {
    if (!table) return [];

    // 公開テーブルは初期化時に更新済みだが、外部から渡された表にも対応する。
    addFixedTurretEntriesToTable(table);

    const result = table[tierKey] || table.T1 || [];
    return Array.isArray(result) ? [...result] : [];
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
    return `T${Math.min(5, Math.ceil(stageNum / 10))}`;
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
 *    2: 【殲滅目標】   - 有限の出現数(limit)を全滅させるか、制限時間まで生存。
 *    3: 【電撃戦】     - 短い制限時間 + HP減少で敵が加速するberserk戦。
 *    4: 【精密防衛】   - 高密度サバイバル。出現数多め。
 *    5: 【タイムアタック】- 時間内に通常より多いノルマを達成。
 *    6: 【サボタージュ】- HP継続減少デバフ + 撃破目標。
 *    7: 【圧倒】       - 同時出現上限(maxAlive)大幅増 + 低速化で滞留 + 生存目標。
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
 * 1.6 同時出現（マルチスポーン）:
 *    - spawn.multiCount    : 1回の出現で同時に出す敵の数（既定 1 = 従来どおり1体ずつ）
 *    - spawn.multiInterval : 何回に1回まとめて出すか（既定 1 = 毎回まとめて出す）
 *      multiInterval: 2 なら「2回に1回」だけ multiCount 匹を同時出現させる。
 *    - 出現例: multiCount:2, multiInterval:2 → 1回目1匹 / 2回目2匹 / 3回目1匹 / 4回目2匹 …
 *              multiCount:3, multiInterval:3 → 3回に1回だけ3匹同時
 *              multiCount:2, multiInterval:1 → 毎回2匹同時
 *    - 採用パターン:
 *        case3 電撃戦   : multiCount 2（i>=40 で3） / multiInterval 3（i>=40 で2）
 *        case4 精密防衛 : multiCount 2 / multiInterval 2（i>=50 で1）
 *        case7 圧倒     : multiCount 3 / multiInterval 2
 *    - 注意: limit / maxAlive は1体ずつ判定して超過分は出現させずに打ち切る。
 *            limit:1 / maxAlive:1 のボス戦などでは実質無効（常に1体）。
 *            単語が枯渇した場合もその回の同時出現はそこで打ち切られる。
 *
 * 2. 難易度スケーリング (変数 i = ステージ番号):
 *    - 出現間隔: 3000ms (固定)
 *    - 撃破目標: 5 + floor(i / 4)
 *    - 制限時間: 30s + (i * 0.3s)
 *    - 同時存在数: 3 + floor(i / 25)  ※通常時最大6
 *    - マルチスポーン: multiCount 1 / multiInterval 1（パターン別に上書き。1.6 同時出現 参照）
 *
 * 3. ステージ/環境設定:
 *    - 背景画像: 1-30:blue, 31-60:purple, 60-90:red
 *    - アイテム: ステージ12で解禁。
 *               出現率: 0.3 + (i * 0.005)
 *               Tier遷移: 10ステージごとにT1→T5へ上昇。
 *
 * 4. エネミーTier定義:
 *    - 通常クエストステージでは10ステージごとに T1 ～ T10 へ自動遷移する。
 *    - 自動生成ステージとの対応（STAGE1 ～ STAGE100）:
 *        T1  : STAGE1  - STAGE10
 *        T2  : STAGE11 - STAGE20
 *        T3  : STAGE21 - STAGE30
 *        T4  : STAGE31 - STAGE40
 *        T5  : STAGE41 - STAGE50
 *        T6  : STAGE51 - STAGE60
 *        T7  : STAGE61 - STAGE70
 *        T8  : STAGE71 - STAGE80
 *        T9  : STAGE81 - STAGE90
 *        T10 : STAGE91 - STAGE100
 *    - ステージ番号が100を超える場合はT10に固定される。
 *    - T1-T2: 小型/標準 (Gray主体)
 *    - T3-T5: 中型/特殊属性 (Purple, Blueなど) 混入開始
 *    - T6-T8: 大型/リング/ストライプ等の高耐久・複雑なワード
 *    - T9-T10: 各属性の最上位個体 + 低確率で超大型
 *    - ボス戦・特殊ステージは getTierEnemies("Tn", ...) の手動指定に従い、
 *      上記のステージ番号とは独立してT1～T10を選択する場合がある。
 *    - フリーモードも画面上で選択したTierを直接使用する。
 *
 * 5. スター評価:
 *    - パターンに応じて「KPM/クリア時間/正確性/残りHP/残り時間/総合」から動的に選出。
 */
// ==============================================================

function generateStage(i, tierTable = ENEMY_TIER_BALANCED, explicitPattern = null) {
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
    let pattern = explicitPattern;
    if (pattern === null || pattern === undefined) {
        const lastDigit = i % 10;
        if (lastDigit >= 1 && lastDigit <= 3) {
            // 下一桁が1-3の場合: ミッションパターン0-2（基本形）
            pattern = Math.floor(Math.random() * 3);
        } else {
            // それ以外: 応用・全パターン
            pattern = Math.floor(Math.random() * 10);
        }
    }

    // 難易度の緩やかな上昇計算
    const baseSpawnInterval = 4000; // 基本の出現間隔を4秒に固定
    const killGoal = 10 + Math.floor(i / 4); // 討伐目標数
    const timeLimit = 30000 + (i * 1000); // 30秒〜130秒程度
    const maxAlive = Math.min(8, 4 + Math.floor(i / 25)); // 通常ミッションは最大8体までに制限

    // ミッションパターンごとの説明
    const missionDescriptions = [
        { name: "撃破", desc: "指定数の敵を撃破せよ！" },
        { name: "生存", desc: "制限時間まで生き残れ！" },
        { name: "殲滅", desc: "敵を全て殲滅せよ！" },
        { name: "電撃戦", desc: "短時間で敵を撃破せよ！HPが減ると敵が加速！" },
        { name: "精密防衛", desc: "高密度攻撃を防衛せよ！" },
        { name: "タイムアタック", desc: "時間内に指定数撃破！" },
        { name: "サボタージュ", desc: "HP減少の中、敵を撃破せよ！" },
        { name: "圧倒", desc: "低速の敵が大量に滞留！捌き切れ！" },
        { name: "精密射撃", desc: "ミスなく敵を撃破せよ！" },
        { name: "純粋なる試練", desc: "アイテム・スキルなしで敵を撃破せよ！" }
    ];

    const currentMission = missionDescriptions[pattern];
    const currentEnemyVariationDescription = getTierDescription(selectedTable);

    let config = {
        // bgImage: i <= 33 ? "battle_blue" : i <= 66 ? "battle_green" : "battle_gray",
        // ↑ この行をコメントアウトまたは削除します。
        spawn: {
            interval: baseSpawnInterval,
            limit: null,
            maxAlive: maxAlive,
            immediateOnClear: false,
            multiCount: 1,      // ★同時出現数（既定は1体ずつ）
            multiInterval: 1    // ★同時出現タイミング（1 = 毎回 / 2 = 2回に1回まとめて multiCount 体）
        },
        enemyTable: getTierEnemies(tier, selectedTable),
        missionName: currentMission.name,
        missionDescription: currentMission.desc,
        enemyVariationDescription: currentEnemyVariationDescription,
    };

    // 2. パターン別の条件設定
    switch (pattern) {
        case 0: // 【撃破目標】指定数倒せばクリア
            config.spawn.limit = null;
            config.endConditions = { hpZero: true, killCount: killGoal };
            config.clearConditions = { killCount: killGoal };
            config.spawn.immediateOnClear = true; // 敵がいなくなったら即座に次を出す
            
            // スター：タイピング速度(KPM) または 正確性（時間無制限＝じっくり質実な撃破任務）
            if (Math.random() > 0.5) {
                config.star = {
                  type: "typingSpeed",
                  thresholds: [ // 圧倒も厳しかったため緩和
                      80 + (i * 0.5), // 精密射撃も緩和
                      100 + (i * 0.5),
                      130 + (i * 0.5),
                      150 + (i * 0.5),
                      170 + (i * 0.5)
                  ]
                };
            } else {
                // 正確性（丁寧に戦うほど星が増える）
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

        case 2: // 【殲滅目標】出現した敵を全て倒す。
            const spawnLimit = Math.floor(killGoal * 0.8) + 5;
            config.spawn.limit = spawnLimit;
            config.endConditions = {
                hpZero: true,
                allSpawnedDefeated: true     // (表示用) 全滅でも終了
            };
            config.clearConditions = { survive: true }; // ★ 生存クリア：1匹残してもクリア可能に
            config.phaseConditions = { allSpawnedDefeated: true }; // 全滅させればその時点で早期クリア
            config.spawn.immediateOnClear = true; // 殲滅目標では即時スポーンが効果的

            // スター：総合評価(Composite) または クリア時間
            if (Math.random() > 0.5) {
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
            } else {
                const minSpawnTime = (spawnLimit - 1) * config.spawn.interval;
                const typingBuffer = 1500;
                const minPossibleTime = minSpawnTime + typingBuffer;
                const baseTime = Math.max(minPossibleTime + 10000, spawnLimit * 4000);

                // ★★★ 修正: 最低保証時間(minPossibleTime)を基準に、段階的に目標時間を設定する
                // これにより、ステージが進んでも目標タイムが適切にスケールするようになります。
                config.star = {
                    type: "clearTime",
                    thresholds: [
                        // [★1, ★2, ★3, ★4, ★5] の目標タイム (ms)
                        minPossibleTime + 15000, minPossibleTime + 10000, minPossibleTime + 6000, minPossibleTime + 3000, minPossibleTime + 1000
                    ]
                };
            }
            break;

        case 3: // 【電撃戦】短時間で決着。HPが減るほど敵が加速する(berserk)
            const blitzTime = Math.max(30000, 25000 + (i * 250)); // 制限時間 (30sベース)
            const blitzKillGoal = Math.floor(killGoal * 0.6); // 討伐目標を基本の6割に緩和
            config.spawn.interval *= 0.8; // 敵がどんどん出る
            // 出現数は討伐目標より多め（猶予付き）：倒し切らなくても討伐数到達でクリア
            config.spawn.limit = Math.floor(blitzKillGoal * 1.5) + 3;
            config.endConditions = { hpZero: true, timerMs: blitzTime, killCount: blitzKillGoal };
            config.clearConditions = { killCount: blitzKillGoal };
            config.phaseConditions = { killCount: blitzKillGoal }; // ★ 討伐数到達でフェーズ完了（全滅不要＝逃しても詰まない）
            config.spawn.immediateOnClear = true;

            // ★同時出現：3回に1回は2体まとめて出現（ステージ40以降は2回に1回3体）
            config.spawn.multiCount = i >= 40 ? 3 : 2;
            config.spawn.multiInterval = i >= 40 ? 2 : 3;

            // ★ berserk: 残りHPが少ないほど敵が加速（最大 +60%、ステージ進行で最大+100%まで強化）
            config.berserk = { maxBoost: 0.6 + Math.min(0.4, i * 0.005) };

            // スター：タイピング速度(KPM)
            config.star = {
                type: "typingSpeed",
                thresholds: [ // 圧倒も厳しかったため緩和
                    80 + (i * 0.5), // 精密射撃も緩和
                    100 + (i * 0.5),
                    130 + (i * 0.5),
                    150 + (i * 0.5),
                    170 + (i * 0.5)
                ]
            };
            break;

        case 4: // 【精密防衛】高密度サバイバル
            config.spawn.maxAlive += 2; // 増加量を抑制
            config.spawn.interval *= 0.8;
            // ★同時出現：2回に1回まとめて2体（ステージ50以降は毎回2体で高密度化）
            config.spawn.multiCount = 2;
            config.spawn.multiInterval = i >= 50 ? 1 : 2;
            config.endConditions = { hpZero: true, timerMs: timeLimit * 0.8 };
            config.clearConditions = { survive: true };

            // スター：正確性(Accuracy) ではなく 残りHP率に変更（1ミス終了ルールの親和性のため）
            config.star = {
                type: "hpRemaining",
                thresholds: [
                    0.4, 
                    0.6, 
                    0.7, 
                    0.8, 
                    0.9,
                ]
            };
            break;

        case 5: // 【タイムアタック】指定時間内に指定数撃破
            const timeAttackTime = Math.max(30000, 35000 + (i * 300)); // 30秒〜60秒程度
            const timeAttackKillGoal = Math.floor( killGoal * 0.6); 
            config.spawn.interval *= 0.8; // 敵の出現を少し早める
            config.spawn.limit = null;
            config.endConditions = { hpZero: true, killCount: timeAttackKillGoal, timerMs: timeAttackTime };
            config.clearConditions = { killCount: timeAttackKillGoal };
            config.spawn.immediateOnClear = true; // タイムアタックには必須級の機能

            // スター：クリア時間 または タイピング速度
            if (Math.random() > 0.5) {
                config.star = {
                    type: "clearTime",
                    thresholds: [
                        timeAttackTime,
                        Math.max(timeAttackTime * 0.98),
                        Math.max(timeAttackTime * 0.95),
                        Math.max(timeAttackTime * 0.92),
                        Math.max(timeAttackTime * 0.88)
                    ]
                };
            } else {
                config.star = {
                    type: "typingSpeed",
                    thresholds: [ // 圧倒も厳しかったため緩和
                        80 + (i * 0.5), // 精密射撃も緩和
                        100 + (i * 0.5),
                        130 + (i * 0.5),
                        150 + (i * 0.5),
                        170 + (i * 0.5)
                    ]
                };
            }
            break;

        case 6: // 【サボタージュ】HPが徐々に減る中、指定数撃破
            const sabotageKillTarget = killGoal + Math.floor(i / 3);
            config.spawn.limit = null;
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
            config.spawn.interval *= 0.6; // 出現頻度を抑える (0.7 -> 0.8)
            config.spawn.maxAlive = Math.min(14, maxAlive + 6); // 大幅増 → 画面に敵が溜まり続ける
            config.enemySpeedMultiplier = 0.6; // ★ 敵を低速化：到達が遅く、画面上に滞留して密度が上がる
            // ★同時出現：2回に1回は3体まとめて出現（maxAlive 14 の範囲でループ側が自動制限）
            config.spawn.multiCount = 3;
            config.spawn.multiInterval = 2;
            config.spawn.limit = null; // 無限湧き
            config.endConditions = { hpZero: true, timerMs: overwhelmTime };
            config.clearConditions = { survive: true };

             // 圧倒的な敵を捌くにはタイピング速度が最も重要
            config.star = {
                type: "typingSpeed",
                thresholds: [ // 圧倒も厳しかったため緩和
                    80 + (i * 0.5), // 精密射撃も緩和
                    100 + (i * 0.5),
                    130 + (i * 0.5),
                    150 + (i * 0.5),
                    170 + (i * 0.5)
                ]
            };
            break;

        case 8: // 【精密射撃】ミスなく敵を撃破 (Precision Shot)
            const precisionKillTarget = killGoal + Math.floor(i / 5);
            let missLimit = 1;
            if (i <= 30) {
                missLimit = 4;
            } else if (i <= 60) {
                missLimit = 2;
            }
     
            config.spawn.limit = precisionKillTarget; // 倒すべき敵は有限
            config.spawn.maxAlive = Math.min(maxAlive, 2 + Math.floor(i / 30)); // さらに少なめに調整
            config.spawn.interval *= 1.2; // 少しゆっくり出現
            config.endConditions = { 
                hpZero: true, 
                allSpawnedDefeated: true,
                failOnMissCount: missLimit
            };
            config.spawn.immediateOnClear = true;
            config.clearConditions = { 
                killCount: precisionKillTarget,
                noMiss: missLimit === 1 // 許容ミスが1回の場合のみノーミス条件
            };

            // スター：タイピング速度(KPM) に変更（ミス＝終了のため正確性は常に100%になるため）
            config.star = {
                type: "typingSpeed",
                thresholds: [
                    80 + (i * 0.5), // 精密射撃も緩和
                    100 + (i * 0.5),
                    130 + (i * 0.5),
                    150 + (i * 0.5),
                    170 + (i * 0.5)
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

    // ステージ12からアイテム解禁
    if (i >= 12 && config.itemSpawn !== null) {
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
const QUEST_STAGES_STORAGE_KEY = "QuestStages_Cache_v3";

function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * クエストステージのキャッシュ移行：同時出現（マルチスポーン）パラメータの補完
 *
 * クエストステージは生成時の内容を LocalStorage に保存して固定するため、
 * 同時出現パラメータの追加前に生成されたキャッシュには multiCount / multiInterval が
 * 存在しない（＝出現処理側で 1 にフォールバックされ、同時出現が効かない）。
 *
 * ここでは以下だけを行う。
 *   - ステージ内容から ケース3（電撃戦）/ ケース4（精密防衛）/ ケース7（圧倒）を判定
 *   - ステージ番号（キャッシュキー "STAGE<n>"）から generateStage と同じ既定値を適用
 *   - 上記以外のステージは 1 / 1（従来どおり1体ずつ）を補完
 *
 * 進行状況・敵構成・出現間隔・終了条件など、スポーン以外の設定には一切触れない。
 */

/**
 * キャッシュされたステージがどの出現パターン（generateStage の switch case）に該当するか判定する。
 * @param {Object} stage ステージ設定
 * @returns {number|null} case番号（3 / 4 / 7）、判定できない場合は null
 */
function detectMultiSpawnPattern(stage) {
    // 最も確実な判定：ミッション名
    if (stage.missionName) {
        if (stage.missionName === "電撃戦") return 3;
        if (stage.missionName === "精密防衛") return 4;
        if (stage.missionName === "圧倒") return 7;
    }

    // 旧キャッシュで missionName が無い場合の保険（generateStage が設定する固有フィールドで判定）
    if (stage.berserk) return 3;
    if (stage.enemySpeedMultiplier === 0.6) return 7;
    if (stage.star?.type === "hpRemaining" && stage.clearConditions?.survive && stage.endConditions?.timerMs) return 4;

    return null;
}

/**
 * 旧キャッシュに欠けている同時出現パラメータを補完する。
 * @param {Object} stages キャッシュされたクエストステージ（STAGE1〜STAGE100）
 * @returns {boolean} 補完して保存し直した場合は true
 */
function backfillMultiSpawnSettings(stages) {
    if (!stages || typeof stages !== "object") return false;

    let changed = false;

    for (const [key, stage] of Object.entries(stages)) {
        if (!stage || typeof stage !== "object" || !stage.spawn || typeof stage.spawn !== "object") {
            continue;
        }

        // ステージ番号（generateStage の i 相当）をキャッシュキーから取得
        const numMatch = /^STAGE(\d+)$/.exec(key);
        const stageNum = numMatch ? parseInt(numMatch[1], 10) : null;
        const isLateStage = (threshold) => stageNum !== null && stageNum >= threshold;

        // ケース3 / 4 / 7 以外は generateStage と同じ既定値（従来どおり1体ずつ）
        let multiCount = 1;
        let multiInterval = 1;

        switch (detectMultiSpawnPattern(stage)) {
            case 3: // 【電撃戦】3回に1回2体（ステージ40以降は2回に1回3体）
                multiCount = isLateStage(40) ? 3 : 2;
                multiInterval = isLateStage(40) ? 2 : 3;
                break;
            case 4: // 【精密防衛】2回に1回2体（ステージ50以降は毎回2体）
                multiCount = 2;
                multiInterval = isLateStage(50) ? 1 : 2;
                break;
            case 7: // 【圧倒】2回に1回3体
                multiCount = 3;
                multiInterval = 2;
                break;
            default:
                // 既定値が設定済みなら何もしない（手動調整済み設定を壊さないため）
                if (stage.spawn.multiCount !== undefined && stage.spawn.multiInterval !== undefined) {
                    continue;
                }
                break;
        }

        if (stage.spawn.multiCount === multiCount && stage.spawn.multiInterval === multiInterval) {
            continue;
        }

        stage.spawn.multiCount = multiCount;
        stage.spawn.multiInterval = multiInterval;
        changed = true;
    }

    return changed;
}

/**
 * 既存クエストキャッシュへ固定砲台を後付けする。
 * 同じ table を二度変更しないよう、既存の固定砲台IDを確認してから不足分だけ追加する。
 */
function backfillFixedTurretEntries(stages) {
    if (!stages || typeof stages !== "object") return false;

    let changed = false;
    const addToTable = (table, tierKey) => {
        if (!Array.isArray(table)) return;
        if (tierKey === "T1" || tierKey === "T2") return;
        const entries = FIXED_TURRET_TIER_ENTRIES[tierKey];
        if (!entries?.length) return;

        const missing = entries.filter(entry =>
            !table.some(current => current?.type === entry.type)
        );
        if (missing.length === 0) return;

        // ボス専用フェーズには通常砲台を混在させない。
        if (table.some(entry => /BOSS|MID_BOSS|LAST_BOSS|EX_BOSS/.test(String(entry?.type || "")))) {
            return;
        }

        table.push(...missing.map(entry => ({ ...entry })));
        changed = true;
    };

    for (const [key, stage] of Object.entries(stages)) {
        const match = /^STAGE(\d+)$/.exec(key);
        if (!match || !stage || typeof stage !== "object") continue;

        const stageNum = Number(match[1]);
        if (!Number.isFinite(stageNum) || stageNum < 21) continue;
        if (String(stage.enemyVariationDescription || "").includes("のみ")) continue;
        const tierKey = `T${Math.min(10, Math.ceil(stageNum / 10))}`;

        addToTable(stage.enemyTable, tierKey);
        if (Array.isArray(stage.phases)) {
            stage.phases.forEach(phase => addToTable(phase?.enemyTable, tierKey));
        }
    }

    return changed;
}

function initGeneratedStages() {
    if (typeof localStorage === 'undefined') return {}; // 非ブラウザ環境用セーフティ

    const cached = localStorage.getItem(QUEST_STAGES_STORAGE_KEY);
    if (cached) {
        try {
            const parsed = JSON.parse(cached);

            // ★旧キャッシュ移行：同時出現パラメータと固定砲台を補完し、保存し直す
            // （進行データには影響しない。ステージ構成・敵内容もそのまま維持される）
            const multiSpawnChanged = backfillMultiSpawnSettings(parsed);
            const turretChanged = backfillFixedTurretEntries(parsed);
            if (multiSpawnChanged || turretChanged) {
                localStorage.setItem(QUEST_STAGES_STORAGE_KEY, JSON.stringify(parsed));
            }

            return parsed;
        } catch (e) {
            console.warn("Quest stage cache corrupted. Regenerating...");
        }
    }

    // キャッシュがない（New Game時など）場合は新規生成して保存
    const newStages = {};
    // 10ステージごとの区切り（1-10, 11-20, ...）で全10パターンを配置
    for (let block = 0; block < 10; block++) {
        // 序盤（下一桁 1〜3）: 基本形 [0:撃破, 1:生存, 2:殲滅] をシャッフルして配置
        const basicPatterns = shuffleArray([0, 1, 2]);
        // 中盤〜後半（下一桁 4〜10）: 応用形 [3:電撃戦, 4:精密防衛, 5:タイムアタック, 6:サボタージュ, 7:圧倒, 8:精密射撃, 9:純粋なる試練] をシャッフルして配置
        const advancedPatterns = shuffleArray([3, 4, 5, 6, 7, 8, 9]);

        const patterns = [...basicPatterns, ...advancedPatterns];

        for (let step = 0; step < 10; step++) {
            const stageNum = block * 10 + step + 1;
            newStages[`STAGE${stageNum}`] = generateStage(stageNum, ENEMY_TIER_BALANCED, patterns[step]);
        }
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


// =========================================================================
// ステージ設定リファレンス
// =========================================================================
/*
STAGES = {
  ステージID: {
    // ---------------------------
    // ステージ全体の設定
    // ---------------------------
    bgm: "bgm_swim",     // ステージ全体のBGM
    bgImage: "battle_blue", // ステージ全体の背景画像

    // ---------------------------
    // フェーズ設定（複数フェーズを持つステージの場合）
    // ---------------------------
    phases: [
      { name: "Phase 1", bgm: "bgm_rainy",  各フェーズ固有の設定...  },
      { name: "Phase 2",  ...  }
    ],

    // ---------------------------
    // 敵出現設定
    // ---------------------------
    spawn: {
      interval: 3000,   // 出現間隔(ms)
      limit: 10,        // 総出現数上限
                           // null = 無限
      maxAlive: 5,      // 同時存在数上限
                           // null = 無制限
      immediateOnClear: false, // 敵が全滅した際に即座に次を出すか

      // ★同時出現（マルチスポーン）
      multiCount: 1,    // 1回の出現で同時に出す敵の数（2なら2匹同時）
      multiInterval: 1  // 何回に1回まとめて出すか
                        //   2 → 「2回に1回」だけ multiCount 匹同時
                        //   1 → 毎回まとめて出す（multiCount:1 なら従来どおり1匹ずつ）
                        // 例) multiCount:2, multiInterval:2 → 1匹/2匹/1匹/2匹… の繰り返し
                        //     multiCount:3, multiInterval:1 → 常に3匹同時
                        // ※ limit / maxAlive は1体ずつ判定し、超過分は出現させずに打ち切る
                        // ※ phases 内の spawn に書けばフェーズ単位で切り替え可能
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
      endless: false              // endlessフラグ trueの場合、HP0でも失敗扱いにならない
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
    },
    // ---------------------------
    // フェーズごとの条件
    // ---------------------------
    phaseConditions: {
      killCount: 10,             // このフェーズでの撃破目標
      timerMs: 30000,            // このフェーズの制限時間
      allSpawnedDefeated: true   // このフェーズの敵を全滅させると次へ
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

defenseSurplus → 防衛モード専用（超過率×surplusWeight ＋ 正確率×accuracyWeight）
  thresholds: [0.4,0.45,0.5,0.6,0.7]  // 総合スコア閾値（クリアすれば最低1つ星獲得）
  weights: { surplus: 0.4, accuracy: 0.6 }  // 超過率/正確率の重み
    score = (入力文字数 / 目標文字数 − 1.0) × surplus ＋ 正確率(0〜1) × accuracy
    ※ 失敗（時間切れで未達成）時は星0
*/

// =========================================================================
// 防衛モード（Defense）ステージ設定リファレンス
// =========================================================================
/*
通常ステージの代わりに、以下のようにして防衛戦ステージを定義する。

DEFENSE_1: {
  isDefenseMode: true,   // ★必須: このフラグで防衛戦として起動する
  bgm: "bgm_universe",   // 防衛戦のBGM（省略可）
  missionName: "コア防衛戦線",
  missionDescription: "時間内に、指定された文字数を入力せよ。",

  defenseConfig: {       // ★防衛モード専用の設定
    totalCharsToType: 300,       // 目標文字数（タイムアップ時にこの数に達していればクリア）
    timeLimit: 120,              // 制限時間（秒）
    genres: ['empty', '促音', 'ことわざ'], // 出題ジャンル（下記参照）
    minLength: 4,                // 出題単語の最小文字数
    maxLength: 8                 // 出題単語の最大文字数
  },

  // 星評価は 防衛モード専用 type を使用する（下記 star.type 一覧 参照）
  star: {
    type: "defenseSurplus",
    thresholds: [0.4, 0.45, 0.5, 0.6, 0.7],
    weights: { surplus: 0.4, accuracy: 0.6 }
  }
}

===============================
defenseConfig.genres の書き方
===============================
  ['empty']                     → 標準（タグ無し）のみ
  ['empty', '促音', 'ことわざ']  → 標準 ＋ 指定タグ（OR条件で共存できる）
  ['all']                       → 全ジャンル（標準 ＋ すべてのタグ）

  ※ 標準（'empty'）は他のタグと同時に指定可能。
     'empty'の単語は①タグ無し判定で、タグ付き単語は②タグ一致(OR)で採用される。

  利用可能タグ: 句読点 / 促音 / 記号 / 英語 / ことわざ / 擬音 / 数字 / ネタ
  （※ 長文タグの文学・おもしろ等はTARGETSに無いため防衛戦では使用不可）

===============================
防衛戦の勝敗判定（defenseCore.js 準拠）
===============================
  タイムアップ（timeLimit 到達）が唯一の終了条件。
    入力文字数 >= totalCharsToType ならクリア（成功）
    入力文字数 <  totalCharsToType なら失敗
*/
//===================================================================================

// =====================================================
// ステージ設定（個別）
// =====================================================
export const STAGES = {

  // =====================================================
  // デイリー free
  // =====================================================

  DAILY: {
    bgImage: "battle_gray",

    phases: [
      {
        name: "phase1",
        bgm: "bgm_harunosuisou", 
        spawn: {
          interval: 2500,
          limit: null,
          maxAlive: 4,
          immediateOnClear: true
        },
        enemyTable: getTierEnemies("T2", ENEMY_TIER_BALANCED),
        phaseConditions: { timerMs: 30000 }
      },
      {
        name: "phase2",
        bgm: "bgm_rojiura", 
        spawn: {
          interval:2500,
          limit: null,
          maxAlive: 5,
          immediateOnClear: true
        },
        enemyTable: getTierEnemies("T4", ENEMY_TIER_BALANCED),
        phaseConditions: { timerMs: 30000 }
      },
      {
        name: "phase3",
        bgm: "bgm_yamiyo", 
        spawn: {
          interval: 2500,
          limit: null,
          maxAlive: 6,
          immediateOnClear: true
        },
        enemyTable: getTierEnemies("T6", ENEMY_TIER_BALANCED),
        phaseConditions: { timerMs: 30000 }
      },
      {
        name: "phase4",
        bgm: "bgm_reflectable", 
        spawn: {
          interval: 2500,
          limit: null,
          maxAlive: 6,
          immediateOnClear: true
        },
        enemyTable: getTierEnemies("T8", ENEMY_TIER_BALANCED),
        //phaseConditions: { allSpawnedDefeated: true }
      },
    ],
    endConditions: {
      hpZero: true,
    },
    // DAILYモードはendlessフラグをtrueにすることで、HP0でも失敗扱いにならないようにする
    clearConditions: {
      killCount: 1, 
      endless: true
    },
  },

  FREE: {
    bgImage: "battle_gray",
    spawn: { interval: 2000, limit: null, maxAlive: null, immediateOnClear: false },
        enemyTable: getTierEnemies("T2", ENEMY_TIER_BALANCED),
    endConditions: { hpZero: true, timerMs: 30000 },
    clearConditions: { killCount: 10 },
    star: { type: "typingSpeed", thresholds: [100, 150, 200, 250, 300] }
  },
    ...generatedStages,

  // =====================================================
  // 中ボスステージ
  // =====================================================

  // 第10ステージ後のレベルチェック（中ボス）
  W1_MID_BOSS_1: {
    phases: [
      {
        name: "phase 1",
        spawn: { interval: 2500, limit: null, maxAlive: 4, immediateOnClear: true },
        enemyTable: getTierEnemies("T1", ENEMY_TIER_BALANCED),
        immediateOnClear: true,
        phaseConditions: { killCount: 10 }
      },
      {
        name: "mid boss",
        bgm: "bgm_reflectable",
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
        name: "phase 1",
        spawn: { interval: 2500, limit: 15, maxAlive: 5, immediateOnClear: true },
        enemyTable: getTierEnemies("T2", ENEMY_TIER_BALANCED),
        phaseConditions: { killCount: 15 }
      },
      {
        name: "mid boss",
        bgm: "bgm_reflectable",
        spawn: { interval: 1000, limit: 1, maxAlive: 1 },
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
        name: "phase 1",
        spawn: { interval: 2500, limit: null, maxAlive: 5 },
        enemyTable: getTierEnemies("T3", ENEMY_TIER_BALANCED),
        phaseConditions: { timerMs: 40000}
      },
      {
        name: "mid boss",
        bgm: "bgm_reflectable",
        spawn: { interval: 1000, limit: 1, maxAlive: 1 },
        enemyTable: [{ type: "MID_BOSS_3", weight: 100, pos: { x: 830, y: 150 }  }],
        phaseConditions: { killcount: 1 }
      }
    ],
    endConditions: { hpZero: true },
    clearConditions: { survive: true },
    star: { type: "typingSpeed", thresholds: [150, 180, 210, 240, 260] }
  },
  
  W2_MID_BOSS_4: {
    phases: [
      {
        name: "phase 1",
        spawn: { interval: 2500, limit: null, maxAlive: 6, immediateOnClear: true },
        enemyTable: getTierEnemies("T4", ENEMY_TIER_BALANCED),
        phaseConditions: { killCount: 15 }
      },
      {
        name: "mid boss",
        bgm: "bgm_reflectable",
        spawn: { interval: 1000, limit: 1, maxAlive: 1 },
        enemyTable: [{ type: "MID_BOSS_4", weight: 100, pos: { x: 830, y: 150 } }],
        phaseConditions: { killCount: 1 }
      }
    ],
    endConditions: { hpZero: true },
    clearConditions: { survive: true },
    star: { type: "composite", thresholds: [0.5, 0.6, 0.7, 0.8, 0.9] }
  },

  W2_MID_BOSS_5: {
    phases: [
      {
        name: "phase 1",
        spawn: { interval: 2500, limit: null, maxAlive: 6, immediateOnClear: true },
        enemyTable: getTierEnemies("T5", ENEMY_TIER_BALANCED),
        phaseConditions: { killCount: 20 }
      },
      {
        name: "mid boss",
        bgm: "bgm_reflectable",
        spawn: { interval: 1000, limit: 1, maxAlive: 1 },
        enemyTable: [{ type: "MID_BOSS_5", weight: 100, pos: { x: 830, y: 150 } }],
        phaseConditions: { killCount: 1 }
      }
    ],
    endConditions: { hpZero: true },
    clearConditions: { survive: true },
    star: { type: "composite", thresholds: [0.5, 0.6, 0.7, 0.8, 0.9] }
  },

  W2_MID_BOSS_6: {
    phases: [
      {
        name: "phase 1",
        spawn: { interval: 2500, limit: null, maxAlive: 6, immediateOnClear: true },
        enemyTable: getTierEnemies("T6", ENEMY_TIER_BALANCED),
        phaseConditions: {  timerMs: 50000 }
      },
      {
        name: "mid boss",
        bgm: "bgm_reflectable",
        spawn: { interval: 1000, limit: 1, maxAlive: 1 },
        enemyTable: [{ type: "MID_BOSS_6", weight: 100, pos: { x: 830, y: 150 } }],
        phaseConditions: { killCount: 1 }
      }
    ],
    endConditions: { hpZero: true },
    clearConditions: { survive: true },
    star: { type: "composite", thresholds: [0.5, 0.6, 0.7, 0.8, 0.9] }
  },

  W3_MID_BOSS_7: {
    phases: [
      {
        name: "phase 1",
        spawn: { interval: 2500, limit: null, maxAlive: 7, immediateOnClear: true },
        enemyTable: getTierEnemies("T7", ENEMY_TIER_BALANCED),
        phaseConditions: { killCount: 25 }
      },
      {
        name: "mid boss",
        bgm: "bgm_reflectable",
        spawn: { interval: 1000, limit: 1, maxAlive: 1 },
        enemyTable: [{ type: "MID_BOSS_7", weight: 100, pos: { x: 830, y: 150 } }],
        phaseConditions: { killCount: 1 }
      }
    ],
    endConditions: { hpZero: true },
    clearConditions: { survive: true },
    star: { type: "composite", thresholds: [0.5, 0.6, 0.7, 0.8, 0.9] }
  },

  W3_MID_BOSS_8: {
    phases: [
      {
        name: "phase 1",
        spawn: { interval: 2500, limit: null, maxAlive: 7, immediateOnClear: true },
        enemyTable: getTierEnemies("T8", ENEMY_TIER_BALANCED),
        phaseConditions: { killCount: 28 }
      },
      {
        name: "mid boss",
        bgm: "bgm_reflectable",
        spawn: { interval: 1000, limit: 1, maxAlive: 1 },
        enemyTable: [{ type: "MID_BOSS_8", weight: 100, pos: { x: 830, y: 150 } }],
        phaseConditions: { killCount: 1 }
      }
    ],
    endConditions: { hpZero: true },
    clearConditions: { survive: true },
    star: { type: "composite", thresholds: [0.5, 0.6, 0.7, 0.8, 0.9] }
  },

  W3_MID_BOSS_9: {
    phases: [
      {
        name: "phase 1",
        spawn: { interval: 2500, limit: null, maxAlive: 7, immediateOnClear: true },
        enemyTable: getTierEnemies("T8", ENEMY_TIER_BALANCED),
        phaseConditions: { timerMs: 60000 }
      },
      {
        name: "mid boss",
        bgm: "bgm_reflectable",
        spawn: { interval: 1000, limit: 1, maxAlive: 1 },
        enemyTable: [{ type: "MID_BOSS_9", weight: 100, pos: { x: 830, y: 150 } }],
        phaseConditions: { killCount: 1 }
      }
    ],
    endConditions: { hpZero: true },
    clearConditions: { survive: true },
    star: { type: "composite", thresholds: [0.5, 0.6, 0.7, 0.8, 0.9] }
  },

  // EX mini Boss
  WEX_MID_BOSS_10: {
    phases: [
      {
        name: "phase 1",
        spawn: { interval: 2500, limit: null, maxAlive: 8, immediateOnClear: true },
        enemyTable: getTierEnemies("T9", ENEMY_TIER_BALANCED),
        phaseConditions: { timerMs: 70000 }
      },
      {
        name: "mid boss",
        bgm: "bgm_reflectable",
        spawn: { interval: 1000, limit: 1, maxAlive: 1 },
        enemyTable: [{ type: "MID_BOSS_10", weight: 100, pos: { x: 830, y: 150 } }],
        phaseConditions: { killCount: 1 }
      }
    ],
    endConditions: { hpZero: true },
    clearConditions: { survive: true },
    star: { type: "composite", thresholds: [0.5, 0.6, 0.7, 0.8, 0.9] }
  },

  

  // =====================================================
  // ボスバトル定義
  // =====================================================

  // 第30ステージ後のワールドボス
  W1_WORLD_BOSS: {
    phases: [
      {
        name: "phase 1",
        spawn: { interval: 2500, limit: null, maxAlive: 6, immediateOnClear: true },
        enemyTable: getTierEnemies("T3", ENEMY_TIER_BALANCED),
        phaseConditions: { killCount: 20 }
      },
      {
        name: "boss",
        bgm: "bgm_boss1",
        spawn: { interval: 1000, limit: 1, maxAlive: 1 },
        enemyTable: [{ type: "BOSS_1", weight: 100, pos: { x: 830, y: 150 }  }],
        phaseConditions: { killCount: 1 }
      }
    ],
    endConditions: { hpZero: true },
    clearConditions: { survive: true },
    star: { type: "composite", thresholds: [0.5, 0.6, 0.7, 0.8, 0.9] }
  },

  // World 2 ボス
  W2_WORLD_BOSS: {
    phases: [
      {
        name: "phase 1",
        spawn: { interval: 2500, limit: null, maxAlive: 7, immediateOnClear: true },
        enemyTable: getTierEnemies("T6", ENEMY_TIER_BALANCED),
        phaseConditions: { killCount: 25 }
      },
      {
        name: "phase 2",
        spawn: { interval: 2500, limit: null, maxAlive: 7, immediateOnClear: true },
        enemyTable: getTierEnemies("T6", ENEMY_TIER_BALANCED),
        phaseConditions: { timerMs: 50000 }
      },
      {
        name: "boss",
        bgm: "bgm_boss1",
        spawn: { interval: 1000, limit: 1, maxAlive: 1 },
        enemyTable: [{ type: "BOSS_2", weight: 100, pos: { x: 830, y: 150 } }],
        phaseConditions: { killCount: 1 }
      }
    ],
    endConditions: { hpZero: true },
    clearConditions: { survive: true },
    star: { type: "composite", thresholds: [0.5, 0.6, 0.7, 0.8, 0.9] }
  },

  // World 3 ボス
  W3_WORLD_BOSS: {
    phases: [
      {
        name: "phase 1",
        spawn: { interval: 2500, limit: null, maxAlive: 8, immediateOnClear: true },
        enemyTable: getTierEnemies("T8", ENEMY_TIER_BALANCED),
        phaseConditions: { killCount: 30 }
      },
      {
        name: "phase 2",
        spawn: { interval: 2500, limit: null, maxAlive: 8, immediateOnClear: true },
        enemyTable: getTierEnemies("T9", ENEMY_TIER_BALANCED),
        phaseConditions: {timerMs: 60000}
      },
      {
        name: "phase 3",
        spawn: { interval: 2500, limit: null, maxAlive: 8, immediateOnClear: true },
        enemyTable: getTierEnemies("T9", ENEMY_TIER_BALANCED),
        phaseConditions: { killCount: 30 }
      },
      {
        name: "boss",
        bgm: "bgm_boss1",
        spawn: { interval: 1000, limit: 1, maxAlive: 1 },
        enemyTable: [{ type: "BOSS_3", weight: 100, pos: { x: 830, y: 150 } }],
        phaseConditions: { killCount: 1 }
      }
    ],
    endConditions: { hpZero: true },
    clearConditions: { survive: true },
    star: { type: "composite", thresholds: [0.5, 0.6, 0.7, 0.8, 0.9] }
  },

    // Worldend ボス(LastBoss)
  LAST_BOSS: {
    phases: [
      {
        name: "phase 1",
        spawn: { interval: 2500, limit: null, maxAlive: 8, immediateOnClear: true },
        enemyTable: getTierEnemies("T8", ENEMY_TIER_ENGLISH_HEAVY),
        phaseConditions: { killCount: 30 }
      },
      {
        name: "phase 2",
        spawn: { interval: 2500, limit: null, maxAlive: 8, immediateOnClear: true },
        enemyTable: getTierEnemies("T9", ENEMY_TIER_BALANCED),
        phaseConditions: {timerMs: 65000}
      },
      {
        name: "phase 3",
        spawn: { interval: 2500, limit: null, maxAlive: 8, immediateOnClear: true },
        enemyTable: getTierEnemies("T9", ENEMY_TIER_BALANCED),
        phaseConditions: { killCount: 35 }
      },
      {
        name: "last boss",
        bgm: "bgm_boss2",
        spawn: { interval: 1000, limit: 1, maxAlive: 1 },
        enemyTable: [{ type: "LAST_BOSS", weight: 100, pos: { x: 830, y: 150 } }],
        phaseConditions: { killCount: 1 }
      }
    ],
    endConditions: { hpZero: true },
    clearConditions: { survive: true },
    star: { type: "composite", thresholds: [0.5, 0.6, 0.7, 0.8, 0.9] }
  },

  // Ex ボス
  WEX_BOSS: {
    phases: [
      {
        name: "phase 1",
        spawn: { interval: 2500, limit: null, maxAlive: 8, immediateOnClear: true },
        enemyTable: getTierEnemies("T9", ENEMY_TIER_ENGLISH_HEAVY),
        phaseConditions: { killCount: 30 }
      },
      {
        name: "phase 2",
        spawn: { interval: 2500, limit: null, maxAlive: 8, immediateOnClear: true },
        enemyTable: getTierEnemies("T10", ENEMY_TIER_BALANCED),
        phaseConditions: {timerMs: 65000}
      },
      {
        name: "phase 3",
        spawn: { interval: 2500, limit: null, maxAlive: 8, immediateOnClear: true },
        enemyTable: getTierEnemies("T10", ENEMY_TIER_BALANCED),
        phaseConditions: { killCount: 35 }
      },
      {
        name: "extra boss",
        bgm: "bgm_vampire",
        spawn: { interval: 1000, limit: 1, maxAlive: 1 },
        enemyTable: [{ type: "EX_BOSS", weight: 100, pos: { x: 830, y: 150 } }],
        phaseConditions: { killCount: 1 }
      }
    ],
    endConditions: { hpZero: true },
    clearConditions: { survive: true },
    star: { type: "composite", thresholds: [0.5, 0.6, 0.7, 0.8, 0.9] }
  },

  // ========================================================
  // 防衛戦モード (クエスト用)
  // =========================================================
  DEFENSE_1: {
    isDefenseMode: true, // ★防衛モードであることを示すフラグ
    //bgImage: "battle_red",
    bgm: "bgm_universe",
    missionName: "コア防衛戦線",
    missionDescription: "時間内に、指定された文字数を入力せよ。",
    defenseConfig: {
      totalCharsToType: 100,
      timeLimit: 60, // 秒
      genres: ['empty'], // 標準単語
      minLength: 4,
      maxLength: 8,
    },
    // ★ 防衛モード用の星評価ロジックに変更
    star: { 
      type: "defenseSurplus", 
      thresholds: [0.4, 0.45, 0.5, 0.6, 0.7], // 総合スコアの閾値
      weights: {
        surplus: 0.4, // 超過率の重み
        accuracy: 0.6 // 正確性の重み
      }
    }
  },

  DEFENSE_2: {
    isDefenseMode: true, // ★防衛モードであることを示すフラグ
    //bgImage: "battle_red",
    bgm: "bgm_universe",
    missionName: "コア防衛戦線",
    missionDescription: "時間内に、指定された文字数を入力せよ。",
    defenseConfig: {
      totalCharsToType: 170,
      timeLimit: 90, // 秒
      genres: ['empty'], // 標準単語
      minLength: 4,
      maxLength: 8,
    },
    // ★ 防衛モード用の星評価ロジックに変更
    star: { 
      type: "defenseSurplus", 
      thresholds: [0.4, 0.45, 0.5, 0.6, 0.7], // 総合スコアの閾値
      weights: {
        surplus: 0.4, // 超過率の重み
        accuracy: 0.6 // 正確性の重み
      }
    }
  },

  DEFENSE_3: {
    isDefenseMode: true, // ★防衛モードであることを示すフラグ
    //bgImage: "battle_red",
    bgm: "bgm_float",
    missionName: "コア防衛戦線",
    missionDescription: "時間内に、指定された文字数を入力せよ。",
    defenseConfig: {
      totalCharsToType: 230,
      timeLimit: 120, // 秒
      genres: ['empty'], // 標準単語
      minLength: 4,
      maxLength: 8,
    },
    // ★ 防衛モード用の星評価ロジックに変更
    star: { 
      type: "defenseSurplus", 
      thresholds: [0.4, 0.45, 0.5, 0.6, 0.7], // 総合スコアの閾値
      weights: {
        surplus: 0.4, // 超過率の重み
        accuracy: 0.6 // 正確性の重み
      }
    }
  },

    DEFENSE_4: {
    isDefenseMode: true, // ★防衛モードであることを示すフラグ
    //bgImage: "battle_red",
    bgm: "bgm_float",
    missionName: "コア防衛戦線",
    missionDescription: "時間内に、指定された文字数を入力せよ。",
    defenseConfig: {
      totalCharsToType: 290,
      timeLimit: 150, // 秒
      genres: ['empty'], // 標準単語
      minLength: 4,
      maxLength: 8,
    },
    // ★ 防衛モード用の星評価ロジックに変更
    star: { 
      type: "defenseSurplus", 
      thresholds: [0.4, 0.45, 0.5, 0.6, 0.7], // 総合スコアの閾値
      weights: {
        surplus: 0.4, // 超過率の重み
        accuracy: 0.6 // 正確性の重み
      }
    }
  },

    DEFENSE_5: {
    isDefenseMode: true, // ★防衛モードであることを示すフラグ
    //bgImage: "battle_red",
    bgm: "bgm_aftersummer",
    missionName: "コア防衛戦線",
    missionDescription: "時間内に、指定された文字数を入力せよ。",
    defenseConfig: {
      totalCharsToType: 370,
      timeLimit: 180, // 秒
      genres: ['empty'], // 標準単語
      minLength: 4,
      maxLength: 8,
    },
    // ★ 防衛モード用の星評価ロジックに変更
    star: { 
      type: "defenseSurplus", 
      thresholds: [0.4, 0.45, 0.5, 0.6, 0.7], // 総合スコアの閾値
      weights: {
        surplus: 0.4, // 超過率の重み
        accuracy: 0.6 // 正確性の重み
      }
    }
  },

    DEFENSE_6: {
    isDefenseMode: true, // ★防衛モードであることを示すフラグ
    //bgImage: "battle_red",
    bgm: "bgm_aftersummer",
    missionName: "コア防衛戦線",
    missionDescription: "時間内に、指定された文字数を入力せよ。",
    defenseConfig: {
      totalCharsToType: 400,
      timeLimit: 180, // 秒
      genres: ['empty'], // 標準単語
      minLength: 4,
      maxLength: 10,
    },
    // ★ 防衛モード用の星評価ロジックに変更
    star: { 
      type: "defenseSurplus", 
      thresholds: [0.4, 0.45, 0.5, 0.6, 0.7], // 総合スコアの閾値
      weights: {
        surplus: 0.4, // 超過率の重み
        accuracy: 0.6 // 正確性の重み
      }
    }
  },
  DEFENSE_7: {
    isDefenseMode: true, // ★防衛モードであることを示すフラグ
    //bgImage: "battle_red",
    bgm: "bgm_free",
    missionName: "コア防衛戦線",
    missionDescription: "時間内に、指定された文字数を入力せよ。",
    defenseConfig: {
      totalCharsToType: 470,
      timeLimit: 200, // 秒
      genres: ['empty'], // 標準単語
      minLength: 4,
      maxLength: 12,
    },
    // ★ 防衛モード用の星評価ロジックに変更
    star: { 
      type: "defenseSurplus", 
      thresholds: [0.4, 0.45, 0.5, 0.6, 0.7], // 総合スコアの閾値
      weights: {
        surplus: 0.4, // 超過率の重み
        accuracy: 0.6 // 正確性の重み
      }
    }
  },

  DEFENSE_8: {
    isDefenseMode: true, // ★防衛モードであることを示すフラグ
    //bgImage: "battle_red",
    bgm: "bgm_free",
    missionName: "コア防衛戦線",
    missionDescription: "時間内に、指定された文字数を入力せよ。",
    defenseConfig: {
      totalCharsToType: 470,
      timeLimit: 200, // 秒
      genres: ['英語'], // 標準単語
      minLength: 4,
      maxLength: 12,
    },
    // ★ 防衛モード用の星評価ロジックに変更
    star: { 
      type: "defenseSurplus", 
      thresholds: [0.4, 0.45, 0.5, 0.6, 0.7], // 総合スコアの閾値
      weights: {
        surplus: 0.4, // 超過率の重み
        accuracy: 0.6 // 正確性の重み
      }
    }
  },

  DEFENSE_9: {
    isDefenseMode: true, // ★防衛モードであることを示すフラグ
    //bgImage: "battle_red",
    bgm: "bgm_free",
    missionName: "コア防衛戦線",
    missionDescription: "時間内に、指定された文字数を入力せよ。",
    defenseConfig: {
      totalCharsToType: 620,
      timeLimit: 240, // 秒
      genres: ['empty'], // 標準単語
      minLength: 5,
      maxLength: 13,
    },
    // ★ 防衛モード用の星評価ロジックに変更
    star: { 
      type: "defenseSurplus", 
      thresholds: [0.4, 0.45, 0.5, 0.6, 0.7], // 総合スコアの閾値
      weights: {
        surplus: 0.4, // 超過率の重み
        accuracy: 0.6 // 正確性の重み
      }
    }
  },

  DEFENSE_10: {
    isDefenseMode: true, // ★防衛モードであることを示すフラグ
    //bgImage: "battle_red",
    bgm: "bgm_free",
    missionName: "コア防衛戦線",
    missionDescription: "時間内に、指定された文字数を入力せよ。",
    defenseConfig: {
      totalCharsToType: 620,
      timeLimit: 240, // 秒
      genres: ['英語'], // 標準単語
      minLength: 5,
      maxLength: 13,
    },
    // ★ 防衛モード用の星評価ロジックに変更
    star: { 
      type: "defenseSurplus", 
      thresholds: [0.4, 0.45, 0.5, 0.6, 0.7], // 総合スコアの閾値
      weights: {
        surplus: 0.4, // 超過率の重み
        accuracy: 0.6 // 正確性の重み
      }
    }
  },

  DEFENSE_11: {
    isDefenseMode: true, // ★防衛モードであることを示すフラグ
    //bgImage: "battle_red",
    bgm: "bgm_free",
    missionName: "コア防衛戦線",
    missionDescription: "時間内に、指定された文字数を入力せよ。",
    defenseConfig: {
      totalCharsToType: 780,
      timeLimit: 280, // 秒
      genres: ['empty'], // 標準単語
      minLength: 6,
      maxLength: 14,
    },
    // ★ 防衛モード用の星評価ロジックに変更
    star: { 
      type: "defenseSurplus", 
      thresholds: [0.4, 0.45, 0.5, 0.6, 0.7], // 総合スコアの閾値
      weights: {
        surplus: 0.4, // 超過率の重み
        accuracy: 0.6 // 正確性の重み
      }
    }
  },

  DEFENSE_12: {
    isDefenseMode: true, // ★防衛モードであることを示すフラグ
    //bgImage: "battle_red",
    bgm: "bgm_free",
    missionName: "コア防衛戦線",
    missionDescription: "時間内に、指定された文字数を入力せよ。",
    defenseConfig: {
      totalCharsToType: 870,
      timeLimit: 300, // 秒
      genres: ['empty'], // 標準単語
      minLength: 6,
      maxLength: 15,
    },
    // ★ 防衛モード用の星評価ロジックに変更
    star: { 
      type: "defenseSurplus", 
      thresholds: [0.4, 0.45, 0.5, 0.6, 0.7], // 総合スコアの閾値
      weights: {
        surplus: 0.4, // 超過率の重み
        accuracy: 0.6 // 正確性の重み
      }
    }
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
        bgm: "bgm_reflectable", 
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
        bgm: "bgm_yamiyo", 
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
      limit: 30,
      maxAlive: null,
      immediateOnClear: true
    },
    itemSpawn: {
      interval: 3000,
      chance: 0.9,
      limit: null,
      maxAlive: 5,
    },
    enemyTable: [
      { type: "GRAY_CIRCLE_SMALL", weight: 70 },
      { type: "GRAY_SQUARE_SMALL", weight: 30 }
    ],
    itemTable: [
      { type: "KILL_ALL", weight: 40 },
      { type: "HEAL_FULL", weight: 30 },
      { type: "FREEZE_LARGE", weight: 30 }
    ],
    endConditions: {
      hpZero: true,
      killCount: 20
    },
    clearConditions: {
      killCount: 20
    },
    star: {
      type: "clearTime",
      thresholds: [70000,60000,50000, 40000, 30000] //ms
    },

  },

  TESTSTAGE: {
    spawn: {
      interval: 1000,
      limit: 1,
      maxAlive: null,
      immediateOnClear: true
    },
    enemyTable: [
    { type: "MID_BOSS_1", weight: 100 },
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

  DEFENSE_TEST: {
    isDefenseMode: true, // ★防衛モードであることを示すフラグ
    //bgImage: "battle_red",
    bgm: "bgm_universe",
    missionName: "コア防衛戦線",
    missionDescription: "時間内に、指定された文字数を入力せよ。",
    defenseConfig: {
      totalCharsToType: 50,
      timeLimit: 30, // 秒
      genres: ['empty'], // 標準単語
      minLength: 4,
      maxLength: 8,
    },
    // ★ 防衛モード用の星評価ロジックに変更
    star: { 
      type: "defenseSurplus", 
      thresholds: [0.4, 0.45, 0.5, 0.6, 0.7], // 総合スコアの閾値
      weights: {
        surplus: 0.4, // 超過率の重み
        accuracy: 0.6 // 正確性の重み
      }
    }
  },

  // =====================================================
  // EXTRA WORLD テストステージ
  // ※ ここから自由にステージを追加・変更できます
  // =====================================================
  STAGE_EX1: {
    spawn: {
      interval: 2000,
      limit: 10,
      maxAlive: 3,
      immediateOnClear: false
    },
    enemyTable: [
      { type: "TYPE_A", weight: 40 },
      { type: "TYPE_B", weight: 30 },
      { type: "TYPE_C", weight: 30 }
    ],
    endConditions: {
      hpZero: true,
      killCount: 10,
      allSpawnedDefeated: false
    },
    clearConditions: {
      killCount: 10
    },
    star: {
      type: "accuracy",
      thresholds: [0.7, 0.8, 0.88, 0.94, 0.98]
    }
  },

  STAGE_EX2: {
    spawn: {
      interval: 1500,
      limit: 15,
      maxAlive: 4,
      immediateOnClear: true
    },
    enemyTable: [
      { type: "TYPE_B", weight: 40 },
      { type: "TYPE_C", weight: 30 },
      { type: "TYPE_D", weight: 30 }
    ],
    endConditions: {
      hpZero: true,
      killCount: 15,
      allSpawnedDefeated: false
    },
    clearConditions: {
      killCount: 15
    },
    star: {
      type: "accuracy",
      thresholds: [0.75, 0.82, 0.90, 0.95, 0.99]
    }
  },

  // =====================================================
  // ★ビット連動型ボス(BOSS_4)
  // =====================================================
  // 本体(BOSS_4)と左右のビット(BIT_LEFT / BIT_RIGHT)が電磁波ラインで薄く連結。
  // ビットはプレイヤーには向かわず、本体周囲を楕円軌道で不規則に漂う。
  // ビットは普通の敵と同じ設定(hitCount / tags / behaviors等)で倒せる。
  // 撃破されると本体が bitReviveTime 秒後に復活させ、本体が死ねばビットも消える。
  W4_WORLD_BOSS: {
    phases: [
      {
        name: "phase 1",
        spawn: { interval: 2500, limit: null, maxAlive: 6, immediateOnClear: true },
        enemyTable: getTierEnemies("T6", ENEMY_TIER_BALANCED),
        phaseConditions: { killCount: 20 }
      },
      {
        name: "boss",
        bgm: "bgm_boss1",
        spawn: { interval: 1000, limit: 1, maxAlive: 1 },
        enemyTable: [{ type: "BOSS_4", weight: 100, pos: { x: 800, y: 200 } }],
        phaseConditions: { killCount: 1 }
      }
    ],
    endConditions: { hpZero: true },
    clearConditions: { survive: true },
    star: { type: "composite", thresholds: [0.5, 0.6, 0.7, 0.8, 0.9] }
  },

};
