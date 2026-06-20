// enemyRenderer.js

import { getDisplayFullRoma, getDisplayRomaForEnemy } from "./typingLogic.js";
import { getDifficulty } from "./difficulties.js";
import { getNow } from "./gameCore.js";
import { getChainMultiplier } from "./enemyCore.js"
import { getEquippedActiveSkills, COMBO_TIERS, OVERDRIVE_COMBO, } from "./questPlayerStats.js";
import { ACTIVE_SKILLS } from "./questSkills.js";
import { getItemDescription } from "./enemy.js";
import { renderEnemyBehaviorEffect,renderFreezeAura } from "./effectManager.js";
import { images } from "./assetsLoader.js";

// テキストが英数字・記号のみ（英語問題）か判定
const isEnglish = (str) => /^[a-zA-Z0-9\s.,!?-]+$/.test(str);

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

const bgCache = new Map();

/**
 * クエストモードの背景画像を描画する
 */
export function renderQuestBackground(ctx, node) {
    if (!node?.bgImage) return;

    // 1. まず assetsLoader でロード済みの画像から探す
    let img = images[node.bgImage];

    // 2. なければ動的にロード（フォールバック）
    if (!img) {
        if (!bgCache.has(node.bgImage)) {
            img = new Image();
            img.src = node.bgImage;
            bgCache.set(node.bgImage, img);
        } else {
            img = bgCache.get(node.bgImage);
        }
    }

    if (img.complete && img.naturalWidth !== 0) {
        const cw = ctx.canvas.clientWidth;
        const ch = ctx.canvas.clientHeight;
        ctx.save();
        // タイピングの邪魔にならないよう、背景を薄く（透過）描画
        ctx.globalAlpha = 0.25; 
        
        const scale = Math.max(cw / img.width, ch / img.height);
        const sw = img.width * scale;
        const sh = img.height * scale;
        ctx.drawImage(img, (cw - sw) / 2, (ch - sh) / 2, sw, sh);
        ctx.restore();
    }
}

export function renderEnemies(ctx, enemies, lockedEnemy, candidateEnemies = []) {
    ctx.textAlign = "center";

    // lockedEnemy may be an `activeAttack` (has .ref) or an `enemy` directly.
    const lockedRef = lockedEnemy ? (lockedEnemy.ref || lockedEnemy) : null;

    // 通常敵：ロック対象を除いて Y 座標でソートして描画（前後関係を自然にする）
    const nonLocked = enemies
        .filter(e => e && e !== lockedRef)
        .slice()
        .sort((a, b) => (a.y || 0) - (b.y || 0));

    for (const enemy of nonLocked) {
        drawEnemy(ctx, enemy, lockedEnemy, candidateEnemies);
    }

    // ロック敵は常に最後（最前面）に描画
    if (lockedRef && enemies.includes(lockedRef)) {
        drawEnemy(ctx, lockedRef, lockedEnemy, candidateEnemies);
    }
}

