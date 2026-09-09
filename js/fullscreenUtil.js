// fullscreenUtil.js
// =====================================================
// フルスクリーン / ウィンドウモード切替ユーティリティ
// =====================================================
// Fullscreen API をラップした共通モジュール。
// Safari 等の webkit プレフィックスにも対応しており、
// 全ゲーム画面のフルスクリーン切替ボタンから利用する。
//
// ※ manifest.json に特別な記載は不要。
//   PWA は display: "standalone"（ウィンドウモード）で起動し、
//   ゲーム内の切替ボタンでフルスクリーン ⇔ ウィンドウを切り替える。
//
// ※ フルスクリーン中の ESC キーについて
//   ESC はブラウザが「フルスクリーン解除」として消費するため、
//   Chrome / Safari 等ではページに keydown が届かない。
//   このモジュールは解除を検知して ESC の keydown を再送することで、
//   フルスクリーン中でもゲーム内の「ESC で中断 / 戻る」等の処理が
//   ウィンドウモード時と同じように効くようにしている。
//   （詳細は下記「ESC キーによるフルスクリーン解除の検知と ESC 再送」）

// -----------------------------------------------------
// 状態変化リスナー管理
// -----------------------------------------------------

let fullscreenListeners = new Set();

// -----------------------------------------------------
// 内部ヘルパー（ベンダープレフィックス対応）
// -----------------------------------------------------

/** 現在フルスクリーン中の要素を返す（なければ null） */
function getFullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

/** フルスクリーン状態の変化を全リスナーへ通知する */
function notifyFullscreenChange() {
  const fs = isFullscreen();
  fullscreenListeners.forEach((cb) => {
    try {
      cb(fs);
    } catch (err) {
      console.warn("fullscreen change listener failed:", err);
    }
  });
}

/**
 * ネイティブの fullscreenchange を常時監視する。
 * - ユーザー操作（ESC 等）による解除を ESC 再送判定へ回す
 * - 状態変化を onFullscreenChange() の購読者へ通知する
 * モジュール読み込み時に1回だけ登録する（購読者の有無に関わらず有効）。
 */
function handleNativeFullscreenChange() {
  // フルスクリーン解除時に、ESC による解除ならゲーム側へ keydown を再送する
  if (!getFullscreenElement()) {
    replayEscapeIfNeeded();
  }
  notifyFullscreenChange();
}

let nativeListenersAttached = false;
function attachNativeListenersOnce() {
  if (nativeListenersAttached) return;
  document.addEventListener("fullscreenchange", handleNativeFullscreenChange);
  document.addEventListener("webkitfullscreenchange", handleNativeFullscreenChange);
  nativeListenersAttached = true;
}

// -----------------------------------------------------
// ESC キーによるフルスクリーン解除の検知と ESC 再送
// -----------------------------------------------------
// Fullscreen API の仕様上、ESC はブラウザが「フルスクリーン解除」の
// ショートカットとして消費するため、解除そのものを拒否することはできない。
// さらに Chrome / Safari 等では、その ESC の keydown はページへ通知されない。
// その結果、フルスクリーン中だけゲーム内の
// 「ESC で中断 / 戻る / モーダルを閉じる」等の処理が効かなくなる。
//
// そこでフルスクリーン解除を検知したとき、次の両方に当てはまる場合は
// 「ユーザーが ESC を押した」とみなして ESC の keydown を再送する。
//   1. 自前の切替ボタン / exitFullscreen() による解除ではない
//   2. 直前に本物の ESC keydown を受けていない
//      （Firefox は ESC の keydown がページへ届くため、すでにゲーム側の
//        ESC 処理が実行済み。再送すると二重処理になってしまう）
// 再送された keydown は通常のキー入力と同じ経路で各ハンドラへ渡るため、
// 個々の画面はウィンドウモード時と同一の ESC 挙動になる。

const ESC_REPLAY_DELAY_MS = 50;      // 解除検知後に ESC を再送するまでの遅延
const ESC_DELIVERED_WINDOW_MS = 300; // この時間内に本物の ESC が届いていれば再送しない
const ESC_SELF_EXIT_WINDOW_MS = 500; // 自前での解除直後は ESC 扱いにしない
const ESC_REPLAY_DEDUP_MS = 100;     // 再送直後に届いた本物の ESC は二重処理防止のため握りつぶす

// 最後に本物の ESC keydown を受信した時刻
let lastRealEscapeAt = 0;
// 自前で exitFullscreen() を呼び出した時刻（切替ボタン等からの解除判定用）
let selfExitRequestedAt = 0;
// 最後に ESC を再送した時刻
let lastReplayAt = 0;
let escapeKeyWatcherAttached = false;

