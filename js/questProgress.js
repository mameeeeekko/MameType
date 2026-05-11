// questProgress.js
import { autoSaveQuest } from "./storage.js";
import { QUEST_MAP } from "./questMap.js";

const DEFAULT_PROGRESS = {
    unlocked: ["Q1"],
    cleared: []
};

let progress = load();

function load(){
    const data = localStorage.getItem("questProgress");
    if(!data) return {...DEFAULT_PROGRESS};
    return JSON.parse(data);
}

export function reloadQuestProgress() {
  const data = JSON.parse(localStorage.getItem("questProgress"));

  if (!data) return;

  progress = {
    ...DEFAULT_PROGRESS,
    ...data,
    unlocked: data.unlocked ?? ["Q1"],
    cleared: data.cleared ?? []
  };// ←これが重要
  return progress;
}

export function getClearedStageCount() {
  const progress = reloadQuestProgress();
  return progress?.cleared?.length || 0;
}


export function isUnlocked(id){
    return progress.unlocked.includes(id);
}

export function markCleared(id, nextList){
    if(!progress.cleared.includes(id)){
        progress.cleared.push(id);
    }

    nextList.forEach(n=>{
        if(!progress.unlocked.includes(n)){
            progress.unlocked.push(n);
        }
    });

    save();
}

export function isCleared(id){
    return progress.cleared.includes(id);
}

function save(){
    localStorage.setItem("questProgress", JSON.stringify(progress));
    // ★追加：オートセーブ連動
    autoSaveQuest();
}

export function resetQuestAll() {

    localStorage.removeItem("questPlayerStats");
    localStorage.removeItem("questProgress");
    localStorage.removeItem("quest_auto_save");
    localStorage.removeItem("questStars"); 

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
        unlocked: ["Q1"],
        cleared: []
    }));

    localStorage.setItem("quest_auto_save", JSON.stringify({
        progress: { unlocked: ["Q1"], cleared: [] },
        playerStats: freshStats
    }));

    resetQuestProgressMemory();
}

export function resetQuestProgressMemory() {
    progress = {
        unlocked: ["Q1"],
        cleared: []
    };
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

    if (node.id === "Q1") return true;

    const prevNodes = world.nodes.filter(n =>
        n.next.includes(node.id)
    );

    return prevNodes.some(n => isCleared(n.id));
}

// ★チャレンジ可能な最大スター数
export function getAvailableMaxStars() {

    const world = QUEST_MAP.WORLD1;

    let count = 0;

    world.nodes.forEach(node => {
        if (canEnterNode(node, world)) {
            count++;
        }
    });

    return count * 5;
}