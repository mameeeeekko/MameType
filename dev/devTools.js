// devTools.js
import { devOverride } from "./devOverride.js";
import { getPlayerStats, updateAchievements } from "../js/playerStats.js";
import { savePlayerStats } from "../js/storage.js";
import { gameState } from "../js/gameCore.js";
import { forceSetLevel } from "../js/questPlayerStats.js";
import { killEnemy } from "../js/enemyCore.js";
import { updateHud } from "../js/hud.js";
import { STAGES, ENEMY_MODE_CONFIG } from "../js/enemyModeConfig.js";
import { renderQuestMapUI, openQuestMenuModal } from "../js/questMapUI.js";


// =====================================================
// Dev API（ここだけ触れば全部安全）
// =====================================================

// Helper to set nested property
function setNestedProperty(obj, path, value) {
    const parts = path.split('.');
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!current[part] || typeof current[part] !== 'object') current[part] = {};
        current = current[part];
    }
    current[parts[parts.length - 1]] = value;
}
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
        if (!gameState.enemyMode) {
            log("Not in enemy mode.");
            return;
        }

        // 画面上のすべての敵と弾を強制的に撃破
        const targets = [
            ...(gameState.enemies || []),
            ...(gameState.enemyBullets || [])
        ];

        targets.forEach(enemy => {
            if (enemy && !enemy.isDead) {
                killEnemy(enemy, gameState, { fromSkill: true });
            }
        });

        log(`KillAll triggered. ${targets.length} enemies killed.`);
    },

    // 終了条件の敵を殺す数
    setKillLimit(value) {
        if (!gameState.enemyMode) {
            log("Not in enemy mode.");
            return;
        }

        // 画面上の敵を取得（弾は除外）
        const targets = (gameState.enemies || []).filter(
            (enemy) => enemy && !enemy.isDead
        );

        if (targets.length === 0) {
            log("No enemies to kill.");
            return;
        }

        // 倒す数を制限
        const killCount = Math.min(targets.length, value);
        const enemiesToKill = targets.slice(0, killCount);

        enemiesToKill.forEach((enemy) => {
            killEnemy(enemy, gameState, { fromSkill: true });
        });

        log(`${killCount} enemy/enemies killed.`);
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

    toggleInfiniteSkill(btn) {
        devOverride.skill = devOverride.skill || {};
        devOverride.skill.infinite = !devOverride.skill.infinite;

        btn.textContent = devOverride.skill.infinite
            ? "SKILL INF: ON"
            : "SKILL INF: OFF";

        if (devOverride.skill.infinite) {
            log("Infinite skill enabled");
        }
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
    
    // Achievements ----------------------------------------------------

    /**
     * プレイヤー統計の特定の値を設定し、実績を再評価します。
     * 例: dev.setAchievementStat("totalPlays", 100)
     * 例: dev.setAchievementStat("days.streak", 7)
     * 例: dev.setAchievementStat("regular.maxSpeed", 300)
     * // =================================================================
    // 勲章（実績）検証用コマンド一覧
    // 使い方: ブラウザの開発者ツール（F12）のコンソールに貼り付けて実行
    // =================================================================

    // --- 基本操作 ---
    // dev.resetAchievements();                      // 全ての実績をリセット
    // dev.triggerAchievementCheck();                // 現在の統計情報で実績を再評価
    // dev.unlockAchievement("first_play");          // 特定の実績をIDで強制アンロック

    // --- プレイ回数系 ---
    dev.setAchievementStat("totalPlays", 1);          // はじめの一歩 (first_play)
    dev.setAchievementStat("totalPlays", 10);         // 常連 (play_10)
    dev.setAchievementStat("totalPlays", 100);        // 熟練者 (play_100)
    dev.setAchievementStat("totalPlays", 500);        // ベテラン (play_500)
    dev.setAchievementStat("totalPlays", 1000);       // レジェンド (play_1000)

    // --- プレイ時間系 ---
    // ※ totalPlayTimeは複数モードの合計値のため、個別の時間を設定して再評価します
    dev.setAchievementStat("regular.totalGameTime", 36000); // 総プレイ時間10時間 (play_time_10h)
    dev.setAchievementStat("regular.totalGameTime", 180000); // 総プレイ時間50時間 (play_time_50h)
    dev.setAchievementStat("freeMode.totalTime", 3600);     // 自由人 (free_1h)
    dev.setAchievementStat("freeMode.totalTime", 36000);    // 解放者 (free_10h)

    // --- 日数系 ---
    dev.setAchievementStat("days.unique", 7);         // 一週間プレイヤー (days_7)
    dev.setAchievementStat("days.unique", 30);        // 一ヶ月プレイヤー (days_30)
    dev.setAchievementStat("days.streak", 3);         // 三日坊主卒業 (streak_3)
    dev.setAchievementStat("days.streak", 7);         // 連続者 (streak_7)
    dev.setAchievementStat("days.streak", 30);        // 継続の鬼 (streak_30)
    dev.setAchievementStat("days.maxStreak", 14);     // 二週間皆勤 (max_streak_14)

    // --- スキル系 ---
    dev.setAchievementStat("regular.maxSpeed", 300);  // 高速域 (speed_300)
    dev.setAchievementStat("regular.maxSpeed", 400);  // 光速 (kpm_400)
    dev.setAchievementStat("regular.maxSpeed", 500);  // 超光速 (kpm_500)
    dev.setAchievementStat("regular.maxEScore", 750); // 神の領域 (rank_god)
    dev.setAchievementStat("regular.noMissClears", 10); // パーフェクト10 (no_miss_10)

    // --- モード別プレイ回数 ---
    dev.setAchievementStat("regular.modes.proverb", 50); // (play_proverb_50) ※ことわざモードを50回プレイ
    dev.setAchievementStat("regular.modes.english", 50); // (play_english_50) ※英語モードを50回プレイ

    // --- エネミーモード系 ---
    dev.setAchievementStat("enemyMode.totalPlays", 10);         // エネミーハンター (enemy_play_10)
    dev.setAchievementStat("enemyMode.totalKills", 1000);       // 撃墜王 (enemy_kill_1000)
    dev.setAchievementStat("enemyMode.maxGScore", 100000);      // スコアマスター (gscore_100k)
    dev.setAchievementStat("enemyMode.maxChain", 100);          // チェインマスター (max_chain_100)
    dev.setAchievementStat("enemyMode.maxCombo", 200);          // コンボアーティスト (enemy_combo_200)
    dev.setAchievementStat("enemyMode.noDamageClears", 1);      // 鉄壁 (no_damage_clear_enemy)
    dev.setAchievementStat("enemyMode.modes.daily_enemy", 30);  // デイリーチャレンジャー (play_daily_enemy_30)

    // --- クエストモード系 (dev.setAchievementStatでは直接操作不可) ---
    // クエスト関連の統計は別ファイルで管理されているため、
    // dev.setAchievementStatでは値を変更できません。
    // dev.unlockAchievement を使って強制的にアンロックして検証してください。

    dev.unlockAchievement("quest_clear_10");          // 冒険の始まり (クエスト10個クリア)
    dev.unlockAchievement("quest_clear_50");          // ベテラン冒険者 (クエスト50個クリア)
    dev.unlockAchievement("all_quests_clear");        // 世界の救世主 (全クエストクリア)
    dev.unlockAchievement("quest_level_10");          // 成長の証 (Lv10到達)
    dev.unlockAchievement("quest_level_50");          // 熟練の風格 (Lv50到達)
    dev.unlockAchievement("skill_unlock_10");         // スキルコレクター (スキル10個アンロック)
    dev.unlockAchievement("all_skills_unlocked");     // スキルマスター (全スキルアンロック)
    dev.unlockAchievement("total_stars_100");         // 星々の収集家 (合計スター100個)
    dev.unlockAchievement("item_heal_100");           // 回復の恩恵 (回復アイテム100個取得)
    dev.unlockAchievement("active_skill_100_uses");   // スキル活用術 (アクティブスキル100回使用)
    dev.unlockAchievement("clear_world_1");           // フロンティアの開拓者 (ワールド1クリア)
    dev.unlockAchievement("clear_world_2");           // 静寂の探求者 (ワールド2クリア)
     * 
     * @param {string} path - 設定する統計のパス (例: "totalPlays", "days.streak")
     * @param {*} value - 設定する値
     */

    setAchievementStat(path, value) {
        const stats = getPlayerStats();
        setNestedProperty(stats, path, value);
        updateAchievements(stats); // 実績を再評価
        savePlayerStats(stats);    // 変更を保存
        updateHud(stats);          // HUDを更新して表示に反映
        log(`Player stat "${path}" set to ${value}. Achievements re-evaluated.`);
    },

    /**
     * 指定した実績IDを直接アンロックします。
     * @param {string} achievementId - アンロックする実績のID
     */
    unlockAchievement(achievementId) {
        const stats = getPlayerStats();
        if (!stats.achievements.includes(achievementId)) {
            stats.achievements.push(achievementId);
            // seenAchievementsにも追加してNEW表示が出ないようにする
            if (!stats.seenAchievements.includes(achievementId)) {
                stats.seenAchievements.push(achievementId);
            }
            savePlayerStats(stats);
            updateHud(stats);
            log(`Achievement "${achievementId}" unlocked.`);
        } else {
            log(`Achievement "${achievementId}" already unlocked.`);
        }
    },

    /**
     * 全ての実績をクリアします。
     */
    resetAchievements() {
        const stats = getPlayerStats();
        stats.achievements = [];
        stats.seenAchievements = [];
        savePlayerStats(stats);
        updateHud(stats);
        log("All achievements reset.");
    },

    /**
     * 現在のプレイヤー統計に基づいて実績を再評価します。
     * 主に手動でlocalStorageを編集した後などに使用します。
     */
    triggerAchievementCheck() {
        const stats = getPlayerStats();
        updateAchievements(stats);
        savePlayerStats(stats);
        updateHud(stats);
        log("Achievements re-evaluated based on current stats.");
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
