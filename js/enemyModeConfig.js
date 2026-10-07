// enemyModeConfig.js

import { devOverride, applyOverride } from "../dev/devOverride.js";

// =====================================================
// エネミーモードの「調整用パラメータ」をすべて集約
// =====================================================

// ===============================
// プレイヤー・スポーン・終了 / クリア条件のデフォルト値
// ===============================
export const ENEMY_MODE_CONFIG = {

    // プレイヤー（固定ステータス）
    player: {
        level: 1,
        maxHp: 100,
        defense: 0,
        radius: 20
    },

    // 敵スポーン
    spawn: {
        interval: 4000,           // 出現間隔(ms)
        limit: null,              // 出現上限（null = 無限）
        maxAlive: null,           // 同時出現上限（null = 無限）
        immediateOnClear: false,  // 敵が全滅した際に即座に次を出すか
        multiCount: 1,            // 1回の出現で同時に出す敵の数（1 = 従来どおり1匹）
        multiInterval: 1          // 何回に1回まとめて出すか（1 = 毎回）
    },

    // 終了条件
    endConditions: {
        hpZero: true,
        timerMs: null,
        killCount: 5,
        allSpawnedDefeated: false,
        failOnMiss: false
    },

    // クリア条件
    clearConditions: {
        survive: null,
        killCount: 5,
        timerMs: null
    },

    // チェインシステム
    chain: {
        maxBar: 6000,
        decayRate: 1.0,      // 1msあたり減少割合
        gainOnKill: 1500,    // 敵撃破で増える量
        missPenalty: 500,    // ミス1回で減る量
        damagePenalty: 2500, // 被弾1回で減る量（ミスより重い）
        gainOnType: 250,     // 1文字あたりの増加量

        // チェイン倍率テーブル（上から評価）
        multipliers: [
            { count: 100, value: 5.0 },
            { count: 80,  value: 3.5 },
            { count: 60,  value: 3.0 },
            { count: 50,  value: 2.7 },
            { count: 45,  value: 2.4 },
            { count: 40,  value: 2.2 },
            { count: 35,  value: 2.0 },
            { count: 30,  value: 1.8 },
            { count: 25,  value: 1.5 },
            { count: 20,  value: 1.4 },
            { count: 15,  value: 1.3 },
            { count: 10,  value: 1.2 },
            { count: 3,   value: 1.1 }
        ]
    },

    // スコア計算
    score: {
        accuracyMaxBonus: 0.5, // 0〜0.5倍のボーナス加算
        chainDivisor: 80,      // 50チェインで +1.0倍
        speedDivisor: 800,     // 800KPMで +1.0倍
        clearBonus: 0.2,       // +0.2倍 (20%)
        noMissBonus: 0.4,      // +0.4倍 (40%)
        noDamageBonus: 0.2     // +0.2倍 (20%)
    },
};

// ======================================================
// 専用ミッション識別子
// ======================================================

// 【圧倒】専用: 出題文字数の上限
// 圧倒は「同時出現数の大幅増 + 低速化」で画面に敵が溜まるため、
// 出題が10文字を超えると処理しきれなくなる。
// 敵の見た目・属性（tags）は変えず、そのタグの8文字以内の問題に差し替える。
export const OVERWHELM_MISSION_NAME = "圧倒";
export const OVERWHELM_MAX_WORD_LENGTH = 8;

// 【迎撃】専用: 敵を一体も使わない。飛んでくる弾を撃ち落とすだけのミッション。
export const INTERCEPT_MISSION_NAME = "迎撃";

// ======================================================
// 共通ユーティリティ関数
// ======================================================

/**
 * 【圧倒】の飽和度（saturation）設定を組み立てる。
 * クエスト generateStage() case7 とフリーモード【圧倒】プリセットが
 * 必ず同じ値を返すよう、ここを単一ソースとして扱う。
 * @param {number} maxAlive 同時出現上限（config.spawn.maxAlive）
 * @returns {Object} stage.saturation 相当の設定
 */
function buildOverwhelmSaturation(maxAlive) {
    return {
        // 敵数だけでなく画面全体の余白も容量に含め、上限に到達しにくいようにする。
        capacity:           maxAlive * 1.2,
        limit:              75,
        // 弾は飽和度の計算への寄与を小さくする。
        bulletWeight:       0.1,
        // 上がりは遅く、下がりは速くする。
        riseRate:           0.25,
        fallRate:           2.0,
        overloadDurationMs: 5000
    };
}

/**
 * Tier文字列 or 数値を 1〜10 の整数に正規化する。
 * "T3", 3, "3" のいずれでも動作する。
 */
function normalizeTierNumber(tier) {
    const match = String(tier ?? "").match(/\d+/);
    const parsed = match ? Number.parseInt(match[0], 10) : 1;
    if (!Number.isFinite(parsed)) return 1;
    return Math.min(10, Math.max(1, Math.floor(parsed)));
}

// ステージ番号 → Tier キー（10ステージごとに T1〜T10）
function getTierKey(stageNum) {
    return `T${Math.min(10, Math.ceil(stageNum / 10))}`;
}

// ステージ番号 → アイテム Tier キー（30ステージ以降は T5 に固定）
function getItemTierKey(stageNum) {
    return `T${Math.min(5, Math.ceil(stageNum / 10))}`;
}

// ======================================================
// 【迎撃】専用設定
// ======================================================

/**
 * 迎撃モードのステージかどうかを判定する。
 */
export function isInterceptStage(stage) {
    if (!stage) return false;
    return stage.interceptMode === true ||
        stage.missionName === INTERCEPT_MISSION_NAME;
}

// ======================================================
// 【迎撃】専用: ステージ進行度別の弾仕様
// ------------------------------------------------------------
// ・charType : 弾に載る1文字の種類（英字/数字/記号/すべて）
// ・speed    : 弾速（実移動速度は BulletEnemy 側で ×0.7 される）
// ・variance : 速度ゆらぎ幅。1回のウェーブで「遅い弾」と「速い弾」が混ざる
// ・count    : 1ウェーブあたりの発射数
// ・maxAlive : 画面上の弾の同時存在上限
// ・interval : ウェーブの間隔(ms)
// ・damage   : 被弾ダメージ。迎撃は被弾前提なので控えめに設定する
// ・size     : 弾の見た目サイズ
// ・goal     : 湧く弾の総数（全て処理したらクリア）
// ・score    : 弾1発の撃ち落としスコア（チェイン倍率が乗る）
// ======================================================
export const INTERCEPT_TIER_SPEC = {
    T1:  { charType: "alphabet", speed: 1.8, variance: 0.05, count: 1, maxAlive: 4, interval: 2000, damage: 15, size: 10, goal: 20, score: 15 },
    T2:  { charType: "alphabet", speed: 1.8, variance: 0.10, count: 2, maxAlive: 4, interval: 1900, damage: 20, size: 10, goal: 30, score: 20 },
    T3:  { charType: "alphabet", speed: 1.9, variance: 0.15, count: 2, maxAlive: 5, interval: 1900, damage: 25, size: 11, goal: 40, score: 23 },
    T4:  { charType: "alphabet", speed: 1.9, variance: 0.20, count: 2, maxAlive: 6, interval: 1800, damage: 30, size: 11, goal: 50, score: 25 },
    T5:  { charType: "alphabet", speed: 2.0, variance: 0.25, count: 3, maxAlive: 7, interval: 1800, damage: 35, size: 12, goal: 60, score: 28 },
    T6:  { charType: "alphabet", speed: 2.0, variance: 0.30, count: 3, maxAlive: 7, interval: 1700, damage: 40, size: 12, goal: 65, score: 30 },
    T7:  { charType: "alphabet", speed: 2.1, variance: 0.35, count: 4, maxAlive: 8, interval: 1700, damage: 45, size: 13, goal: 70, score: 32 },
    T8:  { charType: "alphabet", speed: 2.1, variance: 0.35, count: 4, maxAlive: 9, interval: 1700, damage: 50, size: 13, goal: 75, score: 35 },
    T9:  { charType: "all",      speed: 1.8, variance: 0.45, count: 3, maxAlive: 7, interval: 1900, damage: 55, size: 14, goal: 80, score: 40 },
    T10: { charType: "all",      speed: 1.9, variance: 0.45, count: 3, maxAlive: 8, interval: 1900, damage: 60, size: 14, goal: 85, score: 50 },
};

// ======================================================
// 【迎撃】専用: Tier別仕様の引き出し
// ------------------------------------------------------------
// クエストは generateStage() 内で直接 INTERCEPT_TIER_SPEC を参照しているが、
// フリーモードは UI（Rule Settings）から実数値を表示するため、
// 「Tier番号 → spec」を1箇所にまとめる。
// ======================================================
export function getInterceptTierSpec(tier) {
    const tierNumber = normalizeTierNumber(tier);
    const tierKey = `T${tierNumber}`;
    const spec = INTERCEPT_TIER_SPEC[tierKey] ?? INTERCEPT_TIER_SPEC.T1;
    // tierNumber / tierKey も同梱して、UI側でそのまま表示できるようにする
    return { tierNumber, tierKey, ...spec };
}

/**
 * 迎撃で使用できる文字種。
 * 実際に文字を引くのは enemy.js の getUnusedLetter() で、
 * 同じ4種類（alphabet / number / symbol / all）のプールを持っている。
 * ここでは選択値の検証と表示用のラベルの提供のみを担う。
 */
export const INTERCEPT_CHAR_TYPES = Object.freeze([
    { id: "alphabet", label: "英語（a-z）" },
    { id: "number",   label: "数字（0-9）" },
    { id: "symbol",   label: "記号（!?,.-[]()@%:*+;）" },
    { id: "all",      label: "すべて" },
]);

// Set 化して buildFreeEnemyMissionConfig() 内の検証に使う
const INTERCEPT_CHAR_TYPE_IDS = new Set(INTERCEPT_CHAR_TYPES.map(t => t.id));

// ======================================================
// 【迎撃】専用: 弾の色（速度別）
// ------------------------------------------------------------
// 同じウェーブでも速度ゆらぎで弾速がばらつくため、速度に合わせて弾の色を
// 「少し」変える（速さが一目でわかるように）。
// ・色相はすべて約195°で固定し、明度・彩度だけで差を出す
//   （背景・敵の色調和が崩れないため）
// ・標準速度（speed = spec.speed）の色は従来色 #5cd6ff のまま
// ・描画側（enemyRenderer のワープ演出）も同じ色を使うため、
//   スポーン側と同じファイルに置いて共有する
// ======================================================
export const INTERCEPT_BULLET_COLOR_SLOW = "#00bfff";   // 遅い弾: 深い青
export const INTERCEPT_BULLET_COLOR_BASE = "#74dcff";   // 標準速度: 従来色
export const INTERCEPT_BULLET_COLOR_FAST = "#d3f4ff";   // 速い弾: 明るいシアン〜白

// #rgb / #rrggbb を {r,g,b} に分解する（解釈できない場合は null）
function parseHexColor(hex) {
    if (typeof hex !== "string" || !hex.startsWith("#")) return null;
    let col = hex.slice(1);
    if (col.length === 3) col = col.split("").map(v => v + v).join("");
    if (col.length !== 6) return null;
    const num = Number.parseInt(col, 16);
    if (!Number.isFinite(num)) return null;
    return {
        r: (num >> 16) & 0xff,
        g: (num >> 8)  & 0xff,
        b:  num        & 0xff
    };
}

