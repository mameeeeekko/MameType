// questMap.js

// =====================================================
// name  ノードに表示する名前
// reward 
//  bgImage: 背景画像のパス
//  type: slot スロット追加 
// =====================================================
/**
 * QUEST_MAP 詳細リファレンス:
 * 
 * WORLD_ID: {
 *   name: string,        // ワールド名
 *   bgImage: string,     // マップ画面の背景画像キー
 *   nodes: [             // ステージ（ノード）の配列
 *     {
 *       id: string,      // ユニークなノードID (例: W1_Q1)
 *       name: string,    // ノードの表示名
 *       stage: string,   // enemyModeConfig.js の STAGES に定義されたキー
 *       bgm: string,     // ステージ中のBGMキー (bgm_enemy1:通常, 2:中ボス, 3:ボス)
 *       bgImage: string, // バトル中の背景画像キー
 *       next: string[],  // クリア後に解放されるノードIDの配列
 *       nextWorld: string, // ワールドクリア時に遷移する次のワールドID (終点のみ)
 *       reward: {        // クリア時初回報酬（任意）
 *         type: "slot" | "activeStock", // スロット解放 or スキルストック増加
 *         value: number
 *       },
 *       pos: { x: number, y: number } // マップ画面上の表示座標
 *     }
 *   ]
 * }
 */

