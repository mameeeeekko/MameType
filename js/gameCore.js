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
  initTimeBar, setTimeLeft, setSolvedCount
} from './renderer.js';
import { playTypeSound, playMissSound, initAudio, flashMiss, stopBGM, playBGM, setMasterVolume, setBgmVolume, setSeVolume, setTypeVolume, setMissVolume, playTestSound as playTestSoundEffect } from "./effectManager.js";
import { GameModes} from "./gameModes.js";
import { updatePlayerStats, getPlayerStats} from "./playerStats.js";
import { updateHud} from "./hud.js";
import { resetCandidates, candidates, fullResetInput } from './inputCore.js';
import { showResult } from "./resultView.js";
import { getCurrentDifficulty, getDifficultyById } from "./difficulties.js";
import { handleSkillModeResult } from "./skillTreeResult.js"
import { initTimeCircle, stopTimeCircle, updateCircle } from "./renderer.js";
import { submitScore } from "../online/submitScore.js";
import { RANKING_VERSION } from "./version.js";
import { addQuestSkillNodeAttempt } from "./questPlayerStats.js";

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
export function setGameActive(v){
  isGameActive = v;
}

export let lastWasEnemyMode = false; //結果画面のもう一度につかう。
export function setLastWasEnemyMode(v){
  lastWasEnemyMode = v;
}
export function wasLastGameEnemyMode() {
    return lastWasEnemyMode;
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
        // ★追加
    enemyStats: {
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

let pendingRender=false;

export function initRenderer() {
  resetCandidates();
  renderState();
}

// 描画ラッパー（requestAnimationFrameでスムーズに）
export function renderState() {
  if (!pendingRender) {
    pendingRender = true;

    requestAnimationFrame(() => {
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

      pendingRender = false;
    });
  }
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

export function loadText(index) {
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

  // ① 先に描画だけする（軽い）
  renderState();
  // ② 重い処理は次フレームに回す
  requestAnimationFrame(() => {
    fullResetInput();
    resetCandidates();
  });

  // startTime は初回のみ設定
  if (index === 0) {
    gameStartTime = getNow();
  }
}


// =====================================================
// 11. ゲーム開始
// =====================================================
export async function startGame(config={mode:GameModes.NORMAL,isFreeMode:false}) {

  fullResetGame();

  setLastWasEnemyMode(false);

  await initAudio();
  if (getSoundEnabled() && getSoundSettings().bgm) {
  playBGM("bgm_normal1",0.2);
  }

  const modal = document.getElementById("gameModal");
  if(modal) modal.style.display="flex";

  const normalizedConfig = { mode:GameModes.NORMAL, isFreeMode:false, ...config };
  const diff =
    config.difficulty
      ? getDifficultyById(config.difficulty) 
      : getCurrentDifficulty();

  currentIsFreeMode = normalizedConfig.isFreeMode;
  gameState.isFreeMode = normalizedConfig.isFreeMode;
  gameState.currentMode = normalizedConfig.mode;
  gameState.isQuestMode = !!config.isQuestMode;
  gameState.currentChallenge = config.custom || {}; //skillTree関連フラグ
  gameState.currentSkillNodeId = config.custom?.nodeId || null;
  isGameActive = true;
  isFinishing = false;
  isRetrying = false;
  stopTimeAttackTimer();
  isTimeUp = false;
  gameState.isEnding = false;
  
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

    // ★① LONG_TEXTは専用処理
    if (gameState.currentMode.id === GameModes.LONG_TEXT.id) {
      const tags = modeData.custom?.tags || [];
      let filtered = TARGETS_LONG;
      if (tags.length > 0) {
        filtered = TARGETS_LONG.filter(target => {
          const targetTags = target.tags || [];
          return tags.every(tag => targetTags.includes(tag));
        });
      }
      shuffledTargets = shuffleArray(filtered);
    } else {
      shuffledTargets = gameState.currentMode.buildTargets({
        TARGETS,
        TARGETS_LONG,
        shuffleArray,
        modeData,
        diff,
      }) || [];
    }
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
  updateProgressBar(gameState.currentIndex, shuffledTargets.length);
  updateProgressText(gameState.currentIndex, shuffledTargets.length);
  updateGameButtonsUI();
}

// カウントダウン付き開始
export async function doCountdown(config) {

  setPaused(false); // ★ポーズ解除
  resetRendererState();
  fullResetInput();

  const countdownDiv = document.getElementById("countdown"); // 数字表示用
  const gameDiv = document.getElementById("game");           // ゲームコンテナ
  const modal = document.getElementById("gameModal");        // 枠

  if (!countdownDiv || !gameDiv) return startGame(config);

  const ids = [
    "word-wrap","jp-wrap","roma-wrap","word-long-wrap","scroll-wrap",
    "modeLabel","freeModeBadge","missModeBadge","progress-container","time-bar-container","speed-container",
    "speed-label","timeLeft","solvedCount","backBtn","gameBackBtn"
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

    if (typeof gameState.solvedCount !== "number" || gameState.solvedCount < 0) gameState.solvedCount = 0;

    // ゲーム終了時点の時間を固定（KPM計算の基準を確定させる）
    gameState.totalTime = (getNow() - gameStartTime) / 1000;

    const totalElapsed = Number(gameState.totalTime) || 0;
    const totalInputs = gameState.totalCorrect + gameState.totalMistake;

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
        isFinishing = false;
        gameState.isEnding = false;

        return;
    }

    // ================================
    // 記録保存・ランキング
    // ================================
    let rankingResult = null;
    const diff = getCurrentDifficulty();

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
              ranking_version: RANKING_VERSION
          });
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
      currentIsFreeMode
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
    });
    
    // 結果表示後にオフ。イントロ中にポーズを起動させないために使っている。
    gameState.isEnding = false;

    isGameActive = false;
}

