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

        this.x += dx / dist * this.speed * scale;
        this.y += dy / dist * this.speed * scale;
        this.rotation += this.rotationSpeed * scale;

        // behaviors処理 敵が出す弾や、召喚する敵の処理
        this.updateBehaviors(state, deltaTime);

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
    updateBehaviors(state, deltaTime){

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
                            state
                        );
                        break;

                    case "shoot":
                        this.fireBullet(
                            behavior,
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
    
    spawnChildren(behavior, state){

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

            const x =
                this.x +
                Math.cos(angle)*radius;

            const y =
                this.y +
                Math.sin(angle)*radius;

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

    fireBullet(behavior, state){

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

            const bullet = new BulletEnemy(
                letter,
                this.x,
                this.y,
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
        const speed = this.type.speed;
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
        minLen:5,
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

        size:14,
        speed:0,

        color:"#4ade80",
        shape:"circle",
        pattern:"ring",
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

        size:18,
        speed:0,

        color:"#22c55e",
        shape:"circle",
        pattern:"ring",
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

        size:16,

        color:"#f87171",
        shape:"square",
        pattern:"stripe",
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

        size:22,

        color:"#dc2626",
        shape:"pinwheel",
        rotationSpeed:0.08,
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

        size:18,

        color:"#60a5fa",
        shape:"circle",
        pattern:"stripe",
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

        size:16,

        color:"#c084fc",
        shape:"square",
        pattern:"ring",
    }
};