// stageScale.js
// =====================================================
// ステージスケール管理
// =====================================================
// アプリ全体をデザインサイズ 1600×900（16:9）で描画し、
// ウィンドウ / フルスクリーンのサイズに合わせて
// アスペクト比を維持したまま全体を拡大縮小する。
//
// - スケール適用は2モード（getStageMode() で参照可）:
//     'transform' … body に CSS transform: translate+scale（従来方式・既定）
//     'zoom'      … body に CSS zoom（Windows のみ既定。後述の理由で採用）
//   ★なぜ Windows だけ zoom なのか:
//     Chromium は「Webフォント＋合成レイヤー（transform: scale）」上の文字を
//     常にグレースケールAAで描画し、ClearType（サブピクセルAA）を無効にする
//     （既知仕様 issues.chromium.org/issues/40199005）。DPR=1.0 の Windows では
//     これが文字のギザギザの主犯になる。zoom はレイヤー合成を起こさないため、
//     LCD AA ＋ フォントヒンティングが効いた描画に戻る見込み。
//     ※ zoom は transform と違い position: fixed の包含ブロックを作らない
//       （fixed はビューポート基準になる。16:9 ウィンドウでは
//       ステージと一致するため実害なし。レターボックス時のみオーバーレイが
//       画面全体基準になる）。
// - --stage-scale / --stage-ox / --stage-oy の計算は従来どおり。
//   getBoundingClientRect / clientWidth の挙動は transform と同じ（実測済み）な
//   ため、clientToStage() / stageRect() と各座標変換コードはモード共通で不変。
// - 強制切替（デバッグ・A/B確認用）:
//     ?stage=zoom    … zoom モードを強制（非対応ブラウザでは自動フォールバック）
//     ?stage=transform … transform モードを強制
// - ウィンドウサイズはユーザーが自由に変更でき、resize イベントで
//   常にウィンドウに自動フィットする。

import { onFullscreenChange } from "./fullscreenUtil.js";

// デザインサイズ（ステージの論理サイズ＝16:9）
export const STAGE_W = 1600;
export const STAGE_H = 900;

// -----------------------------------------------------
// 旧表示サイズモード（大 / 中 / 小）の後始末
// -----------------------------------------------------

// かつて大 / 中 / 小 プリセットを localStorage に保存していた名残。
// 機能削除にともない保存値を掃除する。
const LEGACY_SIZE_MODE_KEY = "mametypeDisplaySize";
try {
  localStorage.removeItem(LEGACY_SIZE_MODE_KEY);
} catch (e) {
  /* 保存領域にアクセスできない環境では無視 */
}

let currentScale = 1;
// ステージ原点の表示オフセット（CSS px）。fitStage() がデバイスピクセル整数に
// 丸めて保持する。clientToStage() も同じ値を使い、座標変換のずれを防ぐ。
let currentOx = 0;
let currentOy = 0;

// -----------------------------------------------------
// スケール適用モード（'transform' | 'zoom'）
// -----------------------------------------------------

// null = 未決定。解決後は 'zoom' への検証失敗時のみ 'transform' へ切り戻す。
let stageMode = null;

/** zoom の対応確認（非対応なら transform にフォールバック） */
function isZoomSupported() {
  try {
    return (
      typeof CSS !== "undefined" &&
      typeof CSS.supports === "function" &&
      (CSS.supports("zoom", "1") || CSS.supports("zoom: 1"))
    );
  } catch (e) {
    return false;
  }
}

/** Windows 判定（js/main.js の body.win 判定と同じ基準） */
function isWindowsPlatform() {
  try {
    return (
      /Windows/i.test(navigator.userAgent || "") ||
      /^Win/i.test(navigator.platform || "")
    );
  } catch (e) {
    return false;
  }
}

function resolveStageMode() {
  if (stageMode) return stageMode;
  let mode = "transform";
  try {
    const forced = new URLSearchParams(window.location.search || "").get("stage");
    if (forced === "zoom") {
      mode = isZoomSupported() ? "zoom" : "transform";
    } else if (forced !== "transform") {
      // 既定: Windows ＋ zoom 対応ブラウザのみ zoom。Mac の見た目・挙動は不変。
      mode = isWindowsPlatform() && isZoomSupported() ? "zoom" : "transform";
    }
  } catch (e) {
    mode = "transform";
  }
  stageMode = mode;
  return stageMode;
}

/** 現在のスケール適用モード（'transform' | 'zoom'） */
export function getStageMode() {
  return resolveStageMode();
}

/** --stage-scale / --stage-ox / --stage-oy を CSS 変数へ反映（両モード共通） */
function setStageCssVars() {
  document.documentElement.style.setProperty("--stage-scale", String(currentScale));
  document.documentElement.style.setProperty("--stage-ox", currentOx + "px");
  document.documentElement.style.setProperty("--stage-oy", currentOy + "px");
}

/** 従来の transform 方式を適用（zoom の痕跡を完全に掃除） */
function applyTransformStage() {
  setStageCssVars();
  const body = document.body;
  if (!body) return;
  body.classList.remove("zoom-stage");
  body.style.zoom = "";
  body.style.left = "";
  body.style.top = "";
}

