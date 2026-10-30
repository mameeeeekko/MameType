// musicPlayer.js
// =====================================================
// ミュージックプレイヤー（EXTRA CLEAR 特典）
// -----------------------------------------------------
// ・トップメニューの MUSIC ボタンから開く（EXTRA全クリアで解放）
// ・assetsLoader.js に定義されている BGM を自由に再生できる
// ・再生は effectManager の playBGM / stopBGM / seekBGM を使用するため、
//   設定の BGM トグル・BGM 音量がそのまま適用される
//   （BGMトグルOFF時は effectManager 側で再生されない）
// ・進捗バーはドラッグでシーク可能（押した位置にプレビュー、離した時点で確定）
// ・モーダルを閉じたら再生も停止する
// =====================================================

import { getBgmAssets } from "./assetsLoader.js";
import {
    playBGM, stopBGM, ensureSound, playSE,
    getBgmPlaybackInfo, seekBGM, pauseBGM, resumeBGM, isBgmPaused,
} from "./effectManager.js";

const MODAL_ID = "musicModal";
const LIST_ID = "musicList";
const TITLE_ID = "musicNowTitle";
const BAR_ID = "musicProgressBar";
const FILL_ID = "musicProgressFill";
const KNOB_ID = "musicProgressKnob";
const TIME_ID = "musicProgressTime";
const STOP_BTN_ID = "musicStopBtn";
const PAUSE_BTN_ID = "musicPauseBtn";

// 再生中のBGM名（null = 停止中）
let currentTrack = null;
// 一覧を一度だけ構築するためのキャッシュ
let listBuilt = false;
// name → { title, composer } の対応表（NOW PLAYING 表示用）
const trackMap = {};

// キーボード選択状態
let selectedTrackIndex = 0;
let selectedAction = 0; // 0: PAUSE, 1: STOP
let selectionMode = "track"; // "track" | "action"

// 進捗バーのドラッグ状態
let dragging = false;
let dragRatio = 0;
let progressRafId = null;

/**
 * ミュージックモーダルが表示中かどうか。
 * @returns {boolean}
 */
export function isMusicModalOpen() {
    const modal = document.getElementById(MODAL_ID);
    return !!modal && !modal.classList.contains("hidden");
}

/**
 * ミュージックモーダルを閉じます。
 * ★閉じた時点で再生中の曲も停止します（メニュー遷移での閉じても同様）。
 */
export function closeMusicModal() {
    const modal = document.getElementById(MODAL_ID);
    if (modal) modal.classList.add("hidden");

    // ★閉じたら再生を停止（進捗ループも停止する）
    if (currentTrack) {
        stopBGM();
        currentTrack = null;
        updatePlayingHighlight();
    }

    stopProgressLoop();
    updateProgressUI();
    clearSelectionStyles();
}

/** ミュージックモーダルを開きます。 */
export function openMusicModal() {
    const modal = document.getElementById(MODAL_ID);
    if (!modal) return;

    buildListIfNeeded();

    // 前回の表示中にドラッグが途切れていた場合の保険
    dragging = false;
    const bar = document.getElementById(BAR_ID);
    if (bar) bar.classList.remove("dragging");

    modal.classList.remove("hidden");
    // キーボード選択の初期化
    const rows = getTrackRows();
    if (rows.length) {
        if (currentTrack) {
            const idx = rows.findIndex(r => r.dataset.bgm === currentTrack);
            selectedTrackIndex = idx >= 0 ? idx : 0;
        } else {
            selectedTrackIndex = 0;
        }
    }
    selectionMode = "track";
    selectedAction = 0;
    clearSelectionStyles();
    updateTrackSelection();

    updatePlayingHighlight();
    updateProgressUI();
    startProgressLoop();
}

/**
 * モーダル表示中のキー処理。
 * 表示中は他のキー処理へ流さないため true を返します（freeSkillUI と同じ流儀）。
 * @param {KeyboardEvent} e
 * @returns {boolean} 処理したかどうか
 */
// =====================================================
// キーボード操作用の選択ヘルパー
// =====================================================
function getTrackRows() {
    const list = document.getElementById(LIST_ID);
    return list ? [...list.querySelectorAll(".music-row")] : [];
}

