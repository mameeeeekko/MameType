// enemyRenderer.js

import { getDisplayFullRoma, getDisplayRomaForEnemy } from "./typingLogic.js";
import { getDifficulty } from "./difficulties.js";
import { buildClearText } from "./enemyModeConfig.js";
import { getNow } from "./gameCore.js";
import { getChainMultiplier } from "./enemyCore.js"
import { getEquippedActiveSkills, COMBO_TIERS, OVERDRIVE_COMBO, } from "./questPlayerStats.js";
import { ACTIVE_SKILLS } from "./questSkills.js";
import { getItemDescription } from "./enemy.js";


// サイドを丸める関数
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function adjustColor(hex, amount) {
    if (!hex.startsWith("#")) return hex;

    let col = hex.slice(1);

    if (col.length === 3) {
        col = col.split("").map(v => v + v).join("");
    }

    let num = parseInt(col, 16);

    let r = (num >> 16) + amount;
    let g = ((num >> 8) & 0x00ff) + amount;
    let b = (num & 0x0000ff) + amount;

    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));

    return `rgb(${r}, ${g}, ${b})`;
}

export function renderEnemies(ctx, enemies, lockedEnemy, candidateEnemies = []) {
    ctx.textAlign = "center";

    // 通常敵
    for (const enemy of enemies) {
        if (enemy === lockedEnemy) continue;
        drawEnemy(ctx, enemy, lockedEnemy, candidateEnemies);
    }

    // ロック敵は最後（最前面）
    if (lockedEnemy) {
        drawEnemy(ctx, lockedEnemy, lockedEnemy, candidateEnemies);
    }
}

function drawEnemy(ctx, enemy, lockedEnemy, candidateEnemies){
    
    ctx.save(); // ←これ絶対
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic"; // ←初期化

    const word = enemy.word || "";
    const displayFull = getDisplayRomaForEnemy(enemy, getDisplayFullRoma);

    const typedLen =
        (enemy.inputedRomaji || "").length +
        (enemy.typed || "").length;

    const typedPart = displayFull.slice(0, typedLen);
    const remainPart = displayFull.slice(typedLen);

    let enemyColor = enemy.type.color;
    //ロックした敵の色
    if (enemy === lockedEnemy || candidateEnemies.includes(enemy)) {
        enemyColor = "orange";
    }

    const radius = enemy.radius || 15;

    // =====================
    // 敵の見た目描画（shape + pattern）
    // =====================
    drawEnemyBody(ctx, enemy, enemyColor);

    ctx.font = "17px 'Inter', 'Noto Sans JP', sans-serif";
    ctx.fillStyle = "black";
    ctx.fillText(word, enemy.x, enemy.y - radius - 15);

    ctx.font = "bold 17px monospace";
    //入力文字の色
    let remainColor = "rgb(0, 32, 138)";
    //ロックした敵の入力文字の色
    if (enemy === lockedEnemy || candidateEnemies.includes(enemy)) {
        remainColor = "rgb(255, 123, 0)";
    }

    const remainWidth = ctx.measureText(remainPart).width;

    const remainX = enemy.x;
    const remainY = enemy.y - radius + 5;

    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillRect(remainX - remainWidth / 2 - 4, remainY - 14, remainWidth + 8, 18);

    ctx.fillStyle = remainColor;
    ctx.fillText(remainPart, remainX, remainY);

    // =====================
    // ロックカーソル
    // =====================
    if (enemy === lockedEnemy) {

        const r = radius + 10;

        ctx.strokeStyle = "#ff3b3b";
        ctx.lineWidth = 2;

        ctx.beginPath();

        // 上
        ctx.moveTo(enemy.x, enemy.y - r);
        ctx.lineTo(enemy.x, enemy.y - r + 6);

        // 下
        ctx.moveTo(enemy.x, enemy.y + r);
        ctx.lineTo(enemy.x, enemy.y + r - 6);

        // 左
        ctx.moveTo(enemy.x - r, enemy.y);
        ctx.lineTo(enemy.x - r + 6, enemy.y);

        // 右
        ctx.moveTo(enemy.x + r, enemy.y);
        ctx.lineTo(enemy.x + r - 6, enemy.y);

        ctx.stroke();
    }

    // =====================
    // 残り回数表示（複数ヒット敵のみ）
    // =====================
    if (enemy.hitCount > 1) {

        const countText = "×" + enemy.hitCount;

        ctx.font = "bold 12px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";

        // 背景
        const textWidth = ctx.measureText(countText).width;
        const padding = 4;

        const boxX = enemy.x - textWidth / 2 - padding;
        const boxY = enemy.y + enemy.radius + 6;
        const boxW = textWidth + padding * 2;
        const boxH = 16;

        // 角丸BOX
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        roundRect(ctx, boxX, boxY, boxW, boxH, 6);
        ctx.fill();

        // 文字
        ctx.fillStyle = "#ffffff";
        ctx.fillText(countText, enemy.x, boxY + 2);
        // ロック中だけ強調
        if (enemy === lockedEnemy) {
        ctx.fillStyle = "#ffd700";
        }
    }

    // =====================
    // アイテム説明
    // =====================
    if (enemy.isItem) {

        drawItemLabel(ctx, enemy);
    }
    
    // ======================================
    // Item Lifetime Ring
    // ======================================
    if (enemy.isItem) {

        const ratio =
            Math.max(0, enemy.lifetime / enemy.maxLifetime);

        // ★点滅（ここで抜けるのはOK）
        if (ratio < 0.2) {

            const blink =
                Math.floor(performance.now() / 120) % 2;

            if (!blink) {
                ctx.restore();
                return;
            }
        }

        ctx.save();

        // 色
        if (ratio < 0.25) {
            ctx.strokeStyle = "#ef4444";
        } else {
            ctx.strokeStyle = "rgba(171, 171, 171, 0.9)";
        }

        ctx.lineWidth = 3;
        ctx.lineCap = "round";

        const end = Math.PI; // 左固定

        const start =
            Math.PI * (1 - ratio);

        ctx.beginPath();
        ctx.arc(
            enemy.x,
            enemy.y,
            enemy.type.size + 6,
            start,
            end,
            false 
        );

        ctx.stroke();

        ctx.restore();
    }

    ctx.restore();
}

