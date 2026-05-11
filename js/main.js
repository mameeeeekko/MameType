// main.js
// =====================================================
// タイピングゲーム メインスクリプト
// メニュー遷移・ゲーム開始・設定・記録・プレイヤーステータス管理
// =====================================================

import { showRecordsView } from "./recordsView.js";
import {
  exportAllData,
  importAllData,
  clearPlayerStats,
  clearRecords,
  clearRanking,
  resetQuestData,
  loadQuestSlots,
  saveQuestSlot,
  loadQuestSlot,
  startQuestFromBeginning,
  autoSaveQuest,
  exportQuestData,
  importQuestData
} from "./storage.js";
import * as Game from './gameCore.js';
import { gameState , wasLastGameEnemyMode, getPaused, setPaused, backToMenu } from "./gameCore.js";
import { GameModes } from "./gameModes.js";
import { getPlayerStats } from "./playerStats.js";
import { updateHud } from "./hud.js";
import { handleKey } from './inputCore.js';
import { startEnemyMode, endEnemyMode, handleEnemyKey, restartEnemyMode } from './enemyCore.js';
import { initAudio, playBGM, stopBGM } from "./effectManager.js";
import { DIFFICULTIES, getCurrentDifficulty, setCurrentDifficulty } from "./difficulties.js";
import { renderQuestMapUI, openQuestMenuModal } from "./questMapUI.js";
import { reloadQuestProgress, resetQuestAll } from "./questProgress.js";
import { reloadQuestPlayerStats } from "./questPlayerStats.js";
import { getPlayerName, setPlayerName } from "../online/playerProfile.js";

// ================================
// 🔹DOM参照（グローバル）
// ================================
let menuDiv, startMenuDiv, questMenuDiv, freeStartMenuDiv;
let settingsDiv, gameDiv, resultDiv, recordsDiv;
let questMapScreen, questSaveMenuDiv, skillTreeDiv;
let hintDiv

let startMenuBtn, questMenuBtn, freeModeBtn, recordsMenuBtn;
let startMenuBackBtn, freeStartMenuBackBtn, questStartMenuBackBtn;
let saveToQuestMenuBackBtn, questSaveBtn;

let enemyModeBtn, freeEnemyModeBtn, questStartBtn, questStartBtnFromBeginning;
let startBtn, timeAttackBtn, longTextBtn;
let freeStartBtn, freeTimeAttackBtn, freeLongTextBtn;

let backBtn, resultBackBtn, recordsBackBtn;
let gameBackBtn;

let playAgainBtn, retryBtn;
let resultToStartMenuBtn, resultToQuestMenuBtn, resultOpenRecordsBtn;
let questBackBtn;

let settingsBtn, settingsBackBtn;

let bgmToggle, typeSoundToggle, missSoundToggle;
let flashToggle, SEToggle, soundToggle, soundIcon;

let mapBackBtn;

let switchToFreeBtn, switchToNormalBtn;

let resetQuestBtn;

let playerNameInput, savePlayerNameBtn;


