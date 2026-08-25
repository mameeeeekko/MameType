// defenseCore.js

import { renderDefenseUI, initDefenseComboTierBar, updateDefenseComboTierBar, ensureDefenseSoundToggle } from "./defenseRenderer.js";
import { renderSystemMessage, renderPhaseWarning } from "./enemyRenderer.js";
import { setupCanvasDPR } from "./canvasUtil.js";
import { handleKey, fullResetInput } from "./inputCore.js";
import { gameState, setGameActive, getPaused, setPaused, getNow, getERank, getSoundEnabled, getSoundSettings, renderState } from "./gameCore.js";
import { GameModes } from "./gameModes.js";
import { STAGES, getStageConfig } from "./enemyModeConfig.js";
import { playSE, stopBGM, playBGM, clearAllEffects, playErrorSound, playDialogueSound } from "./effectManager.js";
import { showDefenseResult } from "./defenseResult.js";
import { showEnemyEndIntro, showQuestResult } from "./questResult.js";
import { TARGETS } from "./target.js";
import { closeDialogue, startDialogue, DIALOGUE_DATA, showDialoguePlaybackChoicePopup } from "./dialogue.js";
import { showHud } from "./main.js";
import { spawnTimeBonusPopup, renderTimeBonusPopups } from "./effectManager.js";
import { STAR_EVALUATORS } from "./starEvaluator.js";
import { markCleared, setStar, hasDialogueBeenPlayed, hasSeenTrueEnding } from "./questProgress.js";
import { getPlayerStats, updatePlayerStats } from "./playerStats.js";
import { scoreToExp, addExp, getPlayerStatsForEnemy, updateQuestStats } from "./questPlayerStats.js";
import { addRankingEntry } from "./storage.js";
import { submitScore } from "../online/submitScore.js";
import { RANKING_VERSION } from "./version.js";

const canvas = document.getElementById("defenseModeCanvas");
const ctx = canvas.getContext("2d");

let loopId = null;
let defenseLoopActive = false;
let endingSequence = false;

let defenseState = { // gameState.enemyStats として扱われる
  isActive: false,
  totalCharsToType: 0,
  typedChars: 0,
  timeLimit: 0,
  remainingTime: 0,
  missPenalty: 0,
  corruptionRate: 0,
  wordList: [],
  currentWordIndex: 0,
  startTime: 0,
  typed: "",
  inputedRomaji: "",
  // コンボ関連
  currentCombo: 0,
  maxCombo: 0,
  comboTierUsed: [], // タイム延長ボーナス使用済みフラグ
};
let lastDefenseConfig = {};

// ===============================
// 防衛モード専用コンボ設定
// ===============================
export const DEFENSE_OVERDRIVE_COMBO = 251;

const DEFENSE_COMBO_TIERS = [
    { min: 1,   max: 40  },
    { min: 41,  max: 80  },
    { min: 81,  max: 130  },
    { min: 131,  max: 180 },
    { min: 181, max: DEFENSE_OVERDRIVE_COMBO -1 },
];
export { DEFENSE_COMBO_TIERS };

// コンボによるタイムボーナス設定 (秒)
const COMBO_TIME_BONUSES = [2, 3, 5, 8, 10];

// 1文字あたりの基準スコアとコンボ倍率
export const DEFENSE_SCORE_CONFIG = {
    baseScorePerChar: 5,
    // コンボティア(DEFENSE_COMBO_TIERS)に合わせて倍率を設定
    comboMultipliers: [
        { count: DEFENSE_OVERDRIVE_COMBO, value: 3.0 }, // オーバードライブ
        { count: DEFENSE_COMBO_TIERS[4].min, value: 2.5 }, // Tier 5
        { count: DEFENSE_COMBO_TIERS[3].min, value: 2.0 }, // Tier 4
        { count: DEFENSE_COMBO_TIERS[2].min, value: 1.5 }, // Tier 3
        { count: DEFENSE_COMBO_TIERS[1].min, value: 1.2 }  // Tier 2
    ]
};

// コンボティアの閾値
const COMBO_THRESHOLDS = DEFENSE_COMBO_TIERS.map(t => t.max);

