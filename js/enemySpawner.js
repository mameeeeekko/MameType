import { Enemy, EnemyTypes, ItemEnemy, ItemTypes, BulletEnemy, getUnusedLetter, spawnBitEnemiesFor, applyActiveFreezeToEnemy } from "./enemy.js";
import { getPlayerStatsForEnemy } from "./questPlayerStats.js";
import { getUISafeMinEnemyY } from "./enemyCore.js";
import { getWord, resolveWordLengthRange } from "./target.js";
import { buildBaseRomaji } from "./typingLogic.js";
import { OVERWHELM_MISSION_NAME, OVERWHELM_MAX_WORD_LENGTH, INTERCEPT_WARP_DURATION, getInterceptBulletColor } from "./enemyModeConfig.js";
import { STAGE_W, STAGE_H } from "./stageScale.js";


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

/**
 * 画面上で「問題として并存している」text をすべて集める。
 *
 * 対象は敵そのものの問題text だけでなく、
 * 敵が抱えている防御ワード（activeAttack）や 迎撃モードの弾も含む。
 * これらはプレイヤーから見て同時に「打つ対象」として見えるため、
 * 同じtext が複数存在するとどれへの入力なのか曖昧になる。
 *
 * @param {Object} state { enemies, enemyBullets } を持つゲーム状態
 * @param {Enemy|null} [excludeSelf] 判定から除外する敵（自分自身）
 * @param {string[]} [extraTexts] 追加で「使用中」とみなす text
 * @returns {Set<string>}
 */
export function collectUsedTexts(state, excludeSelf = null, extraTexts = null){

    const used = new Set();

    const add = (e) => {
        if (!e || e === excludeSelf || e.isDead) return;
        if (e.text) used.add(e.text);
        // 敵が抱えている防御ワードも「同時に打つ対象」として扱う
        if (e.activeAttack?.text) used.add(e.activeAttack.text);
    };

    (state?.enemies || []).forEach(add);
    (state?.enemyBullets || []).forEach(add);

    if (extraTexts) {
        extraTexts.forEach(t => { if (t) used.add(t); });
    }

    return used;
}

/**
 * 画面上の既存問題と重複しない単語を、指定回数まで再抽選して取得する。
 *
 * 枯渇時（全て重複）のときは null ではなく「最後に引いた1問」を返す。
 * null を返すと、出現できなかった敵の枠だけが黙って失われたり、
 * 複数問題敵が hitCount を消費したのに新しい問題が出せず
 * 入力不能な状態で固まったりするため、最悪でも1問は必ず供給する。
 *
 * @param {Object} type 敵タイプ（tags / minLen / maxLen）
 * @param {Object} state { enemies, enemyBullets }
 * @param {Object} [options]
 * @param {number|null} [options.maxLenLimit] 出題文字数の上限
 * @param {number} [options.retry] 再抽選回数
 * @param {Enemy|null} [options.excludeSelf] 重複判定から除外する敵
 * @param {string[]} [options.extraTexts] 追加で「使用中」とみなす text
 * @returns {Object|null}
 */
export function getUniqueWordForState(type, state, options = {}){

    const {
        maxLenLimit = null,
        retry = 20,
        excludeSelf = null,
        extraTexts = null,
    } = options;

    const usedTexts =
        collectUsedTexts(state, excludeSelf, extraTexts);

    let fallback = null;

    for (let i = 0; i < retry; i++) {

        const word =
            getRandomWordForType(type, maxLenLimit);

        if (!word) continue;

        fallback = word;

        if (!usedTexts.has(word.text)) {
            return word;
        }
    }

    // 枯渇時：重複を許容して라도1問は返す（出現・入力不能の事故を防ぐ）
    return fallback;
}

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
 * 敵の表示領域（本体＋上部テキストラベル、アイテムの場合は下部説明ラベルも含む）を矩形として返す
 * @param {number} x 敵の中心X
 * @param {number} y 敵の中心Y
 * @param {number} size 敵の半径
 * @param {string} text 出題テキスト（かな）
 * @param {string} [word] 表示テキスト（漢字含む）
 * @param {string} [baseRomaji] ローマ字
 * @param {boolean} [isItem] アイテムかどうか（下部説明ラベルを含む）
 * @returns {{x:number, y:number, w:number, h:number}}
 */
