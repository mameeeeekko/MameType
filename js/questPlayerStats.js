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
import { devOverride } from "../dev/devOverride.js";


const DEFAULT_STATS = {
    level: 1,
    exp: 0,
    nextExp: 500,
    
    maxHp: 35,
    defense: 0, //max 99

    radius: 15,

    //passiveSkill
    baseSkillSlot: 2,
    bonusSkillSlot: 0,
    slotHistory: {
        totalGained: 0,      //level
        rewardGained: 0,  //stage
        skillTreeGained: 0       // skill
    },
    obtainedSlotStages: [], // スキルスロット取得済みステージ

    unlockedSkills: [], //所持
    equippedSkills: [], //装備パッシブスキル
    
    //activeSkill
    activeSkillSlot: 1,  //基本的にアクティブスキルスロットは１
    activeSkill: null,  //装備するアクティブスキル
    activeSkillCooldown: 0,
    cooldownSpeed: 1.0, //skill
    activeSkillStock: 0,
    baseActiveSkillStockMax: 1,   // 初期ストック最大
    bonusActiveSkillStockMax: 0, 
    stockHistory: {
        totalGained: 0,      // level
        rewardGained: 0,     // stage
        skillTreeGained: 0       // skill
    },

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
        
        itemPickupCount: {}, // { itemId: count }

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
        
        maxCombo: 0,
        maxChain: 0,
        maxGScore: 0,

        activeSkillUseCount: {},   // { skillId: count }

        stageAttemptCount: {},     // { stageId: count }

        skillNodeAttemptCount: {},  // { skillNodeId : count}
    },
};

// ================================================
// 戦闘用リアルタイム計算
// ================================================
function buildFinalStats(base) {

    const isQuest = base._mode === "quest";

    const result = {
        ...base,

        chainRate: 1,
        chainDecayRate: 1,
        chainBonus: 1,
        knockbackBonus: 1,
        expMultiplier: 1,
        itemSpawnMultiplier: 1,
        damageNegateChance: 0,
        reviveChance: 0,

        skillSlotMax: (base.baseSkillSlot || 0) + (base.bonusSkillSlot || 0),
        activeSkillStockMax: (base.baseActiveSkillStockMax || 0) + (base.bonusActiveSkillStockMax || 0)
    };

    // ★ここで分岐
    if (isQuest) {
        for (const id of base.equippedSkills || []) {
            const skill = PASSIVE_SKILLS[id];
            if (skill?.apply) {
                skill.apply(result);
            }
        }
    }

    return result;
}

// ===============================
// クエスト統計：アイテム取得回数
// ===============================
export function addQuestItemPickup(itemId, count = 1) {

    if (!itemId) return;

    const stats = playerStats.questRecord;

    if (!stats.itemPickupCount) {
        stats.itemPickupCount = {};
    }

    stats.itemPickupCount[itemId] =
        (stats.itemPickupCount[itemId] || 0) + count;

    saveStats();
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

// パッシブスキル ------------------------------

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

// アクティブスキル装備 ------------------------------

export function equipActiveSkill(skillId) {
    const stats = playerStats;

    if (!stats.equippedActiveSkills) {
        stats.equippedActiveSkills = [];
    }

    // 今は1枠固定（必要なら増やせる）
    const MAX = 1;

    if (stats.equippedActiveSkills.includes(skillId)) return;

    if (stats.equippedActiveSkills.length >= MAX) {
        stats.equippedActiveSkills.shift();
    }

    stats.equippedActiveSkills.push(skillId);

    saveStats();
}

export function unequipActiveSkill(skillId) {
    const stats = playerStats;

    if (!stats.equippedActiveSkills) {
        stats.equippedActiveSkills = [];
    }

    stats.equippedActiveSkills =
        stats.equippedActiveSkills.filter(id => id !== skillId);

    saveStats();
}

export function getEquippedActiveSkills() {
    if (!playerStats.equippedActiveSkills) {
        playerStats.equippedActiveSkills = [];
    }
    return playerStats.equippedActiveSkills;
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
        parsed.bonusSkillSlot =
            parsed.skillSlotMax - (parsed.baseSkillSlot || 2);

        delete parsed.skillSlotMax;
    }

    return {
        ...DEFAULT_STATS,
        ...parsed,

        // ★ questRecord 深いマージ
        questRecord: {
            ...DEFAULT_STATS.questRecord,
            ...(parsed.questRecord || {}),

            // ★ days も深いマージ
            days: {
                ...DEFAULT_STATS.questRecord.days,
                ...(parsed.questRecord?.days || {})
            }
        },

        // ★ skillTreeProgress 深いマージ
        skillTreeProgress: {
            ...DEFAULT_STATS.skillTreeProgress,
            ...(parsed.skillTreeProgress || {})
        }
    };
}


