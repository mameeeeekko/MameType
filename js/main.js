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
  importQuestData,
} from "./storage.js";
import { startQuestSession, stopQuestSession, resetQuestSession, flushQuestSessionTime } from "./storage.js";
import * as Game from "./gameCore.js";
import { gameState, getLastSpecialModeInfo, getPaused, setPaused, backToMenu, getNow } from "./gameCore.js";
import { GameModes } from "./gameModes.js";
import { getPlayerStats } from "./playerStats.js"; 
import { updateHud, initAchievementsUI, showHud } from "./hud.js"; export { showHud };
import { handleKey } from './inputCore.js';
import { startEnemyMode, endEnemyMode, handleEnemyKey, restartEnemyMode, wasLastModeBossOnly } from "./enemyCore.js";
import { renderQuestMapUI, openQuestMenuModal, closeQuestModal } from "./questMapUI.js";
import { reloadQuestProgress, resetQuestAll, hasSeenTrueEnding as hasSeenTrueEndingInAutoSave } from "./questProgress.js";
import { hasBossChallengeUnlocked, hasFreeActiveSkillUnlocked, hasExtraCleared } from "./questProgress.js";
import { openFreeSkillSelectModal, openFreeStarUpgradeModal, handleFreeSkillModalKey, clampFreeSkillStarLevel, FREE_SKILL_STAR_MAX_LEVEL, getFreeSkillStarTimeFactor, getFreeSkillInfo } from "./freeSkillUI.js";
import { reloadQuestPlayerStats } from "./questPlayerStats.js";
import { getClearRewardHtml, getExtraClearRewardHtml } from "./questResult.js";
// ★EXTRA CLEAR 特典：ミュージックプレイヤー（トップメニューの MUSIC）
import { initMusicPlayer, openMusicModal, closeMusicModal, handleMusicModalKey } from "./musicPlayer.js";
import { getPlayerId, getPlayerName, setPlayerName, isOnlineEnabled, setOnlineEnabled, setPlayerId, getRecoveryCode, setRecoveryCode } from "../online/playerProfile.js";
import { openOnlineRanking, closeOnlineRanking } from "../online/onlineRankingRenderer.js";
import { APP_VERSION } from "./version.js";
import { startDialogue, closeDialogue, isDialogueVisible, setDialogueSpeed, showDisclaimer } from "./dialogue.js";
import { loadCoreAssets, loadRemainingAssets, images, collectOfflineAssetUrls, getBgmAssets } from "./assetsLoader.js";
import { loadKeybinds, saveKeybinds, initKeybinds, isBoundKey } from "./keybinds.js";
import { getRenderQuality, setRenderQuality } from "./canvasUtil.js";
import { ensureFullscreenButton, bindFullscreenToggle, initGlobalUiBar } from "./fullscreenUtil.js";
import { fitStage, getStageScale } from "./stageScale.js";
import { enableAdaptiveShadowControl, getProfile } from "./performance.js";
import { clearQuestStageCache, TIER_TABLES, getTierEnemies, STAGES } from "./enemyModeConfig.js";
import "../dev/devTools.js";
import {
  getCurrentDifficulty,
  setCurrentDifficulty,
  getDifficultyDescription,
  getAvailableDifficulties,
} from "./difficulties.js";
import { playSE, stopBGM, stopAllLoopSE, fadeBGMTo, fadeOutBGM, BGM_CONFIG } from "./effectManager.js";
import { handleDefenseKey, restartDefenseMode } from "./defenseCore.js";
// ★v1.0.42: supabase は静的importしない（オフライン起動対策）。
//   supabase.js は https://esm.sh を静的importしており、ネットワークが
//   無いとモジュール解決に失敗してアプリ全体が起動できなくなるため、
//   オンライン認証を行う瞬間だけ動的importする（online/loadSupabase.js）。
import { loadSupabase } from "../online/loadSupabase.js";
import { startDefenseMode } from "./defenseCore.js";
import { showSaveDataNoticeOnce } from "./saveDataNotice.js";

// ================================
// 🔹Safari判定（アップデート表示の分岐用）
// ================================
// ★Safariは中央下ダウンロードバーが0%で固まる問題があるため、
//   バーを出さず設定のステータス文のみで進捗を伝える。
//   UA判定: "safari" を含み、chrome/crios/edg/android を含まない場合に true
//   （Chrome/Edge の UA にも "Safari" が含まれるため、否定先読みで除外する）。
let isSafari = false;
try {
  const ua = navigator.userAgent || "";
  isSafari = /^((?!chrome|android|crios|edg).)*safari/i.test(ua);
} catch (e) { /* 判定失敗時は無視 */ }

// =====================================================
// 🎮 ゲームプレイ状態の判定（裏読み込みのスロットリング用）
// =====================================================
export function isGameplayActive() {
  const ids = ["game", "enemyModeContainer", "defenseModeContainer"];
  return ids.some(id => {
    const el = document.getElementById(id);
    if (!el) return false;
    const d = el.style.display;
    return d !== "" && d !== "none";
  });
}
window.isGameplayActive = isGameplayActive;

// ================================
// 🔹デイリーモードの固定設定
// ================================
// デイリーのStandard / TimeAttackでは英語タグの単語を除外して出題する（固定設定）
const DAILY_EXCLUDED_TAGS = ["英語"];

// ================================
// 🔹DOM参照（グローバル）
// ================================
let bootScreen = null;
let loadingScreen = null;

let menuBackground, menuDiv, startMenuDiv, questMenuDiv, freeStartMenuDiv;
let settingsDiv, gameDiv, resultDiv, recordsDiv;
let questMapScreen, questSaveMenuDiv, skillTreeDiv;
let clearRewardModalDiv;
let hintDiv;
let onlineRankingDiv;

let startMenuBtn, questMenuBtn, freeModeBtn, recordsMenuBtn, onlineRankingBtn, endingBtn;
// ★EXTRA CLEAR 特典：トップメニューの MUSIC ボタン
let musicMenuBtn;
let startMenuBackBtn, freeStartMenuBackBtn, questStartMenuBackBtn;
let saveToQuestMenuBackBtn, questSaveBtn;
let questClearRewardBtn;

let enemyModeBtn, freeEnemyModeBtn, questStartBtn, questStartBtnFromBeginning, freeDefenseModeBtn;
let startBtn, timeAttackBtn, longTextBtn;
let freeStartBtn, freeTimeAttackBtn, freeLongTextBtn, defenseModeBtn, freeBossBtn; // defenseModeBtn を追加

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
// ★ クエストマップのキー設定モーダル用DOM変数
let keybindConfigModal, keybindConfigCloseBtn, keybindConfigSaveBtn, keybindConfigContent;
let playerLvRange;
let enemyIntervalSlider, enemyImmediateToggle;
let currentFreeModeId = 'Standard'; // フリーモードの選択状態を保持する変数
let currentEnemyPattern = 'time'; // エネミーモード内のパターン選択状態

// ★全クリア特典：フリーモード（ENEMY）用アクティブスキル設定（クエストとは独立）
let currentFreeSkillId = null;      // 選択中のスキルID（null = なし）
let currentFreeSkillStockMax = 1;   // ストック上限（1〜5）
let currentFreeSkillStarLevel = 0;  // フリー専用の星強化レベル（0〜10）

// ★全クリア特典：フリーモード（QUEST BOSS）用アクティブスキル設定（ENEMYとは独立）
let currentFreeBossSkillId = null;
let currentFreeBossSkillStockMax = 1;
let currentFreeBossSkillStarLevel = 0;

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
  clearRewardModalDiv = document.getElementById("clearRewardModal");
  skillTreeDiv = document.getElementById("skillTree");
  hintDiv = document.getElementById("skillUnlockHint");
  onlineRankingDiv = document.getElementById("onlineRankingScreen");

  startMenuBtn = document.getElementById("startMenuBtn"); //デイリー
  questMenuBtn = document.getElementById("questMenuBtn");
  freeModeBtn = document.getElementById("freeModeBtn");
  recordsMenuBtn = document.getElementById("recordsMenuBtn");
  onlineRankingBtn = document.getElementById("onlineRankingBtn");
  musicMenuBtn = document.getElementById("musicMenuBtn"); // ★EXTRA CLEAR 特典：MUSIC
  startMenuBackBtn = document.getElementById("startMenuBackBtn");
  freeStartMenuBackBtn = document.getElementById("freeStartMenuBackBtn");
  questStartMenuBackBtn = document.getElementById("questStartMenuBackBtn");
  saveToQuestMenuBackBtn = document.getElementById("saveToQuestMenuBackBtn");
  questSaveBtn = document.getElementById("questSaveBtn");
  questClearRewardBtn = document.getElementById("questClearRewardBtn");

  enemyModeBtn = document.getElementById("enemyModeBtn");
  freeEnemyModeBtn = document.getElementById("freeEnemyModeBtn");
  questStartBtn = document.getElementById("questStartBtn");
  questStartBtnFromBeginning = document.getElementById("questStartBtnFromBeginning");
  startBtn = document.getElementById("startBtn");
  timeAttackBtn = document.getElementById("timeAttackBtn");
  longTextBtn = document.getElementById("longTextBtn");
  defenseModeBtn = document.getElementById("defenseModeBtn"); // defenseModeBtn を取得
  freeStartBtn = document.getElementById("freeStartBtn");
  freeDefenseModeBtn = document.getElementById("freeDefenseModeBtn"); // freeDefenseModeBtn を取得
  freeBossBtn = document.getElementById("freeBossBtn"); // ★QUEST BOSSボタン（全クリア特典）を取得
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

  // ★ クエストマップのキー設定モーダルDOMキャッシュ
  keybindConfigModal = document.getElementById("keybindConfigModal");
  keybindConfigCloseBtn = document.getElementById("keybindConfigCloseBtn");
  keybindConfigSaveBtn = document.getElementById("keybindConfigSaveBtn");
  keybindConfigContent = document.getElementById("keybindConfigContent");

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

// =====================================================
// バックグラウンド読み込みインジケータ（中央下）
// メニュー表示後に残りアセットを裏で読んでいる間だけ表示する
// =====================================================
let _remainingLoadShown = false;
let _remainingLoadTimer = null;

function showRemainingLoadIndicator() {
  _remainingLoadShown = true;
  const el = document.getElementById("remainingLoadIndicator");
  if (el) el.classList.add("show");
  const fill = document.getElementById("remainingLoadBarFill");
  if (fill) fill.style.width = "0%";
}

function updateRemainingLoadProgress(loaded, total) {
  const fill = document.getElementById("remainingLoadBarFill");
  if (fill) {
    const pct = total > 0 ? Math.min(100, Math.floor((loaded / total) * 100)) : 100;
    fill.style.width = `${pct}%`;
  }
  const text = document.querySelector("#remainingLoadIndicator .remaining-load-text");
  if (text) {
    text.textContent = `アセット読み込み中… ${total > 0 ? Math.floor((loaded / total) * 100) : 100}%`;
  }
}

function completeRemainingLoad() {
  if (!_remainingLoadShown) return; // 一瞬で終わった場合は出さない
  const fill = document.getElementById("remainingLoadBarFill");
  if (fill) fill.style.width = "100%";
  const text = document.querySelector("#remainingLoadIndicator .remaining-load-text");
  if (text) text.textContent = "読み込み完了";

  // 少し見せてからフェードアウトし、次回用に初期化
  clearTimeout(_remainingLoadTimer);
  _remainingLoadTimer = setTimeout(() => {
    const el = document.getElementById("remainingLoadIndicator");
    if (el) el.classList.remove("show");
    setTimeout(() => {
      if (text) text.textContent = "アセット読み込み中…";
      _remainingLoadShown = false;
    }, 400);
  }, 2500);
}

// 残りアセットの読み込みを開始し、進捗をインジケータに表示する
function startRemainingLoadProgress() {
  // 読み込みが一瞬で終わる(キャッシュ済み)場合は出さないよう少し待ってから表示
  clearTimeout(_remainingLoadTimer);
  _remainingLoadTimer = setTimeout(() => showRemainingLoadIndicator(), 700);

  loadRemainingAssets((loaded, total) => {
    if (loaded >= total) {
      clearTimeout(_remainingLoadTimer);
      completeRemainingLoad();
    } else {
      updateRemainingLoadProgress(loaded, total);
    }
  });
}

// =====================================================
// ★オフライン用キャッシュ版の記録・取得
//   「オンライン（実行中）vX」と「オフラインで動く版 vY」を
//   分けて表示するための localStorage 管理。
//   保存タイミング: 適用開始（再起動直前）・初回DL完了
// =====================================================
const CACHE_VERSION_KEY = "mametype_applied_version";

function _markCacheVersion(version) {
  try {
    localStorage.setItem(CACHE_VERSION_KEY, version || APP_VERSION);
  } catch (e) { /* localStorage不可は無視 */ }
}

function _getCacheVersion() {
  try {
    return localStorage.getItem(CACHE_VERSION_KEY) || "";
  } catch (e) {
    return "";
  }
}

// =====================================================
// ★バージョン表示（設定画面の VERSION 欄）
// -----------------------------------------------------
//  ★v1.0.42: アップデートを促すモーダルは自動表示しない方針に変更。
//    バージョンの状況は「設定を開いたときにこの文章で伝える」だけにする。
// =====================================================
let _onlineLatestVersion = "";

function _setVersionStatus(text) {
  const el = document.getElementById("updateCheckStatus");
  if (el) el.textContent = text;
}

/**
 * オフライン用キャッシュが実際に保存されているかを判定する。
 * localStorage に記録があればそれを返し、無ければ Cache Storage（mametype-app）を照会する。
 * キャッシュ内に index.html が実在すれば、localStorage が欠落していても自動復元する。
 */
async function _detectOfflineCacheVersion() {
  const cached = _getCacheVersion();
  if (cached) return cached;

  if ("caches" in window) {
    try {
      const hasApp = await caches.has(OFFLINE_APP_CACHE);
      if (hasApp) {
        const appCache = await caches.open(OFFLINE_APP_CACHE);
        const match = await appCache.match(new Request(new URL("./index.html", location.href).href), { ignoreVary: true })
                   || await appCache.match(new Request(new URL("./", location.href).href), { ignoreVary: true });
        if (match) {
          // キャッシュが実在するので localStorage にも復元
          _markCacheVersion(APP_VERSION);
          return APP_VERSION;
        }
      }
    } catch (e) { /* 無視 */ }
  }
  return "";
}

function _updateOfflineVersionLabel(cached) {
  const el = document.getElementById("offlineVersionLabel");
  if (!el) return;

  if (cached) {
    el.textContent = `v${cached}`;
    el.classList.remove("no-offline");
  } else {
    el.textContent = "−";
    el.classList.add("no-offline");
  }
}

function _renderVersionStatus(cached) {
  const isOnline = typeof navigator === "undefined" || navigator.onLine !== false;
  const runningLabel = isOnline ? "オンライン（実行中）" : "オフライン（実行中）";
  const parts = [`${runningLabel}: v${APP_VERSION}`];

  if (cached && cached === APP_VERSION) {
    parts.push(`オフライン用（DL済み）: v${cached}`);
  } else if (cached) {
    parts.push(`オフライン用（DL済み）: v${cached}（更新できます）`);
  } else {
    parts.push("オフライン用: 未ダウンロード（オフライン用にダウンロードを実行してください）");
  }

  if (_onlineLatestVersion && _onlineLatestVersion !== APP_VERSION) {
    parts.push(`新しいバージョン v${_onlineLatestVersion} があります`);
  }

  if (currentServiceWorkerRegistration && currentServiceWorkerRegistration.waiting) {
    parts.push("更新の適用待ち（再起動で反映できます）");
  }

  _setVersionStatus(parts.join(" ／ "));
  _updateOfflineVersionLabel(cached);
}