export function startDefenseMode(config = {}) {
  closeDialogue();
  setPaused(false);
  // HUDを非表示にする
  showHud(false);

  lastDefenseConfig = {
    ...config,
    isQuestMode: config.isQuestMode ?? false,
    isFreeMode: config.isFreeMode ?? false,
  };
  const stageConfig = STAGES["DEFENSE_STAGE"];
  // Use custom config for totalCharsToType and timeLimit if provided (from free mode or quest mode)
  const totalChars = config.custom?.totalCharsToType ?? 300;
  const timeLimitMs = (config.custom?.timeLimit ?? 120) * 1000; // Assume seconds if not specified, then convert
  const missPenaltyMs = (config.custom?.missPenalty ?? 1.5) * 1000; // Allow custom miss penalty

  // 設定からジャンル配列と文字数範囲を取得
  let genres = config.custom?.genres || ['empty']; // デフォルトは '標準'
  const minLength = config.custom?.minLength || 1;
  const maxLength = config.custom?.maxLength || 10;

  // 「すべて」が選択されている場合は、TARGETSに存在する全てのタグを対象とする
  if (genres.includes('all')) {
    const allTags = new Set(TARGETS.flatMap(t => t.tags).filter(Boolean)); // 空タグを除外
    genres = ['empty', ...Array.from(allTags)];
  }

  let wordPool = TARGETS.filter(t => {
    // 文字数範囲でフィルタリング
    if (t.text.length < minLength || t.text.length > maxLength) return false;
    
    // ジャンルでフィルタリング
    if (genres.includes('empty') && (!t.tags || t.tags.length === 0)) return true;
    return t.tags && t.tags.some(tag => genres.includes(tag));
  });

  // ★ wordPoolが空の場合のフォールバック処理
  if (wordPool.length === 0) {
      console.warn("Defense Mode: Filtered word pool is empty. Falling back to all words within length constraints.");
      // まずはジャンル指定を無視して、文字数範囲に合う全ての単語を試す
      wordPool = TARGETS.filter(t => t.text.length >= minLength && t.text.length <= maxLength);
      if (wordPool.length === 0) {
          console.error("Defense Mode: Even fallback word pool is empty. Using 'タイピング'.");
          // それでも空なら、最終手段として「タイピング」を使用
          wordPool = [{ word: "タイピング", text: "たいぴんぐ" }];
      }
  }

  // 最初に50個の単語を生成する
  let generatedWord = "";
  let generatedText = "";
  const initialWordCount = 50;
  // ★ シャッフルして重複を防ぐ
  const shuffledPool = [...wordPool].sort(() => 0.5 - Math.random());
  let poolIndex = 0;

  for (let i = 0; i < initialWordCount; i++) {
    // ★ プールが尽きたらリセットして再度シャッフル
    if (poolIndex >= shuffledPool.length) {
        poolIndex = 0;
        // 再シャッフル
        shuffledPool.sort(() => 0.5 - Math.random());
    }
    const word = shuffledPool[poolIndex] || { word: "タイピング", text: "たいぴんぐ" };
    generatedWord += word.word + " ";
    generatedText += word.text + " ";
    poolIndex++;
  }
  // ★ 現在のプールとインデックスをstateに保存
  defenseState.wordPool = shuffledPool;
  defenseState.poolIndex = poolIndex;

  const longText = {
    word: generatedWord.trim(),
    text: generatedText.trim()
  };

  // ★ defenseStateをgameState.enemyStatsとして初期化
  defenseState = {
    prevCombo: 0,
    isActive: true,
    totalCharsToType: totalChars,
    typedChars: 0,
    countedTypedChars: 0,
    timeLimit: timeLimitMs,
    remainingTime: timeLimitMs,
    missPenalty: missPenaltyMs,
    corruptionRate: 0,
    wordList: [longText],
    startTime: getNow(),
    typed: "",
    inputedRomaji: "",
    currentWordPos: 0,

    // enemyStats互換のプロパティ
    failed: false,
    typingActiveTime: 0,
    solvedCount: 0, // ★解いた単語数
    lastKeyTime: 0,
    totalTyped: 0,
    correctCount: 0,
    mistakeCount: 0,
    // オーバードライブ中の文字数カウント用
    overdriveCharCount: 0, 
  awardedOverdriveBonuses: 0, // 授与済みのオーバードライブボーナス回数
    gScore: 0, // ★スコア
    // コンボ関連
    currentCombo: 0,
    maxCombo: 0,
    // 演出用
    isTransitioning: false,
    transitionMsg: null,
    nextPhaseGoal: null,
    comboTierUsed: new Array(COMBO_THRESHOLDS.length).fill(false),
    endingAnimation: null,

  };

  // gameStateの初期化
  Object.assign(gameState, {
    mode: GameModes.DEFENSE_MODE,
    isFreeMode: lastDefenseConfig.isFreeMode,
    isQuestMode: false,
    currentMode: GameModes.DEFENSE_MODE,
    enemyMode: true,
    text: longText.text,
    pos: 0,
    enemyStats: defenseState, // ★ defenseStateを直接参照
  });
  gameState.isQuestMode = lastDefenseConfig.isQuestMode; // ★クエストモードのフラグを設定

  fullResetInput();
  clearAllEffects();

  const defenseContainer = document.getElementById("defenseModeContainer");
  defenseContainer.style.display = "block";
  canvas.style.display = "block";
  
  // 防衛モード用UIコンテナを表示
  const uiContainer = document.getElementById("defense-ui-container");
  if (uiContainer) {
    uiContainer.style.display = "block";
    uiContainer.style.opacity = "1";
    uiContainer.style.transition = "";
  }

  // ★ 通常エネミーモードのUIコンテナを非表示にする
  const enemyUiContainer = document.getElementById("enemy-ui-container");
  if (enemyUiContainer) enemyUiContainer.style.display = "none";


  setupCanvasDPR(canvas, defenseContainer, ctx);
  initDefenseComboTierBar(); // ★防衛モード用のコンボバーを初期化
  ensureDefenseSoundToggle(); // ★サウンドトグルUIを初期化

  setGameActive(true);

  // ★ 防衛戦BGM
  // クエスト側から指定されたBGMを最優先し、
  // 指定がなければ通常のDEFENSE_MODEのBGMを使用する
  const defenseBgm =
    config.bgm ??
    config.custom?.bgm ??
    GameModes.DEFENSE_MODE.bgm;

  if (getSoundEnabled() && getSoundSettings().bgm) {
    playBGM(defenseBgm, 1.0);
    gameState.startTime = getNow(); // BGM表示タイマーをリセット
  }

  // --- 開始演出 ---
  defenseState.isTransitioning = true;
  defenseState.transitionMsg = 
    lastDefenseConfig.isQuestMode ? "QUEST / DEFENSE MODE START" :
    lastDefenseConfig.isFreeMode ? "FREE / DEFENSE MODE START" : 
    "DEFENSE MODE START";
  defenseState.nextPhaseGoal = `MISSION: TYPE ${totalChars} CHARACTERS`;

  setTimeout(() => {
      defenseState.isTransitioning = false;
      defenseState.transitionMsg = null;
      defenseState.nextPhaseGoal = null;
      // タイマーを開始
      defenseState.startTime = getNow();
  }, 2500);
  // ----------------

  endingSequence = false;
  defenseLoopActive = true;
  loopId = requestAnimationFrame(gameLoop);
}

