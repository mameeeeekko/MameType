import { Enemy, EnemyTypes, ItemEnemy, ItemTypes, spawnBitEnemiesFor } from "./enemy.js";
import { getPlayerStatsForEnemy } from "./questPlayerStats.js";
import { getUISafeMinEnemyY } from "./enemyCore.js";
import { getWord, resolveWordLengthRange } from "./target.js";
import { buildBaseRomaji } from "./typingLogic.js";
import { OVERWHELM_MISSION_NAME, OVERWHELM_MAX_WORD_LENGTH } from "./enemyModeConfig.js";


// =====================================================
// ステージ別の出題文字数上限
// =====================================================

/**
 * 現在のフェーズ／ステージで適用する「出題文字数の上限」を返す。
 * 制限なしの場合は null。
 *
 *  ・config.maxWordLength が明示されていればそれを優先
 *  ・【圧倒】は localStorage に生成済みステージ（QuestStages_Cache）が
 *    残っている可能性があるため、ミッション名からも判定して確実に効かせる
 *
 * @param {Object} config 現在のフェーズ／ステージ
 * @returns {number|null}
 */
function getStageMaxWordLength(config) {
    const explicit = Number(config?.maxWordLength);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;
    if (config?.missionName === OVERWHELM_MISSION_NAME) return OVERWHELM_MAX_WORD_LENGTH;
    return null;
}


// =====================================================
// スポーン設定定数
// =====================================================
const SPAWN_RADIUS_BASE = 500;     // スポーンを試みる基本半径 400 -> 500
const SPAWN_DISTANCE_MIN = 400;    // プレイヤーからの最低保証距離 300 -> 400
const SECONDS_PER_CHAR_BASE = 0.5; // 1文字あたりの許容入力時間（秒）: 0.35 -> 0.5

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

