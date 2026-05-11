// questMap.js

// =====================================================
// name  ノードに表示する名前
// reward 
//  type: slot スロット追加 
// =====================================================

export const QUEST_MAP = {
    WORLD1: {
        name: "はじまりの森",
        nodes: [
            {
                id: "Q1",
                name: "スライム討伐",
                stage: "STAGE1",
                next: ["Q2"],
                pos: { x: 100, y: 200 }
            },
            {
                id: "Q2",
                name: "森の奥へ",
                stage: "STAGE2",
                next: ["Q3", "Q4"], // 分岐
                pos: { x: 250, y: 150 }
            },
            {
                id: "Q3",
                name: "ボス戦",
                stage: "STAGE3",
                next: ["Q5"],
                pos: { x: 400, y: 100 },
                reward: {
                    type: "slot",
                    value: 1
                }
            },
            {
                id: "Q4",
                name: "ボス戦2",
                stage: "STAGE3",
                next: [],
                pos: { x: 400, y: 200 }
            },  
            {
                id: "Q5",
                name: "test1",
                stage: "STAGE3",
                next: ["Q6"],
                pos: { x: 550, y: 50 }
            },
            {
                id: "Q6",
                name: "test2",
                stage: "STAGE3",
                next: [],
                pos: { x: 650, y: 50 }
            }
            
        ]
    }
};