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
//      tags:[ "", "句読点", "促音", "英語","記号","数字","ことわざ","擬音"] （longの場合は["文学"、"セキュリティ"、"おもしろ"、"プログラミング"、"自作キーボード"]）
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
import { backToQuestMap, showGameScreen } from "./main.js";
import { gameState } from "./gameCore.js";
import { findParents } from "./skillTreeUI.js";
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

        const unlocks = Array.isArray(node.unlock)
        ? node.unlock
        : [node.unlock];

    if (!unlocks.length) return;

    // 親チェック
    const parents = findParents(node.id);
    // 親がいて、その親がどれもアンロックされていない場合は挑戦不可
    if (parents.length > 0 && !parents.some(p => unlocked.includes(p.id))) return;

    // 全条件達成チェック
    const cleared = unlocks.every(cond => {
       

        // モード一致
        if (cond.mode && cond.mode !== mode) {
            return false;
        }

        return checkUnlockByResult(cond, result);
    });

    if (cleared) {
        unlockNode(node.id);
        localStorage.setItem(
            "questPlayerStats",
            JSON.stringify(stats)
        );
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
            return (result.solvedCount || 0) >= (cond.value || 0);    

        default:
            console.warn("Unknown type:", cond.type);
            return false;
    }
}

export function getUnlockText(unlock) {

    if (!unlock) return "";

    const unlocks = Array.isArray(unlock)
        ? unlock
        : [unlock];

    return unlocks
        .map(u => getSingleUnlockText(u))
        .join("<br>");
}

export function getSingleUnlockText(cond) {
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

    }).join("<br>");
}

// =====================================================
// skillツリ-の条件自動設定関数
//  
// =====================================================

export const SKILL_DEPTH = {
    EARLY: 0,
    MID: 1,
    LATE: 2,
    END: 3,
};

// 左のstandard系 ======================

export const NORMAL_CHALLENGE_TABLE = {
    0: {
        difficulty: "normal",
        questionLimit: 12
    },
    1: {
        difficulty: "normal",
        questionLimit: 20
    },
    2: {
        difficulty: "hard",
        questionLimit: 30
    },
    3: {
        difficulty: "hard",
        questionLimit: 50
    }
};

export const NORMAL_UNLOCK_TABLE = {
    0: [
        [
            { type:"time", value:120 },
            { type:"accuracy", value:85 }
        ],
        [
            { type:"time", value:100 },
            { type:"miss", value:10 }
        ],
        [
            { type:"time", value:150 },
            { type:"score", value:140 }
        ],
        [
            { type:"time", value:90 }
        ]
    ],

    1: [
        [
            { type:"time", value:150 },
            { type:"accuracy", value:90 }
        ],
        [
            { type:"time", value:130 },
            { type:"miss", value:5 }
        ],
        [
            { type:"time", value:180 },
            { type:"score", value:160 }
        ],
        [
            { type:"time", value:120 }
        ]
    ],

    2: [
        [
            { type:"time", value:180 },
            { type:"accuracy", value:95 }
        ],
        [
            { type:"time", value:150 },
            { type:"miss", value:2 }
        ],
        [
            { type:"time", value:220 },
            { type:"score", value:180 }
        ],
        [
            { type:"time", value:150 }
        ]
    ],

    3: [
        [
            { type:"time", value:240 },
            { type:"accuracy", value:98 }
        ],
        [
            { type:"time", value:200 },
            { type:"miss", value:0 }
        ],
        [
            { type:"time", value:300 },
            { type:"score", value:200 }
        ],
        [
            { type:"time", value:180 }
        ]
    ]
};

//上のtimeattack系 =======================

export const TIME_ATTACK_CHALLENGE_TABLE = { 
    0: { difficulty:"normal", limitSec:40 }, 
    1: { difficulty:"normal", limitSec:90 }, 
    2: { difficulty:"hard", limitSec:150 }, 
    3: { difficulty:"hard", limitSec:240 } 
};

