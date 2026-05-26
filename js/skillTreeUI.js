import { SKILL_TREE, startSkillMode, getUnlockText, getChallengeText, getRequirementText, checkSkillRequirements } from "./skillTree.js";
import { getSkillById } from "./questSkills.js";
import { applySkillNodeEffect, getPlayerStats } from "./questPlayerStats.js";
import { closeQuestModal, openQuestMenuModal } from "./questMapUI.js";
import { backToMenu, exitSkillMode } from "./gameCore.js";
import { backToQuestMap } from "./main.js";
import { devOverride } from "../dev/devOverride.js";
import { setupCanvasDPR } from "./canvasUtil.js";

// =========================================================
// ノード座標（固定配置）
// ==========================================================

const NODE_POS = {
    START: { x: 0, y: 0 },

    // 上（チェイン）
    CHAIN_1: { x: 0, y: -80 },
    CHAIN_2: { x: 0, y: -160 },

    // 右（スコア）
    SCORE_1: { x: 120, y: 0 },

    // 下（耐久）
    DEF_1: { x: 0, y: 120 },

    // 左（自由枠）
    ACTIVE_1: { x: -120, y: 0 },
    SLOT_1: { x: -120, y: 120 },
    STOCK_1: { x: -120, y: -120 },
    ACTIVE_2: { x: -240, y: 0 },
    ACTIVE_3: { x: -360, y: 0 },
    
};