/** zoom 方式を適用（Windows のみ）。left/top は zoom 前の論理値で指定する */
function applyZoomStage() {
  setStageCssVars();
  const body = document.body;
  if (!body) return;
  body.classList.add("zoom-stage");
  body.style.zoom = String(currentScale);
  // body 自身の left/top は zoom でさらに倍率が掛かるため、表示上のオフセット
  // （currentOx/currentOy: ビューポートCSS px）を得るには scale で割って指定する。
  body.style.left = currentOx / currentScale + "px";
  body.style.top = currentOy / currentScale + "px";
}

/**
 * zoom 適用が実際に効いているか検証する。
 * - 計算 zoom 値が設定値と一致するか（非対応環境では computed zoom が空になる）
 * - scale ≠ 1 のとき、body の表示サイズが 1600×scale になっているか
 * 検証に失敗した場合のみ呼び出し側で 'transform' へ切り戻す。
 */
function verifyZoomStage() {
  try {
    const computed = parseFloat(getComputedStyle(document.body).zoom);
    // 丸め誤差（小数第3〜4位）は許容。非対応環境では NaN になるため弾く。
    if (!Number.isFinite(computed) || Math.abs(computed - currentScale) > 1e-3) {
      return false;
    }
    if (Math.abs(currentScale - 1) > 1e-4) {
      const r = document.body.getBoundingClientRect();
      if (Math.abs(r.width - STAGE_W * currentScale) > 1.5) return false;
      if (Math.abs(r.left - currentOx) > 1.5) return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

/** 現在のステージ拡大率（ステージ座標 → 表示座標の倍率） */
export function getStageScale() {
  return currentScale;
}

/**
 * 現在のウィンドウ（またはフルスクリーン画面）にステージをフィットさせる。
 *
 * ★Windows の 125% / 150% 表示スケーリングなど小数DPR環境での
 *   「文字がぼやける・にじむ」問題への対策。
 *   - レターボックスの原点オフセット（--stage-ox / --stage-oy）を
 *     デバイスピクセルの整数に丸める（端数の並進はレイヤー全体が
 *     バイリニア再サンプリングされ、全体がにじむ主原因）。
 *   - ステージ表示幅もデバイスpx整数になるよう scale をスナップする
 *     （canvasUtil.js は「cssW × 実効DPR × stageScale」でバッキングストアを
 *     作るため、ここで整数化しておくと Canvas と画面のピクセルが 1:1 になる）。
 *   - 幅は floor（round だと端数切り上げで僅かに横スクロールが出得る）、
 *     高さ側の誤差は最大 ≒0.5 デバイスpx（≈0.05%）で視覚上は無視できる。
 */
export function fitStage() {
  const vw = window.innerWidth || STAGE_W;
  const vh = window.innerHeight || STAGE_H;
  const dpr = window.devicePixelRatio || 1;

  // ウィンドウに収まる最大の 16:9 スケール
  // （ユーザーがウィンドウサイズを手動で変更しても resize で自動追従する）
  let scale = Math.min(vw / STAGE_W, vh / STAGE_H);
  if (!Number.isFinite(scale) || scale <= 0) scale = 1;

  // 表示幅（デバイスpx）が整数になるよう scale をスナップ（幅基準・切り捨て）
  const snappedScale = Math.max(1, Math.floor(STAGE_W * scale * dpr)) / (STAGE_W * dpr);
  if (Number.isFinite(snappedScale) && snappedScale > 0) scale = snappedScale;

  currentScale = scale;

  // 中央寄せオフセットをデバイスpx整数へ丸めて保持（CSS 変数にも反映）
  currentOx = Math.round(((vw - STAGE_W * scale) / 2) * dpr) / dpr;
  currentOy = Math.round(((vh - STAGE_H * scale) / 2) * dpr) / dpr;

  // スケール適用（モード分岐）。zoom は Windows のみ既定で、検証に失敗したら
  // この呼び出しの中で transform へ切り戻る（次回以降は transform のまま）。
  if (resolveStageMode() === "zoom") {
    applyZoomStage();
    if (!verifyZoomStage()) {
      stageMode = "transform";
      applyTransformStage();
    }
  } else {
    applyTransformStage();
  }
  return currentScale;
}

/**
 * ビューポート座標（event.clientX など）をステージ座標へ変換する。
 * ステージは画面中央にレターボックス配置されるため原点オフセットを含む。
 * ※--stage-ox / --stage-oy（fitStage の丸め値）を使う。スケール適用が
 *   transform モードか zoom モードかに関わらず同じ変換式で正しい。
 */
export function clientToStage(clientX, clientY) {
  const s = currentScale || 1;
  return {
    x: (clientX - currentOx) / s,
    y: (clientY - currentOy) / s
  };
}

/**
 * 要素の getBoundingClientRect() をステージ座標系へ変換して返す。
 * rect はスケール適用後の表示サイズを返すため（transform / zoom 共通）、
 * ステージ内の論理座標で位置計算する場合はこちらを使う。
 */
export function stageRect(el) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const s = currentScale || 1;
  return {
    left: r.left / s,
    top: r.top / s,
    right: r.right / s,
    bottom: r.bottom / s,
    width: r.width / s,
    height: r.height / s
  };
}

// モジュール読み込み時に即時適用（type=module は DOM 構築後に実行される）
fitStage();
window.addEventListener("resize", fitStage);
window.addEventListener("orientationchange", fitStage);
onFullscreenChange(fitStage);