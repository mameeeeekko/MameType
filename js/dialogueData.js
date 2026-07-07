// dialogueData.js

export const DIALOGUE_DATA = {
    "prologue": {
        title: "プロローグ",
        messages: [
            {
                character: "ナビ",
                text: "聞こえますか、オペレーター？\nこの世界は汚染されたデータに侵食され、崩壊の危機に瀕しています。"
            },
            {
                character: "オペレーター",
                text: "......。"
            },
            {
                character: "ナビ",
                text: "あなたのタイピングスキルが、この世界を浄化する唯一の希望です。\nこれは単なるゲームではありません。あなたのキー入力が、未来を紡ぎます。"
            },
            {
                character: "オペレーター",
                text: "了解した。\n始めよう。"
            }
        ]
    },
    "W1_Q1_start": {
        title: "最初の接続",
        messages: [
            {
                character: "ナビ",
                // icon: "./assets/pic/navi_icon.png",
                text: "接続テストを開始します。\n聞こえますか、オペレーター？"
            },
            {
                character: "オペレーター",
                // icon: "./assets/pic/player_icon.png",
                text: "こちらオペレーター。クリアに聞こえる。"
            },
            {
                character: "ナビ",
                // icon: "./assets/pic/navi_icon.png",
                text: "了解しました。これよりシステム内部の汚染区域へ侵入します。\n敵性プログラムの排除をお願いします。"
            }
        ]
    },
    // --- 以下、会話データのサンプルです ---

    //【サンプル1】クエストクリア後の会話
    // キーを「(クエストID)_end」のようにすると、クリア後イベントとして設定できます。（別途実装が必要）
    "W1_Q1_end": {
        title: "初任務完了",
        messages: [
            {
                character: "ナビ",
                // icon: "./assets/pic/navi_icon.png",
                text: "汚染プログラムの排除を確認。素晴らしい腕前です、オペレーター。"
            },
            {
                character: "オペレーター",
                // icon: "./assets/pic/player_icon.png",
                text: "これくらいは当然だ。次の目標は？"
            }
        ]
    },

    //【サンプル2】中ボス戦前の会話
    "W1_MiniBoss_1_start": {
        title: "異常信号",
        messages: [
            {
                character: "ナビ",
                // icon: "./assets/pic/navi_icon.png",
                text: "警告。前方に強力なエネルギー反応を検知。\n通常個体ではありません、注意してください。"
            },
            {
                character: "オペレーター",
                // icon: "./assets/pic/player_icon.png",
                text: "中ボスクラスか…上等だ。腕が鳴る。"
            }
        ]
    },

    //【サンプル3】ワールドボス戦前の会話
    "W1_BOSS_start": {
        title: "ゲートキーパー",
        messages: [
            {
                character: "ナビ",
                // icon: "./assets/pic/navi_icon.png",
                text: "このエリアの汚染源、ゲートキーパーです。\n非常に強力な防御壁を展開しています。総力戦で挑みましょう。"
            },
            {
                character: "オペレーター",
                // icon: "./assets/pic/player_icon.png",
                text: "了解。システムのコアへ進むためにも、ここは突破する。"
            }
        ]
    },

        //【サンプル3】lastboss前の会話
    "WEND_LastBoss_start": {
        title: "最終決戦",
        messages: [
            {
                character: "ナビ",
                // icon: "./assets/pic/navi_icon.png",
                text: "ラスボス\nラスボス前の会話です。"
            },
            {
                character: "オペレーター",
                // icon: "./assets/pic/player_icon.png",
                text: "了解。システムのコアへ進むためにも、ここは突破する。"
            }
        ]
    },

    "WEND_LastBoss_end": {
        title: "the end",
        messages: [
            {
                character: "ナビ",
                // icon: "./assets/pic/navi_icon.png",
                text: "おわり"
            },
            {
                character: "オペレーター",
                // icon: "./assets/pic/player_icon.png",
                text: "おわた"
            }
        ]
    },


    "true_ending_dialogue": {
        title: "エピローグ",
        messages: [
            {
                character: "ナビ",
                text: "やりましたね、オペレーター。\n全ての汚染が浄化されました。"
            },
            {
                character: "オペレーター",
                text: "ああ。これでこの世界も平和になるだろう。"
            },
            {
                character: "ナビ",
                text: "あなたのタイピングが、この世界を救ったのです。\n本当に、ありがとうございました。"
            }
        ]
    },
    // 他の会話データをここに追加
};