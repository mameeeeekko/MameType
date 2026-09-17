// =====================================================
// MameType Service Worker
// =====================================================

// -----------------------------------------------------
// キャッシュバージョン
// version.js の APP_VERSION と合わせる
// -----------------------------------------------------
const CACHE_NAME = "mametype-v1.0.44";

// =====================================================
// オフライン用キャッシュ（固定名）
// -----------------------------------------------------
//  ★v1.0.42: オフライン用データのダウンロードは「設定ボタンからの
//   手動実行」だけにする。Service Worker 側で install / activate 後に
//   自動取得しない（勝手な大量取得・思わぬ通信を避けるため）。
//  ・mametype-app:    アプリ本体（html / css / js / icon）
//  ・mametype-assets: 画像・音声・フォント
//  ・ページ側（js/main.js の downloadOfflineData）が直接書き込む。
//    SW の fetch はオフライン時に caches.match() で全キャッシュを
//    検索するため、ここへ入れた内容がそのままオフライン起動に使われる。
//  ・activate で固定名キャッシュは削除しない（版が上がっても
//    手動DL済みデータが消えないようにする）。
// =====================================================
const OFFLINE_APP_CACHE = "mametype-app";
const OFFLINE_ASSET_CACHE = "mametype-assets";

// =====================================================
// オフライン対象アセット一覧
// -----------------------------------------------------
//  ★v1.0.42: この一覧は「手動ダウンロード用のURLリスト」として使う。
//   ページ側から GET_OFFLINE_MANIFEST を受けたら、同一オリジンの
//   URLだけを OFFLINE_MANIFEST として返信する。
//   クロスオリジン（esm.sh 等）は Cache Storage へ入れられないため
//   対象外にする。
// =====================================================

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./assets/fonts/fonts.css",

  // ---------------------------------------------------
  // メニュー画像 / サウンドアイコン
  // ---------------------------------------------------

  "./assets/pic/title_menu.png",
  "./assets/pic/quest_menu.png",
  "./assets/pic/sound1.png",
  "./assets/pic/soundmute.png",

  // ---------------------------------------------------
  // コアJS
  // ---------------------------------------------------

  "./js/main.js",
  "./js/saveDataNotice.js",
  "./js/fullscreenUtil.js",
  "./js/stageScale.js",
  "./js/gameCore.js",
  "./js/enemyCore.js",
  "./js/defenseCore.js",
  "./js/inputCore.js",
  "./js/renderer.js",
  "./js/assetsLoader.js",
  "./js/dialogue.js",
  "./js/dialogue.css",
  "./js/dialogueData.js",
  "./js/hud.js",
  "./js/playerStats.js",
  "./js/storage.js",
  "./js/gameModes.js",
  "./js/difficulties.js",
  "./js/target.js",
  "./js/romaUtils.js",
  "./js/typingLogic.js",
  "./js/version.js",
  "./js/analytics.js",

  // ---------------------------------------------------
  // クエスト / スキルツリー関連JS
  // ---------------------------------------------------

  "./js/canvasUtil.js",
  "./js/performance.js",
  "./js/keybinds.js",
  "./js/questMap.js",
  "./js/questMapUI.js",
  "./js/questProgress.js",
  "./js/questPlayerStats.js",
  "./js/questResult.js",
  "./js/questSkills.js",
  "./js/skillTree.js",
  "./js/skillTreeUI.js",
  "./js/skillTreeResult.js",

  // ---------------------------------------------------
  // 敵 / 描画 / エフェクト関連JS
  // ---------------------------------------------------

  "./js/enemy.js",
  "./js/enemySpawner.js",
  "./js/enemyRenderer.js",
  "./js/enemyResult.js",
  "./js/enemyModeConfig.js",
  "./js/effectManager.js",
  "./js/defenseRenderer.js",
  "./js/defenseResult.js",
  "./js/shapeDefinitions.js",
  "./js/starEvaluator.js",
  "./js/recordsView.js",
  "./js/resultView.js",

  // ---------------------------------------------------
  // オンライン機能（オフライン起動時もモジュールとして
  // 読み込まれるため、JSファイル自体はキャッシュ必須）
  // ---------------------------------------------------

  "./online/supabase.js",
  "./online/playerProfile.js",
  "./online/submitScore.js",
  "./online/getRanking.js",
  "./online/onlineRankingRenderer.js",

  // ---------------------------------------------------
  // 開発ツール（main.jsから読み込まれている）
  // ---------------------------------------------------

  "./dev/devOverride.js",
  "./dev/devTools.js",

  // ---------------------------------------------------
  // ★v1.0.42: クロスオリジンは Cache Storage へ入れられないため
  //   対象外にした（手動DL側でもフィルタする）。
  // ---------------------------------------------------
];

// =====================================================
// 動的アセット
// =====================================================