// ===============================
// アイテムラベル
// ===============================
function drawItemLabel(ctx, enemy){

    const text =
        getItemDescription(enemy.type);

    if (!text) return;

    const y =
        enemy.y +
        enemy.type.size +
        10;

    ctx.save();

    ctx.font =
        "bold 10px monospace";

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const textW =
        ctx.measureText(text).width;

    const padX = 6;
    const w = textW + padX * 2;
    const h = 14;

    const x =
        enemy.x - w / 2;

    // =====================
    // 色
    // =====================
    let bg =
        "rgba(0,0,0,0.55)";

    let border =
        "rgba(255,255,255,0.2)";

    switch(enemy.type.effect){

        case "heal":
            bg =
            "rgba(34,197,94,0.22)";
            border =
            "rgba(74,222,128,0.7)";
            break;

        case "freeze":
            bg =
            "rgba(96,165,250,0.22)";
            border =
            "rgba(147,197,253,0.7)";
            break;

        case "kill":
            bg =
            "rgba(239,68,68,0.22)";
            border =
            "rgba(248,113,113,0.7)";
            break;

        case "cooldown":
            bg =
            "rgba(192,132,252,0.22)";
            border =
            "rgba(216,180,254,0.7)";
            break;
    }
    // =====================
    // 背景
    // =====================
    roundRect(
        ctx,
        x,
        y,
        w,
        h,
        6
    );

    ctx.fillStyle = bg;
    ctx.fill();

    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.stroke();

    // =====================
    // 文字
    // =====================
    ctx.fillStyle =
        "rgba(255,255,255,0.95)";

    ctx.fillText(
        text,
        enemy.x,
        y + h / 2 + 0.5
    );

    ctx.restore();
}

// ===============================
// 敵の本体描画（形＋模様）
// ===============================
function drawEnemyBody(ctx, enemy, color){

    const { x, y, type } = enemy;

    ctx.save();

    // =========================
    // アイテムの発光
    // =========================
    if (enemy.isItem) {

        ctx.shadowColor = color;
        ctx.shadowBlur = 14;
    }

    // =========================
    // 少し回転（動きが出る）
    // =========================
    ctx.translate(x, y);
    ctx.rotate(enemy.rotation);
    ctx.translate(-x, -y);

    // =========================
    // ① 形（ベース）
    // =========================
    drawShape(ctx, x, y, type, color);

    // =========================
    // ② 模様（上に重ねる）
    // =========================
    drawPattern(ctx, x, y, type);

    ctx.restore();
}

// ===============================
// 形を描く
// ===============================
function drawShape(ctx, x, y, type, color) {

    const light = adjustColor(color, 55);
    const mid   = adjustColor(color, 10);
    const dark  = adjustColor(color, -65);

    const size = type.size;

    const grad = ctx.createRadialGradient(
        x - size * 0.35,
        y - size * 0.4,
        size * 0.12,
        x,
        y,
        size
    );

    grad.addColorStop(0, light);
    grad.addColorStop(0.45, mid);
    grad.addColorStop(1, dark);

    switch(type.shape){

        case "circle":
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();

            // ハイライト
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);

            const shine = ctx.createRadialGradient(
                x - size * 0.45,
                y - size * 0.45,
                0,
                x - size * 0.45,
                y - size * 0.45,
                size * 0.75
            );

            shine.addColorStop(0, "rgba(255,255,255,0.32)");
            shine.addColorStop(0.4, "rgba(255,255,255,0.08)");
            shine.addColorStop(1, "rgba(255,255,255,0)");

            ctx.fillStyle = shine;
            ctx.fill();

            // 外周
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(255,255,255,0.15)";
            ctx.lineWidth = 1;
            ctx.stroke();
            break;

        case "square":
            ctx.fillStyle = grad;
            ctx.fillRect(
                x - size,
                y - size,
                size * 2,
                size * 2
            );

            ctx.strokeStyle = "rgba(255,255,255,0.14)";
            ctx.lineWidth = 1;
            ctx.strokeRect(
                x - size,
                y - size,
                size * 2,
                size * 2
            );
            break;

        case "pinwheel":
            drawPinwheelShape(ctx, x, y, type, color);
            break;

        default:
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();
    }
}

// ===============================
// かざぐるま形状（扇4枚）
// ===============================
function drawPinwheelShape(ctx, x, y, type, color){

    const r = type.size;

    ctx.save();

    ctx.shadowColor = color;
    ctx.shadowBlur = 14;

    for(let i = 0; i < 4; i++){

        const base = i * Math.PI / 2 + 0.25;
        const mid  = base + Math.PI / 3;
        const next = base + Math.PI / 2;

        ctx.beginPath();
        ctx.moveTo(x, y);

        // 外側（しっかり大きく）
        ctx.quadraticCurveTo(
            x + Math.cos(base) * r * 1.2,
            y + Math.sin(base) * r * 1.2,
            x + Math.cos(mid) * r,
            y + Math.sin(mid) * r
        );

        // 内側（かなり中心寄り＝太くなる）
        ctx.quadraticCurveTo(
            x + Math.cos(next) * r * 0.2,
            y + Math.sin(next) * r * 0.2,
            x, y
        );

        ctx.closePath();

        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, "rgba(255,255,255,0.15)");
        grad.addColorStop(0.5, color);
        grad.addColorStop(1, "rgba(0,0,0,0)");

        ctx.fillStyle = grad;
        ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(x, y, r * 0.22, 0, Math.PI * 2);

    const coreGrad = ctx.createRadialGradient(
        x - r * 0.08,
        y - r * 0.08,
        0,
        x,
        y,
        r * 0.22
    );

    coreGrad.addColorStop(0, "rgba(255,255,255,0.5)");
    coreGrad.addColorStop(0.5, adjustColor(color, 20));
    coreGrad.addColorStop(1, adjustColor(color, -40));

    ctx.fillStyle = coreGrad;
    ctx.fill();

    ctx.restore();
}

