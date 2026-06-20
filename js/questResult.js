// questResult.js

import { gameState, setGameActive, fullResetGame } from "./gameCore.js";
import { updateHud } from "./hud.js";
import { backToQuestMap } from "./main.js";
import { restartEnemyMode } from "./enemyCore.js";

export function showEnemyEndIntro(text, onFinish) {
    const intro = document.getElementById("endIntro");

    console.log("intro:", intro);
    console.log("HTML:", intro?.innerHTML);

    const textEl = intro.querySelector(".introText");

    console.log("textEl:", textEl);

    textEl.textContent = text;

    // 表示
    intro.style.display = "flex";

    // ★1フレーム待ってからshow付ける（超重要）
    requestAnimationFrame(() => {
        intro.classList.add("show");
    });

    setGameActive(false);

    // 表示時間
    setTimeout(() => {
        intro.classList.remove("show");

        setTimeout(() => {
            intro.style.display = "none";
            onFinish();
        }, 600); // ← CSSのopacity時間と合わせる

    }, 1400); // ← 表示時間（ここ調整ポイント）
}
    

export function showQuestResult(stats) {

    const container = document.getElementById("questSkillResult");
    const content = document.getElementById("questSkillResultContent");

    const retryBtn = document.getElementById("questSkillRetryBtn");
    const backBtn = document.getElementById("questSkillBackBtn");

    container.style.display = "flex";
    

    // =========================
    // タイトル
    // =========================
    const title = `
        <div class="quest-skill-title">
            ${stats.isClear ? "CLEAR!" : "FAILED"}
        </div>
    `;

    // =========================
    // 星評価（追加）
    // =========================
    const starHTML = (!stats.failed && stats.stars > 0 && !stats.isInvalidRun)
        ? `
        <div class="quest-skill-stars">
            ${[...Array(5)].map((_, i) =>
                `<span>${i < stats.stars ? "★" : "☆"}</span>`
            ).join("")}
        </div>
        `
        : "";

    // =========================
    // スコア・ランク
    // =========================
   const multiplierText = (stats.scoreBreakdown && !stats.isInvalidRun)
        ? `<div style="font-size: 0.75em; color: #8b949e; margin-top: 15px; letter-spacing: 1px;">TOTAL MULTIPLIER: ×${stats.scoreBreakdown.totalMultiplier.toFixed(2)}</div>`
        : "";

   const scoreBlock = `
        <div class="quest-skill-block">
            <div class="quest-skill-label2">SCORE</div>

           <div class="score-row">

            <div class="score-side score-left">
                <span class="score-base">
                    ${Math.floor(stats.scoreBreakdown.base).toLocaleString()}
                </span>
                <span class="score-arrow">＞＞＞</span>
            </div>

            <div class="score-center">
                <span class="score-value">
                    ${stats.isInvalidRun ? "ー" : (stats.gScore ?? 0).toLocaleString()}
                </span>
                ${multiplierText}
            </div>

            <div class="score-side score-right">
                <span class="score-rank">
                    ${stats.isInvalidRun ? "" : ` / ${stats.rank ?? "-"} <span style="font-size: 0.9em;">(${stats.skillScore ?? 0})</span>`}
                </span>
            </div>

        </div>
        `;

    // =========================
    // ステータス（2段）
    // =========================
    const statsBlock = `
        <div class="quest-skill-block">
            <div class="quest-skill-label2"></div>

            <div class="quest-skill-stats">

                <div class="quest-skill-stat">
                    <div class="label">Kills</div>
                    <div class="value">${stats.defeatedCount}</div>
                </div>

                <div class="quest-skill-stat">
                    <div class="label">TotalKeystrokes</div>
                    <div class="value">${stats.totalTyped}</div>
                </div>

                <div class="quest-skill-stat">
                    <div class="label">CorrectKeys</div>
                    <div class="value">${stats.correctCount}</div>
                </div>

                <div class="quest-skill-stat">
                    <div class="label">Misses</div>
                    <div class="value">${stats.mistakeCount}</div>
                </div>

                <div class="quest-skill-stat">
                    <div class="label">Accuracy</div>
                    <div class="value">${stats.accuracy.toFixed(1)}%</div>
                </div>

                <div class="quest-skill-stat">
                    <div class="label">PlayTime</div>
                    <div class="value">${((stats.endTime - stats.startTime)/1000).toFixed(2)}s</div>
                </div>

                <div class="quest-skill-stat">
                    <div class="label">TypingTime</div>
                    <div class="value">${((stats.typingActiveTime)/1000).toFixed(2)}s</div>
                </div>

                <div class="quest-skill-stat">
                    <div class="label">gKPM</div>
                    <div class="value">${stats.gKpm.toFixed(2)}</div>
                </div>

                <div class="quest-skill-stat">
                    <div class="label">MaxCombo</div>
                    <div class="value">${stats.maxCombo}</div>
                </div>

                <div class="quest-skill-stat">
                    <div class="label">MaxChain</div>
                    <div class="value">${stats.maxChainCount}</div>
                </div>

            </div>
        </div>
    `;

    // =========================
    // EXP・レベル（そのまま）
    // =========================
    const expBlock = `
        <div class="quest-skill-block">

            <div class="quest-skill-label2">EXP</div>
        
            <div class="level-row">
                <div class="exp-gain">+${stats.gainedExp}</div>
                ${stats.leveledUp ? `
                    <div class="r-badge levelup" id="levelUpBadge"></div>
                ` : ""}
            </div>

            ${stats.leveledUp ? `
                <div class="level-up-stats-row" style="display: flex; gap: 8px; justify-content: center; margin-top: 5px;">
                    ${stats.hpIncrease > 0 ? `<div class="r-badge hpup" style="background: #2ea44f; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 0.8em; font-weight: bold;">HP +${stats.hpIncrease}</div>` : ""}
                    ${stats.defIncrease > 0 ? `<div class="r-badge defup" style="background: #0969da; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 0.8em; font-weight: bold;">DEF +${stats.defIncrease}</div>` : ""}
                </div>
            ` : ""}
        
            <div class="exp-row">
                <div class="exp-bar">
                    <div id="expFill" class="exp-fill"></div>
                </div>
                <div class="level-gain">Lv ${stats.level}</div>
            </div>
            
            <div class="quest-skill-label">
                ${stats.currentExp} / ${stats.nextExp}
            </div>
        </div>
    `;

    // =========================
    // slot / stack 用
    // =========================
    const slotHTML = `
        ${(stats.slotFromLevel > 0) ? `
            <div class="r-badge slotup">
                SLOT +${stats.slotFromLevel} (LEVEL)
            </div>
        ` : ""}

        ${(stats.slotFromReward > 0) ? `
            <div class="r-badge slotup reward">
                SLOT +${stats.slotFromReward} (STAGE)
            </div>
        ` : ""}

        ${(stats.stockFromLevel > 0) ? `
            <div class="r-badge stockup">
                STACK +${stats.stockFromLevel} (LEVEL)
            </div>
        ` : ""}

        ${(stats.stockFromReward > 0) ? `
            <div class="r-badge stockup reward">
                STACK +${stats.stockFromReward} (STAGE)
            </div>
        ` : ""}
    `;

    // =========================
    // スコア計算（完全維持）
    // =========================
    let calcHTML = "";

    const breakdown = stats.scoreBreakdown;

    if (breakdown && !stats.isInvalidRun) {

        const clearHTML = breakdown.clearBonus > 0 ? `
            <div class="calc-item bonus">
                <div class="label">CLEAR</div>
                <div class="value">+${breakdown.clearBonus.toFixed(2)}</div>
            </div>
        ` : "";

        const noDamageHTML = breakdown.noDamageBonus > 0 ? `
            <div class="calc-item bonus">
                <div class="label">NO DMG</div>
                <div class="value">+${breakdown.noDamageBonus.toFixed(2)}</div>
            </div>
        ` : "";

        const noMissHTML = breakdown.noMissBonus > 0 ? `
            <div class="calc-item bonus">
                <div class="label">NO MISS</div>
                <div class="value">+${breakdown.noMissBonus.toFixed(2)}</div>
            </div>
        ` : "";

        const bonusHTML = (clearHTML || noDamageHTML || noMissHTML)
        ? `
        <div class="calc-bonus-row">
            ${clearHTML}
            ${noDamageHTML}
            ${noMissHTML}
        </div>
        `
        : "";

        calcHTML = `
        <div class="quest-skill-block">

            <div class="result-calc">

                <div class="calc-grid">

                    <div class="calc-item">
                        <div class="label">ACC</div>
                        <div class="value">+${breakdown.accuracy.toFixed(2)}</div>
                    </div>

                    <div class="calc-item">
                        <div class="label">CHAIN</div>
                        <div class="value">+${breakdown.chain.toFixed(2)}</div>
                    </div>

                    <div class="calc-item">
                        <div class="label">SPEED</div>
                        <div class="value">+${breakdown.speed.toFixed(2)}</div>
                    </div>

                    <div class="calc-item">
                        <div class="label">DIFF</div>
                        <div class="value">+${breakdown.difficulty.toFixed(2)}</div>
                    </div>

                </div>

                ${bonusHTML}

            </div>
        </div>
        `;
    }

    // =========================
    // 組み立て
    // =========================
    content.innerHTML = `
        <div class="quest-result-inner">
            ${title}
            ${starHTML}
            ${slotHTML} 
            ${scoreBlock}
            ${calcHTML}
            ${expBlock}
            ${statsBlock}
        </div>
    `;

    // =========================
    // 既存アニメーション流用
    // =========================
    window._lastQuestStats = stats;
    setTimeout(() => {
        playCalcAnimationForQuest();
    }, 50);

    // =========================
    // ボタン
    // =========================
    if (stats.isClear) {
        retryBtn.style.display = "none";
    } else {
        retryBtn.style.display = "inline-block";
    }

    retryBtn.onclick = () => {
        document.removeEventListener("keydown", container._keyHandler);
        container.style.display = "none";
        restartEnemyMode();
    };

    backBtn.onclick = () => {
        document.removeEventListener("keydown", container._keyHandler);
        container.style.display = "none";
        fullResetGame();
        gameState.typed = "";
        const modal = document.querySelector(".game-modal");
        if (modal) modal.style.display = "none";
        backToQuestMap();
    };

    updateHud(null, { isQuestMode: true })

    // =========================
    // キーボード操作
    // =========================
    function handleResultKey(e) {

        if (container.style.display === "none") return;

        const tag = document.activeElement.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;

        // 長押し防止（任意だけどおすすめ）
        if (e.repeat) return;

        // 🔽 ここ追加
        const retryVisible = retryBtn.offsetParent !== null;

        if ((e.key === "r" || e.key === "Enter") && retryVisible) {
            e.preventDefault();
            retryBtn.click();
        }

        if (e.key === "b") {
            e.preventDefault();
            backBtn.click();
        }
    }

    // 登録
    document.addEventListener("keydown", handleResultKey);

    // 一度だけでなく、結果閉じたら解除するために保存
    container._keyHandler = handleResultKey;
}


