//questMapUI.js

import { QUEST_MAP } from "./questMap.js";
import { isCleared, getStar } from "./questProgress.js";
import { startEnemyMode, endEnemyMode } from "./enemyCore.js";
import { gameState } from "./gameCore.js";
import * as Game from "./gameCore.js";
import { DIFFICULTIES, getCurrentDifficulty, setCurrentDifficulty } from "./difficulties.js";
import { backToQuestMenu, backToQuestMap } from "./main.js";
import { renderSkillTreeUI } from "./skillTreeUI.js";
import { SKILL_TREE } from "./skillTree.js";
import { PASSIVE_SKILLS } from "./questSkills.js";
import { equipSkill, unequipSkill, getSkillSlotMax, getPlayerStats } from "./questPlayerStats.js";
import { buildClearText, buildEndText, buildStarText, STAGES } from "./enemyModeConfig.js";


export function renderQuestMapUI(){

    const canvas = document.getElementById("mapCanvas");
    const ctx = canvas.getContext("2d");

    const container = document.getElementById("mapContainer");
    const nodeLayer = document.getElementById("mapNodes");
    const world = QUEST_MAP.WORLD1;

    const rect = container.getBoundingClientRect();
    // canvasサイズ同期（DPR対応）
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + "px";
    canvas.style.height = rect.height + "px";

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    nodeLayer.innerHTML = "";


    // =========================
    // 距離を計算する関数
    // =========================
    function getDepthFromCleared(world) {

        const depthMap = new Map();
        const queue = [];

        // ★クリア済み全部を起点にする
        world.nodes.forEach(n => {
            if (isCleared(n.id)) {
                depthMap.set(n.id, 0);
                queue.push({ id: n.id, depth: 0 });
            }
        });

        // クリア0件でも落ちないように
        if (queue.length === 0) {
            const start = world.nodes.find(n => n.id === "Q1");
            if (start) {
                depthMap.set(start.id, 0);
                queue.push({ id: start.id, depth: 0 });
            }
        }

        while (queue.length) {
            const { id, depth } = queue.shift();
            const node = world.nodes.find(n => n.id === id);
            if (!node) continue;

            for (const nextId of node.next) {

                const prev = depthMap.get(nextId);

                if (prev === undefined || depth + 1 < prev) {
                    depthMap.set(nextId, depth + 1);
                    queue.push({ id: nextId, depth: depth + 1 });
                }
            }
        }

        return depthMap;
    }

    // =========================
    // どこまで見えるかを判定する関数
    // =========================
    function getVisibility(node, depthMap) {

        const depth = depthMap.get(node.id);

        if (depth === undefined) return "fog";        // 未到達領域

        if (depth === 0) return "open";               // 現在地点
        if (depth === 1) return "near";               // 1つ先
        if (depth === 2) return "far";                // 2つ先

        return "fog";                                  // それ以降
    }

    // =========================
    // アンロックを見えなくする関数
    // =========================
    function isNodeVisible(node, depthMap) {

    if (window.QUEST_MAP_ADMIN_SHOW_ALL) return true;

    if (isCleared(node.id)) return true;

    const depth = depthMap.get(node.id);

    return depth !== undefined && depth <= 2;
}
    // =========================
    // ノードに入れるか判定
    // =========================
    function canEnterNode(node, world) {

        // 最初のノードは常にOK
        if (node.id === "Q1") return true;

        // 自分に繋がっている前ノードを探す
        const prevNodes = world.nodes.filter(n =>
            n.next.includes(node.id)
        );

        // どれか1つでもクリアしていればOK
        return prevNodes.some(n => isCleared(n.id));
    }

    // =========================
    // 線（そのままpx）
    // =========================
    const OFFSET_X = 150; // メニュー幅分右にずらす
    
    const depthMap = getDepthFromCleared(world);
    world.nodes.forEach(node => {

    if (!isNodeVisible(node, depthMap) && !window.QUEST_MAP_ADMIN_SHOW_ALL) return;

        node.next.forEach(nextId => {

            const target = world.nodes.find(n => n.id === nextId);
            
            if (!target) return;

            // どちらか見えてないなら線も描かない
            if (!isNodeVisible(node, depthMap) || !isNodeVisible(target, depthMap)) return;

                if(!target) return;

                const fromCleared = isCleared(node.id);
                const toCleared = isCleared(target.id);

                const fromUnlocked = canEnterNode(node, world);
                const toUnlocked = canEnterNode(target, world);

                // ▼状態判定
                let lineType = "locked";

                if (fromCleared && toCleared) {
                    lineType = "cleared";        // 完全クリア
                } else if (fromUnlocked && toUnlocked) {
                    lineType = "unlocked";       // ★今回追加（到達済み）
                }

                ctx.beginPath();
                ctx.moveTo(node.pos.x + OFFSET_X, node.pos.y);
                ctx.lineTo(target.pos.x + OFFSET_X, target.pos.y);

                // ▼見た目
                if (lineType === "cleared") {
                    ctx.strokeStyle = "#bfbfbf";
                    ctx.lineWidth = 4;

                } else if (lineType === "unlocked") {
                    ctx.strokeStyle = "#8e8e8e";
                    ctx.lineWidth = 3;

                } else {
                    //ctx.strokeStyle = "#2b2b2b";
                    //ctx.lineWidth = 2;
                    return;
                }

                ctx.stroke();
            });
    });

    // =========================
    // ノード（DOM）
    // =========================

    world.nodes.forEach(node => {

        if (!isNodeVisible(node, depthMap) && !window.QUEST_MAP_ADMIN_SHOW_ALL) return;

        const visibility = window.QUEST_MAP_ADMIN_SHOW_ALL
            ? "open"
            : getVisibility(node, depthMap);

        const wrapper = document.createElement("div");
        wrapper.className = "map-node-wrapper";

        // ★★★☆☆ 表示
        const starEl = document.createElement("div");
        starEl.className = "map-star";

        const starCount = getStar(node.id);
        
        starEl.textContent = renderStarString(starCount);
        wrapper.appendChild(starEl);

        // ノード表示
        const NODE_SIZE = 14;

        wrapper.style.left = (node.pos.x - NODE_SIZE / 2 + OFFSET_X) + "px";
        wrapper.style.top  = (node.pos.y - NODE_SIZE / 2) + "px";

        const el = document.createElement("div");
        el.classList.add("map-node");
        if (visibility === "near") el.classList.add("near-fog-node");
        if (visibility === "far") el.classList.add("far-fog-node");
        if (visibility === "fog") el.classList.add("hard-fog-node");

        const label = document.createElement("div");
        label.classList.add("map-label");
        if (visibility === "near") label.classList.add("near-fog-label");
        if (visibility === "far") label.classList.add("far-fog-label");
        if (visibility === "fog") label.classList.add("hard-fog-label");

        label.textContent = node.name ?? "";
        
        // 報酬アイコン
        if (node.reward) {
            const rewardEl = document.createElement("span");
            rewardEl.className = "map-reward-inline";

            if (node.reward.type === "slot") {
                rewardEl.textContent = "+";
            } else {
                rewardEl.textContent = "◆";
            }

            // ★クリア済みで薄く
            if (isCleared(node.id)) {
                rewardEl.style.opacity = "0.4";
            }

            label.appendChild(rewardEl);
        }

        // ▼ラベル位置調整（線と被らないようにする）
        // ▼ラベル位置候補（8方向）
        const LABEL_OFFSETS = [
            { x: 0, y: -18 },   // 上
            { x: 0, y: 18 },    // 下
            { x: -22, y: 0 },   // 左
            { x: 22, y: 0 },    // 右
            { x: -18, y: -14 }, // 左上
            { x: 18, y: -14 },  // 右上
            { x: -18, y: 14 },  // 左下
            { x: 18, y: 14 },   // 右下
        ];

        function isTooClose(x, y, nodes, minDist = 18) {
            return nodes.some(n => {
                const dx = n.pos.x - x;
                const dy = n.pos.y - y;
                return Math.sqrt(dx * dx + dy * dy) < minDist;
            });
        }

        // ▼ラベル位置決定
        let offsetX = 14;
        let offsetY = -10;

        const candidates = LABEL_OFFSETS
            .map(o => ({
                x: node.pos.x + o.x,
                y: node.pos.y + o.y,
                ox: o.x,
                oy: o.y
            }))
            .filter(p => !isTooClose(p.x, p.y, world.nodes));

        // 一番マシな位置を採用
        if (candidates.length > 0) {
            offsetX = candidates[0].ox;
            offsetY = candidates[0].oy;
        }

        label.style.left = offsetX + "px";
        label.style.top  = offsetY + "px";

        const canEnter = canEnterNode(node, world);
        const cleared = isCleared(node.id);
        
        //星表示
        if (cleared) {
            starEl.textContent = renderStarString(starCount);
        } else {
            starEl.textContent = "";
        }

        // 状態クラス付与
        if(!canEnter){
            el.classList.add("locked");
            label.classList.add("locked");
            // ロック時クリック
            el.onclick = () => {
                showLockedFeedback(el, node, world);
            };

        } else {
            el.classList.add("unlocked");

            if(cleared){
                el.classList.add("cleared");
                label.classList.add("cleared");
            }
            
            el.onmouseenter = () => {
                const stage = STAGES[node.stage];
                if (!stage) return;

                const clearText = buildClearText(stage.clearConditions);
                const endText   = buildEndText(stage.endConditions);
                const starText  = buildStarText(stage.star);

                const rewardText = [];

                if (node.reward) {
                    if (node.reward.type === "slot") {
                        rewardText.push(`スロット +${node.reward.value ?? 1}`);
                    } else {
                        rewardText.push("報酬あり");
                    }
                }

                showQuestTooltip([
                    "■終了条件",
                    ...endText,
                    "",
                    "■クリア条件",
                    ...clearText,
                    "",
                    "■★条件",
                    ...starText,
                    ...(rewardText.length ? ["", "■報酬", ...rewardText] : [])
                ], el);
            };

            el.onmouseleave = hideQuestTooltip;

            el.onclick = ()=>{
                const diff = getCurrentDifficulty("quest");
                const stageData = STAGES[node.stage];
                const skillTreeDiv = document.getElementById("skill-tree");

                showStageIntro(
                    stageData,
                    node,
                    () => {
                        startEnemyMode({
                            stage: node.stage,
                            difficulty: typeof diff === "string" ? diff : diff.id,
                            isQuestMode: true}
                        );
                    },
                    () => {
                        if (skillTreeDiv) skillTreeDiv.style.display = "none";
                        endEnemyMode();
                        gameState.typed = "";
                        Game.fullResetGame();
                        backToQuestMap();
                    },

                );

                gameState.currentQuestNode = node;
            };
        }

        wrapper.appendChild(el);
        wrapper.appendChild(label);
        nodeLayer.appendChild(wrapper);
    });
    renderQuestSideMenu(container);
}

