// storage.js

import { QUEST_MAP } from "./questMap.js";
import { getTotalStars, getAvailableMaxStars } from "./questProgress.js";

// ================================
// Keys
// ================================
export const RECORDS_KEY   = "typing_game_records";   // 履歴
const RANKING_KEY   = "typing_game_ranking";   // ランキング
const STATS_KEY     = "typing_player_stats";   // プレイヤーステータス
const MAX_RECORDS   = 500;                    // 履歴上限
export const MAX_RANKING   = 100;                      // ランキング上限（任意）


// ================================
// 内部ユーティリティ
// ================================
function ensureModeFlags(record) {
  if (!record.userProtectedModes) record.userProtectedModes = {};
  if (!record.rankingProtectedModes) record.rankingProtectedModes = {};

  // 旧データ移行
  if (record.userProtected === true) {
    record.userProtectedModes[record.mode] = true;
  }
  if (record.rankingProtected === true) {
    record.rankingProtectedModes[record.mode] = true;
  }

  delete record.userProtected;
  delete record.rankingProtected;
}

// ============================================
// addRecord：履歴追加（userProtected / rankingProtected に対応）
// ============================================
export function addRecord(record) {
  const records = loadRecords();

  if (!record.id) record.id = crypto.randomUUID();
  ensureModeFlags(record);

  records.push(record);

  const mode = record.mode;

  // 未保護（そのモードで）のみ抽出
  const unprotected = records.filter(r =>
    r.mode === mode &&
    !r.userProtectedModes?.[mode] &&
    !r.rankingProtectedModes?.[mode]
  );

  if (unprotected.length > MAX_RECORDS) {
    let excess = unprotected.length - MAX_RECORDS;

    for (let i = 0; i < records.length && excess > 0; i++) {
      const r = records[i];
      if (
        r.mode === mode &&
        !r.userProtectedModes?.[mode] &&
        !r.rankingProtectedModes?.[mode]
      ) {
        records.splice(i, 1);
        i--;
        excess--;
      }
    }
  }

  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
}


export function loadRecords() {
  const json = localStorage.getItem(RECORDS_KEY);
  if (!json) return [];

  try {
    const data = JSON.parse(json);
    if (!Array.isArray(data)) return [];

    // フラグ保証
    data.forEach(ensureModeFlags);
    return data;
  } catch {
    return [];
  }
}

export function clearRecords() {
  localStorage.removeItem(RECORDS_KEY);
}

