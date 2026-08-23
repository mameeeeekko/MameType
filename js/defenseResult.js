// defenseResult.js

import { gameState, setLastWasEnemyMode, getERank, fullResetGame } from "./gameCore.js";
import { backToQuestMap } from "./main.js";
import { updateHud } from "./hud.js";
import { restartDefenseMode } from "./defenseCore.js";
import { animateExpBarWithLevelUp } from "./questResult.js";
import { resetResultButtons } from "./resultView.js";
import { GameModes } from "./gameModes.js";
import { renderOnlineRanking } from "../online/getRanking.js";


/**
 * 防衛モードの結果を表示します。
 * @param {object} defenseStats - 防衛モードの最終的な統計情報
 * @param {object} modeInfo - モードに関する情報
 * @param {object} [rankingInfo={}] - ランキング関連の情報
 */
export function showDefenseResult(defenseStats, modeInfo = {}, rankingInfo = {}) {
    // 「もう一度」ボタンが正しく防衛モードを再開できるようにフラグを設定
    setLastWasEnemyMode(true, "defense_mode");

    const modal = document.querySelector(".game-modal");
    const resultDiv = document.getElementById("result");
    const resultStats = document.getElementById("resultStats");

    // defenseStats は gameState.enemyStats と同じ構造を持つ
    const stats = defenseStats;
    const {
        failed,
        gKpm,
        accuracy,
        skillScore,
        totalTyped,
        mistakeCount,
        correctCount,
        remainingTime,
        timeLimit,
        corruptionRate
    } = defenseStats;
    const { isNewRecord, isRankIn, rankPos, onlineUpdated } = rankingInfo;
    
    if (modeInfo.isQuestMode) {
        // クエストモードの場合、questResult.js と同様のレイアウトとボタン制御を行う
        const container = document.getElementById("questSkillResult");
        const content = document.getElementById("questSkillResultContent");
        const retryBtn = document.getElementById("questSkillRetryBtn");
        const backBtn = document.getElementById("questSkillBackBtn");

        if (container) container.style.display = "flex";
        if (content) content.innerHTML = _renderQuestDefenseResult(stats);

        if (retryBtn) {
            retryBtn.style.display = stats.failed ? "inline-block" : "none";
            retryBtn.onclick = () => {
                container.style.display = "none";
                restartDefenseMode();
            };
        }
        
        if (backBtn) {
            backBtn.style.display = "inline-block";
            backBtn.onclick = () => {
                container.style.display = "none";
                fullResetGame();
                backToQuestMap();
            };
        }

        // ★クエストモードの場合、アニメーションを再生
        window._lastQuestStats = stats;
        setTimeout(() => {
            updateHud(null, { isQuestMode: true });
            animateExpBarWithLevelUp();
        }, 50);
    } else {
        // 通常/フリーモード
        if (modal) modal.style.display = "flex";
        if (resultDiv) resultDiv.style.display = "flex";
        if (resultStats) {
            resultStats.innerHTML = _renderStandardDefenseResult(stats, stats.isFreeMode, { isNewRecord, isRankIn, rankPos, onlineUpdated });
        }
        // ボタンの表示設定を共通関数に任せる
        resetResultButtons("defense_mode", { missedCount: mistakeCount });
    }

    // 「記録を見る」ボタンに現在のモードIDを保存
    const resultOpenRecordsBtn = document.getElementById("resultOpenRecordsBtn");
    if (resultOpenRecordsBtn) {
        resultOpenRecordsBtn.dataset.modeId = "defense_mode";
    }

    // オンラインランキング表示
    requestAnimationFrame(() => {
        // ★クエストモードの場合はオンラインランキング関連の処理をすべてスキップ
        if (modeInfo.isQuestMode) {
            // 通常/フリーモード用のオンラインランキング要素がもしあればクリアする
            const onlineRankingEl = document.getElementById("onlineRanking");
            if (onlineRankingEl) onlineRankingEl.innerHTML = "";
            return;
        }

        const onlineRankingEl = document.getElementById("onlineRanking");
        if (!onlineRankingEl) return;

        if (!navigator.onLine) {
            onlineRankingEl.innerHTML = `<div class="ranking-disabled">ネットワークに接続されていません</div>`;
            return;
        }
        if (!stats.isInvalidRun && !modeInfo.isFreeMode) {
            renderOnlineRanking(stats.gScore ?? 0, stats.solvedCount ?? 0, GameModes.DEFENSE_MODE.id);
        } else {
            onlineRankingEl.innerHTML = "";
        }
    });
}