function _refreshVersionStatus() {
  // まず同期的に即時描画
  const cachedSync = _getCacheVersion();
  _renderVersionStatus(cachedSync);

  // localStorage に無い場合、Cache Storage の実在を非同期で確認して更新・復元
  if (!cachedSync) {
    _detectOfflineCacheVersion().then(cachedAsync => {
      if (cachedAsync) {
        _renderVersionStatus(cachedAsync);
      }
    });
  }
}

/** タイトル下のバージョン表示を初期化 */
function _initTitleVersionLabels() {
  // 実行中バージョン
  const versionLabel = document.getElementById("versionLabel");
  if (versionLabel) versionLabel.textContent = `v${APP_VERSION}`;

  // オフライン版バージョン（非同期で取得）
  _refreshVersionStatus();
}
// ============================================================
// オフライン用データの手動ダウンロード
// ------------------------------------------------------------
//  ★v1.0.42: Service Worker 側の裏処理を廃止し、ページ側から直接
//   Cache Storage へ書き込む方式に変更した。
//
//  ・なぜ変えたか
//    旧実装は postMessage でSWに依頼するだけだったため、
//    進捗も完了も失敗もページに伝わらず、さらに
//    「押した瞬間に“最新版です”と表示される（実際は1件も保存していない）」
//    という誤表示が起きていた。
//  ・新実装の要点
//    ① 対象URLをリスト化してから開始する（対象件数を最初に確定）
//    ② 進捗は「取得件数 / 総件数」の実測値を表示する
//    ③ 完了後は全URLをキャッシュへ照会して検証してから完了を表示する
//    ④ 自動では走らない（設定のボタンを押したときだけ実行）
//
//  ※キャッシュ名は service-worker.js の OFFLINE_APP_CACHE /
//    OFFLINE_ASSET_CACHE と必ず揃えること。
//  ※サービスワーカーの fetch はオフライン時に caches.match() で
//    全キャッシュを検索するため、ここで書き込んだ内容がそのまま
//    オフライン起動・オフライン再生に使われる。
// ============================================================
const OFFLINE_APP_CACHE = "mametype-app";       // アプリ本体（html / css / js）
const OFFLINE_ASSET_CACHE = "mametype-assets";  // 画像・音声・フォント
const OFFLINE_DL_CONCURRENCY = 4;               // 同時取得数

// アプリ本体（オフライン起動に必要なファイル。追加時はここにも追記する）
const OFFLINE_APP_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",

  // コアJS
  "./js/main.js",
  "./js/saveDataNotice.js",
  "./js/fullscreenUtil.js",
  "./js/stageScale.js",
  "./js/gameCore.js",
  "./js/enemyCore.js",
  "./js/defenseCore.js",
  "./js/inputCore.js",
  "./js/renderer.js",
  "./js/assetsLoader.js",
  "./js/dialogue.js",
  "./js/dialogue.css",
  "./js/dialogueData.js",
  "./js/hud.js",
  "./js/playerStats.js",
  "./js/storage.js",
  "./js/gameModes.js",
  "./js/difficulties.js",
  "./js/target.js",
  "./js/romaUtils.js",
  "./js/typingLogic.js",
  "./js/version.js",
  "./js/analytics.js",
  // ★EXTRA CLEAR 特典：ミュージックプレイヤー
  "./js/musicPlayer.js",

  // クエスト / スキルツリー
  "./js/canvasUtil.js",
  "./js/performance.js",
  "./js/keybinds.js",
  "./js/questMap.js",
  "./js/questMapUI.js",
  "./js/questProgress.js",
  "./js/questPlayerStats.js",
  "./js/questResult.js",
  "./js/questSkills.js",
  "./js/skillTree.js",
  "./js/skillTreeUI.js",
  "./js/skillTreeResult.js",

  // 敵 / 描画 / エフェクト
  "./js/enemy.js",
  "./js/enemySpawner.js",
  "./js/enemyRenderer.js",
  "./js/enemyResult.js",
  "./js/enemyModeConfig.js",
  "./js/effectManager.js",
  "./js/defenseRenderer.js",
  "./js/defenseResult.js",
  "./js/shapeDefinitions.js",
  "./js/starEvaluator.js",
  "./js/recordsView.js",
  "./js/resultView.js",

  // オンライン機能（オフライン起動時もモジュールとして読み込まれる）
  "./online/loadSupabase.js",
  "./online/supabase.js",
  "./online/playerProfile.js",
  "./online/submitScore.js",
  "./online/getRanking.js",
  "./online/onlineRankingRenderer.js",

  // 開発ツール
  "./dev/devOverride.js",
  "./dev/devTools.js",
];
let _offlineModalActive = false;
let _offlineModalBlockKeybinds = true;

// ダウンロード処理の状態
let _offlineDlRunning = false;
let _offlineDlCancelled = false;
let _offlineDlAbort = null;
let _offlineDlFailed = [];
let _offlineDlStat = { fetched: 0, reused: 0, total: 0 };

function _showOfflineDownloadModal() {
  const modal = document.getElementById("offlineDownloadModal");
  if (!modal) return;

  _offlineModalActive = true;
  _offlineModalBlockKeybinds = true;
  modal.classList.remove("hidden");
}

function _hideOfflineDownloadModal() {
  const modal = document.getElementById("offlineDownloadModal");
  if (!modal) return;

  modal.classList.add("hidden");
  _offlineModalActive = false;
  _offlineModalBlockKeybinds = false;
}

function _updateOfflineModalProgress(percent, detail) {
  const safe = Math.max(0, Math.min(100, Math.floor(Number(percent) || 0)));

  const progressFill = document.getElementById("offlineDlProgressFill");
  const progressText = document.getElementById("offlineDlProgressText");
  const detailEl = document.getElementById("offlineDlDetail");

  if (progressFill) progressFill.style.width = `${safe}%`;
  if (progressText) progressText.textContent = `${safe}%`;
  if (detailEl) detailEl.textContent = detail || "";
}

function _setOfflineModalStatus(status) {
  const statusEl = document.getElementById("offlineDlStatus");
  if (statusEl) statusEl.textContent = status;
}

/**
 * モーダル下部のボタンを差し替える
 * @param {Array<{label:string, onClick:Function, primary?:boolean, disabled?:boolean}>} defs
 */
function _setOfflineModalButtons(defs) {
  const wrap = document.getElementById("offlineDlButtons");
  if (!wrap) return;

  wrap.innerHTML = "";

  (defs || []).forEach(def => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "offline-dl-action-btn" + (def.primary ? " primary" : "");
    btn.textContent = def.label;
    btn.disabled = !!def.disabled;
    btn.addEventListener("click", () => {
      try { def.onClick?.(); } catch (e) { /* ボタン処理の失敗で固まらないようにする */ }
    });
    wrap.appendChild(btn);
  });
}

/** URLのファイル名だけを取り出す（進捗表示用） */
function _shortName(url) {
  try {
    const raw = decodeURIComponent(String(url).split("/").pop() || url);
    return raw.length > 26 ? `${raw.slice(0, 24)}…` : raw;
  } catch (e) {
    return "";
  }
}

/** 進捗（実測値）をモーダルへ反映する */
function _reportOfflineProgress(detail) {
  const done = _offlineDlStat.fetched + _offlineDlStat.reused;
  const total = _offlineDlStat.total || 0;
  const percent = total > 0 ? Math.floor((done / total) * 100) : 0;

  _updateOfflineModalProgress(
    percent,
    // `取得 ${_offlineDlStat.fetched} ・ 既存 ${_offlineDlStat.reused} ／ 全 ${total} 件${detail ? `　${detail}` : ""}`
    `${done} ／ ${total} 件${detail ? `　${detail}` : ""}`
  );
}

/** URL文字列の配列を絶対URL化して重複除去する */
function _uniqueUrls(urls) {
  const out = [];
  const seen = new Set();

  for (const u of urls || []) {
    const href = typeof u === "string" ? u : (u && u.href) || "";
    if (!href || seen.has(href)) continue;
    seen.add(href);
    out.push(href);
  }

  return out;
}
/**
 * Service Worker へ問い合わせて「キャッシュすべきURLの一覧」を取得する。
 * 旧バージョンのSW（このメッセージを知らない）場合は null を返す。
 */
function _requestOfflineManifest() {
  return new Promise(resolve => {
    if (!("serviceWorker" in navigator)) { resolve(null); return; }

    const sw = navigator.serviceWorker;
    const target =
      sw.controller ||
      (currentServiceWorkerRegistration && currentServiceWorkerRegistration.active);

    if (!target) { resolve(null); return; }

    let settled = false;

    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { sw.removeEventListener("message", onMessage); } catch (e) { /* 無視 */ }
      resolve(value);
    };

    const onMessage = (event) => {
      const data = event.data;
      if (!data || data.type !== "OFFLINE_MANIFEST") return;
      finish(data);
    };

    const timer = setTimeout(() => finish(null), 6000);

    try {
      sw.addEventListener("message", onMessage);
      target.postMessage({ type: "GET_OFFLINE_MANIFEST" });
    } catch (e) {
      finish(null);
    }
  });
}

/**
 * アプリ本体（html / css / js）のURL一覧。
 * 固定リストに加えて、実際に読み込まれた同一オリジンのJS/CSSを合算する
 * （リストへの追記漏れがあってもオフライン起動が壊れないようにするため）。
 */
function _collectAppUrls() {
  const urls = [];

  for (const p of OFFLINE_APP_FILES) {
    try { urls.push(new URL(p, location.href).href); } catch (e) { /* 不正URLは無視 */ }
  }

  try {
    for (const entry of performance.getEntriesByType("resource")) {
      let u;
      try { u = new URL(entry.name); } catch (e) { continue; }
      if (u.origin !== location.origin) continue;
      if (!/\.(?:js|mjs|css|html|json)$/i.test(u.pathname)) continue;
      urls.push(u.href);
    }
  } catch (e) { /* 無視 */ }

  return urls;
}

/**
 * URLを並列でキャッシュへ書き込む
 * @param {Cache} cache 書き込み先
 * @param {string[]} urls 対象URL（絶対URL）
 * @param {boolean} skipExisting キャッシュ済みのものをスキップするか
 * @param {Function} [onOne] 1件完了ごとのコールバック (url, status)
 */
async function _pullUrlsToCache(cache, urls, skipExisting, onOne) {
  if (!urls.length) return;

  let index = 0;
  const workerCount = Math.max(1, Math.min(OFFLINE_DL_CONCURRENCY, urls.length));

  const worker = async () => {
    while (!_offlineDlCancelled) {
      const i = index++;
      if (i >= urls.length) return;

      const url = urls[i];
      let status = "fetched";

      try {
        const request = new Request(url);

        if (skipExisting && await cache.match(request, { ignoreVary: true })) {
          status = "reused";
        } else {
          // fetchの既定のキャッシュモード（HTTPキャッシュを再利用）で取得する
          const res = await fetch(
            request,
            _offlineDlAbort ? { signal: _offlineDlAbort.signal } : undefined
          );
          if (!res || !res.ok) {
            throw new Error(`HTTP ${res ? res.status : "no response"}: ${url}`);
          }
          await cache.put(request, res.clone());
        }
      } catch (e) {
        if (_offlineDlCancelled) return; // キャンセルによる中断は失敗に数えない
        status = "failed";
        _offlineDlFailed.push(url);
        console.warn("[offline] 取得に失敗:", url, e);
      }

      if (status === "fetched") _offlineDlStat.fetched++;
      else if (status === "reused") _offlineDlStat.reused++;

      try { onOne?.(url, status); } catch (e) { /* 無視 */ }
    }
  };

  const workers = [];
  for (let w = 0; w < workerCount; w++) workers.push(worker());
  await Promise.all(workers);
}

/** 全URLがキャッシュに入っているか照会し、欠落しているURLを返す */
async function _findMissingUrls(urls) {
  const opened = [];

  try {
    opened.push(await caches.open(OFFLINE_APP_CACHE));
    opened.push(await caches.open(OFFLINE_ASSET_CACHE));
  } catch (e) {
    return urls.slice(); // キャッシュを開けない＝全滅扱い
  }

  const missing = [];

  for (const url of urls) {
    if (_offlineDlCancelled) break;

    const request = new Request(url);
    let found = false;

    for (const cache of opened) {
      if (await cache.match(request, { ignoreVary: true })) {
        found = true;
        break;
      }
    }

    if (!found) missing.push(url);
  }

  return missing;
}
/** ダウンロード中のキャンセル操作 */
function _cancelOfflineDownload() {
  _offlineDlCancelled = true;
  _setOfflineModalStatus("キャンセルしています…");
  try { _offlineDlAbort?.abort(); } catch (e) { /* 無視 */ }
}

/**
 * ダウンロード処理の後始末（ボタンと状態を戻す）
 * @param {"done"|"cancelled"} reason
 */
function _finishOfflineDownload(reason) {
  _offlineDlRunning = false;
  _offlineDlCancelled = false;

  const checkUpdateBtn = document.getElementById("checkUpdateBtn");
  if (checkUpdateBtn) checkUpdateBtn.disabled = false;

  if (reason === "cancelled") {
    _setOfflineModalStatus("ダウンロードを中断しました。");
    _setOfflineModalButtons([
      { label: "閉じる", onClick: () => _hideOfflineDownloadModal(), primary: true },
    ]);
    _refreshVersionStatus();
    return;
  }

  // -----------------------------------------------
  // 完了（全件キャッシュ済みであることを検証済み）
  // -----------------------------------------------
  const counts = _offlineDlStat;
  const done = counts.fetched + counts.reused;
  // ★本当に保存できたときだけ「オフライン用の版」を記録する
  _markCacheVersion(APP_VERSION);

  _updateOfflineModalProgress(
    100,
    //`取得 ${counts.fetched} ・ 既存 ${counts.reused} ／ 全 ${counts.total} 件`
    `${done} ／ ${counts.total} 件`
  );
  _setOfflineModalStatus("ダウンロードが完了しました。オフラインでも遊べます。");

  const buttons = [
    { label: "OK", onClick: () => _hideOfflineDownloadModal(), primary: true },
  ];

  // 新バージョンの適用待ちなら、そのまま適用（再起動）できるようにする
  if (currentServiceWorkerRegistration && currentServiceWorkerRegistration.waiting) {
    buttons.unshift({
      label: "更新を適用して再起動",
      onClick: () => {
        _hideOfflineDownloadModal();
        _applyWaitingUpdate();
      },
    });
  }

  _setOfflineModalButtons(buttons);
  _refreshVersionStatus();
}
/**
 * オフライン用データを手動ダウンロードする
 * @param {{force?:boolean}} [options] force=true で全データを取り直す
 */