export const TIME_ATTACK_UNLOCK_TABLE = {
    0: [
        [
            { type:"target", value:6 },
            { type:"accuracy", value:85 }
        ],
        [
            { type:"target", value:6 },
            { type:"miss", value:10 }
        ],
        [
            { type:"target", value:6 },
            { type:"score", value:140 }
        ],
        [
            { type:"target", value:7 }
        ]
    ],

    1: [
        [
            { type:"target", value:15 },
            { type:"accuracy", value:90 }
        ],
        [
            { type:"target", value:15 },
            { type:"miss", value:5 }
        ],
        [
            { type:"target", value:15 },
            { type:"score", value:160 }
        ],
        [
            { type:"target", value:16 }
        ]
    ],

    2: [
        [
            { type:"target", value:23 },
            { type:"accuracy", value:95 }
        ],
        [
            { type:"target", value:23 },
            { type:"miss", value:2 }
        ],
        [
            { type:"target", value:23 },
            { type:"score", value:180 }
        ],
        [
            { type:"target", value:25 }
        ]
    ],

    3: [
        [
            { type:"target", value:40 },
            { type:"accuracy", value:98 }
        ],
        [
            { type:"target", value:40 },
            { type:"miss", value:0 }
        ],
        [
            { type:"target", value:40 },
            { type:"score", value:200 }
        ],
        [
            { type:"target", value:42 }
        ]
    ]
};

// 右の長文系 ==================

export const LONG_TEXT_TAGS = [
    "文学",
    "プログラミング",
    "自作キーボード",
    "セキュリティ",
    "おもしろ"
];

export const LONG_TEXT_CHALLENGE_TABLE = { 
    0: { tags: [ { tag: "文学", weight: 5 }, { tag: "おもしろ", weight: 2 } ] },
    1: { tags: [ { tag: "文学", weight: 5 }, { tag: "セキュリティ", weight: 2 } ] }, 
    2: { tags: [ { tag: "おもしろ", weight: 5 }, { tag: "自作キーボード", weight: 2 } ] },
    3: { tags: [ { tag: "セキュリティ", weight: 4 }, { tag: "プログラミング", weight: 2 }, { tag: "自作キーボード", weight: 1 } ] } 
};

export const LONG_TEXT_UNLOCK_TABLE = {
    0: [
        [
            { type:"time", value:180 },
            { type:"accuracy", value:85 }
        ],
        [
            { type:"time", value:180 },
            { type:"miss", value:10 }
        ],
        [
            { type:"time", value:180 },
            { type:"score", value:130 }
        ],
        [
            { type:"time", value:180 }
        ]
    ],

    1: [
        [
            { type:"time", value:175 },
            { type:"accuracy", value:90 }
        ],
        [
            { type:"time", value:175 },
            { type:"miss", value:5 }
        ],
        [
            { type:"time", value:175 },
            { type:"score", value:160 }
        ],
        [
            { type:"time", value:170 }
        ]
    ],

    2: [
        [
            { type:"time", value:155 },
            { type:"accuracy", value:95 }
        ],
        [
            { type:"time", value:155 },
            { type:"miss", value:3 }
        ],
        [
            { type:"time", value:155 },
            { type:"score", value:180 }
        ],
        [
            { type:"time", value:150 }
        ]
    ],

    3: [
        [
            { type:"time", value:145 },
            { type:"accuracy", value:98 }
        ],
        [
            { type:"time", value:145 },
            { type:"miss", value:1 }
        ],
        [
            { type:"time", value:145 },
            { type:"score", value:200 }
        ],
        [
            { type:"time", value:140 }
        ]
    ]
};

// 下の補助系 =====================

export const SUPPORT_TAGS = {
    0: ["英語"],
    1: ["英語","数字"],
    2: ["英語","記号"],
    3: ["英語","数字","記号"]
};

// =====================================================
// 条件生成関数
// =====================================================

export function buildNormalSkill(depth, pattern = 0, isSupport = false) {
    const challenge = {
        mode: "normal",
        ...NORMAL_CHALLENGE_TABLE[depth]
    };
    if (isSupport) {
        challenge.tags = SUPPORT_TAGS[depth];
    }
    return {
        challenge,
        unlock: NORMAL_UNLOCK_TABLE[depth][pattern].map(x => ({
            mode: "normal",
            ...x
        }))
    };
}

export function buildTimeAttackSkill(depth, pattern = 0, isSupport = false) {
    const challenge = {
        mode: "time_attack",
        ...TIME_ATTACK_CHALLENGE_TABLE[depth]
    };
    if (isSupport) {
        challenge.tags = SUPPORT_TAGS[depth];
    }
    return {
        challenge,
        unlock: TIME_ATTACK_UNLOCK_TABLE[depth][pattern].map(x => ({
            mode: "time_attack",
            ...x
        }))
    };
}

