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
 *
 * @description
 * このオブジェクトに定義されていないキャラクター名も使用可能です。
 * 特に、以下の名前はシステム側で特別な挙動をします。
 * - **`？`**: 発言者が不明な場合に使用します。立ち絵は表示されません。
 * - **`SYSTEM`**: システムメッセージに使用します。立ち絵が表示されず、機械的なフォントと四角い会話枠の専用スタイルが適用されます。
 * - **`オペレーター`**: プレイヤーの発言として扱われます。立ち絵は表示されず、会話ログでは右側に表示されます。
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
 * @property {string} [dialogueId] - 各会話イベントのユニークなID。以下の命名規則に従います。
 *   - `prologue`: ゲーム開始時のプロローグ。
 *   - `{クエストID}_start`: クエスト開始時の会話。
 *   - `{クエストID}_end`: クエスト終了時の会話。
 *   - `true_ending_dialogue`: 真エンディングの会話。
 *   - その他、分岐先としてユニークなIDを自由に設定可能。
 *
 * @property {string} title - 会話のタイトル。ログ画面でチャプター名として表示されます。
 * @property {boolean} [isBranch=false] - `true`に設定すると、この会話データはログ画面のチャプターリストに表示されなくなります。選択肢からの分岐先など、メインストーリーラインではない会話に使用します。
 * @property {boolean} [showOnce=false] - `true`に設定すると、特定の条件下で会話の表示が一度きりになります。
 *   - **クエスト開始前 (`_start`) の会話**: クエストをクリアするまで表示され、クリア後は表示されなくなります。
 *   - **クエスト終了後 (`_end`) の会話**: クエストクリア後に一度だけ表示され、二度目以降は表示されなくなります。
 *   - `false`または未定義の場合は、常に表示されます。
 *
 * @property {Array<Object>} messages - 会話のセリフや選択肢を格納する配列。各要素はメッセージオブジェクトです。
 *
 * @typedef {Object} MessageObject
 * @property {string} character - 発言者名。`CHARACTERS`オブジェクトのキーと一致させる必要があります。"SYSTEM"や"？"も使用可能です。
 * @property {string} [expression] - キャラクターの表情。`CHARACTERS`オブジェクトの`images`内のキーと一致させます。省略した場合は "normal" が使用されます。
 * @property {string} text - セリフの本文。`\n` を使用することで、セリフ内で改行できます。
 * @property {string} [choiceId] - このメッセージに選択肢がある場合、その選択肢グループを識別するためのユニークなID。既読管理に使用されます。`choices`プロパティとセットで使います。
 * @property {Array<ChoiceObject>} [choices] - プレイヤーに提示する選択肢の配列。
 * 
 * @description
 * ### ログ画面での表示について
 * - プレイヤーが選択した選択肢は、ログ画面で「└「（選択肢のテキスト）」を選択」という形式で表示されます。
 * - 2階層目以降の選択肢は、親の選択肢テキストも表示され、インデントが深くなります。
 * - `response`で指定された応答メッセージは、選択肢の直後にキャラクターの吹き出しとして表示されます。
 * - `end: true`が設定された選択肢を選ぶと、ログに「--- 会話終了 ---」と表示され、その分岐がそこで終わったことが示されます。
 *
 *
 * @typedef {Object} ChoiceObject
 * @property {string} text - 選択肢のボタンに表示されるテキスト。
 * @property {MessageObject} [response] - この選択肢を選んだ直後に表示されるキャラクターの応答メッセージ。`nextId`と併用可能です。
 * @property {string} [nextId] - この選択肢を選んだ後に遷移する、別の会話データのID。`DIALOGUE_DATA`のトップレベルキーと一致させる必要があります。
 * @property {boolean} [end] - `true`に設定すると、この選択肢を選んだ時点で会話が終了し、完了コールバックが抑制されます。
 *
 * @example
 * "W1_Q1_start": {
 *   title: "チュートリアル１",
 *   messages: [
 *     { character: "ナビ", text: "準備はよろしいですか？" },
 *     {
 *       character: "ナビ",
 *       text: "選択してください。",
 *       choiceId: "W1_Q1_start_1",
 *       choices: [
 *         { text: "はい", response: { character: "ナビ", text: "素晴らしい！" }, nextId: "W1_Q1_mission_start" },
 *         { text: "いいえ", response: { character: "ナビ", text: "準備ができたら教えてください。" }, end: true }
 *       ]
 *     }
 *   ]
 * }
 */
/**
 * @typedef {Object} RandomDialogueMessage
 * @property {string} character - 発言者名。
 * @property {string} [expression] - キャラクターの表情。
 * @property {string} text - セリフの本文。
 */

