import { initAudio, loadSound, registerSoundAssets } from "./effectManager.js";

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

// ======================================================================
// bgm imgを追加したら、かならずservice-worker.jsのキャッシュリストにも追加すること
// ======================================================================

const coreAssets = [
  // UI
  { type: "img", name: "title_menu", src: "./assets/pic/title_menu.png" },
  { type: "img", name: "quest_menu", src: "./assets/pic/quest_menu.png" },
  { type: "img", name: "sound1", src: "./assets/pic/sound1.png" },
  { type: "img", name: "soundmute", src: "./assets/pic/soundmute.png" },
  // SE
  { type: "sound", name: "select", src: "./assets/sound/se/select.mp3", composer: "", title: "", volume: 1.0 },
  { type: "sound", name: "questmenu", src: "./assets/sound/se/questmenu.mp3", composer: "", title: "", volume: 1.0 },
  // BGM
  { type: "sound", name: "bgm_rainy", src: "./assets/sound/bgm/rainy.mp3", composer: "もえるごみ", title: "rainy", volume: 1.0 },
];

const remainingAssets = [

  // 立ち絵
  { type: "img", name: "navi_normal", src: "./assets/pic/char/navi_normal.png" },
  { type: "img", name: "navi_smile", src: "./assets/pic/char/navi_smile.png" },
  { type: "img", name: "navi_sad", src: "./assets/pic/char/navi_sad.png" },
  { type: "img", name: "navi_angry", src: "./assets/pic/char/navi_angry.png" },
  { type: "img", name: "navi_surprised", src: "./assets/pic/char/navi_surprised.png" },
  { type: "img", name: "enemy_normal", src: "./assets/pic/char/enemy.png" },

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
  { type: "img", name: "cooldown_1", src: "./assets/pic/skill/cooldown_1.png" },
  { type: "img", name: "cooldown_2", src: "./assets/pic/skill/cooldown_2.png" },
  { type: "img", name: "cooldown_3", src: "./assets/pic/skill/cooldown_3.png" },
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

  // クエストバトル背景
  { type: "img", name: "battle_blue", src: "./assets/pic/battle_field_blue.png" },
  { type: "img", name: "battle_purple", src: "./assets/pic/battle_field_purple.png" },
  { type: "img", name: "battle_red", src: "./assets/pic/battle_field_red.png" },
  { type: "img", name: "battle_green", src: "./assets/pic/battle_field_green.png" },
  { type: "img", name: "battle_gray", src: "./assets/pic/battle_field_gray.png" },

  // クエストマップ背景
  { type: "img", name: "map_blue", src: "./assets/pic/map_field_blue.png" },
  { type: "img", name: "map_purple", src: "./assets/pic/map_field_purple.png" },
  { type: "img", name: "map_red", src: "./assets/pic/map_field_red.png" },
  { type: "img", name: "map_gray", src: "./assets/pic/map_field_gray.png" },
  { type: "img", name: "map_ex", src: "./assets/pic/map_field_ex.png" },

  // 音源
  // SE
  { type: "sound", name: "mapmove", src: "./assets/sound/se/mapmove.mp3", composer: "", title: "", volume: 1.0 },
  { type: "sound", name: "kill1", src: "./assets/sound/se/kill1.mp3", composer: "", title: "", volume: 0.8 },
  { type: "sound", name: "kill2", src: "./assets/sound/se/kill2.mp3", composer: "", title: "", volume: 0.8 },
  { type: "sound", name: "kill3", src: "./assets/sound/se/kill3.mp3", composer: "", title: "", volume: 0.8 },
  { type: "sound", name: "killLaser", src: "./assets/sound/se/killLaser.mp3", composer: "", title: "", volume: 0.8 },
  { type: "sound", name: "kill5", src: "./assets/sound/se/kill5.mp3", composer: "", title: "", volume: 0.8 },
  { type: "sound", name: "killBullet", src: "./assets/sound/se/killBullet.mp3", composer: "", title: "", volume: 0.8 },
  { type: "sound", name: "killItem", src: "./assets/sound/se/killItem.mp3", composer: "", title: "", volume: 0.8 },
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

  { type: "sound", name: "trophy", src: "./assets/sound/se/trophy.mp3", composer: "", title: "", volume: 1.0 },
  { type: "sound", name: "skill_on", src: "./assets/sound/se/skillon.mp3", composer: "", title: "", volume: 1.0 },
  { type: "sound", name: "skill_off", src: "./assets/sound/se/skilloff.mp3", composer: "", title: "", volume: 1.0 },

  { type: "sound", name: "bitspawn", src: "./assets/sound/se/bitspawn.mp3", composer: "", title: "", volume: 1.0 },

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
  { type: "sound", name: "bgm_dive", src: "./assets/sound/bgm/dive.mp3", composer: "RYU ITO", title: "Dive", volume: 1.0 },
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
  { type: "sound", name: "bgm_swim", src: "./assets/sound/bgm/swim.mp3", composer: "もえるごみ", title: "swim", volume: 1.0 },
  { type: "sound", name: "bgm_reika", src: "./assets/sound/bgm/reika.mp3", composer: "もえるごみ", title: "冷夏", volume: 1.0 },
  { type: "sound", name: "bgm_universe", src: "./assets/sound/bgm/universe.mp3", composer: "もえるごみ", title: "Universe", volume: 1.0 },
  { type: "sound", name: "bgm_soranaka", src: "./assets/sound/bgm/soranaka.mp3", composer: "もえるごみ", title: "Soranaka", volume: 1.0 },
  { type: "sound", name: "bgm_float", src: "./assets/sound/bgm/floating_city.mp3", composer: "MFP", title: "Floating City", volume: 1.0 },
  { type: "sound", name: "bgm_aftersummer", src: "./assets/sound/bgm/after_the_summer_fades.mp3", composer: "MFP", title: "After the Summer Fades", volume: 1.0 },
  { type: "sound", name: "bgm_ikuseisou", src: "./assets/sound/bgm/ikuseisou.mp3", composer: "もえるごみ", title: "幾星霜", volume: 1.0 }, //quest ex normal
  { type: "sound", name: "bgm_free", src: "./assets/sound/bgm/free.mp3", composer: "もえるごみ", title: "Free!Free!", volume: 1.0 }, //quest ex defense
  { type: "sound", name: "bgm_1minute", src: "./assets/sound/bgm/1minute.mp3", composer: "もえるごみ", title: "1minute", volume: 1.0 }, //quest ex midboss
  { type: "sound", name: "bgm_yukkuriisoge", src: "./assets/sound/bgm/yukkuriisoge.mp3", composer: "watson", title: "ゆっくり急げ！", volume: 1.0 }, //quest ex boss
  { type: "sound", name: "bgm_vampire", src: "./assets/sound/bgm/vampire.mp3", composer: "なぐもりず", title: "Vampire-Twins", volume: 1.0 }, //quest ex exboss
  { type: "sound", name: "bgm_broccoli", src: "./assets/sound/bgm/broccoli.mp3", composer: "なぐもりず", title: "Broccoli", volume: 1.0 }, //クエストマップ
  { type: "sound", name: "bgm_mercury", src: "./assets/sound/bgm/mercury.mp3", composer: "Flehmann", title: "Mercury", volume: 1.0 }, //会話
  { type: "sound", name: "bgm_otiru", src: "./assets/sound/bgm/otiru.mp3", composer: "もっぴーさうんど", title: "堕ちる", volume: 1.0 }, //エピローグ
];