// 2色を補間して #rrggbb で返す（t は 0〜1 にクランプ）
function lerpHexColor(from, to, t) {
    const a = parseHexColor(from);
    const b = parseHexColor(to);
    if (!a || !b) return from;
    const k = Math.max(0, Math.min(1, Number(t) || 0));
    const r  = Math.round(a.r + (b.r - a.r) * k);
    const g  = Math.round(a.g + (b.g - a.g) * k);
    const bl = Math.round(a.b + (b.b - a.b) * k);
    return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

/**
 * 迎撃の弾の色を速度から求める。
 * 速度ゆらぎの範囲（1-variance 〜 1+variance）を 0〜1 に正規化し、
 * 「遅い＝深い青 〜 標準＝従来色 〜 速い＝明るいシアン」の3点で補間する。
 * 描画は enemy.type.color を使うため、生成側で決めた色だけで全体に反映される。
 *
 * @param {number} speed 実際の弾速（spec.speed × ゆらぎ）
 * @param {Object} spec  INTERCEPT_TIER_SPEC の1件
 * @returns {string} #rrggbb
 */
export function getInterceptBulletColor(speed, spec) {
    const baseSpeed    = Number(spec?.speed);
    const variance     = Math.abs(Number(spec?.variance)) || 0;
    const currentSpeed = Number(speed);

    // 設定が壊れている場合は従来色へフォールバックする（描画が壊れないことを優先）
    if (!Number.isFinite(baseSpeed) || baseSpeed <= 0 || !Number.isFinite(currentSpeed)) {
        return INTERCEPT_BULLET_COLOR_BASE;
    }
    // ゆらぎなし（=Tier で常に同じ速度）なら基本色のまま
    if (variance <= 0) return INTERCEPT_BULLET_COLOR_BASE;

    // 最遅(1-variance)→0.0 / 標準(1)→0.5 / 最速(1+variance)→1.0
    const t = (currentSpeed / baseSpeed - (1 - variance)) / (2 * variance);
    return t < 0.5
        ? lerpHexColor(INTERCEPT_BULLET_COLOR_SLOW, INTERCEPT_BULLET_COLOR_BASE, t * 2)
        : lerpHexColor(INTERCEPT_BULLET_COLOR_BASE, INTERCEPT_BULLET_COLOR_FAST, (t - 0.5) * 2);
}

// ======================================================
// 【迎撃】専用: ワープ出現演出の長さ(秒)
// ------------------------------------------------------------
// 弾は敵から発射されないため、空間からワープして現れる。
// この時間のあいだ弾は移動せず、出現演出だけを描く。
// ※ enemySpawner（生成時）と enemyRenderer（描画時）で共有する。
// ======================================================
export const INTERCEPT_WARP_DURATION = 0.8;

// ======================================================
// Tier別 通常敵ダメージ倍率
// ======================================================

// Tierごとの通常敵基本ダメージ倍率。
// T1を基準値(1.00)として、Tierが1つ上がるごとに指定値を適用する。
export const TIER_DAMAGE_MULTIPLIERS = Object.freeze({
    T1:  1.00,
    T2:  1.80,
    T3:  2.20,
    T4:  2.70,
    T5:  2.90,
    T6:  3.20,
    T7:  3.50,
    T8:  3.70,
    T9:  4.00,
    T10: 4.50
});

/**
 * Tier値から通常敵の基本ダメージ倍率を取得する。
 * 不正値・未設定値はT1の倍率へフォールバックする。
 */
export function getTierDamageMultiplier(tier) {
    const tierNumber = normalizeTierNumber(tier);
    return TIER_DAMAGE_MULTIPLIERS[`T${tierNumber}`] ?? TIER_DAMAGE_MULTIPLIERS.T1;
}

// ======================================================
// Tier別 出現圧力（T1〜T4）
// ======================================================
// T1〜T4の通常クエスト戦闘に適用する出現圧力。
// Tierは変えずに、出現間隔・同時存在数・複数出現だけを段階的に上げる。
const TIER_SPAWN_PRESSURE = {
    T1: {
        early: { interval: 3000, maxAlive: 5, multiCount: 2, multiInterval: 2 },
        late:  { interval: 3000, maxAlive: 5, multiCount: 2, multiInterval: 2 },
        lateFrom: 5
    },
    T2: {
        early: { interval: 3500, maxAlive: 6, multiCount: 2, multiInterval: 2 },
        late:  { interval: 3500, maxAlive: 6, multiCount: 2, multiInterval: 2 },
        lateFrom: 6
    },
    T3: {
        early:     { interval: 3800, maxAlive: 6, multiCount: 2, multiInterval: 2 },
        late:      { interval: 3800, maxAlive: 6, multiCount: 2, multiInterval: 2 },
        final:     { interval: 3800, maxAlive: 7, multiCount: 2, multiInterval: 2 },
        lateFrom:  6,
        finalFrom: 9
    },
    T4: {
        early: { interval: 3800, maxAlive: 7, multiCount: 2, multiInterval: 2 },
        late:  { interval: 3800, maxAlive: 7, multiCount: 2, multiInterval: 2 },
        lateFrom: 6
    }
};

function getTierSpawnPressure(stageNum) {
    const stageNumber = Number(stageNum);
    if (!Number.isFinite(stageNumber) || stageNumber < 1) return null;

    const tierNumber = Math.ceil(stageNumber / 10);
    // 今回はT1〜T4のみ。T5以降は別のバランス段階として扱う。
    if (tierNumber < 1 || tierNumber > 4) return null;

    const profile = TIER_SPAWN_PRESSURE[`T${tierNumber}`];
    if (!profile) return null;

    const offset = ((stageNumber - 1) % 10) + 1;
    if (profile.final && offset >= profile.finalFrom) return profile.final;
    if (offset >= profile.lateFrom) return profile.late;
    return profile.early;
}

function isTierPressureExempt(stage, pattern = null) {
    // ★2 = 【迎撃】は出現間隔・同時存在数・複数出現を独自設計するため対象外にする。
    return [2, 3, 4, 7, 8].includes(Number(pattern));
}

function applyTierSpawnPressure(config, stageNum, pattern = null) {
    const pressure = getTierSpawnPressure(stageNum);
    if (!config?.spawn || !pressure || isTierPressureExempt(config, pattern)) {
        return false;
    }

    const spawn = config.spawn;
    let changed = false;

    const currentInterval = Number(spawn.interval);
    if (!Number.isFinite(currentInterval) || currentInterval > pressure.interval) {
        spawn.interval = pressure.interval;
        changed = true;
    }

    // maxAliveがnullは無制限なので、意図して上書きしない。
    const currentMaxAlive = Number(spawn.maxAlive);
    if (spawn.maxAlive !== null && spawn.maxAlive !== undefined &&
        (!Number.isFinite(currentMaxAlive) || currentMaxAlive < pressure.maxAlive)) {
        spawn.maxAlive = pressure.maxAlive;
        changed = true;
    }

    const currentMultiCount = Number(spawn.multiCount);
    if (!Number.isFinite(currentMultiCount) || currentMultiCount < pressure.multiCount) {
        spawn.multiCount = pressure.multiCount;
        changed = true;
    }

    const currentMultiInterval = Number(spawn.multiInterval);
    if (!Number.isFinite(currentMultiInterval) || currentMultiInterval > pressure.multiInterval) {
        spawn.multiInterval = pressure.multiInterval;
        changed = true;
    }

    return changed;
}

// =====================================================
// Tier別 敵セット定義 (10ステージごと)
// =====================================================

// --- メイン: 標準セット (Gray多め、徐々に他属性が混ざる) ---
export const ENEMY_TIER_BALANCED = {
    description: "標準構成（Grayタイプ主体）",
    T1:  [{ type: "GRAY_CIRCLE_SMALL", weight: 50 }, { type: "GRAY_SQUARE_SMALL", weight: 40 }, { type: "GRAY_PINWHEEL_SMALL", weight: 10 }],
    T2:  [{ type: "GRAY_CIRCLE_NORMAL", weight: 50 }, { type: "GRAY_SQUARE_SMALL_STRIPE", weight: 20 }, { type: "GRAY_PINWHEEL_SMALL", weight: 10 }, { type: "PURPLE_CIRCLE_SMALL", weight: 10 }, { type: "BLUE_CIRCLE_SMALL", weight: 10 }],
    T3:  [{ type: "GRAY_SQUARE_NORMAL", weight: 50 }, { type: "GRAY_PINWHEEL_NORMAL", weight: 20 }, { type: "PURPLE_SQUARE_NORMAL", weight: 15 }, { type: "BLUE_CIRCLE_NORMAL", weight: 10 }, { type: "GRAY_CIRCLE_SMALL_RING", weight: 5 }],
    T4:  [{ type: "GRAY_SQUARE_NORMAL", weight: 25 }, { type: "GRAY_CIRCLE_NORMAL_STRIPE", weight: 15 }, { type: "PINK_CIRCLE_NORMAL", weight: 15 }, { type: "YELLOW_CIRCLE_NORMAL", weight: 15 }, { type: "GRAY_PINWHEEL_SMALL", weight: 15 }, { type: "GRAY_SQUARE_NORMAL_RING", weight: 10 }],
    T5:  [{ type: "GRAY_CIRCLE_NORMAL", weight: 30 }, { type: "GRAY_SQUARE_NORMAL_STRIPE", weight: 25 }, { type: "PURPLE_PINWHEEL_SMALL", weight: 15 }, { type: "GREEN_SQUARE_SMALL", weight: 15 }, { type: "GRAY_SQUARE_LARGE", weight: 5 }, { type: "GRAY_SQUARE_NORMAL_RING", weight:10 }],
    T6:  [{ type: "GRAY_SQUARE_LARGE", weight: 20 }, { type: "GRAY_CIRCLE_LARGE", weight: 15 }, { type: "BLUE_CIRCLE_NORMAL_STRIPE", weight: 20 }, { type: "RED_CIRCLE_SMALL", weight: 10 }, { type: "PURPLE_SQUARE_NORMAL", weight: 15 }, { type: "PINK_SQUARE_NORMAL", weight: 10 }, { type: "GRAY_CIRCLE_NORMAL_RING", weight: 5 }, { type: "GRAY_SQUARE_LARGE_RING", weight: 5 },{ type: "GRAY_SQUARE_NORMAL_RING", weight: 5 },],
    T7:  [{ type: "GRAY_PINWHEEL_LARGE", weight: 20 }, { type: "PINK_PINWHEEL_NORMAL", weight: 15 }, { type: "YELLOW_PINWHEEL_NORMAL", weight: 15 }, { type: "BLUE_SQUARE_LARGE", weight: 10 }, { type: "GRAY_CIRCLE_NORMAL", weight: 15 }, { type: "GRAY_CIRCLE_SMALL", weight: 10 }, { type: "GRAY_PINWHEEL_NORMAL_RING", weight: 5 },{ type: "GRAY_SQUARE_NORMAL_RING", weight: 5 }, { type: "GRAY_CIRCLE_NORMAL_RING", weight: 5 },{ type: "GRAY_SQUARE_LARGE_RING", weight: 5 }, ],
    T8:  [{ type: "RED_SQUARE_NORMAL", weight: 15 }, { type: "PURPLE_CIRCLE_LARGE", weight: 15 }, { type: "PINK_PINWHEEL_LARGE_STRIPE", weight: 10 }, { type: "GRAY_SQUARE_NORMAL", weight: 20 }, { type: "GRAY_SQUARE_SMALL", weight: 5 }, { type: "GRAY_SQUARE_LARGE_RING", weight: 10 }, { type: "GRAY_NORMAL_RING", weight: 10 }],
    T9:  [{ type: "RED_PINWHEEL_LARGE", weight: 10 }, { type: "YELLOW_SQUARE_LARGE", weight: 10 }, { type: "BLUE_PINWHEEL_LARGE_STRIPE", weight: 10 }, { type: "GRAY_CIRCLE_NORMAL", weight: 25 }, { type: "GRAY_PINWHEEL_SMALL", weight: 5 }, { type: "GRAY_PINWHEEL_NORMAL", weight: 5 }, { type: "GRAY_SQUARE_LARGE_RING", weight: 15 }, { type: "GRAY_NORMAL_RING", weight: 10 }],
    T10: [{ type: "PINK_PINWHEEL_LARGE_STRIPE", weight: 10 }, { type: "PURPLE_CIRCLE_LARGE_STRIPE", weight: 20 }, { type: "BLUE_SQUARE_LARGE", weight: 15 }, { type: "GRAY_CIRCLE_NORMAL", weight: 15 }, { type: "GRAY_CIRCLE_SMALL", weight: 5 }, { type: "GRAY_SQUARE_LARGE_RING", weight: 20 }, { type: "GRAY_NORMAL_RING", weight: 10 }]
};

// =====================================================
// ★RING（リング）出現率の設計方針 —— 全HEAVY系 / 全ONLY系で共通
// ---------------------------------------------------------
// RING は hitCount 2（1体につき2入力の必要がある）であり、
// 出現割合を上げると「実効的な湧き速度」が下がり、湧いた敵を
// 捌ききれない難易度が大きく跳ね上がってしまう。
// 一方 STRIPE は入力回数が1回のまま速度が1.2倍になるため、
// RING を減らした分を STRIPE へ移せば湧き速度の体感を保てる。
//
// そのため全テーブルで次のルールを適用する。
//   1. RING は各階層1枠に集約する（連続湧きの防止・割合の読み取りやすさ）
//   2. 減らした weight は STRIPE か 無地LARGE へ転用する
//   3. 目標RING比率（HEAVY系は固定砲台の自動追加 weight 5×2=10 を総和に含む）:
//        T4 約15% / T5 約10% / T6 約20% / T7 約25% / T8 約30% / T9 約30% / T10 約35%
//   4. ONLY系は固定砲台が混ざらないため、同じ枠組みで少し締めた目標にする
// =====================================================


// --- バリエーション: 英語多め (Purpleの比率が高い) ---
export const ENEMY_TIER_ENGLISH_HEAVY = {
    description: "英語多め（Purpleタイプ混成）",
    T1:  [{ type: "GRAY_CIRCLE_SMALL", weight: 30 }, { type: "GRAY_SQUARE_SMALL", weight: 10 }, { type: "PURPLE_CIRCLE_SMALL", weight: 50 }, { type: "PURPLE_SQUARE_SMALL", weight: 10 }],
    T2:  [{ type: "GRAY_CIRCLE_NORMAL", weight: 20 }, { type: "GRAY_SQUARE_SMALL_STRIPE", weight: 15 }, { type: "PURPLE_PINWHEEL_SMALL", weight: 50 }, { type: "PURPLE_CIRCLE_NORMAL", weight: 15 }],
    T3:  [{ type: "GRAY_PINWHEEL_NORMAL", weight: 15 }, { type: "GRAY_SQUARE_NORMAL", weight: 25 }, { type: "PURPLE_SQUARE_NORMAL", weight: 40 }, { type: "PURPLE_CIRCLE_NORMAL_STRIPE", weight: 20 }],
    T4:  [{ type: "GRAY_SQUARE_NORMAL", weight: 25 }, { type: "GRAY_CIRCLE_NORMAL_STRIPE", weight: 15 }, { type: "PURPLE_SQUARE_NORMAL", weight: 35 }, { type: "PURPLE_PINWHEEL_SMALL", weight: 10 }, { type: "PURPLE_SQUARE_LARGE_RING", weight: 15 }],
    T5:  [{ type: "GRAY_SQUARE_NORMAL_STRIPE", weight: 25 }, { type: "GRAY_CIRCLE_NORMAL", weight: 25 }, { type: "PURPLE_CIRCLE_LARGE", weight: 40 }, { type: "PURPLE_PINWHEEL_NORMAL_STRIPE", weight: 10 }, { type: "PURPLE_CIRCLE_LARGE_RING", weight: 10 }],
    T6:  [{ type: "PURPLE_CIRCLE_LARGE_STRIPE", weight: 45 }, { type: "PURPLE_SQUARE_LARGE", weight: 20 }, { type: "GRAY_PINWHEEL_NORMAL", weight: 15 }, { type: "GRAY_SQUARE_NORMAL_STRIPE", weight: 10 }, { type: "PURPLE_CIRCLE_LARGE_RING", weight: 20 }],
    T7:  [{ type: "GRAY_PINWHEEL_LARGE", weight: 15 }, { type: "GRAY_CIRCLE_NORMAL", weight: 15 }, { type: "PURPLE_PINWHEEL_NORMAL_STRIPE", weight: 30 }, { type: "PURPLE_CIRCLE_LARGE", weight: 15 }, { type: "PURPLE_CIRCLE_LARGE_RING", weight: 25 }],
    T8:  [{ type: "GRAY_SQUARE_NORMAL", weight: 25 }, { type: "GRAY_PINWHEEL_LARGE_STRIPE", weight: 20 }, { type: "PURPLE_SQUARE_LARGE", weight: 25 }, { type: "PURPLE_PINWHEEL_LARGE", weight: 10 }, { type: "PURPLE_CIRCLE_LARGE_RING", weight: 30 }],
    T9:  [{ type: "GRAY_PINWHEEL_NORMAL", weight: 10 }, { type: "PURPLE_CIRCLE_NORMAL", weight: 30 }, { type: "PURPLE_PINWHEEL_LARGE_STRIPE", weight: 20 }, { type: "PURPLE_SQUARE_NORMAL", weight: 10 }, { type: "PURPLE_CIRCLE_LARGE", weight: 10 }, { type: "PURPLE_CIRCLE_LARGE_RING", weight: 30 }],
    T10: [{ type: "GRAY_CIRCLE_NORMAL", weight: 15 }, { type: "GRAY_PINWHEEL_LARGE_STRIPE", weight: 15 }, { type: "PURPLE_SQUARE_NORMAL_STRIPE", weight: 10 }, { type: "PURPLE_CIRCLE_LARGE", weight: 15 }, { type: "PURPLE_PINWHEEL_LARGE", weight: 10 }, { type: "PURPLE_CIRCLE_LARGE_RING", weight: 35 }]
};

// --- バリエーション: 記号多め (Redの比率が高い) ---
export const ENEMY_TIER_SYMBOL_HEAVY = {
    description: "記号多め（Redタイプ混成）",
    T1:  [{ type: "GRAY_CIRCLE_SMALL", weight: 30 }, { type: "GRAY_SQUARE_SMALL", weight: 10 }, { type: "RED_CIRCLE_SMALL", weight: 50 }, { type: "RED_SQUARE_SMALL", weight: 10 }],
    T2:  [{ type: "GRAY_CIRCLE_NORMAL", weight: 20 }, { type: "GRAY_SQUARE_SMALL_STRIPE", weight: 15 }, { type: "RED_PINWHEEL_SMALL", weight: 50 }, { type: "RED_CIRCLE_NORMAL", weight: 15 }],
    T3:  [{ type: "GRAY_PINWHEEL_NORMAL", weight: 15 }, { type: "GRAY_SQUARE_NORMAL", weight: 25 }, { type: "RED_SQUARE_NORMAL", weight: 40 }, { type: "RED_CIRCLE_NORMAL_STRIPE", weight: 20 }],
    T4:  [{ type: "GRAY_SQUARE_NORMAL", weight: 25 }, { type: "GRAY_CIRCLE_NORMAL_STRIPE", weight: 15 }, { type: "RED_SQUARE_NORMAL", weight: 35 }, { type: "RED_PINWHEEL_SMALL", weight: 10 }, { type: "RED_SQUARE_LARGE_RING", weight: 15 }],
    T5:  [{ type: "GRAY_SQUARE_NORMAL_STRIPE", weight: 25 }, { type: "GRAY_CIRCLE_NORMAL", weight: 25 }, { type: "RED_PINWHEEL_LARGE", weight: 40 }, { type: "RED_CIRCLE_NORMAL_STRIPE", weight: 10 }, { type: "RED_PINWHEEL_LARGE_RING", weight: 10 }],
    T6:  [{ type: "RED_PINWHEEL_LARGE_STRIPE", weight: 45 }, { type: "RED_SQUARE_LARGE", weight: 20 }, { type: "GRAY_PINWHEEL_NORMAL", weight: 15 }, { type: "GRAY_SQUARE_NORMAL_STRIPE", weight: 10 }, { type: "RED_PINWHEEL_LARGE_RING", weight: 20 }],
    T7:  [{ type: "GRAY_PINWHEEL_LARGE", weight: 15 }, { type: "GRAY_CIRCLE_NORMAL", weight: 15 }, { type: "RED_CIRCLE_NORMAL_STRIPE", weight: 30 }, { type: "RED_PINWHEEL_LARGE", weight: 15 }, { type: "RED_SQUARE_LARGE_RING", weight: 25 }],
    T8:  [{ type: "GRAY_SQUARE_NORMAL", weight: 25 }, { type: "GRAY_PINWHEEL_LARGE_STRIPE", weight: 20 }, { type: "RED_SQUARE_LARGE", weight: 25 }, { type: "RED_PINWHEEL_LARGE", weight: 10 }, { type: "RED_SQUARE_LARGE_RING", weight: 30 }],
    T9:  [{ type: "GRAY_PINWHEEL_NORMAL", weight: 10 }, { type: "RED_SQUARE_NORMAL", weight: 30 }, { type: "RED_PINWHEEL_LARGE_STRIPE", weight: 20 }, { type: "RED_SQUARE_NORMAL_STRIPE", weight: 10 }, { type: "RED_PINWHEEL_LARGE", weight: 10 }, { type: "RED_NORMAL_LARGE_RING", weight: 30 }],
    T10: [{ type: "GRAY_CIRCLE_NORMAL", weight: 15 }, { type: "GRAY_PINWHEEL_LARGE_STRIPE", weight: 15 }, { type: "RED_SQUARE_NORMAL_STRIPE", weight: 10 }, { type: "RED_SQUARE_LARGE", weight: 15 }, { type: "RED_PINWHEEL_LARGE", weight: 10 }, { type: "RED_NORMAL_LARGE_RING", weight: 35 }]
};

// --- バリエーション: 擬音多め (Pinkの比率が高い) ---
export const ENEMY_TIER_ONOMATOPOEIA_HEAVY = {
    description: "擬音多め（Pinkタイプ混成）",
    T1:  [{ type: "GRAY_CIRCLE_SMALL", weight: 30 }, { type: "GRAY_SQUARE_SMALL", weight: 10 }, { type: "PINK_SQUARE_SMALL", weight: 50 }, { type: "PINK_CIRCLE_SMALL", weight: 10 }],
    T2:  [{ type: "GRAY_CIRCLE_NORMAL", weight: 20 }, { type: "GRAY_SQUARE_SMALL_STRIPE", weight: 15 }, { type: "PINK_PINWHEEL_SMALL", weight: 50 }, { type: "PINK_SQUARE_NORMAL", weight: 15 }],
    T3:  [{ type: "GRAY_PINWHEEL_NORMAL", weight: 15 }, { type: "GRAY_SQUARE_NORMAL", weight: 25 }, { type: "PINK_CIRCLE_NORMAL", weight: 40 }, { type: "PINK_SQUARE_NORMAL_STRIPE", weight: 20 }],
    T4:  [{ type: "GRAY_SQUARE_NORMAL", weight: 25 }, { type: "GRAY_CIRCLE_NORMAL_STRIPE", weight: 15 }, { type: "PINK_SQUARE_NORMAL", weight: 35 }, { type: "PINK_CIRCLE_SMALL", weight: 10 }, { type: "PINK_SQUARE_LARGE_RING", weight: 15 }],
    T5:  [{ type: "GRAY_SQUARE_NORMAL_STRIPE", weight: 25 }, { type: "GRAY_CIRCLE_NORMAL", weight: 25 }, { type: "PINK_PINWHEEL_LARGE", weight: 40 }, { type: "PINK_CIRCLE_NORMAL_STRIPE", weight: 10 }, { type: "PINK_PINWHEEL_LARGE_RING", weight: 10 }],
    T6:  [{ type: "PINK_PINWHEEL_LARGE_STRIPE", weight: 45 }, { type: "PINK_CIRCLE_LARGE", weight: 20 }, { type: "GRAY_PINWHEEL_NORMAL", weight: 15 }, { type: "GRAY_SQUARE_NORMAL_STRIPE", weight: 10 }, { type: "PINK_PINWHEEL_LARGE_RING", weight: 20 }],
    T7:  [{ type: "GRAY_PINWHEEL_LARGE", weight: 15 }, { type: "GRAY_CIRCLE_NORMAL", weight: 15 }, { type: "PINK_CIRCLE_NORMAL_STRIPE", weight: 30 }, { type: "PINK_PINWHEEL_LARGE", weight: 15 }, { type: "PINK_SQUARE_LARGE_RING", weight: 25 }],
    T8:  [{ type: "GRAY_SQUARE_NORMAL", weight: 25 }, { type: "GRAY_PINWHEEL_LARGE_STRIPE", weight: 20 }, { type: "PINK_CIRCLE_LARGE", weight: 25 }, { type: "PINK_PINWHEEL_LARGE", weight: 10 }, { type: "PINK_SQUARE_LARGE_RING", weight: 30 }],
    T9:  [{ type: "GRAY_PINWHEEL_NORMAL", weight: 10 }, { type: "PINK_CIRCLE_NORMAL", weight: 30 }, { type: "PINK_PINWHEEL_LARGE_STRIPE", weight: 20 }, { type: "PINK_SQUARE_NORMAL", weight: 10 }, { type: "PINK_CIRCLE_LARGE", weight: 10 }, { type: "PINK_NORMAL_LARGE_RING", weight: 30 }],
    T10: [{ type: "GRAY_CIRCLE_NORMAL", weight: 15 }, { type: "GRAY_PINWHEEL_LARGE_STRIPE", weight: 15 }, { type: "PINK_SQUARE_NORMAL_STRIPE", weight: 10 }, { type: "PINK_CIRCLE_LARGE", weight: 15 }, { type: "PINK_PINWHEEL_LARGE", weight: 10 }, { type: "PINK_NORMAL_LARGE_RING", weight: 35 }]
};

// --- バリエーション: 句読点多め (Greenの比率が高い) ---
export const ENEMY_TIER_PUNCTUATION_HEAVY = {
    description: "句読点多め（Greenタイプ混成）",
    T1:  [{ type: "GRAY_CIRCLE_SMALL", weight: 30 }, { type: "GRAY_SQUARE_SMALL", weight: 10 }, { type: "GREEN_SQUARE_SMALL", weight: 50 }, { type: "GREEN_CIRCLE_SMALL", weight: 10 }],
    T2:  [{ type: "GRAY_CIRCLE_NORMAL", weight: 20 }, { type: "GRAY_SQUARE_SMALL_STRIPE", weight: 15 }, { type: "GREEN_PINWHEEL_SMALL", weight: 50 }, { type: "GREEN_SQUARE_NORMAL", weight: 15 }],
    T3:  [{ type: "GRAY_PINWHEEL_NORMAL", weight: 15 }, { type: "GRAY_SQUARE_NORMAL", weight: 25 }, { type: "GREEN_PINWHEEL_NORMAL", weight: 40 }, { type: "GREEN_CIRCLE_NORMAL_STRIPE", weight: 20 }],
    T4:  [{ type: "GRAY_SQUARE_NORMAL", weight: 25 }, { type: "GRAY_CIRCLE_NORMAL_STRIPE", weight: 15 }, { type: "GREEN_SQUARE_NORMAL", weight: 35 }, { type: "GREEN_PINWHEEL_SMALL", weight: 10 }, { type: "GREEN_SQUARE_LARGE_RING", weight: 15 }],
    T5:  [{ type: "GRAY_SQUARE_NORMAL_STRIPE", weight: 25 }, { type: "GRAY_CIRCLE_NORMAL", weight: 25 }, { type: "GREEN_CIRCLE_LARGE", weight: 40 }, { type: "GREEN_PINWHEEL_NORMAL_STRIPE", weight: 10 }, { type: "GREEN_CIRCLE_LARGE_RING", weight: 10 }],
    T6:  [{ type: "GREEN_CIRCLE_LARGE_STRIPE", weight: 45 }, { type: "GREEN_SQUARE_LARGE", weight: 20 }, { type: "GRAY_PINWHEEL_NORMAL", weight: 15 }, { type: "GRAY_SQUARE_NORMAL_STRIPE", weight: 10 }, { type: "GREEN_CIRCLE_LARGE_RING", weight: 20 }],
    T7:  [{ type: "GRAY_PINWHEEL_LARGE", weight: 15 }, { type: "GRAY_CIRCLE_NORMAL", weight: 15 }, { type: "GREEN_PINWHEEL_NORMAL_STRIPE", weight: 30 }, { type: "GREEN_CIRCLE_LARGE", weight: 15 }, { type: "GREEN_CIRCLE_LARGE_RING", weight: 25 }],
    T8:  [{ type: "GRAY_SQUARE_NORMAL", weight: 25 }, { type: "GRAY_PINWHEEL_LARGE_STRIPE", weight: 20 }, { type: "GREEN_SQUARE_LARGE", weight: 25 }, { type: "GREEN_PINWHEEL_LARGE", weight: 10 }, { type: "GREEN_CIRCLE_LARGE_RING", weight: 30 }],
    T9:  [{ type: "GRAY_PINWHEEL_NORMAL", weight: 10 }, { type: "GREEN_SQUARE_NORMAL", weight: 30 }, { type: "GREEN_CIRCLE_LARGE_STRIPE", weight: 20 }, { type: "GREEN_SQUARE_NORMAL_STRIPE", weight: 10 }, { type: "GREEN_PINWHEEL_LARGE", weight: 10 }, { type: "GREEN_CIRCLE_LARGE_RING", weight: 30 }],
    T10: [{ type: "GRAY_CIRCLE_NORMAL", weight: 15 }, { type: "GRAY_PINWHEEL_LARGE_STRIPE", weight: 15 }, { type: "GREEN_SQUARE_NORMAL_STRIPE", weight: 10 }, { type: "GREEN_SQUARE_LARGE", weight: 15 }, { type: "GREEN_PINWHEEL_LARGE", weight: 10 }, { type: "GREEN_CIRCLE_LARGE_RING", weight: 35 }]
};

// --- バリエーション: 促音多め (Blueの比率が高い) ---
export const ENEMY_TIER_SOKUON_HEAVY = {
    description: "促音多め（Blueタイプ混成）",
    T1:  [{ type: "GRAY_CIRCLE_SMALL", weight: 30 }, { type: "GRAY_PINWHEEL_SMALL", weight: 10 }, { type: "BLUE_PINWHEEL_SMALL", weight: 50 }, { type: "BLUE_CIRCLE_SMALL", weight: 10 }],
    T2:  [{ type: "GRAY_CIRCLE_NORMAL", weight: 20 }, { type: "GRAY_SQUARE_SMALL_STRIPE", weight: 15 }, { type: "BLUE_CIRCLE_NORMAL", weight: 50 }, { type: "BLUE_PINWHEEL_NORMAL", weight: 15 }],
    T3:  [{ type: "GRAY_PINWHEEL_NORMAL", weight: 15 }, { type: "GRAY_SQUARE_NORMAL", weight: 25 }, { type: "BLUE_CIRCLE_NORMAL_STRIPE", weight: 40 }, { type: "BLUE_SQUARE_NORMAL", weight: 20 }],
    T4:  [{ type: "GRAY_SQUARE_NORMAL", weight: 25 }, { type: "GRAY_CIRCLE_NORMAL_STRIPE", weight: 15 }, { type: "BLUE_CIRCLE_NORMAL", weight: 35 }, { type: "BLUE_PINWHEEL_NORMAL", weight: 10 }, { type: "BLUE_CIRCLE_LARGE_RING", weight: 15 }],
    T5:  [{ type: "GRAY_SQUARE_NORMAL_STRIPE", weight: 25 }, { type: "GRAY_CIRCLE_NORMAL", weight: 25 }, { type: "BLUE_SQUARE_LARGE", weight: 40 }, { type: "BLUE_CIRCLE_NORMAL_STRIPE", weight: 10 }, { type: "BLUE_SQUARE_LARGE_RING", weight: 10 }],
    T6:  [{ type: "BLUE_SQUARE_LARGE_STRIPE", weight: 45 }, { type: "BLUE_CIRCLE_LARGE", weight: 20 }, { type: "GRAY_PINWHEEL_NORMAL", weight: 15 }, { type: "GRAY_SQUARE_NORMAL_STRIPE", weight: 10 }, { type: "BLUE_SQUARE_LARGE_RING", weight: 20 }],
    T7:  [{ type: "GRAY_PINWHEEL_LARGE", weight: 15 }, { type: "GRAY_CIRCLE_NORMAL", weight: 15 }, { type: "BLUE_PINWHEEL_NORMAL_STRIPE", weight: 30 }, { type: "BLUE_SQUARE_LARGE", weight: 15 }, { type: "BLUE_SQUARE_LARGE_RING", weight: 25 }],
    T8:  [{ type: "GRAY_SQUARE_NORMAL", weight: 25 }, { type: "GRAY_PINWHEEL_LARGE_STRIPE", weight: 20 }, { type: "BLUE_CIRCLE_LARGE", weight: 25 }, { type: "BLUE_PINWHEEL_LARGE", weight: 10 }, { type: "BLUE_SQUARE_LARGE_RING", weight: 30 }],
    T9:  [{ type: "GRAY_PINWHEEL_NORMAL", weight: 10 }, { type: "BLUE_SQUARE_NORMAL", weight: 30 }, { type: "BLUE_SQUARE_LARGE_STRIPE", weight: 20 }, { type: "BLUE_CIRCLE_NORMAL", weight: 10 }, { type: "BLUE_SQUARE_LARGE", weight: 10 }, { type: "BLUE_SQUARE_LARGE_RING", weight: 30 }],
    T10: [{ type: "GRAY_CIRCLE_NORMAL", weight: 15 }, { type: "GRAY_PINWHEEL_LARGE_STRIPE", weight: 15 }, { type: "BLUE_SQUARE_NORMAL_STRIPE", weight: 10 }, { type: "BLUE_SQUARE_LARGE", weight: 15 }, { type: "BLUE_PINWHEEL_LARGE", weight: 10 }, { type: "BLUE_SQUARE_LARGE_RING", weight: 35 }]
};

// --- バリエーション: ことわざ多め (Yellowの比率が高い) ---
export const ENEMY_TIER_PROVERB_HEAVY = {
    description: "ことわざ多め（Yellowタイプ混成）",
    T1:  [{ type: "GRAY_CIRCLE_SMALL", weight: 30 }, { type: "GRAY_SQUARE_SMALL", weight: 10 }, { type: "YELLOW_CIRCLE_NORMAL", weight: 50 }, { type: "YELLOW_SQUARE_NORMAL", weight: 10 }],
    T2:  [{ type: "GRAY_CIRCLE_NORMAL", weight: 20 }, { type: "GRAY_SQUARE_SMALL_STRIPE", weight: 15 }, { type: "YELLOW_PINWHEEL_NORMAL", weight: 50 }, { type: "YELLOW_CIRCLE_NORMAL", weight: 15 }],
    T3:  [{ type: "GRAY_PINWHEEL_NORMAL", weight: 15 }, { type: "GRAY_SQUARE_NORMAL", weight: 25 }, { type: "YELLOW_PINWHEEL_NORMAL", weight: 40 }, { type: "YELLOW_SQUARE_NORMAL_STRIPE", weight: 20 }],
    T4:  [{ type: "GRAY_SQUARE_NORMAL", weight: 25 }, { type: "GRAY_CIRCLE_NORMAL_STRIPE", weight: 15 }, { type: "YELLOW_SQUARE_LARGE", weight: 35 }, { type: "YELLOW_PINWHEEL_NORMAL", weight: 10 }, { type: "YELLOW_SQUARE_LARGE_RING", weight: 15 }],
    T5:  [{ type: "GRAY_SQUARE_NORMAL_STRIPE", weight: 25 }, { type: "GRAY_CIRCLE_NORMAL", weight: 25 }, { type: "YELLOW_CIRCLE_LARGE", weight: 40 }, { type: "YELLOW_SQUARE_NORMAL_STRIPE", weight: 10 }, { type: "YELLOW_CIRCLE_LARGE_RING", weight: 10 }],
    T6:  [{ type: "YELLOW_SQUARE_LARGE_STRIPE", weight: 45 }, { type: "YELLOW_CIRCLE_LARGE", weight: 20 }, { type: "GRAY_PINWHEEL_NORMAL", weight: 15 }, { type: "GRAY_SQUARE_NORMAL_STRIPE", weight: 10 }, { type: "YELLOW_SQUARE_LARGE_RING", weight: 20 }],
    T7:  [{ type: "GRAY_PINWHEEL_LARGE", weight: 15 }, { type: "GRAY_CIRCLE_NORMAL", weight: 15 }, { type: "YELLOW_PINWHEEL_NORMAL_STRIPE", weight: 30 }, { type: "YELLOW_SQUARE_LARGE", weight: 15 }, { type: "YELLOW_SQUARE_LARGE_RING", weight: 25 }],
    T8:  [{ type: "GRAY_SQUARE_NORMAL", weight: 25 }, { type: "GRAY_PINWHEEL_LARGE_STRIPE", weight: 20 }, { type: "YELLOW_CIRCLE_LARGE", weight: 25 }, { type: "YELLOW_PINWHEEL_LARGE", weight: 10 }, { type: "YELLOW_SQUARE_LARGE_RING", weight: 30 }],
    T9:  [{ type: "GRAY_PINWHEEL_NORMAL", weight: 10 }, { type: "YELLOW_SQUARE_NORMAL", weight: 30 }, { type: "YELLOW_SQUARE_LARGE_STRIPE", weight: 20 }, { type: "YELLOW_CIRCLE_NORMAL", weight: 10 }, { type: "YELLOW_SQUARE_LARGE", weight: 10 }, { type: "YELLOW_SQUARE_LARGE_RING", weight: 30 }],
    T10: [{ type: "GRAY_CIRCLE_NORMAL", weight: 15 }, { type: "GRAY_PINWHEEL_LARGE_STRIPE", weight: 15 }, { type: "YELLOW_SQUARE_NORMAL_STRIPE", weight: 10 }, { type: "YELLOW_SQUARE_LARGE", weight: 15 }, { type: "YELLOW_PINWHEEL_LARGE", weight: 10 }, { type: "YELLOW_SQUARE_LARGE_RING", weight: 35 }]
};

// =====================================================
// 単色（ONLY）テーブル一覧
// ---------------------------------------------------------
// 全7色（GRAY / PURPLE / YELLOW / BLUE / PINK / GREEN / RED）を
// 同じ骨格で設計し、type は下記3階層の規則で必ず並べる。
//
//   1. size    : LARGE → NORMAL → SMALL       （そのパターン内での脅威度降順）
//   2. pattern : 無地 → STRIPE → RING         （易 → 難）
//   3. shape   : CIRCLE → SQUARE → PINWHEEL   （速度降順）
//
// この規則により、どの色でも
//   ・T1〜T4 : SMALL 主体のチュートリアル帯（装飾は STRIPE / RING が薄め）
//   ・T5     : LARGE が初登場し、難易度の転換点になる
//   ・T6〜T8 : LARGE / NORMAL 併存 + STRIPE / RING 強化
//   ・T9〜T10: LARGE 主体 + LARGE_RING / LARGE_STRIPE の豪華枠
// という難易度の上昇が、色によらず共通になる。
//
// 色は主shape（形状）で差別化する。
//   GRAY / PURPLE / YELLOW / RED … CIRCLE 主体
//   PINK / GREEN … SQUARE 主体
//   BLUE … PINWHEEL 主体
// ※重みは pickWeightedEntry() が合計で正規化する相対抽選のため、
//   各階層の weight 合計が 100 を超えていても挙動は weight 比のまま。
// ★YELLOW は「ことわざ＝短い語彙がない」ため SMALL タイプが存在しない
//   （enemySpawner.js / enemy.js で YELLOW_*_SMALL* は NORMAL へ強制変換される）。
//   そのため Yellow だけは NORMAL を最小サイズとして扱う。
// =====================================================

// --- 単色: 標準（Gray）のみ ---
export const ENEMY_TIER_GRAY_ONLY = {
    description: "標準（Grayタイプ）のみ",
    T1:  [{ type: "GRAY_CIRCLE_SMALL", weight: 80 }, { type: "GRAY_CIRCLE_NORMAL", weight: 20 }],
    T2:  [{ type: "GRAY_CIRCLE_SMALL", weight: 60 }, { type: "GRAY_SQUARE_SMALL", weight: 20 }, { type: "GRAY_PINWHEEL_SMALL", weight: 40 }, { type: "GRAY_CIRCLE_NORMAL", weight: 10 }],
    T3:  [{ type: "GRAY_CIRCLE_NORMAL", weight: 40 }, { type: "GRAY_SQUARE_NORMAL", weight: 60 }, { type: "GRAY_CIRCLE_SMALL_STRIPE", weight: 30 }],
    T4:  [{ type: "GRAY_CIRCLE_NORMAL", weight: 25 }, { type: "GRAY_PINWHEEL_NORMAL", weight: 15 }, { type: "GRAY_SQUARE_NORMAL_STRIPE", weight: 50 }, { type: "GRAY_PINWHEEL_SMALL", weight: 20 }, { type: "GRAY_CIRCLE_SMALL_RING", weight: 20 }],
    T5:  [{ type: "GRAY_SQUARE_LARGE", weight: 20 }, { type: "GRAY_PINWHEEL_LARGE", weight: 25 }, { type: "GRAY_CIRCLE_NORMAL", weight: 25 }, { type: "GRAY_SQUARE_NORMAL", weight: 40 }, { type: "GRAY_PINWHEEL_NORMAL", weight: 10 }, { type: "GRAY_SQUARE_NORMAL_RING", weight: 15 }, { type: "GRAY_PINWHEEL_SMALL", weight: 5 }],
    T6:  [{ type: "GRAY_CIRCLE_LARGE", weight: 10 }, { type: "GRAY_SQUARE_LARGE", weight: 15 }, { type: "GRAY_PINWHEEL_LARGE", weight: 20 }, { type: "GRAY_PINWHEEL_LARGE_STRIPE", weight: 30 }, { type: "GRAY_CIRCLE_NORMAL", weight: 20 }, { type: "GRAY_SQUARE_NORMAL_STRIPE", weight: 30 }, { type: "GRAY_SQUARE_NORMAL_RING", weight: 30 }],
    T7:  [{ type: "GRAY_CIRCLE_LARGE", weight: 20 }, { type: "GRAY_SQUARE_LARGE", weight: 15 }, { type: "GRAY_PINWHEEL_LARGE_STRIPE", weight: 15 }, { type: "GRAY_CIRCLE_NORMAL", weight: 10 }, { type: "GRAY_PINWHEEL_NORMAL", weight: 25 }, { type: "GRAY_SQUARE_NORMAL_RING", weight: 25 }, { type: "GRAY_PINWHEEL_SMALL", weight: 5 }],
    T8:  [{ type: "GRAY_CIRCLE_LARGE", weight: 20 }, { type: "GRAY_SQUARE_LARGE", weight: 15 }, { type: "GRAY_PINWHEEL_LARGE", weight: 10 }, { type: "GRAY_CIRCLE_LARGE_RING", weight: 25 }, { type: "GRAY_CIRCLE_NORMAL", weight: 20 }, { type: "GRAY_SQUARE_NORMAL", weight: 10 }, { type: "GRAY_PINWHEEL_SMALL", weight: 5 }],
    T9:  [{ type: "GRAY_CIRCLE_LARGE", weight: 30 }, { type: "GRAY_SQUARE_LARGE", weight: 15 }, { type: "GRAY_PINWHEEL_LARGE", weight: 10 }, { type: "GRAY_PINWHEEL_LARGE_STRIPE", weight: 20 }, { type: "GRAY_CIRCLE_LARGE_RING", weight: 25 }, { type: "GRAY_PINWHEEL_NORMAL", weight: 15 }, { type: "GRAY_PINWHEEL_SMALL", weight: 5 }],
    T10: [{ type: "GRAY_CIRCLE_LARGE", weight: 30 }, { type: "GRAY_SQUARE_LARGE", weight: 15 }, { type: "GRAY_PINWHEEL_LARGE", weight: 10 }, { type: "GRAY_PINWHEEL_LARGE_STRIPE", weight: 30 }, { type: "GRAY_CIRCLE_LARGE_RING", weight: 30 }, { type: "GRAY_CIRCLE_NORMAL", weight: 10 }, { type: "GRAY_PINWHEEL_SMALL", weight: 5 }]
};

// --- 単色: 英語（Purple）のみ ---
export const ENEMY_TIER_PURPLE_ONLY = {
    description: "英語（Purpleタイプ）のみ",
    T1:  [{ type: "PURPLE_CIRCLE_SMALL", weight: 80 }, { type: "PURPLE_CIRCLE_NORMAL", weight: 20 }],
    T2:  [{ type: "PURPLE_CIRCLE_SMALL", weight: 60 }, { type: "PURPLE_SQUARE_SMALL", weight: 20 }, { type: "PURPLE_PINWHEEL_SMALL", weight: 40 }, { type: "PURPLE_CIRCLE_NORMAL", weight: 10 }],
    T3:  [{ type: "PURPLE_CIRCLE_NORMAL", weight: 40 }, { type: "PURPLE_SQUARE_NORMAL", weight: 60 }, { type: "PURPLE_CIRCLE_SMALL_STRIPE", weight: 30 }],
    T4:  [{ type: "PURPLE_CIRCLE_NORMAL", weight: 25 }, { type: "PURPLE_PINWHEEL_NORMAL", weight: 15 }, { type: "PURPLE_SQUARE_NORMAL_STRIPE", weight: 50 }, { type: "PURPLE_PINWHEEL_SMALL", weight: 20 }, { type: "PURPLE_CIRCLE_SMALL_RING", weight: 20 }],
    T5:  [{ type: "PURPLE_SQUARE_LARGE", weight: 20 }, { type: "PURPLE_PINWHEEL_LARGE", weight: 25 }, { type: "PURPLE_CIRCLE_NORMAL", weight: 25 }, { type: "PURPLE_SQUARE_NORMAL", weight: 40 }, { type: "PURPLE_PINWHEEL_NORMAL", weight: 10 }, { type: "PURPLE_SQUARE_NORMAL_RING", weight: 15 }, { type: "PURPLE_PINWHEEL_SMALL", weight: 5 }],
    T6:  [{ type: "PURPLE_CIRCLE_LARGE", weight: 10 }, { type: "PURPLE_SQUARE_LARGE", weight: 15 }, { type: "PURPLE_PINWHEEL_LARGE", weight: 20 }, { type: "PURPLE_PINWHEEL_LARGE_STRIPE", weight: 30 }, { type: "PURPLE_CIRCLE_NORMAL", weight: 20 }, { type: "PURPLE_SQUARE_NORMAL_STRIPE", weight: 30 }, { type: "PURPLE_SQUARE_NORMAL_RING", weight: 30 }],
    T7:  [{ type: "PURPLE_CIRCLE_LARGE", weight: 20 }, { type: "PURPLE_SQUARE_LARGE", weight: 15 }, { type: "PURPLE_PINWHEEL_LARGE_STRIPE", weight: 15 }, { type: "PURPLE_CIRCLE_NORMAL", weight: 10 }, { type: "PURPLE_PINWHEEL_NORMAL", weight: 25 }, { type: "PURPLE_SQUARE_NORMAL_RING", weight: 25 }, { type: "PURPLE_PINWHEEL_SMALL", weight: 5 }],
    T8:  [{ type: "PURPLE_CIRCLE_LARGE", weight: 20 }, { type: "PURPLE_SQUARE_LARGE", weight: 15 }, { type: "PURPLE_PINWHEEL_LARGE", weight: 10 }, { type: "PURPLE_CIRCLE_LARGE_RING", weight: 25 }, { type: "PURPLE_CIRCLE_NORMAL", weight: 20 }, { type: "PURPLE_SQUARE_NORMAL", weight: 10 }, { type: "PURPLE_PINWHEEL_SMALL", weight: 5 }],
    T9:  [{ type: "PURPLE_CIRCLE_LARGE", weight: 30 }, { type: "PURPLE_SQUARE_LARGE", weight: 15 }, { type: "PURPLE_PINWHEEL_LARGE", weight: 10 }, { type: "PURPLE_PINWHEEL_LARGE_STRIPE", weight: 20 }, { type: "PURPLE_CIRCLE_LARGE_RING", weight: 25 }, { type: "PURPLE_PINWHEEL_NORMAL", weight: 15 }, { type: "PURPLE_PINWHEEL_SMALL", weight: 5 }],
    T10: [{ type: "PURPLE_CIRCLE_LARGE", weight: 30 }, { type: "PURPLE_SQUARE_LARGE", weight: 15 }, { type: "PURPLE_PINWHEEL_LARGE", weight: 10 }, { type: "PURPLE_PINWHEEL_LARGE_STRIPE", weight: 30 }, { type: "PURPLE_CIRCLE_LARGE_RING", weight: 30 }, { type: "PURPLE_CIRCLE_NORMAL", weight: 10 }, { type: "PURPLE_PINWHEEL_SMALL", weight: 5 }]
};

// --- 単色: ことわざ（Yellow）のみ ---
// ★ことわざは短い語彙が無く SMALL が作れないため、最小サイズは NORMAL。
//   T1〜T4 の「チュートリアル帯」は NORMAL の Rings / Stripes で表現する。
export const ENEMY_TIER_YELLOW_ONLY = {
    description: "ことわざ（Yellowタイプ）のみ",
    T1:  [{ type: "YELLOW_CIRCLE_NORMAL", weight: 80 }, { type: "YELLOW_SQUARE_NORMAL", weight: 20 }],
    T2:  [{ type: "YELLOW_CIRCLE_NORMAL", weight: 60 }, { type: "YELLOW_SQUARE_NORMAL", weight: 20 }, { type: "YELLOW_PINWHEEL_NORMAL", weight: 40 }, { type: "YELLOW_CIRCLE_NORMAL_STRIPE", weight: 10 }],
    T3:  [{ type: "YELLOW_CIRCLE_NORMAL", weight: 40 }, { type: "YELLOW_SQUARE_NORMAL", weight: 60 }, { type: "YELLOW_CIRCLE_NORMAL_STRIPE", weight: 30 }],
    T4:  [{ type: "YELLOW_CIRCLE_NORMAL", weight: 25 }, { type: "YELLOW_PINWHEEL_NORMAL", weight: 15 }, { type: "YELLOW_SQUARE_NORMAL_STRIPE", weight: 50 }, { type: "YELLOW_CIRCLE_NORMAL_RING", weight: 20 }],
    T5:  [{ type: "YELLOW_SQUARE_LARGE", weight: 20 }, { type: "YELLOW_PINWHEEL_LARGE", weight: 25 }, { type: "YELLOW_CIRCLE_NORMAL", weight: 25 }, { type: "YELLOW_SQUARE_NORMAL", weight: 40 }, { type: "YELLOW_PINWHEEL_NORMAL", weight: 10 }, { type: "YELLOW_SQUARE_NORMAL_RING", weight: 15 }],
    T6:  [{ type: "YELLOW_CIRCLE_LARGE", weight: 10 }, { type: "YELLOW_SQUARE_LARGE", weight: 15 }, { type: "YELLOW_PINWHEEL_LARGE", weight: 20 }, { type: "YELLOW_PINWHEEL_LARGE_STRIPE", weight: 30 }, { type: "YELLOW_CIRCLE_NORMAL", weight: 20 }, { type: "YELLOW_SQUARE_NORMAL_STRIPE", weight: 30 }, { type: "YELLOW_SQUARE_NORMAL_RING", weight: 30 }],
    T7:  [{ type: "YELLOW_CIRCLE_LARGE", weight: 20 }, { type: "YELLOW_SQUARE_LARGE", weight: 15 }, { type: "YELLOW_PINWHEEL_LARGE_STRIPE", weight: 15 }, { type: "YELLOW_CIRCLE_NORMAL", weight: 10 }, { type: "YELLOW_PINWHEEL_NORMAL", weight: 25 }, { type: "YELLOW_SQUARE_NORMAL_RING", weight: 25 }],
    T8:  [{ type: "YELLOW_CIRCLE_LARGE", weight: 20 }, { type: "YELLOW_SQUARE_LARGE", weight: 15 }, { type: "YELLOW_PINWHEEL_LARGE", weight: 10 }, { type: "YELLOW_CIRCLE_LARGE_RING", weight: 25 }, { type: "YELLOW_CIRCLE_NORMAL", weight: 20 }, { type: "YELLOW_SQUARE_NORMAL", weight: 10 }],
    T9:  [{ type: "YELLOW_CIRCLE_LARGE", weight: 30 }, { type: "YELLOW_SQUARE_LARGE", weight: 15 }, { type: "YELLOW_PINWHEEL_LARGE", weight: 10 }, { type: "YELLOW_PINWHEEL_LARGE_STRIPE", weight: 20 }, { type: "YELLOW_CIRCLE_LARGE_RING", weight: 25 }, { type: "YELLOW_PINWHEEL_NORMAL", weight: 15 }],
    T10: [{ type: "YELLOW_CIRCLE_LARGE", weight: 30 }, { type: "YELLOW_SQUARE_LARGE", weight: 15 }, { type: "YELLOW_PINWHEEL_LARGE", weight: 10 }, { type: "YELLOW_PINWHEEL_LARGE_STRIPE", weight: 30 }, { type: "YELLOW_CIRCLE_LARGE_RING", weight: 30 }, { type: "YELLOW_CIRCLE_NORMAL", weight: 10 }]
};

// --- 単色: 促音（Blue）のみ ---
export const ENEMY_TIER_BLUE_ONLY = {
    description: "促音（Blueタイプ）のみ",
    T1:  [{ type: "BLUE_PINWHEEL_SMALL", weight: 80 }, { type: "BLUE_PINWHEEL_NORMAL", weight: 20 }],
    T2:  [{ type: "BLUE_CIRCLE_SMALL", weight: 60 }, { type: "BLUE_SQUARE_SMALL", weight: 20 }, { type: "BLUE_PINWHEEL_SMALL", weight: 40 }, { type: "BLUE_PINWHEEL_NORMAL", weight: 10 }],
    T3:  [{ type: "BLUE_CIRCLE_NORMAL", weight: 40 }, { type: "BLUE_SQUARE_NORMAL", weight: 60 }, { type: "BLUE_PINWHEEL_SMALL_STRIPE", weight: 30 }],
    T4:  [{ type: "BLUE_SQUARE_NORMAL", weight: 10 }, { type: "BLUE_PINWHEEL_NORMAL", weight: 30 }, { type: "BLUE_CIRCLE_NORMAL_STRIPE", weight: 50 }, { type: "BLUE_PINWHEEL_SMALL", weight: 20 }, { type: "BLUE_PINWHEEL_SMALL_RING", weight: 20 }],
    T5:  [{ type: "BLUE_SQUARE_LARGE", weight: 20 }, { type: "BLUE_PINWHEEL_LARGE", weight: 25 }, { type: "BLUE_CIRCLE_NORMAL", weight: 25 }, { type: "BLUE_SQUARE_NORMAL", weight: 40 }, { type: "BLUE_PINWHEEL_NORMAL", weight: 10 }, { type: "BLUE_SQUARE_NORMAL_RING", weight: 15 }, { type: "BLUE_CIRCLE_SMALL", weight: 5 }],
    T6:  [{ type: "BLUE_CIRCLE_LARGE", weight: 10 }, { type: "BLUE_SQUARE_LARGE", weight: 15 }, { type: "BLUE_PINWHEEL_LARGE", weight: 20 }, { type: "BLUE_PINWHEEL_LARGE_STRIPE", weight: 30 }, { type: "BLUE_PINWHEEL_NORMAL", weight: 20 }, { type: "BLUE_SQUARE_NORMAL_STRIPE", weight: 30 }, { type: "BLUE_SQUARE_NORMAL_RING", weight: 30 }],
    T7:  [{ type: "BLUE_CIRCLE_LARGE", weight: 20 }, { type: "BLUE_SQUARE_LARGE", weight: 15 }, { type: "BLUE_PINWHEEL_LARGE_STRIPE", weight: 15 }, { type: "BLUE_SQUARE_NORMAL", weight: 30 }, { type: "BLUE_PINWHEEL_NORMAL", weight: 15 }, { type: "BLUE_SQUARE_NORMAL_RING", weight: 20 }],
    T8:  [{ type: "BLUE_CIRCLE_LARGE", weight: 20 }, { type: "BLUE_SQUARE_LARGE", weight: 15 }, { type: "BLUE_PINWHEEL_LARGE", weight: 10 }, { type: "BLUE_PINWHEEL_LARGE_RING", weight: 25 }, { type: "BLUE_PINWHEEL_NORMAL", weight: 20 }, { type: "BLUE_SQUARE_NORMAL", weight: 10 }],
    T9:  [{ type: "BLUE_CIRCLE_LARGE", weight: 30 }, { type: "BLUE_SQUARE_LARGE", weight: 15 }, { type: "BLUE_PINWHEEL_LARGE", weight: 10 }, { type: "BLUE_PINWHEEL_LARGE_STRIPE", weight: 20 }, { type: "BLUE_PINWHEEL_LARGE_RING", weight: 25 }, { type: "BLUE_PINWHEEL_NORMAL", weight: 15 }],
    T10: [{ type: "BLUE_CIRCLE_LARGE", weight: 30 }, { type: "BLUE_SQUARE_LARGE", weight: 15 }, { type: "BLUE_PINWHEEL_LARGE", weight: 10 }, { type: "BLUE_PINWHEEL_LARGE_STRIPE", weight: 30 }, { type: "BLUE_PINWHEEL_LARGE_RING", weight: 30 }, { type: "BLUE_PINWHEEL_NORMAL", weight: 10 }]
};

// --- 単色: 擬音（Pink）のみ ---
export const ENEMY_TIER_PINK_ONLY = {
    description: "擬音（Pinkタイプ）のみ",
    T1:  [{ type: "PINK_SQUARE_SMALL", weight: 80 }, { type: "PINK_SQUARE_NORMAL", weight: 20 }],
    T2:  [{ type: "PINK_CIRCLE_SMALL", weight: 60 }, { type: "PINK_SQUARE_SMALL", weight: 20 }, { type: "PINK_PINWHEEL_SMALL", weight: 40 }, { type: "PINK_SQUARE_NORMAL", weight: 10 }],
    T3:  [{ type: "PINK_CIRCLE_NORMAL", weight: 40 }, { type: "PINK_SQUARE_NORMAL", weight: 60 }, { type: "PINK_SQUARE_SMALL_STRIPE", weight: 30 }],
    T4:  [{ type: "PINK_CIRCLE_NORMAL", weight: 25 }, { type: "PINK_PINWHEEL_NORMAL", weight: 15 }, { type: "PINK_SQUARE_NORMAL_STRIPE", weight: 50 }, { type: "PINK_PINWHEEL_SMALL", weight: 20 }, { type: "PINK_SQUARE_SMALL_RING", weight: 20 }],
    T5:  [{ type: "PINK_SQUARE_LARGE", weight: 20 }, { type: "PINK_PINWHEEL_LARGE", weight: 25 }, { type: "PINK_CIRCLE_NORMAL", weight: 25 }, { type: "PINK_SQUARE_NORMAL", weight: 40 }, { type: "PINK_PINWHEEL_NORMAL", weight: 10 }, { type: "PINK_SQUARE_NORMAL_RING", weight: 15 }, { type: "PINK_PINWHEEL_SMALL", weight: 5 }],
    T6:  [{ type: "PINK_CIRCLE_LARGE", weight: 10 }, { type: "PINK_SQUARE_LARGE", weight: 15 }, { type: "PINK_PINWHEEL_LARGE", weight: 20 }, { type: "PINK_PINWHEEL_LARGE_STRIPE", weight: 30 }, { type: "PINK_CIRCLE_NORMAL", weight: 20 }, { type: "PINK_SQUARE_NORMAL_STRIPE", weight: 30 }, { type: "PINK_SQUARE_NORMAL_RING", weight: 30 }],
    T7:  [{ type: "PINK_CIRCLE_LARGE", weight: 20 }, { type: "PINK_SQUARE_LARGE", weight: 15 }, { type: "PINK_PINWHEEL_LARGE_STRIPE", weight: 15 }, { type: "PINK_CIRCLE_NORMAL", weight: 10 }, { type: "PINK_PINWHEEL_NORMAL", weight: 25 }, { type: "PINK_SQUARE_NORMAL_RING", weight: 25 }, { type: "PINK_PINWHEEL_SMALL", weight: 5 }],
    T8:  [{ type: "PINK_CIRCLE_LARGE", weight: 20 }, { type: "PINK_SQUARE_LARGE", weight: 15 }, { type: "PINK_PINWHEEL_LARGE", weight: 10 }, { type: "PINK_CIRCLE_LARGE_RING", weight: 25 }, { type: "PINK_CIRCLE_NORMAL", weight: 20 }, { type: "PINK_SQUARE_NORMAL", weight: 10 }, { type: "PINK_PINWHEEL_SMALL", weight: 5 }],
    T9:  [{ type: "PINK_CIRCLE_LARGE", weight: 30 }, { type: "PINK_SQUARE_LARGE", weight: 15 }, { type: "PINK_PINWHEEL_LARGE", weight: 10 }, { type: "PINK_PINWHEEL_LARGE_STRIPE", weight: 20 }, { type: "PINK_CIRCLE_LARGE_RING", weight: 25 }, { type: "PINK_PINWHEEL_NORMAL", weight: 15 }, { type: "PINK_PINWHEEL_SMALL", weight: 5 }],
    T10: [{ type: "PINK_CIRCLE_LARGE", weight: 30 }, { type: "PINK_SQUARE_LARGE", weight: 15 }, { type: "PINK_PINWHEEL_LARGE", weight: 10 }, { type: "PINK_PINWHEEL_LARGE_STRIPE", weight: 30 }, { type: "PINK_CIRCLE_LARGE_RING", weight: 30 }, { type: "PINK_CIRCLE_NORMAL", weight: 10 }, { type: "PINK_PINWHEEL_SMALL", weight: 5 }]
};

// --- 単色: 句読点（Green）のみ ---
export const ENEMY_TIER_GREEN_ONLY = {
    description: "句読点（Greenタイプ）のみ",
    T1:  [{ type: "GREEN_SQUARE_SMALL", weight: 80 }, { type: "GREEN_SQUARE_NORMAL", weight: 20 }],
    T2:  [{ type: "GREEN_CIRCLE_SMALL", weight: 60 }, { type: "GREEN_SQUARE_SMALL", weight: 20 }, { type: "GREEN_PINWHEEL_SMALL", weight: 40 }, { type: "GREEN_SQUARE_NORMAL", weight: 10 }],
    T3:  [{ type: "GREEN_CIRCLE_NORMAL", weight: 40 }, { type: "GREEN_SQUARE_NORMAL", weight: 60 }, { type: "GREEN_SQUARE_SMALL_STRIPE", weight: 30 }],
    T4:  [{ type: "GREEN_CIRCLE_NORMAL", weight: 25 }, { type: "GREEN_PINWHEEL_NORMAL", weight: 15 }, { type: "GREEN_SQUARE_NORMAL_STRIPE", weight: 50 }, { type: "GREEN_PINWHEEL_SMALL", weight: 20 }, { type: "GREEN_SQUARE_SMALL_RING", weight: 20 }],
    T5:  [{ type: "GREEN_SQUARE_LARGE", weight: 20 }, { type: "GREEN_PINWHEEL_LARGE", weight: 25 }, { type: "GREEN_CIRCLE_NORMAL", weight: 25 }, { type: "GREEN_SQUARE_NORMAL", weight: 40 }, { type: "GREEN_PINWHEEL_NORMAL", weight: 10 }, { type: "GREEN_SQUARE_NORMAL_RING", weight: 15 }, { type: "GREEN_PINWHEEL_SMALL", weight: 5 }],
    T6:  [{ type: "GREEN_CIRCLE_LARGE", weight: 10 }, { type: "GREEN_SQUARE_LARGE", weight: 15 }, { type: "GREEN_PINWHEEL_LARGE", weight: 20 }, { type: "GREEN_PINWHEEL_LARGE_STRIPE", weight: 30 }, { type: "GREEN_CIRCLE_NORMAL", weight: 20 }, { type: "GREEN_SQUARE_NORMAL_STRIPE", weight: 30 }, { type: "GREEN_SQUARE_NORMAL_RING", weight: 30 }],
    T7:  [{ type: "GREEN_CIRCLE_LARGE", weight: 20 }, { type: "GREEN_SQUARE_LARGE", weight: 15 }, { type: "GREEN_PINWHEEL_LARGE_STRIPE", weight: 15 }, { type: "GREEN_CIRCLE_NORMAL", weight: 10 }, { type: "GREEN_PINWHEEL_NORMAL", weight: 25 }, { type: "GREEN_SQUARE_NORMAL_RING", weight: 25 }, { type: "GREEN_PINWHEEL_SMALL", weight: 5 }],
    T8:  [{ type: "GREEN_CIRCLE_LARGE", weight: 20 }, { type: "GREEN_SQUARE_LARGE", weight: 15 }, { type: "GREEN_PINWHEEL_LARGE", weight: 10 }, { type: "GREEN_CIRCLE_LARGE_RING", weight: 25 }, { type: "GREEN_CIRCLE_NORMAL", weight: 20 }, { type: "GREEN_SQUARE_NORMAL", weight: 10 }, { type: "GREEN_PINWHEEL_SMALL", weight: 5 }],
    T9:  [{ type: "GREEN_CIRCLE_LARGE", weight: 30 }, { type: "GREEN_SQUARE_LARGE", weight: 15 }, { type: "GREEN_PINWHEEL_LARGE", weight: 10 }, { type: "GREEN_PINWHEEL_LARGE_STRIPE", weight: 20 }, { type: "GREEN_CIRCLE_LARGE_RING", weight: 25 }, { type: "GREEN_PINWHEEL_NORMAL", weight: 15 }, { type: "GREEN_PINWHEEL_SMALL", weight: 5 }],
    T10: [{ type: "GREEN_CIRCLE_LARGE", weight: 30 }, { type: "GREEN_SQUARE_LARGE", weight: 15 }, { type: "GREEN_PINWHEEL_LARGE", weight: 10 }, { type: "GREEN_PINWHEEL_LARGE_STRIPE", weight: 30 }, { type: "GREEN_CIRCLE_LARGE_RING", weight: 30 }, { type: "GREEN_CIRCLE_NORMAL", weight: 10 }, { type: "GREEN_PINWHEEL_SMALL", weight: 5 }]
};

// --- 単色: 記号（Red）のみ ---
export const ENEMY_TIER_RED_ONLY = {
    description: "記号（Redタイプ）のみ",
    T1:  [{ type: "RED_CIRCLE_SMALL", weight: 80 }, { type: "RED_CIRCLE_NORMAL", weight: 20 }],
    T2:  [{ type: "RED_CIRCLE_SMALL", weight: 60 }, { type: "RED_SQUARE_SMALL", weight: 20 }, { type: "RED_PINWHEEL_SMALL", weight: 40 }, { type: "RED_CIRCLE_NORMAL", weight: 10 }],
    T3:  [{ type: "RED_CIRCLE_NORMAL", weight: 40 }, { type: "RED_SQUARE_NORMAL", weight: 60 }, { type: "RED_CIRCLE_SMALL_STRIPE", weight: 30 }],
    T4:  [{ type: "RED_CIRCLE_NORMAL", weight: 25 }, { type: "RED_PINWHEEL_NORMAL", weight: 15 }, { type: "RED_SQUARE_NORMAL_STRIPE", weight: 50 }, { type: "RED_PINWHEEL_SMALL", weight: 20 }, { type: "RED_CIRCLE_SMALL_RING", weight: 20 }],
    T5:  [{ type: "RED_SQUARE_LARGE", weight: 20 }, { type: "RED_PINWHEEL_LARGE", weight: 25 }, { type: "RED_CIRCLE_NORMAL", weight: 25 }, { type: "RED_SQUARE_NORMAL", weight: 40 }, { type: "RED_PINWHEEL_NORMAL", weight: 10 }, { type: "RED_SQUARE_NORMAL_RING", weight: 15 }, { type: "RED_PINWHEEL_SMALL", weight: 5 }],
    T6:  [{ type: "RED_CIRCLE_LARGE", weight: 10 }, { type: "RED_SQUARE_LARGE", weight: 15 }, { type: "RED_PINWHEEL_LARGE", weight: 20 }, { type: "RED_PINWHEEL_LARGE_STRIPE", weight: 30 }, { type: "RED_CIRCLE_NORMAL", weight: 20 }, { type: "RED_SQUARE_NORMAL_STRIPE", weight: 30 }, { type: "RED_SQUARE_NORMAL_RING", weight: 30 }],
    T7:  [{ type: "RED_CIRCLE_LARGE", weight: 20 }, { type: "RED_SQUARE_LARGE", weight: 15 }, { type: "RED_PINWHEEL_LARGE_STRIPE", weight: 15 }, { type: "RED_CIRCLE_NORMAL", weight: 10 }, { type: "RED_PINWHEEL_NORMAL", weight: 25 }, { type: "RED_SQUARE_NORMAL_RING", weight: 25 }, { type: "RED_PINWHEEL_SMALL", weight: 5 }],
    T8:  [{ type: "RED_CIRCLE_LARGE", weight: 20 }, { type: "RED_SQUARE_LARGE", weight: 15 }, { type: "RED_PINWHEEL_LARGE", weight: 10 }, { type: "RED_CIRCLE_LARGE_RING", weight: 25 }, { type: "RED_CIRCLE_NORMAL", weight: 20 }, { type: "RED_SQUARE_NORMAL", weight: 10 }, { type: "RED_PINWHEEL_SMALL", weight: 5 }],
    T9:  [{ type: "RED_CIRCLE_LARGE", weight: 30 }, { type: "RED_SQUARE_LARGE", weight: 15 }, { type: "RED_PINWHEEL_LARGE", weight: 10 }, { type: "RED_PINWHEEL_LARGE_STRIPE", weight: 20 }, { type: "RED_CIRCLE_LARGE_RING", weight: 25 }, { type: "RED_PINWHEEL_NORMAL", weight: 15 }, { type: "RED_PINWHEEL_SMALL", weight: 5 }],
    T10: [{ type: "RED_CIRCLE_LARGE", weight: 30 }, { type: "RED_SQUARE_LARGE", weight: 15 }, { type: "RED_PINWHEEL_LARGE", weight: 10 }, { type: "RED_PINWHEEL_LARGE_STRIPE", weight: 30 }, { type: "RED_CIRCLE_LARGE_RING", weight: 30 }, { type: "RED_CIRCLE_NORMAL", weight: 10 }, { type: "RED_PINWHEEL_SMALL", weight: 5 }]
};

// --- 属性セットのルックアップテーブル ---
export const TIER_TABLES = {
    ENEMY_TIER_BALANCED,
    ENEMY_TIER_ENGLISH_HEAVY,
    ENEMY_TIER_SYMBOL_HEAVY,
    ENEMY_TIER_ONOMATOPOEIA_HEAVY,
    ENEMY_TIER_PUNCTUATION_HEAVY,
    ENEMY_TIER_SOKUON_HEAVY,
    ENEMY_TIER_PROVERB_HEAVY,
    ENEMY_TIER_GRAY_ONLY,
    ENEMY_TIER_PURPLE_ONLY,
    ENEMY_TIER_YELLOW_ONLY,
    ENEMY_TIER_BLUE_ONLY,
    ENEMY_TIER_PINK_ONLY,
    ENEMY_TIER_GREEN_ONLY,
    ENEMY_TIER_RED_ONLY
};

// ======================================================
// 固定砲台 Tier定義
// ======================================================

// 固定砲台の追加重み。T3から出現し、T8以降で頭打ちにする。
// 属性「のみ」の表には混在させない。
const FIXED_TURRET_TIER_ENTRIES = {
    T3:  [{ type: "FIXED_TURRET_LASER_T3",  weight: 5 }, { type: "FIXED_TURRET_BULLET_T3",  weight: 5 }],
    T4:  [{ type: "FIXED_TURRET_LASER_T4",  weight: 5 }, { type: "FIXED_TURRET_BULLET_T4",  weight: 5 }],
    T5:  [{ type: "FIXED_TURRET_LASER_T5",  weight: 5 }, { type: "FIXED_TURRET_BULLET_T5",  weight: 5 }],
    T6:  [{ type: "FIXED_TURRET_LASER_T6",  weight: 5 }, { type: "FIXED_TURRET_BULLET_T6",  weight: 5 }],
    T7:  [{ type: "FIXED_TURRET_LASER_T7",  weight: 5 }, { type: "FIXED_TURRET_BULLET_T7",  weight: 5 }],
    T8:  [{ type: "FIXED_TURRET_LASER_T8",  weight: 5 }, { type: "FIXED_TURRET_BULLET_T8",  weight: 5 }],
    T9:  [{ type: "FIXED_TURRET_LASER_T9",  weight: 5 }, { type: "FIXED_TURRET_BULLET_T9",  weight: 5 }],
    T10: [{ type: "FIXED_TURRET_LASER_T10", weight: 5 }, { type: "FIXED_TURRET_BULLET_T10", weight: 5 }],
};

function addFixedTurretEntriesToTable(table) {
    if (!table || String(table.description || "").includes("のみ")) return;

    for (const [tierKey, entries] of Object.entries(FIXED_TURRET_TIER_ENTRIES)) {
        const target = table[tierKey];
        if (!Array.isArray(target) || !entries?.length) continue;

        const missing = entries.filter(entry =>
            !target.some(current => current?.type === entry.type)
        );
        if (missing.length > 0) {
            target.push(...missing.map(entry => ({ ...entry })));
        }
    }
}

// 公開Tier表自体にも固定砲台を反映し、getTierEnemies経由だけでなく
// テーブルを直接参照するツールからもT3以降の固定砲台を確認できる。
for (const table of Object.values(TIER_TABLES)) {
    addFixedTurretEntriesToTable(table);
}

// ======================================================
// 敵テーブル取得ユーティリティ
// ======================================================

// getTierEnemies() の戻り値に、配列自身を壊さずTierを紐付ける。
// staticなフェーズ定義が敵テーブルだけを持つ場合もここでTierを解決できる。
const ENEMY_TABLE_TIER = new WeakMap();

// 旧名互換用
const ENEMY_TIER_TABLE = ENEMY_TIER_BALANCED;

/**
 * 指定した属性テーブルからTierの敵セットを取得する。
 */
export function getTierEnemies(tierKey, table = ENEMY_TIER_BALANCED) {
    if (!table) return [];

    // 公開テーブルは初期化時に更新済みだが、外部から渡された表にも対応する。
    addFixedTurretEntriesToTable(table);

    const resultKey = table[tierKey] ? tierKey : "T1";
    const result = table[resultKey] || [];
    const entries = Array.isArray(result) ? [...result] : [];
    ENEMY_TABLE_TIER.set(entries, resultKey);
    return entries;
}

/**
 * 敵テーブルから、getTierEnemies() に紐付けたTierを取得する。
 * localStorageから復元された配列にはWeakMapの情報が残らないため、
 * その場合はステージ番号／spawn.tier のフォールバックを利用する。
 */
export function getTierFromEnemyTable(enemyTable) {
    if (!enemyTable || typeof enemyTable !== "object") return null;
    return ENEMY_TABLE_TIER.get(enemyTable) || null;
}

/**
 * 砲台制圧戦用の固定砲台テーブルを返す。
 * 固定砲台の専用定義はT3以降にあるため、T1・T2ではT3を最低Tierとして使う。
 * ★フリーモードの【砲台制圧戦】からも main.js 経由で使うため export している。
 */
export function getFixedTurretTable(tierKey) {
    const tierNumber = Math.max(3, normalizeTierNumber(tierKey));
    const effectiveTierKey = `T${Math.min(10, tierNumber)}`;
    const entries = (FIXED_TURRET_TIER_ENTRIES[effectiveTierKey] || [])
        .map(entry => ({ ...entry }));

    ENEMY_TABLE_TIER.set(entries, effectiveTierKey);
    return entries;
}

/**
 * 属性セットの説明を取得し、HTML着色スパンを返す（標準・Grayはそのまま）。
 */
export function getTierDescription(table = ENEMY_TIER_BALANCED) {
    const desc = table.description || "不明な属性";

    // 標準（Gray）またはそれに準ずる構成の場合はそのまま返す
    if (table === ENEMY_TIER_BALANCED || table === ENEMY_TIER_GRAY_ONLY) {
        return desc;
    }

    const colorMap = {
        "Purple": "#d48df0", // 英語
        "Red":    "#ff4d4f", // 記号
        "Pink":   "#ff85c0", // 擬音
        "Green":  "#73d13d", // 句読点
        "Blue":   "#40a9ff", // 促音
        "Yellow": "#ffec3d"  // ことわざ
    };

    for (const [key, color] of Object.entries(colorMap)) {
        if (desc.includes(key)) {
            return `<span style="color:${color}; font-weight:bold;">${desc}</span>`;
        }
    }

    return desc;
}

// ======================================================
// W1 T1後半（STAGE5〜10）の敵構成補正
// ======================================================
// T1後半だけはSmall偏重を緩和するため、Normal敵を一部加える。
// T2〜T4は既存のTierテーブルをそのまま利用する。
const W1_T1_LATE_EXTRA_ENTRIES = [
    { type: "GRAY_CIRCLE_NORMAL", weight: 20 },
    { type: "GRAY_SQUARE_NORMAL", weight: 20 }
];

function addW1T1LateComposition(enemyTable, stageNum) {
    if (
        !Array.isArray(enemyTable) ||
        !Number.isFinite(Number(stageNum)) ||
        Number(stageNum) < 5 ||
        Number(stageNum) > 10
    ) {
        return false;
    }

    const existingTypes = new Set(enemyTable.map(entry => entry?.type));
    const missing = W1_T1_LATE_EXTRA_ENTRIES.filter(entry =>
        !existingTypes.has(entry.type)
    );
    if (missing.length === 0) return false;

    enemyTable.push(...missing.map(entry => ({ ...entry })));
    return true;
}

function getStageEnemyTable(tierKey, table, stageNum) {
    const enemyTable = getTierEnemies(tierKey, table);
    if (tierKey === "T1") {
        addW1T1LateComposition(enemyTable, stageNum);
    }
    return enemyTable;
}

// ======================================================
// アイテム Tier テーブル
// ======================================================
const ITEM_TIER_TABLE = {
    T1: [{ type: "HEAL_SMALL", weight: 100 }], // 序盤は回復のみ
    T2: [{ type: "HEAL_SMALL", weight: 50 }, { type: "KILL_SMALL", weight: 50 }],
    T3: [{ type: "HEAL_SMALL", weight: 40 }, { type: "KILL_SMALL", weight: 40 }, { type: "FREEZE_SMALL", weight: 20 }],
    T4: [{ type: "HEAL_MEDIUM", weight: 30 }, { type: "KILL_MEDIUM", weight: 30 }, { type: "FREEZE_MEDIUM", weight: 20 }, { type: "COOLDOWN_SMALL", weight: 20 }],
    T5: [{ type: "HEAL_LARGE", weight: 15 }, { type: "KILL_LARGE", weight: 15 }, { type: "FREEZE_LARGE", weight: 15 }, { type: "COOLDOWN_MEDIUM", weight: 13 }, { type: "HEAL_MEDIUM", weight: 12 }, { type: "KILL_MEDIUM", weight: 13 }, { type: "FREEZE_MEDIUM", weight: 12 }, { type: "KILL_ALL", weight: 5 }]
};

// ======================================================
// 表示用テキストビルダー
// ======================================================

export function buildEndText(end, playerConfig = null, defenseConfig = null) {
    const lines = [];

    // 防衛モードの場合は専用の終了条件を表示
    if (defenseConfig) {
        lines.push(`制限時間: ${defenseConfig.timeLimit || '-'}秒`);
        return lines;
    }

    if (!end) return lines;

    if (end.hpZero) {
        lines.push("HPが0になると終了");
    }

    if (end.failOnMissCount) {
        if (end.failOnMissCount === 1) {
            lines.push('<span style="color:#ff4d4f;">1回でもミスすると終了</span>');
        } else {
            lines.push(`<span style="color:#ff4d4f;">${end.failOnMissCount}回ミスすると終了</span>`);
        }
    }

    if (playerConfig && playerConfig.hpDrainPerSec > 0) {
        lines.push(`<span style="color:#ff4d4f;">毎秒HPが ${Math.floor(playerConfig.hpDrainPerSec)} 減少 (サボタージュ)</span>`);
    }

    if (end.timerMs != null) {
        lines.push(`${Math.round(end.timerMs / 1000)}秒で終了`);
    }

    if (end.killCount != null) {
        lines.push(`${end.killCount}体撃破で終了`);
    }

    if (end.allSpawnedDefeated) {
        lines.push("全敵撃破で終了");
    }

    return lines;
}

export function buildClearText(clear, defenseConfig = null) {
    const lines = [];

    // 明示的にクリア条件が定義されている場合は、まずそれを処理します。
    // そうでない場合、防衛モードでは defenseConfig がクリア条件の主要なソースとなります。
    if (clear) {
        if (clear.killCount != null) {
            lines.push(`敵を${clear.killCount}体倒せ`);
        }
        if (clear.chainCount != null) {
            lines.push(`チェイン${clear.chainCount}を達成せよ`);
        }
        if (clear.noMiss) {
            lines.push("ノーミスでクリアせよ");
        }
        if (clear.timerMs != null) {
            lines.push(`${Math.round(clear.timerMs / 1000)}秒以内にクリア`);
        }
        if (clear.survive != null) {
            lines.push(`生き残れ`);
        }
    }

    // defenseConfig が提供されている場合、常に防衛モード固有のクリア条件を追加します。
    // これにより、'clear' が null/undefined であっても防衛モードのクリア条件が表示されます。
    if (defenseConfig && defenseConfig.totalCharsToType != null) {
        lines.push(`目標文字数: ${defenseConfig.totalCharsToType}`);
    }

    return lines;
}

/**
 * 防衛モードのジャンル表記を整形する（複数タグ対応）
 * @param {string[]} genres - ['empty'] や ['empty', '促音', 'ことわざ'] など
 * @returns {string} 表示用テキスト（例: "標準・促音・ことわざ" / "全ジャンル"）
 */
export function formatDefenseGenres(genres) {
    if (!genres || genres.length === 0) return "標準";
    if (genres.includes("all")) return "全ジャンル";
    return genres.map(g => (g === "empty" ? "標準" : g)).join("・");
}

// スター評価取得条件テキスト
export function buildStarText(star = {}) {
    const lines = [];
    if (!star.type || !star.thresholds) return lines;

    const t = star.thresholds;

    switch (star.type) {

        case "typingSpeed":
            t.forEach((v, i) => {
                lines.push(`★${i+1}: ${Math.round(v)} KPM以上`);
            });
            break;

        case "clearTime":
            t.forEach((v, i) => {
                lines.push(`★${i+1}: ${Math.round(v/1000)}秒以内`);
            });
            break;

        case "accuracy":
            t.forEach((v, i) => {
                lines.push(`★${i+1}: 正確性${Math.round(v*100)}%以上`);
            });
            break;

        case "killCount":
            t.forEach((v, i) => {
                lines.push(`★${i+1}: ${v}体撃破`);
            });
            break;

        case "composite":
            t.forEach((v, i) => {
                lines.push(`★${i+1}: 総合評価 ${Math.round(v*100)}%以上`);
            });
            break;

        case "timeRemaining":
            t.forEach((v, i) => {
                lines.push(`★${i+1}: 残り時間 ${Math.round(v*100)}%以上`);
            });
            break;

        case "hpRemaining":
            t.forEach((v, i) => {
                lines.push(`★${i+1}: 残りHP ${Math.round(v*100)}%以上`);
            });
            break;

        case "defenseSurplus":
            t.forEach((v, i) => {
                const surplusWeight  = Math.round((star.weights?.surplus  ?? 0.7) * 100);
                const accuracyWeight = Math.round((star.weights?.accuracy ?? 0.3) * 100);
                lines.push(`★${i+1}: 総合評価 (タイピング量 ${surplusWeight}% + 正確性 ${accuracyWeight}%) ${Math.round(v * 100)}%以上`);
            });
            break;

        // 迎撃: 撃ち落とした弾の割合（迎撃率）で評価する。
        case "interceptRate":
            t.forEach((v, i) => {
                lines.push(`★${i+1}: 迎撃率${Math.round(v*100)}%以上`);
            });
            break;
    }

    return lines;
}

// DEVツールのためのステージ取得用関数
export function getStageConfig(stageId) {
    let stage = STAGES[stageId];
    if (!stage) return null;

    // フェーズがある場合は現在のフェーズ（または初期フェーズ）をベースにする仕組みが必要ならここで調整
    // 今回はCore側でフェーズを切り替えるため、オブジェクト全体を返す

    // 全体override
    if (devOverride.stage.global) {
        stage = applyOverride(stage, devOverride.stage.global);
    }

    return stage;
}

// =====================================================
// ステージ生成ロジック (1-100)
// =====================================================
/**
 * ステージ自動生成リファレンス
 * -----------------------------------------------------
 * 1. ミッションパターン (0-9):
 *    0: 【撃破目標】   - 標準。指定数撃破でクリア。
 *    1: 【生存目標】   - 制限時間まで生存。無限湧き。
 *    2: 【迎撃】       - 敵は一体も出ず、飛んでくる弾を撃ち落とす。出現総数を処理しきればクリア。
 *    3: 【電撃戦】     - 制限時間内にチェインを指定数までつなげる。
 *    4: 【砲台制圧戦】 - 固定砲台を主体に出現させ、倒しながら攻撃に耐える。
 *    5: 【タイムアタック】- 時間内に通常より多いノルマを達成。
 *    6: 【サボタージュ】- HP継続減少デバフ + 撃破目標。
 *    7: 【圧倒】       - 同時出現上限(maxAlive)大幅増 + 低速化で滞留 + 生存目標 + 出題10文字以内。
 *    8: 【精密射撃】   - 1ミスで即終了(failOnMiss) + 少数精鋭を撃破。
 *    9: 【純粋なる試練】- アイテム・スキル使用禁止 + 撃破目標。
 *    - 抽選ルール:
 *        下一桁 1-3: パターン 0-2 (基本・撃破/生存/迎撃)
 *        下一桁 9, 0: パターン 3-9 (応用・高難度/特殊条件)
 *
 * 1.5 敵構成のアクセント:
 *    - 通常は ENEMY_TIER_BALANCED (標準) を使用。
 *    - 下1桁が 5 , 10のステージ (5, 10, 15, 20, 25...) では、属性混成テーブルからランダムに選択される。
 *
 * 1.6 同時出現（マルチスポーン）:
 *    - spawn.multiCount    : 1回の出現で同時に出す敵の数（既定 1 = 従来どおり1体ずつ）
 *    - spawn.multiInterval : 何回に1回まとめて出すか（既定 1 = 毎回まとめて出す）
 *      multiInterval: 2 なら「2回に1回」だけ multiCount 匹を同時出現させる。
 *    - 出現例: multiCount:2, multiInterval:2 → 1回目1匹 / 2回目2匹 / 3回目1匹 / 4回目2匹 …
 *              multiCount:3, multiInterval:3 → 3回に1回だけ3匹同時
 *              multiCount:2, multiInterval:1 → 毎回2匹同時
 *    - 採用パターン:
 *        case3 電撃戦   : multiCount 2（i>=40 で3） / multiInterval 3（i>=40 で2）
 *        case4 砲台制圧戦: multiCount 2 / multiInterval 2
 *        case7 圧倒     : multiCount 3 / multiInterval 2
 *    - 注意: limit / maxAlive は1体ずつ判定して超過分は出現させずに打ち切る。
 *            limit:1 / maxAlive:1 のボス戦などでは実質無効（常に1体）。
 *            単語が枯渇した場合もその回の同時出現はそこで打ち切られる。
 *
 * 2. 難易度スケーリング (変数 i = ステージ番号):
 *    - 基本出現間隔: 3500ms（T1〜T4はTIER_SPAWN_PRESSUREで上書き）
 *    - 撃破目標: 12 + floor(i / 4)
 *    - 制限時間: 30s + (i * 1s)
 *    - 基本同時存在数: 4 + floor(i / 25) ※通常時最大8
 *    - T1〜T4はPressureプロファイルで段階的に強化（T5以降は現状値）
 *    - 特殊ミッションは既存のspawn設定を優先し、Pressureを適用しない
 *
 * 3. ステージ/環境設定:
 *    - 背景画像: 1-30:blue, 31-60:purple, 60-90:red
 *    - アイテム: ステージ12で解禁。
 *               出現率: 0.3 + (i * 0.005)
 *               Tier遷移: 10ステージごとにT1→T10へ上昇。
 *
 * 4. エネミーTier定義:
 *    - 通常クエストステージでは10ステージごとに T1 ～ T10 へ自動遷移する。
 *    - 自動生成ステージとの対応（STAGE1 ～ STAGE100）:
 *        T1  : STAGE1  - STAGE10
 *        T2  : STAGE11 - STAGE20
 *        T3  : STAGE21 - STAGE30
 *        T4  : STAGE31 - STAGE40
 *        T5  : STAGE41 - STAGE50
 *        T6  : STAGE51 - STAGE60
 *        T7  : STAGE61 - STAGE70
 *        T8  : STAGE71 - STAGE80
 *        T9  : STAGE81 - STAGE90
 *        T10 : STAGE91 - STAGE100
 *    - ステージ番号が100を超える場合はT10に固定される。
 *    - T1-T2: 小型/標準 (Gray主体)
 *    - T3-T5: 中型/特殊属性 (Purple, Blueなど) 混入開始
 *    - T6-T8: 大型/リング/ストライプ等の高耐久・複雑なワード
 *    - T9-T10: 各属性の最上位個体 + 低確率で超大型
 *    - ボス戦・特殊ステージは getTierEnemies("Tn", ...) の手動指定に従い、
 *      上記のステージ番号とは独立してT1～T10を選択する場合がある。
 *    - フリーモードも画面上で選択したTierを直接使用する。
 *
 * 5. スター評価:
 *    - パターンに応じて「KPM/クリア時間/正確性/残りHP/残り時間/総合」から動的に選出。
 */
// ==============================================================

function generateStage(i, tierTable = ENEMY_TIER_BALANCED, explicitPattern = null) {
    // --- 属性アクセントの決定ロジック ---
    let selectedTable = tierTable;

    // 下1桁が5または0のステージを「属性アクセントステージ」とする (例: 5, 10, 15, 20...)
    // かつ、引数で明示的に指定されていない場合のみ自動選択
    if ((i % 10 === 5 || i % 10 === 0) && tierTable === ENEMY_TIER_BALANCED) {
        const accentTables = [
            ENEMY_TIER_ENGLISH_HEAVY,
            ENEMY_TIER_SYMBOL_HEAVY,
            ENEMY_TIER_ONOMATOPOEIA_HEAVY,
            ENEMY_TIER_PUNCTUATION_HEAVY,
            ENEMY_TIER_SOKUON_HEAVY,
            ENEMY_TIER_PROVERB_HEAVY
        ];
        // _ONLY 系を除いた混成テーブルからランダムに選択
        selectedTable = accentTables[Math.floor(Math.random() * accentTables.length)];
    }

    // 以降、selectedTable を使用して生成
    const tier     = getTierKey(i);
    const itemTier = getItemTierKey(i);

    // 1. ミッションパターンの決定 (0-9の10種類)
    let pattern = explicitPattern;
    if (pattern === null || pattern === undefined) {
        const lastDigit = i % 10;
        if (lastDigit === 1) {
            // ★各ブロックの先頭（STAGE1/11/21/...）は迎撃にしない。
            //   先に基本ミッション（撃破/生存）を1回踏んでから迎撃を出す。
            pattern = Math.floor(Math.random() * 2);
        } else if (lastDigit >= 1 && lastDigit <= 3) {
            // 下一桁が1-3の場合: ミッションパターン0-2（基本形）
            pattern = Math.floor(Math.random() * 3);
        } else {
            // それ以外: 応用・全パターン
            pattern = Math.floor(Math.random() * 10);
        }
    }

    // 難易度の緩やかな上昇計算
    const baseSpawnInterval = 4000;                                    // 基本の出現間隔を4秒に固定
    const killGoal          = 12 + Math.floor(i / 4);                 // 討伐目標数
    const timeLimit         = 30000 + (i * 1000);                     // 30秒〜130秒程度
    const maxAlive          = Math.min(8, 4 + Math.floor(i / 25));    // 通常ミッションは最大8体まで

    // ミッションパターンごとの説明
    const missionDescriptions = [
        { name: "撃破",         desc: "指定数の敵を撃破せよ！" },
        { name: "生存",         desc: "制限時間まで生き残れ！" },
        { name: "迎撃",         desc: "飛んでくる弾を撃ち落とせ！" },
        { name: "電撃戦",       desc: "制限時間内に指定チェイン数を達成せよ！" },
        { name: "砲台制圧戦",   desc: "大量に出現する固定砲台を倒し、攻撃に耐えろ！" },
        { name: "タイムアタック", desc: "時間内に指定数撃破！" },
        { name: "サボタージュ", desc: "HP減少の中、敵を撃破せよ！" },
        { name: "圧倒",         desc: "大量の低速の敵を処理し、飽和度の上限を守れ！" },
        { name: "精密射撃",     desc: "ミスなく敵を撃破せよ！" },
        { name: "純粋なる試練", desc: "アイテム・スキルなしで敵を撃破せよ！" }
    ];

    const currentMission                  = missionDescriptions[pattern];
    const currentEnemyVariationDescription = getTierDescription(selectedTable);

    let config = {
        // 生成時は現在のTierを明示する（localStorageの旧データには
        // ステージ番号からのフォールバックを使う）。
        tier,

        // bgImage: i <= 33 ? "battle_blue" : i <= 66 ? "battle_green" : "battle_gray",
        // ↑ この行をコメントアウトまたは削除します。
        spawn: {
            interval:         baseSpawnInterval,
            limit:            null,
            maxAlive:         maxAlive,
            immediateOnClear: false,
            multiCount:       1,   // ★同時出現数（既定は1体ずつ）
            multiInterval:    1    // ★同時出現タイミング（1 = 毎回 / 2 = 2回に1回まとめて multiCount 体）
        },
        enemyTable:                   getStageEnemyTable(tier, selectedTable, i),
        missionName:                  currentMission.name,
        missionDescription:           currentMission.desc,
        enemyVariationDescription:    currentEnemyVariationDescription,
    };

    // 2. パターン別の条件設定
    switch (pattern) {
        case 0: { // 【撃破目標】指定数倒せばクリア
            const KillTarget = killGoal + Math.floor(i / 5);
            config.spawn.limit            = null;
            config.endConditions          = { hpZero: true, killCount: KillTarget };
            config.clearConditions        = { killCount: KillTarget };
            config.spawn.immediateOnClear = true; // 敵がいなくなったら即座に次を出す
            config.spawn.multiCount       = i >= 40 ? 2 : 2;
            config.spawn.multiInterval    = i >= 40 ? 2 : 3;

            // スター：タイピング速度(KPM) または 正確性（時間無制限＝じっくり質実な撃破任務）
            if (Math.random() > 0.5) {
                config.star = {
                    type: "typingSpeed",
                    thresholds: [
                        90  + (i * 0.7),
                        110 + (i * 0.7),
                        140 + (i * 0.7),
                        160 + (i * 0.75),
                        180 + (i * 0.8)
                    ]
                };
            } else {
                // 正確性（丁寧に戦うほど星が増える）
                const accBase = 0.5 + (i * 0.003);
                config.star = {
                    type: "accuracy",
                    thresholds: [
                        Math.min(0.85, accBase),
                        Math.min(0.88, accBase + 0.05),
                        Math.min(0.92, accBase + 0.1),
                        Math.min(0.95, accBase + 0.15),
                        0.98
                    ]
                };
            }
            break;
        }

        case 1: { // 【生存目標】時間まで生き残ればクリア
            config.spawn.limit         = null; // 無限湧き
            // 同時存在数の調整は、tier pressureの適用の後に行う（末尾で処理）。
            config.endConditions       = { hpZero: true, timerMs: timeLimit };
            config.clearConditions     = { survive: true };
            config.spawn.multiCount    = i >= 40 ? 2 : 2;
            config.spawn.multiInterval = i >= 40 ? 2 : 3;

            // スター：残りHP率 または 正確性
            if (Math.random() > 0.5) {
                config.star = {
                    type: "hpRemaining",
                    thresholds: [0.3, 0.5, 0.7, 0.85, 0.95]
                };
            } else {
                const accBase = 0.5 + (i * 0.003);
                config.star = {
                    type: "accuracy",
                    thresholds: [
                        Math.min(0.85, accBase),
                        Math.min(0.88, accBase + 0.05),
                        Math.min(0.92, accBase + 0.1),
                        Math.min(0.95, accBase + 0.15),
                        0.98
                    ]
                };
            }
            break;
        }

        case 2: { // 【迎撃】飛んでくる弾を撃ち落とす
            // 旧【殲滅目標】のスロットを、迎撃に置き換える。敵は一体も出ず、弾だけを処理する。
            const spec = INTERCEPT_TIER_SPEC[tier] ?? INTERCEPT_TIER_SPEC["T1"];

            config.interceptMode              = true;
            config.interceptSpec              = spec;    // スポーン側（enemySpawner）が読む
            config.enemyTable                 = [];      // 通常敵は湧かない
            config.enemyVariationDescription  = "弾のみ";

            // 湧く弾の総数を有限にする。送り切ったらクリア判定へ入る。
            config.spawn.limit            = spec.goal;
            config.spawn.interval         = spec.interval;
            config.spawn.maxAlive         = spec.maxAlive;  // 弾の同時存在上限として使う
            config.spawn.immediateOnClear = false;
            config.spawn.multiCount       = 1;              // 複数出現は使わない（1ウェーブ=count発）
            config.spawn.multiInterval    = 1;

            // 時間は設けない。弾が当たってもダメージだけで、即敗北にもならない。
            config.endConditions = { hpZero: true, allBulletsResolved: true };
            // ★フェーズ進行条件にも同じフラグを載せる。
            //   クリア判定は phaseCond（phaseConditions 優先）で見るため、ここが無いと
            //   「全弾処理完了」の判定が一度も発火しない。
            config.phaseConditions = { allBulletsResolved: true };
            // ★survive は使わない。残弾が0なら常に成立してしまうため、
            //   「弾を送り切って全部処理した」瞬間だけクリアになるよう専用フラグを持たせる。
            config.clearConditions = { allBulletsResolved: true };

            // スター: 迎撃率（＝撃ち落とした弾 / 全弾数）
            // ★★5 は全弾を撃ち落としきった時だけ成立する。
            //    フリーズ／回復スキルで被弾を回復しながら 1 発も漏らさない難度。
            config.star = {
                type: "interceptRate",
                thresholds: [0.75, 0.80, 0.85, 0.90, 0.95]
            };
            break;
        }

        case 3: { // 【電撃戦】制限時間内に既存チェインを指定数までつなげる
            const blitzTime = Math.max(30000, 30000 + (i * 600)); // 制限時間
            const chainGoal = Math.min(30, 10 + (2 * Math.floor(i / 10)));
            config.chainGoal              = chainGoal;
            config.spawn.interval        *= 0.9; // 敵がどんどん出る
            // チェインが切れても制限時間内なら再挑戦できるよう、敵の総数は余分に確保する。
            config.spawn.limit            = Math.max(12, chainGoal * 3);
            config.endConditions          = { hpZero: true, timerMs: blitzTime };
            config.clearConditions        = { chainCount: chainGoal };
            config.phaseConditions        = { chainCount: chainGoal };
            config.spawn.immediateOnClear = true;

            // ★同時出現：3回に1回は2体まとめて出現（ステージ40以降は3回に1回2体）
            config.spawn.multiCount    = i >= 40 ? 2 : 2;
            config.spawn.multiInterval = i >= 40 ? 3 : 3;

            // スター：タイピング速度(KPM)
            config.star = {
                type: "typingSpeed",
                thresholds: [
                    90  + (i * 0.7),
                    110 + (i * 0.7),
                    140 + (i * 0.7),
                    160 + (i * 0.75),
                    180 + (i * 0.8)
                ]
            };
            break;
        }

        case 4: { // 【砲台制圧戦】固定砲台を倒しながら攻撃に耐える
            // T1・T2には固定砲台の専用Tierがないため、最小のT3砲台を使用する。
            config.enemyTable              = getFixedTurretTable(tier);
            config.turretMode              = true;
            config.enemyVariationDescription = "固定砲台主体";
            config.spawn.maxAlive         -= 1; // 増加量を抑制
            config.spawn.interval         *= 1.0;
            // ★同時出現：2回に1回まとめ
            config.spawn.multiCount    = i >= 30 ? 2 : 2;
            config.spawn.multiInterval = i >= 30 ? 2 : 3;
            config.endConditions           = { hpZero: true, timerMs: timeLimit * 0.8 };
            config.clearConditions         = { survive: true };

            // ★スター：固定砲台を倒しながら残りHPを保つ
            config.star = {
                type: "hpRemaining",
                thresholds: [0.4, 0.6, 0.7, 0.8, 0.9]
            };
            break;
        }

        case 5: { // 【タイムアタック】指定時間内に指定数撃破
            const timeAttackTime = Math.max(
                30000,
                35000 + (i * 300) + Math.max(0, i - 70) * 1400
            );// 30秒〜60秒程度
            const timeAttackKillGoal = Math.floor(killGoal * 0.6);
            config.spawn.interval        *= 0.8; // 敵の出現を少し早める
            config.spawn.limit            = null;
            config.endConditions          = { hpZero: true, killCount: timeAttackKillGoal, timerMs: timeAttackTime };
            config.clearConditions        = { killCount: timeAttackKillGoal };
            config.spawn.multiCount    = i >= 40 ? 2 : 2;
            config.spawn.multiInterval = i >= 60 ? 3 : 2;
            config.spawn.immediateOnClear = true; // タイムアタックには必須級の機能

            // スター：クリア時間 または タイピング速度
            if (Math.random() > 0.5) {
                config.star = {
                    type: "clearTime",
                    thresholds: [
                        timeAttackTime,
                        Math.max(timeAttackTime * 0.98),
                        Math.max(timeAttackTime * 0.95),
                        Math.max(timeAttackTime * 0.92),
                        Math.max(timeAttackTime * 0.88)
                    ]
                };
            } else {
                config.star = {
                    type: "typingSpeed",
                    thresholds: [
                        90  + (i * 0.7),
                        110 + (i * 0.7),
                        140 + (i * 0.7),
                        160 + (i * 0.75),
                        180 + (i * 0.8)
                    ]
                };
            }
            break;
        }

        case 6: { // 【サボタージュ】HPが徐々に減る中、指定数撃破
            const sabotageKillTarget = killGoal;
            config.spawn.limit            = null;
            config.endConditions          = { hpZero: true, killCount: sabotageKillTarget };
            config.clearConditions        = { killCount: sabotageKillTarget };
            config.spawn.multiCount    = i >= 40 ? 2 : 2;
            config.spawn.multiInterval = i >= 60 ? 3 : 2;
            config.enemySpeedMultiplier   = i >= 70 ? 0.8 : 1.0;
            config.spawn.immediateOnClear = true;

            const hpDrain = 1 + (i * 0.05);
            config.player = { ...ENEMY_MODE_CONFIG.player, hpDrainPerSec: hpDrain };

            // 期待クリア時間（スポーン待ち時間 + タイピング猶予）から不可避なダメージを計算
            const expectedTimeSec = ((sabotageKillTarget - 1) * config.spawn.interval / 1000) + (sabotageKillTarget * 0.5);
            const mandatoryLoss   = expectedTimeSec * hpDrain;
            const maxPossibleHp   = Math.max(5, ENEMY_MODE_CONFIG.player.maxHp - mandatoryLoss);
            const maxRatio        = maxPossibleHp / ENEMY_MODE_CONFIG.player.maxHp;

            config.star = {
                type: "hpRemaining",
                thresholds: [
                    maxRatio * 0.2,
                    maxRatio * 0.4,
                    maxRatio * 0.6,
                    maxRatio * 0.8,
                    maxRatio * 0.9
                ]
            };
            break;
        }

        case 7: { // 【圧倒】途方もない数の敵を捌き切れ！ (Overwhelm)
            const overwhelmTime = timeLimit; // 長めの生存時間
            config.spawn.interval        *= 0.8; // 出現頻度を上げる
            config.spawn.maxAlive         = Math.min(14, maxAlive + 6); // 大幅増 → 画面に敵が溜まり続ける
            config.enemySpeedMultiplier   = 0.6; // ★ 敵を低速化：到達が遅く、画面上に滞留して密度が上がる
            // ★ 出題文字数を10文字以内に制限：大量の低速の敵を捌きやすくする。
            //   敵の見た目・属性（タグ）・出現重みはそのままで、
            //   「そのタグの10文字以内の問題」に差し替えて出題する。
            //   （生成済みステージが localStorage に残るため、スポーン側でも missionName から判定する）
            config.maxWordLength          = OVERWHELM_MAX_WORD_LENGTH;
            // ★同時出現：3回に1回は3体まとめて出現（maxAlive 14 の範囲でループ側が自動制限）
            config.spawn.multiCount       = 3;
            config.spawn.multiInterval    = 3;
            config.spawn.limit            = null; // 無限湧き
            // 飽和度はフリーモード【圧倒】と同一値（buildOverwhelmSaturation）を使う。
            config.saturation = buildOverwhelmSaturation(config.spawn.maxAlive);
            config.endConditions   = { hpZero: true, timerMs: overwhelmTime };
            config.clearConditions = { survive: true };

            // 圧倒的な敵を捌くにはタイピング速度が最も重要
            config.star = {
                type: "typingSpeed",
                thresholds: [
                    90  + (i * 0.7),
                    110 + (i * 0.7),
                    140 + (i * 0.7),
                    160 + (i * 0.75),
                    180 + (i * 0.8)
                ]
            };
            break;
        }

        case 8: { // 【精密射撃】ミスなく敵を撃破 (Precision Shot)
            const precisionKillTarget = killGoal - 2;
            let missLimit = 3;
            if (i <= 30) {
                missLimit = 7;
            } else if (i <= 60) {
                missLimit = 5;
            }

            config.spawn.limit            = null; // 倒すべき敵は有限
            config.spawn.maxAlive         = Math.min(maxAlive, 2 + Math.floor(i / 25)); // さらに少なめに調整
            config.spawn.interval        *= 1.2; // 少しゆっくり出現
            config.endConditions          = {
                hpZero:             true,
                killCount: precisionKillTarget,
                failOnMissCount:    missLimit
            };
            config.spawn.immediateOnClear = true;
            config.clearConditions        = {
                killCount: precisionKillTarget,
                noMiss:    missLimit === 1 // 許容ミスが1回の場合のみノーミス条件
            };

            // スター：タイピング速度(KPM) に変更（ミス＝終了のため正確性は常に100%になるため）
            config.star = {
                type: "typingSpeed",
                thresholds: [
                    80  + (i * 0.7),
                    100 + (i * 0.7),
                    130 + (i * 0.7),
                    150 + (i * 0.7),
                    170 + (i * 0.7)
                ]
            };
            break;
        }

        case 9: { // 【純粋なる試練】アイテム・アクティブスキル禁止 (Pure Trial)
            const pureTrialKillTarget = killGoal - 2;
            config.spawn.limit            = Math.floor(pureTrialKillTarget * 1.5);
            config.endConditions          = { hpZero: true, killCount: pureTrialKillTarget };
            config.clearConditions        = { killCount: pureTrialKillTarget };
            config.spawn.immediateOnClear = true;
            config.itemSpawn              = null; // アイテム出現禁止
            config.player                 = { ...ENEMY_MODE_CONFIG.player, disableActiveSkill: true }; // アクティブスキル禁止
            config.spawn.multiCount    = i >= 40 ? 2 : 2;
            config.spawn.multiInterval = i >= 60 ? 3 : 2;

            // スター：総合評価 (Composite) - アイテム・スキルなしでの総合力を評価
            config.star = {
                type: "composite",
                thresholds: [
                    Math.min(0.5,  0.3  + (i * 0.003)),
                    Math.min(0.65, 0.45 + (i * 0.003)),
                    Math.min(0.75, 0.55 + (i * 0.003)),
                    Math.min(0.85, 0.65 + (i * 0.003)),
                    Math.min(0.95, 0.75 + (i * 0.003))
                ]
            };
            break;
        }
    }

    // ステージ12からアイテム解禁
    if (i >= 12 && config.itemSpawn !== null) {
        config.itemSpawn = {
            interval: 8000 - (i * 30),
            chance:   0.2 + (i * 0.001), // 徐々にアイテムが出やすくなる
            limit:    null,
            maxAlive: 1
        };
        config.itemTable = ITEM_TIER_TABLE[itemTier];
    }

    // T1〜T4の通常戦闘に出現圧力を加える。
    // 特殊ミッションはapplyTierSpawnPressure()で既存バランスを優先して除外する。
    applyTierSpawnPressure(config, i, pattern);

    // 生存だけは、既存のtier pressure確定後に同時存在数を1体だけ増やす。
    // 出現間隔には触れない。
    if (pattern === 1 && Number.isFinite(config.spawn?.maxAlive)) {
        config.spawn.maxAlive += 1;
    }

    return config;
}

// ======================================================
// フリーモード（ENEMY）用: ミッションプリセット
// ------------------------------------------------------------
// クエストの generateStage() case 2/3/4/7（迎撃・電撃戦・砲台制圧戦・圧倒）と
// 同じミッション構成を、フリーモードの Rule Settings から組み立てるための関数。
//
// ・数値の出典（INTERCEPT_TIER_SPEC / OVERWHELM_MAX_WORD_LENGTH など）は
//   クエスト側と完全に共有するため、バランス値が二重管理にならない。
// ・返す spawn は【ミッション側で上書きしたい値】だけを入れる。
//   出現間隔・同時出現数などの共通スポーン設定はmain.js側で
//   ユーザー設定を優先してマージされる。
//
// @param {Object} opts
// @param {string} opts.rule          - "blitz" | "intercept" | "turret" | "overwhelm"
// @param {string|number} opts.tier   - 1〜10（"T3" 形式も可）
// @param {number} [opts.timeSec=60]  - 生存系ミッションの制限時間（秒）
// @param {number} [opts.chainGoal=15]- 【電撃戦】の目標チェイン数
// @param {string} [opts.charType]    - 【迎撃】の文字種（"alphabet"|"number"|"symbol"|"all"）
// @returns {Object} customConditions 相当のミッション設定
export function buildFreeEnemyMissionConfig({ rule, tier, timeSec = 60, chainGoal = 15, charType = null } = {}) {
    const tierNumber = normalizeTierNumber(tier);
    const ruleId     = String(rule ?? "").toLowerCase();
    const timeMs     = Math.max(1, Number(timeSec) || 60) * 1000;
    const chain      = Math.max(3, Math.floor(Number(chainGoal) || 15));

    switch (ruleId) {

        case "blitz": { // 【電撃戦】制限時間内にチェインを達成。
            return {
                missionName:     "電撃戦",
                endConditions:   { hpZero: true, timerMs: timeMs },
                clearConditions: { chainCount: chain },
                // フェーズ進行条件にも同じフラグを載せないとチェイン到達でクリアが発火しない
                phaseConditions: { chainCount: chain },
                // チェインを保つには常に討伐対象が居る必要があるため、即時湧きは有効にする
                // （出現間隔・同時出現数はユーザー設定を優先するためここでは触らない）
                spawn:           { immediateOnClear: true },
            };
        }

        case "intercept": { // 【迎撃】敵は一体も出ず、飛んでくる弾を撃ち落とす
            const spec = getInterceptTierSpec(tierNumber);

            // ★コピーを作ってから文字種だけ上書きする。
            //   getInterceptTierSpec() は INTERCEPT_TIER_SPEC 本体の参照を返すため、
            //   直接書き換えると以降のゲーム（クエスト等）にも影響してしまう。
            const interceptSpec = INTERCEPT_CHAR_TYPE_IDS.has(charType)
                ? { ...spec, charType }
                : { ...spec };

            return {
                missionName:     INTERCEPT_MISSION_NAME,
                interceptMode:   true,
                interceptSpec:   interceptSpec,   // スポーン側（enemySpawner）が読む
                // 迎撃の弾はTier仕様で固定する（総弾数・1ウェーブの発数・弾速など）
                spawn: {
                    limit:            spec.goal,      // 送り切る弾の総数（＝迎撃率の分母）
                    maxAlive:         spec.maxAlive,
                    immediateOnClear: false,
                    multiCount:       1,              // 複数出現は使わない（1ウェーブ = count 発）
                    multiInterval:    1,
                },
                // ★フェーズ進行条件にも同じフラグを載せる。
                //   クリア判定は phaseCond 優先のため、ここが無いと判定が発火しない。
                endConditions:   { hpZero: true, allBulletsResolved: true },
                phaseConditions: { allBulletsResolved: true },
                clearConditions: { allBulletsResolved: true },
            };
        }

        case "turret": { // 【砲台制圧戦】固定砲台を倒しながら攻撃に耐える
            return {
                missionName:     "砲台制圧戦",
                turretMode:      true,
                // 固定砲台テーブルはmain.jsが getFixedTurretTable() で組み立てて渡す
                spawn:           { maxAlive: 8 },
                endConditions:   { hpZero: true, timerMs: timeMs },
                clearConditions: { survive: true },
            };
        }

        case "overwhelm": { // 【圧倒】大量の低速の敵を捌き切る
            const maxAlive = 14;
            return {
                missionName:          OVERWHELM_MISSION_NAME,
                // ★低速化：到達が遅く画面上に滞留して密度が上がる
                enemySpeedMultiplier: 0.6,
                // ★出題8文字以内：大量の低速の敵を捌きやすくする
                maxWordLength:        OVERWHELM_MAX_WORD_LENGTH,
                spawn:                { maxAlive, limit: null },
                // 飽和度はクエスト【圧倒】と同一値（buildOverwhelmSaturation）を使う
                saturation: buildOverwhelmSaturation(maxAlive),
                endConditions:   { hpZero: true, timerMs: timeMs },
                clearConditions: { survive: true },
            };
        }

        default:
            // 未知のルールIDは「時間制限」のMission設定にフォールバックする
            return {
                endConditions:   { hpZero: true, timerMs: timeMs },
                clearConditions: { timerMs: timeMs },
            };
    }
}

// ======================================================
// クエストステージの生成・永続化ロジック
// ======================================================
/**
 * 初回実行時に生成し、以降は LocalStorage から固定値を読み込む。
 */
const QUEST_STAGES_STORAGE_KEY = "QuestStages_Cache_v5";

function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function initGeneratedStages() {
    if (typeof localStorage === 'undefined') return {}; // 非ブラウザ環境用セーフティ

    const cached = localStorage.getItem(QUEST_STAGES_STORAGE_KEY);
    if (cached) {
        try {
            // ステージは生成時に固定して保存するため、キャッシュがあればそのまま使う。
            return JSON.parse(cached);
        } catch (e) {
            console.warn("Quest stage cache corrupted. Regenerating...");
        }
    }

    // キャッシュがない（New Game時など）場合は新規生成して保存
    const newStages = {};
    // 10ステージごとの区切り（1-10, 11-20, ...）で全10パターンを配置
    for (let block = 0; block < 10; block++) {
        // 序盤（下一桁 1〜3）: 基本形 [0:撃破, 1:生存, 2:迎撃] をシャッフルして配置
        const basicPatterns = shuffleArray([0, 1, 2]);
        // ★迎撃(2) はブロックの先頭（下一桁1 = STAGE1/11/21/...）には置かない。
        //   先頭が迎撃だった場合は 2〜3番目と入れ替える。
        if (basicPatterns[0] === 2) {
            const swapWith = 1 + Math.floor(Math.random() * (basicPatterns.length - 1));
            [basicPatterns[0], basicPatterns[swapWith]] = [basicPatterns[swapWith], basicPatterns[0]];
        }
        // 中盤〜後半（下一桁 4〜10）: 応用形をシャッフルして配置
        // [3:電撃戦, 4:砲台制圧戦, 5:タイムアタック, 6:サボタージュ, 7:圧倒, 8:精密射撃, 9:純粋なる試練]
        const advancedPatterns = shuffleArray([3, 4, 5, 6, 7, 8, 9]);

        const patterns = [...basicPatterns, ...advancedPatterns];

        for (let step = 0; step < 10; step++) {
            const stageNum = block * 10 + step + 1;
            newStages[`STAGE${stageNum}`] = generateStage(stageNum, ENEMY_TIER_BALANCED, patterns[step]);
        }
    }
    localStorage.setItem(QUEST_STAGES_STORAGE_KEY, JSON.stringify(newStages));
    return newStages;
}

/**
 * メモリ上のステージデータを最新のキャッシュ（または新規生成）で更新する。
 */
export function refreshStages() {
    // キャッシュをクリアして再生成
    clearQuestStageCache();
    const newStages = initGeneratedStages();

    // エクスポート済みの STAGES オブジェクトの中身を直接更新する
    // (参照を壊さないようにプロパティをコピー)
    for (let i = 1; i <= 100; i++) {
        const key = `STAGE${i}`;
        STAGES[key] = newStages[key];
    }
}

let generatedStages = initGeneratedStages();

/**
 * クエストステージのキャッシュを削除する。
 * 「最初から遊ぶ」などのボタンが押された際に実行することを想定。
 */
export function clearQuestStageCache() {
    if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(QUEST_STAGES_STORAGE_KEY);
    }
}

