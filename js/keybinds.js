// keybinds.js


export const defaultKeybinds = {
  unlock: "Delete",
  autoLock: "Tab",
  pause: "Enter",
  activeSkill: "Backspace"
};

export function loadKeybinds() {
  let stored = {};
  try {
    stored = JSON.parse(localStorage.getItem("keybinds") || "{}");
  } catch (e) {
    // 壊れたキー設定は既定値に戻す（設定画面が操作不能になるのを防ぐ）
    console.warn("[keybinds] 壊れたデータを検出（既定値を使用）", e);
    stored = {};
  }
  return {
    ...defaultKeybinds,
    ...stored
  };
}

export function saveKeybinds(bind) {
  localStorage.setItem("keybinds", JSON.stringify(bind));
}

// キーバインド判定ヘルパー
// Controlなど左右で e.code が分かれるキー（ControlLeft/ControlRight）を吸収する
export function isBoundKey(e, bound) {
  if (bound === "Control") return e.code === "ControlLeft" || e.code === "ControlRight";
  return e.code === bound;
}

export function initKeybinds() {

  const keybinds = loadKeybinds();

  console.log("keybind loaded:", keybinds);

  // 必要ならここで他初期化にも使える
}