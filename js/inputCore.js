// =====================================================
// inputCore.js
// 入力処理・ローマ字変換・候補管理
// =====================================================

// romaUtils.js からローマ字変換や文字種判定関数をインポート
import { getKana, getRomajiCandidates, getSokuonCandidates, toHalfWidthAlpha,
         isSmallTsu, isSymbol, isN, isNaRow, SYMBOL_TABLE } from './romaUtils.js';

// gameCore.js からゲーム状態や描画関数・サウンド関数をインポート
// safePlayTypeSound: タイプ音、safePlayMissSound: ミス音、safeFlashMiss: フラッシュ
// renderState: 画面更新、checkGameEnd: 次の問題チェック
// correctCount, mistakeCount, inputedRomaji, typed, pos, text は状態変数
import { gameState, renderState, checkGameEnd, safePlayTypeSound, safePlayMissSound, safeFlashMiss, smoothKPM, calcKPM} from './gameCore.js';
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

  const kana = getKana(text, pos);

  if (!kana) return [];

  // 記号
  if (isSymbol(kana)) {
    return [SYMBOL_TABLE[kana]];
  }

  // っ
  if (isSmallTsu(kana)) {
    const nextKana = getKana(text, pos + kana.length);
    return getSokuonCandidates(nextKana);
  }

  // ん
  if (isN(kana)) {
    const nextKana = getKana(text, pos + kana.length);
    const prevKana = pos > 0 ? getKana(text, pos - 1) : null;
    // 次の文字が母音(あいうえお)またはヤ行(やゆよ)の場合、'nn'が必須
    const nextRequiresNn = nextKana && /^[aiueoy]/.test(getRomajiCandidates(nextKana)[0] || '');

    try {
      const mode = localStorage.getItem('final_n_mode') || 'nn';

      // 1. 単語の末尾、または直前が長音符の場合
      if (!nextKana || prevKana === 'ー') {
        return mode === 'n' ? ['n'] : ['nn', 'xn'];
      }
      // 2. 次が「な行」
      if (isNaRow(nextKana)) {
        return mode === 'n' ? ['n', 'nn', 'xn'] : ['nn', 'xn', 'n'];
      }
      // 3. 次が母音・ヤ行、または「ん」が続く場合
      return (nextRequiresNn || isN(nextKana)) ? ['nn', 'xn', 'n'] : ['n', 'nn', 'xn'];
    } catch (e) {
      return isNaRow(nextKana) ? ["n","nn"] : ["n"];
    }
  }

  // 通常かな
  return getRomajiCandidates(kana);
}

// =====================================================
// 候補リセット関数
// 現在の pos の文字に対して、候補を生成する
// =====================================================
export function resetCandidates(posOverride = gameState.pos) {
  candidateCache = {}; 
  candidates = getCandidatesForKana(gameState.text, posOverride);
}

export function fullResetInput() {
  candidateCache = {};
  candidates = [];
}