// =========================================================================
// ステージ設定リファレンス
// =========================================================================
/*
STAGES = {
  ステージID: {
    // ---------------------------
    // ステージ全体の設定
    // ---------------------------
    bgm: "bgm_swim",        // ステージ全体のBGM
    bgImage: "battle_blue", // ステージ全体の背景画像

    // ---------------------------
    // フェーズ設定（複数フェーズを持つステージの場合）
    // ---------------------------
    phases: [
      { name: "Phase 1", bgm: "bgm_rainy",  各フェーズ固有の設定...  },
      { name: "Phase 2",  ...  }
    ],

    // ---------------------------
    // 敵出現設定
    // ---------------------------
    spawn: {
      interval: 3000,           // 出現間隔(ms)
      limit: 10,                // 総出現数上限（null = 無限）
      maxAlive: 5,              // 同時存在数上限（null = 無制限）
      immediateOnClear: false,  // 敵が全滅した際に即座に次を出すか

      // ★同時出現（マルチスポーン）
      multiCount: 1,    // 1回の出現で同時に出す敵の数（2なら2匹同時）
      multiInterval: 1  // 何回に1回まとめて出すか
                        //   2 → 「2回に1回」だけ multiCount 匹同時
                        //   1 → 毎回まとめて出す（multiCount:1 なら従来どおり1匹ずつ）
                        // 例) multiCount:2, multiInterval:2 → 1匹/2匹/1匹/2匹… の繰り返し
                        //     multiCount:3, multiInterval:1 → 常に3匹同時
                        // ※ limit / maxAlive は1体ずつ判定し、超過分は出現させずに打ち切る
                        // ※ phases 内の spawn に書けばフェーズ単位で切り替え可能
    },

    // ---------------------------
    // アイテム出現設定（省略可）
    // ---------------------------
    itemSpawn: {
      interval: 5000,   // 出現間隔(ms)
      chance: 0.5,      // 出現確率 0.0 ～ 1.0
      limit: 10,        // 総出現数上限（null = 無限）
      maxAlive: 1       // 同時存在数上限（null = 無制限）
    },

    // ---------------------------
    // 敵出現テーブル
    // ---------------------------
    enemyTable: [
      { type: "SLIME",  weight: 70, pos: { x: 100, y: 100 } }, // pos指定可（省略時はランダム）
      { type: "GOBLIN", weight: 20 },
      { type: "OGRE",   weight: 10 }
    ],
    // enemy type 一覧
    // SLIME GOBLIN OGRE BOSS
    // ※ enemyData.js に定義された敵を追加可能

    // ---------------------------
    // アイテム出現テーブル
    // ---------------------------
    itemTable: [
      { type: "FREEZE", weight: 50 },
      { type: "BOMB",   weight: 50 }
    ],
    // item type 一覧
    //
    // FREEZE      : 敵凍結
    // BOMB        : 単体爆弾
    // BOMB_ALL    : 全体爆弾
    // HEAL_SMALL  : HP少量回復
    // HEAL_FULL   : HP全回復
    // SKILL_CD    : スキルCT短縮
    //
    // ※ itemData.js に定義されたアイテムを追加可能

    // ---------------------------
    // ゲーム終了条件
    // ---------------------------
    endConditions: {
      hpZero: true,              // プレイヤーHP0で終了
      timerMs: 30000,            // 制限時間終了で終了（null = 無効）
      killCount: 10,             // 指定撃破数到達で終了（null = 無効）
      allSpawnedDefeated: true   // 出現した敵を全滅で終了（spawn.limit と組み合わせて使う）
    },

    // ---------------------------
    // クリア条件
    // ---------------------------
    clearConditions: {
      killCount: 10,   // 指定数撃破でクリア
      timerMs: 30000,  // 制限時間以内クリア
      survive: true    // 生存していればクリア
      endless: false   // endlessフラグ trueの場合、HP0でも失敗扱いにならない
    },

    // ---------------------------
    // 星評価条件
    // ---------------------------
    star: {
      type: "typingSpeed",
      thresholds: [100, 150, 200, 250, 300]
    },

    // ---------------------------
    // フェーズごとの条件
    // ---------------------------
    phaseConditions: {
      killCount: 10,             // このフェーズでの撃破目標
      timerMs: 30000,            // このフェーズの制限時間
      allSpawnedDefeated: true   // このフェーズの敵を全滅させると次へ
    }
  }
}

===============================
star.type 一覧
===============================
typingSpeed    → KPM評価                    thresholds: [100,150,200,250,300]
clearTime      → クリア時間評価(ms)         thresholds: [70000,60000,50000,40000,30000]
accuracy       → 正確率評価(0～1)           thresholds: [0.2,0.4,0.6,0.8,0.9]
killCount      → 撃破数評価                 thresholds: [10,20,30,40,50]
composite      → 総合評価(0～1)             thresholds: [0.3,0.5,0.7,0.8,0.9]
timeRemaining  → 残り時間率(0～1)
hpRemaining    → 残りHP率(0～1)
defenseSurplus → 防衛モード専用（超過率×surplusWeight ＋ 正確率×accuracyWeight）
                 thresholds: [0.4,0.45,0.5,0.6,0.7]  // 総合スコア閾値
                 weights: { surplus: 0.4, accuracy: 0.6 }  // 超過率/正確率の重み
                   score = (入力文字数 / 目標文字数 − 1.0) × surplus ＋ 正確率(0〜1) × accuracy
                   ※ 失敗（時間切れで未達成）時は星0
interceptRate  → 迎撃率（撃ち落とした弾 / 全弾数）
*/