// ===============================
// 模様を描く
// ===============================
function drawPattern(ctx, x, y, type){

    switch(type.pattern){

        // 縞々
        case "stripe":
            drawStripe(ctx, x, y, type);
            break;

        // 同心円
        case "ring":
            drawRing(ctx, x, y, type);
            break;
    }
}

function drawStripe(ctx, x, y, type){

    const size = type.size;
    const diag = size * 3; // ← 十分大きくするのがコツ

    ctx.save();

    // クリッピング（円）
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.clip();

    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 3;

    for(let i = -diag; i < diag; i += 8){
        ctx.beginPath();
        ctx.moveTo(x - diag, y + i);
        ctx.lineTo(x + diag, y + i + diag);
        ctx.stroke();
    }

    ctx.restore();
}

function drawRing(ctx, x, y, type){

    if (!type) return;
    if (!Number.isFinite(type.size)) return;

    const maxRing = Math.floor(type.size / 5);

    for(let i = 0; i < maxRing; i++){

        const radius = type.size - i * 5;

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);

        ctx.strokeStyle = i % 2 === 0
            ? "rgba(255,255,255,0.45)"
            : "rgba(0,0,0,0.22)";

        ctx.lineWidth = 2;
        ctx.stroke();
    }
}


export function renderPlayer(ctx, player, enemyStats) {

    drawPlayerBody(ctx, player, enemyStats);

    const barWidth = 60;
    const barHeight = 6;
    const barX = player.x - barWidth / 2;
    const barY = player.y + player.radius + 24;

    // =====================
    // Lv（クエストのみ）
    // =====================
    if (enemyStats?.isQuestMode) {

        const level = player.level ?? 1;

        ctx.font = "bold 12px monospace";
        ctx.fillStyle = "#383838";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom"; // ←重要

        ctx.fillText(
            `Lv.${level}`,
            player.x,
            player.y - player.radius - 10 // ←ここが位置
        );
    }
    // =====================
    // HPテキスト
    // =====================
    const maxHP = player.maxHp ?? 40; //
    const hpRatio = player.hp / maxHP;

    ctx.font = "12px monospace";
    ctx.fillStyle = "#383838";
    ctx.textAlign = "center";

    ctx.fillText(
        player.hp + " / " + maxHP,
        player.x,
        barY - 3
    );

    // =====================
    // HPバー
    // =====================

    const radius = 4; // ←角丸の強さ（4〜8くらいがオシャレ）

    // 背景（グレー）
    ctx.fillStyle = "rgba(200,200,200,0.15)";
    roundRect(ctx, barX, barY, barWidth, barHeight, radius);
    ctx.fill();

    // HPカラー
    let hpColor = "#5cd65c";
    if (hpRatio < 0.5) hpColor = "#ffb84d";
    if (hpRatio < 0.25) hpColor = "#ff6666";

    // HP本体（角丸だけど右は切れるので工夫）
    ctx.save();
    roundRect(ctx, barX, barY, barWidth, barHeight, radius);
    ctx.clip(); // ←はみ出し防止

    ctx.fillStyle = hpColor;
    ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);

    // ハイライト
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight * 0.4);

    ctx.restore();
}


