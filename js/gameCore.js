// =====================================================
// gameCore.js
// ゲーム全体の進行・状態管理・入力処理の中枢
// 描画やサウンドなどの副作用は renderer.js に委譲
// =====================================================

// =====================================================
// 1. 外部モジュールの import
// =====================================================
import { addRankingEntry } from "./storage.js";
import { TARGETS, TARGETS_LONG } from './target.js';
import {
  render, initProgressBar, updateProgressBar, updateProgressText, markProgressDoneFromRight,
  initSpeedBar, updateSpeedBar,
  setLongTextMode, setUIMode, resetRendererState,
  initTimeBar, setTimeLeft, setSolvedCount, renderBgmInfo
} from './renderer.js';
import { closeDialogue } from './dialogue.js';
import { playTypeSound, playMissSound, initAudio, flashMiss, stopBGM, playBGM, ensureSound, setMasterVolume, setBgmVolume, setSeVolume, setTypeVolume, setMissVolume, playTestSound as playTestSoundEffect } from "./effectManager.js";
import { GameModes} from "./gameModes.js";
import { updatePlayerStats, getPlayerStats} from "./playerStats.js";
import { updateHud, showHud } from "./hud.js";
import { resetCandidates, candidates, fullResetInput } from './inputCore.js';
import { showResult } from "./resultView.js";
import { getCurrentDifficulty, getDifficultyById } from "./difficulties.js";
import { handleSkillModeResult } from "./skillTreeResult.js"
import { initTimeCircle, stopTimeCircle } from "./renderer.js";
import { submitScore } from "../online/submitScore.js";
import { RANKING_VERSION } from "./version.js";
import { addQuestSkillNodeAttempt } from "./questPlayerStats.js";
import { recordFrame, shouldRunFrame } from "./performance.js";
import {
  initAnalyticsLazy,
  trackGameStart,
  trackGameComplete,
  mapModeIdToAnalytics,
} from "./analytics.js";

// =====================================================
// Google Analytics (軽量・遅延読み込み)
// G-LTCTSF3D03 / game_start: standard/time_attack等を分類
// ミス練は除外・ボスは含める
// =====================================================
initAnalyticsLazy();

/**
 * 通常系(startGame経由)のgame_start計測パラメータを組み立てる
 * play_style: quest / free / daily
 * mode: standard / time_attack / long_text 等
 */
function buildNormalGameStartParams(config, normalizedConfig, diff) {
  const modeId = normalizedConfig.mode?.id || config.mode?.id || "unknown";
  const mode = mapModeIdToAnalytics(modeId);
  const isQuest = !!config.isQuestMode;
  const isFree = !!normalizedConfig.isFreeMode;
  const play_style = isQuest ? "quest" : isFree ? "free" : "daily";
  const difficulty = diff?.id || normalizedConfig.difficulty || null;
  return { mode, play_style, difficulty };
}

// =====================================================
// 1.5 グローバル定数・変数の初期化（TDZ回避のため先頭へ）
// =====================================================
export let soundEnabled = true;
export let soundSettings = {
        bgm: true,
        type: true,
        miss: true,
        flash: true,
        soundeffect: true
      };
export let soundVolumes = {
  bgm: 0.5,
  type: 0.5,
  miss: 0.5,
  se: 0.5
};

requestAnimationFrame(speedTick);

// =====================================================
// 2. 内部フラグ・モード管理
// =====================================================
let isFinishing = false;          // 終了処理の多重防止
//let currentMode = GameModes.NORMAL;
let modeData = {};                // モード固有の一時データ
let currentIsFreeMode = false;    // フリーモードかどうか
// ゲーム全体の開始時刻（累積計算用）
let gameStartTime = 0;

// フリーモード / 通常モードで最後に開始した設定を保持
let lastGameByType = {
  free: null,
  normal: null
};

// =====================================================
// 3. タイムアタック用 状態管理
// =====================================================
export let isTimeUp = false;
let timeLimitMs = 0;
let timeAttackStartTime = 0;

// =====================================================
// 4. ゲーム状態（外部から参照されるもの）
// =====================================================
export let startTime = 0, endTime = 0;
export let shuffledTargets = [];
export let isRetrying = false;

export let isGameActive = false;

// ★v1.0.23: ゲーム中は Service Worker / assetsLoader の裏読み込みを停止させる。
//   Windows で裏ダウンロード中に「打鍵表示の遅れ」「防衛モードのもっさり」が
//   起きるため、ゲーム開始/終了を SW（GAME_ACTIVE メッセージ）と
//   ページ内ローダー（window.__mametypeGameActive フラグ）の両方へ通知する。
let lastGameActivityNotified = false;
function notifyGameActivity(active) {
  const val = !!active;
  if (val === lastGameActivityNotified) return; // 変化があった時だけ通知
  lastGameActivityNotified = val;
  try {
    window.__mametypeGameActive = val;
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "GAME_ACTIVE",
        active: val
      });
    }
  } catch (e) { /* 通知失敗は無視 */ }
}

export function setGameActive(v){
  isGameActive = v;
  notifyGameActivity(v);
  // ★エネミー/防衛モードは startGame を経由しないため、ここで speedTick を再始動する
  if (v) ensureSpeedTickRunning();
}
 
