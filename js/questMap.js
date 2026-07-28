// questMap.js

// =====================================================
/*
 * QUEST_MAP 詳細リファレンス:
 * 
 * WORLD_ID: {
 *   name: string,        // ワールド名
 *   bgImage: string,     // マップ画面の背景画像キー
 *   defaults: { ... },   // ワールド内の戦闘中デフォルトBGM/背景 (enemyCore.jsで適用)
 *   nodes: [             // ステージ（ノード）の配列
 *     {
 *       id: string,      // ユニークなノードID (例: W1_Q1)
 *       name: string,    // ノードの表示名
 * 
 *       // ★★★ stage: 必須プロパティ ★★★
 *       // enemyModeConfig.js の STAGES オブジェクトに定義されたキーを指定します。
 *       // これにより、敵の出現パターン、フェーズ、クリア条件などが決まります。（例：STAGE13）
 *       // もし省略された場合、enemyCore.jsが `node.id` からステージ名を推測しようと試みますが、
 *       // 命名規則が一致しないと失敗するため、明示的な指定が推奨されます。
 *       // (例: id:"W1_BOSS" -> stage:"W1_WORLD_BOSS")
 *       stage: string,
 * 
 *       // bgm / bgImage: 任意プロパティ
 *       // ワールドのdefaults設定を上書きしたい場合に個別に指定します。
 *       bgm?: string,
 *       bgImage?: string,
 * 
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
        defaults: {
            bgm: {
                normal: "bgm_swim",
                mid_boss: "bgm_dream",
                boss: "bgm_genesis"
            },
            bgImage: {
                normal: "battle_blue",
                mid_boss: "battle_blue",
                boss: "battle_blue"
            }
        },
        nodes: [
            { id: "W1_Q1",  name: "接続テスト1", stage: "STAGE1", next: ["W1_Q2", "W1_TEST"], pos: { x: 100, y: 350 } },
            //rewordはtestでいれている。
            { id: "W1_TEST",  name: "tetetetes", stage: "TESTSTAGE", next: [], pos: { x: 100, y: 100 },reward: { type: "slot", value: 1 }, enableRandomDialogue: true }, 
            { id: "W1_Q2",  name: "接続テスト2", stage: "STAGE2", next: ["W1_Q3"], pos: { x: 140, y: 290 } },
            { id: "W1_Q3",  name: "接続テスト3", stage: "STAGE3", next: ["W1_Q4"], pos: { x: 180, y: 230 }, enableRandomDialogue: true },
            { id: "W1_Q4",  name: "接続テスト4", stage: "STAGE4", next: ["W1_Q5"], pos: { x: 220, y: 170 } , enableRandomDialogue: true},
            { id: "W1_Q5",  name: "接続テスト5", stage: "STAGE5", next: ["W1_Q6"], pos: { x: 250, y: 110 } , enableRandomDialogue: true},
            { id: "W1_Q6",  name: "接続テスト6", stage: "STAGE6", next: ["W1_Q7"], pos: { x: 285, y: 140 } , enableRandomDialogue: true},
            { id: "W1_Q7",  name: "接続テスト7", stage: "STAGE7", next: ["W1_Q8"], pos: { x: 305, y: 180 }, enableRandomDialogue: true },
            { id: "W1_Q8",  name: "接続テスト8", stage: "STAGE8", next: ["W1_Q9"], pos: { x: 325, y: 220 } },
            { id: "W1_Q9",  name: "接続テスト9", stage: "STAGE9", next: ["W1_Q10"], pos: { x: 345, y: 260 } },
            { id: "W1_Q10", name: "接続テスト10", stage: "STAGE10", next: ["W1_MiniBoss_1"], pos: { x: 350, y: 300 } },
            { 
                id: "W1_MiniBoss_1", 
                name: "最終接続テスト", 
                stage: "W1_MID_BOSS_1", 
                next: ["W1_Q11"], 
                pos: { x: 350, y: 350 } 
            },
            { id: "W1_Q11", name: "新たな経路", stage: "STAGE11", next: ["W1_Q12"], pos: { x: 330, y: 475 } },
            { id: "W1_Q12", name: "英語の残骸", stage: "STAGE12", next: ["W1_Q13"], pos: { x: 300, y: 600 } },
            { id: "W1_Q13", name: "トークンの迷宮", stage: "STAGE13", next: ["W1_Q14"], pos: { x: 340, y: 725 } },
            { id: "W1_Q14", name: "ファイアウォールの穴", stage: "STAGE14", next: ["W1_Q15"], pos: { x: 380, y: 850 } },
            { id: "W1_Q15", name: "バックドア探索", stage: "STAGE15", next: ["W1_Q16"], pos: { x: 430, y: 900 } },
            { id: "W1_Q16", name: "促音の響き", stage: "STAGE16", next: ["W1_Q17"], pos: { x: 470, y: 895 } },
            { id: "W1_Q17", name: "プロキシの霧", stage: "STAGE17", next: ["W1_Q18"], pos: { x: 510, y: 790 } },
            { id: "W1_Q18", name: "暗号化の欠片", stage: "STAGE18", next: ["W1_Q19"], pos: { x: 550, y: 685 } },
            { id: "W1_Q19", name: "猛攻の気配", stage: "STAGE19", next: ["W1_Q20"], pos: { x: 590, y: 580 } },
            { id: "W1_Q20", name: "司令部目前", stage: "STAGE20", next: ["W1_MiniBoss_2"], pos: { x: 630, y: 475 } },
            { 
                id: "W1_MiniBoss_2", 
                name: "Botnet Commander", 
                stage: "W1_MID_BOSS_2", 
                next: ["W1_Q21"], 
                
                pos: { x: 660, y: 350 } 
            },
            { id: "W1_Q21", name: "深層へのアクセス", stage: "STAGE21", next: ["W1_Q22"], pos: { x: 730, y: 330 } },
            { id: "W1_Q22", name: "メインフレームへの道", stage: "STAGE22", next: ["W1_Q23"], pos: { x: 800, y: 320 } },
            { id: "W1_Q23", name: "加速するトラフィック", stage: "STAGE23", next: ["W1_Q24"], pos: { x: 870, y: 280 } },
            { id: "W1_Q24", name: "擬音の嵐", stage: "STAGE24", next: ["W1_Q25"], pos: { x: 940, y: 240 } },
            { id: "W1_Q25", name: "スパイウェアの網", stage: "STAGE25", next: ["W1_Q26"], pos: { x: 1000, y: 200 } },
            { id: "W1_Q26", name: "エンコーダーの罠", stage: "STAGE26", next: ["W1_Q27"], pos: { x: 1060, y: 225 } },
            { id: "W1_Q27", name: "無限ループの淵", stage: "STAGE27", next: ["W1_Q28"], pos: { x: 1120, y: 250 } },
            { id: "W1_Q28", name: "最終プロトコル", stage: "STAGE28", next: ["W1_Q29"], pos: { x: 1180, y: 275 } },
            { id: "W1_Q29", name: "門番の咆哮", stage: "STAGE29", next: ["W1_Q30"], pos: { x: 1240, y: 300 } },
            { id: "W1_Q30", name: "ゲートウェイの門", stage: "STAGE30", next: ["W1_MiniBoss_3"], pos: { x: 1300, y: 325 } },
            { 
                id: "W1_MiniBoss_3", 
                name: "Botnet Commander", 
                stage: "W1_MID_BOSS_3", 
                next: ["W1_BOSS"], 
                
                pos: { x: 1360, y: 350 } 
            },
            { 
                id: "W1_BOSS", 
                name: "Gateway", 
                stage: "W1_WORLD_BOSS", 
                bgImage: "battle_gray",
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
        defaults: {
            bgm: {
                normal: "bgm_aquarium",
                mid_boss: "bgm_cracker",
                boss: "bgm_flashback"
            },
            bgImage: {
                normal: "battle_purple",
                mid_boss: "battle_purple",
                boss: "battle_purple"
            }
        },
        nodes: [
            { id: "W2_Q31", name: "静寂の入口", stage: "STAGE31", next: ["W2_Q32"], pos: { x: 150, y: 100 } },
            { id: "W2_Q32", name: "忘れられたデータ", stage: "STAGE32", next: ["W2_Q33"], pos: { x: 180, y: 180 } },
            { id: "W2_Q33", name: "ノイズの源流", stage: "STAGE33", next: ["W2_Q34"], pos: { x: 210, y: 260 } },
            { id: "W2_Q34", name: "こだまの回廊", stage: "STAGE34", next: ["W2_Q35"], pos: { x: 240, y: 340 } },
            { id: "W2_Q35", name: "沈黙のサーバー", stage: "STAGE35", next: ["W2_Q36"], pos: { x: 280, y: 420 } },
            { id: "W2_Q36", name: "虚ろなポート", stage: "STAGE36", next: ["W2_Q37"], pos: { x: 320, y: 500 } },
            { id: "W2_Q37", name: "ゴーストプロセス", stage: "STAGE37", next: ["W2_Q38"], pos: { x: 360, y: 580 } },
            { id: "W2_Q38", name: "漂流するパケット", stage: "STAGE38", next: ["W2_Q39"], pos: { x: 400, y: 660 } },
            { id: "W2_Q39", name: "深淵の監視者", stage: "STAGE39", next: ["W2_Q40"], pos: { x: 440, y: 740 } },
            { id: "W2_Q40", name: "深淵の監視者2", stage: "STAGE40", next: ["W2_MiniBoss_4"], pos: { x: 460, y: 770 } },
            { id: "W2_MiniBoss_4", name: "Breaker", stage: "W2_MID_BOSS_4", next: ["W2_Q41"], pos: { x: 480, y: 800 } },
            { id: "W2_Q41", name: "反転する信号", stage: "STAGE41", next: ["W2_Q42"], pos: { x: 520, y: 740 } },
            { id: "W2_Q42", name: "歪んだ接続", stage: "STAGE42", next: ["W2_Q43"], pos: { x: 560, y: 660 } },
            { id: "W2_Q43", name: "偽りの応答", stage: "STAGE43", next: ["W2_Q44"], pos: { x: 600, y: 580 } },
            { id: "W2_Q44", name: "幻影のプロトコル", stage: "STAGE44", next: ["W2_Q45"], pos: { x: 640, y: 500 } },
            { id: "W2_Q45", name: "ミラーサーバー", stage: "STAGE45", next: ["W2_Q46"], pos: { x: 680, y: 420 } },
            { id: "W2_Q46", name: "反響するクエリ", stage: "STAGE46", next: ["W2_Q47"], pos: { x: 720, y: 340 } },
            { id: "W2_Q47", name: "二重の罠", stage: "STAGE47", next: ["W2_Q48"], pos: { x: 760, y: 260 } },
            { id: "W2_Q48", name: "反転世界の脅威", stage: "STAGE48", next: ["W2_Q49"], pos: { x: 800, y: 180 } },
            { id: "W2_Q49", name: "虚像の番人", stage: "STAGE49", next: ["W2_Q50"], pos: { x: 840, y: 100 } },
            { id: "W2_Q50", name: "深淵の監視者2", stage: "STAGE50", next: ["W2_MiniBoss_5"], pos: { x: 860, y: 75 } },
            { id: "W2_MiniBoss_5", name: "Void", stage: "W2_MID_BOSS_5", next: ["W2_Q51"], pos: { x: 880, y: 50 } },
            { id: "W2_Q51", name: "最後の平穏", stage: "STAGE51", next: ["W2_Q52"], pos: { x: 930, y: 130 } },
            { id: "W2_Q52", name: "崩壊の序曲", stage: "STAGE52", next: ["W2_Q53"], pos: { x: 960, y: 180 } },
            { id: "W2_Q53", name: "断片化する世界", stage: "STAGE53", next: ["W2_Q54"], pos: { x: 1000, y: 260 } },
            { id: "W2_Q54", name: "グリッチの嵐", stage: "STAGE54", next: ["W2_Q55"], pos: { x: 1040, y: 340 } },
            { id: "W2_Q55", name: "エラーの連鎖", stage: "STAGE55", next: ["W2_Q56"], pos: { x: 1080, y: 420 } },
            { id: "W2_Q56", name: "カーネルパニック", stage: "STAGE56", next: ["W2_Q57"], pos: { x: 1120, y: 500 } },
            { id: "W2_Q57", name: "暴走するコア", stage: "STAGE57", next: ["W2_Q58"], pos: { x: 1160, y: 580 } },
            { id: "W2_Q58", name: "終焉へのカウントダウン", stage: "STAGE58", next: ["W2_Q59"], pos: { x: 1200, y: 660 } },
            { id: "W2_Q59", name: "コアの守護者", stage: "STAGE59", next: ["W2_Q60"], pos: { x: 1240, y: 740 } },
            { id: "W2_Q60", name: "深淵の監視者2", stage: "STAGE60", next: ["W2_MiniBoss_6"], pos: { x: 1260, y: 770 } },
            { id: "W2_MiniBoss_6", name: "Ghost", stage: "W2_MID_BOSS_6", next: ["W2_BOSS"], pos: { x: 1280, y: 800 } },
            { id: "W2_BOSS", name: "Cyber Core", stage: "W2_WORLD_BOSS", reward: { type: "activeStock", value: 1 }, next: [], nextWorld: "WORLD3", pos: { x: 1320, y: 850 } }
        ]
    },

    WORLD3: {
        name: "虚無の荒野",
        bgImage: "map_red",
        defaults: {
            bgm: {
                normal: "bgm_harunosuisou",
                mid_boss: "bgm_rojiura",
                boss: "bgm_yamiyo"
            },
            bgImage: {
                normal: "battle_red",
                mid_boss: "battle_red",
                boss: "battle_red"
            }
        },
        nodes: [
            { id: "W3_Q61", name: "始まりの砂塵", stage: "STAGE61", next: ["W3_Q62"], pos: { x: 100, y: 475 } },
            { id: "W3_Q62", name: "風紋の道", stage: "STAGE62", next: ["W3_Q63"], pos: { x: 180, y: 280 } },
            { id: "W3_Q63", name: "陽炎の彼方", stage: "STAGE63", next: ["W3_Q64"], pos: { x: 350, y: 150 } },
            { id: "W3_Q64", name: "乾いた記憶", stage: "STAGE64", next: ["W3_Q65"], pos: { x: 550, y: 110 } },
            { id: "W3_Q65", name: "残響のオアシス", stage: "STAGE65", next: ["W3_Q66"], pos: { x: 705, y: 100 } },
            { id: "W3_Q66", name: "砂漠の蜃気楼", stage: "STAGE66", next: ["W3_Q67"], pos: { x: 860, y: 110 } },
            { id: "W3_Q67", name: "熱砂の試練", stage: "STAGE67", next: ["W3_Q68"], pos: { x: 1060, y: 150 } },
            { id: "W3_Q68", name: "古代の遺物", stage: "STAGE68", next: ["W3_Q69"], pos: { x: 1230, y: 280 } },
            { id: "W3_Q69", name: "遺跡の守護者", stage: "STAGE69", next: ["W3_Q70"], pos: { x: 1310, y: 475 } },
            { id: "W3_Q70", name: "深淵の監視者2", stage: "STAGE70", next: ["W3_MiniBoss_7"], pos: { x: 1270, y: 570 } },
            { id: "W3_MiniBoss_7", name: "Void", stage: "W3_MID_BOSS_7", next: ["W3_Q71"], pos: { x: 1230, y: 670 } },
            { id: "W3_Q71", name: "地下回廊", stage: "STAGE71", next: ["W3_Q72"], pos: { x: 1060, y: 800 } },
            { id: "W3_Q72", name: "封印されたコード", stage: "STAGE72", next: ["W3_Q73"], pos: { x: 860, y: 840 } },
            { id: "W3_Q73", name: "暗闇のささやき", stage: "STAGE73", next: ["W3_Q74"], pos: { x: 705, y: 850 } },
            { id: "W3_Q74", name: "失われたアーカイブ", stage: "STAGE74", next: ["W3_Q75"], pos: { x: 550, y: 840 } },
            { id: "W3_Q75", name: "奈落への階段", stage: "STAGE75", next: ["W3_Q76"], pos: { x: 350, y: 800 } },
            { id: "W3_Q76", name: "深淵の呼び声", stage: "STAGE76", next: ["W3_Q77"], pos: { x: 290, y: 670 } },
            { id: "W3_Q77", name: "内なる円環", stage: "STAGE77", next: ["W3_Q78"], pos: { x: 280, y: 475 } },
            { id: "W3_Q78", name: "螺旋の終着点", stage: "STAGE78", next: ["W3_Q79"], pos: { x: 430, y: 300 } },
            { id: "W3_Q79", name: "中心核の脈動", stage: "STAGE79", next: ["W3_Q80"], pos: { x: 705, y: 250 } },
            { id: "W3_Q80", name: "深淵の監視者2", stage: "STAGE80", next: ["W3_MiniBoss_8"], pos: { x: 840, y: 275 } },
            { id: "W3_MiniBoss_8", name: "Ghost", stage: "W3_MID_BOSS_8", next: ["W3_Q81"], pos: { x: 980, y: 300 } },
            { id: "W3_Q81", name: "最後の防衛線", stage: "STAGE81", next: ["W3_Q82"], pos: { x: 1080, y: 475 } },
            { id: "W3_Q82", name: "暴走する防壁", stage: "STAGE82", next: ["W3_Q83"], pos: { x: 980, y: 650 } },
            { id: "W3_Q83", name: "オーバーロード", stage: "STAGE83", next: ["W3_Q84"], pos: { x: 705, y: 700 } },
            { id: "W3_Q84", name: "臨界点", stage: "STAGE84", next: ["W3_Q85"], pos: { x: 490, y: 650 } },
            { id: "W3_Q85", name: "虚無への道", stage: "STAGE85", next: ["W3_Q86"], pos: { x: 480, y: 475 } },
            { id: "W3_Q86", name: "無音の警告", stage: "STAGE86", next: ["W3_Q87"], pos: { x: 705, y: 380 } },
            { id: "W3_Q87", name: "全てがゼロになる", stage: "STAGE87", next: ["W3_Q88"], pos: { x: 930, y: 475 } },
            { id: "W3_Q88", name: "最後の抵抗", stage: "STAGE88", next: ["W3_Q89"], pos: { x: 705, y: 570 } },
            { id: "W3_Q89", name: "管理者", stage: "STAGE89", next: ["W3_Q90"], pos: { x: 600, y: 475 } },
            { id: "W3_Q90", name: "深淵の監視者2", stage: "STAGE90", next: ["W3_MiniBoss_9"], pos: { x: 640, y: 462 } },
            { id: "W3_MiniBoss_9", name: "Ghost", stage: "W3_MID_BOSS_9", next: ["W3_BOSS"], pos: { x: 680, y: 450 } },
            { id: "W3_BOSS", name: "The Admin", stage: "W3_WORLD_BOSS", next: [], nextWorld: "WORLDEND", pos: { x: 705, y: 475 } }
        ]
    },

    WORLDEND: {
        name: "終焉の地",
        bgImage: "map_gray",
        defaults: {
            bgm: {
                normal: "bgm_harunosuisou",
                mid_boss: "bgm_rojiura",
                boss: "bgm_yamiyo"
            },
            bgImage: {
                normal: "battle_gray",
                mid_boss: "battle_gray",
                boss: "battle_gray"
            }
        },
        nodes: [
            { id: "WEND_LastBoss", name: "The Void", stage: "LAST_BOSS", next: [], pos: { x: 705, y: 150 } }
        ]
    }    
};