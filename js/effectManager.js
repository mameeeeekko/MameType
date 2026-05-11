// effectManager.js
// ===========================================
// 低遅延オーディオ管理
// ===========================================

let audioCtx = null;
let masterGain = null;
let bgmGain = null;
let seGain = null;

let buffers = {};
let bgmSource = null;

let initialized = false;

// ===========================================
// AudioContext
// ===========================================

function getAudioContext() {

    if (!audioCtx) {

        audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        masterGain = audioCtx.createGain();
        bgmGain = audioCtx.createGain();
        seGain = audioCtx.createGain();

        masterGain.connect(audioCtx.destination);

        bgmGain.connect(masterGain);
        seGain.connect(masterGain);

        masterGain.gain.value = 1;
        bgmGain.gain.value = 0.8;
        seGain.gain.value = 0.7;
    }

    return audioCtx;
}

// ===========================================
// サウンドロード
// ===========================================

async function loadSound(name, url) {

    const ctx = getAudioContext();

    const res = await fetch(url);
    const arrayBuffer = await res.arrayBuffer();

    buffers[name] = await ctx.decodeAudioData(arrayBuffer);
}

// ===========================================
// 初期化（ユーザー操作後）
// ===========================================

export async function initAudio() {
    //console.log("initAudio called");
    if (initialized) return;

    const ctx = getAudioContext();
    //console.log("Audio state (before resume):", ctx.state);

    if (ctx.state === "suspended") {
        await ctx.resume();
       // console.log("Audio state (after resume):", ctx.state);
    }

    await Promise.all([
        loadSound("bgm1","./assets/sound/bgm1.mp3"),
        loadSound("bgm2","./assets/sound/bgm2.mp3"),
        loadSound("bgm3","./assets/sound/bgm3.mp3"),
        loadSound("kill1","./assets/sound/kill1.mp3"),
        loadSound("kill2","./assets/sound/kill2.mp3"),
        loadSound("kill3","./assets/sound/kill3.mp3"),
        loadSound("kill4","./assets/sound/kill4.mp3"),
        loadSound("kill5","./assets/sound/kill5.mp3"),
        loadSound("damage1","./assets/sound/damage1.mp3"),
        loadSound("bgm_enemy1","./assets/sound/bgm_enemy1.mp3"),
        loadSound("bgm_normal1","./assets/sound/bgm_normal1.mp3"),
    ]);

    // 初回再生遅延防止（ウォームアップ）
    playTone(440,0.001);

    initialized = true;
}

// ===========================================
// 効果音
// ===========================================
function playTone(freq, duration, type="sine", volume=0.4){
    // ガード
    if(!isFinite(freq)) return;
    if(!isFinite(duration)) return;
    if(!isFinite(volume)) return;

    if(freq <= 0) return;
    if(duration <= 0) return;

    const ctx = getAudioContext();

    if (ctx.state !== "running") {
        ctx.resume();
    }

    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    // エンベロープ（超重要）
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain).connect(seGain);

    osc.start();
    osc.stop(ctx.currentTime + duration);

    osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
    };
}

function playNoise(duration = 0.1, volume = 0.3) {
    const ctx = getAudioContext();

    if (ctx.state !== "running") {
        ctx.resume();
    }

    const now = ctx.currentTime;

    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(5000, now);

    noise.connect(filter).connect(gain).connect(seGain);

    noise.start();
    noise.stop(ctx.currentTime+ duration);
}

export function playSE(name, volume = 0.5, playbackRate = 1) {

    const ctx = getAudioContext();

    if (ctx.state !== "running") {
        ctx.resume();
    }

    const buffer = buffers[name];
    if (!buffer) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // ピッチ変更（テクノ感・弾け感に効く）
    source.playbackRate.value = playbackRate;

    const gain = ctx.createGain();
    gain.gain.value = volume;

    source.connect(gain).connect(seGain);

    source.start();

    // メモリ解放（地味に重要）
    source.onended = () => {
        source.disconnect();
        gain.disconnect();
    };
}

export function playTypeSound() {
    const freq = 680 + Math.random() * 40; // 微揺れ

    playTone(freq, 0.06, "triangle", 0.4);
}

export function playMissSound() {
    playNoise(0.08, 0.25);
}

export function playEnemyKillSound(type=1){
    if(type===1) playSE("kill1",0.35);
    if(type===2) playSE("kill2",0.35);
    if(type===3) playSE("kill3",0.35);
    if(type===4) playSE("kill4",0.35);
    if(type===5) playSE("kill5",0.35);
}


export function playDamageSound(){
    playSE("damage1",0.4);
}

// ===========================================
// BGM
// ===========================================

export function playBGM(name="bgm1", volume=0.4){

    const ctx = getAudioContext();

    if (ctx.state !== "running") {
        ctx.resume();
    }

    const buffer = buffers[name];

    if(!buffer) return;

    stopBGM();

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const gain = ctx.createGain();
    gain.gain.value = volume;

    source.connect(gain).connect(bgmGain);

    source.start();

    bgmSource = source;
}

