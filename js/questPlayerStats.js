// questPlayerStats.js
// ===============================
// Lv1 → 100
// Lv10 → 約400
// Lv50 → 約1600
// Lv99 → かなり重い（やり込み用）
// Lv99 / HP999上限
// ===============================

import { autoSaveQuest } from "./storage.js";
import { PASSIVE_SKILLS } from "./questSkills.js";

const DEFAULT_STATS = {
    level: 1,
    exp: 0,
    nextExp: 500,
    
    maxHp: 35,
    defense: 0, //max 50

    radius: 15,

    baseSkillSlot: 2,
    bonusSkillSlot: 0,
    slotHistory: {
        totalGained: 0,      // レベルアップ
        rewardGained: 0,
        skillTreeGained: 0       // ★ステージ報酬
    },
    obtainedSlotStages: [], // スキルスロット取得済みステージ

    unlockedSkills: [], //所持
    equippedSkills: [], //装備スキル
    skillTreeProgress: {
        unlockedNodes: ["START"]
        },
    
  //クエストモード詳細ステータス
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

    totalStars: 0, //現在取得済みスター数
    maxStars: 0,   //取得できる最大のスター数

    days: {
      todayCount: 0,
      maxPerDay: 0,
      streak: 0,
      unique: 0
    },
    
  },
};


function buildFinalStats(base) {
    const result = {
        ...base,

        chainRate: 1,
        chainDecayRate: 1,
        chainBonus: 1,
        knockbackBonus: 1,

        // ★ここで合成
        skillSlotMax: (base.baseSkillSlot || 0) + (base.bonusSkillSlot || 0)
    };

    for (const id of base.equippedSkills || []) {
        const skill = PASSIVE_SKILLS[id];
        if (skill?.apply) {
            skill.apply(result);
        }
    }

    return result;
}

// ===============================
// スキル関連
// ===============================
export function unlockSkillNode(nodeId) {
    const stats = getPlayerStats();

    if (!stats.unlockedSkills.includes(nodeId)) {
        stats.unlockedSkills.push(nodeId);
        saveStats();
    }
}

export function equipSkill(skillId) {
    const stats = playerStats; // ←統一

    const MAX = getSkillSlotMax();

    if (!stats.equippedSkills) stats.equippedSkills = [];

    if (stats.equippedSkills.includes(skillId)) return;

    if (stats.equippedSkills.length >= MAX) {
        stats.equippedSkills.shift();
    }

    stats.equippedSkills.push(skillId);

    saveStats();
}

export function unequipSkill(skillId) {
    const stats = playerStats;

    stats.equippedSkills =
        stats.equippedSkills.filter(id => id !== skillId);

    saveStats();
}

let playerStats = loadStats();

// ===============================
// 読み込み / 保存
// ===============================
function loadStats() {
    const data = localStorage.getItem("questPlayerStats");

    if (!data) return { ...DEFAULT_STATS };

    const parsed = JSON.parse(data);

    if (parsed.skillSlotMax !== undefined) {
        parsed.bonusSkillSlot = parsed.skillSlotMax - (parsed.baseSkillSlot || 2);
        delete parsed.skillSlotMax;
    }

    return {
        ...DEFAULT_STATS,
        ...parsed,

        // ★ここが超重要（深いマージ）
        skillTreeProgress: {
            ...DEFAULT_STATS.skillTreeProgress,
            ...(parsed.skillTreeProgress || {})
        }
    };
}

export function reloadQuestPlayerStats(){
    const data = localStorage.getItem("questPlayerStats");
    if (!data) return;

    const parsed = JSON.parse(data);

    playerStats = {
        ...DEFAULT_STATS,
        ...parsed,

        // ★これ追加
        skillTreeProgress: {
            ...DEFAULT_STATS.skillTreeProgress,
            ...(parsed.skillTreeProgress || {})
        }
    };
}

function saveStats() {
    localStorage.setItem("questPlayerStats", JSON.stringify(playerStats));
    autoSaveQuest();
}

// ===============================
// 取得
// ===============================
export function getPlayerStatsForEnemy() {
  const data = JSON.parse(localStorage.getItem("questPlayerStats"));

  const base = {
    ...DEFAULT_STATS,
    ...(data || {})
  };

  return buildFinalStats(base);
}

// ===============================
// 経験値追加
// ===============================
export function addExp(amount) {
    playerStats.exp += amount;

    let totalSlotIncrease = 0; // ★追加
    let levelUpCount = 0;

    while (
        playerStats.level < 99 &&
        playerStats.exp >= playerStats.nextExp
    ) {
        const inc = levelUp();
        totalSlotIncrease += inc;
        levelUpCount++;
    }

    saveStats();

    playerStats.slotHistory.totalGained += totalSlotIncrease;

    return {
        levelUpCount,
        slotIncrease: totalSlotIncrease
    };
}

