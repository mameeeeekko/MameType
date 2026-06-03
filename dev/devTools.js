// devTools.js
import { devOverride } from "./devOverride.js";
import { getPlayerStats } from "../js/playerStats.js";
import { savePlayerStats } from "../js/storage.js";
import { gameState } from "../js/gameCore.js";
import { forceSetLevel } from "../js/questPlayerStats.js";
import { updateHud } from "../js/hud.js";
import { STAGES, ENEMY_MODE_CONFIG } from "../js/enemyModeConfig.js";
import { renderQuestMapUI, openQuestMenuModal } from "../js/questMapUI.js";


// =====================================================
// Dev API（ここだけ触れば全部安全）
// =====================================================

export const dev = {

    // =========================
    // set系　変更実行関数
    // =========================

    // level ----------------------------------------------------

    setLevel(level, progress = 0) {
        const stats = forceSetLevel(level, progress);

        if (gameState.playerStats) {
            Object.assign(gameState.playerStats, stats);
        }

        if (typeof initPlayerByMode === "function") {
            initPlayerByMode(true);
        }

        if (typeof updateHud === "function") {
            updateHud(null, { isQuestMode: true });
        }

        const el = document.getElementById("viewLevel");
        if (el) el.textContent = stats.level;

        log("level set:", stats.level, stats);
    },

    setExpMultiplier(value) {
        devOverride.exp.multiplier = value;

        const el = document.getElementById("viewExpMultiplier");
        if (el) el.textContent = value;

        log("exp multiplier:", value);
    },

    // parameter --------------------------------------------------

    setChain(value) {
        if (gameState.enemyStats) {
            gameState.enemyStats.chainCount = value;
        }

        const el = document.getElementById("viewChain");
        if (el) el.textContent = value;

        log("Chain:", value);
    },
    setChainRate(value) {
        devOverride.chain = devOverride.chain || {};
        devOverride.chain.chainRate = value;
        const el = document.getElementById("viewChainRate");
        if (el) el.textContent = value;

        log("ChainRate:", value);
    },

    setChainDecayRate(value) {
        devOverride.chain = devOverride.chain || {};
        devOverride.chain.chainDecayRate = value;
        const el = document.getElementById("viewChainDecayRate");
        if (el) el.textContent = value;

        log("ChainDecayRate:", value);        
    },

    setChainBonus(value) {
        devOverride.chain = devOverride.chain || {};
        devOverride.chain.chainBonus = value;
        const el = document.getElementById("viewChainBonus");
        if (el) el.textContent = value;

        log("ChainBonus:", value);  
    },

    setGainOnType(value) {
        devOverride.chain = devOverride.chain || {};
        devOverride.chain.gainOnType = value;
        const el = document.getElementById("viewGainOnType");
        if (el) el.textContent = value;

        log("GainOnType:", value);  
    },

    setGainOnKill(value) {
        devOverride.chain = devOverride.chain || {};
        devOverride.chain.gainOnKill = value;
        const el = document.getElementById("viewGainOnKill");
        if (el) el.textContent = value;

        log("GainOnKill:", value);  
    },

    setMissPenalty(value) {
        devOverride.chain = devOverride.chain || {};
        devOverride.chain.missPenalty = value;
        const el = document.getElementById("viewMissPenalty");
        if (el) el.textContent = value;

        log("MissPenalty:", value);  
    },

    setDecayRate(value) {
        devOverride.chain = devOverride.chain || {};
        devOverride.chain.decayRate = value;
        const el = document.getElementById("viewDecayRate");
        if (el) el.textContent = value;

        log("DecayRate:", value);  
    },

    setKnockbackBonus(value) {
        devOverride.other = devOverride.other || {};
        devOverride.other.knockbackBonus = value;
        const el = document.getElementById("viewKnockBackBonus");
        if (el) el.textContent = value;

        log("KnockBackBonus:", value);  
    },

    // stage change ------------------------------------------------

    setStage(id) {
        devOverride.stage.current = id;

        const el = document.getElementById("currentStageOverride");
        if (el) el.textContent = `Stage: ${id}`;

        log("Stage override:", id);
    },

    setSpawnInterval(ms) {
        if (!devOverride.stage.global) {
            devOverride.stage.global = {};
        }

        devOverride.stage.global.spawn = {
            interval: ms
        };

        const el = document.getElementById("viewSpawnInterval");
        if (el) el.textContent = ms;

        log("Global Spawn interval:", ms);
    },

    setMaxAlive(value) {
        devOverride.spawn = devOverride.spawn || {};
        devOverride.spawn.maxAlive = value;
        const el = document.getElementById("viewMaxAlive");
        if (el) el.textContent = value;

        log("MaxAlive:", value);  
    },

    killAllEnemies() {
        gameState.enemyStats.defeatedCount = 9999;
        log("KillAll triggered");
    },

    // 終了条件の敵を殺す数
    setKillLimit(value) {    
        if (!devOverride.stage.global) {
            devOverride.stage.global = {};
        }

        devOverride.stage.global.endConditions = {
            killCount: value
        };

        log("Global Kill limit:", value);
    },
    
    // デバッグ補助 --------------------------------------------------
    
    // mapを全表示
    toggleMapAdmin(btn) {
        devOverride.map.showAll = !devOverride.map.showAll;
        window.QUEST_MAP_ADMIN_SHOW_ALL = devOverride.map.showAll;

        btn.textContent = devOverride.map.showAll
            ? "MAP ALL: ON"
            : "MAP ALL: OFF";

        renderQuestMapUI();
    },

    toggleUnlockAllSkills(btn) {
        devOverride.unlockAllSkills = !devOverride.unlockAllSkills;

        if (btn && btn instanceof HTMLElement) {
            btn.textContent = devOverride.unlockAllSkills
                ? "SKILL ALL: ON"
                : "SKILL ALL: OFF";
        }

        // モーダル（スキル・スキルツリー）が開いていれば再描画して即時反映
        const modal = document.getElementById("questModal");
        if (modal) {
            const box = modal.querySelector(".quest-modal-box");
            if (box.classList.contains("quest-modal-skill")) {
                openQuestMenuModal("skill");
            } else if (box.classList.contains("quest-modal-skillTree")) {
                openQuestMenuModal("skillTree");
            }
        }

        log("Skill All toggle:", devOverride.unlockAllSkills);
    },

    logState() {
        log("GAME STATE:", gameState);
    },

    resetEnemyStats() {
        const stats = getPlayerStats();

        stats.enemyMode = {
            totalPlays: 0,
            totalTyped: 0,
            totalMiss: 0,
            totalTypeTime: 0,
            totalPlayTime: 0,
            maxGScore: 0,
            maxGScoreDate: null,
            maxGKpm: 0,
            maxGKpmDate: null,
            avgGKpm: 0,
            avgAccuracy: 0,
            modes: {},
            totalKills: 0
        };

        savePlayerStats(stats);
        log("enemy stats reset");
    },
    
    // ================================
    // DEV APPLY　入力された数値をSetへ渡す
    // ================================

    // level ---------------------------------------------------------

    applyLevel() {
        const v = Number(document.getElementById("levelInput")?.value);
        if (!isNaN(v)) {
            this.setLevel(v, 0.99);
        }
    },

    applyExpMultiplier() {
        const v = Number(document.getElementById("expMultInput")?.value);
        if (!isNaN(v)) {
            this.setExpMultiplier(v);
        }
    },
    
    // parameter --------------------------------------------------------

    applyChain() {
        const input = document.getElementById("chainInput");
        if (!input) return;

        const value = Number(input.value);
        if (isNaN(value)) return;

        this.setChain(value);
        log("Chain set:", value);
    },

    applyChainRate() {
    const v = Number(document.getElementById("chainRateInput")?.value);
    if (!isNaN(v)) this.setChainRate(v);
    },

    applyChainDecayRate() {
        const v = Number(document.getElementById("chainDecayInput")?.value);
        if (!isNaN(v)) this.setChainDecayRate(v);
    },

    applyChainBonus() {
        const v = Number(document.getElementById("chainBonusInput")?.value);
        if (!isNaN(v)) this.setChainBonus(v);
    },

    applyGainOnType() {
        const v = Number(document.getElementById("gainTypeInput")?.value);
        if (!isNaN(v)) this.setGainOnType(v);
    },

    applyGainOnKill() {
        const v = Number(document.getElementById("gainKillInput")?.value);
        if (!isNaN(v)) this.setGainOnKill(v);
    },

    applyMissPenalty() {
        const v = Number(document.getElementById("missPenaltyInput")?.value);
        if (!isNaN(v)) this.setMissPenalty(v);
    },

    applyDecayRate() {
        const v = Number(document.getElementById("decayRateInput")?.value);
        if (!isNaN(v)) this.setDecayRate(v);
    },

    applyKnockbackBonus() {
        const v = Number(document.getElementById("knockbackInput")?.value);
        if (!isNaN(v)) this.setKnockbackBonus(v);
    },

    // stage ------------------------------------------------------------
    applySelectedStage() {
        const select = document.getElementById("devStageSelect");
        if (!select) return;

        this.setStage(select.value);
    },

    applySpawnInterval() {
        const v = Number(document.getElementById("spawnIntervalInput")?.value);
        if (!isNaN(v)) {
            this.setSpawnInterval(v);
        }
    },
    
    applyMaxAlive() {
        const v = Number(document.getElementById("maxAliveInput")?.value);
        if (!isNaN(v)) this.setMaxAlive(v);
    },

    // =========================
    // リセット系
    // =========================

    // level -----------------------------------------------------------------------

    resetExpMultiplier() {
        devOverride.exp.multiplier = 1;
        log("exp multiplier reset");
    },


    // Parameter ------------------------------------------------------------------

    resetChain() {
        if (gameState.enemyStats) {
            gameState.enemyStats.chainCount = 0;
        }

        const el = document.getElementById("viewChain");
        if (el) el.textContent = "0";

        log("Chain reset");
    },

    resetChainRate() {
        if (devOverride.chain) delete devOverride.chain.chainRate;

        const el = document.getElementById("viewChainRate");
        if (el) el.textContent = "";

        log("Chain rate reset");
    },

    resetChainDecayRate() {
        if (devOverride.chain) delete devOverride.chain.chainDecayRate;

        const el = document.getElementById("viewChainDecayRate");
        if (el) el.textContent = "";

        log("Chain decay reset");
    },

    resetChainBonus() {
        if (devOverride.chain) delete devOverride.chain.chainBonus;

        const el = document.getElementById("viewChainBonus");
        if (el) el.textContent = "";

        log("Chain bonus reset");
    },

    resetGainOnType() {
        if (devOverride.chain) delete devOverride.chain.gainOnType;

        const el = document.getElementById("viewGainOnType");
        if (el) el.textContent = "";

        log("GainOnType reset");
    },

    resetGainOnKill() {
        if (devOverride.chain) delete devOverride.chain.gainOnKill;

        const el = document.getElementById("viewGainOnKill");
        if (el) el.textContent = "";

        log("GainOnKill reset");
    },

    resetMissPenalty() {
        if (devOverride.chain) delete devOverride.chain.missPenalty;

        const el = document.getElementById("viewMissPenalty");
        if (el) el.textContent = "";

        log("MissPenalty reset");
    },

    resetDecayRate() {
        if (devOverride.chain) delete devOverride.chain.decayRate;

        const el = document.getElementById("viewDecayRate");
        if (el) el.textContent = "";

        log("DecayRate reset");
    },

    resetKnockbackBonus() {
        if (devOverride.other) delete devOverride.other.knockbackBonus;

        const el = document.getElementById("viewKnockBackBonus");
        if (el) el.textContent = "";

        log("Knockback reset");
    },

    resetParameterAll() {
        devOverride.other = {};
        devOverride.chain = {};

        [
            "viewChainRate",
            "viewChainDecayRate",
            "viewChainBonus",
            "viewGainOnType",
            "viewGainOnKill",
            "viewMissPenalty",
            "viewDecayRate",
            "viewKnockBackBonus",

        ].forEach(id => this.resetView(id));

        log("ALL parameter reset");
    },
    
    // stage -------------------------------------------------------

    resetStage() {
        delete devOverride.stage.current;

        const el = document.getElementById("currentStageOverride");
        if (el) el.textContent = "Stage: none";

        log("Stage override reset");
    },

    resetSpawnInterval() {
        if (devOverride.stage?.global?.spawn) {
            delete devOverride.stage.global.spawn;
        }

        const el = document.getElementById("viewSpawnInterval");
        if (el) el.textContent = "";

        log("Spawn interval reset");
    },

    resetMaxAlive() {
        if (devOverride.spawn) delete devOverride.spawn.maxAlive;

        const el = document.getElementById("viewMaxAlive");
        if (el) el.textContent = "";

        log("maxAlive reset");
    },

    
    // stage override を丸ごと初期化
    resetStageOverrides() {
        devOverride.stage = {};

        log("All stage overrides reset");
    },
    
    // デバッグ補助 -----------------------------------------------------

    resetAll() {
        localStorage.removeItem("playerStats");

        Object.assign(devOverride, {
            exp: {},
            chain: {},
            stage: {},
            other: {},
            spawn: {},
            map: {
                showAll: false
            },
            unlockAllSkills: false
        });

        location.reload();
    },
    
    // =========================
    // htmlの数値をリセットするのに使う関数
    // =========================
    resetView(id) {
        const el = document.getElementById(id);
        if (el) el.textContent = "";
    },
};



