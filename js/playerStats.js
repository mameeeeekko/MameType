// playerStats.js

import { loadPlayerStats, savePlayerStats } from "./storage.js";

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
    avgAccuracy: 0,    // 平均正確率（Typed ÷ (Typed+Miss)）
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

    // 平均
    const totalAllEnemy = e.totalTyped + e.totalMiss; // 全入力数
    e.avgGKpm = e.totalTypeTime > 0 ? (e.totalTyped / e.totalTypeTime) * 60 : 0; // 平均KPM
    e.avgAccuracy = totalAllEnemy > 0 ? (e.totalTyped / totalAllEnemy) * 100 : 0; // 平均正確率

        // カテゴリ・モード別
    if (!e.modes) e.modes = {};
      e.modes[mode] = (e.modes[mode] || 0) + 1;

    // console.log("mode:", mode, "isEnemy:", isEnemy);
    // console.log("modes before:", e.modes);
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
    stats.freeMode.totalTime += totalTime;       // フリー時間加算
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
function showAchievementPopup(ids) {
  const container = document.createElement("div");
  container.className = "ach-popup-container";

  ids.forEach(id => {
    const a = ACHIEVEMENTS.find(x => x.id === id);
    if (!a) return;

    const el = document.createElement("div");
    el.className = "ach-popup";
    el.innerHTML = `🏅 ${a.name} 獲得！`;
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
function updateAchievements(stats) {
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
  if (stats.days?.streak >= 3) unlock("streak_3");
  if (stats.days?.streak >= 7) unlock("streak_7");
  if (stats.days?.streak >= 30) unlock("streak_30");

  // ===== 速度 =====
  if (stats.regular?.maxSpeed >= 300) unlock("speed_300");

  return unlockedNow; // 勲章お知らせ用
}



// ================================
// 勲章
// ================================
export const ACHIEVEMENTS = [
  { id: "first_play", name: "はじめの一歩", desc: "初めてプレイした" },
  { id: "days_7", name: "一週間プレイヤー", desc: "7日プレイ" },
  { id: "play_10", name: "常連", desc: "10回プレイ" },
  { id: "play_100", name: "熟練者", desc: "100回プレイ" },
  { id: "free_1h", name: "自由人", desc: "フリーモード1時間" },
  { id: "free_10h", name: "解放者", desc: "フリーモード10時間" },
  { id: "streak_3", name: "三日坊主卒業", desc: "3日連続プレイ" }, // ★追加
  { id: "streak_7", name: "連続者", desc: "7日連続プレイ" },
  { id: "streak_30", name: "継続の鬼", desc: "30日連続プレイ" }, // ★追加
  { id: "speed_300", name: "高速域", desc: "300KPM到達" }
];

