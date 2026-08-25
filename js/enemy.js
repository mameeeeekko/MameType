// enemy.js

import { getUISafeTop, markDamageTaken, onEnemyRemovedByDamage, killEnemy } from "./enemyCore.js";
import { playDamageSound, spawnHitWave, spawnDamagePopup, spawnItemSkillEffect, 
    spawnLaserEffect, spawnPlayerDamageEffect, spawnPlayerNegateEffect} from "./effectManager.js";
import { getSoundSettings, getSoundEnabled } from "./gameCore.js";
import { buildBaseRomaji } from "./typingLogic.js";
import { getRandomWordForType, getWordForBehavior } from "./enemySpawner.js"; 
import { devOverride } from "../dev/devOverride.js";
import { addQuestItemPickup } from "./questPlayerStats.js";
import { getPlayerStatsForEnemy } from "./questPlayerStats.js";
import { getUIAnchorPosition } from "./enemyRenderer.js";

// =====================================================
// 敵タイプ生成ルール
/*
 【基本設計ルール】
 1. 色と対応タグ（スコア順：赤 > 緑 > 黄 > ピンク > 青 > 紫 > グレー）
    - 赤 (#ff4d4f): 記号、数字 ["記号","数字"] (Score: 60)
    - 緑 (#73d13d): 句読点 ["句読点"] (Score: 55)
    - 黄 (#fadb14): ことわざ ["ことわざ"] (Score: 50)
    - ピンク (#ff85c0): 擬音 ["擬音"] (Score: 45)
    - 青 (#40a9ff): 促音 ["促音"] (Score: 40)
    - 紫 (#b37feb): 英語 ["英語"] (Score: 35)
    - グレー (#a4a4a4): 標準 [] (Score: 30)

 2. 形とスピード（早いほど高スコア）
    - pinwheel (高速): speed 1.0, rotation 0.05 (Score x1.5)
    - circle   (標準): speed 0.8, rotation 0.02 (Score x1.0)
    - square   (低速): speed 0.4, rotation 0.01 (Score x0.7)

 3. サイズと難易度（大きいほど高ダメージ・長文・高スコア）
    - Large  (size:28): damage:60, len:8-15 (Score x2.0)
    - Normal (size:20): damage:30, len:5-10  (Score x1.2)
    - Small  (size:14): damage:15,  len:2-4   (Score x0.8)

 4. パターンによる特殊効果
    - ring (同心円): hitCount 2 / knockback 40 / スコア 3倍（強力個体）
    - stripe (縞々): スピード 1.2倍 / rotationSpeed 1.2倍 / スコア 1.5倍（高速個体）
    - null (無地): 標準

*/
// =====================================================

const COLOR_PROPS = {
    RED:    { name: "Red",    color: "#ff4d4f", tags: ["記号", "数字"], baseScore: 60 },
    GREEN:  { name: "Green",  color: "#73d13d", tags: ["句読点"],       baseScore: 55 },
    YELLOW: { name: "Yellow", color: "#fadb14", tags: ["ことわざ"],     baseScore: 50 },
    PINK:   { name: "Pink",   color: "#ff85c0", tags: ["擬音"],         baseScore: 45 },
    PURPLE: { name: "Purple", color: "#b37feb", tags: ["英語"],         baseScore: 40 },
    BLUE:   { name: "Blue",   color: "#40a9ff", tags: ["促音"],         baseScore: 35 },
    GRAY:   { name: "Gray",   color: "#a4a4a4", tags: [],               baseScore: 30 },
};

const SHAPE_PROPS = {
    PINWHEEL: { name: "Pinwheel", shape: "pinwheel", speed: 0.7, rotationSpeed: 0.05, scoreMultiplier: 1.5 },
    CIRCLE:   { name: "Circle",   shape: "circle",   speed: 0.5, rotationSpeed: 0.02, scoreMultiplier: 1.0 },
    SQUARE:   { name: "Square",   shape: "square",   speed: 0.35, rotationSpeed: 0.01, scoreMultiplier: 0.7 },
};

