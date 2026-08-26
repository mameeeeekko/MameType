// canvasUtil.js

// ==========================================
// CanvasのDPR（devicePixelRatio）対応のため
// ズレ・ぼやけ・UIと敵位置ズレをまとめて安定させる。
// さらに「描画品質」設定（Auto / High / Medium / Low）に対応し、
// Retina・Windows拡大(125%/150%)・4K・低スペックPCなど
// いろいろな画面環境で最適な画質になるようにする。
// =============================================

const QUALITY_STORAGE_KEY = "typing_game_quality";

// 各品質レベルにおけるDPR（devicePixelRatio）の上限
//   auto   : 端末のdprをそのまま使う（最大3まで）＝最もきれい
//   high   : 最大2倍まで（4K/Retina向け）
//   medium : 最大1.5倍まで（標準）
//   low    : 等倍（1倍）＝最も軽い
const QUALITY_DPR_CAPS = {
    auto: 3,
    high: 2,
    medium: 1.5,
    low: 1
};

/** 現在の描画品質設定を取得する */
export function getRenderQuality() {
    try {
        const q = localStorage.getItem(QUALITY_STORAGE_KEY);
        return QUALITY_DPR_CAPS[q] !== undefined ? q : "auto";
    } catch (e) {
        return "auto";
    }
}

/** 描画品質設定を保存する */
export function setRenderQuality(level) {
    const q = QUALITY_DPR_CAPS[level] !== undefined ? level : "auto";
    try {
        localStorage.setItem(QUALITY_STORAGE_KEY, q);
    } catch (e) { /* localStorage不可の環境は無視 */ }
    return getRenderQuality();
}

/** 品質設定を反映した実効DPRを返す（最低1は保証） */
export function getEffectiveDPR() {
    const raw = window.devicePixelRatio || 1;
    const cap = QUALITY_DPR_CAPS[getRenderQuality()];
    return Math.max(1, Math.min(raw, cap));
}

/**
 * CSSサイズ固定のキャンバス（HUDリングやグラフなど）をHi-DPI描画にする。
 * 論理サイズ（CSS px）を渡すと、バッキングストアを実効DPR倍にして
 * ctx を論理座標系で描けるようにスケールする。
 */
export function applyCanvasDPR(canvas, cssW, cssH) {
    const dpr = getEffectiveDPR();

    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));

    const ctx = canvas.getContext("2d");
    if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);

        if ("imageSmoothingEnabled" in ctx) {
            ctx.imageSmoothingEnabled = true;
            try { ctx.imageSmoothingQuality = "high"; } catch (e) { /* 未対応環境 */ }
        }
    }

    return { width: cssW, height: cssH, dpr };
}

export function setupCanvasDPR(canvas, container, ctx) {
    const dpr = getEffectiveDPR();
    const rect = container.getBoundingClientRect();

    canvas.style.width = rect.width + "px";
    canvas.style.height = rect.height + "px";

    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);

    // ★重要：一度リセット
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // ★CSSピクセル基準に統一
    ctx.scale(dpr, dpr);

    return {
        width: rect.width,
        height: rect.height,
        dpr
    };
}

/**
 * コンテナ（＝画面）いっぱいにキャンバスを広げる（レターボックスなし）。
 * 16:9 以外のアスペクト比やフルスクリーンでも余白が発生せず、
 * 描画コードは clientWidth / clientHeight を基準にするため自動的に追従する。
 */
export function fitCanvasToContainerFill(canvas, container, ctx) {
    const dpr = getEffectiveDPR();
    const rect = container.getBoundingClientRect();
    const cssW = Math.max(1, Math.floor((rect && rect.width) || window.innerWidth || 800));
    const cssH = Math.max(1, Math.floor((rect && rect.height) || window.innerHeight || 600));

    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";

    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);

    // ★重要：一度リセット
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    // 拡大縮小時に線が汚れないように
    if (typeof ctx.imageSmoothingEnabled !== "undefined") {
        ctx.imageSmoothingEnabled = true;
        try { ctx.imageSmoothingQuality = "high"; } catch (e) { /* 一部環境では未対応 */ }
    }

    return {
        width: cssW,
        height: cssH,
        dpr
    };
}

/**
 * 論理キャンバス（例: 1400×900）を、コンテナ/画面に「収まる範囲で均一スケール」して
 * 中央に表示する。縦横比を保つため、画面がどんなサイズでも下・右が切れず、
 * Mac / Windows で同じ見た目になる（レターボックス方式）。
 *
 * 描画コードは canvas.clientWidth / clientHeight（CSS px）を座標基準に使う想定のため、
 * ここで style 幅を論理幅×scale に設定することで、既存の描画ロジックはそのまま動作する。
 */
export function fitCanvasToContainer(canvas, container, ctx, logicalW, logicalH) {
    const dpr = getEffectiveDPR();
    const rect = container.getBoundingClientRect();
    const availW = (rect && rect.width) || window.innerWidth || 1400;
    const availH = (rect && rect.height) || window.innerHeight || 900;

    const scale = Math.min(availW / logicalW, availH / logicalH) || 1;
    const cssW = Math.max(1, Math.floor(logicalW * scale));
    const cssH = Math.max(1, Math.floor(logicalH * scale));

    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";

    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);

    // ★重要：一度リセット
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    // 拡大縮小時に線が汚れないように
    if (typeof ctx.imageSmoothingEnabled !== "undefined") {
        ctx.imageSmoothingEnabled = true;
        try { ctx.imageSmoothingQuality = "high"; } catch (e) { /* 一部環境では未対応 */ }
    }

    return {
        width: cssW,
        height: cssH,
        dpr,
        scale
    };
}
