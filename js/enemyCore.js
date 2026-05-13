// enemyCore.js

import {
    renderEnemies,
    renderPlayer,
    renderChainUI,
    renderScore,
    renderEndCondition
} from "./enemyRenderer.js";
import { buildBaseRomaji } from "./typingLogic.js";
import { initAudio, playEnemyKillSound, stopBGM, playBGM, spawnEnemyEffect, renderEnemyEffects, renderHitWaveEffects, renderKnockbackEffects, spawnKnockbackEffect,
     spawnChainBurstEffect, renderChainBurstEffects, spawnLockOnEffect, renderLockOnEffects, spawnScorePopup, renderScorePopups, renderDamagePopups, playHitEffect, 
     renderHitParticles, renderShotEffects, spawnShotEffect } from "./effectManager.js";
import { spawnEnemy } from "./enemySpawner.js";
import { showEnemyResult } from "./enemyResult.js";
import { showQuestResult, showEnemyEndIntro } from "./questResult.js";
import { handleKey, resetCandidates, fullResetInput } from "./inputCore.js";
import { gameState, setGameActive, renderState, setLastWasEnemyMode, getSoundSettings, getSoundEnabled, resetGameState, setPaused, getPaused, getNow } from "./gameCore.js";
import { GameModes } from "./gameModes.js";
import { addRankingEntry } from "./storage.js";
import { ENEMY_MODE_CONFIG, STAGES } from "./enemyModeConfig.js";
import { addExp, scoreToExp, getPlayerStatsForEnemy, updateQuestStats, applySkillNodeEffect, hasReceivedStageReward, markStageRewardReceived  } from "./questPlayerStats.js";
import { getCurrentDifficulty, getDifficulty } from "./difficulties.js";
import { getPlayerStats, updatePlayerStats } from "./playerStats.js";
import { markCleared } from "./questProgress.js";
import { STAR_EVALUATORS } from "./starEvaluator.js";
import { setStar } from "./questProgress.js";
import { submitScore } from "../online/submitScore.js";
import { getEvolutionStage } from "./questPlayerStats.js";
import { RANKING_VERSION } from "../js/version.js";

let currentStage = "STAGE1";
let loopId = null;
let currentEnemyDifficulty = null;

const canvas = document.getElementById("enemyModeCanvas");
const ctx = canvas.getContext("2d");

const p = ENEMY_MODE_CONFIG.player;
const player = {
    level: p.level,
    maxHp: p.maxHp, 
    hp: p.maxHp,
    defense: p.defense,
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: p.radius,
};

let candidateEnemies = []; // ロック前の候補敵
let typedBuffer = "";      // ロック前に入力した文字
let enemies = [];
let lockedEnemy = null;
let enemyLoopActive = false;
let lastEnemyConfig = null; //もう一回ように

let spawnedCount = 0;
let lastSpawnTime = 0;     // ★最後に敵を出した時間
let enemyStartTime = null;    // タイマー用
let timerStarted = false;  // 敵が出てからタイマースタートさせるため

// ===============================
// 敵が来ないUI表示場所設定
// ===============================
export function getUISafeTop(){

    const chainUI = document.getElementById("chainUI");
    if(!chainUI) return 0;

    const rect = chainUI.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();

    return rect.bottom - canvasRect.top + 20; // 少し余白
}

// ===============================
// Chain System Config
// 後で能力・難易度で変更できるように定数化
// ===============================
const CHAIN_CONFIG = ENEMY_MODE_CONFIG.chain;
 
// =======================================
// Chain Bar 更新
// 時間経過による減衰
// =======================================
function updateChainBar(){

    const now = getNow();
    const stats = gameState.enemyStats;
    const delta = now - stats.lastChainUpdate;

    if(!stats.chainActive) return; //タイピング開始にフラグがつくまで減らないよう

    stats.lastChainUpdate = now;
    // 減衰
    const diff = getCurrentDifficulty();
    const enemyDiff = diff.enemy;
    // スキル計算　chainDecayRateがスキル　decayRateはDef enemyDill.chainDecayは難易度別の値
    stats.chainBar -= delta * CHAIN_CONFIG.decayRate * enemyDiff.chainDecay * stats.chainDecayRate;
    // 下限
    if(stats.chainBar <= 0){
        chainBurst();
       
    }
}

function getChainBarCenter(){

    const bar = document.getElementById("chainBar");
    const rect = bar.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();

    return {
        x: rect.left + rect.width/2 - canvasRect.left,
        y: rect.top + rect.height/2 - canvasRect.top
    };
}