function updateTrackSelection() {
    const rows = getTrackRows();
    rows.forEach((row, i) => {
        if (i === selectedTrackIndex) {
            row.style.outline = "2px solid #58a6ff";
            row.style.outlineOffset = "-2px";
        } else {
            row.style.outline = "";
            row.style.outlineOffset = "";
        }
    });
    if (rows[selectedTrackIndex]) {
        rows[selectedTrackIndex].scrollIntoView({ block: "nearest" });
    }
}

function updateActionSelection() {
    const pauseBtn = document.getElementById(PAUSE_BTN_ID);
    const stopBtn = document.getElementById(STOP_BTN_ID);
    [pauseBtn, stopBtn].forEach((btn, i) => {
        if (!btn) return;
        if (i === selectedAction) {
            btn.style.outline = "2px solid #58a6ff";
            btn.style.outlineOffset = "-2px";
        } else {
            btn.style.outline = "";
            btn.style.outlineOffset = "";
        }
    });
}

function clearSelectionStyles() {
    getTrackRows().forEach(row => {
        row.style.outline = "";
        row.style.outlineOffset = "";
    });
    [document.getElementById(PAUSE_BTN_ID), document.getElementById(STOP_BTN_ID)].forEach(btn => {
        if (btn) { btn.style.outline = ""; btn.style.outlineOffset = ""; }
    });
}

function clearTrackSelection() {
    getTrackRows().forEach(row => {
        row.style.outline = "";
        row.style.outlineOffset = "";
    });
}
function clearActionSelection() {
    [document.getElementById(PAUSE_BTN_ID), document.getElementById(STOP_BTN_ID)].forEach(btn => {
        if (btn) { btn.style.outline = ""; btn.style.outlineOffset = ""; }
    });
}
function activateSelectedTrack() {
    const rows = getTrackRows();
    const row = rows[selectedTrackIndex];
    if (row) toggleTrack(row.dataset.bgm);
}

function activateSelectedAction() {
    if (selectedAction === 0) {
        if (!currentTrack) return;
        if (isBgmPaused()) resumeBGM(); else pauseBGM();
        updatePlayingHighlight();
        updateProgressUI();
    } else {
        stopCurrentTrack();
    }
    try { playSE("select"); } catch (e) { /* 無視 */ }
}

export function handleMusicModalKey(e) {
    if (!isMusicModalOpen()) return false;

    const key = (e.key || "").toLowerCase();
    if (key === "escape" || key === "b" || key === "m") {
        e.preventDefault();
        closeMusicModal();
        return true;
    }

    const rows = getTrackRows();

    if (key === "arrowup") {
        e.preventDefault();
        selectionMode = "track";
        selectedTrackIndex = Math.max(0, selectedTrackIndex - 1);
        if (!rows.length) return true;
        updateTrackSelection();
        clearActionSelection();
        return true;
    }
    if (key === "arrowdown") {
        e.preventDefault();
        selectionMode = "track";
        selectedTrackIndex = Math.min(Math.max(0, rows.length - 1), selectedTrackIndex + 1);
        if (!rows.length) return true;
        updateTrackSelection();
        clearActionSelection();
        return true;
    }
    if (key === "arrowleft") {
        e.preventDefault();
        selectionMode = "action";
        selectedAction = Math.max(0, selectedAction - 1);
        updateActionSelection();
        clearTrackSelection();
        return true;
    }
    if (key === "arrowright") {
        e.preventDefault();
        selectionMode = "action";
        selectedAction = Math.min(1, selectedAction + 1);
        updateActionSelection();
        clearTrackSelection();
        return true;
    }

    if (key === " " || key === "enter") {
        e.preventDefault();
        if (selectionMode === "track") {
            activateSelectedTrack();
        } else {
            activateSelectedAction();
        }
        updatePlayingHighlight();
        updateProgressUI();
        return true;
    }

    if (key === "p") {
        e.preventDefault();
        if (!currentTrack) return true;
        if (isBgmPaused()) resumeBGM(); else pauseBGM();
        updatePlayingHighlight();
        updateProgressUI();
        try { playSE("select"); } catch (e) { /* 無視 */ }
        return true;
    }
    if (key === "s") {
        e.preventDefault();
        stopCurrentTrack();
        return true;
    }

    // モーダル表示中はメニューのキー操作（BACK 等）へ漏らさない
    return true;
}