export function stopBGM(){

    if(bgmSource){
        try{ bgmSource.stop(); }catch{}
        bgmSource = null;
    }

}

// ===========================================
// ミスフラッシュ
// ===========================================

export function flashMiss(){

    const body = document.body;
    if(!body) return;

    body.classList.remove("flash-miss");
    void body.offsetWidth;
    body.classList.add("flash-miss");

}

// ===============================
// プレイヤーエフェクト
// ===============================

export const hitWaveEffects = [];

export function spawnHitWave(x, y){

    hitWaveEffects.push({
        x,
        y,
        radius: 10,
        life: 30,
        maxLife: 30
    });

}

export function renderHitWaveEffects(ctx){

    for(let i = hitWaveEffects.length - 1; i >= 0; i--){

        const e = hitWaveEffects[i];

        e.life--;
        e.radius += 6;

        const t = Math.max(e.life / e.maxLife, 0);

        ctx.save();

        // 外側リング
        ctx.globalAlpha = t;
        ctx.strokeStyle = "rgba(255,255,255,1)";
        ctx.lineWidth = 3;

        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
        ctx.stroke();

        // 内側の光（これが重要）
        ctx.globalAlpha = t * 0.5;
        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius * 0.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        if(e.life <= 0){
            hitWaveEffects.splice(i, 1);
        }
    }
}

// ===============================
// 敵エフェクト
// ===============================
// 消滅時
let particles = [];

export function spawnEnemyEffect(x, y) {

    for (let i = 0; i < 12; i++) {

        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 5,
            vy: (Math.random() - 0.5) * 5,
            life: 30
        });
    }
}

export function renderEnemyEffects(ctx) {

    particles = particles.filter(p => p.life > 0);

    for (const p of particles) {

        p.x += p.vx;
        p.y += p.vy;
        p.life--;

        ctx.globalAlpha = p.life / 30;

        ctx.fillStyle = "orange";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();

    }
    ctx.globalAlpha = 1;
}

// ノックバック時
export const knockbackEffects = [];

export function spawnKnockbackEffect(x, y){

    for(let i = 0; i < 8; i++){

        const angle = (Math.PI * 2 / 8) * i;

        knockbackEffects.push({
            x,
            y,
            vx: Math.cos(angle) * 3,
            vy: Math.sin(angle) * 3,
            life: 20
        });
    }
}

