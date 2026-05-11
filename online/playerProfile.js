//playerProfile.js

export function getPlayerName() {
  return localStorage.getItem("playerName") || "";
}

export function setPlayerName(name) {
  localStorage.setItem("playerName", name);
}