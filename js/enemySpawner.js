import { Enemy, EnemyTypes, ItemEnemy, ItemTypes } from "./enemy.js";
import { getUISafeTop } from "./enemyCore.js";
import { getWord } from "./target.js";
import { buildBaseRomaji } from "./typingLogic.js";


// =====================================================
// スポーン設定定数
// =====================================================
const SPAWN_RADIUS_BASE = 400;     // スポーンを試みる基本半径
const SPAWN_DISTANCE_MIN = 300;    // プレイヤーからの最低保証距離
const SECONDS_PER_CHAR_BASE = 0.45; // 1文字あたりの許容入力時間（秒）: 0.35 -> 0.45

// =====================================================
// 共通：weight抽選
// =====================================================

function pickWeightedEntry(table) {
    if (!table || !Array.isArray(table) || table.length === 0) return null;
    const total = table.reduce((sum, e) => sum + (e.weight || 0), 0);
    if (total <= 0) return table[0];
    let r = Math.random() * total;
    for (const e of table) {
        r -= (e.weight || 0);
        if (r <= 0) return e;
    }
    return table[table.length - 1];
}

function pickWeightedType(table, typeMap){
    const entry = pickWeightedEntry(table);
    return (entry && typeMap) ? typeMap[entry.type] : null;
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
    size,
    existingEnemies = []
){

    const padding = 10;

    const rect =
        canvas.getBoundingClientRect();

    const canvasWidth = rect.width;
    const canvasHeight = rect.height;

    // UIセーフエリアを取得 (enemyCoreの共通関数を使用)
    const uiTopLimit = getUISafeTop();

    const minX = size + padding;
    const maxX = canvasWidth - size - padding;

    // minY を UIの下端に合わせる
    const minY = Math.max(size + padding, uiTopLimit);

    const maxY =
        canvasHeight - size - padding;

    // 複数回トライして既存敵と重ならない位置を探す
    const attempts = 18;
    const margin = 8; // 最低余白

    for (let i = 0; i < attempts; i++) {
        const angle = Math.random() * Math.PI * 2;
        // 少しランダム幅を持たせた距離
        const dist = SPAWN_RADIUS_BASE + (Math.random() - 0.5) * 120;

        let x = player.x + Math.cos(angle) * dist;
        let y = player.y + Math.sin(angle) * dist;

        x = Math.min(Math.max(x, minX), maxX);
        y = Math.min(Math.max(y, minY), maxY);

        // プレイヤーから一定距離を保つ
        const dx = x - player.x;
        const dy = y - player.y;
        const currentDist = Math.hypot(dx, dy) || 0.0001;

        if (currentDist < SPAWN_DISTANCE_MIN) {
            x = player.x + (dx / currentDist) * SPAWN_DISTANCE_MIN;
            y = player.y + (dy / currentDist) * SPAWN_DISTANCE_MIN;
            x = Math.min(Math.max(x, minX), maxX);
            y = Math.min(Math.max(y, minY), maxY);
        }

        // 重なりチェック
        let ok = true;
        for (const e of existingEnemies) {
            if (!e || e.isDead) continue;
            const otherR = e.type?.size || e.radius || 15;
            const dd = Math.hypot(x - (e.x || 0), y - (e.y || 0));
            if (dd < (size + otherR + margin)) {
                ok = false;
                break;
            }
        }

        if (ok) return { x, y };
    }

    // どれもダメなら最後に一つ作る（既存の位置を最小化して返す）
    const fallbackAngle = Math.random() * Math.PI * 2;
    const fx = Math.min(Math.max(player.x + Math.cos(fallbackAngle) * SPAWN_RADIUS_BASE, minX), maxX);
    const fy = Math.min(Math.max(player.y + Math.sin(fallbackAngle) * SPAWN_RADIUS_BASE, minY), maxY);
    return { x: fx, y: fy };

    // プレイヤーから一定距離（300px）を強制的に保つように調整
    const dx = x - player.x;
    const dy = y - player.y;
    const currentDist = Math.hypot(dx, dy) || 0.0001;

    if (currentDist < SPAWN_DISTANCE_MIN) {
        x = player.x + (dx / currentDist) * SPAWN_DISTANCE_MIN;
        y = player.y + (dy / currentDist) * SPAWN_DISTANCE_MIN;

        // 再度画面内に収める（距離を保てる限界の端に配置される）
        x = Math.min(Math.max(x, minX), maxX);
        y = Math.min(Math.max(y, minY), maxY);
    }

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
    config, // stage または phase
    diff
){
    const entry = pickWeightedEntry(config?.enemyTable);
    if (!entry) return null;

    const type = EnemyTypes[entry.type];
    if (!type) return null;

    const target = getUniqueWord(type, enemies);
    if (!target) return null;

    // 固定座標指定があれば使用、なければランダム
    const pos = entry.pos 
        ? { x: entry.pos.x, y: entry.pos.y } 
        : getSpawnPosition(player, canvas, type.size, enemies);

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

    // 文字数に応じた最低入力時間を確保するための速度調整
    // 0.25 に設定すると、10文字の単語に対して 2.5秒 の到達時間が保証
    const SECONDS_PER_CHAR = SECONDS_PER_CHAR_BASE;
    const FPS = 60;
    const distToPlayer = Math.hypot(pos.x - player.x, pos.y - player.y);
    const minFramesToReach = Math.max(1, target.text.length * SECONDS_PER_CHAR * FPS);
    
    const maxAllowedSpeed = distToPlayer / minFramesToReach;
    enemy.speed = Math.min(enemy.speed, maxAllowedSpeed);

    enemy.baseRomaji =
        buildBaseRomaji(enemy.text);

    return enemy;
}

// =====================================================
// アイテム出現関連関数
// =====================================================

export function spawnItemEnemy(state, config, itemTableOverride){

    const {player, canvas} = state;
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
            itemTableOverride || ItemTypes,
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
            type.size,
            state.enemies
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
    // type.tags, minLen, maxLen を getWord にそのまま渡す
    // 大元の EnemyTypes 定義側で長さを調整することを推奨
    return getWord(type.tags, type.minLen, type.maxLen);
}

export function getWordForBehavior(behavior) {
    return getWord(behavior.tags, behavior.minLen, behavior.maxLen);
}