function cacheDOM() {
  menuDiv = document.getElementById("menu");
  startMenuDiv = document.getElementById("startMenu");
  questMenuDiv = document.getElementById("questMenu");
  freeStartMenuDiv = document.getElementById("freeStartMenu");
  settingsDiv = document.getElementById("settings");
  gameDiv = document.getElementById("game");
  resultDiv = document.getElementById("result");
  recordsDiv = document.getElementById("records");
  questMapScreen = document.getElementById("questMapScreen");
  questSaveMenuDiv = document.getElementById("saveModal");
  skillTreeDiv = document.getElementById("skillTree");
  hintDiv = document.getElementById("skillUnlockHint");

  startMenuBtn = document.getElementById("startMenuBtn");
  questMenuBtn = document.getElementById("questMenuBtn");
  freeModeBtn = document.getElementById("freeModeBtn");
  recordsMenuBtn = document.getElementById("recordsMenuBtn");
  startMenuBackBtn = document.getElementById("startMenuBackBtn");
  freeStartMenuBackBtn = document.getElementById("freeStartMenuBackBtn");
  questStartMenuBackBtn = document.getElementById("questStartMenuBackBtn");
  saveToQuestMenuBackBtn = document.getElementById("saveToQuestMenuBackBtn");
  questSaveBtn = document.getElementById("questSaveBtn");

  enemyModeBtn = document.getElementById("enemyModeBtn");
  freeEnemyModeBtn = document.getElementById("freeEnemyModeBtn");
  questStartBtn = document.getElementById("questStartBtn");
  questStartBtnFromBeginning = document.getElementById("questStartBtnFromBeginning");
  startBtn = document.getElementById("startBtn");
  timeAttackBtn = document.getElementById("timeAttackBtn");
  longTextBtn = document.getElementById("longTextBtn");
  freeStartBtn = document.getElementById("freeStartBtn");
  freeTimeAttackBtn = document.getElementById("freeTimeAttackBtn");
  freeLongTextBtn = document.getElementById("freeLongTextBtn");

  backBtn = document.getElementById("backBtn");
  resultBackBtn = document.getElementById("resultBackBtn");
  recordsBackBtn = document.getElementById("recordsBackBtn");
  gameBackBtn = document.getElementById("gameBackBtn");

  playAgainBtn = document.getElementById("playAgainBtn");
  retryBtn = document.getElementById("retryMissedBtn");
  resultToStartMenuBtn = document.getElementById("resultToStartMenuBtn");
  resultToQuestMenuBtn = document.getElementById("resultToQuestMenuBtn");
  resultOpenRecordsBtn = document.getElementById("resultOpenRecordsBtn");
  questBackBtn = document.getElementById("questBackBtn");

  settingsBtn = document.getElementById("settingsBtn");
  settingsBackBtn = document.getElementById("settingsBackBtn");

  bgmToggle = document.getElementById("bgmToggle");
  typeSoundToggle = document.getElementById("typeSoundToggle");
  missSoundToggle = document.getElementById("missSoundToggle");
  flashToggle = document.getElementById("flashToggle");
  SEToggle = document.getElementById("SEToggle");
  soundToggle = document.getElementById("soundToggle");
  soundIcon = document.getElementById("soundIcon");

  mapBackBtn = document.getElementById("mapBackBtn");

  switchToFreeBtn = document.getElementById("switchToFreeBtn");
  switchToNormalBtn = document.getElementById("switchToNormalBtn");

  resetQuestBtn = document.getElementById("resetQuestBtn");

  playerNameInput = document.getElementById("playerNameInput");
  savePlayerNameBtn = document.getElementById("savePlayerNameBtn");
}

// =====================================================
// 起動時にウォームアップ処理
// =====================================================
window.addEventListener("load", async () => {
  await warmup();   // ← ここで全部やる
  hideLoading();
});

// ★ ウォームアップ本体==========
export async function warmup() {
  // フォント・DOMウォームアップ
  setLoadingText("描画準備中...");
  document.body.offsetHeight; // 強制レイアウト
  setLoadingText("準備完了！");
}

// ローディング表示テキスト変更========
function setLoadingText(text) {
  const el = document.querySelector(".loading-text");
  if (el) el.textContent = text;
}

// ローディング非表示================
function hideLoading() {
  const el = document.getElementById("loadingScreen");
  if (el) el.style.display = "none";
}

// =====================================================
// ★ Audioを最初のユーザー操作で解放する
// =====================================================
let audioUnlocked = false;

// ★あらゆる入力で発火
["click", "keydown", "touchstart", "mousemove", "scroll"].forEach(e => {
  document.addEventListener(e, unlockAudio, { once: true });
});

function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;

  console.log("🔊 Audio unlocked");

  initAudio().then(() => {
    // デコードも済ませる
    playBGM("bgm_normal1", 0);
    stopBGM();
  });
}
// ページ読み込み時に HUD を更新
updateHud();

