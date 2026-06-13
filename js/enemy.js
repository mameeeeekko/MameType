// enemy.js

import { getUISafeTop, markDamageTaken, onEnemyRemovedByDamage, killEnemy } from "./enemyCore.js";
import { playDamageSound, spawnHitWave, spawnDamagePopup, spawnItemSkillEffect } from "./effectManager.js";
import { getSoundSettings, getSoundEnabled } from "./gameCore.js";
import { buildBaseRomaji } from "./typingLogic.js";
import { getRandomWordForType } from "./enemySpawner.js"; 
import { devOverride } from "../dev/devOverride.js";
import { addQuestItemPickup } from "./questPlayerStats.js";
import { getUIAnchorPosition } from "./enemyRenderer.js";

// 同じ敵をださない。
function getUnusedLetter(state) {

    const letters =
        "abcdefghijklmnopqrstuvwxyz!?".split("");

    const usedLetters = new Set();

    // 敵
    state.enemies?.forEach(enemy => {
        if (
            enemy &&
            !enemy.isDead &&
            enemy.text?.length === 1
        ) {
            usedLetters.add(
                enemy.text.toLowerCase()
            );
        }
    });

    // 弾
    state.enemyBullets?.forEach(bullet => {
        if (
            bullet &&
            !bullet.isDead &&
            bullet.text?.length === 1
        ) {
            usedLetters.add(
                bullet.text.toLowerCase()
            );
        }
    });

    const available =
        letters.filter(
            l => !usedLetters.has(l)
        );

    if (available.length === 0) {
        return letters[
            Math.floor(
                Math.random()
                * letters.length
            )
        ];
    }

    return available[
        Math.floor(
            Math.random()
            * available.length
        )
    ];
}

export class Enemy {

    constructor(word, text, x, y, speed, type) {

        this.word = word; // 表示（漢字あり）
        this.text = text; // タイピング用かな

        this.x = x;
        this.y = y;
        this.speed = speed;
        this.type = type;
        this.radius = type.size || 15;
        this.hitCount = type.hitCount || 1; // 残り問題数
        this.rotation = Math.random() * Math.PI * 2; // 初期角度
        this.rotationSpeed = type.rotationSpeed || 0; // 回転速度
        this.behaviorTimers = {};
        this.behaviorEffect = null;
        this.behaviorEffectTimer = 0;
        this.behaviorEffectDuration = 0;
        this.behaviorStates = {}; //特殊行動開始前にpreで警告をだすため状態をつくる
        this.freezeTimer = 0; //出現した敵のみフリーズさせるため

        this.pos = 0;
        this.inputedRomaji = "";
        // 表示基準ローマ字（描画ズレ防止）
        this.baseRomaji = "";
        // ★安全初期化
        this.isDead = false;
        // ステージ目標敵
        this.isObjective = true;

    }

    update(player, difficulty, state, deltaTime){

        // エフェクトのタイマー
        if (this.behaviorEffectTimer > 0) {
            this.behaviorEffectTimer -= deltaTime;

            if (this.behaviorEffectTimer <= 0) {
                this.behaviorEffect = null;
                this.behaviorEffectTimer = 0;
            }
        }

        // ★フリーズ判定（最優先）
        if (this.freezeTimer > 0) {

            this.freezeTimer -= deltaTime;

            if (this.freezeTimer < 0) {
                this.freezeTimer = 0;
            }

            return true;
        }

        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.hypot(dx, dy) || 0.0001;
        // ダメージを受けた時
        if(dist < player.radius + this.type.size){
            if (getSoundEnabled() && getSoundSettings().soundeffect) {
                playDamageSound(this.type.damageSound);
            }
            spawnHitWave(player.x, player.y);

            const damage = calcDamage(this.type, player, difficulty);
            player.hp -= damage;
            spawnDamagePopup(player.x, player.y - 20, damage);
            player.hp = Math.max(0, player.hp);

            markDamageTaken(); //damage受けたフラグOn
            onEnemyRemovedByDamage(this.isObjective); //damage受けた時敵が消えるため、processedCount ++
            this.isDead = true;
            return false;
        }

        const scale = deltaTime * 60;

        // 全体的な減速(0.7倍)と、文字数が多いほどさらに遅くする補正(5文字を超えた分から適用)
        const lengthPenalty = Math.max(0.3, 1.0 - (Math.max(0, (this.text?.length || 0) - 5) * 0.04));
        const moveSpeed = this.speed * 0.7 * lengthPenalty;

        this.x += dx / dist * moveSpeed * scale;
        this.y += dy / dist * moveSpeed * scale;
        this.rotation += this.rotationSpeed * scale;

        // behaviors処理 敵が出す弾や、召喚する敵の処理
        this.updateBehaviors(player, state, deltaTime);

        // UI侵入防止
        const uiTop = getUISafeTop();
        if(this.y < uiTop){
            this.y = Math.max(this.y, uiTop);
        }

        return !this.isDead;
    }

    // ====================================
    // 敵の行動処理
    // =====================================
    updateBehaviors(player, state, deltaTime){

        const behaviors = this.type.behaviors;

        if(!behaviors?.length) return;

        for(const behavior of behaviors){

            const key = behavior.type + "_" + behavior.interval;
            const preDelay = behavior.preDelay || 0;

            const behaviorState =
                this.behaviorStates[key] ||
                { timer: 0, charging: false };

            behaviorState.timer += deltaTime;

            if(!behaviorState.charging){

                const triggerTime =
                    behavior.interval - preDelay;

                if(behaviorState.timer >= triggerTime){

                    behaviorState.charging = true;

                    this.startBehaviorEffect(
                        behavior.type,
                        preDelay
                    );
                }
            }

            if(
                behaviorState.charging &&
                behaviorState.timer >= behavior.interval
            ){

                switch(behavior.type){

                    case "spawn":
                        this.spawnChildren(
                            behavior,
                            player,
                            state
                        );
                        break;

                    case "shoot":
                        this.fireBullet(
                            behavior,
                            player,
                            state
                        );
                        break;
                }

                behaviorState.timer = 0;
                behaviorState.charging = false;
            }

            this.behaviorStates[key] =
                behaviorState;
        }
    }

    startBehaviorEffect(type, duration = 1){

        this.behaviorEffect = type;
        this.behaviorEffectTimer = duration;
        this.behaviorEffectDuration = duration;
    }
    
    spawnChildren(behavior, player, state){

        const enemyType =
            Object.values(EnemyTypes)
                .find(
                    t =>
                    t.id === behavior.spawnType
                );

        if(!enemyType) return;

        for(
            let i=0;
            i<behavior.count;
            i++
        ){
            const angle =
                Math.random() * Math.PI * 2;

            const radius = 30;

            let x =
                this.x +
                Math.cos(angle)*radius;

            let y =
                this.y +
                Math.sin(angle)*radius;

            // プレイヤーから一定距離（例：200px）を保つように出現位置を調整
            const dx = x - player.x;
            const dy = y - player.y;
            const dist = Math.hypot(dx, dy) || 0.0001;
            const minSpawnDist = 200;

            if (dist < minSpawnDist) {
                x = player.x + (dx / dist) * minSpawnDist;
                y = player.y + (dy / dist) * minSpawnDist;
            }

            const enemy = createEnemyByType(
                enemyType, x, y, state
            );

            if (enemy) {

                // 召喚敵はステージ目標外
                enemy.isObjective = false;
                // 召喚敵フラグ（目印用）
                enemy.isSummoned = true;
                state.enemies.push(enemy);

            }
        }
    }

    fireBullet(behavior, player, state){

        const speed = behavior.bullet.speed;
        const count = behavior.bullet.count || 1;

        const reserved = new Set();

        for(let i = 0; i < count; i++){

            let letter;

            do{
                letter = getUnusedLetter(state);
            }
            while(reserved.has(letter));

            reserved.add(letter);

            const angle = (Math.PI * 2 / count) * i;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            
            let spawnX = this.x;
            let spawnY = this.y;

            // 弾の出現位置もプレイヤーに近すぎないように調整（例：100px）
            const dx = spawnX - player.x;
            const dy = spawnY - player.y;
            const dist = Math.hypot(dx, dy) || 0.0001;
            const minBulletDist = 100;

            if (dist < minBulletDist) {
                spawnX = player.x + (dx / dist) * minBulletDist;
                spawnY = player.y + (dy / dist) * minBulletDist;
            }

            const bullet = new BulletEnemy(
                letter,
                spawnX,
                spawnY,
                vx,
                vy,
                behavior.bullet
            );

            state.enemyBullets.push(bullet);
        }
    }

    // =================================
    // 1単語入力完了時の処理(複数問題敵)
    // =================================
    onWordComplete(player) {
        this.hitCount--;

        if (this.hitCount > 0) {
            // ノックバック
            const dx = this.x - player.x;
            const dy = this.y - player.y;
            const dist = Math.hypot(dx, dy) || 1;
            const knockbackBonus =
                devOverride.other?.knockbackBonus
                ?? player.knockbackBonus
                ?? 1;

            const knockbackPower =
                (this.type.knockback || 30) * knockbackBonus;
                
            this.x += dx / dist * knockbackPower;
            this.y += dy / dist * knockbackPower;

            // 次の問題を取得
            const newWord = getRandomWordForType(this.type);
            if (newWord) {
                this.text = newWord.text;
                this.word = newWord.word;
                this.baseRomaji = buildBaseRomaji(this.text, 0);
                this.pos = 0;
                this.inputedRomaji = "";
            }

            return false; // まだ生きてる
        }

        // 完全撃破
        this.isDead = true;
        return true;
    }
}


export class BulletEnemy extends Enemy{

    constructor(
        letter,
        x,
        y,
        vx,
        vy,
        bulletConfig
    ){

        super(
            letter,
            letter,
            x,
            y,
            0,
            {
                ...bulletConfig,

                score:0,
                hitCount:1,
                killSound:6,
                killedEffect:"bullet"
            }
        );

        this.isBullet = true;
        this.isObjective = false;
        this.vx = vx;
        this.vy = vy;

        // 追尾強度
        this.homing = bulletConfig.homing ?? 0.03;

        this.baseRomaji = letter;
    }

    update( player, difficulty, state, deltaTime ){
        
        if (this.freezeTimer > 0) {

            this.freezeTimer -= deltaTime;

            if (this.freezeTimer < 0) {
                this.freezeTimer = 0;
            }

            return true;
        }

        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.hypot(dx,dy);

        if( dist < player.radius + this.type.size){

            const damage = this.type.damage;
            player.hp -= damage;

            spawnDamagePopup( player.x, player.y-20, damage );

            this.isDead = true;

            return false;
        }

        // =========================
        // ホーミング
        // =========================
        const targetVx = dx / (dist || 1);
        const targetVy = dy / (dist || 1);
        // 徐々にプレイヤー方向へ向く
        this.vx += (targetVx - this.vx) * this.homing;
        this.vy += (targetVy - this.vy) * this.homing;
        // 速度一定化
        // 弾（BulletEnemy）にも全体的な減速と文字数補正を適用
        const lengthPenalty = Math.max(0.3, 1.0 - (Math.max(0, (this.text?.length || 0) - 5) * 0.04));
        const speed = this.type.speed * 0.7 * lengthPenalty;

        const len = Math.hypot( this.vx, this.vy ) || 1;

        this.vx = (this.vx / len) * speed;
        this.vy = (this.vy / len) * speed;

        // =========================
        // 移動
        // =========================
        const scale = deltaTime * 60;

        this.x += this.vx * scale;
        this.y += this.vy * scale;

        // 進行方向（プレイヤー側）を向くように回転を更新
        this.rotation = Math.atan2(this.vy, this.vx);

        return !this.isDead;
    }
}

// =================================
// ダメージ計算
// =================================
function calcDamage(enemyType, player, difficulty) {

    const baseDamage = enemyType.damage;

    // 防御軽減（割合カット）
    const defenseRate = 1 - (player.defense / 60); 

    // 下限（0未満防止）
    const clampedDefenseRate = Math.max(0.2, defenseRate);
    // ↑ 最大80%カットまで

    // 難易度補正
    const diffMultiplier = difficulty.enemy?.damageMultiplier ?? 1;

    let damage =
        baseDamage *
        clampedDefenseRate *
        diffMultiplier;

    // ★最低ダメージ保証
    const MIN_DAMAGE = 1;

    damage = Math.max(MIN_DAMAGE, damage);

    // ★整数化
    return Math.floor(damage);
}


export class ItemEnemy extends Enemy {

    constructor(word, text, x, y, type){

        super(word, text, x, y, 0, type);

        this.isItem = true;
        // 秒
        this.maxLifetime = type.lifetime || 300;
        this.lifetime = this.maxLifetime;

        this.baseRomaji = buildBaseRomaji(this.text, 0);
    }

