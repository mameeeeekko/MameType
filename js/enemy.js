// enemy.js

import { getUISafeTop, markDamageTaken, onEnemyRemovedByDamage } from "./enemyCore.js";
import { playDamageSound, spawnHitWave, spawnDamagePopup } from "./effectManager.js";
import { getSoundSettings, getSoundEnabled } from "./gameCore.js";
import { buildBaseRomaji } from "./typingLogic.js";
import { getRandomWordForType } from "./enemySpawner.js"; 
import { devOverride } from "../dev/devOverride.js";

export class Enemy {

  constructor(word, text, x, y, speed, type) {

    this.word = word; // 表示（漢字あり）
    this.text = text; // タイピング用かな

    this.x = x;
    this.y = y;
    this.speed = speed;
    this.type = type;
    this.hitCount = type.hitCount || 1; // 残り問題数
    this.rotation = Math.random() * Math.PI * 2; // 初期角度
    this.rotationSpeed = type.rotationSpeed || 0; // 回転速度

    this.pos = 0;
    this.inputedRomaji = "";
    // 表示基準ローマ字（描画ズレ防止）
    this.baseRomaji = "";
    // ★安全初期化
    this.isDead = false;
   
  }

    update(player, difficulty, state){

        // ★フリーズ判定（最優先）
        const frozen = state?.enemyStats?.freezeTimer > 0;

        if (frozen) {
            state.enemyStats.freezeTimer--;
            return true; // 完全停止
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
            onEnemyRemovedByDamage(); //damage受けた時敵が消えるため、processedCount ++
            this.isDead = true;
            return false;
        }

        this.x += dx/dist * this.speed;
        this.y += dy/dist * this.speed;
        this.rotation += this.rotationSpeed;

        // UI侵入防止
        const uiTop = getUISafeTop();
        if(this.y < uiTop){
            this.y = Math.max(this.y, uiTop);
        }

        return !this.isDead;
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

// =====================================================
// 敵パラメータ
// =====================================================
/*
shape: "circle" "square" "pinwheel"
pattern: "stripe"  "ring"
tags: ["句読点","促音","英語", "記号","ことわざ","擬音"]
*/

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
        speed:1.0,

        score:20,
        killSound:2,
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
        speed:0.3,

        score:200,
        killSound:3,
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
    }

};


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