const SIZE_PROPS = {
    LARGE:  { name: "Large",  size: 28, damage: 60, minLen: 8, maxLen: 15, scoreMultiplier: 2.0, killSound: 5, killedEffect: "enemy2" },
    NORMAL: { name: "Normal", size: 20, damage: 30, minLen: 5,  maxLen: 10, scoreMultiplier: 1.2, killSound: 1, killedEffect: "enemy1" },
    SMALL:  { name: "Small",  size: 12, damage: 15, minLen: 2,  maxLen: 4,  scoreMultiplier: 0.8, killSound: 1, killedEffect: "enemy1" },
};

const PATTERN_PROPS = {
    RING:   { name: "Ring",   pattern: "ring",   hitCount: 2, knockback: 80, scoreMultiplier: 3.0 },
    STRIPE: { name: "Stripe", pattern: "stripe", speedMultiplier: 1.2, rotationSpeedMultiplier: 1.2, scoreMultiplier: 1.5 },
    NULL:   { name: "Null",   pattern: null },
};

/**
 * ルールに基づいて敵タイプを生成する関数
 * @param {object} colorProp - COLOR_PROPSのいずれか
 * @param {object} shapeProp - SHAPE_PROPSのいずれか
 * @param {object} sizeProp - SIZE_PROPSのいずれか
 * @param {object} patternProp - PATTERN_PROPSのいずれか
 * @returns {object} 生成された敵タイプのオブジェクト
 */
function createEnemyType(colorProp, shapeProp, sizeProp, patternProp) {
    let finalSizeProp = sizeProp;
    let finalId, finalName;

    // ★★★ ことわざ(Yellow)には短い単語がないため、SMALLサイズをNORMALサイズに強制変換する
    if (colorProp.name === 'Yellow' && sizeProp.name === 'Small') {
        finalSizeProp = SIZE_PROPS.NORMAL;
        // IDと名前もNORMALのものに強制的に書き換える
        finalId = `${colorProp.name}_${shapeProp.name}_${finalSizeProp.name}${patternProp.name !== 'Null' ? `_${patternProp.name}` : ''}`.toUpperCase();
        finalName = `${colorProp.name} ${shapeProp.name} ${finalSizeProp.name}${patternProp.name !== 'Null' ? ` ${patternProp.name}` : ''}`;
    }
    // ★★★

    let finalSpeed = shapeProp.speed;
    let finalRotationSpeed = shapeProp.rotationSpeed;
    let finalScore = colorProp.baseScore * shapeProp.scoreMultiplier * sizeProp.scoreMultiplier;

    const enemyData = {
        id: finalId || `${colorProp.name}_${shapeProp.name}_${sizeProp.name}${patternProp.name !== 'Null' ? `_${patternProp.name}` : ''}`.toUpperCase(),
        name: finalName || `${colorProp.name} ${shapeProp.name} ${sizeProp.name}${patternProp.name !== 'Null' ? ` ${patternProp.name}` : ''}`,
        color: colorProp.color,
        shape: shapeProp.shape,
        pattern: patternProp.pattern,
        size: finalSizeProp.size,
        damage: finalSizeProp.damage,
        tags: colorProp.tags,
        minLen: finalSizeProp.minLen,
        maxLen: finalSizeProp.maxLen,
        killSound: sizeProp.killSound,
        killedEffect: sizeProp.killedEffect,
        damageSound: 1,
    };

    if (patternProp.pattern === 'stripe') {
        finalSpeed *= patternProp.speedMultiplier;
        finalRotationSpeed *= patternProp.rotationSpeedMultiplier;
        finalScore *= patternProp.scoreMultiplier;
    } else if (patternProp.pattern === 'ring') {
        Object.assign(enemyData, {
            hitCount: patternProp.hitCount,
            knockback: patternProp.knockback,
        });
        finalScore *= patternProp.scoreMultiplier;
    }

    enemyData.speed = finalSpeed;
    enemyData.rotationSpeed = finalRotationSpeed;
    enemyData.score = Math.round(finalScore);

    return enemyData;
}