// ====================================
// サイドメニュー
// ====================================
function renderQuestSideMenu(container){

    let menu = document.getElementById("questSideMenu");
    if (menu) menu.remove();

    menu = document.createElement("div");
    menu.id = "questSideMenu";
    menu.className = "quest-side-menu";

    // =========================
    // ボタン生成ヘルパー
    // =========================
    function createBtn(label, onClick){
        const btn = document.createElement("button");
        btn.textContent = label;
        btn.className = "quest-side-btn";
        btn.onclick = onClick;
        return btn;
    }

    menu.appendChild(createBtn("難易度", () => openQuestMenuModal("difficulty")));
    menu.appendChild(createBtn("スキルツリー", () => openQuestMenuModal("skillTree")));
    menu.appendChild(createBtn("スキル", () => openQuestMenuModal("skill")));
    menu.appendChild(createBtn("ステータス", () => document.getElementById("hudDetailBtn").click()));
    menu.appendChild(createBtn("セーブ / ロード", () => document.getElementById("questSaveBtn").click()));
    menu.appendChild(createBtn("戻る", () => backToQuestMenu()));

    container.appendChild(menu);
}

// ====================================
// ロック済みをクリックした時のフィードバック
// ====================================
function showLockedFeedback(el, node, world) {

    // 🔹ブルっとさせる
    el.classList.add("shake");
    setTimeout(() => el.classList.remove("shake"), 300);

    // 🔹理由取得して表示
    const reason = getLockReason(node, world);
    showLockMessage(reason);
}

