import { initAudio, loadSound } from "./effectManager.js";

export const images = {};

function loadImage(name, src) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      images[name] = img;
      resolve();
    };
    img.onerror = () => {
      console.error(`Failed to load image: ${src}`);
      resolve(); // 失敗しても次に進めるようにする
    };
    img.src = src;
  });
}

export async function loadAssets(onProgress) {
  // 音声の初期化（ブラウザポリシー対応）
  await initAudio();

  const assets = [
    // スキル画像
    { type: "img", name: "chain_up", src: "./assets/pic/chain_up.jpeg" },
    { type: "img", name: "chain_bonus", src: "./assets/pic/chain_bonus.jpeg" },
    { type: "img", name: "skill_1", src: "./assets/pic/skill_1.jpeg" },

    // タイトル画面背景
    { type: "img", name: "title_menu", src: "./assets/pic/title_menu.png" },
    // クエストメニュー画面背景
    { type: "img", name: "quest_menu", src: "./assets/pic/quest_menu.png" },

    // クエストバトル背景
    { type: "img", name: "battle_blue", src: "./assets/pic/battle_field_blue.png" },
    { type: "img", name: "battle_green", src: "./assets/pic/battle_field_green.png" },
    { type: "img", name: "battle_gray", src: "./assets/pic/battle_field_gray.png" },

    // クエストマップ背景
    { type: "img", name: "map_blue", src: "./assets/pic/map_field_blue.png" },
    { type: "img", name: "map_purple", src: "./assets/pic/map_field_purple.png" },
    { type: "img", name: "map_red", src: "./assets/pic/map_field_red.png" },

    // 音源
    { type: "sound", name: "bgm1", src: "./assets/sound/bgm1.mp3" },
    { type: "sound", name: "bgm2", src: "./assets/sound/bgm2.mp3" },
    { type: "sound", name: "bgm3", src: "./assets/sound/bgm3.mp3" },
    { type: "sound", name: "kill1", src: "./assets/sound/kill1.mp3" },
    { type: "sound", name: "kill2", src: "./assets/sound/kill2.mp3" },
    { type: "sound", name: "kill3", src: "./assets/sound/kill3.mp3" },
    { type: "sound", name: "killLaser", src: "./assets/sound/killLaser.mp3" },
    { type: "sound", name: "kill5", src: "./assets/sound/kill5.mp3" },
    { type: "sound", name: "killBullet", src: "./assets/sound/killBullet.mp3" },
    { type: "sound", name: "killItem", src: "./assets/sound/killItem.mp3" },
    { type: "sound", name: "damage1", src: "./assets/sound/damage1.mp3" },
    { type: "sound", name: "bgm_enemy1", src: "./assets/sound/bgm_enemy1.mp3" },
    { type: "sound", name: "bgm_enemy2", src: "./assets/sound/bgm_enemy2.mp3" },
    { type: "sound", name: "bgm_enemy3", src: "./assets/sound/bgm_enemy3.mp3" },
    { type: "sound", name: "bgm_normal1", src: "./assets/sound/bgm_normal1.mp3" },
    { type: "sound", name: "error1", src: "./assets/sound/error1.mp3" },
  ];

  let loaded = 0;
  const total = assets.length;

  onProgress?.(0, total);

  for (const a of assets) {
    if (a.type === "img") {
      await loadImage(a.name, a.src);
    } else if (a.type === "sound") {
      await loadSound(a.name, a.src);
    }

    loaded++;
    onProgress?.(loaded, total);
  }

  console.log("asset loaded", images);
console.log("title_menu", images.title_menu);
}