/**
 * 本物の ESC keydown の受信時刻を記録する監視を document に登録する。
 * capture フェーズで最速に観測するが、伝播は妨げない。
 */
function attachEscapeKeyWatcher() {
  if (escapeKeyWatcherAttached) return;

  document.addEventListener(
    "keydown",
    (e) => {
      // 自分で再送した合成イベントは記録しない
      if (!e.isTrusted) return;
      if (e.key !== "Escape" && e.code !== "Escape") return;

      const now = Date.now();

      // 再送の直後に本物の ESC が届いた場合（ブラウザによる二重配信）は
      // すでにゲーム側の ESC 処理が実行済みなので握りつぶす
      if (now - lastReplayAt < ESC_REPLAY_DEDUP_MS) {
        e.stopImmediatePropagation();
        e.preventDefault();
        return;
      }

      lastRealEscapeAt = now;
    },
    true
  );

  escapeKeyWatcherAttached = true;
}

/**
 * フルスクリーン解除がユーザーの ESC によるものとみなせる場合に、
 * ゲーム側へ ESC の keydown を再送する。
 */
function replayEscapeIfNeeded() {
  // 自前の切替ボタン / API による解除はゲームの ESC 扱いにしない
  if (Date.now() - selfExitRequestedAt < ESC_SELF_EXIT_WINDOW_MS) return;

  // 直前に本物の ESC keydown が届いている場合は、ゲーム側の ESC 処理が
  // すでに実行されているので再送しない
  if (Date.now() - lastRealEscapeAt < ESC_DELIVERED_WINDOW_MS) return;

  // わずかに遅延させて、ブラウザが解除後に keydown を届けるケースとの
  // 二重処理を防ぐ（遅延中に本物の ESC が届いたら再送を取りやめる）
  setTimeout(() => {
    if (Date.now() - lastRealEscapeAt < ESC_DELIVERED_WINDOW_MS) return;

    lastReplayAt = Date.now();

    // 実際のキー入力と同じように、フォーカス中の要素を発火元にする
    const target =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : document.body;

    target.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        code: "Escape",
        bubbles: true,
        cancelable: true,
      })
    );
  }, ESC_REPLAY_DELAY_MS);
}

// -----------------------------------------------------
// 公開API
// -----------------------------------------------------

/**
 * フルスクリーン切替が可能な環境か（未対応環境では false）。
 * iPhone の Safari など、要素のフルスクリーンに対応していない
 * 環境ではボタン自体を生成しない。
 */
export function isFullscreenAvailable() {
  const el = document.documentElement;
  return !!(el.requestFullscreen || el.webkitRequestFullscreen);
}

/** 現在フルスクリーン中かどうか */
export function isFullscreen() {
  return !!getFullscreenElement();
}

/** フルスクリーンへ切り替える */
export async function enterFullscreen() {
  const el = document.documentElement;
  try {
    if (el.requestFullscreen) {
      await el.requestFullscreen();
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
    }
    return true;
  } catch (err) {
    console.warn("fullscreen enter failed:", err);
    return false;
  }
}

/** フルスクリーンを解除してウィンドウモードへ戻る */
export async function exitFullscreen() {
  // 自前での解除（切替ボタン等）。ユーザーの ESC による解除と
  // 区別するため、呼び出し時刻を記録してから解除する。
  // （fullscreenchange は解除完了を待たずに発火するため先に記録する）
  selfExitRequestedAt = Date.now();
  try {
    if (document.exitFullscreen) {
      await document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
    return true;
  } catch (err) {
    console.warn("fullscreen exit failed:", err);
    return false;
  }
}

/** フルスクリーン ⇔ ウィンドウモードを切り替える */
export async function toggleFullscreen() {
  if (isFullscreen()) {
    return exitFullscreen();
  }
  return enterFullscreen();
}

/**
 * フルスクリーン状態の変化を購読する。
 * コールバックにはフルスクリーン中かどうかの真偽値が渡される。
 * 戻り値の関数を呼ぶと購読を解除できる。
 */
export function onFullscreenChange(callback) {
  if (typeof callback !== "function") return () => {};

  fullscreenListeners.add(callback);

  return () => {
    fullscreenListeners.delete(callback);
  };
}

/**
 * 既存ボタンを「フルスクリーン ⇔ ウィンドウ」切替トグルとして動作させる。
 * （メニューの globalFsToggle など、HTML 側に置いたグローバル切替ボタン用）
 * ラベルはウィンドウモード時「⛶ FULLSCREEN」、フルスクリーン中「⛶ WINDOW」。
 */
export function bindFullscreenToggle(btn) {
  if (!btn) return null;

  const update = () => {
    btn.textContent = isFullscreen() ? "⛶ WINDOW" : "⛶ FULLSCREEN";
  };
  update();

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleFullscreen();
  });

  onFullscreenChange(update);
  return btn;
}