/**
 * @typedef {Object} RandomDialogueCategory
 * @property {RandomDialogueMessage[]} pre - ミッション開始前に再生される可能性のある会話の配列。
 * @property {RandomDialogueMessage[]} post - ミッション終了後に再生される可能性のある会話の配列。
 */

/**
 * ステージごとのランダム会話データを定義します。
 * `startDialogue`で指定されたIDの会話が存在せず、かつ対象ステージで`enableRandomDialogue`がtrueの場合に、
 * このデータからランダムに会話が選ばれて再生されます。
 * これらの会話はログには記録されません。
 *
 * @type {Object.<string, RandomDialogueCategory>}
 * @property {string} '1-10' - ステージ番号1から10の範囲。
 */
export const RANDOM_DIALOGUES = {
    '0-3': {
        pre: [
            { character: "ナビ", text: "３オペレーター、準備はよろしいですか？気を引き締めていきましょう。" },
            { character: "オペレーター", text: "３いつでもどうぞ。腕が鳴るね。" }
        ],
        post: [
            { character: "ナビ", text: "３任務完了、お疲れ様でした。この調子でお願いします。" },
            { character: "オペレーター", text: "３ふぅ、一仕事終わりっと。" }
        ]
    },
    '4-6': {
        pre: [
            { character: "ナビ", text: "４この領域の汚染は拡大しているようです。注意してください。" },
            { character: "オペレーター", text: "４了解。少しずつ敵も手強くなってきたな。" }
        ],
        post: [
            { character: "ナビ", text: "４お見事です。確実にエリアを浄化できています。" },
            { character: "オペレーター", text: "４このくらい、朝飯前だよ。" }
        ]
    },
    '7-10': {
        pre: [
            { character: "ナビ", text: "７さらに深層へ。ここから先は未知の領域です。" },
            { character: "オペレーター", text: "７何が出てきても、やることは変わらないさ。" }
        ],
        post: [
            { character: "ナビ", text: "７素晴らしい腕前です。あなたのタイピングが、この世界の光になります。" },
            { character: "オペレーター", text: "７大げさだな。でも、悪い気はしないね。" }
        ]
    },
    // '11-20': {
    //     pre: [
    //         { character: "ナビ", text: "..." },
    //     ],
    //     post: [
    //         { character: "ナビ", text: "..." },
    //     ]
    // }
};

