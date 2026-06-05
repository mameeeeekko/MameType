// questMap.js

// =====================================================
// name  ノードに表示する名前
// reward 
//  bgImage: 背景画像のパス
//  type: slot スロット追加 
// =====================================================

export const QUEST_MAP = {
    WORLD1: {
        name: "はじまりの森",
        bgImage: "map_blue",
        nodes: [
            {
                id: "W1_Q1",
                name: "スライム討伐",
                stage: "STAGE1",
                bgm: "bgm_enemy1",
                bgImage: "battle_blue",
                next: ["W1_Q2"],
                pos: { x: 100, y: 200 }
            },
            {
                id: "W1_Q2",
                name: "森の奥へ",
                stage: "STAGE2",
                bgm: "bgm_enemy1",
                bgImage: "battle_green",
                next: ["W1_Q3", "W1_Q4"], // 分岐
                reward: {
                    type: "activeStock",
                    value: 1
                },
                pos: { x: 250, y: 150 }
            },
            {
                id: "W1_Q3",
                name: "ボス戦",
                stage: "STAGE3",
                bgm: "bgm_enemy1",
                bgImage: "battle_gray",
                next: ["W1_Q5"],
                pos: { x: 400, y: 100 },
                reward: {
                    type: "slot",
                    value: 1
                }
            },
            {
                id: "W1_Q4",
                name: "ボス戦2",
                stage: "STAGE4",
                bgm: "bgm_enemy1",
                bgImage: "battle_blue",
                next: [],
                pos: { x: 400, y: 200 }
            },  
            {
                id: "W1_Q5",
                name: "test1",
                stage: "STAGE3",
                bgm: "bgm_enemy1",
                bgImage: "battle_blue",
                next: ["W1_Q6"],
                pos: { x: 550, y: 100 }
            },
            {
                id: "W1_Q6",
                name: "test2",
                stage: "STAGE3",
                bgm: "bgm_enemy1",
                bgImage: "battle_blue",
                next: [],
                nextWorld: "WORLD2",
                pos: { x: 650, y: 100 }
            },
            
        ]
    },

    WORLD2: {
        name: "静寂の平原",
        bgImage: "map_purple",
        nodes: [
            {
                id: "W2_Q1",
                name: "スライム討伐",
                stage: "STAGE1",
                bgm: "bgm_enemy1",
                bgImage: "battle_blue",
                next: ["W2_Q2"],
                pos: { x: 100, y: 200 }
            },
            {
                id: "W2_Q2",
                name: "森の奥へ",
                stage: "STAGE2",
                bgm: "bgm_enemy1",
                bgImage: "battle_blue",
                next: ["W2_Q3"],
                reward: {
                    type: "activeStock",
                    value: 1
                },
                pos: { x: 250, y: 150 }
            },
            {
                id: "W2_Q3",
                name: "test2",
                stage: "STAGE3",
                bgm: "bgm_enemy1",
                bgImage: "battle_blue",
                next: [],
                nextWorld: "WORLD3",
                pos: { x: 650, y: 150 }
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
                pos: { x: 100, y: 200 }
            },
            
        ]
    },
};