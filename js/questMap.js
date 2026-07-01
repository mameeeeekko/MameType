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
            { id: "W1_Q1",  name: "接続テスト", stage: "STAGE1", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q2","W1_TEST"], pos: { x: 100, y: 350 } },
            //rewordはtestでいれている。
            { id: "W1_TEST",  name: "テスト", stage: "TESTSTAGE", bgm: "bgm_enemy1", bgImage: "battle_blue", next: [], pos: { x: 100, y: 100 },reward: { type: "slot", value: 1 },  }, 
            { id: "W1_Q2",  name: "パケットの海", stage: "STAGE2", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q3"], pos: { x: 140, y: 290 } },
            { id: "W1_Q3",  name: "Cookie採取", stage: "STAGE3", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q4"], pos: { x: 180, y: 230 } },
            { id: "W1_Q4",  name: "ログ解析", stage: "STAGE4", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q5"], pos: { x: 220, y: 170 } },
            { id: "W1_Q5",  name: "バッファ浄化", stage: "STAGE5", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q6"], pos: { x: 250, y: 110 } },
            { id: "W1_Q6",  name: "不要なキャッシュ", stage: "STAGE6", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q7"], pos: { x: 285, y: 140 } },
            { id: "W1_Q7",  name: "セッション維持", stage: "STAGE7", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q8"], pos: { x: 305, y: 180 } },
            { id: "W1_Q8",  name: "ゴミ捨て場", stage: "STAGE8", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q9"], pos: { x: 325, y: 220 } },
            { id: "W1_Q9",  name: "警告の予兆", stage: "STAGE9", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q10"], pos: { x: 345, y: 260 } },
            { id: "W1_Q10", name: "最終チェックポイント", stage: "STAGE10", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_MiniBoss_1"], pos: { x: 350, y: 300 } },
            { 
                id: "W1_MiniBoss_1", 
                name: "Adware King", 
                stage: "W1_MID_BOSS_1", 
                bgm: "bgm_enemy2", 
                bgImage: "battle_blue", 
                next: ["W1_Q11"], 
                pos: { x: 350, y: 350 } 
            },
            { id: "W1_Q11", name: "新たな経路", stage: "STAGE11", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q12"], pos: { x: 330, y: 475 } },
            { id: "W1_Q12", name: "英語の残骸", stage: "STAGE12", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q13"], pos: { x: 300, y: 600 } },
            { id: "W1_Q13", name: "トークンの迷宮", stage: "STAGE13", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q14"], pos: { x: 340, y: 725 } },
            { id: "W1_Q14", name: "ファイアウォールの穴", stage: "STAGE14", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q15"], pos: { x: 380, y: 850 } },
            { id: "W1_Q15", name: "バックドア探索", stage: "STAGE15", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q16"], pos: { x: 430, y: 900 } },
            { id: "W1_Q16", name: "促音の響き", stage: "STAGE16", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q17"], pos: { x: 470, y: 895 } },
            { id: "W1_Q17", name: "プロキシの霧", stage: "STAGE17", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q18"], pos: { x: 510, y: 790 } },
            { id: "W1_Q18", name: "暗号化の欠片", stage: "STAGE18", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q19"], pos: { x: 550, y: 685 } },
            { id: "W1_Q19", name: "猛攻の気配", stage: "STAGE19", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q20"], pos: { x: 590, y: 580 } },
            { id: "W1_Q20", name: "司令部目前", stage: "STAGE20", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_MiniBoss_2"], pos: { x: 630, y: 475 } },
            { 
                id: "W1_MiniBoss_2", 
                name: "Botnet Commander", 
                stage: "W1_MID_BOSS_2", 
                bgm: "bgm_enemy2", 
                bgImage: "battle_blue", 
                next: ["W1_Q21"], 
                
                pos: { x: 660, y: 350 } 
            },
            { id: "W1_Q21", name: "深層へのアクセス", stage: "STAGE21", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q22"], pos: { x: 730, y: 330 } },
            { id: "W1_Q22", name: "メインフレームへの道", stage: "STAGE22", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q23"], pos: { x: 800, y: 320 } },
            { id: "W1_Q23", name: "加速するトラフィック", stage: "STAGE23", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q24"], pos: { x: 870, y: 280 } },
            { id: "W1_Q24", name: "擬音の嵐", stage: "STAGE24", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q25"], pos: { x: 940, y: 240 } },
            { id: "W1_Q25", name: "スパイウェアの網", stage: "STAGE25", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q26"], pos: { x: 1000, y: 200 } },
            { id: "W1_Q26", name: "エンコーダーの罠", stage: "STAGE26", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q27"], pos: { x: 1060, y: 225 } },
            { id: "W1_Q27", name: "無限ループの淵", stage: "STAGE27", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q28"], pos: { x: 1120, y: 250 } },
            { id: "W1_Q28", name: "最終プロトコル", stage: "STAGE28", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q29"], pos: { x: 1180, y: 275 } },
            { id: "W1_Q29", name: "門番の咆哮", stage: "STAGE29", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_Q30"], pos: { x: 1240, y: 300 } },
            { id: "W1_Q30", name: "ゲートウェイの門", stage: "STAGE30", bgm: "bgm_enemy1", bgImage: "battle_blue", next: ["W1_MiniBoss_3"], pos: { x: 1300, y: 325 } },
            { 
                id: "W1_MiniBoss_3", 
                name: "Botnet Commander", 
                stage: "W1_MID_BOSS_3", 
                bgm: "bgm_enemy2", 
                bgImage: "battle_blue", 
                next: ["W1_BOSS"], 
                
                pos: { x: 1360, y: 350 } 
            },
            { 
                id: "W1_BOSS", 
                name: "Gateway", 
                stage: "W1_WORLD_BOSS", 
                bgm: "bgm_enemy3", 
                bgImage: "battle_blue", 
                reward: { type: "slot", value: 1 }, 
                next: [], 
                nextWorld: "WORLD2", 
                pos: { x: 1420, y: 350 } 
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
                reward: { type: "activeStock", value: 1 }, 
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