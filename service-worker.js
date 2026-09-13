// =====================================================
// MameType Service Worker
// =====================================================

// -----------------------------------------------------
// キャッシュバージョン
// version.js の APP_VERSION と合わせる
// -----------------------------------------------------
const CACHE_NAME = "mametype-v1.0.27";

// =====================================================
// オフライン用データ（SWキャッシュ）の裏ダウンロードを
// 段階的に行う（裏で重くならない対策）
// ----------------------------------------------------------------------
//  - install イベントで一括キャッシュすると、Windowsでは
//    大量の同時fetch+デコードが走りメインスレッドを圧迫する。
//  - 初回は起動に必要な最小セット（起動コア）だけを同期的に
//    キャッシュし、残りは activate 後のアイドル時に数件ずつ
//    少しずつキャッシュする（裏でも軽い）。
//  - 残りは「低速キュー」として activate 時にバックグラウンドで
//    1件ずつ取得する。取得失敗は握りつぶし（fetch時に都度取得）。
// =====================================================

// -----------------------------------------------------
// 起動に必要な最小セット（install で同期キャッシュ）
//  → ブート〜メニュー表示に必要なものだけ
// -----------------------------------------------------

const BOOT_CORE_ASSETS = [
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
  // 起動直後のメニュー描画・起動シーケンスに必要なJS
  // ---------------------------------------------------

  "./js/main.js",
  "./js/version.js",
  "./js/storage.js",
  "./js/stageScale.js",
  "./js/fullscreenUtil.js",
  "./js/saveDataNotice.js",
  "./js/assetsLoader.js",
  "./js/effectManager.js",
  "./js/gameCore.js",
  "./js/renderer.js",
  "./js/gameModes.js",
  "./js/difficulties.js",
  "./js/keybinds.js",
  "./js/dialogue.js",
  "./js/dialogue.css",
  "./js/dialogueData.js",
  "./js/analytics.js",
];

// -----------------------------------------------------
// 裏ダウンロードの同時取得数・間隔
//  → 1件ずつ・少し間を空けて取得することで、
//    Windows でも裏ダウンロード中の重さを抑える
// -----------------------------------------------------

const DEFERRED_CONCURRENCY = 1;
// ★v1.0.23: 300ms → 1200ms に緩和。
//   頻繁な取得+キャッシュ書き込みは Windows（プロキシ/セキュリティソフト環境）で
//   ネットワーク・ディスクI/Oを圧迫し、プレイ中の表示遅れ・カクつきの原因になる。
const DEFERRED_INTERVAL_MS = 1200;

// ★v1.0.23: ゲーム中フラグ（ページから GAME_ACTIVE メッセージで切替）。
//   true の間は裏ダウンロードを完全に停止する。
let gameActive = false;

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
  // 外部CDN（Supabaseクライアント）
  // supabase.js が起動時に静的importしているため、
  // 完全オフライン起動にはこのキャッシュが必須
  // ---------------------------------------------------

  "https://esm.sh/@supabase/supabase-js@2.49.1?bundle",
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

// 起動コア以外（activate 後にバックグラウンドで少しずつ取得する）
//  install 時は起動コアだけをキャッシュして素早く有効化し、
//  残りは interval を空けて 1 件ずつ取得する。
//  （一括キャッシュは CacheStorage の排他ロックを長時間占有し、
//     Windows のタイピング遅延・起動失敗の原因になるため）
const NON_BOOT_ASSETS_TO_CACHE = ALL_ASSETS_TO_CACHE.filter(
  url => !BOOT_CORE_ASSETS.includes(url)
);

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

/**
 * activate 後のバックグラウンド事前キャッシュ。
 * 起動コア以外のアセットを「1件ずつ・間隔を空けて」取得して
 * オフライン対応を完成させる。進捗は UPDATE_PROGRESS で通知する。
 * キャッシュ書き込みは CacheStorage の排他ロックを短時間しか
 * 占めないため、ページ側の要求（タイピング音 fetch など）が
 * ロック待ちで遅延しなくなる。
 */
