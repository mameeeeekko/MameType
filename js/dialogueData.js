// dialogueData.js

/**
 * @file ゲーム内で使用されるキャラクター情報と会話データを定義します。
 */

/**
 * キャラクターの基本情報を定義します。
 * `dialogue.js` はこの定義を元に、キャラクターの立ち絵や表示位置を制御します。
 *
 * @type {Object.<string, {
 *   name: string,
 *   position: 'left'|'right',
 *   images?: Object.<string, string>
 * }>}
 *
 * @property {string} name - キャラクター名。`DIALOGUE_DATA`の`character`プロパティと一致させる必要があります。
 * @property {'left'|'right'} position - 立ち絵の表示位置。
 * @property {Object.<string, string>} [images] - 表情ごとの画像パスを格納するオブジェクト。
 *   - キー (例: "normal", "smile") は、`DIALOGUE_DATA`の`expression`プロパティに対応します。
 *   - オペレーターのように立ち絵を表示しないキャラクターは、このプロパティを省略できます。
 */
// ★ MODIFIED: アイコン画像への参照を追加
export const CHARACTERS = {
    "ナビ": {
        name: "ナビ",
        position: "left",
        images: {
            normal: "navi_normal",
            smile: "navi_smile",
            sad: "navi_sad",
            angry: "navi_angry",
            surprised: "navi_surprised",
        },
        icon: "navi_normal" // デフォルトのアイコン画像キー
    },
    "オペレーター": {
        name: "オペレーター",
        position: "right",
        // アイコンを表示しないため、iconプロパティは不要
    }
};

/**
 * ゲーム内の会話イベントデータを定義します。
 *
 * @type {Object.<string, {
 *   title: string,
 *   messages: Array<{
 *     character: string,
 *     expression?: string,
 *     text: string
 *   }>
 * }>}
 *
 * @property {string} dialogueId - 各会話イベントのユニークなID。以下の命名規則に従います。
 *   - `prologue`: ゲーム開始時のプロローグ。
 *   - `{クエストID}_start`: クエスト開始時の会話。
 *   - `{クエストID}_end`: クエスト終了時の会話。
 *   - `true_ending_dialogue`: 真エンディングの会話。
 *
 * @property {string} title - 会話のタイトル。ログ画面でチャプター名として表示されます。
 *
 * @property {Array} messages - 会話のセリフを格納する配列。
 * @property {string} messages.character - 発言者名。`CHARACTERS`オブジェクトのキーと一致させる必要があります。
 * @property {string} [messages.expression] - キャラクターの表情。`CHARACTERS`オブジェクトの`images`内のキーと一致させます。省略した場合は "normal" が使用されます。
 * @property {string} messages.text - セリフの本文。`\n` を使用することで、セリフ内で改行できます。
 */
export const DIALOGUE_DATA = {
    "prologue": {
        title: "プロローグ",
        messages: [
            {
                character: "？",
                text: "聞こえますか、オペレーター？\nこの世界は汚染されたデータに侵食され、崩壊の危機に瀕しています。"
            },
            {
                character: "オペレーター",
                text: "......。"
            },
            {
                character: "ナビ",
                expression: "sad",
                text: "あなたのタイピングスキルが、この世界を浄化する唯一の希望です。\nこれは単なるゲームではありません。あなたのキー入力が、未来を紡ぎます。"
            },
            {
                character: "オペレーター",
                text: "了解した。\n始めよう。"
            },
            {
                character: "ナビ",
                expression: "smile",
                text: "test\nこれは単なるゲームではありません。あなたのキー入力が、未来を紡ぎます。"
            },
            {
                character: "ナビ",
                expression: "surprised",
                text: "testsup\nこれは単なるゲームではありません。あなたのキー入力が、未来を紡ぎます。"
            },
            {
                character: "ナビ",
                expression: "angry",
                text: "testa\nこれは単なるゲームではありません。あなたのキー入力が、未来を紡ぎます。"
            },
        ]
    },
    "W1_Q1_start": {
        title: "最初の接続",
        messages: [
            {
                character: "ナビ",
                expression: "normal",
                text: "接続テストを開始します。\n聞こえますか、オペレーター？"
            },
            {
                character: "オペレーター",
                expression: "normal",
                text: "こちらオペレーター。クリアに聞こえる。"
            },
            {
                character: "ナビ",
                expression: "smile",
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