export function reloadQuestPlayerStats() {
    const data = localStorage.getItem("questPlayerStats");

    if (!data) return;

    const parsed = JSON.parse(data);

    playerStats = {
        ...DEFAULT_STATS,
        ...parsed,

        // ★ questRecord 深いマージ
        questRecord: {
            ...DEFAULT_STATS.questRecord,
            ...(parsed.questRecord || {}),

            // ★ days も深いマージ
            days: {
                ...DEFAULT_STATS.questRecord.days,
                ...(parsed.questRecord?.days || {})
            }
        },

        // ★ skillTreeProgress 深いマージ
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
export function getPlayerStatsForEnemy(mode = "enemy", levelOverride = null) {

  const data = JSON.parse(localStorage.getItem("questPlayerStats"));

  let base = {
    ...DEFAULT_STATS,
    ...(data || {}),

    // ★重要：モードタグ
    _mode: mode
  };

  // フリーモード等でレベルが指定された場合、そのレベルに応じたステータスを再計算
  if (levelOverride !== null) {
    base.level = levelOverride;
    // クエストモードの成長式を流用
    base.maxHp = Math.min(999, 45 + (base.level - 1) * 8);
    base.defense = Math.min(99, (DEFAULT_STATS.defense || 0) + (base.level - 1));
    // 次の経験値もレベルに合わせて更新
    base.nextExp = Math.floor(650 * Math.pow(1.16, base.level - 1));
  }

  return buildFinalStats(base);
}

// ===============================
// 経験値追加
// ===============================
export function addExp(amount) {
    const beforeHp = playerStats.maxHp;
    const beforeDef = playerStats.defense;

    playerStats.exp += amount;

    let totalSlotIncrease = 0; // skillslot増加
    let totalStockIncrease = 0; // activeSkillStock増加
    let levelUpCount = 0;

    while (
        playerStats.level < 99 &&
        playerStats.exp >= playerStats.nextExp
    ) {
        const res = levelUp();
        if (res) {
            totalSlotIncrease += (res.slotIncrease || 0);
            totalStockIncrease += (res.stockIncrease || 0);
        }
        levelUpCount++;
    }

    const hpIncrease = playerStats.maxHp - beforeHp;
    const defIncrease = playerStats.defense - beforeDef;

    saveStats();

    playerStats.slotHistory.totalGained += totalSlotIncrease;
    playerStats.stockHistory.totalGained += totalStockIncrease;

    return {
        levelUpCount,
        slotIncrease: totalSlotIncrease,
        stockIncrease: totalStockIncrease,
        hpIncrease,
        defIncrease
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
    let stockIncrease = 0;

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
    // 推奨: スキルで防御を上げる場合のバランス調整として、
    // レベルごとの防御成長を一部のレベルでスキップする。
    // デフォルト：5レベル間隔でスキップ（Lv%5===0 の時は +1 しない）。
    const DEF_GROWTH_SKIP_INTERVAL = 5;

    if (playerStats.level % DEF_GROWTH_SKIP_INTERVAL !== 0) {
        playerStats.defense = Math.min(99, playerStats.defense + 1);
    } else {
        // スキップ時は成長しない（ただし上限は維持）
        playerStats.defense = Math.min(99, playerStats.defense);
    }

    //skill slot ,activeSkill stock増加
    if (playerStats.level === 2) { playerStats.bonusSkillSlot++; slotIncrease++; playerStats.bonusActiveSkillStockMax++; stockIncrease++; }//test
    if (playerStats.level === 15) { playerStats.bonusSkillSlot++; slotIncrease++; }
    if (playerStats.level === 30) { playerStats.bonusActiveSkillStockMax++; stockIncrease++;}
    if (playerStats.level === 35) { playerStats.bonusSkillSlot++; slotIncrease++; }
    if (playerStats.level === 70) { playerStats.bonusSkillSlot++; slotIncrease++; }
    return {slotIncrease, stockIncrease}; 

}

// ===============================
// DEV用レベルアップ指定関数　
// ===============================
export function forceSetLevel(targetLevel, progress = 0) {
    targetLevel = Math.max(1, Math.min(99, Number(targetLevel) || 1));
    progress = Math.max(0, Math.min(1, Number(progress) || 0));

    // 初期化
    playerStats.level = 1;
    playerStats.exp = 0;
    playerStats.nextExp = 500;

    playerStats.maxHp = DEFAULT_STATS.maxHp;
    playerStats.defense = DEFAULT_STATS.defense;
    playerStats.radius = DEFAULT_STATS.radius;
    playerStats.bonusSkillSlot = DEFAULT_STATS.bonusSkillSlot;

    playerStats.slotHistory = structuredClone(
        DEFAULT_STATS.slotHistory
    );

    // 正規レベルアップ
    while (playerStats.level < targetLevel) {
        levelUp();
    }

    // 現在レベル内の進捗
    playerStats.exp = Math.floor(
        playerStats.nextExp * progress
    );

    saveStats();
    return playerStats;
}

// ===============================
// スコアの経験値変換 (DEV対応)
// ===============================
export function scoreToExp(score) {
    if (score <= 0) return 0;

    const baseExp = Math.floor(score * 0.4);
    const multiplier = devOverride.exp?.multiplier ?? 1;

    return Math.floor(baseExp * multiplier);
}

// ===============================
// スキルツリー・報酬用
// ===============================
export function applySkillNodeEffect(reward, source = "stage") {

    const stats = getPlayerStats();

    if (!reward) return;

    // =========================
    // スキルスロット
    // =========================
    if (reward.type === "slot") {

        const value = reward.value || 1;

        stats.bonusSkillSlot += value;

        if (!stats.slotHistory) {
            stats.slotHistory = {
                totalGained: 0,
                rewardGained: 0,
                skillTreeGained: 0,
            };
        }

        if (source === "stage") {
            stats.slotHistory.rewardGained += value;
        } else if (source === "skill") {
            stats.slotHistory.skillTreeGained += value;
        }
    }

    // =========================
    // ★アクティブスキルストック上限
    // =========================
    if (reward.type === "activeStock") {

        const value = reward.value || 1;

        stats.bonusActiveSkillStockMax += value;

        if (!stats.stockHistory) {
            stats.stockHistory = {
                totalGained: 0,
                rewardGained: 0,
                skillTreeGained: 0,
            };
        }

        if (source === "stage") {
            stats.stockHistory.rewardGained += value;
        } else if (source === "skill") {
            stats.stockHistory.skillTreeGained += value;
        }
    }

    // 忘れず保存
    saveStats();
}

export function getSkillSlotMax() {
    const stats = getPlayerStatsForEnemy(); // buildFinalStats通る
    return stats.skillSlotMax;
}

export function getActiveSkillStockMax() {
    const stats = getPlayerStatsForEnemy(); // buildFinalStats通る
    return stats.activeSkillStockMax;
}

// ===============================
// Combo Tier
// ===============================
export const OVERDRIVE_COMBO = 60;
export const OVERDRIVE_SPEED = 3.0;

export const COMBO_TIERS = [
    {
        min: 1,
        max: 15,
        cooldownSpeed: 1.00,
    },
    {
        min: 16,
        max: 30,
        cooldownSpeed: 1.5,
    },
    {
        min: 31,
        max: OVERDRIVE_COMBO - 1,
        cooldownSpeed: 2.0,
    },
];

// ===============================
// 現在Tier取得
// ===============================
export function getComboTier(comboCount = 0) {

    for (const tier of COMBO_TIERS) {

        if (
            comboCount >= tier.min &&
            comboCount <= tier.max
        ) {
            return { ...tier }; // ← コピー
        }
    }

    return { ...COMBO_TIERS[0] };
}

// ===============================
// Tier進行率
// 0.0 ~ 1.0
// ===============================
export function getComboTierProgress(
    comboCount = 0
) {

    const tier =
        getComboTier(comboCount);

    // =====================
    // 最終Tierだけ特別処理
    // =====================
    if (tier.max >= OVERDRIVE_COMBO) {

        const displayMax = OVERDRIVE_COMBO;

        const range =
            displayMax - tier.min + 1;

        const current =
            Math.min(comboCount, displayMax)
            - tier.min + 1;

        return Math.max(
            0,
            Math.min(1, current / range)
        );
    }

    const range =
        tier.max - tier.min + 1;

    const current =
        comboCount - tier.min + 1;

    return Math.max(
        0,
        Math.min(1, current / range)
    );
}

// ===============================
// 現在Tier Index
// 0 ~
// ===============================
export function getComboTierIndex(
    comboCount = 0
) {

    return COMBO_TIERS.findIndex(
        tier =>
            comboCount >= tier.min &&
            comboCount <= tier.max
    );
}

// ===============================
// 現在のCooldown Speed取得
// ===============================
export function getCooldownSpeed(
    comboCount = 0
) {

    // 完全MAX
    if (comboCount >= OVERDRIVE_COMBO) {
        return OVERDRIVE_SPEED;
    }

    // 通常Tier
    const tier = getComboTier(comboCount);

    return tier.cooldownSpeed;
}

// ===============================
// クエストモード詳細ステータス更新 記録用
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
    // アクティブスキルストックの最大値更新
    // =========================
    if (result.activeSkillStockMax !== undefined) {
        stats.maxActiveSkillStock = Math.max(
            stats.maxActiveSkillStock || 0,
            result.activeSkillStockMax
        );
    }

    // =========================
    // 最大Combo / Chain
    // =========================
    stats.maxCombo = Math.max(
    stats.maxCombo || 0,
    result.maxCombo || 0
    );

    stats.maxChain = Math.max(
    stats.maxChain || 0,
    result.maxChain || 0
    );

    // =========================
    // 最高gScore更新
    // =========================
    stats.maxGScore = Math.max(
        stats.maxGScore || 0,
        result.gScore || 0
    );

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
// クエスト統計：アクティブスキル使用回数
// ===============================
export function addQuestActiveSkillUse(skillId, count = 1) {
    if (!skillId) return;

    const stats = playerStats.questRecord;

    if (!stats.activeSkillUseCount) {
        stats.activeSkillUseCount = {};
    }

    stats.activeSkillUseCount[skillId] =
        (stats.activeSkillUseCount[skillId] || 0) + count;

    saveStats();
}

// ===============================
// クエスト統計：ステージ挑戦回数
// ===============================
export function addQuestStageAttempt(stageId, count = 1) {
    if (!stageId) return;

    const stats = playerStats.questRecord;

    if (!stats.stageAttemptCount) {
        stats.stageAttemptCount = {};
    }

    stats.stageAttemptCount[stageId] =
        (stats.stageAttemptCount[stageId] || 0) + count;

    saveStats();
}

// ===============================
// クエスト統計：スキルノード挑戦回数
// ===============================
export function addQuestSkillNodeAttempt(nodeId, count = 1) {
    if (!nodeId) return;

    const stats = playerStats.questRecord;

    if (!stats.skillNodeAttemptCount) {
        stats.skillNodeAttemptCount = {};
    }

    stats.skillNodeAttemptCount[nodeId] =
        (stats.skillNodeAttemptCount[nodeId] || 0) + count;

    saveStats();
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