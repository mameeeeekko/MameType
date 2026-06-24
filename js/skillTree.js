// skillTree.js
// =====================================================
// Skill Tree Reference
// =====================================================
//
// ■ ノード構造
//
// id:
//   ノードID（ユニーク）
//
// skillId:
//   解放時に付与されるスキルID
//
// unlock:
//   チャレンジクリア条件
//
//   {
//      mode: "normal" | "time_attack" | "long_text",
//      type: "score" | "accuracy" | "time" | "miss" | "target",
//      value: number
//   }
//
//   type一覧
//   --------------------------------
//   score     : スコア○以上
//   accuracy  : 正確率○%以上
//   time      : ○秒以内にクリア
//   miss      : ミス○回以下
//   target    : ○問クリア
//
// challenge:
//   スキル解放チャレンジ内容
//
//   {
//      mode: "normal" | "time_attack" | "long_text",
//      difficulty: "easy" | "normal" | "hard",
//      questionLimit?: number,
//      limitSec?: number,
//      tags:[ "", "句読点", "促音", "英語","記号","ことわざ","擬音"] 
//   }
//
//   modeごとの使用項目
//   --------------------------------
//   normal      → questionLimit
//   time_attack → limitSec
//   long_text   → 特殊設定なし
//
// children:
//   解放後に表示される次ノードID配列
//
// requirements:
//   チャレンジ挑戦条件
//
//   [
//      {
//          type: "questClear",
//          value: "W1_Q3"
//      },
//      {
//          type: "playerLevel",
//          value: 5
//      }
//   ]
//
//   requirement type一覧
//   --------------------------------
//   questClear  : 指定ステージクリア
//   playerLevel : プレイヤーレベル以上
//
// effect:
//   スキルツリーUI用の追加情報
//
//   {
//      type: "slot" | "activeStock",
//      value: number
//   }
//
//   slot        : 装備枠増加
//   activeStock : アクティブスキル枠増加
//
// ■ 解放フロー
//
// START
//   ↓
// CHAIN_UP_1
//   ↓
// CHAIN_DECAY_1
//   ↓
// GLASS_CHAIN_2
//   ...
//
// 親ノードが未解放の場合、子ノードは解放判定されない。
// checkSkillUnlocks() により結果画面で判定される。
//
// ■ セーブデータ
//
// stats.skillTreeProgress = {
//     unlockedNodes: ["START", ...]
// }
//
// unlockNode() 実行時に保存される。
//
// =====================================================

import { startGame } from "./gameCore.js";
import { GameModes } from "./gameModes.js";
import { showGameScreen } from "./main.js";
import { gameState } from "./gameCore.js";
import { findParent } from "./skillTreeUI.js";
import { getPlayerStats, reloadQuestPlayerStats } from "./questPlayerStats.js";
import { unlockNode } from "./skillTreeUI.js";
import { isCleared } from "./questProgress.js";
import { devOverride } from "../dev/devOverride.js";

// =====================================================
// skill関連関数
// =====================================================

export function checkSkillUnlocks(result, mode, nodeId){
    
    //DEV対応
    if (devOverride.unlockAllSkills) return;

    reloadQuestPlayerStats();
    const stats = getPlayerStats();

    if (!stats.skillTreeProgress) {
        stats.skillTreeProgress = { unlockedNodes: ["START"] };
    }

    const unlocked = stats.skillTreeProgress.unlockedNodes;

    const node = SKILL_TREE[nodeId];
    if (!node) return;

    // すでに解放済みなら何もしない
    if (unlocked.includes(node.id)) return;

    const cond = node.unlock;
    if (!cond) return;

    // モード一致チェック
    if (cond.mode !== mode) return;

    // 親チェック
    const parent = findParent(node.id);
    if (parent && !unlocked.includes(parent.id)) return;

    // 条件クリアで解放
    if (checkUnlockByResult(cond, result)) {
        unlockNode(node.id);
        localStorage.setItem("questPlayerStats", JSON.stringify(stats));
    }
}

export function checkUnlockByResult(cond, result){

    if (!cond) return false;

    // モード違いは即NG
    if (result.mode !== cond.mode) return false;

    switch (cond.type){

        case "score":
            return (result.score || 0) >= (cond.value || 0);

        case "accuracy":
            return (result.accuracy || 0) >= (cond.value || 0);

        case "time":
            return (result.totalTime || Infinity) <= (cond.value || 0);

        case "miss":
            return (result.totalMistake || 0) <= (cond.value || 0);

        case "target":
            console.log("TARGET CHECK:", {
                solved: result.solvedCount,
                need: cond.value,
                result
            });
            return (result.solvedCount || 0) >= (cond.value || 0);    

        default:
            console.warn("Unknown type:", cond.type);
            return false;
    }
}