// =====================================================
// DOM 取得・初期化
// =====================================================
document.addEventListener("DOMContentLoaded", () => {

  cacheDOM();
  initDifficultyButtons()

  // ゲーム画面描画準備
  Game.initRenderer();

  bindMenuEvents();
  bindGameMenuEvents();
  bindModeSwitchEvents();
  bindModeStartEvents();
  bindResultEvents();
  bindMenuBackEvents();

  bindKeyEvents();

  initSettingsUI();
  initHudControls(); 

  loadSettings();
  // 初期表示はメインメニュー
  showMainMenu();

  // =====================================================
  // プレイヤーネーム処理
  // =====================================================

  playerNameInput.value = getPlayerName();

  savePlayerNameBtn.addEventListener("click", () => {
    const name = playerNameInput.value.trim();

    if (!name) return;

    setPlayerName(name);
    alert("保存しました");
  });

  // -----------------------------
  // プレイヤー統計 / ゲーム記録 ボタン
  // -----------------------------
  const statsButtons = {
    export: document.getElementById("exportPlayerStatsBtn"),
    import: document.getElementById("importPlayerStatsBtn"),
    reset:  document.getElementById("resetPlayerStatsBtn"),
    importFile: document.getElementById("importPlayerStatsFile")
  };

  const exportQuestBtn = document.getElementById("exportQuestBtn");
  const importQuestBtn = document.getElementById("importQuestBtn");
  const importQuestFile = document.getElementById("importQuestFile");
  // =====================================================
  // デイリーデータ処理
  // （プレイヤーステータス + 記録 + ランキング）
  // =====================================================
  statsButtons.export?.addEventListener("click", () => {
    exportAllData(getPlayerStats());
    alert("デイリーデータ全体をバックアップします。保存先を選択してください。");
  });

  statsButtons.import?.addEventListener("click", () => {
    statsButtons.importFile.value = "";
    statsButtons.importFile.click();
  });

  statsButtons.importFile?.addEventListener("change", async () => {
    const file = statsButtons.importFile.files[0];
    if (!file) return;

    try {
      await importAllData(file);
      alert("デイリーデータ全体を復元しました。\nページを再読み込みします。");
      location.reload();
    } catch (e) {
      alert("復元に失敗しました: " + e.message);
    }
  });

  statsButtons.reset?.addEventListener("click", () => {
    if (!confirm(
      "デイリーデータを本当にリセットしますか？\n" +
      "プレイヤーステータス・記録・ランキングが全て削除されます。"
    )) return;

    clearPlayerStats();
    clearRecords();
    clearRanking();

    alert("デイリーデータをリセットしました。\nページを再読み込みします。");
    location.reload();
  });



  // =====================================================
  // クエストデータ処理
  // =====================================================
  exportQuestBtn?.addEventListener("click", () => {
    exportQuestData();
  });

  importQuestBtn?.addEventListener("click", () => {
    importQuestFile.click();
  });

  importQuestFile?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await importQuestData(file);
      alert("クエストデータを復元しました");

      // 必要ならHUD更新
      reloadQuestPlayerStats?.();
      updateHud?.(null, { isQuestMode: true });

    } catch (err) {
      alert(err.message);
    }

    e.target.value = "";
  });

  resetQuestBtn?.addEventListener("click", () => {
    if (!confirm("クエストモードを初期化します。セーブデータ等が全て消えますがよろしいですか？")) return;
    resetQuestData();
    alert("クエストモードのデータをリセットしました。\nページを再読み込みします。");
    location.reload();
  });

});

