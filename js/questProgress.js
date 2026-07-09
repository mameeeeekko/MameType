// questProgress.js
import { autoSaveQuest } from "./storage.js";
import { QUEST_MAP } from "./questMap.js";

const DEFAULT_PROGRESS = {
    unlocked: ["W1_Q1"],
    cleared: [],
    unlockedWorlds: ["WORLD1"],
    selectedWorldId: "WORLD1",
    hasSeenTrueEnding: false,
    playedDialogues: {}, // 会話再生履歴
};

let progress = load();

function load(){
    const data = localStorage.getItem("questProgress");
    if (!data) return { ...DEFAULT_PROGRESS };
    const parsed = JSON.parse(data);
    // playedDialoguesプロパティがない古いセーブデータのための後方互換性
    if (!parsed.playedDialogues) {
        parsed.playedDialogues = {};
    }
    return { ...DEFAULT_PROGRESS, ...parsed };
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
    hasSeenTrueEnding: data.hasSeenTrueEnding || false,
  };// ←これが重要
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

// ★ ADDED: Mark true ending as seen
export function markTrueEndingSeen() {
    if (progress) {
        progress.hasSeenTrueEnding = true;
    }
    save();
}
// ★ ADDED: Check if true ending has been seen
export function hasSeenTrueEnding() {
    // progress.hasSeenTrueEnding が undefined の場合も考慮して false を返す
    return !!progress.hasSeenTrueEnding;
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
        playedDialogues: {}, // ★ playedDialoguesを初期化
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