export function exportRecords() {
  const records = loadRecords();
  const blob = new Blob([JSON.stringify(records, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "typing_records.json";
  a.click();

  URL.revokeObjectURL(url);
}

export async function importRecords(file) {
  const text = await file.text();
  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("ファイル形式が正しくありません");
  }

  if (!Array.isArray(data)) {
    throw new Error("データ形式が不正です");
  }

  // -----------------------------
  // mode・ID・保護フラグ補完
  // -----------------------------
  data.forEach(r => {
    if (!r.id) r.id = crypto.randomUUID();

    // mode補完
    if (!r.mode) r.mode = "NORMAL";

    // ★ 新形式優先
    if (!r.userProtectedModes) r.userProtectedModes = {};
    if (!r.rankingProtectedModes) r.rankingProtectedModes = {};

    // ★ 旧形式 → 新形式へ移行
    if (r.userProtected === true) {
      r.userProtectedModes[r.mode] = true;
    }
    if (r.rankingProtected === true) {
      r.rankingProtectedModes[r.mode] = true;
    }

    delete r.userProtected;
    delete r.rankingProtected;
  });

  // -----------------------------
  // mode別 MAX_RECORDS 制限
  // 保護は削除しない
  // -----------------------------
  const result = [];

  const modes = [...new Set(data.map(r => r.mode))];

  modes.forEach(mode => {
    const list = data.filter(r => r.mode === mode);

    const protectedList = list.filter(
      r => r.userProtectedModes?.[mode] || r.rankingProtectedModes?.[mode]
    );

    const unprotectedList = list
      .filter(r => !r.userProtectedModes?.[mode] && !r.rankingProtectedModes?.[mode])
      .slice(-MAX_RECORDS);

    result.push(...protectedList, ...unprotectedList);
  });

  localStorage.setItem(RECORDS_KEY, JSON.stringify(result));

  // 👑同期
  syncRankingProtection();
}



// ================================
// Ranking（ランキング）
// ================================
// ============================================
// ランキングに応じて履歴の👑を自動付与・解除
// MAX_RANKING に完全連動
// ============================================
// ================================
// Ranking（mode別）
// ================================
function loadRankingMap() {
  return JSON.parse(localStorage.getItem(RANKING_KEY) || "{}");
}

function saveRankingMap(map) {
  localStorage.setItem(RANKING_KEY, JSON.stringify(map));
}

// ================================
// 👑同期（mode別）
// ================================
export function syncRankingProtection() {
  const map = loadRankingMap();
  const records = loadRecords();

  records.forEach(r => {
    const mode = r.mode;
    if (!r.rankingProtectedModes) r.rankingProtectedModes = {};

    const ids = map[mode] || [];
    r.rankingProtectedModes[mode] = ids.includes(r.id);
  });

  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
}

// ================================
// ランキング追加
// ================================
export function addRankingEntry(entry) {

  addRecord(entry);

  const mode = entry.mode;
  const records = loadRecords();
  const rec = records.at(-1);

  let ranking = loadRanking(mode);

  // 追加前の1位スコア
  let beforeTopScore;
  if (mode === "time_attack") {
    beforeTopScore = ranking[0]?.solvedCount ?? -Infinity;
  } else if (mode === "enemy_mode") {
    beforeTopScore = ranking[0]?.gScore ?? -Infinity;
  } else {
    beforeTopScore = ranking[0]?.eScore ?? -Infinity;
  }

  ranking.push(rec);

  // モード別ソート
  ranking = ranking
    .sort((a, b) => {
      if (mode === "time_attack") {
        return (b.solvedCount ?? 0) - (a.solvedCount ?? 0);
      } else if (mode === "enemy_mode") {
        return (b.gScore ?? 0) - (a.gScore ?? 0);
      } else {
        return (b.eScore ?? 0) - (a.eScore ?? 0);
      }
    })
    .slice(0, MAX_RANKING);
  
  saveRanking(mode, ranking);
  syncRankingProtection();

  const rankIndex = ranking.findIndex(r => r.id === rec.id);

  // 新記録判定
  let isNewRecord = false;
  if (rankIndex === 0) {
    if (mode === "time_attack") {
      isNewRecord = (rec.solvedCount ?? 0) > beforeTopScore;
    } else if (mode === "enemy_mode") {
      isNewRecord = (rec.gScore ?? 0) > beforeTopScore;
    } else {
      isNewRecord = (rec.eScore ?? 0) > beforeTopScore;
    }
  }

  return {
    isRankIn: rankIndex !== -1,
    isNewRecord,
    rankPos: rankIndex !== -1 ? rankIndex + 1 : null
  };
}

// ============================================
// ランキング保護を履歴に反映（上位から外れたら👑を解除）
// 必要に応じてランキング更新後に呼ぶ
// ============================================
export function updateRankingProtection() {
  const ranking = loadRanking();
  const records = loadRecords();

  const topIds = new Set(ranking.map(r => r.id));
  records.forEach(r => {
    // 上位ランキングIDなら👑付与、外れたら解除
    r.rankingProtected = topIds.has(r.id);
  });

  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
}

export function loadRanking(mode) {
  const map = loadRankingMap();
  const ids = map[mode] || [];
  const records = loadRecords();

  return ids
    .map(id => records.find(r => r.id === id))
    .filter(Boolean);
}

export function saveRanking(mode, rankingRecords) {
  const map = loadRankingMap();
  map[mode] = rankingRecords.map(r => r.id);
  saveRankingMap(map);
}


export function clearRanking() {
  localStorage.removeItem(RANKING_KEY);

  const records = loadRecords();
  records.forEach(r => {
    if (!r.rankingProtectedModes) r.rankingProtectedModes = {};
    r.rankingProtectedModes[r.mode] = false;
  });

  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
}

export function exportRanking() {
  const ranking = loadRanking();
  const blob = new Blob([JSON.stringify(ranking, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "typing_ranking.json";
  a.click();

  URL.revokeObjectURL(url);
}

export async function importRanking(file) {
  const text = await file.text();
  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("ファイル形式が正しくありません");
  }

  if (!Array.isArray(data)) {
    throw new Error("データ形式が不正です");
  }

  // UUID・フラグ補完
  data.forEach(r => {
    if (!r.id) r.id = crypto.randomUUID();
    if (r.userProtected === undefined) r.userProtected = false;
  });

  // MAX_RANKING制限
  const sorted = [...data].sort((a, b) => { 
    if(mode === "time_attack"){
      return (b.solvedCount ?? 0) - (a.solvedCount ?? 0);
    }else if(mode === "enemy_mode"){
      return (b.gScore ?? 0) - (a.gScore ?? 0);
    }else{
      return (b.eScore ?? 0) - (a.eScore ?? 0);
    }
  });

  const limited = sorted.slice(0, MAX_RANKING);

  saveRanking(limited);

  // 履歴追加
  limited.forEach(r => addRecord(r));

  // 👑同期
  syncRankingProtection();
}


// ================================
// PlayerStats（プレイヤーステータス）デイリー分
// ================================
function deepMerge(defaultObj, savedObj) {
  // 配列はそのまま採用
  if (Array.isArray(savedObj)) return savedObj;

  if (typeof defaultObj !== "object" || defaultObj === null) return savedObj;
  if (typeof savedObj !== "object" || savedObj === null) return defaultObj;

  const result = { ...defaultObj };

  for (const key of Object.keys(savedObj)) {
    if (key in defaultObj) {
      result[key] = deepMerge(defaultObj[key], savedObj[key]);
    } else {
      result[key] = savedObj[key];
    }
  }

  return result;
}

export function loadPlayerStats(defaultStats) {
  const json = localStorage.getItem(STATS_KEY);
  if (!json) return structuredClone(defaultStats);

  try {
    const saved = JSON.parse(json);
    return deepMerge(defaultStats, saved);
  } catch {
    return structuredClone(defaultStats);
  }
}

export function savePlayerStats(stats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

export function clearPlayerStats() {
  localStorage.removeItem(STATS_KEY);
}

// ================================
// Full Backup（統合バックアップ）
// ================================
export function exportAllData(stats = null) {
  const backup = {
    version: 1,
    exportedAt: Date.now(),

    records: loadRecords(),
    ranking: loadRankingMap(),
    playerStats: stats ?? JSON.parse(localStorage.getItem(STATS_KEY) || "null")
  };

  const blob = new Blob(
    [JSON.stringify(backup, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "typing_backup.json";
  a.click();

  URL.revokeObjectURL(url);
}

export async function importAllData(file, defaultStats = null) {
  const text = await file.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("ファイル形式が正しくありません");
  }

  if (!data || typeof data !== "object") {
    throw new Error("データ形式が不正です");
  }

  // -------------------------
  // records
  // -------------------------
  if (Array.isArray(data.records)) {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(data.records));
  }

  // -------------------------
  // ranking
  // -------------------------
  if (data.ranking && typeof data.ranking === "object") {
    localStorage.setItem(RANKING_KEY, JSON.stringify(data.ranking));
  }

  // -------------------------
  // playerStats
  // -------------------------
  if (data.playerStats) {
    const merged = defaultStats
      ? deepMerge(defaultStats, data.playerStats)
      : data.playerStats;

    localStorage.setItem(STATS_KEY, JSON.stringify(merged));
  }

  // 👑整合性補正
  syncRankingProtection();
}

export function exportPlayerStats(stats) {
  const blob = new Blob([JSON.stringify(stats, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "typing_player_stats.json";
  a.click();

  URL.revokeObjectURL(url);
}

export async function importPlayerStats(file, defaultStats) {
  const text = await file.text();
  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("ファイル形式が正しくありません");
  }

  if (typeof data !== "object" || data === null) {
    throw new Error("データ形式が不正です");
  }

  // defaultとマージして保存
  const merged = deepMerge(defaultStats, data);
  localStorage.setItem(STATS_KEY, JSON.stringify(merged));
}

// ================================
// Quest Save System（追加分）
// ================================

const QUEST_SLOTS_KEY = "quest_slots";
const QUEST_AUTO_KEY = "quest_auto_save";

function getQuestSnapshot() {
  return {
    progress: JSON.parse(localStorage.getItem("questProgress")),
    playerStats: JSON.parse(localStorage.getItem("questPlayerStats")),
  };
}
// ================================
// 🔹スロット一覧取得
// ================================
export function loadQuestSlots() {
  return JSON.parse(localStorage.getItem(QUEST_SLOTS_KEY) || "[]");
}

// ================================
// 🔹オートセーブ（常時上書き）
// ================================
export function autoSaveQuest() {
  const data = getQuestSnapshot();
  localStorage.setItem(QUEST_AUTO_KEY, JSON.stringify(data));
}

// ================================
// 🔹手動セーブ（スロット指定）
// ================================
export function saveQuestSlot(slotIndex) {
  const slots = loadQuestSlots(); // 既存データ取得
  const data = getQuestSnapshot(); // 現在の進行

  const stats = data.playerStats || {};
  const progress = data.progress || {};

  const furthestNode = getFurthestNodeId(progress.cleared);

  // ★ 指定スロットに上書き
  slots[slotIndex] = {
    progress,
    playerStats: stats,
    
    // ===== UI用サマリー =====
    summary: {
      level: stats.level ?? 1,
      hp: stats.maxHp ?? 0,
      def: stats.defense ?? 0,
      // ★ ノード → ステージ変換
      stage: getStageFromNode(furthestNode),
      // ★ 配列からカウント
      cleared: progress.cleared?.length ?? 0,
      currentStars: getTotalStars(progress), // 現在の獲得★
      maxStars: getAvailableMaxStars(),               // 最大★（後述）
      playTime: stats.playTime ?? 0          // プレイ時間（秒）
    },

    savedAt: Date.now() // ★保存日時追加（UI用）
  };

  localStorage.setItem(QUEST_SLOTS_KEY, JSON.stringify(slots));
}

function getStageFromNode(nodeId) {
  if (!nodeId) return "NONE";

  for (const world of Object.values(QUEST_MAP)) {
    const node = world.nodes.find(n => n.id === nodeId);
    if (node) return node.stage;
  }

  return "UNKNOWN";
}

function getFurthestNodeId(clearedList) {
  if (!clearedList || clearedList.length === 0) return null;

  // 全ノードを順番付きでフラット化
  const orderMap = {};
  let index = 0;

  for (const world of Object.values(QUEST_MAP)) {
    for (const node of world.nodes) {
      orderMap[node.id] = index++;
    }
  }

  // 一番進んでるノードを探す
  let bestId = null;
  let bestOrder = -1;

  for (const id of clearedList) {
    const order = orderMap[id] ?? -1;
    if (order > bestOrder) {
      bestOrder = order;
      bestId = id;
    }
  }

  return bestId;
}

// ================================
// 🔹手動ロード（スロット指定）
// ================================
function applyQuestData(data) {
  if (!data) return false;

  if (data.progress) {
    localStorage.setItem("questProgress", JSON.stringify(data.progress));
  }

  if (data.playerStats) {
    localStorage.setItem("questPlayerStats", JSON.stringify(data.playerStats));
  }

  return true;
}

export function loadQuestSlot(slotIndex) {
  const slots = loadQuestSlots();
  return applyQuestData(slots[slotIndex]);
}

export function loadQuestAuto() {
  const json = localStorage.getItem(QUEST_AUTO_KEY);
  if (!json) return false;

  return applyQuestData(JSON.parse(json));
}

// ================================
// 🔹スロット削除
// ================================
export function deleteQuestSlot(slotIndex) {
  const slots = loadQuestSlots();

  slots[slotIndex] = null; // 空にする

  localStorage.setItem(QUEST_SLOTS_KEY, JSON.stringify(slots));
}


// ================================
// 🔹リセット
// ================================
//savedataも消す
export function resetQuestData() {
  localStorage.removeItem("questProgress");
  localStorage.removeItem("questPlayerStats");
  localStorage.removeItem("questStars");
  localStorage.removeItem(QUEST_SLOTS_KEY); // ★変更
  localStorage.removeItem(QUEST_AUTO_KEY);
}

// ================================
// 🔹はじめから（スロットは保持）
// ================================
export function startQuestFromBeginning(defaultStats = null) {

  // ★ 星リセット
  localStorage.removeItem("questStars");

  // 進行リセット
  const initialProgress = {
    unlocked: ["Q1"],  // 最初のノードだけ解放（必要に応じて変更）
    cleared: []
  };

  localStorage.setItem("questProgress", JSON.stringify(initialProgress));

  // ステータス初期化
  if (defaultStats) {
    localStorage.setItem("questPlayerStats", JSON.stringify(defaultStats));
  } else {
    localStorage.removeItem("questPlayerStats");
  }

  // オートセーブも初期状態に
  localStorage.setItem(
    "quest_auto_save",
    JSON.stringify({
      progress: initialProgress,
      playerStats: defaultStats ?? null
    })
  );
}

// ================================
// Quest Backup
// ================================
export function exportQuestData() {
  const backup = {
    version: 1,
    exportedAt: Date.now(),

    questProgress: JSON.parse(localStorage.getItem("questProgress") || "null"),
    questPlayerStats: JSON.parse(localStorage.getItem("questPlayerStats") || "null"),
    questSlots: JSON.parse(localStorage.getItem(QUEST_SLOTS_KEY) || "[]"),
    questAutoSave: JSON.parse(localStorage.getItem(QUEST_AUTO_KEY) || "null"),
  };

  const blob = new Blob(
    [JSON.stringify(backup, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "quest_backup.json";
  a.click();

  URL.revokeObjectURL(url);
}

export async function importQuestData(file) {
  const text = await file.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("ファイル形式が正しくありません");
  }

  if (!data || typeof data !== "object") {
    throw new Error("データ形式が不正です");
  }

  if (data.questProgress) {
    localStorage.setItem(
      "questProgress",
      JSON.stringify(data.questProgress)
    );
  }

  if (data.questPlayerStats) {
    localStorage.setItem(
      "questPlayerStats",
      JSON.stringify(data.questPlayerStats)
    );
  }

  if (Array.isArray(data.questSlots)) {
    localStorage.setItem(
      QUEST_SLOTS_KEY,
      JSON.stringify(data.questSlots)
    );
  }

  if (data.questAutoSave) {
    localStorage.setItem(
      QUEST_AUTO_KEY,
      JSON.stringify(data.questAutoSave)
    );
  }
}