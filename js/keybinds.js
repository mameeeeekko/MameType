// keybinds.js


export const defaultKeybinds = {
  unlock: "Space",
  autoLock: "Tab",
  pause: "Enter",
};

export function loadKeybinds() {
  return {
    ...defaultKeybinds,
    ...JSON.parse(localStorage.getItem("keybinds") || "{}")
  };
}

export function saveKeybinds(bind) {
  localStorage.setItem("keybinds", JSON.stringify(bind));
}

export function initKeybinds() {

  const keybinds = loadKeybinds();

  console.log("keybind loaded:", keybinds);

  // 必要ならここで他初期化にも使える
}