function gameLoop(timestamp) {
  if (!defenseLoopActive) return;

  if (getPaused()) {
    const deltaMs = timestamp - (gameState._lastFrameTime || timestamp);
    if (defenseState.startTime != null) defenseState.startTime += deltaMs;
    if (defenseState.endingAnimation?.active) defenseState.endingAnimation.startTime += deltaMs;
    gameState._lastFrameTime = timestamp;
    loopId = requestAnimationFrame(gameLoop);
    return;
  }

  const now = timestamp;
  const deltaTime = now - (gameState._lastFrameTime || now);
  gameState._lastFrameTime = now;

  // 時間減少
  // 演出中はタイマーを停止
  // ★ startTimeが設定されてからタイマーを開始する
  if (!defenseState.isTransitioning && defenseState.startTime > 0 && !endingSequence) {
    defenseState.remainingTime -= deltaTime;
    if (defenseState.remainingTime < 0) {
      defenseState.remainingTime = 0;
    }
  }

  // 侵食率の計算
  // ★ 開始演出中は侵食率を0に固定する
  if (defenseState.isTransitioning) {
    defenseState.corruptionRate = 0;
  } else if (defenseState.endingAnimation?.active) {
    // 終了演出アニメーション中の侵食率・パーティクル更新
    const anim = defenseState.endingAnimation;
    const elapsed = getNow() - anim.startTime;
    anim.progress = Math.min(1.0, Math.max(0, elapsed / anim.duration));

    if (anim.type === 'failure') {
      // 失敗: 加速しながら一気に 1.0 (全侵食) へ
      const ease = Math.pow(anim.progress, 2.2);
      defenseState.corruptionRate = Math.min(1.0, anim.initialCorruption + (1.0 - anim.initialCorruption) * ease);
    } else {
      // 成功: 一気に外側へ押し戻されて 0.0 (浄化消滅) へ
      const ease = 1 - Math.pow(1 - anim.progress, 3);
      defenseState.corruptionRate = Math.max(0, anim.initialCorruption * (1 - ease));
    }

    // パーティクルの更新
    if (anim.particles) {
      for (const p of anim.particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.98;
        p.vy *= 0.98;
        p.life -= p.decay;
        p.alpha = Math.max(0, p.life);
      }
    }
  } else {
    // 時間の進捗率 (0から1へ)
    const timeProgress = 1 - (defenseState.remainingTime / defenseState.timeLimit);
    // タイピングの進捗率 (0から1へ)
    const typingProgress = defenseState.countedTypedChars / (defenseState.totalCharsToType || 1);
    // タイピングによる侵食抑制効果の係数（1.0だと時間とタイピングが同じペースで進むと0になる）
    const typingProgressFactor = 0.2; // 係数を0.8にして、タイピングが少し不利になるように調整
    // 侵食率を計算。時間は常に侵食を進め、タイピングでそれを押し戻す。
    defenseState.corruptionRate = Math.max(0, timeProgress - (typingProgress * typingProgressFactor));
  }
  // ctx.clearRect(0, 0, canvas.width, canvas.height); // renderCyberGridBackgroundが背景を塗りつぶすため不要
  renderDefenseUI(ctx, defenseState);


  // 開始演出の描画
  renderSystemMessage(ctx, gameState, canvas);
  renderPhaseWarning(ctx, defenseState, canvas);
  
  // コンボバー更新
  updateDefenseComboTierBar(defenseState);

  // ポップアップエフェクト描画
  renderTimeBonusPopups(ctx);

  // 終了判定
  if (!endingSequence) {
    if (defenseState.remainingTime <= 0) {
      const isFailed = defenseState.countedTypedChars < defenseState.totalCharsToType;
      startDefenseEndingSequence(isFailed);
    }
  }

  loopId = requestAnimationFrame(gameLoop);
}