    update(player, difficulty, state, deltaTime){

        this.lifetime -= deltaTime;

        // 点滅
        if (this.lifetime < 120) {
            this.flash = Math.floor(this.lifetime / 10) % 2;
        }

        // 時間切れ
        if (this.lifetime <= 0) {
            this.isDead = true;
            return false;
        }

        this.rotation += this.rotationSpeed || 0;

        return true;
    }

    onWordComplete(player, state, enemies){

        // ★アイテム取得記録
        addQuestItemPickup(this.type.id);

        applyItemEffect(this.type, player, state, enemies);

        this.isDead = true;

        return true;
    }
}


function applyItemEffect(type, player, state = {}, enemies = []){

    switch(type.effect){

        case "heal":

            spawnItemSkillEffect({

                category: "heal",
                source: "item",

                level:
                    type.value === "full"
                        ? "large"
                        : "medium",

                x: player.x,
                y: player.y
            });

            if(type.value === "full"){
                player.hp = player.maxHp;
            } else {
                player.hp += type.value;
                player.hp = Math.min(player.hp, player.maxHp);
            }

            break;

        case "kill":

            const aliveEnemies =
                enemies.filter(
                    e => e && !e.isDead && !e.isItem
                );

            if (aliveEnemies.length === 0) break;

            // =========================
            // targets
            // =========================

            const targets =
                type.value === "all"
                    ? aliveEnemies
                    : aliveEnemies.slice(0, type.value);

            // =========================
            // Effect
            // =========================

            spawnItemSkillEffect({

                category: "kill",
                source: "item",

                level:
                    type.value === "all"
                        ? "large"
                        : type.value >= 5
                            ? "medium"
                            : "small",

                targets
            });

            // =========================
            // Kill
            // =========================

            targets.forEach(enemy => {

                killEnemy(enemy, state, {
                    fromItem: true
                });

            });

            break;
    
        case "freeze":
            
            const freezeTargets = [
                ...enemies.filter(e => e && !e.isDead && !e.isItem),
                ...(state.enemyBullets || []).filter(b => b && !b.isDead)
            ];

            spawnItemSkillEffect({
                category: "freeze",
                source: "item",

                level: type.value >= 5
                        ? "large"
                        : "medium",

                targets: freezeTargets
            });

            freezeTargets.forEach(enemy => {

                enemy.freezeTimer =
                    Math.max(
                        enemy.freezeTimer || 0,
                        type.value
                    );

            });

            break;

        case "cooldown":

            const uiPos = getUIAnchorPosition("skill");

             spawnItemSkillEffect({

                category: "cooldown",
                source: "item",

                level: "medium",

                uiX: uiPos.x,
                uiY: uiPos.y
            });

            state.activeSkillCooldown =
                Math.max(
                    0,
                    (state.activeSkillCooldown || 0) - type.value
                );

            break;

        case "stock":
            const uiPosStock = getUIAnchorPosition("skill");
            spawnItemSkillEffect({
                category: "cooldown",
                source: "item",
                level: "medium",
                uiX: uiPosStock.x,
                uiY: uiPosStock.y
            });

            const maxS = state.activeSkillStockMax ?? 1;
            state.activeSkillStock = Math.min(maxS, (state.activeSkillStock || 0) + type.value);

            // ストックが最大になったらチャージ中のクールダウンをリセット
            if (state.activeSkillStock >= maxS) {
                state.activeSkillCooldown = 0;
            }
            break;
    }
}

// =================================
// アイテム説明文
// =================================
export function getItemDescription(type){

    switch(type.effect){

        case "heal":

            if(type.value === "full"){
                return "FULL";
            }

            return `+${type.value}`;

        case "freeze":

            return `${type.value}sec`;

        case "kill":

            if(type.value === "all"){
                return "ALL";
            }

            return `${type.value}`;

        case "cooldown":

            return `-${type.value}sec`;

        case "stock":
            return `STOCK+${type.value}`;

        default:
            return "";
    }
}

function createEnemyByType(type, x, y, state){

    let wordData = null;

    for (let i = 0; i < 20; i++) {

        const candidate =
            getRandomWordForType(type);

        if (!candidate) continue;

        const duplicate =
            state?.enemies?.some(
                e =>
                    !e.isDead &&
                    e.text === candidate.text
            ) ||
            state?.enemyBullets?.some(
                b =>
                    !b.isDead &&
                    b.text === candidate.text
            );

        if (!duplicate) {
            wordData = candidate;
            break;
        }
    }

    if (!wordData) {
        wordData =
            getRandomWordForType(type);
    }

    if (!wordData) return null;

    const enemy = new Enemy(
        wordData.word,
        wordData.text,
        x,
        y,
        type.speed,
        type
    );

    enemy.baseRomaji =
        buildBaseRomaji(
            enemy.text,
            0
        );

    return enemy;
}

// =====================================================
// EnemyType設定
// =====================================================
/*
 【基本設計ルール】
 1. 色と対応タグ（スコア順：赤 > 緑 > 黄 > ピンク > 青 > 紫 > グレー）
    - 赤 (#ff4d4f): 記号 ["記号"] (Score: 60)
    - 緑 (#73d13d): 句読点 ["句読点"] (Score: 55)
    - 黄 (#fadb14): ことわざ ["ことわざ"] (Score: 50)
    - ピンク (#ff85c0): 擬音 ["擬音"] (Score: 45)
    - 青 (#40a9ff): 促音 ["促音"] (Score: 40)
    - 紫 (#b37feb): 英語 ["英語"] (Score: 35)
    - グレー (#a4a4a4): 標準 [] (Score: 30)

 2. 形とスピード（早いほど高スコア）
    - pinwheel (高速): speed 1.2, rotation 0.05 (Score x1.5)
    - circle   (標準): speed 0.8, rotation 0.02 (Score x1.0)
    - square   (低速): speed 0.4, rotation 0.01 (Score x0.7)

 3. サイズと難易度（大きいほど高ダメージ・長文・高スコア）
    - Large  (size:28): damage:25, len:12-20 (Score x2.0)
    - Normal (size:20): damage:15, len:5-10  (Score x1.2)
    - Small  (size:14): damage:8,  len:2-4   (Score x0.8)

 4. パターンによる特殊効果
    - ring (同心円): hitCount 2 / knockback 40 / スコア 3倍（強力個体）
    - stripe (縞々): スピード 1.5倍 / rotationSpeed 1.5倍 / スコア 1.5倍（高速個体）
    - null (無地): 標準

【基本ステータス】
id              : 敵ID
name            : 表示名
size            : 当たり判定半径(px)
damage          : 接触ダメージ
hitCount        : 撃破までの問題数
knockback       : 問題クリア時ノックバック量
speed           : 移動速度
score           : 撃破スコア
killSound       : 撃破SE番号
damageSound     : 接触SE番号
killedEffect    : 撃破エフェクトID

【問題生成】
tags            : 使用タグ
minLen          : 最小文字数
maxLen          : 最大文字数

対応タグ:
[ "句読点", "促音", "英語","記号","ことわざ","擬音"]

【見た目】
color           : 本体色
shape           : "circle" "square" "pinwheel" "arrow"
pattern         : null "stripe" "ring"
rotationSpeed   : 回転速度

【行動パターン】
behaviors:[
    {
        type:"spawn",
        interval:5,      // 発動間隔(sec)
        preDelay:1.5,    // 演出後の発動までの時間（sec）
        spawnType:"slime",
        count:3          // 召喚数
    },
    {
        type:"shoot",
        interval:2,      // 発動間隔(sec)
        preDelay:1.5,    // 演出後の発動までの時間（sec）
        bullet:{
            count:8,         // 発射数
            speed:1,         // 弾速
            homing:0.03      // ホーミング強度 0.01(ゆっくり) → 0.3(ほぼミサイル)
            damage:5,        // ダメージ
            size:10,         // サイズ
            color:"#f00",
            shape:"circle",
            pattern:"ring",
            rotationSpeed:0
        }
    }
]
*/
// =====================================================

