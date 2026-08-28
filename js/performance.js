// performance.js
// ============================================================
// 描画コストの中枢を一元管理するパフォーマンスモジュール。
// 「描画品質」設定を「解像度（DPR）」だけでなく、
//   * グロー影（shadowBlur）
//   * パーティクル数
//   * エフェクト強度
//   * 最大FPS
// にまで反映させるためのヘルパを提供する。
// ------------------------------------------------------------
// 設計方針
//   * High / Medium / Low は「手動固定」…ユーザーが選んだ品質に固定
//   * Auto は「スペック自動判定」…実測FPSに応じて内部的に段階を下げる
//   * 各モジュールは個別の数値を書かず、必ずこのモジュールの
//     getProfile() / getShadow() / scaledParticleCount() などを参照する
// ============================================================

// ------------------------------------------------------------
// 品質レベルの保存・取得（canvasUtil.js から移管・一元管理）
// ------------------------------------------------------------
export const QUALITY_LEVELS = ["auto", "high", "medium", "low"];

const QUALITY_STORAGE_KEY = "typing_game_quality";

// 手動レベル選択時のDPR上限。auto は適応制御により動的に決まるため null
const QUALITY_DPR_CAPS = { auto: null, high: 2, medium: 1.5, low: 1 };

/** 現在の品質レベル名を返す（auto/high/medium/low） */
export function getRenderQuality() {
    try {
        const q = localStorage.getItem(QUALITY_STORAGE_KEY);
        return QUALITY_DPR_CAPS[q] !== undefined ? q : "auto";
    } catch (e) {
        return "auto";
    }
}

/** 描画品質設定を保存する（戻り値は確定後のレベル名） */
export function setRenderQuality(level) {
    const q = QUALITY_DPR_CAPS[level] !== undefined ? level : "auto";
    try {
        localStorage.setItem(QUALITY_STORAGE_KEY, q);
    } catch (e) { /* localStorage不可の環境は無視 */ }
    // 変更をアプリ全体へ通知（表示中キャンバスのDPR再フィット等に使用）
    notifyQualityChanged();
    return getRenderQuality();
}

// 各品質レベルで実際に使う「実効プロファイル」
//  - shadow       : true ならグロー影を描く（false で無効化）
//  - particleScale: パーティクル生成数の倍率（1.0 = 設計どおり）
//  - effectScale  : リング・波紋などのエフェクト強度・数の倍率
//  - fpsCap       : 描画ループの上限FPS（0 = 制限なし / 標準60）
//  - dprCap       : 解像度上限（canvasUtil と連動。※auto は適応値）
//  - label        : デバッグ表示用
const PROFILES = {
  auto:   { shadow: true, particleScale: 1.0, effectsScale: 1.0, fpsCap: 0, dprCap: 3, label: "Auto（自動）" },
  high:   { shadow: true, particleScale: 1.0, effectsScale: 1.0, fpsCap: 0, dprCap: 2.0, label: "High（高画質）" },
  medium: { shadow: true, particleScale: 0.7, effectsScale: 0.6, fpsCap: 0, dprCap: 1.5, label: "Medium（標準）" },
  low:    { shadow: false, particleScale: 0.4, effectsScale: 0.3, fpsCap: 30, dprCap: 1.0, label: "Low（軽量）" },
};

// ------------------------------------------------------------
// Auto の自動劣化（アダプティブ）
// ------------------------------------------------------------
//  自動判定の仕組み：
//   - FPS / フレーム時間の実測値に応じて、shadowOff / particleScale / fpsCap を
//     内部で「段階」として下げていく。
//   - 一度下がったら、長時間負荷が低い場合にのみ戻す（ハンチング防止）。
//   - ユーザーが手動で High/Medium/Low を選んだ場合はこの判定を完全に無効化する。

const AUTO_EVAL_FRAMES = 30;   // 評価を行う間隔（フレーム数 / 60fps時 ≈ 0.5秒）
const AUTO_LOWER_FPS = 35;     // 平均FPSがこれを下回る評価が続くと一段下げる
const AUTO_LOWER_EVALS = 8;    // 「下げ」判定に必要な連続評価回数（≈4秒）
const AUTO_RAISE_FPS = 45;     // 平均FPSがこれを上回る評価が続けば一段戻す
const AUTO_RAISE_EVALS = 60;   // 「上げ」判定に必要な連続評価回数（≈30秒・ハンチング防止）

