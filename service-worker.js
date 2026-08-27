// =====================================================
// MameType Service Worker
// =====================================================

// -----------------------------------------------------
// キャッシュバージョン
// version.js の APP_VERSION と合わせる
// -----------------------------------------------------
const CACHE_NAME = "mametype-v1.0.2";

// =====================================================
// コアアセット
// =====================================================

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./style.css",

  "./js/main.js",
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

  "./assets/pic/title_menu.png",
  "./assets/pic/quest_menu.png",
  "./assets/pic/sound1.png",
  "./assets/pic/soundmute.png",
];

// =====================================================
// 動的アセット
// =====================================================

const DYNAMIC_ASSETS = [

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

  // ---------------------------------------------------
  // SE
  // ---------------------------------------------------

  "./assets/sound/se/select.mp3",
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
// クライアントへ進捗を送信
// =====================================================

async function notifyClients(message) {
  const clients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true
  });

  clients.forEach(client => {
    client.postMessage(message);
  });
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

        const total = ALL_ASSETS_TO_CACHE.length;

        let completed = 0;

        console.log(
          `Service Worker: Updating ${total} assets`
        );

        // ---------------------------------------------
        // 進捗を開始
        // ---------------------------------------------

        await notifyClients({
          type: "UPDATE_PROGRESS",
          status: "start",
          current: 0,
          total: total,
          percent: 0
        });

        // ---------------------------------------------
        // 1ファイルずつ取得
        // ---------------------------------------------

        for (const asset of ALL_ASSETS_TO_CACHE) {

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

            await notifyClients({
              type: "UPDATE_PROGRESS",
              status: "progress",
              current: completed,
              total: total,
              percent: percent,
              file: asset
            });

          } catch (error) {

            console.error(
              "Service Worker: Failed to cache:",
              asset,
              error
            );

            // -----------------------------------------
            // 1ファイル失敗しても全体を止めない
            // -----------------------------------------

            await notifyClients({
              type: "UPDATE_PROGRESS",
              status: "file-error",
              current: completed,
              total: total,
              percent: Math.floor(
                (completed / total) * 100
              ),
              file: asset
            });
          }
        }

        // ---------------------------------------------
        // 完了
        // ---------------------------------------------

        await notifyClients({
          type: "UPDATE_PROGRESS",
          status: "complete",
          current: total,
          total: total,
          percent: 100
        });

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

    caches.keys()
      .then(cacheNames => {

        return Promise.all(

          cacheNames.map(cacheName => {

            if (cacheName !== CACHE_NAME) {

              console.log(
                "Service Worker: Deleting old cache:",
                cacheName
              );

              return caches.delete(cacheName);
            }

            return null;
          })

        );

      })

      .then(() => {
        return self.clients.claim();
      })

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

  event.respondWith(

    caches.match(event.request)
      .then(cachedResponse => {

        // ---------------------------------------------
        // キャッシュ優先
        // ---------------------------------------------

        if (cachedResponse) {
          return cachedResponse;
        }

        // ---------------------------------------------
        // キャッシュにない場合はネットワーク
        // ---------------------------------------------

        return fetch(event.request)

          .then(networkResponse => {

            if (
              !networkResponse ||
              networkResponse.status !== 200 ||
              networkResponse.type !== "basic"
            ) {
              return networkResponse;
            }

            const responseToCache =
              networkResponse.clone();

            caches.open(CACHE_NAME)
              .then(cache => {

                cache.put(
                  event.request,
                  responseToCache
                );

              })
              .catch(error => {

                console.error(
                  "Service Worker: cache.put failed:",
                  error
                );

              });

            return networkResponse;

          })

          .catch(error => {

            console.error(
              "Service Worker: Fetch failed:",
              error
            );

            // オフラインかつキャッシュにもない場合
            throw error;

          });

      })

  );

});

// =====================================================
// Message
// =====================================================

self.addEventListener("message", event => {

  if (
    event.data &&
    event.data.type === "SKIP_WAITING"
  ) {

    console.log(
      "Service Worker: SKIP_WAITING received"
    );

    self.skipWaiting();
  }

});