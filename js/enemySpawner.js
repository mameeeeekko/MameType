import { Enemy, EnemyTypes, ItemEnemy, ItemTypes} from "./enemy.js";
import { getWord } from "./target.js";
import { buildBaseRomaji } from "./typingLogic.js";


// =====================================================
// 共通：weight抽選
// =====================================================

function pickWeightedType(table, typeMap){

    if (!table?.length) return null;

    const total =
        table.reduce((sum, e) => sum + e.weight, 0);

    let r = Math.random() * total;

    for (const e of table) {

        r -= e.weight;

        if (r <= 0) {
            return typeMap[e.type];
        }
    }

    return typeMap[table[0].type];
}

// =====================================================
// 共通：重複なし単語取得
// =====================================================

function getUniqueWord(type, enemies = [], retry = 5){

    const usedTexts =
        new Set(enemies.map(e => e.text));

    while (retry-- > 0) {

        const word =
            getRandomWordForType(type);

        if (
            word &&
            !usedTexts.has(word.text)
        ) {
            return word;
        }
    }

    return null;
}

// =====================================================
// 共通：スポーン位置
// =====================================================

function getSpawnPosition(
    player,
    canvas,
    size
){

    const padding = 10;

    const rect =
        canvas.getBoundingClientRect();

    const canvasWidth = rect.width;
    const canvasHeight = rect.height;

    // UIセーフエリア
    const chainUI =
        document.getElementById("chainUI");

    let uiBottom = 0;

    if (chainUI) {

        const rect =
            chainUI.getBoundingClientRect();

        const canvasRect =
            canvas.getBoundingClientRect();

        uiBottom =
            rect.bottom - canvasRect.top;
    }

    const minX = size + padding;
    const maxX = canvasWidth - size - padding;

    const minY =
        Math.max(size + padding, uiBottom + padding);

    const maxY =
        canvasHeight - size - padding;

    // 円周上
    const angle = Math.random() * Math.PI * 2;
    const dist = 350;

    let x =
        player.x + Math.cos(angle) * dist;

    let y =
        player.y + Math.sin(angle) * dist;

    x = Math.min(Math.max(x, minX), maxX);
    y = Math.min(Math.max(y, minY), maxY);

    return { x, y };
}


/**
 * 敵を生成する
 * 
 * 処理の流れ
 * 1. 現在出ている敵の text を取得
 * 2. TARGETS から未使用ターゲットだけ抽出
 * 3. その中からランダム選択
 * 4. プレイヤーの周囲にスポーン位置を決定
 * 5. Enemyインスタンスを生成して返す
 * 
 * @param {Object} player プレイヤー座標 {x, y}
 * @param {Enemy[]} enemies 現在画面に存在する敵配列
 * @returns {Enemy|null} 生成した敵（生成できない場合は null）
 */

export function spawnEnemy(
    player,
    enemies = [],
    canvas,
    stage,
    diff
){

    const type =
        pickWeightedType(
            stage?.enemyTable,
            EnemyTypes
        );

    if (!type) return null;

    const target =
        getUniqueWord(type, enemies);

    if (!target) return null;

    const pos =
        getSpawnPosition(
            player,
            canvas,
            type.size
        );

    const enemy = new Enemy(
        target.word,
        target.text,
        pos.x,
        pos.y,
        type.speed,
        type
    );

    // 難易度補正
    if (diff) {

        enemy.speed =
            type.speed * diff.enemySpeed;

        enemy.damage =
            type.damage *
            diff.damageMultiplier;

    } else {

        enemy.damage = type.damage;
    }

    enemy.radius = type.size;

    enemy.baseRomaji =
        buildBaseRomaji(enemy.text);

    return enemy;
}

// =====================================================
// アイテム出現関連関数
// =====================================================

export function spawnItemEnemy(state,stage){

    const {player, canvas} = state;

    const config = stage?.itemSpawn;

    if (!config) return;

    // chance
    if (Math.random() > config.chance) {
        return;
    }

    // maxAlive
    const aliveItems =
        state.enemies.filter(
            e => e.isItem && !e.isDead
        );

    if (
        config.maxAlive != null &&
        aliveItems.length >= config.maxAlive
    ) {
        return;
    }

    // type抽選
    const type =
        pickWeightedType(
            stage.itemTable,
            ItemTypes
        );

    if (!type) return;

    // word取得
    const target =
        getUniqueWord(type, state.enemies);

    if (!target) return;

    // position
    const pos =
        getSpawnPosition(
            player,
            canvas,
            type.size
        );

    // item生成
    const item = new ItemEnemy(
        target.word,
        target.text,
        pos.x,
        pos.y,
        type
    );

    state.enemies.push(item);
}

// typeに応じたランダム単語を返す
export function getRandomWordForType(type) {
    // type.tags, minLen, maxLen を getWord に渡す
    const word = getWord(type.tags, type.minLen, type.maxLen);

    if (!word) return null;

    return word;
}