export function buildLongTextSkill(depth, pattern = 0, isSupport = false) { // isSupport is unused but kept for consistency
    const weightedRandom = (items) => {
        const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
        let r = Math.random() * totalWeight;
        for (const item of items) {
            r -= item.weight;
            if (r <= 0) return item.tag;
        }
        return items[0].tag;
    };
    const tag =
        weightedRandom(
            LONG_TEXT_CHALLENGE_TABLE[depth].tags
        );

    return {
        challenge: {
            mode: "long_text",
            tags: [tag]
        },

        unlock:
            LONG_TEXT_UNLOCK_TABLE[depth][pattern]
                .map(x => ({
                    mode: "long_text",
                    ...x
                }))
    };
}

// 全部まとめた生成関数、isSupportは下用のtagsが英語のやつ。longではisSupportはfalse
// pattern 0=accuracy型, 1=miss型, 2=score型, 3=速度型
export function buildSkill(mode, depth, isSupport = false, pattern = 0) {
    switch (mode) {
        case "normal":
            return buildNormalSkill(
                depth,
                pattern,
                isSupport
            );

        case "time_attack":
            return buildTimeAttackSkill(
                depth,
                pattern,
                isSupport
            );

        case "long_text":
            return buildLongTextSkill(
                depth,
                pattern,
                isSupport
            );

        default:
            throw new Error(`Unknown mode: ${mode}`);
    }
}

// =====================================================
// 条件生成関数 (第2引数に条件を追加できる)
//          requirements: buildRequirements(SKILL_DEPTH.EARLY, [
//            { type: "playerLevel", value: 5 }  
//           ]),
// =====================================================

function buildRequirements(depth, additional = []) {
    const baseReqs = [];
    switch (depth) {
        case SKILL_DEPTH.EARLY:
            baseReqs.push({ type: "questClear", value: "W1_Q5" });
            break;
        case SKILL_DEPTH.MID:
            baseReqs.push({ type: "playerLevel", value: 8 });
            baseReqs.push({ type: "questClear", value: "W1_MiniBoss_1" });
            break;
        case SKILL_DEPTH.LATE:
            baseReqs.push({ type: "playerLevel", value: 15 });
            baseReqs.push({ type: "questClear", value: "W1_BOSS" });
            break;
        case SKILL_DEPTH.END:
            baseReqs.push({ type: "playerLevel", value: 25 });
            baseReqs.push({ type: "questClear", value: "W2_Q3" });
            break;
    }
    return [...baseReqs, ...additional];
}


