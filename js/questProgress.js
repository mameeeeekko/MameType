// questProgress.js
import { autoSaveQuest } from "./storage.js";
import { QUEST_MAP } from "./questMap.js";
import { grantRebuildTicket, setRebuildUnlimited } from "./questPlayerStats.js";

const DEFAULT_PROGRESS = {
    unlocked: ["W1_Q1"],
    cleared: [],
    unlockedWorlds: ["WORLD1"],
    selectedWorldId: "WORLD1",
    hasSeenTrueEnding: false,
    playedDialogues: {}, // 会話再生履歴
    playedChoices: {}, // { choiceId: [index1, index2] }
    // 初回全クリ特典を表示済みかどうか
    hasShownFirstFullClearReward: false,
    // ボスチャレンジモードのアンロック
    hasBossChallengeUnlocked: false,
};

let progress = load(); // 初期ロード

// 全ノードを順番に並べたリストを一度だけ生成
const allNodesInOrder = Object.values(QUEST_MAP).flatMap(world => world.nodes);

/**
 * クリア済みのノードIDの中から最大のステージ番号を取得します。
 * この関数は、IDの数字だけでなく、クエストマップ全体での進行度を考慮して数値を返します。
 * @returns {number} 進行度を示す数値。クリア済みがなければ0を返す。
 */
export function getMaxClearedStageNumber() {
    if (!progress.cleared || progress.cleared.length === 0) {
        return 0;
    }

    // 1. クリア済みのノードがマップ全体の何番目にあるか、そのインデックスの最大値を取得
    const maxIndex = progress.cleared.reduce((maxIdx, clearedId) => {
        const currentIndex = allNodesInOrder.findIndex(node => node.id === clearedId);
        return Math.max(maxIdx, currentIndex);
    }, -1);

    if (maxIndex === -1) return 0;

    // 2. そのインデックスにあるノードのIDからステージ番号を抽出する
    const furthestNodeId = allNodesInOrder[maxIndex]?.id;
    if (furthestNodeId) {
        const match = furthestNodeId.match(/\d+$/);
        if (match) {
            const num = parseInt(match[0], 10);
            // IDから数字が取れればそれを返す
            return num;
        }
    }

    // 3. IDに数字がない場合（ボスなど）は、そのインデックス自体を進行度として返す
    // これにより、W3_BOSSクリア後は90以上の値が返るようになる
    return maxIndex + 1;
}

function load(){
    const data = localStorage.getItem("questProgress");
    if (!data) return { ...DEFAULT_PROGRESS };
    const parsed = JSON.parse(data);
    // playedDialoguesプロパティがない古いセーブデータのための後方互換性
    if (!parsed.playedDialogues) {
        parsed.playedDialogues = {};
    }
    if (!parsed.playedChoices) {
        parsed.playedChoices = {};
    }
    const res = { ...DEFAULT_PROGRESS, ...parsed };
    if (res.hasSeenTrueEnding) {
        if (!res.unlockedWorlds.includes("WORLD_EX")) {
            res.unlockedWorlds.push("WORLD_EX");
        }
        if (!res.unlocked.includes("WEX_TEST_1")) {
            res.unlocked.push("WEX_TEST_1");
        }
    }
    return res;
}

export function reloadQuestProgress() {
  const data = JSON.parse(localStorage.getItem("questProgress"));

  if (!data) return;

  progress = {
    ...DEFAULT_PROGRESS,
    ...data,
    unlocked: data.unlocked ?? ["W1_Q1"],
    cleared: data.cleared ?? [],
    unlockedWorlds: data.unlockedWorlds ?? ["WORLD1"],
    selectedWorldId: data.selectedWorldId ?? "WORLD1",
    playedDialogues: data.playedDialogues ?? {},
    playedChoices: data.playedChoices ?? {},
    hasSeenTrueEnding: data.hasSeenTrueEnding || false,
    hasShownFirstFullClearReward: data.hasShownFirstFullClearReward || false,
    hasBossChallengeUnlocked: data.hasBossChallengeUnlocked || false,
  };
  if (progress.hasSeenTrueEnding) {
    if (!progress.unlockedWorlds.includes("WORLD_EX")) {
      progress.unlockedWorlds.push("WORLD_EX");
    }
    if (!progress.unlocked.includes("WEX_TEST_1")) {
      progress.unlocked.push("WEX_TEST_1");
    }
  }
  return progress;
}

export function getClearedStageCount(returnAsArray = false) {
  const progress = reloadQuestProgress();

  // 引数がtrueの場合、クリア済みIDの配列を返す
  if (returnAsArray) {
    return progress?.cleared || [];
  }
  // デフォルトではクリア数を返す
  return progress?.cleared?.length || 0;
}