function drawPlayerBody(ctx, player, enemyStats) {
    const evo = enemyStats?.evo ?? 0;
    const r = player.radius;

    ctx.save();
    ctx.translate(player.x, player.y);

    // =====================
    // 本体（常に丸）
    // =====================
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);

    // =====================
    // 本体グラデーション
    // =====================
    const bodyGrad = ctx.createRadialGradient(
        -r * 0.35,   // 光源を左上
        -r * 0.4,
        r * 0.15,
        0,
        0,
        r
    );

    bodyGrad.addColorStop(0, "#b7bcc4");   // 明るい部分
    bodyGrad.addColorStop(0.45, "#7b8188");
    bodyGrad.addColorStop(1, "#4a4f55");   // 暗い外周

    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // =====================
    // 上側ハイライト
    // =====================
    const shine = ctx.createRadialGradient(
        -r * 0.45,
        -r * 0.45,
        0,
        -r * 0.45,
        -r * 0.45,
        r * 0.8
    );

    shine.addColorStop(0, "rgba(255,255,255,0.38)");
    shine.addColorStop(0.4, "rgba(255,255,255,0.10)");
    shine.addColorStop(1, "rgba(255,255,255,0)");

    ctx.fillStyle = shine;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    // =====================
    // 下側シャドウ
    // =====================
    const shadow = ctx.createRadialGradient(
        r * 0.25,
        r * 0.35,
        0,
        r * 0.25,
        r * 0.35,
        r
    );

    shadow.addColorStop(0, "rgba(0,0,0,0)");
    shadow.addColorStop(1, "rgba(0,0,0,0.28)");

    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    // =====================
    // 外周輪郭
    // =====================
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    

    // =====================
    // Lv10: 中心コア
    // =====================
    if (evo >= 1) {
        const coreR = r * 0.35;

        const coreGrad = ctx.createRadialGradient(
            -coreR * 0.35,
            -coreR * 0.35,
            0,
            0,
            0,
            coreR
        );

        coreGrad.addColorStop(0, "#d6dae2");
        coreGrad.addColorStop(0.45, "#9ea4ad");
        coreGrad.addColorStop(1, "#5d636b");

        ctx.beginPath();
        ctx.arc(0, 0, coreR, 0, Math.PI * 2);
        ctx.fillStyle = coreGrad;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(0, 0, coreR, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,255,255,0.15)";
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // =====================
    // Lv20: 外枠
    // =====================
    if (evo >= 2) {
        ctx.beginPath();
        ctx.arc(0, 0, r + 3, 0, Math.PI * 2);

        const ringGrad = ctx.createLinearGradient(
            -r - 3,
            -r - 3,
            r + 3,
            r + 3
        );

        ringGrad.addColorStop(0, "#d4d8e0");
        ringGrad.addColorStop(0.45, "#7b8191");
        ringGrad.addColorStop(1, "#4b5058");

        ctx.strokeStyle = ringGrad;
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    
    // =====================
    // Lv30: 内部装甲
    // =====================
    if (evo >= 3) {
        drawArmorShell(ctx, r);
    }

    // =====================
    // Lv40: 外部装甲
    // =====================
    if (evo >= 4) {
        const armorGrad = ctx.createLinearGradient(
            -r - 8,
            -r - 8,
            r + 8,
            r + 8
        );

        armorGrad.addColorStop(0, "#d9dde6");
        armorGrad.addColorStop(0.45, "#8a90a0");
        armorGrad.addColorStop(1, "#4d525a");

        ctx.strokeStyle = armorGrad;
        ctx.lineWidth = 3;
        ctx.lineCap = "round";

        const armorR = r + 6;
        const arcSize = 0.95; // アーマーの長さ

        const angles = [
            -Math.PI / 2, // 上
            0,            // 右
            Math.PI / 2,  // 下
            Math.PI       // 左
        ];

        angles.forEach(angle => {
            ctx.beginPath();
            ctx.arc(
                0,
                0,
                armorR,
                angle - arcSize / 2,
                angle + arcSize / 2
            );
            ctx.stroke();
        });
    }

     // =====================
    // Lv50+: 外周シェル
    // =====================
    if (evo >= 5) {

        ctx.beginPath();

        // 外側
        ctx.arc(0, 0, r + 8, 0, Math.PI * 2);

        // 内側をくり抜く
        ctx.arc(0, 0, r + 4.5, 0, Math.PI * 2, true);

        ctx.closePath();

        const shellGrad = ctx.createLinearGradient(
            -r - 8,
            -r - 8,
            r + 8,
            r + 8
        );

        shellGrad.addColorStop(0, "#d6d9e1");
        shellGrad.addColorStop(0.4, "#8e93a3");
        shellGrad.addColorStop(1, "#4e535b");

        ctx.fillStyle = shellGrad;
        ctx.fill();
    }

    // =====================
    // Lv60: 
    // =====================
    if (evo >= 6 && evo < 7) {
        drawNodes(ctx, r, false);
    }

    // =====================
    // Lv70:
    // =====================
    if (evo >= 7) {
        drawNodes(ctx, r, true);
    }


    // =====================
    // Lv80+: 重力歪曲フィールド
    // =====================
    if (evo >= 8) {

        ctx.save();

        const t = performance.now() * 0.0015;

        const fieldR = r + 26;

        // =====================
        // 歪曲層
        // =====================
        for (let layer = 0; layer < 5; layer++) {

            const rr =
                fieldR - layer * 4;

            ctx.beginPath();

            for (let i = 0; i <= 120; i++) {

                const a =
                    Math.PI * 2 * (i / 120);

                // 歪みをかなり強く
                const noise =
                    Math.sin(
                        a * 4 +
                        t * 2 +
                        layer
                    ) * 5
                    +
                    Math.cos(
                        a * 7 -
                        t * 1.5
                    ) * 3;

                const rad =
                    rr + noise;

                const x =
                    Math.cos(a) * rad;

                const y =
                    Math.sin(a) * rad;

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }

            ctx.closePath();

            // 濃くする
            ctx.fillStyle =
                `rgba(170,170,180,${
                    0.11 - layer * 0.015
                })`;

            ctx.fill();
        }

        // =====================
        // 圧縮リングっぽい影
        // =====================
        const pulse =
            1 +
            Math.sin(t * 2.5) * 0.04;

        ctx.scale(pulse, pulse);

        const grad =
            ctx.createRadialGradient(
                0, 0, r * 0.5,
                0, 0, fieldR + 6
            );

        grad.addColorStop(
            0,
            "rgba(255,255,255,0)"
        );

        grad.addColorStop(
            0.45,
            "rgba(220,220,230,0.06)"
        );

        grad.addColorStop(
            0.7,
            "rgba(140,140,150,0.14)"
        );

        grad.addColorStop(
            1,
            "rgba(255,255,255,0)"
        );

        ctx.fillStyle = grad;

        ctx.beginPath();
        ctx.arc(
            0,
            0,
            fieldR + 6,
            0,
            Math.PI * 2
        );

        ctx.fill();

        // =====================
        // 重力ノイズ粒子
        // =====================
        for (let i = 0; i < 34; i++) {

            const a =
                (Math.PI * 2 / 34) * i
                + t * 0.5;

            const rr =
                fieldR +
                Math.sin(i + t * 3) * 5;

            const x =
                Math.cos(a) * rr;

            const y =
                Math.sin(a) * rr;

            const size =
                1.5 +
                Math.sin(i * 2 + t * 4);

            ctx.beginPath();

            ctx.arc(
                x,
                y,
                size,
                0,
                Math.PI * 2
            );

            ctx.fillStyle =
                "rgba(240,240,255,0.25)";

            ctx.fill();
        }

        ctx.restore();
    }
    
    // =====================
    // Lv90+: 特異点渦
    // =====================
    if (evo >= 9) {

        ctx.save();

        const t = performance.now() * 0.0018;

        const fieldR = r + 34;

        // =====================
        // 渦流
        // =====================
        for (let arm = 0; arm < 3; arm++) {

            ctx.beginPath();

            for (let i = 0; i < 90; i++) {

                const p = i / 90;

                const rr =
                    fieldR * (1 - p);

                const a =
                    p * 5 +
                    t * 2 +
                    arm * Math.PI * 0.66;

                const x =
                    Math.cos(a) * rr;

                const y =
                    Math.sin(a) * rr;

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }

            // 少し青白い重力光
            ctx.strokeStyle =
                "rgba(180,210,255,0.13)";

            ctx.lineWidth = 3;

            ctx.stroke();
        }

        // =====================
        // 吸い込み粒子
        // =====================
        for (let i = 0; i < 36; i++) {

            const life =
                ((t * 0.22 + i * 0.07) % 1);

            const rr =
                fieldR * (1 - life);

            const a =
                i * 2.1 +
                t * 1.8 +
                life * 5;

            const x =
                Math.cos(a) * rr;

            const y =
                Math.sin(a) * rr;

            const size =
                (1 - life) * 2.5;

            ctx.beginPath();

            ctx.arc(
                x,
                y,
                size,
                0,
                Math.PI * 2
            );

            // 白〜水色
            ctx.fillStyle =
                `rgba(220,240,255,${
                    0.32 * (1 - life)
                })`;

            ctx.fill();
        }

        // =====================
        // 外周ゆらぎ
        // =====================
        const aura =
            ctx.createRadialGradient(
                0, 0, r * 0.7,
                0, 0, fieldR
            );

        aura.addColorStop(
            0,
            "rgba(0,0,0,0)"
        );

        aura.addColorStop(
            0.65,
            "rgba(120,170,255,0.05)"
        );

        aura.addColorStop(
            1,
            "rgba(180,220,255,0)"
        );

        ctx.fillStyle = aura;

        ctx.beginPath();

        ctx.arc(
            0,
            0,
            fieldR,
            0,
            Math.PI * 2
        );

        ctx.fill();

        // =====================
        // 中心圧縮
        // =====================
        const core =
            ctx.createRadialGradient(
                0, 0, r * 0.1,
                0, 0, r
            );

        core.addColorStop(
            0,
            "rgba(0,0,0,0.5)"
        );

        core.addColorStop(
            0.35,
            "rgba(30,30,35,0.12)"
        );

        core.addColorStop(
            1,
            "rgba(0,0,0,0)"
        );

        ctx.fillStyle = core;

        ctx.beginPath();

        // 元の球は維持
        ctx.arc(
            0,
            0,
            r,
            0,
            Math.PI * 2
        );

        ctx.fill();

        ctx.restore();
    }

    
    ctx.restore();
}

function drawNodes(ctx, r, electronMode = false) {

    const nodeR = 3;
    const dist = r + 12;

    const t = getNow() * 0.001;

    // =====================
    // 通常回転
    // =====================
    if (!electronMode) {

        const rotation = t;

        for (let i = 0; i < 4; i++) {

            const angle =
                Math.PI / 4 +
                (Math.PI / 2) * i +
                rotation;

            const x = Math.cos(angle) * dist;
            const y = Math.sin(angle) * dist;

            ctx.beginPath();
            const grad = ctx.createRadialGradient(
                x - 1,
                y - 1,
                0,
                x,
                y,
                nodeR
            );

            grad.addColorStop(0, "#d8dbe2");
            grad.addColorStop(0.5, "#7d8391");
            grad.addColorStop(1, "#444852");

            ctx.fillStyle = grad;
            ctx.arc(x, y, nodeR, 0, Math.PI * 2);
            ctx.fill();
        }

        return;
    }

    // =====================
    // 電子軌道モード
    // =====================

    const orbitCount = 4;

    for (let orbit = 0; orbit < orbitCount; orbit++) {

        const tilt =
            orbit * Math.PI / 3;

        const speed =
            0.8 + orbit * 0.3;

        const phase =
            orbit * Math.PI * 0.7;

        for (let i = 0; i < 2; i++) {

            const a =
                t * speed +
                phase +
                Math.PI * i;

            const ex =
                Math.cos(a) * dist;

            const ey =
                Math.sin(a) * dist * 0.35;

            const x =
                ex * Math.cos(tilt) -
                ey * Math.sin(tilt);

            const y =
                ex * Math.sin(tilt) +
                ey * Math.cos(tilt);

            const z =
                Math.sin(a);

            const scale =
                0.6 + z * 0.4;

            ctx.globalAlpha =
                0.2 + scale * 0.8;

            ctx.beginPath();

            const grad = ctx.createRadialGradient(
                x - 1,
                y - 1,
                0,
                x,
                y,
                nodeR * scale
            );

            grad.addColorStop(0, "#e1e5ee");
            grad.addColorStop(0.5, "#8790a3");
            grad.addColorStop(1, "#434854");

            ctx.fillStyle = grad;

            ctx.arc(
                x,
                y,
                nodeR * scale,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }
    }

    ctx.globalAlpha = 1;
}

function drawArmorShell(ctx, r) {

    const grad = ctx.createLinearGradient(
        -r,
        -r,
        r,
        r
    );

    grad.addColorStop(0, "#d9dde4");
    grad.addColorStop(0.45, "#878d9b");
    grad.addColorStop(1, "#4c5158");

    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";

    const rr = r - 2;
    const size = 0.22;

    const angles = [
        -Math.PI / 2,
        0,
        Math.PI / 2,
        Math.PI
    ];

    angles.forEach(angle => {
        ctx.beginPath();
        ctx.arc(
            0,
            0,
            rr,
            angle - size,
            angle + size
        );
        ctx.stroke();
    });
}


// ===============================
// Chain UI Render
// ===============================
export function renderChainUI(gameState){

    const stats = gameState.enemyStats;

    if(!stats) return;

    const bar = document.getElementById("chainBar");
    const label = document.getElementById("chainLabel");
    const value = document.getElementById("chainValue");
    const mul = document.getElementById("chainMultiplier");    

    if(!bar || !label || !value) return;

    const ratio = stats.chainBar / stats.chainBarMax;

    bar.style.width = (ratio * 100) + "%";

    // 表示　チェインカウント
    label.textContent = "CHAIN";
    value.textContent = stats.chainCount;
    // 表示　ボーナス倍率
    const multiplier = getChainMultiplier(stats.chainCount);

    if(mul){
        const bonus = stats.chainBonus ?? 0;

        const bonusText = bonus > 0
            ? ` (×${bonus.toFixed(1)})`
            : "";

        mul.textContent = `x${multiplier.toFixed(1)}${bonusText}`;
        // 上表示用
        mul.style.order = "-1";
        // 少し余白
        mul.style.marginBottom = "4px";

    }

    // 色変化
    if(ratio < 0.25){
        bar.style.background =
        "linear-gradient(90deg,#ff6b6b,#ff3b3b)";
    }
    else if(ratio < 0.5){
        bar.style.background =
        "linear-gradient(90deg,#ffd93d,#ff9f1c)";
    }
    else{
        bar.style.background =
        "linear-gradient(90deg,#4ecdc4,#44aaff)";
    }

}

// =====================
// Combo Tier Bar
// =====================

const tierCount = 3;

// 前回tier記録用
let prevTierIndex = -1;

/* =====================
初期生成
===================== */

export function initComboTierBar() {

    const tierWrapper =
    document.getElementById(
        "comboTierWrapper"
    );

    if (!tierWrapper) return;

       tierWrapper.innerHTML = "";

    for (let i = 0; i < tierCount; i++) {

        const block =
            document.createElement("div");

        block.className =
            "combo-tier-block";

        tierWrapper.appendChild(
            block
        );
    }
}

/* =====================
更新
===================== */

let prevComboTier = -1;

export function updateComboTierBar(stats) {

    const tierWrapper =
        document.getElementById(
            "comboTierWrapper"
        );

    if (!tierWrapper) return;

    const combo =
        stats.currentCombo;

    const blocks =
        tierWrapper.children;

    const isOverdrive =
        combo >= OVERDRIVE_COMBO;    

    // =====================
    // tier判定
    // =====================

    let currentTier = -1;

    for (let i = 0; i < COMBO_TIERS.length; i++) {

        if (
            combo >= COMBO_TIERS[i].min
        ) {
            currentTier = i;
        }
    }

    // =====================
    // block更新
    // =====================

    for (let i = 0; i < blocks.length; i++) {

        const block = blocks[i];

        block.classList.remove(
            "filled",
            "active",
            "overdrive-all"
        );

        block.style.setProperty(
            "--fill",
            `0%`
        );

        if (isOverdrive) {

            block.classList.add(
                "overdrive-all"
            );
        }

        // 達成済みtier
        if (
            currentTier >= 0 &&
            i < currentTier
        ) {
            block.classList.add(
                "filled"
            );
        }

        // 現在tier
        if (i === currentTier) {

            block.classList.add(
                "active"
            );

            const tier =
                COMBO_TIERS[i];

            const range =
                tier.max - tier.min;

            const value =
                combo - tier.min;

            const progress =
                    Math.max(0,Math.min(1,value / range)
                    );

            block.style.setProperty(
                "--fill",
                `${progress * 100}%`
            );
        }

    }

    // =====================
    // Flash
    // =====================

    if (
        currentTier > prevComboTier &&
        currentTier > 0
    ) {

        const flashBlock =
            blocks[currentTier - 1];

        if (flashBlock) {

            flashBlock.classList.remove(
                "flash"
            );

            void flashBlock.offsetWidth;

            flashBlock.classList.add(
                "flash"
            );
        }
    }

    prevComboTier = currentTier;
}

// ===============================
// ゲーム中のスコア表示（右上）
// ===============================
export function renderScore(ctx, gameState) {

    const stats = gameState.enemyStats;
    if (!stats?.startTime) return;

    // ★これ追加（重要）
    ctx.save();

    const x = ctx.canvas.clientWidth - 12;
    let y = 12;

    ctx.save();

    ctx.textAlign = "right";
    ctx.textBaseline = "top";

    y += 25;

    // =========================
    // ① ラベル（小さく）
    // =========================
    ctx.font = "bold 12px monospace";
    // 本体
    ctx.fillStyle = "#9a9a9a";
    ctx.fillText("SCORE", x, y);

    // =========================
    // ② スコア数値（大きく）
    // =========================
    const valueY = y + 14;

    ctx.font = "bold 30px monospace";

    // 本体
    ctx.fillStyle = "#9a9a9a";
    ctx.fillText(stats.gScore, x, valueY);


    // =========================
    // ③ 追加情報（ここから）
    // =========================
    const infoY = valueY + 40;

    ctx.font = "bold 12px monospace";
    ctx.fillStyle = "#9a9a9a";
    ctx.fillText("KILL", x, infoY);
    ctx.font = "bold 20px monospace";
    ctx.fillStyle = "#9a9a9a";
    ctx.fillText(`${stats.defeatedCount}`, x, infoY + 16);

    // 経過時間
    const now = getNow();
    const elapsedSec = ((now - stats.startTime) / 1000).toFixed(1);

    const infoY2 = infoY + 42;

    ctx.font = "bold 12px monospace";
    ctx.fillStyle = "#9a9a9a";
    ctx.fillText("TIME", x, infoY2);
    ctx.font = "bold 20px monospace";
    ctx.fillStyle = "#9a9a9a";
    ctx.fillText(`${elapsedSec}s`, x, infoY2 + 16);


    ctx.restore();
}

// ===============================
// 終了条件UI（左上・複数対応）
// ===============================
export function renderEndCondition(ctx, gameState, stage, now, startTime) {

    let spawnText = "";
    
    const stats = gameState.enemyStats;
    const end = stage.endConditions;
    const clear = stage.clearConditions;
    
    const lines = [];
    const lines2 = [];
    
    if (!startTime) return;

    // 出現敵数
    if (stage.spawn?.limit != null) {
        const remainEnemies = stats.remainingSpawn;
        const totalEnemies = stats.totalSpawn;
        const currentEnemies = totalEnemies - remainEnemies

        spawnText = `${currentEnemies}/${totalEnemies}`;

    } else {
        // 無限ステージ
        spawnText = `♾️`;
    }
    
    // 残り敵数
    if (end.killCount != null) {
        const remain = Math.max(0, end.killCount - stats.defeatedCount);
        lines.push({ label: "ENEMY", value: remain });
    }

    // 残り時間
    if (end.timerMs != null) {
        const remainMs = Math.max(0, end.timerMs - (now - startTime));
        const sec = (remainMs / 1000).toFixed(1);
        lines.push({ label: "TIME", value: `${sec}s` });
    }

    // 全滅
    if (end.allSpawnedDefeated) {
        lines.push({ label2: "Eliminate" });
    }
    
    // クリア条件
    const clearLines = buildClearText(clear);

    // fallback（何もないステージ対策）
    if (clearLines.length === 0) {
        clearLines.push("生き残れ");
    }

    // lines2に変換
    clearLines.forEach(text => {
        lines2.push({ label2: text });
    });

    // 表示なし
    //if (lines.length === 0) return;
    //if (lines2.length === 0) return;



    // =========================
    // 描画
    // =========================
    ctx.save();

    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    const x = 12;
    let y = 12;
    
    // 🔥 難易度（追加）
    ctx.font = "bold 10px monospace";
    ctx.fillStyle = "#9a9a9a";
    const diff = getDifficulty(stats.difficulty);
    ctx.fillText(`DIFFICULTY: ${diff.name}`, x, y);

    y += 25

    // SPAWN（単独描画）
    ctx.font = "bold 12px monospace";
    ctx.fillStyle = "#9a9a9a";
    ctx.fillText("SPAWN", x, y);

    y += 16;

    ctx.font = "bold 24px monospace";
    ctx.fillStyle = "#9a9a9a";
    ctx.fillText(spawnText, x, y);

    y += 48;
    
    // タイトル
    if (lines.length > 0) {
        ctx.font = "bold 12px monospace";
        ctx.fillStyle = "#9a9a9a";
        ctx.fillText("OBJECTIVE", x, y);

        y += 16;
        
        // 各行描画
        lines.forEach((item, i) => {

            const baseY = y + i * 26;
            // ラベル（小）
            if (item.label) {
                ctx.font = "bold 16px monospace";
                ctx.fillStyle = "#9a9a9a";
                ctx.fillText(item.label + ":", x, baseY+5);
            }
            // ラベル（中）
            if (item.label2) {
                ctx.font = "16px monospace";
                ctx.fillStyle = "#9a9a9a";
                ctx.fillText(item.label2, x, baseY);
            }
            // 値（大）
            if (item.value) {
            ctx.font = "bold 24px monospace";
            ctx.fillStyle = "#9a9a9a";
            ctx.fillText(item.value, x + 70, baseY);
            }

        });

        y += lines.length * 26 + 20;
    }

    // タイトル
    if (lines2.length > 0) {
        ctx.font = "bold 12px monospace";
        ctx.fillStyle = "#9a9a9a";
        ctx.fillText("CLEAR", x, y);

        y += 16;
        
        lines2.forEach((item, i) => {

            const baseY = y + i * 26;
            // ラベル（小）
            if (item.label) {
                ctx.font = "bold 16px monospace";
                ctx.fillStyle = "#9a9a9a";
                ctx.fillText(item.label + ":", x, baseY+5);
            }
            // ラベル（中）
            if (item.label2) {
                ctx.font = "16px monospace";
                ctx.fillStyle = "#9a9a9a";
                ctx.fillText(item.label2, x, baseY);
            }
            // 値（大）
            if (item.value) {
            ctx.font = "bold 24px monospace";
            ctx.fillStyle = "#9a9a9a";
            ctx.fillText(item.value, x + 70, baseY);
            }

        });
    }
    
     ctx.restore();
}

// ===============================
// Active Skill UI
// ===============================

export function renderActiveSkillUI(ctx, state, canvas) {
    const equipped = getEquippedActiveSkills();
    const skillId = equipped?.[0];
    const skill = ACTIVE_SKILLS?.[skillId];
    if (!skill) return;

    const chainUI = document.getElementById("chainUI");
    if (!chainUI) return;

    const rect = chainUI.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();

    // 少しコンパクト化
    const size = 36;
    // 表示座標
    const OFFSET_X = 22;
    const OFFSET_Y = 5; // ← 15 → 5 に減らす（上へ約10px）
    const x = rect.right - canvasRect.left + OFFSET_X;
    const y = rect.top - canvasRect.top + OFFSET_Y;

    const cooldownMax = state.activeSkillCooldownMax ?? 1;
    const current = state.activeSkillCooldown ?? 0;

    const stock = state.activeSkillStock ?? 0;
    const maxStock =
        state.player?.activeSkillStockMax ??
        state.activeSkillStockMax ??
        1;

    // 次チャージ進行率
    const rawRatio = 1 - current / cooldownMax;
    const ratio = Number.isFinite(rawRatio)
        ? Math.max(0, Math.min(1, rawRatio))
        : 0;

    // 1個でもあれば使用可能
    const ready = stock > 0;

    // 最大まで溜まってるか
    const fullyCharged = stock >= maxStock && current <= 0;

    ctx.save();

    // 外側リング（クールダウン）
    drawCooldownCircle(
        ctx,
        x + size / 2,
        y + size / 2,
        size / 2 + 2.5,
        ratio,
        ready,
        fullyCharged
    );

    // セパレーター
    drawSkillSeparatorRing(
        ctx,
        x + size / 2,
        y + size / 2,
        size / 2 - 0.5
    );

    // 中身（円アイコン）
    drawSkillIconCircle(
        ctx,
        skill,
        x + size / 2,
        y + size / 2,
        size - 12,
        ready
    );

    // 内側リング（ストック）
    if (maxStock > 1) {
        drawStockSegments(
            ctx,
            x + size / 2,
            y + size / 2,
            size / 2 - 3,
            stock,
            maxStock
        );
    }

    ctx.restore();

    // // ストック数字
    // if (stock > 0) {
    //     drawSkillStockNumber(
    //         ctx,
    //         x + size - 2,
    //         y + size - 2,
    //         stock
    //     );
    // }

    if (isMouseHoverRect(x, y, size, size)) {
        drawSkillTooltip(ctx, skill, x, y + size + 8);
    }
}

function drawSkillIconCircle(ctx, skill, x, y, size, ready) {
    ctx.save();

    if (!skill._img) {
        skill._img = new Image();
        skill._img.src = skill.icon;
    }

    if (
        !skill._img.complete ||
        skill._img.naturalWidth === 0
    ) {
        ctx.restore();
        return;
    }

    const r = size / 2;

    // 背景円（リング内側を埋める）
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(12,16,24,0.92)";
    ctx.fill();

    // 丸クリップ
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r - 1, 0, Math.PI * 2);
    ctx.clip();

    // CD中はグレー
    if (!ready) {
        ctx.filter = "grayscale(1) brightness(0.45)";
    } else {
        ctx.filter = "none";
    }

    ctx.drawImage(
        skill._img,
        x - r,
        y - r,
        size,
        size
    );

    ctx.restore();

    // ready時だけ発光
    if (ready) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(143,211,255,0.45)";
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    ctx.restore();
}

function drawCooldownCircle(
    ctx,
    x,
    y,
    r,
    ratio,
    ready,
    fullyCharged
) {
    ctx.save();

    // 背景リング
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(172, 172, 172, 0.3)";
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // MAX時は満タン固定
    const displayRatio = Number.isFinite(ratio)
        ? (fullyCharged ? 1 : ratio)
        : 0;

    ctx.beginPath();
    ctx.arc(
        x,
        y,
        r,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * displayRatio
    );

    // 色分け
    if (fullyCharged) {
        ctx.strokeStyle = "rgba(86, 107, 143, 0.95)";
    } else if (ready) {
        ctx.strokeStyle = "rgba(152, 174, 213, 0.69)";
    } else {
        ctx.strokeStyle = "rgba(152, 174, 213, 0.69)";
    }

    // 外周リングの線の太さ
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";
    ctx.stroke();

    ctx.restore();
}

function isMouseHoverRect(x, y, w, h) {

    if (!window.mousePos) return false;

    return (
        window.mousePos.x >= x &&
        window.mousePos.x <= x + w &&
        window.mousePos.y >= y &&
        window.mousePos.y <= y + h
    );
}

function drawSkillTooltip(ctx, skill, x, y) {

    const w = 180;
    const h = 64;

    ctx.save();

    roundRect(ctx, x, y, w, h, 10);
    ctx.fillStyle = "rgba(10,14,22,0.96)";
    ctx.fill();

    ctx.strokeStyle = "rgba(143,211,255,0.18)";
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    ctx.font = "bold 14px sans-serif";
    ctx.fillStyle = "#e7f3ff";
    ctx.fillText(skill.name, x + 10, y + 8);

    ctx.font = "12px sans-serif";
    ctx.fillStyle = "rgba(220,235,255,0.7)";
    ctx.fillText(skill.desc ?? "", x + 10, y + 30);

    ctx.restore();
}

// ===============================
// Active Skill Stock UI
// ===============================
// function drawSkillStockNumber(ctx, x, y, stock) {
//     ctx.save();

//     // 少し左上へ寄せる（右下から呼ばれても見切れにくい）
//     const offsetX = -2;
//     const offsetY = -2;

//     const cx = x + offsetX;
//     const cy = y + offsetY;

//     // stock数でサイズ微調整
//     const text = String(stock);
//     const radius = text.length >= 2 ? 10 : 8;

//     // バッジ背景
//     ctx.beginPath();
//     ctx.arc(cx, cy, radius, 0, Math.PI * 2);
//     ctx.fillStyle = "rgba(8,12,18,0.92)";
//     ctx.fill();

//     // 枠線
//     ctx.strokeStyle = "rgba(120,190,255,0.65)";
//     ctx.lineWidth = 1.5;
//     ctx.stroke();

//     // 数字
//     ctx.font = text.length >= 2
//         ? "bold 9px sans-serif"
//         : "bold 11px sans-serif";

//     ctx.textAlign = "center";
//     ctx.textBaseline = "middle";
//     ctx.fillStyle = "#d8ecff";
//     ctx.fillText(text, cx, cy + 0.5);

//     ctx.restore();
// }

function drawStockSegments(
    ctx,
    x,
    y,
    r,
    stock,
    maxStock
) {
    if (maxStock <= 1) return;

    ctx.save();

    const gap = 0.2; // セグメント隙間
    const startAngle = -Math.PI / 2;
    const segmentAngle =
        (Math.PI * 2) / maxStock;

    for (let i = 0; i < maxStock; i++) {

        const filled = i < stock;

        const a0 =
            startAngle +
            segmentAngle * i +
            gap / 2;

        const a1 =
            startAngle +
            segmentAngle * (i + 1) -
            gap / 2;

        ctx.beginPath();
        ctx.arc(x, y, r, a0, a1);

        if (filled) {
            ctx.strokeStyle = "rgb(57, 79, 121)";
            ctx.shadowBlur = 10; // 少し強め
            ctx.shadowColor = "rgba(0,0,0,0.3)";
        } else {
            ctx.strokeStyle = "rgba(120, 140, 160, 0.25)";
            ctx.shadowBlur = 0;
        }

        ctx.lineWidth = 4;
        //ctx.lineCap = "round";
        ctx.stroke();
    }

    ctx.restore();
}

function drawSkillSeparatorRing(
    ctx,
    x,
    y,
    r
) {
    ctx.save();

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);

    ctx.strokeStyle =
        "rgba(255, 255, 255, 0.94)";

    ctx.lineWidth = 1;

    ctx.stroke();

    ctx.restore();
}


