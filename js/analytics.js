// analytics.js
// =====================================================
// Google Analytics 4 の軽量ラッパー
// G-LTCTSF3D03
// 方針:
//  * 初回描画をブロックしないため gtag.js は遅延読み込み
//    (window.load + requestIdleCallback / fallback setTimeout)
//  * localhost / file:// / DNT有効時は送信しない(開発データ汚染防止)
//  * AdBlock等で読込失敗してもゲームは壊さない(例外は握りつぶす)
//  * 打鍵ごとは送らない。game_start / game_complete の節目のみ
// =====================================================

export const GA_ID = "G-LTCTSF3D03";

// GameModes.id -> GA用 mode 値
const MODE_ID_MAP = {
  normal: "standard",
  time_attack: "time_attack",
  long_text: "long_text",
  enemy_mode: "enemy",
  defense_mode: "defense",
  miss_practice: "miss_practice",
};

export function mapModeIdToAnalytics(id) {
  return MODE_ID_MAP[id] || id || "unknown";
}

let analyticsInitialized = false;
let analyticsAllowedCache = null;

/**
 * 送信してよい環境かどうか
 * - localhost / 127.0.0.1 / file: は除外
 * - Do Not Track 有効時は除外
 */
export function isAnalyticsAllowed() {
  if (analyticsAllowedCache !== null) return analyticsAllowedCache;
  try {
    const { protocol, hostname } = window.location;
    if (protocol === "file:") {
      analyticsAllowedCache = false;
      return false;
    }
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]" ||
      hostname === ""
    ) {
      analyticsAllowedCache = false;
      return false;
    }
    const dnt =
      window.doNotTrack === "1" ||
      navigator.doNotTrack === "1" ||
      navigator.msDoNotTrack === "1";
    if (dnt) {
      analyticsAllowedCache = false;
      return false;
    }
  } catch (e) {
    analyticsAllowedCache = false;
    return false;
  }
  analyticsAllowedCache = true;
  return true;
}

function ensureDataLayerStub() {
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== "function") {
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };
  }
}

/**
 * gtag.js を遅延読み込みする。何度呼んでも1回だけ実行。
 * - loadイベント後にidleコールバックでinject
 * - page_viewは自動送信を止めて手動で1回だけ送る(重複防止)
 */
export function initAnalyticsLazy() {
  if (analyticsInitialized) return;
  analyticsInitialized = true;

  if (!isAnalyticsAllowed()) return;

  ensureDataLayerStub();
  try {
    window.gtag("js", new Date());
    // 自動page_viewを止めて手動送信用に待機させる
    window.gtag("config", GA_ID, {
      send_page_view: false,
      transport_type: "beacon",
    });
  } catch (e) {
    /* 計測失敗は無視 */
  }

  const inject = () => {
    try {
      if (document.querySelector('script[data-ga="gtag"]')) return;
      const s = document.createElement("script");
      s.async = true;
      s.dataset.ga = "gtag";
      s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
      s.onerror = () => {
        /* AdBlock等でブロックされてもゲーム継続 */
      };
      document.head.appendChild(s);
      // 手動page_view(アプリバージョン付き)
      sendPageView();
    } catch (e) {
      /* noop */
    }
  };

  const schedule = () => {
    try {
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(inject, { timeout: 3000 });
      } else {
        setTimeout(inject, 2000);
      }
    } catch (e) {
      setTimeout(inject, 2000);
    }
  };

  if (document.readyState === "complete") {
    schedule();
  } else {
    window.addEventListener("load", schedule, { once: true });
    // loadが来ない環境向けの保険
    setTimeout(() => {
      if (!document.querySelector('script[data-ga="gtag"]')) inject();
    }, 8000);
  }
}

function sendPageView() {
  try {
    window.gtag("event", "page_view", {
      page_location: window.location.href,
      page_path: window.location.pathname,
      page_title: document.title,
    });
  } catch (e) {
    /* noop */
  }
}

/**
 * 安全なイベント送信ラッパー
 * gtag未ロード・ブロック時は黙ってスキップ
 */
export function trackGameEvent(name, params = {}) {
  try {
    if (!isAnalyticsAllowed()) return;
    if (typeof window.gtag !== "function") return;
    window.gtag("event", name, {
      ...params,
      transport_type: "beacon",
    });
  } catch (e) {
    /* 計測失敗はゲームに波及させない */
  }
}

/**
 * game_start 送信ヘルパー
 * - miss_practice は送信しない(ノイズ除外)
 * - mode: standard / time_attack / long_text / enemy / defense / boss / quest_stage等
 * - play_style: daily / free / quest
 * - difficulty: easy / normal / hard / master (取れる場合のみ)
 */
export function trackGameStart({ mode, play_style, difficulty } = {}) {
  if (mode === "miss_practice") return; // ★ミス練は除外
  const params = {};
  if (mode) params.mode = String(mode);
  if (play_style) params.play_style = String(play_style);
  if (difficulty) params.difficulty = String(difficulty);
  trackGameEvent("game_start", params);
}

/**
 * game_complete 送信ヘルパー(将来用・リザルト時に呼ぶ)
 * score等は数値のみ。名前・ID等の個人情報は送らない。
 */
export function trackGameComplete(
  { mode, play_style, difficulty, score, solved, clear } = {},
) {
  if (mode === "miss_practice") return;
  const params = {};
  if (mode) params.mode = String(mode);
  if (play_style) params.play_style = String(play_style);
  if (difficulty) params.difficulty = String(difficulty);
  if (typeof score === "number" && Number.isFinite(score))
    params.score = Math.round(score);
  if (typeof solved === "number" && Number.isFinite(solved))
    params.solved = Math.round(solved);
  if (typeof clear === "boolean") params.clear = clear;
  trackGameEvent("game_complete", params);
}