// ================================
// 🔹クエストスロットUI描画
// ================================
function renderQuestSlots() {

  const container = document.getElementById("questSlots");
  container.innerHTML = "";

  const slots = loadQuestSlots();
  const SLOT_COUNT = 3;

  // 秒 → hh:mm:ss
  function formatPlayTime(sec = 0) {

    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);

    return [
      h.toString().padStart(2, "0"),
      m.toString().padStart(2, "0"),
      s.toString().padStart(2, "0"),
    ].join(":");
  }

  for (let i = 0; i < SLOT_COUNT; i++) {

    const slot = slots[i];

    const div = document.createElement("div");
    div.className = "quest-slot-card";

    // =========================
    // セーブあり
    // =========================
    if (slot && slot.summary) {

      const s = slot.summary;

      const date = new Date(slot.savedAt).toLocaleString();

      div.innerHTML = `
        <div class="slot-header">
          <span>スロット ${i + 1}</span>
          <span class="slot-date">${date}</span>
        </div>

        <div class="slot-body">

          <div class="slot-row">
            Lv：${s.level}
            　HP：${s.hp}
            　DEF：${s.def}
          </div>

          <div class="slot-row">
            進行：${s.stage}
          </div>

          <div class="slot-row">
            クリア数：${s.cleared}
          </div>

          <div class="slot-row">
            ★：${s.currentStars ?? 0} / ${s.maxStars ?? 0}
          </div>

          <div class="slot-row">
            プレイ時間：${formatPlayTime(s.playTime)}
          </div>

        </div>

        <div class="slot-actions">
          <button class="load">▶ ロード</button>
          <button class="save">💾 セーブ</button>
        </div>
      `;

    } else {

      // =========================
      // 空スロット
      // =========================
      div.innerHTML = `
        <div class="slot-empty">
          スロット ${i + 1}<br>
          （空）
        </div>

        <div class="slot-actions">
          <button class="save">💾 セーブ</button>
        </div>
      `;
    }

    // =========================
    // セーブ
    // =========================
    div.querySelector(".save")?.addEventListener("click", () => {

      if (!confirm("上書き保存しますか？")) return;

      saveQuestSlot(i);
      renderQuestSlots();
    });

    // =========================
    // ロード
    // =========================
    div.querySelector(".load")?.addEventListener("click", () => {

      if (!loadQuestSlot(i)) {
        alert("データがありません");
        return;
      }

      reloadQuestProgress();
      reloadQuestPlayerStats();

      updateHud(null, { isQuestMode: true });

      autoSaveQuest();

      showQuestMap();

      questSaveMenuDiv.classList.add("hidden");
    });

    container.appendChild(div);
  }
}

// =====================================================
// 難易度セレクト初期化
// =====================================================
function initDifficultyButtons() {
  const difficultyButtons = document.getElementById("difficultyButtons");

  // 初期状態取得
  let current = getCurrentDifficulty();

  for (const d of Object.values(DIFFICULTIES)) {
    const btn = document.createElement("button");
    btn.className = "diff-btn";
    btn.textContent = d.name;
    btn.dataset.diff = d.id;

    // ★現在難易度を反映
    if (d.id === current.id) {
      btn.classList.add("active");
    }

    btn.addEventListener("click", () => {
      // UI更新
      difficultyButtons
        .querySelectorAll(".diff-btn")
        .forEach(b => b.classList.remove("active"));

      btn.classList.add("active");
      // ★ここが最重要
      setCurrentDifficulty(d.id);
  
    });

    difficultyButtons.appendChild(btn);
  }
}

// =====================================================
// 設定UI
// =====================================================
function initSettingsUI() {

  settingsBtn?.addEventListener("click", () => {
    hideAllScreens();
    if (settingsDiv) settingsDiv.style.display = "block";
    applySoundSettingsToUI();
  });

  settingsBackBtn?.addEventListener("click", showMainMenu);

  [
    [bgmToggle, 'bgm'],
    [typeSoundToggle, 'type'],
    [missSoundToggle, 'miss'],
    [flashToggle, 'flash'],
    [SEToggle, 'soundeffect']
  ].forEach(([el, key]) => {
    el?.addEventListener("change", e => {
      Game.setSoundSetting(key, e.target.checked);
      saveSettings();
    });
  });

  if (soundToggle && soundIcon) {
    soundToggle.addEventListener("change", () => {
      Game.setSoundEnabled(soundToggle.checked);
      soundIcon.src = soundToggle.checked ? "./assets/pic/sound1.png" : "./assets/pic/soundmute.png";
      saveSettings();
    });
  }
}

// =====================================================
// 画面表示制御ユーティリティ
// =====================================================
export function hideAllScreens() {
  [menuDiv, questMenuDiv, startMenuDiv, freeStartMenuDiv, settingsDiv, gameDiv, resultDiv, recordsDiv, questMapScreen, skillTreeDiv]
    .forEach(div => { if (div) div.style.display = "none"; });
}