function getLockReason(node, world) {

    const prevNodes = world.nodes.filter(n =>
        n.next.includes(node.id)
    );

    const uncleared = prevNodes.filter(n => !isCleared(n.id));

    if (uncleared.length > 0) {
        return `${uncleared[0].name} をクリアすると解放`;
    }

    return "条件未達成";
}

function showLockMessage(text) {

    const msg = document.createElement("div");
    msg.className = "lock-tooltip";
    msg.textContent = text;

    document.body.appendChild(msg);

    // 少し遅らせてフェードイン
    setTimeout(() => {
        msg.classList.add("show");
    }, 10);

    // 自動で消える
    setTimeout(() => {
        msg.classList.remove("show");
        setTimeout(() => msg.remove(), 200);
    }, 1500);
}

// =========================
// ★モーダル表示
// =========================
export function openQuestMenuModal(type = "difficulty") {

    const old = document.getElementById("questModal");
    if (old) old.remove();

    const overlay = document.createElement("div");
    overlay.id = "questModal";
    overlay.className = "quest-modal";

    const box = document.createElement("div");
    box.className = "quest-modal-box";

    function closeModal() {
        document.removeEventListener("keydown", onKeyDown);
        overlay.remove();
    }

    function onKeyDown(e) {
        if (e.key === "b") closeModal();
    }

    document.addEventListener("keydown", onKeyDown);

    // 閉じるボタン
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "×";
    closeBtn.className = "quest-modal-close-btn";
    closeBtn.onclick = closeModal;

    box.appendChild(closeBtn);

    // タイトル
    const title = document.createElement("div");
    title.className = "quest-modal-title";
    box.appendChild(title);

    // コンテンツ領域
    const content = document.createElement("div");
    content.className = "quest-modal-content";
    box.appendChild(content);

    // =========================
    // ★コンテンツ切り替え
    // =========================
    const modalPages = {

        difficulty: () => {
            title.textContent = "DIFFICULTY";

            const currentLabel = document.createElement("div");
            currentLabel.className = "quest-current-difficulty";
            content.appendChild(currentLabel);

            const btnContainer = document.createElement("div");
            btnContainer.className = "quest-difficulty-list";
            content.appendChild(btnContainer);

            function update(){
                const current = getCurrentDifficulty("quest");
                //currentLabel.textContent = `現在: ${current.name}`;

                btnContainer.innerHTML = "";

                Object.values(DIFFICULTIES).forEach(diff=>{
                    const btn = document.createElement("button");
                    btn.textContent = diff.name;
                    btn.className = "quest-modal-btn";

                    if(diff.id === current.id){
                        btn.classList.add("active");
                    }

                    btn.onclick = ()=>{
                        setCurrentDifficulty(diff.id, "quest");
                        update();
                    };

                    btnContainer.appendChild(btn);
                });
            }

            update();
        },

        skillTree: () => {
            title.textContent = "SKILL TREE";

            const treeBox = document.createElement("div");
            treeBox.style.height = "400px";
            treeBox.style.border = "1px solid #333";

            content.appendChild(treeBox);

            setTimeout(() => {
                renderSkillTreeUI(treeBox);
            }, 0);
        },

        skill: () => {
            title.textContent = "SKILL";

            const stats = getPlayerStats();

            if (!stats.skillTreeProgress) {
                stats.skillTreeProgress = { unlockedNodes: ["START"] };
            }

            const unlockedNodes = stats.skillTreeProgress.unlockedNodes;
            
            function getEquipped() {
                const s = getPlayerStats();
                return s.equippedSkills || [];
            }

            const wrapper = document.createElement("div");
            wrapper.className = "skill-wrapper";

            // =========================
            // ステータス表示
            // =========================
            const statBox = document.createElement("div");
            statBox.className = "skill-stats";

            function calcPreview(nextEquipped) {

                // ★スキル未適用のベース値にする
                const preview = {
                    chainRate: 1,
                    chainDecayRate: 1,
                    chainBonus: 1,
                    knockbackBonus: 1 
                };

                nextEquipped.forEach(id => {
                    const skill = PASSIVE_SKILLS[id];
                    if (skill?.apply) skill.apply(preview);
                });

                return preview;
            }

            function renderStats(nextEquipped = null) {

                const current = calcPreview(getEquipped());

                // ★ プレビュー中かどうか
                const isPreview = nextEquipped !== null;

                let html = "";

                if (isPreview) {
                    const next = calcPreview(nextEquipped);

                    html = `
                        ${buildStatRow("Chain増加", current.chainRate, next.chainRate)}
                        ${buildStatRow("Chain減衰", current.chainDecayRate, next.chainDecayRate, true)}
                        ${buildStatRow("Chainボーナス補正", current.chainBonus, next.chainBonus)}
                        ${buildStatRow("ノックバック", current.knockbackBonus, next.knockbackBonus)}
                    `;
                } else {
                    html = `
                        ${buildStatRow("Chain増加", current.chainRate)}
                        ${buildStatRow("Chain減衰", current.chainDecayRate, null, true)}
                        ${buildStatRow("Chainボーナス補正", current.chainBonus)}
                        ${buildStatRow("ノックバック", current.knockbackBonus)}
                    `;
                }

                statBox.innerHTML = html;
            }
            
            function buildStatRow(name, current, next = null, inverse = false) {
                const diffText = next !== null
                    ? formatDiffOnly(current, next, inverse)
                    : "";

                return `
                    <div class="skill-stat-row">
                        <div class="skill-stat-name">${name}</div>
                        <div class="skill-stat-current">${current.toFixed(2)}</div>
                        ${renderBar(current, next, inverse)}
                        <div class="skill-stat-value">${diffText}</div>
                    </div>
                `;
            }

            function renderBar(value, nextValue = null, inverse = false) {
                const base = 1.0;

                const currentDelta = inverse ? base - value : value - base;
                const nextDelta = nextValue !== null
                    ? (inverse ? base - nextValue : nextValue - base)
                    : null;

                // 最大±0.5を100%として表示（必要なら調整）
                const scale = 100 / 2.0;

                const currentWidth = Math.abs(currentDelta) * scale;
                const nextWidth = nextDelta !== null ? Math.abs(nextDelta - currentDelta) * scale : 0;

                const currentDir = currentDelta >= 0 ? "up" : "down";
                const nextDir =
                    nextDelta !== null && nextDelta - currentDelta >= 0 ? "up" : "down";

                const currentLeft =
                    currentDelta >= 0 ? 50 : 50 - currentWidth;

                let diffHTML = "";

                if (nextValue !== null && nextDelta !== currentDelta) {
                    const diffStart =
                        nextDelta >= currentDelta
                            ? (currentDelta >= 0 ? 50 + currentWidth : 50 - nextWidth)
                            : (nextDelta >= 0 ? 50 + Math.abs(nextDelta) * scale : 50 - Math.abs(nextDelta) * scale);

                    diffHTML = `
                        <div class="skill-bar-diff ${nextDir}"
                            style="left:${diffStart}%; width:${nextWidth}%;">
                        </div>
                    `;
                }

                return `
                    <div class="skill-bar">
                        <div class="skill-bar-center"></div>

                        <div class="skill-bar-fill ${currentDir}"
                            style="left:${currentLeft}%; width:${currentWidth}%;">
                        </div>

                        ${diffHTML}
                    </div>
                `;
            }

            function formatDiffOnly(a, b, inverse = false) {
                const rawDiff = b - a;
                if (rawDiff === 0) return "";

                // 強さ判定だけ反転
                const effectiveDiff = inverse ? -rawDiff : rawDiff;

                const sign = rawDiff > 0 ? "+" : "";
                const colorClass = effectiveDiff > 0 ? "stat-up" : "stat-down";

                return `<span class="${colorClass}">(${sign}${rawDiff.toFixed(2)})</span>`;
            }

            renderStats(null);

            // =========================
            // 装備スロット
            // =========================
            const equipBox = document.createElement("div");
            equipBox.className = "skill-equip";

            function renderEquip() {
                equipBox.innerHTML = "<h3>装備中</h3>";

                const grid = document.createElement("div");
                grid.className = "equip-grid";

                const MAX = getSkillSlotMax();
                const eq = getEquipped();

                for (let i = 0; i < MAX; i++) {
                    const slot = document.createElement("div");
                    slot.className = "equip-slot";

                    const skillId = eq[i];

                    if (skillId) {
                        const skill = PASSIVE_SKILLS[skillId];

                        slot.innerHTML = `
                            <img src="${skill.icon}" class="equip-slot-icon">
                        `;

                        slot.onclick = () => {
                            unequipSkill(skillId);
                            refresh();
                        };

                        slot.onmousemove = (e) => showSkillTooltip(skill, e);

                        slot.onmouseenter = () => {
                            const next = getEquipped().filter(id => id !== skillId);
                            renderStats(next);   // 外した場合をプレビュー
                        };

                        slot.onmouseleave = () => {
                            renderStats(null);   // 元に戻す
                            hideQuestTooltip();
                        };
                    }

                    // 空スロットでも箱だけ表示
                    grid.appendChild(slot);
                }

                equipBox.appendChild(grid);
            }

            // =========================
            // スキル一覧
            // =========================
            const list = document.createElement("div");
            list.className = "skill-list";

            function renderList() {

                // ★リセット
                list.innerHTML = "";

                // =========================
                // ▼ セクション作成
                // =========================
                const activeSection = document.createElement("div");
                activeSection.className = "skill-section";

                const activeTitle = document.createElement("h3");
                activeTitle.textContent = "装備スキル";

                const activeList = document.createElement("div");
                activeList.className = "skill-grid";

                activeSection.appendChild(activeTitle);
                activeSection.appendChild(activeList);


                const passiveSection = document.createElement("div");
                passiveSection.className = "skill-section";

                const passiveTitle = document.createElement("h3");
                passiveTitle.textContent = "パッシブ";

                const passiveList = document.createElement("div");
                passiveList.className = "skill-grid";

                passiveSection.appendChild(passiveTitle);
                passiveSection.appendChild(passiveList);

                unlockedNodes.forEach(nodeId => {

                    const node = SKILL_TREE[nodeId];
                    if (!node || !node.skillId) return;

                    const skill = PASSIVE_SKILLS[node.skillId];
                    if (!skill) return;

                    // =========================
                    // ▼ パッシブ（装備不可）
                    // =========================
                    if (skill.equipable === false) {

                        const item = document.createElement("div");
                        item.className = "skill-grid-item passive";

                        item.innerHTML = `
                            <div class="skill-grid-icon-wrap">
                                <img src="${skill.icon}" class="skill-grid-icon">
                            </div>
                            <div class="skill-grid-name">${skill.name}</div>
                        `;

                        item.style.cursor = "default";

                        item.onmousemove = (e) => showSkillTooltip(skill, e);
                        item.onmouseleave = hideQuestTooltip;

                        passiveList.appendChild(item);
                        return;
                    }

                    // =========================
                    // ▼ 通常スキル（装備可）
                    // =========================
                    const item = document.createElement("div");
                    item.className = "skill-grid-item";

                    item.innerHTML = `
                        <div class="skill-grid-icon-wrap">
                            <img src="${skill.icon}" class="skill-grid-icon">
                        </div>
                        <div class="skill-grid-name">${skill.name}</div>
                    `;

                    const eq = getEquipped();
                    const isEquipped = eq.includes(node.skillId);

                    if (isEquipped) {
                        item.classList.add("equipped");
                    }

                    // クリック：装備 or 解除
                    item.onclick = () => {

                        let next = [...getEquipped()];

                        if (isEquipped) {
                            next = next.filter(id => id !== node.skillId);
                        } else {
                            const MAX = getSkillSlotMax();
                            if (next.length >= MAX) next.shift();
                            next.push(node.skillId);
                        }

                        if (isEquipped) {
                            unequipSkill(node.skillId);
                        } else {
                            equipSkill(node.skillId);
                        }

                        refresh();
                    };

                    item.onmousemove = (e) => showSkillTooltip(skill, e);

                    item.onmouseenter = () => {
                        let next = [...getEquipped()];

                        if (!isEquipped) {
                            const MAX = getSkillSlotMax();
                            if (next.length >= MAX) next.shift();
                            next.push(node.skillId);
                        } else {
                            next = next.filter(id => id !== node.skillId);
                        }

                        renderStats(next);
                    };

                    item.onmouseleave = () => {
                        renderStats(null);
                        hideQuestTooltip();
                    };

                    activeList.appendChild(item);
                });

                // =========================
                // ▼ 追加
                // =========================
                list.appendChild(activeSection);
                list.appendChild(passiveSection);
            }

            // =========================
            // 再描画
            // =========================
            function refresh() {
                renderEquip();
                renderList();
                renderStats();
            }

            // 初期描画
            renderEquip();
            renderList();

            wrapper.appendChild(statBox);

            // =========================
            // skillslot表示
            // =========================
            const slotInfo = document.createElement("div");
            slotInfo.className = "skill-slot-info";

            const totalSlots = getSkillSlotMax();
            const levelSlots = stats.slotHistory?.totalGained || 0;
            const stageSlots = stats.slotHistory?.rewardGained || 0;
            const skillSlots = stats.slotHistory?.skillTreeGained || 0;

            slotInfo.innerHTML = `
                <div>スロット合計: ${totalSlots}</div>
                <div class="skill-slot-breakdown">
                    <div>レベルアップ: +${levelSlots}</div>
                    <div>ステージ報酬: +${stageSlots}</div>
                    <div>スキルツリー: +${skillSlots}</div>
                </div>
            `;

            wrapper.appendChild(slotInfo);
  
            wrapper.appendChild(equipBox);
            wrapper.appendChild(list);

            content.appendChild(wrapper);
        }
    };

    modalPages[type]?.();

    overlay.appendChild(box);
    document.body.appendChild(overlay);
}

