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
  exportQuestData,
  importQuestData
} from "./storage.js";
import * as Game from './gameCore.js';
import { gameState , wasLastGameEnemyMode, getPaused, setPaused, backToMenu } from "./gameCore.js";
import { GameModes } from "./gameModes.js";
import { getPlayerStats } from "./playerStats.js";
import { updateHud, initAchievementsUI } from "./hud.js";
import { handleKey } from './inputCore.js';
import { startEnemyMode, endEnemyMode, handleEnemyKey, restartEnemyMode, showHud } from './enemyCore.js';
import { renderQuestMapUI, openQuestMenuModal, closeQuestModal } from "./questMapUI.js";
import { reloadQuestProgress, resetQuestAll, markTrueEndingSeen, hasSeenTrueEnding } from "./questProgress.js";
import { reloadQuestPlayerStats } from "./questPlayerStats.js";
import { getPlayerId, getPlayerName, setPlayerName, isOnlineEnabled, setOnlineEnabled, setPlayerId } from "../online/playerProfile.js";
import { openOnlineRanking } from "../online/onlineRankingRenderer.js";
import { APP_VERSION } from "./version.js";
import { startDialogue, closeDialogue, isDialogueVisible, setDialogueSpeed } from "./dialogue.js";
import { loadAssets, images } from "./assetsLoader.js";
import { loadKeybinds, saveKeybinds, initKeybinds } from "./keybinds.js";
import { clearQuestStageCache, TIER_TABLES, getTierEnemies } from "./enemyModeConfig.js";
import "../dev/devTools.js";
import {
  DIFFICULTIES,
  getCurrentDifficulty,
  setCurrentDifficulty,
  getDifficultyDescription,
} from "./difficulties.js";
import { playBGM, stopBGM, playSE } from "./effectManager.js";



// ================================
// 🔹DOM参照（グローバル）
// ================================
let bootScreen = null;
let loadingScreen = null;

let menuBackground, menuDiv, startMenuDiv, questMenuDiv, freeStartMenuDiv;
let settingsDiv, gameDiv, resultDiv, recordsDiv;
let questMapScreen, questSaveMenuDiv, skillTreeDiv;
let hintDiv;
let onlineRankingDiv;
let bgmInfoDisplay; // Add this to cacheDOM

let startMenuBtn, questMenuBtn, freeModeBtn, recordsMenuBtn, onlineRankingBtn, endingBtn;
let startMenuBackBtn, freeStartMenuBackBtn, questStartMenuBackBtn;
let saveToQuestMenuBackBtn, questSaveBtn;

let enemyModeBtn, freeEnemyModeBtn, questStartBtn, questStartBtnFromBeginning;
let startBtn, timeAttackBtn, longTextBtn;
let freeStartBtn, freeTimeAttackBtn, freeLongTextBtn;

let backBtn, resultBackBtn, recordsBackBtn, rankingBackBtn;
let gameBackBtn;

let playAgainBtn, retryBtn;
let resultToStartMenuBtn, resultToQuestMenuBtn, resultOpenRecordsBtn;
let questBackBtn;

let settingsBtn, settingsBackBtn;

let bgmToggle, typeSoundToggle, missSoundToggle;
let flashToggle, SEToggle, soundToggle, soundIcon;
let bgmVolSlider, typeVolSlider, missVolSlider, seVolSlider;
let dialogueSpeedSlider;
let resetBgmVolumeBtn, resetSeVolumeBtn, resetTypeVolumeBtn, resetMissVolumeBtn;

let mapBackBtn;

let switchToFreeBtn, switchToNormalBtn;

let resetQuestBtn;

let playerNameInput, savePlayerNameBtn, playerIdDisplay, copyPlayerIdBtn, importPlayerIdBtn;

let onlineRankingToggle;

let unlock, autoLock, pause, activeSkill, saveKeybindBtn;
let playerLvRange;
let enemyIntervalSlider, enemyImmediateToggle;
let currentFreeModeId = 'Standard'; // フリーモードの選択状態を保持する変数
let currentEnemyPattern = 'time'; // エネミーモード内のパターン選択状態

let isStaffRollShowing = false; // スタッフロール表示中フラグ

function cacheDOM() {
  bootScreen = document.getElementById("bootScreen");
  loadingScreen = document.getElementById("loadingScreen");

  menuBackground = document.getElementById("menuBackground");
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
  onlineRankingDiv = document.getElementById("onlineRankingScreen");
  bgmInfoDisplay = document.getElementById("bgmInfoDisplay"); // Cache the new element

  startMenuBtn = document.getElementById("startMenuBtn");
  questMenuBtn = document.getElementById("questMenuBtn");
  freeModeBtn = document.getElementById("freeModeBtn");
  recordsMenuBtn = document.getElementById("recordsMenuBtn");
  onlineRankingBtn = document.getElementById("onlineRankingBtn");
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
  rankingBackBtn = document.getElementById("rankingBackBtn")
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
  bgmVolSlider = document.getElementById("bgmVolSlider");
  typeVolSlider = document.getElementById("typeVolSlider");
  missVolSlider = document.getElementById("missVolSlider");
  seVolSlider = document.getElementById("seVolSlider");
  dialogueSpeedSlider = document.getElementById("dialogueSpeedSlider");

  // 音量リセットボタン
  resetBgmVolumeBtn = document.getElementById("resetBgmVolumeBtn");
  resetSeVolumeBtn = document.getElementById("resetSeVolumeBtn");
  resetTypeVolumeBtn = document.getElementById("resetTypeVolumeBtn");
  resetMissVolumeBtn = document.getElementById("resetMissVolumeBtn");

  mapBackBtn = document.getElementById("mapBackBtn");

  switchToFreeBtn = document.getElementById("switchToFreeBtn");
  switchToNormalBtn = document.getElementById("switchToNormalBtn");

  resetQuestBtn = document.getElementById("resetQuestBtn");

  playerNameInput = document.getElementById("playerNameInput");
  playerIdDisplay = document.getElementById("playerIdDisplay");
  copyPlayerIdBtn = document.getElementById("copyPlayerIdBtn");
  importPlayerIdBtn = document.getElementById("importPlayerIdBtn");

  savePlayerNameBtn = document.getElementById("savePlayerNameBtn");

  onlineRankingToggle = document.getElementById("onlineRankingToggle");

  unlock = document.getElementById("key-unlock");
  autoLock = document.getElementById("key-autolock");
  pause = document.getElementById("key-pause");
  activeSkill = document.getElementById("key-skill");
  saveKeybindBtn = document.getElementById("saveKeybindBtn");

  playerLvRange = document.getElementById("playerLvRange");
  enemyIntervalSlider = document.getElementById("enemyIntervalSlider");
  enemyImmediateToggle = document.getElementById("enemyImmediateToggle");

}

// =====================================================
// 起動時にウォームアップ処理
// =====================================================


// ローディング表示テキスト変更========
function setLoadingText(text) {
  const el = document.querySelector(".loading-text");
  if (el) el.textContent = text;
}

// ローディング非表示================

function showLoadingScreen() {
  hideAllScreens();
  if (bootScreen) bootScreen.style.display = "none";
  if (loadingScreen) loadingScreen.style.display = "flex";
}

function hideLoading() {
  if (loadingScreen) loadingScreen.style.display = "none";
}

function showBootScreen() {
  hideAllScreens();
  if (bootScreen) {
    // 最初の画面ではHUDを非表示にする
    const hud = document.getElementById("playerHud");
    if (hud) hud.style.display = "none";

    bootScreen.style.display = "flex"; // 画面を表示するために必要
    bootScreen.style.cursor = "pointer";
    // インラインスタイルを削除し、CSSでスタイリングするためのクラスを付与
    bootScreen.innerHTML = '<div class="boot-message">Click to Start</div>';
  }
  if (loadingScreen) loadingScreen.style.display = "none";
}

// =====================================================
// 🔊 音量トグル・同期処理
// =====================================================
export function handleGlobalSoundToggle() {
  const enabled = Game.toggleSoundGlobal();
  
  // 設定画面のチェックボックスとアイコンを同期
  if (soundToggle) soundToggle.checked = enabled;
  if (soundIcon) {
    soundIcon.src = enabled ? "./assets/pic/sound1.png" : "./assets/pic/soundmute.png";
  }

  // 全ての音量切り替えテキスト/画像クラスを持つ要素を更新
  updateAllSoundToggleUI(enabled);
  
  // 保存
  saveSettings();
}

function updateAllSoundToggleUI(enabled) {
  const icon = enabled ? "./assets/pic/sound1.png" : "./assets/pic/soundmute.png";
  const text = enabled ? "sound on" : "sound off";
  document.querySelectorAll(".global-sound-toggle-img").forEach(img => img.src = icon);
  document.querySelectorAll(".global-sound-toggle-txt").forEach(span => span.textContent = text);
}