async function _loadAssetList(assetList, onProgress) {
  let loaded = 0;
  const total = assetList.length;

  const promises = assetList.map(async (a) => {
    if (a.type === "img") {
      await loadImage(a.name, a.src);
    } else if (a.type === "sound") {
      await loadSound(a);
    }
    loaded++;
    onProgress?.(loaded, total);
  });

  await Promise.all(promises);
}

// ======================================================================
// ★v1.0.42: 音源は起動時に一括デコードせず、「鳴らす直前に読み込む」。
//   そのため effectManager 側へ「name → src」の対応表を渡しておく。
//   （SE/BGM の初回再生時に ensureSound() がこの表を使って取得する）
// ======================================================================
registerSoundAssets([...coreAssets, ...remainingAssets]);

async function loadCoreAssets(onProgress) {
  // 音声の初期化（ブラウザポリシー対応）
  await initAudio();
  await _loadAssetList(coreAssets, onProgress);
}

// ======================================================================
// 残りアセットのバックグラウンド読み込み（低スペックPC対策）
// ----------------------------------------------------------------------
//  - フォントは FONT_CONCURRENCY 件、画像は IMAGE_CONCURRENCY 件、
//    音声は SOUND_CONCURRENCY 件ずつしか同時に読み込まない
//    （BGMのfetch+デコードが一斉に走るのを防ぐ）
//  - フォントを最優先（タイピング表示の遅延防止）。
//  - 音声キューは「デイリー各モードの先頭曲 → SE → その他BGM」の順。
//    デイリー曲は最初から読み込むので、ゲーム開始時のBGM待ちを減らす。
//  - 全アセット数に対する進捗を onProgress(loaded, total) で通知する。
// ======================================================================

const IMAGE_CONCURRENCY = 4; // 画像の同時読み込み数
// ★v1.0.42: 音源はモード開始時に effectManager.ensureSound() が
//   1件ずつ読み込むようになったため、起動時の同時読み込み数は未使用。