// =========================================================================
// 防衛モード（Defense）ステージ設定リファレンス
// =========================================================================
/*
通常ステージの代わりに、以下のようにして防衛戦ステージを定義する。

DEFENSE_1: {
  isDefenseMode: true,   // ★必須: このフラグで防衛戦として起動する
  bgm: "bgm_universe",   // 防衛戦のBGM（省略可）
  missionName: "コア防衛戦線",
  missionDescription: "時間内に、指定された文字数を入力せよ。",

  defenseConfig: {           // ★防衛モード専用の設定
    totalCharsToType: 300,   // 目標文字数（タイムアップ時にこの数に達していればクリア）
    timeLimit: 120,          // 制限時間（秒）
    genres: ['empty', '促音', 'ことわざ'], // 出題ジャンル（下記参照）
    minLength: 4,            // 出題単語の最小文字数
    maxLength: 8             // 出題単語の最大文字数
  },

  // 星評価は 防衛モード専用 type を使用する（star.type 一覧 参照）
  star: {
    type: "defenseSurplus",
    thresholds: [0.4, 0.45, 0.5, 0.6, 0.7],
    weights: { surplus: 0.4, accuracy: 0.6 }
  }
}

===============================
defenseConfig.genres の書き方
===============================
  ['empty']                     → 標準（タグ無し）のみ
  ['empty', '促音', 'ことわざ']  → 標準 ＋ 指定タグ（OR条件で共存できる）
  ['all']                       → 全ジャンル（標準 ＋ すべてのタグ）

  ※ 標準（'empty'）は他のタグと同時に指定可能。
     'empty'の単語は①タグ無し判定で、タグ付き単語は②タグ一致(OR)で採用される。

  利用可能タグ: 句読点 / 促音 / 記号 / 英語 / ことわざ / 擬音 / 数字 / ネタ
  （※ 長文タグの文学・おもしろ等はTARGETSに無いため防衛戦では使用不可）

===============================
防衛戦の勝敗判定（defenseCore.js 準拠）
===============================
  タイムアップ（timeLimit 到達）が唯一の終了条件。
    入力文字数 >= totalCharsToType ならクリア（成功）
    入力文字数 <  totalCharsToType なら失敗
*/
// =========================================================================