/**
 * 防衛モード終了直後の成否演出アニメーションを開始
 * @param {boolean} isFailed - 失敗フラグ
 */
export function startDefenseEndingSequence(isFailed) {
  endingSequence = true;
  gameState.enemyStats.failed = isFailed;
  defenseState.failed = isFailed;

  const duration = 1400; // 1.4秒
  const initialCorruption = defenseState.corruptionRate;

  // パーティクル生成
  const particles = [];
  const cw = canvas.clientWidth || 1400;
  const ch = canvas.clientHeight || 900;
  const centerX = cw / 2;
  const centerY = ch / 2;
  const particleCount = isFailed ? 60 : 75;

  for (let i = 0; i < particleCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = isFailed ? (Math.random() * 5 + 2) : (Math.random() * 7 + 3);
    particles.push({
      x: centerX,
      y: centerY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: Math.random() * 4 + 2,
      color: isFailed 
        ? (Math.random() > 0.5 ? "rgba(255, 50, 50, 0.9)" : "rgba(255, 120, 50, 0.8)")
        : (Math.random() > 0.4 ? "rgba(100, 240, 255, 0.9)" : "rgba(255, 255, 255, 0.9)"),
      alpha: 1.0,
      life: 1.0,
      decay: Math.random() * 0.02 + 0.015
    });
  }

  defenseState.endingAnimation = {
    active: true,
    type: isFailed ? 'failure' : 'success',
    startTime: getNow(),
    duration: duration,
    initialCorruption: initialCorruption,
    progress: 0,
    particles: particles
  };

  // UIコンテナをフェードアウト
  const uiContainer = document.getElementById("defense-ui-container");
  if (uiContainer) {
    uiContainer.style.transition = "opacity 0.4s ease";
    uiContainer.style.opacity = "0";
  }

  // 効果音再生
  if (isFailed) {
    playSE("damage1");
    setTimeout(() => {
      if (endingSequence && defenseLoopActive) playSE("chain_break");
    }, 300);
  } else {
    playSE("guard", 1, 1, 0, 3);
    setTimeout(() => {
      if (endingSequence && defenseLoopActive) {
        playSE("combo_tier_max");
        playSE("heal2");
      }
    }, 250);
  }

  // アニメーション完了後に endDefenseMode を実行
  setTimeout(() => {
    if (defenseState.endingAnimation?.active && defenseLoopActive) {
      endDefenseMode();
    }
  }, duration + 100);
}