// ---------------------------------------------------------------------
// フォント（丸ゴ・Inter）サブセットの一括プリフェッチ
// ---------------------------------------------------------------------
//  self-host フォントは unicode-range サブセット（woff2 約200ファイル）に
//  分かれており、各サブセットは「その文字を初めて表示した瞬間」に
//  ネットワークから遅延取得される（font-display: swap）。
//  → 漢字を含む問題（スタンダード / タイムアタック / 長文 / 防衛）では
//    問題が変わるたびに新サブセットの取得待ちが発生し、タイピング表示が
//    「フォールバック描画 → 差し替え」で遅れる。
//    （SW はオンライン中は介入しないため、ページ側で HTTP キャッシュに
//      事前に載せておく必要がある）
//  → 起動後の裏読み込みで全サブセットを事前取得してタイピング中の
//    フォント取得待ちをなくす。フォントは軽いため画像より先に読む。
// ---------------------------------------------------------------------
const FONT_CSS_URL = "./assets/fonts/fonts.css";
const FONT_CONCURRENCY = 6; // フォントは軽いので多少並列でOK
const FONT_GAP_MS = 4;      // 1件完了ごとの呼吸用インターバル

/**
 * fonts.css から woff2 サブセットの URL 一覧を抽出する。
 * 相対パスは fonts.css の場所（/assets/fonts/）基準で解決する。
 * 失敗時は [] を返しゲーム起動には影響させない。
 */