const DYNAMIC_ASSETS = [

  // ---------------------------------------------------
  // 立ち絵 / キャラ portraits
  // assetsLoader.js（remainingAssets）で参照されている。
  // 背景読み込みだけではなく、SWの事前キャッシュ対象にする。
  // これがないと「オフラインでも遊べるようになりました」
  // 表示直後をオフラインにすると立ち絵が欠落する。
  // ---------------------------------------------------

  "./assets/pic/char/navi_normal.png",
  "./assets/pic/char/navi_smile.png",
  "./assets/pic/char/navi_sad.png",
  "./assets/pic/char/navi_angry.png",
  "./assets/pic/char/navi_surprised.png",
  "./assets/pic/char/enemy.png",

  // ---------------------------------------------------
  // passiveスキル画像
  // ---------------------------------------------------

  "./assets/pic/skill/chain_up_1.png",
  "./assets/pic/skill/chain_up_2.png",
  "./assets/pic/skill/chain_up_3.png",
  "./assets/pic/skill/chain_up_4.png",

  "./assets/pic/skill/chain_bonus_1.png",
  "./assets/pic/skill/chain_bonus_2.png",
  "./assets/pic/skill/chain_bonus_3.png",
  "./assets/pic/skill/chain_bonus_4.png",

  "./assets/pic/skill/chain_decay_1.png",
  "./assets/pic/skill/chain_decay_2.png",
  "./assets/pic/skill/chain_decay_3.png",
  "./assets/pic/skill/chain_decay_4.png",

  "./assets/pic/skill/glass_1.png",
  "./assets/pic/skill/glass_2.png",
  "./assets/pic/skill/glass_3.png",
  "./assets/pic/skill/glass_4.png",

  "./assets/pic/skill/kb_1.png",
  "./assets/pic/skill/kb_2.png",
  "./assets/pic/skill/kb_3.png",
  "./assets/pic/skill/kb_4.png",

  "./assets/pic/skill/hpup_1.png",
  "./assets/pic/skill/hpup_2.png",
  "./assets/pic/skill/hpup_3.png",

  "./assets/pic/skill/defup_1.png",
  "./assets/pic/skill/defup_2.png",
  "./assets/pic/skill/defup_3.png",

  "./assets/pic/skill/expup_1.png",
  "./assets/pic/skill/expup_2.png",
  "./assets/pic/skill/expup_3.png",

  "./assets/pic/skill/negate_1.png",
  "./assets/pic/skill/negate_2.png",
  "./assets/pic/skill/negate_3.png",

  "./assets/pic/skill/revive_1.png",
  "./assets/pic/skill/revive_2.png",
  "./assets/pic/skill/revive_3.png",

  "./assets/pic/skill/item_1.png",
  "./assets/pic/skill/item_2.png",
  "./assets/pic/skill/item_3.png",

  "./assets/pic/skill/skillslot_1.png",
  "./assets/pic/skill/stock_1.png",

  // ---------------------------------------------------
  // activeスキル画像
  // ---------------------------------------------------

  "./assets/pic/skill/guard_1.png",
  "./assets/pic/skill/guard_2.png",
  "./assets/pic/skill/guard_3.png",

  "./assets/pic/skill/freeze_1.png",
  "./assets/pic/skill/freeze_2.png",
  "./assets/pic/skill/freeze_3.png",

  "./assets/pic/skill/recover_1.png",
  "./assets/pic/skill/recover_2.png",
  "./assets/pic/skill/recover_3.png",

  "./assets/pic/skill/kill_1.png",
  "./assets/pic/skill/kill_near.png",
  "./assets/pic/skill/kill_random.png",
  "./assets/pic/skill/kill_all.png",
  "./assets/pic/skill/knockback.png",

  // ---------------------------------------------------
  // 背景画像
  // ---------------------------------------------------

  "./assets/pic/battle_field_green.png",
  "./assets/pic/battle_field_gray.png",
  "./assets/pic/battle_field_blue.png",
  "./assets/pic/battle_field_red.png",
  "./assets/pic/battle_field_purple.png",

  "./assets/pic/map_field_blue.png",
  "./assets/pic/map_field_purple.png",
  "./assets/pic/map_field_red.png",
  "./assets/pic/map_field_gray.png",
  "./assets/pic/map_field_ex.png" ,

  // ---------------------------------------------------
  // SE
  // ---------------------------------------------------

  "./assets/sound/se/select.mp3",

  "./assets/sound/se/questmenu.mp3",
  "./assets/sound/se/mapmove.mp3",
  "./assets/sound/se/kill1.mp3",
  "./assets/sound/se/kill2.mp3",
  "./assets/sound/se/kill3.mp3",
  "./assets/sound/se/killLaser.mp3",
  "./assets/sound/se/kill5.mp3",
  "./assets/sound/se/killBullet.mp3",
  "./assets/sound/se/killItem.mp3",
  "./assets/sound/se/damage1.mp3",
  "./assets/sound/se/error1.mp3",
  "./assets/sound/se/freeze.mp3",
  "./assets/sound/se/edgeknockback.mp3",
  "./assets/sound/se/guard.mp3",
  "./assets/sound/se/heal1.mp3",
  "./assets/sound/se/heal2.mp3",
  "./assets/sound/se/heal3.mp3",
  "./assets/sound/se/combo_tier1.mp3",
  "./assets/sound/se/combo_tier_max.mp3",
  "./assets/sound/se/chain_break.mp3",
  "./assets/sound/se/trophy.mp3",
  "./assets/sound/se/skillon.mp3",
  "./assets/sound/se/skilloff.mp3",
  "./assets/sound/se/bitspawn.mp3",

  // ---------------------------------------------------
  // BGM
  // ---------------------------------------------------
  
  "./assets/sound/bgm/rojiura.mp3",
  "./assets/sound/bgm/flashback.mp3",
  "./assets/sound/bgm/yamiyonikakeru.mp3",
  "./assets/sound/bgm/hosikuzumitaininagareteku.mp3",
  "./assets/sound/bgm/reflectable.mp3",
  "./assets/sound/bgm/genesis_pulse.mp3",
  "./assets/sound/bgm/dance_in_the_sun.mp3",
  "./assets/sound/bgm/dream.mp3",
  "./assets/sound/bgm/cracker.mp3",
  "./assets/sound/bgm/yakanhikou.mp3",
  "./assets/sound/bgm/harunosuisou.mp3",
  "./assets/sound/bgm/edm_club_music.mp3",
  "./assets/sound/bgm/the_fight_left_in_us.mp3",
  "./assets/sound/bgm/aquarium.mp3",
  "./assets/sound/bgm/bpm150.mp3",
  "./assets/sound/bgm/mercury.mp3",//map
  "./assets/sound/bgm/sounds_of_memories.mp3",
  "./assets/sound/bgm/gameover.mp3",
  "./assets/sound/bgm/yellow.mp3",
  "./assets/sound/bgm/sept.mp3",
  "./assets/sound/bgm/rainy.mp3",
  "./assets/sound/bgm/swim.mp3",
  "./assets/sound/bgm/reika.mp3",
  "./assets/sound/bgm/universe.mp3",
  "./assets/sound/bgm/soranaka.mp3",
  "./assets/sound/bgm/floating_city.mp3",
  "./assets/sound/bgm/after_the_summer_fades.mp3",
  "./assets/sound/bgm/ikuseisou.mp3", 
  "./assets/sound/bgm/free.mp3",
  "./assets/sound/bgm/1minute.mp3",
  "./assets/sound/bgm/yukkuriisoge.mp3",
  "./assets/sound/bgm/vampire.mp3",
  "./assets/sound/bgm/broccoli.mp3",
  "./assets/sound/bgm/otiru.mp3"
];

