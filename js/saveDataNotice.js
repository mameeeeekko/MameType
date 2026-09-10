// saveDataNotice.js
// =====================================================
// セーブデータ保存場所の注意喚起モーダル（初回のみ表示）
// ・起動時に1回表示する
// ・「以後表示しない」にチェックしてOKで閉じた場合はスキップ
// ・APP_VERSION が変わったら、チェック済みでも再表示する
// =====================================================

import { APP_VERSION } from "./version.js";

// 「以後表示しない」にチェックした際のバージョンを保存するキー
const NOTICE_DISMISSED_VERSION_KEY = "saveDataNoticeDismissedVersion";

/**
 * 注意喚起が必要なら表示し、不要なら即解決します。
 * （main.js からは起動時に1回呼ばれます）
 * @returns {Promise<void>} ユーザーがOKで閉じると解決するPromise
 */
export function showSaveDataNoticeOnce() {
  try {
    const dismissedVersion = localStorage.getItem(NOTICE_DISMISSED_VERSION_KEY);
    // チェック済みで同じバージョンなら表示しない
    if (dismissedVersion === APP_VERSION) {
      return Promise.resolve();
    }
  } catch (e) {
    // localStorage が使えない環境ではスキップ判定せず表示して継続
  }
  return showSaveDataNotice();
}

/**
 * 注意喚起モーダルを表示します。
 * OKボタン（または Enter / Escape）で閉じられます。
 * @returns {Promise<void>}
 */
function showSaveDataNotice() {
  return new Promise(resolve => {
    const existing = document.getElementById("saveDataNoticeOverlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "saveDataNoticeOverlay";
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex; justify-content: center; align-items: center;
      z-index: 40000; padding: 16px;
      opacity: 0; transition: opacity 0.4s ease-in-out;
    `;

    const message = [
      "【セーブデータの保存場所について】",
      "このゲームのセーブデータは、開き方・ブラウザごとに独立して保存されます。\n",
      "特に Safari で「Dockに追加」してインストールしたアプリと、Safari のタブ（GitHub Pages など）で開いた場合は保存領域が別々のため、お互いにセーブデータは共有されません。\n",
      "片方で遊んだデータはもう片方には反映されませんのでご注意ください。\n",
      "データを移したい場合は、メニューの「データ管理」から書き出し／読み込みで移行してください。"
    ].join("\n");

    overlay.innerHTML = `
      <div style="max-width: 560px; width: 100%; background: #111319; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; box-shadow: 0 18px 40px rgba(0,0,0,0.45); padding: 24px; color: #f7f7f7;">
        <div style="margin-bottom: 18px; font-size: 0.95rem; line-height: 1.8; white-space: pre-line;">${message}</div>
        <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 20px; font-size: 0.85rem; color: #c9d1d9; cursor: pointer;">
          <input type="checkbox" id="saveDataNoticeDontShow" style="width: 16px; height: 16px; cursor: pointer; accent-color: #2f8aff;">
          以後表示しない（バージョン更新時は再表示されます）
        </label>
        <div style="display: flex; justify-content: flex-end;">
          <button id="saveDataNoticeOk" style="min-width: 130px; padding: 12px 18px; border: none; border-radius: 10px; background: #2f8aff; color: #fff; font-weight: 700; cursor: pointer;">OK</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => {
      overlay.style.opacity = "1";
    });

    const okButton = overlay.querySelector("#saveDataNoticeOk");
    const checkbox = overlay.querySelector("#saveDataNoticeDontShow");

    const handleKeyDown = (event) => {
      if (event.code === "Enter" || event.code === "Escape") {
        event.preventDefault();
        cleanup();
      }
    };

    const cleanup = () => {
      if (checkbox.checked) {
        try {
          // 「以後表示しない」：チェックした時のバージョンを保存。
          // バージョンが上がると一致しなくなり、再表示される。
          localStorage.setItem(NOTICE_DISMISSED_VERSION_KEY, APP_VERSION);
        } catch (e) {
          // localStorage 書き込み不可でもモーダルは閉じる
        }
      }
      overlay.style.opacity = "0";
      document.removeEventListener("keydown", handleKeyDown);
      setTimeout(() => {
        overlay.remove();
        resolve();
      }, 400);
    };

    okButton.addEventListener("click", cleanup);
    document.addEventListener("keydown", handleKeyDown);
  });
}
