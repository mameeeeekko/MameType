// service-worker.js

// キャッシュの名前。バージョンを更新すると、古いキャッシュが削除されます。
const CACHE_NAME = "mametype-v1.1";

// インストール時にキャッシュするファイルのリスト
// ゲームの起動に必須なコアファイルや、頻繁にアクセスされるファイルを指定します。
const CORE_ASSETS = [
  "./", // ルート
  "./index.html",
  "./style.css",
  "./js/main.js",
  "./js/gameCore.js",
  "./js/enemyCore.js",
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

// assetsLoader.jsに記載されているすべてのアセットをキャッシュ対象とします。
// 手動でリストアップするのは大変なので、ここでは代表的なものだけを例として挙げています。
// 本来はビルドツールでこのリストを自動生成するのが理想的です。
const DYNAMIC_ASSETS = [
  // passiveスキル画像
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
  // activeスキル画像
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
  "./assets.pic/skill/kill_random.png",
  "./assets/pic/skill/kill_all.png",
  "./assets/pic/skill/knockback.png",
  // 背景画像
  "./assets/pic/battle_field_green.png",
  "./assets/pic/battle_field_gray.png",
  "./assets/pic/battle_field_blue.png",
  "./assets/pic/battle_field_red.png",
  "./assets/pic/battle_field_purple.png",
  "./assets/pic/map_field_blue.png",
  "./assets/pic/map_field_purple.png",
  "./assets/pic/map_field_red.png",
  "./assets/pic/map_field_gray.png",
  // SE
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
  // BGM
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
  "./assets/sound/bgm/soranaka.mp3",
];

// 重複を排除して最終的なキャッシュリストを作成
const ALL_ASSETS_TO_CACHE = [...new Set([...CORE_ASSETS, ...DYNAMIC_ASSETS])];

// 1. Service Workerのインストール
self.addEventListener("install", event => {
  console.log("Service Worker: Install");
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log("Service Worker: Caching all assets for offline use...");
        // すべてのアセットをインストール時にキャッシュします。
        // これにより、インストール完了後は完全にオフラインで動作します。
        // 注意: ファイル数が多い場合、インストールに時間がかかったり、失敗するリスクがあります。
        return cache.addAll(ALL_ASSETS_TO_CACHE);
      })
      .catch(error => {
        console.error("Service Worker: Failed to cache all assets:", error);
      })
  );
  // self.skipWaiting(); // ユーザーに更新を通知するため、即時有効化をコメントアウト
});

// 2. Service Workerの有効化と古いキャッシュの削除
self.addEventListener("activate", event => {
  console.log("Service Worker: Activate");
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // 現在のキャッシュ名と異なるものは削除
          if (cacheName !== CACHE_NAME) {
            console.log("Service Worker: Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // 新しいService Workerを即座に有効化
  return self.clients.claim();
});

// 3. リクエストのインターセプト
self.addEventListener("fetch", event => {
  // Cache-First戦略
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // キャッシュにあればそれを返す
        if (cachedResponse) {
          return cachedResponse;
        }

        // キャッシュになければネットワークにリクエスト
        return fetch(event.request).then(
          networkResponse => {
            // ネットワークから正常に取得できた場合
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }

            // レスポンスをクローンして片方をキャッシュに保存
            const responseToCache = networkResponse.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                // 動的にキャッシュに追加
                cache.put(event.request, responseToCache);
              });

            return networkResponse;
          }
        ).catch(error => {
          // ネットワークエラー（オフラインなど）
          console.log('Service Worker: Fetch failed; returning offline page instead.', error);
          // ここでオフライン用の代替ページを返すこともできます。
          // return caches.match('./offline.html');
        });
      })
  );
});

// 4. クライアントからのメッセージを待つ
self.addEventListener('message', (event) => {
  // クライアントから 'SKIP_WAITING' メッセージを受け取ったら、新しいService Workerを有効化する
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});