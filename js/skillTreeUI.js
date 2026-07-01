import { SKILL_TREE, startSkillMode, getUnlockText, getChallengeText, getRequirementText, checkSkillRequirements } from "./skillTree.js";
import { getSkillById, ACTIVE_SKILLS } from "./questSkills.js";
import { applySkillNodeEffect, getPlayerStats } from "./questPlayerStats.js";
import { closeQuestModal, openQuestMenuModal } from "./questMapUI.js";
import { backToMenu, exitSkillMode } from "./gameCore.js";
import { backToQuestMap } from "./main.js";
import { devOverride } from "../dev/devOverride.js";
import { setupCanvasDPR } from "./canvasUtil.js";
import { images } from "./assetsLoader.js";


// =========================================================
// ノード座標（固定配置）
// ==========================================================

const NODE_POS = {
    START: { x: 0, y: 0 },

    // 左（チェイン系）
    CHAIN_UP_1: { x: -80, y: 0 },
    CHAIN_UP_2: { x: -400, y: 0 },
    CHAIN_UP_3: { x: -480, y: 70 },
    CHAIN_UP_4: { x: -720, y: -70 },

    CHAIN_DECAY_1: { x: -160, y: 0 },
    CHAIN_DECAY_2: { x: -320, y: 70 },
    CHAIN_DECAY_3: { x: -560, y: 70 },
    CHAIN_DECAY_4: { x: -720, y: 70 },

    GLASS_CHAIN_1: { x: -240, y: 0 },
    GLASS_CHAIN_2: { x: -240, y: 70 },
    GLASS_CHAIN_3: { x: -480, y: -70 },
    GLASS_CHAIN_4: { x: -640, y: 0 },

    CHAIN_BONUS_1: { x: -240, y: -70 },
    CHAIN_BONUS_2: { x: -320, y: -70 },
    CHAIN_BONUS_3: { x: -560, y: -70 },
    CHAIN_BONUS_4: { x: -720, y: 0 },

    // 右（防御回復系）
    HEAL_SMALL: { x: 80, y: 0 },
    HEAL_MEDIUM: {x: 240, y: 140},
    HEAL_HIGH: {x: 320, y: 140},

    DAMAGE_NEGATE_1: {x: 160, y: 0},
    DAMAGE_NEGATE_2: {x: 240, y: 0},
    DAMAGE_NEGATE_3: {x: 320, y: 0},

    REVIVE_1: {x: 160, y: -70},
    REVIVE_2: {x: 240, y: -70},
    REVIVE_3: {x: 320, y: -70},

    INVINCIBLE_SHORT: {x: 160, y: 70},
    INVINCIBLE_MEDIUM: {x: 240, y: 70},
    INVINCIBLE_LONG: {x: 320, y: 70},

    // Cooldown
    COOLDOWN_SPEED_3: { x: 400, y: 140 },

    // 上（攻撃系）
    
    KB_UP_1: { x: 0, y: -70 },
    KB_UP_2: { x: 0, y: -140 },
    KB_UP_3: { x: -80, y: -280 },
    KB_UP_4: { x: 0, y: -350 },

    KNOCKBACK_EDGE: {x: 80, y: -420},

    FREEZE_LIGHT: { x: 80, y: -140 },
    FREEZE_MEDIUM: {x: 80, y: -210},
    FREEZE_HEAVY: {x: 80, y: -280},
    
    KILL_NEAREST: { x: -80, y: -140 },
    KILL_RANDOM: { x: -80, y: -210 },
    KILL_NEAREST_H: { x: -160, y: -210 },
    KILL_ALL: {x: -80, y: -420},

    // Cooldown
    COOLDOWN_SPEED_2: { x: -240, y: -210 },

   // 下 （補助系）

    ITEM_SPAWN_1: {x: 80, y: 210},
    ITEM_SPAWN_2: {x: 160, y: 350},
    ITEM_SPAWN_3: {x: 160, y: 490},

    SLOT_1: { x: 0, y: 280 },
    STOCK_1: { x: 0, y: 350 },
    
    // Max HP ノード（左下）
    MAX_HP_1: { x: 0, y: 140 },
    MAX_HP_2: { x: 160, y: 280 },
    MAX_HP_3: { x: 0, y: 490 },

    // DEF ノード（左寄り）
    DEF_UP_1: { x: 0, y: 70 },
    DEF_UP_2: { x: -160, y: 280 },
    DEF_UP_3: { x: -160, y: 490 },

    // EXP ノード（右下）
    EXP_UP_1: { x: -80, y: 210 },
    EXP_UP_2: { x: -160, y: 350 },
    EXP_UP_3: { x: 0, y: 420 },
    
    // Cooldown
    COOLDOWN_SPEED_1: { x: -240, y: 350 },
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

    // =========================
    // 自動フィット: NODE_POS の範囲を取得して
    // キャンバス内に収まるように scale と origin を計算する
    // =========================
    const nodeKeys = Object.keys(NODE_POS).filter(k => SKILL_TREE[k]);

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodeKeys.forEach(k => {
        const p = NODE_POS[k];
        if (!p) return;
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
    });

    if (minX === Infinity) {
        minX = -200; minY = -200; maxX = 200; maxY = 200;
    }

    const padding = 80; // px
    const contentW = (maxX - minX) || 1;
    const contentH = (maxY - minY) || 1;

    // required size in px (account for padding)
    const requiredW = contentW + padding * 2;
    const requiredH = contentH + padding * 2;

    // scale to fit (but allow upscaling a bit)
    const fitScale = Math.min(width / requiredW, height / requiredH, 1.5);

    // origin such that bbox center aligns with canvas center
    const bboxCenterX = (minX + maxX) / 2;
    const bboxCenterY = (minY + maxY) / 2;

    const originX = centerX - bboxCenterX * fitScale;
    const originY = centerY - bboxCenterY * fitScale;

    function toCanvasPos(pos) {
        return {
            x: originX + (pos.x || 0) * fitScale,
            y: originY + (pos.y || 0) * fitScale
        };
    }

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

                const pFrom = toCanvasPos(from);
                const pTo = toCanvasPos(to);

                ctx.beginPath();
                ctx.moveTo(pFrom.x, pFrom.y);
                ctx.lineTo(pTo.x, pTo.y);

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

        const cp = toCanvasPos(pos);
        const x = cp.x;
        const y = cp.y;

        const isUnlocked = unlocked.includes(node.id);

        // 解放可能判定
        let canUnlock = false;

        if (!isUnlocked) {
            const parents = findParents(node.id); // 複数の親を取得

            // 親がいないノードは解放不可（STARTノードを除く）
            if (parents.length > 0) {
                // 全ての親が解放されているかチェック (AND条件)
                canUnlock = parents.every(p => unlocked.includes(p.id)); // AND条件
            }
        }

        const scaledRadius = Math.max(8, nodeRadius * fitScale);
        ctx.beginPath();
        ctx.arc(x, y, scaledRadius, 0, Math.PI * 2);

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

            const isActiveSkill = !!ACTIVE_SKILLS[node.skillId];

            ctx.fillStyle = isActiveSkill
                ? "#ffdbd6"   // アクティブスキル
                : "#ffffff";  // パッシブスキル

            ctx.font = "10px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(skill.name, x, y + 28);

            // ラベル影
            ctx.shadowColor = "rgba(0,0,0,0.8)";
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 1;

            ctx.fillText(skill.name, x, y + 28);

            // 他の描画に影が残らないよう戻す
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
        }

        // クリック判定用
        nodeHitAreas.push({
            id: node.id,
            x,
            y,
            r: scaledRadius,
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

        const tooltipWidth = 260;
        const tooltipHeight = 180;

        let left = mx + 20;
        let top = my + 20;

        // コンテナ右端を超えたら左へ
        if (left + tooltipWidth > container.clientWidth) {
            left = mx - tooltipWidth - 20;
        }

        // コンテナ下端を超えたら上へ
        if (top + tooltipHeight > container.clientHeight) {
            top = my - tooltipHeight - 20;
        }

        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;

        const unlockText = getUnlockText(node.unlock);
        const challengeText = getChallengeText(node.challenge);
        const requirementText = getRequirementText(node.requirements);
        const tagHtml = (node.challenge.tags || [])
            .map(tag => `<span class="skill-tag">${tag}</span>`)
            .join("");

        tooltip.innerHTML = `
            <div class="title">
                <img class="skill-icon-img" src="${images[skill.icon]?.src || ""}" />
                <span>${skill.name}</span>
            </div>
            <div class="desc">${skill.desc}</div>

            ${
                requirementText
                ? `
                    <div class="unlock">
                        <div class="label requirement-onmouse-label">[挑戦条件]</div>
                        <div class="value">${requirementText}</div>
                    </div>
                `
                : ""
            }

            ${
                challengeText
                ? `
                    <div class="challenge">
                        <div class="label challenge-onmouse-label">[挑戦内容]</div>
                        <div class="value">${challengeText}</div>
                    </div>
                `
                : ""
            }

            ${tagHtml
                ? `
                    <div class="skill-tags">
                        ${tagHtml}
                    </div>
                `
                : ""
            }

            ${
                unlockText
                ? `
                    <div class="unlock">
                        <div class="label unlock-onmouse-label">[解放条件]</div>
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
// 複数の親を配列で返す (AND条件用)
export function findParents(id) {
    return Object.values(SKILL_TREE).filter(n =>
        n.children && n.children.includes(id)
    );
}

// 最初に見つかった親を1つ返す (OR条件用)
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
  const tagHtml = (node.challenge.tags || [])
            .map(tag => `<span class="skill-tag">${tag}</span>`)
            .join("");

  overlay.innerHTML = `
    <div class="stage-intro-box">
      <h2>SKILL CHALLENGE</h2>

      <div class="intro-section">
        <img class="skill-icon-img" src="${images[skill.icon]?.src || ""}" />
        <div class="skill-intro-name">${skill?.name || "-"}</div>
        <div>${skill?.desc || ""}</div>
      </div>

      ${
        challengeText
        ? `
        <div class="intro-section">
          <h3 class="challenge-title">[ 挑戦内容 ]</h3>
          <div>${challengeText}</div>
        </div>
        `
        : ""
      }

        ${tagHtml
            ? `
                <div class="skill-tags">
                    ${tagHtml}
                </div>
            `
            : ""
        }

      ${
        unlockText
        ? `
        <div class="intro-section">
          <h3 class="unlock-title">[ 解放条件 ]</h3>
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
        <img class="skill-icon-img" src="${images[skill.icon]?.src || ""}" />
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