// =====================================================
// inputCore.js
// 入力処理・ローマ字変換・候補管理
// @mametype/roma-engine へのブリッジ / アダプターモジュール
// ライブラリ側の変更（packages/mame-roma-engine/src/）は自動的にMameType本体へ反映されます。
// =====================================================

// romaUtils.js（@mametype/roma-engine 経由）から文字判定・正規化・テーブルをインポート
import { getKana, toHalfWidthAlpha, isSmallTsu, isSymbol, isN, isNaRow, SYMBOL_TABLE } from './romaUtils.js';

// 独立ライブラリ @mametype/roma-engine から判定エンジンを直接インポート
import { evaluateKey, getCandidatesForKana as _getCandidatesForKana } from '../packages/mame-roma-engine/src/index.js';

// gameCore.js からゲーム状態や描画関数・サウンド関数をインポート
import { gameState, getNow, renderState, checkGameEnd, safePlayTypeSound, safePlayMissSound, safeFlashMiss, smoothKPM, calcKPM } from './gameCore.js';
import { updateSpeedBar } from './renderer.js';
import { ENEMY_MODE_CONFIG } from "./enemyModeConfig.js";
import { devOverride } from '../dev/devOverride.js';

const CHAIN_CONFIG = ENEMY_MODE_CONFIG.chain;

// =====================================================
// 候補キャッシュ（同じ文字で何度も候補計算しないよう保持）
// =====================================================
let candidateCache = {};
export let candidates = []; // 現在の入力候補（ローマ字配列）

// =====================================================
// 指定位置のかなのローマ字候補を取得
// =====================================================
export function getCandidatesForKana(text, pos) {
  let mode = 'nn';
  try {
    mode = localStorage.getItem('final_n_mode') || 'nn';
  } catch (e) {}
  return _getCandidatesForKana(text, pos, { finalNMode: mode });
}

// =====================================================
// 候補リセット関数
// 現在の pos の文字に対して、候補を生成する
// =====================================================
export function resetCandidates(posOverride = null) {
  candidateCache = {};
  const pos = posOverride ?? (gameState?.pos ?? 0);
  const text = gameState?.text ?? "";
  candidates = getCandidatesForKana(text, pos);
}

export function fullResetInput() {
  candidateCache = {};
  candidates = [];
}

// =====================================================
// 正解時処理関数
// 1英文字成功時の処理　コンボ、スピードバー、正解数、処理
// =====================================================
function onCorrectType(count = 1, state = gameState) {
  state.correctCount += count;

  // Enemy Combo数追加
  addCombo(count, state);

  gameState.speedCorrectChars += count;

  const now = getNow(); // same clock as speedStartTime (pause-adjusted)
  const elapsed = now - gameState.speedStartTime;

  updateSpeedBar(
    smoothKPM(
      calcKPM(
        gameState.speedCorrectChars,
        elapsed
      )
    )
  );
}

// =====================================================
// ミス時処理関数
// ミスサウンド、フラッシュ、ミスカウント、チェイン、チェインバー、コンボ処理
// =====================================================
function handleMiss(state = gameState) {
  safePlayMissSound();
  safeFlashMiss();

  if (!gameState.enemyMode) { // Enemyモードでない場合のみグローバルミスカウントを更新
    state.mistakeCount++;
  }
  resetCombo(state);

  // Chain Penalty =================
  if (gameState.enemyMode) {
    const stats = gameState.enemyStats;

    // DEV対応
    const penalty =
      devOverride.chain?.missPenalty ??
      stats.missPenalty ??
      CHAIN_CONFIG.missPenalty;

    stats.chainBar -= penalty;

    if (stats.chainBar < 0) {
      stats.chainBar = 0;
      stats.chainCount = 0;
    }
  }
  // ================================
  updateRender();
}

// =====================================================
// コンボ処理
// =====================================================
function getComboTarget(state = gameState) {
  if (state.enemyStats) {
    return state.enemyStats;
  }
  return state;
}

function addCombo(value, state = gameState) {
  const target = getComboTarget(state);
  target.currentCombo += value;

  if (target.currentCombo > target.maxCombo) {
    target.maxCombo = target.currentCombo;
  }
}

function resetCombo(state = gameState) {
  const target = getComboTarget(state);
  target.currentCombo = 0;
}

// =====================================================
// キー入力判定メイン関数
// @mametype/roma-engine の evaluateKey を用いて判定し、
// サウンド・演出・コンボ・描画更新の副作用を実行する
// =====================================================
export function handleKey(e, silent = false, state = gameState, options = {}) {
  const { processComboInSilent = false } = options;

  // タイプ音は非同期で後追い再生
  if (!silent) {
    try {
      const play = () => { try { safePlayTypeSound(); } catch (e) {} };
      if (typeof requestIdleCallback === "function") {
        requestIdleCallback(play, { timeout: 50 });
      } else {
        setTimeout(play, 0);
      }
    } catch (e) { /* 音失敗は無視 */ }
  }

  let mode = 'nn';
  try {
    mode = localStorage.getItem('final_n_mode') || 'nn';
  } catch (e) {}

  const evalResult = evaluateKey(e.key, state, { finalNMode: mode });

  if (evalResult.ignored) {
    return { success: false, isMiss: false, charCount: 0 };
  }

  // 有効キーの場合ブラウザのデフォルト動作を抑制
  if (!silent && e.preventDefault) e.preventDefault();

  // 候補キャッシュの同期
  const kana = getKana(state.text, state.pos);
  const cacheKey = kana + state.pos;
  if (!candidateCache[cacheKey]) {
    candidateCache[cacheKey] = getCandidatesForKana(state.text, state.pos);
  }
  candidates = candidateCache[cacheKey] || [];

  if (evalResult.isMiss) {
    if (!silent || processComboInSilent) handleMiss(state);
    return { success: false, isMiss: true, charCount: 0 };
  }

  if (evalResult.success) {
    state.typed = evalResult.typed;
    state.inputedRomaji = evalResult.inputedRomaji;
    state.pos = evalResult.pos;

    if (evalResult.isComplete) {
      if (!silent || processComboInSilent) onCorrectType(evalResult.charCount, state);
      resetCandidates(state.pos);
      if (!silent) {
        updateRender();
        updateGameEnd();
      }
      return { success: true, isMiss: false, charCount: evalResult.charCount, isComplete: true };
    } else {
      if (!silent) {
        updateRender();
      }
      return { success: true, isMiss: false, charCount: 0 };
    }
  }

  return { success: false, isMiss: false, charCount: 0 };
}

function updateGameEnd() {
  if (!gameState.enemyMode) {
    checkGameEnd();
  }
}

function updateRender() {
  if (!gameState.enemyMode) {
    renderState();
  }
}