export function getLabelBox(x, y, size, text, word = "", baseRomaji = "", isItem = false) {
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
    // 敵本体下端: y + radius + 4（アイテムの場合は下部に説明ラベルがあるため y + radius + 28）
    const top = y - radius - 38;
    const bottom = isItem ? (y + radius + 28) : (y + radius + 4);
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
    return getLabelBox(enemy.x || 0, enemy.y || 0, r, enemy.text, enemy.word, enemy.baseRomaji, enemy.isItem === true);
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
    word = "",
    isItem = false
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

    // アイテムの場合、下部に説明ラベル（y + size + 10、高さ14px）が表示されるため、
    // ラベル全体および画面下端マージンが確実に収まるように maxY を低く設定する。
    // ラベル下端 = y + size + 24。画面下端との余白(24px)を含めると size + 48 の余白を確保する。
    const ITEM_BOTTOM_MARGIN = 48;
    const bottomPadding = isItem ? (size + ITEM_BOTTOM_MARGIN) : (size + padding);
    const maxY = canvasHeight - bottomPadding;

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
        const box = getLabelBox(x, y, size, text, word, "", isItem);
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
}


/**
 * 敵を生成する
 * 
 * 処理の流れ
 * 1. 画面上の敵・弾・防御ワードから「使用中のtext」を集める
 * 2. TARGETS からそのSet に含まれない問題だけを再抽選で探す
 * 3. プレイヤーの周囲にスポーン位置を決定
 * 4. Enemyインスタンスを生成して返す
 * 
 * @param {Object} player プレイヤー座標 {x, y}
 * @param {Enemy[]} enemies 現在画面に存在する敵配列
 * @param {Object} [state] ゲーム状態（敵・弾・防御ワードまで含めた重複判定に使う）
 * @returns {Enemy|null} 生成した敵（生成できない場合は null）
 */

export function spawnEnemy(
    player,
    enemies = [],
    state = null,
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

    // ★重複チェックの対象は「敵」だけに限らず、弾・防御ワードも含める。
    //   どれも同じ画面に打つ対象として同時に見えるため、同じtext が2体あると
    //   どちらへの入力なのか分からなくなる。
    //   state が渡されない経路（テスト等）は従来の敵配列のみで判定する。
    const target = state
        ? getUniqueWordForState(type, state, { maxLenLimit: maxWordLength })
        : getUniqueWord(type, enemies, maxWordLength ? 10 : 5, maxWordLength);

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

    // =====================================================
    // ★固定砲台の hitCount 抽選
    //   FIXED_TURRET_TIER_CONFIG の hitCountRatio（0〜1）は
    //   「hitCount 回入力になる確率」を表す。0.6 なら 6割が2入力、4割が1入力。
    //   type には比率だけを載せてあるので、抽選はここで個体ごとに行う。
    //   同じ Tier でも個体ごとに必要な入力回数が違うため、
    //   画面上の「×2」バッジ（enemyRenderer）は個体ごとに正しく出し分けられる。
    //   対象外（通常敵・弾・ボス・ビット）は Enemy コンストラクタの値がそのまま使われる。
    // =====================================================
    if (type.isFixed) {
        const ratio = Number(type.hitCountRatio);
        const baseCount = Math.max(1, Number(type.hitCount) || 1);

        if (Number.isFinite(ratio) && baseCount > 1) {
            // 0〜1 に丸めてから比較（0以下は0扱い、1以上は1扱い＝常に hitCount）
            const roll = Math.random() < Math.min(1, Math.max(0, ratio));
            enemy.hitCount = roll ? baseCount : baseCount - 1;
        } else {
            // 比率未設定、または hitCount:1 の Tier は 1入力固定
            enemy.hitCount = baseCount > 1 ? baseCount : 1;
        }
    }

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
    //   state をそのまま渡すことで、ビット側の重複判定にも弾・防御ワードを含められる。
    if (type.isBitBoss) {
        spawnBitEnemiesFor(enemy, state ?? { enemies });
    }

    return enemy;
}

