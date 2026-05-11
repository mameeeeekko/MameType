// skillTreeResult.js
import { gameState, backToMenu } from "./gameCore.js";
import { showQuestMap } from "./main.js";
import { openQuestMenuModal } from "./questMapUI.js"; 
import { startSkillMode, checkSkillUnlocks, SKILL_TREE, checkUnlockByResult, getUnlockText } from "./skillTree.js";
import { showSkillResultIntro } from "./skillTreeUI.js";
import { PASSIVE_SKILLS } from "./questSkills.js";
import { getPlayerStats } from "./questPlayerStats.js";

export function handleSkillModeResult(nodeId) {

    console.log("nodeId:", nodeId);
console.log("node:", SKILL_TREE[nodeId]);

    if (!nodeId) {
        console.error("nodeId missing in skill result");
        return;
    }

    const challenge = gameState.currentChallenge || {};

    const totalInputs = gameState.totalCorrect + gameState.totalMistake;
    const accuracy =
        totalInputs === 0
            ? 0
            : Math.round((gameState.totalCorrect / totalInputs) * 1000) / 10;

    const totalKpm = Math.round(gameState.totalChars / (gameState.totalTime / 60));       

    // =========================
    // result生成
    // =========================
    const resultData = {
        mode: challenge.mode,
        solvedCount: gameState.solvedCount,
        totalMistake: gameState.totalMistake,
        score: gameState.score,
        totalTime: gameState.totalTime,
        accuracy,
        kpm: totalKpm,
        isClear: false,
    };

    // =========================
    // クリア判定（target方式）
    // =========================
    let isClear = false;

    const node = SKILL_TREE[nodeId];

    if (node?.unlock) {
        isClear = checkUnlockByResult(node.unlock, resultData);
    }

    resultData.isClear = isClear;

    // unlock前の状態保存
    const statsBefore = getPlayerStats();
    const unlockedBefore = statsBefore.skillTreeProgress?.unlockedNodes || [];
    const hadSkillBefore = unlockedBefore.includes(nodeId);

    // unlock判定（これは「次を開く」だけ）
    checkSkillUnlocks(resultData, challenge.mode, nodeId);

    // =========================
    // UI表示
    // =========================
    const result = document.getElementById("skillResult");
    const retryBtn = document.getElementById("skillRetryBtn");
    const backBtn = document.getElementById("skillBackBtn");
    const slotDiv = document.getElementById("skillSlotReward");

    showSkillResultIntro(node, isClear, () => {

        result.style.display = "flex";

        // =========================
        // クリア表示タイトル
        // =========================
        const titleDiv = document.createElement("div");
        titleDiv.className = "skill-result-title";
        titleDiv.textContent = isClear ? "CLEAR!" : "FAILED";

        // =========================
        // クリア目標
        // =========================
        const goalDiv = document.createElement("div");
        goalDiv.className = "result-block";

        const unlockText = node?.unlock
            ? getUnlockText(node.unlock)
            : "条件なし";

        goalDiv.innerHTML = `
            <div class="block-title">クリア目標</div>
            <div class="block-content">
                ${unlockText}
            </div>
        `;

        // =========================
        // 獲得スキル（修正後）
        // =========================
        const stats = getPlayerStats();
        const unlocked = stats.skillTreeProgress?.unlockedNodes || [];

        const isUnlockedNow = unlocked.includes(node.id);
        const isNewUnlock = isClear && !hadSkillBefore && isUnlockedNow;

        const skill = isClear ? PASSIVE_SKILLS[node.skillId] : null;

        const skillDiv = document.createElement("div");
        skillDiv.className = "result-block";

        skillDiv.innerHTML = `
            <div class="block-title">獲得スキル</div>
            <div class="block-content">
                ${
                    skill
                        ? `
                        <div class="skill-result-header">
                            <div class="skill-result-icon">
                                <img src="${skill.icon}" alt="${skill.name}">
                            </div>

                            <div class="skill-name">
                                ${skill.name}

                                ${
                                    isNewUnlock
                                        ? `<span class="new-badge">NEW</span>`
                                        : isUnlockedNow
                                            ? `<span class="owned-badge">取得済み</span>`
                                            : ""
                                }
                            </div>
                        </div>

                        <div class="skill-desc">
                            ${skill.desc}
                        </div>
                        `
                        : `<div class="no-skill">なし</div>`
                }
            </div>
        `;
        // =========================
        // ステータス（横並び）
        // =========================
        const statsDiv = document.createElement("div");
        statsDiv.className = "result-stats";

        statsDiv.innerHTML = `
            <div class="block-title">ステータス</div>

            <div class="stats-row">
                
                <div class="stat">
                    <div class="label">クリア数</div>
                    <div class="value">${gameState.solvedCount}</div>
                </div>
                <div class="stat">
                    <div class="label">時間</div>
                    <div class="value">${formatTimeMMSS(gameState.totalTime)}</div>
                </div>
                <div class="stat">
                    <div class="label">KPM</div>
                    <div class="value">${resultData.kpm || 0}</div>
                </div>
                <div class="stat">
                    <div class="label">正確性</div>
                    <div class="value">${accuracy}%</div>
                </div>
                <div class="stat">
                    <div class="label">ミス</div>
                    <div class="value">${gameState.totalMistake}</div>
                </div>

            </div>
        `;

        // =========================
        // DOM再構築
        // =========================
        result.innerHTML = "";

        result.appendChild(titleDiv);
        result.appendChild(goalDiv);
        result.appendChild(skillDiv);
        result.appendChild(statsDiv);
        const btnWrap = document.createElement("div");
        btnWrap.className = "result-buttons";

        btnWrap.appendChild(retryBtn);
        btnWrap.appendChild(backBtn);

        result.appendChild(btnWrap);

        // =========================
        // CLEAR / FAILED
        // =========================
        if (isClear) {
            retryBtn.style.display = "none";
        } else {
            retryBtn.style.display = "inline-block";
        }

        // =========================
        // スロット表示（そのまま）
        // =========================
        if (slotDiv) {
            slotDiv.style.display = "none";
            slotDiv.innerHTML = "";

            resultData.slotIncrease = node?.reward?.slotIncrease;
            if (resultData.slotIncrease) {
                slotDiv.style.display = "block";
                slotDiv.innerHTML = `
                    <span class="slot-up">
                        SLOT +${resultData.slotIncrease}
                    </span>
                `;
            }
        }

        // =========================
        // ボタン処理（そのまま）
        // =========================
        retryBtn.onclick = () => {
            if (isClear) return;
            document.removeEventListener("keydown", result._keyHandler);
            result.style.display = "none";
            startSkillMode(challenge, gameState.currentSkillNodeId);
        };

        backBtn.onclick = () => {
            document.removeEventListener("keydown", result._keyHandler);
            result.style.display = "none";
            backToMenu();
            showQuestMap();

            setTimeout(() => {
                openQuestMenuModal("skillTree");
            }, 0);
        };

        // =========================
        // キーボード操作
        // =========================
        function handleResultKey(e) {

            // 非表示なら無視
            if (result.style.display === "none") return;

            // 入力中は無視
            const tag = document.activeElement.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA") return;

            // 長押し防止
            if (e.repeat) return;

            const retryVisible = retryBtn.offsetParent !== null;

            // R / Enter → リトライ（表示されてる時だけ）
            if ((e.key === "r" || e.key === "Enter") && retryVisible) {
                e.preventDefault();
                retryBtn.click();
            }

            // B → 戻る
            if (e.key === "b") {
                e.preventDefault();
                backBtn.click();
            }
        }

        // 登録
        document.addEventListener("keydown", handleResultKey);

        // 後で解除するために保持
        result._keyHandler = handleResultKey;

    });
}

function formatTimeMMSS(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
}