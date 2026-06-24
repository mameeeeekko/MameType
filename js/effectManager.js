// effectManager.js
// ===========================================
// 低遅延オーディオ管理
// ===========================================
let audioCtx = null;
let masterGain = null;
let delayNode = null;
let feedbackGain = null;
let echoGain = null;
export let bgmGain = null; // Exported
export let seGain = null;  // Exported
export let typeGain = null; // Exported
export let missGain = null; // Exported

const laserEffects = [];
const playerDamageEffects = [];
const playerNegateEffects = [];
let buffers = {};
let bgmSource = null;

let initialized = false;

const volumes = {
    bgm: 0.5,
    se: 0.5,
    type: 0.5,
    miss: 0.5
};

export function setBgmVolume(v) {
    volumes.bgm = v;
    if (bgmGain && audioCtx) {
        bgmGain.gain.setTargetAtTime(v, audioCtx.currentTime, 0.01);
    }
}

export function setSeVolume(v) {
    volumes.se = v;
    if (seGain && audioCtx) {
        seGain.gain.setTargetAtTime(v, audioCtx.currentTime, 0.01);
    }
}

export function setTypeVolume(v) {
    volumes.type = v;
    if (typeGain && audioCtx) {
        typeGain.gain.setTargetAtTime(v, audioCtx.currentTime, 0.01);
    }
}

export function setMissVolume(v) {
    volumes.miss = v;
    if (missGain && audioCtx) {
        missGain.gain.setTargetAtTime(v, audioCtx.currentTime, 0.01);
    }
}

let masterVolume = 1;

// 全体の音量を設定（ミュート用）
export function setMasterVolume(v) {
    masterVolume = v;
    if (masterGain && audioCtx) {
        masterGain.gain.setTargetAtTime(v, audioCtx.currentTime, 0.01);
    }
}

// ===========================================
// AudioContext
// ===========================================

function getAudioContext() {

    if (!audioCtx) {

        audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        masterGain = audioCtx.createGain();
        bgmGain = audioCtx.createGain();
        seGain = audioCtx.createGain();
        typeGain = audioCtx.createGain();
        missGain = audioCtx.createGain();

        delayNode = audioCtx.createDelay();
        feedbackGain = audioCtx.createGain();
        echoGain = audioCtx.createGain();

        masterGain.connect(audioCtx.destination);

        bgmGain.connect(masterGain);
        seGain.connect(masterGain);
        typeGain.connect(masterGain);
        missGain.connect(masterGain);

        delayNode.delayTime.value = 0.08;
        feedbackGain.gain.value = 0.18;
        echoGain.gain.value = 0.25;

        // フィードバックループ
        delayNode.connect(feedbackGain);
        feedbackGain.connect(delayNode);

        // 出力
        delayNode.connect(echoGain);
        echoGain.connect(masterGain);

        masterGain.gain.value = masterVolume;
        bgmGain.gain.value = volumes.bgm;
        seGain.gain.value = volumes.se;
        typeGain.gain.value = volumes.type;
        missGain.gain.value = volumes.miss;
    }

    return audioCtx;
}

// ===========================================
// サウンドロード
// ===========================================

export async function loadSound(name, url) {

    const ctx = getAudioContext();

    const res = await fetch(url);
    const arrayBuffer = await res.arrayBuffer();

    buffers[name] = await ctx.decodeAudioData(arrayBuffer);
}

// ===========================================
// 初期化（ユーザー操作後）
// ===========================================

export async function initAudio() {
    if (initialized) return;

    const ctx = getAudioContext();

    if (ctx.state === "suspended") {
        await ctx.resume();
    }

    // 初回再生遅延防止（ウォームアップ）
    playTone(440,0.001);

    initialized = true;
}

// ===========================================
// 効果音
// ===========================================
export function playTone(freq, duration, type="sine", volume=0.4, targetGainNode=null){ // targetGainNode is now the actual node
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

    osc.connect(gain).connect(targetGainNode || seGain); // Connect to the determined destinationNode

    osc.start();
    osc.stop(ctx.currentTime + duration);

    osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
    };
}

function playNoise(duration = 0.1, volume = 0.3, target = null) {
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

    noise.connect(filter).connect(gain).connect(target || seGain);

    noise.start();
    noise.stop(ctx.currentTime+ duration);
}

// SEを流す関数
export function playSE(
    name,
    volume = 0.5,
    playbackRate = 1, //再生速度
    startOffset = 0,  //開始位置sec
    duration = null   //再生時間sec
) {
    const ctx = getAudioContext();

    const buffer = buffers[name];
    if (!buffer) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = playbackRate;

    const gain = ctx.createGain();
    gain.gain.value = volume;

    source.connect(gain).connect(seGain);

    if (duration != null) {
        source.start(0, startOffset, duration);
    } else {
        source.start(0, startOffset);
    }
}

export function playTypeSound() {

    const freq = 680 + Math.random() * 40;

    const ctx = getAudioContext();

    playTone(
        freq,
        0.06,
        "triangle",
        0.35,
        typeGain
    );

    // 倍音
    playTone(
        freq * 2,
        0.03,
        "sine",
        0.08,
        typeGain
    );

    // エコー
    const g = ctx.createGain();
    g.gain.value = 0.15;

    const osc = ctx.createOscillator();

    osc.type = "triangle";
    osc.frequency.value = freq;

    osc.connect(g);
    g.connect(delayNode);

    osc.start();
    osc.stop(ctx.currentTime + 0.05);
}

export function playMissSound() {
    getAudioContext();
    playNoise(0.08, 0.25, missGain);
}

/**
 * ボリューム調整用のテスト音を再生する
 * @param {string} key 'bgm', 'type', 'miss', 'se'
 * @param {object} settings 現在のサウンド設定 (soundSettings)
 */
export function playTestSound(key, settings) {
    switch (key) {
        case 'bgm':
            if (settings.bgm) playTone(330, 0.2, 'sine', 0.5, bgmGain);
            break;
        case 'type':
            if (settings.type) playTypeSound();
            break;
        case 'miss':
            if (settings.miss) playMissSound();
            break;
        case 'se':
            if (settings.soundeffect) playTone(440, 0.1, 'sine', 0.5, seGain);
            break;
    }
}