export function getUnlockText(cond) {
    if (!cond) return "";

    switch (cond.type) {
        case "score":
            return `スコア ${cond.value} 以上`;

        case "accuracy":
            return `正確率 ${cond.value}% 以上`;

        case "time":
            return `${cond.value}秒以内にクリア`;

        case "miss":
            return `ミス ${cond.value} 回以下`;

        case "target":
            return `${cond.value} 問クリア`;

        default:
            return "条件不明";
    }
}

export function getChallengeText(challenge) {
    if (!challenge) return "";

    const modeMap = {
        normal: "スタンダード",
        time_attack: "タイムアタック",
        long_text: "長文"
    };

    const modeText = modeMap[challenge.mode] || challenge.mode;

    let detail = "";

    if (challenge.mode === "time_attack") {
        detail = `制限時間  ${challenge.limitSec}秒`;
    } else if (challenge.questionLimit) {
        detail = `問題数  ${challenge.questionLimit}問`;
    }

    // 👇ここがポイント
    return detail
        ? `${modeText} / ${detail}`
        : `${modeText}`;
}

export function startSkillMode(challenge, nodeId){

    if (!nodeId) {
        console.warn("nodeId missing");
    }

    gameState.currentSkillNodeId = nodeId; 

    showGameScreen(); 

    const modeMap = {
        normal: GameModes.NORMAL,
        time_attack: GameModes.TIME_ATTACK,
        long_text: GameModes.LONG_TEXT
    };

    const mode = modeMap[challenge.mode];

    // =========================
    // 解放条件の固定表示
    // =========================
    requestAnimationFrame(() => {
        const node = SKILL_TREE[nodeId];
        const hint = document.getElementById("skillUnlockHint");

        if (node && hint) {
            const unlockText = getUnlockText(node.unlock);

            hint.style.display = "block";
            hint.innerHTML = `
                <div class="label">CLEAR</div>
                <div class="value">${unlockText || "-"}</div>
            `;
        }
    });

    startGame({
        mode,
        isFreeMode: false,
        difficulty: challenge.difficulty,
        custom: {
            ...challenge,
            isSkillMode: true,
            nodeId
        }
    });
}

// =========================
// スキル挑戦制限チェック
// =========================
export function checkSkillRequirements(node) {

    if (!node?.requirements?.length) return true;

    // DEV override
    if (window.DEV_CONFIG?.ignoreSkillRequirements) {
        return true;
    }

    const stats = getPlayerStats();

    return node.requirements.every(req => {

        switch (req.type) {

            case "questClear":
                return isCleared(req.value);

            case "playerLevel":
                return (stats.level || 1) >= req.value;

            default:
                console.warn("Unknown requirement:", req.type);
                return false;
        }
    });
}

export function getRequirementText(requirements) {

    if (!requirements?.length) return "";

    return requirements.map(req => {

        switch (req.type) {

            case "questClear":
                return `ステージ ${req.value} クリア`;

            case "playerLevel":
                return `Lv.${req.value}以上`;

            default:
                return "条件不明";
        }

    }).join(" / ");
}


// =====================================================
// skillツリーの内容
// 　unlock: skill獲得条件
// 　challenge:　出題内容
// 　children: 次に解放するノードのid
// 　requirements: チャレンジ条件
//  
//  effect:{type: slot or activeStock
//          value: 通常１    
//  }
// =====================================================

