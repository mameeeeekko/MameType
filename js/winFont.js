// winFont.js
// =====================================================
// Windows の Canvas 文字を OS 標準のヒンティング済みUD系で描くための
// フォント解決ヘルパー（DOM の body.win と対になる Canvas 側対応）。
// - Windows: 'BIZ UDPGothic' → 'Meiryo' を最優先（DPR 1.0 でも潰れない）
// - Mac/その他: 従来どおり丸ゴ webfont を維持（見た目不変）
// - ラテン/等幅は Inter / Noto Sans Mono を維持し、和文部分だけ差し替える
// =====================================================

let _isWinCache = null;

/** Windows 判定（js/main.js の body.win / stageScale.js と同じ基準） */
export function isWindowsFontTarget() {
  if (_isWinCache !== null) return _isWinCache;
  try {
    _isWinCache =
      /Windows/i.test(navigator.userAgent || "") ||
      /^Win/i.test(navigator.platform || "");
  } catch (e) {
    _isWinCache = false;
  }
  return _isWinCache;
}

// 和文フォールバックの UD 優先スタック（DOM の body.win と同一順序）
const WIN_JA_STACK = "'BIZ UDPGothic', 'Meiryo', 'M PLUS Rounded 1c', sans-serif";
const WIN_JA_MONO_STACK =
  "'Noto Sans Mono', 'BIZ UDPGothic', 'Meiryo', monospace";

/**
 * Canvas の ctx.font 文字列を Windows 用に解決する。
 * - 'M PLUS Rounded 1c' を含む指定 → UD 優先スタックに置換
 * - 'Noto Sans Mono' + 'M PLUS Rounded 1c' の混成 → 等幅 + UD 混成に置換
 * - 'Inter' + 'M PLUS Rounded 1c' の混成 → Inter(ラテン維持) + UD に置換
 * - 非 Windows / 該当なし → そのまま返す（Mac の見た目不変）
 */
export function resolveCanvasFont(font) {
  if (!font || !isWindowsFontTarget()) return font;
  if (font.includes("M PLUS Rounded 1c")) {
    if (font.includes("Noto Sans Mono")) {
      return font.replace(
        /'Noto Sans Mono',\s*'M PLUS Rounded 1c',\s*sans-serif/,
        WIN_JA_MONO_STACK
      );
    }
    if (font.includes("'Inter'")) {
      return font.replace(
        /'Inter',\s*'M PLUS Rounded 1c',\s*sans-serif/,
        `'Inter', ${WIN_JA_STACK}`
      );
    }
    return font.replace(/'M PLUS Rounded 1c',\s*sans-serif/, WIN_JA_STACK);
  }
  return font;
}

/**
 * テスト用: Windows 判定キャッシュをリセットする */
export function _resetWinFontCache() {
  _isWinCache = null;
}

let _patchInstalled = false;

/**
 * Canvas 全体に Windows UD 解決を適用する中央パッチ。
 * ctx.font への代入を横取りし、丸ゴ指定だけ UD 優先に書き換える。
 * - 51箇所の個別編集が不要（enemy/hud/effect/records/skillTree を一括対応）
 * - 非 Windows / 非該当フォントは素通し（Mac の見た目・計測幅は不変）
 * - resolve は冪等（解決済み文字列は M PLUS を含まないため二重変換なし）
 */
export function installWinCanvasFontPatch() {
  if (_patchInstalled) return;
  _patchInstalled = true;
  try {
    if (!isWindowsFontTarget()) return;
    const proto = window.CanvasRenderingContext2D?.prototype;
    if (!proto) return;
    const desc = Object.getOwnPropertyDescriptor(proto, "font");
    if (!desc || typeof desc.set !== "function" || desc.set.__winFontPatched) return;
    const origSet = desc.set;
    const patchedSet = function (v) {
      try {
        origSet.call(this, resolveCanvasFont(v));
      } catch (e) {
        origSet.call(this, v);
      }
    };
    patchedSet.__winFontPatched = true;
    Object.defineProperty(proto, "font", {
      configurable: true,
      enumerable: desc.enumerable,
      get: desc.get,
      set: patchedSet,
    });
  } catch (e) { /* パッチ失敗時は素のフォントで継続 */ }
}