function chainBurst(){

    const stats = gameState.enemyStats;
    const pos = getChainBarCenter();
  
    // 演出
     spawnChainBurstEffect(pos.x, pos.y);
   
    stats.chainCount = 0;
    // バー復活
    stats.chainBar = stats.chainBarMax;
    // 一旦停止
    stats.chainActive = false;
}

export function getChainMultiplier(chainCount) {

    const stats = gameState.enemyStats; 
    const table = ENEMY_MODE_CONFIG.chain.multipliers;
    
    // chainBonusがスキル分 つまりベース倍率×スキル倍率============
    for (const row of table) {
        if (chainCount >= row.count) {
            return row.value * stats.chainBonus;
        }
    }

    return 1.0;
}

// ===============================
// ゲームループ
// ===============================
function gameLoop() {

    if (!enemyLoopActive) return;

    // ★ポーズ中でもループは維持
    if (getPaused()) {
        loopId = requestAnimationFrame(gameLoop);
        return;
    }

    const diff = getCurrentDifficulty();
    const enemyDiff = diff.enemy;
    const stage = STAGES[currentStage];
    const spawnInterval = stage.spawn.interval * enemyDiff.spawnRate;
    const now = getNow();  // ★現在時刻取得

    // Chain Update
    updateChainBar();
    renderChainUI(gameState);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // ロック敵が死んでいたら解除
    if (lockedEnemy && lockedEnemy.isDead) {
        resetCandidates();
        lockedEnemy = null;
    }
    // 敵更新
    enemies.forEach(enemy => {
        if (enemy && !enemy.isDead) {
            enemy.update(player, enemyDiff);
        }
    });

    // ★画面に敵が入ったらタイマー開始
    if (!timerStarted) {
        const visibleEnemy = enemies.find(e => !e.isDead && isEnemyVisible(e));

        if (visibleEnemy) {
            enemyStartTime = now;
            timerStarted = true;
            gameState.enemyStats.startTime = now;

            console.log("TIMER START (VISIBLE)");
        }
    }

    // 死亡した敵を削除
    enemies = enemies.filter(enemy => enemy && !enemy.isDead);

    renderEnemies(ctx, enemies, lockedEnemy, candidateEnemies);
    renderPlayer(ctx, player, gameState.enemyStats);
    renderScore(ctx, gameState); // ゲーム画面スコア描画
    renderEndCondition(          // ゲーム終了条件描画
        ctx,
        gameState,
        stage,
        timerStarted ? now : null,
        timerStarted ? enemyStartTime : null 
    );
    // エフェクト描画
    renderEnemyEffects(ctx);
    renderHitWaveEffects(ctx);

    renderLockOnEffects(ctx);

    renderShotEffects(ctx);
    renderHitParticles(ctx);
    renderKnockbackEffects(ctx);
  
    renderScorePopups(ctx);
    renderDamagePopups(ctx);

 
    // スポーン処理
        // ★一定時間ごとに敵出現
        if (now - lastSpawnTime > spawnInterval)  {
            // ★追加：上限チェック
             if ( stage.spawn.limit == null || spawnedCount < stage.spawn.limit){

                const enemy = spawnEnemy(player, enemies, canvas, stage, enemyDiff);

                if (enemy && enemy.word) {

                    enemy.originalWord = enemy.word;
                    enemy.pos = 0;
                    enemy.inputedRomaji = "";
                    enemy.typed = "";
                    enemy.baseRomaji = buildBaseRomaji(enemy.text,0);

                    if (enemy) { // ← nullチェック必須
                        enemies.push(enemy);

                        if (stage.spawn?.limit != null) {
                            gameState.enemyStats.remainingSpawn--;
                        }

                        spawnedCount++;
                        // ★成功した時だけ時間更新
                        lastSpawnTime = now;
                    }
                }
            }
        }
//  // ログ
// console.log(
//     "spawned:", spawnedCount,
//     "limit:", ENEMY_MODE_CONFIG.spawn.limit,
//     "alive:", enemies.length
// );
    // ===============================
    // 終了条件チェック
    // ===============================
    let shouldEnd = false;
    let isClear = false;
    const end = stage.endConditions;
    const clear = stage.clearConditions || {};
 
    // HP0 → 強制終了（失敗）
    if (end.hpZero && player.hp <= 0) {
        gameState.enemyStats.failed = true;
        shouldEnd = true;
    }
    // 指定数の敵を処理（撃破）
    if (end.killCount != null && gameState.enemyStats.defeatedCount >= end.killCount) {
        shouldEnd = true;
    }
    // タイマー終了
    if (timerStarted && end.timerMs != null && now - enemyStartTime >= end.timerMs) {
        shouldEnd = true;
    }
    // 全撃破系
    if (
        end.allSpawnedDefeated &&
        stage.spawn.limit != null &&
        spawnedCount >= stage.spawn.limit &&
        enemies.length === 0
    ) {
        shouldEnd = true;
    }
     // killCount救済：全処理終了
    if (
        end.killCount != null &&
        !end.allSpawnedDefeated &&
        stage.spawn.limit != null &&
        spawnedCount >= stage.spawn.limit &&
        enemies.length === 0
    ) {
        shouldEnd = true;
    }
    // フォールバック：全処理終了
    const noExplicitEnd =
        end.killCount == null &&
        end.timerMs == null &&
        !end.allSpawnedDefeated;

    if (
        noExplicitEnd &&
        stage.spawn.limit != null &&
        spawnedCount >= stage.spawn.limit &&
        enemies.length === 0
    ) {
        shouldEnd = true;
    }

    // クリア条件 ==========================
    // ■ 撃破系
    if (
        !gameState.enemyStats.failed &&
        clear.killCount != null &&
        gameState.enemyStats.defeatedCount >= clear.killCount
    ) {
        isClear = true;
    }

    // ■ 生存系（★追加）
    if (
        !gameState.enemyStats.failed &&
        clear.killCount == null // 条件がない＝生存系
    ) {
        // タイマー終了でクリア
        if (timerStarted && end.timerMs != null && now - enemyStartTime >= end.timerMs) {
            isClear = true;
        }

        // または全処理終了（フォールバック）
        if (
            end.timerMs == null &&
            stage.spawn.limit != null &&
            spawnedCount >= stage.spawn.limit &&
            enemies.length === 0
        ) {
            isClear = true;
        }
    }

    // 終了条件満たした場合
    if (shouldEnd) {
        // すでに失敗確定してない場合のみ判定
        if (!gameState.enemyStats.failed) {
            if (!isClear) {
                gameState.enemyStats.failed = true;
            }
        }

        const rankingResult = endEnemyMode();

        // 終了
        const isFailed = gameState.enemyStats.failed;
        const introText = isFailed ? "FAILED" : "MISSION COMPLETE";

        showEnemyEndIntro(introText, () => {

            if (lastEnemyConfig?.isQuestMode) {
                showQuestResult(gameState.questStats);
            } else {
                showEnemyResult({
                    isNewRecord: rankingResult?.isNewRecord ?? false,
                    isRankIn: rankingResult?.isRankIn ?? false,
                    rankPos: rankingResult?.rankPos ?? null
                });
            }

        });

        return;
    }

    renderChainBurstEffects(ctx);
    loopId = requestAnimationFrame(gameLoop);
}

