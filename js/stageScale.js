// stageScale.js
// =====================================================
// ステージスケール管理
// =====================================================
// アプリ全体をデザインサイズ 1600×900（16:9）で描画し、
// ウィンドウ / フルスクリーンのサイズに合わせて
// アスペクト比を維持したまま全体を拡大縮小する。
//
// - body への transform（--stage-ox / --stage-oy / --stage-scale）の適用は style.css 側。
// - このモジュールは --stage-scale の計算・更新と
//   「ビューポート座標 ⇔ ステージ座標」変換ユーティリティを提供する。
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

  document.documentElement.style.setProperty("--stage-scale", String(currentScale));
  document.documentElement.style.setProperty("--stage-ox", currentOx + "px");
  document.documentElement.style.setProperty("--stage-oy", currentOy + "px");
  return currentScale;
}

/**
 * ビューポート座標（event.clientX など）をステージ座標へ変換する。
 * ステージは画面中央にレターボックス配置されるため原点オフセットを含む。
 * ※style.css の transform（--stage-ox / --stage-oy）と同じ丸め値を使う。
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
 * transform スケール下では rect が表示上のサイズを返すため、
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