export let lastWasEnemyMode = false; //結果画面のもう一度につかう。
let lastSpecialModeType = null; // "enemy_mode" or "defense_mode"
export function setLastWasEnemyMode(v, type = null){
  lastWasEnemyMode = v;
  lastSpecialModeType = type;
}
export function getLastSpecialModeInfo() {
    return { isSpecial: lastWasEnemyMode, type: lastSpecialModeType };
}

// =====================================================
// ゲーム状態をオブジェクトでまとめる
// 直接 let typed, pos, correctCount に代入せず、
// gameState.typed のようにアクセスすることで
// import 先でも書き換え可能になる
// =====================================================
export const gameState = {
    currentMode: null,
    isQuestMode: false,
    isEnding: false, //イントロ中にポーズを走らせないために使う  
    typed: "",
    inputedRomaji: "",
    pos: 0,
    correctCount: 0,
    mistakeCount: 0,
    text: "",
    displayWord: "",
    segments: [],
    currentIndex: 0,
    solvedCount: 0,
    missedTargets: [],
    currentCombo: 0,
    maxCombo: 0,
    totalCorrect: 0,
    totalMistake: 0,
    totalChars: 0,
    totalTime: 0,
    speedCorrectChars: 0,
    speedStartTime: 0,
    startTime: 0, // Game start time for all modes
    // ★追加
    currentBgmInfo: null,
    enemyStats: { // gameState に含める
        startTime: 0,
        endTime: 0,
    }
};

// =====================================================
// 初期化関連
// =====================================================
export function fullResetGame() {
  stopTimeAttackTimer();
  stopBGM();
  stopTimeCircle();
  resetRendererState();
  resetGameState();
  shuffledTargets = [];
  fullResetInput();
  resetAllModes(); 
  gameState.totalCorrect = 0;
  gameState.totalMistake = 0;
  gameState.totalChars = 0;
  gameState.totalTime = 0;
  gameState.solvedCount = 0;
  gameState.missedTargets = [];
  gameStartTime = 0;
  totalPauseTime = 0;
  pauseStart = 0;
  kpmHistory.length = 0;
}

export function resetGameState() {
  gameState.text = "";
  gameState.pos = 0;
  gameState.typed = "";
  gameState.inputedRomaji = "";
  gameState.correctCount = 0;
  gameState.mistakeCount = 0;
  gameState.currentIndex = 0;
  gameState.startTime = 0; // Reset game start time
  gameState.currentBgmInfo = null;
} 

export function resetAllModes() {
  gameState.enemyMode = false;
  gameState.currentMode = null;
  gameState.currentQuestNode = null;
  gameState.isQuestMode = false;
  gameState.currentChallenge = null;
}

export function exitSkillMode() {
    if (gameState.currentChallenge) {
        gameState.currentChallenge.isSkillMode = false;
    }
}

// =====================================================
// 4-1. ゲーム状態オブジェクト生成（currentMode に渡す用）
// =====================================================
function buildState() {
  
  const diff = getCurrentDifficulty()
  return {
    currentIndex: gameState.currentIndex,       // gameState に統一
    pos: gameState.pos,
    typed: gameState.typed,
    inputedRomaji: gameState.inputedRomaji,
    displayWord: gameState.displayWord,
    correctCount: gameState.correctCount,
    mistakeCount: gameState.mistakeCount,
    missedTargets: gameState.missedTargets,
    modeData,                                    // モード固有データは gameState に含めずそのまま
    diff,
    currentIsFreeMode,
    currentMode: gameState.currentMode,
    totalCorrect: gameState.totalCorrect,
    totalMistake: gameState.totalMistake,
    totalChars: gameState.totalChars,
    totalTime: gameState.totalTime,
    shuffledTargets,
    solvedCount: gameState.solvedCount,
    isTimeUp,
    isRetrying,
    isGameActive
  };
}

// =====================================================
// 5. ゲームモード確認(resultで、フリーモードのメニューに行くかどうかを判定するため)
// =====================================================
export function wasLastGameFree() {
  return currentIsFreeMode;
}
// =====================================================
// 5. ゲームモード確認(resultで、どの結果をデフォルトとするか判定するため)
// =====================================================
export function getLastGameMode() {
  return gameState.currentMode;
}
// =====================================================
// 6. スピード(KPM)計測
// =====================================================
const kpmHistory = [];
const HISTORY_SIZE = 5;
let lastSpeedUpdate = 0;

// KPM計算
export function calcKPM(chars, elapsedMs) {
  const minutes = elapsedMs / 60000;
  return minutes <= 0 ? 0 : chars / minutes;
}

// 平滑化
export function smoothKPM(kpm) {
  kpmHistory.push(kpm);
  if (kpmHistory.length > HISTORY_SIZE) kpmHistory.shift();
  return kpmHistory.reduce((a,b)=>a+b,0)/kpmHistory.length;
}

// =====================================================
// 7. サウンド設定
// =====================================================

