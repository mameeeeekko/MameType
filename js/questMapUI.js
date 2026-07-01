//questMapUI.js

import { QUEST_MAP } from "./questMap.js";
import { isCleared, getStar, getUnlockedWorlds, getSelectedWorldId, setSelectedWorldId } from "./questProgress.js";
import { startEnemyMode, endEnemyMode } from "./enemyCore.js";
import { gameState } from "./gameCore.js";
import * as Game from "./gameCore.js";
import { DIFFICULTIES, getCurrentDifficulty, setCurrentDifficulty } from "./difficulties.js";
import { backToQuestMenu, backToQuestMap } from "./main.js";
import { renderSkillTreeUI } from "./skillTreeUI.js";
import { SKILL_TREE } from "./skillTree.js";
import { getSkillById, ACTIVE_SKILLS } from "./questSkills.js";
import {
    equipSkill,
    unequipSkill,
    getSkillSlotMax,
    getPlayerStats,
    equipActiveSkill,
    unequipActiveSkill,
    getEquippedActiveSkills,
    getActiveSkillStockMax,
} from "./questPlayerStats.js";
import { buildClearText, buildEndText, buildStarText, STAGES, getStageConfig } from "./enemyModeConfig.js";
import { devOverride } from "../dev/devOverride.js";
import { images } from "./assetsLoader.js";


