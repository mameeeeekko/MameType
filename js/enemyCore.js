// enemyCore.js
import {renderEnemies,renderPlayer,renderChainUI,renderScore,renderEndCondition,renderActiveSkillUI, showGameMessage,renderSystemMessage, updateComboTierBar, initComboTierBar, renderQuestBackground, renderPhaseWarning, renderActiveAttackUI} from "./enemyRenderer.js";
import { fitCanvasToContainerFill } from "./canvasUtil.js";
import { buildBaseRomaji } from "./typingLogic.js";
import { initAudio, playEnemyKillSound, stopBGM, playBGM, spawnEnemyEffect, renderEnemyEffects, areAllEffectsDone, renderComboTierUpEffects, playChainBreakSound,
    renderHitWaveEffects, renderKnockbackEffects, spawnKnockbackEffect,spawnChainBreakEffect, playLoopSE, stopLoopSE,
    renderChainBreakEffects, spawnLockOnEffect, renderLockOnEffects, spawnScorePopup, renderScorePopups,
    renderDamagePopups, playHitEffect, renderHitParticles, renderShotEffects, spawnShotEffect, spawnItemSkillEffect,
    renderItemSkillEffects, clearAllEffects, playErrorSound, playPhaseWarningSound,
    renderLaserEffects, renderPlayerDamageEffects, spawnLaserEffect, spawnHitWave,
    renderPlayerNegateEffects} from "./effectManager.js";
import { spawnEnemy, spawnItemEnemy } from "./enemySpawner.js";
import { showEnemyResult } from "./enemyResult.js";
import { showQuestResult, showEnemyEndIntro } from "./questResult.js";
import { handleKey, resetCandidates, fullResetInput } from "./inputCore.js";
import { handleGlobalSoundToggle } from "./main.js";
import { gameState, setGameActive, renderState, setLastWasEnemyMode, getSoundSettings, getSoundEnabled, resetGameState, setPaused, getPaused, getNow, getERank } from "./gameCore.js";
import { GameModes, QUEST_MAP } from "./gameModes.js";
import { addRankingEntry } from "./storage.js";
import { ENEMY_MODE_CONFIG, STAGES } from "./enemyModeConfig.js";
import { addExp, scoreToExp, getPlayerStatsForEnemy, updateQuestStats,
    applySkillNodeEffect, hasReceivedStageReward, markStageRewardReceived,
    getEvolutionStage, getEquippedActiveSkills, getCooldownSpeed, addQuestActiveSkillUse, addQuestStageAttempt, getActiveSkillStockMax,
    getStarUpgradeCooldownMultiplier, addTotalStarsEarned  } from "./questPlayerStats.js";
import { getCurrentDifficulty, getDifficulty } from "./difficulties.js";
import { getPlayerStats, updatePlayerStats } from "./playerStats.js";
import { markCleared, setStar, getStar, hasDialogueBeenPlayed, hasSeenTrueEnding } from "./questProgress.js";
import { STAR_EVALUATORS } from "./starEvaluator.js";
import { submitScore } from "../online/submitScore.js"; 
import { RANKING_VERSION } from "../js/version.js";
import { loadKeybinds } from "./keybinds.js";
import { devOverride, applyOverride } from "../dev/devOverride.js";
import { activateSkill, ACTIVE_SKILLS } from "./questSkills.js";

import { closeDialogue, startDialogue, DIALOGUE_DATA, showDialoguePlaybackChoicePopup } from "./dialogue.js";
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
    _hpDrainAccumulator: 0, // HP減少の蓄積用
    lastDeathCause: null, // 復活スキル判断のためのフラグ
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
// 敵が来ないUI表示場所設定 (パフォーマンス改善)
// ===============================
let uiSafeTop = 0;

/**
 * UIと重ならないY座標の上限を計算し、キャッシュする。
 * この関数はゲーム開始時やウィンドウリサイズ時に呼び出す。
 */
function updateUISafeTop() {
    const chainUI = document.getElementById("chainUI");
    if (!chainUI || chainUI.offsetParent === null) {
        uiSafeTop = 0;
        return;
    }
    const rect = chainUI.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    uiSafeTop = rect.bottom - canvasRect.top + 20; // 少し余白
}

/**
 * キャッシュされたUIセーフエリアの上限Y座標を返す。
 * @returns {number}
 */
export function getUISafeTop() {
    return uiSafeTop;
}

/**
 * ウィンドウリサイズ時にキャンバスを再フィットし、UIセーフエリアを再計算する。
 */