export function getSoundEnabled() { return soundEnabled; }
export function setSoundEnabled(val) {
  soundEnabled = !!val;
  setMasterVolume(soundEnabled ? 1 : 0);
}

export function getSoundSettings() { return { ...soundSettings }; }
export function setSoundSetting(key, val) { if (key in soundSettings) soundSettings[key] = !!val; }
export function getSoundVolumes() { return { ...soundVolumes }; }
export function setSoundVolume(key, val) {
  const v = Number(val);
  if (key in soundVolumes) {
    soundVolumes[key] = v;
    if (key === 'bgm') setBgmVolume(v);
    if (key === 'se') setSeVolume(v);
    if (key === 'type') setTypeVolume(v);
    if (key === 'miss') setMissVolume(v);
  }
}
export function toggleSoundGlobal() {
  soundEnabled = !soundEnabled;
  setMasterVolume(soundEnabled ? 1 : 0);
  return soundEnabled;
}

// New function to play a test sound for volume adjustment
export function playTestSound(key) {
  if (!soundEnabled) return;
  
  // 具体的な再生処理は effectManager に委譲
  playTestSoundEffect(key, soundSettings);
}

// 安全ラッパー（音・フラッシュ）
export function safePlayTypeSound(){ if(soundEnabled&&isGameActive&&soundSettings.type) playTypeSound(); }
export function safePlayMissSound(){ if(soundEnabled&&isGameActive&&soundSettings.miss) playMissSound(); }
export function safeFlashMiss(){ if(isGameActive&&soundSettings.flash) flashMiss(); }

// =====================================================
// 8. 描画初期化
// =====================================================

export function initRenderer() {
  resetCandidates();
  renderState();
}

// ★v1.0.22: 描画ラッパーを同期呼び出しに戻した（安定状態へ復帰）
//   以前の rAF 遅延 + renderer 側の rAF で二重遅延になり、
//   「タイプした文字の表示が遅れる」原因になっていた。
//   render() 側の再描画コストは軽いので直接呼ぶ。
export function renderState() {
  render({
    text: gameState.text,               // gameState.text に変更
    pos: gameState.pos,                 // gameState.pos に変更
    typed: gameState.typed,             // gameState.typed に変更
    inputedRomaji: gameState.inputedRomaji, // gameState.inputedRomaji に変更
    displayWord: gameState.displayWord, // gameState.displayWord に変更
            segments: gameState.segments,
    correctCount: gameState.correctCount,   // gameState.correctCount に変更
    mistakeCount: gameState.mistakeCount,   // gameState.mistakeCount に変更
    isFreeMode: currentIsFreeMode,
    isMissPractice: gameState.currentMode === GameModes.MISS_PRACTICE
  });
}