export function showMenuBackground(imageKeyOrVisible) {
  if (!menuBackground) return;
  if (imageKeyOrVisible === false) {
    menuBackground.style.display = "none";
    return;
  }

  const key = typeof imageKeyOrVisible === "string" ? imageKeyOrVisible : "title_menu";
  if (images[key]) {
    menuBackground.style.backgroundImage = `url("${images[key].src}")`;
  }

  // クエストメニューの時だけ、少しだけ黒っぽく（明度をわずかに下げる）調整
  if (key === "quest_menu") {
    menuBackground.style.filter = "brightness(0.8)";
  } else {
    menuBackground.style.filter = "none";
  }

  menuBackground.style.display = "block";
}

// =====================================================
// タイトル画面表示関数
// =====================================================
export function applyTitleMenuBackground() {
  console.log(images.title_menu);
  if (!menuBackground || !images.title_menu) return;

  menuBackground.style.backgroundImage =
    `url("${images.title_menu.src}")`;
}

// =====================================================
// DOM 取得・初期化
// =====================================================
document.addEventListener("DOMContentLoaded", () => {
  cacheDOM();

  // ゲーム中の意図しないテキスト選択（青いハイライト）を防止
  document.addEventListener("selectstart", (e) => {
    if (e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
      e.preventDefault();
    }
  });
  // ダブルクリック等による画面全体の選択を防止
  document.addEventListener("mousedown", (e) => {
    if (e.detail > 1 && e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
      e.preventDefault();
    }
  });

  if (checkMobile()) return; // モバイルなら初期化を中断

  showBootScreen();

  if (bootScreen) {
    const startInitialLoad = async () => {
      if (bootScreen.style.display === "none") return;

      showLoadingScreen();
      document.removeEventListener("keydown", handleBootKey);

      await loadAssets((loaded, total) => {
        const percent = Math.floor((loaded / total) * 100);
        setLoadingText(`Loading... ${percent}%`);
      });

      applyTitleMenuBackground();
      
      // 100%の状態を少し見せてから遷移
      setLoadingText("Loading... 100%");
      await new Promise(r => setTimeout(r, 500));

      hideLoading();
      // メインメニューを表示
      showMainMenu();
    };

    const handleBootKey = (e) => {
      if (e.code === "Enter" || e.code === "Space") {
        startInitialLoad();
      }
    };

    bootScreen.addEventListener("click", startInitialLoad);
    document.addEventListener("keydown", handleBootKey);
  }

  document.getElementById("versionLabel").textContent = `v${APP_VERSION}`;

  bindModeStartEvents();
  bindResultEvents();
  bindMenuBackEvents();
  // ★設定を読み込む（UI描画より先に）
  loadSettings();
  loadFreeModeConfig();

  // ★UI初期化
  createDifficultySelector(
    "standardDifficultyButtons",
    "standardDifficultyInfo",
    "free-standard",
    "standard"
  );

  createDifficultySelector(
    "timeAttackDifficultyButtons",
    "timeAttackDifficultyInfo",
    "free-timeattack",
    "timeattack"
  );

  createDifficultySelector(
    "enemyDifficultyButtons",
    "enemyDifficultyInfo",
    "free-enemy",
    "enemy"
  );

  initKeybinds(); // キーバインドUI初期化
  initAchievementsUI(); // 実績UI初期化
  Game.initRenderer(); // ゲーム画面描画準備

  // ★UIイベント紐付け
  bindMenuEvents();
  bindModeStartEvents();
  bindResultEvents();
  bindGameMenuEvents();
  bindModeSwitchEvents();
  initFreeModeConfigUI();
  bindKeyEvents();
  initSettingsUI();
  initHudControls(); 

  // =====================================================
  // プレイヤーネーム処理
  // =====================================================

  playerNameInput.value = getPlayerName();

  onlineRankingToggle.checked = isOnlineEnabled();

  playerNameInput.disabled = !isOnlineEnabled();
  savePlayerNameBtn.disabled = !isOnlineEnabled();

  onlineRankingToggle.addEventListener("change", () => {
    const enabled = onlineRankingToggle.checked;

    setOnlineEnabled(enabled);

    playerNameInput.disabled = !enabled;
    savePlayerNameBtn.disabled = !enabled;
  });

  savePlayerNameBtn.addEventListener("click", () => {
    const name = playerNameInput.value.trim();

    if (!name) {
      alert("名前を入力してください");
      return;
    }

    setPlayerName(name);
    alert("保存しました");
  });

  // Player IDのコピー
  copyPlayerIdBtn?.addEventListener("click", () => {
    const playerId = getPlayerId();
    if (playerId) {
      navigator.clipboard.writeText(playerId).then(() => {
        alert("Player IDをクリップボードにコピーしました。");
      }).catch(err => {
        alert("コピーに失敗しました。");
        console.error('Failed to copy Player ID: ', err);
      });
    }
  });

  // Player IDのインポート
  importPlayerIdBtn?.addEventListener("click", () => {
    const newPlayerId = prompt("バックアップしたPlayer IDをここに貼り付けてください。");
    if (newPlayerId && newPlayerId.trim() !== "") {
      if (confirm(`Player IDを「${newPlayerId.trim()}」に変更しますか？\nこの操作は元に戻せません。`)) {
        setPlayerId(newPlayerId.trim());
        // UIを更新
        if (playerIdDisplay) playerIdDisplay.textContent = newPlayerId.trim();
        alert("Player IDを更新しました。");
      }
    } else if (newPlayerId !== null) { // キャンセルではなく空文字が入力された場合
      alert("Player IDが入力されていません。");
    }
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
    clearQuestStageCache();
    alert("クエストモードのデータをリセットしました。\nページを再読み込みします。");
    location.reload();
  });

});

// =====================================================
// Service Worker 更新通知処理
// =====================================================
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js').then(registration => {
    console.log('Service Worker registered with scope:', registration.scope);

    // 更新が見つかった場合
    registration.onupdatefound = () => {
      const installingWorker = registration.installing;
      if (installingWorker) {
        installingWorker.onstatechange = () => {
          // 新しいワーカーがインストールされ、待機状態になった
          if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('New content is available and will be used when all tabs for this scope are closed. Or click update button.');
            showUpdateNotification(registration);
          }
        };
      }
    };
  }).catch(error => {
    console.error('Service Worker registration failed:', error);
  });
}