export function closeQuestModal() {
    const modal = document.getElementById("questModal");
    if (modal) modal.remove();
}


// =========================
// 星表示関数
// =========================
function renderStarString(count) {
  let str = "";
  for (let i = 0; i < 5; i++) {
    str += i < count ? "★" : "☆";
  }
  return str;
}

// =========================
// ノードクリア条件ツールチップ
// =========================
let tooltipEl = null;

function showQuestTooltip(lines, targetEl) {
  hideQuestTooltip();

  tooltipEl = document.createElement("div");
  tooltipEl.className = "quest-tooltip";
  tooltipEl.innerHTML = lines.join("<br>");

  document.body.appendChild(tooltipEl);

  const rect = targetEl.getBoundingClientRect();

  tooltipEl.style.left = rect.right + 10 + "px";
  tooltipEl.style.top  = rect.top + "px";
}

function hideQuestTooltip() {
  if (tooltipEl) {
    tooltipEl.remove();
    tooltipEl = null;
  }
}

function showSkillTooltip(skill, event) {
    hideQuestTooltip();

    tooltipEl = document.createElement("div");
    tooltipEl.className = "quest-tooltip";

    tooltipEl.innerHTML = `
        <b>${skill.name}</b><br>
        ${skill.desc ?? ""}
    `;

    document.body.appendChild(tooltipEl);

    const x = event?.pageX ?? 0;
    const y = event?.pageY ?? 0;

    tooltipEl.style.left = x + 12 + "px";
    tooltipEl.style.top = y + 12 + "px";
}