function showMainMenu() { hideAllScreens(); if (menuDiv) menuDiv.style.display = "block"; }
function showQuestMenu() {
  hideAllScreens();
  if (questMenuDiv) questMenuDiv.style.display = "block";

  renderQuestSlots(); // ★これ追加
}
function showStartMenu() { hideAllScreens(); if (startMenuDiv) startMenuDiv.style.display = "block"; }
function showFreeStartMenu() { hideAllScreens(); if (freeStartMenuDiv) freeStartMenuDiv.style.display = "block"; }

export function showQuestMap() {
  hideAllScreens();
  reloadQuestProgress();
  
  questMapScreen.style.display = "block";
  renderQuestMapUI();
}

export function showGameScreen() {
  hideAllScreens();
  gameDiv.style.display = "block";
}

// ================================
// 🔹イベントバインディングまとめ
// ================================

function bindMenuEvents() {

  questMenuBtn?.addEventListener("click", () => {
    updateHud(null, { isQuestMode: true });
    showQuestMenu();
  });

  startMenuBtn?.addEventListener("click", showStartMenu);
  freeModeBtn?.addEventListener("click", showFreeStartMenu);

  recordsMenuBtn?.addEventListener("click", () => {
    hideAllScreens();
    showRecordsView(Game.getLastGameMode?.() ?? GameModes.NORMAL);
  });

  startMenuBackBtn?.addEventListener("click", showMainMenu);
  freeStartMenuBackBtn?.addEventListener("click", showMainMenu);

  questStartMenuBackBtn?.addEventListener("click", () => {
    updateHud(null, { isQuestMode: false });
    showMainMenu();
  });

  questSaveBtn?.addEventListener("click", () => {
    questSaveMenuDiv.classList.remove("hidden");
    renderQuestSlots();
  });

  saveToQuestMenuBackBtn?.addEventListener("click", () => {
    questSaveMenuDiv.classList.add("hidden");
  });
}

function bindGameMenuEvents() {

  gameBackBtn?.addEventListener("click", () => {
    if (!Game.isGameActive) return;

    // ★ スキルモード
    if (gameState.currentChallenge?.isSkillMode) {
      if (!confirm("スキルチャレンジを中断しますか？")) return;

      backToMenu();
      if (hintDiv) hintDiv.style.display = "none";
      showQuestMap();
      openQuestMenuModal("skillTree");
      gameState.currentChallenge.isSkillMode = false;
      return;
    }

    // ★ 通常
    if (!confirm("ゲームを中断してメニューに戻りますか？")) return;

    Game.backToMenu();
    if (Game.wasLastGameFree()) showFreeStartMenu();
    else showStartMenu();
  });

  mapBackBtn?.addEventListener("click", () => {
    showQuestMenu();
  });
}

function bindModeSwitchEvents() {

  switchToFreeBtn?.addEventListener("click", () => {
    startMenuDiv.style.display = "none";
    freeStartMenuDiv.style.display = "block";
  });

  switchToNormalBtn?.addEventListener("click", () => {
    freeStartMenuDiv.style.display = "none";
    startMenuDiv.style.display = "block";
  });
}