async function collectFontUrls() {
  try {
    const cssUrl = new URL(FONT_CSS_URL, location.href);
    const res = await fetch(cssUrl.href);
    if (!res || !res.ok) return [];
    const css = await res.text();
    const urls = [];
    const re = /url\((['"]?)([^'")]+\.woff2)\1\)/g;
    let m;
    while ((m = re.exec(css)) !== null) {
      try {
        urls.push(new URL(m[2], cssUrl).href);
      } catch (e) { /* 不正URLは無視 */ }
    }
    return [...new Set(urls)];
  } catch (e) {
    console.warn("[fonts] フォント一覧の取得に失敗（プリフェッチをスキップ）:", e);
    return [];
  }
}

/** フォントファイルを1件取得して HTTP キャッシュに載せる（表示には使わない） */
async function prefetchFont(url) {
  const res = await fetch(url);
  if (res && res.ok) {
    // ボディを消費してキャッシュへの載りを確実にする
    await res.arrayBuffer();
  } else {
    console.warn(`[fonts] フォント取得失敗(${res ? res.status : "no response"}): ${url}`);
  }
}

// デイリー各モードの先頭曲
//   スタンダード = bgm_rainy（コアアセットで既読）
//   タイムアタック = bgm_gameover / 長文 = bgm_yakanhikou
//   防衛 = bgm_dive / エネミー = bgm_swim
// ★v1.0.42: 音源は起動時に読み込まなくなったため、この定数は未使用。
//   （各モード開始時に effectManager.ensureSound() が読み込む）

/**
 * 1件読み込み。音声は「yield付き」で読み込む。
 * 低スペックPC（特にWindows）では AudioContext.decodeAudioData と
 * メインスレッドの描画がCPUを奪い合ってカクつくため、音声の前後に
 * マイクロタスクを挟んで描画に譲る（同時進行は assetsLoader 側の並列数で制御）。
 * @param {{type:string,name:string,src:string}} a
 */
async function _loadOneAsset(a) {
  if (a.type === "font") {
    // フォントサブセット: HTTPキャッシュに載せることが目的（表示には使わない）
    await prefetchFont(a.src);
    return;
  }
  if (a.type === "img") {
    await loadImage(a.name, a.src);
    return;
  }
  if (a.type === "sound") {
    // デコード前に1フレーム譲る（直前の完了処理・描画を先に流す）
    await _yieldToMain();
    try {
      await loadSound(a);
    } finally {
      // デコード直後も1フレーム譲る（次のデコード開始前に描画を通す）
      await _yieldToMain();
    }
  }
}

/** メインスレッドを1フレーム（rAF）譲る。rAF不可環境では setTimeout に退避 */
function _yieldToMain() {
  return new Promise(resolve => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
}

/**
 * キュー方式で最大 maxConcurrent 件ずつ処理する汎用ローダー。
 * @param {Array} queue - アセット定義の配列
 * @param {number} maxConcurrent - 同時実行数
 * @param {number} gapMs - 1件完了ごとに空ける間隔（ms）。メインスレッドの呼吸用
 * @param {Function} [onOneLoaded] - 1件完了ごとに呼ばれる
 */
async function _runQueueWithLimit(queue, maxConcurrent, gapMs, onOneLoaded) {
  if (typeof gapMs === "function") {
    onOneLoaded = gapMs;
    gapMs = 0;
  }
  let index = 0;
  const workerCount = Math.max(1, Math.min(maxConcurrent, queue.length));
  const gap = Math.max(0, Number(gapMs) || 0);
  const workers = [];
  for (let w = 0; w < workerCount; w++) {
    workers.push((async () => {
      while (true) {
        // ゲームプレイ中（エネミー・防衛・通常ゲーム実行中）は
        // 描画・操作を最優先するため、裏読み込みを一時待機する
        while (typeof window.isGameplayActive === "function" && window.isGameplayActive()) {
          await new Promise(r => setTimeout(r, 200));
        }

        const idx = index++;
        if (idx >= queue.length) break;
        const a = queue[idx];
        try {
          await _loadOneAsset(a);
        } catch (e) {
          console.error(`[ASSET LOAD ERROR] name=${a.name} src=${a.src}`, e);
        }
        onOneLoaded?.(a);
        // 1件完了ごとに少し間を空けてメインスレッドを呼吸させる
        if (gap > 0) {
          await new Promise(r => setTimeout(r, gap));
        }
      }
    })());
  }
  await Promise.all(workers);
}

/**
 * 残りアセット（画像・フォント）をバックグラウンドで読み込む。
 * @param {Function} [onProgress] - (loaded, total) の進捗通知
 *
 * ★v1.0.42: 音源（BGM/SE）はここから外した。
 *   起動時に全BGM/SEをfetch+decodeすると負荷が大きいため、
 *   「実際に鳴らす直前」＝モード開始時に effectManager.ensureSound() が
 *   1件ずつ読み込む方式へ変更した。
 *   ※画像とフォントは従来どおり起動後に自動で読み込む。
 *     フォント（約413件）を最優先するのは、タイピング表示の遅延防止のため。
 */
async function loadRemainingAssets(onProgress) {
  // 種類ごとに分割（優先順位: フォント → 画像）
  const fontUrls = await collectFontUrls();
  const fontQueue = fontUrls.map(url => ({ type: "font", name: "font", src: url }));
  const imageQueue = remainingAssets.filter(a => a.type === "img");

  const total = fontQueue.length + imageQueue.length;
  let loaded = 0;
  const report = () => {
    loaded++;
    try { onProgress?.(loaded, total); } catch (e) { /* 無視 */ }
  };

  // オフライン環境では Service Worker の大量 IPC / キャッシュ照会がメインスレッドを
  // 圧迫しないよう、フォントの並列数を抑えて間隔を広げる
  const isOffline = typeof navigator !== "undefined" && navigator.onLine === false;
  const effectiveFontConcurrency = isOffline ? 2 : FONT_CONCURRENCY;
  const effectiveFontGap = isOffline ? 12 : FONT_GAP_MS;

  // フォント・画像はそれぞれ別の並列数で同時に進める
  // → フォント（タイピング表示に直結）を最優先で進めつつ、
  //   メニュー用画像も最初から読み込まれる
  // ※ 裏読み込み中に重くならないよう、件数ごとに少し間を空ける
  const fontPromise = _runQueueWithLimit(fontQueue, effectiveFontConcurrency, effectiveFontGap, report);
  const imagePromise = _runQueueWithLimit(imageQueue, IMAGE_CONCURRENCY, 8, report);
  await Promise.all([fontPromise, imagePromise]);

  try { onProgress?.(total, total); } catch (e) { /* 無視 */ }
  console.log("All remaining assets loaded in background.");
}

// ======================================================================
// ★v1.0.42: オフライン用データ（手動ダウンロード）の対象URL一覧
// ----------------------------------------------------------------------
//  設定の「最新版をオフライン用にダウンロード」で Cache Storage へ
//  書き込む画像・音声・フォントのURLを列挙する。
//  （アプリ本体の html/css/js は main.js 側の一覧を使う）
// ======================================================================
async function collectOfflineAssetUrls() {
  const urls = [];
  const push = (src) => {
    if (!src) return;
    try { urls.push(new URL(src, location.href).href); } catch (e) { /* 不正URLは無視 */ }
  };

  for (const a of [...coreAssets, ...remainingAssets]) {
    if (a.type !== "img" && a.type !== "sound") continue;
    push(a.src);
  }

  // フォント（fonts.css が参照する woff2 サブセット）
  push(FONT_CSS_URL);
  for (const url of await collectFontUrls()) {
    urls.push(url);
  }

  return [...new Set(urls)];
}

export { loadCoreAssets, loadRemainingAssets, collectFontUrls, collectOfflineAssetUrls };