// ===========================================
// handle
// ===========================================

export function handleEnemyKey(key) {

//実際のタイピング入力時間測定
    const now = getNow();

    if (gameState.enemyStats.lastKeyTime > 0) {

        const diff = now - gameState.enemyStats.lastKeyTime;
        // 2秒以内なら入力時間として加算
        if (diff < 2000) {
            gameState.enemyStats.typingActiveTime += diff;
        }

    }
//チェイン開始
onTypingStart()

gameState.enemyStats.lastKeyTime = now;

 // =====================
 // TABターゲット切替 近くの敵をロック
 // =====================
if (key === "tab") {
    // ★今ロックしている敵がいたら入力状態を確定
    if (lockedEnemy) {

        const enemy = lockedEnemy;

        // 残り文字に更新
        enemy.text = enemy.text.slice(enemy.pos);
        // ローマ字再構築
        enemy.baseRomaji = buildBaseRomaji(enemy.text);
        // 入力状態リセット
        enemy.pos = 0;
        enemy.typed = "";
        enemy.inputedRomaji = "";
    }

    const aliveEnemies = enemies.filter(e => e && !e.isDead);

    if (aliveEnemies.length === 0) return;

    let nearest = null;
    let nearestDist = Infinity;

    aliveEnemies.forEach(enemy => {

        const dx = enemy.x - player.x;
        const dy = enemy.y - player.y;
        const dist = Math.sqrt(dx*dx + dy*dy);

        if (dist < nearestDist) {
            nearestDist = dist;
            nearest = enemy;
        }

    });

    if (!nearest) return;

    // ★新しい敵にロック
    lockedEnemy = nearest;

    gameState.text = lockedEnemy.text;
    gameState.pos = 0;
    gameState.inputedRomaji = "";
    gameState.typed = "";

    lockedEnemy.pos = 0;
    lockedEnemy.typed = "";
    lockedEnemy.inputedRomaji = "";

    enemies.forEach(enemy=>{
        if(enemy !== lockedEnemy){
            resetEnemyInput(enemy);
        }
    });

    candidateEnemies = [];
    typedBuffer = "";

    return;
}
    // =====================
    // SPACE処理
    // =====================
    if (key === " ") {
        // ロック解除
        if (lockedEnemy) {
            const enemy = lockedEnemy;
            // 残り文字を新しいtextにする
            enemy.text = enemy.text.slice(enemy.pos);
            // ローマ字再構築
            enemy.baseRomaji = buildBaseRomaji(enemy.text);
            // 入力状態リセット
            enemy.pos = 0;
            enemy.typed = "";
            enemy.inputedRomaji = "";

            lockedEnemy = null;
            resetCandidates();
            return;
        }

        // 候補解除
        if (candidateEnemies.length > 0) {
            candidateEnemies.forEach(enemy=>{
                resetEnemyInput(enemy);
            });
            candidateEnemies = [];
            typedBuffer = "";
            return;
        }
        return;
    }

    // =====================
    // ロック済み敵
    // =====================
    if (lockedEnemy) {

        gameState.text = lockedEnemy.text;
        gameState.pos = lockedEnemy.pos ?? 0;
        gameState.inputedRomaji = lockedEnemy.inputedRomaji ?? "";
        gameState.typed = lockedEnemy.typed ?? "";
        // 正解判定用に事前保存
        const beforeCorrect = gameState.correctCount;
    
        handleKey(key);

        // 正解入力ならチェイン増加
        if (gameState.correctCount > beforeCorrect) {

            const stats = gameState.enemyStats;
            
            //攻撃演出
            spawnShotEffect(
                player.x,
                player.y,
                lockedEnemy.x,
                lockedEnemy.y
            );

            // ヒット演出
            playHitEffect(lockedEnemy.x, lockedEnemy.y);

            // チェイン開始（保険）
            if (!stats.chainActive) {
                stats.chainActive = true;
                stats.lastChainUpdate = getNow();
            }

            // タイプでチェイン増加　スキル加算＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
            stats.chainBar += CHAIN_CONFIG.gainOnType * stats.chainRate;

            if (stats.chainBar > stats.chainBarMax) {
                stats.chainBar = stats.chainBarMax;
            }
        }

        // 総タイプ数
        gameState.enemyStats.totalTyped++;

        lockedEnemy.pos = gameState.pos;
        lockedEnemy.typed = gameState.typed;
        lockedEnemy.inputedRomaji = gameState.inputedRomaji;

        // 敵撃破 =========================================
        if (lockedEnemy.pos >= lockedEnemy.text.length) {
            const enemy = lockedEnemy;
            // ★ここが今回のコア
            const isKilled = enemy.onWordComplete(player);

            if (isKilled) {
             // ===== 完全撃破 =====
            if (getSoundEnabled() && getSoundSettings().soundeffect) {
                playEnemyKillSound(lockedEnemy.type.killSound);
            }

            spawnEnemyEffect(lockedEnemy.x, lockedEnemy.y);

            lockedEnemy.isDead = true;
            gameState.enemyStats.defeatedCount++;
            gameState.enemyStats.processedCount++;
            // 敵スコア追加 getChainMultiplierでスキル分増加========
            const stats = gameState.enemyStats;
            const baseScore = lockedEnemy.type.score;
            const multiplier = getChainMultiplier(stats.chainCount);
            const gainedScore = Math.floor(baseScore * multiplier);

            spawnScorePopup(
                lockedEnemy.x,
                lockedEnemy.y,
                baseScore,
                multiplier
            );

            stats.gScore += gainedScore;

            // Chain System ===================
            stats.chainCount++;
            if(stats.chainCount > stats.maxChainCount){
            stats.maxChainCount = stats.chainCount;
            }
            // 敵倒したらチェインバー増加 スキルでの加算
            stats.chainBar += CHAIN_CONFIG.gainOnKill * stats.chainRate;
            if(stats.chainBar > stats.chainBarMax){
                stats.chainBar = stats.chainBarMax;
            }
            //チェイン増えた時のポップ演出
            const chainText = document.getElementById("chainCount");
            chainText.style.transform = "scale(1.3)";
            setTimeout(()=>{
                chainText.style.transform = "scale(1)";
            },120);
           // =================================

            resetCandidates();
            lockedEnemy = null;
            candidateEnemies = [];
            typedBuffer = "";

            } else {

            // ===== まだ生きてる（ノックバック済み） =====
            spawnKnockbackEffect(enemy.x, enemy.y);

            enemy.baseRomaji = buildBaseRomaji(enemy.text);
            enemy.pos = 0;
            enemy.typed = "";
            enemy.inputedRomaji = "";
            // ロック維持したいならそのまま
            lockedEnemy = enemy;

            // ロック解除したいなら↓
            // lockedEnemy = null;

            // 候補リセット
            resetCandidates();
            }

        //=================================================
    }
       return;
}
    // =====================
    // ロック前
    // =====================

    typedBuffer += key;

    // 候補検索
    if (candidateEnemies.length === 0) {
        candidateEnemies = enemies.filter(enemy => {
            if (!enemy || enemy.isDead) return false;
            return enemy.baseRomaji.startsWith(typedBuffer);
        });
    } else {
        candidateEnemies = candidateEnemies.filter(enemy => {
            return enemy.baseRomaji.startsWith(typedBuffer);
        });
    }

    // 候補なし
    if (candidateEnemies.length === 0) {
        typedBuffer = "";
        return;
    }
    // 候補敵更新
    candidateEnemies.forEach(enemy => {
        enemy.typed = typedBuffer;
    });
    // 候補外を戻す
    enemies.forEach(enemy=>{
        if(!candidateEnemies.includes(enemy)){
            resetEnemyInput(enemy);
        }
    });
    // 候補1体 → ロック
    if (candidateEnemies.length === 1) {

        lockedEnemy = candidateEnemies[0];
        spawnLockOnEffect(lockedEnemy);
        enemies.forEach(enemy=>{
        enemy.progress = 0;
        });

        // gameState初期化
        gameState.text = lockedEnemy.text;
        gameState.pos = 0;
        gameState.inputedRomaji = "";
        gameState.typed = "";
        // 今までの入力を適用
        for (const ch of typedBuffer) {
            handleKey(ch);
        }

        lockedEnemy.pos = gameState.pos;
        lockedEnemy.typed = gameState.typed;
        lockedEnemy.inputedRomaji = gameState.inputedRomaji;
        // 他敵リセット
        enemies.forEach(enemy=>{
            if(enemy !== lockedEnemy){
                resetEnemyInput(enemy);
            }
        });

        candidateEnemies = [];
        typedBuffer = "";
    }
}