function bindModeStartEvents() {

  questStartBtn?.addEventListener("click", () => {
    showQuestMap();
  });
  
  questStartBtnFromBeginning?.addEventListener("click", () => {
   //データがない場合は警告を出さないようにするため
   const auto = JSON.parse(localStorage.getItem("quest_auto_save"));
   const hasSave =
      auto &&
      auto.progress &&
      auto.progress.cleared &&
      auto.progress.cleared.length > 0; 

    if (hasSave) {
      const ok = confirm(
        "⚠️ オートセーブデータが削除されます。\nこの操作は元に戻せません。\n本当に最初から開始しますか？"
      );
      if (!ok) return;
    }

    startQuestFromBeginning();
    resetQuestAll();
    reloadQuestPlayerStats();
    updateHud(null, { isQuestMode: true });
    showQuestMap();
  });

  enemyModeBtn?.addEventListener("click", () => {
    hideAllScreens();
    startEnemyMode({
      mode: GameModes.ENEMY_MODE,
      isFreeMode: false,
      difficulty: "normal",
      stage: "DAILY"
    });
  });

  freeEnemyModeBtn?.addEventListener("click", () => {
    hideAllScreens();
    startEnemyMode({
      mode: GameModes.ENEMY_MODE,
      isFreeMode: true,
      difficulty: getCurrentDifficulty().id,
      stage: "STAGE2"
    });
  });

  startBtn?.addEventListener("click", () => {
    hideAllScreens();
    Game.doCountdown({ mode: GameModes.NORMAL, isFreeMode: false, difficulty: "normal" });
  });

  timeAttackBtn?.addEventListener("click", () => {
    hideAllScreens();
    Game.doCountdown({ mode: GameModes.TIME_ATTACK, isFreeMode: false, difficulty: "normal" });
  });

  longTextBtn?.addEventListener("click", () => {
    hideAllScreens();
    Game.doCountdown({ mode: GameModes.LONG_TEXT, isFreeMode: false, difficulty: null });
  });

  freeStartBtn?.addEventListener("click", () => {
    hideAllScreens();
    Game.doCountdown({
      mode: GameModes.NORMAL,
      isFreeMode: true,
      difficulty: getCurrentDifficulty().id
    });
  });

  freeTimeAttackBtn?.addEventListener("click", () => {
    hideAllScreens();
    Game.doCountdown({
      mode: GameModes.TIME_ATTACK,
      isFreeMode: true,
      difficulty: getCurrentDifficulty().id
    });
  });

  freeLongTextBtn?.addEventListener("click", () => {
    hideAllScreens();
    Game.doCountdown({ mode: GameModes.LONG_TEXT, isFreeMode: true, difficulty: null });
  });
}

function bindResultEvents() {

  playAgainBtn?.addEventListener("click", () => {
    const modal = document.querySelector(".game-modal");
    if (modal) modal.style.display = "none";
    if (resultDiv) resultDiv.style.display = "none";

    if (wasLastGameEnemyMode()) {
      restartEnemyMode();
    } else {
      Game.restartLastGame();
    }
  });

  retryBtn?.addEventListener("click", () => {
    if (resultDiv) resultDiv.style.display = "none";
    Game.retryMissed();
    retryBtn.style.display = "none";
  });

  resultToStartMenuBtn?.addEventListener("click", () => {
    Game.fullResetGame(); 
    Game.backToMenu();
    if (Game.wasLastGameFree()) showFreeStartMenu();
    else showStartMenu();
  });

  resultToQuestMenuBtn?.addEventListener("click", () => {
   //if (gameState.enemyMode) endEnemyMode();
    Game.fullResetGame();
    gameState.typed = "";
    const modal = document.querySelector(".game-modal");
    if (modal) modal.style.display = "none";
    showQuestMenu();
  });

  questBackBtn?.addEventListener("click", () => {
    //if (gameState.enemyMode) endEnemyMode();
    Game.fullResetGame();
    gameState.typed = "";
    const modal = document.querySelector(".game-modal");
    if (modal) modal.style.display = "none";
    showQuestMap();
  });

  resultOpenRecordsBtn?.addEventListener("click", () => {
    Game.fullResetGame();
    Game.backToMenu();
    hideAllScreens();
    showRecordsView(Game.getLastGameMode?.() ?? GameModes.NORMAL);
  });
}

function bindMenuBackEvents() {

  backBtn?.addEventListener("click", () => {
    Game.backToMenu();
    showMainMenu();
  });

  resultBackBtn?.addEventListener("click", () => {
    Game.backToMenu();
    updateHud(null, { isQuestMode: false });
    showMainMenu();
  });

  recordsBackBtn?.addEventListener("click", showMainMenu);
}

//クエストサイドメニューの戻るボタン用
export function backToQuestMenu() {
  showQuestMenu();
}