function playCalcAnimationForQuest() {
    const container = document.getElementById("questSkillResultContent");
    if (!container) return;

    const items = container.querySelectorAll(".calc-item");
    const score = container.querySelector(".result-score");

    //  前回状態リセット
    items.forEach(el => el.classList.remove("show"));
    if (score) score.classList.remove("score-pop");

    setTimeout(() => {

        items.forEach((el, i) => {
            setTimeout(() => {
                el.classList.add("show");
            }, i * 140);
        });

        setTimeout(() => {
            if (score) score.classList.add("score-pop");
        }, items.length * 140 + 120);

        setTimeout(() => {
            animateExpBarWithLevelUp();
        }, items.length * 140 + 200);

    }, 50);
}

function animateExpBarWithLevelUp() {

    const stats = window._lastQuestStats || gameState.questStats;
    if (!stats) return;

    const startLevel = stats.level - (stats.levelUpCount || 0);
    const endLevel   = stats.level;

    const fill = document.getElementById("expFill");
    if (!fill) return;

    const before = Number(stats.prevExp) || 0;
    const after  = Number(stats.currentExp) || 0;
    const max    = Number(stats.nextExp) || 1;

    const levelUps = stats.levelUpCount || 0;
    const beforeP = (before / max) * 100;

    const FILL_DURATION = 900;
    const FINAL_DURATION = 1000;
    const PAUSE_DURATION = 400;

    requestAnimationFrame(() => {

        // =========================
        // レベルアップなし
        // =========================
        if (levelUps === 0) {
            const afterP = (after / max) * 100;
            animatePercent(beforeP, afterP, FINAL_DURATION);
            return;
        }
        // =========================
        // 複数レベルアップ
        // =========================
        let count = 0;

        function loop(startP) {

            animatePercent(startP, 100, FILL_DURATION, () => {

                setTimeout(() => {

                    const isLast = (count === levelUps - 1);

                    if (isLast) {
                        showFinalLevelUp(startLevel, endLevel);
                    } else {
                        showLevelUpEffect(count);
                    }

                    count++;

                    fill.style.transition = "none";
                    fill.style.width = "0%";
                    fill.classList.remove("exp-max");
                    fill.offsetHeight;

                    if (count < levelUps) {
                        requestAnimationFrame(() => loop(0));
                    } else {
                        const afterP = (after / max) * 100;
                        requestAnimationFrame(() => {
                            animatePercent(0, afterP, FINAL_DURATION);
                        });
                    }

                }, PAUSE_DURATION);
            });
        }
        loop(beforeP);
    });
}