export function handleDefenseKey(e, isRecursiveCall = false) {
    if (endingSequence || getPaused()) return;

    // ★ タイプ音を再生
    playDialogueSound();

    const now = getNow();

    if (gameState.enemyStats.lastKeyTime > 0) {
        const diff = now - gameState.enemyStats.lastKeyTime;

        if (diff < 2000) {
            gameState.enemyStats.typingActiveTime += diff;
        }
    }

    gameState.enemyStats.lastKeyTime = now;

    const fullText = defenseState.wordList[0]?.text;
    if (!fullText) return;

    // ★コンボアニメーションのために、キー入力前のコンボ数を保存
    gameState.enemyStats.prevCombo = gameState.enemyStats.currentCombo;

    // ========================================================= 
    // ★ 現在位置のスペースを自動でスキップ
    // =========================================================

    while (fullText[defenseState.typedChars] === " ") {
        defenseState.typedChars++;
    }

    // ========================================================= 
    // ★ 再帰呼び出しの場合
    // スペースを飛ばしたところで終了
    // =========================================================

    if (isRecursiveCall) {
        return;
    }

    // ========================================================= 
    // 現在の単語を取得
    // =========================================================

    const remainingText =
        fullText.substring(defenseState.typedChars);

    const spaceIndex =
        remainingText.indexOf(" ");

    const currentWord =
        spaceIndex === -1
            ? remainingText
            : remainingText.substring(0, spaceIndex);

    // ========================================================= 
    // inputCoreへ渡す
    // =========================================================

    const tempGameState = {
        text: currentWord,
        typed: defenseState.typed,
        pos: defenseState.currentWordPos,
        inputedRomaji: defenseState.inputedRomaji,
        correctCount: defenseState.correctCount, // ★現在の正解数を渡す
        mistakeCount: defenseState.mistakeCount, // ★現在のミス数を渡す
        enemyStats: defenseState, // ★ defenseStateをenemyStatsとして渡す
    };

    const result = handleKey(e, true, tempGameState, { type: 'romaji', processComboInSilent: true });

    // inputCoreの状態を反映
    defenseState.typed = tempGameState.typed;
    defenseState.inputedRomaji =
        tempGameState.inputedRomaji;

    defenseState.currentWordPos =
        tempGameState.pos;

    // ★ inputCoreで更新された統計情報をdefenseStateに反映する
    defenseState.correctCount = tempGameState.correctCount;
    defenseState.mistakeCount = tempGameState.mistakeCount;

    // ========================================================= 
    // ミス
    // =========================================================

    if (result.isMiss) {
        // ミス時のコンボリセットはinputCoreに任せる
        // defenseState.currentCombo = 0; // 削除

        defenseState.remainingTime -=
            defenseState.missPenalty;

        gameState.enemyStats.mistakeCount++;

        // 現在の単語を取得
        const allWords = fullText.split(" ");

        let charCount = 0;
        let missedWord = null;

        for (const word of allWords) {
            if (
                defenseState.typedChars >= charCount &&
                defenseState.typedChars <
                    charCount + word.length
            ) {
                missedWord = word;
                break;
            }

            charCount += word.length + 1;
        }

        if (
            missedWord &&
            !gameState.missedTargets.some(
                t => t.text === missedWord
            )
        ) {
            gameState.missedTargets.push({
                word: missedWord,
                text: missedWord,
                tags: []
            });
        }

        playErrorSound();

        return;
    }

    // ========================================================= 
    // ★ 正解時処理 (1文字でも正解した場合)
    // =========================================================
    if (result.charCount > 0) {
        // スコア加算
        const scoreConfig = DEFENSE_SCORE_CONFIG;
        let multiplier = 1.0;
        for (const tier of scoreConfig.comboMultipliers) {
            if (defenseState.currentCombo >= tier.count) {
                multiplier = tier.value;
                break;
            }
        }
        const gainedScore = Math.floor(scoreConfig.baseScorePerChar * multiplier * result.charCount);
        defenseState.gScore += gainedScore;

        // ★ オーバードライブ中のタイムボーナス (カウンターはリセットしない)
        if (defenseState.currentCombo >= DEFENSE_OVERDRIVE_COMBO) {
            defenseState.overdriveCharCount += result.charCount;

            // 現在の総文字数で獲得できるボーナス回数を計算
            const potentialBonuses = Math.floor(defenseState.overdriveCharCount / 40);

            // まだ授与されていないボーナスがあるかチェック
            if (potentialBonuses > defenseState.awardedOverdriveBonuses) {
                const newBonusesToAward = potentialBonuses - defenseState.awardedOverdriveBonuses;
                const timeBonusMs = newBonusesToAward * 5000; // 5秒
                const timeBonus = timeBonusMs / 1000;
                defenseState.remainingTime += timeBonusMs;
                defenseState.awardedOverdriveBonuses = potentialBonuses; // 授与済み回数を更新
                // ポップアップ表示 (コンボバー側)
                const comboBarRect = document.getElementById("defenseComboTierWrapper")?.getBoundingClientRect(); // このIDは存在しない可能性あり
                const canvasRect = canvas.getBoundingClientRect();
                const popupX = comboBarRect ? comboBarRect.left - canvasRect.left - 40 : canvas.clientWidth / 2; // 少し左へ
                const popupY = comboBarRect ? comboBarRect.top - canvasRect.top + comboBarRect.height + 10 : 50; // 少し下へ
                spawnTimeBonusPopup(popupX, popupY, `+${timeBonus}s`, { type: 'fade' }); // コンボバー側
                // ポップアップ表示 (メインタイム表示の近くにも)
                const popupXTime = canvas.clientWidth / 2 + 100; // 少し左へ
                const popupYTime = 45; // メインタイム表示の後ろ（少し下）
                spawnTimeBonusPopup(popupXTime, popupYTime, `+${timeBonus}s`, { type: 'float', vy: -0.3 }); // 以前の浮き上がるアニメーションに戻す
                playSE("combo_tier1"); // タイムボーナス音
            }
        }
    }

    // コンボはinputCore.jsによってdefenseState (== gameState.enemyStats) が直接更新される
    if (result.isComplete) {
      // コンボティアに応じたタイムボーナスをチェック

      for (let i = 0; i < COMBO_THRESHOLDS.length; i++) {
        // ティアの閾値を超えていて、まだボーナスを受け取っていない場合
        // ★ ティアを「完了」した瞬間にボーナス
        // prevCombo < threshold <= currentCombo のようなロジックで判定
        const threshold = COMBO_THRESHOLDS[i];
        if (gameState.enemyStats.prevCombo < threshold && gameState.enemyStats.currentCombo >= threshold) {

          const bonusTime = COMBO_TIME_BONUSES[i] * 1000; // 秒をミリ秒に変換
          defenseState.remainingTime += bonusTime;
          // ポップアップ表示 (コンボバーの左側に表示)
          const comboBarRect = document.getElementById("defenseComboTierWrapper")?.getBoundingClientRect(); // このIDは存在しない可能性あり
          const canvasRect = canvas.getBoundingClientRect();
          const popupX = comboBarRect ? comboBarRect.left - canvasRect.left - 40 : canvas.clientWidth / 2; // 少し左へ
          const popupY = comboBarRect ? comboBarRect.top - canvasRect.top + comboBarRect.height + 5 : 50; // 少し下へ
          spawnTimeBonusPopup(popupX, popupY, `+${COMBO_TIME_BONUSES[i]}s`, { type: 'fade' }); // コンボバー側
          // ポップアップ表示 (メインタイム表示の近くにも)
          const popupXTime = canvas.clientWidth / 2 + 100; // 少し左へ
          const popupYTime = 45; // メインタイム表示の後ろ（少し下）
          spawnTimeBonusPopup(popupXTime, popupYTime, `+${COMBO_TIME_BONUSES[i]}s`, { type: 'float', vy: -0.3 }); // 以前の浮き上がるアニメーションに戻す
          playSE("combo_tier1");
          break; // 1フレームで複数のボーナスが発動しないようにする
        }
      }
    }

    // ========================================================= 
    // ★ 単語完成
    // =========================================================
    if (
        result.isComplete &&
        tempGameState.pos >= currentWord.length
    ) {
        const charsToAdd = currentWord.length;

        // -----------------------------------------------------
        // ★ 元文章上の位置
        // -----------------------------------------------------

        defenseState.countedTypedChars += charsToAdd;

        // 正解文字数

        // -----------------------------------------------------
        // 入力状態をリセット
        // -----------------------------------------------------

        defenseState.typed = "";
        defenseState.inputedRomaji = "";
        defenseState.currentWordPos = 0;

        playSE("select", 0.8);

        // -----------------------------------------------------
        // ★ 次の単語へ移動するために、元テキスト上の文字数を進める
        // -----------------------------------------------------
        defenseState.typedChars += charsToAdd + 1; // 単語の文字数 + スペース1文字分

        // -----------------------------------------------------
        // ★ 次の単語へ移動
        //
        // ここではキーイベントを再利用しない。

        // ★単語数をカウント
        defenseState.solvedCount++;
        // 次の入力時に、新しい currentWord が取得される。

    // =========================================================
    // ★ フリーモードで単語が尽きそうなら補充する
    // =========================================================
    // 残りの単語数を計算
    const remainingWords = fullText.substring(defenseState.typedChars).split(' ').filter(w => w).length;

    // 残り単語数が5未満になったら新しい単語を追加
    if (remainingWords < 20) {
      let genres = lastDefenseConfig.custom?.genres || ['']; // 'empty' -> '' に修正
      const minLength = lastDefenseConfig.custom?.minLength || 1;
      const maxLength = lastDefenseConfig.custom?.maxLength || 10;

      if (genres.includes('all')) {
        const allTags = new Set(TARGETS.flatMap(t => t.tags));
        genres = ['empty', ...Array.from(allTags)];
      }

      let wordPool = TARGETS.filter(t => {
        if (t.text.length < minLength || t.text.length > maxLength) return false;
        if (genres.includes('') && (!t.tags || t.tags.length === 0)) return true;
        return t.tags.some(tag => genres.includes(tag));
      });

      // ★ 補充用の単語プールをシャッフル
      const shuffledPool = [...wordPool].sort(() => 0.5 - Math.random());
      let poolIndex = 0;

      let newWords = "";
      let newTexts = "";
      const wordsToAdd = 50;
      for (let i = 0; i < wordsToAdd; i++) {
          if (poolIndex >= shuffledPool.length) {
              poolIndex = 0;
              shuffledPool.sort(() => 0.5 - Math.random());
          }
          const word = shuffledPool[poolIndex] || { word: "タイピング", text: "たいぴんぐ" };
          newWords += " " + word.word;
          newTexts += " " + word.text;
          poolIndex++;
      }
      defenseState.wordList[0].word += newWords;
      defenseState.wordList[0].text += newTexts;
      // ★ 更新されたプールとインデックスを保存
      defenseState.wordPool = shuffledPool;
      defenseState.poolIndex = poolIndex;
    }
        // -----------------------------------------------------

        return;
    }
}