// =====================================================
// skillツリーの内容
// 　unlock: skill獲得条件
// 　challenge:　出題内容
// 　children: 次に解放するノードのid
// 　requirements: チャレンジ条件 
//  effect:{type: slot or activeStock
//          value: 通常１    
//  }
// 
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
        ...buildSkill("normal", SKILL_DEPTH.EARLY, false, 3),
        children: ["CHAIN_DECAY_1"],
        requirements: buildRequirements(SKILL_DEPTH.EARLY),
    },

    CHAIN_UP_2: {
        id: "CHAIN_UP_2",
        skillId: "chain_up_2",
        ...buildSkill("normal", SKILL_DEPTH.MID, false, 3),
        children: ["CHAIN_UP_3","GLASS_CHAIN_3"],
        requirements: buildRequirements(SKILL_DEPTH.MID),
    },    

    CHAIN_UP_3: {
        id: "CHAIN_UP_3",
        skillId: "chain_up_3",
        ...buildSkill("normal", SKILL_DEPTH.LATE, false, 3),
        children: ["CHAIN_DECAY_3"],
        requirements: buildRequirements(SKILL_DEPTH.LATE),
    },
    
    CHAIN_UP_4: {
        id: "CHAIN_UP_4",
        skillId: "chain_up_4",
        ...buildSkill("normal", SKILL_DEPTH.END, false, 3),
        requirements: buildRequirements(SKILL_DEPTH.END),
    },
    

    CHAIN_DECAY_1: {
        id: "CHAIN_DECAY_1",
        skillId: "chain_decay_1",
        ...buildSkill("normal", SKILL_DEPTH.EARLY, false, 0),
        children: ["GLASS_CHAIN_1"],
        requirements: buildRequirements(SKILL_DEPTH.EARLY),
    },

    CHAIN_DECAY_2: {
        id: "CHAIN_DECAY_2",
        skillId: "chain_decay_2",
        ...buildSkill("normal", SKILL_DEPTH.MID, false, 0),
        children: ["CHAIN_UP_2"],
        requirements: buildRequirements(SKILL_DEPTH.MID),
    },    
    

    CHAIN_DECAY_3: {
        id: "CHAIN_DECAY_3",
        skillId: "chain_decay_3",
        ...buildSkill("normal", SKILL_DEPTH.LATE, false, 0),
        children: ["GLASS_CHAIN_4"],
        requirements: buildRequirements(SKILL_DEPTH.LATE),
    },
    
    CHAIN_DECAY_4: {
        id: "CHAIN_DECAY_4",
        skillId: "chain_decay_4",
        ...buildSkill("normal", SKILL_DEPTH.END, false, 0),
        requirements: buildRequirements(SKILL_DEPTH.END),
    },
    

    GLASS_CHAIN_1: {
        id: "GLASS_CHAIN_1",
        skillId: "glass_chain_1",
        ...buildSkill("normal", SKILL_DEPTH.EARLY, false, 1),
        children: ["CHAIN_BONUS_1","GLASS_CHAIN_2"],
        requirements: buildRequirements(SKILL_DEPTH.EARLY),
    },

    GLASS_CHAIN_2: {
        id: "GLASS_CHAIN_2",
        skillId: "glass_chain_2",
        ...buildSkill("normal", SKILL_DEPTH.MID, false, 1),
        children: ["CHAIN_DECAY_2"],
        requirements: buildRequirements(SKILL_DEPTH.MID),
    },    
    

    GLASS_CHAIN_3: {
        id: "GLASS_CHAIN_3",
        skillId: "glass_chain_3",
        ...buildSkill("normal", SKILL_DEPTH.LATE, false, 1),
        children: ["CHAIN_BONUS_3"],
        requirements: buildRequirements(SKILL_DEPTH.LATE),
    },
    
    GLASS_CHAIN_4: {
        id: "GLASS_CHAIN_4",
        skillId: "glass_chain_4",
        ...buildSkill("normal", SKILL_DEPTH.END, false, 1),
        children: ["CHAIN_BONUS_4","CHAIN_UP_4","CHAIN_DECAY_4"],
        requirements: buildRequirements(SKILL_DEPTH.END),
    },

    CHAIN_BONUS_1: {
        id: "CHAIN_BONUS_1",
        skillId: "chain_bonus_1",
        ...buildSkill("normal", SKILL_DEPTH.EARLY, false, 2),
        children: ["CHAIN_BONUS_2"],
        requirements: buildRequirements(SKILL_DEPTH.EARLY),
    },

    CHAIN_BONUS_2: {
        id: "CHAIN_BONUS_2",
        skillId: "chain_bonus_2",
        ...buildSkill("normal", SKILL_DEPTH.MID, false, 2),
        children: ["CHAIN_UP_2"],
        requirements: buildRequirements(SKILL_DEPTH.MID),
    },    
    

    CHAIN_BONUS_3: {
        id: "CHAIN_BONUS_3",
        skillId: "chain_bonus_3",
        ...buildSkill("normal", SKILL_DEPTH.LATE, false, 2),
        children: ["GLASS_CHAIN_4"],
        requirements: buildRequirements(SKILL_DEPTH.LATE),
    },
    
    CHAIN_BONUS_4: {
        id: "CHAIN_BONUS_4",
        skillId: "chain_bonus_4",
        ...buildSkill("normal", SKILL_DEPTH.END, false, 2),
        requirements: buildRequirements(SKILL_DEPTH.END),
    },
    

    // ===== 上（タイムアタック）=====
    KB_UP_1: {
        id: "KB_UP_1",
        skillId: "kb_up_1",
        ...buildSkill("time_attack", SKILL_DEPTH.EARLY, false, 3),
        children: ["KB_UP_2"],
        requirements: buildRequirements(SKILL_DEPTH.EARLY),
    },    
    

    KB_UP_2: {
        id: "KB_UP_2",
        skillId: "kb_up_2",
        ...buildSkill("time_attack", SKILL_DEPTH.MID, false, 3),
        children: ["KILL_NEAREST","FREEZE_LIGHT"],
        requirements: buildRequirements(SKILL_DEPTH.MID),
    },

    KB_UP_3: {
        id: "KB_UP_3",
        skillId: "kb_up_3",
        ...buildSkill("time_attack", SKILL_DEPTH.LATE, false, 3),
        children: ["KB_UP_4"],
        requirements: buildRequirements(SKILL_DEPTH.LATE),
    },    
    

    KB_UP_4: {
        id: "KB_UP_4",
        skillId: "kb_up_4",
        ...buildSkill("time_attack", SKILL_DEPTH.END, true, 3),
        children: ["KILL_ALL","KNOCKBACK_EDGE"],
        requirements: buildRequirements(SKILL_DEPTH.END),
    },

    // ===== 下（混合）=====
    SLOT_1: {
        id: "SLOT_1",
        skillId: "slot_1",
        ...buildSkill("normal", SKILL_DEPTH.MID, true, 0),
        effect: { type: "slot", value: 1 },
        children: ["STOCK_1"],
        requirements: buildRequirements(SKILL_DEPTH.MID),
    },

    STOCK_1: {
        id: "STOCK_1",
        skillId: "skill_stock_1",
        ...buildSkill("time_attack", SKILL_DEPTH.END, true, 0),
        effect: { type: "activeStock", value: 1 },
        children: ["EXP_UP_3"],
        requirements: buildRequirements(SKILL_DEPTH.END),
    },

    ITEM_SPAWN_1: {
        id: "ITEM_SPAWN_1",
        skillId: "item_spawn_1",
        ...buildSkill("normal", SKILL_DEPTH.MID, true, 2),
        children: ["MAX_HP_2","SLOT_1"],
        requirements: buildRequirements(SKILL_DEPTH.MID),
    },

    ITEM_SPAWN_2: {
        id: "ITEM_SPAWN_2",
        skillId: "item_spawn_2",
        ...buildSkill("time_attack", SKILL_DEPTH.LATE, true, 2),
        children: ["EXP_UP_3"],
        requirements: buildRequirements(SKILL_DEPTH.LATE),
    },    
    

    ITEM_SPAWN_3: {
        id: "ITEM_SPAWN_3",
        skillId: "item_spawn_3",
        ...buildSkill("time_attack", SKILL_DEPTH.END, true, 2),
        requirements: buildRequirements(SKILL_DEPTH.END),
    },

    // ===== 防御（右・長文）=====
    DAMAGE_NEGATE_1: {
        id: "DAMAGE_NEGATE_1",
        skillId: "damage_negate_1",
        ...buildSkill("long_text", SKILL_DEPTH.MID, false, 1),
        children: ["DAMAGE_NEGATE_2","REVIVE_1","INVINCIBLE_SHORT"],
        requirements: buildRequirements(SKILL_DEPTH.MID),
    },

    DAMAGE_NEGATE_2: {
        id: "DAMAGE_NEGATE_2",
        skillId: "damage_negate_2",
        ...buildSkill("long_text", SKILL_DEPTH.LATE, false, 1),
        children: ["DAMAGE_NEGATE_3"],
        requirements: buildRequirements(SKILL_DEPTH.LATE),
    },

    DAMAGE_NEGATE_3: {
        id: "DAMAGE_NEGATE_3",
        skillId: "damage_negate_3",
        ...buildSkill("long_text", SKILL_DEPTH.END, false, 1),
        requirements: buildRequirements(SKILL_DEPTH.END, [
            { type: "playerLevel", value: 30 }
        ]),
    },    

    REVIVE_1: {
        id: "REVIVE_1",
        skillId: "revive_once_1",
        ...buildSkill("long_text", SKILL_DEPTH.MID, false, 2),
        children: ["REVIVE_2"],
        requirements: buildRequirements(SKILL_DEPTH.MID),
    },

    REVIVE_2: {
        id: "REVIVE_2",
        skillId: "revive_once_2",
        ...buildSkill("long_text", SKILL_DEPTH.LATE, false, 2),
        children: ["REVIVE_3"],
        requirements: buildRequirements(SKILL_DEPTH.LATE),
    },

    REVIVE_3: {
        id: "REVIVE_3",
        skillId: "revive_once_3",
        ...buildSkill("long_text", SKILL_DEPTH.END, false, 2),
        requirements: buildRequirements(SKILL_DEPTH.END),
    },    
    
    // ========下=========
    // ===== DEF系=====
    MAX_HP_1: {
        id: "MAX_HP_1",
        skillId: "max_hp_1",
        ...buildSkill("normal", SKILL_DEPTH.MID, true, 2),
        children: ["ITEM_SPAWN_1","EXP_UP_1"],
        requirements: buildRequirements(SKILL_DEPTH.MID),
    },

    MAX_HP_2: {
        id: "MAX_HP_2",
        skillId: "max_hp_2",
        ...buildSkill("time_attack", SKILL_DEPTH.LATE, true, 2),
        children: ["ITEM_SPAWN_2"],
        requirements: buildRequirements(SKILL_DEPTH.LATE),
    },    
    

    MAX_HP_3: {
        id: "MAX_HP_3",
        skillId: "max_hp_3",
        ...buildSkill("normal", SKILL_DEPTH.END, true, 2),
        requirements: buildRequirements(SKILL_DEPTH.END),
    },

    DEF_UP_1: {
        id: "DEF_UP_1",
        skillId: "defense_up_1",
        ...buildSkill("normal", SKILL_DEPTH.MID, true, 3),
        children: ["MAX_HP_1"],
        requirements: buildRequirements(SKILL_DEPTH.MID),
    },    
    

    DEF_UP_2: {
        id: "DEF_UP_2",
        skillId: "defense_up_2",
        ...buildSkill("time_attack", SKILL_DEPTH.LATE, true, 3),
        children: ["EXP_UP_2"],
        requirements: buildRequirements(SKILL_DEPTH.LATE),
    },

    DEF_UP_3: {
        id: "DEF_UP_3",
        skillId: "defense_up_3",
        ...buildSkill("time_attack", SKILL_DEPTH.END, true, 3),
        requirements: buildRequirements(SKILL_DEPTH.END, [
            { type: "playerLevel", value: 30 }
        ]),
    },    

    // ===== EXP =====
    EXP_UP_1: {
        id: "EXP_UP_1",
        skillId: "exp_up_1",
        ...buildSkill("normal", SKILL_DEPTH.MID, true, 1),
        children: ["DEF_UP_2","SLOT_1"],
        requirements: buildRequirements(SKILL_DEPTH.MID),
    },

    EXP_UP_2: {
        id: "EXP_UP_2",
        skillId: "exp_up_2",
        ...buildSkill("time_attack", SKILL_DEPTH.LATE, true, 1),
        children: ["EXP_UP_3","COOLDOWN_SPEED_1"],
        requirements: buildRequirements(SKILL_DEPTH.LATE),
    },

    EXP_UP_3: {
        id: "EXP_UP_3",
        skillId: "exp_up_3",
        ...buildSkill("normal", SKILL_DEPTH.END, true, 1),
        children: ["DEF_UP_3","MAX_HP_3","ITEM_SPAWN_3"],
        requirements: buildRequirements(SKILL_DEPTH.END),
    },
    
    // ===== アクティブ系（軽く調整のみ）=====
    // =========右=======================
    HEAL_SMALL: {
        id: "HEAL_SMALL",
        skillId: "heal_small",
        ...buildSkill("long_text", SKILL_DEPTH.MID, false, 3),
        children: ["DAMAGE_NEGATE_1"],
        requirements: buildRequirements(SKILL_DEPTH.MID),
    },

    HEAL_MEDIUM: {
        id: "HEAL_MEDIUM",
        skillId: "heal_medium",
        ...buildSkill("long_text", SKILL_DEPTH.LATE, false, 3),
        children: ["HEAL_HIGH"],
        requirements: buildRequirements(SKILL_DEPTH.LATE),
    },

    HEAL_HIGH: {
        id: "HEAL_HIGH",
        skillId: "heal_high",
        ...buildSkill("long_text", SKILL_DEPTH.END, false, 3),
        children: ["COOLDOWN_SPEED_3"],
        requirements: buildRequirements(SKILL_DEPTH.END),
    },

    // ===== 上攻撃系=====
    FREEZE_LIGHT: {
        id: "FREEZE_LIGHT",
        skillId: "freeze_light",
        ...buildSkill("time_attack", SKILL_DEPTH.MID, false, 0),
        children: ["FREEZE_MEDIUM"],
        requirements: buildRequirements(SKILL_DEPTH.MID),
    },

    FREEZE_MEDIUM: {
        id: "FREEZE_MEDIUM",
        skillId: "freeze_medium",
        ...buildSkill("time_attack", SKILL_DEPTH.LATE, false, 0),
        children: ["FREEZE_HEAVY"],
        requirements: buildRequirements(SKILL_DEPTH.LATE),
    },

    FREEZE_HEAVY: {
        id: "FREEZE_HEAVY",
        skillId: "freeze_heavy",
        ...buildSkill("time_attack", SKILL_DEPTH.END, true, 0),
        children: ["KB_UP_4"],
        requirements: buildRequirements(SKILL_DEPTH.END),
    },

    KILL_NEAREST: {
        id: "KILL_NEAREST",
        skillId: "kill_nearest",
        ...buildSkill("time_attack", SKILL_DEPTH.MID, false, 3),
        children: ["KILL_RANDOM"],
        requirements: buildRequirements(SKILL_DEPTH.MID),
    },

    KILL_RANDOM: {
        id: "KILL_RANDOM",
        skillId: "kill_random",
        ...buildSkill("time_attack", SKILL_DEPTH.LATE, false, 2),
        children: ["KILL_NEAREST_H","KB_UP_3"],
        requirements: buildRequirements(SKILL_DEPTH.LATE),
    },

    KILL_NEAREST_H: {
        id: "KILL_NEAREST_H",
        skillId: "kill_nearest_h",
        ...buildSkill("time_attack", SKILL_DEPTH.LATE, false, 1),
        children: ["COOLDOWN_SPEED_2"],
        requirements: buildRequirements(SKILL_DEPTH.LATE),
    },

    KILL_ALL: {
        id: "KILL_ALL",
        skillId: "kill_all",
        ...buildSkill("time_attack", SKILL_DEPTH.END, false, 1),
        requirements: buildRequirements(SKILL_DEPTH.END),
    },

    KNOCKBACK_EDGE: {
        id: "KNOCKBACK_EDGE",
        skillId: "knockback_edge",
        ...buildSkill("time_attack", SKILL_DEPTH.END, false, 2),
        requirements: buildRequirements(SKILL_DEPTH.END),
    },
    
    // ========右==============
    // ===== 防御系=====
    INVINCIBLE_SHORT: {
        id: "INVINCIBLE_SHORT",
        skillId: "invincible_short",
        ...buildSkill("long_text", SKILL_DEPTH.MID, false, 0),
        children: ["INVINCIBLE_MEDIUM"],
        requirements: buildRequirements(SKILL_DEPTH.MID),
    },

    INVINCIBLE_MEDIUM: {
        id: "INVINCIBLE_MEDIUM",
        skillId: "invincible_medium",
        ...buildSkill("long_text", SKILL_DEPTH.LATE, false, 0),
        children: ["INVINCIBLE_LONG","HEAL_MEDIUM"],
        requirements: buildRequirements(SKILL_DEPTH.LATE),
    },

    INVINCIBLE_LONG: {
        id: "INVINCIBLE_LONG",
        skillId: "invincible_long",
        ...buildSkill("long_text", SKILL_DEPTH.END, false, 0),
        requirements: buildRequirements(SKILL_DEPTH.END),
    },

    // ===== スキル補助=====
    // 下
    COOLDOWN_SPEED_1: {
        id: "COOLDOWN_SPEED_1",
        skillId: "cooldown_speed_1",
        ...buildSkill("normal", SKILL_DEPTH.LATE, true, 0),
        requirements: buildRequirements(SKILL_DEPTH.LATE),
    },
    // 上
    COOLDOWN_SPEED_2: {
        id: "COOLDOWN_SPEED_2",
        skillId: "cooldown_speed_2",
        ...buildSkill("time_attack", SKILL_DEPTH.LATE, false, 0),
        requirements: buildRequirements(SKILL_DEPTH.LATE),
    },
    // 右
    COOLDOWN_SPEED_3: {
        id: "COOLDOWN_SPEED_3",
        skillId: "cooldown_speed_3",
        ...buildSkill("long_text", SKILL_DEPTH.END, false, 0),
        requirements: buildRequirements(SKILL_DEPTH.END),
    },


};