// =====================================================
// 9. 配列シャッフル
// =====================================================
export function shuffleArray(array){
  const arr=array.slice();
  for(let i=arr.length-1;i>0;i--){
    const j=Math.floor(Math.random()* (i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}

// =====================================================
// 10. 問題ロード
// =====================================================
let candidateCache = {};

export async function loadText(index) {
  const target = shuffledTargets[index];
  if (!target) return;

  candidateCache = {};
  gameState.displayWord = target.word || target.text;
  gameState.text = target.text;
  gameState.segments = target.segments || [];
  gameState.pos = 0;
  gameState.typed = "";
  gameState.inputedRomaji = "";
  candidates.length = 0;

  // フォント待機してから描画（Windows でのチラ見え防止）
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }
  renderState();

  requestAnimationFrame(() => {
    fullResetInput();
    resetCandidates();
  });

  if (index === 0) {
    gameStartTime = getNow();
  }
}


// =====================================================
// 11. ゲーム開始
// =====================================================
export async function startGame(config={mode:GameModes.NORMAL,isFreeMode:false}) {

  fullResetGame();
  // ゲーム開始時に、残っている会話ウィンドウを確実に閉じる
  try { closeDialogue(); } catch(e) { /* noop if dialogue module unavailable */ }
  
  // ミス練習モード以外でゲームを開始する場合、特殊モードのフラグをリセットする
  if (config.mode !== GameModes.MISS_PRACTICE) {
    setLastWasEnemyMode(false);
  }

  await initAudio();
  if (getSoundEnabled() && getSoundSettings().bgm) {
    // モード設定からBGM IDを取得。なければデフォルトを再生
    const bgmId = config.mode?.bgm || "bgm_rainy";
    // ★v1.0.42: モード開始時にBGMを読み込む
    //   （起動時に全BGMをデコードしなくなったため、ここで先に取得する。
    //     オフライン時はSWキャッシュ、オンライン時はHTTPキャッシュから取得される）
    await ensureSound(bgmId);
    playBGM(bgmId, 1.0);
  } else {
    stopBGM(); // ★ BGM設定がOFFでも、マップBGM等が鳴り続けないように停止
  }
  gameState.startTime = getNow(); // BGM表示のために開始時間をセット

  const modal = document.getElementById("gameModal");
  if(modal) modal.style.display="flex";

  const normalizedConfig = { mode:GameModes.NORMAL, isFreeMode:false, ...config };
  const diff =
    config.difficulty
      ? getDifficultyById(config.difficulty) 
      : getCurrentDifficulty();

  // ★GA: ミス練はtrackGameStart内で除外される。クエスト/通常/フリーを分類
  trackGameStart(buildNormalGameStartParams(config, normalizedConfig, diff));

  currentIsFreeMode = normalizedConfig.isFreeMode;
  gameState.isFreeMode = normalizedConfig.isFreeMode;
  gameState.currentMode = normalizedConfig.mode;
  gameState.isQuestMode = !!config.isQuestMode;
  gameState.currentChallenge = config.custom || {}; //skillTree関連フラグ
  gameState.currentSkillNodeId = config.custom?.nodeId || null;
  isGameActive = true;
  notifyGameActivity(true); // ★裏読み込みを停止
  isFinishing = false;
  isRetrying = false;
  stopTimeAttackTimer();
  isTimeUp = false;
  gameState.isEnding = false;
  ensureSpeedTickRunning(); // ★前回のゲーム終了時に停止した speedTick ループを再始動
  
  // 最後に開始したゲームを保存
  if (normalizedConfig.mode !== GameModes.MISS_PRACTICE) {
    lastGameByType[currentIsFreeMode ? "free":"normal"] = { ...normalizedConfig };
  }

  document.getElementById("menu").style.display="none";
  document.getElementById("game").style.display="block";
  setTimeout(()=>document.body.focus(),0);

  setLongTextMode(gameState.currentMode?.id === GameModes.LONG_TEXT.id);
  setUIMode(gameState.currentMode, GameModes);

  gameState.currentIndex = 0;
  gameState.correctCount = 0;
  gameState.mistakeCount = 0;
  gameState.missedTargets = [];

  modeData = { 
    difficulty: diff.id, 
    diff,
    custom: config.custom || {},
    limitSec: config.custom?.limitSec
  };
  gameState.currentMode.onStart(buildState());

  if (normalizedConfig.practiceTargets) {
    shuffledTargets = gameState.currentMode.buildTargets({
      practiceTargets: normalizedConfig.practiceTargets
    }) || [];

  } else {

    const key = diff.id;

    shuffledTargets =
      gameState.currentMode.buildTargets({
        TARGETS,
        TARGETS_LONG,
        shuffleArray,
        modeData,
        diff,
      }) || [];
  }

  if (gameState.currentMode.id === GameModes.TIME_ATTACK.id) { 
    setSolvedCount(0, gameState.currentMode.id); 
    startTimeAttackTimer(); 
  } else {
    setSolvedCount(null, gameState.currentMode.id); //タイムアタック以外は空にする
    stopTimeAttackTimer(); 
    setTimeLeft(null); 
    initTimeCircle(gameState.currentMode.id);
  }

  initProgressBar(shuffledTargets.length);
  initSpeedBar();
 

  gameState.speedStartTime=performance.now(); 
  gameState.speedCorrectChars=0; 
  kpmHistory.length=0; 
  lastSpeedUpdate=0;

  loadText(gameState.currentIndex);
  gameState.startTime = getNow(); // Set game start time here for all modes
  updateProgressBar(gameState.currentIndex, shuffledTargets.length);
  updateProgressText(gameState.currentIndex, shuffledTargets.length);
  updateGameButtonsUI();
}

// カウントダウン付き開始
export async function doCountdown(config) {

  setPaused(false); // ★ポーズ解除
  gameState.currentBgmInfo = null;
  gameState.startTime = 0;
  resetRendererState();
  fullResetInput();

  const countdownDiv = document.getElementById("countdown"); // 数字表示用
  const gameDiv = document.getElementById("game");           // ゲームコンテナ
  const modal = document.getElementById("gameModal");        // 枠

  if (!countdownDiv || !gameDiv) return startGame(config);

  const ids = [
    "word-wrap","jp-wrap","roma-wrap","word-long-wrap","scroll-wrap",
    "modeLabel","freeModeBadge","missModeBadge","progress-container","time-bar-container","speed-container",
    "speed-label","timeLeft","solvedCount","backBtn","gameBackBtn", // ★タイマーサークルも非表示対象に追加
    "time-circle-container",
    "bgmInfoDisplay"
  ];
  
  // 1. まずゲーム画面全体を表示する
  gameDiv.style.display = "block";
  
  // 2. モーダル枠は表示するが、背景や枠線を消すために「表示のみ」行い、
  //    中身のコンテンツ（ids）を非表示にする。
  if (modal) {
    modal.style.display = "flex";
    modal.classList.add("is-counting"); // 枠を消すためのクラスを付与
  }

  const originalDisplay = {};
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) { originalDisplay[id] = el.style.display || ""; el.style.display = "none"; }
  });

  // 3. カウントダウンの開始
  countdownDiv.style.display = "block";
  let count = 2; // 2から開始
  countdownDiv.textContent = count;

  return new Promise(resolve => {
    const timer = setInterval(() => {
      count--;
      if (count > 0) countdownDiv.textContent = count;
      else {
        clearInterval(timer);
        countdownDiv.style.display = "none";
        if (modal) modal.classList.remove("is-counting"); // クラスを削除

        // 元の要素を復帰
        ids.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = originalDisplay[id]; });

        updateGameButtonsUI(); // UIを更新
        // 速度メーター初期化
        gameState.speedCorrectChars = 0;
        gameState.speedStartTime = getNow();
        kpmHistory.length = 0;
        lastSpeedUpdate = 0;
        updateSpeedBar(0);   // ← ここで強制的にゼロに描画
        
        startGame(config).then(resolve);
      }
    }, 1000);
  });
}

