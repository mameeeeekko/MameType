// skillTree.js
import { startGame } from "./gameCore.js";
import { GameModes } from "./gameModes.js";
import { showGameScreen } from "./main.js";
import { gameState } from "./gameCore.js";
import { findParent } from "./skillTreeUI.js";
import { getPlayerStats, reloadQuestPlayerStats } from "./questPlayerStats.js";
import { unlockNode } from "./skillTreeUI.js";


export const SKILL_TREE = {

    START: {
        id: "START",
        children: ["CHAIN_1", "SCORE_1", "DEF_1", "SLOT_1"]
    },

    // ===== 上：チェイン =====
    CHAIN_1: {
        id: "CHAIN_1",
        skillId: "chain_up_1",
        unlock: { mode: "normal", type: "target", value: 3 },
        challenge: {
            mode: "normal",          // GameModesと一致させる
            difficulty: "normal",
            questionLimit: 3
        },
        children: ["CHAIN_2"]
    },

    CHAIN_2: {
        id: "CHAIN_2",
        skillId: "chain_decay_1",
        unlock: { mode: "normal", type: "time", value: 10  },
        challenge: {
            mode: "normal",          // GameModesと一致させる
            difficulty: "normal",
            questionLimit: 2
        },
    },

    // ===== 右：スコア =====
    SCORE_1: {
        id: "SCORE_1",
        skillId: "chain_bonus_1",
        unlock: { mode: "time_attack", type: "target", value: 2 },
        challenge: {
            mode: "time_attack",
            difficulty: "hard",
            limitSec: 15,
        },
    },

    // ===== 下：耐久 =====
    DEF_1: {
        id: "DEF_1",
        skillId: "kb_up_1",
        unlock: { mode: "long_text", type: "time", value: 20 },
        challenge: {
            mode: "long_text",
            difficulty: "hard",
        },
    },

     // ===== 左：その他 =====

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
}
};

export function checkSkillUnlocks(result, mode, nodeId){

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