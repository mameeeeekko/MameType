// enemyCore.js

import {renderEnemies,renderPlayer,renderChainUI,renderScore,renderEndCondition,renderActiveSkillUI,
    showGameMessage,renderSystemMessage,  updateComboTierBar, initComboTierBar, renderQuestBackground, renderPhaseWarning } from "./enemyRenderer.js";
import { setupCanvasDPR } from "./canvasUtil.js";
import { buildBaseRomaji } from "./typingLogic.js";
import { initAudio, playEnemyKillSound, stopBGM, playBGM, spawnEnemyEffect, renderEnemyEffects, 
    renderHitWaveEffects, renderKnockbackEffects, spawnKnockbackEffect,spawnChainBurstEffect, 
    renderChainBurstEffects, spawnLockOnEffect, renderLockOnEffects, spawnScorePopup, renderScorePopups,
    renderDamagePopups, playHitEffect, renderHitParticles, renderShotEffects, spawnShotEffect, 
    renderItemSkillEffects, clearAllEffects, playErrorSound, playPhaseWarningSound} from "./effectManager.js";
import { spawnEnemy, spawnItemEnemy } from "./enemySpawner.js";
import { showEnemyResult } from "./enemyResult.js";
import { showQuestResult, showEnemyEndIntro } from "./questResult.js";
import { handleKey, resetCandidates, fullResetInput } from "./inputCore.js";
import { handleGlobalSoundToggle } from "./main.js";
import { gameState, setGameActive, renderState, setLastWasEnemyMode, getSoundSettings, getSoundEnabled, resetGameState, setPaused, getPaused, getNow } from "./gameCore.js";
import { GameModes } from "./gameModes.js";
import { addRankingEntry } from "./storage.js";
import { ENEMY_MODE_CONFIG, STAGES } from "./enemyModeConfig.js";
import { addExp, scoreToExp, getPlayerStatsForEnemy, updateQuestStats, 
    applySkillNodeEffect, hasReceivedStageReward, markStageRewardReceived,
    getEvolutionStage, getEquippedActiveSkills, getCooldownSpeed, addQuestActiveSkillUse, addQuestStageAttempt, getActiveSkillStockMax  } from "./questPlayerStats.js";
import { getCurrentDifficulty, getDifficulty } from "./difficulties.js";
import { getPlayerStats, updatePlayerStats } from "./playerStats.js";
import { markCleared, setStar  } from "./questProgress.js";
import { STAR_EVALUATORS } from "./starEvaluator.js";
import { submitScore } from "../online/submitScore.js";
import { RANKING_VERSION } from "../js/version.js";
import { loadKeybinds } from "./keybinds.js";
import { devOverride, applyOverride } from "../dev/devOverride.js";
import { activateSkill, ACTIVE_SKILLS } from "./questSkills.js";

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
let enemyBullets = [];
let lockedEnemy = null;
let enemyLoopActive = false;
let lastEnemyConfig = null; //もう一回ように

let spawnedCount = 0;
let lastSpawnTime = 0;     // ★最後に敵を出した時間
let lastItemSpawnTime = 0;
let enemyStartTime = null;    // タイマー用
let timerStarted = false;  // 敵が出てからタイマースタートさせるため

let endingSequence = false; //終了待機用フラグ

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

    // フェーズ移行中はチェインの減衰を停止
    if (stats.isTransitioning) {
        stats.lastChainUpdate = now;
        return;
    }

    if(!stats.chainActive) return; //タイピング開始にフラグがつくまで減らないよう

    stats.lastChainUpdate = now;
    // 減衰
    const diff = getCurrentDifficulty();
    const enemyDiff = diff.enemy;
    // スキル計算　chainDecayRateがスキル　decayRateはDef enemyDill.chainDecayは難易度別の値
    stats.chainBar -= delta * stats.decayRate * enemyDiff.chainDecay * stats.chainDecayRate;
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

// =============================================================
// 敵を殺した場合演出、スコア、チェインなど
// =============================================================
export function killEnemy(enemy, state, options = {}) {
    if (!enemy) return;

    const stats = state.enemyStats;
    if (!stats) return;

    // すでに死んでても統計未加算なら通す
    if (!enemy.isDead) {
        enemy.isDead = true;
    }

    const fromSkill = options.fromSkill ?? false;
    const isItem = enemy.isItem === true;
    const isBullet = enemy.isBullet === true;

    // =====================================================
    // ✅ 通常・スキルキル（完全同一処理）
    // =====================================================
    if (!isItem && !isBullet) {
        stats.defeatedCount = (stats.defeatedCount ?? 0) + 1;

        const isObjectiveEnemy = enemy.isObjective === true;
        if (isObjectiveEnemy) {
            stats.objectiveDefeated = (stats.objectiveDefeated ?? 0) + 1;
            stats.processedCount = (stats.processedCount ?? 0) + 1;
            stats.phaseObjectiveDefeated = (stats.phaseObjectiveDefeated ?? 0) + 1;
            stats.phaseProcessedCount = (stats.phaseProcessedCount ?? 0) + 1;
        }
    }
    // =========================
    // チェイン
    // =========================
    stats.chainCount++;
    stats.chainActive = true;
    stats.lastChainUpdate = getNow();
    
    //maxチェイン回数保存
    if (stats.chainCount > stats.maxChainCount) {
        stats.maxChainCount = stats.chainCount;
    }

    stats.chainBar += stats.gainOnKill * stats.chainRate;
    if (stats.chainBar > stats.chainBarMax) {
        stats.chainBar = stats.chainBarMax;
    }

    // =========================
    // スコア
    // =========================
    if (!isItem && !isBullet) {

        const baseScore = enemy.type.score;
        const multiplier = getChainMultiplier(stats.chainCount);
        const gainedScore = Math.floor(baseScore * multiplier);

        stats.gScore += gainedScore;

        spawnScorePopup(enemy.x, enemy.y, baseScore, multiplier);
    }

    // =========================
    // 演出（共通）
    // =========================
    //チェイン増えた時のポップ演出
    const chainText = document.getElementById("chainValue");

    chainText.style.transform = "scale(1.3)";
    chainText.style.transformOrigin = "center";

    setTimeout(() => {
        chainText.style.transform = "scale(1)";
    }, 120);

    spawnEnemyEffect(
        enemy.x,
        enemy.y,
        enemy.type.killedEffect || "enemy1"
    );
    playEnemyKillSound(enemy.type.killSound);

    // skillフラグ（今後拡張用）
    if (fromSkill) {
        stats._lastKillFromSkill = true;
    }
}