// =====================================================
// 12. 再開・リトライ
// =====================================================
export function restartLastGame() {
  // 通常モードの再開
  const lastConfig = currentIsFreeMode ? lastGameByType.free : lastGameByType.normal;
  if (!lastConfig) {
    return startGame({ mode: GameModes.NORMAL, isFreeMode: currentIsFreeMode });
  }

  doCountdown({ ...lastConfig }); // カウントダウンを通して再開
}

export function retryMissed(){
  if(!gameState.missedTargets||gameState.missedTargets.length===0){ 
    console.warn("間違えた問題がありません。"); 
    return; 
  }
  doCountdown({ mode: GameModes.MISS_PRACTICE, practiceTargets: gameState.missedTargets, isRetryMode:true, isFreeMode:currentIsFreeMode });
}



// =====================================================
// 14. ゲーム終了判定
// =====================================================
export function checkGameEnd(){
  if(gameState.pos<gameState.text.length) return;

  const now = getNow();
  const elapsedSec = (now - gameStartTime)/1000; // 累積時間
  gameState.totalTime = elapsedSec;

  const chars = gameState.inputedRomaji.length;
  gameState.totalCorrect += gameState.correctCount;
  gameState.totalMistake += gameState.mistakeCount;
  gameState.totalChars += chars;

  if(gameState.mistakeCount>0) gameState.missedTargets.push({...shuffledTargets[gameState.currentIndex]});
  // 正解時（問題クリア時）
  gameState.solvedCount++;

  if (gameState.currentMode === GameModes.TIME_ATTACK && !isTimeUp) {
      setSolvedCount(gameState.solvedCount, gameState.currentMode.id);
  }

  // 合計に加算したので、重複防止のため現在の単語統計をクリア
  // これにより、finishGame での二重加算を防ぎつつ、タイムアップ時に打ちかけの文字を finishGame が拾えるようにします。
  gameState.correctCount = 0;
  gameState.mistakeCount = 0;
  gameState.inputedRomaji = "";
  gameState.typed = "";

  markProgressDoneFromRight(gameState.currentIndex);
  gameState.currentIndex++;

  if(gameState.currentMode.shouldContinue(buildState())){
    if(gameState.currentIndex>=shuffledTargets.length){ 
        finishGame(); return; 
    }

    loadText(gameState.currentIndex); 
    updateProgressBar(gameState.currentIndex,shuffledTargets.length);
    updateProgressText(gameState.currentIndex, shuffledTargets.length);
    return;
}

  if(gameState.currentMode.isFinished(buildState())) finishGame();
}


