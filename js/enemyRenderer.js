// enemyRenderer.js

import { getDisplayFullRoma, getDisplayRomaForEnemy } from "./typingLogic.js";
import { getDifficulty } from "./difficulties.js";
import { getNow } from "./gameCore.js";
import { getChainMultiplier } from "./enemyCore.js";
import { spawnComboTierUpEffect, playComboTierUpSound } from "./effectManager.js";
import { getEquippedActiveSkills, COMBO_TIERS, OVERDRIVE_COMBO, OVERDRIVE_SPEED, } from "./questPlayerStats.js";
import { ACTIVE_SKILLS } from "./questSkills.js";
import { getItemDescription } from "./enemy.js";
import { renderEnemyBehaviorEffect,renderFreezeAura } from "./effectManager.js";
import { images } from "./assetsLoader.js";
import { defineShapePath } from "./shapeDefinitions.js";
import { stageRect, STAGE_W, STAGE_H } from "./stageScale.js";
import { getEnemyTextBox } from "./enemySpawner.js";

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

// =====================================================
// ★文字同士の動的ずらし（文字列が重なった時のみ上段へずらし、離れたら0へスッと復帰）
// =====================================================
/**
 * 敵・ビットなど全ターゲットの「文字列同士」の重なりを検出し、
 * targetTextOffsetY（目標ずらし量・負=上方向）を設定する。
 * - 判定は文字列ラベル部分（上段word＋下段romaの2行）のみ。
 *   本体（敵の円）同士が重なっていても文字列同士が離れていればずらさない
 * - ※弾（isBullet）は対象外：弾の文字列は常に定位置（オフセット0）で描画し、
 *    他のターゲットをずらすきっかけにもしない
 * - 実際の位置は各オブジェクトの update 内で textOffsetY を滑らかに補間する
 * - 入力中（ロック中）のターゲットはタイピングしやすいよう定位置（オフセット0）をキープし、
 *   重なった相手側を「ロック中の文字列から離れる方向（外側）」へずらす。
 *   （無条件に上へずらすと、ロック敵の下にある敵の文字がロック文字列の上に
 *     積み重なって逆に読めなくなるため）
 * - 敵同士がすれ違って重なりが解消されたら targetTextOffsetY は自動的に0へ戻る
 * - あわせて「文字列と他の敵本体の重なり」を検出して textOverBody フラグを立てる。
 *   位置はずらさず、描画側（drawEnemyText）で文字だけ浮かび上がらせる
 * @param {Array} targets 敵（＋ビット等）の全ターゲット配列
 * @param {object} lockedEnemy ロック中のターゲット（activeAttack の場合は .ref を参照）
 */