export function renderSkillTreeUI(container){

    const canvas = document.createElement("canvas");
    canvas.className = "skill-tree-canvas";
    container.appendChild(canvas);

    //スキルツールチップ
    const tooltip = document.createElement("div");
    tooltip.className = "skill-tooltip";
    container.appendChild(tooltip);

    const ctx = canvas.getContext("2d");

    const { width, height } = setupCanvasDPR(canvas, container, ctx);

    const centerX = width / 2;
    const centerY = height / 2;

    const stats = getPlayerStats();

    if (!stats.skillTreeProgress) {
        stats.skillTreeProgress = { unlockedNodes: ["START"] };
    }
    
    // DEV対応　管理モード対応　全ノードチャレンジ可能にできる。
    const unlocked = devOverride.unlockAllSkills
        ? Object.keys(SKILL_TREE)
        : stats.skillTreeProgress.unlockedNodes;
    
    const nodeRadius = 14;

    const nodeHitAreas = [];

    // =========================
    // ロック演出
    // =========================
    function showSkillTreeLockedFeedback(text) {

        // ツールチップ表示
        tooltip.style.display = "block";

        tooltip.innerHTML = `
            <div class="title locked">
                LOCKED
            </div>

            <div class="desc">
                ${text || "条件未達成"}
            </div>
        `;

        // 中央寄せ表示
        tooltip.style.left = `${window.innerWidth / 2 - 120}px`;
        tooltip.style.top  = `${window.innerHeight / 2 + 120}px`;

        // ブルっと
        canvas.classList.add("shake");

        setTimeout(() => {
            canvas.classList.remove("shake");
        }, 300);

        // 自動で消える
        clearTimeout(showSkillTreeLockedFeedback.timer);

        showSkillTreeLockedFeedback.timer = setTimeout(() => {
            tooltip.style.display = "none";
        }, 1500);
    }

    // =========================
    // 線描画
    // =========================
    Object.values(SKILL_TREE).forEach(node => {
        if (!node.children) return;

        const from = NODE_POS[node.id];
        if (!from) return;

        node.children.forEach(childId => {
            const to = NODE_POS[childId];
            if (!to) return;

            ctx.beginPath();
            ctx.moveTo(centerX + from.x, centerY + from.y);
            ctx.lineTo(centerX + to.x, centerY + to.y);

            const fromUnlocked = unlocked.includes(node.id);
            const toUnlocked = unlocked.includes(childId);

            if (fromUnlocked && toUnlocked) {
                ctx.strokeStyle = "#bfbfbf";
                ctx.lineWidth = 3;
            } else if (fromUnlocked) {
                ctx.strokeStyle = "#888";
                ctx.lineWidth = 2;
            } else {
                ctx.strokeStyle = "#333";
                ctx.lineWidth = 1;
            }

            ctx.stroke();
        });
    });

    // =========================
    // ノード描画
    // =========================
    Object.values(SKILL_TREE).forEach(node => {

        const pos = NODE_POS[node.id];
        if (!pos) return;

        const x = centerX + pos.x;
        const y = centerY + pos.y;

        const isUnlocked = unlocked.includes(node.id);

        // 解放可能判定
        let canUnlock = false;

        if (!isUnlocked) {
            const parent = findParent(node.id);

            if (parent && unlocked.includes(parent.id)) {
                canUnlock = true;
            }
        }

        ctx.beginPath();
        ctx.arc(x, y, nodeRadius, 0, Math.PI * 2);

        if (isUnlocked) {
            ctx.fillStyle = "#4caf50";
        } else if (canUnlock) {
            ctx.fillStyle = "#ffc107";
        } else {
            ctx.fillStyle = "#555";
        }

        ctx.fill();

        // スキル名
        if (node.skillId) {
            const skill = getSkillById(node.skillId);

            if (!skill) {
                console.warn("Skill not found:", node.skillId);
                return;
            }

            ctx.fillStyle = "#fff";
            ctx.font = "10px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(skill.name, x, y + 28);
        }

        // クリック判定用
        nodeHitAreas.push({
            id: node.id,
            x,
            y,
            r: nodeRadius,
            canUnlock
        });
    });

    // =========================
    // クリック処理
    // =========================
    canvas.onclick = (e) => {

        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        nodeHitAreas.forEach(n => {
            const dx = mx - n.x;
            const dy = my - n.y;

            if (Math.sqrt(dx*dx + dy*dy) <= n.r) {

                const node = SKILL_TREE[n.id];
                const hintDiv = document.getElementById("skillUnlockHint");

                // =========================
                // 未解放 → 解放
                // =========================
                if (!unlocked.includes(n.id)) {

                    // DEV対応　skill all がONだったら全てクリック可能
                    if (!devOverride.unlockAllSkills && !n.canUnlock) {

                        const requirementText =
                            getRequirementText(node.requirements);

                        showSkillTreeLockedFeedback(
                            requirementText || "未解放ノード"
                        );

                        return;
                    }

                    if (node.challenge) {

                        // 解放済みでも他の条件（ステージやレベルなど）未達成なら開始しないようここで止める。
                        // DEV対応
                        const canChallenge =
                            devOverride.unlockAllSkills || checkSkillRequirements(node);

                        if (!canChallenge) {

                            const requirementText =
                                getRequirementText(node.requirements);

                            showSkillTreeLockedFeedback(
                                requirementText || "条件未達成"
                            );

                            return;
                        }

                        // チャレンジ開始
                        closeQuestModal(); 
                        showSkillIntro(
                            node, 
                            () => { startSkillMode(node.challenge, node.id)},
                            () => { backToMenu();
                                    if (hintDiv) hintDiv.style.display = "none";
                                    backToQuestMap();
                                    openQuestMenuModal("skillTree");
                                    exitSkillMode();},
                        );
                    }
                    return;
                }

                // =========================
                // 解放済み → チャレンジ開始
                // =========================
                if (node.challenge) {
                    closeQuestModal(); 
                    showSkillIntro(
                        node, 
                        () => { startSkillMode(node.challenge, node.id)},
                        () => { backToMenu();
                                if (hintDiv) hintDiv.style.display = "none";
                                backToQuestMap();
                                openQuestMenuModal("skillTree");
                                exitSkillMode();},
                    );
                }
            }
        });
    };

    // =========================
    // オンマウス処理（スキルツールチップ）
    // =========================
    canvas.onmousemove = (e) => {

        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        let hitNode = null;

        nodeHitAreas.forEach(n => {
            const dx = mx - n.x;
            const dy = my - n.y;

            if (Math.sqrt(dx*dx + dy*dy) <= n.r) {
                hitNode = n;
            }
        });

        if (!hitNode) {
            tooltip.style.display = "none";
            return;
        }

        const node = SKILL_TREE[hitNode.id];
        const skill = getSkillById(node.skillId);

        if (!skill) {
            tooltip.style.display = "none";
            return;
        }

        tooltip.style.display = "block";

        const containerRect = container.getBoundingClientRect();
        const tooltipWidth = 260;
        const tooltipHeight = 180;

        let left = containerRect.left + mx + 16;
        let top = containerRect.top + my + 16;

        if (left + tooltipWidth > window.innerWidth) {
            left = containerRect.left + mx - tooltipWidth - 16;
        }

        if (top + tooltipHeight > window.innerHeight) {
            top = containerRect.top + my - tooltipHeight - 16;
        }

        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;

        const unlockText = getUnlockText(node.unlock);
        const challengeText = getChallengeText(node.challenge);
        const requirementText = getRequirementText(node.requirements);

        tooltip.innerHTML = `
            <div class="title">
                <img class="skill-icon-img" src="${skill.icon}" />
                <span>${skill.name}</span>
            </div>
            <div class="desc">${skill.desc}</div>

            ${
                requirementText
                ? `
                    <div class="unlock">
                        <div class="label">-挑戦条件-</div>
                        <div class="value">${requirementText}</div>
                    </div>
                `
                : ""
            }

            ${
                challengeText
                ? `
                    <div class="challenge">
                        <div class="label">-挑戦内容-</div>
                        <div class="value">${challengeText}</div>
                    </div>
                `
                : ""
            }

            ${
                unlockText
                ? `
                    <div class="unlock">
                        <div class="label">-解放条件-</div>
                        <div class="value">${unlockText}</div>
                    </div>
                `
                : ""
            }
            
        `;
    };

    canvas.onmouseleave = () => {
        tooltip.style.display = "none";
    };
}