// =====================================================
// 15. ゲーム終了処理（totalTime 統一版）
// =====================================================
async function finishGame(config = {}) {
    if (isFinishing) return;
    isFinishing = true;
    gameState.isEnding = true; //pauseを終了後イントロでださないため。

    // タイムアタック等で、時間切れの瞬間に打ちかけていた文字を合計値に反映させる
    // checkGameEnd で加算済みの場合は 0 になっているので二重加算されません
    if (gameState.mistakeCount > 0) {
        const currentTarget = shuffledTargets[gameState.currentIndex];
        if (currentTarget) {
            gameState.missedTargets.push({ ...currentTarget });
        }
    }

    gameState.totalCorrect += gameState.correctCount;
    gameState.totalMistake += gameState.mistakeCount;
    gameState.totalChars += (gameState.inputedRomaji ? gameState.inputedRomaji.length : 0);

    stopTimeAttackTimer();
    stopTimeCircle(); 
    stopBGM();
    gameState.currentBgmInfo = null;

    if (typeof gameState.solvedCount !== "number" || gameState.solvedCount < 0) gameState.solvedCount = 0;

    // ゲーム終了時点の時間を固定（KPM計算の基準を確定させる）
    gameState.totalTime = (getNow() - gameStartTime) / 1000;

    const totalElapsed = Number(gameState.totalTime) || 0;
    const totalInputs = gameState.totalCorrect + gameState.totalMistake;

    // ★クエストモード（スキルチャレンジ等）は daily の記録・eScoreランク勲章の対象外
    const isQuestContext = !!(
        gameState.currentQuestNode ||
        gameState.currentChallenge?.isSkillMode ||
        gameState.isQuestMode
    );

    const accuracy =
        (shuffledTargets.length === 0 || totalInputs === 0)
            ? null
            : Math.round((gameState.totalCorrect / totalInputs) * 1000) / 10;

    const totalKpm =
        (shuffledTargets.length === 0 || gameState.totalTime <= 0)
            ? 0
            : Math.round(gameState.totalChars / (gameState.totalTime / 60));

    const eScore =
        (totalKpm > 0 && totalInputs > 0)
            ? Math.round(totalKpm * Math.pow(gameState.totalCorrect / totalInputs, 3))
            : 0;

    const eRank = getERank(eScore);

    const shouldSaveRecord =
        gameState.currentMode.saveToStats !== false &&
        !config.isRetryMode &&
        gameState.currentMode !== GameModes.MISS_PRACTICE &&
        !currentIsFreeMode &&
        shuffledTargets.length > 0 &&
        totalInputs > 0;

    // ★スキルモード専用分岐
    if (gameState.currentChallenge?.isSkillMode) {

        const hint = document.getElementById("skillUnlockHint");
        if (hint) hint.style.display = "none";

        // ==============================
        // ★ノード取得（安全に確保）
        // ==============================
        const node = gameState.currentQuestNode
            || gameState.currentSkillNode
            || { id: gameState.currentSkillNodeId };

        // ==============================
        // ★ノード挑戦回数を記録
        // ==============================
        if (node?.id) {
            addQuestSkillNodeAttempt(node.id);
        }

        // ==============================
        // ★結果処理
        // ==============================
        handleSkillModeResult(gameState.currentSkillNodeId);

        // ==============================
        // ★状態リセット
        // ==============================
        gameState.currentChallenge = null;
        gameState.currentSkillNodeId = null;

        isGameActive = false;
        notifyGameActivity(false); // ★裏読み込みを再開
        isFinishing = false;
        gameState.isEnding = false;

        return;
    }

    // ================================
    // 記録保存・ランキング
    // ================================
    let rankingResult = null;
    const diff = getCurrentDifficulty();

    let recordId = null; // ★ UUIDを保持する変数を追加
    let onlineUpdated = false; // ★ オンライン更新フラグ
    if (shouldSaveRecord) {
      rankingResult = addRankingEntry({
          date: new Date().toISOString(),
          mode: gameState.currentMode.id,
          difficulty: diff.id,
          difficultyName: diff.name,
          accuracy,
          totalCorrect: gameState.totalCorrect,
          totalMistake: gameState.totalMistake,
          totalChars: gameState.totalChars,
          totalTime: totalElapsed,
          kpm: totalKpm,
          eScore,
          eRank,
          solvedCount: gameState.solvedCount,
          ...gameState.currentMode.buildResultExtra(buildState())
      });

      recordId = rankingResult.record?.id; // ★ 返されたレコードからIDを取得

      // =========================
      // オンラインランキング送信
      // =========================
      let submitResult = null;
      try {
          submitResult = await submitScore({
              player_name: localStorage.getItem("playerName") || "NO NAME",
              score: eScore,
              kpm: totalKpm,
              solvedCount: gameState.solvedCount,
              accuracy,
              mode: gameState.currentMode.id,
              ranking_version: RANKING_VERSION,
              id: recordId // ★ UUIDを送信データに含める
          });
          onlineUpdated = submitResult?.onlineUpdated ?? false;
      } catch (err) {
          console.error("Online ranking submit failed:", err);
      }

      console.log("submit result:", submitResult);
  }

    // ================================
    // プレイヤーステータス更新
    // ★ フリーモードは regular に影響しない
    // ================================
    const stats = getPlayerStats();

    stats.achievements = Array.isArray(stats.achievements) ? stats.achievements : [];
    stats.seenAchievements = Array.isArray(stats.seenAchievements) ? stats.seenAchievements : [];

    const nowStr = new Date().toISOString();

    // ★ ミス練習判定
    const isMissPractice = gameState.currentMode.id === GameModes.MISS_PRACTICE.id;

    let updatedStats = updatePlayerStats(
      stats,
      isMissPractice
        ? {
            // ミス練習は「回数と時間だけ」
            totalTime: totalElapsed
          }
        : currentIsFreeMode
        ? {
            // フリーモード
            totalTime: totalElapsed
          }
        : {
            // 通常モード
            kpm: totalKpm,
            eScore,
            totalCorrect: gameState.totalCorrect,
            totalMistake: gameState.totalMistake,
            totalTime: totalElapsed,
            totalChars: gameState.totalChars
          },
      gameState.currentMode.id,
      nowStr,
      currentIsFreeMode,
      isQuestContext
    );

    updateHud(updatedStats);

    // ================================
    // 結果表示前イントロ
    // ================================
    // ★追加：デイリー or 通常終了演出
    let endMessage = "FINISHED";
    // ★イントロ表示
    await showGameEndIntro(endMessage, 1500);

    // ================================
    // 結果表示（フリーでも表示する仕様）
    // ================================
    showResult({
        totalTime: totalElapsed,
        totalCorrect: gameState.totalCorrect,   // gameState 経由
        totalMistake: gameState.totalMistake,   // gameState 経由
        totalChars: gameState.totalChars,       // gameState 経由
        solvedCount: gameState.solvedCount,     // gameState 経由
        mode: gameState.currentMode.id,
        totalKpm,
        eScore,
        eRank,
        accuracy,
        difficulty: diff,
        isFreeMode: currentIsFreeMode,
        totalInputs,
        totalTargets: shuffledTargets.length,
        isNewRecord: rankingResult?.isNewRecord ?? false,
        isRankIn: rankingResult?.isRankIn ?? false,
        rankPos: rankingResult?.rankPos ?? null,
        onlineUpdated: onlineUpdated, // ★ 結果表示に渡す
    });
    
    // 結果表示前にオフ。イントロ中にポーズを起動させないために使っている。
    gameState.isEnding = false;

    // ★GA: game_complete(ミス練は除外・個人情報なし)
    try {
      const completeMode = mapModeIdToAnalytics(gameState.currentMode?.id);
      const completePlayStyle = isQuestContext
        ? "quest"
        : currentIsFreeMode
          ? "free"
          : "daily";
      trackGameComplete({
        mode: completeMode,
        play_style: completePlayStyle,
        difficulty: diff?.id,
        score: typeof eScore === "number" ? eScore : undefined,
        solved:
          typeof gameState.solvedCount === "number"
            ? gameState.solvedCount
            : undefined,
        clear: totalInputs > 0,
      });
    } catch (e) {
      /* 計測失敗は無視 */
    }

    isGameActive = false;
    notifyGameActivity(false); // ★裏読み込みを再開
}