export function backToQuestMap() {
  showQuestMap();
}

// ================================
// 🔹キー入力制御（状態別ルーター）
// ================================

function bindKeyEvents() {
  document.addEventListener("keydown", (e) => {
    const key = e.key.toLowerCase();

    if (handleResultKey(key, e)) return;
    if (handlePauseKey(key)) return;
    if (handleGameKey(e, key)) return;
    if (handleMenuKey(key, e)) return;
  });
}

function handleResultKey(key, e) {
  if (resultDiv.style.display === "none") return false;

  switch (key) {
    case "a":
    case "enter":
    case " ":
      playAgainBtn?.click();
      break;
    case "m":
      if (gameState.currentQuestNode || gameState.currentChallenge?.isSkillMode) {
        break;
      } else {
      retryBtn?.click();
      }
      break;
    case "s":
      if (gameState.currentQuestNode || gameState.currentChallenge?.isSkillMode) {
        break;
      } else {
        resultToStartMenuBtn?.click();
      }  
      break;
    case "b":
      if (gameState.currentQuestNode || gameState.currentChallenge?.isSkillMode) {
        questBackBtn?.click();
      } else {
        resultBackBtn?.click();
      }
      break;
    case "r":
      if (gameState.currentQuestNode || gameState.currentChallenge?.isSkillMode) {
        break;
      } else {
      resultOpenRecordsBtn?.click();
      }
      break;
  }

  e.preventDefault();
  return true;
}

function handlePauseKey(key) {
  if (!getPaused()) return false;

  switch (key) {
    case "enter":
    case "p":
      setPaused(false);
      document.querySelector(".pause-overlay").style.display = "none";
      break;

    case "r":
      setPaused(false);
      document.querySelector(".pause-overlay").style.display = "none";
  
      if (gameState.enemyMode) restartEnemyMode();
      else Game.restartLastGame();
      break;

    case "b":
      setPaused(false);
      document.querySelector(".pause-overlay").style.display = "none";

      // ★ スキルモード中断
      if (gameState.currentChallenge?.isSkillMode) {

        backToMenu();
        if (hintDiv) hintDiv.style.display = "none";
        showQuestMap();
        openQuestMenuModal("skillTree");
        gameState.currentChallenge.isSkillMode = false;

        return true;
      }

      // ★ クエストモード
      if (gameState.currentQuestNode) {
        if (skillTreeDiv) skillTreeDiv.style.display = "none";
        endEnemyMode();
        gameState.typed = "";
        Game.fullResetGame();
        showQuestMap();
        return true;
      }

      if (gameState.enemyMode) {
        endEnemyMode();
        gameState.typed = "";
        Game.fullResetGame();
      }  

      // ★ 通常モード
      Game.backToMenu();
      if (Game.wasLastGameFree()) showFreeStartMenu();
      else showStartMenu();

      break;

  }

  return true;
}

function handleGameKey(e, key) {
  if (!Game.isGameActive) return false;

  if (getPaused()) return true;

  // ポーズトグル
  if (key === "enter") {
    e.preventDefault();
    const paused = Game.togglePause();
    const overlay = document.querySelector(".pause-overlay");
    if (overlay) overlay.style.display = paused ? "flex" : "none";
    return true;
  }

  // ESC終了
  if (key === "escape") {
    e.preventDefault();

      // ★① スキルモード（最優先）
    if (gameState.currentChallenge?.isSkillMode) {
      backToMenu();
      if (hintDiv) hintDiv.style.display = "none";
      showQuestMap();
      openQuestMenuModal("skillTree");
      gameState.currentChallenge.isSkillMode = false;
      return true;
    }

    // ★② クエスト中
    if (gameState.currentQuestNode) {
      gameState.enemyStats.failed = true;
      endEnemyMode();
      Game.fullResetGame();
      gameState.typed = "";
      if (skillTreeDiv) skillTreeDiv.style.display = "none";
      showQuestMap();
      return true;
    }

    // ★③ エネミーモード
    if (gameState.enemyMode) {
      gameState.enemyStats.failed = true;
      endEnemyMode();
      Game.fullResetGame();
      gameState.typed = "";
      return true;
    }

    // ★④ 通常
    Game.backToMenu();
    if (Game.wasLastGameFree()) showFreeStartMenu();
    else showStartMenu();
    return true;
  }

  // 入力処理
  if (gameState.enemyMode) {
    if (e.key === "Tab") e.preventDefault();
    handleEnemyKey(key);
  } else {
    handleKey(e.key);
  }

  return true;
}

