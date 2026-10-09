// =====================================================
// MameType Service Worker
// =====================================================

// -----------------------------------------------------
// キャッシュバージョン
// version.js の APP_VERSION と合わせる
// -----------------------------------------------------
const CACHE_NAME = "mametype-v1.0.85";

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
  "./js/saveFile.js",
  "./js/gameModes.js",
  "./js/difficulties.js",
  "./js/target.js",
  "./js/romaUtils.js",
  "./js/typingLogic.js",
  "./js/version.js",
  "./js/analytics.js",
  // ★EXTRA CLEAR 特典：ミュージックプレイヤー
  "./js/musicPlayer.js",

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
  "./assets/pic/skill/stockstart_1.png",

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

  // ★v1.0.85: 起動に必要な最小セット（App Shell）だけ自動キャッシュ。
  //   ・オンライン初回訪問で ./ / index.html / css / js 等を mametype-app へ保存
  //   ・1件ずつ fetch→put し、1件失敗でも install 全体は失敗させない
  //   ・手動DL（193MBアセット）は従来通りページ側の downloadOfflineData が担当
  //   ・オフライン中の install は何もせず成功扱い（起動不能にしない）

  console.log(
    "Service Worker: Install (app-shell cache)",
    CACHE_NAME
  );

  event.waitUntil(
    (async () => {
      try {
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
          console.log("Service Worker: Install skipped (offline)");
          return;
        }
        const cache = await caches.open(OFFLINE_APP_CACHE);
        const targets = (typeof CORE_ASSETS !== "undefined" ? CORE_ASSETS : [])
          .filter(u => {
            try { return new URL(u, self.location.href).origin === self.location.origin; }
            catch (e) { return false; }
          });
        for (const u of targets) {
          try {
            const url = new URL(u, self.location.href).href;
            const res = await fetch(new Request(url, { cache: "no-cache" }));
            if (res && res.ok) {
              await cache.put(new Request(url), res.clone());
            }
          } catch (e) {
            // 1件の失敗は無視（手動DL・次回更新で補完される）
          }
        }
        console.log("Service Worker: Install app-shell done");
      } catch (e) {
        console.log("Service Worker: Install app-shell skipped:", e);
      }
    })()
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
  let requestUrl = null;
  try {
    requestUrl = new URL(event.request.url);
  } catch (e) {
    return;
  }
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  // ------------------------------------------------------
  // ★v1.0.85: ナビゲーション（アプリ起動）は必ず Response を返す。
  //   network → キャッシュ(index.html / ./) → 最小HTML の順。
  //   絶対に throw しない＝Chromeの恐竜画面を出さない。
  // ------------------------------------------------------
  if (event.request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const netRes = await fetch(event.request);
          if (netRes && netRes.ok) {
            // 起動殻は裏で最新化（次回オフライン起動用）
            try {
              const cache = await caches.open(OFFLINE_APP_CACHE);
              cache.put(new Request(new URL("./index.html", self.location.href).href), netRes.clone()).catch(() => {});
            } catch (e) { /* 裏更新の失敗は無視 */ }
            return netRes;
          }
          // ネットワークは来たが ok でない → キャッシュへ
          throw new Error("network-not-ok");
        } catch (e) {
          // オフライン時：キャッシュから index.html を返す
          try {
            const cached = await caches.match(event.request, { ignoreVary: true })
              || await caches.match(new Request(new URL("./index.html", self.location.href).href), { ignoreVary: true })
              || await caches.match(new Request(new URL("./", self.location.href).href), { ignoreVary: true });
            if (cached) return cached;
          } catch (err) { /* 下の最小HTMLへ */ }
          // キャッシュも無い初回オフライン → 最小HTMLで起動だけさせる
          return new Response(
            "<!doctype html><html lang=\"ja\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>MameType</title></head>" +
            "<body style=\"background:#111;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0\">" +
            "<div style=\"text-align:center\"><h1>MameType</h1><p>オフライン用データが未ダウンロードです。<br>オンラインで開いて、設定から「最新版をオフライン用にダウンロード」してください。</p></div></body></html>",
            { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
          );
        }
      })()
    );
    return;
  }

  // ------------------------------------------------------
  // ★v1.0.85: ナビゲーション以外（JS/CSS/画像/音/フォント）は
  //   cache-first → network（取得できたら保存して次回オフライン用に）。
  //   navigator.onLine 判定は使わない（SW内の onLine は不安定なため）。
  //   版更新は新SWの install が CORE_ASSETS を上書き＋手動DLで反映する。
  // ------------------------------------------------------
  // 拡張子で保存先を振り分け（matchは全キャッシュを検索するので
  // どちらに入っても動作するが、重複・分散を避けるため統一する）
  const pickOfflineCache = (url) => {
    try {
      const path = new URL(url).pathname.toLowerCase();
      if (
        path.endsWith(".js") || path.endsWith(".css") ||
        path.endsWith(".html") || path.endsWith(".json") ||
        path.endsWith("/") || path.endsWith("mametype") ||
        path.includes("icon-")
      ) {
        return OFFLINE_APP_CACHE;
      }
    } catch (e) { /* 判定不能はアセット側へ */ }
    return OFFLINE_ASSET_CACHE;
  };
  event.respondWith(
    (async () => {
      try {
        const cachedResponse = await caches.match(event.request, { ignoreVary: true });
        if (cachedResponse) {
          return cachedResponse;
        }
      } catch (e) { /* ネットワークへ進む */ }
      try {
        const netRes = await fetch(event.request);
        // ok な同一オリジンGETは保存して次回オフライン用に
        if (netRes && netRes.ok) {
          try {
            const cache = await caches.open(pickOfflineCache(event.request.url));
            // navigation以外の静的物だけ保存（API等のPOSTは上で除外済み）
            cache.put(event.request, netRes.clone()).catch(() => {});
          } catch (e) { /* 保存失敗は無視 */ }
        }
        return netRes;
      } catch (e) {
        // ネット失敗時にキャッシュがあれば返す（再照会）
        try {
          const retry = await caches.match(event.request, { ignoreVary: true });
          if (retry) return retry;
        } catch (err) { /* 下の503へ */ }
        return new Response("MameType is offline", {
          status: 503,
          statusText: "Service Unavailable",
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-store",
          },
        });
      }
    })()
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