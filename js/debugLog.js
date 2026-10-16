// debugLog.js
// =====================================================
// デバッグログの一括ON/OFF制御
// -----------------------------------------------------
// ・既定は OFF（起動時はログを出さない）
// ・localStorage("debugLogEnabled") に状態を永続化
// ・ONにすると従来の console.log 相当の出力が復活する
// ・操作方法（3通り ※ 2はDEV解放中のみ）:
//     1) DEVパネル（Shift+O、DEV解放中のみ）の LOG ボタン
//     2) DevToolsコンソール: debugLog.enable() / disable() / toggle()
//        （DEVロック中は window.debugLog 自体が非公開）
//     3) コードから setDebugLogEnabled(true/false)
// ※ console.warn / console.error はエラー診断用のため対象外
//   （service-worker.js は独立スコープのためファイル内定数で制御）
// =====================================================

import { onDevAccessChange } from "./devGate.js";

const STORAGE_KEY = "debugLogEnabled";

// 保存された状態を復元（未設定・読み取り失敗は OFF）
function readStoredEnabled() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch (e) {
    return false;
  }
}

let enabled = readStoredEnabled();

// 状態変更を通知したい登録先（DEVパネルのボタン表示更新など）
const listeners = new Set();

export function isDebugLogEnabled() {
  return enabled;
}

export function setDebugLogEnabled(on) {
  const next = !!on;
  if (next === enabled) return enabled;

  enabled = next;

  try {
    localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  } catch (e) {
    /* 保存できない環境ではメモリ上の値のみ維持 */
  }

  for (const fn of listeners) {
    try {
      fn(next);
    } catch (e) {
      /* リスナーの例外は無視 */
    }
  }

  return enabled;
}

export function toggleDebugLog() {
  return setDebugLogEnabled(!enabled);
}

/** 状態変更リスナーを登録する。戻り値は解除関数 */
export function onDebugLogChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** デバッグログ出力。OFF時は何もしない */
export function dbg(...args) {
  if (enabled) console.log(...args);
}

// DevToolsコンソールから `debugLog.*` で切替できるようグローバル公開
// ※ リリース時はDEVロック中。ロック解除時だけ公開する（js/devGate.js）
if (typeof window !== "undefined") {
  const api = {
    enable: () => setDebugLogEnabled(true),
    disable: () => setDebugLogEnabled(false),
    toggle: () => toggleDebugLog(),
    isEnabled: () => isDebugLogEnabled(),
    onChange: (fn) => onDebugLogChange(fn),
  };

  onDevAccessChange((unlocked) => {
    if (unlocked) {
      window.debugLog = api;
    } else {
      try {
        delete window.debugLog;
      } catch (e) {
        window.debugLog = undefined;
      }
    }
  });
}