export function playEnemyKillSound(type=1){
    if(type===1){
        playSE("kill1",0.35);

        setTimeout(()=>{
            playSE("kill1",0.12);
        },80);
    }
    if(type===2) playSE("kill2",0.35);
    if(type===3) playSE("kill3",0.35);
    if(type===4) playSE("killLaser",0.35);
    if(type===5) playSE("kill5",0.35);
    if(type===6) playSE("killBullet",0.35,1,0,1);
    if(type===7) playSE("killItem",0.35,1,0,1);
}


export function playDamageSound(){
    playSE("damage1",0.4);
}

export function playErrorSound(){
    playSE("error1",0.6, 1, 0, 1);
}

export function playPhaseWarningSound() {

    // G4
    playTone(
        392,
        0.25,
        "triangle",
        0.25
    );

    // C5
    setTimeout(() => {
        playTone(
            523,
            0.30,
            "triangle",
            0.25
        );
    }, 250);

    // G5
    setTimeout(() => {
        playTone(
            784,
            1.2,
            "sine",
            0.35
        );
    }, 600);
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

    // 従来の flash-miss クラスは画面全体が急激に変化するため刺激が強い場合があります。
    // 代わりに、画面の縁を薄く赤く光らせる「ビネット効果」を JS で制御してマイルドにします。
    let overlay = document.getElementById("miss-flash-overlay");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "miss-flash-overlay";
        // 中心は透明、外側に向かって非常に薄い赤 (15%不透明度) になるグラデーション
        overlay.style.cssText = `
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            pointer-events: none;
            z-index: 10000;
            background: radial-gradient(circle, rgba(255, 0, 0, 0) 60%, rgba(255, 0, 0, 0.3) 100%);
            opacity: 0;
        `;
        document.body.appendChild(overlay);
    }

    // アニメーションのリセット
    overlay.style.transition = "none";
    overlay.style.opacity = "1";
    overlay.offsetHeight; // リフローを強制してアニメーションを最初から実行

    // 0.5秒かけてゆっくり消えるように設定
    overlay.style.transition = "opacity 0.5s ease-out";
    overlay.style.opacity = "0";

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

export function spawnLaserEffect(sx, sy, tx, ty, options = {}) {
    laserEffects.push({
        sx, sy, tx, ty,
        life: 40,
        maxLife: 40,
        ...options
    });
}

export function spawnPlayerDamageEffect(x, y) {

    const effect = {
        x,
        y,
        life: 40,
        maxLife: 40,
        particles: []
    };

    for (let i = 0; i < 25; i++) {

        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 5;

        effect.particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 20 + Math.random() * 15,
            maxLife: 20 + Math.random() * 15,
            radius: 1 + Math.random() * 2
        });
    }

    playerDamageEffects.push(effect);
}

export function spawnPlayerNegateEffect(
    x,
    y,
    value = "GUARD",
    color = "#9befff"
) {

    const effect = {
        x,
        y,
        value,
        color,
        life: 40,
        maxLife: 40,
        particles: []
    };

    for (let i = 0; i < 25; i++) {

        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 5;

        effect.particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 20 + Math.random() * 15,
            maxLife: 20 + Math.random() * 15,
            radius: 1 + Math.random() * 2
        });
    }

    playerNegateEffects.push(effect);
}

// ===============================
// 敵attackのレーザーの描出および、ガード演出
// ===============================
export function renderLaserEffects(ctx) {
    for (let i = laserEffects.length - 1; i >= 0; i--) {
        const e = laserEffects[i];
        e.life--;
        const t = e.life / e.maxLife;
        const alpha = Math.sin(t * Math.PI); // フェードイン・アウト
        
        // ★防御成功時はレーザーの終点をバリア位置に補正
        let endX = e.tx;
        let endY = e.ty;
        const barrierRadius = 30 + (1 - t) * 20;
        if (e.diffused) {
            const angle = Math.atan2(e.ty - e.sy, e.tx - e.sx);
            endX = e.tx - Math.cos(angle) * barrierRadius;
            endY = e.ty - Math.sin(angle) * barrierRadius;
        }

        ctx.save();
        ctx.globalAlpha = alpha;

        // ★レーザーの色を赤系に統一
        const laserColor = "#ff4d4d";
        ctx.shadowColor = laserColor;

        // 外側のグロー
        ctx.lineWidth = 10;
        ctx.strokeStyle = `rgba(255, 77, 77, ${alpha * 0.3})`;
        ctx.shadowBlur = 20;
        
        ctx.beginPath();
        ctx.moveTo(e.sx, e.sy);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // 外側のグロー
        ctx.lineWidth = 10;
        ctx.strokeStyle = `rgba(255, 77, 77, ${alpha * 0.3})`;
        ctx.shadowBlur = 20;

        if (e.diffused) {
            const barrierColor = "#44ccff";
            
            ctx.strokeStyle = barrierColor;
            ctx.lineWidth = 3;
            ctx.shadowColor = barrierColor;
            ctx.shadowBlur = 15;

            // 六角形を描画
            const rings = 3;

            for (let r = 0; r < rings; r++) {

                const radius =
                    barrierRadius * (1 + r * 0.25);

                ctx.beginPath();

                for (let j = 0; j < 6; j++) {

                    const angle =
                        (Math.PI / 3) * j;

                    const x =
                        e.tx +
                        radius * Math.cos(angle);

                    const y =
                        e.ty +
                        radius * Math.sin(angle);

                    if (j === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }

                ctx.closePath();

                ctx.strokeStyle =
                    `rgba(68,204,255,${
                        0.8 - r * 0.2
                    })`;

                ctx.lineWidth =
                    3 - r * 0.5;

                ctx.stroke();
            }

            // GUARD文字
            ctx.save();

            ctx.globalAlpha = alpha * 0.9;

            ctx.font = "bold 14px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            ctx.fillStyle = "rgba(255,255,255,0.95)";
            ctx.shadowColor = "#88ddff";
            ctx.shadowBlur = 8;

            ctx.fillText(
                "GUARD",
                e.tx,
                e.ty
            );

            ctx.restore();

            // 拡散パーティクルを強化
            const sparkCount = Math.floor(15 * (e.completionRatio || 0));
            const baseAngle = Math.atan2(e.sy - e.ty, e.sx - e.tx);
            for (let j = 0; j < sparkCount; j++) { // ★拡散パーティクルの色をレーザー色に変更
                const sa = baseAngle + (Math.random() - 0.5) * 2.5;
                const dist = 40 + (1 - t) * 150; // より遠くへ
                ctx.fillStyle = laserColor;
                ctx.beginPath();
                ctx.arc(e.tx + Math.cos(sa) * dist, e.ty + Math.sin(sa) * dist, 3, 0, Math.PI * 2); // 少し大きく
                ctx.fill();
            }
        }
        ctx.restore();
        if (e.life <= 0) laserEffects.splice(i, 1);
    }
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


export function renderPlayerDamageEffects(ctx) {
    for (let i = playerDamageEffects.length - 1; i >= 0; i--) {
        const e = playerDamageEffects[i];
        e.life--;
        const t = 1 - (e.life / e.maxLife); // 0 -> 1
        const alpha = Math.sin((1 - t) * Math.PI); // フェードアウト

        // 💥 パーティクル描画
        e.particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.life--;
            const pAlpha = p.life / p.maxLife;
            ctx.save();
            ctx.globalAlpha = pAlpha;
            ctx.fillStyle = "#ff6b6b";
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });

        // 💥 中央の閃光 (白 -> 黄 -> 赤)
        const flashRadius = 60 * Math.sin(t * Math.PI * 0.5);
        const grad = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, flashRadius);
        grad.addColorStop(0, `rgba(255, 255, 220, ${alpha * 0.9})`);
        grad.addColorStop(0.5, `rgba(255, 180, 80, ${alpha * 0.6})`);
        grad.addColorStop(1, `rgba(255, 80, 80, 0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(e.x - flashRadius, e.y - flashRadius, flashRadius * 2, flashRadius * 2);

        // 💥 衝撃波 (外側に広がるリング)
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "rgba(255, 0, 0, 0.3)";
        ctx.beginPath();
        ctx.arc(e.x, e.y, 40 * (1 - alpha), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 衝撃波
        ctx.strokeStyle = `rgba(255, 100, 100, ${alpha})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 20 + 80 * t, 0, Math.PI * 2);
        ctx.stroke();

        if (e.life <= 0) {
            playerDamageEffects.splice(i, 1);
        }
    }
}