// ===============================
// Enemyモード開始
// ===============================

export function showHud(show){
  const hud = document.getElementById("playerHud");
  if (!hud) return;

  if (show) {
    hud.classList.remove("hud-hidden");
  } else {
    hud.classList.add("hud-hidden");
  }
}

// プレイヤーステータス初期化関数
function initPlayerByMode(isQuestMode){

    const p = ENEMY_MODE_CONFIG.player;

    if (isQuestMode) {
        const stats = getPlayerStatsForEnemy();

        player.maxHp = stats.maxHp;
        player.hp = stats.maxHp;
        player.defense = stats.defense;
        player.radius = stats.radius;

        // 任意：レベル依存で強化
        player.level = stats.level;

    } else {
        // 従来の固定値（エネミーモード）
        player.maxHp = p.maxHp;
        player.hp = p.maxHp;
        player.defense = p.defense;
        player.radius = p.radius;
        player.level = 1;
    }

    player.x = canvas.width / 2;
    player.y = canvas.height / 2;
}

//敵が画面内に入ったらタイマースタートさせる用の関数
function isEnemyVisible(enemy) {
    if (!enemy) return false;

    return (
        enemy.x + enemy.radius > 0 &&
        enemy.x - enemy.radius < canvas.width &&
        enemy.y + enemy.radius > 0 &&
        enemy.y - enemy.radius < canvas.height
    );
}