async function preCacheRemainingInBackground() {

  // オフライン中は取得できないので何もしない
  if (navigator.onLine === false) {
    return;
  }

  const cache = await caches.open(CACHE_NAME).catch(() => null);
  if (!cache) return;

  const total = NON_BOOT_ASSETS_TO_CACHE.length;
  if (total <= 0) return;

  let completed = 0;

  const notify = (status) => {
    const percent = Math.floor((completed / total) * 100);
    try {
      notifyClients({
        type: "UPDATE_PROGRESS",
        status,
        current: completed,
        total,
        percent,
      });
    } catch (e) { /* 無視 */ }
  };

  // ---------------------------------------------------------------
  // ★v1.0.23: ゲーム中は裏ダウンロードを完全に停止する。
  //   プレイ中のネットワーク帯域・ディスクI/Oの取り合いで
  //   「打鍵表示の遅れ」「防衛モードのもっさり」が起きるため。
  //   ページが GAME_ACTIVE(active:false) を送ってくるまで待機する。
  // ---------------------------------------------------------------
  const waitForGameIdle = async () => {
    while (gameActive) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  };

  notify("start");

  for (const asset of NON_BOOT_ASSETS_TO_CACHE) {

    // ゲームが始まったら再開を待つ
    await waitForGameIdle();

    try {
      const request = new Request(asset);
      const response = await fetch(request);
      if (response && response.ok) {
        await cache.put(request, response.clone());
      }
      completed++;
    } catch (e) {
      // 1件の失敗で中断しない（次の起動時に再試行）
      completed++;
      console.error("Service Worker: background cache failed:", asset, e);
    }

    notify("progress");

    // 間隔を空けて、キャッシュロックの長時間占有を避ける
    await new Promise(resolve => setTimeout(resolve, DEFERRED_INTERVAL_MS));
  }

  completed = total;
  notify("complete");
  console.log("Service Worker: Background cache complete.");

  // ---------------------------------------------------------------
  // フォントサブセット（fonts.css が参照する woff2 群）も事前キャッシュ。
  //  self-host フォントは unicode-range サブセット（woff2 約200ファイル）に
  //  分かれており、オフライン起動時にキャッシュがないと日本語表示が
  //  フォールバックフォントになる・表示が遅れる。
  //  （オンライン中はページ側 assetsLoader が HTTP キャッシュへ事前取得済み。
  //    ここはオフライン対応のための補完）
  // ---------------------------------------------------------------
  try {
    const fontCssRequest = new Request("./assets/fonts/fonts.css");
    const fontCssResponse = await fetch(fontCssRequest);
    if (fontCssResponse && fontCssResponse.ok) {
      await cache.put(fontCssRequest, fontCssResponse.clone());
      const fontCss = await fontCssResponse.text();
      const fontUrls = [...new Set(
        [...fontCss.matchAll(/url\((['"]?)([^'")]+\.woff2)\1\)/g)].map(m => m[2])
      )];
      for (const href of fontUrls) {
        // ゲームが始まったら再開を待つ
        await waitForGameIdle();
        try {
          // 相対URLは fonts.css の場所（/assets/fonts/）基準で解決する
          const cssUrl = new URL("./assets/fonts/fonts.css", self.location.href);
          const url = new URL(href, cssUrl).href;
          const res = await fetch(new Request(url));
          if (res && res.ok) {
            await cache.put(new Request(url), res.clone());
          }
        } catch (e) {
          // 1件の失敗は握りつぶし（次回起動時に再試行）
        }
        // 間隔を空けて、キャッシュロックの長時間占有を避ける
        await new Promise(resolve => setTimeout(resolve, DEFERRED_INTERVAL_MS));
      }
      console.log(`Service Worker: Font cache complete. (${fontUrls.length} files)`);
    }
  } catch (e) {
    console.warn("Service Worker: font precache failed:", e);
  }
}

// =====================================================
// インストール
// =====================================================

self.addEventListener("install", event => {

  console.log(
    "Service Worker: Install",
    CACHE_NAME
  );

  event.waitUntil(

    caches.open(CACHE_NAME)

      .then(async cache => {

        const total = BOOT_CORE_ASSETS.length;

        let completed = 0;

        console.log(
          `Service Worker: Updating ${total} assets`
        );

        // ---------------------------------------------
        // 進捗を開始
        // ---------------------------------------------

        notifyClients({
          type: "UPDATE_PROGRESS",
          status: "start",
          current: 0,
          total: total,
          percent: 0
        }).catch(() => {});

        // ---------------------------------------------
        // 1ファイルずつ取得
        // ---------------------------------------------

        for (const asset of BOOT_CORE_ASSETS) {

          try {

            const request = new Request(
              asset,
              {
                cache: "no-cache"
              }
            );

            const response = await fetch(request);

            if (!response.ok) {
              throw new Error(
                `HTTP ${response.status}: ${asset}`
              );
            }

            await cache.put(
              request,
              response.clone()
            );

            completed++;

            const percent = Math.floor(
              (completed / total) * 100
            );

            console.log(
              `Service Worker: ${completed}/${total}`,
              asset
            );

            // -----------------------------------------
            // 進捗送信
            // -----------------------------------------

            notifyClients({
              type: "UPDATE_PROGRESS",
              status: "progress",
              current: completed,
              total: total,
              percent: percent,
              file: asset
            }).catch(() => {});

          } catch (error) {

            console.error(
              "Service Worker: Failed to cache:",
              asset,
              error
            );

            // -----------------------------------------
            // 1ファイル失敗しても全体を止めない
            // -----------------------------------------

            notifyClients({
              type: "UPDATE_PROGRESS",
              status: "file-error",
              current: completed,
              total: total,
              percent: Math.floor(
                (completed / total) * 100
              ),
              file: asset
            }).catch(() => {});
          }
        }

        // ---------------------------------------------
        // 完了
        // ---------------------------------------------

        notifyClients({
          type: "UPDATE_PROGRESS",
          status: "complete-boot",
          current: total,
          total: total,
          percent: 100
        }).catch(() => {});

        console.log(
          "Service Worker: Asset update complete."
        );

      })
  );

  // -----------------------------------------------
  // ここでは skipWaiting しない
  // ユーザーが「今すぐ更新」を押したときに実行
  // -----------------------------------------------

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
            .filter(name => name !== CACHE_NAME)
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

      // ---------------------------------------------
      // 起動コア以外をバックグラウンドで事前キャッシュ
      // （オフライン対応の完成。ページの読み込みは妨げない）
      // ---------------------------------------------
      await preCacheRemainingInBackground();

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
  // ★v1.0.23: ページからのゲーム状態通知。
  //   ゲーム中は裏ダウンロード（preCacheRemainingInBackground）を
  //   停止させるために使う。
  // ---------------------------------------------------------------
  if (
    event.data &&
    event.data.type === "GAME_ACTIVE"
  ) {

    gameActive = !!event.data.active;

    console.log(
      "Service Worker: GAME_ACTIVE =",
      gameActive
    );

    return;
  }

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

});