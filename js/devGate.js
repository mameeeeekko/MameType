// devGate.js
// =====================================================
// DEVツール（DEVパネル / window.dev / window.debugLog）の
// リリース時ロック & 開発者（管理者）だけの解放機構
// -----------------------------------------------------
// ・既定はロック。localStorage("devUnlocked") が "1" のときだけ解放
// ・解放方法: DevToolsコンソールで unlockDev("パスフレーズ")
//   一致すると localStorage に保存され、以後の起動でも解放されたまま
// ・解除: lockDev()（localStorage を削除）
// ・パスフレーズは平文で残さず、FNV-1a 32bit ハッシュ定数と比較する
//   （※ クライアント側ロックは抑止機構。全コードはクライアントに
//      届くため、ソースを読む熟練者は原理的に突破可能）
// =====================================================

const STORAGE_KEY = "devUnlocked";

// 解放パスフレーズの FNV-1a 32bit ハッシュ
//   ※ 平文はコードに残さない。変更時は新しい文字列の
//     FNV-1a 32bit 値（符号なし32bit）に差し替える
const DEV_PASSPHRASE_HASH = 0xF0847FDC;

function fnv1a32(str) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

// 状態変更を通知したい登録先（devTools / debugLog が window 公開を制御）
const listeners = new Set();

export function isDevUnlocked() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch (e) {
    return false;
  }
}

/**
 * パスフレーズが一致したら解放して localStorage に永続化する。
 * @returns {boolean} 解放成功なら true
 */
export function unlockDev(passphrase) {
  if (fnv1a32(String(passphrase ?? "")) !== DEV_PASSPHRASE_HASH) {
    return false;
  }

  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch (e) {
    /* 保存できない環境では本セッションのみ有効（notifyは走らせる） */
  }

  notify();
  return true;
}

/** 解放を解除（localStorage 削除） */
export function lockDev() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    /* 無視 */
  }

  notify();
}

/**
 * 解放状態の変更を購読する。登録時に現在状態も即時通知される。
 * @param {(unlocked: boolean) => void} fn
 * @returns {() => void} 購読解除関数
 */
export function onDevAccessChange(fn) {
  listeners.add(fn);
  try {
    fn(isDevUnlocked());
  } catch (e) {
    /* リスナーの例外は無視 */
  }
  return () => listeners.delete(fn);
}

function notify() {
  const unlocked = isDevUnlocked();
  for (const fn of listeners) {
    try {
      fn(unlocked);
    } catch (e) {
      /* リスナーの例外は無視 */
    }
  }
}

// DevToolsコンソールから解放/解除できるようグローバル公開
if (typeof window !== "undefined") {
  window.unlockDev = (passphrase) => unlockDev(passphrase);
  window.lockDev = () => lockDev();
}