export async function startEnemyMode(config = {}) {

    const map = document.getElementById("questMapScreen");
    if (map) map.style.display = "none";

    setPaused(false); // ★ポーズ解除

    lastEnemyConfig = {
        stage: config.stage ?? "STAGE1",
        isFreeMode: config.isFreeMode ?? false,
        isQuestMode: config.isQuestMode ?? false,
    };

    currentStage = lastEnemyConfig.stage;
    const stage = STAGES[currentStage];
    gameState.stage = stage;

    resetGameState();
    fullResetInput();

    spawnedCount = 0;

    timerStarted = false;   // ★追加
    enemyStartTime = null;     // ★追加（安全対策）

    gameState.mode = GameModes.ENEMY_MODE;
    gameState.isFreeMode = config.isFreeMode ?? false;
    gameState.currentMode = GameModes.ENEMY_MODE;
    
    setLastWasEnemyMode(true);

    showHud(false);

    const enemyContainer = document.getElementById("enemyModeContainer");
    enemyContainer.style.display = "block";
    document.getElementById("chainUI").style.display = "block";

    if (enemyLoopActive) return;

    // エネミーモードはconfigで難易度固定、クエストはUIで難易度固定のため
    if (config.isQuestMode) {
        // ★クエストは「固定で渡された難易度」を使う
        currentEnemyDifficulty = getDifficulty(config.difficulty || "normal");
    } else if (config.isFreeMode) {
        // ★フリーはグローバル
        currentEnemyDifficulty = getCurrentDifficulty();
    } else {
        // ★通常エネミー（単体起動など）
        currentEnemyDifficulty = getDifficulty(config.difficulty || "normal");
    }
    
    const playerStats = getPlayerStatsForEnemy();
    // ★ここで統計を初期化
    const diff = currentEnemyDifficulty;

    gameState.enemyStats = {
        difficulty: diff.id,
        difficultyName: diff.name,
        typingActiveTime: 0, // ★実入力時間
        lastKeyTime: 0,      // ★前回キー時間
        totalTyped: 0,       // 総タイプ数
        correctCount: 0,     // 正確入力
        mistakeCount: 0,     // ミス数
        accuracy: 0,         // 正確性
        startTime: null,  // 開始時間
        endTime: 0,          // 終了時間
        maxCombo: 0,         // 最大コンボ
        currentCombo: 0,     // 現在のコンボ
        defeatedCount: 0,    // 倒した敵の数
        processedCount: 0,   // 倒した or 消えた 敵の合計
        gScore: 0,           // エネミーモード専用スコア
        gKpm: 0,             // KPM
        rank: "C",           // 初期ランク

        isQuestMode: config.isQuestMode ?? false,
        evo: config.isQuestMode ? getEvolutionStage() : 0, //見た目

        failed: false,
        tookDamage: false,   // ダメージを受けたフラグ
        remainingSpawn: 0,
        totalSpawn: 0,

        // Chain System
        chainCount: 0,     // 現在チェイン数
        maxChainCount: 0,
        chainBar: CHAIN_CONFIG.maxBar,     // チェイン初期値
        chainBarMax: CHAIN_CONFIG.maxBar,
        lastChainUpdate: getNow(), // 減衰計算用
        chainActive: false,
        chainRate: playerStats.chainRate, //skill
        chainDecayRate: playerStats.chainDecayRate, //skill
        chainBonus: playerStats.chainBonus, //skill
        knockbackBonus: playerStats.knockbackBonus ?? 1,
    };

    gameState.questStats = {
        slotIncreased: false,
        slotIncreaseCount: 0
    };
    
    await initAudio();   // ← 音読み込み
    if (getSoundEnabled() && getSoundSettings().bgm) {
    playBGM("bgm_enemy1",0.2);
    }

    const canvas = document.getElementById("enemyModeCanvas");
    const container = document.getElementById("enemyModeContainer");

    if (canvas && container) {
        canvas.style.display = "block";
        container.style.display = "block";

        // 安定してサイズ取得
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;

        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    //player初期化
    initPlayerByMode(config.isQuestMode);

    setGameActive(true);
    gameState.enemyMode = true;   // ←追加

    const total = stage.spawn?.limit ?? 0;
    gameState.enemyStats.totalSpawn = total;
    gameState.enemyStats.remainingSpawn = total;

    resetCandidates();

    enemies = [];
    lockedEnemy = null;
    candidateEnemies = []; // ★追加
    typedBuffer = ""; 
    lastSpawnTime = getNow(); // 
    enemyLoopActive = true;

    gameLoop();
}

// チェインモードのスタート用
function onTypingStart(){

    const stats = gameState.enemyStats;

    if(!stats.chainActive){
        stats.chainActive = true;
        stats.lastChainUpdate = getNow();
    }
}

//enemy.jsでフラグを使うため
export function markDamageTaken() {
    gameState.enemyStats.tookDamage = true;
    // ★追加：チェイン強制リセット
    chainBurst();
    
}

//enemy.jsで使うため
export function onEnemyRemovedByDamage() {
    const stats = gameState.enemyStats;
    if (!stats) return;

    stats.processedCount++;
}

export function restartEnemyMode() {
    if (!lastEnemyConfig) return;
    endEnemyMode();
    startEnemyMode(lastEnemyConfig);
}

// ===============================
// Enemyモード終了処理
// ===============================
export async function endEnemyMode() {

    gameState.enemyMode = false;

    stopBGM();
    
    const stats = gameState.enemyStats;
    const enemyContainer = document.getElementById("enemyModeContainer");
    const chainUI = document.getElementById("chainUI")

    enemyContainer.style.display = "none";
    chainUI.style.display = "none";

    // ★完全未入力は無効試合（ESCと同じ扱い）
    stats.correctCount = gameState.correctCount
    stats.mistakeCount = gameState.mistakeCount
    stats.totalTyped = gameState.correctCount + gameState.mistakeCount

    const isNoInput = stats.totalTyped === 0;

    if (isNoInput) {
        // 見た目用
        stats.failed = true;
        stats.gScore = 0;
        stats.rank = "-";
        stats.isInvalidRun = true;
    }

    //スコア等の計算
    stats.endTime = getNow();
    stats.maxCombo = gameState.maxCombo

    const elapsedSec = Math.max(0.001, stats.typingActiveTime / 1000);
    const gKpm = (stats.correctCount / elapsedSec) * 60;
    stats.gKpm = Math.round(gKpm);

    // gScoreの計算======================================
    // ベース（プレイ中に稼いだスコア）
    let finalScore = stats.gScore;
    const sc = ENEMY_MODE_CONFIG.score;
    const diff = getCurrentDifficulty();
    const enemyDiff = diff.enemy;

    // 補正①：正確性
    const accuracy =
    stats.correctCount / Math.max(1, stats.totalTyped);
    stats.accuracy = accuracy * 100;
    const accuracyBonus = sc.accuracyBase + accuracy; // base〜1+base倍
    // 補正②：最大チェイン
    const chainBonus = 1 + (stats.maxChainCount / sc.chainDivisor); // divisorの値で +1.0倍   
    // 補正③：速度（KPM）
    const speedBonus = 1 + (stats.gKpm / sc.speedDivisor); //divisorの値で +1.0倍
    // 合成
    finalScore = Math.floor(
        finalScore *
        accuracyBonus *
        chainBonus *
        speedBonus *
        enemyDiff.scoreMultiplier
    );
    //クリア、ノーミス、ノーダメのボーナス
    const isClear = !stats.failed;
    const isNoMiss = stats.mistakeCount === 0;
    const isNoDamage = !stats.tookDamage;
    // ★加算値
    const clearBonus = isClear
    ? (enemyDiff.scoreBonus?.clearBonus ?? sc.clearBonus)
    : 0;

    const noMissBonus = isNoMiss
    ? (enemyDiff.scoreBonus?.noMissBonus ?? sc.noMissBonus)
    : 0;

    const noDamageBonus = isNoDamage
    ? (enemyDiff.scoreBonus?.noDamageBonus ?? sc.noDamageBonus)
    : 0;

    // 合成
    finalScore += clearBonus + noMissBonus + noDamageBonus;

    // 結果計算表示用
    const baseScore = stats.gScore;
    stats.scoreBreakdown = {
        base: baseScore,
        accuracy: accuracyBonus,
        chain: chainBonus,
        speed: speedBonus,
        difficulty: enemyDiff.scoreMultiplier,
        clearBonus: clearBonus,
        noMissBonus: noMissBonus,
        noDamageBonus: noDamageBonus
    };
    //最終的なgScore
    stats.gScore = Math.max(0, finalScore);
    // =======================================================

    // ランク判定
    const rankTable = ENEMY_MODE_CONFIG.score.rankThresholds;
    stats.rank = rankTable.find(t => stats.gScore >= t.score)?.rank ?? "C";

    // ループ停止
    enemyLoopActive = false;
    cancelAnimationFrame(loopId);
    // Enemyモードフラグ解除
    gameState.enemyMode = false;
    // ★ゲーム状態停止
    setGameActive(false);
    // Enemyモード状態リセット
    lockedEnemy = null;
    //enemies = [];
    enemies.length = 0;
    
    //gameState リセット
    gameState.text = "";
    gameState.pos = 0;
    gameState.typed = "";
    gameState.inputedRomaji = "";
    gameState.correctCount = 0;
    gameState.mistakeCount = 0; 

    // canvas 非表示
    const canvas = document.getElementById("enemyModeCanvas");
    if (canvas) {
        canvas.style.display = "none";
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height); // ←必ずクリア
    }
    // 通常モード描画再開
    showHud(true);
    resetCandidates();
    renderState();
   
    // ===============================
    // クエストモード処理
    // ===============================
    //星評価
    let starCount = 0;
    const stage = gameState.stage;
    if (lastEnemyConfig?.isQuestMode && stage.star && !stats.isInvalidRun) {
        const evaluator = STAR_EVALUATORS[stage.star.type];

        if (evaluator) {
            starCount = evaluator(
                stats,
                {
                    player,
                    stage,
                    now: getNow(),
                    startTime: enemyStartTime
                },
                stage.star
            );
        }
    }

    if (lastEnemyConfig?.isQuestMode) {
        
        const stats = gameState.enemyStats;
        const node = gameState.currentQuestNode;
        //マップのノード解放
        if (!stats.failed && node) {
            markCleared(node.id, node.next);

            // ★ステージ報酬
            if (
                node.reward?.type === "slot" &&
                !hasReceivedStageReward(node.id)
            ) {
                const before = getPlayerStatsForEnemy().skillSlotMax;

                applySkillNodeEffect(node.reward, "stage");

                const after = getPlayerStatsForEnemy().skillSlotMax;

                gameState.questStats.rewardSlotIncrease = after - before;

                // ★ここ超重要
                markStageRewardReceived(node.id);
            }
        }
        // ⭐ ① 先に取得（これを追加）
        const playerBefore = structuredClone(getPlayerStatsForEnemy());
        // EXP計算（補正版）
        let gainedExp = 0;

        if (!stats.isInvalidRun) {

            const baseExp = scoreToExp(stats.gScore);
            // ★失敗補正
            const failMultiplier = stats.failed ? 0.5 : 1.0;

            // ★星補正
            const starMultiplierTable = {
                0: 0.5,  // 念のため（失敗時）
                1: 1.0,
                2: 1.05,
                3: 1.1,
                4: 1.2,
                5: 1.3
            };

            const starMultiplier = starMultiplierTable[starCount] ?? 1.0;

            // ★最終EXP
            gainedExp = Math.floor(baseExp * failMultiplier * starMultiplier);
        }
        
        const prevExp = playerBefore.exp;
        // EXP加算
        const expResult = addExp(gainedExp); // ★受け取る

        const afterStats = getPlayerStatsForEnemy();

        const totalSlotIncrease =
            (expResult.slotIncrease || 0) +
            (gameState.questStats.rewardSlotIncrease || 0);

        // ★星保存
        if (lastEnemyConfig?.isQuestMode && gameState.currentQuestNode) {
            setStar(gameState.currentQuestNode.id, starCount);
        }    
        
        // result用
        gameState.questStats = {
            ...stats,

            gainedExp,

            level: afterStats.level,
            currentExp: afterStats.exp,
            nextExp: afterStats.nextExp,
            prevExp: prevExp,

            // ★ここが重要
            leveledUp: expResult.levelUpCount > 0,
            levelUpCount: expResult.levelUpCount,

            slotIncreased: totalSlotIncrease > 0,
            slotIncreaseCount: totalSlotIncrease,

            slotFromLevel: expResult.slotIncrease,
            slotFromReward: gameState.questStats.rewardSlotIncrease || 0,


            isClear: !stats.failed,
            stars: starCount
        };

        updateQuestStats({
            playTime: (stats.endTime - stats.startTime)/1000,
            kills: stats.defeatedCount,
            typed: stats.correctCount,
            miss: stats.mistakeCount,
            kpm: stats.gKpm
        });

        resetGameState();
        fullResetInput();
    }
    
    resetGameState();
    fullResetInput();
    // ===============================
    // 記録保存
    // ===============================
    const record = {
        mode: "enemy_mode",
        date: new Date().toISOString(),

        // スコア系
        gScore: stats.gScore,
        gRank: stats.rank,

        // タイピング系
        gKpm: Math.round(stats.gKpm),
        accuracy: Math.round(
            (stats.correctCount /
            Math.max(1, stats.totalTyped)) * 100
        ),

        totalMistake: stats.mistakeCount,

        // エネミー専用
        defeatedCount: stats.defeatedCount,
        maxChain: stats.maxChainCount,

        isFreeMode: gameState.isFreeMode
        
    };

    const statsData = getPlayerStats();
    
    if (!stats.isInvalidRun && stats.totalTyped > 0) {

        updatePlayerStats(
            statsData,
            {
                totalChars: stats.correctCount,
                totalMistake: stats.mistakeCount,
                totalTypeTime: (stats.typingActiveTime)/1000,
                totalPlayTime: (stats.endTime - stats.startTime)/1000,
                kpm: stats.gKpm,
                eScore: stats.gScore,
                defeatedCount: stats.defeatedCount
            },
            "enemy_mode",              // ← モード名
            null,
            gameState.isFreeMode       // ← ★これが超重要
        );

        // ランキング登録（自動で履歴にも入る）
        if (lastEnemyConfig?.isQuestMode || lastEnemyConfig?.isFreeMode) {
            return null; // ← 保存しない
        }

        const rankingResult = addRankingEntry(record);

        // ===============================
        // オンライン送信
        // ===============================
        let submitResult = null;

        try {
            submitResult = await submitScore({
                player_name: localStorage.getItem("playerName") || "NO NAME",
                mode: `enemy_mode`,
                score: stats.gScore,
                solvedCount: stats.defeatedCount,
                accuracy: Number(stats.accuracy.toFixed(1)),
                kpm: stats.gKpm,
                ranking_version: RANKING_VERSION,
            });
        } catch (err) {
            console.error("Enemy online submit failed:", err);
        }

        return {
            ...rankingResult,
            submitResult
        };
    }

}

function resetEnemyInput(enemy){

    enemy.pos = 0;
    enemy.inputedRomaji = "";
    enemy.typed = "";

}
