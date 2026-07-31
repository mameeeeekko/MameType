// playerStats.js

import { loadPlayerStats, savePlayerStats } from "./storage.js"; export { savePlayerStats };
import { getClearedStageCount, hasSeenTrueEnding, getTotalStars, getTotalMaxStars } from "./questProgress.js";
import { QUEST_MAP } from "./questMap.js";
import { playSE } from "./effectManager.js";
import { getPlayerStats as getQuestPlayerStats } from "./questPlayerStats.js";
import { SKILL_TREE } from "./skillTree.js";

// ================================
// デフォルト
// ================================
const defaultStats = {
  totalPlays: 0,       // 全体総プレイ回数（通常＋フリーモード）

  // ========================
  // 通常モード
  // ========================
  regular: {
    totalPlays: 0,     // 通常モードの総プレイ回数
    totalTyped: 0,     // 正しく入力した総文字数
    totalMiss: 0,      // ミスタイプ総数
    totalGameTime: 0,  // 通常モードの累計プレイ時間（秒）
    maxEScore: 0,        // max eScore
    maxEScoreDate: null, //
    maxSpeed: 0,       // これまでの最高KPM
    maxSpeedDate: null, //最高KPMを出した日
    avgSpeed: 0,       // 平均KPM（総Typed ÷ 総時間 ×60）
    avgAccuracy: 0,    // 平均正確率
    noMissClears: 0,   // ★ノーミスクリア回数
    modes: {}          // モード別回数（mode名 → 回数）
  },
  
  // ========================
  // エネミーモード
  // ========================
  enemyMode: {
    totalPlays: 0,     // エネミーモード回数（任意）
    totalTyped: 0,     // 正しく入力した総文字数
    totalMiss: 0,      // ミスタイプ総数
    totalTypeTime: 0,  // enemyモードのタイピング時間（秒）
    totalPlayTime: 0,  // enemyモードの累計プレイ時間（秒）
    maxGScore: 0,
    maxGScoreDate: null,
    maxGKpm: 0,
    maxGKpmDate: null,
    avgGKpm: 0,
    avgAccuracy: 0,    // 平均正確率（Typed ÷ (Typed+Miss)）
    modes: {} ,         // モード別回数（mode名 → 回数）

    totalKills: 0,     // 倒した敵総
    maxChain: 0,
    maxCombo: 0,
    noDamageClears: 0, // ★ノーダメージクリア回数
  },

  // ========================
  // フリーモード
  // ========================
  freeMode: {
    totalPlays: 0,     // フリーモード総プレイ回数
    totalTime: 0,      // フリーモード累計プレイ時間（秒）
    modes: {}          // フリーモード内モード別回数（mode名 → 回数）
  },

  // ========================
  // 日数
  // ========================
  days: {
    unique: 0,         // プレイした日数（ユニーク日数）
    streak: 0,         // 連続プレイ日数
    maxStreak: 0,       // ★ 最高連続プレイ日数
    todayCount: 0,     // 今日のプレイ回数
    maxPerDay: 0,      // 1日の最大プレイ回数
    lastPlayDate: null,// 最後にプレイした日付（YYYY-MM-DD）
    playedDates: {}    // 日付別プレイ回数（YYYY-MM-DD → 回数）
  },

  // ========================
  // 勲章
  // ========================
  achievements: [],     // 取得済み勲章ID一覧
  seenAchievements: []  // 表示済み勲章ID（未読管理用）
};

