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
      console.error(
        `[IMAGE LOAD ERROR] name=${name} src=${src}`
      );
      resolve();
    };

    img.src = src;
  });
}

export async function loadAssets(onProgress) {
  // 音声の初期化（ブラウザポリシー対応）
  await initAudio();

  const assets = [
    // passiveスキル画像
    { type: "img", name: "chain_up_1", src: "./assets/pic/skill/chain_up_1.png" },
    { type: "img", name: "chain_up_2", src: "./assets/pic/skill/chain_up_2.png" },
    { type: "img", name: "chain_up_3", src: "./assets/pic/skill/chain_up_3.png" },
    { type: "img", name: "chain_up_4", src: "./assets/pic/skill/chain_up_4.png" },
    { type: "img", name: "chain_bonus_1", src: "./assets/pic/skill/chain_bonus_1.png" },
    { type: "img", name: "chain_bonus_2", src: "./assets/pic/skill/chain_bonus_2.png" },
    { type: "img", name: "chain_bonus_3", src: "./assets/pic/skill/chain_bonus_3.png" },
    { type: "img", name: "chain_bonus_4", src: "./assets/pic/skill/chain_bonus_4.png" },
    { type: "img", name: "chain_decay_1", src: "./assets/pic/skill/chain_decay_1.png" },
    { type: "img", name: "chain_decay_2", src: "./assets/pic/skill/chain_decay_2.png" },
    { type: "img", name: "chain_decay_3", src: "./assets/pic/skill/chain_decay_3.png" },
    { type: "img", name: "chain_decay_4", src: "./assets/pic/skill/chain_decay_4.png" },
    { type: "img", name: "glass_1", src: "./assets/pic/skill/glass_1.png" },
    { type: "img", name: "glass_2", src: "./assets/pic/skill/glass_2.png" },
    { type: "img", name: "glass_3", src: "./assets/pic/skill/glass_3.png" },
    { type: "img", name: "glass_4", src: "./assets/pic/skill/glass_4.png" },
    { type: "img", name: "kb_1", src: "./assets/pic/skill/kb_1.png" },
    { type: "img", name: "kb_2", src: "./assets/pic/skill/kb_2.png" },
    { type: "img", name: "kb_3", src: "./assets/pic/skill/kb_3.png" },
    { type: "img", name: "kb_4", src: "./assets/pic/skill/kb_4.png" },
    { type: "img", name: "hpup_1", src: "./assets/pic/skill/hpup_1.png" },
    { type: "img", name: "hpup_2", src: "./assets/pic/skill/hpup_2.png" },
    { type: "img", name: "hpup_3", src: "./assets/pic/skill/hpup_3.png" },
    { type: "img", name: "defup_1", src: "./assets/pic/skill/defup_1.png" },
    { type: "img", name: "defup_2", src: "./assets/pic/skill/defup_2.png" },
    { type: "img", name: "defup_3", src: "./assets/pic/skill/defup_3.png" },
    { type: "img", name: "expup_1", src: "./assets/pic/skill/expup_1.png" },
    { type: "img", name: "expup_2", src: "./assets/pic/skill/expup_2.png" },
    { type: "img", name: "expup_3", src: "./assets/pic/skill/expup_3.png" },
    { type: "img", name: "negate_1", src: "./assets/pic/skill/negate_1.png" },
    { type: "img", name: "negate_2", src: "./assets/pic/skill/negate_2.png" },
    { type: "img", name: "negate_3", src: "./assets/pic/skill/negate_3.png" },
    { type: "img", name: "revive_1", src: "./assets/pic/skill/revive_1.png" },
    { type: "img", name: "revive_2", src: "./assets/pic/skill/revive_2.png" },
    { type: "img", name: "revive_3", src: "./assets/pic/skill/revive_3.png" },
    { type: "img", name: "item_1", src: "./assets/pic/skill/item_1.png" },
    { type: "img", name: "item_2", src: "./assets/pic/skill/item_2.png" },
    { type: "img", name: "item_3", src: "./assets/pic/skill/item_3.png" },
    { type: "img", name: "skillslot_1", src: "./assets/pic/skill/skillslot_1.png" },
    { type: "img", name: "stock_1", src: "./assets/pic/skill/stock_1.png" },
    // activeスキル画像
    { type: "img", name: "guard_1", src: "./assets/pic/skill/guard_1.png" },
    { type: "img", name: "guard_2", src: "./assets/pic/skill/guard_2.png" },
    { type: "img", name: "guard_3", src: "./assets/pic/skill/guard_3.png" },
    { type: "img", name: "freeze_1", src: "./assets/pic/skill/freeze_1.png" },
    { type: "img", name: "freeze_2", src: "./assets/pic/skill/freeze_2.png" },
    { type: "img", name: "freeze_3", src: "./assets/pic/skill/freeze_3.png" },
    { type: "img", name: "recover_1", src: "./assets/pic/skill/recover_1.png" },
    { type: "img", name: "recover_2", src: "./assets/pic/skill/recover_2.png" },
    { type: "img", name: "recover_3", src: "./assets/pic/skill/recover_3.png" },
    { type: "img", name: "kill_1", src: "./assets/pic/skill/kill_1.png" },
    { type: "img", name: "kill_near", src: "./assets/pic/skill/kill_near.png" },
    { type: "img", name: "kill_random", src: "./assets/pic/skill/kill_random.png" },
    { type: "img", name: "kill_all", src: "./assets/pic/skill/kill_all.png" },
    { type: "img", name: "knockback", src: "./assets/pic/skill/knockback.png" },

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
    // SE
    { type: "sound", name: "kill1", src: "./assets/sound/se/kill1.mp3", composer: "", title: "" },
    { type: "sound", name: "kill2", src: "./assets/sound/se/kill2.mp3", composer: "", title: "" },
    { type: "sound", name: "kill3", src: "./assets/sound/se/kill3.mp3", composer: "", title: "" },
    { type: "sound", name: "killLaser", src: "./assets/sound/se/killLaser.mp3", composer: "", title: "" },
    { type: "sound", name: "kill5", src: "./assets/sound/se/kill5.mp3", composer: "", title: "" },
    { type: "sound", name: "killBullet", src: "./assets/sound/se/killBullet.mp3", composer: "", title: "" },
    { type: "sound", name: "killItem", src: "./assets/sound/se/killItem.mp3", composer: "", title: "" },
    { type: "sound", name: "damage1", src: "./assets/sound/se/damage1.mp3", composer: "", title: "" },
    { type: "sound", name: "error1", src: "./assets/sound/se/error1.mp3", composer: "", title: "" },

    { type: "sound", name: "freeze", src: "./assets/sound/se/freeze.mp3", composer: "", title: "" },
    { type: "sound", name: "edgeknockback", src: "./assets/sound/se/edgeknockback.mp3", composer: "", title: "" },
    { type: "sound", name: "guard", src: "./assets/sound/se/guard.mp3", composer: "", title: "" },
    { type: "sound", name: "heal1", src: "./assets/sound/se/heal1.mp3", composer: "", title: "" },
    { type: "sound", name: "heal2", src: "./assets/sound/se/heal2.mp3", composer: "", title: "" },
    { type: "sound", name: "heal3", src: "./assets/sound/se/heal3.mp3", composer: "", title: "" },




    // BGM
    { type: "sound", name: "bgm1", src: "./assets/sound/bgm/bgm1.mp3", composer: "", title: "" },
    { type: "sound", name: "bgm2", src: "./assets/sound/bgm/bgm2.mp3", composer: "", title: "" },
    { type: "sound", name: "bgm3", src: "./assets/sound/bgm/bgm3.mp3", composer: "", title: "" },
    { type: "sound", name: "bgm_enemy1", src: "./assets/sound/bgm/bgm_enemy1.mp3", composer: "", title: "" },
    { type: "sound", name: "bgm_enemy2", src: "./assets/sound/bgm/bgm_enemy2.mp3", composer: "", title: "" },
    { type: "sound", name: "bgm_enemy3", src: "./assets/sound/bgm/bgm_enemy3.mp3", composer: "", title: "" },
    { type: "sound", name: "bgm_normal1", src: "./assets/sound/bgm/bgm_normal1.mp3", composer: "", title: "" },
    { type: "sound", name: "bgm_dream", src: "./assets/sound/bgm/dream.mp3", composer: "RYU ITO", title: "Dream" },
    { type: "sound", name: "bgm_cracker", src: "./assets/sound/bgm/cracker.mp3", composer: "RYU ITO", title: "Cracker" },
    { type: "sound", name: "bgm_yakanhikou", src: "./assets/sound/bgm/yakanhikou.mp3", composer: "もえるごみ", title: "夜間飛行" },
    { type: "sound", name: "bgm_harunosuisou", src: "./assets/sound/bgm/harunosuisou.mp3", composer: "もえるごみ", title: "はるの水槽" },
    { type: "sound", name: "bgm_boss1", src: "./assets/sound/bgm/edm_club_music.mp3", composer: "LudeSoundX", title: "EDM Club Music" },
    { type: "sound", name: "bgm_boss2", src: "./assets/sound/bgm/the_fight_left_in_us.mp3", composer: "Psychronic", title: "The Fight Left In Us" },
    { type: "sound", name: "bgm_aquarium", src: "./assets/sound/bgm/aquarium.mp3", composer: "もえるごみ", title: "Aquarium" },
    { type: "sound", name: "bgm_bpm150", src: "./assets/sound/bgm/bpm150.mp3", composer: "もえるごみ", title: "bmp150" },
    { type: "sound", name: "bgm_memories", src: "./assets/sound/bgm/sounds_of_memories.mp3", composer: "crusadope", title: "sound of memories" },
    { type: "sound", name: "bgm_gameover", src: "./assets/sound/bgm/gameover.mp3", composer: "もえるごみ", title: "GAME OVER" },
    { type: "sound", name: "bgm_yellow", src: "./assets/sound/bgm/yellow.mp3", composer: "もえるごみ", title: "yellow" },
    { type: "sound", name: "bgm_sept", src: "./assets/sound/bgm/sept.mp3", composer: "もえるごみ", title: "Sept." },
    { type: "sound", name: "bgm_rainy", src: "./assets/sound/bgm/rainy.mp3", composer: "もえるごみ", title: "rainy" },
    { type: "sound", name: "bgm_swim", src: "./assets/sound/bgm/swim.mp3", composer: "もえるごみ", title: "swim" },
    { type: "sound", name: "bgm_reika", src: "./assets/sound/bgm/reika.mp3", composer: "もえるごみ", title: "冷夏" },
    { type: "sound", name: "bgm_soranaka", src: "./assets/sound/bgm/soranaka.mp3", composer: "もえるごみ", title: "Soranaka" },
  ];

  let loaded = 0;
  const total = assets.length;

  onProgress?.(0, total);

  for (const a of assets) {

    console.log("loading:", a.name, a.src);

    if (a.type === "img") {
      await loadImage(a.name, a.src);
    } else if (a.type === "sound") {
      await loadSound(a);
    }

    loaded++;
    onProgress?.(loaded, total);
  }

console.log("asset loaded", assets.length);
  console.log("asset loaded", images);
console.log("title_menu", images.title_menu);
}