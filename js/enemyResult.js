// enemyResult.js

import { gameState } from "./gameCore.js";
import { resetResultButtons } from "./resultView.js";
import { renderOnlineRanking } from "../online/getRanking.js";

export function showEnemyResult({
    isNewRecord = false,
    isRankIn = false,
    rankPos = null
} = {}) {
   
    const stats = gameState.enemyStats ?? {}; // ←必ず stats を定義

    resetResultButtons("enemy_mode", { missedCount: stats.mistakeCount });

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
        <div class="result-calc">
            <div class="calc-item">
                    <div class="label">BASE SCORE</div>
                <div class="value">${Math.floor(breakdown.base)}</div>
            </div>

            <!-- 上段：倍率計算 -->
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
                    <div class="r-row"><span class="result-label">難易度</span><span class="result-value">${stats.difficultyName}</span></div>
                    <div class="r-row"><span class="result-label">撃破数</span><span class="result-value">${stats.defeatedCount}</span></div>
                    <div class="r-row"><span class="result-label">タイプ数</span><span class="result-value">${stats.totalTyped}</span></div>
                    <div class="r-row"><span class="result-label">正確数</span><span class="result-value">${stats.correctCount}</span></div>
                    <div class="r-row"><span class="result-label">ミス数</span><span class="result-value">${stats.mistakeCount}</span></div>
                    <div class="r-row"><span class="result-label">正確性</span><span class="result-value">${stats.accuracy.toFixed(1)}%</span></div>
                    <div class="r-row"><span class="result-label">総時間</span><span class="result-value">${((stats.endTime - stats.startTime)/1000).toFixed(1)}s</span></div>
                    <div class="r-row"><span class="result-label">打鍵時間</span><span class="result-value">${((stats.typingActiveTime)/1000).toFixed(1)}s</span></div>
                    <div class="r-row"><span class="result-label">gKPM</span><span class="result-value">${stats.gKpm.toFixed(0)}</span></div>
                    <div class="r-row"><span class="result-label">最大コンボ</span><span class="result-value">${stats.maxCombo}</span></div>
                    <div class="r-row"><span class="result-label">最大チェイン</span><span class="result-value">${stats.maxChainCount}</span></div>
                </div>

                <div class="result-badges">
                    ${isNewRecord ? `<div class="r-badge new">NEW RECORD</div>` : ""}
                    ${isRankIn ? `<div class="r-badge rank">RANK IN ${rankPos ? rankPos+"位" : ""}</div>` : ""}
                </div>

                <div id="onlineRanking" class="result-online-ranking"></div>
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