export const EnemyTypes = {

    // --- GRAY: Standard (タグなし / Base 30) ---
    GRAY_CIRCLE_SMALL: {
        id: "gray_circle_small", name: "Cookie",
        color: "#a4a4a4", shape: "circle", pattern: null, size: 14,
        speed: 0.6, rotationSpeed: 0.02, damage: 8,
        tags: [], minLen: 2, maxLen: 4, score: 24, // 30 * 1.0 * 0.8
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    GRAY_CIRCLE_SMALL_RING: {
        id: "gray_circle_small_ring", name: "EncryptedCookie",
        color: "#a4a4a4", shape: "circle", pattern: "ring", size: 14,
        speed: 0.8, rotationSpeed: 0.02, damage: 8,
        tags: [], minLen: 1, maxLen: 2, score: 72, // 24 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    GRAY_CIRCLE_SMALL_STRIPE: {
        id: "gray_circle_small_stripe", name: "SessionID",
        color: "#a4a4a4", shape: "circle", pattern: "stripe", size: 14,
        speed: 1.2, rotationSpeed: 0.03, damage: 8, // 0.8 * 1.5
        tags: [], minLen: 2, maxLen: 4, score: 36, // 24 * 1.5
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    GRAY_SQUARE_SMALL_RING: {
        id: "gray_square_small_ring", name: "SecureAdware",
        color: "#a4a4a4", shape: "square", pattern: "ring", size: 14,
        speed: 0.3, rotationSpeed: 0.01, damage: 8,
        tags: [], minLen: 1, maxLen: 2, score: 51, // 17 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    GRAY_CIRCLE_NORMAL: {
        id: "gray_circle_normal", name: "JunkData",
        color: "#a4a4a4", shape: "circle", pattern: null, size: 20,
        speed: 0.6, rotationSpeed: 0.02, damage: 15,
        tags: [], minLen: 5, maxLen: 10, score: 36, // 30 * 1.0 * 1.2
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    GRAY_CIRCLE_NORMAL_RING: {
        id: "gray_circle_normal_ring", name: "EncryptedJunkData",
        color: "#a4a4a4", shape: "circle", pattern: "ring", size: 20,
        speed: 0.8, rotationSpeed: 0.02, damage: 15,
        tags: [], minLen: 3, maxLen: 8, score: 108, // 36 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    GRAY_CIRCLE_NORMAL_STRIPE: {
        id: "gray_circle_normal_stripe", name: "FastJunkData",
        color: "#a4a4a4", shape: "circle", pattern: "stripe", size: 20,
        speed: 1.2, rotationSpeed: 0.03, damage: 15,
        tags: [], minLen: 5, maxLen: 10, score: 54, // 36 * 1.5
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    GRAY_SQUARE_SMALL: {
        id: "gray_square_small", name: "Adware",
        color: "#a4a4a4", shape: "square", pattern: null, size: 14,
        speed: 0.4, rotationSpeed: 0.01, damage: 8,
        tags: [], minLen: 2, maxLen: 4, score: 17, // 30 * 0.7 * 0.8
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    GRAY_SQUARE_SMALL_STRIPE: {
        id: "gray_square_small_stripe", name: "FastAdware",
        color: "#a4a4a4", shape: "square", pattern: "stripe", size: 14,
        speed: 0.6, rotationSpeed: 0.015, damage: 8,
        tags: [], minLen: 2, maxLen: 4, score: 26, // 17 * 1.5
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    GRAY_SQUARE_NORMAL: {
        id: "gray_square_normal", name: "Buffer",
        color: "#a4a4a4", shape: "square", pattern: null, size: 20,
        speed: 0.3, rotationSpeed: 0.01, damage: 15,
        tags: [], minLen: 5, maxLen: 10, score: 25, // 30 * 0.7 * 1.2
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    GRAY_SQUARE_NORMAL_RING: {
        id: "gray_square_normal_ring", name: "SecureBuffer",
        color: "#a4a4a4", shape: "square", pattern: "ring", size: 20,
        speed: 0.4, rotationSpeed: 0.01, damage: 15,
        tags: [], minLen: 3, maxLen: 8, score: 75, // 25 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    GRAY_SQUARE_NORMAL_STRIPE: {
        id: "gray_square_normal_stripe", name: "FastBuffer",
        color: "#a4a4a4", shape: "square", pattern: "stripe", size: 20,
        speed: 0.6, rotationSpeed: 0.015, damage: 15,
        tags: [], minLen: 5, maxLen: 10, score: 38, // 25 * 1.5
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    GRAY_CIRCLE_LARGE: {
        id: "gray_circle_large", name: "LogFile",
        color: "#a4a4a4", shape: "circle", pattern: null, size: 28,
        speed: 0.6, rotationSpeed: 0.02, damage: 25,
        tags: [], minLen: 10, maxLen: 18, score: 60, // 30 * 1.0 * 2.0
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    GRAY_CIRCLE_LARGE_RING: {
        id: "gray_circle_large_ring", name: "EncryptedLogFile",
        color: "#a4a4a4", shape: "circle", pattern: "ring", size: 28,
        speed: 0.8, rotationSpeed: 0.02, damage: 25,
        tags: [], minLen: 8, maxLen: 16, score: 180, // 60 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    GRAY_CIRCLE_LARGE_STRIPE: {
        id: "gray_circle_large_stripe", name: "FastLogFile",
        color: "#a4a4a4", shape: "circle", pattern: "stripe", size: 28,
        speed: 1.2, rotationSpeed: 0.03, damage: 25,
        tags: [], minLen: 10, maxLen: 18, score: 90, // 60 * 1.5
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    GRAY_SQUARE_LARGE: {
        id: "gray_square_large", name: "Botnet",
        color: "#a4a4a4", shape: "square", pattern: null, size: 28,
        speed: 0.3, rotationSpeed: 0.01, damage: 25,
        tags: [], minLen: 10, maxLen: 18, score: 42, // 30 * 0.7 * 2.0
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    GRAY_SQUARE_LARGE_RING: {
        id: "gray_square_large_ring", name: "EncryptedBotnet",
        color: "#a4a4a4", shape: "square", pattern: "ring", size: 28,
        speed: 0.4, rotationSpeed: 0.01, damage: 25,
        tags: [], minLen: 8, maxLen: 16, score: 126, // 42 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    GRAY_SQUARE_LARGE_STRIPE: {
        id: "gray_square_large_stripe", name: "FastBotnet",
        color: "#a4a4a4", shape: "square", pattern: "stripe", size: 28,
        speed: 0.6, rotationSpeed: 0.015, damage: 25, // 0.4 * 1.5, 0.01 * 1.5
        tags: [], minLen: 10, maxLen: 18, score: 63, // 30 * 0.7 * 2.0 * 1.5
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    GRAY_PINWHEEL_SMALL: {
        id: "gray_pinwheel_small", name: "Ping",
        color: "#a4a4a4", shape: "pinwheel", pattern: null, size: 14,
        speed: 0.9, rotationSpeed: 0.05, damage: 8,
        tags: [], minLen: 2, maxLen: 4, score: 36, // 30 * 1.5 * 0.8
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    GRAY_PINWHEEL_SMALL_RING: {
        id: "gray_pinwheel_small_ring", name: "SecurePing",
        color: "#a4a4a4", shape: "pinwheel", pattern: "ring", size: 14,
        speed: 1.2, rotationSpeed: 0.05, damage: 8,
        tags: [], minLen: 1, maxLen: 2, score: 108, // 36 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    GRAY_PINWHEEL_SMALL_STRIPE: {
        id: "gray_pinwheel_small_stripe", name: "HyperPing",
        color: "#a4a4a4", shape: "pinwheel", pattern: "stripe", size: 14,
        speed: 1.8, rotationSpeed: 0.075, damage: 8,
        tags: [], minLen: 2, maxLen: 4, score: 54, // 36 * 1.5
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    GRAY_PINWHEEL_NORMAL: {
        id: "gray_pinwheel_normal", name: "Packet",
        color: "#a4a4a4", shape: "pinwheel", pattern: null, size: 20,
        speed: 0.9, rotationSpeed: 0.05, damage: 15,
        tags: [], minLen: 5, maxLen: 10, score: 54, // 30 * 1.5 * 1.2
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    GRAY_PINWHEEL_NORMAL_RING: {
        id: "gray_pinwheel_normal_ring", name: "EncryptedPacket",
        color: "#a4a4a4", shape: "pinwheel", pattern: "ring", size: 20,
        speed: 1.2, rotationSpeed: 0.05, damage: 15,
        tags: [], minLen: 3, maxLen: 8, score: 162, // 54 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    GRAY_PINWHEEL_NORMAL_STRIPE: {
        id: "gray_pinwheel_normal_stripe", name: "FastPacket",
        color: "#a4a4a4", shape: "pinwheel", pattern: "stripe", size: 20,
        speed: 1.8, rotationSpeed: 0.075, damage: 15, // 1.2 * 1.5, 0.05 * 1.5
        tags: [], minLen: 5, maxLen: 10, score: 81, // 54 * 1.5
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    GRAY_PINWHEEL_LARGE: {
        id: "gray_pinwheel_large", name: "Traffic",
        color: "#a4a4a4", shape: "pinwheel", pattern: null, size: 28,
        speed: 0.9, rotationSpeed: 0.05, damage: 25,
        tags: [], minLen: 10, maxLen: 18, score: 90, // 30 * 1.5 * 2.0
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    GRAY_PINWHEEL_LARGE_RING: {
        id: "gray_pinwheel_large_ring", name: "EncryptedTraffic",
        color: "#a4a4a4", shape: "pinwheel", pattern: "ring", size: 28,
        speed: 1.2, rotationSpeed: 0.05, damage: 25,
        tags: [], minLen: 8, maxLen: 16, score: 270, // 90 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    GRAY_PINWHEEL_LARGE_STRIPE: {
        id: "gray_pinwheel_large_stripe", name: "HyperTraffic",
        color: "#a4a4a4", shape: "pinwheel", pattern: "stripe", size: 28,
        speed: 1.8, rotationSpeed: 0.075, damage: 25,
        tags: [], minLen: 10, maxLen: 18, score: 135, // 90 * 1.5
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },

    // --- PURPLE: English (英語 / Base 35) ---
    PURPLE_SQUARE_SMALL: {
        id: "purple_square_small", name: "Token",
        color: "#b37feb", shape: "square", pattern: null, size: 14,
        speed: 0.3, rotationSpeed: 0.01, damage: 8,
        tags: ["英語"], minLen: 2, maxLen: 4, score: 20, // 35 * 0.7 * 0.8
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    PURPLE_SQUARE_SMALL_RING: {
        id: "purple_square_small_ring", name: "SecureToken",
        color: "#b37feb", shape: "square", pattern: "ring", size: 14,
        speed: 0.4, rotationSpeed: 0.01, damage: 8,
        tags: ["英語"], minLen: 1, maxLen: 2, score: 60, // 20 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    PURPLE_SQUARE_SMALL_STRIPE: {
        id: "purple_square_small_stripe", name: "FastToken",
        color: "#b37feb", shape: "square", pattern: "stripe", size: 14,
        speed: 0.6, rotationSpeed: 0.015, damage: 8,
        tags: ["英語"], minLen: 2, maxLen: 4, score: 30, // 20 * 1.5
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    PURPLE_SQUARE_NORMAL: {
        id: "purple_square_normal", name: "Firewall",
        color: "#b37feb", shape: "square", pattern: null, size: 20,
        speed: 0.3, rotationSpeed: 0.01, damage: 15,
        tags: ["英語"], minLen: 5, maxLen: 10, score: 29, // 35 * 0.7 * 1.2
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    PURPLE_SQUARE_NORMAL_RING: {
        id: "purple_square_normal_ring", name: "SecureFirewall",
        color: "#b37feb", shape: "square", pattern: "ring", size: 20,
        speed: 0.4, rotationSpeed: 0.01, damage: 15,
        tags: ["英語"], minLen: 3, maxLen: 8, score: 87, // 29 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    PURPLE_SQUARE_NORMAL_STRIPE: {
        id: "purple_square_normal_stripe", name: "FastFirewall",
        color: "#b37feb", shape: "square", pattern: "stripe", size: 20,
        speed: 0.6, rotationSpeed: 0.015, damage: 15, // 0.4 * 1.5, 0.01 * 1.5
        tags: ["英語"], minLen: 5, maxLen: 10, score: 44, // 29 * 1.5
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    PURPLE_SQUARE_LARGE: {
        id: "purple_SQUARE_large", name: "Mainframe",
        color: "#b37feb", shape: "square", pattern: null, size: 28,
        speed: 0.3, rotationSpeed: 0.01, damage: 25,
        tags: ["英語"], minLen: 10, maxLen: 18, score: 49, // 35 * 0.7 * 2.0
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    PURPLE_SQUARE_LARGE_RING: {
        id: "purple_SQUARE_large_ring", name: "EncryptedMainframe",
        color: "#b37feb", shape: "square", pattern: "ring", size: 28,
        speed: 0.4, rotationSpeed: 0.01, damage: 25,
        tags: ["英語"], minLen: 8, maxLen: 16, score: 147, // 49 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    PURPLE_SQUARE_LARGE_STRIPE: {
        id: "purple_SQUARE_large_stripe", name: "FastMainframe",
        color: "#b37feb", shape: "square", pattern: "stripe", size: 28,
        speed: 0.6, rotationSpeed: 0.015, damage: 25,
        tags: ["英語"], minLen: 10, maxLen: 18, score: 74, // 49 * 1.5
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    PURPLE_PINWHEEL_SMALL: {
        id: "purple_pinwheel_small", name: "Phishing",
        color: "#b37feb", shape: "pinwheel", pattern: null, size: 14,
        speed: 0.9, rotationSpeed: 0.05, damage: 8,
        tags: ["英語"], minLen: 2, maxLen: 4, score: 42, // 35 * 1.5 * 0.8
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    PURPLE_PINWHEEL_SMALL_RING: {
        id: "purple_pinwheel_small_ring", name: "EncryptedPhishing",
        color: "#b37feb", shape: "pinwheel", pattern: "ring", size: 14,
        speed: 1.2, rotationSpeed: 0.05, damage: 8,
        tags: ["英語"], minLen: 1, maxLen: 2, score: 126, // 42 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    PURPLE_PINWHEEL_SMALL_STRIPE: {
        id: "purple_pinwheel_small_stripe", name: "FastPhishing",
        color: "#b37feb", shape: "pinwheel", pattern: "stripe", size: 14,
        speed: 1.8, rotationSpeed: 0.075, damage: 8, // 1.2 * 1.5, 0.05 * 1.5
        tags: ["英語"], minLen: 2, maxLen: 4, score: 63, // 42 * 1.5
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    PURPLE_CIRCLE_SMALL: {
        id: "purple_circle_small", name: "Keylogger",
        color: "#b37feb", shape: "circle", pattern: null, size: 14,
        speed: 0.6, rotationSpeed: 0.02, damage: 8,
        tags: ["英語"], minLen: 2, maxLen: 4, score: 28, // 35 * 1.0 * 0.8
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    PURPLE_CIRCLE_SMALL_RING: {
        id: "purple_circle_small_ring", name: "HiddenKeylogger",
        color: "#b37feb", shape: "circle", pattern: "ring", size: 14,
        speed: 0.8, rotationSpeed: 0.02, damage: 8,
        tags: ["英語"], minLen: 1, maxLen: 2, score: 84, // 28 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    PURPLE_CIRCLE_SMALL_STRIPE: {
        id: "purple_circle_small_stripe", name: "FastKeylogger",
        color: "#b37feb", shape: "circle", pattern: "stripe", size: 14,
        speed: 1.2, rotationSpeed: 0.03, damage: 8,
        tags: ["英語"], minLen: 2, maxLen: 4, score: 42, // 28 * 1.5
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    PURPLE_CIRCLE_NORMAL: {
        id: "purple_circle_normal", name: "SpamMail",
        color: "#b37feb", shape: "circle", pattern: null, size: 20,
        speed: 0.6, rotationSpeed: 0.02, damage: 15,
        tags: ["英語"], minLen: 5, maxLen: 10, score: 42, // 35 * 1.0 * 1.2
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    PURPLE_CIRCLE_NORMAL_RING: {
        id: "purple_circle_normal_ring", name: "SecureSpam",
        color: "#b37feb", shape: "circle", pattern: "ring", size: 20,
        speed: 0.8, rotationSpeed: 0.02, damage: 15,
        tags: ["英語"], minLen: 3, maxLen: 8, score: 126, // 42 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    PURPLE_CIRCLE_NORMAL_STRIPE: {
        id: "purple_circle_normal_stripe", name: "FastSpam",
        color: "#b37feb", shape: "circle", pattern: "stripe", size: 20,
        speed: 1.2, rotationSpeed: 0.03, damage: 15,
        tags: ["英語"], minLen: 5, maxLen: 10, score: 63, // 42 * 1.5
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    PURPLE_PINWHEEL_NORMAL: {
        id: "purple_pinwheel_normal", name: "Streamer",
        color: "#b37feb", shape: "pinwheel", pattern: null, size: 20,
        speed: 0.9, rotationSpeed: 0.05, damage: 15,
        tags: ["英語"], minLen: 5, maxLen: 10, score: 63, // 35 * 1.5 * 1.2
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    PURPLE_PINWHEEL_NORMAL_RING: {
        id: "purple_pinwheel_normal_ring", name: "SecureStreamer",
        color: "#b37feb", shape: "pinwheel", pattern: "ring", size: 20,
        speed: 1.2, rotationSpeed: 0.05, damage: 15,
        tags: ["英語"], minLen: 3, maxLen: 8, score: 189, // 63 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    PURPLE_PINWHEEL_NORMAL_STRIPE: {
        id: "purple_pinwheel_normal_stripe", name: "HyperStreamer",
        color: "#b37feb", shape: "pinwheel", pattern: "stripe", size: 20,
        speed: 1.8, rotationSpeed: 0.075, damage: 15,
        tags: ["英語"], minLen: 5, maxLen: 10, score: 95, // 63 * 1.5
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    PURPLE_PINWHEEL_LARGE: {
        id: "purple_pinwheel_large", name: "DataBreach",
        color: "#b37feb", shape: "pinwheel", pattern: null, size: 28,
        speed: 0.9, rotationSpeed: 0.05, damage: 25,
        tags: ["英語"], minLen: 10, maxLen: 18, score: 105, // 35 * 1.5 * 2.0
        killSound: 5, killedEffect: "enemy1", damageSound: 1
    },
    PURPLE_PINWHEEL_LARGE_RING: {
        id: "purple_pinwheel_large_ring", name: "EncryptedBreach",
        color: "#b37feb", shape: "pinwheel", pattern: "ring", size: 28,
        speed: 1.2, rotationSpeed: 0.05, damage: 25,
        tags: ["英語"], minLen: 8, maxLen: 16, score: 315, // 105 * 3
        killSound: 5, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    PURPLE_PINWHEEL_LARGE_STRIPE: {
        id: "purple_pinwheel_large_stripe", name: "HyperBreach",
        color: "#b37feb", shape: "pinwheel", pattern: "stripe", size: 28,
        speed: 1.8, rotationSpeed: 0.075, damage: 25,
        tags: ["英語"], minLen: 10, maxLen: 18, score: 158, // 105 * 1.5
        killSound: 5, killedEffect: "enemy1", damageSound: 1
    },
    PURPLE_CIRCLE_LARGE: {
        id: "purple_circle_large", name: "LargePhishing",
        color: "#b37feb", shape: "circle", pattern: null, size: 28,
        speed: 0.6, rotationSpeed: 0.02, damage: 25,
        tags: ["英語"], minLen: 10, maxLen: 18, score: 70, // 35 * 1.0 * 2.0
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    PURPLE_CIRCLE_LARGE_RING: {
        id: "purple_circle_large_ring", name: "EncryptedLargePhishing",
        color: "#b37feb", shape: "circle", pattern: "ring", size: 28,
        speed: 0.8, rotationSpeed: 0.02, damage: 25,
        tags: ["英語"], minLen: 8, maxLen: 16, score: 210, // 70 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    PURPLE_CIRCLE_LARGE_STRIPE: {
        id: "purple_circle_large_stripe", name: "FastLargePhishing",
        color: "#b37feb", shape: "circle", pattern: "stripe", size: 28,
        speed: 1.2, rotationSpeed: 0.03, damage: 25, // 0.8 * 1.5, 0.02 * 1.5
        tags: ["英語"], minLen: 10, maxLen: 18, score: 105, // 70 * 1.5
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },

    // --- BLUE: Sokuon (促音 / Base 40) ---
    BLUE_CIRCLE_SMALL: {
        id: "blue_circle_small", name: "Proxy",
        color: "#40a9ff", shape: "circle", pattern: null, size: 14,
        speed: 0.6, rotationSpeed: 0.02, damage: 8,
        tags: ["促音"], minLen: 2, maxLen: 4, score: 32, // 40 * 1.0 * 0.8
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    BLUE_CIRCLE_SMALL_RING: {
        id: "blue_circle_small_ring", name: "EncryptedProxy",
        color: "#40a9ff", shape: "circle", pattern: "ring", size: 14,
        speed: 0.8, rotationSpeed: 0.02, damage: 8,
        tags: ["促音"], minLen: 1, maxLen: 2, score: 96, // 32 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    BLUE_CIRCLE_SMALL_STRIPE: {
        id: "blue_circle_small_stripe", name: "FastProxy",
        color: "#40a9ff", shape: "circle", pattern: "stripe", size: 14,
        speed: 1.2, rotationSpeed: 0.03, damage: 8,
        tags: ["促音"], minLen: 2, maxLen: 4, score: 48, // 32 * 1.5
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    BLUE_PINWHEEL_SMALL: {
        id: "blue_pinwheel_small", name: "Backdoor",
        color: "#40a9ff", shape: "pinwheel", pattern: null, size: 14,
        speed: 0.9, rotationSpeed: 0.05, damage: 8,
        tags: ["促音"], minLen: 2, maxLen: 4, score: 48, // 40 * 1.5 * 0.8
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    BLUE_PINWHEEL_SMALL_STRIPE: {
        id: "blue_pinwheel_small_stripe", name: "DDoS",
        color: "#40a9ff", shape: "pinwheel", pattern: "stripe", size: 14,
        speed: 1.8, rotationSpeed: 0.08, damage: 8, // 1.2 * 1.5
        tags: ["促音"], minLen: 2, maxLen: 4, score: 72, // 48 * 1.5
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    BLUE_PINWHEEL_SMALL_RING: {
        id: "blue_pinwheel_small_ring", name: "EncryptedBackdoor",
        color: "#40a9ff", shape: "pinwheel", pattern: "ring", size: 14,
        speed: 1.2, rotationSpeed: 0.05, damage: 8,
        tags: ["促音"], minLen: 1, maxLen: 2, score: 144, // 48 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    BLUE_CIRCLE_NORMAL: {
        id: "blue_circle_normal", name: "Backdoor",
        color: "#40a9ff", shape: "circle", pattern: null, size: 20,
        speed: 0.6, rotationSpeed: 0.02, damage: 15,
        tags: ["促音"], minLen: 5, maxLen: 10, score: 48, // 40 * 1.0 * 1.2
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    BLUE_CIRCLE_NORMAL_RING: {
        id: "blue_circle_normal_ring", name: "EncryptedBackdoor",
        color: "#40a9ff", shape: "circle", pattern: "ring", size: 20,
        speed: 0.8, rotationSpeed: 0.02, damage: 15,
        tags: ["促音"], minLen: 3, maxLen: 8, score: 144, // 48 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    BLUE_CIRCLE_NORMAL_STRIPE: {
        id: "blue_circle_normal_stripe", name: "FastBackdoor",
        color: "#40a9ff", shape: "circle", pattern: "stripe", size: 20,
        speed: 1.2, rotationSpeed: 0.03, damage: 15, // 0.8 * 1.5, 0.02 * 1.5
        tags: ["促音"], minLen: 5, maxLen: 10, score: 72, // 48 * 1.5
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    BLUE_PINWHEEL_NORMAL: {
        id: "blue_pinwheel_normal", name: "Encoder",
        color: "#40a9ff", shape: "pinwheel", pattern: null, size: 20,
        speed: 0.9, rotationSpeed: 0.05, damage: 15,
        tags: ["促音"], minLen: 5, maxLen: 10, score: 72, // 40 * 1.5 * 1.2
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    BLUE_PINWHEEL_NORMAL_RING: {
        id: "blue_pinwheel_normal_ring", name: "SecureEncoder",
        color: "#40a9ff", shape: "pinwheel", pattern: "ring", size: 20,
        speed: 1.2, rotationSpeed: 0.05, damage: 15,
        tags: ["促音"], minLen: 3, maxLen: 8, score: 216, // 72 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    BLUE_PINWHEEL_NORMAL_STRIPE: {
        id: "blue_pinwheel_normal_stripe", name: "HyperEncoder",
        color: "#40a9ff", shape: "pinwheel", pattern: "stripe", size: 20,
        speed: 1.8, rotationSpeed: 0.075, damage: 15,
        tags: ["促音"], minLen: 5, maxLen: 10, score: 108, // 72 * 1.5
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    BLUE_SQUARE_LARGE: {
        id: "blue_square_large", name: "LargeDDoS",
        color: "#40a9ff", shape: "square", pattern: null, size: 28,
        speed: 0.3, rotationSpeed: 0.01, damage: 25,
        tags: ["促音"], minLen: 10, maxLen: 18, score: 56, // 40 * 0.7 * 2.0
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    BLUE_SQUARE_LARGE_RING: {
        id: "blue_square_large_ring", name: "EncryptedLargeDDoS",
        color: "#40a9ff", shape: "square", pattern: "ring", size: 28,
        speed: 0.4, rotationSpeed: 0.01, damage: 25,
        tags: ["促音"], minLen: 8, maxLen: 16, score: 168, // 56 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    BLUE_CIRCLE_LARGE: {
        id: "blue_circle_large", name: "Bridge",
        color: "#40a9ff", shape: "circle", pattern: null, size: 28,
        speed: 0.6, rotationSpeed: 0.02, damage: 25,
        tags: ["促音"], minLen: 10, maxLen: 18, score: 80, // 40 * 1.0 * 2.0
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    BLUE_CIRCLE_LARGE_RING: {
        id: "blue_circle_large_ring", name: "EncryptedBridge",
        color: "#40a9ff", shape: "circle", pattern: "ring", size: 28,
        speed: 0.8, rotationSpeed: 0.02, damage: 25,
        tags: ["促音"], minLen: 8, maxLen: 16, score: 240, // 80 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    BLUE_CIRCLE_LARGE_STRIPE: {
        id: "blue_circle_large_stripe", name: "FastBridge",
        color: "#40a9ff", shape: "circle", pattern: "stripe", size: 28,
        speed: 1.2, rotationSpeed: 0.03, damage: 25,
        tags: ["促音"], minLen: 10, maxLen: 18, score: 120, // 80 * 1.5
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    BLUE_PINWHEEL_LARGE: {
        id: "blue_pinwheel_large", name: "BurstTraffic",
        color: "#40a9ff", shape: "pinwheel", pattern: null, size: 28,
        speed: 0.9, rotationSpeed: 0.05, damage: 25,
        tags: ["促音"], minLen: 10, maxLen: 18, score: 120, // 40 * 1.5 * 2.0
        killSound: 5, killedEffect: "enemy1", damageSound: 1
    },
    BLUE_PINWHEEL_LARGE_RING: {
        id: "blue_pinwheel_large_ring", name: "PersistentBurst",
        color: "#40a9ff", shape: "pinwheel", pattern: "ring", size: 28,
        speed: 1.2, rotationSpeed: 0.05, damage: 25,
        tags: ["促音"], minLen: 8, maxLen: 16, score: 360, // 120 * 3
        killSound: 5, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    BLUE_PINWHEEL_LARGE_STRIPE: {
        id: "blue_pinwheel_large_stripe", name: "HyperBurst",
        color: "#40a9ff", shape: "pinwheel", pattern: "stripe", size: 28,
        speed: 1.8, rotationSpeed: 0.075, damage: 25,
        tags: ["促音"], minLen: 10, maxLen: 18, score: 180, // 120 * 1.5
        killSound: 5, killedEffect: "enemy1", damageSound: 1
    },
    BLUE_SQUARE_LARGE_STRIPE: {
        id: "blue_square_large_stripe", name: "FastLargeDDoS",
        color: "#40a9ff", shape: "square", pattern: "stripe", size: 28,
        speed: 0.6, rotationSpeed: 0.015, damage: 25, // 0.4 * 1.5, 0.01 * 1.5
        tags: ["促音"], minLen: 10, maxLen: 18, score: 84, // 56 * 1.5
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    BLUE_SQUARE_NORMAL: {
        id: "blue_square_normal", name: "Sniffer",
        color: "#40a9ff", shape: "square", pattern: null, size: 20,
        speed: 0.3, rotationSpeed: 0.01, damage: 15,
        tags: ["促音"], minLen: 5, maxLen: 10, score: 34, // 40 * 0.7 * 1.2
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    BLUE_SQUARE_NORMAL_RING: {
        id: "blue_square_normal_ring", name: "PersistentSniffer",
        color: "#40a9ff", shape: "square", pattern: "ring", size: 20,
        speed: 0.4, rotationSpeed: 0.01, damage: 15,
        tags: ["促音"], minLen: 3, maxLen: 8, score: 102, // 34 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    BLUE_SQUARE_NORMAL_STRIPE: {
        id: "blue_square_normal_stripe", name: "FastSniffer",
        color: "#40a9ff", shape: "square", pattern: "stripe", size: 20,
        speed: 0.6, rotationSpeed: 0.015, damage: 15,
        tags: ["促音"], minLen: 5, maxLen: 10, score: 51, // 34 * 1.5
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    BLUE_SQUARE_SMALL: {
        id: "blue_square_small", name: "Latency",
        color: "#40a9ff", shape: "square", pattern: null, size: 14,
        speed: 0.3, rotationSpeed: 0.01, damage: 8,
        tags: ["促音"], minLen: 2, maxLen: 4, score: 22, // 40 * 0.7 * 0.8
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    BLUE_SQUARE_SMALL_RING: {
        id: "blue_square_small_ring", name: "PersistentLatency",
        color: "#40a9ff", shape: "square", pattern: "ring", size: 14,
        speed: 0.4, rotationSpeed: 0.01, damage: 8,
        tags: ["促音"], minLen: 1, maxLen: 2, score: 66, // 22 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    BLUE_SQUARE_SMALL_STRIPE: {
        id: "blue_square_small_stripe", name: "FastLatency",
        color: "#40a9ff", shape: "square", pattern: "stripe", size: 14,
        speed: 0.6, rotationSpeed: 0.015, damage: 8,
        tags: ["促音"], minLen: 2, maxLen: 4, score: 33, // 22 * 1.5
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },

    // --- PINK: Gion (擬音 / Base 45) ---
    PINK_CIRCLE_SMALL: {
        id: "pink_circle_small", name: "Popup",
        color: "#ff85c0", shape: "circle", pattern: null, size: 14,
        speed: 0.6, rotationSpeed: 0.02, damage: 8,
        tags: ["擬音"], minLen: 2, maxLen: 4, score: 36, // 45 * 1.0 * 0.8
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    PINK_CIRCLE_SMALL_RING: {
        id: "pink_circle_small_ring", name: "StickyPopup",
        color: "#ff85c0", shape: "circle", pattern: "ring", size: 14,
        speed: 0.8, rotationSpeed: 0.02, damage: 8,
        tags: ["擬音"], minLen: 1, maxLen: 2, score: 108, // 36 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    PINK_CIRCLE_SMALL_STRIPE: {
        id: "pink_circle_small_stripe", name: "FastPopup",
        color: "#ff85c0", shape: "circle", pattern: "stripe", size: 14,
        speed: 1.2, rotationSpeed: 0.03, damage: 8,
        tags: ["擬音"], minLen: 2, maxLen: 4, score: 54, // 36 * 1.5
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    PINK_CIRCLE_NORMAL: {
        id: "pink_circle_normal", name: "Malware",
        color: "#ff85c0", shape: "circle", pattern: null, size: 20,
        speed: 0.6, rotationSpeed: 0.02, damage: 15,
        tags: ["擬音"], minLen: 5, maxLen: 10, score: 54, // 45 * 1.0 * 1.2
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    PINK_CIRCLE_NORMAL_RING: {
        id: "pink_circle_normal_ring", name: "PersistentMalware",
        color: "#ff85c0", shape: "circle", pattern: "ring", size: 20,
        speed: 0.8, rotationSpeed: 0.02, damage: 15,
        tags: ["擬音"], minLen: 3, maxLen: 8, score: 162, // 54 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    PINK_CIRCLE_NORMAL_STRIPE: {
        id: "pink_circle_normal_stripe", name: "FastMalware",
        color: "#ff85c0", shape: "circle", pattern: "stripe", size: 20,
        speed: 1.2, rotationSpeed: 0.03, damage: 15, // 0.8 * 1.5, 0.02 * 1.5
        tags: ["擬音"], minLen: 5, maxLen: 10, score: 81, // 54 * 1.5
        killSound: 1, killedEffect: "enemy1", damageSound: 1

    },
    PINK_PINWHEEL_SMALL: {
        id: "pink_pinwheel_small", name: "Worm",
        color: "#ff85c0", shape: "pinwheel", pattern: null, size: 14,
        speed: 0.9, rotationSpeed: 0.05, damage: 8,
        tags: ["擬音"], minLen: 2, maxLen: 4, score: 54, // 45 * 1.5 * 0.8
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    PINK_PINWHEEL_SMALL_RING: {
        id: "pink_pinwheel_small_ring", name: "EncryptedWorm",
        color: "#ff85c0", shape: "pinwheel", pattern: "ring", size: 14,
        speed: 1.2, rotationSpeed: 0.05, damage: 8,
        tags: ["擬音"], minLen: 1, maxLen: 2, score: 162, // 54 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    PINK_PINWHEEL_SMALL_STRIPE: {
        id: "pink_pinwheel_small_stripe", name: "HyperWorm",
        color: "#ff85c0", shape: "pinwheel", pattern: "stripe", size: 14,
        speed: 1.8, rotationSpeed: 0.075, damage: 8,
        tags: ["擬音"], minLen: 2, maxLen: 4, score: 81, // 54 * 1.5
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    PINK_SQUARE_SMALL: {
        id: "pink_square_small", name: "SmallMalware",
        color: "#ff85c0", shape: "square", pattern: null, size: 14,
        speed: 0.3, rotationSpeed: 0.01, damage: 8,
        tags: ["擬音"], minLen: 2, maxLen: 4, score: 25, // 45 * 0.7 * 0.8
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    PINK_SQUARE_SMALL_RING: {
        id: "pink_square_small_ring", name: "EncryptedSmallMalware",
        color: "#ff85c0", shape: "square", pattern: "ring", size: 14,
        speed: 0.4, rotationSpeed: 0.01, damage: 8,
        tags: ["擬音"], minLen: 1, maxLen: 2, score: 75, // 25 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    PINK_SQUARE_SMALL_STRIPE: {
        id: "pink_square_small_stripe", name: "FastSmallMalware",
        color: "#ff85c0", shape: "square", pattern: "stripe", size: 14,
        speed: 0.6, rotationSpeed: 0.015, damage: 8, // 0.4 * 1.5, 0.01 * 1.5
        tags: ["擬音"], minLen: 2, maxLen: 4, score: 38, // 25 * 1.5
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    PINK_SQUARE_NORMAL: {
        id: "pink_square_normal", name: "Static",
        color: "#ff85c0", shape: "square", pattern: null, size: 20,
        speed: 0.3, rotationSpeed: 0.01, damage: 15,
        tags: ["擬音"], minLen: 5, maxLen: 10, score: 38, // 45 * 0.7 * 1.2
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    PINK_SQUARE_NORMAL_RING: {
        id: "pink_square_normal_ring", name: "SecureStatic",
        color: "#ff85c0", shape: "square", pattern: "ring", size: 20,
        speed: 0.4, rotationSpeed: 0.01, damage: 15,
        tags: ["擬音"], minLen: 3, maxLen: 8, score: 114, // 38 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    PINK_SQUARE_NORMAL_STRIPE: {
        id: "pink_square_normal_stripe", name: "FastStatic",
        color: "#ff85c0", shape: "square", pattern: "stripe", size: 20,
        speed: 0.6, rotationSpeed: 0.015, damage: 15,
        tags: ["擬音"], minLen: 5, maxLen: 10, score: 57, // 38 * 1.5
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    PINK_PINWHEEL_NORMAL: {
        id: "pink_pinwheel_normal", name: "Glitch",
        color: "#ff85c0", shape: "pinwheel", pattern: null, size: 20,
        speed: 0.9, rotationSpeed: 0.05, damage: 15,
        tags: ["擬音"], minLen: 5, maxLen: 10, score: 81, // 45 * 1.5 * 1.2
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    PINK_PINWHEEL_NORMAL_RING: {
        id: "pink_pinwheel_normal_ring", name: "SecureGlitch",
        color: "#ff85c0", shape: "pinwheel", pattern: "ring", size: 20,
        speed: 1.2, rotationSpeed: 0.05, damage: 15,
        tags: ["擬音"], minLen: 3, maxLen: 8, score: 243, // 81 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    PINK_PINWHEEL_NORMAL_STRIPE: {
        id: "pink_pinwheel_normal_stripe", name: "HyperGlitch",
        color: "#ff85c0", shape: "pinwheel", pattern: "stripe", size: 20,
        speed: 1.8, rotationSpeed: 0.075, damage: 15,
        tags: ["擬音"], minLen: 5, maxLen: 10, score: 122, // 81 * 1.5
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    PINK_SQUARE_LARGE: {
        id: "pink_square_large", name: "GlitchServer",
        color: "#ff85c0", shape: "square", pattern: null, size: 28,
        speed: 0.4, rotationSpeed: 0.01, damage: 25,
        tags: ["擬音"], minLen: 10, maxLen: 18, score: 63, // 45 * 0.7 * 2.0
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    PINK_PINWHEEL_LARGE: {
        id: "pink_pinwheel_large", name: "LargeSpyware",
        color: "#ff85c0", shape: "pinwheel", pattern: null, size: 28,
        speed: 0.9, rotationSpeed: 0.05, damage: 25,
        tags: ["擬音"], minLen: 10, maxLen: 18, score: 135, // 45 * 1.5 * 2.0
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    PINK_PINWHEEL_LARGE_RING: {
        id: "pink_pinwheel_large_ring", name: "PersistentLargeSpyware",
        color: "#ff85c0", shape: "pinwheel", pattern: "ring", size: 28,
        speed: 1.2, rotationSpeed: 0.05, damage: 25,
        tags: ["擬音"], minLen: 8, maxLen: 16, score: 405, // 135 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    PINK_PINWHEEL_LARGE_STRIPE: {
        id: "pink_pinwheel_large_stripe", name: "HyperSpyware",
        color: "#ff85c0", shape: "pinwheel", pattern: "stripe", size: 28,
        speed: 1.8, rotationSpeed: 0.075, damage: 25,
        tags: ["擬音"], minLen: 10, maxLen: 18, score: 202, // 135 * 1.5
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    PINK_CIRCLE_LARGE: {
        id: "pink_circle_large", name: "Miner",
        color: "#ff85c0", shape: "circle", pattern: null, size: 28,
        speed: 0.6, rotationSpeed: 0.02, damage: 25,
        tags: ["擬音"], minLen: 10, maxLen: 18, score: 90, // 45 * 1.0 * 2.0
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    PINK_CIRCLE_LARGE_RING: {
        id: "pink_circle_large_ring", name: "EncryptedMiner",
        color: "#ff85c0", shape: "circle", pattern: "ring", size: 28,
        speed: 0.8, rotationSpeed: 0.02, damage: 25,
        tags: ["擬音"], minLen: 8, maxLen: 16, score: 270, // 90 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    PINK_CIRCLE_LARGE_STRIPE: {
        id: "pink_circle_large_stripe", name: "FastMiner",
        color: "#ff85c0", shape: "circle", pattern: "stripe", size: 28,
        speed: 1.2, rotationSpeed: 0.03, damage: 25,
        tags: ["擬音"], minLen: 10, maxLen: 18, score: 135, // 90 * 1.5
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },

    // --- YELLOW: Proverb (ことわざ / Base 50) ---
    YELLOW_CIRCLE_SMALL: {
        id: "yellow_circle_small", name: "SmallTrojan",
        color: "#fadb14", shape: "circle", pattern: null, size: 14,
        speed: 0.6, rotationSpeed: 0.02, damage: 8,
        tags: ["ことわざ"], minLen: 2, maxLen: 4, score: 40, // 50 * 1.0 * 0.8
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    YELLOW_CIRCLE_SMALL_RING: {
        id: "yellow_circle_small_ring", name: "EncryptedTrojan",
        color: "#fadb14", shape: "circle", pattern: "ring", size: 14,
        speed: 0.8, rotationSpeed: 0.02, damage: 8,
        tags: ["ことわざ"], minLen: 1, maxLen: 2, score: 120, // 40 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    YELLOW_CIRCLE_SMALL_STRIPE: {
        id: "yellow_circle_small_stripe", name: "FastTrojan",
        color: "#fadb14", shape: "circle", pattern: "stripe", size: 14,
        speed: 1.2, rotationSpeed: 0.03, damage: 8, // 0.8 * 1.5, 0.02 * 1.5
        tags: ["ことわざ"], minLen: 2, maxLen: 4, score: 60, // 40 * 1.5
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    YELLOW_SQUARE_SMALL: {
        id: "yellow_square_small", name: "Branch",
        color: "#fadb14", shape: "square", pattern: null, size: 14,
        speed: 0.3, rotationSpeed: 0.01, damage: 8,
        tags: ["ことわざ"], minLen: 2, maxLen: 4, score: 28, // 50 * 0.7 * 0.8
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    YELLOW_SQUARE_SMALL_RING: {
        id: "yellow_square_small_ring", name: "SecureBranch",
        color: "#fadb14", shape: "square", pattern: "ring", size: 14,
        speed: 0.4, rotationSpeed: 0.01, damage: 8,
        tags: ["ことわざ"], minLen: 1, maxLen: 2, score: 84, // 28 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    YELLOW_SQUARE_SMALL_STRIPE: {
        id: "yellow_square_small_stripe", name: "FastBranch",
        color: "#fadb14", shape: "square", pattern: "stripe", size: 14,
        speed: 0.6, rotationSpeed: 0.015, damage: 8,
        tags: ["ことわざ"], minLen: 2, maxLen: 4, score: 42, // 28 * 1.5
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    YELLOW_PINWHEEL_SMALL: {
        id: "yellow_pinwheel_small", name: "Loop",
        color: "#fadb14", shape: "pinwheel", pattern: null, size: 14,
        speed: 0.9, rotationSpeed: 0.05, damage: 8,
        tags: ["ことわざ"], minLen: 2, maxLen: 4, score: 60, // 50 * 1.5 * 0.8
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    YELLOW_PINWHEEL_SMALL_RING: {
        id: "yellow_pinwheel_small_ring", name: "SecureLoop",
        color: "#fadb14", shape: "pinwheel", pattern: "ring", size: 14,
        speed: 1.2, rotationSpeed: 0.05, damage: 8,
        tags: ["ことわざ"], minLen: 1, maxLen: 2, score: 180, // 60 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    YELLOW_PINWHEEL_SMALL_STRIPE: {
        id: "yellow_pinwheel_small_stripe", name: "HyperLoop",
        color: "#fadb14", shape: "pinwheel", pattern: "stripe", size: 14,
        speed: 1.8, rotationSpeed: 0.075, damage: 8,
        tags: ["ことわざ"], minLen: 2, maxLen: 4, score: 90, // 60 * 1.5
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    YELLOW_CIRCLE_NORMAL: {
        id: "yellow_circle_normal", name: "Hash",
        color: "#fadb14", shape: "circle", pattern: null, size: 20,
        speed: 0.6, rotationSpeed: 0.02, damage: 15,
        tags: ["ことわざ"], minLen: 5, maxLen: 10, score: 60, // 50 * 1.0 * 1.2
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    YELLOW_CIRCLE_NORMAL_RING: {
        id: "yellow_circle_normal_ring", name: "SecureHash",
        color: "#fadb14", shape: "circle", pattern: "ring", size: 20,
        speed: 0.8, rotationSpeed: 0.02, damage: 15,
        tags: ["ことわざ"], minLen: 3, maxLen: 8, score: 180, // 60 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    YELLOW_CIRCLE_NORMAL_STRIPE: {
        id: "yellow_circle_normal_stripe", name: "FastHash",
        color: "#fadb14", shape: "circle", pattern: "stripe", size: 20,
        speed: 1.2, rotationSpeed: 0.03, damage: 15,
        tags: ["ことわざ"], minLen: 5, maxLen: 10, score: 90, // 60 * 1.5
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    YELLOW_SQUARE_NORMAL: {
        id: "yellow_square_normal", name: "Logic",
        color: "#fadb14", shape: "square", pattern: null, size: 20,
        speed: 0.3, rotationSpeed: 0.01, damage: 15,
        tags: ["ことわざ"], minLen: 5, maxLen: 10, score: 42, // 50 * 0.7 * 1.2
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    YELLOW_SQUARE_NORMAL_RING: {
        id: "yellow_square_normal_ring", name: "SecureLogic",
        color: "#fadb14", shape: "square", pattern: "ring", size: 20,
        speed: 0.4, rotationSpeed: 0.01, damage: 15,
        tags: ["ことわざ"], minLen: 3, maxLen: 8, score: 126, // 42 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    YELLOW_SQUARE_NORMAL_STRIPE: {
        id: "yellow_square_normal_stripe", name: "FastLogic",
        color: "#fadb14", shape: "square", pattern: "stripe", size: 20,
        speed: 0.6, rotationSpeed: 0.015, damage: 15,
        tags: ["ことわざ"], minLen: 5, maxLen: 10, score: 63, // 42 * 1.5
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    YELLOW_PINWHEEL_LARGE: {
        id: "yellow_pinwheel_large", name: "InfiniteLoop",
        color: "#fadb14", shape: "pinwheel", pattern: null, size: 28,
        speed: 0.9, rotationSpeed: 0.05, damage: 25,
        tags: ["ことわざ"], minLen: 10, maxLen: 18, score: 150, // 50 * 1.5 * 2.0
        killSound: 5, killedEffect: "enemy1", damageSound: 1
    },
    YELLOW_PINWHEEL_LARGE_RING: {
        id: "yellow_pinwheel_large_ring", name: "SecureInfiniteLoop",
        color: "#fadb14", shape: "pinwheel", pattern: "ring", size: 28,
        speed: 1.2, rotationSpeed: 0.05, damage: 25,
        tags: ["ことわざ"], minLen: 8, maxLen: 16, score: 450, // 150 * 3
        killSound: 5, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    YELLOW_PINWHEEL_LARGE_STRIPE: {
        id: "yellow_pinwheel_large_stripe", name: "HyperInfiniteLoop",
        color: "#fadb14", shape: "pinwheel", pattern: "stripe", size: 28,
        speed: 1.8, rotationSpeed: 0.075, damage: 25,
        tags: ["ことわざ"], minLen: 10, maxLen: 18, score: 225, // 150 * 1.5
        killSound: 5, killedEffect: "enemy1", damageSound: 1
    },
    YELLOW_CIRCLE_LARGE: {
        id: "yellow_circle_large", name: "CryptoVault",
        color: "#fadb14", shape: "circle", pattern: null, size: 28,
        speed: 0.6, rotationSpeed: 0.02, damage: 25,
        tags: ["ことわざ"], minLen: 10, maxLen: 18, score: 100, // 50 * 1.0 * 2.0
        killSound: 5, killedEffect: "enemy1", damageSound: 1
    },
    YELLOW_CIRCLE_LARGE_RING: {
        id: "yellow_circle_large_ring", name: "AdvancedVault",
        color: "#fadb14", shape: "circle", pattern: "ring", size: 28,
        speed: 0.8, rotationSpeed: 0.02, damage: 25,
        tags: ["ことわざ"], minLen: 8, maxLen: 16, score: 300, // 100 * 3
        killSound: 5, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    YELLOW_CIRCLE_LARGE_STRIPE: {
        id: "yellow_circle_large_stripe", name: "FastVault",
        color: "#fadb14", shape: "circle", pattern: "stripe", size: 28,
        speed: 1.2, rotationSpeed: 0.03, damage: 25,
        tags: ["ことわざ"], minLen: 10, maxLen: 18, score: 150, // 100 * 1.5
        killSound: 5, killedEffect: "enemy1", damageSound: 1
    },
    YELLOW_PINWHEEL_NORMAL: {
        id: "yellow_pinwheel_normal", name: "Encryption",
        color: "#fadb14", shape: "pinwheel", pattern: null, size: 20,
        speed: 0.9, rotationSpeed: 0.05, damage: 15,
        tags: ["ことわざ"], minLen: 5, maxLen: 10, score: 90, // 50 * 1.5 * 1.2
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    YELLOW_PINWHEEL_NORMAL_RING: {
        id: "yellow_pinwheel_normal_ring", name: "EncryptedEncryption",
        color: "#fadb14", shape: "pinwheel", pattern: "ring", size: 20,
        speed: 1.2, rotationSpeed: 0.05, damage: 15,
        tags: ["ことわざ"], minLen: 3, maxLen: 8, score: 270, // 90 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    YELLOW_PINWHEEL_NORMAL_STRIPE: {
        id: "yellow_pinwheel_normal_stripe", name: "FastEncryption",
        color: "#fadb14", shape: "pinwheel", pattern: "stripe", size: 20,
        speed: 1.8, rotationSpeed: 0.075, damage: 15, // 1.2 * 1.5, 0.05 * 1.5
        tags: ["ことわざ"], minLen: 5, maxLen: 10, score: 135, // 90 * 1.5
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    YELLOW_SQUARE_LARGE: {
        id: "yellow_square_large", name: "Trojan",
        color: "#fadb14", shape: "square", pattern: null, size: 28,
        speed: 0.4, rotationSpeed: 0.01, damage: 25,
        tags: ["ことわざ"], minLen: 10, maxLen: 18, score: 70, // 50 * 0.7 * 2.0
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    YELLOW_SQUARE_LARGE_RING: {
        id: "yellow_square_large_ring", name: "AdvancedTrojan",
        color: "#fadb14", shape: "square", pattern: "ring", size: 28,
        speed: 0.3, rotationSpeed: 0.01, damage: 25, 
        tags: ["ことわざ"], minLen: 8, maxLen: 16, score: 210, // 70 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    YELLOW_SQUARE_LARGE_STRIPE: {
        id: "yellow_square_large_stripe", name: "FastTrojan",
        color: "#fadb14", shape: "square", pattern: "stripe", size: 28,
        speed: 0.6, rotationSpeed: 0.015, damage: 25, // 0.4 * 1.5, 0.01 * 1.5
        tags: ["ことわざ"], minLen: 10, maxLen: 18, score: 105, // 70 * 1.5
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },

    // --- GREEN: Kutouten (句読点 / Base 55) ---
    GREEN_CIRCLE_SMALL: {
        id: "green_circle_small", name: "Pointer",
        color: "#73d13d", shape: "circle", pattern: null, size: 14,
        speed: 0.6, rotationSpeed: 0.02, damage: 8,
        tags: ["句読点"], minLen: 2, maxLen: 4, score: 44, // 55 * 1.0 * 0.8
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    GREEN_CIRCLE_SMALL_RING: {
        id: "green_circle_small_ring", name: "HiddenPointer",
        color: "#73d13d", shape: "circle", pattern: "ring", size: 14,
        speed: 0.8, rotationSpeed: 0.02, damage: 8,
        tags: ["句読点"], minLen: 1, maxLen: 2, score: 132, // 44 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    GREEN_CIRCLE_SMALL_STRIPE: {
        id: "green_circle_small_stripe", name: "FastPointer",
        color: "#73d13d", shape: "circle", pattern: "stripe", size: 14,
        speed: 1.2, rotationSpeed: 0.03, damage: 8,
        tags: ["句読点"], minLen: 2, maxLen: 4, score: 66, // 44 * 1.5
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    GREEN_CIRCLE_NORMAL: {
        id: "green_circle_normal", name: "Payload",
        color: "#73d13d", shape: "circle", pattern: null, size: 20,
        speed: 0.8, rotationSpeed: 0.02, damage: 15,
        tags: ["句読点"], minLen: 5, maxLen: 10, score: 66, // 55 * 1.0 * 1.2
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    GREEN_CIRCLE_NORMAL_STRIPE: {
        id: "green_circle_normal_stripe", name: "FastPayload",
        color: "#73d13d", shape: "circle", pattern: "stripe", size: 20,
        speed: 1.2, rotationSpeed: 0.03, damage: 15,
        tags: ["句読点"], minLen: 5, maxLen: 10, score: 99, // 66 * 1.5
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    GREEN_SQUARE_NORMAL: {
        id: "green_square_normal", name: "GlobalVar",
        color: "#73d13d", shape: "square", pattern: null, size: 20,
        speed: 0.3, rotationSpeed: 0.01, damage: 15,
        tags: ["句読点"], minLen: 5, maxLen: 10, score: 46, // 55 * 0.7 * 1.2
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    GREEN_SQUARE_NORMAL_RING: {
        id: "green_square_normal_ring", name: "SecureGlobal",
        color: "#73d13d", shape: "square", pattern: "ring", size: 20,
        speed: 0.4, rotationSpeed: 0.01, damage: 15,
        tags: ["句読点"], minLen: 3, maxLen: 8, score: 138, // 46 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    GREEN_SQUARE_NORMAL_STRIPE: {
        id: "green_square_normal_stripe", name: "FastGlobal",
        color: "#73d13d", shape: "square", pattern: "stripe", size: 20,
        speed: 0.6, rotationSpeed: 0.015, damage: 15,
        tags: ["句読点"], minLen: 5, maxLen: 10, score: 69, // 46 * 1.5
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    GREEN_PINWHEEL_SMALL: {
        id: "green_pinwheel_small", name: "Signal",
        color: "#73d13d", shape: "pinwheel", pattern: null, size: 14,
        speed: 0.9, rotationSpeed: 0.05, damage: 8,
        tags: ["句読点"], minLen: 2, maxLen: 4, score: 66, // 55 * 1.5 * 0.8
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    GREEN_PINWHEEL_SMALL_RING: {
        id: "green_pinwheel_small_ring", name: "SecureSignal",
        color: "#73d13d", shape: "pinwheel", pattern: "ring", size: 14,
        speed: 1.2, rotationSpeed: 0.05, damage: 8,
        tags: ["句読点"], minLen: 1, maxLen: 2, score: 198, // 66 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    GREEN_PINWHEEL_SMALL_STRIPE: {
        id: "green_pinwheel_small_stripe", name: "HyperSignal",
        color: "#73d13d", shape: "pinwheel", pattern: "stripe", size: 14,
        speed: 1.8, rotationSpeed: 0.075, damage: 8,
        tags: ["句読点"], minLen: 2, maxLen: 4, score: 99, // 66 * 1.5
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    GREEN_SQUARE_LARGE: {
        id: "green_square_large", name: "Repository",
        color: "#73d13d", shape: "square", pattern: null, size: 28,
        speed: 0.4, rotationSpeed: 0.01, damage: 25,
        tags: ["句読点"], minLen: 10, maxLen: 18, score: 77, // 55 * 0.7 * 2.0
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    GREEN_PINWHEEL_NORMAL: {
        id: "green_pinwheel_normal", name: "Exploit",
        color: "#73d13d", shape: "pinwheel", pattern: null, size: 20,
        speed: 0.9, rotationSpeed: 0.05, damage: 15,
        tags: ["句読点"], minLen: 5, maxLen: 10, score: 99, // 55 * 1.5 * 1.2
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    GREEN_PINWHEEL_NORMAL_STRIPE: {
        id: "green_pinwheel_normal_stripe", name: "Ransomware",
        color: "#73d13d", shape: "pinwheel", pattern: "stripe", size: 20,
        speed: 1.8, rotationSpeed: 0.08, damage: 15, // 1.2 * 1.5
        tags: ["句読点"], minLen: 5, maxLen: 10, score: 149, // 99 * 1.5
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    GREEN_PINWHEEL_NORMAL_RING: {
        id: "green_pinwheel_normal_ring", name: "PersistentExploit",
        color: "#73d13d", shape: "pinwheel", pattern: "ring", size: 20,
        speed: 1.2, rotationSpeed: 0.05, damage: 15,
        tags: ["句読点"], minLen: 3, maxLen: 8, score: 297, // 99 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    GREEN_PINWHEEL_LARGE: {
        id: "green_pinwheel_large", name: "MassiveExploit",
        color: "#73d13d", shape: "pinwheel", pattern: null, size: 28,
        speed: 0.9, rotationSpeed: 0.05, damage: 25,
        tags: ["句読点"], minLen: 10, maxLen: 18, score: 165, // 55 * 1.5 * 2.0
        killSound: 5, killedEffect: "enemy1", damageSound: 1
    },
    GREEN_PINWHEEL_LARGE_RING: {
        id: "green_pinwheel_large_ring", name: "SecureMassiveExploit",
        color: "#73d13d", shape: "pinwheel", pattern: "ring", size: 28,
        speed: 1.2, rotationSpeed: 0.05, damage: 25,
        tags: ["句読点"], minLen: 8, maxLen: 16, score: 495, // 165 * 3
        killSound: 5, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    GREEN_SQUARE_SMALL: {
        id: "green_square_small", name: "SmallRansomware",
        color: "#73d13d", shape: "square", pattern: null, size: 14,
        speed: 0.4, rotationSpeed: 0.01, damage: 8,
        tags: ["句読点"], minLen: 2, maxLen: 4, score: 31, // 55 * 0.7 * 0.8
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    GREEN_CIRCLE_NORMAL_RING: {
        id: "green_circle_normal_ring", name: "LockedPayload",
        color: "#73d13d", shape: "circle", pattern: "ring", size: 20,
        speed: 0.6, rotationSpeed: 0.02, damage: 15,
        tags: ["句読点"], minLen: 3, maxLen: 8, score: 198, // (55 * 1.0 * 1.2) * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    GREEN_SQUARE_SMALL_RING: {
        id: "green_square_small_ring", name: "EncryptedSmallRansomware",
        color: "#73d13d", shape: "square", pattern: "ring", size: 14,
        speed: 0.3, rotationSpeed: 0.01, damage: 8,
        tags: ["句読点"], minLen: 1, maxLen: 2, score: 93, // 31 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    GREEN_SQUARE_SMALL_STRIPE: {
        id: "green_square_small_stripe", name: "FastSmallRansomware",
        color: "#73d13d", shape: "square", pattern: "stripe", size: 14,
        speed: 0.6, rotationSpeed: 0.015, damage: 8, // 0.4 * 1.5, 0.01 * 1.5
        tags: ["句読点"], minLen: 2, maxLen: 4, score: 47, // 31 * 1.5
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    GREEN_CIRCLE_LARGE: {
        id: "green_circle_large", name: "LargeExploit",
        color: "#73d13d", shape: "circle", pattern: null, size: 28,
        speed: 0.6, rotationSpeed: 0.02, damage: 25,
        tags: ["句読点"], minLen: 10, maxLen: 18, score: 110, // 55 * 1.0 * 2.0
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    GREEN_CIRCLE_LARGE_RING: {
        id: "green_circle_large_ring", name: "PersistentLargeExploit",
        color: "#73d13d", shape: "circle", pattern: "ring", size: 28,
        speed: 0.8, rotationSpeed: 0.02, damage: 25,
        tags: ["句読点"], minLen: 8, maxLen: 16, score: 330, // 110 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    GREEN_CIRCLE_LARGE_STRIPE: {
        id: "green_circle_large_stripe", name: "FastLargeExploit",
        color: "#73d13d", shape: "circle", pattern: "stripe", size: 28,
        speed: 1.2, rotationSpeed: 0.03, damage: 25, // 0.8 * 1.5, 0.02 * 1.5
        tags: ["句読点"], minLen: 10, maxLen: 18, score: 165, // 110 * 1.5
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },

    // --- RED: Symbol (記号 / Base 60) ---
    RED_PINWHEEL_LARGE: {
        id: "red_pinwheel_large", name: "ZeroDay",
        color: "#ff4d4f", shape: "pinwheel", pattern: null, size: 28,
        speed: 0.9, rotationSpeed: 0.05, damage: 25,
        tags: ["記号"], minLen: 10, maxLen: 18, score: 180, // 60 * 1.5 * 2.0 (RINGなしは維持)
        killSound: 5, killedEffect: "boss1", damageSound: 1,
    },
    RED_PINWHEEL_LARGE_RING: {
        id: "red_pinwheel_large_ring", name: "StealthRootkit",
        color: "#ff4d4f", shape: "pinwheel", pattern: "ring", size: 28,
        speed: 1.2, rotationSpeed: 0.05, damage: 25,
        tags: ["記号"], minLen: 8, maxLen: 16, score: 540, // 180 * 3
        killSound: 5, killedEffect: "boss1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    RED_PINWHEEL_LARGE_STRIPE: {
        id: "red_pinwheel_large_stripe", name: "AdvancedVirus",
        color: "#ff4d4f", shape: "pinwheel", pattern: "stripe", size: 28,
        speed: 1.8, rotationSpeed: 0.075, damage: 25, // 1.2 * 1.5, 0.05 * 1.5
        tags: ["記号"], minLen: 10, maxLen: 18, score: 270, // 180 * 1.5
        killSound: 5, killedEffect: "boss1", damageSound: 1,
    },
    RED_CIRCLE_SMALL: {
        id: "red_circle_small", name: "SmallVirus",
        color: "#ff4d4f", shape: "circle", pattern: null, size: 14,
        speed: 0.8, rotationSpeed: 0.02, damage: 8,
        tags: ["記号"], minLen: 2, maxLen: 4, score: 48, // 60 * 1.0 * 0.8
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    RED_PINWHEEL_SMALL: {
        id: "red_pinwheel_small", name: "ActiveVirus",
        color: "#ff4d4f", shape: "pinwheel", pattern: null, size: 14,
        speed: 0.9, rotationSpeed: 0.05, damage: 8,
        tags: ["記号"], minLen: 2, maxLen: 4, score: 72, // 60 * 1.5 * 0.8
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    RED_PINWHEEL_SMALL_RING: {
        id: "red_pinwheel_small_ring", name: "SecureActiveVirus",
        color: "#ff4d4f", shape: "pinwheel", pattern: "ring", size: 14,
        speed: 1.2, rotationSpeed: 0.05, damage: 8,
        tags: ["記号"], minLen: 1, maxLen: 2, score: 216, // 72 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    RED_CIRCLE_SMALL_RING: {
        id: "red_circle_small_ring", name: "EncryptedSmallVirus",
        color: "#ff4d4f", shape: "circle", pattern: "ring", size: 14,
        speed: 0.6, rotationSpeed: 0.02, damage: 8,
        tags: ["記号"], minLen: 1, maxLen: 2, score: 144, // 48 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    RED_CIRCLE_NORMAL: {
        id: "red_circle_normal", name: "MutantVirus",
        color: "#ff4d4f", shape: "circle", pattern: null, size: 20,
        speed: 0.6, rotationSpeed: 0.02, damage: 15,
        tags: ["記号"], minLen: 5, maxLen: 10, score: 72, // 60 * 1.0 * 1.2
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    RED_CIRCLE_NORMAL_RING: {
        id: "red_circle_normal_ring", name: "EncryptedMutant",
        color: "#ff4d4f", shape: "circle", pattern: "ring", size: 20,
        speed: 0.8, rotationSpeed: 0.02, damage: 15,
        tags: ["記号"], minLen: 3, maxLen: 8, score: 216, // 72 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    RED_CIRCLE_NORMAL_STRIPE: {
        id: "red_circle_normal_stripe", name: "FastMutant",
        color: "#ff4d4f", shape: "circle", pattern: "stripe", size: 20,
        speed: 1.2, rotationSpeed: 0.03, damage: 15,
        tags: ["記号"], minLen: 5, maxLen: 10, score: 108, // 72 * 1.5
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    RED_PINWHEEL_NORMAL: {
        id: "red_pinwheel_normal", name: "Hijacker",
        color: "#ff4d4f", shape: "pinwheel", pattern: null, size: 20,
        speed: 0.9, rotationSpeed: 0.05, damage: 15,
        tags: ["記号"], minLen: 5, maxLen: 10, score: 108, // 60 * 1.5 * 1.2
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    RED_PINWHEEL_NORMAL_RING: {
        id: "red_pinwheel_normal_ring", name: "PersistentHijacker",
        color: "#ff4d4f", shape: "pinwheel", pattern: "ring", size: 20,
        speed: 1.2, rotationSpeed: 0.05, damage: 15,
        tags: ["記号"], minLen: 3, maxLen: 8, score: 324, // 108 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    RED_PINWHEEL_NORMAL_STRIPE: {
        id: "red_pinwheel_normal_stripe", name: "HyperHijacker",
        color: "#ff4d4f", shape: "pinwheel", pattern: "stripe", size: 20,
        speed: 1.8, rotationSpeed: 0.075, damage: 15,
        tags: ["記号"], minLen: 5, maxLen: 10, score: 162, // 108 * 1.5
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    RED_SQUARE_LARGE: {
        id: "red_square_large", name: "FatalError",
        color: "#ff4d4f", shape: "square", pattern: null, size: 28,
        speed: 0.3, rotationSpeed: 0.01, damage: 25,
        tags: ["記号"], minLen: 10, maxLen: 18, score: 84, // 60 * 0.7 * 2.0
        killSound: 5, killedEffect: "boss1", damageSound: 1
    },
    RED_SQUARE_LARGE_RING: {
        id: "red_square_large_ring", name: "EncryptedFatal",
        color: "#ff4d4f", shape: "square", pattern: "ring", size: 28,
        speed: 0.4, rotationSpeed: 0.01, damage: 25,
        tags: ["記号"], minLen: 8, maxLen: 16, score: 252, // 84 * 3
        killSound: 5, killedEffect: "boss1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    RED_SQUARE_LARGE_STRIPE: {
        id: "red_square_large_stripe", name: "FastFatalError",
        color: "#ff4d4f", shape: "square", pattern: "stripe", size: 28,
        speed: 0.6, rotationSpeed: 0.015, damage: 25,
        tags: ["記号"], minLen: 10, maxLen: 18, score: 126, // 84 * 1.5
        killSound: 5, killedEffect: "boss1", damageSound: 1
    },
    RED_CIRCLE_SMALL_STRIPE: {
        id: "red_circle_small_stripe", name: "FastSmallVirus",
        color: "#ff4d4f", shape: "circle", pattern: "stripe", size: 14,
        speed: 1.2, rotationSpeed: 0.03, damage: 8, // 0.8 * 1.5, 0.02 * 1.5
        tags: ["記号"], minLen: 2, maxLen: 4, score: 72, // 48 * 1.5
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    RED_CIRCLE_LARGE: {
        id: "red_circle_large", name: "Trigger",
        color: "#ff4d4f", shape: "circle", pattern: null, size: 28,
        speed: 0.6, rotationSpeed: 0.02, damage: 25,
        tags: ["記号"], minLen: 10, maxLen: 18, score: 120, // 60 * 1.0 * 2.0
        killSound: 5, killedEffect: "boss1", damageSound: 1
    },
    RED_CIRCLE_LARGE_RING: {
        id: "red_circle_large_ring", name: "EncryptedTrigger",
        color: "#ff4d4f", shape: "circle", pattern: "ring", size: 28,
        speed: 0.8, rotationSpeed: 0.02, damage: 25,
        tags: ["記号"], minLen: 8, maxLen: 16, score: 360, // 120 * 3
        killSound: 5, killedEffect: "boss1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    RED_CIRCLE_LARGE_STRIPE: {
        id: "red_circle_large_stripe", name: "FastTrigger",
        color: "#ff4d4f", shape: "circle", pattern: "stripe", size: 28,
        speed: 1.2, rotationSpeed: 0.03, damage: 25,
        tags: ["記号"], minLen: 10, maxLen: 18, score: 180, // 120 * 1.5
        killSound: 5, killedEffect: "boss1", damageSound: 1
    },
    RED_SQUARE_NORMAL: {
        id: "red_square_normal", name: "Rootkit",
        color: "#ff4d4f", shape: "square", pattern: null, size: 20,
        speed: 0.3, rotationSpeed: 0.01, damage: 15,
        tags: ["記号"], minLen: 5, maxLen: 10, score: 50, // 60 * 0.7 * 1.2
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    RED_SQUARE_NORMAL_RING: {
        id: "red_square_normal_ring", name: "EncryptedRootkit",
        color: "#ff4d4f", shape: "square", pattern: "ring", size: 20,
        speed: 0.4, rotationSpeed: 0.01, damage: 15,
        tags: ["記号"], minLen: 3, maxLen: 8, score: 151, // 50 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },
    RED_SQUARE_NORMAL_STRIPE: {
        id: "red_square_normal_stripe", name: "FastRootkit",
        color: "#ff4d4f", shape: "square", pattern: "stripe", size: 20,
        speed: 0.6, rotationSpeed: 0.015, damage: 15, // 0.4 * 1.5, 0.01 * 1.5
        tags: ["記号"], minLen: 5, maxLen: 10, score: 75, // 50 * 1.5
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    RED_SQUARE_SMALL: {
        id: "red_square_small", name: "Panic",
        color: "#ff4d4f", shape: "square", pattern: null, size: 14,
        speed: 0.3, rotationSpeed: 0.01, damage: 8,
        tags: ["記号"], minLen: 2, maxLen: 4, score: 34, // 60 * 0.7 * 0.8
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },
    RED_SQUARE_SMALL_RING: {
        id: "red_square_small_ring", name: "PersistentPanic",
        color: "#ff4d4f", shape: "square", pattern: "ring", size: 14,
        speed: 0.4, rotationSpeed: 0.01, damage: 8,
        tags: ["記号"], minLen: 1, maxLen: 2, score: 102, // 34 * 3
        killSound: 1, killedEffect: "enemy1", damageSound: 1,
        hitCount: 2, knockback: 40
    },

    // 以下はテストね
    SLIME:{
        id:"slime",
        name:"スライム",

        size:16,
        damage:10,
        hitCount:1, 
        speed:0.7,

        score:10,
        killSound:1,
        killedEffect:"enemy1",
        damageSound:1,

        tags:[], // ← 制限なし
        minLen:2,
        maxLen:3,
        //spawnWeight:50,

        // 見た目設定
        shape:"circle",     // 形（circle / square など）
        pattern:"stripe", // 模様（かざぐるま）
        rotationSpeed: 0,
        color:"#66ccff",
    },

    GOBLIN:{
        id:"goblin",
        name:"ゴブリン",

        size:18,
        damage:5,
        hitCount:1, 
        speed:0.6,

        score:20,
        killSound:2,
        killedEffect:"enemy1",
        damageSound:1,

        tags:["英語"],
        minLen:3,
        maxLen:6,
        //spawnWeight:30,

        // 見た目設定
        shape:"square",     // 四角
        pattern:null,
        rotationSpeed: 0.02,  
        color:"#a3a3a3",
    },

    OGRE:{
        id:"orge",
        name:"オーガ",

        size:25,
        damage:10,
        hitCount:1, 
        speed:0.5,

        score:40,
        killSound:3,
        killedEffect:"enemy1",
        damageSound:1,

        tags:["句読点","促音"],
        minLen:5,
        maxLen:20,
        //spawnWeight:20,

        // 見た目設定
        shape:"pinwheel",
        pattern:null,     // 同心円
        rotationSpeed: 0.03,
        color:"#525252",
    },

    BOSS:{
        id:"boss",
        name:"ボス",

        size:28,
        damage:30,
        hitCount:2,
        knockback:50, 
        speed:0.05,

        score:200,
        killSound:5,
        killedEffect:"boss1",
        damageSound:1,

        tags:["句読点","促音","英語"],
        minLen:3,
        maxLen:20,
        //spawnWeight:5,

        // 見た目設定
        shape:"circle",
        pattern:"ring", // 回転＋強調でボス感
        rotationSpeed: 0,
        color:"#474747",

        // 行動パターン
        behaviors:[
            {
                type:"spawn",
                interval:5,
                preDelay:1.5,
                spawnType:"slime",
                count:2
            },
            {
                type:"shoot",
                interval:6,
                preDelay:1.5,
                bullet:{
                    count:3,
                    speed:0.5,
                    homing:0.03,
                    damage:5,
                    size:10,
                    color:"#ed6f6f",
                    shape:"arrow",
                    pattern: null,
                    rotationSpeed:1
                }
            }
        ]
    }
};


// =================================
// アイテム
/*
shape: "circle" "square" "pinwheel"
pattern: "stripe"  "ring"
tags: ["句読点","促音","英語", "記号","ことわざ","擬音"]
*/
// =================================

export const ItemTypes = {
    // --- HEAL (緑系 / KillSound 7) ---
    // 小回復: 標準タグ、短文
    HEAL_SMALL: {
        id: "heal_small", name: "小回復", effect: "heal", value: 20,
        killSound: 7, killedEffect: "item1", tags: [], minLen: 2, maxLen: 3, lifetime: 6,
        size: 12, speed: 0, color: "#4ade80", shape: "hexagon", pattern: null,
    },
    // 中回復: 句読点タグ、中難度
    HEAL_MEDIUM: {
        id: "heal_medium", name: "中回復", effect: "heal", value: 50,
        killSound: 7, killedEffect: "item1", tags: ["句読点"], minLen: 5, maxLen: 8, lifetime: 10,
        size: 14, speed: 0, color: "#22c55e", shape: "hexagon", pattern: null,
    },
    // 大回復: 句読点タグ、長文
    HEAL_LARGE: {
        id: "heal_large", name: "大回復", effect: "heal", value: 100,
        killSound: 7, killedEffect: "item1", tags: ["句読点"], minLen: 10, maxLen: 16, lifetime: 16,
        size: 16, speed: 0, color: "#16a34a", shape: "hexagon", pattern: null,
    },
    // 全回復: 句読点タグ、最長文
    HEAL_FULL: {
        id: "heal_full", name: "全回復", effect: "heal", value: "full",
        killSound: 7, killedEffect: "item1", tags: ["句読点"], minLen: 12, maxLen: 20, lifetime: 18,
        size: 16, speed: 0, color: "#14532d", shape: "hexagon", pattern: null,
    },

    // --- KILL (赤系 / KillSound 4) ---
    // ボム: 標準タグ、短文
    KILL_SMALL: {
        id: "kill_small", name: "ボム", effect: "kill", value: 1,
        killSound: 4, killedEffect: "item1", tags: [], minLen: 2, maxLen: 3, lifetime: 6,
        size: 12, speed: 0, color: "#f87171", shape: "hexagon", pattern: null,
    },
    // メガボム: 記号タグ、中難度
    KILL_MEDIUM: {
        id: "kill_medium", name: "メガボム", effect: "kill", value: 3,
        killSound: 4, killedEffect: "item1", tags: ["記号"], minLen: 6, maxLen: 10, lifetime: 12,
        size: 14, speed: 0, color: "#ef4444", shape: "hexagon", pattern: null,
    },
    // 大ボム: 記号タグ、長文
    KILL_LARGE: {
        id: "kill_large", name: "大ボム", effect: "kill", value: 5,
        killSound: 4, killedEffect: "item1", tags: ["記号"], minLen: 12, maxLen: 20, lifetime: 18,
        size: 16, speed: 0, color: "#b91c1c", shape: "hexagon", pattern: null,
    },
    // 殲滅: 記号タグ、最長文
    KILL_ALL: {
        id: "kill_all", name: "殲滅", effect: "kill", value: "all",
        killSound: 4, killedEffect: "item1", tags: ["記号"], minLen: 15, maxLen: 25, lifetime: 20,
        size: 16, speed: 0, color: "#991b1b", shape: "hexagon", pattern: null,
    },

    // --- FREEZE (青系 / KillSound 7) ---
    // プチ凍結: 標準タグ、短文
    FREEZE_SMALL: {
        id: "freeze_small", name: "プチ凍結", effect: "freeze", value: 2,
        killSound: 7, killedEffect: "item1", tags: [], minLen: 2, maxLen: 3, lifetime: 6,
        size: 12, speed: 0, color: "#60a5fa", shape: "hexagon", pattern: null,
    },
    // フリーズ: 促音タグ、中難度
    FREEZE_MEDIUM: {
        id: "freeze_medium", name: "フリーズ", effect: "freeze", value: 4,
        killSound: 7, killedEffect: "item1", tags: ["促音"], minLen: 5, maxLen: 9, lifetime: 11,
        size: 14, speed: 0, color: "#3b82f6", shape: "hexagon", pattern: null,
    },
    // 大凍結: 促音タグ、長文
    FREEZE_LARGE: {
        id: "freeze_large", name: "大凍結", effect: "freeze", value: 6,
        killSound: 7, killedEffect: "item1", tags: ["促音"], minLen: 10, maxLen: 16, lifetime: 16,
        size: 16, speed: 0, color: "#1d4ed8", shape: "hexagon", pattern: null,
    },

    // --- COOLDOWN (紫系 / KillSound 7) ---
    // プチ短縮: 標準タグ、短文
    COOLDOWN_SMALL: {
        id: "cooldown_small", name: "プチ短縮", effect: "cooldown", value: 5,
        killSound: 7, killedEffect: "item1", tags: [], minLen: 2, maxLen: 3, lifetime: 6,
        size: 12, speed: 0, color: "#c084fc", shape: "hexagon", pattern: null,
    },
    // 短縮: 英語タグ、中難度
    COOLDOWN_MEDIUM: {
        id: "cooldown_medium", name: "短縮", effect: "cooldown", value: 15,
        killSound: 7, killedEffect: "item1", tags: ["英語"], minLen: 5, maxLen: 10, lifetime: 12,
        size: 14, speed: 0, color: "#a855f7", shape: "hexagon", pattern: null,
    },
    // 大短縮: 英語タグ、長文
    COOLDOWN_LARGE: {
        id: "cooldown_large", name: "大短縮", effect: "cooldown", value: 30,
        killSound: 7, killedEffect: "item1", tags: ["英語"], minLen: 12, maxLen: 20, lifetime: 18,
        size: 16, speed: 0, color: "#7e22ce", shape: "hexagon", pattern: null,
    },
    // ストック追加: 英語タグ、中〜長文、ストック+1
    COOLDOWN_STOCK: {
        id: "cooldown_stock", name: "ストック", effect: "stock", value: 1,
        killSound: 7, killedEffect: "item1", tags: ["英語"], minLen: 14, maxLen: 22, lifetime: 22,
        size: 16, speed: 0, color: "#c084fc", shape: "hexagon", pattern: null,
    },

    // 以下テストね

     HEAL_SMALL:{
        id:"heal_small",
        name:"回復",

        effect:"heal",
        value:20,

        killSound:7,
        killedEffect:"item1",

        tags:[], // ← 制限なし
        minLen:2,
        maxLen:3,

        lifetime:6, //消えるまでの時間 sec

        size:10,
        speed:0,

        color:"#4ade80",
        shape:"hexagon",
        pattern: null,
    },

    HEAL_FULL:{
        id:"heal_full",
        name:"全回復",

        effect:"heal",
        value:"full",

        killSound:7,
        killedEffect:"item1",

        tags:[], // ← 制限なし
        minLen:2,
        maxLen:3,

        lifetime:5,

        size:15,
        speed:0,

        color:"#22c55e",
        shape:"hexagon",
        pattern: null,
    },

    BOMB:{
        id:"bomb",
        name:"ボム",

        effect:"kill",
        value:3,

        killSound:4,
        killedEffect:"item1",

        tags:[], // ← 制限なし
        minLen:2,
        maxLen:3,

        lifetime:6,

        size:10,

        color:"#f87171",
        shape:"hexagon",
        pattern: null,
    },

    BOMB_ALL:{
        id:"bomb_all",
        name:"殲滅",

        effect:"kill",
        value:"all",

        killSound:4,
        killedEffect:"item1",

        tags:[], // ← 制限なし
        minLen:2,
        maxLen:3,

        lifetime:6,

        size:10,

        color:"#dc2626",
        shape:"hexagon",
        pattern: null,
    },

    FREEZE:{
        id:"freeze",
        name:"フリーズ",

        effect:"freeze",
        value:5, //秒

        killSound:7,
        killedEffect:"item1",

        tags:[], // ← 制限なし
        minLen:2,
        maxLen:3,

        lifetime:5,

        size:10,

        color:"#60a5fa",
        shape:"hexagon",
        pattern: null,
    },

    SKILL_CD:{
        id:"skill_cd",
        name:"短縮",

        effect:"cooldown",
        value:15, //sec

        killSound:7,
        killedEffect:"item1",

        tags:[], // ← 制限なし
        minLen:2,
        maxLen:3,

        lifetime:5,

        size:10,

        color:"#c084fc",
        shape:"hexagon",
        pattern: null,
    }
};