export function renderQuestMapUI(){

    const canvas = document.getElementById("mapCanvas");
    const ctx = canvas.getContext("2d");

    const container = document.getElementById("mapContainer");
    const nodeLayer = document.getElementById("mapNodes");
    const worldId = getSelectedWorldId();
    const world = QUEST_MAP[worldId] || QUEST_MAP.WORLD1;

    const rect = container.getBoundingClientRect();
    // canvasサイズ同期（DPR対応）
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + "px";
    canvas.style.height = rect.height + "px";

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    // 背景描画
    if (world.bgImage && images[world.bgImage]) {
        ctx.save();
        ctx.globalAlpha = 0.3; // マップを見やすくするため薄く
        ctx.drawImage(images[world.bgImage], 0, 0, rect.width, rect.height);
        ctx.restore();
    }

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
            // どのノードからも指されていないノード（開始点）を探す
            const allNexts = new Set(world.nodes.flatMap(n => n.next));
            const starts = world.nodes.filter(n => !allNexts.has(n.id));
            
            starts.forEach(start => {
                depthMap.set(start.id, 0);
                queue.push({ id: start.id, depth: 0 });
            });

            // それでもなければ最初の要素
            if (queue.length === 0 && world.nodes.length > 0) {
                 depthMap.set(world.nodes[0].id, 0);
                 queue.push({ id: world.nodes[0].id, depth: 0 });
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

        // どのノードからも指されていないノードは、そのワールドの開始点とみなす
        const allNexts = new Set(world.nodes.flatMap(n => n.next || []));
        if (!allNexts.has(node.id)) return true;

        // 自分に繋がっている前ノードがクリアされているか
        const prevNodes = world.nodes.filter(n => (n.next || []).includes(node.id));
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

            // 通常時のみ、見えてない線は描かない
            if (
                !window.QUEST_MAP_ADMIN_SHOW_ALL &&
                (!isNodeVisible(node, depthMap) || !isNodeVisible(target, depthMap))
            ) {
                return;
            }

            const fromCleared = isCleared(node.id);
            const toCleared = isCleared(target.id);

            const fromUnlocked = canEnterNode(node, world);
            const toUnlocked = canEnterNode(target, world);

            // =========================
            // 線状態判定
            // =========================
            let lineType = "locked";

            if (fromCleared && toCleared) {
                lineType = "cleared";
            } else if (fromUnlocked && toUnlocked) {
                lineType = "unlocked";
            }

            ctx.beginPath();
            ctx.moveTo(node.pos.x + OFFSET_X, node.pos.y);
            ctx.lineTo(target.pos.x + OFFSET_X, target.pos.y);

            // =========================
            // 線見た目
            // =========================
            if (lineType === "cleared") {
                ctx.strokeStyle = "#e1e1e1";
                ctx.lineWidth = 2;

            } else if (lineType === "unlocked") {
                ctx.strokeStyle = "#a3a3a3";
                ctx.lineWidth = 2;

            } else {
                // locked線は管理者表示時のみ描画
                if (!window.QUEST_MAP_ADMIN_SHOW_ALL) return;

                ctx.strokeStyle = "#696969";
                ctx.lineWidth = 2;
            }

            ctx.stroke();
        });
    });

    // =========================
    // ノード（DOM）
    // =========================

    // 開始ノード（どこからも指されていない）を判定するためのセット
    const allNextsInWorld = new Set(world.nodes.flatMap(n => n.next || []));

    // 1. outgoing connectionsがないノードをすべて特定
    const deadEnds = world.nodes.filter(n => !n.next || n.next.length === 0);

    // 2. nextWorldプロパティを持つノードをすべて特定
    const worldTransitionEnds = world.nodes.filter(n => n.nextWorld);

    // 3. 「真の」終了ノードを決定
    let trueEndNodes = new Set();
    if (worldTransitionEnds.length > 0) {
        worldTransitionEnds.forEach(n => trueEndNodes.add(n.id));
    } else {
        deadEnds.forEach(n => trueEndNodes.add(n.id));
    }

    world.nodes.forEach(node => {

        if (!isNodeVisible(node, depthMap) && !window.QUEST_MAP_ADMIN_SHOW_ALL) return;

        // 開始・終了・中ボスの判定を先に行う
        const isStartNode = !allNextsInWorld.has(node.id);
        const isEndNode = trueEndNodes.has(node.id);
        const isMidBoss = node.stage && node.stage.includes("MID_");

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
        const NODE_SIZE = 13;

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

            // if (node.reward.type === "slot") {
            //     rewardEl.textContent = "+";
            // } else {
            //     rewardEl.textContent = "●";
            // }
            
            rewardEl.textContent = "●";

            // ★クリア済みで薄く
            // if (isCleared(node.id)) {
            //     rewardEl.style.opacity = "0.4";
            // }

            label.appendChild(rewardEl);
        }

        // ▼ラベル・星の位置調整（線と被らないように一番広い隙間に配置）
        const center = NODE_SIZE / 2;

        // 1. 接続されている全ノード（前後）の角度を取得
        const connections = [
            ...world.nodes.filter(n => (n.next || []).includes(node.id)),
            ...node.next.map(id => world.nodes.find(n => n.id === id)).filter(Boolean)
        ];
        const angles = connections.map(conn => 
            Math.atan2(conn.pos.y - node.pos.y, conn.pos.x - node.pos.x)
        );

        // 2. 最も広い角度の隙間を計算
        let bestAngle = -Math.PI / 2; // デフォルトは上方向
        if (angles.length > 0) {
            angles.sort((a, b) => a - b);
            let maxGap = 0;
            for (let i = 0; i < angles.length; i++) {
                const a1 = angles[i];
                const a2 = (i === angles.length - 1) ? angles[0] + 2 * Math.PI : angles[i + 1];
                const gap = a2 - a1;
                if (gap > maxGap) {
                    maxGap = gap;
                    bestAngle = a1 + gap / 2;
                }
            }
        }

        // 3. 座標の計算と適用（ノード中心からのオフセット）
        let distX = 20; 
        let distY = 18; 

        // スタート/ゴール（中ボスを除く）の場合は、装飾と重ならないようラベルをさらに離す
        if ((isStartNode || isEndNode) && !isMidBoss) {
            distX += 12;
            distY += 12;
        }

        // 下側に配置される場合、星（ラベルの14px上）がノードと被らないように距離を離す
        if (Math.sin(bestAngle) > 0) {
            distY += 14;
        }
        
        const lx = Math.cos(bestAngle) * distX;
        const ly = Math.sin(bestAngle) * distY;

        const labelX = center + lx;
        const labelY = center + ly;

        // ラベルを隙間の中央に配置
        label.style.left = labelX + "px";
        label.style.top  = labelY + "px";

        let labelTransform = "translateY(-50%)"; // デフォルトは左寄せ（ノードの右側）
        if (lx < -0.01) { // ノードの左側に配置される場合
            labelTransform = "translateX(-100%) translateY(-50%)"; // 右寄せ
        } else if (Math.abs(lx) < 0.01) { // ノードの真上または真下に配置される場合
            labelTransform = "translateX(-50%) translateY(-50%)"; // 中央寄せ
        }
        label.style.transform = labelTransform;

        // 星の位置もラベルに追従（位置関係を維持するため、ラベルの少し上に固定）
        starEl.style.left = labelX + "px";
        starEl.style.top  = (labelY - 14) + "px";
        starEl.style.transform = labelTransform; // ラベルと同じ水平方向のtransformを適用

        const canEnter = canEnterNode(node, world);
        const cleared = isCleared(node.id);

        if (isMidBoss) {
            el.classList.add("mid-boss-node");
        }

        // スタート/ゴール（中ボスを除く）用のターゲットマーク装飾を追加
        if ((isStartNode || isEndNode) && !isMidBoss) {
            const decor = document.createElement("div");
            decor.className = "node-target-decor";
            // 一重の輪っかと上下左右の内向き三角形用の構造
            decor.innerHTML = `
                <div class="ring-inner"></div>
                <span class="target-tri tri-t"></span>
                <span class="target-tri tri-b"></span>
                <span class="target-tri tri-l"></span>
                <span class="target-tri tri-r"></span>
            `;
            el.appendChild(decor);
        }
        
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

                // フェーズがある場合は最初のフェーズの条件、なければトップレベルの条件を参照
                const endConditions = stage.endConditions || (stage.phases && stage.phases[0] ? stage.phases[0].endConditions : null);
                
                const clearText = buildClearText(stage.clearConditions);
                const endText   = buildEndText(endConditions, stage.player);
                const starText  = buildStarText(stage.star);

                const rewardText = [];
                if (node.reward) {
                    if (node.reward.type === "slot") {
                        rewardText.push(`スロット +${node.reward.value ?? 1}`);
                    } else if (node.reward.type === "activeStock") {
                        rewardText.push(`アクティブスキルストック +${node.reward.value ?? 1}`);
                    } else {
                        rewardText.push("報酬あり");
                    }
                }

                const tooltipLines = [];
                
                // ミッションと敵バリエーションの追加
                if (stage.missionName) {
                    tooltipLines.push(`<span class="tooltip-mission-title">${stage.missionName}</span>`);
                    tooltipLines.push(`<span style="font-size:0.9em; color:#ddd;">${stage.missionDescription || ""}</span>`);
                    tooltipLines.push("");
                }
                if (stage.enemyVariationDescription) {
                    tooltipLines.push('<span class="tooltip-title">[エネミー構成]</span>');
                    tooltipLines.push(stage.enemyVariationDescription);
                    tooltipLines.push("");
                }

                tooltipLines.push(
                    '<span class="tooltip-title">[終了条件]</span>',
                    ...endText,
                    "",
                    '<span class="tooltip-title">[クリア条件]</span>',
                    ...clearText,
                    "",
                    '<span class="tooltip-title">[★条件]</span>',
                    ...starText
                );

                if (rewardText.length) {
                    tooltipLines.push("", '<span class="tooltip-title">[報酬]</span>', ...rewardText);
                }

                showQuestTooltip(tooltipLines, el);
            };

            el.onmouseleave = hideQuestTooltip;

            el.onclick = ()=>{
                const diff = getCurrentDifficulty("quest");
                // DEV対応
                const actualStage = devOverride.stage.current || node.stage;
                const stageData = getStageConfig(actualStage);
                const skillTreeDiv = document.getElementById("skill-tree");

                showStageIntro(
                    stageData,
                    node,
                    () => {
                        startEnemyMode({
                            // DEV対応
                            stage: actualStage,
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

        // =========================
        // ▼ ラベルの色付け（状態クラス付与の後に行う）
        // =========================
        // 中ボスまたはボスの場合、オレンジ色にする
        if (isMidBoss || isEndNode) {
            label.style.color = "#ffc15d"; // オレンジ
            label.style.textShadow = "0 0 8px rgba(255, 184, 77, 0.6)";
        }
        
        // ロックされている場合は、全ての色設定をリセットしてCSSのスタイルを優先する
        if (!canEnter) {
            label.style.color = ""; 
            label.style.textShadow = "";
        }
    });
    renderQuestSideMenu(container);
    renderWorldSelector(container);
}

// ====================================
// ワールド切り替え（中央上部）
// ====================================
function renderWorldSelector(container) {
    const unlocked = getUnlockedWorlds();
    const currentId = getSelectedWorldId();
    const currentIndex = unlocked.indexOf(currentId);

    let selector = document.getElementById("worldSelector");
    if (selector) selector.remove();

    selector = document.createElement("div");
    selector.id = "worldSelector";
    selector.className = "world-selector";

    // 前へボタン
    const prevBtn = document.createElement("button");
    prevBtn.className = "world-nav-btn";
    prevBtn.innerHTML = "◀";
    if (currentIndex <= 0) {
        prevBtn.classList.add("disabled");
    } else {
        prevBtn.onclick = () => {
            setSelectedWorldId(unlocked[currentIndex - 1]);
            renderQuestMapUI();
        };
    }

    // ワールド名
    const nameArea = document.createElement("div");
    nameArea.className = "world-name-area";
    const wData = QUEST_MAP[currentId];
    nameArea.textContent = wData?.name || currentId;

    // 次へボタン
    const nextBtn = document.createElement("button");
    nextBtn.className = "world-nav-btn";
    nextBtn.innerHTML = "▶";
    if (currentIndex >= unlocked.length - 1) {
        nextBtn.classList.add("disabled");
    } else {
        nextBtn.onclick = () => {
            setSelectedWorldId(unlocked[currentIndex + 1]);
            renderQuestMapUI();
        };
    }

    selector.appendChild(prevBtn);
    selector.appendChild(nameArea);
    selector.appendChild(nextBtn);

    container.appendChild(selector);
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

    menu.appendChild(createBtn("DIFFICULTY", () => openQuestMenuModal("difficulty")));
    menu.appendChild(createBtn("SKILL TREE", () => openQuestMenuModal("skillTree")));
    menu.appendChild(createBtn("SKILL", () => openQuestMenuModal("skill")));
    menu.appendChild(createBtn("STATUS", () => document.getElementById("hudDetailBtn").click()));
    menu.appendChild(createBtn("SAVE / LOAD", () => document.getElementById("questSaveBtn").click()));
    menu.appendChild(createBtn("EXIT", () => backToQuestMenu()));

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

    // メニューによってサイズを変えるため
    box.classList.add(`quest-modal-${type}`);

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

            // `現在`ラベルは表示しない（UI要望により削除）

            const btnContainer = document.createElement("div");
            btnContainer.className = "quest-difficulty-list";
            content.appendChild(btnContainer);
            
            // 難易度説明を描画するヘルパー
            function renderDiffDescription(diff) {
                if (!diff) return;

                // 既存の説明要素があれば全部削除してから再生成（重複を防ぐ）
                const prevs = document.querySelectorAll('#questDifficultyDesc');
                prevs.forEach(p => p.remove());

                const desc = document.createElement("div");
                desc.id = "questDifficultyDesc";
                desc.className = "quest-difficulty-desc";
                desc.style.marginTop = "12px";
                desc.style.fontSize = "0.9em";
                desc.style.color = "#ddd";
                content.appendChild(desc);

                const e = diff.enemy || {};
                const sb = e.scoreBonus || {};

                // 整形して表示（不足する値は '-' で表示）
                desc.innerHTML = `
                    <div style="font-weight:700; margin-bottom:6px;">${diff.name} の設定</div>
                    <br>
                    <div>[敵関連]</div>
                    <div>・敵出現間隔 (spawnRate): ${e.spawnRate ?? '-' } 倍</div>
                    <div>・敵速度 (enemySpeed): ${e.enemySpeed ?? '-' } 倍</div>
                    <div>・敵ダメージ倍率 (damageMultiplier): ${e.damageMultiplier ?? '-' } 倍</div>
                    <div>・チェイン減衰 (chainDecay): ${e.chainDecay ?? '-' } 倍</div>
                    <br>
                    <div style="margin-top:8px">[スコア関連]</div>
                    <div>・スコア倍率 (scoreMultiplier): ${e.scoreMultiplier ?? '-' } 倍</div>
                    <div>・クリアボーナス: +${Math.round((sb.clearBonus ?? 0)*100)}%</div>
                    <div>・ノーミスボーナス: +${Math.round((sb.noMissBonus ?? 0)*100)}%</div>
                    <div>・被ダメージなしボーナス: +${Math.round((sb.noDamageBonus ?? 0)*100)}%</div>
                `;
            }
            function update(){
                const current = getCurrentDifficulty("quest");
                // 現在選択中のラベル表示は不要のため省略

                btnContainer.innerHTML = "";

                // 説明要素は renderDiffDescription が生成するためここでは作らない

                Object.values(DIFFICULTIES).forEach(diff=>{
                    const btn = document.createElement("button");
                    btn.textContent = diff.name;
                    btn.className = "quest-modal-btn";

                    if(diff.id === current.id){
                        btn.classList.add("active");
                    }

                    // クリックで選択すると説明を切り替える
                    btn.onclick = ()=>{
                        setCurrentDifficulty(diff.id, "quest");
                        update();
                        renderDiffDescription(getCurrentDifficulty("quest"));
                    };

                    btnContainer.appendChild(btn);
                });

                // 初期説明は常に表示する（現在の選択を反映）
                renderDiffDescription(current);
            }

            update();
        },

        skillTree: () => {
            title.textContent = "SKILL TREE";

            const treeBox = document.createElement("div");
            treeBox.className = "skill-tree-box";
            // make height responsive and allow scrolling if content is large
            // 高さはモーダルの max-height と干渉しないように調整
            treeBox.style.height = "calc(90vh - 120px)";
            treeBox.style.maxHeight = "calc(90vh - 120px)";
            treeBox.style.border = "1px solid #333";
            treeBox.style.overflow = "auto";
            treeBox.style.width = "100%";
            treeBox.style.maxWidth = "1200px";
            treeBox.style.boxSizing = "border-box";
            treeBox.style.margin = "0 auto";

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

            // DEV対応：全スキル表示モード
            const unlockedNodes = devOverride.unlockAllSkills
                ? Object.keys(SKILL_TREE)
                : (stats.skillTreeProgress?.unlockedNodes || ["START"]);
            
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
                    knockbackBonus: 1,
                    maxHp: 0,
                    defense: 0,
                    expMultiplier: 1,
                    itemSpawnMultiplier: 1,
                    damageNegateChance: 0,
                    reviveChance: 0,
                    cooldownSpeed: 1.0,
                };

                nextEquipped.forEach(id => {
                    const skill = getSkillById(id);
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
                        ${buildStatRow("Chain増加", current.chainRate, next.chainRate, false, 1.0, { format: v => `x${v.toFixed(2)}` }, 3.0)}
                        ${buildStatRow("Chain減衰", current.chainDecayRate, next.chainDecayRate, true, 1.0, { format: v => `x${v.toFixed(2)}` }, 3.0)}
                        ${buildStatRow("Chainボーナス", current.chainBonus, next.chainBonus, false, 1.0, { format: v => `x${v.toFixed(2)}` }, 3.0)}
                        ${buildStatRow("ノックバック", current.knockbackBonus, next.knockbackBonus, false, 1.0, { format: v => `x${v.toFixed(2)}` }, 3.0)}
                        ${buildStatRow("Max HP", current.maxHp, next.maxHp, false, 0, { format: v => `${v > 0 ? '+' : ''}${v.toFixed(0)}`, diffFormat: v => `${v > 0 ? '+' : ''}${v.toFixed(0)}` }, 200)}
                        ${buildStatRow("DEF", current.defense, next.defense, false, 0, { format: v => `${v > 0 ? '+' : ''}${v.toFixed(0)}`, diffFormat: v => `${v > 0 ? '+' : ''}${v.toFixed(0)}` }, 50)}
                        ${buildStatRow("EXP倍率", current.expMultiplier, next.expMultiplier, false, 1.0, { format: v => `x${v.toFixed(2)}` }, 3.0)}
                        ${buildStatRow("アイテム出現率", current.itemSpawnMultiplier, next.itemSpawnMultiplier, false, 1.0, { format: v => `x${v.toFixed(2)}` }, 2.0)}
                        ${buildStatRow("ダメージ無効化率", current.damageNegateChance, next.damageNegateChance, false, 0, { format: v => `${(v * 100).toFixed(0)}%`, diffFormat: v => `${(v * 100).toFixed(0)}%` }, 1.0)}
                        ${buildStatRow("クールダウン速度", current.cooldownSpeed, next.cooldownSpeed, false, 1.0, { format: v => `x${v.toFixed(2)}` }, 2.0)}
                        ${buildStatRow("REVIVE", current.reviveChance, next.reviveChance, false, 0, { format: v => `${(v * 100).toFixed(0)}%`, diffFormat: v => `${(v * 100).toFixed(0)}%` }, 1.0)}
                    `;
                } else {
                    html = `
                        ${buildStatRow("Chain増加", current.chainRate, null, false, 1.0, { format: v => `x${v.toFixed(2)}` }, 3.0)}
                        ${buildStatRow("Chain減衰", current.chainDecayRate, null, true, 1.0, { format: v => `x${v.toFixed(2)}` }, 3.0)}
                        ${buildStatRow("Chainボーナス", current.chainBonus, null, false, 1.0, { format: v => `x${v.toFixed(2)}` }, 3.0)}
                        ${buildStatRow("ノックバック", current.knockbackBonus, null, false, 1.0, { format: v => `x${v.toFixed(2)}` }, 3.0)}
                        ${buildStatRow("Max HP", current.maxHp, null, false, 0, { format: v => `${v > 0 ? '+' : ''}${v.toFixed(0)}` }, 200)}
                        ${buildStatRow("DEF", current.defense, null, false, 0, { format: v => `${v > 0 ? '+' : ''}${v.toFixed(0)}` }, 50)}
                        ${buildStatRow("EXP倍率", current.expMultiplier, null, false, 1.0, { format: v => `x${v.toFixed(2)}` }, 3.0)}
                        ${buildStatRow("アイテム出現率", current.itemSpawnMultiplier, null, false, 1.0, { format: v => `x${v.toFixed(2)}` }, 2.0)}
                        ${buildStatRow("ダメージ無効化率", current.damageNegateChance, null, false, 0, { format: v => `${(v * 100).toFixed(0)}%` }, 1.0)}
                        ${buildStatRow("クールダウン速度", current.cooldownSpeed, null, false, 1.0, { format: v => `x${v.toFixed(2)}` }, 2.0)}
                        ${buildStatRow("REVIVE", current.reviveChance, null, false, 0, { format: v => `${(v * 100).toFixed(0)}%` }, 1.0)}
                    `;
                }

                statBox.innerHTML = html;
            }
            
            function buildStatRow(name, current, next = null, inverse = false, base = 1.0, formatOptions = {}, maxValue = 3.0) {
                const { format = v => v.toFixed(2), diffFormat = v => v.toFixed(2) } = formatOptions;

                const diffText = next !== null
                    ? formatDiffOnly(current, next, inverse, diffFormat)
                    : "";

                return `
                    <div class="skill-stat-row">
                        <div class="skill-stat-name">${name}</div>
                        <div class="skill-stat-current">${format(current)}</div>
                        ${renderBar(current, next, inverse, base, maxValue)}
                        <div class="skill-stat-value">${diffText}</div>
                    </div>
                `;
            }

            function renderBar(value, nextValue = null, inverse = false, base = 1.0, maxValue = 3.0) {
                // 基準値が1.0の倍率系パラメータと、0の加算系パラメータを両方扱えるようにする
                const currentDelta = inverse ? base - value : value - base;
                const nextDelta = nextValue !== null
                    ? (inverse ? base - nextValue : nextValue - base)
                    : null;

                // 最大±0.5を100%として表示（必要なら調整）
                const maxDelta = Math.max(0.0001, maxValue - base);
                const scale = 50 / maxDelta; // delta * scale がパーセンテージ幅にマッピングされる

                const currentWidth = Math.min(Math.abs(currentDelta) * scale, 50);
                const nextWidth = nextDelta !== null ? Math.min(Math.abs(nextDelta - currentDelta) * scale, 50) : 0;

                const currentDir = currentDelta >= 0 ? "up" : "down";
                const nextDir =
                    nextDelta !== null && nextDelta - currentDelta >= 0 ? "up" : "down";

                const currentLeft = currentDelta >= 0 ? 50 : 50 - currentWidth;

                let diffHTML = "";

                if (nextValue !== null && nextDelta !== currentDelta) {
                    const diffStart =
                        nextDelta >= currentDelta
                            ? (currentDelta >= 0 ? 50 + currentWidth : 50 - nextWidth)
                            : (nextDelta >= 0 ? 50 + Math.min(Math.abs(nextDelta) * scale, 50) : 50 - Math.min(Math.abs(nextDelta) * scale, 50));

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

            function formatDiffOnly(a, b, inverse = false, diffFormatter) {
                const rawDiff = b - a;
                if (rawDiff === 0) return "";

                // 強さ判定だけ反転
                const effectiveDiff = inverse ? -rawDiff : rawDiff;

                const formattedDiff = diffFormatter(rawDiff);
                const sign = rawDiff > 0 && !formattedDiff.startsWith('+') ? "+" : "";
                const colorClass = effectiveDiff > 0 ? "stat-up" : "stat-down";

                return `<span class="${colorClass}">(${sign}${formattedDiff})</span>`;
            }

            renderStats(null);

            // =========================
            // 装備スロット
            // =========================
            const equipBox = document.createElement("div");
            equipBox.className = "skill-equip";
            const activeEquipBox = document.createElement("div");
            activeEquipBox.className = "skill-equip";

            // passive skill　装備
            function renderEquip() {
                equipBox.innerHTML = "<h3>PASSIVE</h3>";

                const grid = document.createElement("div");
                grid.className = "equip-grid";

                const MAX = getSkillSlotMax();
                const eq = getEquipped();

                for (let i = 0; i < MAX; i++) {
                    const slot = document.createElement("div");
                    slot.className = "equip-slot";

                    const skillId = eq[i];

                    if (skillId) {
                        const skill = getSkillById(skillId);

                        slot.innerHTML = `
                            <img src="${images[skill.icon]?.src || ""}" class="equip-slot-icon">
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
            
            //active skill 装備
            function renderActiveEquip() {
                activeEquipBox.innerHTML = `<h3>ACTIVE</h3>`;

                const eq = getEquippedActiveSkills();
                const MAX = 1;
                const skillId = eq[0];
                const skill = skillId ? getSkillById(skillId) : null;

                const container = document.createElement("div");
                container.className = "active-skill-container";

                // アイコンスロット
                const slot = document.createElement("div");
                slot.className = "equip-slot";

                if (skill) {
                    slot.innerHTML = `<img src="${images[skill.icon]?.src || ""}" class="equip-slot-icon">`;
                    slot.onclick = () => {
                        unequipActiveSkill(skillId);
                        refresh();
                    };
                    slot.onmousemove = (e) => showSkillTooltip(skill, e);
                    slot.onmouseleave = hideQuestTooltip;
                }
                container.appendChild(slot);

                // 説明文
                const descContainer = document.createElement("div");
                descContainer.className = "active-skill-desc-container";
                if (skill) {
                    descContainer.innerHTML = `
                        <div class="skill-name">${skill.name}</div>
                        <div class="skill-desc">${skill.desc ?? ""}</div>
                        ${skill.cooldown ? `<div class="skill-cooldown">cooldown: ${skill.cooldown}sec</div>` : ""}
                    `;
                }
                container.appendChild(descContainer);

                activeEquipBox.appendChild(container);
            }

            // =========================
            // スキル一覧
            // =========================
            const list = document.createElement("div");
            list.className = "skill-list";
            const autoSkillBox = document.createElement("div");
            autoSkillBox.className = "skill-equip"; // スタイルを統一
            autoSkillBox.classList.add("auto-skill-box"); // 新しいクラスを追加

            function renderList(currentTab = 'passive') {

                // --- リセット ---
                list.innerHTML = "";

                // --- タブUIの構築 ---
                const tabButtons = document.createElement('div');
                tabButtons.className = 'skill-tabs';

                const tabContents = document.createElement('div');
                tabContents.className = 'skill-tab-contents';

                list.appendChild(tabButtons);
                list.appendChild(tabContents);

                // --- 各タブとコンテンツエリアの作成 ---
                const passiveTab = document.createElement('button');
                passiveTab.className = 'skill-tab-btn';
                passiveTab.textContent = 'PASSIVE';
                tabButtons.appendChild(passiveTab);

                // datasetを追加
                passiveTab.dataset.tab = 'passive';

                const activeTab = document.createElement('button');
                activeTab.className = 'skill-tab-btn';
                activeTab.textContent = 'ACTIVE';
                tabButtons.appendChild(activeTab);

                const passiveContent = document.createElement('div');
                passiveContent.className = 'skill-tab-content';
                const passiveGrid = document.createElement('div');
                passiveGrid.className = 'skill-grid';
                passiveContent.appendChild(passiveGrid);
                tabContents.appendChild(passiveContent);

                const activeContent = document.createElement('div');
                activeContent.className = 'skill-tab-content';
                const activeGrid = document.createElement('div');
                activeGrid.className = 'skill-grid';
                activeContent.appendChild(activeGrid);
                tabContents.appendChild(activeContent);

                // datasetを追加
                activeTab.dataset.tab = 'active';

                // --- タブ切り替えロジック ---
                function switchTab(tabName) {
                    if (tabName === 'passive') {
                        passiveTab.classList.add('active');
                        activeTab.classList.remove('active');
                        passiveContent.classList.add('active');
                        activeContent.classList.remove('active');
                    } else {
                        passiveTab.classList.remove('active');
                        activeTab.classList.add('active');
                        passiveContent.classList.remove('active');
                        activeContent.classList.add('active');
                    }
                }

                passiveTab.onclick = () => {
                    switchTab('passive');
                };
                activeTab.onclick = () => {
                    switchTab('active');
                };

                // ★ 初期表示時にタブを選択
                switchTab(currentTab);

                // AUTOスキル（装備不要）
                autoSkillBox.innerHTML = '<h3>AUTO</h3>';
                const passiveList = document.createElement("div");
                passiveList.className = "skill-grid";

                // --- スキルアイテムの振り分け ---
                const stats = getPlayerStats();
                const unlockedNodes = devOverride.unlockAllSkills
                    ? Object.keys(SKILL_TREE)
                    : (stats.skillTreeProgress?.unlockedNodes || ["START"]);

                const equippedPassive = getEquipped();
                const equippedActive = getEquippedActiveSkills();

 
                //処理
                unlockedNodes.forEach(nodeId => {

                    const node = SKILL_TREE[nodeId];
                    if (!node || !node.skillId) return;

                    const skill = getSkillById(node.skillId);
                    if (!skill) return;

                    // =========================
                    // ▼ アクティブスキル
                    // =========================
                    if (ACTIVE_SKILLS[node.skillId]) {

                        const item = document.createElement("div");
                        item.className = "skill-grid-item";

                        item.innerHTML = `
                            <div class="skill-grid-icon-wrap">
                                <img src="${images[skill.icon]?.src || ""}" class="skill-grid-icon">
                            </div>
                            <div class="skill-grid-name">${skill.name}</div>
                        `;

                        const isEquipped = equippedActive.includes(node.skillId);

                        if (isEquipped) {
                            item.classList.add("equipped");
                        }

                        item.onclick = () => {
                            if (isEquipped) {
                                unequipActiveSkill(node.skillId);
                            } else {
                                equipActiveSkill(node.skillId);
                            }
                            refresh();
                        };

                        item.onmousemove = (e) => showSkillTooltip(skill, e);
                        item.onmouseleave = hideQuestTooltip;

                        activeGrid.appendChild(item);
                        return;
                    }

                    // =========================
                    // ▼ パッシブ（装備不可）
                    // =========================
                    if (skill.equipable === false) {

                        const slot = document.createElement("div");
                        slot.className = "equip-slot auto-skill"; // equip-slotクラスを適用し、専用クラスも追加

                        slot.innerHTML = `
                            <img src="${images[skill.icon]?.src || ""}" class="equip-slot-icon">
                        `;

                        slot.style.cursor = "default";

                        slot.onmousemove = (e) => showSkillTooltip(skill, e);
                        slot.onmouseleave = hideQuestTooltip;

                        passiveList.appendChild(slot);
                        return;
                    }

                    // =========================
                    // ▼ 通常スキル（装備可）
                    // =========================
                    const item = document.createElement("div");
                    item.className = "skill-grid-item";

                    item.innerHTML = `
                        <div class="skill-grid-icon-wrap">
                            <img src="${images[skill.icon]?.src || ""}" class="skill-grid-icon">
                        </div>
                        <div class="skill-grid-name">${skill.name}</div>
                    `;

                    const isEquipped = equippedPassive.includes(node.skillId);

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

                        refresh(getActiveTab());
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

                    passiveGrid.appendChild(item);
                });

                autoSkillBox.appendChild(passiveList);
            }

            // =========================
            // 再描画
            // =========================
            function refresh(currentTab) {
                renderEquip();
                renderActiveEquip();
                renderList(currentTab || getActiveTab());
                renderStats();
            }

            // 現在アクティブなタブを取得するヘルパー
            function getActiveTab() {
                const activeBtn = content.querySelector('.skill-tab-btn.active');
                // アクティブなタブが見つからない場合は 'passive' をデフォルトとする
                return activeBtn ? activeBtn.dataset.tab : 'passive';
            }

            // 初期描画
            renderEquip();
            renderActiveEquip();
            renderList();

            // =========================
            // レイアウト構成
            // =========================
            const leftColumn = document.createElement("div");
            leftColumn.className = "skill-left-column";

            const rightColumn = document.createElement("div");
            rightColumn.className = "skill-right-column";

            // 左カラムに要素を追加
            leftColumn.appendChild(statBox);

             // skillslot表示
             const slotInfo = document.createElement("div");
             slotInfo.className = "skill-slot-info compact"; 
 
             const totalSlots = getSkillSlotMax();
             const levelSlots = stats.slotHistory?.totalGained || 0;
             const stageSlots = stats.slotHistory?.rewardGained || 0;
             const skillSlots = stats.slotHistory?.skillTreeGained || 0;
 
             const totalStocks = getActiveSkillStockMax();
             const levelStocks = stats.stockHistory?.totalGained || 0;
             const stageStocks = stats.stockHistory?.rewardGained || 0;
             const skillStocks = stats.stockHistory?.skillTreeGained || 0;
 
             slotInfo.innerHTML = `
                 <div class="slot-row">
 
                    <div class="slot-card">
                        <div class="slot-title-group">
                            <span class="slot-title">P.Skill Slots</span>
                            <span class="slot-title-detail">（Lv/Stage/Skill）</span>
                        </div>
                        <div class="slot-value-group">
                            <span class="slot-total">${totalSlots}</span>
                            <span class="slot-breakdown">${levelSlots} / ${stageSlots} / ${skillSlots}</span>
                        </div>
                    </div>

                    <div class="slot-card">
                        <div class="slot-title-group">
                            <span class="slot-title">A.Skill Stocks</span>
                            <span class="slot-title-detail">（Lv/Stage/Skill）</span>
                        </div>
                        <div class="slot-value-group">
                            <span class="slot-total">${totalStocks}</span>
                            <span class="slot-breakdown">${levelStocks} / ${stageStocks} / ${skillStocks}</span>
                        </div>
                    </div>
 
                 </div>
                 `;
            leftColumn.appendChild(slotInfo);
  
            const equipArea = document.createElement("div");
            equipArea.className = "skill-equip-area";
            equipArea.appendChild(activeEquipBox);
            equipArea.appendChild(equipBox);
            leftColumn.appendChild(equipArea);
            leftColumn.appendChild(autoSkillBox);

            // 右カラムにスキル一覧を追加
            rightColumn.appendChild(list);

            wrapper.appendChild(leftColumn);
            wrapper.appendChild(rightColumn);
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
  const tooltipRect = tooltipEl.getBoundingClientRect();

  let left = rect.right + 10;
  let top = rect.top;

  // 画面右端からはみ出る場合は左側に表示
  if (left + tooltipRect.width > window.innerWidth) {
    left = Math.max(10, rect.left - tooltipRect.width - 10);
  }
  // 画面下端からはみ出る場合は表示位置を上に調整
  if (top + tooltipRect.height > window.innerHeight) {
    top = Math.max(10, window.innerHeight - tooltipRect.height - 10);
  }

  tooltipEl.style.left = left + "px";
  tooltipEl.style.top  = top + "px";
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

    // スキルのクールダウン時間を表示するHTMLを生成
    const cooldownHTML = skill.cooldown
        ? `<div class="skill-tooltip-cooldown">cooldown: ${skill.cooldown}sec</div>`
        : "";

    tooltipEl.innerHTML = `
        <b>${skill.name}</b>
        <div style="margin-top: 5px;">${skill.desc ?? ""}</div>
        ${cooldownHTML}
    `;

    document.body.appendChild(tooltipEl);

  const tooltipRect = tooltipEl.getBoundingClientRect();
  const mouseX = event?.clientX ?? 0;
  const mouseY = event?.clientY ?? 0;

  let left = mouseX + 12;
  let top = mouseY + 12;

  // 画面端での折り返し判定
  if (left + tooltipRect.width > window.innerWidth) {
    left = mouseX - tooltipRect.width - 12;
  }
  if (top + tooltipRect.height > window.innerHeight) {
    top = mouseY - tooltipRect.height - 12;
  }

  tooltipEl.style.left = (left + window.scrollX) + "px";
  tooltipEl.style.top = (top + window.scrollY) + "px";
}

// =========================
// クエストスタート前情報表示
// =========================
function showStageIntro(stage, node, onStart, onCancel) {

  if (!stage) {
      console.error("Stage config not found for node:", node.id);
      return;
  }

  const overlay = document.createElement("div");
  overlay.className = "stage-intro";

  const endConditions = stage.endConditions || (stage.phases && stage.phases[0] ? stage.phases[0].endConditions : null);
  const clearText = buildClearText(stage.clearConditions);
  const endText   = buildEndText(endConditions, stage.player);
  const starText  = buildStarText(stage.star);
  
  const missionTitle = stage.missionName || "標準ミッション";
  const missionDesc  = stage.missionDescription || "敵を排除し、システムを正常化せよ。";
  const enemyVar     = stage.enemyVariationDescription || "標準データ";

    // =========================
    // 報酬テキスト生成
    // =========================
    let rewardHTML = "";

    if (node.reward) {

        const cleared = isCleared(node.id);

        let rewardText = "";

        if (node.reward.type === "slot") {
            rewardText = `スロット +${node.reward.value ?? 1}`;
        } else if (node.reward.type === "activeStock") {
            rewardText = `アクティブスキルストック +${node.reward.value ?? 1}`;
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
      <div class="intro-header">
        <div class="mission-label">MISSION</div>
        <h2 class="mission-name-main">${missionTitle}</h2>
        <div class="mission-desc-main">${missionDesc}</div>
      </div>

      <div class="intro-section">
        <h3>[ エネミー・バリエーション ]</h3>
        <div class="enemy-var-highlight">${enemyVar}</div>
      </div>

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