// ================================
// 取得
// ================================
export function getPlayerStats() {
  const loaded = loadPlayerStats(defaultStats);

  // ===== 基本補完 =====
  if (!loaded.achievements) loaded.achievements = [];
  if (!loaded.seenAchievements) loaded.seenAchievements = [];
  if (!loaded.regular.maxSpeedDate)
  loaded.regular.maxSpeedDate = null;
  if (!loaded.freeMode) {
    loaded.freeMode = { totalPlays: 0, totalTime: 0, modes: {} };
  }
  if (!loaded.regular.maxEScore) loaded.regular.maxEScore = 0;
  if (!loaded.regular.maxEScoreDate) loaded.regular.maxEScoreDate = null;
  if (!loaded.regular) {
    loaded.regular = {
      totalPlays: 0,
      totalTyped: 0,
      totalMiss: 0,
      totalGameTime: 0,
      maxSpeed: 0,
      avgSpeed: 0,
      avgAccuracy: 0,
      modes: {}
    // noMissClears は後方互換性のため、なければ0として扱う
    };
  }

  if (!loaded.days) {
    loaded.days = {
      unique: 0,
      streak: 0,
      maxStreak: 0,
      todayCount: 0,
      maxPerDay: 0,
      lastPlayDate: null,
      playedDates: {}
    };
  }

  if (!loaded.days.maxStreak) loaded.days.maxStreak = 0;

  // ===== categories → modes 移行 =====
  if (loaded.regular.categories) {
    loaded.regular.modes = loaded.regular.categories;
    delete loaded.regular.categories;
  }

  if (!loaded.regular.modes) loaded.regular.modes = {};
  if (!loaded.freeMode.modes) loaded.freeMode.modes = {};

  return loaded;
}


// ================================
// 日付取得
// ================================
function todayStr() {
  const d = new Date();        // 現在日時
  return d.toISOString().slice(0, 10); // YYYY-MM-DD形式
}