function onEnemyResize() {
    const containerEl = document.getElementById("enemyModeContainer");
    if (!containerEl || containerEl.style.display === "none") return;
    const c = canvas.getContext("2d");
    // 画面いっぱいに再フィット（レターボックスなし）
    fitCanvasToContainerFill(canvas, containerEl, c);
    // リサイズ後もプレイヤーが画面中央に来るように補正
    player.x = canvas.clientWidth / 2;
    player.y = canvas.clientHeight / 2;
    updateUISafeTop();
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
    const diff = getCurrentDifficulty(
        gameState.isFreeMode ? "free-enemy" : (gameState.isQuestMode ? "quest" : "daily")
    );
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
    spawnChainBreakEffect(pos.x, pos.y);
    playChainBreakSound();
   
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

            // Free Modeかつ討伐目標がある場合、UI表示（残り数）を更新
            if (gameState.isFreeMode && gameState.stage.clearConditions?.killCount) {
                stats.remainingSpawn = Math.max(0, stats.totalSpawn - stats.objectiveDefeated);
            }
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

    // NOTE: do not early-return when `endingSequence` is true.
    // We want to continue rendering remaining effects (enemy kill effects,
    // particles, etc.) so the player can see the final animations.
    // Spawning and phase progression are already gated by `endingSequence`.

    if (!enemyLoopActive) return;

    // ★ポーズ中でもループは維持
    if (getPaused()) {
        // ポーズ中、経過した時間分だけ開始時間を後ろにずらすことで、タイマーを停止させる
        const deltaMs = timestamp - (gameState._lastFrameTime || timestamp);
        if (enemyStartTime != null) enemyStartTime += deltaMs;
        if (gameState.enemyStats.startTime != null) gameState.enemyStats.startTime += deltaMs;
        if (gameState.enemyStats.phaseStartTime != null) gameState.enemyStats.phaseStartTime += deltaMs;
        if (lastSpawnTime != null) lastSpawnTime += deltaMs;

        // ポーズ中も現在時刻を同期
        gameState._lastFrameTime = timestamp;
        loopId = requestAnimationFrame(gameLoop);
        return;
    }
    
    const now = timestamp; 
    const diff = getCurrentDifficulty(
        gameState.isFreeMode ? "free-enemy" : (gameState.isQuestMode ? "quest" : "daily")
    );

    // フェーズ管理
    const stats = gameState.enemyStats;
    const stage = gameState.stage;
    const isMultiPhase = Array.isArray(stage.phases) && stage.phases.length > 0;
    const currentPhaseIndex = stats.currentPhaseIndex || 0;
    const currentPhase = isMultiPhase ? stage.phases[currentPhaseIndex] : stage;

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
      !gameState.currentQuestNode &&
      !gameState.isFreeMode; // フリーモードのボス戦でもUIを表示するため、isFreeModeでないことを条件に追加

    // プレイヤー無敵タイマーの減算
    if (gameState.player && gameState.player.invincibleTimer > 0) {
        gameState.player.invincibleTimer = Math.max(0, gameState.player.invincibleTimer - deltaTime);
        // ★無敵音の開始
        if (!gameState.invincibleSoundPlaying) {
            playLoopSE("guard", 0.4);
            gameState.invincibleSoundPlaying = true;
        }
    } else if (gameState.invincibleSoundPlaying) {
        stopLoopSE("guard");
        gameState.invincibleSoundPlaying = false;
    }

    // 復活スキル使用済みフラグのリセット
    if (gameState._reviveUsed && player.hp > 0) {
        player.lastDeathCause = null;
    }

    // ===============================
    // Active Skill Charge Update
    // ===============================j
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
                // ★星強化によるクールダウン短縮
                const starCooldownMultiplier = gameState.enemyStats.starCooldownMultiplier ?? 1;
                // 実時間差分（秒）
                gameState.activeSkillCooldown -= deltaTime * comboSpeed * skillCooldownSpeed * starCooldownMultiplier;

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
        gameState.enemyStats,
        gameState.isQuestMode === true // ★クエストモード時のみクールタイム短縮ポップアップを有効化
    );

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 背景描画（クエストノードの設定を優先し、なければステージの設定を使用）
    if (gameState.enemyStats.activeBgImage) {
        renderQuestBackground(ctx, { bgImage: gameState.enemyStats.activeBgImage });
    }

    // ===============================
    // サボタージュモードのHP減少処理
    // ===============================
    if (gameState.player && gameState.player.hpDrainPerSec > 0) {
        // ダメージを蓄積
        gameState.player._hpDrainAccumulator += gameState.player.hpDrainPerSec * deltaTime;

        // 蓄積が1以上になったら、整数分だけHPを減らす
        if (gameState.player._hpDrainAccumulator >= 1) {
            const drain = Math.floor(gameState.player._hpDrainAccumulator);
            gameState.player.hp = Math.max(0, gameState.player.hp - drain);
            gameState.player._hpDrainAccumulator -= drain;
        }
    }

    // ロック敵が死んでいたら解除
    if (lockedEnemy && lockedEnemy.isDead) {
        resetCandidates();
        lockedEnemy = null;
    }
    // 敵更新
    enemies.forEach(enemy => {
        // ======================
        // スキルノックバック
        // ======================

        if (enemy.knockbackDelay > 0) {

            enemy.knockbackDelay--;

            if (enemy.knockbackDelay === 0) {

                spawnKnockbackEffect(
                    enemy.x,
                    enemy.y
                );
            }

            return;
        }

        if (enemy.knockbackTime !== undefined) {

            enemy.knockbackTime++;

            const t =
                enemy.knockbackTime /
                enemy.knockbackDuration;

            enemy.x =
                enemy.knockbackStartX +
                (enemy.knockbackTargetX -
                enemy.knockbackStartX) * t;

            enemy.y =
                enemy.knockbackStartY +
                (enemy.knockbackTargetY -
                enemy.knockbackStartY) * t;

            if (enemy.knockbackTime >= enemy.knockbackDuration) {

                delete enemy.knockbackTime;
                delete enemy.knockbackDelay;

                delete enemy.knockbackStartX;
                delete enemy.knockbackStartY;

                delete enemy.knockbackTargetX;
                delete enemy.knockbackTargetY;

                delete enemy.knockbackDuration;
            }

            return;
        }

        if (enemy && !enemy.isDead) {

            enemy.update(
                player,
                diff, // ★ diff を渡す
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
                diff, // ★ diff を渡す
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
            enemy => {
                if (!enemy) return false;
                if (enemy.isDead && enemy.lifeAfterDeath > 0) enemy.lifeAfterDeath--;
                return !enemy.isDead || enemy.lifeAfterDeath > 0;
            }
        );

    enemies.length = 0;
    enemies.push(...aliveEnemies);

    // 撃ち落とした弾を削除
    const aliveBullets =
        enemyBullets.filter(
            bullet => {
                if (!bullet) return false;
                if (bullet.isDead && bullet.lifeAfterDeath > 0) bullet.lifeAfterDeath--;
                return !bullet.isDead || bullet.lifeAfterDeath > 0;
            }
        );

    enemyBullets.length = 0;
    enemyBullets.push(...aliveBullets);

    // =========================
    // 毎フレーム：プレイヤー防御値を同期
    // クエスト中は `getPlayerStatsForEnemy("quest")` の最終ステータスを
    // 参照して `player.defense` を上書きする（スキルの反映漏れ防止）
    // =========================
    try {
        if (gameState.isQuestMode) {
            const statsMode = gameState.isQuestMode ? "quest" : "enemy";
            const syncStats = getPlayerStatsForEnemy(statsMode);
            player.defense = Number(syncStats.defense) || 0;
        }
    } catch (e) {
        // フォールバック不要：同期失敗してもゲーム継続
    }

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

        // Render Active Skill UI only in Quest Mode
    if (gameState.isQuestMode) {
        renderActiveSkillUI(ctx, gameState, canvas);
    }

    // Render Active Attack UI (defense typing) if any enemy has an active attack
    // This covers both Quest Boss and Free Boss if activeAttack is a boss-only feature
    if (enemies.some(en => en.activeAttack)) {
        renderActiveAttackUI(ctx, player, enemies, lockedEnemy, candidateEnemies);
    }

    // Render general system messages
    renderSystemMessage(ctx, gameState, canvas);

    renderPhaseWarning(ctx, stats, canvas);
  

    // エフェクト描画
    renderEnemyEffects(ctx);
    renderItemSkillEffects(ctx);
    renderHitWaveEffects(ctx);

    renderLockOnEffects(ctx);
    renderLaserEffects(ctx); // ★追加
    renderPlayerDamageEffects(ctx); // レーザーダメージ
    renderPlayerNegateEffects(ctx); // 敵の攻撃防いだエフェクト

    renderShotEffects(ctx);
    renderHitParticles(ctx);
    renderKnockbackEffects(ctx);
  
    renderChainBreakEffects(ctx);
    renderComboTierUpEffects(ctx);
    renderScorePopups(ctx);
    renderDamagePopups(ctx);

        // =============================================================
        // スポーン処理
        // =============================================================
        if (!endingSequence && !stats.isTransitioning) {

            // 全滅時即座に出現フラグの確認
            const immediate = currentPhase.spawn?.immediateOnClear;
            // 画面上に敵（ターゲット）が一体もいないか判定
            const isScreenEmpty = (enemies.length === 0 && enemyBullets.length === 0);

            // ★一定時間ごとに敵出現、または「即座に出現」がONで敵がいない場合
            if ((now - lastSpawnTime > (currentPhase.spawn.interval * diff.enemy.spawnRate)) || (immediate && isScreenEmpty)) {

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
                        diff
                    );

                    if (enemy && enemy.word) {

                        enemy.originalWord = enemy.word;
                        enemy.pos = 0;
                        enemy.inputedRomaji = "";
                        enemy.typed = "";
                        enemy.baseRomaji = buildBaseRomaji(enemy.text,0);

                        if (enemy) {

                            // フリーモード時はすべての敵をノルマ対象(isObjective)として扱う
                            if (gameState.isFreeMode) {
                                enemy.isObjective = true;
                            }

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
    if (globalEnd.hpZero && player.hp <= 0){

        const deathCause = player.lastDeathCause;

        // ★ボス接触は復活不可
        const canRevive = deathCause !== "boss_contact";

        try {
            const statsMode = gameState.isQuestMode ? "quest" : "enemy";
            const stats = getPlayerStatsForEnemy(statsMode);
            const reviveChance = Number(stats.reviveChance) || 0;

            if (canRevive && reviveChance > 0 && !gameState._reviveUsed && Math.random() < reviveChance) {

                // ★復活成功 3割のHP
                player.hp = Math.max(1, Math.floor((player.maxHp || 1) * 0.3));
                gameState._reviveUsed = true;

                player.lastDeathCause = null;

                // ★超重要：失敗状態を完全リセット
                gameState.enemyStats.failed = false;
                forceFail = false;
                endingSequence = false;

                // ★追加（これが重要）
                gameState.enemyStats.mistakeCount = 0;
                gameState.enemyStats.lastKeyTime = getNow();

                // ★追加：HP0判定再発防止用フラグ
                gameState._reviving = true;

                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        gameState._reviving = false;
                    });
                });

                // 復活時に入力状態リセット
                fullResetInput();
                resetCandidates();
                typedBuffer = "";
                lockedEnemy = null;

                // 復活したのでフレームループを継続する（早期 return の前に予約）
                loopId = requestAnimationFrame(gameLoop);

                spawnItemSkillEffect({
                    category: "revive",
                    source: "skill",
                    x: player.x,
                    y: player.y
                });

                return;
            }

            // ★復活失敗 → 死亡確定
            // endlessモードでない場合のみ、ここで失敗を確定させる
            const isEndless = gameState.stage?.clearConditions?.endless === true;
            if (!isEndless) {
                gameState.enemyStats.failed = true;
            }
            // endlessモードであっても、ゲーム終了シーケンスを開始するためにforceFailはtrueにする
            forceFail = true;

        } catch (e) {
            gameState.enemyStats.failed = true;
            forceFail = true;
        }
    }

    // ★ 精密射撃（ミス即終了）または他所での失敗確定の判定
    const missLimit = globalEnd.failOnMissCount;
    const failOnMissCondition = (missLimit !== undefined && stats.mistakeCount >= missLimit) || (globalEnd.failOnMiss && stats.mistakeCount > 0);

    if (!gameState._reviving && (failOnMissCondition || stats.failed)) {
        gameState.enemyStats.failed = true;
        forceFail = true;
    }

    // タイマーによる強制失敗は、クリア条件が生存タイマーの場合、そのタイマーがまだ満たされていない場合にのみ適用
    if (timerStarted && globalEnd.timerMs != null && now - enemyStartTime >= globalEnd.timerMs) {
        // 生存系クリア条件がある場合
        if (clear.killCount == null && clear.timerMs != null) {
            // クリア条件のタイマーがまだ満たされていない場合のみ失敗
            if (now - enemyStartTime < clear.timerMs) {
                forceFail = true;
            }
            // else: clear.timerMs が満たされているなら、クリアになるはずなので forceFail はしない
        } else {
            // 生存系クリア条件がない場合は、globalEnd.timerMs で失敗
            forceFail = true;
        }
    }

    // 現在のフェーズが完了したかチェック
    if (phaseCond.killCount != null && stats.phaseProcessedCount >= phaseCond.killCount) {
        phaseComplete = true;
    }
    if (timerStarted && phaseCond.timerMs != null && now - stats.phaseStartTime >= phaseCond.timerMs) {
        phaseComplete = true;
    }
    if (
        phaseCond.allSpawnedDefeated &&
        currentPhase.spawn.limit != null &&
        stats.phaseProcessedCount >= currentPhase.spawn.limit &&
        enemies.filter(e => e.isObjective).length === 0 // ★目標敵が0体になったら
    ) {
        phaseComplete = true;
    }
    if (
        // ★殲滅系で、目標撃破数が指定されていない場合
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

    // ■ 生存系（エンドレス以外）
    if (!gameState.enemyStats.failed && clear.killCount == null && !clear.endless) {
        // タイマー終了でクリア
        if (timerStarted && clear.timerMs != null && now - enemyStartTime >= clear.timerMs) {
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

            const isEndless = clear?.endless === true;

            // endlessモードの場合、HP0が原因で失敗フラグが立っていても、ここでリセットして再評価する
            if (isEndless && forceFail) {
                gameState.enemyStats.failed = false;
            }

            // クリア条件の評価
            if (clear.killCount != null && stats.objectiveDefeated >= clear.killCount) isClear = true;
            if (clear.survive && !gameState.enemyStats.failed) isClear = true;
            if (!isClear && clear.killCount == null && phaseComplete && isLastPhase) isClear = true;

            // 最終的な失敗判定 (endlessモードは失敗にならない)
            if (!isClear && !isEndless) {
                gameState.enemyStats.failed = true;
            }

            // エフェクト完了を待ってから結果表示
            const checkEffectsDone = async () => {
                if (areAllEffectsDone()) {
                    const rankingResult = await endEnemyMode();

                    const isFailed = gameState.enemyStats.failed;
                    let introText = isFailed
                        ? "FAILED"
                        : "MISSION COMPLETE";

                    // エンドレス用の演出テキスト
                    if (isEndless) introText = "FINISH";

                    // ★ rankingResultがnullでないことを確認してから、オンライン更新フラグを取得
                    const onlineUpdated = rankingResult?.submitResult?.onlineUpdated ?? false;

                    // クエストモードの場合の分岐
                    if (lastEnemyConfig?.isQuestMode) {
                        const node = gameState.currentQuestNode;
                        const endDialogueId = `${node.id}_end`;
                        const dialogueData = DIALOGUE_DATA?.[endDialogueId];

                    // ★★★ 修正箇所 ★★★
                    // DIALOGUE_DATAに会話が存在しなくてもstartDialogueを呼び出すように変更。
                    // これにより、ランダム会話のフォールバック処理が正しく機能するようになります。
                    if (!isFailed) {
                        const hasPlayed = hasDialogueBeenPlayed(endDialogueId);
                        const shouldAskDialogueChoice = dialogueData?.showOnce && hasSeenTrueEnding();
                        const shouldSkipDialogue = dialogueData?.showOnce && hasPlayed && !hasSeenTrueEnding();

                        if (shouldAskDialogueChoice) {
                            showDialoguePlaybackChoicePopup(
                                "全クリア後の特典：戦闘後のこの会話を再生しますか？",
                                () => {
                                    startDialogue(endDialogueId, () => {
                                        showEnemyEndIntro(introText, () => showQuestResult(gameState.questStats));
                                    });
                                },
                                () => showEnemyEndIntro(introText, () => showQuestResult(gameState.questStats))
                            );
                        } else if (shouldSkipDialogue) {
                            // 会話をスキップしてリザルトへ
                            showEnemyEndIntro(introText, () => showQuestResult(gameState.questStats));
                        } else {
                            // 会話（固定またはランダム）を開始し、終了後にリザルト表示
                            startDialogue(endDialogueId, () => {
                                showEnemyEndIntro(introText, () => showQuestResult(gameState.questStats));
                            });
                        }
                    } else {
                        // クエスト失敗時は会話なしでリザルトへ
                        showEnemyEndIntro(introText, () => showQuestResult(gameState.questStats));
                        }
                    } else {
                        // クエストモード以外の場合（デイリー・フリーモード）
                        showEnemyEndIntro(introText, () => {
                            showEnemyResult({
                                isNewRecord: rankingResult?.isNewRecord ?? false,
                                isRankIn: rankingResult?.isRankIn ?? false,
                                rankPos: rankingResult?.rankPos ?? null,
                                onlineUpdated: onlineUpdated // ★ フラグを渡す
                            });
                        });
                    }
                } else {
                    // まだエフェクトが残っていれば、次のフレームで再チェック
                    requestAnimationFrame(checkEffectsDone);
                }
            };

            // 最初のチェックを開始
            checkEffectsDone();
        }
    }

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
    let resolvedBgm = "bgm_swim";
    let resolvedBgImage = gameState.enemyStats.activeBgImage || "battle_blue";

    if (gameState.isQuestMode && gameState.currentQuestNode) {
        const node = gameState.currentQuestNode;
        const worldId = Object.keys(QUEST_MAP).find(w => QUEST_MAP[w].nodes.some(n => n.id === node.id));
        const world = QUEST_MAP[worldId];
        if (world && world.defaults) {
            const stageType = node.stage.includes("BOSS") ? "boss" : node.stage.includes("MID_") ? "mid_boss" : "normal";
            resolvedBgm = world.defaults.bgm?.[stageType] || "bgm_swim";
            resolvedBgImage = world.defaults.bgImage?.[stageType] || "battle_blue";
        }
    }
    // フェーズ固有BGM > ノード固有BGM > ワールドデフォルト > フォールバック
    resolvedBgm = nextPhase.bgm || gameState.currentQuestNode?.bgm || resolvedBgm;
    resolvedBgImage = nextPhase.bgImage || gameState.currentQuestNode?.bgImage || resolvedBgImage;

    // ★ 背景画像も更新
    stats.activeBgImage = resolvedBgImage;

    if (resolvedBgm !== stats.activeBgm) {
        stats.activeBgm = resolvedBgm;
        if (getSoundEnabled() && getSoundSettings().bgm) {
            gameState.startTime = getNow(); // BGM表示タイマーをリセット
            playBGM(resolvedBgm, 1.0);
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

    let key = e.key; // inputCore.jsのhandleKeyで正規化されるため、ここではe.keyをそのまま渡す


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
        // アクティブスキルが禁止されている場合は使用不可
        if (gameState.player.disableActiveSkill) {
            playErrorSound();
            showGameMessage(gameState, "SKILL DISABLED");
            return;
        }
 
        tryUseActiveSkill();
        return;
    }

    // ===============================
    // ★1文字敵の即時処理（最優先）
    // ===============================
    const allTargets = [...enemies, ...enemyBullets];
    // 敵の特殊攻撃（activeAttack）をターゲットに含める
    enemies.forEach(en => {
        if (en.activeAttack) {
            en.activeAttack.isAttack = true;
            en.activeAttack.ref = en;
            allTargets.push(en.activeAttack);
        }
    });

    const visibleTargets = allTargets.filter(t => {
        const checkObj = t.isAttack ? t.ref : t;
        return checkObj && !checkObj.isDead && isEnemyVisible(checkObj);
    });

    // ロックしていない状態、または候補絞り込み中に1文字の敵（弾など）が入力と一致した場合
    // ★修正：ロック中、または既に文字を入力している（候補を絞り込んでいる）最中は、1文字即時処理をスキップ
    if (!lockedEnemy && typedBuffer === "") {
        let closestOneChar = null;
        let minDist = Infinity;

        for (const enemy of visibleTargets) {
            // ★修正：ターゲット側の文字も比較用に正規化。全ての記号を変換対象にする
            const targetRoma = (enemy.baseRomaji || "").toLowerCase()
                .replaceAll("！", "!").replaceAll("？", "?").replaceAll("ー", "-").replaceAll("「", "[").replaceAll("」", "]").replaceAll("　", " ");

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
            ...enemyBullets,
            ...enemies.filter(e => e.activeAttack).map(e => e.activeAttack)
        ].filter(
            e => e && (e.isAttack || !e.isDead)
        );

        if (aliveEnemies.length === 0) return;

        let nearest = null;
        let nearestDist = Infinity;

        aliveEnemies.forEach(enemy => {

            // ★防御ワードはプレイヤー位置を基準にすることで、最優先でロックオン
            const targetPos = enemy.isAttack ? player : enemy;
            const dx = targetPos.x - player.x; // 防御ワードの場合、dx, dyは0になる
            const dy = targetPos.y - player.y;
            const dist = Math.hypot(dx, dy);

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

        // ★新しいロックオン対象以外のすべての敵と弾の入力をリセットする
        [...enemies, ...enemyBullets].forEach(e => {
            if (e !== lockedEnemy) {
                resetEnemyInput(e);
            }
        });
        return;
    }

    // =====================
    // ロック解除処理 (デフォルト: Delete)
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
    // ★ロックオン対象が無効になっていないかチェック（防御ワードが中断された場合など）
    if (lockedEnemy) {
        const isAttackInvalid = lockedEnemy.isAttack && (!lockedEnemy.ref || !lockedEnemy.ref.activeAttack);
        const isTargetDead = lockedEnemy.isDead;

        if (isAttackInvalid || isTargetDead) {
            lockedEnemy = null;
            candidateEnemies = [];
            typedBuffer = "";
            resetCandidates();
            // このフレームでの以降のキー入力をキャンセル
            return;
        }
    }

    if (lockedEnemy) {

        gameState.text = lockedEnemy.text;
        gameState.pos = lockedEnemy.pos ?? 0;
        gameState.inputedRomaji = lockedEnemy.inputedRomaji ?? "";
        gameState.typed = lockedEnemy.typed ?? "";
        // 正解判定用に事前保存
        // const beforeCorrect = gameState.correctCount; // inputCore.jsで直接更新しないように変更したため不要
    
        // ★修正：正規化したkeyを使用して判定に渡す
        // 全角記号の入力で正解判定が失敗し、ロックが固まったり次の敵が選べなくなる問題を解消
        const inputResult = handleKey(e, false, gameState, { type: 'romaji' }); // Pass 'romaji' to add romaji char count to combo

        if (!inputResult || inputResult.isMiss) {
            // ミス処理
            const stats = gameState.enemyStats;
            if (lockedEnemy.isAttack) {
                stats.mistakeCount++; // 防御ワードのミス
            } else {
                stats.mistakeCount++; // 通常敵のミス
                gameState.mistakeCount++; // グローバルミスカウント
            }
            // ★ミス即終了の設定がある場合、即座に失敗フラグを立てる
            if (gameState.stage?.endConditions?.failOnMiss) {
                stats.failed = true;
            }
            return;
        }

        // 正解入力ならチェイン増加
        if (inputResult.isComplete) { // Only trigger chain increase on kana completion

            const stats = gameState.enemyStats;

            // ★ 防御ワードの場合はプレイヤー座標をターゲットにする
            const targetX = lockedEnemy.isAttack ? player.x : lockedEnemy.x;
            const targetY = lockedEnemy.isAttack ? player.y : lockedEnemy.y;

            //攻撃演出
            spawnShotEffect(
                player.x,
                player.y,
                targetX,
                targetY
            );

            // ヒット演出
            playHitEffect(lockedEnemy.x, lockedEnemy.y);

            // チェイン開始（保険）
            if (!stats.chainActive) {
                stats.chainActive = true;
                stats.lastChainUpdate = getNow();
            }

            // タイプでチェイン増加 スキル加算＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
            // デバッグ出力：増加量が0の場合に原因追跡しやすくする
            try {
                const gainOnType = stats.gainOnType ?? 0;
                const chainRate = stats.chainRate ?? 1;
                const inc = gainOnType * chainRate;
                if (inc === 0) {
                    console.log("[DEBUG] Chain type add zero:", { gainOnType, chainRate, chainBar: stats.chainBar });
                }
                stats.chainBar += inc;
            } catch (e) {
                console.error("[DEBUG] Error computing chain gain on type", e);
            }

            if (stats.chainBar > stats.chainBarMax) {
                stats.chainBar = stats.chainBarMax;
            }
        }

        lockedEnemy.pos = gameState.pos;
        lockedEnemy.typed = gameState.typed;
        lockedEnemy.inputedRomaji = gameState.inputedRomaji;

        // 敵撃破 =========================================
        if (lockedEnemy.pos >= lockedEnemy.text.length) {
            if (lockedEnemy.isAttack) {
                // 防御成功時：全ての攻撃ワードを削除し、完全アンロック状態にする
                // 1) エフェクト表示（最後の攻撃のみ派手に表示）
                if (lockedEnemy.ref) {
                    spawnLaserEffect(lockedEnemy.ref.x, lockedEnemy.ref.y, player.x, player.y, {
                        diffused: true,
                        attenuated: true,
                        completionRatio: 1
                    });
                    spawnHitWave(player.x, player.y);
                }

                // 2) 全敵の activeAttack をクリア
                enemies.forEach(en => {
                    if (en && en.activeAttack) en.activeAttack = null;
                });

                // 3) 敵・弾の入力状態を完全リセット
                [...enemies, ...enemyBullets].forEach(e => resetEnemyInput(e));

                // 4) ロック関連の状態をクリア
                lockedEnemy = null;
                candidateEnemies = [];
                typedBuffer = "";
                resetCandidates();

                return;
            }

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
            //lockedEnemy = enemy;

            // ロック解除したいなら↓
            lockedEnemy = null;

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
            // ★防御ワードは isDead や isEnemyVisible のチェックをスキップ
            if (enemy.isAttack) {
                // activeAttack オブジェクト自体は isDead を持たないので、その参照元(ref)の敵が死んでいないかチェック
                if (!enemy.ref || enemy.ref.isDead) return false;
            } else if (!enemy || enemy.isDead || !isEnemyVisible(enemy)) {
                return false;
            }
            // ★修正：マッチング精度向上のため replaceAll を使用
            const targetRoma = (enemy.baseRomaji || "").toLowerCase()
                .replaceAll("！", "!").replaceAll("？", "?").replaceAll("ー", "-").replaceAll("「", "[").replaceAll("」", "]").replaceAll("　", " ");
            return targetRoma.startsWith(typedBuffer);
        });
    } else {
        nextCandidates = candidateEnemies.filter(enemy => {
            // ★防御ワードは isDead や isEnemyVisible のチェックをスキップ
            if (enemy.isAttack) {
                if (!enemy.ref || enemy.ref.isDead) return false;
            } else if (!enemy || enemy.isDead || !isEnemyVisible(enemy)) {
                // このパスは既に絞り込まれた候補なので、isDeadチェックは重要
                return false;
            }
            const targetRoma = (enemy.baseRomaji || "").toLowerCase()
                .replaceAll("！", "!").replaceAll("？", "?").replaceAll("ー", "-").replaceAll("「", "[").replaceAll("」", "]").replaceAll("　", " ");
            return targetRoma.startsWith(typedBuffer);
        });
    }

    // =====================
    // ミス時
    // 候補は維持・入力1文字だけ取り消す
    // =====================
    if (nextCandidates.length === 0 && typedBuffer.length > 0) { // typedBufferに何か入力されていて、かつ候補がなくなった場合のみミスと判定

        // 今回押した1文字だけなかったことにする
        typedBuffer = typedBuffer.slice(0, -1);
        
        if (gameState.enemyStats) {
            const stats = gameState.enemyStats;
            
            // ロック前のミスはグローバルミスカウントと敵モードミスカウント両方に影響
            gameState.mistakeCount++; // グローバルミスカウント
            stats.mistakeCount++; // 敵モードミスカウント
            
            stats.currentCombo = 0;

            // Chain penalty
            stats.chainBar -= stats.missPenalty;

            if (stats.chainBar < 0) {
                stats.chainBar = 0;
                stats.chainCount = 0;
            }
            // ★ミス即終了の設定がある場合、即座に失敗フラグを立てる
            if (gameState.stage?.endConditions?.failOnMiss) {
                stats.failed = true;
            }
        }

        return;
    }

    // 候補更新（成功時のみ）
    candidateEnemies = nextCandidates;

    // =============================================================
    // ★修正：単語完成時の即時撃破処理（候補更新後に移動）
    // =============================================================
    // 現在の候補の中から、入力バッファと完全に一致するものを探す
    const completedEnemy = candidateEnemies.find(enemy => {
        if (!enemy || enemy.isDead) return false;
        const targetRoma = (enemy.baseRomaji || "").toLowerCase()
            .replaceAll("！", "!").replaceAll("？", "?").replaceAll("ー", "-").replaceAll("「", "[").replaceAll("」", "]").replaceAll("　", " ");
        return targetRoma === typedBuffer;
    });

    // 短い単語が完成した場合（例: 'neko'）、長い単語（'nekonoshippo'）も候補に残っていても、ここで短い方を優先して処理する
    if (completedEnemy) {
        // 敵を即座に撃破
        const isKilled = completedEnemy.onWordComplete(player, gameState, enemies);
        if (isKilled) {
            killEnemy(completedEnemy, gameState);
        }

        candidateEnemies.forEach(enemy => {
            if (enemy && enemy !== completedEnemy) {
                resetEnemyInput(enemy);
            }
        });

        // 状態をリセットして次の入力に備える
        if (isKilled) {
            // 完全に撃破した場合：全リセット
            typedBuffer = "";
            candidateEnemies = [];
            resetCandidates();
        } else {
            // 複数ヒットでまだ生存している場合：
            candidateEnemies = []; // 他の候補はクリア
            completedEnemy.typed = ""; // ★重要：複数ヒット敵自身の入力バッファもクリア
            typedBuffer = "";      // グローバル入力バッファもクリア
        }

        return; // このキー入力での処理はここで完了（重要）
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
        gameState.pos = 0; // lockedEnemyのposは0から開始
        gameState.inputedRomaji = "";
        gameState.typed = "";

        // typedBufferの内容をlockedEnemyとgameStateに適用
        // handleKeyをsilentモードで呼び出す代わりに、直接状態を更新する
        for (const ch of typedBuffer) {
            const tempState = { ...gameState, text: lockedEnemy.text };
            const result = handleKey({ key: ch }, true, tempState);
            if (result.success) {
                Object.assign(gameState, tempState);
            }
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
function initPlayerByMode(isQuestMode, canvasSize, stage, stats) {

    const baseP = ENEMY_MODE_CONFIG.player;

    // クエストモードまたはフリーモードの場合：statsオブジェクトの数値をそのまま反映
    if (isQuestMode || gameState.isFreeMode) {
        player.maxHp = stats.maxHp;
        player.hp = stats.maxHp;
        player.defense = stats.defense;
        player.radius = stats.radius;

        // サボタージュのHP減少設定を反映 (stage.player が存在する場合のみ)
        player.hpDrainPerSec = stage?.player?.hpDrainPerSec ?? 0;
        player._hpDrainAccumulator = 0;
        // 純粋なる試練のアクティブスキル禁止設定を反映 (stage.player が存在する場合のみ)
        player.disableActiveSkill = stage?.player?.disableActiveSkill ?? false;
        player.level = stats.level;

    } else {
        // デイリーモード：常に初期固定値（Lv.1相当）を使用
        player.maxHp = baseP.maxHp;
        player.hp = baseP.maxHp;
        player.defense = baseP.defense;
        player.radius = baseP.radius;
        player.hpDrainPerSec = 0; // 通常モードでは減少なし
        player._hpDrainAccumulator = 0;
        player.disableActiveSkill = false; // 通常モードではスキル禁止なし
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

    // ★ ゲーム開始時に会話モーダルを強制的に閉じる
    closeDialogue();

    const map = document.getElementById("questMapScreen");
    if (map) map.style.display = "none";

    setPaused(false); // ★ポーズ解除

    lastEnemyConfig = {
        stage: config.stage ?? "STAGE1",
        isFreeMode: config.isFreeMode ?? false,
        isQuestMode: config.isQuestMode ?? false,
        customConditions: config.customConditions ?? null,
    };

    // === Dev 用 ===================
    // フリーモード時はDevのステージ固定を無視して、選択されたステージ(DAILY)を優先する
    currentStage = (lastEnemyConfig.isFreeMode) 
        ? lastEnemyConfig.stage 
        : (devOverride.stage.current || lastEnemyConfig.stage);

    let baseStage = getStageSafe(currentStage);
    let stage = { ...baseStage };
    
    // カスタム条件（フリーモードの設定など）の適用
    const custom = config.customConditions || {};

    if (config.isFreeMode) {
        // Boss-onlyモードが要求されている場合は、ベースステージの最終フェーズ（ボスフェーズ）または
        // 選択されたフェーズだけを取り出して単一フェーズのステージとして扱う。
        if (config.bossOnly && baseStage && Array.isArray(baseStage.phases) && baseStage.phases.length > 0) {
            const bossPhaseIndex = (config.bossPhaseIndex !== undefined && config.bossPhaseIndex !== null)
                ? config.bossPhaseIndex
                : (baseStage.phases.length - 1);

            const bossPhase = baseStage.phases[Math.max(0, Math.min(baseStage.phases.length - 1, bossPhaseIndex))] || baseStage.phases[baseStage.phases.length - 1];

            // ベースのステージ情報を踏襲しつつ、ボスフェーズの設定を優先して単一フェーズ化する
            stage = { ...baseStage, ...bossPhase };
            // 不要なフェーズ配列やフェーズ条件は削除
            delete stage.phases;
            delete stage.phaseConditions;

            // スポーンはボスフェーズのものを使う（fallbackでbaseStage.spawn）
            stage.spawn = { ...(baseStage.spawn || {}), ...(bossPhase.spawn || {}), ...(custom.spawn || {}) };
            stage.enemyTable = bossPhase.enemyTable || stage.enemyTable || baseStage.enemyTable;

            // ボス戦では「ボスを倒す」ことのみをクリア条件にする
            const bossKill = bossPhase.phaseConditions?.killCount ?? bossPhase.phaseConditions?.killcount ?? 1;
            stage.endConditions = { hpZero: true };
            stage.clearConditions = { killCount: bossKill };

            // ボスは1体出現する想定なので出現上限を1にする（未設定なら1を割り当て）
            if (!stage.spawn) stage.spawn = {};
            stage.spawn.limit = stage.spawn.limit ?? 1;
            stage.spawn.maxAlive = stage.spawn.maxAlive ?? 1;

            console.log("FREE MODE BOSS-ONLY: Applied boss phase", { stageId: currentStage, bossPhaseIndex });
        } else {
            const firstPhase = (baseStage.phases && baseStage.phases[0]) ? baseStage.phases[0] : {};

            // 1. DAILYの設定を継承しつつ、フェーズ構造をフラット化
            stage = { ...baseStage, ...firstPhase };

            // 2. ルール設定に関わるプロパティを一旦すべて物理的に削除する
            // これにより「TimeAttack」設定などが残存するのを完全に防ぐ
            delete stage.phases;
            delete stage.phaseConditions;
            delete stage.endConditions;
            delete stage.clearConditions;

            // 3. ゼロから終了条件を構築する（マージではなく完全新規作成）
            stage.endConditions = {
                hpZero: true,
                timerMs: custom.endConditions?.timerMs !== undefined ? custom.endConditions.timerMs : null,
                killCount: custom.endConditions?.killCount !== undefined ? custom.endConditions.killCount : null,
                failOnMiss: custom.endConditions?.failOnMiss === true
            };

            stage.clearConditions = {
                timerMs: custom.clearConditions?.timerMs !== undefined ? custom.clearConditions.timerMs : null,
                killCount: custom.clearConditions?.killCount !== undefined ? custom.clearConditions.clearCount : custom.clearConditions?.killCount ?? null,
                endless: !!custom.clearConditions?.endless
            };

            // 4. スポーン設定のマージ
            stage.spawn = {
                ...(baseStage.spawn || {}),
                ...(firstPhase.spawn || {}),
                ...(custom.spawn || {}),
            };

            // main.jsから直接渡されたenemyTableを優先的に適用
            if (config.enemyTable) {
                stage.enemyTable = config.enemyTable;
            }

            // 難易度計算やログ表示のためにTier情報を保存
            if (custom.spawn?.tier) {
                stage.spawn.tier = custom.spawn.tier;
            }

            // 5. フリーモードでは、討伐目標の有無に関わらず出現数自体は制限せず無限に出現させる
            stage.spawn.limit = null; 

            console.log("FREE MODE: MODE APPLIED", {
                mode: stage.clearConditions.endless ? "endless" : (stage.clearConditions.killCount ? "count" : "time"),
                timer: stage.endConditions.timerMs,
                kill: stage.clearConditions.killCount,
                tier: stage.spawn.tier,
                enemyTypes: custom.spawn?.enemyList
            });
        }
    } else if (config.customConditions) {
        // クエスト等の通常カスタム
        stage = { ...stage, ...custom };
    }
    
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
    gameState.isQuestMode = config.isQuestMode ?? false;
    gameState.currentMode = GameModes.ENEMY_MODE;
    
    setLastWasEnemyMode(true);

    showHud(false);

    const enemyContainer = document.getElementById("enemyModeContainer");
    enemyContainer.style.display = "flex";

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
        currentEnemyDifficulty = getCurrentDifficulty("free-enemy"); // ★スコープを "free-enemy" に修正
    } else {
        // ★通常エネミー（単体起動など）
        currentEnemyDifficulty = getDifficulty(config.difficulty || "normal");
    }
    
    const isMultiPhase = Array.isArray(stage.phases) && stage.phases.length > 0;
    const currentPhase = isMultiPhase ? stage.phases[0] : stage;

    // クエストまたはフリーモードの場合は、成長計算ロジック(quest)を使用
    // フリーモード時はUIスライダーのレベル(config.level)を適用し、クエスト時は現在のレベルを使用する
    const statsMode = config.isQuestMode ? "quest" : "enemy";
    const levelOverride = config.isFreeMode ? config.level : undefined;
    let playerStats = getPlayerStatsForEnemy(statsMode, levelOverride);

    // ===============================
    // Active Skill Stock上限設定
    // ===============================
    player.activeSkillStockMax =
        playerStats.activeSkillStockMax ?? 1;

    gameState.activeSkillStockMax =
        playerStats.activeSkillStockMax ?? 1;

    // ★ここで統計を初期化
    const diff = currentEnemyDifficulty;

    // ★難易度設定をenemyStatsにコピー
    const enemyDiff = diff.enemy;


    // ===============================
    // enemyStats!!!!
    // ===============================
    gameState.enemyStats = {
        difficulty: diff.id,
        invincibleSoundPlaying: false, // 無敵音再生フラグ
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
        prevCombo: 0,        // 1フレーム前のコンボ数
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
        // ★星強化によるアクティブスキルのクールダウン短縮倍率
        starCooldownMultiplier: 1,
        // ★難易度設定をここに含める
        spawnRate: enemyDiff.spawnRate,
        chainDecay: enemyDiff.chainDecay,
        activeBgm: null,
    };
    
    // ===============================
    // アクティブスキル戦闘開始リセット
    // ===============================
    const equippedSkills = getEquippedActiveSkills();
    const activeSkillId = equippedSkills?.[0];
    const activeSkill = ACTIVE_SKILLS?.[activeSkillId];

    gameState.activeSkillStock = 0;

    // ★星強化によるクールダウン短縮倍率を設定
    if (activeSkillId) {
        gameState.enemyStats.starCooldownMultiplier =
            getStarUpgradeCooldownMultiplier(activeSkillId);
    } else {
        gameState.enemyStats.starCooldownMultiplier = 1;
    }

    // cooldown初期化

    gameState.activeSkillCooldownMax = (activeSkill?.cooldown || 20);

    gameState.activeSkillCooldown = gameState.activeSkillCooldownMax;

    // 純粋なる試練モードでアクティブスキルが禁止されている場合
    if (player.disableActiveSkill) {
        gameState.activeSkillStock = 0; // ストックを0にして使用不可にする
    }

     // BGMと背景画像の解決ロジック
    let resolvedBgm = "bgm_swim";
    let resolvedBgImage = "battle_blue";

    // 優先順位: ノード固有設定 > ワールドデフォルト > フェーズ/ステージ設定 > グローバルフォールバック
    if (config.isQuestMode && gameState.currentQuestNode) {
        const node = gameState.currentQuestNode;
        const worldId = Object.keys(QUEST_MAP).find(w => QUEST_MAP[w].nodes.some(n => n.id === node.id));
        const world = QUEST_MAP[worldId];

        // 1. ワールドのデフォルト設定をベースにする
        if (world && world.defaults) {
            const stageType = node.stage.includes("BOSS") ? "boss" : node.stage.includes("MID_") ? "mid_boss" : "normal";
            resolvedBgm = world.defaults.bgm?.[stageType] || "bgm_swim";
            resolvedBgImage = world.defaults.bgImage?.[stageType] || "battle_blue";
        }

        // 2. ノード固有設定があれば最優先で上書き
        if (node.bgm) resolvedBgm = node.bgm;
        if (node.bgImage) resolvedBgImage = node.bgImage;
    }

    // 3. 上記で設定されていない場合のみ、ステージ/フェーズ設定をフォールバックとして使用
    if (resolvedBgm === "bgm_swim" && currentPhase.bgm) resolvedBgm = currentPhase.bgm;
    if (currentPhase.bgImage) {
        // resolvedBgImage が初期値のままの場合のみ、ステージ設定で上書き
        if (resolvedBgImage === "battle_blue") {
            resolvedBgImage = currentPhase.bgImage;
        }
    }
    
    gameState.enemyStats.activeBgm = resolvedBgm;
    // ★ gameStateに背景画像を保存
    gameState.enemyStats.activeBgImage = resolvedBgImage;

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
        playBGM(resolvedBgm, 1.0);
        gameState.startTime = getNow(); // BGM表示のために開始時間をセット
    }

    const canvas = document.getElementById("enemyModeCanvas");
    const container = document.getElementById("enemyModeContainer");
    let canvasSize = null;
    
    if (canvas && container) {
        canvas.style.display = "block";
        container.style.display = "flex";

        // 安定してサイズ取得
        const ctx = canvas.getContext("2d");
        // ★画面いっぱいにフィット（レターボックスなし・フルスクリーン/任意サイズ対応）
        canvasSize = fitCanvasToContainerFill(canvas, container, ctx);
        // ★UIセーフエリアを計算
        updateUISafeTop();
        // ★ウィンドウリサイズ時にも再計算
        window.removeEventListener("resize", onEnemyResize); // 多重登録防止
        window.addEventListener("resize", onEnemyResize);
    }

    //player初期化 (計算済みの playerStats をそのまま渡す)
    initPlayerByMode(config.isQuestMode, canvasSize, stage, playerStats);

    setGameActive(true);
    gameState.enemyMode = true;   // ←追加

    // 表示用の最大出現数を設定 (討伐数モードならその数、それ以外は0またはnull)
    const total = stage.clearConditions?.killCount || stage.spawn?.limit || 0;
    gameState.enemyStats.totalSpawn = total;
    gameState.enemyStats.remainingSpawn = total;

    // ===============================
    // 初期ミッション表示設定 (Free Mode / Daily Mode / Quest Mode)
    // ===============================
    gameState.enemyStats.isTransitioning = true;

    if (config.isFreeMode) {
        gameState.enemyStats.transitionMsg = "FREE MODE START";
    } else if (config.isQuestMode) {
        gameState.enemyStats.transitionMsg = "QUEST START";
    } else {
        gameState.enemyStats.transitionMsg = "DAILY MODE START";
    }

    const globalClear = stage.clearConditions || {};
    const firstPhaseCond = currentPhase?.phaseConditions || currentPhase?.endConditions || {};

    if (globalClear.endless) {
        gameState.enemyStats.nextPhaseGoal = "MISSION: ENDLESS SURVIVAL";
    } else if (globalClear.killCount || firstPhaseCond.killCount) {
        const target = globalClear.killCount || firstPhaseCond.killCount;
        gameState.enemyStats.nextPhaseGoal = `MISSION: KILL ${target} ENEMIES`;
    } else if (globalClear.timerMs || firstPhaseCond.timerMs) {
        const ms = globalClear.timerMs || firstPhaseCond.timerMs;
        gameState.enemyStats.nextPhaseGoal = `MISSION: SURVIVE FOR ${ms / 1000}s`;
    } else {
        gameState.enemyStats.nextPhaseGoal = "MISSION: ELIMINATE ENEMIES";
    }

    setTimeout(() => {
        gameState.enemyStats.isTransitioning = false;
        gameState.enemyStats.transitionMsg = null;
        gameState.enemyStats.nextPhaseGoal = null;
    }, 2500);

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
        // ホバーエフェクト
        toggle.onmouseenter = () => {
            toggle.style.transform = 'scale(1.1)';
            toggle.style.transition = 'transform 0.2s ease';
        };
        toggle.onmouseleave = () => {
            toggle.style.transform = 'scale(1.0)';
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
export async function endEnemyMode(isAbort = false) {

    gameState.enemyMode = false;
    // 戦闘終了時に「一度だけ復活」フラグをリセットする
    gameState._reviveUsed = false;

    stopBGM();

    const stats = gameState.enemyStats;
    const enemyContainer = document.getElementById("enemyModeContainer");
    const chainUI = document.getElementById("chainUI")

    const toggle = document.getElementById("enemySoundToggle");
    if (toggle) toggle.style.display = "none";

    enemyContainer.style.display = "none";
    chainUI.style.display = "none";

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
    const diff = getCurrentDifficulty(
        gameState.isFreeMode ? "free-enemy" : (gameState.isQuestMode ? "quest" : "daily")
    );
    const enemyDiff = diff.enemy;

    // 補正①：正確性
    // ★ totalTyped を correctCount + mistakeCount で再計算
    const accuracy = stats.totalTyped > 0 ? stats.correctCount / stats.totalTyped : 0;
    stats.accuracy = accuracy * 100;
    const accuracyBonus = accuracy * sc.accuracyMaxBonus; // 0〜0.5倍のボーナス

    // 各要素の「加算倍率（ボーナス分）」を算出
    const chainBonusInc = stats.maxChainCount / sc.chainDivisor;
    const speedBonusInc = stats.gKpm / sc.speedDivisor;
    const diffBonusInc  = enemyDiff.scoreMultiplier - 1.0;

    //クリア、ノーミス、ノーダメのボーナス
    const isClear = !stats.failed;
    const isNoMiss = stats.mistakeCount === 0;
    const isNoDamage = !stats.tookDamage;

    // 互換性維持: 1.0より大きい整数（例: 200）が難易度データ等にある場合、倍率（0.2）に変換する
    const normalize = (val) => (val > 2) ? val / 1000 : val;

    const clearBonus = isClear
    ? normalize(enemyDiff.scoreBonus?.clearBonus ?? sc.clearBonus)
    : 0;
    const noMissBonus = isNoMiss
    ? normalize(enemyDiff.scoreBonus?.noMissBonus ?? sc.noMissBonus)
    : 0;
    const noDamageBonus = isNoDamage
    ? normalize(enemyDiff.scoreBonus?.noDamageBonus ?? sc.noDamageBonus)
    : 0;

    // 【重要】全ての倍率を合算する (インフレ防止)
    const totalMultiplier = 1.0 + accuracyBonus + chainBonusInc + speedBonusInc + diffBonusInc + clearBonus + noMissBonus + noDamageBonus;

    // ベーススコアに合計倍率をかける
    finalScore = Math.floor(finalScore * totalMultiplier);

    // 結果計算表示用
    const baseScore = stats.gScore;
    stats.scoreBreakdown = {
        base: baseScore,
        accuracy: accuracyBonus,
        chain: chainBonusInc,
        speed: speedBonusInc,
        difficulty: diffBonusInc,
        totalMultiplier: totalMultiplier,
        clearBonus: clearBonus,
        noMissBonus: noMissBonus,
        noDamageBonus: noDamageBonus
    };
    //最終的なgScore
    stats.gScore = Math.max(0, finalScore);
    // =======================================================

    // タイピング技能ベースのランク判定 (eScore方式)
    stats.skillScore = Math.round(stats.gKpm * Math.pow(accuracy, 3));
    stats.rank = getERank(stats.skillScore);

    // ループ停止
    enemyLoopActive = false;
    cancelAnimationFrame(loopId);

    clearAllEffects();
    // Enemyモードフラグ解除
    gameState.enemyMode = false;
    // ★ゲーム状態停止
    if (gameState.invincibleSoundPlaying) {
        stopLoopSE("guard");
        gameState.invincibleSoundPlaying = false;
    }
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

    // ★★★ ESC等による中断（isAbort）は、記録・報酬・経験値などを一切残さない ★★★
    if (isAbort) {
        resetGameState();
        fullResetInput();
        endingSequence = false;
        return null;
    }
   
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

            // ★ 最終ボス撃破後、エンディングフラグを立てる
            if (node.stage === "LAST_BOSS") {
                gameState.isTrueEnding = true;
                console.log("TRUE ENDING FLAG SET");
            }

            // ★ステージ報酬（slot + stock）
            if (
                (node.reward?.type === "slot" || node.reward?.type === "activeStock") &&
                !hasReceivedStageReward(node.id)
            ) {

                const statsMode = gameState.isQuestMode ? "quest" : "enemy";
                const beforeSlot = getPlayerStatsForEnemy(statsMode).skillSlotMax;
                const beforeStock = getActiveSkillStockMax(statsMode);

                applySkillNodeEffect(node.reward, "stage");

                const afterSlot = getPlayerStatsForEnemy("quest").skillSlotMax;
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
        const statsMode = gameState.isQuestMode ? "quest" : "enemy";
        const playerBefore = structuredClone(getPlayerStatsForEnemy(statsMode));
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

            // ★最終EXP（パッシブでの経験値倍率を反映）
            const expMultiplierFromSkills = (playerBefore.expMultiplier || 1);
            gainedExp = Math.floor(baseExp * failMultiplier * starMultiplier * expMultiplierFromSkills);
        }
        
        const prevExp = playerBefore.exp;
        // EXP加算
        const expResult = addExp(gainedExp); // ★受け取る

        const afterStats = getPlayerStatsForEnemy(statsMode);
        const hpUp = expResult.hpIncrease || 0;
        const defUp = expResult.defIncrease || 0;

        const totalSlotIncrease =
            (expResult.slotIncrease || 0) +
            (gameState.questStats.rewardSlotIncrease || 0);

        const totalStockIncrease =
            (expResult.stockIncrease || 0) +
            (gameState.questStats.rewardStockIncrease || 0);

        // ★星保存
        if (lastEnemyConfig?.isQuestMode && gameState.currentQuestNode) {
            const nodeId = gameState.currentQuestNode.id;
            // ★累計獲得星数を差分で加算（最大値更新分のみ）
            const prevStars = getStar(nodeId);
            if (starCount > prevStars) {
                addTotalStarsEarned(starCount - prevStars);
            }
            setStar(nodeId, starCount);
        }
        
        // result用
        gameState.questStats = {
            ...stats,
                skillScore: stats.skillScore,

            gainedExp,

            level: afterStats.level,
            currentExp: afterStats.exp,
            nextExp: afterStats.nextExp,
            prevExp: prevExp,

            // level up
            leveledUp: expResult.levelUpCount > 0,
            levelUpCount: expResult.levelUpCount,
            hpIncrease: hpUp,
            defIncrease: defUp,
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
            gScore: stats.gScore, // gScoreを追加
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
        skillScore: stats.skillScore,

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

                    // enemy専用 + ノーダメージフラグ
                    noDamage: !stats.tookDamage,
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
        // ★ addRankingEntryから返されたレコードオブジェクトからIDを取得
        const recordId = rankingResult.record?.id;

        // ===============================
        // オンライン送信
        // ===============================
        let submitResult = null;

        try {
            // ★ submitScoreに渡すオブジェクトを修正
            const scoreData = {
                player_name: localStorage.getItem("playerName") || "NO NAME",
                mode: `enemy_mode`,
                score: stats.gScore,
                solvedCount: stats.defeatedCount,
                accuracy: Number(stats.accuracy.toFixed(1)),
                kpm: stats.gKpm,
                ranking_version: RANKING_VERSION,
                id: recordId // ★ recordId を含める
            };
            submitResult = await submitScore(scoreData);
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

    if (!devOverride.skill?.infinite && (gameState.activeSkillStock ?? 0) <= 0) {

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

    // DEVモードで無限スキルが有効なら、ここで処理を終了
    if (devOverride.skill?.infinite) {
        console.log("[DEV] Infinite skill used. Stock and cooldown not affected.");
        return;
    }

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
