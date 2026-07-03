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
    { type: "sound", name: "kill1", src: "./assets/sound/se/kill1.mp3", composer: "", title: "", volume: 1.0 },
    { type: "sound", name: "kill2", src: "./assets/sound/se/kill2.mp3", composer: "", title: "", volume: 1.0 },
    { type: "sound", name: "kill3", src: "./assets/sound/se/kill3.mp3", composer: "", title: "", volume: 1.0 },
    { type: "sound", name: "killLaser", src: "./assets/sound/se/killLaser.mp3", composer: "", title: "", volume: 1.0 },
    { type: "sound", name: "kill5", src: "./assets/sound/se/kill5.mp3", composer: "", title: "", volume: 1.0 },
    { type: "sound", name: "killBullet", src: "./assets/sound/se/killBullet.mp3", composer: "", title: "", volume: 1.0 },
    { type: "sound", name: "killItem", src: "./assets/sound/se/killItem.mp3", composer: "", title: "", volume: 1.0 },
    { type: "sound", name: "damage1", src: "./assets/sound/se/damage1.mp3", composer: "", title: "", volume: 1.0 },
    { type: "sound", name: "error1", src: "./assets/sound/se/error1.mp3", composer: "", title: "", volume: 1.0 },

    { type: "sound", name: "freeze", src: "./assets/sound/se/freeze.mp3", composer: "", title: "", volume: 1.0 },
    { type: "sound", name: "edgeknockback", src: "./assets/sound/se/edgeknockback.mp3", composer: "", title: "", volume: 1.0 },
    { type: "sound", name: "guard", src: "./assets/sound/se/guard.mp3", composer: "", title: "", volume: 1.0 },
    { type: "sound", name: "heal1", src: "./assets/sound/se/heal1.mp3", composer: "", title: "", volume: 1.0 },
    { type: "sound", name: "heal2", src: "./assets/sound/se/heal2.mp3", composer: "", title: "", volume: 1.0 },
    { type: "sound", name: "heal3", src: "./assets/sound/se/heal3.mp3", composer: "", title: "", volume: 1.0 },

    { type: "sound", name: "combo_tier1", src: "./assets/sound/se/combo_tier1.mp3", composer: "", title: "", volume: 1.5 },
    { type: "sound", name: "combo_tier_max", src: "./assets/sound/se/combo_tier_max.mp3", composer: "", title: "", volume: 1.5 },
    { type: "sound", name: "chain_break", src: "./assets/sound/se/chain_break.mp3", composer: "", title: "", volume: 1.3 },



    // BGM
    { type: "sound", name: "bgm_rojiura", src: "./assets/sound/bgm/rojiura.mp3", composer: "もえるごみ", title: "rojiura", volume: 1.2 },
    { type: "sound", name: "bgm_flashback", src: "./assets/sound/bgm/flashback.mp3", composer: "RYU ITO", title: "Flashback", volume: 1.0 },
    { type: "sound", name: "bgm_yamiyo", src: "./assets/sound/bgm/yamiyonikakeru.mp3", composer: "watson", title: "闇夜に駆ける", volume: 1.0 },
    { type: "sound", name: "bgm_hosikuzu", src: "./assets/sound/bgm/hosikuzumitaininagareteku.mp3", composer: "watson", title: "星屑みたいに流れてく", volume: 1.0 },
    { type: "sound", name: "bgm_reflectable", src: "./assets/sound/bgm/reflectable.mp3", composer: "watson", title: "reflectable", volume: 1.0 },
    { type: "sound", name: "bgm_genesis", src: "./assets/sound/bgm/genesis_pulse.mp3", composer: "psychronic", title: "genesis pulse", volume: 1.0 },
    { type: "sound", name: "bgm_dance", src: "./assets/sound/bgm/dance_in_the_sun.mp3", composer: "tooone", title: "dance in the sun", volume: 1.0 },
    { type: "sound", name: "bgm_dream", src: "./assets/sound/bgm/dream.mp3", composer: "RYU ITO", title: "Dream", volume: 1.0 },
    { type: "sound", name: "bgm_cracker", src: "./assets/sound/bgm/cracker.mp3", composer: "RYU ITO", title: "Cracker", volume: 1.0 },
    { type: "sound", name: "bgm_yakanhikou", src: "./assets/sound/bgm/yakanhikou.mp3", composer: "もえるごみ", title: "夜間飛行", volume: 1.0 },
    { type: "sound", name: "bgm_harunosuisou", src: "./assets/sound/bgm/harunosuisou.mp3", composer: "もえるごみ", title: "はるの水槽", volume: 1.0 },
    { type: "sound", name: "bgm_boss1", src: "./assets/sound/bgm/edm_club_music.mp3", composer: "LudeSoundX", title: "EDM Club Music", volume: 1.0 },
    { type: "sound", name: "bgm_boss2", src: "./assets/sound/bgm/the_fight_left_in_us.mp3", composer: "Psychronic", title: "The Fight Left In Us", volume: 1.0 },
    { type: "sound", name: "bgm_aquarium", src: "./assets/sound/bgm/aquarium.mp3", composer: "もえるごみ", title: "Aquarium", volume: 1.0 },
    { type: "sound", name: "bgm_bpm150", src: "./assets/sound/bgm/bpm150.mp3", composer: "もえるごみ", title: "bmp150", volume: 1.0 },
    { type: "sound", name: "bgm_memories", src: "./assets/sound/bgm/sounds_of_memories.mp3", composer: "crusadope", title: "sound of memories", volume: 1.0 },
    { type: "sound", name: "bgm_gameover", src: "./assets/sound/bgm/gameover.mp3", composer: "もえるごみ", title: "GAME OVER", volume: 1.0 },
    { type: "sound", name: "bgm_yellow", src: "./assets/sound/bgm/yellow.mp3", composer: "もえるごみ", title: "yellow", volume: 1.0 },
    { type: "sound", name: "bgm_sept", src: "./assets/sound/bgm/sept.mp3", composer: "もえるごみ", title: "Sept.", volume: 1.0 },
    { type: "sound", name: "bgm_rainy", src: "./assets/sound/bgm/rainy.mp3", composer: "もえるごみ", title: "rainy", volume: 1.0 },
    { type: "sound", name: "bgm_swim", src: "./assets/sound/bgm/swim.mp3", composer: "もえるごみ", title: "swim", volume: 1.0 },
    { type: "sound", name: "bgm_reika", src: "./assets/sound/bgm/reika.mp3", composer: "もえるごみ", title: "冷夏", volume: 1.0 },
    { type: "sound", name: "bgm_soranaka", src: "./assets/sound/bgm/soranaka.mp3", composer: "もえるごみ", title: "Soranaka", volume: 1.0 },
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