// 自動劣化の「段階」を表すテーブル。auto はこの中の現在段階 index により値を決める。
// stageIndex 0 = 完全品質（現状と同じ）, 1, 2 … と下がっていく。
const AUTO_STAGES = [
  { dprCap: 3,    particleScale: 1.0, effectsScale: 1.0, shadow: true,  fpsCap: 0 },
  { dprCap: 2.0,  particleScale: 0.8, effectsScale: 0.8, shadow: true,  fpsCap: 0 },
  { dprCap: 1.5,  particleScale: 0.6, effectsScale: 0.6, shadow: true,  fpsCap: 0 },
  { dprCap: 1.0,  particleScale: 0.4, effectsScale: 0.4, shadow: false, fpsCap: 30 },
];

let autoStage = 0;        // 現在の auto 段階
let autoFrame = 0;        // 評価区間内のサンプルフレーム数
let autoFramesMs = 0;     // 評価区間内のフレーム時間積算
let autoLowStreak = 0;    // 「重い」評価の連続回数
let autoHighStreak = 0;   // 「余裕あり」評価の連続回数

/**
 * 現在の品質レベルの名前を返す（auto/high/medium/low）
 */
export function getQualityLevel() {
  return getRenderQuality();
}

/**
 * 現在のレベルが「自動」かどうか
 */
export function isAutoQuality() {
  return getRenderQuality() === "auto";
}

/**
 * 最終的に使う実効プロファイルを返す。
 * auto の場合は現在の autoStage の値。それ以外は手動PROFILEの値。
 */
export function getProfile() {
  const level = getRenderQuality();
  const base = PROFILES[level] || PROFILES.auto;

  if (level !== "auto") {
    return {
      ...base,
      stageIndex: -1,
    };
  }

  const s = AUTO_STAGES[autoStage] || AUTO_STAGES[AUTO_STAGES.length - 1];
  return {
    ...base,
    ...s,
    stageIndex: autoStage,
    label: `Auto${autoStage === 0 ? "" : `（自動最適化 Lv.${autoStage}）`}`,
  };
}

/**
 * 品質に応じてグロー影（shadowBlur）を使うかどうかを判定するヘルパ。
 * @param {number} wanted - 設計値での blur 値（品質Lowだと0になる）
 * @returns {number} 実際に使う blur 値
 */
export function getShadow(wanted) {
  return getProfile().shadow ? (wanted || 0) : 0;
}

/**
 * パーティクル生成数を品質に応じて縮小する。
 * @param {number} designCount 設計上の個数
 * @returns {number} 実際に作る個数（最低1）
 */
export function scaledParticleCount(designCount) {
  const scale = getProfile().particleScale;
  const n = Math.max(0, Math.round((designCount || 0) * scale));
  return n > 0 ? n : 1;
}

/**
 * エフェクトの数・頻度を品質に応じて縮小する（0.0〜1.0）。
 */
export function getEffectsScale() {
  return getProfile().effectsScale;
}

/**
 * 描画ループで実際に使う最大FPS。 0 = 制限なし
 */
export function getFpsCap() {
  return getProfile().fpsCap;
}

/**
 * DPR上限を返す（品質に応じて）。null = 制限なし（端末dprそのまま）
 */
export function getDprCap() {
  const p = getProfile();
  if (p.dprCap === null) return null;
  return p.dprCap;
}

// ============================================================
// 自動適応（auto）用のフレームタイミングフィードバック
// ============================================================

/**
 * ゲームループ側から毎フレーム呼び出す。
 * @param {number} deltaMs 直前フレームの経過時間
 * @returns {boolean} true なら「FPSを落とす等の再調整が必要」
 */
export function adaptiveFrameTick(deltaMs) {
  if (!isAutoQuality()) {
    autoLowStreak = 0;
    autoHighStreak = 0;
    return false;
  }

  autoFramesMs += deltaMs;
  autoFrame++;

  // AUTO_EVAL_FRAMES フレームごとに平均を取って判定する
  if (autoFrame < AUTO_EVAL_FRAMES) return false;
  const avgFrameMs = autoFramesMs / autoFrame;
  resetAutoMeasure();

  let changed = false;

  if (avgFrameMs > 1000 / AUTO_LOWER_FPS) {
    // 重い →「下げる」方向の連続カウント
    autoHighStreak = 0;
    autoLowStreak++;
    if (autoLowStreak >= AUTO_LOWER_EVALS && autoStage < AUTO_STAGES.length - 1) {
      autoStage++;
      autoLowStreak = 0; // 次の段階への到達も同条件で待つ
      changed = true;
    }
  } else if (avgFrameMs < 1000 / AUTO_RAISE_FPS) {
    // 余裕 →「上げる」方向の連続カウント
    autoLowStreak = 0;
    autoHighStreak++;
    if (autoHighStreak >= AUTO_RAISE_EVALS && autoStage > 0) {
      autoStage--;
      autoHighStreak = 0;
      changed = true;
    }
  } else {
    // 域内 → 両方リセット（ハンチング防止）
    autoLowStreak = 0;
    autoHighStreak = 0;
  }

  return changed;
}

