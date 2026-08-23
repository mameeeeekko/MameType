// enemyResult.js

import { gameState, fullResetGame, backToMenu } from "./gameCore.js";
import { GameModes } from "./gameModes.js";
import { showRecordsView } from "./recordsView.js";
import { resetResultButtons } from "./resultView.js";
import { renderOnlineRanking } from "../online/getRanking.js";

export function showEnemyResult({
    isNewRecord = false,
    isRankIn = false,
    rankPos = null,
    onlineUpdated = false
} = {}) {
   
    const stats = gameState.enemyStats ?? {}; // ←必ず stats を定義

    resetResultButtons("enemy_mode", { missedCount: stats.mistakeCount });

    // ★「記録を見る」ボタンに現在のモードIDを保存する
    const resultOpenRecordsBtn = document.getElementById("resultOpenRecordsBtn");
    if (resultOpenRecordsBtn) {
        // main.jsのイベントリスナーがこのIDを使う
        resultOpenRecordsBtn.dataset.modeId = GameModes.ENEMY_MODE.id;
    }

    const modal = document.querySelector(".game-modal");
    const resultDiv = document.getElementById("result");
    const resultStats = document.getElementById("resultStats");
    const gameScreen = document.getElementById("enemyModeContainer");

    if(gameScreen) gameScreen.style.display = "none";
    //if(canvas) canvas.style.display = "none";
    if(modal) modal.style.display = "flex";

    const failedText = stats.failed ? `<div class="result-failed">MISSION FAILED</div>` : "";

    const breakdown = stats.scoreBreakdown;
    const multiplierText = (breakdown && !stats.isInvalidRun)
        ? `<div style="font-size: 0.75em; color: #8b949e; margin-bottom: 15px; letter-spacing: 1px;">TOTAL MULTIPLIER: ×${breakdown.totalMultiplier.toFixed(2)}</div>`
        : "";

    let calcHTML = "";

    if (breakdown && !stats.isInvalidRun) {
        const clearHTML = breakdown.clearBonus > 0 ? `
            <div class="calc-item bonus">
                <div class="label">CLEAR</div>
                <div class="value">${formatSigned(breakdown.clearBonus)}</div>
            </div>
        ` : "";
        const noDamageHTML = breakdown.noDamageBonus > 0 ? `
            <div class="calc-item bonus">
                <div class="label">NO DMG</div>
                <div class="value">${formatSigned(breakdown.noDamageBonus)}</div>
            </div>
        ` : "";
        const noMissHTML = breakdown.noMissBonus > 0 ? `
            <div class="calc-item bonus">
                <div class="label">NO MISS</div>
                <div class="value">${formatSigned(breakdown.noMissBonus)}</div>
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
        <div class="result-calc">
            <div class="calc-item">
                    <div class="label">BASE SCORE</div>
                <div class="value">${Math.floor(breakdown.base)}</div>
            </div>

            <!-- 上段：倍率計算 -->
            <div class="calc-grid">
                <div class="calc-item">
                    <div class="label">ACC</div>
                    <div class="value">${formatSigned(breakdown.accuracy)}</div>
                </div>

                <div class="calc-item">
                    <div class="label">CHAIN</div>
                    <div class="value">${formatSigned(breakdown.chain)}</div>
                </div>

                <div class="calc-item">
                    <div class="label">SPEED</div>
                    <div class="value">${formatSigned(breakdown.speed)}</div>
                </div>

                <div class="calc-item">
                    <div class="label">DIFF</div>
                    <div class="value">${formatSigned(breakdown.difficulty)}</div>
                </div>
            </div>

            <!-- 下段：ボーナス -->
            ${bonusHTML}

        </div>
        `;
    }

    if(resultStats){
        resultStats.innerHTML = `
            <div class="result-container-centered wider menu-style-card">
                ${gameState.isFreeMode ? `<div class="result-free-badge">FREE</div>` : ""}
                <div class="result-title-main">ENEMY MODE RESULT</div>
                ${calcHTML}
                ${multiplierText}

                <div class="result-header-row">
                    <div class="result-header-item ${stats.isInvalidRun ? "invalid" : ""}">
                        <div class="r-label">gScore</div>
                        <div class="result-score r-value big">${stats.isInvalidRun ? "評価不能" : (stats.gScore ?? 0).toLocaleString()}</div>
                    </div>
                    <div class="result-header-item">
                        <div class="r-label">RANK(eScore)</div>
                        <div class="r-value big accent">${stats.isInvalidRun ? "-" : `${stats.rank ?? "-"} <span style="font-size: 0.6em;">(${stats.skillScore ?? 0})</span>`}</div>
                    </div>
                </div>
                ${failedText}
                
                <div class="result-stats-grid">
                    <div class="r-row"><span class="result-label">Difficulty</span><span class="result-value">${stats.difficultyName}</span></div>
                    <div class="r-row"><span class="result-label">Kills</span><span class="result-value">${stats.defeatedCount}</span></div>
                    <div class="r-row"><span class="result-label">TotalKeystrokes</span><span class="result-value">${stats.totalTyped}</span></div>
                    <div class="r-row"><span class="result-label">CorrectKeys</span><span class="result-value">${stats.correctCount}</span></div>
                    <div class="r-row"><span class="result-label">Misses</span><span class="result-value">${stats.mistakeCount}</span></div>
                    <div class="r-row"><span class="result-label">Accuracy</span><span class="result-value">${stats.accuracy.toFixed(1)}%</span></div>
                    <div class="r-row"><span class="result-label">gKPM</span><span class="result-value">${stats.gKpm.toFixed(0)}</span></div>
                    <div class="r-row"><span class="result-label">PlayTime</span><span class="result-value">${((stats.endTime - stats.startTime)/1000).toFixed(1)}s</span></div>
                    <div class="r-row"><span class="result-label">TypingTime</span><span class="result-value">${((stats.typingActiveTime)/1000).toFixed(1)}s</span></div>
                    <div class="r-row"><span class="result-label">MaxCombo</span><span class="result-value">${stats.maxCombo}</span></div>
                    <div class="r-row"><span class="result-label">MaxChain</span><span class="result-value">${stats.maxChainCount}</span></div>
                </div>

                <div class="result-badges">
                    ${isNewRecord ? `<div class="r-badge new">NEW RECORD</div>` : ""}
                    ${isRankIn ? `<div class="r-badge rank">RANK IN ${rankPos ? rankPos+"位" : ""}</div>` : ""}
                </div>

                <div class="online-ranking-container" style="display: flex; align-items: center; justify-content: center; gap: 10px; margin-top: 10px;">
                    ${onlineUpdated ? `<div class="r-badge online-update">ONLINE RECORD UPDATED</div>` : ""}
                    <div id="onlineRanking" class="result-online-ranking"></div>
                </div>
            </div>
        `;
        playCalcAnimation();
    }

    if(resultDiv) resultDiv.style.display = "flex";

    // 標準リザルトと同様に、DOMの更新を待ってからランキングを描画
    requestAnimationFrame(() => {
        const onlineRankingEl = document.getElementById("onlineRanking");
        if (!onlineRankingEl) return;

        if (!navigator.onLine) {
            onlineRankingEl.innerHTML = `<div class="ranking-disabled">ネットワークに接続されていません</div>`;
            return;
        }

        if (!stats.isInvalidRun && !gameState.isFreeMode) {
            renderOnlineRanking(stats.gScore ?? 0, stats.defeatedCount ?? 0, `enemy_mode`);
        } else {
            onlineRankingEl.innerHTML = "";
        }
    });
}

function playCalcAnimation() {
    const container = document.getElementById("resultStats");
    if (!container) return;

    const items = container.querySelectorAll(".calc-item");
    const score = container.querySelector(".result-score");

    // 🔁 前回状態リセット（超重要）
    items.forEach(el => el.classList.remove("show"));
    if (score) score.classList.remove("score-pop");

    // 少し遅らせて開始（描画安定）
    setTimeout(() => {

        items.forEach((el, i) => {
            setTimeout(() => {
                el.classList.add("show");
            }, i * 140);
        });

        // 🎯 スコア演出
        setTimeout(() => {
            if (score) score.classList.add("score-pop");
        }, items.length * 140 + 120);

    }, 50);
}

function formatSigned(value, digits = 2) {
    const num = Number(value) || 0;
    return num >= 0
        ? `+${num.toFixed(digits)}`
        : num.toFixed(digits);
}