function showUpdateNotification(registration) {
  const notification = document.getElementById('update-notification');
  const updateButton = document.getElementById('update-now-btn');

  if (!notification || !updateButton) return;

  notification.style.display = 'flex';
  setTimeout(() => notification.classList.add('show'), 10);

  updateButton.onclick = () => {
    registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  };
}

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
          <span>SLOT ${i + 1}</span>
          <span class="slot-date">${date}</span>
        </div>

        <div class="slot-body">
          <div class="save-slot-row">Lv：${s.level}　HP：${s.hp}　DEF：${s.def}</div>
          <div class="save-slot-row">進行：${s.stage}</div>
          <div class="save-slot-row">CLEAR：${s.cleared}</div>
          <div class="save-slot-row">★：${s.currentStars ?? 0} / ${s.maxStars ?? 0}</div>
          <div class="save-slot-row">PLAYTIME：${formatPlayTime(s.playTime)}</div>
        </div>

        <div class="slot-actions">
          <button class="load">LOAD</button>
          <button class="save">SAVE</button>
        </div>
      `;

    } else {

      // =========================
      // 空スロット
      // =========================
      div.innerHTML = `
        <div class="slot-header">
          <span>SLOT ${i + 1}</span>
        </div>

        <div class="slot-empty">
          EMPTY
        </div>

        <div class="slot-actions">
          <button class="save">SAVE</button>
        </div>
      `;
    }

    // =========================
    // セーブ
    // =========================
    div.querySelector(".save")?.addEventListener("click", () => {

      if (!confirm(
        `現在のデータを SLOT ${i + 1} にセーブしますか？\n`
      )) return;

      saveQuestSlot(i);
      renderQuestSlots();
    });

    // =========================
    // ロード
    // =========================
    div.querySelector(".load")?.addEventListener("click", () => {

      if (!confirm(
        `SLOT ${i + 1} のデータをロードしますか？\n` +
        "現在の進行状況はロードしたデータで上書きされます。"
      )) return;

      if (!loadQuestSlot(i)) {
        alert("データがありません");
        return;
      }

      reloadQuestProgress();
      reloadQuestPlayerStats();
      updateHud(null, { isQuestMode: true });

      // ★ロード後はマップではなく、一度クエストメニューを表示する
      // これにより、更新されたオートセーブを元にContinueボタンが正しく表示される
      showQuestMenu();
      questSaveMenuDiv.classList.add("hidden");
    });

    container.appendChild(div);
  }
}

// =====================================================
// 難易度セレクト初期化
// =====================================================
function createDifficultySelector(
  buttonContainerId,
  infoContainerId,
  scope,
  mode
) {
  const container =
    document.getElementById(buttonContainerId);

  const info =
    document.getElementById(infoContainerId);

  container.innerHTML = "";

  // ← 追加
  container.classList.add("pattern-selector");

  let current = getCurrentDifficulty(scope);

  function updateInfo(diff) {
    info.textContent =
      getDifficultyDescription(diff, mode);
  }

  for (const d of Object.values(DIFFICULTIES)) {

    const btn = document.createElement("button");

    // diff-btn → pattern-btn
    btn.className = "pattern-btn";
    btn.textContent = d.name;

    if (d.id === current.id) {
      btn.classList.add("active");
    }

    btn.addEventListener("click", () => {

      container
        .querySelectorAll(".pattern-btn")
        .forEach(b => b.classList.remove("active"));

      btn.classList.add("active");

      setCurrentDifficulty(d.id, scope);

      updateInfo(d);

      // 難易度変更を保存
      saveFreeModeConfig();
    });

    container.appendChild(btn);
  }

  updateInfo(current);
}

// =====================================================
// 設定UI
// =====================================================
function initSettingsUI() {

  settingsBtn?.addEventListener("click", (e) => {
    playSE("select");
    hideAllScreens();
    if (settingsDiv) settingsDiv.style.display = "block";
    applySoundSettingsToUI();
    applyKeybindsToUI();

    // Player IDを表示
    if (playerIdDisplay) {
      playerIdDisplay.textContent = getPlayerId() || "（IDがありません）";
    }
  });

  settingsBackBtn?.addEventListener("click", (e) => {
    showMainMenu();
  });

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

  [
    [bgmVolSlider, 'bgm'],
    [typeVolSlider, 'type'],
    [missVolSlider, 'miss'],
    [seVolSlider, 'se']
  ].forEach(([el, key]) => {
    el?.addEventListener("input", e => {
      Game.setSoundVolume(key, e.target.value);
      saveSettings();
      // 数値表示(50%など)を更新する処理を追加
      const valDisplay = document.getElementById(`${key}VolumeValue`);
      if (valDisplay) {
        valDisplay.textContent = `${Math.round(e.target.value * 100)}%`;
      }
      Game.playTestSound(key); // ★ ここにテストサウンド再生を追加
    });
  });

  // 会話速度スライダー
  dialogueSpeedSlider?.addEventListener("input", e => {
    const level = parseInt(e.target.value, 10);
    setDialogueSpeed(level);
    saveSettings();
    // 数値表示を更新
    const valDisplay = document.getElementById("dialogueSpeedValue");
    if (valDisplay) {
      const labels = ["Slowest", "Slow", "Normal", "Fast", "Fastest"];
      valDisplay.textContent = labels[level] || "Normal";
    }
  });


  // 音量リセットボタンのイベント
  const resetVolume = (slider, volumeKey) => {
    const defaultValue = 0.5;
    slider.value = defaultValue;
    Game.setSoundVolume(volumeKey, defaultValue);
    saveSettings();
    const valDisplay = document.getElementById(`${volumeKey}VolumeValue`);
    if (valDisplay) {
      valDisplay.textContent = `${Math.round(defaultValue * 100)}%`;
    }
    Game.playTestSound(volumeKey);
  };

  resetBgmVolumeBtn?.addEventListener("click", () => resetVolume(bgmVolSlider, 'bgm'));
  resetSeVolumeBtn?.addEventListener("click", () => resetVolume(seVolSlider, 'se'));
  resetTypeVolumeBtn?.addEventListener("click", () => resetVolume(typeVolSlider, 'type'));
  resetMissVolumeBtn?.addEventListener("click", () => resetVolume(missVolSlider, 'miss'));


  if (soundToggle && soundIcon) {
    soundToggle.addEventListener("change", () => {
      Game.setSoundEnabled(soundToggle.checked);
      soundIcon.src = soundToggle.checked ? "../assets/pic/sound1.png" : "../assets/pic/soundmute.png";
      saveSettings();
    });
  }

  //keybinde

  // 末尾「ん」入力方式設定
  const finalNModeEl = document.getElementById("finalNMode");
  if (finalNModeEl) {
    // 親要素にスタイル用のクラスを追加
    if (finalNModeEl.parentElement && finalNModeEl.parentElement.classList.contains('setting-item')) {
      finalNModeEl.parentElement.classList.add('setting-item-select');
    }

    // 初期値読み込み（localStorageに保存されていればそれを使う）
    try {
      const stored = localStorage.getItem("final_n_mode");
      finalNModeEl.value = stored || "nn";
    } catch (e) {
      finalNModeEl.value = "nn";
    }

    finalNModeEl.addEventListener("change", (e) => {
      try {
        localStorage.setItem("final_n_mode", e.target.value);
      } catch (err) {
        console.warn("failed to save final_n_mode", err);
      }
    });
  }

  saveKeybindBtn?.addEventListener("click", () => {

    const bind = {
      unlock: unlock.value,
      autoLock: autoLock.value,
      pause: pause.value,
      activeSkill: activeSkill.value,
    };
    
      // ★重複チェック
    if (!validateKeybinds(bind)) {
      showSaveMessage("⚠ キーが重複しています", "error");
      return;
    }

    saveKeybinds(bind);

    // ★保存完了メッセージ
    showSaveMessage("キーバインドを保存しました");
  });
}

function applyKeybindsToUI() {

  const keybinds = loadKeybinds();

  // UIに反映
  unlock.value = keybinds.unlock;
  autoLock.value = keybinds.autoLock;
  pause.value = keybinds.pause;
  if (activeSkill) activeSkill.value = keybinds.activeSkill;
}

// キーバインド重複チェック
function validateKeybinds(bind) {

  const values = Object.values(bind);

  const unique = new Set(values);

  // 重複がある = sizeが小さくなる
  if (unique.size !== values.length) {
    return false;
  }

  return true;
}

// =====================================================
// フリーモード設定の保存・読み込み
// =====================================================
function saveFreeModeConfig() {
  const config = {
    lastModeId: currentFreeModeId,
    lastEnemyPattern: currentEnemyPattern,
    standard: {
      difficulty: getCurrentDifficulty("free-standard").id,
      genre: document.getElementById("standardGenreSelect")?.value || "all",
      count: parseInt(document.getElementById("stdCountSlider")?.value) || 20,
    },
    timeAttack: {
      difficulty: getCurrentDifficulty("free-timeattack").id,
      genre: document.getElementById("timeAttackGenreSelect")?.value || "all",
      time: parseInt(document.getElementById("taTimeSlider")?.value) || 60
    },
    long: {
      genre: document.getElementById("longGenreSelect")?.value || "all"
    },
    enemy: {
      difficulty: getCurrentDifficulty("free-enemy").id,
      pattern: document.querySelector("#configEnemy .pattern-btn.active")?.dataset.pattern || "time",
      time: parseInt(document.getElementById("enemyTimeSlider")?.value) || 60,
      count: parseInt(document.getElementById("enemyCountSlider")?.value) || 30,
      interval: parseInt(document.getElementById("enemyIntervalSlider")?.value) || 2000,
      immediateOnClear: document.getElementById("enemyImmediateToggle")?.checked || false,
      tier: document.getElementById("freeEnemyTier")?.value || "1",
      typeSet: document.getElementById("freeEnemyTypeSet")?.value || "ENEMY_TIER_BALANCED",
      lv: parseInt(document.getElementById("playerLvRange")?.value) || 1
    }
  };
  localStorage.setItem("free_mode_config_v1", JSON.stringify(config));
}

function loadFreeModeConfig() {
  const json = localStorage.getItem("free_mode_config_v1");
  if (!json) return;

  try {
    const config = JSON.parse(json);

    if (config.lastModeId) currentFreeModeId = config.lastModeId;
    if (config.lastEnemyPattern) currentEnemyPattern = config.lastEnemyPattern;

    if (config.standard?.difficulty) {
      setCurrentDifficulty(config.standard.difficulty, "free-standard");
    }

    if (config.standard?.count) {
      const el = document.getElementById("stdCountSlider");
      if (el) { el.value = config.standard.count; updateConfigSliderLabel("stdCountSlider", el.value); }
    }
    if (config.standard?.genre){
      const el = document.getElementById("standardGenreSelect");
      if (el) el.value = config.standard.genre;
    }

    if (config.timeAttack?.difficulty) {
      setCurrentDifficulty(config.timeAttack.difficulty, "free-timeattack");
    }

    if (config.timeAttack?.time) {
      const el = document.getElementById("taTimeSlider");
      if (el) { el.value = config.timeAttack.time; updateConfigSliderLabel("taTimeSlider", el.value); }
    }
    if (config.timeAttack?.genre){
      const el = document.getElementById("timeAttackGenreSelect");
      if (el) el.value = config.timeAttack.genre;
    }

    if (config.long?.genre) {
      const el = document.getElementById("longGenreSelect");
      if (el) el.value = config.long.genre;
    }
    if (config.enemy) {
      if (config.enemy.difficulty) {
        setCurrentDifficulty(config.enemy.difficulty, "free-enemy");
      }

      if (config.enemy.time) {
        const el = document.getElementById("enemyTimeSlider");
        if (el) { el.value = config.enemy.time; updateConfigSliderLabel("enemyTimeSlider", el.value); }
      }
      if (config.enemy.count) {
        const el = document.getElementById("enemyCountSlider");
        if (el) { el.value = config.enemy.count; updateConfigSliderLabel("enemyCountSlider", el.value); }
      }
      if (config.enemy.interval) {
        const el = document.getElementById("enemyIntervalSlider");
        if (el) { el.value = config.enemy.interval; updateConfigSliderLabel("enemyIntervalSlider", el.value); }
      }
      if (config.enemy.immediateOnClear !== undefined) {
        const el = document.getElementById("enemyImmediateToggle");
        if (el) el.checked = config.enemy.immediateOnClear;
      }
      if (config.enemy.tier) {
        const el = document.getElementById("freeEnemyTier");
        if (el) el.value = config.enemy.tier;
      }
      if (config.enemy.typeSet) {
        const el = document.getElementById("freeEnemyTypeSet");
        if (el) el.value = config.enemy.typeSet;
      }
      if (config.enemy.lv !== undefined) {
        const el = document.getElementById("playerLvRange");
        if (el) { 
          el.value = config.enemy.lv; 
          updateConfigSliderLabel("playerLvRange", el.value); 
        }
      }
      // パターンの復元
      switchEnemyPattern(currentEnemyPattern);
    }
  } catch (e) {
    console.warn("Failed to load free mode config", e);
  }
}

/**
 * フリーモードのエネミーモードを開始する (UI設定を反映)
 */
function startFreeEnemyMode() {
  // Tierと属性セットの取得
  const selectedTier = parseInt(document.getElementById("freeEnemyTier").value);
  const selectedTypeSetKey = document.getElementById("freeEnemyTypeSet").value;
  const selectedTable = TIER_TABLES[selectedTypeSetKey] || TIER_TABLES.ENEMY_TIER_BALANCED;
  const enemyTable = getTierEnemies(`T${selectedTier}`, selectedTable);

  // デバッグ用ログ: 選択した条件でテーブルが正しく取得できているか確認
  console.log("Enemy Table Selection Check:", {
    selectedTier: `T${selectedTier}`,
    selectedTypeSetKey: selectedTypeSetKey,
    hasTable: !!selectedTable,
    enemyCount: enemyTable ? enemyTable.length : 0,
    enemyTable: enemyTable
  });

  const interval = parseInt(enemyIntervalSlider?.value || "2000");
  const immediateOnClear = enemyImmediateToggle?.checked || false;
  const selectedLv = parseInt(playerLvRange?.value || "1");

  const spawnConfig = {
    interval: interval,
    immediateOnClear: immediateOnClear,
    maxAlive: 10,
    limit: null,
    tier: selectedTier // Tier情報を追加してenemyCore側に伝える
  };

  const activePattern = currentEnemyPattern.toLowerCase();
  
  let customConditions = {};

  if (activePattern === "time") {
    const timeVal = document.getElementById("enemyTimeSlider")?.value;
    const time = parseInt(timeVal && timeVal !== "" ? timeVal : "60");
    customConditions = {
      endConditions: { timerMs: time * 1000, killCount: null, hpZero: true }, 
      clearConditions: { timerMs: time * 1000 },
      spawn: spawnConfig
    };
  } else if (activePattern === "count") {
    const countVal = document.getElementById("enemyCountSlider")?.value;
    const count = parseInt(countVal && countVal !== "" ? countVal : "30");
    customConditions = {
      endConditions: { killCount: count, timerMs: null, hpZero: true }, 
      clearConditions: { killCount: count, timerMs: null },
      spawn: spawnConfig
    };
  } else {
    // エンドレス
    customConditions = {
      endConditions: { timerMs: null, killCount: null, hpZero: true }, 
      clearConditions: { endless: true },
      spawn: spawnConfig
    };
  }

  console.log("START ENEMY FREE MODE:", { activePattern, customConditions });

  hideAllScreens();
  showMenuBackground(false);
  
  // ★ gameStateの状態を明示的に更新（遷移先判定のため）
  gameState.isFreeMode = true;
  gameState.isQuestMode = false;

  startEnemyMode({
    mode: GameModes.ENEMY_MODE,
    isFreeMode: true,
    difficulty: getCurrentDifficulty("free-enemy").id,
    stage: "FREE", // フリーモードのベースステージ
    level: selectedLv,
    customConditions: customConditions,
    enemyTable: enemyTable // Tierと属性セットから生成したテーブルをトップレベルで渡す
  });
}
// =====================================================
// フリーモード詳細設定のUI制御
// =====================================================
function initFreeModeConfigUI() {
  const configEnemy = document.getElementById("configEnemy");
  const patternBtns = configEnemy?.querySelectorAll(".pattern-btn") || [];
  const patternDetails = configEnemy?.querySelectorAll(".pattern-detail") || [];

  // エネミーモード内のパターン切り替え（時間制限/討伐数/エンドレス）
  patternBtns.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const pattern = btn.dataset.pattern;
      if (pattern) {
        switchEnemyPattern(pattern);
      }
    });
  });

  // スライダー変更時に保存
  const sliders = ["stdCountSlider", "taTimeSlider", "enemyTimeSlider", "enemyCountSlider", "enemyIntervalSlider", "playerLvRange"];
  sliders.forEach(id => {
    const el = document.getElementById(id);
    el?.addEventListener("input", () => {
      updateConfigSliderLabel(id, el.value);
      saveFreeModeConfig();
    });
  });

  // Tierと属性セットの変更時にも保存を実行する
  document.getElementById("freeEnemyTier")?.addEventListener("change", saveFreeModeConfig);
  document.getElementById("freeEnemyTypeSet")?.addEventListener("change", saveFreeModeConfig);

  // チェックボックス変更時に保存
  if (enemyImmediateToggle) {
    enemyImmediateToggle.addEventListener("change", () => {
      saveFreeModeConfig();
    });
  }

  // ジャンル選択変更時に保存
  document.getElementById("standardGenreSelect")?.addEventListener("change", () => {
    saveFreeModeConfig();
  });

  // 各設定パネル内の開始ボタンにイベントを登録
  document.getElementById("startStandardFree")?.addEventListener("click", () => {
    const count = parseInt(document.getElementById("stdCountSlider").value);
    const genre = document.getElementById("standardGenreSelect")?.value || "all";
    let tags = [];

    if (genre !== "all") {
      tags.push(genre);
    }

    hideAllScreens();

    gameState.isFreeMode = true;
    updateGameUIVisibility(GameModes.NORMAL.id); // UI表示を更新
    gameState.isQuestMode = false;

    Game.doCountdown({
      mode: GameModes.NORMAL,
      isFreeMode: true,
      difficulty: getCurrentDifficulty("free-standard").id,
      custom: { questionLimit: count, tags: tags}
    });
  });

  // ジャンル選択変更時に保存
  document.getElementById("timeAttackGenreSelect")?.addEventListener("change", () => {
    saveFreeModeConfig();
  });

  document.getElementById("startTimeAttackFree")?.addEventListener("click", () => {
    const time = parseInt(document.getElementById("taTimeSlider").value);
    const genre = document.getElementById("timeAttackGenreSelect")?.value || "all";
    let tags = [];

    if (genre !== "all") {
      tags.push(genre);
    }

    hideAllScreens();

    gameState.isFreeMode = true;
    updateGameUIVisibility(GameModes.TIME_ATTACK.id); // UI表示を更新
    gameState.isQuestMode = false;

    Game.doCountdown({
      mode: GameModes.TIME_ATTACK,
      isFreeMode: true,
      difficulty: getCurrentDifficulty("free-timeattack").id,
      custom: { limitSec: time , tags: tags}
    });
  });

  // 長文ジャンル選択変更時に保存
  document.getElementById("longGenreSelect")?.addEventListener("change", () => {
    saveFreeModeConfig();
  });

  document.getElementById("startLongFree")?.addEventListener("click", () => {
    const genre = document.getElementById("longGenreSelect")?.value || "all";
    const tags = ["長文"];
    if (genre !== "all") {
      tags.push(genre);
    }

    hideAllScreens();

    gameState.isFreeMode = true;
    updateGameUIVisibility(GameModes.LONG_TEXT.id); // UI表示を更新
    gameState.isQuestMode = false;

    Game.doCountdown({
      mode: GameModes.LONG_TEXT,
      isFreeMode: true,
      difficulty: null,
      custom: { tags: tags }
    });
  });

  document.getElementById("startEnemyFree")?.addEventListener("click", startFreeEnemyMode);

  // エネミーモードの開始ボタンを設定パネルの最下部に移動する
  const enemyStartBtn = document.getElementById("startEnemyFree");
  if (enemyStartBtn && configEnemy) {
    configEnemy.appendChild(enemyStartBtn);
  }

}

/**
 * スライダーの値をUIに反映する共通処理
 */
function updateConfigSliderLabel(id, value) {
  const valDisplay = document.getElementById(id.replace("Slider", "Value").replace("Range", "Value").replace("playerLv", "enemyLv"));
  if (!valDisplay) return;
  
  if (id === "enemyIntervalSlider") {
    valDisplay.textContent = (value / 1000).toFixed(1);
  } else {
    valDisplay.textContent = value;
  }
}

/**
 * エネミーモード内の表示パターンを切り替える
 */
function switchEnemyPattern(pattern) {
  currentEnemyPattern = pattern;
  const configEnemy = document.getElementById("configEnemy");
  if (!configEnemy) return;

  const patternBtns = configEnemy.querySelectorAll(".pattern-selector .pattern-btn");
  const patternDetails = configEnemy.querySelectorAll(".pattern-detail");

  patternBtns.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.pattern === pattern);
  });

  const targetId = `enemyParam${pattern.charAt(0).toUpperCase() + pattern.slice(1)}`;
  patternDetails.forEach(detail => {
    const isTarget = detail.id === targetId;
    detail.style.display = isTarget ? "block" : "none";
    detail.classList.toggle("active-detail", isTarget);
  });

  saveFreeModeConfig();
}

/**
 * フリーモードのモード選択に合わせて設定パネルを切り替える
 * @param {string} modeId 'Standard', 'TimeAttack', 'Enemy', 'Long'
 */
function switchFreeModeConfig(modeId) {
  currentFreeModeId = modeId; // 選択されたモードを保存
  const groups = document.querySelectorAll(".mode-config-group");
  const targetId = `config${modeId}`;

  groups.forEach(group => {
    const isTarget = group.id === targetId;
    group.style.display = isTarget ? "block" : "none";
    group.classList.toggle("active-config", isTarget);
  });

  // 選択されたボタンを強調表示（activeクラスを制御）
  const btnMap = {
    'Standard': freeStartBtn,
    'TimeAttack': freeTimeAttackBtn,
    'Enemy': freeEnemyModeBtn,
    'Long': freeLongTextBtn
  };

  Object.values(btnMap).forEach(btn => btn?.classList.remove("active"));
  if (btnMap[modeId]) {
    btnMap[modeId].classList.add("active");
  }

  saveFreeModeConfig(); // 選択状態が変わるたびに保存
}

/**
 * ゲームモードに応じてゲーム画面のUI要素の表示/非表示を切り替える
 * @param {string} modeId - GameModesのID (e.g., 'time_attack', 'normal')
 */
function updateGameUIVisibility(modeId) {
  const speedContainer = document.getElementById("speed-container");
  const speedLabel = document.getElementById("speed-label");
  const timeBarContainer = document.getElementById("time-bar-container");

  // タイムアタックモードの場合
  if (modeId === GameModes.TIME_ATTACK.id) {
    if (speedContainer) speedContainer.style.display = "flex";
    if (speedLabel) speedLabel.style.display = "block";
    if (timeBarContainer) timeBarContainer.style.display = "block";
  } 
  // その他のモードの場合
  else {
    // デフォルトでは速度バーは表示、タイムバーは非表示
    if (speedContainer) speedContainer.style.display = "flex";
    if (speedLabel) speedLabel.style.display = "block";
    if (timeBarContainer) timeBarContainer.style.display = "none";
  }
  // TODO: 今後、モードごとにさらに詳細な表示制御が必要な場合はここに追加
}


// =====================================================
// 画面表示制御ユーティリティ
// =====================================================
export function hideAllScreens() {
  const freeModeConfig = document.getElementById("freeModeConfig");
  [menuDiv, questMenuDiv, startMenuDiv, freeStartMenuDiv, settingsDiv, gameDiv, resultDiv, recordsDiv, questMapScreen, skillTreeDiv, onlineRankingDiv, freeModeConfig]
    .forEach(div => { if (div) div.style.display = "none"; });
  // showMenuBackground(false); // メニュー遷移時に背景画像が途切れないように維持
}

function showMainMenu() {
  hideAllScreens();
  updateHud(null, { isQuestMode: false }); // HUDを通常モードに戻す
  closeDialogue(); // ★会話モーダルを閉じる
  if (menuDiv) menuDiv.style.display = "block";

  showMenuBackground("title_menu");
  updateHud(); // メインメニューが表示されたタイミングでHUDのデータを同期
  const hud = document.getElementById("playerHud");
  if (hud) hud.style.display = "block";
}
function showQuestMenu() {
  hideAllScreens();
  closeDialogue(); // ★会話モーダルを閉じる
  if (questMenuDiv) questMenuDiv.style.display = "block";

  // オートセーブデータの有無をチェック
  const auto = JSON.parse(localStorage.getItem("quest_auto_save"));
  const hasSave =
    auto &&
    auto.progress &&
    auto.progress.cleared &&
    auto.progress.cleared.length > 0;

  // セーブデータがない場合は「Continue」ボタンを非表示にする
  if (questStartBtn) questStartBtn.style.display = hasSave ? "block" : "none";

  renderQuestSlots(); // ★これ追加
  showMenuBackground("quest_menu"); //クエストメニュー画面
}
function showStartMenu() { 
  hideAllScreens(); 
  if (startMenuDiv) startMenuDiv.style.display = "block"; 
  showMenuBackground("title_menu");
}
function showFreeStartMenu() { 
  hideAllScreens(); 
  if (freeStartMenuDiv) freeStartMenuDiv.style.display = "block"; 
  
  const freeModeConfig = document.getElementById("freeModeConfig");
  if (freeModeConfig) freeModeConfig.style.display = "block";

  showMenuBackground("title_menu");
  // 最後に選択されていた（またはデフォルトの）モードを表示
  switchFreeModeConfig(currentFreeModeId);
}

export function showQuestMap() {
  hideAllScreens();
  showMenuBackground(false); // クエストマップは専用の描画があるため隠す
  reloadQuestProgress();
  
  questMapScreen.style.display = "block";
  renderQuestMapUI();
}

export function showGameScreen() {
  hideAllScreens();
  showMenuBackground(false); // ゲーム中はタイピングに集中するため隠す
  gameDiv.style.display = "block";
}

// ================================
// 🔹イベントバインディングまとめ
// ================================

function bindMenuEvents() {

  questMenuBtn?.addEventListener("click", () => {
    playSE("select");
    updateHud(null, { isQuestMode: true });
    showQuestMenu();
  });

  startMenuBtn?.addEventListener("click", () => { playSE("select"); showStartMenu(); });
  freeModeBtn?.addEventListener("click", () => { playSE("select"); showFreeStartMenu(); });

  recordsMenuBtn?.addEventListener("click", () => {
    playSE("select");
    hideAllScreens();
    showRecordsView(Game.getLastGameMode?.() ?? GameModes.NORMAL);
  });

  onlineRankingBtn?.addEventListener("click", () => {
    playSE("select");
    hideAllScreens();
    openOnlineRanking();
  });

  // 「戻る」ボタンは、すべてshowMainMenuを呼び出すように統一する
  startMenuBackBtn?.addEventListener("click", () => { playSE("select"); showMainMenu(); });
  freeStartMenuBackBtn?.addEventListener("click", () => { playSE("select"); showMainMenu(); });
  questStartMenuBackBtn?.addEventListener("click", () => { playSE("select"); showMainMenu(); });

  questSaveBtn?.addEventListener("click", () => {
    playSE("select");
    questSaveMenuDiv.classList.remove("hidden");
    renderQuestSlots();
  });

  saveToQuestMenuBackBtn?.addEventListener("click", () => {
    playSE("select");
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
    if (gameState.isQuestMode || gameState.currentQuestNode) showQuestMap();
    else if (gameState.isFreeMode) showFreeStartMenu();
    else showStartMenu();
  });

  mapBackBtn?.addEventListener("click", () => {
    showQuestMenu();
  });
}

// =====================================================
// エンディング演出
// =====================================================

/**
 * スタッフロール用のCSSを動的に読み込みます。
 * @returns {Promise<void>}
 */
function loadStaffRollCSS() {
    return new Promise((resolve) => {
        if (document.getElementById('staff-roll-css')) {
            resolve();
            return;
        }
        const link = document.createElement('link');
        link.id = 'staff-roll-css';
        link.rel = 'stylesheet';
        link.href = './js/staffRoll.css'; // CSSファイルのパス
        link.onload = () => resolve();
        link.onerror = () => {
            console.error("Failed to load staffRoll.css");
            resolve(); // エラーでも処理を続行
        };
        document.head.appendChild(link);
    });
}

/**
 * 画面を暗転させます。
 * @param {number} duration - 暗転にかかる時間 (ms)
 * @returns {Promise<void>}
 */
function fadeToBlack(duration = 1500) {
    return new Promise(resolve => {
        const blackout = document.createElement('div');
        blackout.className = 'true-ending-blackout';
        document.body.appendChild(blackout);

        requestAnimationFrame(() => {
            blackout.style.opacity = '1';
        });

        setTimeout(() => {
            resolve(blackout); // 暗転用divを後で消せるように返す
        }, duration);
    });
}

/**
 * 画面にメッセージを表示します。
 * @param {string} text - 表示するテキスト
 * @param {number} duration - 表示時間 (ms)
 * @returns {Promise<void>}
 */
function showMessage(text, duration = 2000) {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'true-ending-message-overlay';
        const p = document.createElement('p');
        p.textContent = text;
        overlay.appendChild(p);
        document.body.appendChild(overlay);

        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
        });

        setTimeout(() => {
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.remove();
                resolve();
            }, 1500);
        }, duration);
    });
}

/**
 * スタッフロールを開始します。
 */
function showStaffRoll(onComplete) {
    isStaffRollShowing = true; // ★表示開始

    const canSkip = hasSeenTrueEnding();

    // クリックとポインター表示に対応
    const staffRollHTML = `
        <div class="staff-roll-overlay">
            ${canSkip ? '<div class="staff-roll-skip" style="position: fixed; bottom: 20px; right: 20px; color: white; font-family: monospace; z-index: 10001; opacity: 0.7; cursor: pointer;">skip &gt;&gt;&gt;</div>' : ''}
            <div class="staff-roll-content">
                <div class="staff-roll-line"><span class="role-center">STAFF</span></div>
                <div class="staff-roll-line"><span class="role">Direction / Design / Programming</span><span class="name">MameSamurai</span></div>
                <div class="staff-roll-line"><span class="role">Music</span><span class="name">DOVA-SYNDROME</span></div>
                <div class="staff-roll-line"><span class="role">Sound Effect</span><span class="name">OtoLogic</span></div>
                <div class="staff-roll-line"><span class="role-center" style="margin-top: 4em;">Special Thanks</span></div>
                <div class="staff-roll-line"><span class="role-center">All Players</span></div>
                <div class="staff-roll-line" style="margin-top: 6em; justify-content: center;"><span class="role-center">Thank you for playing!</span></div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', staffRollHTML);

    const overlay = document.querySelector('.staff-roll-overlay');
    const skipButton = canSkip ? document.querySelector('.staff-roll-skip') : null;
    let skipHandler = null;

    const endRoll = () => {
        if (!overlay) return;
        clearTimeout(rollTimer);
        // イベントリスナーを安全に解除
        if (skipHandler) document.removeEventListener('keydown', skipHandler);
        if (skipButton) skipButton.removeEventListener('click', endRoll);

        overlay.classList.add('fade-out');
        setTimeout(() => {
            overlay.remove();
            isStaffRollShowing = false; // ★表示終了
            if (onComplete) onComplete();
        }, 1500);
    };

    const rollTimer = setTimeout(endRoll, 30000); // 30秒でロール終了

    if (canSkip && skipButton) {
        // Sキーでのスキップ
        skipHandler = (e) => {
            if (e.key.toLowerCase() === 's') {
                e.preventDefault();
                endRoll();
            }
        };
        document.addEventListener('keydown', skipHandler);

        // クリックでのスキップ
        skipButton.addEventListener('click', endRoll);
    }
}