// ==========================================================
// その他デバッグ系関数
// ==========================================================

// ログ
function log(...args) {
    console.log("[DEV]", ...args);
}

// DEVパネル移動可能（ヘッダーのみ）
function enableDevPanelDrag() {
    const panel = document.getElementById("devPanel");
    const header = document.getElementById("devPanelHeader");
    if (!panel || !header) return;

    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    const saved = JSON.parse(localStorage.getItem("devPanelPos") || "null");
    if (saved) {
        panel.style.left = saved.x + "px";
        panel.style.top = saved.y + "px";
    }

    header.addEventListener("mousedown", (e) => {
        dragging = true;
        offsetX = e.clientX - panel.offsetLeft;
        offsetY = e.clientY - panel.offsetTop;
    });

    document.addEventListener("mousemove", (e) => {
        if (!dragging) return;

        panel.style.left = (e.clientX - offsetX) + "px";
        panel.style.top = (e.clientY - offsetY) + "px";
    });

    document.addEventListener("mouseup", () => {
        if (!dragging) return;
        dragging = false;

        localStorage.setItem("devPanelPos", JSON.stringify({
        x: panel.offsetLeft,
        y: panel.offsetTop
        }));
    });
}

// 現在作成しているステージ選択リスト
function initDevStageSelector() {
  const select = document.getElementById("devStageSelect");
  if (!select) return;

  Object.keys(STAGES).forEach(stageId => {
    const option = document.createElement("option");
    option.value = stageId;
    option.textContent = stageId;
    select.appendChild(option);
  });
}

// デフォルト値取得
function getDefaultValue() {
    const chain = ENEMY_MODE_CONFIG.chain;
    const $ = (id) => document.getElementById(id);

    const setDef = (id, value) => {
        const el = $(id);
        if (el) el.textContent = `Def/${value}`;
    };

    setDef("viewDefDecayRate", chain.decayRate);
    setDef("viewDefGainOnKill", chain.gainOnKill);
    setDef("viewDefGainOnType", chain.gainOnType);
    setDef("viewDefMissPenalty", chain.missPenalty);
}


// ==========================================================
// 初期画面ロード
// ==========================================================

// 初期同期
window.QUEST_MAP_ADMIN_SHOW_ALL = devOverride.map.showAll;

// コンソール用公開
window.dev = dev;

//初期化
window.addEventListener("DOMContentLoaded", () => {
  initDevStageSelector();
  enableDevPanelDrag();
  getDefaultValue(); 
});
