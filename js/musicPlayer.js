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
    getBgmPlaybackInfo, seekBGM,
} from "./effectManager.js";

const MODAL_ID = "musicModal";
const LIST_ID = "musicList";
const TITLE_ID = "musicNowTitle";
const BAR_ID = "musicProgressBar";
const FILL_ID = "musicProgressFill";
const KNOB_ID = "musicProgressKnob";
const TIME_ID = "musicProgressTime";
const STOP_BTN_ID = "musicStopBtn";

// 再生中のBGM名（null = 停止中）
let currentTrack = null;
// 一覧を一度だけ構築するためのキャッシュ
let listBuilt = false;
// name → { title, composer } の対応表（NOW PLAYING 表示用）
const trackMap = {};

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
export function handleMusicModalKey(e) {
    if (!isMusicModalOpen()) return false;

    const key = (e.key || "").toLowerCase();
    if (key === "escape" || key === "b" || key === "m") {
        e.preventDefault();
        closeMusicModal();
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
        stopCurrentTrack();
        return;
    }

    // ★v1.0.42 以降は「鳴らす直前に読み込む」方式のため、先に取得してから再生する
    await ensureSound(name);
    playBGM(name, 1.0);

    // BGMトグルOFFなどで実際には鳴っていない場合も選択状態としては扱う
    //（進捗バーは getBgmPlaybackInfo() が null のとき「待機」表示になる）
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
        const isPlaying = !!currentTrack && row.dataset.bgm === currentTrack;
        row.classList.toggle("playing", isPlaying);
        const icon = row.querySelector(".music-row-icon");
        if (icon) icon.textContent = isPlaying ? "■" : "▶";
    });

    const stopBtn = document.getElementById(STOP_BTN_ID);
    if (stopBtn) stopBtn.disabled = !currentTrack;
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

    initProgressSeek();
    updatePlayingHighlight();
    updateProgressUI();
}