export function renderPlayerNegateEffects(ctx) {
    for (let i = playerNegateEffects.length - 1; i >= 0; i--) {

        const e = playerNegateEffects[i];

        e.life--;

        // 寿命切れなら削除
        if (e.life <= 0) {
            playerNegateEffects.splice(i, 1);
            continue;
        }

        // 安全対策
        const maxLife = Math.max(1, e.maxLife || 1);

        const t =
            Math.min(
                1,
                Math.max(
                    0,
                    1 - (e.life / maxLife)
                )
            );

        const alpha = Math.sin((1 - t) * Math.PI);

        // 💥 パーティクル描画
        e.particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.life--;
            const pAlpha = p.life / p.maxLife;
            ctx.save();
            ctx.globalAlpha = pAlpha;
            ctx.fillStyle = "#45bffc";
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });

        // 💥 中央の閃光 (白 -> 黄 -> 赤)
        const flashRadius = Math.max(
            0.1,
            60 * Math.sin(t * Math.PI * 0.5)
        );

        const grad = ctx.createRadialGradient(
            e.x,
            e.y,
            0,
            e.x,
            e.y,
            flashRadius
        );
        grad.addColorStop(0, `rgba(255, 255, 220, ${alpha * 0.9})`);
        grad.addColorStop(0.5,`rgba(120,220,255,${alpha * 0.6})`);
        grad.addColorStop(1,`rgba(80, 179, 255, 0.06)`);
        ctx.fillStyle = grad;
        ctx.fillRect(e.x - flashRadius, e.y - flashRadius, flashRadius * 2, flashRadius * 2);

        // =====================================
        // ATフィールド風シールド
        // =====================================

        const shieldPulse = Math.sin(t * Math.PI);
        const shieldAlpha = alpha * 0.4;

        // 外側グロー
        ctx.save();
        ctx.globalAlpha = shieldAlpha * 0.25;

        const glowGrad = ctx.createRadialGradient(
            e.x, e.y, 20,
            e.x, e.y, 90
        );

        glowGrad.addColorStop(0, "rgba(120,220,255,0.6)");
        glowGrad.addColorStop(1, "rgba(120,220,255,0)");

        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 90, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();


        // =====================================
        // 六角形シールド（3重）
        // =====================================

        [55, 68, 82].forEach((baseRadius, index) => {

            const radius =
                baseRadius +
                Math.sin(t * 12 + index) * 2;

            ctx.save();

            ctx.globalAlpha =
                shieldAlpha * (1 - index * 0.2);

            ctx.strokeStyle = "#8df0ff";
            ctx.lineWidth = index === 0 ? 3 : 1.5;

            ctx.beginPath();

            for (let k = 0; k < 6; k++) {

                const angle =
                    -Math.PI / 2 +
                    (Math.PI * 2 / 6) * k;

                const px =
                    e.x +
                    Math.cos(angle) * radius;

                const py =
                    e.y +
                    Math.sin(angle) * radius;

                if (k === 0) {
                    ctx.moveTo(px, py);
                } else {
                    ctx.lineTo(px, py);
                }
            }

            ctx.closePath();
            ctx.stroke();

            ctx.restore();
        });


        // =====================================
        // シールド内部
        // =====================================

        ctx.save();

        ctx.globalAlpha =
            0.08 + shieldPulse * 0.08;

        ctx.fillStyle = "#5dd7ff";

        ctx.beginPath();

        for (let k = 0; k < 6; k++) {

            const angle =
                -Math.PI / 2 +
                (Math.PI * 2 / 6) * k;

            const px =
                e.x +
                Math.cos(angle) * 55;

            const py =
                e.y +
                Math.sin(angle) * 55;

            if (k === 0) {
                ctx.moveTo(px, py);
            } else {
                ctx.lineTo(px, py);
            }
        }

        ctx.closePath();
        ctx.fill();

        ctx.restore();


        // =====================================
        // 六角形ライン
        // =====================================

        ctx.save();

        ctx.globalAlpha = shieldAlpha * 0.35;
        ctx.strokeStyle = "#d9ffff";
        ctx.lineWidth = 1;

        for (let r = 30; r <= 80; r += 15) {

            ctx.beginPath();

            for (let k = 0; k < 6; k++) {

                const angle =
                    -Math.PI / 2 +
                    (Math.PI * 2 / 6) * k;

                const px =
                    e.x +
                    Math.cos(angle) * r;

                const py =
                    e.y +
                    Math.sin(angle) * r;

                if (k === 0) {
                    ctx.moveTo(px, py);
                } else {
                    ctx.lineTo(px, py);
                }
            }

            ctx.closePath();
            ctx.stroke();
        }

        ctx.restore();

        // 💥 衝撃波 (外側に広がるリング)
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "rgba(80, 179, 255, 0.57)";
        ctx.beginPath();
        ctx.arc(e.x, e.y, 40 * (1 - alpha), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 衝撃波
        ctx.strokeStyle = `rgba(120,220,255,${alpha})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 20 + 80 * t, 0, Math.PI * 2);
        ctx.stroke();

        // =====================================
        // GUARD文字
        // =====================================

        ctx.save();

        ctx.globalAlpha = alpha;

        const textY = e.y - 45 - (1 - alpha) * 15;

        ctx.font = "bold 14px Arial";
        ctx.textAlign = "center";

        ctx.fillStyle = "#9befff";
        ctx.fillText(
            e.value,
            e.x,
            textY
        );

        ctx.restore();
    }
}

// ===============================
// 敵エフェクト
// ===============================
let particles = [];

export function spawnEnemyEffect(x, y, effect = "enemy1") {

    // =====================================
    // 通常敵
    // =====================================
    if (effect === "enemy1") {

        for (let i = 0; i < 12; i++) {

            particles.push({
                type: "enemy1",

                x,
                y,

                vx: (Math.random() - 0.5) * 5,
                vy: (Math.random() - 0.5) * 5,

                radius: 3,
                life: 30,
                maxLife: 30
            });
        }
    }

    // =====================================
    // 弾破壊
    // =====================================
    else if (effect === "bullet") {

        // 火花
        for (let i = 0; i < 8; i++) {

            const angle =
                Math.random() * Math.PI * 2;

            const speed =
                1 + Math.random() * 2.5;

            particles.push({
                type: "bullet",

                x,
                y,

                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,

                radius: 2,
                life: 14,
                maxLife: 14
            });
        }

        // 波紋
        particles.push({
            type: "bullet_wave",

            x,
            y,

            radius: 4,
            maxRadius: 24,

            life: 12,
            maxLife: 12
        });
    }

    // =====================================
    // アイテム取得
    // =====================================
    else if (effect === "item1") {

        particles.push({
            type: "item1_wave",

            x,
            y,

            radius: 10,
            maxRadius: 80,

            // 表示速度感
            life: 20,
            maxLife: 20
        });
    }

    // =====================================
    // ボス撃破
    // =====================================
    else if (effect === "boss1") {

        // 中央爆発
        for (let i = 0; i < 24; i++) {

            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 5;

            particles.push({
                type: "boss1_particle",

                x,
                y,

                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,

                radius: 3 + Math.random() * 4,

                life: 40,
                maxLife: 40
            });
        }

        // 巨大波紋
        particles.push({
            type: "boss1_wave",

            x,
            y,

            radius: 15,
            maxRadius: 1400,

            life: 80,
            maxLife: 80
        });
    }
}

export function renderEnemyEffects(ctx) {

    particles = particles.filter(p => p.life > 0);

    for (const p of particles) {

        if (p.vx != null) p.x += p.vx;
        if (p.vy != null) p.y += p.vy;

        p.life--;

        const alpha = p.life / p.maxLife;

        ctx.save();

        ctx.globalAlpha = alpha;

        // =====================================
        // 通常敵
        // =====================================
        if (p.type === "enemy1") {

            ctx.fillStyle = "orange";

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
        }

        // =====================================
        // 弾破壊：火花
        // =====================================
        else if (p.type === "bullet") {

            ctx.fillStyle = "#a4a4a4";

            ctx.shadowBlur = 8;
            ctx.shadowColor = "#dbdbdb";

            ctx.beginPath();
            ctx.arc(
                p.x,
                p.y,
                p.radius,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }

        // =====================================
        // 弾破壊：波紋
        // =====================================
        else if (p.type === "bullet_wave") {

            const t =
                1 - (p.life / p.maxLife);

            const radius =
                p.radius +
                (p.maxRadius - p.radius) * t;

            ctx.save();

            ctx.globalAlpha = alpha;

            ctx.strokeStyle = "#d8d8d8";

            ctx.lineWidth =
                3 * alpha;

            ctx.shadowBlur = 12;
            ctx.shadowColor = "#8f8f8f";

            ctx.beginPath();
            ctx.arc(
                p.x,
                p.y,
                radius,
                0,
                Math.PI * 2
            );
            ctx.stroke();

            ctx.restore();
        }
        // =====================================
        // アイテム取得：灰色エネルギー
        // =====================================
        else if (p.type === "item1_wave") {

            const t =
                1 - (p.life / p.maxLife);

            let radius;

            // 前半：膨張
            if (t < 0.5) {

                const tt = t / 0.5;

                radius =
                    p.radius +
                    (p.maxRadius - p.radius)
                    * tt;

            }

            // 後半：収束
            else {

                const tt =
                    (t - 0.5) / 0.5;

                radius =
                    p.maxRadius *
                    (1 - tt);
            }

            ctx.save();

            // 少し濃く
            ctx.globalAlpha = alpha * 0.7;

            // グラデーション
            const grad =
                ctx.createRadialGradient(
                    p.x,
                    p.y,
                    radius * 0.15,

                    p.x,
                    p.y,
                    radius
                );

            grad.addColorStop(
                0,
                "rgba(255,255,255,0.9)"
            );

            grad.addColorStop(
                0.35,
                "rgba(220,220,220,0.75)"
            );

            grad.addColorStop(
                0.7,
                "rgba(170,170,170,0.45)"
            );

            grad.addColorStop(
                1,
                "rgba(120,120,120,0)"
            );

            ctx.fillStyle = grad;

            ctx.shadowBlur = 24;
            ctx.shadowColor = "#d0d0d0";

            ctx.beginPath();
            ctx.arc(
                p.x,
                p.y,
                radius,
                0,
                Math.PI * 2
            );
            ctx.fill();

            ctx.restore();
        }

        // =====================================
        // ボス撃破：爆発粒子
        // =====================================
        else if (p.type === "boss1_particle") {

            ctx.fillStyle = "#f89a42";

            ctx.shadowBlur = 20;
            ctx.shadowColor = "#ffb347";

            ctx.beginPath();
            ctx.arc(
                p.x,
                p.y,
                p.radius,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }

        // =====================================
        // ボス撃破：巨大波紋
        // =====================================
        else if (p.type === "boss1_wave") {

            const t =
                1 - (p.life / p.maxLife);

            const radius =
                p.radius +
                (p.maxRadius - p.radius) * t;

            ctx.save();

            ctx.globalAlpha = alpha;

            ctx.strokeStyle = "#ffddb6";

            ctx.lineWidth =
                18 * alpha;

            ctx.shadowBlur = 40;
            ctx.shadowColor = "#ffdfaedc";

            ctx.beginPath();
            ctx.arc(
                p.x,
                p.y,
                radius,
                0,
                Math.PI * 2
            );
            ctx.stroke();

            ctx.restore();
        }

        ctx.restore();
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
        ctx.fillStyle = "#b2b2b2";

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

// =====================
// 敵特殊攻撃使用エフェクト
// =====================
export function renderEnemyBehaviorEffect(
    ctx,
    enemy
){
    if(
        !enemy.behaviorEffect ||
        enemy.behaviorEffectTimer <= 0
    ){
        return;
    }

    const t = enemy.behaviorEffectTimer;

    const alpha =
        Math.sin(
            t * 20
        ) * 0.5 + 0.5;

    switch(enemy.behaviorEffect){

        case "shoot":
        case "attack":

            renderShootEffect(
                ctx,
                enemy,
                alpha
            );
            break;

        case "spawn":

            renderSpawnEffect(
                ctx,
                enemy,
                alpha
            );
            break;
    }
}

function renderShootEffect(
    ctx,
    enemy,
    alpha
){

    ctx.save();

    ctx.globalAlpha =
        alpha * 0.7;

    ctx.fillStyle =
        "#de5959";

    ctx.beginPath();

    ctx.arc(
        enemy.x,
        enemy.y,
        enemy.type.size + 6,
        0,
        Math.PI * 2
    );

    ctx.fill();

    ctx.restore();
}

function renderSpawnEffect(
    ctx,
    enemy,
    alpha
){

    ctx.save();

    ctx.globalAlpha =
        alpha * 0.6;

    ctx.strokeStyle =
        "#d1d5db";

    ctx.lineWidth = 4;

    ctx.beginPath();

    ctx.arc(
        enemy.x,
        enemy.y,
        enemy.type.size + 10,
        0,
        Math.PI * 2
    );

    ctx.stroke();

    ctx.restore();
}

// freeze中ずっと表示
export function renderFreezeAura(
    ctx,
    enemy
){

    if(
        !enemy.freezeTimer ||
        enemy.freezeTimer <= 0
    ){
        return;
    }

    const alpha =
        0.4 +
        Math.sin(
            performance.now() * 0.01
        ) * 0.2;

    const radius =
        enemy.type.size + 10;

    ctx.save();

    // 外周リング
    ctx.globalAlpha = alpha;

    ctx.strokeStyle = "#b8e6ff";
    ctx.lineWidth = 3;

    ctx.shadowBlur = 12;
    ctx.shadowColor = "#dff4ff";

    ctx.beginPath();
    ctx.arc(
        enemy.x,
        enemy.y,
        radius,
        0,
        Math.PI * 2
    );
    ctx.stroke();

    // 中央の薄い氷色
    ctx.globalAlpha =
        alpha * 0.12;

    ctx.fillStyle = "#d8f4ff";

    ctx.beginPath();
    ctx.arc(
        enemy.x,
        enemy.y,
        radius - 2,
        0,
        Math.PI * 2
    );
    ctx.fill();

    ctx.restore();
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

        // 白系に変更し、視認性向上のために軽い影を追加
        ctx.shadowBlur = 4;
        ctx.shadowColor = "rgba(0, 0, 0, 0.5)";

        ctx.fillStyle = "#f0f6fc";
        ctx.fillText("+" + p.score, p.x, p.y);

        // =====================
        // 倍率（1.0以外）
        // =====================
        if (p.multiplier > 1) {
            ctx.font = "bold 14px monospace";
            ctx.fillStyle = "#c9d1d9";
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

// ============================================
// Item / Skill Effects
// sourceごとに演出を分離
// ============================================
// 【構造】
// spawnItemSkillEffect({
//     category,
//     source,
//     level,
//     ...
// })
// ---------------------------------
// category : 演出カテゴリ
// ---------------------------------
// "kill" 敵撃破系演出
// "heal" 回復系演出
// "freeze" 凍結・拘束系演出
// "cooldown" クールダウン短縮系演出 itemのみ
// ---------------------------------
// source : 演出ソース
// ---------------------------------
// "item"
//   アイテム発動演出
//   粒子・霧・流線など
//   カジュアル寄り
// "skill"
//   スキル発動演出
//   HUD・レーザー・魔法陣など
//   メカ/高級感寄り
// ---------------------------------
// level : 演出強度
// ---------------------------------
// "small" 軽量・単発向け
// "medium" 通常
// "large" 大技・レア演出向け
// ---------------------------------
// 現在の演出一覧
// ---------------------------------
// [skill]
// kill
//   - 白HUDロック
//   - 上空レーザー
//   - 白インパクトリング
// heal - 回転魔法陣
// freeze - 六角拘束
// [item]
// kill - 爆散粒子
// heal - 泡粒子
// freeze - 氷霧
// cooldown - 流線HUD
// ================================================

const itemSkillEffects = [];

// ======================================
// Public
// ======================================

export function spawnItemSkillEffect(opts = {}) {

    const {
        category = "kill",
        source = "item",
        level = "small"
    } = opts;

    // sound
    playEffectSound(category, level, source);

    // source別
    if (source === "skill") {

        if (category === "kill") {
            spawnSkillKillEffect(opts);
        }

        else if (category === "heal") {
            spawnSkillHealEffect(opts);
        }

        else if (category === "freeze") {
            spawnSkillFreezeEffect(opts);
        }

        else if (category === "knockback") {
            spawnSkillKnockbackEffect(opts);
        }

        else if (category === "invincible") {
            spawnSkillInvincibleBarrier(opts);
        }

        else if (category === "revive") {
            spawnSkillReviveEffect(opts);
        }

    }

    // item
    else {

        if (category === "kill") {
            spawnItemKillEffect(opts);
        }

        else if (category === "heal") {
            spawnItemHealEffect(opts);
        }

        else if (category === "freeze") {
            spawnItemFreezeEffect(opts);
        }

        else if (category === "cooldown") {
            spawnItemCooldownEffect(opts);
        }
    }
}

// ======================================
// SOUND
// ======================================

export function playEffectSound(
    category,
    level,
    source
) {

    // kill
    if (category === "kill") {

        if (source === "skill") {

            playTone(
                level === "large" ? 120 : 180,
                0.12,
                "sawtooth",
                0.45
            );

            setTimeout(() => {
                playTone(
                    70,
                    0.08,
                    "square",
                    0.25
                );
            }, 40);
        }

        else {

            playSE(
                "kill3",
                level === "large" ? 0.65 : 0.45,
                level === "large" ? 0.7 : 1
            );
        }
    }

    // heal
    else if (category === "heal") {

        playTone(
            source === "skill" ? 740 : 620,
            0.18,
            "triangle",
            0.28
        );

        setTimeout(() => {
            playTone(
                source === "skill" ? 980 : 880,
                0.2,
                "sine",
                0.2
            );
        }, 60);
    }

    // freeze
    else if (category === "freeze") {

        playNoise(0.06, 0.15);

        setTimeout(() => {

            playTone(
                180,
                0.08,
                "square",
                0.15
            );

        }, 20);
    }

    // cooldown
    else if (category === "cooldown") {

        playTone(
            1200,
            0.05,
            "triangle",
            0.15
        );

        setTimeout(() => {
            playTone(
                1500,
                0.04,
                "triangle",
                0.12
            );
        }, 30);
    }
}

// ======================================
// SKILL : KILL
// 白HUDレーザー
// ======================================

function spawnSkillKillEffect({
    targets = [],
    level = "small"
}) {

    const laserCount =
        level === "small" ? 1 :
        level === "medium" ? 3 :
        6;

    for (const t of targets) {

        // lock
        itemSkillEffects.push({
            type: "skill_kill_lock",
            x: t.x,
            y: t.y,
            radius:
                level === "large" ? 90 : 60,
            angle: 0,
            life: 18,
            maxLife: 18
        });

        // laser
        for (let i = 0; i < laserCount; i++) {

            itemSkillEffects.push({

                type: "skill_kill_laser",

                sx:
                    t.x +
                    (Math.random() - 0.5) * 500,

                sy:
                    -200 -
                    Math.random() * 400,

                tx: t.x,
                ty: t.y,

                width:
                    level === "large" ? 7 : 4,

                life: 10,
                maxLife: 10
            });
        }

        // impact
        itemSkillEffects.push({
            type: "skill_kill_impact",
            x: t.x,
            y: t.y,
            radius:
                level === "large" ? 90 : 50,
            life: 16,
            maxLife: 16
        });
    }
}

// ======================================
// ITEM : KILL
// 崩壊爆散
// ======================================

function spawnItemKillEffect({
    targets = [],
    level = "small"
}) {

    const count =
        level === "small" ? 12 :
        level === "medium" ? 24 :
        48;

    for (const t of targets) {

        for (let i = 0; i < count; i++) {

            const angle =
                Math.random() * Math.PI * 2;

            const speed =
                1 + Math.random() * 7;

            itemSkillEffects.push({

                type: "item_kill_particle",

                x: t.x,
                y: t.y,

                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,

                radius:
                    2 + Math.random() * 4,

                life: 30,
                maxLife: 30
            });
        }
    }
}

// ======================================
// SKILL : HEAL
// 魔法陣
// ======================================

function spawnSkillHealEffect({
    x,
    y,
    level = "small"
}) {

    itemSkillEffects.push({

        type: "skill_heal_circle",

        x,
        y,

        radius:
            level === "large" ? 180 : 120,

        angle: 0,

        life: 40,
        maxLife: 40
    });
}

// ======================================
// ITEM : HEAL
// 泡・粒子
// ======================================

function spawnItemHealEffect({
    x,
    y,
    level = "small"
}) {

    const count =
        level === "small" ? 10 :
        level === "medium" ? 20 :
        40;

    for (let i = 0; i < count; i++) {

        const angle =
            Math.random() * Math.PI * 2;

        const speed =
            0.5 + Math.random() * 2;

        itemSkillEffects.push({

            type: "item_heal_particle",

            x,
            y,

            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 1.5,

            radius:
                3 + Math.random() * 5,

            life: 40,
            maxLife: 40
        });
    }
}

// ======================================
// SKILL : FREEZE
// 六角拘束
// ======================================

function spawnSkillFreezeEffect({
    targets = []
}) {

    for (const t of targets) {

        itemSkillEffects.push({

            type: "skill_freeze_hex",

            x: t.x,
            y: t.y,

            angle: 0,

            radius: 50,

            life: 30,
            maxLife: 30
        });
    }
}

// ======================================
// SKILL : KNOCKBACK
// 全周衝撃波
// ======================================

function spawnSkillKnockbackEffect({
    x,
    y
}){

    itemSkillEffects.push({

        type: "skill_knockback_wave",

        x,
        y,

        radius: 40,
        maxRadius: 500,

        life: 24,
        maxLife: 24
    });

    // 飛散粒子
    for(let i = 0; i < 32; i++){

        const angle =
            (Math.PI * 2 / 32) * i;

        itemSkillEffects.push({

            type: "skill_knockback_particle",

            x,
            y,

            vx: Math.cos(angle) * 8,
            vy: Math.sin(angle) * 8,

            life: 20,
            maxLife: 20
        });
    }
}

// ======================================
// SKILL : invincible
// barrier
// ======================================
function spawnSkillInvincibleBarrier({
    x,
    y,
    value = 5 // 秒
}) {
    const now = performance.now();

    itemSkillEffects.push({
        type: "skill_invincible_barrier",

        x,
        y,

        startTime: now,
        durationMs: value * 1000,
        endTime: now + value * 1000,

        radius: 85,

        angle: 0,
        particles: []
    });
}

// ======================================
// SKILL : REVIVE
// 十字架蘇生
// ======================================
function spawnSkillReviveEffect({
    x,
    y
}) {

    itemSkillEffects.push({

        type: "skill_revive_cross",

        x,
        y,

        radius: 120,

        angle: 0,

        life: 50,
        maxLife: 50
    });

    // 光粒子
    for(let i = 0; i < 40; i++){

        const angle =
            Math.random() * Math.PI * 2;

        const dist =
            Math.random() * 60;

        itemSkillEffects.push({

            type: "skill_revive_particle",

            x:
                x +
                Math.cos(angle) * dist,

            y:
                y +
                Math.sin(angle) * dist,

            vx:
                (Math.random() - 0.5) * 0.6,

            vy:
                -1 - Math.random() * 2,

            radius:
                2 + Math.random() * 3,

            life: 40,
            maxLife: 40
        });
    }
}

// ======================================
// ITEM : FREEZE
// 氷霧
// ======================================

function spawnItemFreezeEffect({
    targets = [],
    level = "small"
}) {

    const count =
        level === "small" ? 10 :
        level === "medium" ? 20 :
        40;

    for (const t of targets) {

        for (let i = 0; i < count; i++) {

            itemSkillEffects.push({

                type: "item_freeze_mist",

                x:
                    t.x +
                    (Math.random() - 0.5) * 80,

                y:
                    t.y +
                    (Math.random() - 0.5) * 80,

                radius:
                    8 + Math.random() * 12,

                life: 30,
                maxLife: 30
            });
        }
    }
}


// ======================================
// ITEM : COOLDOWN
// 流線
// ======================================

function spawnItemCooldownEffect({
    uiX,
    uiY,
    level = "small"
}) {

    const count =
        level === "small" ? 8 :
        level === "medium" ? 16 :
        28;

    for (let i = 0; i < count; i++) {

        itemSkillEffects.push({

            type: "item_cooldown_line",

            x: uiX - 40,
            y:
                uiY +
                (Math.random() - 0.5) * 40,

            vx:
                8 + Math.random() * 8,

            life: 14,
            maxLife: 14
        });
    }
}

// ======================================
// RENDER
// ======================================

export function renderItemSkillEffects(ctx) {

    for (
        let i = itemSkillEffects.length - 1;
        i >= 0;
        i--
    ) {

        const e = itemSkillEffects[i];

        e.life--;

        const alpha =
            e.life / e.maxLife;

        ctx.save();

        ctx.globalAlpha = alpha;

        // ======================================
        // Skill Kill Laser
        // ======================================
        if (e.type === "skill_kill_laser") {

            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = e.width;

            ctx.shadowBlur = 25;
            ctx.shadowColor = "#ffffff";

            ctx.beginPath();
            ctx.moveTo(e.sx, e.sy);
            ctx.lineTo(e.tx, e.ty);
            ctx.stroke();
        }

        // ======================================
        // Skill Kill Lock
        // ======================================
        else if (e.type === "skill_kill_lock") {

            e.angle += 0.15;

            ctx.translate(e.x, e.y);
            ctx.rotate(e.angle);

            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 2;

            ctx.strokeRect(
                -e.radius / 2,
                -e.radius / 2,
                e.radius,
                e.radius
            );
        }

        // ======================================
        // Skill Kill Impact
        // ======================================
        else if (e.type === "skill_kill_impact") {

            const r =
                e.radius *
                (1 - alpha);

            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 8 * alpha;

            ctx.beginPath();
            ctx.arc(
                e.x,
                e.y,
                r,
                0,
                Math.PI * 2
            );
            ctx.stroke();
        }

        // ======================================
        // Item Kill Particle
        // ======================================
        else if (e.type === "item_kill_particle") {

            e.x += e.vx;
            e.y += e.vy;

            ctx.fillStyle = "#ffb347";

            ctx.beginPath();
            ctx.arc(
                e.x,
                e.y,
                e.radius,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }

        // ======================================
        // Skill Heal Circle
        // ======================================
        else if (e.type === "skill_heal_circle") {

            e.angle += 0.05;

            ctx.translate(e.x, e.y);
            ctx.rotate(e.angle);

            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 4;

            ctx.beginPath();
            ctx.arc(
                0,
                0,
                e.radius,
                0,
                Math.PI * 2
            );
            ctx.stroke();

            ctx.strokeRect(
                -e.radius * 0.5,
                -e.radius * 0.5,
                e.radius,
                e.radius
            );
        }

        // ======================================
        // Item Heal Particle
        // ======================================
        else if (e.type === "item_heal_particle") {

            e.x += e.vx;
            e.y += e.vy;

            ctx.fillStyle = "#79ff93";

            ctx.beginPath();
            ctx.arc(
                e.x,
                e.y,
                e.radius,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }

        // ======================================
        // Skill Freeze Hex
        // ======================================
        else if (e.type === "skill_freeze_hex") {

            e.angle += 0.05;

            ctx.translate(e.x, e.y);
            ctx.rotate(e.angle);

            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 2;

            ctx.beginPath();

            for (let j = 0; j < 6; j++) {

                const a =
                    (Math.PI * 2 / 6) * j;

                const px =
                    Math.cos(a) * e.radius;

                const py =
                    Math.sin(a) * e.radius;

                if (j === 0) {
                    ctx.moveTo(px, py);
                } else {
                    ctx.lineTo(px, py);
                }
            }

            ctx.closePath();
            ctx.stroke();
        }

        // ======================================
        // Item Freeze Mist
        // ======================================
        else if (e.type === "item_freeze_mist") {

            ctx.fillStyle =
                "rgba(180,220,255,0.5)";

            ctx.beginPath();
            ctx.arc(
                e.x,
                e.y,
                e.radius,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }

        // ======================================
        // Skill knocback egde wave particle
        // ======================================
        else if (
            e.type === "skill_knockback_wave"
        ){

            const t =
                1 - (e.life / e.maxLife);

            const radius =
                e.radius +
                (e.maxRadius - e.radius) * t;

            // 外リング
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 10 * alpha;

            ctx.shadowBlur = 25;
            ctx.shadowColor = "#ffffff";

            ctx.beginPath();
            ctx.arc(
                e.x,
                e.y,
                radius,
                0,
                Math.PI * 2
            );
            ctx.stroke();

            // 内リング
            ctx.lineWidth = 4 * alpha;

            ctx.beginPath();
            ctx.arc(
                e.x,
                e.y,
                radius * 0.75,
                0,
                Math.PI * 2
            );
            ctx.stroke();

            // 中心フラッシュ
            const flashRadius =
                120 * (1 - t);

            ctx.fillStyle =
                `rgba(
                    255,
                    255,
                    255,
                    ${alpha * 0.35}
                )`;

            ctx.beginPath();

            ctx.arc(
                e.x,
                e.y,
                flashRadius,
                0,
                Math.PI * 2
            );

            ctx.fill();
        }

        else if (
            e.type === "skill_knockback_particle"
        ){

            e.x += e.vx;
            e.y += e.vy;

            ctx.fillStyle =
                "#d9d9d9";

            ctx.beginPath();

            ctx.arc(
                e.x,
                e.y,
                3,
                0,
                Math.PI * 2
            );

            ctx.fill();
        }

        // ======================================
        // INVINCIBLE BARRIER
        // ======================================
        else if (e.type === "skill_invincible_barrier") {

            const now = performance.now();

            const remaining = e.endTime - now;
            const duration = e.durationMs;

            // 終了判定
            if (remaining <= 0) {
                e.life = 0;
                return;
            }

            const t = Math.max(0, Math.min(1, remaining / duration));

            e.angle += 0.02;

            // =========================
            // ① コア
            // =========================
            const coreAlpha =
                0.18 + Math.sin(now * 0.003) * 0.05;

            const coreGrad = ctx.createRadialGradient(
                e.x, e.y, 0,
                e.x, e.y, e.radius
            );

            coreGrad.addColorStop(0, `rgba(120,200,255,${coreAlpha})`);
            coreGrad.addColorStop(1, "rgba(80,160,255,0)");

            ctx.fillStyle = coreGrad;
            ctx.beginPath();
            ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
            ctx.fill();

            // =========================
            // ② 回転リング
            // =========================
            for (let i = 0; i < 3; i++) {

                const r = e.radius + 18 + i * 12;

                ctx.save();
                ctx.translate(e.x, e.y);
                ctx.rotate(e.angle * (1 + i * 0.3));

                ctx.strokeStyle = `rgba(120,200,255,${0.6 - i * 0.15})`;
                ctx.lineWidth = 2;

                ctx.beginPath();

                for (let j = 0; j < 6; j++) {
                    const a = (Math.PI * 2 / 6) * j;
                    const x = Math.cos(a) * r;
                    const y = Math.sin(a) * r;

                    if (j === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }

                ctx.closePath();
                ctx.stroke();
                ctx.restore();
            }

            // =========================
            // ③ 粒子
            // =========================
            if (!e.particles) e.particles = [];

            if (Math.random() < 0.35) {
                const a = Math.random() * Math.PI * 2;
                const d = e.radius + Math.random() * 40;

                e.particles.push({
                    x: e.x + Math.cos(a) * d,
                    y: e.y + Math.sin(a) * d,
                    vx: (Math.random() - 0.5) * 0.4,
                    vy: -0.2 + Math.random() * 0.4,
                    life: 40
                });
            }

            for (const p of e.particles) {
                p.x += p.vx;
                p.y += p.vy;
                p.life--;

                const a = p.life / 40;

                ctx.fillStyle = `rgba(140,220,255,${a})`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
                ctx.fill();
            }

            e.particles = e.particles.filter(p => p.life > 0);

            // =========================
            // ④ バー（完全ms連動）
            // =========================
            const barW = 120;
            const barH = 6;

            const bx = e.x - barW / 2;
            const by = e.y + e.radius + 30;

            const progress = remaining / duration;

            ctx.fillStyle = "rgba(20,40,80,0.5)";
            ctx.fillRect(bx, by, barW, barH);

            ctx.fillStyle = "rgba(80,180,255,0.9)";
            ctx.fillRect(bx, by, barW * progress, barH);

            ctx.strokeStyle = "rgba(120,200,255,0.8)";
            ctx.lineWidth = 1;
            ctx.strokeRect(bx, by, barW, barH);
        }

        // ======================================
        // REVIVE CROSS
        // ======================================
        else if (e.type === "skill_revive_cross") {

            const t =
                1 - (e.life / e.maxLife);

            e.angle += 0.03;

            // 外周リング
            ctx.strokeStyle = "#7dff9f";
            ctx.lineWidth = 5;
            ctx.shadowBlur = 25;
            ctx.shadowColor = "#7dff9f";

            ctx.beginPath();
            ctx.arc(
                e.x,
                e.y,
                30 + t * e.radius,
                0,
                Math.PI * 2
            );
            ctx.stroke();

            // 十字架
            ctx.save();

            ctx.translate(e.x, e.y);
            ctx.rotate(e.angle);

            ctx.fillStyle = "#a8ffb8";

            // 縦棒
            ctx.fillRect(
                -8,
                -60,
                16,
                90
            );

            // 横棒
            ctx.fillRect(
                -30,
                -20,
                60,
                16
            );

            ctx.restore();

            // 中央閃光
            const flash =
                80 * Math.sin(t * Math.PI);

            const grad =
                ctx.createRadialGradient(
                    e.x,
                    e.y,
                    0,
                    e.x,
                    e.y,
                    flash
                );

            grad.addColorStop(
                0,
                `rgba(220,255,220,${alpha})`
            );

            grad.addColorStop(
                1,
                "rgba(120,255,180,0)"
            );

            ctx.fillStyle = grad;

            ctx.beginPath();
            ctx.arc(
                e.x,
                e.y,
                flash,
                0,
                Math.PI * 2
            );

            ctx.fill();
        }

        else if (e.type === "skill_revive_particle") {

            e.x += e.vx;
            e.y += e.vy;

            ctx.fillStyle = "#8dffae";

            ctx.shadowBlur = 10;
            ctx.shadowColor = "#8dffae";

            ctx.beginPath();
            ctx.arc(
                e.x,
                e.y,
                e.radius,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }

        // ======================================
        // Skill Cooldown HUD
        // ======================================
        else if (e.type === "skill_cooldown_hud") {

            e.angle += 0.25;

            ctx.translate(e.x, e.y);
            ctx.rotate(e.angle);

            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 3;

            ctx.strokeRect(
                -e.radius,
                -e.radius,
                e.radius * 2,
                e.radius * 2
            );
        }

        // ======================================
        // Item Cooldown Line
        // ======================================
        else if (e.type === "item_cooldown_line") {

            e.x += e.vx;

            ctx.strokeStyle = "#d0d0d0";
            ctx.lineWidth = 2;

            ctx.beginPath();
            ctx.moveTo(e.x, e.y);
            ctx.lineTo(
                e.x - 24,
                e.y
            );
            ctx.stroke();
        }

        ctx.restore();

        if (e.life <= 0) {
            itemSkillEffects.splice(i, 1);
        }
    }
}

export function clearAllEffects() {

    particles.length = 0;

    hitWaveEffects.length = 0;
    knockbackEffects.length = 0;

    lockOnEffects.length = 0;
    shotEffects.length = 0;

    hitEffects.length = 0;

    chainBurstEffects.length = 0;

    scorePopups.length = 0;
    damagePopups.length = 0;

    itemSkillEffects.length = 0;
    laserEffects.length = 0;
    playerDamageEffects.length = 0;
    playerNegateEffects.length = 0;
}