// ================================
// 更新
// ================================
// result = { kpm, totalCorrect, totalMistake, totalTime, totalChars, mode, isFreeMode }
// stats: 現在の統計オブジェクト
// mode: プレイモードID
// date: プレイ日付
// isFree: フリーモードフラグ
export function updatePlayerStats(stats, result, mode, date = null, isFree = false) {

  stats = stats || getPlayerStats(); // 統計取得
  date = date || todayStr();         // 日付決定
  result = result || {};             // result安全化
  
  const isEnemy = mode === "enemy_mode";

  const totalChars = result.totalChars ?? 0;     // 正解文字数
  const totalMistake = result.totalMistake ?? 0; // ミス数
  const totalTime = result.totalTime ?? 0;       // 通常モードのプレイ時間（秒）
  const totalTypeTime = result.totalTypeTime ?? 0;  // エネミーモードのタイピング時間（秒）
  const totalPlayTime = result.totalPlayTime ?? 0;  // エネミーモードのプレイ時間（秒）
  const noDamage = result.noDamage ?? false;     // ★ノーダメージフラグ
  const kpm = !isFree ? result.kpm ?? 0 : null;  // 通常のみKPM
  const eScore = !isFree ? (result.eScore ?? 0) : null;
  const chain = result.maxChain ?? 0;
  const combo = result.maxCombo ?? 0;

  // ========================
  // 全体回数
  // ========================
  stats.totalPlays++; // 総プレイ++

  // ========================
  // enemyモード
  // ========================
  if (!isFree && isEnemy) {
    if (!stats.enemyMode) {
      stats.enemyMode = {
        totalPlays: 0,
        totalKills: 0,
        maxGKpm: 0,
        maxGKpmDate: null,
        maxGScore: 0,
        maxGScoreDate: null,
        avgGKpm: 0,
        totalGKpm: 0,
        avgAccuracy: 0,
        totalKills: 0,
        modes: {}
      };
    }

    const e = stats.enemyMode;

    e.totalPlays++;
    e.totalTyped += totalChars;  // 累計Typed
    e.totalMiss += totalMistake; // 累計Miss
    e.totalTypeTime += totalTypeTime; // 累計type時間
    e.totalPlayTime += totalPlayTime; // 累計プレイ時間

    const gkpm = !isFree ? result.kpm ?? 0 : null;
    const gScore = !isFree ? result.eScore ?? 0: null;
    const defeated = !isFree ? result.defeatedCount ?? 0: null;

    e.totalKills += defeated;

    // 最大GKPM
    if (gkpm > e.maxGKpm) {
      e.maxGKpm = gkpm;
      e.maxGKpmDate = date;
    }

    // 最大スコア
    if (gScore > e.maxGScore) {
      e.maxGScore = gScore;
      e.maxGScoreDate = date;
    }

    if (chain > e.maxChain) {
      e.maxChain = chain;
    }

    if (combo > e.maxCombo) {
      e.maxCombo = combo;
    }
    
    // ★ノーダメージクリア回数
    if (noDamage) {
      e.noDamageClears = (e.noDamageClears || 0) + 1;
    }

    // 平均
    const totalAllEnemy = e.totalTyped + e.totalMiss; // 全入力数
    e.avgGKpm = e.totalTypeTime > 0 ? (e.totalTyped / e.totalTypeTime) * 60 : 0; // 平均KPM
    e.avgAccuracy = totalAllEnemy > 0 ? (e.totalTyped / totalAllEnemy) * 100 : 0; // 平均正確率

        // カテゴリ・モード別
    // カテゴリ・モード別
    if (!e.modes) e.modes = {};
      e.modes[mode] = (e.modes[mode] || 0) + 1;
    // ★フリーモードとデイリーを区別
    const enemyModeKey = isFree ? 'free_enemy' : 'daily_enemy';
    e.modes[enemyModeKey] = (e.modes[enemyModeKey] || 0) + 1;

    // console.log("mode:", mode, "isEnemy:", isEnemy);
    // console.log("modes before:", e.modes);
    // 従来の 'enemy_mode' は合計値として保持（後方互換性のため）
    e.modes['enemy_mode'] = (e.modes['enemy_mode'] || 0) + 1;
  }

  // ========================
  // 通常モード処理
  // ========================
  if (!isFree && !isEnemy) {
    stats.regular.totalPlays++;              // 通常回数++
    stats.regular.totalTyped += totalChars;  // 累計Typed
    stats.regular.totalMiss += totalMistake; // 累計Miss
    stats.regular.totalGameTime += totalTime;// 累計時間
    if (kpm > stats.regular.maxSpeed) {
     stats.regular.maxSpeed = kpm;
     stats.regular.maxSpeedDate = date; // ★最高記録日保存
    }
    if (eScore > stats.regular.maxEScore) {
     stats.regular.maxEScore = eScore;
     stats.regular.maxEScoreDate = date;
    }

    const totalAll = stats.regular.totalTyped + stats.regular.totalMiss; // 全入力数
    stats.regular.avgSpeed = stats.regular.totalGameTime > 0 ? (stats.regular.totalTyped / stats.regular.totalGameTime) * 60 : 0; // 平均KPM
    stats.regular.avgAccuracy = totalAll > 0 ? (stats.regular.totalTyped / totalAll) * 100 : 0; // 平均正確率

    // ★ノーミスクリア回数
    if (totalMistake === 0) {
      stats.regular.noMissClears = (stats.regular.noMissClears || 0) + 1;
    }

    // カテゴリ・モード別
    if (mode) {
     if (!stats.regular.modes[mode])
       stats.regular.modes[mode] = 0;

       stats.regular.modes[mode]++;
    }
  }

  // ========================
  // フリーモード処理
  // ========================
  if (isFree) {
    stats.freeMode.totalPlays++;                 // フリー回数++
    // 通常モードの totalTime または エネミーモードの totalPlayTime を加算
    stats.freeMode.totalTime += (totalTime + totalPlayTime); 
    stats.freeMode.modes[mode] = (stats.freeMode.modes[mode] || 0) + 1; // モード回数++
  }

  // ========================
  // 日数統計
  // ========================
  const days = stats.days || (stats.days = {
    playedDates: {},
    unique: 0,
    todayCount: 0,
    maxPerDay: 0,
    streak: 0,
    maxStreak: 0,
    lastPlayDate: null
  });

  // ★日付は必ず YYYY-MM-DD
  const today = new Date().toISOString().slice(0, 10);

  // 初回日
  if (!days.playedDates[today]) {
    days.playedDates[today] = 0;
    days.unique++;
  }

  // 当日回数
  days.playedDates[today]++;
  days.todayCount = days.playedDates[today];

  // 最大
  days.maxPerDay = Math.max(days.maxPerDay, days.todayCount);

  // 連続判定
  if (days.lastPlayDate) {
    const prev = new Date(days.lastPlayDate);
    const curr = new Date(today);
    const diff = (curr - prev) / 86400000;

    if (diff === 1) days.streak++;
    else if (diff > 1) days.streak = 1;
  } else {
    days.streak = 1;
  }

  // 最大連続
  days.maxStreak = Math.max(days.maxStreak, days.streak);

  // 最終日
  days.lastPlayDate = today;


  // ========================
  // 勲章判定
  // ========================
  const newAchievements = updateAchievements(stats);

  // ★新規取得があれば通知
  if (newAchievements.length > 0) {
    showAchievementPopup(newAchievements);
  }

  // ========================
  // 保存
  // ========================
  savePlayerStats(stats); // 永続化

  return stats; // 更新済み統計
}

  // ========================
  // ポップアップUI追加
  // ========================