// =========================
// 親ノード取得
// =========================
export function findParent(id) {
    return Object.values(SKILL_TREE).find(n =>
        n.children && n.children.includes(id)
    );
}

// =========================
// 解放処理
// =========================
export function unlockNode(id){

    const stats = getPlayerStats();

    if (!stats.skillTreeProgress) {
        stats.skillTreeProgress = { unlockedNodes: ["START"] };
    }

    const unlocked = stats.skillTreeProgress.unlockedNodes;

    if (!unlocked.includes(id)) {
        unlocked.push(id);

        const node = SKILL_TREE[id];
        if (node?.effect) {
            applySkillNodeEffect(node.effect, "skill");
        }
    }

    localStorage.setItem("questPlayerStats", JSON.stringify(stats));
}

// =========================
// スキルモードスタート前のイントロ
// =========================
export function showSkillIntro(node, onStart, onCancel) {

  const overlay = document.createElement("div");
  overlay.className = "stage-intro"; // ←流用OK

  const skill = getSkillById(node.skillId);

  const unlockText = getUnlockText(node.unlock);
  const challengeText = getChallengeText(node.challenge);

  overlay.innerHTML = `
    <div class="stage-intro-box">
      <h2>SKILL CHALLENGE</h2>

      <div class="intro-section">
        <img class="skill-icon-img" src="${skill.icon}" />
        <div>${skill?.name || "-"}</div>
        <div>${skill?.desc || ""}</div>
      </div>

      ${
        challengeText
        ? `
        <div class="intro-section">
          <h3>[ 挑戦内容 ]</h3>
          <div>${challengeText}</div>
        </div>
        `
        : ""
      }

      ${
        unlockText
        ? `
        <div class="intro-section">
          <h3>[ 解放条件 ]</h3>
          <div>${unlockText}</div>
        </div>
        `
        : ""
      }

      <div class="intro-start">
        ENTER / SPACE で開始<br>
        ESC / B でキャンセル
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  function start(e) {
    const key = e.key;

    // ★追加：ブラウザのデフォルト動作を抑制
    e.preventDefault();
    e.stopPropagation();

    // 開始
    if (key === "Enter" || key === " ") {
        document.removeEventListener("keydown", start);
        overlay.remove();
        onStart();
        return;
    }

    // キャンセル
    if (key === "Escape" || key.toLowerCase() === "b") {
        document.removeEventListener("keydown", start);
        overlay.remove();
        onCancel && onCancel();
        return;
    }
 }

  document.addEventListener("keydown", start);
}

// =========================
// 結果後イントロ（成功/失敗）
// =========================
export function showSkillResultIntro(node, isClear, onNext) {

  const overlay = document.createElement("div");
  overlay.className = "stage-intro";

  const skill = getSkillById(node.skillId);

  const title = isClear ? "MISSION COMPLETE" : "FAILED";

  overlay.innerHTML = `
    <div class="stage-intro-box fade-in">
      <h2>${title}</h2>

      <div class="intro-section">
        <img class="skill-icon-img" src="${skill.icon}" />
        <div>${skill?.name || "-"}</div>
      </div>
      
    </div>
  `;

  document.body.appendChild(overlay);

  // =========================
  // ⏱ 自動遷移（ここが重要）
  // =========================
  setTimeout(() => {
    overlay.classList.add("fade-out");

    setTimeout(() => {
      overlay.remove();
      onNext();
    }, 400); // フェードアウト時間
  }, 1200); // 表示時間（調整ポイント）
}