/**
 * 真エンディングシーケンスを開始します。
 */
export async function startTrueEndingSequence(onCompleteCallback) {
    // HUDを非表示にする
    showHud(false);

    // 1. CSSの読み込みを試みる
    await loadStaffRollCSS();

    // 2. 画面を暗転させる
    const blackout = await fadeToBlack();
    playBGM("bgm_hosikuzu"); // BGM再生開始
    await new Promise(r => setTimeout(r, 2000));

    // 3. メッセージを表示する
    await showMessage("Thank you for playing.");

    // 4. スタッフロールのHTMLを表示する
    await showStaffRoll(() => {
        stopBGM(); // BGM停止
        if (onCompleteCallback) onCompleteCallback();
        showHud(true); // ★ HUDを再表示
    });
    // 5. エンディングを見たことを記録する
    markTrueEndingSeen();

    if (blackout) blackout.remove();
}

// =============================================================================================================




function bindModeSwitchEvents() {

  switchToFreeBtn?.addEventListener("click", () => {
    showFreeStartMenu();
  });

  switchToNormalBtn?.addEventListener("click", () => {
    showStartMenu();
  });
}

function bindModeStartEvents() {

  // イベントリスナーの重複登録を防ぐため、要素をクローンして置き換える
  questStartBtn = questStartBtn.replaceWith(questStartBtn.cloneNode(true)) || questStartBtn;
  questStartBtn = document.getElementById("questStartBtn");

  questStartBtnFromBeginning = questStartBtnFromBeginning.replaceWith(questStartBtnFromBeginning.cloneNode(true)) || questStartBtnFromBeginning;
  questStartBtnFromBeginning = document.getElementById("questStartBtnFromBeginning");



  questStartBtn?.addEventListener("click", () => {
    showQuestMap();
  });
  
  questStartBtnFromBeginning?.addEventListener("click", async () => {
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
  
      // ロード画面を表示
      showLoadingScreen();
      setLoadingText("Creating New World...");
      await new Promise(r => setTimeout(r, 800));
  
      // 進行状況の初期化
      resetQuestAll();
      // ★ MODIFIED: resetQuestAll の後にプロローグを再生するように移動
      // これにより、プロローグ再生済みのフラグがリセットされなくなります。
      await new Promise(resolve => {
        closeQuestModal();
        startDialogue("prologue", () => {
          resolve(); // ダイアログが閉じたらPromiseを解決
        });
      });

      reloadQuestProgress();
      reloadQuestPlayerStats();
      updateHud(null, { isQuestMode: true });
  
      // 画面切り替え
      hideLoading();
      showQuestMap();
  });

  enemyModeBtn?.addEventListener("click", () => {
    hideAllScreens();
    showMenuBackground(false); // ゲーム画面に遷移する際にメニュー背景を非表示にする

    // ★ 通常（デイリー）のエネミーモード開始時のフラグ設定
    gameState.isFreeMode = false;
    gameState.isQuestMode = false;

    startEnemyMode({
      mode: GameModes.ENEMY_MODE,
      isFreeMode: false,
      difficulty: "normal",
      stage: "DAILY"
    });
  });

  freeEnemyModeBtn?.addEventListener("click", () => {
    switchFreeModeConfig('Enemy');
  });

  startBtn?.addEventListener("click", () => {
    hideAllScreens();
    updateGameUIVisibility(GameModes.NORMAL.id); // UI表示を更新
    Game.doCountdown({ mode: GameModes.NORMAL, isFreeMode: false, difficulty: "normal" });
  });

  timeAttackBtn?.addEventListener("click", () => {
    hideAllScreens();
    updateGameUIVisibility(GameModes.TIME_ATTACK.id); // UI表示を更新
    Game.doCountdown({ mode: GameModes.TIME_ATTACK, isFreeMode: false, difficulty: "normal" });
  });

  longTextBtn?.addEventListener("click", () => {
    hideAllScreens();
    updateGameUIVisibility(GameModes.LONG_TEXT.id); // UI表示を更新
    Game.doCountdown({ mode: GameModes.LONG_TEXT, isFreeMode: false, difficulty: null });
  });

  freeStartBtn?.addEventListener("click", () => {
    switchFreeModeConfig('Standard');
  });

  freeTimeAttackBtn?.addEventListener("click", () => {
    switchFreeModeConfig('TimeAttack');
  });

  freeLongTextBtn?.addEventListener("click", () => {
    switchFreeModeConfig('Long');
  });
}