function resetAutoMeasure() {
  autoFrame = 0;
  autoFramesMs = 0;
}

/**
 * アダプティブ制御をリセット（ゲーム開始直後など）する。
 */
export function resetAutoQuality() {
  autoStage = 0;
  resetAutoMeasure();
}

/**
 * 現在の auto の段階（デバッグ・設定UI表示用）
 */
export function getAutoStage() {
  return autoStage;
}

// ============================================================
// Canvas 全描画への「グロー影」一括反映
// ------------------------------------------------------------
// 40箇所以上に散らばった `ctx.shadowBlur = …` を個別に書き換えず、
// CanvasRenderingContext2D の shadowBlur セッターを品質に応じて
// 「low なら常に 0（影なし）」になるよう監視付きに差し替える。
// これにより全モード・全コールに一括で反映される。
// ============================================================
let shadowPatched = false;

/**
 * 品質が shadow オフのとき、全ての 2D 描画で影を無効化できるよう
 * shadowBlur セッターをラップする。起動時かつ一度だけ呼ぶ。
 * 品質を手動で切り替えた場合も次回描画から反映される。
 */
export function enableAdaptiveShadowControl() {
  if (shadowPatched) return;
  shadowPatched = true;

  const proto = CanvasRenderingContext2D.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, "shadowBlur");
  if (!desc || !desc.set) return;

  const origSet = desc.set;
  const origGet = desc.get;
  try {
    Object.defineProperty(proto, "shadowBlur", {
      configurable: true,
      enumerable: true,
      get: function () { return origGet.call(this); },
      set: function (v) {
        // 品質（autoを含む実効プロファイル）次第で影を無効化
        if (typeof v === "number" && !getProfile().shadow) v = 0;
        origSet.call(this, v);
      }
    });
  } catch (e) {
    /* defineProperty に失敗しても描画は継続 */
  }
}

// ============================================================
// フレーム間引き（FPSキャップ）＋ 実測による適応制御への入力
// ============================================================
//  * shouldRunFrame : fpsCap>0 のとき描画フレームを間引くゲート
//  * recordFrame    : 生のrAF間隔を実測して adaptiveFrameTick へ渡す。
//                     間引き「前」に呼ぶことで、本体スペック由来の
//                     遅れ（rAFが遅延する）だけを正しく計測できる。

let lastRunStamp = 0;
let lastRecordedTime = 0;

/**
 * 品質プロファイルが要求する場合に描画フレームを間引くためのゲート。
 * @param {number} timestamp requestAnimationFrame のコールバック引数
 * @returns {boolean} true ならこのフレームを描画してよい
 */
export function shouldRunFrame(timestamp) {
  const cap = getFpsCap();
  if (!cap || cap <= 0) {
    lastRunStamp = timestamp;
    return true;
  }
  // タイマ精度の誤差を見て1msほどマージンを取る
  const minInterval = 1000 / cap - 1;
  if (timestamp - lastRunStamp >= minInterval) {
    lastRunStamp = timestamp;
    return true;
  }
  return false;
}

/**
 * 各ゲームループの先頭（間引き判定より前）で呼び出し、
 * 実際に rAF が回っている間隔を計測する。
 * Auto品質のときのみ適応制御が働き、段階が変わったら
 * "mametype-quality-changed" イベントを発火する。
 */
export function recordFrame(timestamp) {
  const deltaMs = timestamp - (lastRecordedTime || timestamp);
  lastRecordedTime = timestamp;

  // タブ復帰・大きな stall は測定値として無意味なため除外
  if (deltaMs <= 0 || deltaMs >= 1000) return;

  const changed = adaptiveFrameTick(deltaMs);
  if (changed) notifyQualityChanged();
}

/** 品質プロファイル変化（Auto適応など）をアプリ全体へ通知する */
export function notifyQualityChanged() {
  try {
    window.dispatchEvent(new CustomEvent("mametype-quality-changed", {
      detail: { level: getRenderQuality(), stage: getAutoStage() }
    }));
  } catch (e) {
    /* イベント不可の環境では黙って続行 */
  }
}