// =====================================================
// 重複除去
// =====================================================

const ALL_ASSETS_TO_CACHE = [
  ...new Set([
    ...CORE_ASSETS,
    ...DYNAMIC_ASSETS
  ])
];

// =====================================================
// ★v1.0.42: オフラインデータの取得は「ページ側主導（手動）」。
//   ALL_ASSETS_TO_CACHE は GET_OFFLINE_MANIFEST 応答用の
//   フォールバック一覧。ページ側は main.js / assetsLoader.js
//   で独自にURL一覧を構築し、この一覧は補助的に使う。
// ====================================================

// =====================================================
// クライアントへ進捗を送信
// =====================================================

async function notifyClients(message) {
  const clients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true
  });

  clients.forEach(client => {
    try {
      client.postMessage(message);
    } catch (e) {
      // クライアントが閉じられた・メッセージング不能でも
      // インストールの進捗通知を止めない
    }
  });
}

// =====================================================
// インストール
// =====================================================

self.addEventListener("install", event => {

  // ★v1.0.42: install 時のブートキャッシュを廃止。
  //   オフライン環境で install がタイムアウト・失敗し
  //   「ハードリフレッシュでしか起動できない」問題の根本修正。
  //   オフライン用データはユーザーが明示的に
  //   「最新版をオフライン用にダウンロード」を押したときに
  //   ページ側（js/main.js の downloadOfflineData）が
  //   Cache Storage へ直接書き込む。

  console.log(
    "Service Worker: Install (no boot cache)",
    CACHE_NAME
  );

  // skipWaiting はしない（ユーザーが「更新を適用して再起動」を
  // 押すまで既存のSWを制御し続ける）。

});

// =====================================================
// Activate
// =====================================================