function bindResultEvents() {

  playAgainBtn?.addEventListener("click", () => {
    const modal = document.querySelector(".game-modal");
    if (modal) modal.style.display = "none";
    if (resultDiv) resultDiv.style.display = "none";

     // ★ UI表示を更新（スピードバーなどが正しく表示されるようにするため）
    const lastModeId = Game.getLastGameMode()?.id || GameModes.NORMAL.id;
    updateGameUIVisibility(lastModeId);

    if (wasLastGameEnemyMode()) {
      // フリーモードのエネミーモードの場合、UIの設定（Tier等）を反映し直して開始する
      if (gameState.isFreeMode) {
        startFreeEnemyMode();
      } else {
        restartEnemyMode();
      }
    } else {
      Game.restartLastGame();
    }
  });

  retryBtn?.addEventListener("click", () => {
    // ★ UI表示をミス練習モード用に更新
    // これを呼ばないと、タイムアタック後などにスピードバーが非表示になる問題を解決
    updateGameUIVisibility(GameModes.MISS_PRACTICE.id);

    if (resultDiv) resultDiv.style.display = "none";
    Game.retryMissed();
    retryBtn.style.display = "none";
  });

  resultToStartMenuBtn?.addEventListener("click", () => {
    Game.fullResetGame(); 
    Game.backToMenu();
    if (gameState.isQuestMode) showQuestMenu();
    else if (gameState.isFreeMode) showFreeStartMenu();
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

  resultOpenRecordsBtn?.addEventListener("click", (e) => {
    // ボタンのdatasetからモードIDを取得
    const modeId = e.currentTarget.dataset.modeId;
    Game.fullResetGame();
    Game.backToMenu();
    hideAllScreens();
    showRecordsView(modeId ?? GameModes.NORMAL.id);
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

  rankingBackBtn?.addEventListener("click", () => {
    hideAllScreens();
    showMainMenu();
  });
}

//クエストサイドメニューの戻るボタン用
export function backToQuestMenu() {
  closeDialogue(); // ★会話モーダルを閉じる
  showQuestMenu();
}

export function backToQuestMap() {
  showQuestMap();
}

// ================================
// 🔹キー入力制御（状態別ルーター）
// Result画面なら handleResultKey で止まる
// Pause中なら handlePauseKey で止まる
// ゲーム中なら handleGameKey で止まる
// それ以外だけ handleMenuKey
// ================================

function bindKeyEvents() {
  
  document.addEventListener("keydown", (e) => {

    // 管理者用DEVツール
    if (e.shiftKey && e.key.toLowerCase() === "d") {
      const panel = document.getElementById("devPanel");
      if (!panel) return;

      panel.style.display =
        panel.style.display === "none" ? "block" : "none";
    
    }
    
    if (handleResultKey(e)) return;
    if (handlePauseKey(e)) return;
    if (handleGameKey(e)) return;
    if (handleMenuKey(e)) return;
  });
}

function handleResultKey(e) {
  if (resultDiv.style.display === "none") return false;

  const key = e.key.toLowerCase(); // ここだけ残す（UI用）

  switch (key) {
    case "p":
      playAgainBtn?.click();
      break;
    case "m": //
      // クエスト、スキルモード、長文モード、エネミーモードではミス練習リトライを無効化
      if (gameState.currentQuestNode || 
          gameState.currentChallenge?.isSkillMode || 
          gameState.currentMode?.id === GameModes.LONG_TEXT.id ||
          gameState.currentMode?.id === GameModes.ENEMY_MODE.id) {
        break;
      } else {
      retryBtn?.click();
      }
      break;
    case "s": // select menu
      if (gameState.currentQuestNode || gameState.currentChallenge?.isSkillMode) {
        break;
      } else {
        resultToStartMenuBtn?.click();
      }  
      break;
    case "b": // back to menu
      if (gameState.currentQuestNode || gameState.currentChallenge?.isSkillMode) {
        questBackBtn?.click();
      } else {
        resultBackBtn?.click();
      }
      break;
    case "r": // records
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

function handlePauseKey(e) {
  if (!getPaused()) return false;

  const key = e.key.toLowerCase();

  switch (key) {
    case "enter":
    case "p":
      setPaused(false);
      document.querySelector(".pause-overlay").style.display = "none";
      break;

    case "r":
      setPaused(false);
      document.querySelector(".pause-overlay").style.display = "none";
  
      if (gameState.enemyMode) {
        if (gameState.isFreeMode) startFreeEnemyMode();
        else restartEnemyMode();
      }
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
      const isQuest = gameState.isQuestMode || !!gameState.currentQuestNode;
      Game.backToMenu();
      if (isQuest) showQuestMap();
      else if (gameState.isFreeMode) showFreeStartMenu();
      else showStartMenu();

      break;

  }

  return true;
}

function handleGameKey(e) {

  const keybinds = loadKeybinds();

  if (!Game.isGameActive) return false;

  // ★終了演出中は入力停止
  if (gameState.isEnding) return true;

  // ★エネミーモードの開始・フェーズ移行演出中は入力停止
  if (gameState.enemyMode && gameState.enemyStats?.isTransitioning) return true;

  if (getPaused()) return true;

  // ポーズトグル
  if (e.code === keybinds.pause) {
    e.preventDefault();
    const paused = Game.togglePause();
    const overlay = document.querySelector(".pause-overlay");
    if (overlay) overlay.style.display = paused ? "flex" : "none";
    return true;
  }

  // ESC終了
  if (e.code === "Escape") {
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
      const isQuest = gameState.isQuestMode || true;
      gameState.enemyStats.failed = true;
      endEnemyMode();
      Game.fullResetGame();
      gameState.typed = "";
      if (skillTreeDiv) skillTreeDiv.style.display = "none";
      if (isQuest) showQuestMap();
      else showMainMenu();
      return true;
    }

    // ★③ エネミーモード
    if (gameState.enemyMode) {
      const isQuest = gameState.isQuestMode;
      gameState.enemyStats.failed = true;
      endEnemyMode();
      Game.fullResetGame();
      gameState.typed = "";
      if (isQuest) showQuestMap();
      else if (gameState.isFreeMode) showFreeStartMenu();
      else showStartMenu();
      return true;
    }

    // ★④ 通常
    const isQuestNormal = gameState.isQuestMode;
    Game.backToMenu();
    if (isQuestNormal) showQuestMap();
    else if (gameState.isFreeMode) showFreeStartMenu();
    else showStartMenu();
    return true;
  }

  // 入力処理
  if (gameState.enemyMode) {
    if (e.code === "Tab") e.preventDefault();
    handleEnemyKey(e);
  } else { // 通常モード
    handleKey(e);
  }

  return true;
}

function handleMenuKey(e) {
  // スタッフロール表示中はメニューキーを無効化
  if (isStaffRollShowing) return true;


  const key = e.key.toLowerCase();

  // ★会話・ログモーダルが表示されている場合のキー処理
  if (isDialogueVisible()) {
    // ログ画面の閉じるボタンが表示されているかチェック
    const closeBtn = document.getElementById('dialogueCloseBtn');
    const isLogView = closeBtn && closeBtn.style.display === 'block';

    // ログ画面が表示されていて、'b'または'Escape'が押されたら閉じる
    if (isLogView && (key === 'b' || key === 'escape')) {
        e.preventDefault();
        closeDialogue();
        return true; // イベントを処理したのでここで終了
    }
    // 会話再生中は他のメニューキーを無効化
    return true;
  }
  
  // クエストモードの難易度選択モーダルが開いている場合、難易度選択のショートカットキーを処理する
  const questModal = document.getElementById("questModal");
  if (questModal && questModal.style.display !== "none") {
    const titleEl = questModal.querySelector(".quest-modal-title");
    if (titleEl && titleEl.textContent === "DIFFICULTY") {
      const btnContainer = questModal.querySelector(".quest-difficulty-list");
      if (btnContainer) {
        let btn;
        switch (key) {
          case "e": // EASY
            btn = btnContainer.querySelector("button:nth-child(1)");
            break;
          case "n": // NORMAL
            btn = btnContainer.querySelector("button:nth-child(2)");
            break;
          case "h": // HARD
            btn = btnContainer.querySelector("button:nth-child(3)");
            break;
        }
        btn?.click();
      }
    }
    // 会話再生中は他のメニューキーを無効化（ESCキーの処理はdialogue.jsに移行）
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

  // アチーブメントモーダルが開いている場合、閉じるショートカットキーを処理する
  const achModal = document.getElementById("achModal");
  if (achModal && window.getComputedStyle(achModal).display !== "none") {
    if (key === "b" || key === "escape") {
      e.preventDefault();
      document.getElementById("achClose")?.click();
      return true; // モーダルを閉じたので処理を終了
    }
  }

  // 通常ステータスモーダル
  const statsModal = document.getElementById("playerStatsModal");
  if (statsModal && window.getComputedStyle(statsModal).display !== "none") {
    if (key === "b" || key === "escape") {
      e.preventDefault();
      document.getElementById("statsClose")?.click();
      return true; // モーダルを閉じたので処理を終了
    }
  }

  // クエストステータスモーダル
  const questStatsModal = document.getElementById("questStatsModal");
  if (questStatsModal && window.getComputedStyle(questStatsModal).display !== "none") {
    if (key === "b" || key === "escape") {
      e.preventDefault();
      document.getElementById("statsCloseQuest")?.click();
      return true; // モーダルを閉じたので処理を終了
    }
  }

  if (settingsDiv.style.display !== "none") {
    if (key === "b" || key === "escape") {
      e.preventDefault();
      settingsBackBtn?.click();
    }
    return true;
  }

  if (onlineRankingDiv.style.display !== "none") {
    if (key === "b" || key === "escape") {
      e.preventDefault();
      rankingBackBtn?.click();
      return true;
    }

    // タブ切り替え
    const onlineRankingModeButtons = document.getElementById("onlineRankingModeButtons");
    if (onlineRankingModeButtons && !e.ctrlKey && !e.metaKey) { //修飾キーのチェックを追加
        let targetButton = null;
        switch (key) {
            case "s": // Standard(Normal)
                targetButton = onlineRankingModeButtons.querySelector('button[data-mode="normal"]');
                break;
            case "t": // Time Attack
                targetButton = onlineRankingModeButtons.querySelector('button[data-mode="time_attack"]');
                break;
            case "l": // Long Text
                targetButton = onlineRankingModeButtons.querySelector('button[data-mode="long_text"]');
                break;
            case "e": // Enemy Mode
                targetButton = onlineRankingModeButtons.querySelector('button[data-mode="enemy_mode"]');
                break;
        }
        if (targetButton) {
            targetButton.click();
            e.preventDefault();
        }
    }
    return true;
  }

  if (recordsDiv.style.display !== "none") {
    if (key === "b" || key === "escape") {
      e.preventDefault();
      recordsBackBtn?.click();
      return true;
    }

    // タブ切り替え
    const recordsModeButtons = document.getElementById("recordsModeButtons");
    if (recordsModeButtons && !e.ctrlKey && !e.metaKey) { // Ctrl/Cmd + R (リロード) を除外
        let targetButton = null;
        switch (key) {
            case "s": // Standard(Normal)
                targetButton = recordsModeButtons.querySelector('button[data-mode="normal"]');
                break;
            case "t": // Time Attack
                targetButton = recordsModeButtons.querySelector('button[data-mode="time_attack"]');
                break;
            case "l": // Long Text
                targetButton = recordsModeButtons.querySelector('button[data-mode="long_text"]');
                break;
            case "e": // Enemy Mode
                targetButton = recordsModeButtons.querySelector('button[data-mode="enemy_mode"]');
                break;
        }
        if (targetButton) {
            targetButton.click();
            e.preventDefault();
        }
    }
    return true;
  }

  if (menuDiv.style.display !== "none") {
    // メインメニュー
    switch (key) {
      case "h": startMenuBtn?.click(); break;
      case "d": startMenuBtn?.click(); break; // Daily
      case "q": questMenuBtn?.click(); break; // Quest
      case "f": freeModeBtn?.click(); break;
      case "r": recordsMenuBtn?.click(); break;
      case "o": onlineRankingBtn?.click(); break; // Online
      case "s": settingsBtn?.click(); break;
      case "a": // Achievements
        document.getElementById("hudAchievementsBtn")?.click();
        break;
      case "i": // Info/Stats
        document.getElementById("hudDetailBtn")?.click();
        break;
    }
    return true;
  }

  if (startMenuDiv.style.display !== "none") {
    // デイリーモードメニュー
    switch (key) {
      case "k": startBtn?.click(); break;
      case "s": startBtn?.click(); break; // Standard
      case "t": timeAttackBtn?.click(); break;
      case "l": longTextBtn?.click(); break;
      case "e": enemyModeBtn?.click(); break; // Enemy
      case "b": startMenuBackBtn?.click(); break;
      case "f": switchToFreeBtn?.click(); break;
      case "a": // Achievements
        document.getElementById("hudAchievementsBtn")?.click();
        break;
      case "i": // Info/Stats
        document.getElementById("hudDetailBtn")?.click();
        break;
    }
    return true;
  }

  if (freeStartMenuDiv.style.display !== "none") {
    // フリーモードメニュー
    switch (key) {
      case "k": freeStartBtn?.click(); break;
      case "s": freeStartBtn?.click(); break; // Standard
      case "t": freeTimeAttackBtn?.click(); break;
      case "l": freeLongTextBtn?.click(); break;
      case "e": freeEnemyModeBtn?.click(); break; // Enemy
      case "b": freeStartMenuBackBtn?.click(); break;
      case "n": switchToNormalBtn?.click(); break;
      case "a": // Achievements
        document.getElementById("hudAchievementsBtn")?.click();
        break;
      case "i": // Info/Stats
        document.getElementById("hudDetailBtn")?.click();
        break;
    }
    return true;
  }

  if (questMenuDiv.style.display !== "none") {
    // クエストモードメニュー
    switch (key) {
      case "c": // Continue
        questStartBtn?.click();
        break;
      case "s": // Save/Load
        questSaveBtn?.click();
        break;
      case "n": // New Game
        questStartBtnFromBeginning?.click();
        break;
      case "b": questStartMenuBackBtn?.click(); break;
      case "a": // Achievements
        document.getElementById("hudAchievementsBtn")?.click();
        break;
      case "i": // Info/Stats
        document.getElementById("hudDetailBtn")?.click();
        break;
    }
    return true;
  }

  if (questMapScreen.style.display !== "none") {
    // クエストマップ画面
    const sideMenu = document.getElementById("questSideMenu");
    if (sideMenu) {
      let btn;
      switch (key) {
        case "d": // Difficulty
          btn = sideMenu.querySelector("button:nth-child(1)");
          break;
        case "t": // skill Tree
          btn = sideMenu.querySelector("button:nth-child(2)");
          break;
        case "e": // equip Skill (or "SKILL")
          btn = sideMenu.querySelector("button:nth-child(3)");
          break;
        case "p": // status (was "i")
          btn = sideMenu.querySelector("button:nth-child(4)");
          break;
        case "l": // log (new)
          btn = sideMenu.querySelector("button:nth-child(5)");
          break; 
        case "s": // save/load
          btn = sideMenu.querySelector("button:nth-child(6)");
          break;
        case "b": // Back
          btn = sideMenu.querySelector("button:nth-child(7)");
          break;
        case "a": // Achievements
          document.getElementById("hudAchievementsBtn")?.click();
          break;
        case "i": // Info/Stats
          document.getElementById("hudDetailBtn")?.click();
          break;
      }
      btn?.click();
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

  const vols = Game.getSoundVolumes();
  if (bgmVolSlider) {
    bgmVolSlider.value = vols.bgm;
    document.getElementById("bgmVolumeValue").textContent = `${Math.round(vols.bgm * 100)}%`;
  }
  if (typeVolSlider) {
    typeVolSlider.value = vols.type;
    document.getElementById("typeVolumeValue").textContent = `${Math.round(vols.type * 100)}%`;
  }
  if (missVolSlider) {
    missVolSlider.value = vols.miss;
    document.getElementById("missVolumeValue").textContent = `${Math.round(vols.miss * 100)}%`;
  }
  if (seVolSlider) {
    seVolSlider.value = vols.se;
    document.getElementById("seVolumeValue").textContent = `${Math.round(vols.se * 100)}%`;
  }
  // 会話速度
  if (dialogueSpeedSlider) {
    const settings = JSON.parse(localStorage.getItem("typing_game_settings") || "{}");
    const speedLevel = settings.dialogueSpeed !== undefined ? settings.dialogueSpeed : 3; // デフォルトはFast
    dialogueSpeedSlider.value = speedLevel;
    setDialogueSpeed(speedLevel);
    const valDisplay = document.getElementById("dialogueSpeedValue");
    if (valDisplay) {
      const labels = ["Slowest", "Slow", "Normal", "Fast", "Fastest"];
      valDisplay.textContent = labels[speedLevel] || "Normal";
    }
  }

  if (soundToggle && soundIcon) {
    soundToggle.checked = Game.getSoundEnabled();
    soundIcon.src = Game.getSoundEnabled() ? "../assets/pic/sound1.png" : "../assets/pic/soundmute.png";
  }
}

function saveSettings() {
  localStorage.setItem("typing_game_settings", JSON.stringify({
    soundEnabled: Game.getSoundEnabled(),
    soundSettings: Game.getSoundSettings(),
    soundVolumes: Game.getSoundVolumes(),
    dialogueSpeed: dialogueSpeedSlider ? parseInt(dialogueSpeedSlider.value, 10) : 3,
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
    if (settings.soundVolumes) {
      Object.entries(settings.soundVolumes).forEach(([key, value]) => {
        Game.setSoundVolume(key, value);
      });
    }
    if (settings.dialogueSpeed !== undefined) {
      setDialogueSpeed(settings.dialogueSpeed);
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


// =====================================================
// メッセージ表示関数
// =====================================================
function showSaveMessage(text) {

  let el = document.getElementById("saveMessage");

  if (!el) {
    el = document.createElement("div");
    el.id = "saveMessage";

    // スタイル（簡易トースト）
    el.style.position = "fixed";
    el.style.top = "50%";
    el.style.left = "50%";
    el.style.transform = "translate(-50%, -50%)";
    el.style.background = "rgba(0,0,0,0.8)";
    el.style.color = "#fff";
    el.style.padding = "10px 20px";
    el.style.borderRadius = "8px";
    el.style.fontSize = "14px";
    el.style.zIndex = "10700";
    el.style.transition = "opacity 0.3s, background-color 0.3s";

    document.body.appendChild(el);
  }

  el.textContent = text;
  el.style.opacity = "1";

  // ★2秒後に消す
  clearTimeout(el._timer);
  el._timer = setTimeout(() => {
    el.style.opacity = "0";
  }, 2000);
}


// =====================================================
// マウス座標取得
// エネミーモード hover 用
// =====================================================
const enemyCanvas = document.getElementById("enemyModeCanvas");

if (enemyCanvas) {
    enemyCanvas.addEventListener("mousemove", (e) => {
        const rect = enemyCanvas.getBoundingClientRect();

        window.mousePos = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    });

    enemyCanvas.addEventListener("mouseleave", () => {
        window.mousePos = null;
    });
}

/**
 * モバイルデバイスの判定と警告表示
 */
function checkMobile() {
  // 1. 判定基準の強化（iPad等のデスクトップモードも考慮）
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isSmallScreen = window.innerWidth <= 1024 || window.innerHeight <= 600;
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  if (isTouchDevice || isSmallScreen || isMobileUA) {
    // 2. 警告を出す前に、BootScreen や Loading 画面を含め全てのUIを「強制消去」する
    hideAllScreens();
    if (bootScreen) bootScreen.style.setProperty("display", "none", "important");
    if (loadingScreen) loadingScreen.style.setProperty("display", "none", "important");

    // 3. 警告画面を取得、なければ作成して最前面に表示
    let warning = document.getElementById("mobileWarning");
    if (!warning) {
      warning = document.createElement("div");
      warning.id = "mobileWarning";
      document.body.appendChild(warning);
    }

    warning.style.setProperty("display", "flex", "important");
    warning.innerHTML = `
      <div>
        <h2>PC Only Game</h2>
        <p>このゲームはPCおよび物理キーボード専用です。<br>
        スマートフォンやタブレットには対応しておりません。</p>
        <p style="margin-top:20px; color:#888;">PCからアクセスしてプレイしてください。</p>
      </div>
    `;
    document.body.appendChild(warning);
    return true;
  }
  return false;
}