export function getERank(eScore) {
    if (eScore <= 21) return "E-"; if (eScore <= 38) return "E"; if (eScore <= 55) return "E+";
    if (eScore <= 72) return "D-"; if (eScore <= 89) return "D"; if (eScore <= 106) return "D+";
    if (eScore <= 123) return "C-"; if (eScore <= 140) return "C"; if (eScore <= 157) return "C+";
    if (eScore <= 174) return "B-"; if (eScore <= 191) return "B"; if (eScore <= 208) return "B+";
    if (eScore <= 225) return "A-"; if (eScore <= 242) return "A"; if (eScore <= 259) return "A+";
    if (eScore <= 276) return "S"; if (eScore <= 299) return "Great!"; if (eScore <= 324) return "Rapid";
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

function updateTimeAttack() {
  if (!isGameActive || isTimeUp) return;

  if (isPaused) return;

  const elapsed = getNow() - timeAttackStartTime;
  const remainMs = timeLimitMs - elapsed;

  const sec = Math.max(0, Math.ceil(remainMs / 1000));
  setTimeLeft(sec);

  if (remainMs <= 0) {
    isTimeUp = true;
    finishGame();
  }
}

// =====================================================
// 17. メニューに戻る
// =====================================================
export function backToMenu(){
  stopBGM(); 
  isGameActive=false;
  isFinishing = false;
  gameState.isEnding = false;
  isPaused = false; 
  stopTimeCircle();
  // モーダル閉じる
  const modal = document.getElementById("gameModal");
  if(modal) modal.style.display="none";

  // ★ UIモードを通常に戻す（重要）
  setLongTextMode(false);

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
function speedTick(now){
  // ゲーム中かつ終了演出（isEnding）開始前のみロジックを動かす
  if(!isGameActive || gameState.isEnding){ 
    requestAnimationFrame(speedTick); 
    return; 
  }

  // ポーズ中はKPM更新停止
  if (isPaused) {
    requestAnimationFrame(speedTick);
    return;
  }

  if (gameState.currentMode.id === GameModes.TIME_ATTACK.id) {
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

  if (!gameBackBtn || !backBtn) return;

  // ★ スキルモード
  if (gameState.currentChallenge?.isSkillMode) {
    gameBackBtn.textContent = "戻る";
    backBtn.style.display = "none";
    return;
  }

  // ★ 通常
  gameBackBtn.textContent = "戻る";
  backBtn.style.display = "block";
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

    // 🔥 ここが最重要
    requestAnimationFrame(() => {
      intro.classList.add("show");
    });

    setTimeout(() => {
      intro.classList.remove("show");

      setTimeout(() => {
        intro.style.display = "none";
        resolve();
      }, 400);

    }, duration);
  });
}
