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
//      tags:[ "", "句読点", "促音", "英語","記号","数字","ことわざ","擬音"] （longの場合は["文学"、"セキュリティ"、"おもしろ"、"プログラミング"、"自作キーボード","医療","時事"]）
//      excludeTags?: string[]（除外タグ。tags 未指定のときだけ自動で入る）
//      tagWeights?: {tag:string, weight:number}[]（long_text 専用。
//                 「開始時に選ぶ重み付き候補」。ノード生成時にはタグを固定せず
//                 この候補だけを持つ。出題時に1つだけ確定して tags に入る）
//   }
//
//   modeごとの使用項目
//   --------------------------------
//   normal      → questionLimit
//   time_attack → limitSec
//   long_text   → 特殊設定なし
//
//   ★tags 未指定（isSupport=false）の場合
//   --------------------------------
//   tags を持たないため「全タグ出題」になるが、デイリーと同じく
//   excludeTags: ["英語"] が自動設定され、英語を出題しない。
//   （isSupport=true のノードは SUPPORT_TAGS に英語が含まれるため除外しない）
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

import { doCountdown } from "./gameCore.js";
import { GameModes } from "./gameModes.js";
import { showGameScreen, updateGameUIVisibility } from "./main.js";
import { gameState } from "./gameCore.js";
import { findParents } from "./skillTreeUI.js";
import { getPlayerStats, reloadQuestPlayerStats } from "./questPlayerStats.js";
import { unlockNode } from "./skillTreeUI.js";
import { isCleared } from "./questProgress.js";
// ★ENGLISH_EXCLUDED_TAGS は target.js から直接 import する。
//   gameModes.js を経由すると gameModes → difficulties → defenseCore → main
//   → hud → skillTree の循環で TDZ（初期化前参照）エラーになる。
import { ENGLISH_EXCLUDED_TAGS } from "./target.js";
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

    // ★長文のタグは「開始時」に決める（ノード生成時ではない）
    //   長文は候補（tagWeights）しか持たないため、ここで初めて1枚に絞る。
    gameState.currentSkillNodeId = nodeId; 

    showGameScreen(); 

    const modeMap = {
        normal: GameModes.NORMAL,
        time_attack: GameModes.TIME_ATTACK,
        long_text: GameModes.LONG_TEXT
    };

    const runtimeChallenge = createRuntimeChallenge(challenge);

    const mode = modeMap[runtimeChallenge.mode];

    // ★デイリーと同じく、速度バー／残り時間バーの表示をモードに合わせる
    //   （doCountdown は非表示要素を元の値に戻すため、先に適用しておく必要がある）
    updateGameUIVisibility(mode.id);

    // =========================
    // 解放条件の固定表示
    // =========================
    requestAnimationFrame(() => {
        const node = SKILL_TREE[nodeId];
        const hint = document.getElementById("skillUnlockHint");

        if (node && hint) {
            // ★長文「プログラミング」が出題された場合は補正後の秒数を表示する
            //   （クリア判定と同じ補正を通さないと表示と判定がずれる）
            const unlockText = getUnlockTextForChallenge(node.unlock, runtimeChallenge);

            hint.style.display = "block";
            hint.innerHTML = `
                <div class="label">CLEAR</div>
                <div class="value">${unlockText || "-"}</div>
            `;
        }
    });

    // ★デイリーと同じくカウントダウン（2→1）を挟んでから問題を開始する
    doCountdown({
        mode,
        isFreeMode: false,
        difficulty: runtimeChallenge.difficulty,
        custom: {
            ...runtimeChallenge,
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
        questionLimit: 15
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
            { type:"time", value:75 },
            { type:"accuracy", value:90 }
        ],
        [
            { type:"time", value:75 },
            { type:"miss", value:8 }
        ],
        [
            { type:"time", value:80 },
            { type:"score", value:140 }
        ],
        [
            { type:"time", value:65 }
        ]
    ],

    1: [
        [
            { type:"time", value:85 },
            { type:"accuracy", value:93 }
        ],
        [
            { type:"time", value:85 },
            { type:"miss", value:5 }
        ],
        [
            { type:"time", value:85 },
            { type:"score", value:180 }
        ],
        [
            { type:"time", value:75 }
        ]
    ],

    2: [
        [
            { type:"time", value:165 },
            { type:"accuracy", value:95 }
        ],
        [
            { type:"time", value:165 },
            { type:"miss", value:5 }
        ],
        [
            { type:"time", value:165 },
            { type:"score", value:220 }
        ],
        [
            { type:"time", value:155 }
        ]
    ],

    3: [
        [
            { type:"time", value:270 },
            { type:"accuracy", value:97 }
        ],
        [
            { type:"time", value:270 },
            { type:"miss", value:5 }
        ],
        [
            { type:"time", value:270 },
            { type:"score", value:240 }
        ],
        [
            { type:"time", value:260 }
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
            { type:"target", value:8 },
            { type:"accuracy", value:90 }
        ],
        [
            { type:"target", value:8 },
            { type:"miss", value:8 }
        ],
        [
            { type:"target", value:8 },
            { type:"score", value:140 }
        ],
        [
            { type:"target", value:9 }
        ]
    ],

    1: [
        [
            { type:"target", value:21 },
            { type:"accuracy", value:93 }
        ],
        [
            { type:"target", value:21 },
            { type:"miss", value:5 }
        ],
        [
            { type:"target", value:21 },
            { type:"score", value:180 }
        ],
        [
            { type:"target", value:22 }
        ]
    ],

    2: [
        [
            { type:"target", value:26 },
            { type:"accuracy", value:95 }
        ],
        [
            { type:"target", value:26},
            { type:"miss", value:5 }
        ],
        [
            { type:"target", value:26 },
            { type:"score", value:220 }
        ],
        [
            { type:"target", value:28 }
        ]
    ],

    3: [
        [
            { type:"target", value:42 },
            { type:"accuracy", value:97 }
        ],
        [
            { type:"target", value:42 },
            { type:"miss", value:5 }
        ],
        [
            { type:"target", value:42 },
            { type:"score", value:240 }
        ],
        [
            { type:"target", value:43 }
        ]
    ]
};