/**
 * デイリー/フリーモード用の結果HTMLを生成します。
 * @param {object} stats - 統計情報
 * @param {boolean} isFreeMode - フリーモードかどうか
 * @returns {string} HTML文字列
 */
function _renderStandardDefenseResult(stats, isFreeMode, rankingInfo) {
    const { isNewRecord, isRankIn, rankPos, onlineUpdated } = rankingInfo;
    const { gKpm, accuracy, skillScore, totalKeystrokes, totalKeyChars, mistakeCount, correctCount, finalCorruptionRate } = stats;
    const resultTitle = "DEFENSE";
    const rank = getERank(skillScore); // gScoreからランクを再計算

    return `
        <div class="result-container-centered wider menu-style-card">
            ${isFreeMode ? `<div class="result-free-badge">FREE</div>` : ""}
            <div class="result-title-main">${resultTitle}</div>

            <div class="result-header-row">
                <div class="result-header-item ${stats.isInvalidRun ? "invalid" : ""}">
                    <div class="r-label">gScore</div>
                    <div class="result-score r-value big">${stats.isInvalidRun ? "評価不能" : (stats.gScore ?? 0).toLocaleString()}</div>
                </div>
                <div class="result-header-item">
                    <div class="r-label">e-score</div>
                    <div class="r-value big">${stats.isInvalidRun ? "-" : (skillScore ?? 0).toLocaleString()}</div>
                </div>
                <div class="result-header-item">
                    <div class="r-label">RANK</div>
                    <div class="r-value big accent">${stats.isInvalidRun ? "-" : rank ?? "-"}</div>
                </div>
            </div>
            ${stats.failed ? `<div class="result-failed">MISSION FAILED</div>` : ""}

            <div class="result-stats-grid">
                <div class="r-row"><span class="result-label">PlayTime</span><span class="result-value">${((stats.endTime - stats.startTime) / 1000).toFixed(1)}s</span></div>
                <div class="r-row"><span class="result-label">Solved</span><span class="result-value">${stats.solvedCount ?? 0}</span></div>
                <div class="r-row"><span class="result-label">TotalChars</span><span class="result-value">${totalKeyChars}</span></div>
                <div class="r-row"><span class="result-label">TotalKeystrokes</span><span class="result-value">${stats.totalKeystrokes}</span></div>
                <div class="r-row"><span class="result-label">CorrectKeys</span><span class="result-value">${stats.correctCount}</span></div>
                <div class="r-row"><span class="result-label">Misses</span><span class="result-value">${mistakeCount}</span></div>
                <div class="r-row"><span class="result-label">MaxCombo</span><span class="result-value">${stats.maxCombo ?? 0}</span></div>
                <div class="r-row"><span class="result-label">Accuracy</span><span class="result-value">${accuracy.toFixed(1)}%</span></div>
                <div class="r-row"><span class="result-label">KPM</span><span class="result-value">${gKpm.toFixed(0)}</span></div>
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
}

/**
 * クエストモード用の結果HTMLを生成します。
 * @param {object} stats - 統計情報
 * @returns {string} HTML文字列
 */
function _renderQuestDefenseResult(stats) {
    const { failed, gKpm, accuracy, skillScore, totalTyped, mistakeCount, correctCount, remainingTime, timeLimit, finalCorruptionRate, stars } = stats;
    const resultTitle = failed ? "MISSION FAILED" : "MISSION COMPLETE";
    const rank = getERank(skillScore);

    const starHTML = (!failed && stars > 0 && !stats.isInvalidRun) ? `
        <div class="quest-skill-stars">${[...Array(5)].map((_, i) => `<span>${i < stars ? "★" : "☆"}</span>`).join("")}</div>
    ` : "";

    // クエストモード特有の報酬やEXP表示
    const gainedExp = stats.gainedExp ?? 0; // ★
    const levelUpBadge = stats.leveledUp ? `<div class="r-badge levelup" id="levelUpBadge">LEVEL UP!</div>` : "";
    const hpIncreaseBadge = stats.hpIncrease > 0 ? `<div class="r-badge hpup" style="background: #2ea44f; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 0.8em; font-weight: bold;">HP +${stats.hpIncrease}</div>` : ""; // ★
    const defIncreaseBadge = stats.defIncrease > 0 ? `<div class="r-badge defup" style="background: #0969da; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 0.8em; font-weight: bold;">DEF +${stats.defIncrease}</div>` : ""; // ★

    const slotHTML = (stats.slotFromLevel > 0 || stats.slotFromReward > 0) ? `
        ${stats.slotFromLevel > 0 ? `<div class="r-badge slotup">SLOT +${stats.slotFromLevel} (LEVEL)</div>` : ""}
        ${stats.slotFromReward > 0 ? `<div class="r-badge slotup reward">SLOT +${stats.slotFromReward} (STAGE)</div>` : ""}
    ` : "";

    const stockHTML = (stats.stockFromLevel > 0 || stats.stockFromReward > 0) ? `
        ${stats.stockFromLevel > 0 ? `<div class="r-badge stockup">STOCK +${stats.stockFromLevel} (LEVEL)</div>` : ""}
        ${stats.stockFromReward > 0 ? `<div class="r-badge stockup reward">STOCK +${stats.stockFromReward} (STAGE)</div>` : ""}
    ` : "";

    return `
        <div class="quest-result-inner">
            <div class="quest-skill-title">${resultTitle}</div>
            ${starHTML}
            ${slotHTML}
            ${stockHTML}

            <div class="quest-skill-block" style="margin-bottom: 16px;">
                <div class="quest-skill-label2">SCORE</div>
                <div class="score-value-container" style="position: relative; text-align: center;">
                    <span class="score-value">${stats.isInvalidRun ? "ー" : (stats.gScore ?? 0).toLocaleString()}</span>
                    <span class="score-rank" style="position: absolute; left: 50%; top: 12px; transform: translateX(10px); white-space: nowrap; margin-left: 2.5em;">
                        ${stats.isInvalidRun ? "" : ` / ${rank ?? "-"} <span style="font-size: 1.1em;">(${skillScore ?? 0})</span>`}</span>
                </div>
            </div>

            <div class="quest-skill-block" style="margin-bottom: 20px;">
                <div class="quest-skill-label2">EXP</div>
                <div class="level-row">
                    <div class="exp-gain">+${gainedExp}</div>
                    ${levelUpBadge}
                </div>
                <div class="level-up-stats-row" style="display: flex; gap: 8px; justify-content: center; margin-top: 5px;">
                    ${hpIncreaseBadge}
                    ${defIncreaseBadge}
                </div>
                <div class="exp-row">
                    <div class="exp-bar">
                        <div id="expFill" class="exp-fill" style="width:${(stats.currentExp / (stats.nextExp || 1)) * 100}%"></div>
                    </div>
                    <div class="level-gain">Lv ${stats.level}</div>
                </div>
                <div class="quest-skill-label">
                    ${stats.currentExp ?? 0} / ${stats.nextExp ?? 1}
                </div>
            </div>

            <div class="quest-skill-block"  style="margin-bottom: 30px;">
                <div class="quest-skill-stats" style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 16px 16px;">
                    <div class="quest-skill-stat"><div class="label">PlayTime</div><div class="value">${((stats.endTime - stats.startTime) / 1000).toFixed(2)}s</div></div>
                    <div class="quest-skill-stat"><div class="label">Typed Chars</div><div class="value">${stats.countedTypedChars ?? 0} / ${stats.totalKeyChars ?? 0}</div></div>                  
                    <div class="quest-skill-stat"><div class="label">Solved</div><div class="value">${stats.solvedCount ?? 0}</div></div>
                    <div class="quest-skill-stat"><div class="label">MaxCombo</div><div class="value">${stats.maxCombo ?? 0}</div></div>
                    <div class="quest-skill-stat"><div class="label">KPM</div><div class="value">${gKpm.toFixed(0)}</div></div>
                    <div class="quest-skill-stat"><div class="label">Accuracy</div><div class="value">${accuracy.toFixed(1)}%</div></div>
                    <div class="quest-skill-stat"><div class="label">CorrectKeys</div><div class="value">${stats.correctCount ?? 0}</div></div>
                    <div class="quest-skill-stat"><div class="label">Misses</div><div class="value">${stats.mistakeCount}</div></div>
                </div>
            </div>
        </div>
    `;
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