export function getERank(eScore) {
    if (eScore <= 21) return "E-"; if (eScore <= 38) return "E"; if (eScore <= 55) return "E+";
    if (eScore <= 72) return "D-"; if (eScore <= 89) return "D"; if (eScore <= 106) return "D+";
    if (eScore <= 123) return "C-"; if (eScore <= 140) return "C"; if (eScore <= 157) return "C+";
    if (eScore <= 174) return "B-"; if (eScore <= 191) return "B"; if (eScore <= 208) return "B+";
    if (eScore <= 225) return "A-"; if (eScore <= 242) return "A"; if (eScore <= 259) return "A+";
    if (eScore <= 274) return "S"; if (eScore <= 299) return "Great!"; if (eScore <= 324) return "Rapid";
    if (eScore <= 349) return "Falcon"; if (eScore <= 374) return "ShootingStar"; if (eScore <= 399) return "Lightning";
    if (eScore <= 449) return "Bullet"; if (eScore <= 499) return "Flash"; if (eScore <= 549) return "Blitz";
    if (eScore <= 599) return "LaserBeam"; if (eScore <= 649) return "Martian"; if (eScore <= 699) return "Cosmo";
    if (eScore <= 749) return "SuperNova"; return "God";
}


// =====================================================
// 16. タイムアタックタイマー
// =====================================================
function startTimeAttackTimer(){
  stopTimeAttackTimer();
  lastTaSecond = -1; // ★前回ゲームの秒表示キャッシュをリセット

  const limitSec = modeData.limitSec; 
  if (!limitSec || limitSec <= 0) return;

  timeLimitMs = limitSec * 1000;

  // ★ゲーム時間ベースで開始
  timeAttackStartTime = getNow();

  initTimeBar(limitSec);
}

function stopTimeAttackTimer(){ 
  timeLimitMs = 0;
  timeAttackStartTime = 0;
  setTimeLeft(null);
}

/**
 * タイムアタックの残り時間を更新する。
 * @returns {boolean} 表示秒が変わってDOM（タイマー表示）を更新した場合は true
 */
function updateTimeAttack() {
  if (!isGameActive || isTimeUp) return false;

  if (isPaused) return false;

  const elapsed = getNow() - timeAttackStartTime;
  const remainMs = timeLimitMs - elapsed;

  const sec = Math.max(0, Math.ceil(remainMs / 1000));
  let secChanged = false;
  if (sec !== lastTaSecond) {
    lastTaSecond = sec;
    setTimeLeft(sec); // ★秒が変わったときだけDOMを更新（毎フレームのinnerHTML再生成を廃止）
    secChanged = true;
  }

  if (remainMs <= 0) {
    isTimeUp = true;
    finishGame();
  }
  return secChanged;
}

// =====================================================
// 17. メニューに戻る
// =====================================================
export function backToMenu(){
  stopBGM(); 
  gameState.startTime = 0; //曲情報表示リセット
  isGameActive=false;
  isFinishing = false;
  gameState.isEnding = false;
  isPaused = false; 
  stopTimeCircle();
  // モーダル閉じる
  const modal = document.getElementById("gameModal");
  if (modal) {
    modal.style.display = "none";
  }

  // 中断したモードに合わせて適切なメニューカテゴリを表示する
  // ※ showCategory, showQuestMenu はグローバルまたは他で定義されている前提
  if (currentIsFreeMode && typeof showCategory === 'function') {
    showCategory('free');
  } else {
    const menu = document.getElementById("menu");
    if (menu) menu.style.display = "block";
  }

  setTimeout(()=>document.body.focus(),0);
}
// =====================================================
// 18. スピード(KPM)更新ループ
// =====================================================
// ★パフォーマンス:
//  - ゲーム非アクティブ / 終了演出中は rAF ループを完全に停止する
//    （再開は startGame / setGameActive(true) 内の ensureSpeedTickRunning が行う）
//  - ★v1.0.22: 毎フレームの renderState() を復活（安定状態へ復帰）。
//    打鍵時のみの描画 + rAF二重遅延では「タイプ表示の遅れ」が
//    起こるため、通常・タイムアタック等の DOM モードでは
//    毎フレーム描画で常に最新を表示する。
//  - performance.js の recordFrame（Auto品質の自動調整への入力）と
//    shouldRunFrame（FPSキャップ）は従来どおり適用する
//  - エネミー/防衛モードは各ゲームループ側で同じ処理を行うため、
//    二重計測・ゲート競合を避けるためにここでは適用しない
let speedTickActive = false;
let lastTaSecond = -1;    // タイムアタックで最後に表示した残り秒