export const SKILL_TREE = {

    START: {
        id: "START",
        children: ["CHAIN_UP_1", "DEF_UP_1", "KB_UP_1", "HEAL_SMALL"]
    },

    // ===== チェイン 左=====
    CHAIN_UP_1: {
        id: "CHAIN_UP_1",
        skillId: "chain_up_1",
        unlock: { mode: "normal", type: "target", value: 3 },
        challenge: {
            mode: "normal",          // GameModesと一致させる
            difficulty: "normal",
            questionLimit: 3,
            tags:["英語"] 
        },
        children: ["CHAIN_DECAY_1"],
        requirements: [
            {
                type: "questClear",
                value: "W1_Q3"
            },
            {
                type: "playerLevel",
                value: 5
            },
        ],
    },

    CHAIN_UP_2: {
        id: "CHAIN_UP_2",
        skillId: "chain_up_2",
        unlock: { mode: "normal", type: "target", value: 5 },
        challenge: {
            mode: "normal",
            difficulty: "hard",
            questionLimit: 4
        },
        children: ["CHAIN_UP_3","GLASS_CHAIN_3"]
    },

    CHAIN_UP_3: {
        id: "CHAIN_UP_3",
        skillId: "chain_up_3",
        unlock: { mode: "time_attack", type: "target", value: 3 },
        challenge: {
            mode: "time_attack",
            difficulty: "hard",
            limitSec: 20
        },
        children: ["CHAIN_DECAY_3"]
    },

    CHAIN_UP_4: {
        id: "CHAIN_UP_4",
        skillId: "chain_up_4",
        unlock: { mode: "long_text", type: "time", value: 30 },
        challenge: {
            mode: "long_text",
            difficulty: "hard",
        },
    },

    CHAIN_DECAY_1: {
        id: "CHAIN_DECAY_1",
        skillId: "chain_decay_1",
        unlock: { mode: "normal", type: "time", value: 10  },
        challenge: {
            mode: "normal",          // GameModesと一致させる
            difficulty: "normal",
            questionLimit: 2
        },
        children: ["GLASS_CHAIN_1"]
    },

    CHAIN_DECAY_2: {
        id: "CHAIN_DECAY_2",
        skillId: "chain_decay_2",
        unlock: { mode: "normal", type: "target", value: 4 },
        challenge: {
            mode: "normal",
            difficulty: "hard",
            questionLimit: 3
        },
        children: ["CHAIN_UP_2"]
    },

    CHAIN_DECAY_3: {
        id: "CHAIN_DECAY_3",
        skillId: "chain_decay_3",
        unlock: { mode: "time_attack", type: "target", value: 3 },
        challenge: {
            mode: "time_attack",
            difficulty: "hard",
            limitSec: 20
        },
        children: ["GLASS_CHAIN_4"]
    },

    CHAIN_DECAY_4: {
        id: "CHAIN_DECAY_4",
        skillId: "chain_decay_4",
        unlock: { mode: "long_text", type: "time", value: 30 },
        challenge: {
            mode: "long_text",
            difficulty: "hard",
        }
    },

    GLASS_CHAIN_1: {
        id: "GLASS_CHAIN_1",
        skillId: "glass_chain_1",
        unlock: { mode: "normal", type: "target", value: 3 },
        challenge: {
            mode: "normal",
            difficulty: "normal",
            questionLimit: 3
        },
        children: ["CHAIN_BONUS_1","GLASS_CHAIN_2"]
    },

    GLASS_CHAIN_2: {
        id: "GLASS_CHAIN_2",
        skillId: "glass_chain_2",
        unlock: { mode: "normal", type: "target", value: 4 },
        challenge: {
            mode: "normal",
            difficulty: "hard",
            questionLimit: 4
        },
        children: ["CHAIN_DECAY_2"]
    },

    GLASS_CHAIN_3: {
        id: "GLASS_CHAIN_3",
        skillId: "glass_chain_3",
        unlock: { mode: "time_attack", type: "target", value: 3 },
        challenge: {
            mode: "time_attack",
            difficulty: "hard",
            limitSec: 20
        },
        children: ["CHAIN_BONUS_3"]
    },

    GLASS_CHAIN_4: {
        id: "GLASS_CHAIN_4",
        skillId: "glass_chain_4",
        unlock: { mode: "long_text", type: "time", value: 30 },
        challenge: {
            mode: "long_text",
            difficulty: "hard",
        },
        children: ["CHAIN_BONUS_4","CHAIN_UP_4","CHAIN_DECAY_4"]
    },


    CHAIN_BONUS_1: {
        id: "CHAIN_BONUS_1",
        skillId: "chain_bonus_1",
        unlock: { mode: "time_attack", type: "target", value: 2 },
        challenge: {
            mode: "time_attack",
            difficulty: "hard",
            limitSec: 15,
        },
        children: ["CHAIN_BONUS_2"]
    },

    CHAIN_BONUS_2: {
        id: "CHAIN_BONUS_2",
        skillId: "chain_bonus_2",
        unlock: { mode: "time_attack", type: "target", value: 3 },
        challenge: {
            mode: "time_attack",
            difficulty: "hard",
            limitSec: 15,
        },
        children: ["CHAIN_UP_2"]
    },

    CHAIN_BONUS_3: {
        id: "CHAIN_BONUS_3",
        skillId: "chain_bonus_3",
        unlock: { mode: "normal", type: "target", value: 4 },
        challenge: {
            mode: "normal",
            difficulty: "hard",
            questionLimit: 4
        },
        children: ["GLASS_CHAIN_4"]
    },

    CHAIN_BONUS_4: {
        id: "CHAIN_BONUS_4",
        skillId: "chain_bonus_4",
        unlock: { mode: "long_text", type: "time", value: 30 },
        challenge: {
            mode: "long_text",
            difficulty: "hard",
        }
    },

    // ===== 攻撃系 上 =====
    KB_UP_1: {
        id: "KB_UP_1",
        skillId: "kb_up_1",
        unlock: { mode: "long_text", type: "time", value: 20 },
        challenge: {
            mode: "long_text",
            difficulty: "hard",
        },
        children: ["KB_UP_2"]
    },

    KB_UP_2: {
        id: "KB_UP_2",
        skillId: "kb_up_2",
        unlock: { mode: "long_text", type: "time", value: 30 },
        challenge: {
            mode: "long_text",
            difficulty: "hard",
        },
        children: ["KILL_NEAREST","FREEZE_LIGHT"]
    },

    KB_UP_3: {
        id: "KB_UP_3",
        skillId: "kb_up_3",
        unlock: { mode: "normal", type: "target", value: 6 },
        challenge: {
            mode: "normal",
            difficulty: "hard",
            questionLimit: 6
        },
        children: ["KB_UP_4"]
    },

    KB_UP_4: {
        id: "KB_UP_4",
        skillId: "kb_up_4",
        unlock: { mode: "time_attack", type: "target", value: 4 },
        challenge: {
            mode: "time_attack",
            difficulty: "hard",
            limitSec: 20
        },
        children: ["KILL_ALL","KNOCKBACK_EDGE"]
    },

     // ===== 下：補助系 =====

     SLOT_1: {
        id: "SLOT_1",
        skillId: "slot_1",
        unlock: { mode: "time_attack", type: "target", value: 2 },
        challenge: {
            mode: "time_attack",
            difficulty: "hard",
            limitSec: 15,
        },

        effect: {
            type: "slot",
            value: 1
        },
        children: ["STOCK_1"]
        
    },

    STOCK_1: {
        id: "STOCK_1",
        skillId: "skill_stock_1",
        unlock: { mode: "time_attack", type: "target", value: 2 },
        challenge: {
            mode: "time_attack",
            difficulty: "hard",
            limitSec: 15,
        },

        effect: {
            type: "activeStock",
            value: 1
        },

        children: ["EXP_UP_3"]
    },

    // アイテム出現率系
    ITEM_SPAWN_1: {
        id: "ITEM_SPAWN_1",
        skillId: "item_spawn_1",
        unlock: { mode: "normal", type: "target", value: 3 },
        challenge: { mode: "normal", difficulty: "normal", questionLimit: 3 },
        children: ["MAX_HP_2","SLOT_1"]
    },

    ITEM_SPAWN_2: {
        id: "ITEM_SPAWN_2",
        skillId: "item_spawn_2",
        unlock: { mode: "normal", type: "target", value: 5 },
        challenge: { mode: "normal", difficulty: "hard", questionLimit: 4 },
        children: ["EXP_UP_3"]
    },

    ITEM_SPAWN_3: {
        id: "ITEM_SPAWN_3",
        skillId: "item_spawn_3",
        unlock: { mode: "time_attack", type: "target", value: 3 },
        challenge: { mode: "time_attack", difficulty: "hard", limitSec: 20 },
    },

    // ======= 右 防御系 =========================

    // ダメージ無効化系
    DAMAGE_NEGATE_1: {
        id: "DAMAGE_NEGATE_1",
        skillId: "damage_negate_1",
        unlock: { mode: "normal", type: "target", value: 4 },
        challenge: { mode: "normal", difficulty: "normal", questionLimit: 4 },
        children: ["DAMAGE_NEGATE_2","REVIVE_1","INVINCIBLE_SHORT"]
    },

    DAMAGE_NEGATE_2: {
        id: "DAMAGE_NEGATE_2",
        skillId: "damage_negate_2",
        unlock: { mode: "normal", type: "target", value: 6 },
        challenge: { mode: "normal", difficulty: "hard", questionLimit: 5 },
        children: ["DAMAGE_NEGATE_3"]
    },

    DAMAGE_NEGATE_3: {
        id: "DAMAGE_NEGATE_3",
        skillId: "damage_negate_3",
        unlock: { mode: "time_attack", type: "target", value: 4 },
        challenge: { mode: "time_attack", difficulty: "hard", limitSec: 25 },
    },

    // 復活系
    REVIVE_1: {
        id: "REVIVE_1",
        skillId: "revive_once_1",
        unlock: { mode: "normal", type: "target", value: 5 },
        challenge: { mode: "normal", difficulty: "hard", questionLimit: 5 },
        children: ["REVIVE_2"]
    },

    REVIVE_2: {
        id: "REVIVE_2",
        skillId: "revive_once_2",
        unlock: { mode: "normal", type: "target", value: 7 },
        challenge: { mode: "normal", difficulty: "hard", questionLimit: 6 },
        children: ["REVIVE_3"]
    },

    REVIVE_3: {
        id: "REVIVE_3",
        skillId: "revive_once_3",
        unlock: { mode: "time_attack", type: "target", value: 5 },
        challenge: { mode: "time_attack", difficulty: "hard", limitSec: 30 },
    },

    //========== 下；補助系 =========================
    // ===== ステータス向上系: MAX HP =====
    MAX_HP_1: {
        id: "MAX_HP_1",
        skillId: "max_hp_1",
        unlock: { mode: "normal", type: "target", value: 5 },
        challenge: {
            mode: "normal",
            difficulty: "normal",
            questionLimit: 5
        },
        children: ["ITEM_SPAWN_1","EXP_UP_1"]
    },

    MAX_HP_2: {
        id: "MAX_HP_2",
        skillId: "max_hp_2",
        unlock: { mode: "time_attack", type: "target", value: 3 },
        challenge: {
            mode: "time_attack",
            difficulty: "hard",
            limitSec: 20
        },
        children: ["ITEM_SPAWN_2"]
    },

    MAX_HP_3: {
        id: "MAX_HP_3",
        skillId: "max_hp_3",
        unlock: { mode: "long_text", type: "time", value: 30 },
        challenge: {
            mode: "long_text",
            difficulty: "hard",
        }
    },

    // ===== ステータス向上系: DEF（防御） =====
    DEF_UP_1: {
        id: "DEF_UP_1",
        skillId: "defense_up_1",
        unlock: { mode: "long_text", type: "time", value: 35 },
        challenge: {
            mode: "long_text",
            difficulty: "hard",
            tags: ["プログラミング"]
        },
        children: ["MAX_HP_1"]
    },

    DEF_UP_2: {
        id: "DEF_UP_2",
        skillId: "defense_up_2",
        unlock: { mode: "time_attack", type: "target", value: 4 },
        challenge: {
            mode: "time_attack",
            difficulty: "hard",
            limitSec: 20
        },
        children: ["EXP_UP_2"]
    },

    DEF_UP_3: {
        id: "DEF_UP_3",
        skillId: "defense_up_3",
        unlock: { mode: "long_text", type: "time", value: 30 },
        challenge: {
            mode: "long_text",
            difficulty: "hard",
        }
    },

    // ===== ステータス向上系: EXP（経験値増加） =====
    EXP_UP_1: {
        id: "EXP_UP_1",
        skillId: "exp_up_1",
        unlock: { mode: "normal", type: "target", value: 5 },
        challenge: {
            mode: "normal",
            difficulty: "normal",
            questionLimit: 5
        },
        children: ["DEF_UP_2","SLOT_1"]
    },

    EXP_UP_2: {
        id: "EXP_UP_2",
        skillId: "exp_up_2",
        unlock: { mode: "time_attack", type: "target", value: 3 },
        challenge: {
            mode: "time_attack",
            difficulty: "hard",
            limitSec: 20
        },
        children: ["EXP_UP_3"]
    },

    EXP_UP_3: {
        id: "EXP_UP_3",
        skillId: "exp_up_3",
        unlock: { mode: "long_text", type: "time", value: 30 },
        challenge: {
            mode: "long_text",
            difficulty: "hard",
        },
        children: ["DEF_UP_3","MAX_HP_3","ITEM_SPAWN_3"]
    },

    // ===== active skill ===================

    // =========右：補助系===============
    HEAL_SMALL: {
        id: "HEAL_SMALL",
        skillId: "heal_small",

        unlock: {
            mode: "normal",
            type: "target",
            value: 5
        },

        challenge: {
            mode: "normal",
            difficulty: "hard",
            questionLimit: 5
        },

        children: ["DAMAGE_NEGATE_1"],

        requirements: [
            {
                type: "questClear",
                value: "W1_Q1"
            }
        ]
    },

    HEAL_MEDIUM: {
        id: "HEAL_MEDIUM",
        skillId: "heal_medium",

        unlock: {
            mode: "normal",
            type: "target",
            value: 5
        },

        challenge: {
            mode: "normal",
            difficulty: "hard",
            questionLimit: 5
        },

        children: ["HEAL_HIGH"],

        requirements: [
            {
                type: "questClear",
                value: "W1_Q1"
            }
        ]
    },

    HEAL_HIGH: {
        id: "HEAL_HIGH",
        skillId: "heal_high",

        unlock: {
            mode: "normal",
            type: "target",
            value: 5
        },

        challenge: {
            mode: "normal",
            difficulty: "hard",
            questionLimit: 5
        },

        requirements: [
            {
                type: "questClear",
                value: "W1_Q1"
            }
        ]
    },

    // =====上；攻撃系==========================

    FREEZE_LIGHT: {
        id: "FREEZE_LIGHT",
        skillId: "freeze_light",

        unlock: {
            mode: "time_attack",
            type: "target",
            value: 3
        },

        challenge: {
            mode: "time_attack",
            difficulty: "hard",
            limitSec: 15
        },

        children: ["FREEZE_MEDIUM"]
    },

    FREEZE_MEDIUM: {
        id: "FREEZE_MEDIUM",
        skillId: "freeze_medium",

        unlock: {
            mode: "time_attack",
            type: "target",
            value: 3
        },

        challenge: {
            mode: "time_attack",
            difficulty: "hard",
            limitSec: 15
        },

        children: ["FREEZE_HEAVY"]
    },
        
    FREEZE_HEAVY: {
        id: "FREEZE_HEAVY",
        skillId: "freeze_heavy",

        unlock: {
            mode: "time_attack",
            type: "target",
            value: 3
        },

        challenge: {
            mode: "time_attack",
            difficulty: "hard",
            limitSec: 15
        },

        children: ["KB_UP_4"]
    },

    KILL_NEAREST: {
        id: "KILL_NEAREST",
        skillId: "kill_nearest",

        unlock: {
            mode: "long_text",
            type: "time",
            value: 20
        },

        challenge: {
            mode: "long_text",
            difficulty: "hard"
        },

        children: ["KILL_RANDOM"]
    },

    KILL_RANDOM: {
        id: "KILL_RANDOM",
        skillId: "kill_random",

        unlock: {
            mode: "long_text",
            type: "time",
            value: 20
        },

        challenge: {
            mode: "long_text",
            difficulty: "hard"
        },

        children: ["KILL_NEAREST_H","KB_UP_3"]
    },

    KILL_NEAREST_H: {
        id: "KILL_NEAREST_H",
        skillId: "kill_nearest_h",

        unlock: {
            mode: "long_text",
            type: "time",
            value: 20
        },

        challenge: {
            mode: "long_text",
            difficulty: "hard"
        }
    },

    KILL_ALL: {
        id: "KILL_ALL",
        skillId: "kill_all",

        unlock: {
            mode: "long_text",
            type: "time",
            value: 20
        },

        challenge: {
            mode: "long_text",
            difficulty: "hard"
        }
    },

    
    KNOCKBACK_EDGE: {
        id: "KNOCKBACK_EDGE",
        skillId: "knockback_edge",
        unlock: { mode: "normal", type: "target", value: 6 },
        challenge: { mode: "normal", difficulty: "hard", questionLimit: 6 }
    },

    // =============== 右；防御系 =======================================

    INVINCIBLE_SHORT: {
        id: "INVINCIBLE_SHORT",
        skillId: "invincible_short",
        unlock: { mode: "normal", type: "target", value: 3 },
        challenge: { mode: "normal", difficulty: "normal", questionLimit: 3 },
        children: ["INVINCIBLE_MEDIUM"]
    },

    INVINCIBLE_MEDIUM: {
        id: "INVINCIBLE_MEDIUM",
        skillId: "invincible_medium",
        unlock: { mode: "normal", type: "target", value: 5 },
        challenge: { mode: "normal", difficulty: "hard", questionLimit: 4 },
        children: ["INVINCIBLE_LONG","HEAL_MEDIUM"]
    },

    INVINCIBLE_LONG: {
        id: "INVINCIBLE_LONG",
        skillId: "invincible_long",
        unlock: { mode: "time_attack", type: "target", value: 3 },
        challenge: { mode: "time_attack", difficulty: "hard", limitSec: 25 }
    },
    
   
};