// =====================================================
// 一覧の構築
// =====================================================
function buildListIfNeeded() {
    if (listBuilt) return;

    const list = document.getElementById(LIST_ID);
    if (!list) return;

    list.innerHTML = "";

    const tracks = getBgmAssets();
    tracks.forEach((track) => {
        trackMap[track.name] = track;

        const row = document.createElement("button");
        row.type = "button";
        row.className = "music-row";
        row.dataset.bgm = track.name;

        row.innerHTML = `
            <span class="music-row-text">
                <span class="music-row-title">${track.title}</span>
                <span class="music-row-composer">${track.composer}</span>
            </span>
            <span class="music-row-icon">▶</span>
        `;

        row.addEventListener("click", () => {
            const rows = getTrackRows();
            const idx = rows.indexOf(row);
            if (idx >= 0) selectedTrackIndex = idx;
            selectionMode = "track";
            clearActionSelection();
            updateTrackSelection();
            toggleTrack(track.name);
        });

        list.appendChild(row);
    });

    listBuilt = true;
}

/** 曲名・作曲者を取得します（未登録の曲はアセット名をそのまま使う）。 */
function getTrackLabel(name) {
    const t = trackMap[name];
    return t ? t : { title: name, composer: "" };
}

// =====================================================
// 再生 / 停止
// =====================================================

/**
 * 指定した曲を再生します（再生中の曲をクリックした場合は停止）。
 * @param {string} name - BGMのアセット名（bgm_*）
 */
async function toggleTrack(name) {
    if (currentTrack === name) {
        // 同じ曲 → 一時停止 / 再開を切り替え
        if (isBgmPaused()) {
            resumeBGM();
        } else {
            pauseBGM();
        }
        updatePlayingHighlight();
        updateProgressUI();
        return;
    }

    // 別の曲 → 完全停止してから再生
    stopCurrentTrack();

    await ensureSound(name);
    playBGM(name, 1.0);

    currentTrack = name;
    updatePlayingHighlight();
    updateProgressUI();
    startProgressLoop();
}

/** 再生中の曲を停止します。 */
export function stopCurrentTrack() {
    stopBGM();
    currentTrack = null;
    updatePlayingHighlight();
    updateProgressUI();
    try { playSE("select"); } catch (e) { /* 音なしモードでも落とさない */ }
}

// =====================================================
// 再生中表示の更新
// =====================================================
function updatePlayingHighlight() {
    const list = document.getElementById(LIST_ID);
    if (!list) return;

    list.querySelectorAll(".music-row").forEach(row => {
        const isCurrent = !!currentTrack && row.dataset.bgm === currentTrack;
        const playing = isCurrent && !isBgmPaused();
        const paused = isCurrent && isBgmPaused();
        row.classList.toggle("playing", playing);
        row.classList.toggle("paused", paused);
        const icon = row.querySelector(".music-row-icon");
        if (icon) icon.textContent = isCurrent ? (isBgmPaused() ? "▶" : "⏸") : "▶";
    });

    const stopBtn = document.getElementById(STOP_BTN_ID);
    if (stopBtn) stopBtn.disabled = !currentTrack;

    const pauseBtn = document.getElementById(PAUSE_BTN_ID);
    if (pauseBtn) {
        pauseBtn.disabled = !currentTrack;
        pauseBtn.textContent = isBgmPaused() ? "RESUME" : "PAUSE";
    }
}

// =====================================================
// 進捗バー（NOW PLAYING）
// =====================================================