// =====================================================
// ステージ設定（個別）
// =====================================================
export const STAGES = {

    // =====================================================
    // デイリー / フリー
    // =====================================================

    DAILY: {
        bgImage: "battle_gray",

        phases: [
            {
                name: "PHASE 1",
                bgm:  "bgm_harunosuisou",
                spawn: { interval: 2500, limit: null, maxAlive: 4, immediateOnClear: true },
                enemyTable:      getTierEnemies("T2", ENEMY_TIER_BALANCED),
                phaseConditions: { timerMs: 30000 }
            },
            {
                name: "PHASE 2",
                bgm:  "bgm_rojiura",
                spawn: { interval: 2500, limit: null, maxAlive: 5, immediateOnClear: true },
                enemyTable:      getTierEnemies("T4", ENEMY_TIER_BALANCED),
                phaseConditions: { timerMs: 30000 }
            },
            {
                name: "PHASE 3",
                bgm:  "bgm_yamiyo",
                spawn: { interval: 2500, limit: null, maxAlive: 6, immediateOnClear: true },
                enemyTable:      getTierEnemies("T6", ENEMY_TIER_BALANCED),
                phaseConditions: { timerMs: 30000 }
            },
            {
                name: "PHASE 4",
                bgm:  "bgm_reflectable",
                spawn: { interval: 2500, limit: null, maxAlive: 6, immediateOnClear: true },
                enemyTable:      getTierEnemies("T8", ENEMY_TIER_BALANCED),
                //phaseConditions: { allSpawnedDefeated: true }
            },
        ],
        endConditions: { hpZero: true },
        // DAILYモードはendlessフラグをtrueにすることで、HP0でも失敗扱いにならないようにする
        clearConditions: { killCount: 1, endless: true },
    },

    FREE: {
        bgImage:         "battle_gray",
        spawn:           { interval: 2000, limit: null, maxAlive: null, immediateOnClear: false },
        enemyTable:      getTierEnemies("T2", ENEMY_TIER_BALANCED),
        endConditions:   { hpZero: true, timerMs: 30000 },
        clearConditions: { killCount: 10 },
        star:            { type: "typingSpeed", thresholds: [100, 150, 200, 250, 300] }
    },

    ...generatedStages,

    // =====================================================
    // 中ボスステージ
    // =====================================================

    // W1 第10ステージ後（中ボス）
    W1_MID_BOSS_1: {
        phases: [
            {
                name: "PHASE 1",
                spawn:           { interval: 2500, limit: null, maxAlive: 4, immediateOnClear: true },
                enemyTable:      getTierEnemies("T1", ENEMY_TIER_BALANCED),
                immediateOnClear: true,
                phaseConditions: { killCount: 10 }
            },
            {
                name: "MID BOSS",
                bgm:             "bgm_reflectable",
                spawn:           { interval: 1000, limit: 1, maxAlive: 1 },
                enemyTable:      [{ type: "MID_BOSS_1", weight: 100, pos: { x: 830, y: 150 } }],
                phaseConditions: { killCount: 1 }
            }
        ],
        endConditions:   { hpZero: true },
        clearConditions: { killCount: 11 },
        star:            { type: "accuracy", thresholds: [0.6, 0.7, 0.8, 0.85, 0.9] }
    },

    // W1 第20ステージ後（中ボス）
    W1_MID_BOSS_2: {
        phases: [
            {
                name: "PHASE 1",
                spawn:           { interval: 2500, limit: 15, maxAlive: 5, immediateOnClear: true },
                enemyTable:      getTierEnemies("T2", ENEMY_TIER_BALANCED),
                phaseConditions: { killCount: 15 }
            },
            {
                name: "MID BOSS",
                bgm:             "bgm_reflectable",
                spawn:           { interval: 1000, limit: 1, maxAlive: 1 },
                enemyTable:      [{ type: "MID_BOSS_2", weight: 100, pos: { x: 830, y: 150 } }],
                phaseConditions: { killCount: 1 }
            }
        ],
        endConditions:   { hpZero: true },
        clearConditions: { killCount: 16 },
        star:            { type: "typingSpeed", thresholds: [150, 180, 210, 240, 260] }
    },

    W1_MID_BOSS_3: {
        phases: [
            {
                name: "PHASE 1",
                spawn:           { interval: 2500, limit: null, maxAlive: 5 },
                enemyTable:      getTierEnemies("T3", ENEMY_TIER_BALANCED),
                phaseConditions: { timerMs: 40000 }
            },
            {
                name: "MID BOSS",
                bgm:             "bgm_reflectable",
                spawn:           { interval: 1000, limit: 1, maxAlive: 1 },
                enemyTable:      [{ type: "MID_BOSS_3", weight: 100, pos: { x: 830, y: 150 } }],
                phaseConditions: { killCount: 1 }
            }
        ],
        endConditions:   { hpZero: true },
        clearConditions: { survive: true },
        star:            { type: "typingSpeed", thresholds: [150, 180, 210, 240, 260] }
    },

    // W2 中ボス
    W2_MID_BOSS_4: {
        phases: [
            {
                name: "PHASE 1",
                spawn:           { interval: 2500, limit: null, maxAlive: 6, immediateOnClear: true },
                enemyTable:      getTierEnemies("T4", ENEMY_TIER_BALANCED),
                phaseConditions: { killCount: 15 }
            },
            {
                name: "MID BOSS",
                bgm:             "bgm_reflectable",
                spawn:           { interval: 1000, limit: 1, maxAlive: 1 },
                enemyTable:      [{ type: "MID_BOSS_4", weight: 100, pos: { x: 830, y: 150 } }],
                phaseConditions: { killCount: 1 }
            }
        ],
        endConditions:   { hpZero: true },
        clearConditions: { survive: true },
        star:            { type: "composite", thresholds: [0.5, 0.6, 0.7, 0.8, 0.9] }
    },

    W2_MID_BOSS_5: {
        phases: [
            {
                name: "PHASE 1",
                spawn:           { interval: 2500, limit: null, maxAlive: 6, immediateOnClear: true },
                enemyTable:      getTierEnemies("T5", ENEMY_TIER_BALANCED),
                phaseConditions: { killCount: 20 }
            },
            {
                name: "MID BOSS",
                bgm:             "bgm_reflectable",
                spawn:           { interval: 1000, limit: 1, maxAlive: 1 },
                enemyTable:      [{ type: "MID_BOSS_5", weight: 100, pos: { x: 830, y: 150 } }],
                phaseConditions: { killCount: 1 }
            }
        ],
        endConditions:   { hpZero: true },
        clearConditions: { survive: true },
        star:            { type: "composite", thresholds: [0.5, 0.6, 0.7, 0.8, 0.9] }
    },

    W2_MID_BOSS_6: {
        phases: [
            {
                name: "PHASE 1",
                spawn:           { interval: 2500, limit: null, maxAlive: 6, immediateOnClear: true },
                enemyTable:      getTierEnemies("T6", ENEMY_TIER_BALANCED),
                phaseConditions: { timerMs: 50000 }
            },
            {
                name: "MID BOSS",
                bgm:             "bgm_reflectable",
                spawn:           { interval: 1000, limit: 1, maxAlive: 1 },
                enemyTable:      [{ type: "MID_BOSS_6", weight: 100, pos: { x: 830, y: 150 } }],
                phaseConditions: { killCount: 1 }
            }
        ],
        endConditions:   { hpZero: true },
        clearConditions: { survive: true },
        star:            { type: "composite", thresholds: [0.5, 0.6, 0.7, 0.8, 0.9] }
    },

    // W3 中ボス
    W3_MID_BOSS_7: {
        phases: [
            {
                name: "PHASE 1",
                spawn:           { interval: 2500, limit: null, maxAlive: 7, immediateOnClear: true },
                enemyTable:      getTierEnemies("T7", ENEMY_TIER_BALANCED),
                phaseConditions: { killCount: 25 }
            },
            {
                name: "MID BOSS",
                bgm:             "bgm_reflectable",
                spawn:           { interval: 1000, limit: 1, maxAlive: 1 },
                enemyTable:      [{ type: "MID_BOSS_7", weight: 100, pos: { x: 830, y: 150 } }],
                phaseConditions: { killCount: 1 }
            }
        ],
        endConditions:   { hpZero: true },
        clearConditions: { survive: true },
        star:            { type: "composite", thresholds: [0.5, 0.6, 0.7, 0.8, 0.9] }
    },

    W3_MID_BOSS_8: {
        phases: [
            {
                name: "PHASE 1",
                spawn:           { interval: 2500, limit: null, maxAlive: 7, immediateOnClear: true },
                enemyTable:      getTierEnemies("T8", ENEMY_TIER_BALANCED),
                phaseConditions: { killCount: 28 }
            },
            {
                name: "MID BOSS",
                bgm:             "bgm_reflectable",
                spawn:           { interval: 1000, limit: 1, maxAlive: 1 },
                enemyTable:      [{ type: "MID_BOSS_8", weight: 100, pos: { x: 830, y: 150 } }],
                phaseConditions: { killCount: 1 }
            }
        ],
        endConditions:   { hpZero: true },
        clearConditions: { survive: true },
        star:            { type: "composite", thresholds: [0.5, 0.6, 0.7, 0.8, 0.9] }
    },

    W3_MID_BOSS_9: {
        phases: [
            {
                name: "PHASE 1",
                spawn:           { interval: 2500, limit: null, maxAlive: 7, immediateOnClear: true },
                enemyTable:      getTierEnemies("T8", ENEMY_TIER_BALANCED),
                phaseConditions: { timerMs: 60000 }
            },
            {
                name: "MID BOSS",
                bgm:             "bgm_reflectable",
                spawn:           { interval: 1000, limit: 1, maxAlive: 1 },
                enemyTable:      [{ type: "MID_BOSS_9", weight: 100, pos: { x: 830, y: 150 } }],
                phaseConditions: { killCount: 1 }
            }
        ],
        endConditions:   { hpZero: true },
        clearConditions: { survive: true },
        star:            { type: "composite", thresholds: [0.5, 0.6, 0.7, 0.8, 0.9] }
    },

    // EX 中ボス
    WEX_MID_BOSS_10: {
        phases: [
            {
                name: "PHASE 1",
                spawn:           { interval: 2500, limit: null, maxAlive: 8, immediateOnClear: true },
                enemyTable:      getTierEnemies("T9", ENEMY_TIER_BALANCED),
                phaseConditions: { timerMs: 70000 }
            },
            {
                name: "MID BOSS",
                bgm:             "bgm_reflectable",
                spawn:           { interval: 1000, limit: 1, maxAlive: 1 },
                enemyTable:      [{ type: "MID_BOSS_10", weight: 100, pos: { x: 830, y: 150 } }],
                phaseConditions: { killCount: 1 }
            }
        ],
        endConditions:   { hpZero: true },
        clearConditions: { survive: true },
        star:            { type: "composite", thresholds: [0.5, 0.6, 0.7, 0.8, 0.9] }
    },

    // =====================================================
    // ボスバトル定義
    // =====================================================

    // W1 第30ステージ後のワールドボス
    W1_WORLD_BOSS: {
        phases: [
            {
                name: "PHASE 1",
                spawn:           { interval: 2500, limit: null, maxAlive: 6, immediateOnClear: true },
                enemyTable:      getTierEnemies("T3", ENEMY_TIER_BALANCED),
                phaseConditions: { killCount: 20 }
            },
            {
                name: "BOSS",
                bgm:             "bgm_boss1",
                spawn:           { interval: 1000, limit: 1, maxAlive: 1 },
                enemyTable:      [{ type: "BOSS_1", weight: 100, pos: { x: 830, y: 150 } }],
                phaseConditions: { killCount: 1 }
            }
        ],
        endConditions:   { hpZero: true },
        clearConditions: { survive: true },
        star:            { type: "composite", thresholds: [0.5, 0.6, 0.7, 0.8, 0.9] }
    },

    // W2 ワールドボス
    W2_WORLD_BOSS: {
        phases: [
            {
                name: "PHASE 1",
                spawn:           { interval: 2500, limit: null, maxAlive: 7, immediateOnClear: true },
                enemyTable:      getTierEnemies("T6", ENEMY_TIER_BALANCED),
                phaseConditions: { killCount: 25 }
            },
            {
                name: "PHASE 2",
                spawn:           { interval: 2500, limit: null, maxAlive: 7, immediateOnClear: true },
                enemyTable:      getTierEnemies("T6", ENEMY_TIER_BALANCED),
                phaseConditions: { timerMs: 50000 }
            },
            {
                name: "BOSS",
                bgm:             "bgm_boss1",
                spawn:           { interval: 1000, limit: 1, maxAlive: 1 },
                enemyTable:      [{ type: "BOSS_2", weight: 100, pos: { x: 830, y: 150 } }],
                phaseConditions: { killCount: 1 }
            }
        ],
        endConditions:   { hpZero: true },
        clearConditions: { survive: true },
        star:            { type: "composite", thresholds: [0.5, 0.6, 0.7, 0.8, 0.9] }
    },

    // W3 ワールドボス
    W3_WORLD_BOSS: {
        phases: [
            {
                name: "PHASE 1",
                spawn:           { interval: 2500, limit: null, maxAlive: 8, immediateOnClear: true },
                enemyTable:      getTierEnemies("T8", ENEMY_TIER_BALANCED),
                phaseConditions: { killCount: 30 }
            },
            {
                name: "PHASE 2",
                spawn:           { interval: 2500, limit: null, maxAlive: 8, immediateOnClear: true },
                enemyTable:      getTierEnemies("T9", ENEMY_TIER_BALANCED),
                phaseConditions: { timerMs: 60000 }
            },
            {
                name: "PHASE 3",
                spawn:           { interval: 2500, limit: null, maxAlive: 8, immediateOnClear: true },
                enemyTable:      getTierEnemies("T9", ENEMY_TIER_BALANCED),
                phaseConditions: { killCount: 30 }
            },
            {
                name: "BOSS",
                bgm:             "bgm_boss1",
                spawn:           { interval: 1000, limit: 1, maxAlive: 1 },
                enemyTable:      [{ type: "BOSS_3", weight: 100, pos: { x: 830, y: 150 } }],
                phaseConditions: { killCount: 1 }
            }
        ],
        endConditions:   { hpZero: true },
        clearConditions: { survive: true },
        star:            { type: "composite", thresholds: [0.5, 0.6, 0.7, 0.8, 0.9] }
    },


    // ★ビット連動型ボス(EXTRA_BOSS LAST_BOSS)
    // 本体(BOSS_4)と左右のビット(BIT_LEFT / BIT_RIGHT)が電磁波ラインで薄く連結。
    // ビットはプレイヤーには向かわず、本体周囲を楕円軌道で不規則に漂う。
    // ビットは普通の敵と同じ設定(hitCount / tags / behaviors等)で倒せる。
    // 撃破されると本体が bitReviveTime 秒後に復活させ、本体が死ねばビットも消える。

    // Worldend ラストボス
    LAST_BOSS: {
        phases: [
            {
                name: "PHASE 1",
                spawn:           { interval: 2500, limit: null, maxAlive: 8, immediateOnClear: true },
                enemyTable:      getTierEnemies("T8", ENEMY_TIER_ENGLISH_HEAVY),
                phaseConditions: { killCount: 30 }
            },
            {
                name: "PHASE 2",
                spawn:           { interval: 2500, limit: null, maxAlive: 8, immediateOnClear: true },
                enemyTable:      getTierEnemies("T9", ENEMY_TIER_BALANCED),
                phaseConditions: { timerMs: 65000 }
            },
            {
                name: "PHASE 3",
                spawn:           { interval: 2500, limit: null, maxAlive: 8, immediateOnClear: true },
                enemyTable:      getTierEnemies("T9", ENEMY_TIER_BALANCED),
                phaseConditions: { killCount: 35 }
            },
            {
                name: "LAST BOSS",
                bgm:             "bgm_boss2",
                spawn:           { interval: 1000, limit: 1, maxAlive: 1 },
                enemyTable:      [{ type: "LAST_BOSS", weight: 100, pos: { x: 830, y: 150 } }],
                phaseConditions: { killCount: 1 }
            }
        ],
        endConditions:   { hpZero: true },
        clearConditions: { survive: true },
        star:            { type: "composite", thresholds: [0.5, 0.6, 0.7, 0.8, 0.9] }
    },

    // EX ボス
    WEX_BOSS: {
        phases: [
            {
                name: "PHASE 1",
                spawn:           { interval: 2500, limit: null, maxAlive: 8, immediateOnClear: true },
                enemyTable:      getTierEnemies("T9", ENEMY_TIER_ENGLISH_HEAVY),
                phaseConditions: { killCount: 30 }
            },
            {
                name: "PHASE 2",
                spawn:           { interval: 2500, limit: null, maxAlive: 8, immediateOnClear: true },
                enemyTable:      getTierEnemies("T10", ENEMY_TIER_BALANCED),
                phaseConditions: { timerMs: 65000 }
            },
            {
                name: "PHASE 3",
                spawn:           { interval: 2500, limit: null, maxAlive: 8, immediateOnClear: true },
                enemyTable:      getTierEnemies("T10", ENEMY_TIER_BALANCED),
                phaseConditions: { killCount: 35 }
            },
            {
                name: "EXTRA BOSS",
                bgm:             "bgm_vampire",
                spawn:           { interval: 1000, limit: 1, maxAlive: 1 },
                enemyTable:      [{ type: "EX_BOSS", weight: 100, pos: { x: 830, y: 150 } }],
                phaseConditions: { killCount: 1 }
            }
        ],
        endConditions:   { hpZero: true },
        clearConditions: { survive: true },
        star:            { type: "composite", thresholds: [0.5, 0.6, 0.7, 0.8, 0.9] }
    },

    // =====================================================
    // 防衛戦モード（クエスト用）
    // =====================================================

    DEFENSE_1: {
        isDefenseMode:      true,
        bgm:                "bgm_universe",
        missionName:        "コア防衛戦線",
        missionDescription: "時間内に、指定された文字数を入力せよ。",
        defenseConfig: { totalCharsToType: 110, timeLimit: 60,  genres: ['empty'], minLength: 4, maxLength: 8  },
        star: { type: "defenseSurplus", thresholds: [0.4, 0.45, 0.5, 0.6, 0.7], weights: { surplus: 0.4, accuracy: 0.6 } }
    },

    DEFENSE_2: {
        isDefenseMode:      true,
        bgm:                "bgm_universe",
        missionName:        "コア防衛戦線",
        missionDescription: "時間内に、指定された文字数を入力せよ。",
        defenseConfig: { totalCharsToType: 180, timeLimit: 90,  genres: ['empty'], minLength: 4, maxLength: 8  },
        star: { type: "defenseSurplus", thresholds: [0.4, 0.45, 0.5, 0.6, 0.7], weights: { surplus: 0.4, accuracy: 0.6 } }
    },

    DEFENSE_3: {
        isDefenseMode:      true,
        bgm:                "bgm_float",
        missionName:        "コア防衛戦線",
        missionDescription: "時間内に、指定された文字数を入力せよ。",
        defenseConfig: { totalCharsToType: 230, timeLimit: 120, genres: ['empty'], minLength: 4, maxLength: 8  },
        star: { type: "defenseSurplus", thresholds: [0.4, 0.45, 0.5, 0.6, 0.7], weights: { surplus: 0.4, accuracy: 0.6 } }
    },

    DEFENSE_4: {
        isDefenseMode:      true,
        bgm:                "bgm_float",
        missionName:        "コア防衛戦線",
        missionDescription: "時間内に、指定された文字数を入力せよ。",
        defenseConfig: { totalCharsToType: 290, timeLimit: 150, genres: ['empty'], minLength: 4, maxLength: 8  },
        star: { type: "defenseSurplus", thresholds: [0.4, 0.45, 0.5, 0.6, 0.7], weights: { surplus: 0.4, accuracy: 0.6 } }
    },

    DEFENSE_5: {
        isDefenseMode:      true,
        bgm:                "bgm_aftersummer",
        missionName:        "コア防衛戦線",
        missionDescription: "時間内に、指定された文字数を入力せよ。",
        defenseConfig: { totalCharsToType: 370, timeLimit: 180, genres: ['empty'], minLength: 4, maxLength: 8  },
        star: { type: "defenseSurplus", thresholds: [0.4, 0.45, 0.5, 0.6, 0.7], weights: { surplus: 0.4, accuracy: 0.6 } }
    },

    DEFENSE_6: {
        isDefenseMode:      true,
        bgm:                "bgm_aftersummer",
        missionName:        "コア防衛戦線",
        missionDescription: "時間内に、指定された文字数を入力せよ。",
        defenseConfig: { totalCharsToType: 400, timeLimit: 180, genres: ['empty'], minLength: 4, maxLength: 10 },
        star: { type: "defenseSurplus", thresholds: [0.4, 0.45, 0.5, 0.6, 0.7], weights: { surplus: 0.4, accuracy: 0.6 } }
    },

    DEFENSE_7: {
        isDefenseMode:      true,
        bgm:                "bgm_free",
        missionName:        "コア防衛戦線",
        missionDescription: "時間内に、指定された文字数を入力せよ。",
        defenseConfig: { totalCharsToType: 470, timeLimit: 200, genres: ['empty'], minLength: 4, maxLength: 12 },
        star: { type: "defenseSurplus", thresholds: [0.4, 0.45, 0.5, 0.6, 0.7], weights: { surplus: 0.4, accuracy: 0.6 } }
    },

    DEFENSE_8: {
        isDefenseMode:      true,
        bgm:                "bgm_free",
        missionName:        "コア防衛戦線",
        missionDescription: "時間内に、指定された文字数を入力せよ。",
        defenseConfig: { totalCharsToType: 470, timeLimit: 200, genres: ['英語'], minLength: 4, maxLength: 12 },
        star: { type: "defenseSurplus", thresholds: [0.4, 0.45, 0.5, 0.6, 0.7], weights: { surplus: 0.4, accuracy: 0.6 } }
    },

    DEFENSE_9: {
        isDefenseMode:      true,
        bgm:                "bgm_free",
        missionName:        "コア防衛戦線",
        missionDescription: "時間内に、指定された文字数を入力せよ。",
        defenseConfig: { totalCharsToType: 620, timeLimit: 240, genres: ['empty'], minLength: 5, maxLength: 13 },
        star: { type: "defenseSurplus", thresholds: [0.4, 0.45, 0.5, 0.6, 0.7], weights: { surplus: 0.4, accuracy: 0.6 } }
    },

    DEFENSE_10: {
        isDefenseMode:      true,
        bgm:                "bgm_free",
        missionName:        "コア防衛戦線",
        missionDescription: "時間内に、指定された文字数を入力せよ。",
        defenseConfig: { totalCharsToType: 620, timeLimit: 240, genres: ['英語'], minLength: 5, maxLength: 13 },
        star: { type: "defenseSurplus", thresholds: [0.4, 0.45, 0.5, 0.6, 0.7], weights: { surplus: 0.4, accuracy: 0.6 } }
    },

    DEFENSE_11: {
        isDefenseMode:      true,
        bgm:                "bgm_free",
        missionName:        "コア防衛戦線",
        missionDescription: "時間内に、指定された文字数を入力せよ。",
        defenseConfig: { totalCharsToType: 780, timeLimit: 280, genres: ['empty'], minLength: 6, maxLength: 14 },
        star: { type: "defenseSurplus", thresholds: [0.4, 0.45, 0.5, 0.6, 0.7], weights: { surplus: 0.4, accuracy: 0.6 } }
    },

    DEFENSE_12: {
        isDefenseMode:      true,
        bgm:                "bgm_free",
        missionName:        "コア防衛戦線",
        missionDescription: "時間内に、指定された文字数を入力せよ。",
        defenseConfig: { totalCharsToType: 870, timeLimit: 300, genres: ['empty'], minLength: 6, maxLength: 15 },
        star: { type: "defenseSurplus", thresholds: [0.4, 0.45, 0.5, 0.6, 0.7], weights: { surplus: 0.4, accuracy: 0.6 } }
    },

    // =====================================================
    // テスト・開発用ステージ
    // =====================================================

    // フェーズテスト用
    PHASE_TEST: {
        phases: [
            {
                name: "",
                spawn:           { interval: 1500, limit: 5, immediateOnClear: true },
                enemyTable:      [{ type: "GRAY_CIRCLE_SMALL", weight: 100 }],
                phaseConditions: { allSpawnedDefeated: true }
            },
            {
                name: "phase2",
                bgm:  "bgm_reflectable",
                spawn: { interval: 800, limit: 8 },
                enemyTable: [{ type: "PURPLE_CIRCLE_SMALL", weight: 100 }],
                itemSpawn: { interval: 5000, chance: 0.9, limit: null, maxAlive: 1 },
                itemTable: [
                    { type: "HEAL_SMALL",      weight: 5  },
                    { type: "COOLDOWN_STOCK",  weight: 80 },
                    { type: "BOMB",            weight: 10 },
                    { type: "BOMB_ALL",        weight: 5  },
                    { type: "HEAL_FULL",       weight: 5  },
                    { type: "SKILL_CD",        weight: 5  },
                ],
                phaseConditions: { timerMs: 30000 }
            },
            {
                name: "phase3",
                bgm:  "bgm_yamiyo",
                spawn:           { interval: 2000, limit: 1 },
                enemyTable:      [{ type: "BOSS", weight: 100 }],
                phaseConditions: { allSpawnedDefeated: true }
            }
        ],
        endConditions:   { hpZero: true },
        clearConditions: { killCount: 9 },
        star:            { type: "typingSpeed", thresholds: [100, 200, 300, 400, 500] }
    },

    STAGE1test: {
        spawn: { interval: 2000, limit: 30, maxAlive: null, immediateOnClear: true },
        itemSpawn: { interval: 3000, chance: 0.9, limit: null, maxAlive: 5 },
        enemyTable: [
            { type: "GRAY_CIRCLE_SMALL", weight: 70 },
            { type: "GRAY_SQUARE_SMALL", weight: 30 }
        ],
        itemTable: [
            { type: "KILL_ALL",     weight: 40 },
            { type: "HEAL_FULL",    weight: 30 },
            { type: "FREEZE_LARGE", weight: 30 }
        ],
        endConditions:   { hpZero: true, killCount: 20 },
        clearConditions: { killCount: 20 },
        star:            { type: "clearTime", thresholds: [70000, 60000, 50000, 40000, 30000] }
    },

    TESTSTAGE: {
        spawn:           { interval: 1000, limit: 1, maxAlive: null, immediateOnClear: true },
        enemyTable:      [{ type: "MID_BOSS_1", weight: 100 }],
        endConditions:   { hpZero: true, killCount: 1, allSpawnedDefeated: false },
        clearConditions: { killCount: 1 },
        star:            { type: "accuracy", thresholds: [0.2, 0.4, 0.6, 0.8, 0.9] }
    },

    DEFENSE_TEST: {
        isDefenseMode:      true,
        bgm:                "bgm_universe",
        missionName:        "コア防衛戦線",
        missionDescription: "時間内に、指定された文字数を入力せよ。",
        defenseConfig: { totalCharsToType: 50, timeLimit: 30, genres: ['empty'], minLength: 4, maxLength: 8 },
        star: { type: "defenseSurplus", thresholds: [0.4, 0.45, 0.5, 0.6, 0.7], weights: { surplus: 0.4, accuracy: 0.6 } }
    },

    // ★ビット連動型ボス(BOSS_4)
    // 本体(BOSS_4)と左右のビット(BIT_LEFT / BIT_RIGHT)が電磁波ラインで薄く連結。
    // ビットはプレイヤーには向かわず、本体周囲を楕円軌道で不規則に漂う。
    // ビットは普通の敵と同じ設定(hitCount / tags / behaviors等)で倒せる。
    // 撃破されると本体が bitReviveTime 秒後に復活させ、本体が死ねばビットも消える。
    W4_WORLD_BOSS: {
        phases: [
            {
                name: "phase 1",
                spawn:           { interval: 2500, limit: null, maxAlive: 6, immediateOnClear: true },
                enemyTable:      getTierEnemies("T6", ENEMY_TIER_BALANCED),
                phaseConditions: { killCount: 20 }
            },
            {
                name: "boss",
                bgm:             "bgm_boss1",
                spawn:           { interval: 1000, limit: 1, maxAlive: 1 },
                enemyTable:      [{ type: "BOSS_4", weight: 100, pos: { x: 800, y: 200 } }],
                phaseConditions: { killCount: 1 }
            }
        ],
        endConditions:   { hpZero: true },
        clearConditions: { survive: true },
        star:            { type: "composite", thresholds: [0.5, 0.6, 0.7, 0.8, 0.9] }
    },

    // =====================================================
    // EXTRA WORLD テストステージ
    // ※ ここから自由にステージを追加・変更できます
    // =====================================================
    STAGE_EX1: {
        spawn:           { interval: 2000, limit: 10, maxAlive: 3, immediateOnClear: false },
        enemyTable:      [{ type: "TYPE_A", weight: 40 }, { type: "TYPE_B", weight: 30 }, { type: "TYPE_C", weight: 30 }],
        endConditions:   { hpZero: true, killCount: 10, allSpawnedDefeated: false },
        clearConditions: { killCount: 10 },
        star:            { type: "accuracy", thresholds: [0.7, 0.8, 0.88, 0.94, 0.98] }
    },

    STAGE_EX2: {
        spawn:           { interval: 1500, limit: 15, maxAlive: 4, immediateOnClear: true },
        enemyTable:      [{ type: "TYPE_B", weight: 40 }, { type: "TYPE_C", weight: 30 }, { type: "TYPE_D", weight: 30 }],
        endConditions:   { hpZero: true, killCount: 15, allSpawnedDefeated: false },
        clearConditions: { killCount: 15 },
        star:            { type: "accuracy", thresholds: [0.75, 0.82, 0.90, 0.95, 0.99] }
    },

};