async function endDefenseMode(isAbort = false) {
  if (defenseState.endingAnimation) {
    defenseState.endingAnimation.active = false;
  }

  defenseLoopActive = false;
  cancelAnimationFrame(loopId);
  setGameActive(false);
  stopBGM();
  
  // ★ defense-ui-container も非表示＆スタイルリセット
  const uiContainer = document.getElementById("defense-ui-container");
  if (uiContainer) {
    uiContainer.style.display = "none";
    uiContainer.style.opacity = "";
    uiContainer.style.transition = "";
  }
  // ★ 最終的な侵食率を保存
  const finalCorruptionRate = defenseState.corruptionRate;

  // ★ コンテナとキャンバスを非表示にする
  const defenseContainer = document.getElementById("defenseModeContainer");
  if (defenseContainer) defenseContainer.style.display = "none";
  if (canvas) canvas.style.display = "none";



  // HUDを再表示
  showHud(true);

  const stats = gameState.enemyStats;
  stats.endTime = getNow();

  // defenseStateの最終状態もstatsにマージ
  Object.assign(stats, {
    remainingTime: defenseState.remainingTime,
    maxCombo: gameState.enemyStats.maxCombo, // ★ inputCoreで更新されたmaxComboを参照
    timeLimit: defenseState.timeLimit,    
    finalCorruptionRate: finalCorruptionRate, // ★ 最終値を保存
    // ★ ひらがなベースの文字数を追加
    totalKeyChars: defenseState.totalCharsToType,
    countedKeyChars: defenseState.countedTypedChars,
    isInvalidRun: defenseState.correctCount + defenseState.mistakeCount === 0 // If no keys were typed
  });

  // totalKeystrokes（総打鍵数）を正解ローマ字数とミス数の合計に修正
  stats.totalKeystrokes = stats.correctCount + stats.mistakeCount;

  // accuracy（正確性）の計算を totalKeystrokes を使うように修正
  stats.accuracy = (stats.correctCount / Math.max(1, stats.totalKeystrokes)) * 100;

  // KPMとskillScoreの計算
  const elapsedSec = Math.max(0.001, stats.typingActiveTime / 1000);
  stats.gKpm = Math.round((stats.correctCount / elapsedSec) * 60);
  stats.skillScore = Math.round(stats.gKpm * Math.pow(stats.accuracy / 100, 3));
  
  // ★防衛モードではgScoreをそのまま最終スコアとし、skillScoreからランクを計算
  stats.gScore = defenseState.gScore;
  stats.rank = getERank(stats.skillScore); 

  // ★スコア計算の内訳を追加
  stats.scoreBreakdown = { // eslint-disable-line no-unused-vars
    base: stats.gScore, // ベーススコアはgScore
    accuracy: 0,
    chain: 0,
    speed: 0,
    difficulty: 0,
    clearBonus: 0,
    noMissBonus: 0,
    noDamageBonus: 0,
    totalMultiplier: 1.0,
  };
  stats.difficultyName = "Defense"; // 難易度名を固定

  // 中断時は結果画面を表示しない
  if (!isAbort) { // eslint-disable-line no-unreachable
    // ★フリーモードまたはクエストモードでない場合のみ記録
    if (lastDefenseConfig.isQuestMode) {
      // ===============================
      // クエストモードの結果処理
      // ===============================
      const node = gameState.currentQuestNode;
      const stageConfig = getStageConfig(node.stage);

      // 星評価
      let starCount = 0;
      if (stageConfig?.star && !stats.isInvalidRun) {
        const evaluator = STAR_EVALUATORS[stageConfig.star.type];
        if (evaluator) {
          starCount = evaluator(
            stats,
            {
              player: defenseState, // defenseStateからプレイヤー情報を参照
              stage: stageConfig,
              now: getNow(),
              startTime: defenseState.startTime,
            },
            stageConfig.star
          );
        }
      }

      // マップのノード解放と星の保存
      if (!stats.failed && node) {
        markCleared(node.id, node.next, node.nextWorld);
        if (starCount > 0) {
          setStar(node.id, starCount);
        }
      }

      const playerBefore = getPlayerStatsForEnemy("quest");
      let gainedExp = 0;
      if (!stats.isInvalidRun) {
        const baseExp = scoreToExp(stats.gScore);
        const failMultiplier = stats.failed ? 0.5 : 1.0;
        const starMultiplierTable = {
            0: 0.5, 1: 1.0, 2: 1.05, 3: 1.1, 4: 1.2, 5: 1.3
        };
        const starMultiplier = starMultiplierTable[starCount] ?? 1.0;
        const expMultiplierFromSkills = (playerBefore.expMultiplier || 1);
        gainedExp = Math.floor(
            baseExp *
            failMultiplier *
            starMultiplier *
            expMultiplierFromSkills
        );
      }

      const prevExp = playerBefore.exp;
      const expResult = addExp(gainedExp);
      const afterStats = getPlayerStatsForEnemy("quest");

      const questStats = {
        ...stats,
        isQuestMode: true, // ★クエストモードであることを明示
        skillScore: stats.skillScore,
        gainedExp,
        level: afterStats.level,
        currentExp: afterStats.exp,
        nextExp: afterStats.nextExp,
        prevExp: prevExp,
        leveledUp: expResult.levelUpCount > 0,
        levelUpCount: expResult.levelUpCount,
        hpIncrease: expResult.hpIncrease || 0,
        defIncrease: expResult.defIncrease || 0,
        slotIncreased: (expResult.slotIncrease || 0) > 0,
        slotIncreaseCount: expResult.slotIncrease || 0,
        slotFromLevel: expResult.slotIncrease || 0,
        slotFromReward: 0,
        stockIncreased: (expResult.stockIncrease || 0) > 0,
        stockIncreaseCount: expResult.stockIncrease || 0,
        stockFromLevel: expResult.stockIncrease || 0,
        stockFromReward: 0,
        isClear: !stats.failed,
        stars: starCount
      };

      // ★★★ 修正箇所: クエストモードの総合的な統計情報を更新する処理を追加 ★★★
      updateQuestStats({
        playTime: (questStats.endTime - questStats.startTime) / 1000,
        kills: questStats.solvedCount, // 防衛モードではsolvedCountをkillsとして記録
        typed: questStats.correctCount,
        miss: questStats.mistakeCount,
        kpm: questStats.gKpm,
        maxCombo: questStats.maxCombo || 0,
        maxChain: 0, // 防衛モードにはチェインがないため0
        gScore: questStats.gScore,
      });
      // ★★★ ここまで ★★★
      
      const introText = stats.failed ? "FAILED" : "MISSION COMPLETE";
      const endDialogueId = `${node.id}_end`;
      const dialogueData = DIALOGUE_DATA?.[endDialogueId];

      // ★★★ 会話処理を追加 ★★★
      // 失敗時は会話をスキップ
      if (stats.failed) {
        showEnemyEndIntro(introText, () => {
          showDefenseResult(questStats, { isQuestMode: true });
        });
        return;
      }

      const hasPlayed = hasDialogueBeenPlayed(endDialogueId);
      const shouldAskDialogueChoice = dialogueData?.showOnce && hasSeenTrueEnding();
      const shouldSkipDialogue = dialogueData?.showOnce && hasPlayed && !hasSeenTrueEnding();

      const showResultScreen = () => showEnemyEndIntro(introText, () => showDefenseResult(questStats, { isQuestMode: true }));

      if (shouldAskDialogueChoice) {
        showDialoguePlaybackChoicePopup("全クリア後の特典：この会話を再生しますか？", () => startDialogue(endDialogueId, showResultScreen), showResultScreen);
      } else if (shouldSkipDialogue) {
        showResultScreen();
      } else {
        startDialogue(endDialogueId, showResultScreen);
      }
      return; // 通常の記録処理をスキップ
    }

    // ===============================
    // 通常・フリーモードの結果処理
    // ===============================
    let rankingResult = null;
    let onlineUpdated = false;
    const shouldRecord = !lastDefenseConfig.isFreeMode && !lastDefenseConfig.isQuestMode;

    if (shouldRecord) {
      rankingResult = addRankingEntry({
        date: new Date().toISOString(),
        mode: GameModes.DEFENSE_MODE.id,
        difficulty: "Defense", // 固定
        difficultyName: "Defense",
        accuracy: stats.accuracy,
        totalCorrect: stats.correctCount,
        totalMistake: stats.mistakeCount,
        totalChars: stats.totalKeyChars, // ひらがなベースの文字数
        totalTime: (stats.endTime - stats.startTime) / 1000,
        kpm: stats.gKpm,
        eScore: stats.skillScore, // eScoreはskillScore
        gScore: stats.gScore,
        rank: stats.rank,
        solvedCount: stats.solvedCount,
        maxCombo: stats.maxCombo,
      });
    }

    // ★ プレイヤー統計の更新 (クエストモードでは更新しない)
    const playerStats = getPlayerStats();
    updatePlayerStats(playerStats, {
      totalChars: stats.correctCount,
      totalMistake: stats.mistakeCount,
      totalPlayTime: (stats.endTime - stats.startTime) / 1000,
      kpm: stats.gKpm,
      gScore: stats.gScore,
      solvedCount: stats.solvedCount,
      maxCombo: stats.maxCombo,
      failed: stats.failed,
    }, GameModes.DEFENSE_MODE.id, new Date().toISOString(), lastDefenseConfig.isFreeMode || lastDefenseConfig.isQuestMode);

    if (shouldRecord) {
      const recordId = rankingResult.record?.id;
      try {
        const submitResult = await submitScore({
          player_name: localStorage.getItem("playerName") || "NO NAME",
          score: stats.gScore,
          kpm: stats.gKpm,
          accuracy: stats.accuracy,
          solvedCount: stats.solvedCount,
          mode: GameModes.DEFENSE_MODE.id,
          id: recordId,
          ranking_version: RANKING_VERSION, // ★ランキングバージョンを追加
        });
        onlineUpdated = submitResult?.onlineUpdated ?? false;
      } catch (err) {
        console.error("Defense mode online ranking submit failed:", err);
      }
    }

    const introText = stats.failed ? "FAILED" : "MISSION COMPLETE";
    showEnemyEndIntro(introText, () => {
      showDefenseResult(stats, lastDefenseConfig, {
        ...rankingResult,
        onlineUpdated,
      });
    });
  }

  // ★★★ 修正: isAbortでも共通のクリーンアップ処理を実行する ★★★
  // enemyModeフラグを解除
  gameState.enemyMode = false;
  // gameStateをリセット
  gameState.text = "";
  gameState.pos = 0;
  gameState.typed = "";
  gameState.inputedRomaji = "";
  gameState.correctCount = 0;
  gameState.mistakeCount = 0;
  // 通常モードの描画を再開
  renderState();
  // ★★★ ゲームモードをリセット
  gameState.currentMode = null;
}

export function restartDefenseMode(isAbort = false) {
    if (lastDefenseConfig) {
        if (isAbort) {
            endDefenseMode(true);
            defenseLoopActive = false;
            cancelAnimationFrame(loopId);
            return;
        }
        // コンテナを再表示する (前回修正)
        const defenseContainer = document.getElementById("defenseModeContainer");
        if (defenseContainer) {
            defenseContainer.style.display = "block";
        }
        // ★ UIコンテナも再表示する (今回の修正)
        const uiContainer = document.getElementById("defense-ui-container");
        if (uiContainer) {
            uiContainer.style.display = "block";
        }
        startDefenseMode(lastDefenseConfig);
    }
}