export function showAchievementPopup(ids) {
  const container = document.createElement("div");
  container.className = "ach-popup-container";

  // ★ 実績獲得時に効果音を再生
  playSE("trophy", 1.0);

  ids.forEach(id => {
    const a = ACHIEVEMENTS.find(x => x.id === id);
    if (!a) return;

    const el = document.createElement("div");
    el.className = "ach-popup";
    el.innerHTML = `🏆 ${a.name} 獲得！`;
    container.appendChild(el);
  });

  document.body.appendChild(container);

  // 自動消滅
  setTimeout(() => {
    container.remove();
  }, 6000);
}

// ================================
// ランク
// ================================
export function getSpeedRank(avgKpm) {
  if (avgKpm >= 600) return "God";
  if (avgKpm >= 500) return "SS";
  if (avgKpm >= 400) return "S";
  if (avgKpm >= 300) return "A";
  if (avgKpm >= 220) return "B";
  if (avgKpm >= 160) return "C";
  if (avgKpm >= 120) return "D";
  return "Beginner";
}

export function getAccuracyRank(avgAcc) {
  if (avgAcc >= 99) return "SS";
  if (avgAcc >= 97) return "S";
  if (avgAcc >= 95) return "A";
  if (avgAcc >= 90) return "B";
  if (avgAcc >= 80) return "C";
  return "D";
}

// ================================
// 時間表示
// ================================
export function formatPlayTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) return `${h}時間 ${m}分 ${s}秒`;
  if (m > 0) return `${m}分 ${s}秒`;
  return `${s}秒`;
}

// ================================
// 勲章判定
// ================================
export function updateAchievements(stats) {
  // ===== 配列保証 =====
  if (!Array.isArray(stats.achievements)) stats.achievements = [];
  if (!Array.isArray(stats.seenAchievements)) stats.seenAchievements = [];

  const a = stats.achievements;
  const unlockedNow = []; // 勲章ポップアップでお知らせ

  function unlock(id) {
    if (!a.includes(id)) {
      a.push(id);
      unlockedNow.push(id); //勲章お知らせ用
    }
  }

  // ===== 回数 =====
  if (stats.totalPlays >= 1) unlock("first_play");
  if (stats.totalPlays >= 10) unlock("play_10");
  if (stats.totalPlays >= 100) unlock("play_100");

  // ===== フリー時間 =====
  if (stats.freeMode?.totalTime >= 3600) unlock("free_1h");
  if (stats.freeMode?.totalTime >= 36000) unlock("free_10h");

  // ===== 日数 =====
  if (stats.days?.unique >= 7) unlock("days_7");
  if (stats.days?.unique >= 30) unlock("days_30");
  if (stats.days?.streak >= 3) unlock("streak_3");
  if (stats.days?.streak >= 7) unlock("streak_7");
  if (stats.days?.streak >= 14 ) unlock("streak_14");  
  if (stats.days?.streak >= 30) unlock("streak_30");

  // ===== 速度 =====
  if (stats.regular?.maxSpeed >= 200) unlock("kpm_200");
  if (stats.regular?.maxSpeed >= 250) unlock("kpm_250");
  if (stats.regular?.maxSpeed >= 300) unlock("kpm_300");

  if (stats.regular?.noMissClears >= 10) unlock("no_miss_10");

  // ===== クエスト & エネミーモード =====
  updateQuestAndEnemyAchievements(stats, unlock);

  // 真エンディング到達
  if (hasSeenTrueEnding()) {
    unlock("true_ending");
  }

  // 全実績解除
  // 「全実績解除」の実績自体を除いた総数
  const totalAchievements = ACHIEVEMENTS.filter(ach => ach.id !== 'all_achievements').length;
  const currentUnlockedCount = a.filter(id => id !== "all_achievements").length;
  if (currentUnlockedCount >= totalAchievements) {
    unlock("all_achievements");
  }
  return unlockedNow; // 勲章お知らせ用
}