function getUniqueWord(type, enemies = [], retry = 5, maxLenLimit = null){

    const usedTexts =
        new Set(enemies.map(e => e.text));

    while (retry-- > 0) {

        const word =
            getRandomWordForType(type, maxLenLimit);

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
// 共通：テキストラベル込みの当たり判定用矩形
// =====================================================
// 敵1体が実際に占有する領域 = 本体の円＋上部に表示される2行テキストの矩形。
// スポーン時の重なり回避と、移動時の近接分離（enemy.js）で共用する。

const LABEL_CHAR_WIDTH = 11;  // 17px モノスペースフォントの1文字幅（概算）
const LABEL_TOP_MARGIN = 40;  // 上部2行テキスト分の高さ
const LABEL_BOX_PADDING = 6;  // 矩形の余白

/**
 * 敵の表示領域（本体＋上部テキストラベル）を矩形として返す
 * @param {number} x 敵の中心X
 * @param {number} y 敵の中心Y
 * @param {number} size 敵の半径
 * @param {string} text 出題テキスト（かな）
 * @param {string} [word] 表示テキスト（漢字含む）
 * @param {string} [baseRomaji] ローマ字
 * @returns {{x:number, y:number, w:number, h:number}}
 */
export function getLabelBox(x, y, size, text, word = "", baseRomaji = "") {
    const radius = size || 15;
    const textLen = (text?.length || 0);
    const wordLen = (word?.length || 0);
    const romaLen = (baseRomaji?.length || 0) || Math.ceil(textLen * 1.6);

    // 漢字/日本語: 1文字約16〜17px、モノスペースローマ字: 1文字約10.5〜11px
    const textW = textLen * 14;
    const wordW = wordLen * 17;
    const romaW = romaLen * 11;
    const contentW = Math.max(textW, wordW, romaW, radius * 2);

    const padding = 12; // 左右に十分なマージンを確保
    const w = contentW + padding * 2;

    // Y方向:
    // 上段（word）ベースライン: y - radius - 15、文字高さを考慮して上端は約 y - radius - 38
    // 下段（roma）ベースライン: y - radius
    // 敵本体下端: y + radius + 4
    const top = y - radius - 38;
    const bottom = y + radius + 4;
    return { x: x - w / 2, y: top, w, h: bottom - top };
}

/**
 * 敵インスタンスからラベル矩形を取得するヘルパー
 * @param {object} enemy
 * @returns {{x:number, y:number, w:number, h:number}}
 */
export function getEnemyLabelBox(enemy) {
    if (!enemy) return { x: 0, y: 0, w: 0, h: 0 };
    const r = enemy.radius || enemy.type?.size || 15;
    return getLabelBox(enemy.x || 0, enemy.y || 0, r, enemy.text, enemy.word, enemy.baseRomaji);
}

/**
 * 敵の「文字列ラベル部分のみ」の矩形を返す（本体の円は含まない）
 * updateEnemyTextOffsets による文字同士の重なり判定専用。
 * 上段（word）ベースライン: y - radius - 15 / 下段（roma）ベースライン: y - radius
 * @param {object} enemy
 * @returns {{x:number, y:number, w:number, h:number}}
 */
export function getEnemyTextBox(enemy) {
    if (!enemy) return { x: 0, y: 0, w: 0, h: 0 };
    const r = enemy.radius || enemy.type?.size || 15;
    return getTextBox(enemy.x || 0, enemy.y || 0, r, enemy.text, enemy.word, enemy.baseRomaji);
}

/**
 * 文字列（上段word＋下段romaの2行）のみの矩形を計算する
 * @returns {{x:number, y:number, w:number, h:number}}
 */
function getTextBox(x, y, radius, text, word = "", baseRomaji = "") {
    const textLen = (text?.length || 0);
    const wordLen = (word?.length || 0);
    const romaLen = (baseRomaji?.length || 0) || Math.ceil(textLen * 1.6);

    // 漢字/日本語: 1文字約17px、かな: 約14px、モノスペースローマ字: 約11px（概算）
    // 英数字のみの単語は文字幅が狭い（約10px/文字）ため、誤検出を避けて縮めて見積もる
    const isAsciiWord = /^[a-zA-Z0-9\s.,!?-]*$/.test(word || "");
    const wordCharW = isAsciiWord ? 10 : 17;

    const textW = textLen * 14;
    const wordW = wordLen * wordCharW;
    const romaW = romaLen * 11;
    const contentW = Math.max(textW, wordW, romaW);

    const padding = 6; // 左右の余白
    const w = contentW + padding * 2;

    // Y方向（本体を含まない・文字2行分のみ）:
    // 上段（word）: ベースライン y - radius - 15 → 上端は約 y - radius - 29
    // 下段（roma）: ベースライン y - radius → 下端は約 y - radius + 5
    const top = y - radius - 29;
    const bottom = y - radius + 5;
    return { x: x - w / 2, y: top, w, h: bottom - top };
}

/**
 * 2つの矩形が重なるか判定する
 * @returns {boolean}
 */
export function boxesOverlap(a, b) {
    return a.x < b.x + b.w && b.x < a.x + a.w &&
           a.y < b.y + b.h && b.y < a.y + a.h;
}

// =====================================================
// 共通：スポーン位置
// =====================================================

function getSpawnPosition(
    player,
    canvas,
    size,
    existingEnemies = [],
    text = "",
    word = ""
){

    const padding = 10;

    // transform スケールの影響を受けないレイアウトサイズ（ステージ座標）を使用
    const canvasWidth = canvas.clientWidth;
    const canvasHeight = canvas.clientHeight;

    // UIセーフエリア（半径＋上部テキストラベル分も含む）を取得（enemyCoreの共通関数を使用）
    // 敵の「見た目の上端」がUIに重ならないよう、中心Yの下限は uiSafeTop + size + ラベル分 になる
    const uiTopLimit = getUISafeMinEnemyY(size);

    const minX = size + padding;
    const maxX = canvasWidth - size - padding;

    // minY を UIの下端（＋ラベルが重ならない分）に合わせる
    const minY = Math.max(size + padding, uiTopLimit);

    const maxY =
        canvasHeight - size - padding;

    // 複数回トライして既存敵と重ならない位置を探す
    const attempts = 24;

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

        // 重なりチェック（テキストラベル込みの矩形で判定し、文字同士が重なるのを防ぐ）
        let ok = true;
        const box = getLabelBox(x, y, size, text, word);
        for (const e of existingEnemies) {
            if (!e || e.isDead) continue;
            const otherBox = getEnemyLabelBox(e);
            if (boxesOverlap(box, otherBox)) {
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
    // ★ ステージ別の出題文字数上限（例:【圧倒】= 10文字以内）
    //   上限を超える長文の敵でも、敵の見た目・属性（タグ）はそのままで、
    //   「そのタグの10文字以内の問題」に差し替えて処理しやすさを確保する。
    const maxWordLength = getStageMaxWordLength(config);

    const entry = pickWeightedEntry(config?.enemyTable);
    if (!entry) return null;

    let enemyTypeId = entry.type;

    // ★★★ ことわざ(Yellow)には短い単語がないため、SMALLサイズをNORMALサイズに強制変換する
    if (enemyTypeId.startsWith('YELLOW_') && enemyTypeId.includes('_SMALL')) {
        enemyTypeId = enemyTypeId.replace('_SMALL', '_NORMAL');
    }

    const type = EnemyTypes[enemyTypeId];
    if (!type) return null;

    // 文字数上限あり時は候補が絞られるため、未使用語を探すリトライ回数を増やす。
    // 出せなかった場合は従来どおり、その回の出現だけ打ち切って次の間隔で再試行する。
    const target = getUniqueWord(type, enemies, maxWordLength ? 10 : 5, maxWordLength);
    if (!target) return null;

    // 固定座標指定があれば使用、なければランダム
    const pos = entry.pos 
        ? { x: entry.pos.x, y: entry.pos.y } 
        : getSpawnPosition(player, canvas, type.size, enemies, target.text, target.word);

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

        enemy.speed = type.speed; // 初期速度はそのまま

        // Tier・難易度補正はcalcDamageで反映されるため、ここでは基本ダメージを設定
        enemy.damage = type.damage;

    } else {
        enemy.damage = type.damage;
    }

    // ★ ステージ別の出題文字数上限を保持（複数問題敵の2問目以降にも同じ制限を効かせる）
    enemy.maxWordLength = maxWordLength;

    // ★ ステージ別 敵速度倍率（例: 圧倒 = 0.6 で低速化し、画面に敵が滞留する）
    let stageSpeedMult = config?.enemySpeedMultiplier ?? 1;

    // ★ 電撃戦(berserk): 残りHPが少ないほど敵が加速する
    if (config?.berserk && player.maxHp > 0) {
        const hpRatio = Math.max(0, Math.min(1, player.hp / player.maxHp));
        stageSpeedMult *= 1 + (1 - hpRatio) * (config.berserk.maxBoost ?? 0.6);
    }

    // 文字数に応じた最低入力時間を確保するための速度調整
    // 0.25 に設定すると、10文字の単語に対して 2.5秒 の到達時間が保証
    const SECONDS_PER_CHAR = SECONDS_PER_CHAR_BASE;
    const FPS = 60;
    const distToPlayer = Math.hypot(pos.x - player.x, pos.y - player.y);
    const minFramesToReach = Math.max(1, target.text.length * SECONDS_PER_CHAR * FPS);
    
    const maxAllowedSpeed = distToPlayer / minFramesToReach;
    // ステージ倍率を適用（最後に入力保証キャップを通すため、タイプ不能な速度にはならない）
    enemy.speed = Math.min(enemy.speed * stageSpeedMult, maxAllowedSpeed);
    if (type.isFixed) enemy.speed = 0;

    enemy.baseRomaji =
        buildBaseRomaji(enemy.text);

    // ★ビット連動ボス: 左右のビットを初期スポーンする（ビットも普通の敵として倒せる）
    if (type.isBitBoss) {
        spawnBitEnemiesFor(enemy, { enemies });
    }

    return enemy;
}

// =====================================================
// アイテム出現関連関数
// =====================================================

export function spawnItemEnemy(state, config, itemTableOverride){

    const {player, canvas} = state;
    if (!config) return;

    // chance (クエスト用の最終ステータスからアイテム出現率ボーナスを適用)
    let chanceBase = (config.chance || 0);
    try {
        const stats = getPlayerStatsForEnemy("quest");
        const mult = Number(stats.itemSpawnMultiplier) || 1;
        chanceBase = chanceBase * mult;
    } catch (e) {
        // ignore
    }

    if (Math.random() > chanceBase) {
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
            state.enemies,
            target.text,
            target.word
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
// maxLenLimit を渡すと、そのタイプの上限（例: 10）を超えない問題に差し替える
export function getRandomWordForType(type, maxLenLimit = null) {
    // type.tags, minLen, maxLen を getWord にそのまま渡す
    // 大元の EnemyTypes 定義側で長さを調整することを推奨
    const [minLen, maxLen] = resolveWordLengthRange(type, maxLenLimit);
    return getWord(type.tags, minLen, maxLen);
}

export function getWordForBehavior(behavior) {
    return getWord(behavior.tags, behavior.minLen, behavior.maxLen);
}
