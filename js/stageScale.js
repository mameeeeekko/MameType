// stageScale.js
// =====================================================
// ステージスケール管理
// =====================================================
// アプリ全体をデザインサイズ 1600×900（16:9）で描画し、
// ウィンドウ / フルスクリーンのサイズに合わせて
// アスペクト比を維持したまま全体を拡大縮小する。
//
// - body への transform: scale(var(--stage-scale)) の適用は style.css 側。
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

/** 現在のステージ拡大率（ステージ座標 → 表示座標の倍率） */
export function getStageScale() {
  return currentScale;
}

/** 現在のウィンドウ（またはフルスクリーン画面）にステージをフィットさせる */
export function fitStage() {
  const vw = window.innerWidth || STAGE_W;
  const vh = window.innerHeight || STAGE_H;

  // ウィンドウに収まる最大の 16:9 スケール
  // （ユーザーがウィンドウサイズを手動で変更しても resize で自動追従する）
  const scale = Math.min(vw / STAGE_W, vh / STAGE_H);

  currentScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  document.documentElement.style.setProperty("--stage-scale", String(currentScale));
  return currentScale;
}

/**
 * ビューポート座標（event.clientX など）をステージ座標へ変換する。
 * ステージは画面中央にレターボックス配置されるため原点オフセットを含む。
 */
export function clientToStage(clientX, clientY) {
  const s = currentScale || 1;
  const ox = (window.innerWidth - STAGE_W * s) / 2;
  const oy = (window.innerHeight - STAGE_H * s) / 2;
  return {
    x: (clientX - ox) / s,
    y: (clientY - oy) / s
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