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

// -----------------------------------------------------
// 状態変化リスナー管理
// -----------------------------------------------------

let fullscreenListeners = new Set();
let globalListenersAttached = false;

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

function attachGlobalListeners() {
  if (globalListenersAttached) return;
  document.addEventListener("fullscreenchange", notifyFullscreenChange);
  document.addEventListener("webkitfullscreenchange", notifyFullscreenChange);
  globalListenersAttached = true;
}

function detachGlobalListeners() {
  if (!globalListenersAttached) return;
  document.removeEventListener("fullscreenchange", notifyFullscreenChange);
  document.removeEventListener("webkitfullscreenchange", notifyFullscreenChange);
  globalListenersAttached = false;
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
  attachGlobalListeners();

  return () => {
    fullscreenListeners.delete(callback);
    if (fullscreenListeners.size === 0) detachGlobalListeners();
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