// ===============================
// ゲームループ
// ===============================
function gameLoop(timestamp) {

    if (endingSequence) {
        loopId = requestAnimationFrame(gameLoop);
        return;
    }

    if (!enemyLoopActive) return;

    const stats = gameState.enemyStats;

    // ★ポーズ中でもループは維持
    if (getPaused()) {
        // ポーズ中、経過した時間分だけ開始時間を後ろにずらすことで、タイマーを停止させる
        const deltaMs = timestamp - (gameState._lastFrameTime || timestamp);
        if (enemyStartTime != null) enemyStartTime += deltaMs;
        if (stats.startTime != null) stats.startTime += deltaMs;
        if (stats.phaseStartTime != null) stats.phaseStartTime += deltaMs;
        if (lastSpawnTime != null) lastSpawnTime += deltaMs;

        // ポーズ中も現在時刻を同期
        gameState._lastFrameTime = timestamp;
        loopId = requestAnimationFrame(gameLoop);
        return;
    }
    
    const now = timestamp; 
    const diff = getCurrentDifficulty();
    const enemyDiff = diff.enemy;

    // フェーズ管理
    const stage = gameState.stage;
    const isMultiPhase = Array.isArray(stage.phases) && stage.phases.length > 0;
    const currentPhaseIndex = stats.currentPhaseIndex || 0;
    const currentPhase = isMultiPhase ? stage.phases[currentPhaseIndex] : stage;

    const spawnInterval = currentPhase.spawn.interval * enemyDiff.spawnRate; //ms
    const deltaTime = (now - (gameState._lastFrameTime || now)) / 1000; //sec

    gameState._lastFrameTime = now;

    // フェーズ移行中はタイマー類を停止（開始時刻を現在フレームの経過分だけ後ろにずらす）
    if (stats.isTransitioning && timerStarted) {
        const deltaMs = deltaTime * 1000;
        if (enemyStartTime != null) enemyStartTime += deltaMs;
        if (stats.startTime != null) stats.startTime += deltaMs;
        if (stats.phaseStartTime != null) stats.phaseStartTime += deltaMs;
    }

    const isPureEnemyMode =
        gameState.mode === GameModes.ENEMY_MODE &&
        !gameState.currentQuestNode;

    // ===============================
    // Active Skill Charge Update
    // ===============================
    if (!isPureEnemyMode && !stats.isTransitioning) { // クエストモードかつフェーズ移行中ではない場合のみチャージ

        if (gameState.activeSkillStock == null) {
            gameState.activeSkillStock = 0;
        }

        const maxStock =
            gameState.player?.activeSkillStockMax ??
            gameState.activeSkillStockMax ??
            1;

        // 上限未満だけチャージ
        if (gameState.activeSkillStock < maxStock) {

            // ======================================
            // Active Skill Cooldown Update
            // 秒ベース
            // ======================================
            if (gameState.activeSkillCooldown > 0) {

                const combo = gameState.enemyStats.currentCombo || 0;
                // コンボ倍率
                const comboSpeed = getCooldownSpeed(combo);
                // skill補正
                const skillCooldownSpeed = gameState.enemyStats.cooldownSpeed ?? 1;    
                // 実時間差分（秒）
                gameState.activeSkillCooldown -= deltaTime * comboSpeed * skillCooldownSpeed;

                if (gameState.activeSkillCooldown < 0) {
                    gameState.activeSkillCooldown = 0;
                }
            }

            if (gameState.activeSkillCooldown <= 0) {

                gameState.activeSkillStock++;

                // clamp
                if (gameState.activeSkillStock > maxStock) {
                    gameState.activeSkillStock = maxStock;
                }

                console.log(
                    "CHARGE COMPLETE:",
                    gameState.activeSkillStock,
                    "/",
                    maxStock
                );

                // まだ満タンじゃないなら次チャージ
                if (gameState.activeSkillStock < maxStock) {

                    const equipped = getEquippedActiveSkills();
                    const skillId = equipped?.[0];
                    const skill = ACTIVE_SKILLS?.[skillId];

                    gameState.activeSkillCooldown = (skill?.cooldown || 20);

                } else {

                    gameState.activeSkillCooldown = 0;
                }
            }
        }
    }
    
    // Chain Update
    updateChainBar();
    renderChainUI(gameState);
    // Combo update
    updateComboTierBar(
        gameState.enemyStats
    );

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 背景描画（クエストノードの設定を優先し、なければステージの設定を使用）
    const bgSource = gameState.currentQuestNode || gameState.stage;
    if (bgSource) {
        renderQuestBackground(ctx, bgSource);
    }

    // ロック敵が死んでいたら解除
    if (lockedEnemy && lockedEnemy.isDead) {
        resetCandidates();
        lockedEnemy = null;
    }
    // 敵更新
    enemies.forEach(enemy => {
        if (enemy && !enemy.isDead) {

            enemy.update(
                player,
                enemyDiff,
                gameState,
                deltaTime
            );
        }
    });

    // 弾更新
    enemyBullets.forEach(bullet => {
        if (bullet && !bullet.isDead) {
            bullet.update(
                player,
                enemyDiff,
                gameState,
                deltaTime
            );
        }
    });

    // ★画面に敵が入ったらタイマー開始
    if (!timerStarted) {
        const visibleEnemy = enemies.find(e => !e.isDead && isEnemyVisible(e));

        if (visibleEnemy) {
            enemyStartTime = now;
            timerStarted = true;
            gameState.enemyStats.startTime = now;
            gameState.enemyStats.phaseStartTime = now;

            console.log("TIMER START (VISIBLE)");
        }
    }

    // 死亡した敵を削除
    const aliveEnemies =
        enemies.filter(
            enemy => enemy && !enemy.isDead
        );

    enemies.length = 0;
    enemies.push(...aliveEnemies);

    // 撃ち落とした弾を削除
    const aliveBullets =
        enemyBullets.filter(
            bullet => bullet && !bullet.isDead
        );

    enemyBullets.length = 0;
    enemyBullets.push(...aliveBullets);

    renderEnemies(ctx, enemies, lockedEnemy, candidateEnemies);
    renderEnemies(ctx, enemyBullets, lockedEnemy, []);
    renderPlayer(ctx, player, gameState.enemyStats);
    renderScore(ctx, gameState, now); // ゲーム画面スコア描画
    renderEndCondition(          // ゲーム終了条件描画
        ctx,
        gameState,
        currentPhase,
        timerStarted ? now : null,
        timerStarted ? enemyStartTime : null 
    );

    if (!isPureEnemyMode) {
        renderActiveSkillUI(ctx, gameState, canvas);
        renderSystemMessage(ctx, gameState, canvas);
    }

    renderPhaseWarning(ctx, stats, canvas);
  

    // エフェクト描画
    renderEnemyEffects(ctx);
    renderItemSkillEffects(ctx);
    renderHitWaveEffects(ctx);

    renderLockOnEffects(ctx);

    renderShotEffects(ctx);
    renderHitParticles(ctx);
    renderKnockbackEffects(ctx);
  
    renderScorePopups(ctx);
    renderDamagePopups(ctx);

        // =============================================================
        // スポーン処理
        // =============================================================
        if (!endingSequence && !stats.isTransitioning) {

        // ★一定時間ごとに敵出現
        if (now - lastSpawnTime > spawnInterval) {

            const spawnLimitOk =
                currentPhase.spawn.limit == null ||
                spawnedCount < currentPhase.spawn.limit;

            // maxAlive未設定なら無制限 DEV対応
            const maxAlive =
                devOverride.spawn?.maxAlive ??
                currentPhase.spawn.maxAlive;

            const aliveLimitOk =
                maxAlive == null ||
                enemies.length < maxAlive;

            if (spawnLimitOk && aliveLimitOk) {

                const enemy = spawnEnemy(
                    player,
                    enemies,
                    canvas,
                    currentPhase,
                    enemyDiff
                );

                if (enemy && enemy.word) {

                    enemy.originalWord = enemy.word;
                    enemy.pos = 0;
                    enemy.inputedRomaji = "";
                    enemy.typed = "";
                    enemy.baseRomaji = buildBaseRomaji(enemy.text,0);

                    if (enemy) {

                        enemies.push(enemy);

                        if (enemy.isObjective) {
                            gameState.enemyStats.objectiveSpawned++;
                        }

                        if (currentPhase.spawn?.limit != null) {
                            gameState.enemyStats.remainingSpawn--;
                        }

                        spawnedCount++;
                        lastSpawnTime = now;
                    }

                    // ======================================
                    // アイテムスポーン
                    // ======================================
                    if (currentPhase.itemSpawn || stage.itemSpawn) {
                        const itemConfig = currentPhase.itemSpawn || stage.itemSpawn;
                        const itemInterval = itemConfig.interval ?? 10000;

                        if (now - lastItemSpawnTime >= itemInterval) {

                            const itemTable = currentPhase.itemTable || stage.itemTable;
                            spawnItemEnemy({
                                enemies,
                                player,
                                canvas
                            }, itemConfig, itemTable);

                            lastItemSpawnTime = now;
                        }
                    }
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
    let forceFail = false; //強制的にリザルトへ行く合図
    let phaseComplete = false;
    let isClear = false;

    // 全体終了条件 (Global End Conditions)
    const globalEnd = stage.endConditions || {};
    const clear = stage.clearConditions || {};

    // フェーズ進行条件 (Phase Conditions)
    const phaseCond = currentPhase.phaseConditions || currentPhase.endConditions || {};
 
    // 全体失敗条件のチェック
    if (globalEnd.hpZero && player.hp <= 0) {
        gameState.enemyStats.failed = true;
        forceFail = true;
    }
    if (timerStarted && globalEnd.timerMs != null && now - enemyStartTime >= globalEnd.timerMs) {
        forceFail = true;
    }

    // 現在のフェーズが完了したかチェック
    if (phaseCond.killCount != null && stats.phaseObjectiveDefeated >= phaseCond.killCount) {
        phaseComplete = true;
    }
    if (timerStarted && phaseCond.timerMs != null && now - stats.phaseStartTime >= phaseCond.timerMs) {
        phaseComplete = true;
    }
    if (
        phaseCond.allSpawnedDefeated &&
        currentPhase.spawn.limit != null &&
        stats.phaseProcessedCount >= currentPhase.spawn.limit
    ) {
        phaseComplete = true;
    }
    if (
        phaseCond.killCount == null && !phaseCond.allSpawnedDefeated &&
        currentPhase.spawn.limit != null &&
        stats.phaseProcessedCount >= currentPhase.spawn.limit
    ) {
        phaseComplete = true;
    }

    // 最後のフェーズ完了時のクリア判定
    const isLastPhase = isMultiPhase ? (currentPhaseIndex >= stage.phases.length - 1) : true;

    // ステージクリア判定 (常にStage全体の統計で判定) ==========================
    // ■ 撃破系
    if (
        !gameState.enemyStats.failed &&
        clear.killCount != null &&
        gameState.enemyStats.objectiveDefeated >= clear.killCount
    ) {
        isClear = true;
    }

    // ■ 生存系（★追加）
    if (
        !gameState.enemyStats.failed &&
        clear.killCount == null // 条件がない＝生存系
    ) {
        // タイマー終了でクリア
        if (timerStarted && clear.timerMs != null && now - enemyStartTime <= clear.timerMs) {
            isClear = true;
        }

        // または全処理終了（フォールバック）
        if (
            clear.timerMs == null &&
            currentPhase.spawn?.limit != null &&
            spawnedCount >= currentPhase.spawn.limit &&
            enemies.length === 0
        ) {
            isClear = true;
        }
    }

    // ロジック実行
    if ((forceFail || phaseComplete) && !endingSequence && !stats.isTransitioning) {
        
        if (phaseComplete && !isLastPhase) {
            // 次のフェーズへ
            transitionToNextPhase(now);
        } else if (forceFail || (phaseComplete && isLastPhase)) {
            // ゲーム終了
        endingSequence = true;

        // すでに失敗確定してない場合のみ判定
        if (!gameState.enemyStats.failed) {
            if (!isClear) {
                gameState.enemyStats.failed = true;
            }
        }

        // エフェクト表示待ち
        setTimeout(async () => {

            const rankingResult = await endEnemyMode();

            const isFailed = gameState.enemyStats.failed;
            const introText = isFailed
                ? "FAILED"
                : "MISSION COMPLETE";

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

        }, 1000); // ← 好きな時間
        }
    }

    renderChainBurstEffects(ctx);
    loopId = requestAnimationFrame(gameLoop);
}

// ===============================
// フェーズ遷移処理
// ===============================
function transitionToNextPhase(now) {
    const stats = gameState.enemyStats;
    const stage = gameState.stage;
    const nextIndex = (stats.currentPhaseIndex || 0) + 1;
    const nextPhase = stage.phases[nextIndex];

    stats.isTransitioning = true;
    
    // 1. 既存の敵と弾をすべて消去（カウントに含めない）
    enemies.length = 0;
    enemyBullets.length = 0;
    resetCandidates();
    lockedEnemy = null;

    // 警告メッセージ
    stats.transitionMsg = nextPhase.name || `PHASE ${nextIndex + 1}`;
    
    // 次のフェーズの条件を取得
    const nextCond = nextPhase.phaseConditions || nextPhase.endConditions || {};
    if (nextCond.killCount) {
        stats.nextPhaseGoal = `MISSION: KILL ${nextCond.killCount}`;
    } else if (nextCond.timerMs) {
        stats.nextPhaseGoal = `MISSION: SURVIVE ${nextCond.timerMs / 1000}s`;
    } else {
        stats.nextPhaseGoal = "MISSION: ELIMINATE ALL";
    }

    playPhaseWarningSound();

    // BGMの切り替え判定
    const nodeBgm = gameState.currentQuestNode?.bgm;
    const nextBgm = nextPhase.bgm || nodeBgm || stage.bgm || "bgm_enemy1";
    if (nextBgm !== stats.activeBgm) {
        stats.activeBgm = nextBgm;
        if (getSoundEnabled() && getSoundSettings().bgm) {
            playBGM(nextBgm, 0.2);
        }
    }

    // 敵を一旦ノックバックさせたり、少し間を置く
    setTimeout(() => {
        stats.currentPhaseIndex = nextIndex;
        
        // フェーズ用統計リセット
        stats.phaseStartTime = performance.now();
        stats.phaseObjectiveDefeated = 0;
        stats.phaseProcessedCount = 0;
        
        // スポーン用カウントリセット
        spawnedCount = 0;
        lastSpawnTime = now;
        lastItemSpawnTime = now;
        
        // UI用表示更新
        if (nextPhase.spawn?.limit != null) {
            stats.totalSpawn = nextPhase.spawn.limit;
            stats.remainingSpawn = nextPhase.spawn.limit;
        } else {
            stats.totalSpawn = 0;
            stats.remainingSpawn = 0;
        }

        stats.isTransitioning = false;
        stats.transitionMsg = null;
        stats.nextPhaseGoal = null;
        
        console.log("PHASE TRANSITION COMPLETE:", nextIndex);
    }, 2500); // 2.5秒の猶予
}



// ===========================================
// handle
// ===========================================

export function handleEnemyKey(e) {

    // ===============================
    // 入力文字の正規化（記号・大文字対応）
    // ===============================
    let key = e.key.toLowerCase();
    if (key === "！") key = "!";
    if (key === "？") key = "?";
    if (key === "ー") key = "-";


    //実際のタイピング入力時間測定
    const now = getNow();

    // キーバインド読み込み
    const keybinds = loadKeybinds();

    // ★重要：Shiftキー単体などのシステムキー入力を無視する
    // 記号（!や?）を打つ際のShiftキーが入力バッファに入り込み、マッチングを阻害するのを防ぐ
    const isActionKey = (e.code === keybinds.autoLock || e.code === keybinds.unlock || 
                         e.code === keybinds.activeSkill);
    if (e.key.length > 1 && !isActionKey) {
        return;
    }

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
    // Active Skill 使用
    // =====================
    if (e.code === keybinds.activeSkill) {
 
        tryUseActiveSkill();
        return;
    }

    // ===============================
    // ★1文字敵の即時処理（最優先）
    // ===============================
    const allTargets = [...enemies, ...enemyBullets];
    const visibleTargets = allTargets.filter(t => t && !t.isDead && isEnemyVisible(t));

    // ロックしていない状態、または候補絞り込み中に1文字の敵（弾など）が入力と一致した場合
    // ★修正：ロック中、または既に文字を入力している（候補を絞り込んでいる）最中は、1文字即時処理をスキップ
    if (!lockedEnemy && typedBuffer === "") {
        let closestOneChar = null;
        let minDist = Infinity;

        for (const enemy of visibleTargets) {
            // ★修正：ターゲット側の文字も比較用に正規化。全ての記号を変換対象にする
            const targetRoma = (enemy.baseRomaji || "").toLowerCase()
                .replaceAll("！", "!").replaceAll("？", "?").replaceAll("ー", "-");

            if (targetRoma.length === 1 && targetRoma === key) {
                const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
                if (dist < minDist) {
                    minDist = dist;
                    closestOneChar = enemy;
                }
            }
        }

        if (closestOneChar) {
            // 1文字敵を即座に処理（撃破）
            e.preventDefault();
            const isKilled = closestOneChar.onWordComplete(player, gameState, enemies);
            if (isKilled) killEnemy(closestOneChar, gameState);
            
            // 入力バッファや候補は汚さずに終了
            return; 
        }
    }

    // =====================
    // TABターゲット切替 近くの敵をロック
    // =====================
    if (e.code === keybinds.autoLock) {
        // 入力バッファと候補をクリア（重要）
        typedBuffer = "";
        candidateEnemies = [];

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

        const aliveEnemies = [
            ...enemies,
            ...enemyBullets
        ].filter(
            e => e && !e.isDead
        );

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

        resetCandidates(); // inputCore側の候補を同期

        enemies.forEach(enemy=>{
            if(enemy !== lockedEnemy){
                resetEnemyInput(enemy);
            }
        });
        return;
    }

    // =====================
    // SPACE処理(ロック解除)
    // =====================
    if (e.code === keybinds.unlock) {
        // 候補（オレンジ色）を解除
        if (candidateEnemies.length > 0) {
            candidateEnemies.forEach(enemy => resetEnemyInput(enemy));
            candidateEnemies = [];
            typedBuffer = "";
            resetCandidates();
            return;
        }

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
    
        // ★修正：正規化したkeyを使用して判定に渡す
        // 全角記号の入力で正解判定が失敗し、ロックが固まったり次の敵が選べなくなる問題を解消
        handleKey({ key: key, code: e.code, preventDefault: () => e.preventDefault() });

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

            // タイプでチェイン増加 スキル加算＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
            stats.chainBar += stats.gainOnType * stats.chainRate;

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
            const isKilled = enemy.onWordComplete(player, gameState, enemies);

            if (isKilled) {

                console.log("DEFECT CHECK", {
                    type: enemy.type,
                    isObjective: enemy.isObjective,
                    id: enemy.id,
                });
                // ===== 完全撃破 =====
                killEnemy(lockedEnemy, gameState);

                resetCandidates();
                lockedEnemy = null;
                candidateEnemies = []; // 候補もクリア
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
    // ロック前入力処理
    // =====================
    typedBuffer += key;

    // いまの候補は保持したまま、次候補を仮計算
    let nextCandidates = [];

    if (candidateEnemies.length === 0) {
        nextCandidates = visibleTargets.filter(enemy => {
            if (!enemy || enemy.isDead || !isEnemyVisible(enemy)) return false;
            // ★修正：マッチング精度向上のため replaceAll を使用
            const targetRoma = (enemy.baseRomaji || "").toLowerCase()
                .replaceAll("！", "!").replaceAll("？", "?").replaceAll("ー", "-");
            return targetRoma.startsWith(typedBuffer);
        });
    } else {
        nextCandidates = candidateEnemies.filter(enemy => {
            const targetRoma = (enemy.baseRomaji || "").toLowerCase()
                .replaceAll("！", "!").replaceAll("？", "?").replaceAll("ー", "-");
            return targetRoma.startsWith(typedBuffer);
        });
    }

    // =====================
    // ミス時
    // 候補は維持・入力1文字だけ取り消す
    // =====================
    if (nextCandidates.length === 0) {

        // 今回押した1文字だけなかったことにする
        typedBuffer = typedBuffer.slice(0, -1);
        
        if (gameState.enemyStats) {
            const stats = gameState.enemyStats;
            stats.mistakeCount++;
              if (gameState.enemyStats) {
                    gameState.enemyStats.currentCombo = 0;
                }

            // Chain penalty
            stats.chainBar -= stats.missPenalty;

            if (stats.chainBar < 0) {
                stats.chainBar = 0;
                stats.chainCount = 0;
            }
        }

        return;
    }

    // 候補更新（成功時のみ）
    candidateEnemies = nextCandidates;

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

            handleKey({ key: ch });
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
function initPlayerByMode(isQuestMode, canvasSize) {

    const p = ENEMY_MODE_CONFIG.player;

    if (isQuestMode) {
        const stats = getPlayerStatsForEnemy(
            isQuestMode ? "quest" : "enemy"
        );

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

    player.x = canvasSize.width / 2;
    player.y = canvasSize.height / 2;
}

//敵が画面内に入ったらタイマースタートさせる用の関数
function isEnemyVisible(enemy) {
    if (!enemy) return false;

    const r = enemy.radius || 15;
    // ゲーム内座標は physical pixels (DPR調整済み) で計算されているため
    // 判定も表示サイズではなく canvas 自体の解像度を基準にするのが正しい
    const cw = canvas.width;
    const ch = canvas.height;

    return (
        enemy.x + r > 0 &&
        enemy.x - r < cw &&
        enemy.y + r > 0 &&
        enemy.y - r < ch
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

    // === Devなしはこっち =================
    // currentStage = lastEnemyConfig.stage;
    // const stage = STAGES[currentStage];
    // gameState.stage = stage;
    // ====================================

    // === Dev 用 ===================
    currentStage =
        devOverride.stage.current ||
        lastEnemyConfig.stage;

    const stage = getStageSafe(currentStage);
    gameState.stage = stage;

    function getStageSafe(id) {
        const base = STAGES[id];
        if (!base) return null;

        let stage = base;

        // global override
        if (devOverride.stage.global) {
            stage = applyOverride(stage, devOverride.stage.global);
        }

        return stage;
    }
    // ==============================

    resetGameState();
    fullResetInput();
    clearAllEffects();

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

    // コンボバー初期化
    ensureEnemySoundToggle();
    initComboTierBar();

    if (enemyLoopActive) {
        enemyLoopActive = false;
    }

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
    
    const isMultiPhase = Array.isArray(stage.phases) && stage.phases.length > 0;
    const firstPhase = isMultiPhase ? stage.phases[0] : stage;

    const playerStats = getPlayerStatsForEnemy(
        config.isQuestMode ? "quest" : "enemy"
    );

    // ===============================
    // Active Skill Stock上限設定
    // ===============================
    player.activeSkillStockMax =
        playerStats.activeSkillStockMax ?? 1;

    gameState.activeSkillStockMax =
        playerStats.activeSkillStockMax ?? 1;

    // ★ここで統計を初期化
    const diff = currentEnemyDifficulty;

    // ===============================
    // enemyStats!!!!
    // ===============================
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
        processedCount: 0,   // 倒した or 消えた 敵の合計(object)
        objectiveSpawned: 0,  
        objectiveDefeated: 0,

        // フェーズ用
        currentPhaseIndex: 0,
        phaseStartTime: getNow(),
        phaseObjectiveDefeated: 0,
        phaseProcessedCount: 0,
        isTransitioning: false,
        transitionMsg: null,
        
        gScore: 0,           // エネミーモード専用スコア
        gKpm: 0,             // KPM
        rank: "C",           // 初期ランク

        isQuestMode: config.isQuestMode ?? false,
        evo: config.isQuestMode ? getEvolutionStage() : 0, //playerの見た目

        failed: false,
        tookDamage: false,   // ダメージを受けたフラグ
        remainingSpawn: 0,
        totalSpawn: 0,

        freezeTimer: 0,     // itemのfreeze用のtimer

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
        
        // cooldown計算用
        lastCooldownUpdate: getNow(),
        //コンボによるアクティブスキルのクールダウン補正
        cooldownSpeed: playerStats.cooldownSpeed ?? 1,
        activeBgm: null,
    };
    
    // ===============================
    // アクティブスキル戦闘開始リセット
    // ===============================
    const equippedSkills = getEquippedActiveSkills();
    const activeSkillId = equippedSkills?.[0];
    const activeSkill = ACTIVE_SKILLS?.[activeSkillId];

    gameState.activeSkillStock = 0;

    // cooldown初期化

    gameState.activeSkillCooldownMax = (activeSkill?.cooldown || 20);

    gameState.activeSkillCooldown = gameState.activeSkillCooldownMax;

    const nodeBgm = gameState.currentQuestNode?.bgm;
    const initialBgm = firstPhase.bgm || nodeBgm || stage.bgm || "bgm_enemy1";
    gameState.enemyStats.activeBgm = initialBgm;

    //スキルと描画を state.player に統一
    gameState.player = player;
    
    // gameStateに渡す
    gameState.enemies = enemies;
    gameState.enemyBullets = enemyBullets;

    // ===============================
    // Dev Override適用（追加ここ）
    // ===============================
    const devChain = devOverride.chain || {};
    const devOther = devOverride.other || {};
    const baseSkill = getPlayerStatsForEnemy(
        config.isQuestMode ? "quest" : "enemy"
    );

    // chain skill系
    gameState.enemyStats.chainRate =
        devChain.chainRate ?? baseSkill.chainRate;

    gameState.enemyStats.chainDecayRate =
        devChain.chainDecayRate ?? baseSkill.chainDecayRate;

    gameState.enemyStats.chainBonus =
        devChain.chainBonus ?? baseSkill.chainBonus;

    // gain系（CHAIN_CONFIG上書き）
    gameState.enemyStats.gainOnType =
        devChain.gainOnType ?? CHAIN_CONFIG.gainOnType;

    gameState.enemyStats.gainOnKill =
        devChain.gainOnKill ?? CHAIN_CONFIG.gainOnKill;

    gameState.enemyStats.missPenalty =
        devChain.missPenalty ?? CHAIN_CONFIG.missPenalty;

    gameState.enemyStats.decayRate =
        devChain.decayRate ?? CHAIN_CONFIG.decayRate;

    // その他パラメータ
    gameState.enemyStats.knockbackBonus =
        devOther.knockbackBonus ?? baseSkill.knockbackBonus ?? 1;    
    
    //デバッグ適用済み確認    
    gameState.enemyStats._devApplied = true;    

    // =========================================    

    gameState.questStats = {
        slotIncreased: false,
        slotIncreaseCount: 0,
        stockIncreased: false,
        stockIncreaseCount: 0,
    };
    
    await initAudio();   // ← 音読み込み
    if (getSoundEnabled() && getSoundSettings().bgm) {
        playBGM(initialBgm, 0.2);
    }

    const canvas = document.getElementById("enemyModeCanvas");
    const container = document.getElementById("enemyModeContainer");
    let canvasSize = null;
    
    if (canvas && container) {
        canvas.style.display = "block";
        container.style.display = "block";

        // 安定してサイズ取得
        const ctx = canvas.getContext("2d");
        // ★DPR初期化（これだけで全部揃う）
        canvasSize = setupCanvasDPR(canvas, container, ctx);
    }

    //player初期化
    initPlayerByMode(config.isQuestMode, canvasSize);

    setGameActive(true);
    gameState.enemyMode = true;   // ←追加

    const total = firstPhase.spawn?.limit ?? 0;
    gameState.enemyStats.totalSpawn = total;
    gameState.enemyStats.remainingSpawn = total;

    resetCandidates();

    enemies.length = 0;
    enemyBullets.length = 0;
    lockedEnemy = null;
    candidateEnemies = []; // ★追加
    typedBuffer = ""; 
    lastSpawnTime = getNow();
    lastItemSpawnTime = getNow();
    gameState._lastFrameTime = performance.now();

    endingSequence = false;
    enemyLoopActive = true;

    loopId = requestAnimationFrame(gameLoop);
}

// ===============================
// 🔊 エネミーモード専用サウンドトグル
// ===============================
function ensureEnemySoundToggle() {
    const container = document.getElementById("enemyModeContainer");
    if (!container) return;

    let toggle = document.getElementById("enemySoundToggle");
    if (!toggle) {
        toggle = document.createElement("div");
        toggle.id = "enemySoundToggle";
        toggle.className = "enemy-sound-toggle sound-toggle-btn";
        toggle.onclick = (e) => {
            e.stopPropagation();
            handleGlobalSoundToggle();
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
export function onEnemyRemovedByDamage(isObjective = false) {
    const stats = gameState.enemyStats;
    
    if (!stats) return;

    if (isObjective) {
        stats.processedCount++;
        stats.phaseProcessedCount = (stats.phaseProcessedCount || 0) + 1;
    }
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

    const toggle = document.getElementById("enemySoundToggle");
    if (toggle) toggle.style.display = "none";

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

    clearAllEffects();
    // Enemyモードフラグ解除
    gameState.enemyMode = false;
    // ★ゲーム状態停止
    setGameActive(false);
    // Enemyモード状態リセット
    lockedEnemy = null;
    //enemies = [];
    enemies.length = 0;
    enemyBullets.length = 0;
    
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
        const rect = canvas.getBoundingClientRect();
        ctx.clearRect(0, 0, rect.width, rect.height);// ←必ずクリア
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
            markCleared(node.id, node.next, node.nextWorld);

            // ★ステージ報酬（slot + stock）
            if (
                (node.reward?.type === "slot" || node.reward?.type === "activeStock") &&
                !hasReceivedStageReward(node.id)
            ) {

                const beforeSlot = getPlayerStatsForEnemy().skillSlotMax;
                const beforeStock = getActiveSkillStockMax();

                applySkillNodeEffect(node.reward, "stage");

                const afterSlot = getPlayerStatsForEnemy().skillSlotMax;
                const afterStock = getActiveSkillStockMax();

                // =========================
                // 差分記録
                // =========================
                if (node.reward?.type === "slot") {
                    gameState.questStats.rewardSlotIncrease =
                        (gameState.questStats.rewardSlotIncrease || 0) + (afterSlot - beforeSlot);
                }

                if (node.reward?.type === "activeStock") {
                    gameState.questStats.rewardStockIncrease =
                        (gameState.questStats.rewardStockIncrease || 0) + (afterStock - beforeStock);
                }

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

        const totalStockIncrease =
            (expResult.stockIncrease || 0) +
            (gameState.questStats.rewardStockIncrease || 0);

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

            // level up
            leveledUp: expResult.levelUpCount > 0,
            levelUpCount: expResult.levelUpCount,
            // slot
            slotIncreased: totalSlotIncrease > 0,
            slotIncreaseCount: totalSlotIncrease,
            slotFromLevel: expResult.slotIncrease,
            slotFromReward: gameState.questStats.rewardSlotIncrease || 0,
            // active stock
            stockIncreased: totalStockIncrease > 0,
            stockIncreaseCount: totalStockIncrease,
            stockFromLevel: expResult.stockIncrease,
            stockFromReward: gameState.questStats.rewardStockIncrease || 0,
            // result
            isClear: !stats.failed,
            stars: starCount
        };

        // クエストモードの詳細ステータス記録
        updateQuestStats({
            playTime: (stats.endTime - stats.startTime)/1000,
            kills: stats.defeatedCount,
            typed: stats.correctCount,
            miss: stats.mistakeCount,
            kpm: stats.gKpm,
            maxCombo: stats.maxCombo || 0,
            maxChain: stats.maxChainCount || 0,
        });

        // ===============================
        // 挑戦回数記録
        // ===============================
        if (node?.id) {
            addQuestStageAttempt(node.id);
        }

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
        kpm: Math.round(stats.gKpm),
        accuracy: Math.round(
            (stats.correctCount /
            Math.max(1, stats.totalTyped)) * 100
        ),

        totalMistake: stats.mistakeCount,

        // エネミー専用
        defeatedCount: stats.defeatedCount,
        maxChain: stats.maxChainCount,
        maxCombo: stats.maxCombo,

        isFreeMode: gameState.isFreeMode
        
    };

    const statsData = getPlayerStats();
    
    if (!stats.isInvalidRun && stats.totalTyped > 0) {

        // ==========================================
        // 通常エネミー / デイリーのみ
        // ==========================================
        if (!lastEnemyConfig?.isQuestMode) {

            updatePlayerStats(
                statsData,
                {
                    totalChars: stats.correctCount,
                    totalMistake: stats.mistakeCount,
                    totalTypeTime: (stats.typingActiveTime)/1000,
                    totalPlayTime: (stats.endTime - stats.startTime)/1000,
                    kpm: stats.gKpm,

                    // enemy専用
                    eScore: stats.gScore,
                    defeatedCount: stats.defeatedCount,
                    maxChain: stats.maxChainCount,
                    maxCombo: stats.maxCombo
                },
                "enemy_mode",
                null,
                gameState.isFreeMode
            );
        }

        // ==========================================
        // ランキング
        // ==========================================
        if (lastEnemyConfig?.isQuestMode || lastEnemyConfig?.isFreeMode) {
            return null;
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
    endingSequence = false;
}

function resetEnemyInput(enemy){

    enemy.pos = 0;
    enemy.inputedRomaji = "";
    enemy.typed = "";

}

// ===============================
// アクティブスキル使用
// ===============================
function tryUseActiveSkill() {

    if (!gameState.currentQuestNode) {
        return;
    }

    console.log("TRY STOCK:", gameState.activeSkillStock);

    const equipped = getEquippedActiveSkills();
    if (!equipped?.length) return;

    const skillId = equipped[0];
    const skill = ACTIVE_SKILLS?.[skillId];
    if (!skill) return;

    // ======================================
    // heal系：HP満タン時は使用不可
    // ======================================
    if (skill.type === "heal") {

        const player = gameState.player;

        if (player && player.hp >= player.maxHp) {

            console.log("HP FULL");

            playErrorSound();
            showGameMessage(
                gameState,
                "HP FULL"
            );

            return;
        }
    }

    if ((gameState.activeSkillStock ?? 0) <= 0) {

        console.log("NO STOCK");

        playErrorSound();
        showGameMessage(
            gameState,
            "SKILL NOT READY"
        );
        return;
    }

    // ===============================
    // 発動
    // ===============================
    activateSkill(skillId, gameState, enemies || []);

    // ===============================
    // 使用回数記録
    // ===============================
    addQuestActiveSkillUse(skillId);

    // ===============================
    // ストック消費
    // ===============================
    gameState.activeSkillStock--;

    const maxStock =
        gameState.player?.activeSkillStockMax ??
        gameState.activeSkillStockMax ??
        1;

    // まだ満タンじゃないなら再チャージ開始
    if (gameState.activeSkillStock < maxStock) {

        gameState.activeSkillCooldownMax =
            (skill?.cooldown || 20);

        gameState.activeSkillCooldown =
            gameState.activeSkillCooldownMax;

    } else {
        gameState.activeSkillCooldown = 0;
    }

    console.log(
        "ACTIVE USED:",
        gameState.activeSkillStock,
        "/",
        maxStock
    );
}
