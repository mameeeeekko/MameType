// playerProfile.js

const PLAYER_PROFILE_KEY = "typing_player_profile";

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