/**
 * 全ての敵タイプを自動生成する
 * @returns {object} EnemyTypesオブジェクト
 */
function generateAllEnemyTypes() {
    const types = {};
    for (const colorKey in COLOR_PROPS) {
        for (const shapeKey in SHAPE_PROPS) {
            for (const sizeKey in SIZE_PROPS) {
                for (const patternKey in PATTERN_PROPS) {
                    // 特定の組み合わせをスキップするルール（もしあれば）
                    // 例: if (sizeKey === 'LARGE' && patternKey === 'RING') continue;

                    const enemy = createEnemyType(
                        COLOR_PROPS[colorKey],
                        SHAPE_PROPS[shapeKey],
                        SIZE_PROPS[sizeKey],
                        PATTERN_PROPS[patternKey]
                    );
                    types[enemy.id] = enemy;
                }
            }
        }
    }
    return types;
}

// 同じ敵をださない。
function getUnusedLetter(state, charType = 'alphabet') {
    const pools = {
        alphabet: "abcdefghijklmnopqrstuvwxyz".split(""),
        number: "0123456789".split(""),
        symbol: "!?,.-[]()@%:*+;".split(""),
        all: "abcdefghijklmnopqrstuvwxyz0123456789!?,.-[]()@%:*+;".split("")
    };

    // charTypeが未指定または不正な場合は alphabet を使用
    const letters = pools[charType] || pools.alphabet;

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
        this.activeAttack = null; // 攻撃準備中のデータ
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
        // ダメージを受けた時
        if(dist < player.radius + this.type.size){

            // ★追加：ボス接触は即死（復活スキル対象外）
            const isBoss =
                this.type?.id?.includes("boss") ||
                this.isBoss;

            if (isBoss) {
                player.lastDeathCause = "boss_contact";
                player.hp = 0;
                this.isDead = true;

                markDamageTaken();
                onEnemyRemovedByDamage(this.isObjective);

                return false;
            }

            // ここから下は通常敵の処理（既存そのまま）
            if (getSoundEnabled() && getSoundSettings().soundeffect) {
                playDamageSound(this.type.damageSound);
            }
            spawnHitWave(player.x, player.y);

            const damage = calcDamage(this.type, player, difficulty); // 変更なし（正しい）

            // 無敵タイマーがあればダメージ無効
            if (player.invincibleTimer > 0) {
                spawnPlayerNegateEffect(player.x, player.y);
                markDamageTaken();
                onEnemyRemovedByDamage(this.isObjective);
                this.isDead = true;
                return false;
            }

            // パッシブの確率無効化判定
            try {
                const statsMode = state.isQuestMode ? "quest" : "enemy";
                const stats = getPlayerStatsForEnemy(statsMode);
                const negateChance = Number(stats.damageNegateChance) || 0;

                const isBoss =
                    this.type?.id?.includes("boss") ||
                    this.isBoss;

                if (
                    !isBoss &&
                    Math.random() < negateChance
                ) {
                    spawnPlayerNegateEffect(player.x, player.y);
                    markDamageTaken();
                    onEnemyRemovedByDamage(this.isObjective);
                    this.isDead = true;
                    return false;
                }
            } catch (e) {
                // ignore
            }

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
        const moveSpeed = this.speed * 0.7 * lengthPenalty * (difficulty.enemy?.enemySpeed ?? 1);

        if (!this.activeAttack) {
            this.x += dx / dist * moveSpeed * scale;
            this.y += dy / dist * moveSpeed * scale;
        }
        this.rotation += this.rotationSpeed * scale;

        // 近接分離：他の敵と重ならないように軽く押し戻す
        try {
            const minGap = 4;
            for (const other of state.enemies || []) {
                if (!other || other === this || other.isDead) continue;
                const otherR = other.type?.size || other.radius || 15;
                const myR = this.type?.size || this.radius || 15;
                const dxo = this.x - other.x;
                const dyo = this.y - other.y;
                const d = Math.hypot(dxo, dyo) || 0.0001;
                const desired = myR + otherR + minGap;
                if (d < desired) {
                    const overlap = desired - d;
                    const push = overlap * 0.5; // 自分側に少し押し戻す
                    this.x += (dxo / d) * push;
                    this.y += (dyo / d) * push;
                }
            }
        } catch (err) {
            // 安全のため失敗しても無視
        }

        // behaviors処理 敵が出す弾や、召喚する敵の処理
        this.updateBehaviors(player, difficulty, state, deltaTime);

        // UI侵入防止
        const uiTop = getUISafeTop();
        if(this.y < uiTop){
            this.y = uiTop;
        }

        return !this.isDead;
    }

    // ====================================
    // 敵の行動処理
    // =====================================
    updateBehaviors(player, difficulty, state, deltaTime){

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

                    if (behavior.type === "attack") {
                        const wordData = getWordForBehavior(behavior);
                        if (wordData) {
                            this.activeAttack = {
                                id: "atk_" + Math.random().toString(36).substr(2, 9),
                                word: wordData.word,
                                text: wordData.text,
                                isAttack: true,
                                baseRomaji: buildBaseRomaji(wordData.text),
                                pos: 0,
                                typed: "",
                                inputedRomaji: "",
                                ref: this // 参照用
                            };
                        }
                    }

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

                    case "attack":
                        this.executeLaserAttack(
                            behavior,
                            player,
                            state,
                            difficulty
                        );
                        break;

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

    executeLaserAttack(behavior, player, state, difficulty) {
        const atk = this.activeAttack;
        if (!atk) return;

        const completionRatio = atk.text ? (atk.pos / atk.text.length) : 0;
        const baseDamage = Math.floor(behavior.damage * (1 - completionRatio));

        // ダメージ計算（防御反映）
        const damage = calcDamage({ damage: baseDamage }, player, difficulty);

        // エフェクト演出
        const options = {
            attenuated: completionRatio >= 0.5,
            diffused: completionRatio > 0,
            completionRatio: completionRatio
        };

        // ★先にダメージ計算とHP減少を行う
        if (damage > 0) {
            player.hp = Math.max(0, player.hp - damage);
            markDamageTaken();
        }

        // ★ダメージの有無に関わらず、レーザーとポップアップエフェクトを生成
        spawnLaserEffect(this.x, this.y, player.x, player.y, options);
        if (damage > 0) {
            spawnPlayerDamageEffect(player.x, player.y);
            spawnDamagePopup(player.x, player.y - 20, damage);
        }

        this.activeAttack = null;
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

            // 既存の敵や弾と重ならないように位置を微調整
            const maxAdjust = 6;
            let adjX = x;
            let adjY = y;
            let adjusted = false;
            for (let a = 0; a < maxAdjust; a++) {
                let conflict = false;
                for (const e of [...state.enemies, ...(state.enemyBullets || [])]) {
                    if (!e || e.isDead) continue;
                    const otherR = e.type?.size || e.radius || 15;
                    const d = Math.hypot(adjX - e.x, adjY - e.y);
                    if (d < (otherR + (enemyType.size || 15) + 8)) {
                        conflict = true;
                        break;
                    }
                }
                if (!conflict) {
                    adjusted = true;
                    break;
                }
                // 角度を少しずらして離す
                const shift = (a + 1) * 12;
                adjX = this.x + Math.cos(angle + shift * 0.0174533) * (radius + a * 10);
                adjY = this.y + Math.sin(angle + shift * 0.0174533) * (radius + a * 10);
            }

            const enemy = createEnemyByType(
                enemyType, adjX, adjY, state
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
                // behavior.bullet 内に設定された charType を参照する
                const charType = behavior.bullet.charType || 'alphabet';
                letter = getUnusedLetter(state, charType);
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
                this.baseRomaji = buildBaseRomaji(this.text);
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

            // 弾によるダメージは防御を反映するため calcDamage を使う
            const damage = calcDamage(this.type, player, difficulty); // ★ .enemy を削除

            if (player.invincibleTimer > 0) {
                spawnPlayerDamageEffect(player.x, player.y, "GUARD", "#9befff");
                this.isDead = true;
                return false;
            }

            try {
                const statsMode = state.isQuestMode ? "quest" : "enemy";
                const stats = getPlayerStatsForEnemy(statsMode);
                const negateChance = Number(stats.damageNegateChance) || 0;
                if (Math.random() < negateChance) {
                    spawnPlayerDamageEffect(player.x, player.y, "GUARD", "#9befff");
                    this.isDead = true;
                    return false;
                }
            } catch (e) {}

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

    // 防御による減衰（diminishing returns）方式
    // defFactor = 1 - DEF/(DEF + K)  => 実際の被ダメージ割合
    // 下限は 0.2（20%）にクランプ
    const K = 25; // バランス定数（5〜100 のダメージ帯を想定して調整済み）
    const diffMultiplier = difficulty.enemy?.damageMultiplier ?? 1;

    // player.defense が未定義の場合（何らかの初期化順の問題がある場合）
    // クエスト用の最終ステータスからフォールバックして取得する
    let defense = Number(player.defense);
    if (typeof defense === "number" && !isFinite(defense)) defense = NaN;
    if (isNaN(defense)) {
        try {
            const statsMode = gameState.isQuestMode ? "quest" : "enemy";
            const stats = getPlayerStatsForEnemy(statsMode);
            defense = Number(stats.defense) || 0;
        } catch (e) {
            defense = 0;
        }
    }
    const defenseFactor = 1 - defense / (defense + K);
    const clampedDefenseFactor = Math.max(0.2, defenseFactor); // 最低20%のダメージを保証

    let damage = Math.floor(baseDamage * clampedDefenseFactor * diffMultiplier);

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

        this.baseRomaji = buildBaseRomaji(this.text);
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
                    e => e && !e.isDead && !e.isItem && !e.type?.id?.includes("boss")
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
                        if(type===1) playSE("kill1",0.35);
                        if(type===2) playSE("kill2",0.5);
                        if(type===3) playSE("kill3",0.5);
                        if(type===4) playSE("killLaser",0.5);
                        if(type===5) playSE("kill5",0.5);
                        if(type===6) playSE("killBullet",0.5,1,0,1);
                        if(type===7) playSE("killItem",0.5,1,0,1);
damageSound     : 接触SE番号
killedEffect    : 撃破エフェクトID enemy1, enemy2, midboss1,boss1,boss2 bullet
shape           : 形状ID
pattern         : 模様ID

【問題生成】
tags            : 使用タグ
minLen          : 最小文字数
maxLen          : 最大文字数

対応タグ:
[ "", "句読点", "促音", "英語","記号","ことわざ","擬音"]

【見た目】
color           : 本体色
shape           : "circle", "square", "pinwheel", "arrow", "hexagon", "chip", "gate", "pulsar", "relay", "glitch_tri", "core_unit", "shard", "array", "terminal", "omega", "diamond", "rhombus", "shield", "star", "cross", "triangle", "gear", "clover", "octagon", "nova"
pattern         : null, "stripe", "ring", "circuit"
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
            charType: "all" , "alphabet" , "number" , "symbol"
        }
    }
]
*/
// =====================================================

export const EnemyTypes = generateAllEnemyTypes();

// --- ボスや特殊な敵はここで個別に追加・上書き ---
Object.assign(EnemyTypes, {
    GRAY_CIRCLE_SMALL_LEGACY: { // Example of keeping an old one if needed, or just overwrite
        id: "gray_circle_small", name: "Cookie",
        color: "#a4a4a4", shape: "circle", pattern: null, size: 14,
        speed: 0.6, rotationSpeed: 0.02, damage: 10,
        tags: [], minLen: 2, maxLen: 6, score: 24, // 30 * 1.0 * 0.8
        killSound: 1, killedEffect: "enemy1", damageSound: 1
    },

    // --- ボスシリーズ ---

    MID_BOSS_1: {
        id: "mid_boss_1", name: "中ボス 1: Sentinel",
        color: "#d0c4b7", shape: "octagon", pattern: "honeycomb", size: 35,
        speed: 0.4, rotationSpeed: 0.02, damage: 30,
        tags: ["", "促音"], minLen: 12, maxLen: 18, score: 500,
        killSound: 3, killedEffect: "midboss1", damageSound: 1,
        hitCount: 3, knockback: 40
    },

    MID_BOSS_2: {
        id: "mid_boss_2", name: "中ボス 2: Guardian",
        color: "#13c2c2", shape: "clover", pattern: "circuit", size: 35,
        speed: 0.5, rotationSpeed: 0.015, damage: 35,
        tags: ["", "句読点", "ことわざ"], minLen: 12, maxLen: 18, score: 800,
        killSound: 3, killedEffect: "midboss1", damageSound: 1,
        hitCount: 4, knockback: 45,
        behaviors: [
            { type: "spawn", interval: 20, preDelay: 2, spawnType: "gray_circle_small", count: 1 },
        ]
    },

    MID_BOSS_3: {
        id: "mid_boss_3", name: "中ボス 3: Gatekeeper",
        color: "#fa8c16", shape: "relay", pattern: "circuit", size: 35,
        speed: 0.6, rotationSpeed: 0.02, damage: 42,
        tags: ["", "英語"], minLen: 14, maxLen: 20, score: 1200, killedEffect: "midboss1",
        killSound: 3, damageSound: 1,
        hitCount: 5, knockback: 45,
        behaviors:[
            { type: "attack", interval: 25, preDelay: 10, tags: ["","英語"], minLen: 3, maxLen: 6, damage: 20 },
        ]
    },

    BOSS_1: {
        id: "boss_1", name: "ボス 1: Overlord",
        color: "#eb2f96", shape: "chip", pattern: "circuit", size: 40,
        speed: 0.2, rotationSpeed: 0.04, damage: 40,
        tags: ["", "英語", "擬音"], minLen: 12, maxLen: 18, score: 1500,
        killSound: 5, killedEffect: "boss1", damageSound: 1,
        hitCount: 3, knockback: 30,
        behaviors: [
            { type: "shoot", interval: 5, preDelay: 1.0, bullet: { count: 5, speed: 1.0, damage: 15, size: 12, shape: "arrow", color: "#eb2f96", charType: "alphabet" } }
        ]
    },

    MID_BOSS_4: {
        id: "mid_boss_4", name: "中ボス 4: Breaker",
        color: "#a0d911", shape: "star", pattern: "circuit", size: 40,
        speed: 0.6, rotationSpeed: 0.03, damage: 45,
        tags: ["", "促音", "擬音", "記号"], minLen: 14, maxLen: 20, score: 1400, killedEffect: "midboss1",
        killSound: 3, damageSound: 1,
        hitCount: 5, knockback: 45,
        behaviors: [
            { type: "attack", interval: 15, preDelay: 7, tags: ["","英語"], minLen: 5, maxLen: 8, damage: 40 },
        ]
    },

    MID_BOSS_5: {
        id: "mid_boss_5", name: "中ボス 5: Void",
        color: "#2f54eb", shape: "gear", pattern: "circuit", size: 40,
        speed: 0.9, rotationSpeed: 0.06, damage: 60,
        tags: ["", "ことわざ", "英語"], minLen: 15, maxLen: 22, score: 2000, killedEffect: "midboss1",
        killSound: 3, damageSound: 1,
        hitCount: 5, knockback: 55,
        behaviors: [
            { type: "spawn", interval: 12, preDelay: 1.5, spawnType: ["gray_circle_small","gray_circle_normal"], count: 2 },
        ]
    },

    MID_BOSS_6: {
        id: "mid_boss_6", name: "中ボス 6: Ghost",
        color: "#bfbfbf", shape: "nova", pattern: "circuit", size: 40,
        speed: 0.9, rotationSpeed: 0.01, damage: 70,
        tags: ["", "擬音", "記号"], minLen: 15, maxLen: 22, score: 2200, killedEffect: "midboss1",
        killSound: 3, damageSound: 1,
        hitCount: 6, knockback: 55,
        behaviors: [
            { type: "shoot", interval: 8, preDelay: 1.0, bullet: { count: 5, speed: 1.5, damage: 20, size: 10, shape: "arrow", color: "#bfbfbf", charType: "alphabet" } }
        ]
    },

    BOSS_2: {
        id: "boss_2", name: "ボス 2: Cyber Core",
        color: "#722ed1", shape: "core_unit", pattern: "circuit", size: 40,
        speed: 0.15, rotationSpeed: 0.05, damage: 50,
        tags: ["","句読点", "英語", "記号"], minLen: 15, maxLen: 22, score: 3000,
        killSound: 5, killedEffect: "boss1", damageSound: 1,
        hitCount: 6, knockback: 30,
        behaviors: [
            { type: "spawn", interval: 12, preDelay: 1.5, spawnType: ["gray_circle_small","gray_circle_normal"], count: 2 },
            { type: "shoot", interval: 8, preDelay: 1.0, bullet: { count: 6, speed: 1.5, damage: 25, size: 10, shape: "arrow", color: "#722ed1", charType: "alphabet" } }
        ]
    },

    MID_BOSS_7: {
        id: "mid_boss_7", name: "中ボス 5: Void",
        color: "#2f54eb", shape: "virus", pattern: "circuit", size: 40,
        speed: 0.9, rotationSpeed: 0.06, damage: 60,
        tags: ["", "ことわざ", "英語"], minLen: 15, maxLen: 22, score: 2200, killedEffect: "midboss1",
        killSound: 3, damageSound: 1,
        hitCount: 6, knockback: 55,
        behaviors: [
            { type: "spawn", interval: 10, preDelay: 1.5, spawnType: ["gray_circle_small","gray_circle_normal"], count: 2 },
            { type: "attack", interval: 23, preDelay: 10, tags: ["","ことわざ"], minLen: 8, maxLen: 12, damage: 60 },
        ]
    },

    MID_BOSS_8: {
        id: "mid_boss_8", name: "中ボス 6: Ghost",
        color: "#bfbfbf", shape: "diamond", pattern: "circuit", size: 40,
        speed: 0.9, rotationSpeed: 0.01, damage: 70,
        tags: ["", "擬音", "記号"], minLen: 15, maxLen: 22, score: 2400, killedEffect: "midboss1",
        killSound: 3, damageSound: 1,
        hitCount: 6, knockback: 55,
        behaviors: [
            { type: "shoot", interval: 8, preDelay: 1.0, bullet: { count: 5, speed: 1.5, damage: 30, size: 10, shape: "arrow", color: "#bfbfbf", charType: "number" } },
            { type: "attack", interval: 23, preDelay: 10, tags: ["","英語"], minLen: 8, maxLen: 12, damage: 70 },
        ]
    },

    MID_BOSS_9: {
        id: "mid_boss_9", name: "中ボス 6: Ghost",
        color: "#bfbfbf", shape: "mobius", pattern: "circuit", size: 40,
        speed: 0.9, rotationSpeed: 0.01, damage: 70,
        tags: ["", "擬音", "記号", "英語"], minLen: 15, maxLen: 22, score: 2600, killedEffect: "midboss1",
        killSound: 3, damageSound: 1,
        hitCount: 6, knockback: 55,
        behaviors: [
            { type: "shoot", interval: 10, preDelay: 1.0, bullet: { count: 10, speed: 1.5, damage: 35, size: 10, shape: "arrow", color: "#bfbfbf", charType: "alphabet" } },
            { type: "attack", interval: 23, preDelay: 10, tags: ["","句読点"], minLen: 8, maxLen: 12, damage: 80 },
        ]
    },


    BOSS_3: {
        id: "boss_3", name: "ボス 3: The Admin",
        color: "#cf1322", shape: "omega", pattern: "circuit", size: 40,
        speed: 0.1, rotationSpeed: 0.02, damage: 60,
        tags: ["", "英語", "記号", "句読点", "ことわざ"], minLen: 15, maxLen: 25, score: 5000,
        killSound: 5, killedEffect: "boss2", damageSound: 1,
        hitCount: 7, knockback: 30,
        behaviors: [
            { type: "spawn", interval: 16, preDelay: 1.5, spawnType: ["gray_circle_small","gray_circle_normal"], count: 2 },
            { type: "shoot", interval: 18, preDelay: 0.8, bullet: { count: 5, speed: 1.5, damage: 35, size: 10, color: "#cf1322", shape: "arrow", homing: 0.05, charType: "alphabet" } },
            { type: "shoot", interval: 35, preDelay: 0.8, bullet: { count: 3, speed: 0.4, damage: 35, size: 9, color: "#cf1322", shape: "circle", homing: 0.01, charType: "symbol" } },
            { type: "shoot", interval: 26, preDelay: 0.8, bullet: { count: 3, speed: 0.9, damage: 35, size: 12, color: "#cf1322", shape: "circle", homing: 0.02, charType: "number" } },
            { type: "attack", interval: 45, preDelay: 12, tags: ["","英語"], minLen: 8, maxLen: 12, damage: 120 },
        ]
    },

    LAST_BOSS: {
        id: "last_boss", name: "ラスボス: Singularity",
        color: "#000000", shape: "knot5", pattern: "honeycomb", size: 40,
        speed: 0.1, rotationSpeed: 0.08, damage: 99,
        tags: ["", "英語", "記号", "句読点", "ことわざ", "擬音", "促音"], minLen: 30, maxLen: 100, score: 10000, killedEffect: "boss2",
        killSound: 5, damageSound: 1,
        hitCount: 10, knockback: 30,
        behaviors: [
            { type: "spawn", interval: 10, preDelay: 1.5, spawnType: "gray_circle_normal", count: 1 },
            { type: "spawn", interval: 21, preDelay: 1.5, spawnType: "gray_square_small", count: 1 },
            { type: "spawn", interval: 31, preDelay: 1.5, spawnType: "purple_circle_small", count: 1 },
            { type: "shoot", interval: 15, preDelay: 0.8, bullet: { count: 8, speed: 1.0, damage: 50, size: 10, color: "#000000", shape: "arrow", homing: 0.03, charType: "alphabet" } },
            { type: "shoot", interval: 36, preDelay: 0.8, bullet: { count: 3, speed: 0.4, damage: 50, size: 9, color: "#000000", shape: "circle", homing: 0.01, charType: "symbol" } },
            { type: "shoot", interval: 26, preDelay: 0.8, bullet: { count: 3, speed: 0.9, damage: 50, size: 12, color: "#000000", shape: "circle", homing: 0.02, charType: "number" } },
            { type: "attack", interval: 45, preDelay: 12, tags: ["","英語","句読点"], minLen: 8, maxLen: 12, damage: 200 },
        ]
    }
})

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

};