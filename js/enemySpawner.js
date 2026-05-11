import { Enemy, EnemyTypes} from "./enemy.js";
import { TARGETS, getWord } from "./target.js";
import { buildBaseRomaji } from "./typingLogic.js";
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

export function spawnEnemy(player, enemies = [], canvas, stage, diff) {

    // =====================================================
    // 0. 敵タイプを決定（ステージ依存）
    // =====================================================
    function pickEnemyType(stage) {

        // ★ステージ未指定時は従来処理（保険）
        if (!stage || !stage.enemyTable) {
            const types = Object.values(EnemyTypes);
            return types[Math.floor(Math.random() * types.length)];
        }

        const table = stage.enemyTable;

        const total = table.reduce((sum, e) => sum + e.weight, 0);
        let r = Math.random() * total;

        for (const e of table) {
            r -= e.weight;
            if (r <= 0) {
                return EnemyTypes[e.type]; // ★ここ重要（string → 実体）
            }
        }

        return EnemyTypes[table[0].type];
    }

    const type = pickEnemyType(stage);

    // =====================================================
    // 1. 現在使用されている text を取得 使用済みチェック
    // =====================================================
    /*
    enemies 配列から敵の text を取り出し Set にする
    Set にする理由
    - has() が O(1) で高速
    - includes() の O(n) を避ける
    */
    const usedTexts = new Set(enemies.map(e => e.text));

    // =====================================================
    // 3. 出題問題を取得し、同じ問題が出ないようにチェック
    // =====================================================
    //enemyType に設定されたtagや文字数を使ってtarget.js の関数から問題を取得
    //同じ問題になったら、タイプは維持したまま再抽選する。
    let target = null;
    let retry = 5;

    while (retry-- > 0) {
        const t = getWord(type.tags, type.minLen, type.maxLen);
        if (t && !usedTexts.has(t.text)) {
            target = t;
            break;
        }
    }

    if (!target) return null;
    // =====================================================
    // 2. 未使用ターゲットを抽出
    // =====================================================
    /*
    TARGETS から
    「まだ敵として出ていない文章」
    だけを取り出す

    例
    TARGETS
    ["apple","banana","boss"]

    enemies
    ["banana"]
    ↓
    availableTargets
    ["apple","boss"]
    */
    const availableTargets = TARGETS.filter(
        target => !usedTexts.has(target.text)
    );
    // =====================================================
    // 3. 使用可能ターゲットがない場合
    // =====================================================
    /*
    すべてのターゲットが画面に出ている場合
    新しい敵を生成できない
    */
    if (availableTargets.length === 0) {
        console.warn("使用可能なターゲットがありません");
        return null;
    }

    // =====================================================
    // 5. 敵の出現位置を決定
    // =====================================================
    /*
    プレイヤーを中心とした円周上に敵を生成
    angle : 円周の角度
    dist  : プレイヤーからの距離
    */
    const padding = 10;     // 文字やマージンの余白
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    // ==============================
    // UIセーフエリア取得
    // ==============================
    const chainUI = document.getElementById("chainUI");
    let uiBottom = 0;

    if (chainUI) {
        const rect = chainUI.getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();
        uiBottom = rect.bottom - canvasRect.top;
    }
     // 半径
    const enemyRadius = type.size;
    // 乱数で円周上に配置する前に画面内に収まる範囲を計算
    const minX = enemyRadius + padding;
    const maxX = canvasWidth - enemyRadius - padding;
    // 出現ポイント制限
    const minY = Math.max(enemyRadius + padding, uiBottom + padding);
    const maxY = canvasHeight - enemyRadius - padding;
    // ランダム角度・距離
    const angle = Math.random() * Math.PI * 2;
    const dist = 350;
    // プレイヤー中心に円上で座標計算
    let x = player.x + Math.cos(angle) * dist;
    let y = player.y + Math.sin(angle) * dist;
    // 画面内に収める
    x = Math.min(Math.max(x, minX), maxX);
    y = Math.min(Math.max(y, minY), maxY);
    
    // =====================================================
    // 7. Enemy インスタンス生成
    // =====================================================
    /*
    word : 表示用（漢字あり）
    text : タイピング判定用（かな）
    */
    const enemy = new Enemy(
    target.word,
    target.text,
    x,
    y,
    type.speed,
    type 
    );

    // ===============================
    // ★難易度補正（ここ追加）
    // ===============================
    if (diff) {
        enemy.speed = type.speed * diff.enemySpeed;
        enemy.damage = type.damage * diff.damageMultiplier;
    } else {
        enemy.damage = type.damage; // fallback
    }
    
    // 敵タイプ情報を保存
    //enemy.type = type;
    enemy.radius = type.size;

    // 初期ローマ字を保存（描画の基準幅）
    enemy.baseRomaji = buildBaseRomaji(enemy.text); 
    return enemy;

}

// typeに応じたランダム単語を返す
export function getRandomWordForType(type) {
    // type.tags, minLen, maxLen を getWord に渡す
    const word = getWord(type.tags, type.minLen, type.maxLen);

    if (!word) return null;

    return word;
}