// =======================================================
// ゲーム中に表示するメッセージ
// =======================================================
export function showGameMessage(
    gameState,
    text,
    duration = 120
) {

    gameState.systemMessage = text;
    gameState.systemMessageTimer = duration;
}

// =======================================================
// ゲーム中に表示するメッセージ描画
// =======================================================
export function renderSystemMessage(
    ctx,
    gameState,
    canvas
) {

    if (!gameState.systemMessageTimer) return;

    gameState.systemMessageTimer--;

    const chainUI = document.getElementById("chainUI");
    if (!chainUI) return;

    const rect = chainUI.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();

    const size = 40;

    const skillX =
        rect.right - canvasRect.left + 22;

    const skillY =
        rect.top - canvasRect.top + 15;

    // スキル右下あたり
    const x = skillX + size + 10;
    const y = skillY + size - 2;

    const text = gameState.systemMessage ?? "";

    ctx.save();

    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    // 小さめ
    ctx.font = "bold 11px sans-serif";

    const metrics = ctx.measureText(text);

    const w = metrics.width + 10;
    const h = 18;

    // 背景
    ctx.fillStyle = "rgba(0,0,0,0.45)";

    roundRect(
        ctx,
        x,
        y - h / 2,
        w,
        h,
        6
    );

    ctx.fill();

    // 文字
    ctx.fillStyle =
        "rgba(230,240,255,0.88)";

    ctx.fillText(
        text,
        x + 5,
        y
    );

    ctx.restore();
}