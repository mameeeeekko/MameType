// ===============================
// 形状のパスを定義するヘルパー（クリッピングや多重描画用）
// ===============================
export function defineShapePath(ctx, x, y, shapeType, size) {
    switch (shapeType) {
        case "circle":
            ctx.arc(x, y, size, 0, Math.PI * 2);
            break;
        case "pinwheel": {
            for (let i = 0; i < 4; i++) {
                const base = i * Math.PI / 2 + 0.25;
                const mid  = base + Math.PI / 3;
                const next = base + Math.PI / 2;
                ctx.moveTo(x, y);
                ctx.quadraticCurveTo(
                    x + Math.cos(base) * size * 1.2,
                    y + Math.sin(base) * size * 1.2,
                    x + Math.cos(mid) * size,
                    y + Math.sin(mid) * size
                );
                ctx.quadraticCurveTo(
                    x + Math.cos(next) * size * 0.2,
                    y + Math.sin(next) * size * 0.2,
                    x, y
                );
                ctx.closePath();
            }
            break;
        }
        case "hexagon": {
            const sw = size * 0.7;
            const sh = size * 1.3;
            ctx.moveTo(x, y - sh);
            ctx.lineTo(x + sw, y - sh * 0.4);
            ctx.lineTo(x + sw, y + sh * 0.4);
            ctx.lineTo(x, y + sh);
            ctx.lineTo(x - sw, y + sh * 0.4);
            ctx.lineTo(x - sw, y - sh * 0.4);
            ctx.closePath();
            break;
        }
        case "square":
            ctx.rect(x - size, y - size, size * 2, size * 2);
            break;
        case "arrow":
            ctx.moveTo(x + size, y);
            ctx.lineTo(x - size, y - size * 0.35);
            ctx.lineTo(x - size, y + size * 0.35);
            ctx.closePath();
            break;
        case "chip": { // ICチップ：サイドにピンがある四角
            const s = size * 0.8;
            const p = size * 0.2;
            ctx.moveTo(x - s, y - s);
            ctx.lineTo(x - p, y - s); ctx.lineTo(x - p, y - size); ctx.lineTo(x + p, y - size); ctx.lineTo(x + p, y - s);
            ctx.lineTo(x + s, y - s);
            ctx.lineTo(x + s, y - p); ctx.lineTo(x + size, y - p); ctx.lineTo(x + size, y + p); ctx.lineTo(x + s, y + p);
            ctx.lineTo(x + s, y + s);
            ctx.lineTo(x + p, y + s); ctx.lineTo(x + p, y + size); ctx.lineTo(x - p, y + size); ctx.lineTo(x - p, y + s);
            ctx.lineTo(x - s, y + s);
            ctx.lineTo(x - s, y + p); ctx.lineTo(x - size, y + p); ctx.lineTo(x - size, y - p); ctx.lineTo(x - s, y - p);
            ctx.closePath();
            break;
        }
        case "gate": { // 論理ゲート：D型の形状
            const r = size;
            ctx.moveTo(x - r, y - r);
            ctx.lineTo(x - r * 0.2, y - r);
            ctx.arc(x - r * 0.2, y, r, -Math.PI / 2, Math.PI / 2);
            ctx.lineTo(x - r, y + r);
            ctx.closePath();
            break;
        }
        case "pulsar": { // 鋭い多角星
            for (let i = 0; i < 16; i++) {
                const r = i % 2 === 0 ? size : size * 0.3;
                const angle = (Math.PI * 2 / 16) * i;
                ctx.lineTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
            }
            ctx.closePath();
            break;
        }
        case "relay": { // 十字型の通信リレー
            const outerSize = size * 0.8; // 棒の長さを短く調整
            const s = size * 0.35;
            for (let i = 0; i < 4; i++) {
                const a = (Math.PI / 2) * i;
                ctx.lineTo(x + Math.cos(a - 0.2) * outerSize, y + Math.sin(a - 0.2) * outerSize);
                ctx.lineTo(x + Math.cos(a + 0.2) * outerSize, y + Math.sin(a + 0.2) * outerSize);
                ctx.lineTo(x + Math.cos(a + 0.4) * s, y + Math.sin(a + 0.4) * s);
            }
            ctx.closePath();
            break;
        }
        case "glitch_tri": { // 段差のある三角形
            ctx.moveTo(x, y - size);
            ctx.lineTo(x + size, y + size);
            ctx.lineTo(x + size * 0.2, y + size);
            ctx.lineTo(x + size * 0.2, y + size * 0.75);
            ctx.lineTo(x - size * 0.2, y + size * 0.75);
            ctx.lineTo(x - size * 0.2, y + size);
            ctx.lineTo(x - size, y + size);
            ctx.closePath();
            break;
        }
        case "core_unit": { // 中央ユニット
            for (let i = 0; i < 8; i++) {
                const r = i % 2 === 0 ? size : size * 0.85;
                const angle = (Math.PI * 2 / 8) * i;
                ctx.lineTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
            }
            ctx.closePath();
            // 内部に十字の切り込み
            ctx.moveTo(x - size * 0.5, y); ctx.lineTo(x + size * 0.5, y);
            ctx.moveTo(x, y - size * 0.5); ctx.lineTo(x, y + size * 0.5);
            break;
        }
        case "shard": { // 鋭利なクリスタル状
            ctx.moveTo(x, y - size);
            ctx.lineTo(x + size * 0.4, y - size * 0.2);
            ctx.lineTo(x + size * 0.4, y + size * 0.2);
            ctx.lineTo(x, y + size);
            ctx.lineTo(x - size * 0.4, y + size * 0.2);
            ctx.lineTo(x - size * 0.4, y - size * 0.2);
            ctx.closePath();
            break;
        }
        case "array": { // 3方向アンテナ配列
            for (let i = 0; i < 3; i++) {
                const a = (Math.PI * 2 / 3) * i - Math.PI / 2;
                ctx.moveTo(x + Math.cos(a) * size * 0.2, y + Math.sin(a) * size * 0.2);
                ctx.arc(x + Math.cos(a) * size * 0.6, y + Math.sin(a) * size * 0.6, size * 0.4, 0, Math.PI * 2);
            }
            break;
        }
        case "terminal": { // ブラケット付きの端末
            const s = size;
            const t = size * 0.4;
            ctx.moveTo(x - s, y - s + t); ctx.lineTo(x - s, y - s); ctx.lineTo(x - s + t, y - s);
            ctx.moveTo(x + s - t, y - s); ctx.lineTo(x + s, y - s); ctx.lineTo(x + s, y - s + t);
            ctx.moveTo(x + s, y + s - t); ctx.lineTo(x + s, y + s); ctx.lineTo(x + s - t, y + s);
            ctx.moveTo(x - s + t, y + s); ctx.lineTo(x - s, y + s); ctx.lineTo(x - s, y + s - t);
            break;
        }
        case "omega": { // 最終形態：24芒星
            for (let i = 0; i < 48; i++) {
                const r = i % 2 === 0 ? size : size * 0.5;
                const angle = (Math.PI * 2 / 48) * i;
                ctx.lineTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
            }
            ctx.closePath();
            break;
        }
        case "diamond":
        case "rhombus":
            ctx.moveTo(x, y - size); // Top
            ctx.lineTo(x + size, y); // Right
            ctx.lineTo(x, y + size); // Bottom
            ctx.lineTo(x - size, y); // Left
            ctx.closePath();
            break;
        case "shield":
            ctx.moveTo(x - size, y - size * 0.5);
            ctx.quadraticCurveTo(x, y - size * 1.2, x + size, y - size * 0.5);
            ctx.lineTo(x + size, y + size * 0.4);
            ctx.lineTo(x, y + size * 1.2);
            ctx.lineTo(x - size, y + size * 0.4);
            ctx.closePath();
            break;
        case "star": {
            for (let i = 0; i < 10; i++) {
                const r = i % 2 === 0 ? size : size * 0.5;
                const angle = (Math.PI * 2 / 10) * i - Math.PI / 2;
                ctx.lineTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
            }
            ctx.closePath();
            break;
        }
        case "cross": {
            const s = size * 0.4;
            ctx.moveTo(x - s, y - size); ctx.lineTo(x + s, y - size); ctx.lineTo(x + s, y - s);
            ctx.lineTo(x + size, y - s); ctx.lineTo(x + size, y + s); ctx.lineTo(x + s, y + s);
            ctx.lineTo(x + s, y + size); ctx.lineTo(x - s, y + size); ctx.lineTo(x - s, y + s);
            ctx.lineTo(x - size, y + s); ctx.lineTo(x - size, y - s); ctx.lineTo(x - s, y - s);
            ctx.closePath();
            break;
        }
        case "triangle":
            ctx.moveTo(x, y - size);
            ctx.lineTo(x + size, y + size * 0.8);
            ctx.lineTo(x - size, y + size * 0.8);
            ctx.closePath();
            break;
        case "gear": {
            for (let i = 0; i < 16; i++) {
                const r = i % 2 === 0 ? size : size * 0.8;
                const angle = (Math.PI * 2 / 16) * i;
                ctx.lineTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
            }
            ctx.closePath();
            break;
        }
        case "clover": {
            for (let i = 0; i < 4; i++) {
                const angle = (Math.PI / 2) * i;
                ctx.arc(x + Math.cos(angle) * size * 0.5, y + Math.sin(angle) * size * 0.5, size * 0.5, 0, Math.PI * 2);
            }
            break;
        }
        case "octagon": {
            for (let i = 0; i < 8; i++) {
                const angle = (Math.PI * 2 / 8) * i - Math.PI / 8;
                ctx.lineTo(x + Math.cos(angle) * size, y + Math.sin(angle) * size);
            }
            ctx.closePath();
            break;
        }
        case "nova": {
            for (let i = 0; i < 24; i++) {
                const r = i % 2 === 0 ? size : size * 0.6;
                const angle = (Math.PI * 2 / 24) * i;
                ctx.lineTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
            }
            ctx.closePath();
            break;
        }
        case "mobius": {
            const rx = size;        // 横半径
            const ry = size * 0.5;  // 縦半径
            const thickness = size * 0.4; // 帯の太さ

            // 外側のパス
            ctx.moveTo(x - rx, y);
            ctx.bezierCurveTo(x - rx, y - ry * 2.2, x + rx, y + ry * 2.2, x + rx, y);

            // 内側のパス（逆方向）
            ctx.bezierCurveTo(x + rx, y + ry * 2.2 - thickness, x - rx, y - ry * 2.2 + thickness, x - rx, y);

            ctx.closePath();
            break;
        }
        case "knot5": {
            const outer = [];
            const inner = [];

            // 花びら数
            const petals = 5;

            // 帯の太さ
            const band = size * 0.35;

            for (let t = 0; t <= Math.PI * 2 + 0.05; t += 0.05) {

                // 中心線
                const r =
                    size *
                    (1.0 + 0.35 * Math.cos(petals * t));

                // 接線方向
                const r2 =
                    size *
                    (1.0 + 0.35 * Math.cos(petals * (t + 0.01)));

                const x1 = x + Math.cos(t) * r;
                const y1 = y + Math.sin(t) * r;

                const x2 = x + Math.cos(t + 0.01) * r2;
                const y2 = y + Math.sin(t + 0.01) * r2;

                let dx = x2 - x1;
                let dy = y2 - y1;

                const len = Math.hypot(dx, dy) || 1;

                dx /= len;
                dy /= len;

                // 法線
                const nx = -dy;
                const ny = dx;

                outer.push({
                    x: x1 + nx * band,
                    y: y1 + ny * band
                });

                inner.push({
                    x: x1 - nx * band,
                    y: y1 - ny * band
                });
            }

            ctx.moveTo(outer[0].x, outer[0].y);

            for (const p of outer)
                ctx.lineTo(p.x, p.y);

            for (let i = inner.length - 1; i >= 0; i--)
                ctx.lineTo(inner[i].x, inner[i].y);

            ctx.closePath();
            break;
        }
        case "gear": {
            const teeth = 8;
            const outerRadius = size;
            const innerRadius = size * 0.75;
            const toothAngle = (Math.PI * 2) / (teeth * 2);

            for (let i = 0; i < teeth * 2; i++) {
                const r = i % 2 === 0 ? outerRadius : innerRadius;
                const angle = toothAngle * i - Math.PI / (teeth * 2);
                ctx.lineTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
            }
            ctx.closePath();
            break;
        }
        case "clover": {
            const r = size * 0.5;
            for (let i = 0; i < 4; i++) {
                const angle = (Math.PI / 2) * i + Math.PI / 4;
                ctx.arc(x + Math.cos(angle) * r, y + Math.sin(angle) * r, r, 0, Math.PI * 2);
            }
            break;
        }
        case "octagon": {
            for (let i = 0; i < 8; i++) {
                const angle = (Math.PI * 2 / 8) * i - Math.PI / 8;
                ctx.lineTo(x + Math.cos(angle) * size, y + Math.sin(angle) * size);
            }
            ctx.closePath();
            break;
        }
        case "nova": {
            const points = 12;
            for (let i = 0; i < points * 2; i++) {
                const r = i % 2 === 0 ? size : size * 0.3;
                const angle = (Math.PI * 2 / (points * 2)) * i;
                ctx.lineTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
            }
            ctx.closePath();
            break;
        }
        case "knot5": {
            const outer = [];
            const inner = [];
            const petals = 5;
            const band = size * 0.35;

            for (let t = 0; t <= Math.PI * 2 + 0.05; t += 0.05) {
                const r = size * (1.0 + 0.35 * Math.cos(petals * t));
                const r2 = size * (1.0 + 0.35 * Math.cos(petals * (t + 0.01)));

                const x1 = x + Math.cos(t) * r;
                const y1 = y + Math.sin(t) * r;
                const x2 = x + Math.cos(t + 0.01) * r2;
                const y2 = y + Math.sin(t + 0.01) * r2;

                let dx = x2 - x1;
                let dy = y2 - y1;
                const len = Math.hypot(dx, dy) || 1;
                dx /= len;
                dy /= len;

                const nx = -dy;
                const ny = dx;

                outer.push({ x: x1 + nx * band, y: y1 + ny * band });
                inner.push({ x: x1 - nx * band, y: y1 - ny * band });
            }

            ctx.moveTo(outer[0].x, outer[0].y);
            for (const p of outer) ctx.lineTo(p.x, p.y);
            for (let i = inner.length - 1; i >= 0; i--) ctx.lineTo(inner[i].x, inner[i].y);

            ctx.closePath();
            break;
        }
        case "virus": {
            const spikes = 12; // スパイクの数
            const coreRadius = size * 0.7; // 中心のコアの半径
            const spikeLength = size * 0.3; // スパイクの長さ
            const spikeBaseAngle = Math.PI / spikes * 0.6; // スパイクの根元の角度

            for (let i = 0; i < spikes; i++) {
                const angle = (Math.PI * 2 / spikes) * i;

                // スパイクの先端
                const tipX = x + Math.cos(angle) * (coreRadius + spikeLength);
                const tipY = y + Math.sin(angle) * (coreRadius + spikeLength);
                ctx.lineTo(tipX, tipY);

                // 次のスパイクの根元までの円弧
                ctx.arc(x, y, coreRadius, angle + spikeBaseAngle, angle + (Math.PI * 2 / spikes) - spikeBaseAngle);
            }
            ctx.closePath();
            break;
        }
        default:
            ctx.arc(x, y, size, 0, Math.PI * 2);
            break;
    }
}