/** 秒を m:ss 形式に整形します。 */
function formatTime(sec) {
    const s = Math.max(0, Math.floor(sec || 0));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** 進捗バー・時間・NOW PLAYING タイトルを現在状態に合わせて更新します。 */
function updateProgressUI() {
    const bar = document.getElementById(BAR_ID);
    const fill = document.getElementById(FILL_ID);
    const knob = document.getElementById(KNOB_ID);
    const time = document.getElementById(TIME_ID);
    const title = document.getElementById(TITLE_ID);
    if (!bar || !fill || !knob || !time || !title) return;

    const info = getBgmPlaybackInfo();

    if (!info) {
        // 停止中 / BGMトグルOFF / ロード中
        bar.classList.add("disabled");
        bar.classList.remove("dragging");
        fill.style.width = "0%";
        knob.style.left = "0%";
        time.textContent = "0:00 / 0:00";
        title.textContent = currentTrack
            ? `${getTrackLabel(currentTrack).title}（停止中）`
            : "曲を選択してください";
        return;
    }

    bar.classList.remove("disabled");

    const label = getTrackLabel(info.name);
    title.textContent = label.composer
        ? `${label.title} / ${label.composer}`
        : label.title;
    if (isBgmPaused()) title.textContent += "（一時停止中）";

    // ドラッグ中は押した位置をプレビュー表示する
    const ratio = dragging ? dragRatio : (info.elapsed / info.duration);
    const pct = Math.min(100, Math.max(0, ratio * 100));

    fill.style.width = `${pct}%`;
    knob.style.left = `${pct}%`;
    time.textContent = `${formatTime(dragging ? ratio * info.duration : info.elapsed)} / ${formatTime(info.duration)}`;
}

/** 進捗バーの更新ループを開始します（モーダル表示中のみ）。 */
function startProgressLoop() {
    if (progressRafId !== null) return;
    const tick = () => {
        if (!isMusicModalOpen()) {
            progressRafId = null;
            return;
        }
        updateProgressUI();
        progressRafId = requestAnimationFrame(tick);
    };
    progressRafId = requestAnimationFrame(tick);
}

/** 進捗バーの更新ループを停止します。 */
function stopProgressLoop() {
    if (progressRafId !== null) {
        cancelAnimationFrame(progressRafId);
        progressRafId = null;
    }
}

// =====================================================
// 進捗バーのシーク操作（クリック / ドラッグ）
// -----------------------------------------------------
// ・押している間はプレビュー表示のみ（連続シークで音がチラつかないように）
// ・指を離した時点で seekBGM() を呼んで再生位置を確定する
// =====================================================
function initProgressSeek() {
    const bar = document.getElementById(BAR_ID);
    if (!bar) return;

    // スマホでのドラッグがスクロールと競合しないようにする
    bar.style.touchAction = "none";

    const ratioFromEvent = (e) => {
        const rect = bar.getBoundingClientRect();
        if (!rect.width) return 0;
        return Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    };

    bar.addEventListener("pointerdown", (e) => {
        if (bar.classList.contains("disabled")) return;
        if (!getBgmPlaybackInfo()) return; // 停止中はシーク不可

        dragging = true;
        dragRatio = ratioFromEvent(e);
        bar.classList.add("dragging");

        try { bar.setPointerCapture(e.pointerId); } catch (err) { /* 無視 */ }
        e.preventDefault();

        updateProgressUI();
    });

    bar.addEventListener("pointermove", (e) => {
        if (!dragging) return;
        dragRatio = ratioFromEvent(e);
        updateProgressUI();
    });

    const commitSeek = (e) => {
        if (!dragging) return;
        const ratio = ratioFromEvent(e);
        dragging = false;
        bar.classList.remove("dragging");

        const info = getBgmPlaybackInfo();
        if (info && Number.isFinite(info.duration)) {
            seekBGM(ratio * info.duration);
        }
        updateProgressUI();
    };

    bar.addEventListener("pointerup", commitSeek);
    bar.addEventListener("pointercancel", () => {
        // ドラッグ破棄（位置は現状のまま）
        dragging = false;
        bar.classList.remove("dragging");
        updateProgressUI();
    });
}

// =====================================================
// 初期化（main.js から呼ばれる）
// =====================================================
/**
 * モーダル内の閉じるボタン／STOP ボタン／進捗バーのシークを結線します。
 * モーダルの開閉はトップメニューの MUSIC ボタンから行います。
 */
export function initMusicPlayer() {
    const closeBtn = document.getElementById("musicModalCloseBtn");
    closeBtn?.addEventListener("click", () => {
        try { playSE("select"); } catch (e) { /* 無視 */ }
        closeMusicModal();
    });

    const stopBtn = document.getElementById(STOP_BTN_ID);
    stopBtn?.addEventListener("click", () => {
        stopCurrentTrack();
    });

    const pauseBtn = document.getElementById(PAUSE_BTN_ID);
    pauseBtn?.addEventListener("click", () => {
        if (!currentTrack) return;
        if (isBgmPaused()) {
            resumeBGM();
        } else {
            pauseBGM();
        }
        updatePlayingHighlight();
        updateProgressUI();
        try { playSE("select"); } catch (e) { /* 無視 */ }
    });

    initProgressSeek();
    updatePlayingHighlight();
    updateProgressUI();
}