export function updateEnemyTextOffsets(targets, lockedEnemy) {

    // ★見た目・判定ロジック不変の軽量化: 矩形の事前計算＋Map/クロージャ削減でGCを抑制。
    //   ずらし量・方向・上限・復帰挙動の計算式は従来どおり。
    if (!targets || targets.length === 0) return;
    let liveCount = 0;
    for (let k = 0; k < targets.length; k++) {
        const t = targets[k];
        if (t && !t.isDead && !t.isBullet && (t.text || t.word)) liveCount++;
    }
    if (liveCount === 0) return;
    // 1体だけの fast path（ペア判定なし。最終書き込み結果は従来と同一）
    if (liveCount === 1) {
        for (let k = 0; k < targets.length; k++) {
            const t = targets[k];
            if (t && !t.isDead && !t.isBullet && (t.text || t.word)) {
                t.targetTextOffsetY = 0;
                t.textOverBody = false;
                return;
            }
        }
        return;
    }

    const list = (targets || []).filter(t => t && !t.isDead && !t.isBullet && (t.text || t.word));
    if (list.length === 0) return;

    // lockedEnemy may be an `activeAttack` (has .ref) or an `enemy` directly.
    const lockedRef = lockedEnemy ? (lockedEnemy.ref || lockedEnemy) : null;

    // ロック中の文字列（アンカー）の中心Y（常にオフセット0で固定される）
    let anchorCenterY = null;
    if (lockedRef) {
        const anchorBox = getEnemyTextBox(lockedRef);
        anchorCenterY = anchorBox.y + anchorBox.h / 2;
    }

    const PADDING = 6;      // ずらした際の余白
    const MAX_OFFSET = 80; // ずらし上限（上下それぞれ。密集時でも行き場があるように）

    // 目標値を毎フレーム再計算する（重なりが解消されたら0へ戻る）
    // ★配列＋ベース矩形の事前計算で、ペア判定中のMap/オブジェクト生成を排除（計算式は同一）
    const n = list.length;
    const baseX = new Array(n);
    const baseY = new Array(n);
    const baseW = new Array(n);
    const baseH = new Array(n);
    for (let k = 0; k < n; k++) {
        const b = getEnemyTextBox(list[k]);
        baseX[k] = b.x; baseY[k] = b.y; baseW[k] = b.w; baseH[k] = b.h;
    }
    const offArr = new Array(n).fill(0);

    // ペアワイズ解消（数パス回して連鎖的な重なりにも対応）
    for (let pass = 0; pass < 4; pass++) {
        let moved = false;

        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                const aY = baseY[i] + offArr[i];
                const bY = baseY[j] + offArr[j];
                // boxesOverlap と同一判定（インライン化で関数呼び出し・確保を排除）
                if (!(baseX[i] < baseX[j] + baseW[j] && baseX[j] < baseX[i] + baseW[i] &&
                      aY < bY + baseH[j] && bY < aY + baseH[i])) continue;

                const overlapY =
                    Math.min(aY + baseH[i], bY + baseH[j]) -
                    Math.max(aY, bY);
                const push = overlapY + PADDING;

                const a = list[i];
                const b = list[j];
                const aLocked = a === lockedRef;
                const bLocked = b === lockedRef;
                if (aLocked && bLocked) continue; // 両方ロックは基本発生しない

                const aCenter = aY + baseH[i] / 2;
                const bCenter = bY + baseH[j] / 2;

                // ずらす側と方向の決定:
                // 基本は「相手の文字列から離れる方向」へずらす。
                // ロック中の文字列は定位置（オフセット0）で動かないため、
                // 下側の文字を無条件に上へずらすと、ロック中の文字列の上に
                // 文字列が積み重なって逆に読めなくなる。
                // → ロック文字列を挟んで「外側」の文字列を「外側方向」へずらし、
                //   ロック文字列の周囲に空白ができるようにする。
                let moverIdx;
                let dir; // 1: 下へ離れる, -1: 上へ離れる
                if (aLocked || bLocked) {
                    // ロック中のペア: 動ける方をロック文字列から離れる方向へずらす
                    moverIdx = aLocked ? j : i;
                    const moverCenter = aLocked ? bCenter : aCenter;
                    const lockedCenter = aLocked ? aCenter : bCenter;
                    dir = moverCenter >= lockedCenter ? 1 : -1;
                } else if (anchorCenterY !== null) {
                    // ロック文字列が存在する場合: ロック文字列から遠い方（外側）を動かす
                    const aDist = Math.abs(aCenter - anchorCenterY);
                    const bDist = Math.abs(bCenter - anchorCenterY);
                    if (aDist >= bDist) {
                        moverIdx = i;
                        dir = aCenter >= bCenter ? 1 : -1;
                    } else {
                        moverIdx = j;
                        dir = bCenter >= aCenter ? 1 : -1;
                    }
                } else {
                    // ロック中の敵がいない場合: 従来どおり画面下側の文字を上段へずらす
                    moverIdx = (a.y !== b.y) ? (a.y > b.y ? i : j) : j;
                    dir = -1;
                }

                const cur = offArr[moverIdx];
                const newOffset = dir > 0
                    ? Math.min(MAX_OFFSET, cur + push)
                    : Math.max(-MAX_OFFSET, cur - push);
                if (newOffset !== cur) {
                    offArr[moverIdx] = newOffset;
                    moved = true;
                }
            }
        }

        if (!moved) break;
    }

    for (let k = 0; k < n; k++) {
        list[k].targetTextOffsetY = offArr[k];
    }

    // =====================
    // ★文字列と「他の敵本体」との重なり検出
    // 位置はずらさず（文字と文字が重なった場合だけずらす）、
    // textOverBody フラグを立てて描画側で文字だけ浮かび上がらせる
    // =====================
    for (let k = 0; k < n; k++) {
        const t = list[k];
        const tX = baseX[k];
        const tY = baseY[k] + offArr[k];
        const tW = baseW[k];
        const tH = baseH[k];

        let over = false;
        for (let m = 0; m < n; m++) {
            if (m === k) continue;
            const o = list[m];

            const r = o.radius || o.type?.size || 15;
            // 円（本体）と矩形（文字列）の重なり判定
            const cx = Math.max(tX, Math.min(o.x, tX + tW));
            const cy = Math.max(tY, Math.min(o.y, tY + tH));
            const dx = o.x - cx;
            const dy = o.y - cy;

            if (dx * dx + dy * dy < r * r) {
                over = true;
                break;
            }
        }
        t.textOverBody = over;
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

    const hasLocked = Boolean(lockedRef && enemies.includes(lockedRef));

    // =====================
    // ★重なりのレイヤー順（手前 → 奥）:
    //   1. ロック中の敵の文字（最前面: 入力中の文字は必ず読める）
    //   2. ロック以外の敵の文字
    //   3. ロック中の敵の本体
    //   4. ロック以外の敵の本体（最背面）
    //   → 文字列は常に本体より手前に描画され、文字が本体に隠れない
    // =====================

    // 4. ロック以外の敵の本体（最背面）
    for (const enemy of nonLocked) {
        drawEnemy(ctx, enemy, lockedEnemy, candidateEnemies, "body");
    }

    // 3. ロック中の敵の本体
    if (hasLocked) {
        drawEnemy(ctx, lockedRef, lockedEnemy, candidateEnemies, "body");
    }

    // 2. ロック以外の敵の文字
    for (const enemy of nonLocked) {
        drawEnemy(ctx, enemy, lockedEnemy, candidateEnemies, "text");
    }

    // 1. ロック中の敵の文字（最前面）
    if (hasLocked) {
        drawEnemy(ctx, lockedRef, lockedEnemy, candidateEnemies, "text");
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

        ctx.font = "14px 'M PLUS Rounded 1c', sans-serif";
        ctx.fillStyle = mainColor;
        ctx.strokeStyle = "rgba(0,0,0,0.5)";
        ctx.lineWidth = 3;
        ctx.strokeText(atk.word, x, y - 20);
        ctx.fillText(atk.word, x, y - 20);

        const displayRoma = getDisplayRomaForEnemy(atk, getDisplayFullRoma);
        const typedLen = atk.inputedRomaji.length + atk.typed.length;
        const remainPartRaw = displayRoma.slice(typedLen);
        const remainPart = remainPartRaw.replace(/ /g, '␣');
        
        ctx.font = "bold 14px 'Noto Sans Mono', monospace";
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

function drawEnemy(ctx, enemy, lockedEnemy, candidateEnemies, layer = "all"){

    // "text" レイヤー: 文字列（word＋ローマ字の2行）のみを描画する
    if (layer === "text") {
        drawEnemyText(ctx, enemy, lockedEnemy, candidateEnemies);
        return;
    }

    renderEnemyBehaviorEffect(ctx,enemy);
    
    ctx.save(); // ←これ絶対
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic"; // ←初期化

    // ★ビット: フェードイン適用
    if (enemy.isBit && enemy.spawnAlpha < 1) {
        ctx.globalAlpha = enemy.spawnAlpha;
    }

    // ロックまたは候補状態の判定（本体またはその攻撃が対象の場合）
    const isLocked = lockedEnemy && (lockedEnemy === enemy || lockedEnemy.ref === enemy);
    const isCandidate = candidateEnemies.some(c => c === enemy || c.ref === enemy);

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

    // ★ビット連動ボス: 本体と生存ビットを電磁波風ラインで連結
    if (enemy.isBitBoss) {
        drawBitLinks(ctx, enemy);
    }

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

    // =====================
    // 文字列（word＋ローマ字の2行）
    // layer === "all" の場合のみここで一緒に描画する。
    // renderEnemies のレイヤー分割描画（"text" / "body"）時は
    // drawEnemyText 側で描画される。
    // =====================
    if (layer === "all") {
        drawEnemyText(ctx, enemy, lockedEnemy, candidateEnemies);
    }

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

        ctx.font = "bold 12px 'Noto Sans Mono', monospace";
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
// 敵の文字列（word＋ローマ字の2行）のみを描画
// ※renderEnemies のレイヤー分割描画（"text"）からも呼ばれる
// ===============================
function drawEnemyText(ctx, enemy, lockedEnemy, candidateEnemies){

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic"; // ←初期化

    // ★ビット: フェードイン適用
    if (enemy.isBit && enemy.spawnAlpha < 1) {
        ctx.globalAlpha = enemy.spawnAlpha;
    }

    const word = enemy.word || "";
    const displayFull = getDisplayRomaForEnemy(enemy, getDisplayFullRoma);

    // ロックまたは候補状態の判定（本体またはその攻撃が対象の場合）
    const isLocked = lockedEnemy && (lockedEnemy === enemy || lockedEnemy.ref === enemy);
    const isCandidate = candidateEnemies.some(c => c === enemy || c.ref === enemy);

    const typedLen =
        (enemy.inputedRomaji || "").length +
        (enemy.typed || "").length;

    const remainPartRaw = displayFull.slice(typedLen);
    const remainPart = remainPartRaw.replace(/ /g, '␣');

    const radius = enemy.radius || 15;

    // ★文字列動的ずらし: 重なり時に上へずらしたオフセットを適用
    // ※弾（isBullet）の文字列は常に定位置で描画する（ずらさない）
    const labelOffsetY = enemy.isBullet ? 0 : (enemy.textOffsetY || 0);

    // =====================
    // ★文字と敵本体が重なっているときは、文字だけ浮かび上がらせる
    // （位置はずらさない。背前に半透明プレートを添えて本体から浮かせて見せる）
    // =====================
    if (enemy.textOverBody) {
        const tBox = getEnemyTextBox(enemy);
        const px = tBox.x - 2;
        const py = tBox.y + labelOffsetY - 2;
        const pw = tBox.w + 4;
        const ph = tBox.h + 4;

        // 本体の上に文字が浮かんで見えるよう半透明の暗色プレートを敷く
        ctx.fillStyle = "rgba(6, 10, 18, 0.55)";
        roundRect(ctx, px, py, pw, ph, 8);
        ctx.fill();

        // うっすら白い縁で「浮いている」ことを示す
        ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
        ctx.lineWidth = 1;
        roundRect(ctx, px, py, pw, ph, 8);
        ctx.stroke();
    }

    ctx.font = "17px 'Inter', 'M PLUS Rounded 1c', sans-serif";
    ctx.strokeStyle = "rgba(0, 0, 0, 0.85)";
    ctx.lineWidth = 3;
    ctx.strokeText(word, enemy.x, enemy.y - radius - 15 + labelOffsetY);
    ctx.fillStyle = "#f0f6fc"; // 白系
    ctx.fillText(word, enemy.x, enemy.y - radius - 15 + labelOffsetY);

    ctx.font = "bold 17px 'Noto Sans Mono', monospace";
    //入力文字の色
    let remainColor = "#a3c8e4"; // より鮮明なシアンに変更

    //ロックした敵の入力文字の色
    if (isLocked || isCandidate) {
        remainColor = "rgb(255, 123, 0)";
    }

    const remainX = enemy.x; // X座標は変更なし
    const remainY = enemy.y - radius + labelOffsetY; // ★文字列動的ずらしオフセットを適用

    // 発光の代わりに黒い縁取り（アウトライン）を追加して視認性を確保
    ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
    ctx.lineWidth = 3;
    ctx.strokeText(remainPart, remainX, remainY);
    ctx.fillStyle = remainColor;
    ctx.fillText(remainPart, remainX, remainY);

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
        "bold 10px 'Noto Sans Mono', monospace";

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
// ビット連結ライン（電磁波風）+ ビットのリスポーン表示
// ===============================
function drawBitLinks(ctx, enemy) {
    const slots = enemy.bitSlots || {};
    const now = performance.now();
    const orbit = enemy.type.bitOrbitRadius || 120;

    for (const side of ["left", "right"]) {
        const slot = slots[side];
        if (!slot) continue;
        const bit = slot.enemy;

        if (bit && !bit.isDead) {
            // ---- 生存ビット: 本体と薄い波打つラインで連結（電磁波風）----
            // ビットが死んだときはこの分岐に入らず、ラインが消える
            const dx = bit.x - enemy.x;
            const dy = bit.y - enemy.y;
            const ang = Math.atan2(dy, dx);
            const len = Math.hypot(dx, dy) || 1;
            const waveAmp = 3.0;

            ctx.save();
            ctx.strokeStyle = "rgba(120, 220, 255, 0.30)";
            ctx.lineWidth = 1.2;

            ctx.beginPath();
            const segments = 22;
            for (let i = 0; i <= segments; i++) {
                const t = i / segments;
                const phase = Math.sin(t * Math.PI * 3 + now * 0.004);
                const px = enemy.x + Math.cos(ang) * len * t + Math.sin(ang) * waveAmp * phase;
                const py = enemy.y + Math.sin(ang) * len * t - Math.cos(ang) * waveAmp * phase;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.stroke();
            ctx.restore();
        } else {
            // ---- 死亡中ビット: 本体が復活させるまでの残り秒を薄く表示 ----
            const sec = Math.ceil(slot.respawnTimer || 0);
            if (sec <= 0) continue;
            const dir = side === "left" ? -1 : 1;
            const bx = enemy.x + dir * orbit;
            const by = enemy.y + (enemy.type.size || 15) + 14;

            ctx.save();
            ctx.font = "10px 'Noto Sans Mono', monospace";
            ctx.textAlign = "center";
            ctx.fillStyle = "rgba(255,255,255,0.55)";
            ctx.fillText(`RESPAWN ${sec}`, bx, by);
            ctx.restore();
        }
    }
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

        case "diamond":
            drawDiamond(ctx, x, y, size, color);
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
// ラミエル風のダイヤモンド形状
// ===============================
function drawDiamond(ctx, x, y, size, color) {
    const s = size;

    // 4つの三角形の頂点
    const pTop = { x: x, y: y - s };
    const pRight = { x: x + s, y: y };
    const pBottom = { x: x, y: y + s };
    const pLeft = { x: x - s, y: y };
    const pCenter = { x: x, y: y };

    // 面ごとの色を定義
    const colors = {
        topLeft: adjustColor(color, 80),
        topRight: adjustColor(color, 20),
        bottomLeft: adjustColor(color, -20),
        bottomRight: adjustColor(color, -80)
    };

    // 各面を描画
    // Top-Left
    ctx.beginPath();
    ctx.moveTo(pTop.x, pTop.y); ctx.lineTo(pLeft.x, pLeft.y); ctx.lineTo(pCenter.x, pCenter.y);
    ctx.fillStyle = colors.topLeft; ctx.fill();

    // Top-Right
    ctx.beginPath();
    ctx.moveTo(pTop.x, pTop.y); ctx.lineTo(pRight.x, pRight.y); ctx.lineTo(pCenter.x, pCenter.y);
    ctx.fillStyle = colors.topRight; ctx.fill();

    // Bottom-Left
    ctx.beginPath();
    ctx.moveTo(pBottom.x, pBottom.y); ctx.lineTo(pLeft.x, pLeft.y); ctx.lineTo(pCenter.x, pCenter.y);
    ctx.fillStyle = colors.bottomLeft; ctx.fill();

    // Bottom-Right
    ctx.beginPath();
    ctx.moveTo(pBottom.x, pBottom.y); ctx.lineTo(pRight.x, pRight.y); ctx.lineTo(pCenter.x, pCenter.y);
    ctx.fillStyle = colors.bottomRight; ctx.fill();

    // 輪郭線
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1;
    defineShapePath(ctx, x, y, "diamond", size);
    ctx.stroke();
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

        case "stripe":
            drawStripe(ctx, x, y, type);
            break;
        case "ring":
            drawRing(ctx, x, y, type);
            break;
        case "circuit":
            drawCircuit(ctx, x, y, type);
            break;
        
        case "honeycomb":
            drawHoneycomb(ctx, x, y, type);
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

    // レイヤーを重ねて密度を上げる
    for (let layer = 0; layer < 2; layer++) {
        const gridSize = 6 + layer * 2; // レイヤーごとにグリッドサイズを変更
        const numX = Math.ceil(size * 2 / gridSize);
        const numY = Math.ceil(size * 2 / gridSize);
        const startX = x - size;
        const startY = y - size;

        ctx.strokeStyle = `rgba(255, 255, 255, ${0.2 + layer * 0.15})`;
        ctx.fillStyle = `rgba(255, 255, 255, ${0.4 + layer * 0.1})`;
        ctx.lineWidth = 1.0 + layer * 0.5;

        for (let i = 0; i < numX; i++) {
            for (let j = 0; j < numY; j++) {
                // ランダムシードを座標とレイヤーに依存させる
                const seed = i * numY + j + layer;
                const rand = Math.sin(seed * 12.9898) * 43758.5453 % 1;

                if (rand < 0.4) continue; // 60%の確率で描画しない

                const gx = startX + i * gridSize;
                const gy = startY + j * gridSize;

                // 端子（小さな円）
                ctx.beginPath();
                ctx.arc(gx, gy, 1.5, 0, Math.PI * 2);
                ctx.fill();

                // 配線
                ctx.beginPath();
                ctx.moveTo(gx, gy);
                if (rand < 0.6) { // 垂直
                    ctx.lineTo(gx, gy + gridSize * (rand < 0.5 ? 1 : -1));
                } else if (rand < 0.8) { // 水平
                    ctx.lineTo(gx + gridSize * (rand < 0.7 ? 1 : -1), gy);
                } else { // 斜め
                    ctx.lineTo(gx + gridSize * (rand < 0.9 ? 1 : -1), gy + gridSize * (rand < 0.85 ? 1 : -1));
                }
                ctx.stroke();
            }
        }
    }
    ctx.restore();
}

function drawHoneycomb(ctx, x, y, type) {
    const size = type.size;
    ctx.save();

    // クリッピング
    ctx.beginPath();
    defineShapePath(ctx, x, y, type.shape, size);
    ctx.clip();
    const hexSize = size * 0.25; // 六角形のサイズ
    const hexWidth = hexSize * 2;
    const hexHeight = Math.sqrt(3) * hexSize; // No change, this is correct for tight packing
    const horizDist = hexWidth * 3 / 4;
    const vertDist = hexHeight;

    ctx.strokeStyle = "rgba(255, 160, 122, 0.4)"; // イロウル風のオレンジ色
    ctx.lineWidth = 1.5;

    const startX = x - size * 1.5;
    const startY = y - size * 1.5;
    const endX = x + size * 1.5;
    const endY = y + size * 1.5;

    for (let row = 0; startY + row * vertDist < endY; row++) {
        for (let col = 0; startX + col * horizDist < endX; col++) {
            const cx = startX + col * horizDist;
            const cy = startY + row * vertDist + (col % 2 === 1 ? vertDist / 2 : 0);

            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI / 3) * i + Math.PI / 6;
                const hx = cx + hexSize * Math.cos(angle);
                const hy = cy + hexSize * Math.sin(angle);
                if (i === 0) ctx.moveTo(hx, hy);
                else ctx.lineTo(hx, hy);
            }
            ctx.closePath();
            ctx.stroke();
        }
    }

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

        ctx.font = "bold 12px 'Noto Sans Mono', monospace";
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

    ctx.font = "12px 'Noto Sans Mono', monospace";
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
// ★見た目不変の軽量化: DOM取得のキャッシュ＋変化時のみ書き込み
// （色・文言・レイアウト・更新タイミングの見た目は同一）
// ===============================
// DOM参照キャッシュ（初回取得後は使い回し。要素が作り直された場合は再取得）
let _chainEls = null;
let _chainElsReady = false;
// 前回書き込み値（変化時のみDOMへ反映し、スタイル再計算を抑制）
let _chainLast = { ratioQ: -1, band: -1, label: "", value: -1, mul: "" };

function getChainEls() {
    if (_chainElsReady && _chainEls && _chainEls.bar && document.contains(_chainEls.bar)) return _chainEls;
    _chainEls = {
        bar: document.getElementById("chainBar"),
        label: document.getElementById("chainLabel"),
        value: document.getElementById("chainValue"),
        mul: document.getElementById("chainMultiplier"),
    };
    _chainElsReady = true;
    // 固定スタイルは初回のみ設定（毎フレームの上書きを排除。見た目は同一）
    if (_chainEls.label) _chainEls.label.style.color = "#e4e4e4";
    if (_chainEls.value) _chainEls.value.style.color = "#e4e4e4";
    if (_chainEls.mul) {
        _chainEls.mul.style.color = "#e4e4e4";
        _chainEls.mul.style.order = "-1";
        _chainEls.mul.style.marginBottom = "4px";
    }
    return _chainEls;
}

export function renderChainUI(gameState){

    const stats = gameState.enemyStats;

    if(!stats) return;

    const { bar, label, value, mul } = getChainEls();

    if(!bar || !label || !value) return;

    const ratio = stats.chainBar / stats.chainBarMax;

    // 幅は0.5%刻みに量子化（見た目の滑らかさは維持しつつstyle書き込みを間引き）
    const ratioQ = Math.round(ratio * 200) / 200;
    if (ratioQ !== _chainLast.ratioQ) {
        _chainLast.ratioQ = ratioQ;
        bar.style.width = (ratioQ * 100) + "%";
    }

    // 表示　チェインカウント
    if (_chainLast.label !== "CHAIN") {
        _chainLast.label = "CHAIN";
        label.textContent = "CHAIN";
    }
    if (_chainLast.value !== stats.chainCount) {
        _chainLast.value = stats.chainCount;
        value.textContent = stats.chainCount;
    }
    // 表示　ボーナス倍率
    const multiplier = getChainMultiplier(stats.chainCount);

    if(mul){
        const bonus = stats.chainBonus ?? 0;

        const bonusText = bonus > 0
            ? ` (×${bonus.toFixed(1)})`
            : "";

        const mulText = `x${multiplier.toFixed(1)}${bonusText}`;
        if (_chainLast.mul !== mulText) {
            _chainLast.mul = mulText;
            mul.textContent = mulText;
        }

    }

    // 色変化（帯域が変わったときだけbackgroundを書き換え）
    const band = ratio < 0.25 ? 0 : ratio < 0.5 ? 1 : 2;
    if (band !== _chainLast.band) {
        _chainLast.band = band;
        if(band === 0){
            bar.style.background =
            "linear-gradient(90deg,#ff6b6b,#ff3b3b)";
        }
        else if(band === 1){
            bar.style.background =
            "linear-gradient(90deg,#ffd93d,#ff9f1c)";
        }
        else{
            bar.style.background =
            "linear-gradient(90deg,#4ecdc4,#44aaff)";
        }
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

    // ★ chainUI を表示状態にする
    const chainUI = document.getElementById("chainUI");
    if (chainUI) {
        chainUI.style.display = "block";
    }

    if (!tierWrapper) return;

    tierWrapper.innerHTML = "";
    const tierCount = COMBO_TIERS.length;
    for (let i = 0; i < tierCount; i++) {

        const block =
            document.createElement("div");

        block.className =
            "combo-tier-block";

        tierWrapper.appendChild(
            block
        );
    }
    // ★キャッシュ無効化（作り直し後の初回更新で必ず再描画させる）
    _comboTierWrapperCache = null;
    _comboTierLastKey = null;
    prevComboTier = -1;
    // chain表示の前回値もリセット（再開時に古い値でスキップしない）
    _chainElsReady = false;
    _chainEls = null;
    _chainLast = { ratioQ: -1, band: -1, label: "", value: -1, mul: "" };
}

/* =====================
更新
===================== */

let prevComboTier = -1;
// ★見た目不変の軽量化: wrapperキャッシュ＋変化時のみblock更新（表示結果は同一）
let _comboTierWrapperCache = null;
let _comboTierLastKey = null;
let _enemyCanvasCache = null;

function getComboTierWrapper() {
    if (_comboTierWrapperCache && document.contains(_comboTierWrapperCache)) return _comboTierWrapperCache;
    _comboTierWrapperCache = document.getElementById("comboTierWrapper");
    _comboTierLastKey = null; // 作り直し時は必ず再描画
    return _comboTierWrapperCache;
}

function getEnemyModeCanvasEl() {
    if (_enemyCanvasCache && document.contains(_enemyCanvasCache)) return _enemyCanvasCache;
    _enemyCanvasCache = document.getElementById("enemyModeCanvas");
    return _enemyCanvasCache;
}

export function updateComboTierBar(stats, skillUiEnabled = false) {

    const tierWrapper = getComboTierWrapper();

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

    // 現在tierの進捗を量子化（0.5%刻み）し、変化がなければblockのDOM更新をスキップ。
    // class/--fillの最終表示は同一。flash・効果音・ポップアップの条件判定は従来どおり行う。
    let progressQ = -1;
    if (currentTier >= 0 && !isOverdrive) {
        const tier = COMBO_TIERS[currentTier];
        const range = tier.max - tier.min;
        const value = combo - tier.min;
        const progress = Math.max(0, Math.min(1, value / range));
        progressQ = Math.round(progress * 200) / 200; // 0.5%刻み
    }
    const barKey = combo + "|" + currentTier + "|" + (isOverdrive ? 1 : 0) + "|" + progressQ;
    const barDirty = barKey !== _comboTierLastKey;
    if (barDirty) {
        _comboTierLastKey = barKey;

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

            // Tier上昇時のエフェクト（MAXではない）
            const isNowOverdrive = combo >= OVERDRIVE_COMBO;
            if (!isNowOverdrive) {
                const enemyCanvasEl = getEnemyModeCanvasEl();
                const tierWrapperRect = stageRect(tierWrapper);
                const canvasRect = stageRect(enemyCanvasEl);
                const centerX = tierWrapperRect.left + tierWrapperRect.width / 2 - canvasRect.left;
                const centerY = tierWrapperRect.top + tierWrapperRect.height / 2 - canvasRect.top;
                spawnComboTierUpEffect(centerX, centerY, currentTier, false);
                playComboTierUpSound(currentTier, false);
            }

            // ★コンボで獲得したクールタイム短縮倍率をポップアップ表示
            // （アクティブスキルUI表示中のみ＝クエスト / フリーモードのスキル有効時）
            if (skillUiEnabled) {
                triggerCooldownSpeedPopup(
                    COMBO_TIERS[currentTier].cooldownSpeed,
                    stats
                );
            }
        }
    }

    // =====================
    // MAX到達時の演出（prevComboTierとは別に判定）
    // =====================
    const wasOverdrive = stats.prevCombo < OVERDRIVE_COMBO;

    if (wasOverdrive && isOverdrive) {
        const enemyCanvasEl = getEnemyModeCanvasEl();
        const tierWrapperRect = stageRect(tierWrapper);
        const canvasRect = stageRect(enemyCanvasEl);
        const centerX = tierWrapperRect.left + tierWrapperRect.width / 2 - canvasRect.left;
        const centerY = tierWrapperRect.top + tierWrapperRect.height / 2 - canvasRect.top;
        const lastTier = COMBO_TIERS.length - 1; // 最後のティア
        spawnComboTierUpEffect(centerX, centerY, lastTier, true);
        playComboTierUpSound(lastTier, true);

        // ★オーバードライブ到達時もクールタイム短縮倍率をポップアップ表示
        if (skillUiEnabled) {
            triggerCooldownSpeedPopup(OVERDRIVE_SPEED, stats);
        }
    }

    prevComboTier = currentTier;
    stats.prevCombo = combo; // 現在のコンボ数を保存
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
    ctx.font = "bold 12px 'Noto Sans Mono', monospace";
    // 本体
    ctx.fillStyle = "#f0f6fc"; // 左右HUDの文字を明るい白系に統一
    ctx.fillText("SCORE", x, y);

    // =========================
    // ② スコア数値（大きく）
    // =========================
    const valueY = y + 14;

    ctx.font = "bold 30px 'Noto Sans Mono', monospace";

    // 本体
    ctx.fillStyle = "#f0f6fc";
    ctx.fillText(stats.gScore, x, valueY);


    // =========================
    // ③ 追加情報（ここから）
    // =========================
    const infoY = valueY + 40;

    ctx.font = "bold 12px 'Noto Sans Mono', monospace";
    ctx.fillStyle = "#f0f6fc";
    ctx.fillText("KILL", x, infoY);
    ctx.font = "bold 20px 'Noto Sans Mono', monospace";
    ctx.fillStyle = "#f0f6fc";
    ctx.fillText(`${stats.defeatedCount}`, x, infoY + 16);

    // 経過時間
    const elapsedSec = ((now - stats.startTime) / 1000).toFixed(1);

    const infoY2 = infoY + 42;

    ctx.font = "bold 12px 'Noto Sans Mono', monospace";
    ctx.fillStyle = "#f0f6fc";
    ctx.fillText("TIME", x, infoY2);
    ctx.font = "bold 20px 'Noto Sans Mono', monospace";
    ctx.fillStyle = "#f0f6fc";
    ctx.fillText(`${elapsedSec}s`, x, infoY2 + 16);

    renderBgmInfo(ctx, gameState, now);


    ctx.restore();
}

let prevRemainingSpawn = null;
let spawnAnimState = null;
const SPAWN_ANIM_DURATION = 180;

export function resetSpawnDotState() {
    prevRemainingSpawn = null;
    spawnAnimState = null;
}

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
                time: now,
                fromCount: prevRemainingSpawn,
                toCount: remaining,
                fromSmall: prevRemainingSpawn % 10,
                toSmall: remaining % 10,
                fromBig: Math.floor(prevRemainingSpawn / 10),
                toBig: Math.floor(remaining / 10)
            };
        }

        // アニメーション期限切れ判定
        if (spawnAnimState && (now - spawnAnimState.time >= SPAWN_ANIM_DURATION)) {
            spawnAnimState = null;
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
        const currentDefeated = stats.phaseObjectiveDefeated ?? stats.objectiveDefeated ?? 0;
        const remain = Math.max(0, end.killCount - currentDefeated);
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
    ctx.font = "bold 10px 'Noto Sans Mono', monospace";
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
    ctx.font = "bold 12px 'Noto Sans Mono', monospace";
    ctx.fillStyle = "#f0f6fc";
    ctx.fillText("SPAWN", x, y);

    y += 16;

    if (spawnDots) {
        drawSpawnDots(ctx, x, y, spawnDots.remaining, spawnAnimState, now);
    } else {
        ctx.font = "bold 24px 'Noto Sans Mono', monospace";
        ctx.fillStyle = "#f0f6fc"; // ♾️を白く表示
        ctx.fillText(spawnText, x, y);
    }

    y += 48;
    
    // タイトル
    if (lines.length > 0) {
        ctx.font = "bold 12px 'Noto Sans Mono', monospace";
        ctx.fillStyle = "#f0f6fc";
        ctx.fillText("OBJECTIVE", x, y);

        y += 16;
        
        // 各行描画
        lines.forEach((item, i) => {

            const baseY = y + i * 26;
            // ラベル（小）
            if (item.label) {
                ctx.font = "bold 16px 'Noto Sans Mono', monospace";
                ctx.fillStyle = "#f0f6fc";
                ctx.fillText(item.label + ":", x, baseY + 5);
            }
            // ラベル（中）
            if (item.label2) {
                ctx.font = "16px 'Noto Sans Mono', monospace";
                ctx.fillStyle = "#f0f6fc";
                ctx.fillText(item.label2, x, baseY);
            }
            // 値（大）
            if (item.value) {
                ctx.font = "bold 24px 'Noto Sans Mono', monospace";
                ctx.fillStyle = "#f0f6fc";
                ctx.fillText(item.value, x + 70, baseY);
            }

        });

        y += lines.length * 26 + 20;
    }

    // タイトル
    if (lines2.length > 0) {
        ctx.font = "bold 12px 'Noto Sans Mono', monospace";
        ctx.fillStyle = "#e4e4e4";
        ctx.fillText("CLEAR", x, y);

        y += 16;
        
        lines2.forEach((item, i) => {

            const baseY = y + i * 26;
            const itemColor = item.color ?? "#e4e4e4";

            // ラベル（小）
            if (item.label) {
                ctx.font = "bold 16px 'Noto Sans Mono', monospace";
                ctx.fillStyle = "#e4e4e4";
                ctx.fillStyle = itemColor;
                ctx.fillText(item.label + ":", x, baseY+5);
            }
            // ラベル（中）
            if (item.label2) {
                ctx.font = "16px 'Noto Sans Mono', monospace";
                ctx.fillStyle = "#e4e4e4";
                ctx.fillStyle = itemColor;
                ctx.fillText(item.label2, x, baseY);
            }
            // 値（大）
            if (item.value) {
                ctx.font = "bold 24px 'Noto Sans Mono', monospace";
                ctx.fillStyle = item.color ?? "#e4e4e4";
                ctx.fillStyle = itemColor;
                ctx.fillText(item.value, x + 70, baseY);
            }

        });
    }
    
     ctx.restore();
}

/**
 * 現在再生中のBGM情報を描画する
 */
function renderBgmInfo(ctx, gameState, now) {
    const info = gameState.currentBgmInfo;
    // startTimeが0（リセット済み）またはinfoがない場合は描画しない
    if (!info || !gameState.startTime) return;

    // 画面右下に配置
    const x = ctx.canvas.clientWidth - 12;
    const y = ctx.canvas.clientHeight - 12;

    ctx.save();

    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";

    // フェードインのためのアルファ値計算
    // BGMが切り替わってから最初の2秒でフェードイン、その後は表示継続
    const fadeDuration = 2000;
    const elapsed = now - (gameState.startTime || 0); // Use gameState.startTime

    let alpha = 1;
    if (elapsed < fadeDuration) {
        alpha = elapsed / fadeDuration; // Fade in
    }

    ctx.globalAlpha = Math.max(0, alpha);

    // 曲名
    ctx.font = "bold 14px 'M PLUS Rounded 1c', sans-serif";
    ctx.fillStyle = "#e4e4e4";
    ctx.fillText(`♪ ${info.title} / ${info.composer}`, x, y);

    ctx.restore();
}

// 敵の数をドットで表現
function drawSpawnDots(ctx, x, y, remaining, anim, now) {

    if (remaining === 0) {
        // 直前の最後の1個の消滅アニメ中ならそれを描画
        if (anim?.type === "decay" && anim.fromCount === 1) {
            const elapsed = now - anim.time;
            if (elapsed < SPAWN_ANIM_DURATION) {
                const t = Math.min(1, elapsed / SPAWN_ANIM_DURATION);
                ctx.save();
                ctx.font = `14px 'Noto Sans Mono', monospace`;
                ctx.fillStyle = "#e4e4e4";
                ctx.globalAlpha = Math.max(0, 1 - t);
                ctx.fillText("●", x + 10 + t * 8, y);
                ctx.restore();
                return;
            }
        }
        ctx.font = "bold 16px 'Noto Sans Mono', monospace";
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

        ctx.font = `${bigSize}px 'Noto Sans Mono', monospace`;
        ctx.fillStyle = "#e4e4e4";
        ctx.textBaseline = "top";

        ctx.fillText("⬤", 0, 0);

        ctx.restore();

        if (remaining >= 20) {
            ctx.font = "bold 14px 'Noto Sans Mono', monospace";
            ctx.fillStyle = "#a7a7a7";
            ctx.fillText(`×${bigCount}`, cursorX + 18, y + 14);
        }

        cursorX += 30;
    }

    // ======================
    // •（1）
    // ======================
    drawSmallDots(ctx, cursorX + 10, y, smallCount, anim, now);

    ctx.globalAlpha = 1;
}

function drawSmallDots(ctx, x, y, count, anim, now) {
    ctx.font = `14px 'Noto Sans Mono', monospace`;
    ctx.fillStyle = "#e4e4e4";

    // 現在の残りの丸（すべて通常描画）
    for (let i = 0; i < count; i++) {
        const col = i % 5;
        const row = Math.floor(i / 5);

        const dx = x + col * 14;
        const dy = y + row * 12;

        ctx.fillText("●", dx, dy);
    }

    // 減少アニメーション（直前に消えた1個をフェードアウト＆スライド描画）
    if (anim?.type === "decay" && anim.fromBig === anim.toBig) {
        const elapsed = now - anim.time;
        if (elapsed < SPAWN_ANIM_DURATION) {
            const t = Math.min(1, elapsed / SPAWN_ANIM_DURATION);
            const disappearingIndex = count; // 直前にあった位置 (index = count)
            if (disappearingIndex < 10) {
                const col = disappearingIndex % 5;
                const row = Math.floor(disappearingIndex / 5);

                const dx = x + col * 14 + t * 8;
                const dy = y + row * 12;

                ctx.save();
                ctx.globalAlpha = Math.max(0, 1 - t);
                ctx.fillText("●", dx, dy);
                ctx.restore();
            }
        }
    }
}


// ===============================
// Active Skill UI
// ===============================

// ===============================
// コンボで獲得したクールタイム短縮倍率のポップアップ
// （アクティブスキルUIの横に表示）
// ===============================
let cooldownSpeedPopup = null;

function triggerCooldownSpeedPopup(multiplier, stats = null) {

    // ★アクティブスキルを使用できる戦闘（スキルUI表示中）でのみ表示する。
    //   スキルが未選択の場合は enemyStats.activeSkillId が空になるため、ここで判定する。
    const skillId = stats?.activeSkillId ?? getEquippedActiveSkills()?.[0];
    if (!skillId) return;

    cooldownSpeedPopup = {
        text: `x${Number(multiplier).toFixed(1)}`,
        timer: 0,
        duration: 150
    };
}

function drawCooldownSpeedPopup(ctx, canvas, deltaTime = 1 / 60) {

    if (!cooldownSpeedPopup) return;

    const popup = cooldownSpeedPopup;
    // ★deltaTimeベースでリフレッシュレート非依存に
    popup.timer += deltaTime * 60;

    const progress = popup.timer / popup.duration;

    if (progress >= 1) {
        cooldownSpeedPopup = null;
        return;
    }

    // アクティブスキルUIと同じ基準で位置を計算
    const chainUI = document.getElementById("chainUI");
    if (!chainUI) return;

    const rect = stageRect(chainUI);
    const canvasRect = stageRect(canvas);

    const size = 36;
    const OFFSET_X = 22;
    const OFFSET_Y = 5;

    const skillX = rect.right - canvasRect.left + OFFSET_X;
    const skillY = rect.top - canvasRect.top + OFFSET_Y;

    // スキルアイコンの右側に表示
    const baseX = skillX + size + 8;
    const centerY = skillY + size / 2;

    // フェードイン / フェードアウト
    const fadeInFrames = 8;
    const fadeOutFrames = 30;

    let alpha = 1;
    if (popup.timer < fadeInFrames) {
        alpha = popup.timer / fadeInFrames;
    } else if (popup.duration - popup.timer < fadeOutFrames) {
        alpha = (popup.duration - popup.timer) / fadeOutFrames;
    }

    alpha = Math.max(0, Math.min(1, alpha));

    // ゆっくり浮き上がる
    const riseOffset = progress * 8;

    ctx.save();
    ctx.globalAlpha = alpha;

    const labelText = "COOLDOWN";
    const valueText = popup.text;

    ctx.textBaseline = "middle";
    ctx.textAlign = "left";

    ctx.font = "bold 9px 'M PLUS Rounded 1c', sans-serif";
    const labelWidth = ctx.measureText(labelText).width;

    ctx.font = "bold 14px 'Noto Sans Mono', monospace";
    const valueWidth = ctx.measureText(valueText).width;

    const gap = 5;
    const padX = 8;
    const w = labelWidth + gap + valueWidth + padX * 2;
    const h = 20;

    const x = baseX;
    const y = centerY - h / 2 - riseOffset;

    // 背景
    roundRect(ctx, x, y, w, h, 6);
    ctx.fillStyle = "rgba(10, 16, 26, 0.78)";
    ctx.fill();

    ctx.strokeStyle = "rgba(143, 211, 255, 0.45)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // ラベル
    ctx.font = "bold 9px 'M PLUS Rounded 1c', sans-serif";
    ctx.fillStyle = "rgba(160, 200, 235, 0.85)";
    ctx.fillText(labelText, x + padX, centerY + 0.5 - riseOffset);

    // 倍率
    ctx.font = "bold 14px 'Noto Sans Mono', monospace";
    ctx.fillStyle = "#bfe3ff";
    ctx.fillText(valueText, x + padX + labelWidth + gap, centerY - riseOffset);

    ctx.restore();
}

export function renderActiveSkillUI(ctx, state, canvas, deltaTime = 1 / 60) {
    // ★フリーモードは専用設定のスキルを使用（クエストは従来どおり装備スキル）
    const skillId = state.enemyStats?.activeSkillId ?? getEquippedActiveSkills()?.[0];
    const skill = ACTIVE_SKILLS?.[skillId];
    if (!skill) return;

    const chainUI = document.getElementById("chainUI");
    if (!chainUI) return;

    const rect = stageRect(chainUI);
    const canvasRect = stageRect(canvas);

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
        size - 4,
        ready
    );

    ctx.restore();

    // ストック数字
    if (stock > 0) {
        drawSkillStockNumber(
            ctx,
            x + size - 2,
            y + size - 2,
            stock
        );
    }

    if (isMouseHoverRect(x, y, size, size)) {
        drawSkillTooltip(ctx, skill, x, y + size + 8);
    }

    // コンボで獲得したクールタイム短縮倍率のポップアップ
    // （スキルUI表示中＝装備中のみ描画される）
    drawCooldownSpeedPopup(ctx, canvas, deltaTime);
}

function drawSkillIconCircle(ctx, skill, x, y, size, ready) {
    ctx.save();

    if (!skill._img) {
        skill._img = images[skill.icon];
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
    const padding = 10;

    ctx.save();

    ctx.font = "12px 'M PLUS Rounded 1c', sans-serif";

    const desc = skill.desc ?? "";
    const descWidth = w - padding * 2;
    const lineHeight = 16;

    // 説明文を折り返す
    const lines = [];
    let line = "";

    for (const char of desc) {
        const testLine = line + char;

        if (ctx.measureText(testLine).width > descWidth) {
            lines.push(line);
            line = char;
        } else {
            line = testLine;
        }
    }

    if (line) {
        lines.push(line);
    }

    // 高さを自動計算
    const h = 38 + lines.length * lineHeight;

    roundRect(ctx, x, y, w, h, 10);

    ctx.fillStyle = "rgba(10,14,22,0.96)";
    ctx.fill();

    ctx.strokeStyle = "rgba(143,211,255,0.18)";
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    // スキル名
    ctx.font = "bold 14px 'M PLUS Rounded 1c', sans-serif";
    ctx.fillStyle = "#e7f3ff";
    ctx.fillText(skill.name, x + padding, y + 8);

    // 説明
    ctx.font = "12px 'M PLUS Rounded 1c', sans-serif";
    ctx.fillStyle = "rgba(220,235,255,0.7)";

    lines.forEach((text, i) => {
        ctx.fillText(
            text,
            x + padding,
            y + 30 + i * lineHeight
        );
    });

    ctx.restore();
}

// ===============================
// Active Skill Stock UI
// ===============================
function drawSkillStockNumber(ctx, x, y, stock) {
    ctx.save();

    // 少し左上へ寄せる（右下から呼ばれても見切れにくい）
    const offsetX = -2;
    const offsetY = -2;

    const cx = x + offsetX;
    const cy = y + offsetY;

    // stock数でサイズ微調整
    const text = String(stock);
    const radius = text.length >= 2 ? 10 : 8;

    // バッジ背景
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(8,12,18,0.92)";
    ctx.fill();

    // 枠線
    ctx.strokeStyle = "rgba(120,190,255,0.65)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 数字
    ctx.font = text.length >= 2
        ? "bold 9px 'M PLUS Rounded 1c', sans-serif"
        : "bold 11px 'M PLUS Rounded 1c', sans-serif";

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#d8ecff";
    ctx.fillText(text, cx, cy + 0.5);

    ctx.restore();
}

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

    const rect = stageRect(chainUI);
    const canvasRect = stageRect(canvas);

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
    ctx.font = "bold 9px 'M PLUS Rounded 1c', sans-serif";

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
    
    ctx.font = "bold 32px 'M PLUS Rounded 1c', sans-serif";
    ctx.fillText(stats.transitionMsg, cw / 2, ch / 2 - 10);

    // 次の目標を表示
    if (stats.nextPhaseGoal) {
        ctx.font = "16px 'Noto Sans Mono', monospace";
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
            x: STAGE_W * 0.5,      // ステージ中央
            y: STAGE_H - 80        // ステージ下端 - 80
        };
    }

    // transform スケール下では rect が表示サイズを返すためステージ座標へ変換
    const rect =
        stageRect(canvas);

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