// 右の長文系 ==================

export const LONG_TEXT_TAGS = [
    "文学",
    "プログラミング",
    "自作キーボード",
    "セキュリティ",
    "おもしろ",
    "医療",
    "時事",

];

export const LONG_TEXT_CHALLENGE_TABLE = { 
    0: { tags: [ { tag: "文学", weight: 2 }, { tag: "おもしろ", weight: 2 }, { tag: "時事", weight: 3 } ] },
    1: { tags: [ { tag: "文学", weight: 3 }, { tag: "セキュリティ", weight: 2 }, { tag: "医療", weight: 3 } ] }, 
    2: { tags: [ { tag: "おもしろ", weight: 5 }, { tag: "自作キーボード", weight: 2 }, ] },
    3: { tags: [ { tag: "セキュリティ", weight: 4 }, { tag: "プログラミング", weight: 2 }, { tag: "自作キーボード", weight: 1 } ] } 
};

export const LONG_TEXT_UNLOCK_TABLE = {
    0: [
        [
            { type:"time", value:210 },
            { type:"accuracy", value:85 }
        ],
        [
            { type:"time", value:210 },
            { type:"miss", value:20 }
        ],
        [
            { type:"time", value:210 },
            { type:"score", value:130 }
        ],
        [
            { type:"time", value:200 }
        ]
    ],

    1: [
        [
            { type:"time", value:160 },
            { type:"accuracy", value:92 }
        ],
        [
            { type:"time", value:160 },
            { type:"miss", value:25 }
        ],
        [
            { type:"time", value:160 },
            { type:"score", value:180 }
        ],
        [
            { type:"time", value:150 }
        ]
    ],

    2: [
        [
            { type:"time", value:150 },
            { type:"accuracy", value:95 }
        ],
        [
            { type:"time", value:150 },
            { type:"miss", value:15 }
        ],
        [
            { type:"time", value:150 },
            { type:"score", value:220 }
        ],
        [
            { type:"time", value:140 }
        ]
    ],

    3: [
        [
            { type:"time", value:145 },
            { type:"accuracy", value:97 }
        ],
        [
            { type:"time", value:145 },
            { type:"miss", value:8 }
        ],
        [
            { type:"time", value:145 },
            { type:"score", value:240 }
        ],
        [
            { type:"time", value:130 }
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
// 英語主体（下の補助系）の難易度補正
// =====================================================
//
// ★なぜ補正が必要か
//   下の補助系ノードは SUPPORT_TAGS（英語＋数字＋記号）で出題されるが、
//   クリア条件は左（normal）・上（time_attack）と同じテーブルから取っている。
//   英語は「1文字＝1打鍵」に対し日本語（かな→ローマ字）は1文字あたり約1.4〜1.6打鍵
//   なので、同じ文字数制限・同じ条件だと英語が明らかに易しい。
//
// ★係数の根拠（実測）
//   同じ制限時間でクリアできる問数を計測した結果：
//     ・240秒 … 日本語45問 / 英語56問（比 1.244 → 秒/問 0.804）
//     ・150秒 … 日本語27問 / 英語35問（比 1.296 → 秒/問 0.771）
//   2つの実験が独立にほぼ同じ値を示したため、
//   英語は日本語の約 1.27 倍の問数（=0.79 倍の所要時間）で打てる。
//   よって「左・上と同じ難易度」にするには、
//     time   : 英語は短い時間でクリアできる → 秒数を 0.79 倍に詰める
//     target : 同じ時間でより多く解ける     → 問数を 1.27 倍に増やす
//
// ★補正しない条件
//   score / accuracy / miss はいずれも打鍵数ベースの指標
//   （score = KPM × 正確率^3）で言語差が出ないため据え置く。
//   ユーザーが「time と target だけ補正する」と指定済みでも同じ結論。
//
// ★どちらのモードでどちらを補正するか（固定）
//   normal       → 出題側の問題数(questionLimit)は全ノード共通なので、
//                  クリア条件の「時間」だけ短縮して等其他を揃える
//   time_attack  → 出題側の制限時間(limitSec)は全ノード共通なので、
//                  クリア条件の「問数」だけ増やして等其他を揃える
export const ENGLISH_TIME_FACTOR = 0.79;    // normal      : time   = value × 0.79（秒を短く）
export const ENGLISH_TARGET_FACTOR = 1.27;  // time_attack : target = value × 1.27（問数を増やす）

/**
 * スタンダード（normal）用の補正。
 * 出題側の問題数は共通のまま、クリア条件の「秒数」だけを詰める。
 *
 * @param {Array<{type:string, value:number}>} unlock 補正前の条件配列
 * @returns {Array<{type:string, value:number}>} 補正後の条件配列（time のみ値が変わる）
 */
function adjustUnlockForEnglishNormal(unlock) {
    if (!unlock?.length) return unlock;

    return unlock.map(cond => {
        // time : クリア秒数を 0.79 倍（5秒刻みに丸めて表示をそろえる）
        if (cond.type === "time") {
            const scaled = cond.value * ENGLISH_TIME_FACTOR;
            return { ...cond, value: Math.max(5, Math.round(scaled / 5) * 5) };
        }

        // score / accuracy / miss は打鍵数ベースなので据え置き
        return cond;
    });
}

/**
 * タイムアタック（time_attack）用の補正。
 * 出題側の制限時間は共通のまま、クリア条件の「問数」だけ増やす。
 *
 * @param {Array<{type:string, value:number}>} unlock 補正前の条件配列
 * @returns {Array<{type:string, value:number}>} 補正後の条件配列（target のみ値が変わる）
 */
function adjustUnlockForEnglishTimeAttack(unlock) {
    if (!unlock?.length) return unlock;

    return unlock.map(cond => {
        // target : クリア問数を 1.27 倍（1問未満にならないように最低1問）
        if (cond.type === "target") {
            return { ...cond, value: Math.max(1, Math.round(cond.value * ENGLISH_TARGET_FACTOR)) };
        }

        // score / accuracy / miss は打鍵数ベースなので据え置き
        return cond;
    });
}

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
    } else {
        // ★tags 未指定は「全タグ出題」になるが、デイリーと同じく英語は除外する
        //   （isSupport=true は SUPPORT_TAGS に英語が含まれるため除外しない）
        challenge.excludeTags = ENGLISH_EXCLUDED_TAGS;
    }

    const unlock = NORMAL_UNLOCK_TABLE[depth][pattern].map(x => ({
        mode: "normal",
        ...x
    }));

    return {
        challenge,
        // ★下（英語）のみ補正：問題数は共通なのでクリア秒数だけ縮める
        unlock: isSupport ? adjustUnlockForEnglishNormal(unlock) : unlock
    };
}

export function buildTimeAttackSkill(depth, pattern = 0, isSupport = false) {
    const challenge = {
        mode: "time_attack",
        ...TIME_ATTACK_CHALLENGE_TABLE[depth]
    };
    if (isSupport) {
        challenge.tags = SUPPORT_TAGS[depth];
    } else {
        // ★tags 未指定は「全タグ出題」になるが、デイリーと同じく英語は除外する
        //   （isSupport=true は SUPPORT_TAGS に英語が含まれるため除外しない）
        challenge.excludeTags = ENGLISH_EXCLUDED_TAGS;
    }

    const unlock = TIME_ATTACK_UNLOCK_TABLE[depth][pattern].map(x => ({
        mode: "time_attack",
        ...x
    }));

    return {
        challenge,
        // ★下（英語）のみ補正：制限時間は共通なのでクリア問数だけ増やす
        unlock: isSupport ? adjustUnlockForEnglishTimeAttack(unlock) : unlock
    };
}

export function buildLongTextSkill(depth, pattern = 0, isSupport = false) { // isSupport is unused but kept for consistency

    // ★長文のタグはここでは決めない。
    //   この関数は SKILL_TREE 定数の生成関数なので、ここで抽選すると
    //   ページ読み込み時に1回だけ引かれてしまい、リロードするまで
    //   全プレイで同じタグになってしまうため。
    //   候補（重み付き）だけを保持し、実際の1枚は開始時に引く。
    //   テーブルから複製するので、元テーブルとの参照は切れていて
    //   偶発的な書き換えが起きない。
    return {
        challenge: {
            mode: "long_text",

            // 開始時に pickWeightedTag() で1つだけ選ぶための重みテーブル
            tagWeights: LONG_TEXT_CHALLENGE_TABLE[depth].tags
                .map(t => ({ ...t }))
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
// 長文チャレンジのタグ解決（開始時に実行）
//
// ★なぜ「開始時」なのか
//   buildLongTextSkill() は SKILL_TREE 定数の生成関数なので、そこで
//   抽選するとページ読み込み時に1回だけ引かれ、リロードするまで
//   全プレイで同じタグになってしまう。
//   そのため「候補（重み）」だけを保持し、開始時に引直す。
//
// ★表示側（オンマウス時ツールチップ / イントロ）は
//   どのタグが引かれるか未定なので候補を全件表示する。
//   getChallengeTagList() が担う。
// =====================================================

/**
 * 重み付き抽選。buildLongTextSkill から移動したもの。
 *
 * @param {Array<{tag:string, weight:number}>} items 候補
 * @returns {string} 抽選されたタグ
 */
function pickWeightedTag(items) {
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    let r = Math.random() * totalWeight;
    for (const item of items) {
        r -= item.weight;
        if (r <= 0) return item.tag;
    }
    return items[0].tag;
}

/**
 * 開始時点の challenge を生成する。
 * 長文（tagWeights を持つ challenge）のみ tags を1つに確定させる。
 * それ以外はそのまま返す。challenge 本体は改変せずコピーを返す。
 *
 * ★リトライ（skillTreeResult.js 側）も startSkillMode() を通るため、
 *   開始のたびに別タグが引かれる。
 *
 * @param {object} challenge ノードの challenge
 * @returns {object} 開始時点の challenge
 */
export function createRuntimeChallenge(challenge) {
    if (!challenge) return challenge;

    const tagWeights = challenge.tagWeights;

    // 長文以外は開始時に決めるものがない（normal / time_attack は challenge 自体が確定的）
    if (challenge.mode !== "long_text" ||
        !Array.isArray(tagWeights) ||
        !tagWeights.length) {
        return challenge;
    }

    return {
        ...challenge,
        tags: [pickWeightedTag(tagWeights)]
    };
}

/**
 * 表示用のタグ一覧を返す。
 * 長文は「選ばれる可能性があるタグ」を全件返す。
 * それ以外は challenge.tags をそのまま返す。
 *
 * ★UI（オンマウス時のツールチップ／イントロ）からのみ使う。
 *
 * @param {object} challenge ノードの challenge
 * @returns {string[]} 表示するタグ名の一覧
 */
export function getChallengeTagList(challenge) {
    if (!challenge) return [];

    const tagWeights = challenge.tagWeights;

    if (Array.isArray(tagWeights) && tagWeights.length) {
        return tagWeights.map(t => t.tag);
    }

    return challenge.tags || [];
}

// =====================================================
// 長文「プログラミング」のクリア条件補正
//
// ★なぜ補正するか
//   長文タグのうち「プログラミング」はコードサンプル数が多く打鍵数が
//   他の長文より多い。同じ「◯秒以内にクリア」条件では
//   明らかに厳しすぎるため、制限時間を 50 秒ぶん緩める。
//
// ★なぜ time だけか
//   accuracy / miss / score はいずれも打鍵数ベースの指標で、
//   今回の補正意図（所要時間の厳しさ）には直接効かないため据え置き。
//   time は「◯秒以内にクリア」なので値が大きいほど緩くなる。
// =====================================================

// プログラミングが出題されたときの time 条件に加算する秒数
export const PROGRAMMING_TAG_TIME_BONUS_SEC = 50;

// 補正対象のタグ名
const PROGRAMMING_TAG = "プログラミング";

/**
 * 出題タグが「プログラミング」の場合に、time 条件へ +50秒 を加える。
 * unlock は改変せずコピーを返す（該当しなければ元の参照をそのまま返す）。
 *
 * ★開始時に確定した challenge.tags を渡すこと
 *   長文は buildLongTextSkill() ではなく startSkillMode() でタグが決まるため、
 *   判定時点では challenge.tags が「実際に出題されたタグ」を持っている。
 *
 * @param {Array|object} unlock ノードのクリア条件
 * @param {object} challenge 開始時点の challenge（tags 確定済み）
 * @returns {Array} 補正後の条件配列
 */
export function adjustUnlockForChallengeTags(unlock, challenge) {
    if (!unlock) return unlock;

    const tags = challenge?.tags || [];
    if (!tags.includes(PROGRAMMING_TAG)) return unlock;

    const list = Array.isArray(unlock) ? unlock : [unlock];

    return list.map(cond => {
        // time だけ加算する（他は据え置き）
        if (cond.type !== "time") return cond;
        return {
            ...cond,
            value: (cond.value || 0) + PROGRAMMING_TAG_TIME_BONUS_SEC
        };
    });
}

/**
 * UI表示用: タグによるクリア条件補正の説明文。
 * 補正対象の出題タグでなければ空文字を返す。
 *
 * ★長文の候補に「プログラミング」が含まれるノードでは
 *   実際に引かれるタグが未確定なので、必ず説明を出す。
 *
 * @param {object} challenge ノードの challenge
 * @returns {string} 説明文（該当なしは空文字）
 */
export function getChallengeTagNote(challenge) {
    // 長文は候補（tagWeights）と開始時（tags）のどちらにも「プログラミング」が入る
    const tags = getChallengeTagList(challenge);

    if (!tags.includes(PROGRAMMING_TAG)) return "";

    return `「プログラミング」は、クリア条件の制限時間に +${PROGRAMMING_TAG_TIME_BONUS_SEC}秒 を加算`;
}

/**
 * 表示用のクリア条件テキストを返す。
 * adjustUnlockForChallengeTags() で補正したうえで getUnlockText() に渡す。
 *
 * ★判定（adjustUnlockForChallengeTags）と表示は必ずこの関数で揃える
 *   判定だけ補正すると「195秒でクリア」なのに表示は「145秒以内」となり矛盾する。
 *
 * @param {Array|object} unlock ノードのクリア条件
 * @param {object} challenge 開始時点の challenge（tags 確定済み）
 * @returns {string} 表示用テキスト
 */
export function getUnlockTextForChallenge(unlock, challenge) {
    return getUnlockText(adjustUnlockForChallengeTags(unlock, challenge));
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
            baseReqs.push({ type: "questClear", value: "W1_MiniBoss_1" });
            break;
        case SKILL_DEPTH.MID:
            baseReqs.push({ type: "playerLevel", value: 12 });
            baseReqs.push({ type: "questClear", value: "W1_Q15" });
            break;
        case SKILL_DEPTH.LATE:
            baseReqs.push({ type: "playerLevel", value: 25 });
            baseReqs.push({ type: "questClear", value: "W1_BOSS" });
            break;
        case SKILL_DEPTH.END:
            baseReqs.push({ type: "playerLevel", value: 45 });
            baseReqs.push({ type: "questClear", value: "W2_BOSS" });
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
        children: ["CHAIN_BONUS_4","GLASS_CHAIN_4","CHAIN_DECAY_4"],
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
        children: ["CHAIN_UP_4"],
        requirements: buildRequirements(SKILL_DEPTH.LATE),
    },
    
    CHAIN_DECAY_4: {
        id: "CHAIN_DECAY_4",
        skillId: "chain_decay_4",
        ...buildSkill("normal", SKILL_DEPTH.END, false, 0),
        children: ["STOCK_START_1"],
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
        children: ["STOCK_START_1"],
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
        children: ["CHAIN_UP_4"],
        requirements: buildRequirements(SKILL_DEPTH.LATE),
    },
    
    CHAIN_BONUS_4: {
        id: "CHAIN_BONUS_4",
        skillId: "chain_bonus_4",
        ...buildSkill("normal", SKILL_DEPTH.END, false, 2),
        children: ["STOCK_START_1"],
        requirements: buildRequirements(SKILL_DEPTH.END),
    },

    // ===== 戦闘開始時ストック =====
    STOCK_START_1: {
        id: "STOCK_START_1",
        skillId: "stock_start_1",
        ...buildSkill("normal", SKILL_DEPTH.END, false, 1),
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
        ...buildSkill("time_attack", SKILL_DEPTH.END, false, 3),
        children: ["KILL_ALL","KNOCKBACK_EDGE"],
        requirements: buildRequirements(SKILL_DEPTH.END),
    },

    // ===== 下（混合）=====
    SLOT_1: {
        id: "SLOT_1",
        skillId: "slot_1",
        ...buildSkill("normal", SKILL_DEPTH.LATE, true, 0),
        effect: { type: "slot", value: 1 },
        children: ["STOCK_1"],
        requirements: buildRequirements(SKILL_DEPTH.LATE),
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
        children: ["DEF_UP_2","SLOT_1","EXP_AUTO_1"],
        requirements: buildRequirements(SKILL_DEPTH.MID),
    },

    // ★オートスキル：EXP +10%（常時発動）
    EXP_AUTO_1: {
        id: "EXP_AUTO_1",
        skillId: "exp_auto_1",
        ...buildSkill("normal", SKILL_DEPTH.LATE, true, 1),
        effect: { type: "expUp", value: 0.10 },
        children: ["EXP_UP_2"],
        requirements: buildRequirements(SKILL_DEPTH.LATE),
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
        ...buildSkill("time_attack", SKILL_DEPTH.END, false, 0),
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