// ===============================
// レベルアップ
// ===============================
function levelUp() {
    if (playerStats.level >= 99) {
        playerStats.level = 99;
        playerStats.exp = 0;
        return;
    }

    playerStats.exp -= playerStats.nextExp;
    playerStats.level++;

    let slotIncrease = 0;

    // 次の必要経験値（指数カーブ）
    playerStats.nextExp = Math.floor(
        650 * Math.pow(1.16, playerStats.level - 1)
    );

    // HP成長（上限999）
    playerStats.maxHp = Math.min(
        999,
        45 + (playerStats.level - 1) * 8
    );

    // 防御成長（ゆるやか）
    playerStats.defense = Math.min(
        50,
        playerStats.defense + 1
    );

    //skill slot 増加
    if (playerStats.level === 2) { playerStats.bonusSkillSlot++; slotIncrease++; }//test
    if (playerStats.level === 15) { playerStats.bonusSkillSlot++; slotIncrease++; }
    if (playerStats.level === 35) { playerStats.bonusSkillSlot++; slotIncrease++; }
    if (playerStats.level === 70) { playerStats.bonusSkillSlot++; slotIncrease++; }
    return slotIncrease; 
}

// スコアの経験値変換
export function scoreToExp(score) {
    if (score <= 0) return 0;
    return Math.floor(score * 0.4);
}

// ===============================
// スキルツリー・報酬用
// ===============================
export function applySkillNodeEffect(reward, source = "stage") {

    const stats = getPlayerStats();

    if (!reward) return;

    if (reward.type === "slot") {

        const value = reward.value || 1;

        stats.bonusSkillSlot += value;

        // ★履歴初期化
        if (!stats.slotHistory) {
            stats.slotHistory = {
                totalGained: 0,
                rewardGained: 0,
                skillTreeGained: 0 
            };
        }

        // ★ステージ報酬として加算
        if (source === "stage") {
            stats.slotHistory.rewardGained += value;
        } else if (source === "skill") {
            stats.slotHistory.skillTreeGained += value;
        }
    }

    // 忘れず保存
    saveStats();
}

export function getSkillSlotMax() {
    const stats = getPlayerStatsForEnemy(); // buildFinalStats通る
    return stats.skillSlotMax;
}

// ===============================
// クエストモード詳細ステータス更新
// ===============================
export function updateQuestStats(result = {}) {
  const stats = playerStats.questRecord;

  stats.totalPlays++;
  stats.totalPlayTime += result.playTime || 0;
  stats.totalKills += result.kills || 0;
  stats.totalTyped += result.typed || 0;
  stats.totalMiss += result.miss || 0;

  // =========================
  // 最高KPM更新
  // =========================
  const currentKpm = result.kpm || 0;

  if (currentKpm > (stats.maxKpm || 0)) {
    stats.maxKpm = currentKpm;
    stats.maxKpmDate = new Date().toISOString();
  }

  // =========================
  // 平均
  // =========================
  const totalAll = stats.totalTyped + stats.totalMiss;

  stats.avgKpm = stats.totalPlayTime > 0
    ? (stats.totalTyped / stats.totalPlayTime) * 60
    : 0;

  stats.avgAccuracy = totalAll > 0
    ? (stats.totalTyped / totalAll) * 100
    : 0;

  // =========================
  // 日数
  // =========================
  updateQuestDays(stats.days);

  saveStats();
}

function updateQuestDays(days) {
  const today = new Date().toISOString().slice(0,10);

  if (!days._playedDates) days._playedDates = {};

  if (!days._playedDates[today]) {
    days._playedDates[today] = 0;
    days.unique++;
  }

  days._playedDates[today]++;
  days.todayCount = days._playedDates[today];

  days.maxPerDay = Math.max(days.maxPerDay, days.todayCount);

  if (days.lastPlayDate) {
    const prev = new Date(days.lastPlayDate);
    const curr = new Date(today);
    const diff = (curr - prev) / 86400000;

    if (diff === 1) days.streak++;
    else if (diff > 1) days.streak = 1;
  } else {
    days.streak = 1;
  }

  days.lastPlayDate = today;
}

// ===============================
// 報酬取得済みステージ判定関数
// ===============================
export function hasReceivedStageReward(stageId) {
    const stats = getPlayerStats();
    return stats.obtainedSlotStages?.includes(stageId);
}

export function markStageRewardReceived(stageId) {
    const stats = getPlayerStats();

    if (!stats.obtainedSlotStages) {
        stats.obtainedSlotStages = [];
    }

    stats.obtainedSlotStages.push(stageId);
}


// ===============================
// 見た目進化段階
// Lv1-9   : 0
// Lv10-19 : 1
// ...
// Lv90-99 : 9
// ===============================
export function getEvolutionStage() {
    return Math.min(
        9,
        Math.floor((playerStats.level - 1) / 10)
    );
}


// ===============================
// リセット（デバッグ用）
// ===============================
export function resetPlayerStats() {
    playerStats = { ...DEFAULT_STATS };
    saveStats();
}

export function getPlayerStats() {
    return playerStats;
}