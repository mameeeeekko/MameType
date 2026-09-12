// defenseRenderer.js

import { getDisplayFullRoma } from "./typingLogic.js";
import { getSoundEnabled, gameState, getNow } from "./gameCore.js";
import { DEFENSE_COMBO_TIERS, DEFENSE_OVERDRIVE_COMBO, DEFENSE_SCORE_CONFIG } from "./defenseCore.js";
import { spawnComboTierUpEffect, playComboTierUpSound } from "./effectManager.js";
import { stageRect } from "./stageScale.js";

// ============================================================
// オフスクリーンキャッシュ（パフォーマンス最適化）
// ------------------------------------------------------------
// 背景ハニカムグリッド線（静的部分）と侵食グリッドをキャッシュし、
// 毎フレームの全セル再計算コストを削減する。
// ============================================================

// 背景グリッド（グリッド線のみ。明滅アクセントは毎フレーム別途描画）
let _bgGridCanvas = null;
let _bgGridW = 0;
let _bgGridH = 0;
// 明滅アクセント対象セル（約5%）の事前列挙。毎フレームの全セル seededRandom 走査を避ける
let _bgAccentCells = [];

// 侵食グリッド（corruption が変化したときのみ再計算）
let _corruptCanvas = null;
let _corruptW = 0;
let _corruptH = 0;
let _lastCorruption = -1;     // 前回描画時の corruption 値
let _lastAnimType = null;     // 前回の animType
let _lastAnimProgress = -1;   // 前回の animProgress（0.005 以上変化で再描画）
const CORRUPT_REDRAW_THRESHOLD = 0.004; // 再描画を発生させる最低変化量

// ★防衛モードのローマ字表示キャッシュ
// getDisplayFullRoma は漢字問題で重いため、入力状態が変わったときだけ再計算する
let _defenseRomaCacheKey = "";
let _defenseCachedRemainingRoma = "";

/**
 * 座標をシードにした簡易的な乱数を生成します。
 * @param {number} x
 * @param {number} y
 * @returns {number} 0から1の間の値
 */
function seededRandom(x, y) {
    const seed = x * 12.9898 + y * 78.233;
    let t = Math.sin(seed) * 43758.5453;
    return t - Math.floor(t);
}

export function renderDefenseUI(ctx, state) {
  const cw = ctx.canvas.clientWidth;
  const ch = ctx.canvas.clientHeight;

  const centerX = cw / 2;
  const centerY = ch / 2;

  renderCyberGridBackground(ctx);

  // 2. 侵食エフェクト
  const isEnding = state.endingAnimation && state.endingAnimation.active;
  const animType = isEnding ? state.endingAnimation.type : null;
  const animProgress = isEnding ? state.endingAnimation.progress : 0;

  const corruption = state.corruptionRate;
  const maxCanvasRadius = Math.hypot(cw / 2, ch / 2);
 
  // ハニカムグリッドのパラメータ
  const hexSize = 15; // 六角形のサイズを小さくして密度を上げる
  // pointy-topped hexagon（先端が上下）のタイリング計算
  const hexWidth = Math.sqrt(3) * hexSize;
  const hexHeight = 2 * hexSize;
  const horizDist = hexWidth;
  const vertDist = hexHeight * 3 / 4;
 
  // 画面全体をカバーするグリッドの範囲
  const startX = -hexSize * 2; // 画面左端外から開始
  const startY = -hexSize * 2; // 画面上端外から開始
  const endX = cw + hexSize * 2; // 画面右端外まで描画
  const endY = ch + hexSize * 2; // 画面下端外まで描画
 
  // 侵食の進行度に応じて、中心からどのくらい離れた領域まで侵食が及ばないかを決定
  const unCorrodedRadius = maxCanvasRadius * Math.max(0, 1 - corruption);
 
  // 侵食のグラデーション色
  const corruptionColor = animType === "failure"
    ? (animProgress > 0.5 ? "255, 30, 30" : "255, 60, 60")
    : "255, 80, 80"; // 赤系
 
  // 侵食のランダム性を調整する係数
  // 失敗で完全侵食に向かうときはランダムオフセットを徐々に小さくして隙間なく埋める
  const randomFactor = animType === "failure" ? Math.max(20, 150 * (1 - animProgress)) : 150;

  // ★侵食グリッドはオフスクリーンキャンバスにキャッシュし、
  //   侵食率・演出状態がしきい値以上変化したときだけ再描画する。
  //   毎フレームの全セル再計算（≈1万セル × Math.hypot/Math.sin）を
  //   1回の drawImage に置き換える。
  if (!_corruptCanvas || _corruptW !== cw || _corruptH !== ch) {
    _corruptCanvas = document.createElement("canvas");
    _corruptCanvas.width = cw;
    _corruptCanvas.height = ch;
    _corruptW = cw;
    _corruptH = ch;
    _lastCorruption = -1; // サイズ変更時は必ず再描画させる
  }

  const corruptionDirty =
    _lastCorruption === -1 ||
    animType !== _lastAnimType ||
    Math.abs(corruption - _lastCorruption) >= CORRUPT_REDRAW_THRESHOLD ||
    Math.abs(animProgress - _lastAnimProgress) >= CORRUPT_REDRAW_THRESHOLD;

  if (corruptionDirty) {
    redrawCorruptionGrid(_corruptCanvas.getContext("2d"), {
      cw, ch, centerX, centerY,
      hexSize, horizDist, vertDist,
      startX, startY, endX, endY,
      corruption, maxCanvasRadius, unCorrodedRadius,
      corruptionColor, randomFactor,
      animType, animProgress
    });
    _lastCorruption = corruption;
    _lastAnimType = animType;
    _lastAnimProgress = animProgress;
  }

  // キャッシュ済み侵食グリッドを 1 回の drawImage で転写
  ctx.drawImage(_corruptCanvas, 0, 0);

  // 3. 中央のコア（三重装甲光輪）
  renderTrinityShield(ctx, state);

  // 5. UI（残り時間、侵食率、残り文字数）
  renderDefenseStats(ctx, state);

  // 6. 右側の縦書きタイピングUI
  renderWordList(ctx, state);

  // 7. コンボバーの位置とサイズを調整
  const tierWrapper = document.getElementById("defenseComboTierWrapper");
  if (tierWrapper) {
    const rightUiX = cw - 180; // 右側UIの基準X座標
    const romaX = rightUiX + 15; // ローマ字の開始X座標
    const barWidth = 120;      // バーの幅をさらに短くする
    const displayCenterY = ch / 2;
    const barOffsetY = 18; // オフセットを調整し、入力文字の真下に配置

    tierWrapper.style.width = `${barWidth}px`;
    tierWrapper.style.left = `${romaX}px`; // ローマ字の開始位置に合わせる
    tierWrapper.style.top = `${displayCenterY + barOffsetY}px`;
  }

  // 8. 終了アニメーション演出（パージウェーブ、パーティクル、フラッシュ等）
  renderEndingEffects(ctx, state);

  // 9. 現在再生中のBGM情報（画面左下）
  renderBgmInfo(ctx);
}

