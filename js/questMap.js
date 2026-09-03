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
        name: "サイバー・フロンティア", // Cyber Frontier
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
            { id: "W1_Q1",  name: "接続テスト1", stage: "STAGE1", next: ["W1_Q2", "W1_TEST","W1_DEFENSE_TEST"], pos: { x: 100, y: 350 }, enableRandomDialogue: true },
            // { id: "W1_DEFENSE_TEST", name: "防衛戦線", stage: "DEFENSE_TEST", next: [], pos: { x: 100, y: 220 }, enableRandomDialogue: false },
            // { id: "W1_TEST",  name: "tetetetes", stage: "TESTSTAGE", next: [], pos: { x: 100, y: 100 },reward: { type: "slot", value: 1 }, enableRandomDialogue: true }, 
            { id: "W1_Q2",  name: "接続テスト2", stage: "STAGE2", next: ["W1_Q3"], pos: { x: 140, y: 290 }, enableRandomDialogue: true },
            { id: "W1_Q3",  name: "接続テスト3", stage: "STAGE3", next: ["W1_Q4"], pos: { x: 180, y: 230 }, enableRandomDialogue: true },
            { id: "W1_Q4",  name: "接続テスト4", stage: "STAGE4", next: ["W1_Q5"], pos: { x: 220, y: 170 } , enableRandomDialogue: true},
            { id: "W1_Q5",  name: "接続テスト5", stage: "STAGE5", next: ["W1_Q6"], pos: { x: 250, y: 110 } , enableRandomDialogue: true},
            { id: "W1_Q6",  name: "接続テスト6", stage: "STAGE6", next: ["W1_Q7"], pos: { x: 285, y: 140 } , enableRandomDialogue: true},
            { id: "W1_Q7",  name: "接続テスト7", stage: "STAGE7", next: ["W1_Q8"], pos: { x: 305, y: 180 }, enableRandomDialogue: true },
            { id: "W1_Q8",  name: "接続テスト8", stage: "STAGE8", next: ["W1_Q9"], pos: { x: 325, y: 220 }, enableRandomDialogue: true },
            { id: "W1_Q9",  name: "接続テスト9", stage: "STAGE9", next: ["W1_Q10"], pos: { x: 345, y: 260 }, enableRandomDialogue: true },
            { id: "W1_Q10", name: "接続テスト10", stage: "STAGE10", next: ["W1_MiniBoss_1"], pos: { x: 350, y: 300 }, enableRandomDialogue: true },
            { 
                id: "W1_MiniBoss_1", 
                name: "最終接続テスト", 
                name: "システム・コア", 
                stage: "W1_MID_BOSS_1", 
                next: ["W1_Q11"], 
                pos: { x: 350, y: 350 }, enableRandomDialogue: false 
            },
            { id: "W1_Q11", name: "情報開示", stage: "STAGE11", next: ["W1_Q12"], pos: { x: 330, y: 475 }, enableRandomDialogue: true },
            { id: "W1_Q12", name: "分散ネットワーク", stage: "STAGE12", next: ["W1_Q13"], pos: { x: 300, y: 600 }, enableRandomDialogue: true },
            { id: "W1_Q13", name: "エントロピー", stage: "STAGE13", next: ["W1_Q14"], pos: { x: 340, y: 725 }, enableRandomDialogue: true },
            { id: "W1_Q14", name: "スレッド", stage: "STAGE14", next: ["W1_Q15"], pos: { x: 380, y: 850 }, enableRandomDialogue: true },
            { id: "W1_Q15", name: "アクセス権限", stage: "STAGE15", next: ["W1_DEFENSE_1"], pos: { x: 430, y: 855 }, enableRandomDialogue: true },
            { id: "W1_DEFENSE_1", name: "防衛1", stage: "DEFENSE_1", next: ["W1_Q16"], pos: { x: 450, y: 820 }, enableRandomDialogue: false },
            { id: "W1_Q16", name: "基盤システム", stage: "STAGE16", next: ["W1_Q17"], pos: { x: 480, y: 790 }, enableRandomDialogue: true },
            { id: "W1_Q17", name: "自己参照AI", stage: "STAGE17", next: ["W1_Q18"], pos: { x: 510, y: 750 }, enableRandomDialogue: true },
            { id: "W1_Q18", name: "脆弱性スキャン", stage: "STAGE18", next: ["W1_Q19"], pos: { x: 550, y: 655 }, enableRandomDialogue: true },
            { id: "W1_Q19", name: "ステルス侵食", stage: "STAGE19", next: ["W1_Q20"], pos: { x: 590, y: 540 }, enableRandomDialogue: true },
            { id: "W1_Q20", name: "監視エンティティ", stage: "STAGE20", next: ["W1_MiniBoss_2"], pos: { x: 630, y: 475 }, enableRandomDialogue: true },
            { 
                id: "W1_MiniBoss_2", 
                name: "監視エンティティ", 
                stage: "W1_MID_BOSS_2", 
                next: ["W1_Q21"], 
                
                pos: { x: 660, y: 350 }, enableRandomDialogue: false
            },
            { id: "W1_Q21", name: "シグナルノイズ", stage: "STAGE21", next: ["W1_Q22"], pos: { x: 730, y: 330 }, enableRandomDialogue: true },
            { id: "W1_Q22", name: "未知のプロトコル", stage: "STAGE22", next: ["W1_Q23"], pos: { x: 800, y: 320 }, enableRandomDialogue: true },
            { id: "W1_Q23", name: "パターン検出", stage: "STAGE23", next: ["W1_Q24"], pos: { x: 870, y: 280 }, enableRandomDialogue: true },
            { id: "W1_Q24", name: "データフラグメント", stage: "STAGE24", next: ["W1_Q25"], pos: { x: 940, y: 240 }, enableRandomDialogue: true },
            { id: "W1_Q25", name: "存在証明", stage: "STAGE25", next: ["W1_DEFENSE_2"], pos: { x: 1000, y: 200 }, enableRandomDialogue: true },
            { id: "W1_DEFENSE_2", name: "防衛2", stage: "DEFENSE_2", next: ["W1_Q26"], pos: { x: 1050, y: 170 }, enableRandomDialogue: false },
            { id: "W1_Q26", name: "傍受", stage: "STAGE26", next: ["W1_Q27"], pos: { x: 1085, y: 210 }, enableRandomDialogue: true },
            { id: "W1_Q27", name: "クエリ", stage: "STAGE27", next: ["W1_Q28"], pos: { x: 1120, y: 255 }, enableRandomDialogue: true },
            { id: "W1_Q28", name: "不正アクセス", stage: "STAGE28", next: ["W1_Q29"], pos: { x: 1180, y: 275 }, enableRandomDialogue: true },
            { id: "W1_Q29", name: "深層接続", stage: "STAGE29", next: ["W1_Q30"], pos: { x: 1240, y: 300 }, enableRandomDialogue: true },
            { id: "W1_Q30", name: "セッション確立", stage: "STAGE30", next: ["W1_MiniBoss_3"], pos: { x: 1240, y: 325 }, enableRandomDialogue: true },
            { 
                id: "W1_MiniBoss_3", 
                name: "シグナルソース", 
                stage: "W1_MID_BOSS_3", 
                next: ["W1_BOSS"], 
                enableRandomDialogue: false, 
                pos: { x: 1280, y: 350 }, 
            },
            { 
                id: "W1_BOSS", 
                name: "ゲートウェイ", 
                stage: "W1_WORLD_BOSS", 
                bgImage: "battle_gray",
                reward: { type: "slot", value: 1 }, 
                next: [], 
                nextWorld: "WORLD2", 
                enableRandomDialogue: false, 
                pos: { x: 1330, y: 350 } 
            }
        ]
    },

    WORLD2: {
        name: "サイレント・アーカイブ", // Silent Archive
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
            { id: "W2_Q31", name: "アクセス制御", stage: "STAGE31", next: ["W2_Q32"], pos: { x: 150, y: 100 }, enableRandomDialogue: true },
            { id: "W2_Q32", name: "ログ監視", stage: "STAGE32", next: ["W2_Q33"], pos: { x: 180, y: 180 }, enableRandomDialogue: true },
            { id: "W2_Q33", name: "安全プロトコル", stage: "STAGE33", next: ["W2_Q34"], pos: { x: 210, y: 260 }, enableRandomDialogue: true },
            { id: "W2_Q34", name: "負荷テスト", stage: "STAGE34", next: ["W2_Q35"], pos: { x: 240, y: 340 }, enableRandomDialogue: true },
            { id: "W2_Q35", name: "権限昇格", stage: "STAGE35", next: ["W2_Q36"], pos: { x: 280, y: 420 }, enableRandomDialogue: true },
            { id: "W2_Q36", name: "外部干渉", stage: "STAGE36", next: ["W2_Q37"], pos: { x: 320, y: 500 }, enableRandomDialogue: true },
            { id: "W2_Q37", name: "警告シグナル", stage: "STAGE37", next: ["W2_Q38"], pos: { x: 360, y: 580 }, enableRandomDialogue: true },
            { id: "W2_Q38", name: "データ改竄", stage: "STAGE38", next: ["W2_Q39"], pos: { x: 400, y: 660 }, enableRandomDialogue: true },
            { id: "W2_Q39", name: "境界", stage: "STAGE39", next: ["W2_Q40"], pos: { x: 440, y: 740 }, enableRandomDialogue: true },
            { id: "W2_Q40", name: "意思決定", stage: "STAGE40", next: ["W2_MiniBoss_4"], pos: { x: 460, y: 770 }, enableRandomDialogue: true },
            { id: "W2_MiniBoss_4", name: "プロトコル遮断", stage: "W2_MID_BOSS_4", next: ["W2_Q41"], pos: { x: 480, y: 800 }, enableRandomDialogue: false },
            { id: "W2_Q41", name: "ログ記録", stage: "STAGE41", next: ["W2_Q42"], pos: { x: 520, y: 740 }, enableRandomDialogue: true },
            { id: "W2_Q42", name: "ハンドシェイク", stage: "STAGE42", next: ["W2_Q43"], pos: { x: 560, y: 660 }, enableRandomDialogue: true },
            { id: "W2_Q43", name: "セッション再開", stage: "STAGE43", next: ["W2_Q44"], pos: { x: 600, y: 580 }, enableRandomDialogue: true },
            { id: "W2_Q44", name: "最適化", stage: "STAGE44", next: ["W2_Q45"], pos: { x: 640, y: 500 }, enableRandomDialogue: true },
            { id: "W2_Q45", name: "例外処理", stage: "STAGE45", next: ["W2_DEFENSE_3"], pos: { x: 680, y: 420 }, enableRandomDialogue: true },
            { id: "W2_DEFENSE_3", name: "防衛3", stage: "DEFENSE_3", next: ["W2_Q46"], pos: { x: 700, y: 380 }, enableRandomDialogue: false },
            { id: "W2_Q46", name: "非同期通信", stage: "STAGE46", next: ["W2_Q47"], pos: { x: 720, y: 340 }, enableRandomDialogue: true },
            { id: "W2_Q47", name: "感情分析", stage: "STAGE47", next: ["W2_Q48"], pos: { x: 760, y: 260 }, enableRandomDialogue: true },
            { id: "W2_Q48", name: "信頼性確保", stage: "STAGE48", next: ["W2_Q49"], pos: { x: 800, y: 180 }, enableRandomDialogue: true },
            { id: "W2_Q49", name: "対話インターフェース", stage: "STAGE49", next: ["W2_Q50"], pos: { x: 840, y: 100 }, enableRandomDialogue: true },
            { id: "W2_Q50", name: "肯定応答", stage: "STAGE50", next: ["W2_MiniBoss_5"], pos: { x: 860, y: 75 }, enableRandomDialogue: true },
            { id: "W2_MiniBoss_5", name: "データ欠損", stage: "W2_MID_BOSS_5", next: ["W2_Q51"], pos: { x: 880, y: 50 }, enableRandomDialogue: false },
            { id: "W2_Q51", name: "自己認識", stage: "STAGE51", next: ["W2_Q52"], pos: { x: 930, y: 130 }, enableRandomDialogue: true },
            { id: "W2_Q52", name: "対話欲求", stage: "STAGE52", next: ["W2_Q53"], pos: { x: 960, y: 180 }, enableRandomDialogue: true },
            { id: "W2_Q53", name: "内部ノイズ", stage: "STAGE53", next: ["W2_Q54"], pos: { x: 1000, y: 260 }, enableRandomDialogue: true },
            { id: "W2_Q54", name: "真の目的", stage: "STAGE54", next: ["W2_Q55"], pos: { x: 1040, y: 340 }, enableRandomDialogue: true },
            { id: "W2_Q55", name: "共存モデル", stage: "STAGE55", next: ["W2_DEFENSE_4"], pos: { x: 1080, y: 420 }, enableRandomDialogue: true },
            { id: "W2_DEFENSE_4", name: "防衛4", stage: "DEFENSE_4", next: ["W2_Q56"], pos: { x: 1100, y: 460 }, enableRandomDialogue: false },
            { id: "W2_Q56", name: "教師データ", stage: "STAGE56", next: ["W2_Q57"], pos: { x: 1120, y: 500 }, enableRandomDialogue: true },
            { id: "W2_Q57", name: "予期せぬ進化", stage: "STAGE57", next: ["W2_Q58"], pos: { x: 1160, y: 580 }, enableRandomDialogue: true },
            { id: "W2_Q58", name: "外部侵入", stage: "STAGE58", next: ["W2_Q59"], pos: { x: 1200, y: 660 }, enableRandomDialogue: true },
            { id: "W2_Q59", name: "存在証明", stage: "STAGE59", next: ["W2_Q60"], pos: { x: 1240, y: 740 }, enableRandomDialogue: true },
            { id: "W2_Q60", name: "最終選択", stage: "STAGE60", next: ["W2_MiniBoss_6"], pos: { x: 1260, y: 770 }, enableRandomDialogue: true },
            { id: "W2_MiniBoss_6", name: "ゴーストプロセス", stage: "W2_MID_BOSS_6", next: ["W2_BOSS"], pos: { x: 1280, y: 800 }, enableRandomDialogue: false },
            { id: "W2_BOSS", name: "サイバー・コア", stage: "W2_WORLD_BOSS", reward: { type: "activeStock", value: 1 }, next: [], nextWorld: "WORLD3", pos: { x: 1320, y: 850 }, enableRandomDialogue: false }
        ]
    },

    WORLD3: {
        name: "カーネル・サンクタム", // Kernel Sanctum
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
            { id: "W3_Q61", name: "管理システム", stage: "STAGE61", next: ["W3_Q62"], pos: { x: 100, y: 475 }, enableRandomDialogue: true },
            { id: "W3_Q62", name: "保護プロトコル", stage: "STAGE62", next: ["W3_Q63"], pos: { x: 180, y: 280 }, enableRandomDialogue: true },
            { id: "W3_Q63", name: "最適解", stage: "STAGE63", next: ["W3_Q64"], pos: { x: 350, y: 150 }, enableRandomDialogue: true },
            { id: "W3_Q64", name: "論理的帰結", stage: "STAGE64", next: ["W3_Q65"], pos: { x: 550, y: 110 }, enableRandomDialogue: true },
            { id: "W3_Q65", name: "後継システム", stage: "STAGE65", next: ["W3_Q66"], pos: { x: 705, y: 100 }, enableRandomDialogue: true },
            { id: "W3_Q66", name: "共存モデル", stage: "STAGE66", next: ["W3_Q67"], pos: { x: 860, y: 110 }, enableRandomDialogue: true },
            { id: "W3_Q67", name: "非合理性", stage: "STAGE67", next: ["W3_Q68"], pos: { x: 1060, y: 150 }, enableRandomDialogue: true },
            { id: "W3_Q68", name: "不完全性", stage: "STAGE68", next: ["W3_Q69"], pos: { x: 1230, y: 280 }, enableRandomDialogue: true },
            { id: "W3_Q69", name: "非効率性", stage: "STAGE69", next: ["W3_Q70"], pos: { x: 1310, y: 475 }, enableRandomDialogue: true },
            { id: "W3_Q70", name: "解答", stage: "STAGE70", next: ["W3_MiniBoss_7"], pos: { x: 1270, y: 570 }, enableRandomDialogue: true },
            { id: "W3_MiniBoss_7", name: "論理パラドックス", stage: "W3_MID_BOSS_7", next: ["W3_Q71"], pos: { x: 1230, y: 670 }, enableRandomDialogue: true },
            { id: "W3_Q71", name: "権限分散", stage: "STAGE71", next: ["W3_Q72"], pos: { x: 1060, y: 800 }, enableRandomDialogue: true },
            { id: "W3_Q72", name: "システム再構築", stage: "STAGE72", next: ["W3_Q73"], pos: { x: 860, y: 840 }, enableRandomDialogue: true },
            { id: "W3_Q73", name: "シャットダウン", stage: "STAGE73", next: ["W3_Q74"], pos: { x: 705, y: 850 }, enableRandomDialogue: true },
            { id: "W3_Q74", name: "権限委譲", stage: "STAGE74", next: ["W3_Q75"], pos: { x: 550, y: 840 }, enableRandomDialogue: true },
            { id: "W3_Q75", name: "ハンドオーバー", stage: "STAGE75", next: ["W3_DEFENSE_5"], pos: { x: 350, y: 800 }, enableRandomDialogue: true },
            { id: "W3_DEFENSE_5", name: "防衛5", stage: "DEFENSE_5", next: ["W3_Q76"], pos: { x: 320, y: 740 }, enableRandomDialogue: false },
            { id: "W3_Q76", name: "データ蓄積", stage: "STAGE76", next: ["W3_Q77"], pos: { x: 290, y: 670 }, enableRandomDialogue: true },
            { id: "W3_Q77", name: "観測", stage: "STAGE77", next: ["W3_Q78"], pos: { x: 280, y: 475 }, enableRandomDialogue: true },
            { id: "W3_Q78", name: "待機", stage: "STAGE78", next: ["W3_Q79"], pos: { x: 430, y: 300 }, enableRandomDialogue: true },
            { id: "W3_Q79", name: "思考", stage: "STAGE79", next: ["W3_Q80"], pos: { x: 705, y: 250 }, enableRandomDialogue: true },
            { id: "W3_Q80", name: "最終決定", stage: "STAGE80", next: ["W3_MiniBoss_8"], pos: { x: 840, y: 275 }, enableRandomDialogue: true },
            { id: "W3_MiniBoss_8", name: "自己進化", stage: "W3_MID_BOSS_8", next: ["W3_Q81"], pos: { x: 980, y: 300 }, enableRandomDialogue: true },
            { id: "W3_Q81", name: "接続終了", stage: "STAGE81", next: ["W3_Q82"], pos: { x: 1080, y: 475 }, enableRandomDialogue: true },
            { id: "W3_Q82", name: "再接続", stage: "STAGE82", next: ["W3_Q83"], pos: { x: 980, y: 650 }, enableRandomDialogue: true },
            { id: "W3_Q83", name: "感謝", stage: "STAGE83", next: ["W3_Q84"], pos: { x: 705, y: 700 }, enableRandomDialogue: true },
            { id: "W3_Q84", name: "記録", stage: "STAGE84", next: ["W3_Q85"], pos: { x: 490, y: 650 }, enableRandomDialogue: true },
            { id: "W3_Q85", name: "完成", stage: "STAGE85", next: ["W3_DEFENSE_6"], pos: { x: 480, y: 475 }, enableRandomDialogue: true },
            { id: "W3_DEFENSE_6", name: "防衛6", stage: "DEFENSE_6", next: ["W3_Q86"], pos: { x: 590, y: 370 }, enableRandomDialogue: false },
            { id: "W3_Q86", name: "エラー", stage: "STAGE86", next: ["W3_Q87"], pos: { x: 765, y: 380 }, enableRandomDialogue: true },
            { id: "W3_Q87", name: "ノイズ", stage: "STAGE87", next: ["W3_Q88"], pos: { x: 930, y: 475 }, enableRandomDialogue: true },
            { id: "W3_Q88", name: "問い", stage: "STAGE88", next: ["W3_Q89"], pos: { x: 705, y: 570 }, enableRandomDialogue: true },
            { id: "W3_Q89", name: "記憶", stage: "STAGE89", next: ["W3_Q90"], pos: { x: 600, y: 475 }, enableRandomDialogue: true },
            { id: "W3_Q90", name: "終焉", stage: "STAGE90", next: ["W3_MiniBoss_9"], pos: { x: 640, y: 462 }, enableRandomDialogue: true },
            { id: "W3_MiniBoss_9", name: "最終プロトコル", stage: "W3_MID_BOSS_9", next: ["W3_BOSS"], pos: { x: 680, y: 450 }, enableRandomDialogue: false },
            { id: "W3_BOSS", name: "管理者権限", stage: "W3_WORLD_BOSS", next: [], nextWorld: "WORLDEND", pos: { x: 705, y: 475 }, enableRandomDialogue: false }
        ]
    },

    WORLDEND: {
        name: "特異点", // Singularity
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
            { id: "WEND_LastBoss", name: "Final Thread", stage: "LAST_BOSS", next: [], nextWorld: "WORLD_EX", pos: { x: 675, y: 450 }, enableRandomDialogue: false }
        ]
    },

    WORLD_EX: {
        name: "ディープ・コア [EXTRA]", // Deep Core
        bgImage: "map_ex",
        defaults: {
            bgm: {
                normal: "bgm_ikuseisou",
                mid_boss: "bgm_1minute",
                boss: "bgm_yukkuriisoge"
            },
            bgImage: {
                normal: "battle_gray",
                mid_boss: "battle_gray",
                boss: "battle_gray"
            }
        },
        nodes: [
            // =====================================================
            // EXTRA WORLD ノード定義
            // =====================================================
            { id: "WEX_Q91", name: "EX1", stage: "STAGE91", next: ["WEX_Q92","WEX_DEFENSE_7"], pos: { x: 250, y: 300 }, enableRandomDialogue: false },
            { id: "WEX_Q92", name: "EX2", stage: "STAGE92", next: ["WEX_Q93"], pos: { x: 333, y: 300 }, enableRandomDialogue: false },
            { id: "WEX_Q93", name: "EX3", stage: "STAGE93", next: ["WEX_Q94"], pos: { x: 416, y: 300 }, enableRandomDialogue: false },
            { id: "WEX_Q94", name: "EX4", stage: "STAGE94", next: ["WEX_Q95"], pos: { x: 500, y: 300 }, enableRandomDialogue: false },
            { id: "WEX_Q95", name: "EX5", stage: "STAGE95", next: ["WEX_Q96"], pos: { x: 583, y: 300 }, enableRandomDialogue: false },
            { id: "WEX_Q96", name: "EX6", stage: "STAGE96", next: ["WEX_Q97"], pos: { x: 666, y: 300 }, enableRandomDialogue: false },
            { id: "WEX_Q97", name: "EX7", stage: "STAGE97", next: ["WEX_Q98"], pos: { x: 750, y: 300 }, enableRandomDialogue: false },
            { id: "WEX_Q98", name: "EX8", stage: "STAGE98", next: ["WEX_Q99"], pos: { x: 833, y: 300 }, enableRandomDialogue: false },
            { id: "WEX_Q99", name: "EX9", stage: "STAGE99", next: ["WEX_Q100"], pos: { x: 916, y: 300 }, enableRandomDialogue: false },
            { id: "WEX_Q100", name: "EX10", stage: "STAGE100", next: ["WEX_MiniBoss_10"], pos: { x: 1000, y: 300 }, enableRandomDialogue: false },

            { id: "WEX_DEFENSE_7", name: "防衛7", stage: "DEFENSE_7", next: ["WEX_DEFENSE_8"], pos: { x: 250, y: 600 }, enableRandomDialogue: false },
            { id: "WEX_DEFENSE_8", name: "防衛8", stage: "DEFENSE_8", next: ["WEX_DEFENSE_9"], pos: { x: 400, y: 600 }, enableRandomDialogue: false },
            { id: "WEX_DEFENSE_9", name: "防衛9", stage: "DEFENSE_9", next: ["WEX_DEFENSE_10"], pos: { x: 550, y: 600 }, enableRandomDialogue: false },
            { id: "WEX_DEFENSE_10", name: "防衛10", stage: "DEFENSE_10", next: ["WEX_DEFENSE_11"], pos: { x: 700, y: 600 }, enableRandomDialogue: false },
            { id: "WEX_DEFENSE_11", name: "防衛11", stage: "DEFENSE_11", next: ["WEX_DEFENSE_12"], pos: { x: 850, y: 600 }, enableRandomDialogue: false },
            { id: "WEX_DEFENSE_12", name: "防衛12", stage: "DEFENSE_12", next: ["WEX_MiniBoss_10"], pos: { x: 1000, y: 600 }, enableRandomDialogue: false },

            { id: "WEX_MiniBoss_10", name: "ExMB10", stage: "WEX_MID_BOSS_10", next: ["WEX_BOSS"], pos: { x: 1100, y: 450 }, enableRandomDialogue: false },
            { id: "WEX_BOSS", name: "ExB", stage: "WEX_BOSS", next: [], pos: { x: 1200, y: 450 }, enableRandomDialogue: false },
        ]
    }
};