export function renderActiveAttackUI(ctx, player, enemies, lockedTarget, candidateTargets) {
    // 全ての敵から activeAttack を集める
    const targets = enemies
        .filter(en => en.activeAttack)
        .map(en => en.activeAttack);

    if (targets.length === 0) return;

    targets.forEach((atk, index) => {
        const enemy = atk.ref;
        const behavior = enemy.type.behaviors?.find(b => b.type === "attack");
        if (!behavior || !enemy.behaviorStates) return;

        const key = behavior.type + "_" + behavior.interval;
        const bState = enemy.behaviorStates[key];
        if (!bState) return;

        const preDelay = behavior.preDelay || 1;
        const timerRatio = Math.max(0, (behavior.interval - bState.timer) / preDelay);

        // ロックオン状態の判定
        const isLocked = lockedTarget === atk;
        const isCandidate = candidateTargets.includes(atk);

        ctx.save();
        ctx.textAlign = "center";
        
        const x = player.x;
        // 複数の攻撃がある場合は上に積み上げる
        const y = player.y - player.radius - 50 - (index * 45);

        // 文字色の決定（ロックオン時はオレンジ、通常は赤系）
        const mainColor = (isLocked || isCandidate) ? "#ff9100" : "#ff4d4d";
        const romaColor = (isLocked || isCandidate) ? "#ffc107" : "#ff7875";

        ctx.font = "14px sans-serif";
        ctx.fillStyle = mainColor;
        ctx.strokeStyle = "rgba(0,0,0,0.5)";
        ctx.lineWidth = 3;
        ctx.strokeText(atk.word, x, y - 20);
        ctx.fillText(atk.word, x, y - 20);

        const displayRoma = getDisplayRomaForEnemy(atk, getDisplayFullRoma);
        const typedLen = atk.inputedRomaji.length + atk.typed.length;
        const remainPart = displayRoma.slice(typedLen);
        
        ctx.font = "bold 14px monospace";
        ctx.fillStyle = romaColor;
        ctx.strokeText(remainPart, x, y);
        ctx.fillText(remainPart, x, y);

        const barW = 60;
        const barH = 5;
        ctx.fillStyle = "rgba(255,255,255,0.2)";
        ctx.fillRect(x - barW/2, y + 8, barW, barH);
        ctx.fillStyle = mainColor;
        ctx.fillRect(x - barW/2, y + 8, barW * timerRatio, barH);

        ctx.restore();
    });
}