/**
 * 侵食グリッドをオフスクリーンコンテキストへ描画する。
 * renderDefenseUI のキャッシュ更新時（corruptionDirty）のみ呼ばれる重い処理。
 * @param {CanvasRenderingContext2D} offCtx - オフスクリーン描画コンテキスト
 * @param {object} p - グリッド描画に必要なパラメータ一式
 */
function redrawCorruptionGrid(offCtx, p) {
  offCtx.clearRect(0, 0, p.cw, p.ch);

  for (let row = 0; p.startY + row * p.vertDist < p.endY; row++) {
    for (let col = 0; p.startX + col * p.horizDist < p.endX; col++) {
      const cx = p.startX + col * p.horizDist + (row % 2 === 1 ? p.horizDist / 2 : 0);
      const cy = p.startY + row * p.vertDist;

      const distFromCenter = Math.hypot(cx - p.centerX, cy - p.centerY);
      const randomOffset = (seededRandom(cx, cy) - 0.5) * p.randomFactor;

      // unCorrodedRadiusの外側にある六角形ほど、より侵食されているように見せる
      if (distFromCenter > p.unCorrodedRadius + randomOffset || (p.animType === "failure" && p.corruption > 0.88)) {
        // unCorrodedRadiusからmaxCanvasRadiusまでの距離でアルファ値を調整
        const distanceFactor = Math.max(0, (distFromCenter - p.unCorrodedRadius) / Math.max(1, p.maxCanvasRadius - p.unCorrodedRadius));

        let alpha = Math.min(0.5, 0.1 + distanceFactor * 0.4); // 0.1から0.5の範囲で変化
        if (p.animType === "failure") {
          alpha = Math.min(0.85, 0.15 + distanceFactor * 0.45 + p.animProgress * 0.35);
        } else if (p.animType === "success") {
          alpha = alpha * Math.max(0, 1 - p.animProgress * 1.2);
        }

        if (alpha > 0.01) {
          offCtx.fillStyle = `rgba(${p.corruptionColor}, ${alpha})`;
          drawHexagon(offCtx, cx, cy, p.hexSize, true); // 塗りつぶし
        }
      }
    }
  }
}

/**
 * 現在再生中のBGM情報を描画する（画面左下）
 * @param {CanvasRenderingContext2D} ctx - 描画コンテキスト
 */
function renderBgmInfo(ctx) {
    const info = gameState.currentBgmInfo;
    // startTimeが0（リセット済み）またはinfoがない場合は描画しない
    if (!info || !gameState.startTime) return;

    const now = getNow();

    // 画面左下に配置
    const x = 12;
    const y = ctx.canvas.clientHeight - 12;

    ctx.save();

    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";

    // フェードインのためのアルファ値計算
    // BGMが切り替わってから最初の2秒でフェードイン、その後は表示継続
    const fadeDuration = 2000;
    const elapsed = now - (gameState.startTime || 0);

    let alpha = 1;
    if (elapsed < fadeDuration) {
        alpha = elapsed / fadeDuration; // フェードイン
    }

    ctx.globalAlpha = Math.max(0, alpha);

    // 曲名
    ctx.font = "bold 14px 'M PLUS Rounded 1c', sans-serif";
    ctx.fillStyle = "#e4e4e4";
    ctx.fillText(`♪ ${info.title} / ${info.composer}`, x, y);

    ctx.restore();
}
/**
 * 攻殻機動隊風のサイバーなグリッド背景を描画します。
 * グリッド線部分はオフスクリーンキャンバスにキャッシュし、
 * 毎フレームは drawImage + 明滅アクセント（全体の5%）のみ描画する。
 * @param {CanvasRenderingContext2D} ctx - 描画コンテキスト
 */
