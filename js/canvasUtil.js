// canvasUtil.js

// ==========================================
// CanvasのDPR（devicePixelRatio）対応のため
// ズレ・ぼやけ・UIと敵位置ズレをまとめて安定させる。
// =============================================

export function setupCanvasDPR(canvas, container, ctx) {
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();

    canvas.style.width = rect.width + "px";
    canvas.style.height = rect.height + "px";

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

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