async function downloadOfflineData(options = {}) {
  const force = !!options.force;

  if (_offlineDlRunning) return;

  if (!("caches" in window)) {
    _setVersionStatus("この環境ではオフライン用データを保存できません（Cache Storage 非対応）。");
    return;
  }

  const checkUpdateBtn = document.getElementById("checkUpdateBtn");

  _offlineDlRunning = true;
  _offlineDlCancelled = false;
  _offlineDlFailed = [];
  _offlineDlStat = { fetched: 0, reused: 0, total: 0 };
  try {
    _offlineDlAbort = ("AbortController" in window) ? new AbortController() : null;
  } catch (e) {
    _offlineDlAbort = null;
  }

  if (checkUpdateBtn) checkUpdateBtn.disabled = true;

  _showOfflineDownloadModal();
  _setOfflineModalStatus("ダウンロードの準備中…");
  _updateOfflineModalProgress(0, "");
  _setOfflineModalButtons([{ label: "キャンセル", onClick: _cancelOfflineDownload }]);

  try {
    if (!navigator.onLine) {
      throw new Error("オフラインのためダウンロードできません。ネットワークに接続してください。");
    }

    // ------------------------------------------------------------
    // ① 対象URLを確定する（件数を最初に確定＝進捗が正しく出せる）
    // ------------------------------------------------------------
    const manifest = await _requestOfflineManifest();
    const manifestUrls = (manifest && Array.isArray(manifest.urls)) ? manifest.urls : [];

    const appUrls = _uniqueUrls(_collectAppUrls().concat(manifestUrls)).filter(href => {
      try {
        const u = new URL(href);
        return u.origin === location.origin && !u.pathname.includes("/assets/");
      } catch (e) { return false; }
    });

    const manifestAssetUrls = manifestUrls.filter(href => {
      try {
        const u = new URL(href);
        return u.origin === location.origin && u.pathname.includes("/assets/");
      } catch (e) { return false; }
    });

    const collectedAssetUrls = await collectOfflineAssetUrls();
    const fallbackAssetUrls = [
      new URL("./assets/pic/sound1.png", location.href).href,
      new URL("./assets/pic/soundmute.png", location.href).href,
    ];

    const assetUrls = _uniqueUrls(
      manifestAssetUrls.concat(collectedAssetUrls).concat(fallbackAssetUrls)
    ).filter(href => {
      try { return new URL(href).origin === location.origin; } catch (e) { return false; }
    });

    const allUrls = _uniqueUrls(appUrls.concat(assetUrls));
    if (!allUrls.length) throw new Error("ダウンロード対象が見つかりませんでした。");

    _offlineDlStat.total = allUrls.length;
    _reportOfflineProgress("");

    const appCache = await caches.open(OFFLINE_APP_CACHE);
    const assetCache = await caches.open(OFFLINE_ASSET_CACHE);
// ------------------------------------------------------------
    // ② アプリ本体（数MB）は毎回取得して最新に揃える
    // ------------------------------------------------------------
    _setOfflineModalStatus(`アプリ本体をダウンロード中…（全${allUrls.length}件）`);
    await _pullUrlsToCache(appCache, appUrls, false, url => {
      _reportOfflineProgress(`本体: ${_shortName(url)}`);
    });

    if (_offlineDlCancelled) { _finishOfflineDownload("cancelled"); return; }

    // ------------------------------------------------------------
    // ③ 画像・音声・フォントは「未取得のものだけ」取得する
    //    （force 指定時はキャッシュ済みでも取り直す）
    // ------------------------------------------------------------
    _setOfflineModalStatus(`アセットをダウンロード中…（全${allUrls.length}件）`);
    await _pullUrlsToCache(assetCache, assetUrls, !force, url => {
      _reportOfflineProgress(`アセット: ${_shortName(url)}`);
    });

    if (_offlineDlCancelled) { _finishOfflineDownload("cancelled"); return; }

    // ------------------------------------------------------------
    // ④ 検証: 本当に全件キャッシュへ入ったかを確認する
    // ------------------------------------------------------------
    _setOfflineModalStatus("保存内容を確認しています…");
    _updateOfflineModalProgress(100, "");
    const missing = await _findMissingUrls(allUrls);

    if (_offlineDlCancelled) { _finishOfflineDownload("cancelled"); return; }

    if (missing.length) {
      // 保存できなかったものがある場合は、完了にせず再試行できるようにする
      _offlineDlFailed = missing;
      _offlineDlRunning = false;
      if (checkUpdateBtn) checkUpdateBtn.disabled = false;

      _setOfflineModalStatus(
        `一部のデータを保存できませんでした（${missing.length}件）。再試行してください。`
      );
      _updateOfflineModalProgress(
        _offlineDlStat.total > 0
          ? Math.floor(((_offlineDlStat.fetched + _offlineDlStat.reused) / _offlineDlStat.total) * 100)
          : 0,
        `取得 ${_offlineDlStat.fetched} ・ 既存 ${_offlineDlStat.reused} ・ 未保存 ${missing.length}`
      );
      _setOfflineModalButtons([
        { label: "再試行", onClick: () => downloadOfflineData(), primary: true },
        { label: "閉じる", onClick: () => _hideOfflineDownloadModal() },
      ]);
      _refreshVersionStatus();
      return;
    }

    _finishOfflineDownload("done");

  } catch (e) {
    console.warn("[offline] ダウンロードに失敗:", e);

    _offlineDlRunning = false;
    if (checkUpdateBtn) checkUpdateBtn.disabled = false;

    _setOfflineModalStatus(
      (e && e.message) ? e.message : "ダウンロードに失敗しました。ネットワーク接続を確認してください。"
    );
    _setOfflineModalButtons([
      { label: "再試行", onClick: () => downloadOfflineData(), primary: true },
      { label: "閉じる", onClick: () => _hideOfflineDownloadModal() },
    ]);
    _refreshVersionStatus();
  }
}
// =====================================================
// 待機中の Service Worker へ更新適用（再起動）を指示する
// -----------------------------------------------------
//  ★自動では実行しない。ユーザーが「更新を適用して再起動」を
//  押したときだけ動く（勝手な再起動を避けるため）。
// =====================================================
let _applyReloading = false;