// =====================================================
// 正解時処理関数
// 1英文字成功時の処理　コンボ、スピードバー、正解数、処理
// =====================================================
function onCorrectType(count = 1) {

    gameState.correctCount += count;

    // Enemy Combo数追加
    addCombo(count);

    gameState.speedCorrectChars += count;

    const now = performance.now();
    const elapsed =
        now - gameState.speedStartTime;

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
  function handleMiss() {
    
    safePlayMissSound();
    safeFlashMiss();

    if (!gameState.enemyMode) { // Enemyモードでない場合のみグローバルミスカウントを更新
        gameState.mistakeCount++;
    }
    resetCombo();

    // Chain Penalty =================
    if(gameState.enemyMode){
      const stats = gameState.enemyStats;
      
      // DEV対応
      const penalty =
        devOverride.chain?.missPenalty ??
        stats.missPenalty ??
        CHAIN_CONFIG.missPenalty;

      stats.chainBar -= penalty;

      if(stats.chainBar < 0){
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

function getComboTarget() {

  // enemy mode
  if (gameState.enemyStats) {
    return gameState.enemyStats;
  }

  // normal mode
  return gameState;
}

function addCombo(value) {

  const target = getComboTarget();

  target.currentCombo += value;

  if (target.currentCombo > target.maxCombo) {
    target.maxCombo = target.currentCombo;
  }
}

function resetCombo() {

  const target = getComboTarget();
  target.currentCombo = 0;
}

  export function handleKey(e, silent = false, state = gameState) {
    //log
    // console.log("INPUT", {
    //   key: e.key,
    //   pos: gameState.pos,
    //   kana: getKana(gameState.text, gameState.pos),
    //   typed: gameState.typed
    // });
    
    if (!silent) safePlayTypeSound();   // タイプ音
    let key = e.key;

    // 全角を半角に変換（romaUtilsの共通処理を使用）
    key = toHalfWidthAlpha(key);
    if (key === "　") key = " "; // 全角スペースの例外処理
    key = key.toLowerCase(); // 大文字は小文字に統一


    // 許可する文字リストに英数字、プログラム用記号などを追加
    if (!/^[a-z0-9.,!?\-\[\]\(\)@%:*+;{}<>=/\\_&|~^$#'" ]$/.test(key)) return { success: false, isMiss: false, charCount: 0 }; // 許可しない文字は無視

    // ブラウザのデフォルト動作を抑制 (有効なキー入力の場合のみ)
    if (!silent && e.preventDefault) e.preventDefault();

    const kana = getKana(state.text, state.pos);       // 現在の文字
    const cacheKey = kana + state.pos;           // キャッシュ用のキー

    // 候補キャッシュがなければ生成
    if (!candidateCache[cacheKey]) {
      candidateCache[cacheKey] = getCandidatesForKana(state.text, state.pos);
    }

    candidates = candidateCache[cacheKey] || [];// 現在の候補に反映

    // console.log("candidates for kana", {
    // kana: getKana(gameState.text, gameState.pos),
    // pos: gameState.pos,
    // candidates
    // });

    // ==============================
    // 「ん」の特殊処理（IME互換）
    // ==============================
    if (isN(kana)) {
      const nextKana = getKana(state.text, state.pos + kana.length);
      const prevKana = state.pos > 0 ? getKana(state.text, state.pos - 1) : null;

      // 文末、長音符の後、または記号が続く場合 → n を1回で確定
      if (!nextKana || prevKana === 'ー' || isSymbol(nextKana)) {
        // 既に typed が 'n' の場合、2回目の 'n' で 'nn' を確定させる
        if (state.typed === "n" && key === "n") {
          state.inputedRomaji += "nn";
          if (!silent) onCorrectType(2);
          state.typed = "";
          state.pos += kana.length;
          resetCandidates();
          if (!silent) { updateRender(); updateGameEnd(); }
          return { success: true, isMiss: false, charCount: 2, isComplete: true };
        }

        if (key === "n") {
          // 設定に応じて文末の'n'を確定するか決める
          try {
            const mode = localStorage.getItem('final_n_mode') || 'nn';
            if (mode === 'n') {
              // single 'n' で確定
              state.inputedRomaji += "n"; // 確定
              if (!silent) onCorrectType(1); //正解処理

              state.typed = "";            // typed をクリア
              state.pos += kana.length;    // pos を進める
              resetCandidates();     // 次の候補をセット

              if (!silent) { updateRender(); updateGameEnd(); }
              return { success: true, isMiss: false, charCount: 1, isComplete: true };
            } else {
              // 'nn' モード: single 'n' では確定せず typed バッファに入れる
              state.typed = "n";
              if (!silent) { updateRender(); }
              return { success: true, isMiss: false, charCount: 0 };
            }
          } catch (e) {
            // localStorage 失敗時は従来の single 'n' 動作
            state.inputedRomaji += "n"; // 確定
            if (!silent) onCorrectType(1);

            state.typed = "";
            state.pos += kana.length;
            resetCandidates();
            if (!silent) { updateRender(); updateGameEnd(); }
            return { success: true, isMiss: false, charCount: 1, isComplete: true };
          }
        }

        if (!silent) handleMiss(); // (handleMissは呼ばれた)
        return { success: false, isMiss: true, charCount: 0 };
      }

      // すでに typed が "n" の場合
      if (state.typed === "n") {

        // nn → 確定
        if (key === "n") {
          state.inputedRomaji += "nn";
          //正解処理
          if (!silent) onCorrectType(2);

          state.typed = "";
          state.pos += kana.length;
          resetCandidates();

          if (!silent) { updateRender(); updateGameEnd(); }
          return { success: true, isMiss: false, charCount: 2, isComplete: true };
        }

        // 母音または'y'が来た場合
        if (/^[aiueoy]$/.test(key)) {
          // 'n' + 母音/y の組み合わせが次の文字の候補にあるか (例: nya)
          const nextCandidates = getRomajiCandidates(nextKana);
          const canContinue = nextCandidates.some(c => c.startsWith('n' + key));

          if (canContinue) {
            // nya, nyo などの処理
            state.typed += key;
            if (!silent) { updateRender(); }
            return { success: true, isMiss: false, charCount: 0 };
          }
          // 継続できない母音が来た場合 (例: an + a) は、下の「確定して次へ」ロジックで処理される
        }

        // =========================
        // ① 継続できるか？
        // =========================
        // この時点では、n + 子音の組み合わせ (例: n + k) を想定
        // ただし、次の文字が「な行」の場合、n + n も継続とみなす必要がある
        const nextCandidates = getRomajiCandidates(nextKana) || [];
        const canContinue =
          // n + y は上で処理済み
          // n + n (次の文字が「な」行)
          (key === 'n' && isNaRow(nextKana)) ||
          // n + 子音
          nextCandidates.some(c => c.startsWith("n" + key));

        if (canContinue) {
          // nya, nni など
          state.typed += key;
          if (!silent) { updateRender(); }
          return { success: true, isMiss: false, charCount: 0 }; // (typed buffer updated)
        }

        // =========================
        // ② 確定して次に行けるか？
        // =========================
        const nextNextCandidates = getRomajiCandidates(nextKana);
        // 押されたキーが子音で、かつ次の文字の候補の先頭と一致するか
        const canStartNext =
          /^[a-z]$/.test(key) && // 全てのアルファベットを対象に
          nextNextCandidates.some(c => c.startsWith(key));

        // 'n'を「ん」として確定し、押されたキーを次の文字の入力として引き継ぐ
        if (canStartNext) {

          // ん確定
          state.inputedRomaji += "n";
          if (!silent) onCorrectType(1);

          // 次のかなへ移動
          state.pos += kana.length;

          // 次候補生成
          resetCandidates();

          // 押したキーを次文字へ引き継ぐ
          state.typed = key;

          if (!silent) { updateRender(); }
          return { success: true, isMiss: false, charCount: 1, isComplete: true };
        }

        // =========================
        // ③ どちらもダメ → ミス
        // =========================
        if (!silent) { handleMiss(); }
        return { success: false, isMiss: true, charCount: 0 }; // (handleMissは呼ばれた)
      }

      // typed が空の場合、最初の n 入力
      if (key === "n") {
        state.typed = "n";
        
        if (!silent) { updateRender(); } // No charCount, just typed buffer update
        return { success: true, isMiss: false, charCount: 0 }; // (typed buffer updated)
      }
    }
    
    // ==============================
    // 「っ」の特殊処理
    // ==============================
    if (isSmallTsu(kana)) {
        const nextTyped = state.typed + key;
        const match = candidates.some(r => r.startsWith(nextTyped));

        if (!match) {
            if (!silent) handleMiss();
            return { success: false, isMiss: true, charCount: 0 };
        }

        state.typed = nextTyped;

        const complete = candidates.some(r => r === state.typed);

        if (complete) {
            state.inputedRomaji += state.typed;
            const confirmedCharCount = state.typed.length;
            if (!silent) onCorrectType(confirmedCharCount);

            const nextKana = getKana(state.text, state.pos + kana.length);
            state.pos += kana.length;

            // 子音重ね（tta など）のときだけ次の文字をスキップ
            if (state.typed.length > 1 && state.typed !== "ltu" && state.typed !== "xtu") {
                if (nextKana) state.pos += nextKana.length;
            }

            state.typed = "";
            resetCandidates();
            if (!silent) { updateRender(); updateGameEnd(); }
            return { success: true, isMiss: false, charCount: confirmedCharCount, isComplete: true };
        } else {
            if (!silent) { updateRender(); }
            return { success: true, isMiss: false, charCount: 0 };
        }
    }

    // ==============================
    // 通常の入力処理
    // ==============================
    const nextTyped = state.typed + key; // typed にキーを追加

    if (!candidates || candidates.length === 0) {
      if (!silent) { handleMiss(); }
      return { success: false, isMiss: true, charCount: 0 }; // (handleMissは呼ばれた)
    }

    const match = candidates.some(r => r.startsWith(nextTyped)); // 候補と照合

    if (!match) { 
      if (!silent) { handleMiss(); }
      return { success: false, isMiss: true, charCount: 0 }; // (handleMissは呼ばれた)
    }

    state.typed = nextTyped; 


    const complete = candidates.some(r => r === state.typed); // 候補と完全一致判定

    if (complete) {
        state.inputedRomaji += state.typed;

          const confirmedCharCount = state.typed.length;
          if (!silent) onCorrectType(confirmedCharCount);
        
        const nextKana = getKana(state.text, state.pos + kana.length);
        state.pos += kana.length;

        if (isSmallTsu(kana) && nextKana) {
            const firstChar = state.typed[0];
            // 子音重ね（tta など）のときだけ次の文字をスキップ
            if (state.typed.length > 1 && firstChar !== "l" && firstChar !== "x") {
                state.pos += nextKana.length;
            }
        }

        state.typed = "";                     // typed リセット
        resetCandidates();       // 次の候補セット
        if (!silent) { updateRender(); }
        if (!silent) { updateGameEnd(); }      // ゲーム終了判定
        return { success: true, isMiss: false, charCount: confirmedCharCount, isComplete: true };
    } 
    else { if (!silent) { updateRender(); } return { success: true, isMiss: false, charCount: 0 }; } // 完全一致でなければ表示更新のみ (typed buffer updated)
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