// -----------------------------------------------------
// 切替ボタン生成
// -----------------------------------------------------

/**
 * 指定コンテナにフルスクリーン切替ボタンを生成する。
 * - コンテナが非表示のときはボタンも一緒に隠れる（表示制御は不要）。
 * - 生成済みの場合は何もせず既存ボタンを返す（重複生成防止）。
 * - フルスクリーン非対応環境では null を返す（ボタンは出さない）。
 *
 * @param {string} containerId ボタンの追加先コンテナのID
 * @param {object} [opts] { id, className, title } の上書きオプション
 * @returns {HTMLButtonElement|null}
 */
export function ensureFullscreenButton(containerId, opts = {}) {
  const container = document.getElementById(containerId);
  if (!container) return null;

  const btnId = opts.id || containerId + "FsBtn";
  const existing = document.getElementById(btnId);
  if (existing) return existing;

  if (!isFullscreenAvailable()) return null;

  const btn = document.createElement("button");
  btn.id = btnId;
  btn.className =
    opts.className || "enemy-sound-toggle fs-toggle-btn sound-toggle-btn";
  btn.type = "button";
  btn.title = opts.title || "フルスクリーン切替";
  btn.textContent = isFullscreen() ? "⛶ EXIT" : "⛶ FULL";

  btn.onclick = (e) => {
    e.stopPropagation(); // タイピング入力等に影響させない
    toggleFullscreen();
  };

  // フルスクリーン状態の変化でラベルを更新
  onFullscreenChange((fs) => {
    btn.textContent = fs ? "⛶ EXIT" : "⛶ FULL";
  });

  container.appendChild(btn);
  return btn;
}

// -----------------------------------------------------
// グローバルUIバー（メニュー左上の共通ボタン群）の表示制御
// -----------------------------------------------------

// 起動系オーバーレイ（CSSで初期表示のため、style.display === "" でも「表示中」）
const OVERLAY_IDS = ["bootScreen", "loadingScreen"];

// ゲームプレイ画面（CSSで初期非表示のため、インラインスタイルが
// 設定されている場合のみ「表示中」とみなす）
const GAMEPLAY_IDS = ["game", "enemyModeContainer", "defenseModeContainer"];

/**
 * メニュー左上の共通UIバー（#globalUiBar）を初期化する。
 * - body（ステージ）直下の fixed 配置のため、どのメニュー画面でも常に表示
 * - ゲームプレイ中 / 起動オーバーレイ表示中は自動的に非表示
 * - ウィンドウサイズは自由に変更でき、ゲーム画面は自動でフィットする
 */
export function initGlobalUiBar() {
  const bar = document.getElementById("globalUiBar");
  if (!bar) return;

  // ゲームプレイ中 / 起動オーバーレイ中は非表示にする
  // （各画面の表示はインラインスタイルで管理されるため style 変更を監視）
  const updateVisibility = () => {
    const overlayVisible = OVERLAY_IDS.some((id) => {
      const el = document.getElementById(id);
      return !!el && el.style.display !== "none";
    });
    const gameplayVisible = GAMEPLAY_IDS.some((id) => {
      const el = document.getElementById(id);
      if (!el) return false;
      const d = el.style.display;
      return d !== "" && d !== "none";
    });
    bar.classList.toggle("hidden", overlayVisible || gameplayVisible);
  };

  const observer = new MutationObserver(updateVisibility);
  [...OVERLAY_IDS, ...GAMEPLAY_IDS].forEach((id) => {
    const el = document.getElementById(id);
    if (el) observer.observe(el, { attributes: true, attributeFilter: ["style"] });
  });
  updateVisibility();
}

// -----------------------------------------------------
// 常時監視の開始
// -----------------------------------------------------
// ESC 再送はフルスクリーン変化の検知に依存するため、
// onFullscreenChange() の購読者の有無にかかわらず起動時に監視を開始する。
// （attachNativeListenersOnce / attachEscapeKeyWatcher ともに多重登録ガード付き）
attachEscapeKeyWatcher();
attachNativeListenersOnce();