function ensureSpeedTickRunning() {
  if (speedTickActive) return;
  speedTickActive = true;
  requestAnimationFrame(speedTick);
}

function speedTick(now){
  // ゲーム中かつ終了演出（isEnding）開始前のみロジックを動かす
  if(!isGameActive || gameState.isEnding){
    speedTickActive = false; // ★ループを完全に停止（メニュー中の常時rAFを廃止）
    return;
  }

  // ポーズ中はKPM更新停止（再開に備えてループは生かす）
  if (isPaused) {
    requestAnimationFrame(speedTick);
    return;
  }

  // ★低スペック対応: 実測FPSを計測し、Low品質時はフレームを間引く
  //   （キャンバス系モードでは各ゲームループが処理するためスキップ）
  if (!gameState.enemyMode) {
    recordFrame(now);
    if (!shouldRunFrame(now)) {
      requestAnimationFrame(speedTick);
      return;
    }
  }

  // ★タイピング文字・ステータスの描画はキー入力時（inputCore）に即時同期実行されるため、
  //   毎フレームの無条件 renderState() を廃止（低スペックPCのCPU負荷・入力遅延を根本解消）。
  //   時間経過でフェードするBGM曲名表示のみ毎フレーム更新する。
  renderBgmInfo(getNow());

  if (gameState.currentMode?.id === GameModes.TIME_ATTACK.id) {
    // タイマー数値のDOM更新は updateTimeAttack 内で「秒が変わったときだけ」行う
    updateTimeAttack();
  }
  if(now-lastSpeedUpdate>200){
    lastSpeedUpdate=now;
    const elapsed = getNow() - gameState.speedStartTime; //ポーズ補正あり
    const kpm = smoothKPM(calcKPM(gameState.speedCorrectChars,elapsed));
    updateSpeedBar(kpm);
  }
  requestAnimationFrame(speedTick);
}

// ===============================
// ゲーム中のモード別ボタン管理
// ===============================
function updateGameButtonsUI() {
  const gameBackBtn = document.getElementById("gameBackBtn");
  const backBtn = document.getElementById("backBtn");

  if (!gameBackBtn) return;

  // ★ スキルモード
  if (gameState.currentChallenge?.isSkillMode) {
    gameBackBtn.textContent = "BACK";
    gameBackBtn.style.display = "block"; // gameBackBtn を表示
    gameBackBtn.style = "center"; // 中央に配置
    if (backBtn) backBtn.style.display = "none";
    return;
  }

  // ★ 通常
  gameBackBtn.textContent = "BACK";
  gameBackBtn.style.display = "block"; // gameBackBtn を表示
  gameBackBtn.style = "center"; // 中央に配置
  if (backBtn) backBtn.style.display = "block";
}

// ===============================
// ★ポーズ管理（全モード共通）
// ===============================
let isPaused = false;

// ポーズ切り替え
export function togglePause() {
    if (!isGameActive) return;

    isPaused = !isPaused;

    if (isPaused) onPauseStart();
    else onPauseEnd();

    return isPaused;
}

// 状態取得
export function getPaused() {
    return isPaused;
}

// 明示セット（リトライなどで使う）
export function setPaused(v) {
    if (isPaused === v) return;

    isPaused = v;

    if (isPaused) onPauseStart();
    else onPauseEnd();
}

//時間ずれ対策
let pauseStart = 0;
let totalPauseTime = 0;

export function onPauseStart() {
    pauseStart = performance.now();
}

export function onPauseEnd() {
    totalPauseTime += performance.now() - pauseStart;
}

export function getNow() {
    return performance.now() - totalPauseTime;
}


// ===============================
// 結果前のイントロ（通常ゲーム）
// ===============================

function showGameEndIntro(message = "FINISHED", duration = 1200) {
  return new Promise(resolve => {
    const intro = document.getElementById("endIntro");
    if (!intro) return resolve();

    let textEl = intro.querySelector(".introText");

    if (!textEl) {
      textEl = document.createElement("div");
      textEl.className = "introText";
      intro.appendChild(textEl);
    }

    textEl.textContent = message;

    // 表示開始
    intro.style.display = "flex";

    // ★ イントロ中は右上HUDを非表示
    showHud(false);

    // 🔥 ここが最重要
    requestAnimationFrame(() => {
      intro.classList.add("show");
    });

    setTimeout(() => {
      intro.classList.remove("show");

      setTimeout(() => {
        intro.style.display = "none";
        showHud(true); // ★ HUDを再表示
        resolve();
      }, 400);

    }, duration);
  });
}