function _applyWaitingUpdate() {
  if (_applyReloading || isApplyingUpdate) return;

  const reg = currentServiceWorkerRegistration;

  if (!reg || !reg.waiting) {
    _setVersionStatus("適用できる更新が見つかりませんでした。ページを再読み込みしてください。");
    return;
  }

  isApplyingUpdate = true;
  _applyReloading = false;
  _setVersionStatus("アップデートを適用しています…自動で再起動します");

  if (updateControllerChangeHandler) {
    try {
      navigator.serviceWorker.removeEventListener("controllerchange", updateControllerChangeHandler);
    } catch (e) { /* 無視 */ }
  }

  updateControllerChangeHandler = () => {
    if (_applyReloading) return;
    _applyReloading = true;
    // ★オフライン用キャッシュ版として今回の版を記録
    _markCacheVersion(APP_VERSION);
    console.log("Service Worker: Controller changed. Reloading...");
    setTimeout(() => window.location.reload(), 300);
  };

  try {
    navigator.serviceWorker.addEventListener("controllerchange", updateControllerChangeHandler);
  } catch (e) { /* 無視 */ }

  try {
    reg.waiting.postMessage({ type: "SKIP_WAITING" });
  } catch (e) { /* 無視 */ }

  // 保険: controllerchange が届かなくても再読み込みする
  setTimeout(() => {
    if (_applyReloading) return;
    _applyReloading = true;
    _markCacheVersion(APP_VERSION);
    window.location.reload();
  }, 8000);
}
// ============================================================
// メニュー描画のキャッシュ無効化フック（循環参照回避のためwindow経由）
// questProgress.js の markCleared / markTrueEndingSeen 等から呼ばれる
// ============================================================
function markDifficultySelectorsDirty() {
  try {
    if (typeof updateAllDifficultySelectors === "function") {
      updateAllDifficultySelectors._dirty = true;
    }
  } catch (e) { /* 無視 */ }
}
function resetFreeBossUnlockCache() {
  try {
    if (typeof showFreeStartMenu === "function") {
      showFreeStartMenu._bossUnlocked = undefined;
      showFreeStartMenu._availCount = undefined;
    }
  } catch (e) { /* 無視 */ }
}
function resetMusicUnlockCache() {
  // ★現行の MUSIC ボタン／フリーードBGM選択行は表示時に毎回 hasExtraCleared() を再判定するため、
  //   メモリ上の解放キャッシュは持たない（解放直後に開いた場合も正しく判定される）。
  try {
    if (typeof showMainMenu === "function") {
      showMainMenu._musicUnlocked = undefined;
    }
    if (typeof showFreeStartMenu === "function") {
      showFreeStartMenu._musicUnlocked = undefined;
    }
  } catch (e) { /* 無視 */ }
}
try {
  if (typeof window !== "undefined") {
    window.__markDifficultySelectorsDirty = markDifficultySelectorsDirty;
    window.__resetFreeBossUnlockCache = resetFreeBossUnlockCache;
    window.__resetFreeSkillUnlockCache = resetFreeSkillUnlockCache;
    window.__resetMusicUnlockCache = resetMusicUnlockCache;
  }
} catch (e) { /* 無視 */ }




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
// defenseRenderer.jsから呼び出せるようにグローバルスコープに公開
window.handleGlobalSoundToggle = handleGlobalSoundToggle;


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
  // 同一キー再設定による再デコード・再レイアウトを回避（メニュー往復時のカクつき対策）
  if (menuBackground.dataset.bgKey !== key) {
    if (images[key]) {
      menuBackground.style.backgroundImage = `url("${images[key].src}")`;
    }
    menuBackground.dataset.bgKey = key;
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
  // ★Windows のみ UI全体の文字にじみ対策クラスを付与（静的CSSのみ）
  try {
    const ua = navigator.userAgent || "";
    const pf = navigator.platform || "";
    if (/Windows/i.test(ua) || /^Win/i.test(pf)) {
      document.body.classList.add("win");
    }
  } catch (e) { /* 判定失敗時は無視 */ }

  // ★描画品質に応じた「グロー影」の一括制御を有効化（起動時）
  enableAdaptiveShadowControl();

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

  checkMobile(); // 警告を表示するだけで、ゲームの初期化はブロックしない

  showBootScreen();

  if (bootScreen) {
    const startInitialLoad = async () => {
      if (bootScreen.style.display === "none") return;

      showLoadingScreen();
      document.removeEventListener("keydown", handleBootKey);

      // 最初にコアアセットのみを読み込む
      // ★黒画面対策: loadCoreAssets が例外/停滞しても真っ黒のままにしない
      try {
        await Promise.race([
          loadCoreAssets((loaded, total) => {
            const percent = Math.floor((loaded / total) * 100);
            setLoadingText(`Loading... ${percent}%`);
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error("core timeout")), 8000)),
        ]);
      } catch (e) {
        console.warn("Core assets load issue (continue boot):", e);
        setLoadingText("読み込みに時間がかかっています...");
        await new Promise(r => setTimeout(r, 800));
      }

      // バックグラウンドで残りのアセットを読み込み開始（awaitしない）
      // 進捗は中央下の細いプログレスバー（インジケータ）で表示する
      startRemainingLoadProgress();

      applyTitleMenuBackground();
      
      // 100%の状態を少し見せてから遷移
      setLoadingText("Loading... 100%");
      await new Promise(r => setTimeout(r, 500));

      hideLoading();
      // 毎回免責事項を表示
      const disclaimerMessage = `このゲームのセーブデータは、お使いのブラウザ（ローカルストレージ）に保存されます。\n\nブラウザのキャッシュや履歴を削除すると、セーブデータが失われる可能性がありますのでご注意ください。\n\n大切なデータは、設定画面の「データ管理」からエクスポートしてバックアップを取ることをお勧めします。`;
      await showDisclaimer(disclaimerMessage);

      // セーブデータの「保存場所」に関する案内（初回起動時のみ）
      await showSaveDataNoticeOnce();

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

  // タイトル下のバージョン表示初期化（実行中＋オフライン版）
  _initTitleVersionLabels();

  // アプリ全体のフルスクリーン ⇔ ウィンドウ切替（グローバルUIバーのボタン）
  bindFullscreenToggle(document.getElementById("globalFsToggle"));

  // ステージスケールの初期適用（resize / fullscreenchange では自動更新される）
  fitStage();

  // Webフォントの読み込み完了後に一度だけ再フィット。
  // フォント確定前にCanvasへ描かれた「フォールバック字形」の残骸を
  // 再描画させる（DOMテキストはブラウザが自動で再レイアウトする）。
  // resize 発火で各モードの Canvas 再フィット（defenseCore 等）も走る。
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      fitStage();
      window.dispatchEvent(new Event("resize"));
    });
  }

  // グローバルUIバー（全メニュー共通・左上）の表示制御を初期化
  initGlobalUiBar();

  // ★クエスト滞在時間の取りこぼし防止：タブ非表示・ページ離脱時に確定する
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      try { flushQuestSessionTime(); } catch { /* 無視 */ }
    }
  });
  window.addEventListener("pagehide", () => {
    try { flushQuestSessionTime(); } catch { /* 無視 */ }
  });
  // ★定期確定（60秒毎。セッション外はno-op。長時間マップ放置の取りこぼし防止）
  setInterval(() => {
    try { flushQuestSessionTime(); } catch { /* 無視 */ }
  }, 60000);

  bindModeStartEvents();
  bindResultEvents();
  bindMenuBackEvents();
  // ★設定を読み込む（UI描画より先に）
  loadSettings();
  // ★EXTRA CLEAR 特典：フリーモードBGM選択の選択肢を先に構築する
  //   （loadFreeModeConfig で保存済みの選択値を復元するため、必ず先に呼ぶ）
  populateFreeBgmSelect();
  loadFreeModeConfig();
  // populate boss select after free mode config is loaded
  populateBossSelect();
  // ★EXTRA CLEAR 特典：ミュージックプレイヤーのボタン結線
  initMusicPlayer();

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

  // フリーモードのボス戦用難易度セレクター
  createDifficultySelector(
    "bossDifficultyButtons",
    "bossDifficultyInfo",
    "free-boss", // 新しいスコープ
    "enemy" // エネミーモードと同じ難易度説明を使用
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
  ensureFullscreenButtons();

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

  // Player IDのインポート
  importPlayerIdBtn?.addEventListener("click", async () => {
      const newPlayerId = prompt("バックアップしたPlayer IDを貼り付けてください。");
      if (!newPlayerId || newPlayerId.trim() === "") {
          if (newPlayerId !== null) alert("Player IDが入力されていません。");
          return;
      }

      const newRecoveryCode = prompt("バックアップした復元コードを貼り付けてください。");
      if (!newRecoveryCode || newRecoveryCode.trim() === "") {
          if (newRecoveryCode !== null) alert("復元コードが入力されていません。");
          return;
      }

      // ★サーバー側でIDとコードのペアを検証する
      //   ★v1.0.42: supabase は動的importで取得（オフライン時は null）
      const supabase = await loadSupabase();
      if (!supabase) {
          alert("オンラインに接続できません。ネットワーク接続を確認してください。");
          return;
      }

      const { data: isValid, error } = await supabase.rpc('verify_player_credentials', {
          p_id: newPlayerId.trim(),
          r_code: newRecoveryCode.trim()
      });

      if (error || !isValid) {
          alert("Player IDまたは復元コードが正しくありません。サーバーに記録が見つかりませんでした。");
          return;
      }

      // 検証成功
      if (confirm(`Player IDを「${newPlayerId.trim()}」に変更しますか？\nこの操作は元に戻せません。`)) {
          setPlayerId(newPlayerId.trim());
          setRecoveryCode(newRecoveryCode.trim()); // ★復元コードも保存
          if (playerIdDisplay) playerIdDisplay.textContent = newPlayerId.trim();
          alert("Player IDを更新しました。");
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

  // -----------------------------
  // オフライン用データのダウンロード（VERSION）
  // -----------------------------
  // -----------------------------------------------
  // ★起動時の軽量バージョンチェック（自動DLなし）
  //    version.js を no-store で1回だけ取得し、差分があれば
  //    設定画面の文章でのみ案内する（モーダルは表示しない）。
  //    ゲーム起動・描画ループには介入しない。
  // -----------------------------------------------
  try {
    fetch("./js/version.js", { cache: "no-store" })
      .then(res => res.ok ? res.text() : "")
      .then(text => {
        const m = text && text.match(/APP_VERSION\s*=\s*["']([^"']+)["']/);
        if (m && m[1]) {
          _onlineLatestVersion = m[1];
          _refreshVersionStatus();
        }
      })
      .catch(() => { /* ネットワーク失敗時は無視 */ });
  } catch (e) { /* 無視 */ }

  const checkUpdateBtn = document.getElementById("checkUpdateBtn");

  // 現在のバージョン状況を表示（モーダルは出さない）
  _refreshVersionStatus();

  // ボタン: オフライン用データをまとめて保存
  //   ★自動では走らない。このボタンを押したときだけダウンロードする
  checkUpdateBtn?.addEventListener("click", () => {
    downloadOfflineData();
  });
});

// =====================================================
// Service Worker 登録・更新検知
// -----------------------------------------------------
//  ★v1.0.42: アップデートは「設定から明示的に実行したとき」だけ適用する。
//    ページを開いただけで促すモーダルは表示しない
//    （バージョンの状況は設定画面の文章でのみ伝える）。
// =====================================================

let currentServiceWorkerRegistration = null;
let updateControllerChangeHandler = null;
// ★適用中ガード: 「更新を適用して再起動」〜リロード完了まで true
let isApplyingUpdate = false;

if ("serviceWorker" in navigator) {

  navigator.serviceWorker
    .register("./service-worker.js")
    .then(registration => {

      currentServiceWorkerRegistration = registration;

      console.log("Service Worker registered with scope:", registration.scope);

      // -----------------------------------------------
      // 新しいService Workerが見つかった
      // -----------------------------------------------
      registration.onupdatefound = () => {

        const installingWorker = registration.installing;

        if (!installingWorker) {
          // 取りこぼし保険: すでに待機中のワーカーがいれば設定表示を更新
          if (registration.waiting) _refreshVersionStatus();
          return;
        }

        installingWorker.onstatechange = () => {

          console.log("Service Worker state:", installingWorker.state);

          // ★自動モーダルは出さない。設定のVERSION欄の文章だけ更新する
          try { _refreshVersionStatus(); } catch (e) { /* 無視 */ }

        };
      };

      try { _refreshVersionStatus(); } catch (e) { /* 無視 */ }

      // -----------------------------------------------
      // ※ 自動更新チェックは行わない
      //    低スペックPC / Windows への負荷を避けるため、
      //    設定の「最新版をオフライン用にダウンロード」でのみ確認する
      // -----------------------------------------------

    })
    .catch(error => {

      console.error("Service Worker registration failed:", error);

    });

  // ===================================================
  // Service Workerからのメッセージ
  // ===================================================
  navigator.serviceWorker.addEventListener("message", event => {

    const data = event.data;
    if (!data || !data.type) return;

    // ★更新適用（activate / controlling）の通知。
    //   ユーザーが「更新を適用して再起動」を押したときだけ再読み込みする
    //   （勝手に再起動しないよう isApplyingUpdate を確認する）
    if (data.type === "UPDATE_ACTIVATING" || data.type === "UPDATE_CONTROLLING") {

      if (!isApplyingUpdate) return;
      if (_applyReloading) return;

      _applyReloading = true;
      _markCacheVersion(APP_VERSION);
      console.log("Service Worker: update applied. Reloading...");
      window.location.reload();
      return;
    }

  });

  // オンライン復帰時にバージョン表示を更新（モーダルは出さない）
  window.addEventListener("online", () => {
    try { _refreshVersionStatus(); } catch (e) { /* 無視 */ }
  });

}
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
          <div class="slot-left">
            <span>SLOT ${i + 1}</span>
            ${(s.hasSeenTrueEnding ?? slot.progress?.hasSeenTrueEnding ?? false) ? '<span class="slot-cleared">CLEARED</span>' : ''}
            ${(s.hasExtraCleared ?? slot.progress?.hasExtraCleared ?? false) ? '<span class="slot-extra-cleared">EXTRA CLEARED</span>' : ''}
          </div>
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
      reloadQuestPlayerStats(); // ★flush後の最新値をメモリに反映
      renderQuestSlots();
      // カスタムイベントでセーブ完了を通知（モーダル外からの待機用）
      try {
        document.dispatchEvent(new CustomEvent('questSlotSaved', { detail: { slot: i } }));
      } catch (e) {
        console.warn('dispatch questSlotSaved failed', e);
      }
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

      resetQuestSession(); // ★旧セッション破棄（他スロットの時間が混ざらないように）
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

  if (!container || !info) return;

  container.innerHTML = "";

  // ← 追加
  container.classList.add("pattern-selector");

  // フリーモードでも全クリアで MASTER が選択可能になる
  const availableDifficulties = getAvailableDifficulties({ includeMaster: true });

  let current = getCurrentDifficulty(scope);

  // 旧セーブで MASTER が選択されていた場合は NORMAL に戻す
  if (!availableDifficulties.some(d => d.id === current.id)) {
    setCurrentDifficulty("normal", scope);
    current = getCurrentDifficulty(scope);
  }

  function updateInfo(diff) {
    info.textContent =
      getDifficultyDescription(diff, mode);
  }

  for (const d of availableDifficulties) {

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

export function updateAllDifficultySelectors(force = false) {
  // メニュー往復のたびに4スコープ分のDOMを再生成すると低スペックで重い。
  // 初回以降は明示的なdirty/forceがあるときだけ再生成する。
  if (!force && updateAllDifficultySelectors._built && !updateAllDifficultySelectors._dirty) return;
  updateAllDifficultySelectors._dirty = false;
  updateAllDifficultySelectors._built = true;
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
  createDifficultySelector(
    "bossDifficultyButtons",
    "bossDifficultyInfo",
    "free-boss",
    "enemy"
  );
}

/**
 * 敵モード / 防衛モード用のフルスクリーン切替ボタンを生成する。
 * アプリ全体のフルスクリーン ⇔ ウィンドウ切替はメニューの globalFsToggle で行う。
 * コンテナが非表示のときは一緒に隠れるため、表示制御は不要。
 * 実処理は fullscreenUtil.js の共通ユーティリティに委譲。
 */
function ensureFullscreenButtons() {
  ["enemyModeContainer", "defenseModeContainer"].forEach((id) => {
    ensureFullscreenButton(id);
  });
}

function initSettingsUI() {

  settingsBtn?.addEventListener("click", (e) => {
    // ★オフラインダウンロード中は設定画面を開かない
    if (_offlineModalActive) return;
    
    playSE("select");
    hideAllScreens();
    if (settingsDiv) settingsDiv.style.display = "block";
    applySoundSettingsToUI();
    applyKeybindsToUI();
    _refreshVersionStatus();

    // Player IDを表示
    if (playerIdDisplay) {
      playerIdDisplay.textContent = getPlayerId() || "（IDがありません）";
    }
  });

  // Player IDのコピー
  copyPlayerIdBtn?.addEventListener("click", () => {
    const playerId = getPlayerId();
    const recoveryCode = getRecoveryCode();
    if (!playerId || !recoveryCode) {
      alert("引継ぎ情報の取得に失敗しました。");
      return;
    }

    const backupText = `【MameType データ引継ぎ情報】\n\nPlayer ID:\n${playerId}\n\n復元コード:\n${recoveryCode}\n\nこのテキストを安全な場所に保管してください。\n※この引継ぎ情報は、オンラインランキングにスコアを送信した時点で有効になります。`;

    // navigator.clipboardが使えるかチェック (HTTPS/localhost環境)
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(backupText).then(() => {
        alert("Player IDと復元コードをクリップボードにコピーしました。\nテキストファイルなどに貼り付けて安全に保管してください。");
      }).catch(err => {
        alert("コピーに失敗しました。");
        console.error('Failed to copy backup data: ', err);
      });
    } else {
      // http環境など、navigator.clipboardが使えない場合のフォールバック
      try {
        const textarea = document.createElement("textarea");
        textarea.value = backupText;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        alert("Player IDと復元コードをクリップボードにコピーしました。\nテキストファイルなどに貼り付けて安全に保管してください。");
      } catch (err) {
        alert("コピーに失敗しました。手動でコピーしてください。");
      }
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
      // ★ OFFにした瞬間、再生中のBGM / ループSEも即座に停止（一括ON/OFFを反映）
      if (key === 'bgm' && !e.target.checked) stopBGM();
      if (key === 'soundeffect' && !e.target.checked) stopAllLoopSE();
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

  // 描画品質（いろいろな画面環境に対応）
  const renderQualitySelect = document.getElementById("renderQualitySelect");
  if (renderQualitySelect) {
    // 現在の設定を反映
    renderQualitySelect.value = getRenderQuality();

    // 実効プロファイル（Autoの自動調整状況など）を設定UIに表示
    const qualityStatus = document.getElementById("renderQualityStatus");
    const updateQualityStatus = () => {
      if (qualityStatus) {
        qualityStatus.textContent = `現在のプロファイル: ${getProfile().label}`;
      }
    };
    updateQualityStatus();
    // Auto適応制御による段階変化でも表示を更新
    window.addEventListener("mametype-quality-changed", updateQualityStatus);

    renderQualitySelect.addEventListener("change", () => {
      setRenderQuality(renderQualitySelect.value);
      updateQualityStatus();
      playSE("select");
    });
  }


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
      soundIcon.src = soundToggle.checked ? "./assets/pic/sound1.png" : "./assets/pic/soundmute.png";
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

  // 設定画面のKEYセクションのselectを更新
  unlock.value = keybinds.unlock;
  autoLock.value = keybinds.autoLock;
  pause.value = keybinds.pause;
  if (activeSkill) activeSkill.value = keybinds.activeSkill;

  // クエストマップのキー設定モーダルが開いていればそこも更新
  if (keybindConfigModal && !keybindConfigModal.classList.contains("hidden")) {
    const mUnlock = document.getElementById("key-unlock-q");
    const mAutoLock = document.getElementById("key-autolock-q");
    const mPause = document.getElementById("key-pause-q");
    const mSkill = document.getElementById("key-skill-q");
    if (mUnlock) mUnlock.value = keybinds.unlock;
    if (mAutoLock) mAutoLock.value = keybinds.autoLock;
    if (mPause) mPause.value = keybinds.pause;
    if (mSkill) mSkill.value = keybinds.activeSkill;
  }
}

// キーバインド表示用ラベル（フォーム表示用）
function getKeyLabel(v) {
  if (!v) return "";
  if (v === "ArrowUp") return "↑";
  if (v === "ArrowDown") return "↓";
  if (v === "ArrowLeft") return "←";
  if (v === "ArrowRight") return "→";
  if (v === "Control") return "CTRL";
  if (v === "Delete") return "DEL";
  if (v === "Backspace") return "BS";
  if (v === "Tab") return "TAB";
  if (v === "Enter") return "ENTER";
  // それ以外は先頭文字大文字
  return v.charAt(0).toUpperCase() + v.slice(1);
}

// クエストマップのキー設定モーダルを開く
export function openKeybindConfigModal() {
  if (!keybindConfigModal) return;
  const keybinds = loadKeybinds();

  // 動的にキーセレクトを生成（設定画面の KEY セクションと同じ4項目）
  const items = [
    { id: "key-unlock-q", label: "Unlock", key: keybinds.unlock },
    { id: "key-autolock-q", label: "Auto Lock", key: keybinds.autoLock },
    { id: "key-pause-q", label: "Pause", key: keybinds.pause },
    { id: "key-skill-q", label: "Active Skill", key: keybinds.activeSkill }
  ];

  const optionsHTML =
    '<option value="Tab">TAB</option>' +
    '<option value="Enter">ENTER</option>' +
    '<option value="Backspace">BS</option>' +
    '<option value="Delete">DEL</option>' +
    '<option value="Control">CTRL</option>' +
    '<option value="ArrowUp">↑</option>' +
    '<option value="ArrowDown">↓</option>' +
    '<option value="ArrowLeft">←</option>' +
    '<option value="ArrowRight">→</option>';

  let html = '';
  items.forEach(item => {
    let opts = optionsHTML;
    opts = opts.replace('value="' + item.key + '"', 'value="' + item.key + '" selected');
    html +=
      '<div class="keybind-modal-item">' +
        '<div class="keybind-modal-label">' + item.label + '</div>' +
        '<div class="keybind-modal-controls">' +
          '<select id="' + item.id + '" class="keybind-select">' + opts + '</select>' +
        '</div>' +
      '</div>';
  });

  keybindConfigContent.innerHTML = html;
  keybindConfigModal.classList.remove("hidden");
}

// クエストマップのキー設定モーダルを閉じる
function closeKeybindConfigModal() {
  if (!keybindConfigModal) return;
  keybindConfigModal.classList.add("hidden");
}

// クエストマップのキー設定モーダルから保存
// 設定画面の KEY セクションの Save Keybinds と同じ挙動：
// 重複チェック → 警告 → localStorage保存 → 成功メッセージ → モーダル更新
function saveKeybindConfigFromModal() {
  if (!keybindConfigModal) return;
  const unlockEl = document.getElementById("key-unlock-q");
  const autoLockEl = document.getElementById("key-autolock-q");
  const pauseEl = document.getElementById("key-pause-q");
  const skillEl = document.getElementById("key-skill-q");

  if (!unlockEl || !autoLockEl || !pauseEl || !skillEl) return;

  const bind = {
    unlock: unlockEl.value,
    autoLock: autoLockEl.value,
    pause: pauseEl.value,
    activeSkill: skillEl.value
  };

  // ★重複チェック（設定画面と同じ）
  if (!validateKeybinds(bind)) {
    showSaveMessage("⚠ キーが重複しています", "error");
    return;
  }

  saveKeybinds(bind);

  // ★保存完了メッセージ（設定画面と同じ）
  showSaveMessage("キーバインドを保存しました");

  // モーダル選択肢を保存された値で再生成して反映（閉じない）
  openKeybindConfigModal();
}

// クエストマップのキー設定モーダル表示中のキー処理
// 表示中は他のキーへ流さないため true を返す。b / Enter / Escape で閉じる。
function handleQuestKeybindConfigModalKey(e) {
  if (!keybindConfigModal || keybindConfigModal.classList.contains("hidden")) {
    return false;
  }
  const key = (e.key || "").toLowerCase();
  if (key === "b" || key === "escape" || key === "enter") {
    e.preventDefault();
    closeKeybindConfigModal();
    // Enter は保存に見立てるが、必須入力がないので閉じるだけで十分
  }
  // 任意のキー（b/Esc/Enter以外）は無視し、メニュー等に漏らさない
  return true;
}

// =====================================================
// フリーモード設定の保存・読み込み
// =====================================================
// =====================================================
// ★全クリア特典：フリーモードのアクティブスキル設定（ENEMY / QUEST BOSS）
//   クエストモードの装備・星強化データとは完全に独立して扱う。
// =====================================================
const FREE_SKILL_STOCK_MAX = 5; // ストック上限の最大値

/** ストック上限を 1〜5 に丸める */
function clampFreeSkillStockMax(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(FREE_SKILL_STOCK_MAX, Math.floor(n)));
}

/** ★全クリア特典：フリーモードのスキル機能が解放済みか（表示判定キャッシュ付き） */
function isFreeSkillFeatureUnlocked() {
  if (typeof showFreeStartMenu._skillUnlocked !== "boolean") {
    showFreeStartMenu._skillUnlocked = hasFreeActiveSkillUnlocked();
  }
  return showFreeStartMenu._skillUnlocked;
}

/** 解放状況のキャッシュを破棄し、設定パネルの表示も更新する */
function resetFreeSkillUnlockCache() {
  try {
    if (typeof showFreeStartMenu === "function") {
      showFreeStartMenu._skillUnlocked = undefined;
    }
  } catch (e) { /* 無視 */ }
  try {
    updateFreeSkillConfigUI("enemy");
    updateFreeSkillConfigUI("boss");
  } catch (e) { /* 無視 */ }
}

/** 対象（enemy / boss）のスキル設定を取得 */
function getFreeSkillSetting(target = "enemy") {
  return target === "boss"
    ? { skillId: currentFreeBossSkillId, stockMax: currentFreeBossSkillStockMax, starLevel: currentFreeBossSkillStarLevel }
    : { skillId: currentFreeSkillId, stockMax: currentFreeSkillStockMax, starLevel: currentFreeSkillStarLevel };
}

/** 対象（enemy / boss）のスキル設定を更新（クランプ込み） */
function setFreeSkillSetting(target, patch = {}) {
  const isBoss = target === "boss";

  if ("skillId" in patch) {
    const id = patch.skillId || null;
    if (isBoss) currentFreeBossSkillId = id; else currentFreeSkillId = id;
  }
  if ("stockMax" in patch) {
    const v = clampFreeSkillStockMax(patch.stockMax);
    if (isBoss) currentFreeBossSkillStockMax = v; else currentFreeSkillStockMax = v;
  }
  if ("starLevel" in patch) {
    const v = clampFreeSkillStarLevel(patch.starLevel);
    if (isBoss) currentFreeBossSkillStarLevel = v; else currentFreeSkillStarLevel = v;
  }
}

/** 設定パネル表示用のスキル名ラベル（短縮後のCD付き） */
function formatFreeSkillLabel(skillId, starLevel = 0) {
  const skill = getFreeSkillInfo(skillId);
  if (!skill) return "－（なし）";
  const factor = getFreeSkillStarTimeFactor(starLevel);
  const cd = typeof skill.cooldown === "number" ? `（CD ${(skill.cooldown * factor).toFixed(1)}sec）` : "";
  return `${skill.name}${cd}`;
}

/** フリーモード設定パネル（ENEMY / QUEST BOSS）のスキル欄を更新 */
function updateFreeSkillConfigUI(target = "enemy") {
  const isBoss = target === "boss";
  const unlocked = isFreeSkillFeatureUnlocked();

  const section = document.getElementById(isBoss ? "freeBossSkillSection" : "freeSkillSection");
  const titleEl = document.getElementById(isBoss ? "freeBossSkillSectionTitle" : "freeSkillSectionTitle");
  const nameEl = document.getElementById(isBoss ? "freeBossSkillNameValue" : "freeSkillNameValue");
  const starEl = document.getElementById(isBoss ? "freeBossSkillStarValue" : "freeSkillStarValue");
  const stockSlider = document.getElementById(isBoss ? "freeBossSkillStockSlider" : "freeSkillStockSlider");
  const stockValueEl = document.getElementById(isBoss ? "freeBossSkillStockValue" : "freeSkillStockValue");

  if (section) section.style.display = unlocked ? "block" : "none";
  if (titleEl) titleEl.style.display = unlocked ? "flex" : "none";
  if (!unlocked) return;

  const setting = getFreeSkillSetting(target);
  const stockMax = clampFreeSkillStockMax(setting.stockMax);
  const reduction = Math.round((1 - getFreeSkillStarTimeFactor(setting.starLevel)) * 100);

  if (nameEl) nameEl.textContent = formatFreeSkillLabel(setting.skillId, setting.starLevel);
  if (starEl) starEl.textContent = `Lv.${setting.starLevel}/${FREE_SKILL_STAR_MAX_LEVEL}（CD -${reduction}%）`;
  if (stockSlider) stockSlider.value = String(stockMax);
  if (stockValueEl) stockValueEl.textContent = String(stockMax);
}

/** startEnemyMode に渡すフリーモード用スキル設定（未解放・未選択なら null） */
function buildFreeSkillConfig(target = "enemy") {
  if (!isFreeSkillFeatureUnlocked()) return null;
  const setting = getFreeSkillSetting(target);
  if (!getFreeSkillInfo(setting.skillId)) return null;
  return {
    skillId: setting.skillId,
    stockMax: clampFreeSkillStockMax(setting.stockMax),
    starLevel: clampFreeSkillStarLevel(setting.starLevel),
  };
}

/** スキル選択モーダルを開く */
function openFreeSkillSelect(target = "enemy") {
  const isBoss = target === "boss";
  openFreeSkillSelectModal({
    title: isBoss ? "SKILL SELECT (QUEST BOSS)" : "SKILL SELECT (ENEMY)",
    currentSkillId: getFreeSkillSetting(target).skillId,
    onSelect: (skillId) => {
      setFreeSkillSetting(target, { skillId });
      saveFreeModeConfig();
      updateFreeSkillConfigUI(target);
    },
  });
}

/** 星強化モーダルを開く */
function openFreeStarUpgrade(target = "enemy") {
  const isBoss = target === "boss";
  openFreeStarUpgradeModal({
    skillId: getFreeSkillSetting(target).skillId,
    level: getFreeSkillSetting(target).starLevel,
    onChange: (level) => {
      setFreeSkillSetting(target, { starLevel: level });
      saveFreeModeConfig();
      updateFreeSkillConfigUI(target);
    },
  });
}

/** 表示中の設定パネルから対象（enemy / boss）を判定（キーボード操作用） */
function getVisibleFreeSkillTarget() {
  const bossSection = document.getElementById("configBoss");
  return (bossSection && bossSection.style.display !== "none") ? "boss" : "enemy";
}

/** フリーモードのENEMY/BOSS設定パネルが表示中かどうか（スキル設定キー用） */
function isFreeSkillPanelVisible() {
  if (!isFreeSkillFeatureUnlocked()) return false;
  const enemyPanel = document.getElementById("configEnemy");
  const bossPanel = document.getElementById("configBoss");
  return (
    (enemyPanel && enemyPanel.style.display !== "none") ||
    (bossPanel && bossPanel.style.display !== "none")
  );
}

function saveFreeModeConfig() {
  const config = {
    lastModeId: currentFreeModeId,
    lastEnemyPattern: currentEnemyPattern,
    // ★EXTRA CLEAR 特典：フリーモードのBGM選択（"" = モード既定）
    bgm: document.getElementById("freeBgmSelect")?.value || null,
    standard: {
      difficulty: getCurrentDifficulty("free-standard").id,
      genres: Array.from(document.querySelectorAll('#standardGenreCheckboxes input[name="standard-genre"]:checked'))
                   .map(cb => cb.value)
                   .filter(v => v !== 'all'),
      count: parseInt(document.getElementById("stdCountSlider")?.value) || 20,
    },
    timeAttack: {
      difficulty: getCurrentDifficulty("free-timeattack").id,
      genres: Array.from(document.querySelectorAll('#timeAttackGenreCheckboxes input[name="timeattack-genre"]:checked'))
                   .map(cb => cb.value)
                   .filter(v => v !== 'all'),
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
      lv: parseInt(document.getElementById("playerLvRange")?.value) || 1,
      // ★全クリア特典：フリーモード固有のアクティブスキル設定（クエストとは独立）
      skillId: currentFreeSkillId || null,
      skillStockMax: clampFreeSkillStockMax(currentFreeSkillStockMax),
      skillStarLevel: clampFreeSkillStarLevel(currentFreeSkillStarLevel)
    },
    defense: { // Defense Mode settings for Free Mode
      totalCharsToType: parseInt(document.getElementById("defenseCharsSlider")?.value) || 300,
      timeLimit: parseInt(document.getElementById("defenseTimeSlider")?.value) || 120,
      genres: Array.from(document.querySelectorAll('#defenseGenreCheckboxes input[name="defense-genre"]:checked'))
                   .map(cb => cb.value)
                   .filter(v => v !== 'all'), // 'all'は保存しない
      minLength: parseInt(document.getElementById("defenseMinWordLengthSlider")?.value) || 1,
      maxLength: parseInt(document.getElementById("defenseMaxWordLengthSlider")?.value) || 10,
    },
    boss: {
      selectedStage: document.getElementById("bossStageSelect")?.value || "W1_WORLD_BOSS",
      difficulty: getCurrentDifficulty("free-boss").id, // ボスモードの難易度を追加
      level: parseInt(document.getElementById("bossPlayerLvRange")?.value) || 1, // ボスモードのプレイヤーレベルを追加
      // ★全クリア特典：QUEST BOSS 固有のアクティブスキル設定（ENEMYとは独立）
      skillId: currentFreeBossSkillId || null,
      skillStockMax: clampFreeSkillStockMax(currentFreeBossSkillStockMax),
      skillStarLevel: clampFreeSkillStarLevel(currentFreeBossSkillStarLevel)
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

    // ★EXTRA CLEAR 特典：フリーモードのBGM選択を復元（"" = モード既定）
    const bgmSelect = document.getElementById("freeBgmSelect");
    if (bgmSelect && config.bgm !== undefined) {
      bgmSelect.value = config.bgm || "";
    }

    if (config.standard?.difficulty) {
      setCurrentDifficulty(config.standard.difficulty, "free-standard");
    }

    if (config.standard?.count) {
      const el = document.getElementById("stdCountSlider");
      if (el) { el.value = config.standard.count; updateConfigSliderLabel("stdCountSlider", el.value); }
    }
    if (config.standard?.genres){
      const checkboxes = document.querySelectorAll('#standardGenreCheckboxes input[name="standard-genre"]');
      checkboxes.forEach(cb => {
        cb.checked = config.standard.genres.includes(cb.value);
      });
      // 「すべて」チェックボックスの状態を更新
      const allCheckbox = document.querySelector('#standardGenreCheckboxes input[value="all"]');
      const otherCheckboxes = Array.from(checkboxes).filter(cb => cb.value !== 'all');
      if(allCheckbox) allCheckbox.checked = otherCheckboxes.every(cb => cb.checked);
    }

    if (config.timeAttack?.difficulty) {
      setCurrentDifficulty(config.timeAttack.difficulty, "free-timeattack");
    }

    if (config.timeAttack?.time) {
      const el = document.getElementById("taTimeSlider");
      if (el) { el.value = config.timeAttack.time; updateConfigSliderLabel("taTimeSlider", el.value); }
    }
    if (config.timeAttack?.genres){
      const checkboxes = document.querySelectorAll('#timeAttackGenreCheckboxes input[name="timeattack-genre"]');
      checkboxes.forEach(cb => {
        cb.checked = config.timeAttack.genres.includes(cb.value);
      });
      // 「すべて」チェックボックスの状態を更新
      const allCheckbox = document.querySelector('#timeAttackGenreCheckboxes input[value="all"]');
      const otherCheckboxes = Array.from(checkboxes).filter(cb => cb.value !== 'all');
      if(allCheckbox) allCheckbox.checked = otherCheckboxes.every(cb => cb.checked);
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
      // ★全クリア特典：ENEMY固有のアクティブスキル設定を復元（クエストとは独立）
      if (config.enemy.skillId !== undefined) setFreeSkillSetting("enemy", { skillId: config.enemy.skillId });
      if (config.enemy.skillStockMax !== undefined) setFreeSkillSetting("enemy", { stockMax: config.enemy.skillStockMax });
      if (config.enemy.skillStarLevel !== undefined) setFreeSkillSetting("enemy", { starLevel: config.enemy.skillStarLevel });
      // パターンの復元
      switchEnemyPattern(currentEnemyPattern);

      // boss選択の復元
      if (config.boss?.selectedStage) {
        const el = document.getElementById("bossStageSelect");
        if (el) el.value = config.boss.selectedStage;
      }
    }
    // ボスモードの難易度を復元
    if (config.boss?.difficulty) {
      setCurrentDifficulty(config.boss.difficulty, "free-boss");
    }
    // ボスモードのプレイヤーレベルを復元
    if (config.boss?.level !== undefined) {
      const el = document.getElementById("bossPlayerLvRange");
      if (el) {
        el.value = config.boss.level;
        updateConfigSliderLabel("bossPlayerLvRange", el.value);
      }
    }
    // ★全クリア特典：QUEST BOSS固有のアクティブスキル設定を復元（ENEMYとは独立）
    if (config.boss?.skillId !== undefined) setFreeSkillSetting("boss", { skillId: config.boss.skillId });
    if (config.boss?.skillStockMax !== undefined) setFreeSkillSetting("boss", { stockMax: config.boss.skillStockMax });
    if (config.boss?.skillStarLevel !== undefined) setFreeSkillSetting("boss", { starLevel: config.boss.skillStarLevel });
    // Defense Mode settings for Free Mode
    if (config.defense) {
      const charsEl = document.getElementById("defenseCharsSlider");
      if (charsEl) { charsEl.value = config.defense.totalCharsToType; updateConfigSliderLabel("defenseCharsSlider", charsEl.value); }

      const timeEl = document.getElementById("defenseTimeSlider");
      if (timeEl) { timeEl.value = config.defense.timeLimit; updateConfigSliderLabel("defenseTimeSlider", timeEl.value); }

      if (config.defense.genres) {
        const checkboxes = document.querySelectorAll('#defenseGenreCheckboxes input[name="defense-genre"]');
        checkboxes.forEach(cb => {
          cb.checked = config.defense.genres.includes(cb.value);
        });
        // 「すべて」チェックボックスの状態を更新
        const allCheckbox = document.querySelector('#defenseGenreCheckboxes input[value="all"]');
        const otherCheckboxes = Array.from(checkboxes).filter(cb => cb.value !== 'all');
        if(allCheckbox) allCheckbox.checked = otherCheckboxes.every(cb => cb.checked);
      }
      if (config.defense.minLength) {
        const el = document.getElementById("defenseMinWordLengthSlider");
        if (el) { el.value = config.defense.minLength; updateConfigSliderLabel("defenseMinWordLengthSlider", el.value); }
      }
      if (config.defense.maxLength) {
        const el = document.getElementById("defenseMaxWordLengthSlider");
        if (el) { el.value = config.defense.maxLength; updateConfigSliderLabel("defenseMaxWordLengthSlider", el.value); }
      }
      switchFreeModeConfig(currentFreeModeId); // Ensure UI updates if Defense was last selected
    }

    // ★全クリア特典：フリーモードのスキル設定欄（ENEMY / QUEST BOSS）を復元値で更新
    updateFreeSkillConfigUI("enemy");
    updateFreeSkillConfigUI("boss");
  } catch (e) {
    console.warn("Failed to load free mode config", e);
  }
}

// フリーモード用: ボス選択肢を動的に作成
function populateBossSelect() {
  const select = document.getElementById("bossStageSelect");
  if (!select) return;
  select.innerHTML = "";

  const entries = Object.entries(STAGES).filter(([k, v]) => /BOSS|MID/i.test(k));

  for (const [key, val] of entries) {
    let label = key;
    try {
      if (Array.isArray(val.phases) && val.phases.length > 0) {
        const bossPhase = val.phases[val.phases.length - 1];
        if (bossPhase && bossPhase.name) label = `${key}: ${bossPhase.name}`;
      }
    } catch (e) {}

    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = label;
    select.appendChild(opt);
  }

  select.addEventListener("change", () => saveFreeModeConfig());
}

// =====================================================
// ★EXTRA CLEAR 特典：フリーモードのBGM選択
// -----------------------------------------------------
// ・assetsLoader.js の BGM 定義から選択肢を生成する（定義元を一本化）
// ・"" を選ぶと各モード既定のBGMになる（従来どおりの挙動）
// ・EXTRA全クリア前は行ごと非表示にする
// =====================================================

/** フリーモードのBGM選択に選択肢を構築します（起動時に1回だけ呼ぶ）。 */
function populateFreeBgmSelect() {
  const select = document.getElementById("freeBgmSelect");
  if (!select) return;

  select.innerHTML = "";
  const defaultOpt = document.createElement("option");
  defaultOpt.value = "";
  defaultOpt.textContent = "モード既定";
  select.appendChild(defaultOpt);

  getBgmAssets().forEach(track => {
    const opt = document.createElement("option");
    opt.value = track.name;
    opt.textContent = `${track.title} / ${track.composer}`;
    select.appendChild(opt);
  });

  select.addEventListener("change", () => {
    saveFreeModeConfig();
    // 設定を変えたことを分かりやすくする（メニューSE）
    try { playSE("select"); } catch (e) { /* 無視 */ }
  });
}

/**
 * フリーモードのBGM選択を表示／非表示します（EXTRA全クリアで解放）。
 */
function updateFreeBgmRowVisibility() {
  const row = document.getElementById("freeBgmRow");
  if (!row) return;
  row.style.display = hasExtraCleared() ? "flex" : "none";
}

/**
 * フリーモードのBGM上書き値を返します（未選択・未解放なら null = モード既定）。
 * @returns {string|null}
 */
function getFreeBgmOverride() {
  if (!hasExtraCleared()) return null;
  const value = document.getElementById("freeBgmSelect")?.value || "";
  return value || null;
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
    enemyTable: enemyTable, // Tierと属性セットから生成したテーブルをトップレベルで渡す
    // ★全クリア特典：ENEMY用のアクティブスキル設定（クエストとは独立）
    freeSkill: buildFreeSkillConfig("enemy"),
    // ★EXTRA CLEAR 特典：選択されたBGM（未選択なら各モード既定）
    bgm: getFreeBgmOverride()
  });
}

/**
 * フリーモードの防衛戦モードを開始する (UI設定を反映)
 */
function startFreeDefenseMode() {
  hideAllScreens(); // ★追加: UIをリセット
  const totalCharsToType = parseInt(document.getElementById("defenseCharsSlider")?.value) || 2000;
  const timeLimit = parseInt(document.getElementById("defenseTimeSlider")?.value) || 180;
  const genres = Array.from(document.querySelectorAll('#defenseGenreCheckboxes input[name="defense-genre"]:checked'))
                      .map(cb => cb.value);

  const minLength = parseInt(document.getElementById("defenseMinWordLengthSlider")?.value) || 1;
  const maxLength = parseInt(document.getElementById("defenseMaxWordLengthSlider")?.value) || 10;

  showMenuBackground(false);

  gameState.isFreeMode = true;
  gameState.isQuestMode = false;

  startDefenseMode({
    isFreeMode: true,
    // ★EXTRA CLEAR 特典：選択されたBGM（未選択なら防衛モード既定）
    bgm: getFreeBgmOverride(),
    custom: {
      totalCharsToType,
      timeLimit, // 秒単位で渡す
      genres: genres.length > 0 ? genres : ['empty'], // 標準単語の指定を'empty'に戻す
      minLength: minLength,
      maxLength: maxLength,
    }
  });
}
// =====================================================
// フリーモード詳細設定のUI制御
// =====================================================
function initFreeModeConfigUI() {
  const configEnemy = document.getElementById("configEnemy");
  // ★パターン切替は「時間制限/討伐数/エンドレス」の3ボタンのみ。
  //   スキル設定ボタン（STAR/SKILL系）には切替を結線しない
  const patternBtns = configEnemy?.querySelectorAll(".pattern-selector .pattern-btn") || [];
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
  const sliders = ["stdCountSlider", "taTimeSlider", "enemyTimeSlider", "enemyCountSlider", "enemyIntervalSlider", "playerLvRange", "bossPlayerLvRange", "defenseCharsSlider", "defenseTimeSlider", "defenseMinWordLengthSlider", "defenseMaxWordLengthSlider"]; // Defense slidersを追加
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

  // スタンダードモードのジャンルチェックボックス変更時に保存
  const stdGenreCheckboxes = document.querySelectorAll('#standardGenreCheckboxes input[name="standard-genre"]');
  stdGenreCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const allCheckbox = document.querySelector('#standardGenreCheckboxes input[value="all"]');
      const otherCheckboxes = Array.from(stdGenreCheckboxes).filter(cb => cb.value !== 'all');

      if (e.target.value === 'all') {
        otherCheckboxes.forEach(cb => cb.checked = e.target.checked);
      } else {
        if (allCheckbox) allCheckbox.checked = otherCheckboxes.every(cb => cb.checked);
      }
      saveFreeModeConfig();
    });
  });

  // タイムアタックモードのジャンルチェックボックス変更時に保存
  const taGenreCheckboxes = document.querySelectorAll('#timeAttackGenreCheckboxes input[name="timeattack-genre"]');
  taGenreCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const allCheckbox = document.querySelector('#timeAttackGenreCheckboxes input[value="all"]');
      const otherCheckboxes = Array.from(taGenreCheckboxes).filter(cb => cb.value !== 'all');

      if (e.target.value === 'all') {
        otherCheckboxes.forEach(cb => cb.checked = e.target.checked);
      } else {
        if (allCheckbox) allCheckbox.checked = otherCheckboxes.every(cb => cb.checked);
      }
      saveFreeModeConfig();
    });
  });

  // 防衛モードのジャンルチェックボックス変更時に保存
  const defenseGenreCheckboxes = document.querySelectorAll('#defenseGenreCheckboxes input[name="defense-genre"]');
  defenseGenreCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const allCheckbox = document.querySelector('#defenseGenreCheckboxes input[value="all"]');
      const otherCheckboxes = Array.from(defenseGenreCheckboxes).filter(cb => cb.value !== 'all');

      if (e.target.value === 'all') {
        // 「すべて」が変更されたら、他のチェックボックスの状態を同期
        otherCheckboxes.forEach(cb => cb.checked = e.target.checked);
      } else {
        // 他のチェックボックスが変更されたら、「すべて」の状態を更新
        if (allCheckbox) allCheckbox.checked = otherCheckboxes.every(cb => cb.checked);
      }
      saveFreeModeConfig();
    });
  });

  // 各設定パネル内の開始ボタンにイベントを登録
  document.getElementById("startStandardFree")?.addEventListener("click", () => {
    const count = parseInt(document.getElementById("stdCountSlider").value);
    const genres = Array.from(document.querySelectorAll('#standardGenreCheckboxes input[name="standard-genre"]:checked')).map(cb => cb.value);
    let tags = genres.length > 0 ? genres : ['empty'];
    if (tags.includes('all')) {
      tags = []; // 'all' は gameCore 側で解釈されないので、空配列にして全単語対象とする
    }

    hideAllScreens();

    gameState.isFreeMode = true;
    updateGameUIVisibility(GameModes.NORMAL.id); // UI表示を更新
    gameState.isQuestMode = false;

    Game.doCountdown({
      mode: GameModes.NORMAL,
      isFreeMode: true,
      difficulty: getCurrentDifficulty("free-standard").id,
      custom: { questionLimit: count, tags: tags },
      // ★EXTRA CLEAR 特典：選択されたBGM（未選択なら通常モード既定）
      bgm: getFreeBgmOverride()
    });
  });

  document.getElementById("startTimeAttackFree")?.addEventListener("click", () => {
    const time = parseInt(document.getElementById("taTimeSlider").value);
    const genres = Array.from(document.querySelectorAll('#timeAttackGenreCheckboxes input[name="timeattack-genre"]:checked')).map(cb => cb.value);
    let tags = genres.length > 0 ? genres : ['empty'];
    if (tags.includes('all')) {
      tags = []; // 'all' は gameCore 側で解釈されないので、空配列にして全単語対象とする
    }

    hideAllScreens();

    gameState.isFreeMode = true;
    updateGameUIVisibility(GameModes.TIME_ATTACK.id); // UI表示を更新
    gameState.isQuestMode = false;

    Game.doCountdown({
      mode: GameModes.TIME_ATTACK,
      isFreeMode: true,
      difficulty: getCurrentDifficulty("free-timeattack").id,
      custom: { limitSec: time, tags: tags },
      // ★EXTRA CLEAR 特典：選択されたBGM（未選択ならタイムトライアル既定）
      bgm: getFreeBgmOverride()
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
      custom: { tags: tags },
      // ★EXTRA CLEAR 特典：選択されたBGM（未選択なら長文モード既定）
      bgm: getFreeBgmOverride()
    });
  });

  // エネミーモードの開始ボタンを設定パネルの最下部に移動する
  const enemyStartBtn = document.getElementById("startEnemyFree");
  if (enemyStartBtn && configEnemy) {
    configEnemy.appendChild(enemyStartBtn); // 先にDOMに追加
    enemyStartBtn.addEventListener("click", startFreeEnemyMode); // その後でイベントリスナーを設定
  }

  // 防衛モードの開始ボタンを設定パネルの最下部に移動する
  const defenseStartBtn = document.getElementById("startDefenseFree");
  const configDefense = document.getElementById("configDefense");
  if (defenseStartBtn && configDefense) {
    configDefense.appendChild(defenseStartBtn);
  }

  // ★追加: フリーモードの防衛モード開始ボタンにイベントリスナーを設定
  document.getElementById("startDefenseFree")?.addEventListener("click", startFreeDefenseMode);

  // ★★★ 修正箇所 ★★★
  // フリーモードのボス戦開始ボタンにイベントリスナーを設定
  document.getElementById("startBossFree")?.addEventListener("click", () => {
    const stageId = document.getElementById("bossStageSelect")?.value;
    const level = parseInt(document.getElementById("bossPlayerLvRange")?.value || "1");
    if (!stageId) {
      alert("ボスステージが選択されていません。");
      return;
    }
    hideAllScreens();
    showMenuBackground(false);
    startEnemyMode({
      isFreeMode: true,
      stage: stageId,
      bossOnly: true, // ボス戦のみ実行するフラグ
      level: level, // プレイヤーレベル
      difficulty: getCurrentDifficulty("free-boss").id,
      // ★全クリア特典：QUEST BOSS用のアクティブスキル設定（ENEMYとは独立）
      freeSkill: buildFreeSkillConfig("boss"),
      // ★EXTRA CLEAR 特典：選択されたBGM（未選択ならボスステージ既定）
      bgm: getFreeBgmOverride(),
    });
  });

  // ★全クリア特典：フリーモード（ENEMY / QUEST BOSS）のスキル設定UI
  const freeSkillSliders = [
    { id: "freeSkillStockSlider", target: "enemy" },
    { id: "freeBossSkillStockSlider", target: "boss" },
  ];
  freeSkillSliders.forEach(({ id, target }) => {
    const el = document.getElementById(id);
    el?.addEventListener("input", () => {
      setFreeSkillSetting(target, { stockMax: el.value });
      saveFreeModeConfig();
      updateFreeSkillConfigUI(target);
    });
  });

  document.getElementById("freeSkillSelectBtn")?.addEventListener("click", () => openFreeSkillSelect("enemy"));
  document.getElementById("freeSkillUpgradeBtn")?.addEventListener("click", () => openFreeStarUpgrade("enemy"));
  document.getElementById("freeBossSkillSelectBtn")?.addEventListener("click", () => openFreeSkillSelect("boss"));
  document.getElementById("freeBossSkillUpgradeBtn")?.addEventListener("click", () => openFreeStarUpgrade("boss"));

  // --- 防衛モードの単語長範囲スライダーの同期 ---
  const minSlider = document.getElementById("defenseMinWordLengthSlider");
  const maxSlider = document.getElementById("defenseMaxWordLengthSlider");

  if (minSlider && maxSlider) {
    const syncSliders = () => {
      const minVal = parseInt(minSlider.value);
      const maxVal = parseInt(maxSlider.value);

      if (minVal > maxVal) {
        // 最小値が最大値を超えた場合、最大値を最小値に合わせる
        maxSlider.value = minVal;
        updateConfigSliderLabel("defenseMaxWordLengthSlider", minVal);
      }
      // ラベルを範囲表示に更新
      updateConfigSliderLabel("defenseWordLengthRange", { min: minSlider.value, max: maxSlider.value });
    };

    minSlider.addEventListener("input", syncSliders);
    maxSlider.addEventListener("input", syncSliders);

    // 初期表示
    syncSliders();
  }
}

