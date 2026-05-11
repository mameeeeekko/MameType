// =====================================================
// inputCore.js
// 入力処理・ローマ字変換・候補管理
// =====================================================

// romaUtils.js からローマ字変換や文字種判定関数をインポート
import { getKana, getRomajiCandidates, getSokuonCandidates, 
         isSmallTsu, isSymbol, isN, isNaRow, SYMBOL_TABLE } from './romaUtils.js';

// gameCore.js からゲーム状態や描画関数・サウンド関数をインポート
// safePlayTypeSound: タイプ音、safePlayMissSound: ミス音、safeFlashMiss: フラッシュ
// renderState: 画面更新、checkGameEnd: 次の問題チェック
// correctCount, mistakeCount, inputedRomaji, typed, pos, text は状態変数
import { gameState, renderState, checkGameEnd, safePlayTypeSound, safePlayMissSound, safeFlashMiss, smoothKPM, calcKPM} from './gameCore.js';
import { updateSpeedBar } from './renderer.js';
import { ENEMY_MODE_CONFIG } from "./enemyModeConfig.js";

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
    return isNaRow(nextKana) ? ["n","nn"] : ["n"];
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
// 入力処理関数
// キー入力を受け取り、正誤判定・候補更新・確定を行う
// =====================================================
  export function handleKey(key) {
    //log
    // console.log("INPUT", {
    //   key,
    //   pos: gameState.pos,
    //   kana: getKana(gameState.text, gameState.pos),
    //   typed: gameState.typed
    // });

    safePlayTypeSound();   // タイプ音

    key = key.toLowerCase(); // 大文字は小文字に統一
    // 全角を半角に変換
    if (key === "！") key = "!";
    if (key === "？") key = "?";
    if (key === "ー") key = "-";
    // a-z , . , ! , ? のみ処理、その他は無視
    if (!/^[a-z.,!?-]$/.test(key)) return;

    const kana = getKana(gameState.text, gameState.pos);       // 現在の文字
    const cacheKey = kana + gameState.pos;           // キャッシュ用のキー

    // 候補キャッシュがなければ生成
    if (!candidateCache[cacheKey]) {
      candidateCache[cacheKey] = getCandidatesForKana(gameState.text, gameState.pos);
    }

    candidates = candidateCache[cacheKey] || [];// 現在の候補に反映

    // console.log("candidates for kana", {
    // kana: getKana(gameState.text, gameState.pos),
    // pos: gameState.pos,
    // candidates
    // });

    // ミスした時の処理関数
    function handleMiss() {
      
      safePlayMissSound();
      safeFlashMiss();

      gameState.mistakeCount++;
      gameState.currentCombo = 0;

      // Chain Penalty =================
      if(gameState.enemyMode){
        const stats = gameState.enemyStats;
        stats.chainBar -= CHAIN_CONFIG.missPenalty;

        if(stats.chainBar < 0){
          stats.chainBar = 0;
          stats.chainCount = 0;
        }
      }
     // ================================
      updateRender();
    }

    // ==============================
    // 「ん」の特殊処理（IME互換）
    // ==============================
    if (isN(kana)) {
      const nextKana = getKana(gameState.text, gameState.pos + kana.length);

      // 文末の場合 → n を1回で確定
      if (!nextKana) {
        if (key === "n") {
          gameState.inputedRomaji += "n"; // 確定
          gameState.typed = "";            // typed をクリア
          gameState.pos += kana.length;    // pos を進める
          resetCandidates();     // 次の候補をセット
          
          updateRender() ;
          updateGameEnd();        // 終了判定
          return { confirmed: true } ;
        }
        handleMiss();
        return; // 文末以外の処理は続行
      }

      // すでに typed が "n" の場合
      if (gameState.typed === "n") {

        // 母音は無効
        if (/^[aiueo]$/.test(key)) {
          handleMiss();
          return;
        }

        // nn → 確定
        if (key === "n") {
          gameState.inputedRomaji += "nn";
          gameState.typed = "";
          gameState.pos += kana.length;
          resetCandidates();

          updateRender();
          return { confirmed: true };
        }

        // =========================
        // ① 継続できるか？
        // =========================
        const nextCandidates = getRomajiCandidates(nextKana);

        const canContinue = nextCandidates.some(c =>
          c.startsWith("n" + key)
        );

        if (canContinue) {
          // nya, nni など
          gameState.typed += key;
          updateRender();
          return;
        }

        // =========================
        // ② 確定して次に行けるか？
        // =========================
        const nextNextCandidates = getRomajiCandidates(nextKana);

        const canStartNext =
          /^[kstnhmyrwgjdbz]$/.test(key) &&
          nextNextCandidates.some(c => c.startsWith(key));

        if (canStartNext) {
          // ん確定 + 次の文字へ
          gameState.inputedRomaji += "n";
          gameState.typed = key;
          gameState.pos += kana.length;
          resetCandidates();

          updateRender();
          return { confirmed: true };
        }

        // =========================
        // ③ どちらもダメ → ミス
        // =========================
        handleMiss();
        return;
      }

      // typed が空の場合、最初の n 入力
      if (key === "n") {
        gameState.typed = "n";
        
        updateRender() ;
        return { confirmed: true };
      }
    }
    
    // ==============================
    // 通常の入力処理
    // ==============================
    const nextTyped = gameState.typed + key; // typed にキーを追加

    if (!candidates || candidates.length === 0) {
      handleMiss();
      return;
    }

    const match = candidates.some(r => r.startsWith(nextTyped)); // 候補と照合

    if (!match) { 
      handleMiss()
      return; 
    }

    gameState.typed = nextTyped; 


    const complete = candidates.some(r => r === gameState.typed); // 候補と完全一致判定

    if (complete) {
        gameState.inputedRomaji += gameState.typed;        // 確定
        gameState.correctCount += gameState.typed.length;  // 正解数加算
        gameState.currentCombo += gameState.typed.length; 

          if(gameState.currentCombo > gameState.maxCombo){
              gameState.maxCombo = gameState.currentCombo;
          }

        gameState.speedCorrectChars += gameState.typed.length;

        const now = performance.now();
        const elapsed = now - gameState.speedStartTime;
        updateSpeedBar(smoothKPM(calcKPM(gameState.speedCorrectChars, elapsed)));

        
        const nextKana = getKana(gameState.text, gameState.pos + kana.length);
        gameState.pos += kana.length;

        if (isSmallTsu(kana) && nextKana) {

            const firstChar = gameState.typed[0];

            // 子音重ね（tta など）のときだけ次の文字をスキップ
            if (gameState.typed.length > 1 && firstChar !== "l" && firstChar !== "x") {
                gameState.pos += nextKana.length;
            }

        }

        gameState.typed = "";                     // typed リセット
        resetCandidates();       // 次の候補セット
        updateRender() ;
        updateGameEnd();      // ゲーム終了判定
        return { confirmed: true };              
    } 
    else updateRender() ;              // 完全一致でなければ表示更新のみ
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