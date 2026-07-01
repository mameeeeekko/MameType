import { defineShapePath } from './shapeDefinitions.js';

// enemyRenderer.jsから形状リストを抽出する
// defineShapePath関数のswitch文からcaseを抜き出す
const shapeList = [
    "circle", "pinwheel", "hexagon", "square", "arrow", "chip", "gate",
    "pulsar", "relay", "glitch_tri", "core_unit", "shard", "array",
    "terminal", "omega", "diamond", "rhombus", "shield", "star", "cross", "virus",
    "triangle", "mobius", "gear", "clover", "octagon", "nova", "knot5",
];

const container = document.getElementById('shape-container');
const CARD_SIZE = 150;
const CANVAS_SIZE = 100;

// 形状ごとにカードを作成して描画
shapeList.forEach(shapeName => {
    // カード要素を作成
    const card = document.createElement('div');
    card.className = 'shape-card';

    // Canvasを作成
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    const ctx = canvas.getContext('2d');

    // ラベルを作成
    const nameLabel = document.createElement('div');
    nameLabel.className = 'shape-name';
    nameLabel.textContent = shapeName;

    card.appendChild(canvas);
    card.appendChild(nameLabel);
    container.appendChild(card);

    // 描画処理
    drawShapeOnCanvas(ctx, shapeName);
});

/**
 * 指定されたCanvasに敵の形状を描画する
 * @param {CanvasRenderingContext2D} ctx - 描画コンテキスト
 * @param {string} shapeName - 描画する形状の名前
 */
function drawShapeOnCanvas(ctx, shapeName) {
    const size = CANVAS_SIZE;
    const shapeSize = size * 0.35; // 描画サイズを調整
    const centerX = size / 2;
    const centerY = size / 2;

    // グラデーションの作成
    const grad = ctx.createRadialGradient(
        centerX - shapeSize * 0.3,
        centerY - shapeSize * 0.3,
        shapeSize * 0.1,
        centerX,
        centerY,
        shapeSize
    );
    grad.addColorStop(0, '#aaddff');
    grad.addColorStop(0.5, '#66aaff');
    grad.addColorStop(1, '#3377cc');

    ctx.fillStyle = grad;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1.5;

    // パスを定義して描画
    ctx.beginPath();
    defineShapePath(ctx, centerX, centerY, shapeName, shapeSize);
    ctx.fill();
    ctx.stroke();
}