export function isUnlocked(id){
    return progress.unlocked.includes(id);
}

export function markCleared(id, nextList, nextWorldId = null){
    if(!progress.cleared.includes(id)){
        progress.cleared.push(id);
    }

    if (nextWorldId && !progress.unlockedWorlds.includes(nextWorldId)) {
        progress.unlockedWorlds.push(nextWorldId);
    }

    nextList.forEach(n=>{
        if(!progress.unlocked.includes(n)){
            progress.unlocked.push(n);
        }
    });

    // ★WORLD2クリア（W2_BOSS撃破）で星の振り直しチケットを1枚付与
    // W2_BOSSのnextWorldは"WORLD3"なので、WORLD3がアンロックされた時がWORLD2クリア
    if (id === "W2_BOSS" && nextWorldId === "WORLD3") {
        grantRebuildTicket("world2clear");
    }

    save();
}

// dialogue.js から参照するために export する
// ★ enemyCore.js からも参照するために export
export function isCleared(id) {
    return progress.cleared.includes(id);
}

// ★ ADDED: Mark a dialogue as played
export function markDialoguePlayed(dialogueId) {
    if (!progress.playedDialogues) {
        progress.playedDialogues = {};
    }
    progress.playedDialogues[dialogueId] = true;
    save();
}

// ★ ADDED: Check if a dialogue has been played
export function hasDialogueBeenPlayed(dialogueId) {
    return progress.playedDialogues && progress.playedDialogues[dialogueId] === true;
}

/**
 * 選択肢が選ばれたことを記録します。
 * @param {string} choiceId - 選択肢グループのID
 * @param {number} choiceIndex - 選ばれた選択肢のインデックス
 */
export function markChoicePlayed(choiceId, choiceIndex) {
    if (!progress.playedChoices) {
        progress.playedChoices = {};
    }
    if (!progress.playedChoices[choiceId]) {
        progress.playedChoices[choiceId] = [];
    }
    if (!progress.playedChoices[choiceId].includes(choiceIndex)) {
        progress.playedChoices[choiceId].push(choiceIndex);
    }
    save();
}

/**
 * 指定された選択肢グループのすべての選択肢が選ばれたかを確認します。
 * @param {string} choiceId - 選択肢グループのID
 * @param {number} totalChoices - そのグループの選択肢の総数
 */
export function haveAllChoicesBeenPlayed(choiceId, totalChoices) {
    const played = progress.playedChoices?.[choiceId] || [];
    return played.length >= totalChoices;
}

/**
 * 指定された選択肢が選ばれたことがあるかを確認します。
 * @param {string} choiceId - 選択肢グループのID
 * @param {number} choiceIndex - 確認する選択肢のインデックス
 */
export function isChoicePlayed(choiceId, choiceIndex) {
    return progress.playedChoices?.[choiceId]?.includes(choiceIndex) || false;
}

// ★ ADDED: Mark true ending as seen
export function markTrueEndingSeen() {
    if (progress) {
        progress.hasSeenTrueEnding = true;
        if (!progress.unlockedWorlds.includes("WORLD_EX")) {
            progress.unlockedWorlds.push("WORLD_EX");
        }
        if (!progress.unlocked.includes("WEX_TEST_1")) {
            progress.unlocked.push("WEX_TEST_1");
        }
    }
    // ★全クリア特典：星の振り直しを無制限にする
    setRebuildUnlimited();
    save();
}
// ★ ADDED: Check if true ending has been seen
export function hasSeenTrueEnding() {
    // progress.hasSeenTrueEnding が undefined の場合も考慮して false を返す
    return !!progress.hasSeenTrueEnding;
}

// 初回全クリ特典表示フラグを記録する
export function markFirstFullClearRewardShown() {
    if (progress) {
        progress.hasShownFirstFullClearReward = true;
    }
    save();
}

export function hasShownFirstFullClearReward() {
    return !!progress.hasShownFirstFullClearReward;
}

export function markBossChallengeUnlocked() {
    if (progress) {
        progress.hasBossChallengeUnlocked = true;
    }
    save();
}

export function hasBossChallengeUnlocked() {
    return !!progress.hasBossChallengeUnlocked || !!progress.hasSeenTrueEnding;
}

function save(){
    localStorage.setItem("questProgress", JSON.stringify(progress));
    // ★追加：オートセーブ連動
    autoSaveQuest();
}

