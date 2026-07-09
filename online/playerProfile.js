// playerProfile.js

const PLAYER_PROFILE_KEY = "typing_player_profile";

const PLAYER_ID_KEY = "player_id";

let cachedPlayerId = null;

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


// ================================
// プロフィール取得
// ================================
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