function drawEnemy(ctx, enemy, lockedEnemy, candidateEnemies){

    renderEnemyBehaviorEffect(ctx,enemy);
    
    ctx.save(); // ←これ絶対
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic"; // ←初期化

    const word = enemy.word || "";
    const displayFull = getDisplayRomaForEnemy(enemy, getDisplayFullRoma);

    // ロックまたは候補状態の判定（本体またはその攻撃が対象の場合）
    const isLocked = lockedEnemy && (lockedEnemy === enemy || lockedEnemy.ref === enemy);
    const isCandidate = candidateEnemies.some(c => c === enemy || c.ref === enemy);

    const typedLen =
        (enemy.inputedRomaji || "").length +
        (enemy.typed || "").length;

    const remainPart = displayFull.slice(typedLen);

    let enemyColor = enemy.type.color;
    //ロックした敵の色
    if (isLocked || isCandidate) {
        enemyColor = "orange";
    }

    const radius = enemy.radius || 15;

    // =====================
    // 敵の見た目描画（shape + pattern）
    // =====================
    drawEnemyBody(ctx, enemy, enemyColor);

    renderFreezeAura(
        ctx,
        enemy
    );

    // ★召喚マーク
    if (enemy.isSummoned) {
        ctx.save();

        ctx.strokeStyle = "rgba(166, 166, 166, 0.9)";
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        ctx.arc(
            enemy.x,
            enemy.y,
            (enemy.type.size || 15) + 6,
            0,
            Math.PI * 2
        );
        ctx.stroke();

        ctx.restore();
    }

    // 英語問題の場合はメインの単語表示（日本語表記）を隠す
    if (!isEnglish(enemy.text)) {
        ctx.font = "17px 'Inter', 'Noto Sans JP', sans-serif";
        ctx.fillStyle = "#f0f6fc"; // 白系
        ctx.fillText(word, enemy.x, enemy.y - radius - 15);
    }

    ctx.font = "bold 17px monospace";
    //入力文字の色
    let remainColor = "#a3c8e4"; // より鮮明なシアンに変更

    //ロックした敵の入力文字の色
    if (isLocked || isCandidate) {
        remainColor = "rgb(255, 123, 0)";
    }

    const remainWidth = ctx.measureText(remainPart).width;

    const remainX = enemy.x; // X座標は変更なし
    const remainY = enemy.y - radius; // Y座標を5px上に移動

    // 発光の代わりに黒い縁取り（アウトライン）を追加して視認性を確保
    ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
    ctx.lineWidth = 3;
    ctx.strokeText(remainPart, remainX, remainY);
    ctx.fillStyle = remainColor;
    ctx.fillText(remainPart, remainX, remainY);

    // =====================
    // ロックカーソル
    // =====================
    if (isLocked) {

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
        ctx.fillStyle = "rgba(53, 53, 53, 0.5)";
        roundRect(ctx, boxX, boxY, boxW, boxH, 6);
        ctx.fill();

        // 文字
        ctx.fillStyle = "#ffffff";
        ctx.fillText(countText, enemy.x, boxY + 2);
        // ロック中だけ強調
        if (isLocked) {
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
            ctx.strokeStyle = "rgba(195, 195, 195, 0.9)";
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
    // 六角形は常に上を向くように回転を無効化
    if (type.shape === "hexagon") {
        ctx.rotate(0);
    } else {
        ctx.rotate(enemy.rotation);
    }
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
// 形状のパスを定義するヘルパー（クリッピングや多重描画用）
// ===============================
function defineShapePath(ctx, x, y, shapeType, size) {
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
            const s = size * 0.35;
            for (let i = 0; i < 4; i++) {
                const a = (Math.PI / 2) * i;
                ctx.lineTo(x + Math.cos(a - 0.2) * size, y + Math.sin(a - 0.2) * size);
                ctx.lineTo(x + Math.cos(a + 0.2) * size, y + Math.sin(a + 0.2) * size);
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
            ctx.moveTo(x, y - size);
            ctx.lineTo(x + size * 0.8, y);
            ctx.lineTo(x, y + size);
            ctx.lineTo(x - size * 0.8, y);
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
        default:
            ctx.arc(x, y, size, 0, Math.PI * 2);
            break;
    }
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

        case "hexagon":
            drawHexagon(ctx, x, y, size, grad, color);
            break;

        case "square":
            ctx.beginPath();
            defineShapePath(ctx, x, y, "square", size);
            ctx.fillStyle = grad;
            ctx.fill();

            ctx.strokeStyle = "rgba(255,255,255,0.14)";
            ctx.lineWidth = 1;
            ctx.stroke();
            break;

        case "arrow":
            ctx.beginPath();
            defineShapePath(ctx, x, y, "arrow", size);
            
            ctx.fillStyle = grad;
            ctx.fill();

            ctx.strokeStyle = "rgba(255,255,255,0.2)";
            ctx.lineWidth = 1;
            ctx.stroke();
            break;

        default:
            ctx.beginPath();
            defineShapePath(ctx, x, y, type.shape, size);
            
            if (type.shape === "pinwheel") {
                // Pinwheelは独自描画を維持
                drawPinwheelShape(ctx, x, y, type, color);
                return;
            }

            ctx.fillStyle = grad;
            ctx.fill();
    }
}

// ===============================
// 六角形を描く
// ===============================
function drawHexagon(ctx, x, y, size, grad, color) {
    ctx.beginPath();
    defineShapePath(ctx, x, y, "hexagon", size);

    ctx.fillStyle = grad;
    ctx.fill();

    const sw = size * 0.7;
    const sh = size * 1.3;

    // 内部のカットライン（クリスタル感の演出）
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    // 縦のセンターライン
    ctx.moveTo(x, y - sh); ctx.lineTo(x, y + sh);
    // 左右の角から中心へ向かうライン
    ctx.moveTo(x - sw, y - sh * 0.4); ctx.lineTo(x + sw, y + sh * 0.4);
    ctx.moveTo(x + sw, y - sh * 0.4); ctx.lineTo(x - sw, y + sh * 0.4);
    ctx.stroke();

    // 上部の反射（ハイライト）
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.beginPath();
    ctx.moveTo(x, y - sh);
    ctx.lineTo(x + sw, y - sh * 0.4);
    ctx.lineTo(x, y);
    ctx.lineTo(x - sw, y - sh * 0.4);
    ctx.fill();

    // 外枠の輝き
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
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

        // 電子回路
        case "circuit":
            drawCircuit(ctx, x, y, type);
            break;
    }
}

function drawStripe(ctx, x, y, type){

    const size = type.size;
    const diag = size * 3; // ← 十分大きくするのがコツ

    ctx.save();

    // クリッピング（形状に合わせる）
    ctx.beginPath();
    defineShapePath(ctx, x, y, type.shape, size);
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

    const size = type.size;
    const maxRing = Math.floor(size / 5);

    for(let i = 0; i < maxRing; i++){

        const radius = size - i * 5;
        if (radius <= 0) break;

        ctx.beginPath();
        defineShapePath(ctx, x, y, type.shape, radius);

        ctx.strokeStyle = i % 2 === 0
            ? "rgba(255,255,255,0.45)"
            : "rgba(0,0,0,0.22)";

        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

function drawCircuit(ctx, x, y, type) {
    const size = type.size;
    ctx.save();

    // クリッピング
    ctx.beginPath();
    defineShapePath(ctx, x, y, type.shape, size);
    ctx.clip();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.lineWidth = 1.5;

    // 中心から放射状に伸びる回路ライン
    const lineCount = 6;
    for (let i = 0; i < lineCount; i++) {
        const angle = (Math.PI * 2 / lineCount) * i;
        const len = size * 0.8;
        
        ctx.beginPath();
        ctx.moveTo(x, y);
        
        // 途中でカクッと曲がる配線
        const midX = x + Math.cos(angle) * len * 0.5;
        const midY = y + Math.sin(angle) * len * 0.5;
        const endX = x + Math.cos(angle + 0.5) * len;
        const endY = y + Math.sin(angle + 0.5) * len;

        ctx.lineTo(midX, midY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // 端子（ノード）
        ctx.beginPath();
        ctx.arc(endX, endY, 2.5, 0, Math.PI * 2);
        ctx.fill();
    }

    // センターコアの小さな四角
    ctx.fillRect(x - 3, y - 3, 6, 6);

    ctx.restore();
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
        ctx.fillStyle = "#c3c3c3";
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
    ctx.fillStyle = "#dbdbdb";
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

    label.style.color = "#e4e4e4";
    value.style.color = "#e4e4e4";
    if(mul) mul.style.color = "#e4e4e4";

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
export function renderScore(ctx, gameState, now) {

    const stats = gameState.enemyStats;
    if (!stats?.startTime || !now) return;

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
    ctx.fillStyle = "#f0f6fc"; // 左右HUDの文字を明るい白系に統一
    ctx.fillText("SCORE", x, y);

    // =========================
    // ② スコア数値（大きく）
    // =========================
    const valueY = y + 14;

    ctx.font = "bold 30px monospace";

    // 本体
    ctx.fillStyle = "#f0f6fc";
    ctx.fillText(stats.gScore, x, valueY);


    // =========================
    // ③ 追加情報（ここから）
    // =========================
    const infoY = valueY + 40;

    ctx.font = "bold 12px monospace";
    ctx.fillStyle = "#f0f6fc";
    ctx.fillText("KILL", x, infoY);
    ctx.font = "bold 20px monospace";
    ctx.fillStyle = "#f0f6fc";
    ctx.fillText(`${stats.defeatedCount}`, x, infoY + 16);

    // 経過時間
    const elapsedSec = ((now - stats.startTime) / 1000).toFixed(1);

    const infoY2 = infoY + 42;

    ctx.font = "bold 12px monospace";
    ctx.fillStyle = "#f0f6fc";
    ctx.fillText("TIME", x, infoY2);
    ctx.font = "bold 20px monospace";
    ctx.fillStyle = "#f0f6fc";
    ctx.fillText(`${elapsedSec}s`, x, infoY2 + 16);


    ctx.restore();
}

let prevRemainingSpawn = null;
let spawnAnimState = null;

// ===============================
// 終了条件UI（左上・複数対応）
// ===============================
export function renderEndCondition(ctx, gameState, stage, now, startTime) {

    let spawnDots = null;
    let spawnText = "";
    
    const stats = gameState.enemyStats;
    const end = stage.phaseConditions || stage.endConditions || {};
    const clear = stage.clearConditions || gameState.stage?.clearConditions || {};
    
    const lines = [];
    const lines2 = [];
    
    if (!startTime) return;

    // 出現敵数（ドット表示）
    if (stage.spawn?.limit != null) {
        const remaining = stats.remainingSpawn;
        const total = stats.totalSpawn;

        // 減少アニメ検知
        if (prevRemainingSpawn !== null && remaining < prevRemainingSpawn) {
            spawnAnimState = {
                type: "decay",
                time: now
            };
        }

        const prevBig = Math.floor((prevRemainingSpawn ?? remaining) / 10);
        const nowBig = Math.floor(remaining / 10);

        if (prevBig > nowBig) {
            spawnAnimState = {
                type: "collapse10",
                time: now
            };
        }

        prevRemainingSpawn = remaining;

        spawnDots = {
            remaining,
            total
        };

    } else {
        spawnDots = null;
        spawnText = "♾️";
    }
    
    // 残り敵数
    if (end.killCount != null) {
        const remain = Math.max(0, end.killCount - stats.phaseProcessedCount);
        lines.push({ label: "ENEMY", value: remain });
    }

    // 残り時間
    if (end.timerMs != null) {
        const remainMs = Math.max(0, end.timerMs - (now - stats.phaseStartTime));
        const sec = (remainMs / 1000).toFixed(1);
        lines.push({ label: "TIME", value: `${sec}s` });
    }

    // 全滅
    if (end.allSpawnedDefeated) {
        lines.push({ label2: "Eliminate" });
    }
    
    // クリア条件（進捗表示）
    if (clear.killCount != null) {
        const current = stats.objectiveDefeated ?? 0; 
        const isMet = current >= clear.killCount;
        lines2.push({
            label: "KILL", 
            value: `${current}/${clear.killCount}`,
            color: isMet ? "#4caf50" : undefined
        });
    }

    if (clear.timerMs != null) {
        const elapsedSec = ((now - stats.startTime) / 1000).toFixed(1);

        const currentSec = Math.floor(elapsedSec);
        const targetSec = Math.floor(clear.timerMs / 1000);

        let remainSec = targetSec - currentSec;

        // 0でストップ（マイナスは失敗扱い）
        const isFailed = remainSec <= 0;
        remainSec = Math.max(0, remainSec);

        lines2.push({
            label: "TIME",
            value: `${remainSec}/${targetSec}s`,
            color: isFailed ? "#ff6b6b" : undefined
        });
    }

    if (clear.survive != null) {
        lines2.push({
            label2: `生存`
        });
    }

    // =========================
    // 描画
    // =========================
    ctx.save();

    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    const x = 12;
    let y = 12;
    
    // 🔥 難易度 & フェーズ表示
    ctx.font = "bold 10px monospace";
    ctx.fillStyle = "#f0f6fc";
    const diff = getDifficulty(stats.difficulty);
    
    let headerText = `DIFFICULTY: ${diff.name}`;
    if (Array.isArray(gameState.stage.phases)) {
        const phaseName = stage.name || `PHASE ${stats.currentPhaseIndex + 1}`;
        headerText += ` | ${phaseName}`;
    }
    ctx.fillText(headerText, x, y);

    y += 25

    // SPAWN（単独描画）
    ctx.font = "bold 12px monospace";
    ctx.fillStyle = "#f0f6fc";
    ctx.fillText("SPAWN", x, y);

    y += 16;

    if (spawnDots) {
        drawSpawnDots(ctx, x, y, spawnDots.remaining, spawnAnimState);
    } else {
        ctx.font = "bold 24px monospace";
        ctx.fillStyle = "#f0f6fc"; // ♾️を白く表示
        ctx.fillText(spawnText, x, y);
    }

    y += 48;
    
    // タイトル
    if (lines.length > 0) {
        ctx.font = "bold 12px monospace";
        ctx.fillStyle = "#f0f6fc";
        ctx.fillText("OBJECTIVE", x, y);

        y += 16;
        
        // 各行描画
        lines.forEach((item, i) => {

            const baseY = y + i * 26;
            // ラベル（小）
            if (item.label) {
                ctx.font = "bold 16px monospace";
                ctx.fillStyle = "#f0f6fc";
                ctx.fillText(item.label + ":", x, baseY + 5);
            }
            // ラベル（中）
            if (item.label2) {
                ctx.font = "16px monospace";
                ctx.fillStyle = "#f0f6fc";
                ctx.fillText(item.label2, x, baseY);
            }
            // 値（大）
            if (item.value) {
                ctx.font = "bold 24px monospace";
                ctx.fillStyle = "#f0f6fc";
                ctx.fillText(item.value, x + 70, baseY);
            }

        });

        y += lines.length * 26 + 20;
    }

    // タイトル
    if (lines2.length > 0) {
        ctx.font = "bold 12px monospace";
        ctx.fillStyle = "#e4e4e4";
        ctx.fillText("CLEAR", x, y);

        y += 16;
        
        lines2.forEach((item, i) => {

            const baseY = y + i * 26;
            const itemColor = item.color ?? "#e4e4e4";

            // ラベル（小）
            if (item.label) {
                ctx.font = "bold 16px monospace";
                ctx.fillStyle = "#e4e4e4";
                ctx.fillStyle = itemColor;
                ctx.fillText(item.label + ":", x, baseY+5);
            }
            // ラベル（中）
            if (item.label2) {
                ctx.font = "16px monospace";
                ctx.fillStyle = "#e4e4e4";
                ctx.fillStyle = itemColor;
                ctx.fillText(item.label2, x, baseY);
            }
            // 値（大）
            if (item.value) {
                ctx.font = "bold 24px monospace";
                ctx.fillStyle = item.color ?? "#e4e4e4";
                ctx.fillStyle = itemColor;
                ctx.fillText(item.value, x + 70, baseY);
            }

        });
    }
    
     ctx.restore();
}

// 敵の数をドットで表現
function drawSpawnDots(ctx, x, y, remaining, anim) {

    if (remaining === 0) {
        ctx.font = "bold 16px monospace";
        ctx.fillStyle = "#e4e4e4";
        ctx.fillText("0", x, y);
        return;
    }

    const bigSize = 22;
    const bigCount = Math.floor(remaining / 10);
    const smallCount = remaining % 10;

    let cursorX = x;

    // ======================
    // ⬤（10）
    // ======================
    if (bigCount > 0) {

        ctx.save();
        ctx.translate(cursorX, y);

        ctx.font = `${bigSize}px monospace`;
        ctx.fillStyle = "#e4e4e4";
        ctx.textBaseline = "top";

        ctx.fillText("⬤", 0, 0);

        ctx.restore();

        if (remaining >= 20) {
            ctx.font = "bold 14px monospace";
            ctx.fillStyle = "#a7a7a7";
            ctx.fillText(`×${bigCount}`, cursorX + 18, y + 14);
        }

        cursorX += 30;
    }

    // ======================
    // •（1）
    // ======================
    drawSmallDots(ctx, cursorX + 10, y, smallCount, anim);

    ctx.globalAlpha = 1;
}

function drawSmallDots(ctx, x, y, count, anim) {
    ctx.font = `14px monospace`;
    ctx.fillStyle = "#e4e4e4";

    for (let i = 0; i < count; i++) {
        const col = i % 5;
        const row = Math.floor(i / 5);

        let dx = x + col * 14;
        let dy = y + row * 12;

        // 減少アニメ（最後の1個）
        if (anim?.type === "decay" && i === count - 1) {
            const t = Math.min(1, (performance.now() - anim.time) / 150);
            dx += t * 12;
            ctx.globalAlpha = 1 - t;
        }

        ctx.fillText("●", dx, dy);
        ctx.globalAlpha = 1;
    }
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
    ctx.strokeStyle = "rgba(164, 164, 164, 0.45)";
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
        ctx.strokeStyle = "rgb(206, 224, 255)";
    } else if (ready) {
        ctx.strokeStyle = "rgba(193, 216, 255, 0.9)";
    } else {
        ctx.strokeStyle = "rgba(193, 216, 255, 0.9)";
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
            ctx.strokeStyle = "rgb(179, 205, 255)";
            ctx.shadowBlur = 10; // 少し強め
            ctx.shadowColor = "rgba(0,0,0,0.3)";
        } else {
            ctx.strokeStyle = "rgba(80, 100, 120, 0.5)";
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

    const size = 34;

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
    ctx.font = "bold 9px sans-serif";

    const metrics = ctx.measureText(text);

    const w = metrics.width + 8;
    const h = 16;

    // 背景
    ctx.fillStyle = "rgba(14, 14, 14, 0.45)";

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

/**
 * フェーズ移行の警告を画面中央に大きく描画する
 */
export function renderPhaseWarning(ctx, stats, canvas) {
    if (!stats.isTransitioning || !stats.transitionMsg) return;

    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;

    ctx.save();
    
    // 背景の暗転（少しだけ）
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.fillRect(0, 0, cw, ch);

    // 警告バーの背景
    ctx.fillStyle = "rgba(40, 44, 52, 0.85)"; // シンプルなダークグレー
    ctx.fillRect(0, ch / 2 - 60, cw, 120);

    // 上下の装飾ライン
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, ch / 2 - 60); ctx.lineTo(cw, ch / 2 - 60);
    ctx.moveTo(0, ch / 2 + 60); ctx.lineTo(cw, ch / 2 + 60);
    ctx.stroke();

    // テキスト描画
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    // 点滅（パルスエフェクト）
    const alpha = 0.7 + Math.sin(performance.now() * 0.01) * 0.3;
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    
    ctx.font = "bold 32px sans-serif";
    ctx.fillText(stats.transitionMsg, cw / 2, ch / 2 - 10);

    // 次の目標を表示
    if (stats.nextPhaseGoal) {
        ctx.font = "16px monospace";
        ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
        ctx.fillText(stats.nextPhaseGoal, cw / 2, ch / 2 + 30);
    }

    ctx.restore();
}

// ===========================================
// UI Anchor Position
// エネミーモードに表示されるUIの場所記録
// ===========================================

export function getUIAnchorPosition(type = "skill") {

    const canvas =
        document.getElementById("gameCanvas");

    // fallback
    if (!canvas) {

        return {
            x: window.innerWidth * 0.5,
            y: window.innerHeight - 80
        };
    }

    const rect =
        canvas.getBoundingClientRect();

    // ======================================
    // Skill UI
    // ======================================
    if (type === "skill") {

        return {

            x:
                rect.left +
                rect.width * 0.5,

            y:
                rect.top +
                rect.height - 90
        };
    }

    // ======================================
    // HP UI
    // ======================================
    else if (type === "hp") {

        return {

            x:
                rect.left + 110,

            y:
                rect.top + 42
        };
    }

    // ======================================
    // Combo UI
    // ======================================
    else if (type === "combo") {

        return {

            x:
                rect.left +
                rect.width * 0.5,

            y:
                rect.top + 80
        };
    }

    // ======================================
    // default
    // ======================================
    return {

        x:
            rect.left +
            rect.width * 0.5,

        y:
            rect.top +
            rect.height * 0.5
    };
}