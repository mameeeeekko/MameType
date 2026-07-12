// playerProfile.js

const PLAYER_PROFILE_KEY = "typing_player_profile";

const PLAYER_ID_KEY = "player_id";
const RECOVERY_CODE_KEY = "recovery_code"; // ★追加

let cachedPlayerId = null;
let cachedRecoveryCode = null; // ★追加

/**
 * localStorageから永続的なプレイヤーIDを取得または生成します。
 * @returns {string} プレイヤーID (UUID)
 */
export function getPlayerId() {
  if (cachedPlayerId) {
    return cachedPlayerId;
  }

  let pid = localStorage.getItem(PLAYER_ID_KEY);
  if (!pid) {
    pid = crypto.randomUUID();
    localStorage.setItem(PLAYER_ID_KEY, pid);
    // ★ID新規生成時に、復元コードも必ず生成する
    const recoveryCode = crypto.randomUUID();
    localStorage.setItem(RECOVERY_CODE_KEY, recoveryCode);
  }
  cachedPlayerId = pid;
  return pid;
}

/**
 * 新しいプレイヤーIDをlocalStorageに保存し、キャッシュを更新します。
 * @param {string} newId - 新しいプレイヤーID
 */
export function setPlayerId(newId) {
  if (!newId || typeof newId !== 'string') return;

  localStorage.setItem(PLAYER_ID_KEY, newId);
  cachedPlayerId = newId; // キャッシュも更新
}

/**
 * localStorageから復元コードを取得します。
 * @returns {string | null} 復元コード
 */
export function getRecoveryCode() {
  if (cachedRecoveryCode) {
    return cachedRecoveryCode;
  }
  const code = localStorage.getItem(RECOVERY_CODE_KEY);
  cachedRecoveryCode = code;
  return code;
}

/**
 * 新しい復元コードをlocalStorageに保存します。
 * @param {string} newCode - 新しい復元コード
 */
export function setRecoveryCode(newCode) {
  if (!newCode || typeof newCode !== 'string') return;
  localStorage.setItem(RECOVERY_CODE_KEY, newCode);
  cachedRecoveryCode = newCode;
}


// ================================
// プロフィール取得
// ================================

/**
 * プレイヤーIDと復元コードをlocalStorageから削除し、新しいIDが生成されるようにリセットします。
 * (開発者ツール用)
 */
export function resetPlayerAndRecoveryId() {
  localStorage.removeItem(PLAYER_ID_KEY);
  localStorage.removeItem(RECOVERY_CODE_KEY);
  cachedPlayerId = null;
  cachedRecoveryCode = null;
  console.log("Player ID and Recovery Code have been reset.");
}


export function getPlayerProfile() {
  const raw = localStorage.getItem(PLAYER_PROFILE_KEY);

  if (!raw) {
    return {
      playerName: "",
      onlineEnabled: false
    };
  }

  try {
    return JSON.parse(raw);
  } catch {
    return {
      playerName: "",
      onlineEnabled: false
    };
  }
}

// ================================
// プロフィール保存
// ================================
export function savePlayerProfile(profile) {
  localStorage.setItem(
    PLAYER_PROFILE_KEY,
    JSON.stringify(profile)
  );
}

// ================================
// 名前
// ================================
export function getPlayerName() {
  return getPlayerProfile().playerName || "";
}

export function setPlayerName(name) {
  const profile = getPlayerProfile();
  profile.playerName = name;
  savePlayerProfile(profile);
}

// ================================
// オンライン参加設定
// ================================
export function isOnlineEnabled() {
  return getPlayerProfile().onlineEnabled ?? false;
}

export function setOnlineEnabled(enabled) {
  const profile = getPlayerProfile();
  profile.onlineEnabled = enabled;
  savePlayerProfile(profile);
}