function animatePercent(start, end, duration = 800, onComplete) {

    const fill = document.getElementById("expFill");

    // 🔥 ここが超重要：開始値を強制
    fill.style.transition = "none";
    fill.style.width = start + "%";
    fill.offsetHeight; // 強制反映
    fill.style.transition = "";

    let startTime = performance.now();

    function update(now) {

        const t = Math.min(1, (now - startTime) / duration);
        // ★自然な動きに変更
        const eased = t * t * (3 - 2 * t);
        const current = start + (end - start) * eased;

        fill.style.width = current + "%";

        if (t < 1) {
            requestAnimationFrame(update);
        } else {
            // ★満タンエフェクト
            if (end >= 99.9) {
                fill.classList.add("exp-max");
            }
            if (onComplete) onComplete();
        }
    }

    requestAnimationFrame(update);
}

function showLevelUpEffect(i = 0) {

    const badge = document.getElementById("levelUpBadge");
    if (!badge) return;

    // ★何回目か分かるように
    badge.textContent = `LEVEL UP! +${i + 1}`;
    badge.classList.add("levelup-effect");
    badge.classList.add("pop");

    setTimeout(() => {
        badge.classList.remove("pop");
    }, 600);
}

function showFinalLevelUp(startLv, endLv) {

    const badge = document.getElementById("levelUpBadge");
    if (!badge) return;

    badge.textContent = `LEVEL UP! Lv ${startLv} → ${endLv}`;
    badge.classList.add("levelup-effect");
    badge.classList.add("pop");

    setTimeout(() => {
        badge.classList.remove("pop");
    }, 800);
}