// =========================
// クエストスタート前情報表示
// =========================
function showStageIntro(stage, node, onStart, onCancel) {

  const overlay = document.createElement("div");
  overlay.className = "stage-intro";

  const clearText = buildClearText(stage.clearConditions);
  const endText   = buildEndText(stage.endConditions);
  const starText  = buildStarText(stage.star);
  
    // =========================
    // 報酬テキスト生成
    // =========================
    let rewardHTML = "";

    if (node.reward) {

        const cleared = isCleared(node.id);

        let rewardText = "";

        if (node.reward.type === "slot") {
            rewardText = `スロット +${node.reward.value ?? 1}`;
        } else {
            rewardText = "報酬あり";
        }

        rewardHTML = `
            <div class="intro-section">
                <h3>[ ステージ報酬 ]</h3>
                <div>
                    ${rewardText}
                    ${cleared ? '<span class="reward-done">（取得済み）</span>' : ""}
                </div>
            </div>
        `;
    }
  

  overlay.innerHTML = `
    <div class="stage-intro-box">
      <h2>MISSION</h2>

      <div class="intro-section">
        <h3>[ 終了条件 ]</h3>
        ${endText.map(t => `<div>${t}</div>`).join("")}
      </div>

      <div class="intro-section">
        <h3>[ クリア条件 ]</h3>
        ${clearText.map(t => `<div>${t}</div>`).join("")}
      </div>

      <div class="intro-section">
        <h3>[ ★条件 ]</h3>
        ${starText.map(t => `<div>${t}</div>`).join("")}
      </div>

      ${rewardHTML}

      <div class="intro-start">
        ENTER / SPACE で開始<br>
        ESC / B でキャンセル
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  function start(e) {
    const key = e.key;

    // 開始
    if (key === "Enter" || key === " ") {
        e.preventDefault();  
        document.removeEventListener("keydown", start);
        overlay.remove();
        onStart();
        return;
    }

    // キャンセル
    if (key === "Escape" || key.toLowerCase() === "b") {
        e.preventDefault();  
        document.removeEventListener("keydown", start);
        overlay.remove();
        onCancel && onCancel();
        return;
    }
 }

  document.addEventListener("keydown", start);
}