export const QUEST_MAP = {
    WORLD1: {
        name: "サイバー・フロンティア",
        bgImage: "map_blue",
        nodes: [
            { id: "W1_Q1",  name: "接続テスト", stage: "STAGE1", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q2"], pos: { x: 100, y: 300 } },
            { id: "W1_Q2",  name: "パケットの海", stage: "STAGE2", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q3"], pos: { x: 180, y: 450 } },
            { id: "W1_Q3",  name: "Cookie採取", stage: "STAGE3", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q4"], pos: { x: 140, y: 550 } },
            { id: "W1_Q4",  name: "ログ解析", stage: "STAGE4", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q5"], pos: { x: 260, y: 500 } },
            { id: "W1_Q5",  name: "バッファ浄化", stage: "STAGE5", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q6"], pos: { x: 340, y: 550 } },
            { id: "W1_Q6",  name: "不要なキャッシュ", stage: "STAGE6", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q7"], pos: { x: 420, y: 450 } },
            { id: "W1_Q7",  name: "セッション維持", stage: "STAGE7", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q8"], pos: { x: 370, y: 350 } },
            { id: "W1_Q8",  name: "ゴミ捨て場", stage: "STAGE8", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q9"], pos: { x: 460, y: 250 } },
            { id: "W1_Q9",  name: "警告の予兆", stage: "STAGE9", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q10"], pos: { x: 540, y: 150 } },
            { id: "W1_Q10", name: "最終チェックポイント", stage: "STAGE10", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_MiniBoss_1"], pos: { x: 480, y: 50 } },
            { 
                id: "W1_MiniBoss_1", 
                name: "中ボス: Adware King", 
                stage: "W1_MID_BOSS_1", 
                bgm: "bgm_enemy2", 
                bgImage: "battle_blue", 
                next: ["W1_Q11"], 
                reward: { type: "activeStock", value: 1 }, 
                pos: { x: 600, y: 120 } 
            },
            { id: "W1_Q11", name: "新たな経路", stage: "STAGE11", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q12"], pos: { x: 680, y: 200 } },
            { id: "W1_Q12", name: "英語の残骸", stage: "STAGE12", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q13"], pos: { x: 620, y: 300 } },
            { id: "W1_Q13", name: "トークンの迷宮", stage: "STAGE13", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q14"], pos: { x: 720, y: 400 } },
            { id: "W1_Q14", name: "ファイアウォールの穴", stage: "STAGE14", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q15"], pos: { x: 800, y: 520 } },
            { id: "W1_Q15", name: "バックドア探索", stage: "STAGE15", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q16"], pos: { x: 880, y: 450 } },
            { id: "W1_Q16", name: "促音の響き", stage: "STAGE16", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q17"], pos: { x: 820, y: 350 } },
            { id: "W1_Q17", name: "プロキシの霧", stage: "STAGE17", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q18"], pos: { x: 920, y: 250 } },
            { id: "W1_Q18", name: "暗号化の欠片", stage: "STAGE18", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q19"], pos: { x: 1000, y: 150 } },
            { id: "W1_Q19", name: "猛攻の気配", stage: "STAGE19", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q20"], pos: { x: 1080, y: 80 } },
            { id: "W1_Q20", name: "司令部目前", stage: "STAGE20", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_MiniBoss_2"], pos: { x: 1030, y: 220 } },
            { 
                id: "W1_MiniBoss_2", 
                name: "中ボス: Botnet Commander", 
                stage: "W1_MID_BOSS_2", 
                bgm: "bgm_enemy2", 
                bgImage: "battle_blue", 
                next: ["W1_Q21"], 
                reward: { type: "slot", value: 1 }, 
                pos: { x: 1150, y: 320 } 
            },
            { id: "W1_Q21", name: "深層へのアクセス", stage: "STAGE21", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q22"], pos: { x: 1250, y: 420 } },
            { id: "W1_Q22", name: "メインフレームへの道", stage: "STAGE22", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q23"], pos: { x: 1210, y: 530 } },
            { id: "W1_Q23", name: "加速するトラフィック", stage: "STAGE23", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q24"], pos: { x: 1330, y: 500 } },
            { id: "W1_Q24", name: "擬音の嵐", stage: "STAGE24", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q25"], pos: { x: 1420, y: 400 } },
            { id: "W1_Q25", name: "スパイウェアの網", stage: "STAGE25", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q26"], pos: { x: 1510, y: 300 } },
            { id: "W1_Q26", name: "エンコーダーの罠", stage: "STAGE26", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q27"], pos: { x: 1470, y: 180 } },
            { id: "W1_Q27", name: "無限ループの淵", stage: "STAGE27", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q28"], pos: { x: 1580, y: 100 } },
            { id: "W1_Q28", name: "最終プロトコル", stage: "STAGE28", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q29"], pos: { x: 1670, y: 150 } },
            { id: "W1_Q29", name: "門番の咆哮", stage: "STAGE29", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q30"], pos: { x: 1750, y: 220 } },
            { id: "W1_Q30", name: "ゲートウェイの門", stage: "STAGE30", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_BOSS"], pos: { x: 1710, y: 350 } },
            { 
                id: "W1_BOSS", 
                name: "Gateway Guardian", 
                stage: "W1_WORLD_BOSS", 
                bgm: "bgm_enemy3", 
                bgImage: "battle_blue", 
                next: [], 
                nextWorld: "WORLD2", 
                pos: { x: 1850, y: 300 } 
            }
        ]
    },

    WORLD2: {
        name: "静寂の平原",
        bgImage: "map_purple",
        nodes: [
            {
                id: "W2_Q1",
                name: "未知のアーカイブ",
                stage: "STAGE31",
                bgm: "bgm_enemy1",
                bgImage: "battle_green",
                next: ["W2_Q2"],
                pos: { x: 100, y: 300 }
            },
            {
                id: "W2_Q2",
                name: "草生えるフォルダ",
                stage: "STAGE32",
                bgm: "bgm_enemy1",
                bgImage: "battle_green",
                next: ["W2_Q3"],
                reward: {
                    type: "activeStock",
                    value: 1
                },
                pos: { x: 450, y: 100 }
            },
            {
                id: "W2_Q3",
                name: "平原の果て",
                stage: "STAGE33",
                bgm: "bgm_enemy1",
                bgImage: "battle_green",
                next: [],
                nextWorld: "WORLD3",
                pos: { x: 800, y: 300 }
            }
        ]
    },

    WORLD3: {
        name: "虚無の荒野",
        bgImage: "map_red",
        nodes: [
            {
                id: "W3_Q1",
                name: "スライム討伐",
                stage: "STAGE1",
                bgm: "bgm_enemy1",
                bgImage: "battle_gray",
                next: [],
                pos: { x: 100, y: 300 }
            },
        ]
    },
};