export function resetQuestAll() {
    // ★ localStorage.clear() をやめ、クエスト関連のキーのみを削除するように変更
    localStorage.removeItem("questPlayerStats");
    localStorage.removeItem("questProgress");
    localStorage.removeItem("quest_auto_save");
    localStorage.removeItem("questStars");
    localStorage.removeItem("QuestStages_Cache"); // ステージキャッシュもクリア

    const freshStats = {
        level: 1,
        exp: 0,
        nextExp: 500,
        maxHp: 35,
        defense: 0,
        radius: 15,
        baseSkillSlot: 2,
        bonusSkillSlot: 0,
        unlockedSkills: [],
        equippedSkills: [],
        skillTreeProgress: {
            unlockedNodes: ["START"]
        },
        questRecord: {
            totalPlayTime: 0,
            totalPlays: 0,
            totalKills: 0,
            totalTyped: 0,
            totalMiss: 0,
            avgKpm: 0,
            avgAccuracy: 0,
            maxKpm: 0,
            maxKpmDate: null,
            days: {
                todayCount: 0,
                maxPerDay: 0,
                streak: 0,
                unique: 0
            }
        }
    };

    localStorage.setItem("questPlayerStats", JSON.stringify(freshStats));

    localStorage.setItem("questProgress", JSON.stringify({
        unlocked: ["W1_Q1"],
        cleared: [],
        unlockedWorlds: ["WORLD1"],
        selectedWorldId: "WORLD1",
        hasSeenTrueEnding: false,
        hasShownFirstFullClearReward: false,
        playedDialogues: {}, // ★ playedDialoguesを初期化
        playedChoices: {}, // ★ playedChoicesを初期化
    }));

    localStorage.setItem("quest_auto_save", JSON.stringify({
        progress: { unlocked: ["W1_Q1"], cleared: [], unlockedWorlds: ["WORLD1"], selectedWorldId: "WORLD1", playedDialogues: {}, hasSeenTrueEnding: false },
        playerStats: freshStats,
        stars: {} // ★オートセーブに星データを含める
    }));

    resetQuestProgressMemory();
}

export function resetQuestProgressMemory() {
    progress = {
        unlocked: ["W1_Q1"],
        cleared: [],
        unlockedWorlds: ["WORLD1"],
        selectedWorldId: "WORLD1"
    };
}

export function getUnlockedWorlds() {
    return progress.unlockedWorlds;
}

export function getSelectedWorldId() {
    return progress.selectedWorldId || "WORLD1";
}

export function setSelectedWorldId(id) {
    progress.selectedWorldId = id;
    save();
}

// =====================================================
// 星の数を保存
// =====================================================

const KEY = "questStars";

export function getStarData() {
  return JSON.parse(localStorage.getItem(KEY) || "{}");
}

export function getStar(nodeId) {
  const data = getStarData();
  return data[nodeId] ?? 0;
}

export function setStar(nodeId, stars) {
  const data = getStarData();

  // ★上書きは「最大値のみ」
  data[nodeId] = Math.max(data[nodeId] ?? 0, stars);

  localStorage.setItem(KEY, JSON.stringify(data));
}


export function getTotalStars() {
    const data = getStarData(); // ← ここ重要

    let total = 0;

    for (const key in data) {
        total += data[key] || 0;
    }

    return total;
}

// ノードに入れるか判定（UIと同じロジック）
function canEnterNode(node, world) {
    // どのノードからも指されていないノードは、そのワールドの開始点とみなす
    const allNexts = new Set(world.nodes.flatMap(n => n.next || []));
    if (!allNexts.has(node.id)) return true;

    // 自分に繋がっている前ノードを探す
    const prevNodes = world.nodes.filter(n => (n.next || []).includes(node.id));

    return prevNodes.some(n => isCleared(n.id));
}

// ★チャレンジ可能な最大スター数
export function getAvailableMaxStars() {
    let count = 0;

    // 全ワールドをチェックし、アンロック済みのワールドのみノードを集計する
    Object.entries(QUEST_MAP).forEach(([worldId, world]) => {
        if (progress.unlockedWorlds.includes(worldId)) {
            world.nodes.forEach(node => {
                if (canEnterNode(node, world)) {
                    count++;
                }
            });
        }
    });

    return count * 5;
}

/**
 * ゲーム内に存在する全てのノードの最大スター数を計算します。
 * @returns {number}
 */
export function getTotalMaxStars() {
    let totalNodes = 0;
    for (const worldId in QUEST_MAP) {
        totalNodes += QUEST_MAP[worldId].nodes.length;
    }
    // 各ステージの最大スター数は5
    return totalNodes * 5;
}