self.addEventListener("activate", event => {

  console.log(
    "Service Worker: Activate",
    CACHE_NAME
  );

  event.waitUntil(
    (async () => {

      // ---------------------------------------------
      // 旧バージョンのキャッシュを削除
      // ---------------------------------------------
      try {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames
            // ★v1.0.42: 旧バージョンの mametype-v* キャッシュのみ削除。
            //   固定名の mametype-app / mametype-assets は
            //   手動DL済みデータが消えないように保持する。
            .filter(name =>
              name !== CACHE_NAME &&
              name !== OFFLINE_APP_CACHE &&
              name !== OFFLINE_ASSET_CACHE
            )
            .map(name => {
              console.log(
                "Service Worker: Deleting old cache:",
                name
              );
              return caches.delete(name);
            })
        );
      } catch (e) {
        console.error("Service Worker: old cache cleanup failed:", e);
      }

      // ---------------------------------------------
      // クライアントの制御権を取得
      // ---------------------------------------------
      try {
        await self.clients.claim();
      } catch (e) {
        /* 無視 */
      }

      // ---------------------------------------------
      // ★v1.0.23: activate 完了（controlling 取得）後、
      //   ページに対して「更新適用完了→再起動可能」を明示通知する。
      // ---------------------------------------------
      try {
        const clients = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true
        });
        for (const client of clients) {
          client.postMessage({
            type: "UPDATE_CONTROLLING"
          });
        }
      } catch (e) {
        /* 通知失敗は無視 */
      }

      // ★v1.0.40: オフラインキャッシュの自動ダウンロードを廃止
      // ユーザーが設定から明示的に「最新版をオフライン用にダウンロード」を
      // 押した場合にのみダウンロードを開始する（完全手動開始に変更）
      // await preCacheRemainingInBackground();

    })()
  );
});


// =====================================================
// Fetch
// =====================================================

self.addEventListener("fetch", event => {

  // GET以外はそのまま
  if (event.request.method !== "GET") {
    return;
  }

  // 同一オリジン以外は介入しない
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  // ------------------------------------------------------
  // オンライン中は一切介入しない（navigator.onLine が
  // 未定義な環境では「オンライン扱い」にして介入しない）
  if (navigator.onLine !== false) {
    return;
  }

  // ------------------------------------------------------
  // オフライン時のみキャッシュから配信する
  // ------------------------------------------------------
  event.respondWith(
    caches.match(event.request, { ignoreVary: true })
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return new Response("MameType is offline", {
          status: 503,
          statusText: "Service Unavailable",
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-store",
          },
        });
      })
  );

});

// =====================================================
// Message
// =====================================================

self.addEventListener("message", async event => {

  // ---------------------------------------------------------------
  // ★v1.0.42: GAME_ACTIVE（ゲーム中フラグ）は廃止。
  //   裏ダウンロード（preCacheRemainingInBackground）が無くなったため、
  //   ページからの GAME_ACTIVE メッセージは単純に無視される。
  // ---------------------------------------------------------------

  if (
    event.data &&
    event.data.type === "SKIP_WAITING"
  ) {

    console.log(
      "Service Worker: SKIP_WAITING received"
    );

    self.skipWaiting();

    // ★v1.0.23: 「今すぐ更新」後にページ側が止まったままになるケースがあったため、
    //   更新適用開始（activating 遷移）をページへ明示通知する。
    try {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true
      });
      for (const client of clients) {
        client.postMessage({
          type: "UPDATE_ACTIVATING"
        });
      }
    } catch (e) {
      /* ページへの通知失敗は無視 */
    }

  }

  // =====================================================
  // ★v1.0.42: ページから「オフライン用データをダウンロード」
  //   押されたときの問い合わせ。手動DLはページ側で実行するため、
  //   ここでは「キャッシュすべきURLの一覧」だけを返信する。
  // =====================================================
  if (
    event.data &&
    event.data.type === "GET_OFFLINE_MANIFEST"
  ) {

    // ページ側からの問い合わせ。手動DLはページ側で実行するため、
    // ここでは「キャッシュすべきURLの一覧」だけを返信する。
    // （同期応答なので waitUntil は不要。notifyClients は全クライアントへ）
    (async () => {
      try {
        // 同じオリジンのURLのみを返す（クロスオリジンは
        // Cache Storage へ入れられないため対象外）
        const urls = ALL_ASSETS_TO_CACHE.filter(u => {
          try { return new URL(u, self.location.href).origin === self.location.origin; }
          catch (e) { return false; }
        }).map(u => new URL(u, self.location.href).href);

        notifyClients({
          type: "OFFLINE_MANIFEST",
          appCache: OFFLINE_APP_CACHE,
          assetCache: OFFLINE_ASSET_CACHE,
          urls
        });
      } catch (e) { /* 無視 */ }
    })();

  }

});