/**
 * クエストモードとエネミーモードに関連する実績を判定・更新する
 * @param {object} stats - プレイヤー統計オブジェクト
 * @param {function} unlock - 実績をアンロックする関数
 */
function updateQuestAndEnemyAchievements(stats, unlock) {

  // エネミーモードの総撃破数
  if (stats.enemyMode?.maxChain >= 50) unlock("max_chain_50");//ok
  if (stats.enemyMode?.maxChain >= 100) unlock("max_chain_100");
  if (stats.enemyMode?.maxCombo >= 100) unlock("enemy_combo_100");//ok
  if (stats.enemyMode?.maxCombo >= 200) unlock("enemy_combo_200");
  if (stats.enemyMode?.maxCombo >= 300) unlock("enemy_combo_300");
  if (stats.enemyMode?.maxCombo >= 350) unlock("enemy_combo_350");
  if (stats.enemyMode?.modes?.daily_enemy >= 30) unlock("play_daily_enemy_30");//ok
  if (stats.enemyMode?.modes?.daily_enemy >= 100) unlock("play_daily_enemy_100");
  if (stats.enemyMode?.modes?.daily_enemy >= 1) unlock("play_daily_enemy_1"); //test



  if (stats.enemyMode?.noDamageClears >= 1) unlock("no_damage_clear_enemy");

  // ★新しい実績判定を追加
  if (stats.enemyMode?.maxGScore >= 10000) unlock("gscore_10k");
  if (stats.enemyMode?.totalKills >= 1000) unlock("enemy_kill_1000");

  // ★総プレイ時間
  const totalPlayTime = (stats.regular?.totalGameTime || 0) + 
                        (stats.freeMode?.totalTime || 0) + 
                        (stats.enemyMode?.totalPlayTime || 0);
  if (totalPlayTime >= 36000) unlock("play_time_10h"); // 10時間
  if (totalPlayTime >= 180000) unlock("play_time_50h"); // 50時間

  if (stats.totalPlays >= 500) unlock("play_500");
  if (stats.totalPlays >= 1000) unlock("play_1000");

  
  // ★通常モードのプレイ回数
  const nModes = stats.regular?.modes || {};
  if (nModes["proverb"] >= 50) unlock("play_proverb_50");
  if (nModes["english"] >= 50) unlock("play_english_50");


  // クエストモードのクリア回数
  const clearedQuests = getClearedStageCount();
  if (clearedQuests >= 10) unlock("quest_clear_10");
  if (clearedQuests >= 50) unlock("quest_clear_50");

  try {
    const questStats = getQuestPlayerStats();
    // クエストモードのプレイヤーレベル
    if (questStats.level >= 10) unlock("quest_level_10");
    if (questStats.level >= 50) unlock("quest_level_50");
    if (questStats.level >= 99) unlock("quest_level_99");

    // スキルツリーのアンロック数
    const unlockedSkills = questStats.skillTreeProgress?.unlockedNodes?.length || 0;
    if (unlockedSkills >= 10) unlock("skill_unlock_10");

    // ★全クエストクリア
    const totalQuests = Object.values(QUEST_MAP).flatMap(world => world.nodes).length;
    if (clearedQuests >= totalQuests) unlock("all_quests_clear");

    // ★全スキルアンロック
    const totalSkills = Object.keys(SKILL_TREE).length;
    if (unlockedSkills >= totalSkills) unlock("all_skills_unlocked");

    // ★クエストモードの星の数
    if (questStats.questRecord?.totalStars >= 100) unlock("total_stars_100");
    if (questStats.questRecord?.totalStars >= 300) unlock("total_stars_300");
    
    // 全てのスターを獲得
    const totalStars = getTotalStars(); // 現在の星の数
    const maxStars = getTotalMaxStars(); // 全ステージの最大スター数
    if (maxStars > 0 && totalStars >= maxStars) {
      unlock("total_stars_all");
    }

    // ★クエストモードのアイテム取得数
    const healItemCount = (questStats.questRecord?.itemPickupCount?.heal_small || 0) +
                          (questStats.questRecord?.itemPickupCount?.heal_medium || 0) +
                          (questStats.questRecord?.itemPickupCount?.heal_large || 0) +
                          (questStats.questRecord?.itemPickupCount?.heal_full || 0);
    if (healItemCount >= 50) unlock("item_heal_30");
    if (healItemCount >= 1) unlock("item_heal_1");//test


    const killItemCount = (questStats.questRecord?.itemPickupCount?.kill_small || 0) +
                          (questStats.questRecord?.itemPickupCount?.kill_medium || 0) +
                          (questStats.questRecord?.itemPickupCount?.kill_large || 0) +
                          (questStats.questRecord?.itemPickupCount?.kill_all || 0);
    if (killItemCount >= 50) unlock("item_kill_30");
    if (killItemCount >= 1) unlock("item_kill_1");//test

    const supportItemCount = (questStats.questRecord?.itemPickupCount?.freeze_small || 0) +
                             (questStats.questRecord?.itemPickupCount?.freeze_medium || 0) +
                             (questStats.questRecord?.itemPickupCount?.freeze_large || 0) +
                             (questStats.questRecord?.itemPickupCount?.cooldown_small || 0) +
                             (questStats.questRecord?.itemPickupCount?.cooldown_medium || 0) +
                             (questStats.questRecord?.itemPickupCount?.cooldown_large || 0) +
                             (questStats.questRecord?.itemPickupCount?.cooldown_stock || 0);
    if (supportItemCount >= 50) unlock("item_support_30");
    if (supportItemCount >= 1) unlock("item_support_1");//test

    // ★アクティブスキル使用回数
    const totalSkillUses = Object.values(questStats.questRecord?.activeSkillUseCount || {}).reduce((sum, count) => sum + count, 0);
    if (totalSkillUses >= 100) unlock("active_skill_100_uses");
  // 真エンディング到達
  if (hasSeenTrueEnding()) {
    unlock("true_ending");
  }

  } catch (e) {
    // questPlayerStatsがロードできない場合は何もしない
  }

  // ★ワールドクリア実績
  const cleared = getClearedStageCount(true); // 全クリア済みノードIDリストを取得
  if (cleared.includes("W1_BOSS")) unlock("clear_world_1");
  if (cleared.includes("W2_BOSS")) unlock("clear_world_2");
  if (cleared.includes("W3_BOSS")) unlock("clear_world_3");

  if (stats.regular?.maxEScore >= 260) unlock("rank_s");
}