/**
 * スライダーの値をUIに反映する共通処理
 */
function updateConfigSliderLabel(id, value) {
  const valDisplay = document.getElementById(id.replace("Slider", "Value").replace("Range", "Value").replace("playerLv", "enemyLv").replace("WordLength", "WordLength"));
  if (!valDisplay) return;

  if (id === "enemyIntervalSlider") {
    valDisplay.textContent = (value / 1000).toFixed(1);
  } else if (id === "defenseWordLengthRange") {
    // 範囲スライダー用の特別処理
    const rangeDisplay = document.getElementById("defenseWordLengthValue");
    if (rangeDisplay) rangeDisplay.textContent = `${value.min} - ${value.max}`;
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
 * @param {object} [opts] - { save: true } メニュー往復表示時は { save:false } でLS書き込みを省略
 */
function switchFreeModeConfig(modeId, opts = {}) {
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
    'Long': freeLongTextBtn, // This is already there
    'Defense': freeDefenseModeBtn, // New button for Defense
    'Boss': document.getElementById('freeBossBtn') // BOSSボタンもマップに追加
  };

  Object.values(btnMap).forEach(btn => btn?.classList.remove("active"));
  if (btnMap[modeId]) {
    btnMap[modeId].classList.add("active");
  }

  // メニュー表示だけのための切替では保存を省略（低スペックでの往復コスト削減）
  if (opts.save === false) {
    // currentFreeModeId は更新済み。保存はユーザーが明示切替したときのみ行う
    return;
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
  // ★ chainUI も非表示対象に追加
  const freeModeConfig = document.getElementById("freeModeConfig");
  const chainUI = document.getElementById("chainUI");
  // ★ クエストステータスモーダルも対象
  const questStatsModalEl = document.getElementById("questStatsModal");
  [
    menuDiv, questMenuDiv, startMenuDiv, freeStartMenuDiv, settingsDiv, gameDiv,
    resultDiv, recordsDiv, questMapScreen, skillTreeDiv, onlineRankingDiv,
    freeModeConfig, chainUI, questStatsModalEl
  ]
    .forEach(div => { if (div) div.style.display = "none"; });
  // ★EXTRA CLEAR 特典：ミュージックモーダルが開いたまま画面遷移しないように閉じる
  //   （再生中の曲は各モード開始時のBGM切替／メニュー戻りで停止する）
  try { closeMusicModal(); } catch (e) { /* 無視 */ }
  // showMenuBackground(false); // メニュー遷移時に背景画像が途切れないように維持
}

function showMainMenu() {
  stopQuestSession(); // ★クエスト滞在を確定して計測停止
  hideAllScreens();
  updateHud(null, { isQuestMode: false }); // HUDを通常モードに戻す
  closeDialogue(); // ★会話モーダルを閉じる
  fadeOutBGM(1000); // ★ メニューに戻るときはBGMをフェードアウト（クエストマップBGM等を停止）
  if (menuDiv) menuDiv.style.display = "block";

  // ★EXTRA CLEAR 特典：MUSIC ボタンは EXTRA全クリア後のみ表示する
  if (musicMenuBtn) {
    musicMenuBtn.style.display = hasExtraCleared() ? "inline-block" : "none";
  }

  showMenuBackground("title_menu");
  updateHud(); // メインメニューが表示されたタイミングでHUDのデータを同期
  const hud = document.getElementById("playerHud");
  if (hud) hud.style.display = "block";
}

function openClearRewardModal() {
  const content = document.getElementById("clearRewardContent");
  if (!clearRewardModalDiv || !content) return;

  // ★EXTRA全クリア済みなら、全クリア特典に加えてEXTRAクリア特典も表示する
  let html = getClearRewardHtml();
  if (hasExtraCleared()) {
    html += `<hr style="border:none;border-top:1px solid rgba(255,255,255,0.15);margin:16px 0;">`;
    html += getExtraClearRewardHtml();
  }

  content.innerHTML = html;
  clearRewardModalDiv.classList.remove("hidden");
}

function closeClearRewardModal() {
  if (!clearRewardModalDiv) return;
  clearRewardModalDiv.classList.add("hidden");
}


function showQuestMenu() {
  hideAllScreens();
  closeDialogue(); // ★会話モーダルを閉じる
  fadeOutBGM(1000); // ★ メニューに戻るときはBGMをフェードアウト（クエストマップBGM等を停止）
  if (questMenuDiv) questMenuDiv.style.display = "flex"; // 縦flex+内部スクロールのためflexで表示

  // オートセーブデータの有無をチェック
  const auto = JSON.parse(localStorage.getItem("quest_auto_save"));
  const hasSave =
    auto &&
    auto.progress &&
    auto.progress.cleared &&
    auto.progress.cleared.length > 0;

  // セーブデータがない場合は「Continue」ボタンを非表示にする
  if (questStartBtn) questStartBtn.style.display = hasSave ? "block" : "none";

  // CLEAR REWARD ボタンは「全クリア後（QUEST BOSS 表示条件と同じ）」 경우에만表示
  if (questClearRewardBtn) {
    questClearRewardBtn.style.display = hasBossChallengeUnlocked() ? "inline-block" : "none";
  }

  renderQuestSlots(); // ★これ追加
  showMenuBackground("quest_menu"); //クエストメニュー画面
}
function showStartMenu() { 
  stopQuestSession(); // ★クエスト滞在を確定して計測停止
  hideAllScreens(); 
  fadeOutBGM(1000); // ★ メニューに戻るときはBGMをフェードアウト（クエストマップBGM等を停止）
  if (startMenuDiv) startMenuDiv.style.display = "flex"; // 縦flex+内部スクロールのためflexで表示 
  showMenuBackground("title_menu");
}
function showFreeStartMenu() {
  stopQuestSession(); // ★クエスト滞在を確定して計測停止
  hideAllScreens();
  fadeOutBGM(1000); // ★ メニューに戻るときはBGMをフェードアウト（クエストマップBGM等を停止）
  if (freeStartMenuDiv) freeStartMenuDiv.style.display = "flex"; // 縦flex+内部スクロールのためflexで表示

  const freeModeConfig = document.getElementById("freeModeConfig");
  if (freeModeConfig) freeModeConfig.style.display = "block";

  // ★EXTRA CLEAR 特典：BGM選択行の表示を更新（解放前は非表示）
  updateFreeBgmRowVisibility();

  // BOSS チャレンジボタンの表示制御
  // ※ loadQuestSlots() の JSON parse を毎回行うと重いので結果をキャッシュする
  if (freeBossBtn) {
    if (typeof showFreeStartMenu._bossUnlocked !== "boolean") {
      showFreeStartMenu._bossUnlocked = hasBossChallengeUnlocked();
    }
    freeBossBtn.style.display = showFreeStartMenu._bossUnlocked ? "inline-block" : "none";
  }

  // ★全クリア特典：フリーモードのスキル設定欄（ENEMY / QUEST BOSS）の表示と内容を更新
  // ※ 解放判定（hasFreeActiveSkillUnlocked）も同様にキャッシュしてメニュー往復を軽くする
  updateFreeSkillConfigUI("enemy");
  updateFreeSkillConfigUI("boss");

  // 難易度セレクターは初回のみ構築し、MASTER解放など変化があったときだけ再構築する
  // （メニュー往復のたびに4スコープ分の innerHTML + createElement を繰り返さない）
  // ※ MASTER解放状態（選択肢数）が変わった場合だけ force 再構築する
  try {
    const availCount = getAvailableDifficulties({ includeMaster: true }).length;
    if (showFreeStartMenu._availCount !== availCount) {
      showFreeStartMenu._availCount = availCount;
      // 初回(_built未設定)は通常構築、2回目以降の変化は強制再構築
      updateAllDifficultySelectors(!updateAllDifficultySelectors._built ? false : true);
    } else {
      updateAllDifficultySelectors();
    }
  } catch (e) {
    updateAllDifficultySelectors();
  }

  showMenuBackground("title_menu");
  // 最後に選択されていた（またはデフォルトの）モードを表示
  // ※ saveFreeModeConfig() の localStorage 書き込みを毎回行わないよう軽量切替にする
  switchFreeModeConfig(currentFreeModeId, { save: false });
}

export function showQuestMap() {
  hideAllScreens();
  showMenuBackground(false); // クエストマップは専用の描画があるため隠す
  reloadQuestProgress();
  reloadQuestPlayerStats(); // ★セッションflush後の最新値をメモリに反映
  startQuestSession(); // ★クエスト滞在計測開始（マップ・会話・ポーズ含む）
  
  questMapScreen.style.display = "block";
  renderQuestMapUI();

  // クエストマップBGMをフェードインで再生
  gameState.startTime = getNow(); // BGM表示タイマーをリセット
  fadeBGMTo(BGM_CONFIG.QUEST_MAP);
}

export function showGameScreen() {
  hideAllScreens();
  showMenuBackground(false); // ゲーム中はタイピングに集中するため隠す
  gameDiv.style.display = "block";
}

// ================================
// 🔹イベントバインディングまとめ
// ================================

// キーバインド重複チェック（Settings KEY / クエストマップKey Bindモーダル共用）
function validateKeybinds(bind) {
  const values = Object.values(bind);
  const unique = new Set(values);
  return unique.size === values.length;
}

function bindMenuEvents() {

  questMenuBtn?.addEventListener("click", () => {
    // ★オフラインダウンロード中はメニュー操作を受け付けない
    if (_offlineModalActive) return;
    playSE("select");
    updateHud(null, { isQuestMode: true });
    showQuestMenu();
  });

  startMenuBtn?.addEventListener("click", () => { 
    if (_offlineModalActive) return;
    playSE("select"); 
    showStartMenu(); 
  });
  
  freeModeBtn?.addEventListener("click", () => { 
    if (_offlineModalActive) return;
    playSE("select"); 
    showFreeStartMenu(); 
  });

  recordsMenuBtn?.addEventListener("click", () => {
    // ★オフラインダウンロード中はメニュー操作を受け付けない
    if (_offlineModalActive) return;
    playSE("select");
    hideAllScreens();
    showRecordsView(Game.getLastGameMode?.() ?? GameModes.NORMAL);
  });

  onlineRankingBtn?.addEventListener("click", () => {
    // ★オフラインダウンロード中はメニュー操作を受け付けない
    if (_offlineModalActive) return;
    playSE("select");
    hideAllScreens();
    openOnlineRanking();
  });

  // ★EXTRA CLEAR 特典：ミュージックプレイヤー（収録曲を自由に再生）
  musicMenuBtn?.addEventListener("click", () => {
    // ★オフラインダウンロード中はメニュー操作を受け付けない
    if (_offlineModalActive) return;
    playSE("select");
    openMusicModal();
  });

  // 「戻る」ボタンは、すべてshowMainMenuを呼び出すように統一する
  startMenuBackBtn?.addEventListener("click", () => { playSE("select"); showMainMenu(); });
  freeStartMenuBackBtn?.addEventListener("click", () => { playSE("select"); showMainMenu(); });
  questStartMenuBackBtn?.addEventListener("click", () => { playSE("select"); showMainMenu(); });

  questSaveBtn?.addEventListener("click", () => {
    playSE("questmenu"); // ★SAVE/LOADメニューを開いた時のSE
    flushQuestSessionTime(); // ★開いた時点の滞在時間を確定して表示に反映
    reloadQuestPlayerStats(); // ★flush後の最新値をメモリに反映
    questSaveMenuDiv.classList.remove("hidden");
    renderQuestSlots();
  });

  saveToQuestMenuBackBtn?.addEventListener("click", () => {
    playSE("select");
    questSaveMenuDiv.classList.add("hidden");
  });

  questClearRewardBtn?.addEventListener("click", () => {
    playSE("questmenu");
    openClearRewardModal();
  });

  const clearRewardModalCloseBtn = document.getElementById("clearRewardModalCloseBtn");
  clearRewardModalCloseBtn?.addEventListener("click", () => {
    playSE("select");
    closeClearRewardModal();
  });

  // ★クエストマップのキー設定モーダルの閉じる/保存ボタン
  const keybindConfigCloseBtn = document.getElementById("keybindConfigCloseBtn");
  keybindConfigCloseBtn?.addEventListener("click", () => {
    playSE("select");
    closeKeybindConfigModal();
  });
  const keybindConfigSaveBtn = document.getElementById("keybindConfigSaveBtn");
  keybindConfigSaveBtn?.addEventListener("click", () => {
    playSE("select");
    saveKeybindConfigFromModal();
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

// ※ 真エンディングシーケンス（startTrueEndingSequence）の実体は dialogue.js にあります。
//   以前ここに未使用の重複定義がありましたが、loadStaffRollCSS / fadeToBlack /
//   showStaffRoll など未定義の関数を参照していて呼ぶと必ず失敗する死んだコードだったため、
//   キャッシュ不整合の原因を避ける意味も含めて削除しました。

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

      // 一旦ロード画面を隠す
      hideLoading();

      // 免責事項をフェード表示し、ユーザーのアクションを待つ
      await showDisclaimer("この物語はフィクションです。\n登場する人物、団体、名称などはすべて架空のものであり、実在のものとは一切関係ありません。");

      // ローディング画面を再表示
      showLoadingScreen();
      
      setLoadingText("Creating New World...");
      await new Promise(r => setTimeout(r, 1000));
  
      // 進行状況の初期化
      resetQuestSession(); // ★旧セッション破棄（旧データの時間が混ざらないように）
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

  freeBossBtn?.addEventListener("click", () => {
    switchFreeModeConfig('Boss');
  });

  startBtn?.addEventListener("click", () => {
    hideAllScreens();
    updateGameUIVisibility(GameModes.NORMAL.id); // UI表示を更新
    // ★デイリーでは英語タグを除外して出題する（固定設定）
    Game.doCountdown({ mode: GameModes.NORMAL, isFreeMode: false, difficulty: "hard", custom: { excludeTags: DAILY_EXCLUDED_TAGS } });
  });

  timeAttackBtn?.addEventListener("click", () => {
    hideAllScreens();
    updateGameUIVisibility(GameModes.TIME_ATTACK.id); // UI表示を更新
    // ★デイリーでは英語タグを除外して出題する（固定設定）
    Game.doCountdown({ mode: GameModes.TIME_ATTACK, isFreeMode: false, difficulty: "hard", custom: { excludeTags: DAILY_EXCLUDED_TAGS } });
  });

  longTextBtn?.addEventListener("click", () => {
    hideAllScreens();
    updateGameUIVisibility(GameModes.LONG_TEXT.id); // UI表示を更新
    Game.doCountdown({ mode: GameModes.LONG_TEXT, isFreeMode: false, difficulty: null });
  });

  defenseModeBtn?.addEventListener("click", () => {
    hideAllScreens(); // ★追加: UIをリセット
    showMenuBackground(false);
    gameState.isFreeMode = false;
    gameState.isQuestMode = false;
    // ★ defenseCore.js の関数を呼び出す
    startDefenseMode({ isFreeMode: false }); // Pass isFreeMode
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

  freeDefenseModeBtn?.addEventListener("click", () => {
    switchFreeModeConfig('Defense');
  });

  freeDefenseModeBtn?.addEventListener("click", () => {
    switchFreeModeConfig('Defense');
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

    const specialModeInfo = getLastSpecialModeInfo();
    if (specialModeInfo.isSpecial) {
      if (specialModeInfo.type === "defense_mode") {
        restartDefenseMode();
      } else { // "enemy_mode" or null (legacy)
        // フリーモードのエネミーモードの場合、UIの設定（Tier等）を反映し直して開始する
        // ★直前のモードがboss-only（ボス戦のみ）だった場合は、ボスフェーズから再開する
        console.log("[PLAY AGAIN] wasLastModeBossOnly():", wasLastModeBossOnly());
        console.log("[PLAY AGAIN] gameState.isFreeMode:", gameState.isFreeMode);
        if (wasLastModeBossOnly()) {
          console.log("[PLAY AGAIN] -> restartEnemyMode (boss only)");
          restartEnemyMode();
        } else if (gameState.isFreeMode) {
          console.log("[PLAY AGAIN] -> startFreeEnemyMode");
          startFreeEnemyMode();
        } else {
          console.log("[PLAY AGAIN] -> restartEnemyMode");
          restartEnemyMode();
        }
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

    // ★ 防衛モードやエネミーモードの画面が残らないように非表示にする
    const enemyContainer = document.getElementById("enemyModeContainer");
    const canvas = document.getElementById("enemyModeCanvas");
    if (enemyContainer) enemyContainer.style.display = "none";
    if (canvas) canvas.style.display = "none";

    const defenseContainer = document.getElementById("defenseModeContainer");
    const canvasDef = document.getElementById("defenseModeCanvas");
    if (defenseContainer) defenseContainer.style.display = "none";
    if (canvasDef) canvas.style.display = "none";
    const defenseUiContainer = document.getElementById("defense-ui-container");
    if (defenseUiContainer) defenseUiContainer.style.display = "none";

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

  // defenseResult.js からの呼び出しに対応
  resultBackBtn?.addEventListener("click", () => {
      showMainMenu();
  });

  // defenseResult.jsなど、他のモジュールからのメニュー復帰要求をハンドル
  document.addEventListener("back-to-main-menu", () => {
    closeOnlineRanking?.();
    showMainMenu();
  });

  recordsBackBtn?.addEventListener("click", showMainMenu);

  // ★オンラインランキングの×（右上）：画面を閉じてHUDを戻す
  rankingBackBtn?.addEventListener("click", () => {
    hideAllScreens();
    closeOnlineRanking?.();
    showMainMenu();
  });
}

//クエストサイドメニューの戻るボタン用
export function backToQuestMenu() {
  stopQuestSession(); // ★クエスト滞在を確定して計測停止
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
  
  document.addEventListener("keydown", async (e) => {

    // ★スタッフロール中は全ショートカットを無効化（ESCによるスキップはdialogue.js側で処理）
    if (window._staffRollActive) return;

    if (handleQuestSaveClearModalKey(e)) return;

    // ★オフラインダウンロードモーダル表示中は全キーショートカットを無効化
    //   Escのみ、ダウンロード中ならキャンセル・完了後は閉じる操作に使える
    if (_offlineModalActive) {
      e.preventDefault();
      if (e.key === "Escape") {
        if (_offlineDlRunning) _cancelOfflineDownload();
        else _hideOfflineDownloadModal();
      }
      return;
    }

    // ★勲章・詳細ステータス系モーダル表示中は、キー入力をモーダル操作（閉じる/タブ切替）に限定する。
    //   （それ以外のキーが handleGameKey / handleMenuKey 等に漏れて別メニューが開くのを防ぐ）
    if (!e.ctrlKey && !e.metaKey && handleStatsModalKey(e)) return;

    // ★フリーモードのスキル設定モーダル（SKILL SELECT / STAR UPGRADE）表示中は
    //   閉じる操作のみ受け付け、メニューのキー操作（BACK等）へ漏らさない
    if (!e.ctrlKey && !e.metaKey && handleFreeSkillModalKey(e)) return;

    // ★EXTRA CLEAR 特典：ミュージックプレイヤー表示中は
    //   閉じる操作のみ受け付け、メニューのキー操作（BACK等）へ漏らさない
    if (!e.ctrlKey && !e.metaKey && handleMusicModalKey(e)) return;

    // ★クエストマップのキー設定モーダル（Key Bind Config）表示中は
    //   すべてのキー入力をブロックし、b/Esc/Enter で閉じる
    if (!e.ctrlKey && !e.metaKey && handleQuestKeybindConfigModalKey(e)) return;

    // 管理者用DEVツール（Shift+Oで開閉）
    if (e.shiftKey && e.key.toLowerCase() === "o") {
      const panel = document.getElementById("devPanel");
      if (!panel) return;

      // ★DEVパネル起動キーがタイピング入力として処理されないよう止める
      e.preventDefault();

      panel.style.display =
        panel.style.display === "none" ? "block" : "none";
      return;
    }

    if (handleResultKey(e)) return;
    if (handlePauseKey(e)) return;
    if (await handleGameKey(e)) return;
    if (handleMenuKey(e)) return;
  });
}

function handleStatsModalKey(e) {

  // 勲章モーダル / 詳細ステータスモーダル（通常・クエスト）のいずれかが表示中かを判定
  const modalTargets = [
    { id: "achModal",          closeBtn: "achClose" },         // 勲章
    { id: "playerStatsModal",  closeBtn: "statsClose" },       // 詳細ステータス（通常）
    { id: "questStatsModal",   closeBtn: "statsCloseQuest" },  // 詳細ステータス（クエスト）
  ];

  const openModal = modalTargets.find(
    ({ id }) => {
      const m = document.getElementById(id);
      return m && window.getComputedStyle(m).display !== "none";
    }
  );
  if (!openModal) return false;

  e.preventDefault(); // モーダル操作以外のデフォルト挙動・後続ハンドラーを全て止める

  const key = e.key.toLowerCase();

  // 閉じる（b / Escape）
  if (key === "b" || key === "escape") {
    document.getElementById(openModal.closeBtn)?.click();
    return true;
  }

  // クエスト詳細ステータスのタブ切替（MAIN / RECORD / PROGRESSION / SKILL）
  if (openModal.id === "questStatsModal") {
    const tabPage = {
      m: "main",
      r: "record",
      p: "progression",
      s: "skill",
    }[key];
    if (tabPage) {
      const questNavBtn = document.querySelector(
        `.quest-page-nav button[data-page="${tabPage}"]`
      );
      questNavBtn?.click();
    }
  }

  // それ以外のキーは全て無効（他メニューが開くのを防ぐ）
  return true;
}
// ★クエストのセーブ／ロード・クリア報酬モーダル表示中は、他のショートカットキーを無効化
function handleQuestSaveClearModalKey(e) {
  const questModals = [
    { id: "clearRewardModal" },
    { id: "saveModal" },
    { id: "clearRewardPopup" },
    { id: "saveConfirmPopup" },
  ];

  const active = questModals.find(({ id }) => {
    const el = document.getElementById(id);
    return el && window.getComputedStyle(el).display !== "none";
  });

  if (!active) return false;

  const key = e.key.toLowerCase();

  // 閉じる操作のみ許可
  if (key === "escape" || key === "b") {
    if (active.id === "clearRewardModal") {
      closeClearRewardModal();
      return true;
    }
    if (active.id === "saveModal") {
      saveToQuestMenuBackBtn?.click();
      return true;
    }
    if (active.id === "clearRewardPopup") {
      e.preventDefault();
      const popup = document.getElementById("clearRewardPopup");
      if (popup) popup.remove();
      return true;
    }
    if (active.id === "saveConfirmPopup") {
      e.preventDefault();
      const popup = document.getElementById("saveConfirmPopup");
      if (popup) popup.remove();
      return true;
    }
  }

  e.preventDefault();
  return true;
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
  
      // ★ 防衛モード
      if (gameState.currentMode?.id === GameModes.DEFENSE_MODE.id) {
        restartDefenseMode();
        return true;
      }
      if (gameState.enemyMode) {
        // ★フリーモードのボス戦（QUEST BOSS）は直前のモードを維持して再開する。
        //   （従来は startFreeEnemyMode() が呼ばれ、ENEMYモードで再開されてしまっていた）
        //   ※ restartEnemyMode() は lastEnemyConfig を使うため、フリースキル設定も維持される
        if (gameState.isFreeMode && !wasLastModeBossOnly()) startFreeEnemyMode();
        else restartEnemyMode();
      }
      else Game.restartLastGame();
            break;

    case "b":
      setPaused(false);
      document.querySelector(".pause-overlay").style.display = "none";

      // ★ フラグはリセット/遷移前に取得する（fullResetGame/backToMenu で
      //   currentIsFreeMode 参照やクリアが発生しても、下段ルーティングの判定は安全になる）
      const wasQuest = gameState.isQuestMode || !!gameState.currentQuestNode;
      const wasFree = gameState.isFreeMode;

      // ★ スキルモード中断
      if (gameState.currentChallenge?.isSkillMode) {

        backToMenu();
        if (hintDiv) hintDiv.style.display = "none";
        showQuestMap();
        openQuestMenuModal("skillTree");
        gameState.currentChallenge.isSkillMode = false;

        return true;
      }

      // ★ 防衛モード
      if (gameState.currentMode?.id === GameModes.DEFENSE_MODE.id) {
                // 中断は失敗扱い
        gameState.enemyStats.failed = true;

        restartDefenseMode(true); // `true` を渡して中断処理を強制
        Game.fullResetGame();
        gameState.typed = "";
        // 防衛モードがクエストの一部として開始された場合（現状はフリー/デイリーのみだが将来的な拡張を考慮）
        if (wasQuest) showQuestMap();
        else if (wasFree) showFreeStartMenu();
        else showStartMenu();
        return true;
      }

      // ★ クエストモード
      if (gameState.currentQuestNode) {
        if (skillTreeDiv) skillTreeDiv.style.display = "none";
        endEnemyMode(true); // ★中断: 記録を残さない
        gameState.typed = "";
        Game.fullResetGame();
        showQuestMap();
        return true;
      }

                              if (gameState.enemyMode) {
        endEnemyMode(true); // ★中断: 記録を残さない
        gameState.typed = "";
        Game.fullResetGame();
      }
  

      // ★ 通常モード
      Game.backToMenu();
      if (wasQuest) showQuestMap();
      else if (wasFree) showFreeStartMenu();
      else showStartMenu();

      break;

  }

  return true;
}

async function handleGameKey(e) {

  const keybinds = loadKeybinds();

  if (!Game.isGameActive) return false;

  // 矢印キーのページスクロール防止（バインドの有無にかかわらずゲーム中は無効化）
  if (e.code.startsWith("Arrow")) e.preventDefault();

  // ★終了演出中は入力停止
  if (gameState.isEnding) return true;

  // ★エネミーモードの開始・フェーズ移行演出中は入力停止
  if (gameState.enemyMode && gameState.enemyStats?.isTransitioning) return true;

  if (getPaused()) return true;

  // ポーズトグル
  if (isBoundKey(e, keybinds.pause)) {
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
      // クエスト中の防衛モードかエネミーモードかを判定
      if (gameState.currentMode?.id === GameModes.DEFENSE_MODE.id) {
        // 防衛モードの中断処理
        await restartDefenseMode(true);
        Game.fullResetGame();
        gameState.typed = "";
        showQuestMap();
        return true; // ★追加: 処理をここで終了させる
      } else {
        // エネミーモードの中断処理
        const isQuest = gameState.isQuestMode || true;
        gameState.enemyStats.failed = true;
        endEnemyMode(true); // ★ESC中断: 記録を残さない
        Game.fullResetGame();
        gameState.typed = "";
        if (skillTreeDiv) skillTreeDiv.style.display = "none";
        if (isQuest) showQuestMap();
        else showMainMenu();
      }
      return true;
    }

    // ★③-2 防衛モード (クエスト中かどうかも判定)
    if (gameState.currentMode?.id === GameModes.DEFENSE_MODE.id) {
      // フリー/デイリーの防衛モードを中断
      // ★フラグはリセット前に取得する（fullResetGame でクリアされても遷移に影響しないように）
      const wasFree = gameState.isFreeMode;
      await restartDefenseMode(true); // 中断処理
      Game.fullResetGame();
      gameState.typed = "";
      if (wasFree) showFreeStartMenu();
      else showStartMenu();
      return true;
    }
    // ★③ エネミーモード
    if (gameState.enemyMode) {
      const isQuest = gameState.isQuestMode;
      // ★フラグはリセット前に取得する（fullResetGame でクリアされても遷移に影響しないように）
      const wasFree = gameState.isFreeMode;
      gameState.enemyStats.failed = true;
      endEnemyMode(true); // ★ESC中断: 記録を残さない
      Game.fullResetGame();
      gameState.typed = "";
      if (isQuest) showQuestMap();
      else if (wasFree) showFreeStartMenu();
      else showStartMenu();
      return true;
    }

    // ★④ 通常
    // ★フラグは遷移前に取得する
    const isQuestNormal = gameState.isQuestMode;
    const wasFree = gameState.isFreeMode;
    Game.backToMenu();
    if (isQuestNormal) showQuestMap();
    else if (wasFree) showFreeStartMenu();
    else showStartMenu();
    return true;
  }

  // 入力処理
  if (gameState.currentMode?.id === GameModes.DEFENSE_MODE.id) {
    handleDefenseKey(e);
  } else if (gameState.enemyMode) {
    if (e.code === "Tab") e.preventDefault();
    handleEnemyKey(e);
  } else { // Normal mode (and other non-enemy/defense modes)
    handleKey(e, false, gameState, { type: 'romaji' }); // Add combo per romaji character
  }

  return true;
}

// ★v1.0.22: 画面の「実際の表示状態」を判定するヘルパ。
//   style.display はインライン未設定の要素で "" になるため、
//   CSS で display:none にされている隠れ画面まで
//   「表示中」と誤判定して裏でショートカットが発火する問題を防ぐ。
function isScreenVisible(div) {
  return !!div && window.getComputedStyle(div).display !== "none";
}

function handleMenuKey(e) {


  const key = e.key.toLowerCase();

  // ★会話・ログモーダルが表示されている場合のキー処理
  if (isDialogueVisible()) {
    // .log-view-mode クラスの有無でログ表示中かを判定する
    const dialogueContainer = document.querySelector("#dialogueModal .dialogue-container");
    const isLogView = dialogueContainer && dialogueContainer.classList.contains('log-view-mode');

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
          case "m": // MASTER
            btn = btnContainer.querySelector("button:nth-child(4)");
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

    // タブ切り替え（MAIN / RECORD / PROGRESSION / SKILL）
    if (!e.ctrlKey && !e.metaKey) { // 修飾キー（Ctrl/Cmd + キー）は除外
      const questPageBtn = document.querySelector(".quest-page-nav");
      if (questPageBtn) {
        let targetButton = null;
        switch (key) {
          case "m": // MAIN
            targetButton = questPageBtn.querySelector('button[data-page="main"]');
            break;
          case "r": // RECORD
            targetButton = questPageBtn.querySelector('button[data-page="record"]');
            break;
          case "p": // PROGRESSION
            targetButton = questPageBtn.querySelector('button[data-page="progression"]');
            break;
          case "s": // SKILL
            targetButton = questPageBtn.querySelector('button[data-page="skill"]');
            break;
        }
        if (targetButton) {
          targetButton.click();
          e.preventDefault();
          return true; // タブを切り替えたので処理を終了
        }
      }
    }
  }

  if (isScreenVisible(settingsDiv)) {
    if (key === "b" || key === "escape") {
      e.preventDefault();
      settingsBackBtn?.click();
    }
    return true;
  }

  if (isScreenVisible(onlineRankingDiv)) {
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
            case "d": // Defense Mode
                targetButton = onlineRankingModeButtons.querySelector('button[data-mode="defense_mode"]');
                break;
        }
        if (targetButton) {
            targetButton.click();
            e.preventDefault();
        }
    }
    return true;
  }

  if (isScreenVisible(recordsDiv)) {
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
            case "d": // Defense Mode
                targetButton = recordsModeButtons.querySelector('button[data-mode="defense_mode"]');
                break;
        }
        if (targetButton) {
            targetButton.click();
            e.preventDefault();
        }
    }
    return true;
  }

  if (isScreenVisible(menuDiv)) {
    // メインメニュー
    switch (key) {
      case "h": startMenuBtn?.click(); break;
      case "d": startMenuBtn?.click(); break; // Daily
      case "q": questMenuBtn?.click(); break; // Quest
      case "f": freeModeBtn?.click(); break;
      case "r": recordsMenuBtn?.click(); break;
      case "o": onlineRankingBtn?.click(); break; // Online
      case "m": musicMenuBtn?.click(); break; // Music（★EXTRA CLEAR 特典）
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

  if (isScreenVisible(startMenuDiv)) {
    // デイリーモードメニュー
    switch (key) {
      case "k": startBtn?.click(); break;
      case "s": startBtn?.click(); break; // Standard
      case "t": timeAttackBtn?.click(); break;
      case "l": longTextBtn?.click(); break;
      case "e": enemyModeBtn?.click(); break; // Enemy
      case "d": defenseModeBtn?.click(); break; // Defense
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

  if (isScreenVisible(freeStartMenuDiv)) {
    // フリーモードメニュー
    switch (key) {
      case "k": freeStartBtn?.click(); break;
      case "s": freeStartBtn?.click(); break; // Standard
      case "t": freeTimeAttackBtn?.click(); break;
      case "l": freeLongTextBtn?.click(); break;
      case "e": freeEnemyModeBtn?.click(); break; // Enemy
      case "d": freeDefenseModeBtn?.click(); break; // Defense
      case "q": freeBossBtn?.click(); break; // Quest Boss
      case "v": // ★全クリア特典：フリーモードのスキル選択（ENEMY/BOSSパネル表示中のみ）
        if (isFreeSkillPanelVisible()) openFreeSkillSelect(getVisibleFreeSkillTarget());
        break;
      case "u": // ★全クリア特典：フリーモードの星強化（同上）
        if (isFreeSkillPanelVisible()) openFreeStarUpgrade(getVisibleFreeSkillTarget());
        break;
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

  if (isScreenVisible(questMenuDiv)) {
    // クエストモードメニュー
    switch (key) {
      case "c": // Continue
        questStartBtn?.click();
        break;
      case "r": // Clear Reward
        questClearRewardBtn?.click();
        break;
      case "s": // Save/Load
        questSaveBtn?.click();
        break;
      case "n": // New Game
        questStartBtnFromBeginning?.click();
        break;
      case "b":
        if (clearRewardModalDiv && !clearRewardModalDiv.classList.contains("hidden")) {
          closeClearRewardModal();
        } else {
          questStartMenuBackBtn?.click();
        }
        break;
      case "a": // Achievements
        document.getElementById("hudAchievementsBtn")?.click();
        break;
      case "i": // Info/Stats
        document.getElementById("hudDetailBtn")?.click();
        break;
    }
    return true;
  }

  if (isScreenVisible(questMapScreen)) {
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
        case "u": // star upgrade
          btn = sideMenu.querySelector("button:nth-child(4)");
          break;  
        case "p": // status (was "i")
          btn = sideMenu.querySelector("button:nth-child(5)");
          break;
        case "l": // log (new)
          btn = sideMenu.querySelector("button:nth-child(6)");
          break; 
        case "s": // save/load
          btn = sideMenu.querySelector("button:nth-child(7)");
          break;
        case "k": // key bindings
          btn = sideMenu.querySelector("button:nth-child(8)");
          break;
        case "b": // Back
          btn = sideMenu.querySelector("button:nth-child(9)");
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
    soundIcon.src = Game.getSoundEnabled() ? "./assets/pic/sound1.png" : "./assets/pic/soundmute.png";
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

        // ステージが拡大縮小されているため、表示座標をステージ座標へ変換する
        const s = getStageScale() || 1;

        window.mousePos = {
            x: (e.clientX - rect.left) / s,
            y: (e.clientY - rect.top) / s
        };
    });

    enemyCanvas.addEventListener("mouseleave", () => {
        window.mousePos = null;
    });
}

/**
 * モバイルデバイスの判定と警告表示
 *
 * 【判定基準の緩和】
 *  - タッチ対応のWindowsノートPC（navigator.maxTouchPoints > 0）や
 *    小さいブラウザウィンドウでは警告を出さないよう、『モバイルUAのみ』で判定する。
 *  - これにより、普通のWindows PC / Mac では警告が表示されない。
 *
 * 【ゲームをブロックしない】
 *  - 警告は表示するだけ。続行ボタンで閉じればそのままプレイできる。
 */
function checkMobile() {
  // 1. 判定：スマホ/タブレットのUser-Agentのみを対象とする
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Windows Phone/i.test(navigator.userAgent);
  if (!isMobileUA) return false;

  // 2. 警告画面を取得、なければ作成
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
      <p>このゲームはPCおよび物理キーボードを推奨しています。<br>
      スマートフォンやタブレットでは操作が難しい場合があります。</p>
      <button id="mobileWarningContinue">このままプレイする</button>
    </div>
  `;

  // 3. 続行ボタンで警告を閉じる（ゲームはブロックせず続行可能）
  const continueBtn = document.getElementById("mobileWarningContinue");
  if (continueBtn) {
    continueBtn.addEventListener("click", () => {
      warning.style.setProperty("display", "none", "important");
    });
  }

  return true;
}