function renderCyberGridBackground(ctx) {
  const cw = ctx.canvas.clientWidth;
  const ch = ctx.canvas.clientHeight;
  const time = performance.now();

  // 1. 背景色
  ctx.fillStyle = "#020a17"; // 深い紺色
  ctx.fillRect(0, 0, cw, ch);

  // 2. 静的なハニカムグリッド線 — オフスクリーンキャッシュ
  const hexSize = 40;
  const hexWidth = Math.sqrt(3) * hexSize;
  const hexHeight = 2 * hexSize;
  const horizDist = hexWidth;
  const vertDist = hexHeight * 3 / 4;

  // サイズが変わったときのみキャッシュを再生成
  if (!_bgGridCanvas || _bgGridW !== cw || _bgGridH !== ch) {
    _bgGridCanvas = document.createElement("canvas");
    _bgGridCanvas.width = cw;
    _bgGridCanvas.height = ch;
    _bgGridW = cw;
    _bgGridH = ch;

    const offCtx = _bgGridCanvas.getContext("2d");
    offCtx.strokeStyle = "rgba(0, 150, 200, 0.1)";
    offCtx.lineWidth = 1;

    // 明滅アクセント対象セルもこのタイミングで列挙しておく
    _bgAccentCells = [];

    for (let row = -2; row * vertDist < ch + hexHeight; row++) {
      for (let col = -2; col * horizDist < cw + hexWidth; col++) {
        const cx = col * horizDist + (row % 2 === 1 ? horizDist / 2 : 0);
        const cy = row * vertDist;
        drawHexagon(offCtx, cx, cy, hexSize);
        if (seededRandom(col, row) > 0.95) {
          _bgAccentCells.push({ cx, cy, col, row });
        }
      }
    }
  }

  // キャッシュ済みグリッド線を 1 回の drawImage で転写
  ctx.drawImage(_bgGridCanvas, 0, 0);

  ctx.save();

  // 3. ランダムな明滅アクセント（対象は事前列挙済みの全体の約5%のみ）
  for (let i = 0; i < _bgAccentCells.length; i++) {
    const cell = _bgAccentCells[i];
    const blinkAlpha = (Math.sin(time * 0.0005 + cell.col + cell.row) + 1) / 2 * 0.3;
    ctx.fillStyle = `rgba(0, 200, 255, ${blinkAlpha})`;
    drawHexagon(ctx, cell.cx, cell.cy, hexSize, true);
  }

  // 4. 四隅のコーナーアクセント
  const cornerSize = 30;
  const cornerAlpha = (Math.sin(time * 0.0003) + 1) / 2 * 0.5 + 0.2; // 0.2 ~ 0.7
  ctx.strokeStyle = `rgba(0, 220, 255, ${cornerAlpha})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  // 左上
  ctx.moveTo(cornerSize, 0); ctx.lineTo(0, 0); ctx.lineTo(0, cornerSize);
  // 右上
  ctx.moveTo(cw - cornerSize, 0); ctx.lineTo(cw, 0); ctx.lineTo(cw, cornerSize);
  // 左下
  ctx.moveTo(cornerSize, ch); ctx.lineTo(0, ch); ctx.lineTo(0, ch - cornerSize);
  // 右下
  ctx.moveTo(cw - cornerSize, ch); ctx.lineTo(cw, ch); ctx.lineTo(cw, ch - cornerSize);
  ctx.stroke();

  ctx.restore();
}


function renderDefenseStats(ctx, state) {
  const isEnding = state.endingAnimation && state.endingAnimation.active;
  if (isEnding) {
    const fade = Math.max(0, 1 - state.endingAnimation.progress * 3);
    if (fade <= 0.001) return;
    ctx.save();
    ctx.globalAlpha = fade;
  }

  const cw = ctx.canvas.clientWidth;
  const ch = ctx.canvas.clientHeight;

  ctx.font = "bold 18px 'Noto Sans Mono', monospace";
  ctx.textAlign = "center";

  // 残り時間
  const time = (state.remainingTime / 1000).toFixed(1);
  ctx.fillStyle = time < 10 ? "#ff4d4d" : "#e0e0e0";
  ctx.fillText(`TIME: ${time}`, cw / 2, 30);

  // 侵食率
  const corruption = (state.corruptionRate * 100).toFixed(1);
  ctx.fillStyle = corruption > 80 ? "#ff4d4d" : "#e0e0e0";
  ctx.fillText(`CORRUPTION: ${corruption}%`, cw / 2, 60);

  // 目標文字数との差分 (マージン)
  const marginChars = state.countedTypedChars - state.totalCharsToType;
  const marginText = marginChars >= 0 ? `+${marginChars}` : marginChars;
  // 目標達成後は色を変える
  ctx.fillStyle = marginChars >= 0 ? "#a5d6ff" : "#e0e0e0";
  ctx.fillText(`MARGIN: ${marginText}`, cw / 2, 90);

  // --- 右上のスコア表示 ---
  const score = state.gScore || 0;
  const scoreX = cw - 12;
  const scoreY = 12;

  ctx.save();
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.font = "bold 12px 'Noto Sans Mono', monospace";
  ctx.fillStyle = "#f0f6fc";
  ctx.fillText("SCORE", scoreX, scoreY + 25);
  ctx.font = "bold 30px 'Noto Sans Mono', monospace";
  ctx.fillText(score.toLocaleString(), scoreX, scoreY + 25 + 14);

  // --- 右上のコンボ数表示 ---
  const combo = state.currentCombo || 0;
  const comboY = scoreY + 25 + 14 + 45; // スコアの下に配置（さらに距離を離す）

  ctx.font = "bold 12px 'Noto Sans Mono', monospace";
  ctx.fillStyle = "#f0f6fc";
  ctx.fillText("COMBO", scoreX, comboY);
  ctx.font = "bold 30px 'Noto Sans Mono', monospace";
  ctx.fillText(combo.toLocaleString(), scoreX, comboY + 14);

  ctx.restore();

  if (isEnding) {
    ctx.restore();
  }
}


/**
 * コアの三重装甲光輪「トリニティ・シールド」を描画します。
 * @param {CanvasRenderingContext2D} ctx - 描画コンテキスト
 * @param {object} state - 防衛モードの状態オブジェクト
 */
function renderTrinityShield(ctx, state) {
  const cw = ctx.canvas.clientWidth;
  const ch = ctx.canvas.clientHeight;
  const isEnding = state.endingAnimation && state.endingAnimation.active;
  const animType = isEnding ? state.endingAnimation.type : null;
  const animProgress = isEnding ? state.endingAnimation.progress : 0;

  let x = cw / 2;
  let y = ch / 2;

  // 失敗時のシェイク（激しい振動）
  if (animType === "failure") {
    const shake = Math.max(0, (1 - animProgress * 0.7) * 12);
    x += (Math.random() - 0.5) * shake;
    y += (Math.random() - 0.5) * shake;
  }

  const time = performance.now();
  const corruption = state.corruptionRate;

  ctx.save();

  // 侵食率に応じて全体的なアルファ値を調整
  let baseAlpha = 1 - corruption * 0.8; // 侵食が進むと全体的に薄くなる
  if (animType === "success") {
    baseAlpha = Math.min(1.0, baseAlpha + animProgress * 0.5); // 成功時は明るく復元
  } else if (animType === "failure") {
    baseAlpha = Math.max(0, baseAlpha * (1 - animProgress * 1.2)); // 失敗時はブラックアウト
  }

  if (baseAlpha <= 0.01) {
    ctx.restore();
    return;
  }

  // ======================================
  // 第三層: コア (デジタル・パルス)
  // ======================================
  let corePulse = Math.sin(time * 0.002) * 5;
  if (animType === "success") {
    corePulse += Math.sin(animProgress * Math.PI * 4) * 8;
  }
  const coreRadius = Math.max(10, (30 + corePulse) * (animType === "success" ? (1 + animProgress * 0.2) : 1));
  let coreAlpha = baseAlpha * (0.8 - corruption * 0.5);
  if (animType === "success") {
    coreAlpha = Math.min(1.0, 0.8 + animProgress * 0.3);
  }

  // コアのメインの輝き
  const coreGrad = ctx.createRadialGradient(x, y, 0, x, y, coreRadius);
  if (animType === "success") {
    coreGrad.addColorStop(0, `rgba(220, 250, 255, ${coreAlpha * 1.4})`);
    coreGrad.addColorStop(0.5, `rgba(100, 220, 255, ${coreAlpha})`);
    coreGrad.addColorStop(1, `rgba(0, 80, 200, 0)`);
  } else if (animType === "failure" && corruption > 0.5) {
    coreGrad.addColorStop(0, `rgba(255, 180, 180, ${coreAlpha * 1.2})`);
    coreGrad.addColorStop(0.7, `rgba(200, 40, 40, ${coreAlpha * 0.8})`);
    coreGrad.addColorStop(1, `rgba(80, 0, 0, 0)`);
  } else {
    coreGrad.addColorStop(0, `rgba(150, 220, 255, ${coreAlpha * 1.2})`);
    coreGrad.addColorStop(0.7, `rgba(50, 150, 200, ${coreAlpha * 0.8})`);
    coreGrad.addColorStop(1, `rgba(0, 50, 100, 0)`);
  }
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.arc(x, y, coreRadius, 0, Math.PI * 2);
  ctx.fill();

  // コア内部のデジタルパターン (グリッド)
  const gridAlpha = coreAlpha * 0.6;
  ctx.strokeStyle = animType === "failure" && corruption > 0.5
    ? `rgba(255, 150, 150, ${gridAlpha})`
    : `rgba(200, 255, 255, ${gridAlpha})`;
  ctx.lineWidth = 0.8;
  const gridSpacing = 8;
  const numLines = Math.floor(coreRadius / gridSpacing);

  for (let i = 0; i <= numLines; i++) {
    const r = i * gridSpacing;
    if (r > coreRadius) break;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 侵食によるコアの不安定化 (赤色ノイズ)
  if (corruption > 0.3 && animType !== "success") {
    const noiseAlpha = corruption * 0.6;
    ctx.fillStyle = `rgba(255, 50, 50, ${noiseAlpha})`;
    const noiseCount = animType === "failure" ? 12 : 5;
    for (let i = 0; i < noiseCount; i++) {
      const r = Math.random() * coreRadius;
      const angle = Math.random() * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(x + Math.cos(angle) * r, y + Math.sin(angle) * r, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ======================================
  // 第二層: データストリームリング
  // ======================================
  const innerRingRadius = 70;
  const innerRingAlpha = baseAlpha * (0.7 - corruption * 0.4);
  const innerRingRotation = time * (animType === "success" ? 0.0006 : 0.0002);
  const segmentLength = 15; // セグメントの長さ
  const gapLength = 5;      // セグメント間の隙間

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(innerRingRotation);

  ctx.strokeStyle = animType === "failure" && corruption > 0.4
    ? `rgba(255, 100, 100, ${innerRingAlpha})`
    : `rgba(150, 255, 255, ${innerRingAlpha})`; // シアン系
  ctx.lineWidth = animType === "success" ? 2.2 : 1.5;
  ctx.shadowColor = `rgba(150, 255, 255, ${innerRingAlpha * 0.6})`;
  ctx.shadowBlur = animType === "success" ? 14 : 8;

  ctx.beginPath();
  for (let angle = 0; angle < Math.PI * 2; angle += (segmentLength + gapLength) / innerRingRadius) {
    ctx.arc(0, 0, innerRingRadius, angle, angle + segmentLength / innerRingRadius);
  }
  ctx.stroke();

  // 侵食によるデータストリームの乱れ (赤色グリッチ)
  if (corruption > 0.2 && animType !== "success") {
    const glitchAlpha = corruption * 0.4;
    ctx.strokeStyle = `rgba(255, 100, 100, ${glitchAlpha})`;
    ctx.lineWidth = 1;
    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI * 2;
      const startAngle = angle;
      const endAngle = angle + Math.random() * 0.2;
      ctx.beginPath();
      ctx.arc(0, 0, innerRingRadius + (Math.random() - 0.5) * 5, startAngle, endAngle);
      ctx.stroke();
    }
  }

  ctx.restore(); // 第二層の変換を元に戻す

  // ======================================
  // 第一層: 多重ポリゴンバリア
  // ======================================
  const barrierPositions = [120, 160]; // コアからの固定半径 (50%, 80%領域に相当)

  barrierPositions.forEach((pos, i) => {
    const ringRadius = pos;
    let ringAlpha = baseAlpha * (0.5 - i * 0.1) * (1 - corruption * 0.5);
    if (animType === "success") {
      ringAlpha = Math.min(0.8, (0.5 - i * 0.1) + animProgress * 0.4);
    }
    const ringRotation = time * (0.0001 + i * 0.00008) * (animType === "success" ? 2.0 : 1.0);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ringRotation);

    ctx.strokeStyle = animType === "failure" && corruption > 0.4
      ? `rgba(255, 80, 80, ${ringAlpha})`
      : `rgba(120, 200, 255, ${ringAlpha})`;
    ctx.lineWidth = (1 + i * 0.5) * (animType === "success" ? 1.5 : 1);
    ctx.shadowColor = `rgba(120, 200, 255, ${ringAlpha * 0.5})`;
    ctx.shadowBlur = animType === "success" ? 12 : 6;

    // 六角形を描画
    drawHexagon(ctx, 0, 0, ringRadius);

    // 侵食によるバリアの破損 (赤色ライン)
    // ★Math.random の代わりに seededRandom を使用し、侵食率が変わるまで
    //   ひびの位置を固定する（毎フレームのチカチカを防止）
    if (corruption > 0.1 && animType !== "success") {
      const breakAlpha = corruption * (animType === "failure" ? 0.6 : 0.2);
      ctx.strokeStyle = `rgba(255, 80, 80, ${breakAlpha})`;
      ctx.lineWidth = animType === "failure" ? 2 : 1;
      const breakCount = animType === "failure" ? 8 : 3;
      const corruptionSeed = Math.floor(corruption * 40); // 侵食率2.5%ごとに模様が更新される
      for (let j = 0; j < breakCount; j++) {
        const angle = seededRandom(i * 31 + j, corruptionSeed) * Math.PI * 2;
        const len = seededRandom(j * 17 + 7, corruptionSeed + i) * ringRadius * 0.4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * (ringRadius - len), Math.sin(angle) * (ringRadius - len));
        ctx.lineTo(Math.cos(angle) * ringRadius, Math.sin(angle) * ringRadius);
        ctx.stroke();
      }
    }

    ctx.restore();
  });

  ctx.restore();
}

/**
 * ヘルパー関数：六角形を描画
 * @param {CanvasRenderingContext2D} ctx 
 * @param {number} x 
 * @param {number} y 
 * @param {number} size 
 */
function drawHexagon(ctx, x, y, size, fill = false) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i + Math.PI / 6; // pointy-topped hexagon
    const px = x + size * Math.cos(angle);
    const py = y + size * Math.sin(angle);
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
  if (fill) {
    ctx.fill();
  } else {
    ctx.stroke();
  }
}

function renderWordList(ctx, state) {
  const isEnding = state.endingAnimation && state.endingAnimation.active;
  if (isEnding) {
    const fade = Math.max(0, 1 - state.endingAnimation.progress * 3);
    if (fade <= 0.001) return;
    ctx.save();
    ctx.globalAlpha = fade;
  }

  const cw = ctx.canvas.clientWidth;
  const ch = ctx.canvas.clientHeight;

  const list = state.wordList[0];
  // ★ 表示は「ターゲット（スペースを含む1文字列）」ごとに行を分ける。
  //    targets が無い場合は従来どおり split(" ") でフォールバック。
  const words = list.targets
    ? list.targets.map(t => t.word)
    : list.word.split(' ');
  const textWords = list.targets
    ? list.targets.map(t => t.text)
    : list.text.split(' ');
  let charCount = 0;
  let currentWordIndex = -1;

  // 現在どの単語をタイピングしているか判定
  // （ターゲット内のスペースは wordLength に含まれるため分割されない）
  for (let i = 0; i < textWords.length; i++) {
    const wordLength = textWords[i].length; // ひらがなの文字数で判定
    if (state.typedChars < charCount + wordLength + 1) { // +1 for space (ターゲット間の区切り)
      currentWordIndex = i;
      break;
    }
    charCount += wordLength + 1; // +1 for space
  }

  const lineSpacing = 40; // 行間を広げる
  const displayCenterY = ch / 2; // 画面中央を基準にする
  const maxLinesAbove = Math.floor((displayCenterY - 50) / lineSpacing);
  const maxLinesBelow = Math.floor((ch - displayCenterY - 50) / lineSpacing);

  const extraGap = 20; // 現在の単語の上下に追加する隙間

  // 現在の単語を中心に表示
  for (let i = -maxLinesAbove; i <= maxLinesBelow; i++) {
    const wordIndex = currentWordIndex + i;
    if (wordIndex < 0 || wordIndex >= words.length) continue;

    const word = words[wordIndex];
    let y = displayCenterY + i * lineSpacing;

    // 現在の単語より下の行に隙間を追加
    if (i > 0) y += extraGap;
    // 現在の単語より上の行に隙間を追加
    if (i < 0) y -= extraGap;

    const isCurrent = (wordIndex === currentWordIndex);

    // --- 日本語（漢字交じり）表示 ---
    const jpX = cw - 180; // 少し左にずらす
    ctx.font = isCurrent ? "bold 22px 'M PLUS Rounded 1c', sans-serif" : "18px 'M PLUS Rounded 1c', sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom"; // 下揃えにして、ローマ字との位置関係を安定させる
    ctx.fillStyle = isCurrent ? "#e0e0e0" : "#4a4a4a";
    ctx.fillText(word, jpX, y);

    // --- 現在の単語のみローマ字を表示 ---
    if (isCurrent) {
      // ハイライト用の背景
      ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
      const textWidth = ctx.measureText(word).width;
      ctx.fillRect(jpX - textWidth - 10, y - lineSpacing * 0.8, textWidth + 220, lineSpacing * 1.5);

      // 再度単語を描画（ハイライトの上から）
      ctx.fillStyle = "#e0e0e0";
      ctx.fillText(word, jpX, y);

      // --- ローマ字表示 ---
      const romaX = jpX + 15;
      ctx.font = "16px 'Noto Sans Mono', monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";

      // 現在の単語のひらがな部分を取得
      const currentWordText = textWords[currentWordIndex] || "";

      // ★キャッシュキー：現在単語 + 入力位置 + 入力文字列
      // getDisplayFullRoma は漢字問題で重いため、入力状態が変わったときだけ再計算する
      const romaCacheKey = `${currentWordIndex}|${state.currentWordPos}|${state.inputedRomaji}|${state.typed}`;

      let remainingRoma;
      if (romaCacheKey === _defenseRomaCacheKey) {
        remainingRoma = _defenseCachedRemainingRoma;
      } else {
        _defenseRomaCacheKey = romaCacheKey;
        const fullRemainingRoma = getDisplayFullRoma({
          text: currentWordText,
          pos: state.currentWordPos,
          typed: state.typed,
          inputedRomaji: state.inputedRomaji,
        });
        remainingRoma = fullRemainingRoma.substring(state.inputedRomaji.length + state.typed.length);
        _defenseCachedRemainingRoma = remainingRoma;
      }

      ctx.fillStyle = "#888";
      ctx.fillText(remainingRoma, romaX, y);
    }
  }

  if (isEnding) {
    ctx.restore();
  }
}

/**
 * 終了演出のエフェクト（パージウェーブ、パーティクル、フラッシュ等）を描画します。
 * @param {CanvasRenderingContext2D} ctx - 描画コンテキスト
 * @param {object} state - 防衛モードの状態オブジェクト
 */
export function renderEndingEffects(ctx, state) {
  const anim = state.endingAnimation;
  if (!anim || !anim.active) return;

  const cw = ctx.canvas.clientWidth;
  const ch = ctx.canvas.clientHeight;
  const centerX = cw / 2;
  const centerY = ch / 2;
  const maxRadius = Math.hypot(centerX, centerY);
  const progress = anim.progress || 0; // 0.0 -> 1.0

  ctx.save();

  if (anim.type === "success") {
    // ==========================================
    // 成功演出：パージウェーブ（Purge Wave）
    // ==========================================
    const waveRadius = progress * maxRadius * 1.35;
    const waveAlpha = Math.max(0, (1 - progress) * 0.85);

    if (waveRadius > 0) {
      // 1本目の強烈なパージリング
      const grad = ctx.createRadialGradient(centerX, centerY, Math.max(0, waveRadius - 60), centerX, centerY, waveRadius + 25);
      grad.addColorStop(0, "rgba(0, 200, 255, 0)");
      grad.addColorStop(0.65, `rgba(180, 240, 255, ${waveAlpha})`);
      grad.addColorStop(0.88, `rgba(0, 220, 255, ${waveAlpha * 1.2})`);
      grad.addColorStop(1, "rgba(0, 150, 255, 0)");

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, waveRadius + 25, 0, Math.PI * 2);
      ctx.fill();

      // 明確な光輪ライン
      ctx.strokeStyle = `rgba(255, 255, 255, ${waveAlpha * 0.95})`;
      ctx.lineWidth = Math.max(1, 4.5 * (1 - progress));
      ctx.beginPath();
      ctx.arc(centerX, centerY, waveRadius, 0, Math.PI * 2);
      ctx.stroke();

      // 2本目の追従リング（少し遅れて広がる）
      if (progress > 0.15) {
        const subProgress = (progress - 0.15) / 0.85;
        const subWaveRadius = subProgress * maxRadius * 1.25;
        const subWaveAlpha = Math.max(0, (1 - subProgress) * 0.5);

        ctx.strokeStyle = `rgba(120, 230, 255, ${subWaveAlpha})`;
        ctx.lineWidth = Math.max(1, 2.5 * (1 - subProgress));
        ctx.beginPath();
        ctx.arc(centerX, centerY, subWaveRadius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // 全体的な青白フラッシュ
    const flashAlpha = Math.sin(progress * Math.PI) * 0.22;
    if (flashAlpha > 0) {
      ctx.fillStyle = `rgba(0, 210, 255, ${flashAlpha})`;
      ctx.fillRect(0, 0, cw, ch);
    }

  } else if (anim.type === "failure") {
    // ==========================================
    // 失敗演出：全侵食・崩壊オーバーレイ
    // ==========================================
    // 赤黒いパルスとグリッチライン
    if (progress > 0.3) {
      const glitchAlpha = (progress - 0.3) * 0.55;
      ctx.strokeStyle = `rgba(255, 50, 50, ${glitchAlpha})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const y = Math.random() * ch;
        const x1 = Math.random() * (cw * 0.3);
        const x2 = x1 + Math.random() * (cw * 0.7);
        ctx.beginPath();
        ctx.moveTo(x1, y);
        ctx.lineTo(x2, y + (Math.random() - 0.5) * 4);
        ctx.stroke();
      }
    }

    // 終盤の赤黒い暗転フェード
    if (progress > 0.4) {
      const redAlpha = Math.min(0.65, (progress - 0.4) * 0.95);
      ctx.fillStyle = `rgba(120, 0, 10, ${redAlpha})`;
      ctx.fillRect(0, 0, cw, ch);
    }
    if (progress > 0.75) {
      const blackAlpha = Math.min(0.92, (progress - 0.75) * 3.8);
      ctx.fillStyle = `rgba(5, 0, 0, ${blackAlpha})`;
      ctx.fillRect(0, 0, cw, ch);
    }
  }

  // ==========================================
  // パーティクル描画
  // ==========================================
  if (anim.particles && anim.particles.length > 0) {
    for (const p of anim.particles) {
      if (p.alpha <= 0.01) continue;
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = anim.type === "success" ? 8 : 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  ctx.restore();
}

// ====================================================================
// 防衛モード専用コンボバー
// enemyRenderer.js からロジックを完全に分離
// ====================================================================

/**
 * 防衛モード用のコンボバーUIを初期化します。
 * HTMLに存在する要素を直接操作し、中身をクリアして再生成します。
 */
export function initDefenseComboTierBar() {
    // ★ 以前のコンボ数表示UI（chainUIコンテナ全体）を非表示にする
    const oldChainUI = document.getElementById("chainUI");
    if (oldChainUI) {
        oldChainUI.style.setProperty("display", "none", "important");
    }
    // ★ 通常モードのコンボ表示も非表示にする
    const comboUI = document.getElementById("comboUI");
    if (comboUI) comboUI.style.display = "none";

    const tierWrapper = document.getElementById("defenseComboTierWrapper");
    if (!tierWrapper) {
        console.error("Element with ID 'defenseComboTierWrapper' not found.");
        return;
    }

    // 中身をクリア
    tierWrapper.innerHTML = "";

    // 横型バーのコンテナを生成
    const barContainer = document.createElement("div");
    barContainer.className = "defense-combo-bar-container";

    const tierCount = DEFENSE_COMBO_TIERS.length;

    for (let i = 0; i < tierCount; i++) {
        const barBlock = document.createElement("div");
        barBlock.className = "defense-combo-bar-block";
        barBlock.innerHTML = `
            <div class="defense-combo-bar-fill"></div>
        `;
        barContainer.appendChild(barBlock);
    }
    
    // ★倍率表示用の要素をバーコンテナに追加
    const multiplierEl = document.createElement("div");
    multiplierEl.className = "defense-combo-multiplier";
    multiplierEl.innerHTML = `x<span id="defenseMultiplierValue">1.0</span>`;
    // ★位置・サイズ調整
    multiplierEl.style.position = 'absolute';
    multiplierEl.style.right = '-38px'; // さらに右に離す
    multiplierEl.style.top = '-7px';  // さらに上に移動
    multiplierEl.style.fontSize = '13px'; // 少し小さくする

    barContainer.appendChild(multiplierEl);

    tierWrapper.appendChild(barContainer);

    prevComboTier = -1;
}

let prevComboTier = -1;

export function updateDefenseComboTierBar(stats) {
  const tierWrapper = document.getElementById("defenseComboTierWrapper");
  if (!tierWrapper) return;

  const combo = stats.currentCombo;
  const blocks = tierWrapper.querySelectorAll(".defense-combo-bar-block");
  const isOverdrive = combo >= DEFENSE_OVERDRIVE_COMBO;
  // ★追加: 開始演出中は倍率表示を隠す
  const isTransitioning = stats.isTransitioning;
  const multiplierElWrapper = tierWrapper.querySelector(".defense-combo-multiplier");
  if (multiplierElWrapper) {
    multiplierElWrapper.style.visibility = isTransitioning ? 'hidden' : 'visible';
  }

  // --- コンボ倍率の計算と表示 ---
  const multiplierValueEl = document.getElementById("defenseMultiplierValue");
  if (multiplierValueEl) {
    let multiplier = 1.0;
    for (const tier of DEFENSE_SCORE_CONFIG.comboMultipliers) {
      if (combo >= tier.count) {
        multiplier = tier.value;
        break;
      }
    }
    multiplierValueEl.textContent = multiplier.toFixed(1);
  }
  // --------------------------

  let currentTier = -1;
  for (let i = 0; i < DEFENSE_COMBO_TIERS.length; i++) {
    if (combo >= DEFENSE_COMBO_TIERS[i].min) {
      currentTier = i;
    }
  }

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const fillEl = block.querySelector(".defense-combo-bar-fill");
    if (!fillEl) continue;

    block.classList.remove("filled", "active", "overdrive");
    fillEl.style.width = '0%';

    if (isOverdrive) {
      block.classList.add("overdrive");
    } else if (i < currentTier) {
      block.classList.add("filled");
      fillEl.style.width = '100%';
    } else if (i === currentTier) {
      block.classList.add("active");
      const tier = DEFENSE_COMBO_TIERS[i];
      const range = tier.max - tier.min;
      const value = combo - tier.min;
      const progress = Math.max(0, Math.min(1, value / range));
      fillEl.style.width = `${progress * 100}%`;
    }
  }

  if (currentTier > prevComboTier && currentTier > 0) {
    const flashBlock = blocks[currentTier - 1];
    if (flashBlock) {
      flashBlock.classList.remove("flash");
      void flashBlock.offsetWidth;
      flashBlock.classList.add("flash");

      const isNowOverdrive = combo >= DEFENSE_OVERDRIVE_COMBO;
      if (!isNowOverdrive) {
        const tierWrapperRect = stageRect(tierWrapper);
        const canvasRect = stageRect(document.getElementById("defenseModeCanvas"));
        const centerX = tierWrapperRect.left + tierWrapperRect.width / 2 - canvasRect.left;
        const centerY = tierWrapperRect.top + tierWrapperRect.height / 2 - canvasRect.top;
        spawnComboTierUpEffect(centerX, centerY, currentTier, false);
        playComboTierUpSound(currentTier, false);
      }
    }
  }

  const wasOverdrive = stats.prevCombo < DEFENSE_OVERDRIVE_COMBO;
  if (wasOverdrive && isOverdrive) {
    const tierWrapperRect = stageRect(tierWrapper);
    const canvasRect = stageRect(document.getElementById("defenseModeCanvas"));
    const centerX = tierWrapperRect.left + tierWrapperRect.width / 2 - canvasRect.left;
    const centerY = tierWrapperRect.top + tierWrapperRect.height / 2 - canvasRect.top;
    const lastTier = DEFENSE_COMBO_TIERS.length - 1;
    spawnComboTierUpEffect(centerX, centerY, lastTier, true);
    playComboTierUpSound(lastTier, true);
  }

  prevComboTier = currentTier;
  stats.prevCombo = combo;
}

// ===============================
// 🔊 防衛モード専用サウンドトグル
// ===============================
export function ensureDefenseSoundToggle() {
    const container = document.getElementById("defenseModeContainer");
    if (!container) return;

    let toggle = document.getElementById("defenseSoundToggle");
    if (!toggle) {
        toggle = document.createElement("div");
        toggle.id = "defenseSoundToggle";
        // エネミーモードのスタイルを再利用
        toggle.className = "enemy-sound-toggle sound-toggle-btn"; 
        toggle.onclick = (e) => {
            e.stopPropagation();
            // main.jsのグローバルハンドラを呼び出す
            window.handleGlobalSoundToggle?.(); 
        };
        container.appendChild(toggle);
    }

    const enabled = getSoundEnabled();
    toggle.innerHTML = `
        <img src="${enabled ? "./assets/pic/sound1.png" : "./assets/pic/soundmute.png"}" class="global-sound-toggle-img">
        <span class="global-sound-toggle-txt">${enabled ? "sound on" : "sound off"}</span>
    `;
    toggle.style.display = "flex";
}

export function hideDefenseSoundToggle() {
    const toggle = document.getElementById("defenseSoundToggle");
    if (toggle) toggle.style.display = "none";
}