export function renderKnockbackEffects(ctx){

    for(let i = knockbackEffects.length - 1; i >= 0; i--){

        const e = knockbackEffects[i];

        e.x += e.vx;
        e.y += e.vy;
        e.life--;

        const alpha = e.life / 20;

        ctx.save();

        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#ffffff";

        ctx.beginPath();
        ctx.arc(e.x, e.y, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        if(e.life <= 0){
            knockbackEffects.splice(i,1);
        }
    }
}

// ===============================
// ロックオンエフェクト
// ===============================
const lockOnEffects = [];

export function spawnLockOnEffect(enemy) {
    const size = 80; // 初期サイズ
    lockOnEffects.push({
        target: enemy,
        x: enemy.x,
        y: enemy.y,
        size: size,
        angle: 0,
        life: 30,
        maxLife: 30
    });
}

export function renderLockOnEffects(ctx) {
    for (let i = lockOnEffects.length - 1; i >= 0; i--) {
        const e = lockOnEffects[i];

        e.life--;
        const t = e.life / e.maxLife;

        // 角度回転
        e.angle += 0.1;

        // サイズ縮小
        const size = e.size * t;

        ctx.save();

        ctx.translate(e.target.x, e.target.y);
        ctx.rotate(e.angle);
        ctx.globalAlpha = t;

        ctx.strokeStyle = "#cbcbcb";
        ctx.lineWidth = 2;

        ctx.strokeRect(-size/2, -size/2, size, size);

        ctx.restore();

        if (e.life <= 0) {
            lockOnEffects.splice(i, 1);
        }
    }
}

// =====================
// プレイヤー→敵 弾エフェクト
// =====================
const shotEffects = [];

export function spawnShotEffect(sx, sy, tx, ty) {
    shotEffects.push({
        startX: sx,
        startY: sy,
        targetX: tx,
        targetY: ty,
        progress: 0,
        speed: 0.18
    });
}

export function renderShotEffects(ctx) {
    for (let i = shotEffects.length - 1; i >= 0; i--) {
        const s = shotEffects[i];

        s.progress += s.speed;

        if (s.progress >= 1) {
            shotEffects.splice(i, 1);
            continue;
        }

        const x =
            s.startX + (s.targetX - s.startX) * s.progress;
        const y =
            s.startY + (s.targetY - s.startY) * s.progress;

        // 少し後ろの位置（尾）
        const tailProgress = Math.max(0, s.progress - 0.08);
        const tailX =
            s.startX + (s.targetX - s.startX) * tailProgress;
        const tailY =
            s.startY + (s.targetY - s.startY) * tailProgress;

        ctx.save();

        // 尾
        const grad = ctx.createLinearGradient(
            tailX, tailY,
            x, y
        );
        grad.addColorStop(0, "rgba(255,190,90,0)");
        grad.addColorStop(1, "rgba(255,210,120,0.65)");

        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.lineCap = "round";

        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(x, y);
        ctx.stroke();

        // 本体
        ctx.fillStyle = "rgba(255,220,150,0.95)";
        ctx.shadowBlur = 6;
        ctx.shadowColor = "rgba(255,200,100,0.4)";

        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

// =====================
// 攻撃ヒットエフェクト（衝撃波）
// =====================
const hitEffects = [];

export function playHitEffect(x, y) {
    hitEffects.push({
        x,
        y,
        radius: 8,
        life: 12,
        maxLife: 12
    });
}

export function renderHitParticles(ctx) {
    for (let i = hitEffects.length - 1; i >= 0; i--) {
        const e = hitEffects[i];

        e.life--;
        e.radius += 2.5;

        const alpha = e.life / e.maxLife;

        ctx.save();
        ctx.globalAlpha = alpha;

        // 外側リング
        ctx.strokeStyle = "rgba(220, 220, 220, 0.9)";
        ctx.lineWidth = 3;

        ctx.shadowBlur = 7;
        ctx.shadowColor = "rgba(231, 231, 231, 0.4)";

        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
        ctx.stroke();

        // 内側の薄い光
        ctx.fillStyle = `rgba(255,210,90,${alpha * 0.1})`;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius * 0.55, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        if (e.life <= 0) {
            hitEffects.splice(i, 1);
        }
    }
}

// ===============================
// Chain Burst Effects
// ===============================
const chainBurstEffects = [];

export function spawnChainBurstEffect(x, y){
    chainBurstEffects.push({
        x,
        y,
        radius: 20,
        life: 30
    });
}

export function renderChainBurstEffects(ctx){

    for(let i = chainBurstEffects.length - 1; i >= 0; i--){

        const e = chainBurstEffects[i];

        e.life--;
        e.radius += 4;

        const alpha = e.life / 30;

        ctx.save();

        ctx.globalAlpha = alpha;
        ctx.strokeStyle = "#FFD700";
        ctx.lineWidth = 5;

        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();

        if(e.life <= 0){
            chainBurstEffects.splice(i,1);
        }
    }
}

// ===============================
// スコアポップアップ（敵倒した時）
// ===============================

let scorePopups = [];

export function spawnScorePopup(x, y, score, multiplier) {

    scorePopups.push({
        x,
        y,
        vy: -0.6,      // 上にふわっと
        life: 0,
        maxLife: 40,
        score,
        multiplier
    });
}

export function renderScorePopups(ctx) {

    for (const p of scorePopups) {

        p.life++;
        p.y += p.vy;

        const alpha = 1 - (p.life / p.maxLife);

        ctx.save();
        ctx.globalAlpha = alpha;

        // =====================
        // スコア本体
        // =====================
        ctx.font = "bold 20px monospace";
        ctx.textAlign = "center";

        ctx.fillStyle = "#323232";
        ctx.fillText("+" + p.score, p.x, p.y);

        // =====================
        // 倍率（1.0以外）
        // =====================
        if (p.multiplier > 1) {
            ctx.font = "bold 14px monospace";
            ctx.fillStyle = "#959595";
            ctx.fillText(
                `x${p.multiplier.toFixed(1)}`,
                p.x,
                p.y - 18
            );
        }
        ctx.restore();
    }
    // 生きてるやつだけ残す
    scorePopups = scorePopups.filter(p => p.life < p.maxLife);
}

// ===============================
// ダメージポップアップ（攻撃を受けた時）
// ===============================

let damagePopups = [];

export function spawnDamagePopup(x, y, damage) {
    damagePopups.push({
        x,
        y,
        value: damage,
        life: 40,        // フレーム数
        vy: -0.8,        // 上に浮かぶ
        alpha: 1
    });
}

export function renderDamagePopups(ctx) {

    for (let i = damagePopups.length - 1; i >= 0; i--) {
        const p = damagePopups[i];

        p.y += p.vy;
        p.life--;
        p.alpha -= 0.02;

        ctx.save();
        ctx.globalAlpha = p.alpha;

        ctx.font = "bold 20px monospace";
        ctx.fillStyle = "#ff4d4d"; // 🔥赤ダメージ

        ctx.textAlign = "center";
        ctx.fillText(`-${p.value}`, p.x, p.y);

        ctx.restore();

        if (p.life <= 0) {
            damagePopups.splice(i, 1);
        }
    }
}