// ================================
// 勲章
// ================================
export const ACHIEVEMENTS = [
  // --- プレイ回数・時間 ---
  { id: "first_play", name: "はじめの一歩", desc: "初めてプレイした" },//ok
  { id: "play_10", name: "常連", desc: "10回プレイ" },//ok
  { id: "play_100", name: "熟練者", desc: "100回プレイ" },
  { id: "play_500", name: "ベテラン", desc: "500回プレイ" },
  { id: "play_1000", name: "レジェンド", desc: "1000回プレイ" },
  { id: "play_time_10h", name: "時間旅行者", desc: "総プレイ時間10時間" },
  { id: "play_time_50h", name: "時空の覇者", desc: "総プレイ時間50時間" },

  // --- 日数・継続 ---
  { id: "days_7", name: "一週間プレイヤー", desc: "7日プレイ" },
  { id: "days_30", name: "一ヶ月プレイヤー", desc: "累計30日プレイ" },
  { id: "streak_3", name: "三日坊主卒業", desc: "3日連続プレイ" },//ok
  { id: "streak_7", name: "連続者", desc: "7日連続プレイ" },
  { id: "streak_14", name: "二週間皆勤", desc: "14日連続プレイ達成" },
  { id: "streak_30", name: "継続の鬼", desc: "30日連続プレイ" },

  // --- タイピングスキル ---
  { id: "kpm_200", name: "高速域", desc: "200KPM到達" },//ok
  { id: "kpm_250", name: "光速", desc: "250KPM到達" },
  { id: "kpm_300", name: "超光速", desc: "300KPM到達" },
  { id: "no_miss_10", name: "パーフェクト10", desc: "ノーミスクリア10回" },
  { id: "rank_s", name: "Sの領域", desc: "eScoreのランクSに到達" },//ok

  // --- モード別 ---
  { id: "free_1h", name: "自由人", desc: "フリーモード1時間" },
  { id: "free_10h", name: "解放者", desc: "フリーモード10時間" },
  { id: "play_proverb_50", name: "ことわざ博士", desc: "ことわざモードを50回プレイ" },
  { id: "play_english_50", name: "英語マスター", desc: "英語モードを50回プレイ" },

  // --- エネミーモード ---
  { id: "play_daily_enemy_30", name: "エネミーチャレンジャー30", desc: "デイリーのエネミーモードを30回プレイ" }, //ok
  { id: "play_daily_enemy_100", name: "デイリーチャレンジャー100", desc: "デイリーのエネミーモードを100回プレイ" },
  //{ id: "play_daily_enemy_1", name: "デイリーチャレンジャー1", desc: "デイリーのエネミーモードを1回プレイ" },
  { id: "enemy_kill_1000", name: "撃墜王", desc: "エネミーモードで1000体撃破" },
  { id: "gscore_10k", name: "スコアマスター", desc: "gScore 1万点到達" },//ok
  { id: "max_chain_50", name: "チェイン50", desc: "最大チェイン50到達" },//ok
  { id: "max_chain_100", name: "チェインマスター", desc: "最大チェイン100到達" },
  { id: "enemy_combo_100", name: "コンボ100", desc: "最大コンボ100到達" },//ok
  { id: "enemy_combo_200", name: "コンボ200", desc: "最大コンボ200到達" },
  { id: "enemy_combo_300", name: "コンボアーティスト", desc: "最大コンボ300到達" },
  { id: "enemy_combo_350", name: "コンボマスター", desc: "最大コンボ350到達" },
  { id: "no_damage_clear_enemy", name: "鉄壁", desc: "エネミーモードでノーダメージクリア" },

  // --- クエストモード ---
  { id: "quest_clear_10", name: "冒険の始まり", desc: "クエストを10個クリア" },
  { id: "quest_clear_50", name: "ベテラン冒険者", desc: "クエストを50個クリア" },
  { id: "all_quests_clear", name: "世界の救世主", desc: "全てのクエストをクリア" },
  { id: "clear_world_1", name: "開拓者", desc: "ワールド1をクリア" }, //ok
  { id: "clear_world_2", name: "探求者", desc: "ワールド2をクリア" },
  { id: "clear_world_3", name: "到達者", desc: "ワールド3をクリア" },
  { id: "quest_level_10", name: "成長の証", desc: "プレイヤーレベル10到達" },//ok
  { id: "quest_level_50", name: "熟練の風格", desc: "プレイヤーレベル50到達" },
  { id: "quest_level_99", name: "王者の風格", desc: "プレイヤーレベル99到達" },
  { id: "skill_unlock_10", name: "スキルコレクター", desc: "スキルを10個アンロック" },
  { id: "all_skills_unlocked", name: "スキルマスター", desc: "全てのスキルをアンロック" },
  { id: "total_stars_100", name: "星々の収集家", desc: "合計スター100個獲得" },
  { id: "total_stars_300", name: "星空の探検家", desc: "合計スター300個獲得" },
  { id: "total_stars_all", name: "星空の覇者", desc: "全てのスターを獲得した" },
  { id: "item_heal_50", name: "回復の恩恵", desc: "回復アイテムを50個取得" },//ok
  { id: "item_kill_50", name: "破壊の恩恵", desc: "攻撃アイテムを50個取得" },
  { id: "item_support_50", name: "支援の達人", desc: "補助アイテムを50個取得" },
 // { id: "item_heal_1", name: "test回復の恩恵", desc: "test回復アイテムを50個取得" },
  //{ id: "item_kill_1", name: "test破壊の恩恵", desc: "test攻撃アイテムを50個取得" },
  //{ id: "item_support_1", name: "test支援の達人", desc: "test補助アイテムを50個取得" },
  { id: "active_skill_100_uses", name: "スキル活用術", desc: "アクティブスキルを100回使用" },

  // --- ストーリー・コンプリート ---
  { id: "true_ending", name: "物語の終わり、そして始まり", desc: "真のエンディングに到達した" },
  { id: "all_achievements", name: "完全無欠のタイパー", desc: "すべての実績を解除した" },
];