function handleMenuKey(key, e) {

  if (settingsDiv.style.display !== "none") {
    if (key === "b" || key === "escape") {
      e.preventDefault();
      settingsBackBtn?.click();
    }
    return true;
  }

  if (recordsDiv.style.display !== "none") {
    if (key === "b" || key === "escape") {
      e.preventDefault();
      recordsBackBtn?.click();
    }
    return true;
  }

  if (menuDiv.style.display !== "none") {
    switch (key) {
      case "h": startMenuBtn?.click(); break;
      case "f": freeModeBtn?.click(); break;
      case "r": recordsMenuBtn?.click(); break;
      case "s": settingsBtn?.click(); break;
    }
    return true;
  }

  if (startMenuDiv.style.display !== "none") {
    switch (key) {
      case "k": startBtn?.click(); break;
      case "t": timeAttackBtn?.click(); break;
      case "l": longTextBtn?.click(); break;
      case "b": startMenuBackBtn?.click(); break;
      case "f": switchToFreeBtn?.click(); break;
    }
    return true;
  }

  if (freeStartMenuDiv.style.display !== "none") {
    switch (key) {
      case "k": freeStartBtn?.click(); break;
      case "t": freeTimeAttackBtn?.click(); break;
      case "l": freeLongTextBtn?.click(); break;
      case "b": freeStartMenuBackBtn?.click(); break;
      case "n": switchToNormalBtn?.click(); break;
    }
    return true;
  }

  // セーブモーダル閉じる
  const modal = questSaveMenuDiv;
  if (modal && !modal.classList.contains("hidden")) {
    if (key === "b") {
      modal.classList.add("hidden");
      return true;
    }
  }

    return false;
  }

// =====================================================
// 設定（サウンド）
// =====================================================
function applySoundSettingsToUI() {
  const current = Game.getSoundSettings();
  if (bgmToggle) bgmToggle.checked = current.bgm;
  if (typeSoundToggle) typeSoundToggle.checked = current.type;
  if (missSoundToggle) missSoundToggle.checked = current.miss;
  if (flashToggle) flashToggle.checked = current.flash;
  if (SEToggle) SEToggle.checked = current.soundeffect;
  if (soundToggle && soundIcon) {
    soundToggle.checked = Game.getSoundEnabled();
    soundIcon.src = Game.getSoundEnabled() ? "./assets/pic/sound1.png" : "./assets/pic/soundmute.png";
  }
}

function saveSettings() {
  localStorage.setItem("typing_game_settings", JSON.stringify({
    soundEnabled: Game.getSoundEnabled(),
    soundSettings: Game.getSoundSettings()
  }));
}

function loadSettings() {
  const stored = localStorage.getItem("typing_game_settings");
  if (!stored) return;
  try {
    const settings = JSON.parse(stored);
    if (settings.soundEnabled !== undefined) Game.setSoundEnabled(settings.soundEnabled);
    if (settings.soundSettings) {
      Object.entries(settings.soundSettings).forEach(([key, value]) => {
        Game.setSoundSetting(key, value);
      });
    }
    applySoundSettingsToUI();
  } catch (err) {
    console.warn("設定の読み込みに失敗:", err);
  }
}

// =====================================================
// HUDボタン
// =====================================================
function initHudControls() {
  const hud = document.getElementById("playerHud");
  const miniBtn = document.getElementById("hudMiniBtn");

  if (hud && miniBtn) {
    miniBtn.addEventListener("click", () => {
      hud.classList.toggle("compact");
      miniBtn.textContent =
        hud.classList.contains("compact") ? "+" : "−";
    });
  }
}