// =====================================================
// 【迎撃】専用: 弾のウェーブ生成
// =====================================================
// 敵から発射されるのではなく、空間からワープして現れる。
// ・出現位置は canvas 内のプレイヤーから離れたところ
// ・速度にゆらぎを持たせ、1ウェーブ内に「遅い弾」と「速い弾」を混在させる
// ・homing: 1 で必ずプレイヤーへ向かわせる（回避はできない。撃ち落とすか当たるかの二択）
// =====================================================

// ワープ演出の長さは enemyModeConfig の共通定数を使う（描画側と必ず値を揃える）。
export function spawnInterceptWave(player, state, config, spawnCfg, alreadySpawned) {

    const spec = config?.interceptSpec;
    if (!spec) return 0;

    // 画面上の弾の同時存在上限（迎撃では spawn.maxAlive が弾の上限になる）
    const maxAlive = spawnCfg?.maxAlive;
    if (maxAlive != null && state.enemyBullets.length >= maxAlive) return 0;

    // 残り湧き数を超えたら出さない
    const limit = spawnCfg?.limit;
    const room = limit == null ? spec.count : limit - alreadySpawned;
    const count = Math.max(0, Math.min(spec.count, room));
    if (count === 0) return 0;

    const stats = state.enemyStats;
    const margin = 30;
    let made = 0;

    for (let i = 0; i < count; i++) {

        // プレイヤーから見て一定距離の、canvas 内の位置に出現させる
        const angle = Math.random() * Math.PI * 2;
        const dist = SPAWN_RADIUS_BASE * (0.85 + Math.random() * 0.3);
        const cx = Math.min(Math.max(player.x + Math.cos(angle) * dist, margin), STAGE_W - margin);
        const cy = Math.min(Math.max(player.y + Math.sin(angle) * dist, margin), STAGE_H - margin);

        const dx = player.x - cx;
        const dy = player.y - cy;
        const d = Math.hypot(dx, dy) || 1;

        // ★速度ゆらぎ: 1ウェーブ内で遅い弾と速い弾を混ぜる
        const speed = spec.speed * (1 + (Math.random() * 2 - 1) * (spec.variance ?? 0));

        const bullet = new BulletEnemy(
            getUnusedLetter(state, spec.charType),
            cx,
            cy,
            (dx / d) * speed,
            (dy / d) * speed,
            {
                speed,
                charType: spec.charType,
                damage: spec.damage,
                size: spec.size,
                // ★Tier別の撃ち落としスコア（チェイン倍率が乗る）
                score: spec.score,
                // ★描画に必須。既存の弾（fireBullet）も必ず指定している。
                //   ここが欠けると drawShape→adjustColor でエラーになる。
                // ★速度別の色: 遅い弾は深い青、速い弾は明るいシアンになる
                //   （色相は固定のまま、速度ゆらぎの範囲で明度・彩度だけを変える）。
                color: getInterceptBulletColor(speed, spec),
                shape: "circle",
                homing: 1,                    // ★必ずプレイヤーへ向かう
                isObjective: true,            // ★迎撃の弾だけ目標として数える
                tierDamageMultiplier: 1,      // ボス弾と同じ扱い（Tier倍率を掛けない）
                warpDuration: INTERCEPT_WARP_DURATION,
            }
        );

        applyActiveFreezeToEnemy(bullet, state);

        state.enemyBullets.push(bullet);

        // 迎撃率の分母（湧いた弾の総数）
        if (stats) {
            stats.interceptTotal = (stats.interceptTotal ?? 0) + 1;
        }

        made++;
    }

    return made;
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

    // ★word取得（敵・弾・防御ワードと重複しない問題を再抽選で探す）
    const target =
        getUniqueWordForState(type, state);

    if (!target) return;

    // position
    const pos =
        getSpawnPosition(
            player,
            canvas,
            type.size,
            state.enemies,
            target.text,
            target.word,
            true
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