export const DIALOGUE_DATA = {
    "prologue": {
        title: "プロローグ",
        messages: [
            {
                character: "SYSTEM",
                text: ".....\n \nInitializing...\nSecure Channel Established.\nQuantum Signature Verified.\nLoading Core Interface...\n \n.....\n \nConnection Established.\nOperator Signature Detected.\nAuthentication in Progress...\n \n.....\n \nAuthentication Successful.\nWelcome, Operator."
            },
            {
                character: "？",
                text: "ようこそ。\nまずは、このゲームをダウンロードしてくれてありがとうございます。"
            },
            {
                character: "？",
                text: "あなたが起動したのは、一般公開用ゲームクライアント。"
            },
            {
                character: "？",
                text: "\n正式名称\n \nproject THREAD"
            },
            {
                character: "？",
                text: "わたしは、\nM.A.M.E\nMutual Adaptive Monitoring Entity\nProject THREADの管理AIです。\nあなたのナビを務めさせていただきます。"
            },
                        {
                character: "ナビ",
                text: "あなたは、正式にProject THREADのOperatorとして認証されました。"
            }
        ]
    },
    "W1_Q1_start": {
        title: "チュートリアル１",
        showOnce: false, // ★追加：クリア後は表示しない
        messages: [
            {
                character: "ナビ",
                text: "接続テストを開始します。"
            },
            {
                character: "オペレーター",
                text: "OK！"
            },
            {
                character: "ナビ",
                text: "了解しました。\nゲームについて説明します。"
            },
            {
                character: "ナビ",
                text: "文字列を持った敵が出現するので、すべての文字を入力して倒します。\n先頭の文字を入力すると、自動でロックオンします。\n先頭の文字が同じ場合は次の文字で判別します。"
            },
            {
                character: "ナビ",
                text: "別の敵を攻撃したい場合は、Unlockキーを入力し、ロックオンを解除してください。（settingでキー設定できます）\nその後、対象の敵の文字をタイピングしてください。"
            },
            {
                character: "ナビ",
                text: "一番近くの敵にロックオンしたい場合は、Auto Lockキーを入力してください。（settingでキー設定できます）"
            },
            {
                character: "ナビ",
                text: "ゲーム中に一時停止する場合は、Pauseキーを入力してください。（settingでキー設定できます。）"
            },
            {
                character: "ナビ",
                text: "では開始してください。\nよろしくお願いします。"
            },
            {
                character: "ナビ",
                text: "準備はよろしいですか？", // このメッセージに選択肢を追加
                choiceId: "W1_Q1_start_1", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "はい、準備OKです！", response: { character: "ナビ", expression: "smile", text: "素晴らしい意気込みです！" }, nextId: "W1_Q1_mission_start", end:true },
                    { text: "まだ心の準備が…", response: { character: "ナビ", expression: "sad", text: "そうですか…\n準備ができたら、いつでも声をかけてくださいね。" }, nextId: "W1_Q1_start_1"}
                ]
            },
        ]
    },
    "W1_Q1_mission_start": {
        isBranch: true, // ログ画面に表示しないためのフラグ
        messages: [
            { character: "ナビ", text: "それでは、ミッションを開始します。" }
        ]
    },
    "W1_Q1_start_1": {
        isBranch: true,
        messages: [
            { character: "ナビ", text: "というとでも思ったかこのやろう…\nゆるさん" },
            { character: "ナビ", text: "てすとてすと\nてすてすと" },
            { character: "ナビ", text: "てすとてすと\nてすてすと" },
            { character: "ナビ", text: "てすとてすと\nてすてすと" },
            { character: "ナビ", text: "てすとてすと\nてすてすと" },
            {
                character: "ナビ",
                text: "第二の選択肢",
                choiceId: "W1_Q1_start_2",
                choices: [
                    { text: "aaaaaaaaaa", response: { character: "ナビ", expression: "smile", text: "a----ppo--" } },
                    { text: "bbbbbbbbbb", response: { character: "ナビ", expression: "sad", text: "b---b-b-b-" },  }
                ]
            },
            { character: "ナビ", text: "というと\nゆるさん" },
            { character: "ナビ", text: "てすてす\nてすてす" },
        ]
    },
    "W1_Q1_end": {
        title: "初任務完了",
        showOnce: true, // ★追加：一度再生したら表示しない
        messages: [
            {
                character: "ナビ",
                text: "敵プログラムの排除を確認。\n初めてのミッションお疲れ様でした。"
            },
            {
                character: "ナビ",
                text: "素晴らしい腕前です、オペレーター。"
            },
            {
                character: "SYSTEM",
                text: "Project THREAD\n \nSynchronization\n■□□□□□□□□□□ 2.4%\nSystem Stability\n84%"
            },
            {
                character: "オペレーター",
                text: "？"
            },
            {
                character: "ナビ",
                text: "オペレーターにはまだ開示できない情報です。\nゲームを進めていくことを推奨します。"
            },
            {
                character: "ナビ",
                text: "よろしくお願いします。"
            },
                        {
                character: "ナビ",
                text: "準備はよろしいですか？", // このメッセージに選択肢を追加
                choiceId: "W1_Q1_end_1", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "はい、準備OKです！", response: { character: "ナビ", expression: "smile", text: "素晴らしい意気込みです！" }, end: true },
                    { text: "まだ心の準備が…", response: { character: "ナビ", expression: "sad", text: "そうですか…\n準備ができたら、いつでも声をかけてくださいね。" }, end: true }
                ]
            },
            { character: "ナビ", text: "というとでも思ったかこのやろう…\nゆるさん" }, 
            { character: "ナビ", text: "てすとてすと\nてすてすと" }, 
            {
                character: "ナビ",
                text: "第二の選択肢", // このメッセージに選択肢を追加
                choiceId: "W1_Q1_end_2", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "aaaaaaaaaa", response: { character: "ナビ", expression: "smile", text: "a----ppo--" }, end: true },
                    { text: "bbbbbbbbbb", response: { character: "ナビ", expression: "sad", text: "b---b-b-b-" }, end: true }
                ]
            },
            { character: "ナビ", text: "というと\nゆるさん" }, 
            { character: "ナビ", text: "てすてす\nてすてす" }, 

        ]
    },

    "W1_Q2_start": {
        title: "チュートリアル２",
        showOnce: true,
        messages: [
            {
                character: "ナビ",
                text: "ミッションのパターンについて説明します。"
            },
            {
                character: "ナビ",
                text: "ミッションには複数の種類があり、\nこの世界を構築する際（「NEW GAME」で始めた時）にランダムで決定されます。"
            },
            {
                character: "ナビ",
                expression: "smile",
                text: "基本的に、10ステージごとに敵の強さは上昇していきます。"
            },
            {
                character: "ナビ",
                expression: "smile",
                text: "そして、ステージ数の１桁の数字が大きいほどミッションの難度が難しい傾向があります。"
            },
            {
                character: "ナビ",
                expression: "smile",
                text: "ではミッションを開始します。"
            },
        ]
    },

    //【サンプル2】中ボス戦前の会話
    "W1_MiniBoss_1_start": {
        title: "異常信号",
        showOnce: true,
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
        showOnce: true,
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
        showOnce: true,
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
        showOnce: true,
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