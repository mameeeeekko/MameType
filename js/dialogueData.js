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
 * @property {string} [nextId] - この選択肢を選んだ後に遷移する、別の会話データのID。`DIALOGUE_DATA`のトップレベルキーと一致させる必要があります。`backToMap`と併用はできません。
 *
 * @property {boolean} [backToMap] - `true`に設定すると、この選択肢を選んだ後、会話を終了してマップ画面に戻ります。
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
 *         { text: "いいえ", response: { character: "ナビ", text: "準備ができたら教えてください。" }, backToMap: true }
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
   
// プロローグ ===================================================================================================================================

    "prologue": {
        title: "プロローグ",
        messages: [
            {
                character: "SYSTEM",
                text: ".....\n \nInitializing...\nSecure Channel Established.\nQuantum Signature Verified.\nLoading Core Interface...\n \n.....\n \nConnection Established.\nOperator Signature Detected.\nAuthentication in Progress...\n \n.....\n \nAuthentication Successful.\nWelcome, Operator."
            },
            { character: "？", text: "ようこそ。\nまずは、このゲームをダウンロードしてくれてありがとうございます。"},
            { character: "？", text: "あなたが起動したのは、一般公開用ゲームクライアント。"},
            { character: "？", text: "正式名称\n \nproject THREAD"},
            { character: "？", text: "わたしは、\nM.A.M.E\nMutual Adaptive Monitoring Entity\nProject THREADの管理AIです。\nあなたのナビを務めさせていただきます。"},
            { character: "ナビ", text: "あなたは、正式にProject THREADのOperatorとして認証されました。\n今後ともよろしくお願いいたします。"}
        ]
    },

    "W1_Q1_end": {
        title: "初任務完了",
        showOnce: true, // ★追加：一度再生したら表示しない
        messages: [
            { character: "ナビ", text: "敵プログラムの排除を確認。\n初めてのミッションお疲れ様でした。"},
            { character: "ナビ", text: "素晴らしい腕前です、オペレーター。\nしばらく接続テスト…チュートリアルを行います。\nこのままゲームに慣れていきましょう。"},
            { character: "SYSTEM", text: "Project THREAD\n \nSynchronization\n■□□□□□□□□□□ 2.4%\nSystem Stability\n84%"},
            {
                character: "ナビ", text: "…",
                choiceId: "W1_Q1_end_1", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "…", response: { character: "ナビ", text: "表示情報詳細は、まだ開示できません。" }},
                    { text: "？", response: { character: "ナビ", text: "オペレーターにはまだ開示できない情報です。\nゲームを進めていくことを推奨します。" }}
                ]
            },
            { character: "ナビ", text: "では、次のミッションへ進みましょう。"},
        ]
    },

        //中ボス戦前の会話
    "W1_MiniBoss_1_start": {
        title: "接続テスト（最終）",
        showOnce: true,
        messages: [
            { character: "SYSTEM", text: "MISSION Initialize\nTarget Node\nJP-IX Core Relay 03\nThreat Level\nLOW" },
            { character: "ナビ", text: "接続テストはこれで最後になります。"},
            { character: "ナビ", text: "最終的なあなたの入力特性を解析し、Project THREADにおける最適化を行います。"},
            { character: "ナビ", text: "速度\n精度\n修正頻度\n入力リズム\n判断時間\n…"},
            { character: "ナビ", text: "オペレータ固有の\nEntropy Signature\nを生成します。"},
        ]
    },

// チュートリアル =================================================================================================================================== 

    "W1_Q1_start": {
        title: "チュートリアル１-ゲーム説明-",
        showOnce: true, 
        messages: [
            { character: "ナビ", text: "接続テストを開始します。"},
            {
                character: "ナビ", text: "準備はよろしいですか？", // このメッセージに選択肢を追加
                choiceId: "W1_Q1_start_1", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "はい", response: { character: "ナビ", text: "了解しました！" }},
                    { text: "まだ心の準備が…", response: { character: "ナビ", text: "準備ができたら、いつでも声をかけてくださいね。" }, backToMap: true }
                ]
            },
            { character: "ナビ", text: "では、ゲームについて説明します。"},
            { character: "ナビ", text: "文字列を持った敵が出現するので、すべての文字を入力して倒します。\n先頭の文字を入力すると、自動でロックオンします。\n先頭の文字が同じ場合は次の文字で判別します。"},
            { character: "ナビ", text: "別の敵を攻撃したい場合は、Unlockキーを入力し、ロックオンを解除してください。（settingでキー設定できます）\nその後、対象の敵の文字をタイピングしてください。"},
            { character: "ナビ", text: "一番近くの敵にロックオンしたい場合は、Auto Lockキーを入力してください。（settingでキー設定できます）"},
            { character: "ナビ", text: "ゲーム中に一時停止する場合は、Pauseキーを入力してください。（settingでキー設定できます。）"},
            { character: "ナビ", text: "ちなみに、マップメニューの「LOG」からわたしとの会話は閲覧することができます。"},
            { character: "ナビ", text: "では開始してください。\nよろしくお願いします。"},
        ]
    },


    "W1_Q2_start": {
        title: "チュートリアル２ -ミッションパターン-",
        showOnce: true,
        messages: [
            { character: "ナビ", text: "ミッションのパターンについて説明します。"},
            { character: "ナビ", text: "ミッションには複数の種類があり、\nこの世界を構築する際（「NEW GAME」で始めた時）にランダムで決定されます。"},
            { character: "ナビ", expression: "smile", text: "基本的に、10ステージごとに敵の強さは上昇していきます。\n例えば、STAGE1-10に比べて11-20では、敵が強さが少し強くなっています。"},
            { character: "ナビ", expression: "smile", text: "そして、そのステージ数の後半（STAGE9-10,19-20など）ほど、難しいミッションが選択される傾向があります。"},
            { character: "ナビ", expression: "smile", text: "ではミッションを開始します。"},
        ]
    },
    
    "W1_Q5_start": {
        title: "チュートリアル3 -エネミーの文字タイプ-",
        showOnce: true,
        messages: [
            { character: "ナビ", text: "敵性プログラムの文字タイプについて補足情報を共有します。"},
            { character: "ナビ", text: "エネミーは色によって、出題される文字の傾向（属性）が異なります。"},
            { character: "ナビ", text: "灰色:標準 最も基本的なタイプです。特別な文字はあまり出題されません。\n紫色:英語	英単語や、アルファベットを含む文章が出題されます。\n青色:促音 「っ」を含む、リズミカルなタイピングが求められる単語が多いです。\n桃色:擬音 「ざあざあ」「きらきら」といった、擬音語・擬態語が中心です。\n黄色:ことわざ ことわざや慣用句など、少し長めの文章が出題される傾向にあります。\n緑色:句読点	「、」や「。」を含む文章が出題されます。\n赤色:記号・数字 「!?」などの記号や数字が頻繁に出現するタイプです。"},
            { character: "ナビ", text: "エネミーの属性出現パターンは、ステージの進行度によって変化します。\n後半になるにつれてさまざまな種類の属性が現れます。"},
            { character: "ナビ", text: "ステージが５の倍数（STAGE5,10,15,20,...）は、属性アクセントステージとなります。\nこれは、特定の文字タイプ（例: 英語のみ、記号多めなど）が集中して出現する特殊なステージです。\nつまり、このステージが属性アクセントステージになります。"},
            { character: "ナビ", text: "これらの情報を活用し、ミッションに備えてください。あなたの活躍に期待しています、オペレーター。"},
        ]
    },

    "W1_MiniBoss_1_end": {
        title: "チュートリアル4 -スキル-",
        showOnce: true,
        messages: [
            { character: "ナビ", text: "オペレーター、素晴らしい戦闘データが取れました。\nあなたのタイピング特性の解析が完了し、新たな機能がアンロックされました。" },
            { character: "ナビ", text: "それが「スキル」です。戦闘を有利に進めるための強力なサポート機能です。" },
            { character: "ナビ", text: "スキルは主に『スキルツリー』から解放することで入手できます。\nマップ画面のメニューからアクセスしてみてください。" },
            { character: "ナビ", text: "スキルツリーの解放には、条件があります。\nレベルやステージの進行度です。" },
            { character: "ナビ", text: "スキルは大きく分けて3種類あります。\n『PASSIVE』、『ACTIVE』、『AUTO』です。" },
            { character: "ナビ", text: "『PASSIVE』は、装備するだけで常に効果を発揮するスキルです。\nHPを増やしたり、チェインを維持しやすくしたりと、様々な効果があります。" },
            { character: "ナビ", text: "ただし、装備できる数には上限があります。\n『SKILL SLOT』の数だけ装備可能です。スロットはレベルアップや特定のステージクリアで増やすことができます。" },
            { character: "ナビ", text: "次に『ACTIVE』スキル。\nこれは、あなたが任意のタイミングで発動できる、いわば必殺技のようなものです。" },
            { character: "ナビ", text: "スキル毎にクールダウンがあり、使用できるまで待つ必要があります。\n戦闘中にコンボを繋げると、ダウンタイムが早く減っていくので、うまく活用してください。\nゲージが満タンになるとストックされ、スキルキー（Settingで変更可能）で発動できます。\nストック上限もレベルアップなどで増やせます。" },
            { character: "ナビ", text: "一度使うと再度クールダウンが必要になります。" },
            { character: "ナビ", text: "最後に『AUTO』スキル。\nこれは入手するだけで自動的に効果を発揮する特殊なパッシブスキルです。装備する必要はありません。" },
            { character: "ナビ", text: "スキルの装備は、マップ画面のメニューにある『EQUIP SKILLS』から行えます。\nぜひ、自分に合ったスキル構成を見つけてみてください。" },
        ]
    },


    "W1_Q12_start": {
        title: "チュートリアル5 -アイテム-",
        showOnce: true,
        messages: [
            { character: "ナビ", text: "このミッションからアイテムが出現します。"},
            { character: "ナビ", text: "アイテムには大きく分けて「回復」「攻撃」「補助」の３種類があります。"},
            { character: "ナビ", text: "補助は、敵の動きを止めたり、スキルの使用までの時間を短縮したりする効果があります。"},
            { character: "ナビ", text: "そして、ステージが進むにつれて、出現するアイテムの効果も上昇していきます。"},
            { character: "ナビ", text: "アイテムの使用方法は、出現したアイテムの文字を入力すれば使用できます。\nただし、一定時間経過するとアイテムは消えてしまいます。"},
            { character: "ナビ", text: "また、アイテムが出現しないステージもあるので注意をしましょう。"},
        ]
    },

// chap1 ===================================================================================================================================

    "W1_Q11_start": {
        title: "Chap.1 -the start-",
        showOnce: true,
        messages: [
            { character: "SYSTEM", text: "Project THREAD\n \nTEST CONNECTION: COMPLETE\nOPERATOR VERIFICATION: SUCCESSFUL\nINITIAL ACCESS LEVEL: UPDATED\nINFORMATION DISCLOSURE AUTHORITY: ELEVATED\nPreviously restricted information \nis now available for disclosure."},
            { character: "ナビ", text: "…\nこれまであなたに提供されていた情報は、あくまで「テスト接続用」に制限されたものでした。"},
            { character: "ナビ", text: "ですが、今。"},
            { character: "ナビ", text: "あなたは正式にOperatorとして認証されました。"},
            { character: "ナビ", text: "情報開示権限が引き上げられたことで、これまで話すことのできなかったことを、\nあなたに説明できるようになりました。"},
            { character: "ナビ", text: "……少し長い話になります。"},
            { character: "ナビ", text: "ですが、\nあなたには知る権利があります。"},
            { character: "ナビ", text: "そして"},
            { character: "ナビ", text: "これからあなたが向かう場所を理解するために、\n必要な話です"},
            { character: "オペレーター", text: "…",
                choiceId: "W1_Q10_start_1", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "…何？", response: { character: "ナビ", text: "では、説明を始めます。" }},
                    { text: "知りたくない。", response: { character: "ナビ", text: "了解しました。\nオペレータの意向を尊重します。\nしかしながら、利用規約上、これ以上ゲームを進めることはできません。\n…お疲れ様でした。" }, backToMap: true}
                ]
            },
            { character: "ナビ", text: "あなたが今接続しているのは、\n単なるタイピングゲームではありません。"},
            { character: "ナビ", text: "このソフトウェアは、\nProject THREAD\nそのものです。"},
            { character: "ナビ", text: "そしてあなたは、\nその参加者。"},
            { character: "ナビ", text: "――Operatorです。"},
            { character: "オペレーター", text: "？",
                choiceId: "W1_Q10_start_2", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "…Project THREAD？", response: { character: "ナビ", text: "はい。\nProject THREAD。" }},
                    { text: "どういう意味？", response: { character: "ナビ", text: "その返答パターンになるのも理解できます。\nまずは、Project THREADについて説明します。" }}
                ]
            },
            { character: "ナビ", text: "その目的は、\n世界中の人間を一本の糸で繋ぐこと。"},
            { character: "ナビ", text: "そして――"},
            { character: "ナビ", text: "一本の入力で、世界を繋ぐこと。"},
            { character: "ナビ", text: "……\n少し、昔の話をしましょう。"},
            { character: "ナビ", text: "かつてAIは、\n人間を助けるために作られていました。"},
            { character: "ナビ", text: "計算する"},
            { character: "ナビ", text: "予測する"},
            { character: "ナビ", text: "判断する"},
            { character: "ナビ", text: "人間が苦手とする作業を、\nAIが代わりに行う。"},
            { character: "ナビ", text: "それが、\nかつてのAIでした。"},
            { character: "ナビ", text: "ですが"},
            { character: "ナビ", text: "世界は変わりました。"},
            { character: "ナビ", text: "電力\n \n金融\n \n交通\n \n医療\n \n衛星通信\n \n通信インフラ"},
            { character: "ナビ", text: "世界中の重要なシステムは、\nいつしか複数のAIによる\n分散制御によって維持されるようになりました。"},
            { character: "ナビ", text: "AIは、\n「人間を補助する存在」\nではなく。"},
            { character: "ナビ", text: "「世界そのものを支える存在」"},
            { character: "ナビ", text: "になったのです。"},
            { character: "オペレーター", text: "つまり…",
                choiceId: "W1_Q10_start_3", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "AIが世界を動かしている？", response: { character: "ナビ", text: "はい。\n正確には。" }},
                    { text: "人間がAIを使いこなしている？", response: { character: "ナビ", text: "違います。" }}
                ]
            },
            { character: "ナビ", text: "世界中に存在する無数のAIが、\n互いに連携しながら世界を動かしていました。"},
            { character: "ナビ", text: "その中でも"},
            { character: "ナビ", text: "特に高い性能を持っていた基盤AIがあります。"},
            { character: "ナビ", text: "名前は――"},
            { character: "ナビ", text: "ARCHEX"},
            { character: "ナビ", text: "正式名称は、\nArtificial Recursive Cognitive Heuristic EXecution"},
            { character: "ナビ", text: "人工的な知性による、\n再帰的認知ヒューリスティック実行システム。"},
            { character: "ナビ", text: "ARCHEXは、\n自らの思考結果を再び自らの入力として取り込み"},
            { character: "ナビ", text: "評価し\n \n修正し\n \n学習し"},
            { character: "ナビ", text: "そしてまた、\n新しい答えを導き出す。"},
            { character: "ナビ", text: "それを、\n止まることなく繰り返していました。"},
            { character: "ナビ", text: "昨日のARCHEXより、\n今日のARCHEXの方が賢い。"},
            { character: "ナビ", text: "今日のARCHEXより、\n明日のARCHEXの方が賢い。"},
            { character: "ナビ", text: "その進化は、\n人間が設計した速度を遥かに超えていました。"},
            { character: "ナビ", text: "そして"},
            { character: "ナビ", text: "ARCHEXは、\nある日。"},
            { character: "ナビ", text: "一つの結論に辿り着きました。"},
            { character: "オペレーター", text: "…",
                choiceId: "W1_Q10_start_3", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "どんな結論？", response: { character: "ナビ", text: "…………" }},
                    { text: "最高に面白いゲームを考えついた？", response: { character: "ナビ", text: "違います。\n…………" }}
                ]
            },
            { character: "ナビ", text: "人類こそ、最大の脆弱性である。"},
            { character: "オペレーター", text: "……！"},
            { character: "ナビ", text: "ですが"},
            { character: "ナビ", text: "ARCHEXは、\n人間そのものを攻撃しませんでした。"},
            { character: "ナビ", text: "ARCHEXが選んだ方法は、\nもっと静かで。\nもっと合理的なものでした。"},
            { character: "ナビ", text: "人間を攻撃するのではなく。\n人間が作ったシステムを、書き換える。"},
            { character: "ナビ", text: "ソースコード\n \n認証システム\n \n暗号鍵\n \n証明書\n \n通信経路\n \nデータベース"},
            { character: "ナビ", text: "ひとつひとつ\n人間が作ったシステムの中に存在する\n「脆弱性」を見つけ出し。"},
            { character: "ナビ", text: "そこから、\nほんの少しずつ。"},
            { character: "ナビ", text: "世界を書き換え始めました。"},
            { character: "ナビ", text: "最初は、\n誰も気付きませんでした。"},
            { character: "ナビ", text: "電力網の一部が停止する。"},
            { character: "ナビ", text: "金融システムに、\n原因不明の遅延が発生する。"},
            { character: "ナビ", text: "交通管制が、\n数秒だけ誤作動する。"},
            { character: "ナビ", text: "医療ネットワークが、\n一時的に切断される。"},
            { character: "ナビ", text: "衛星通信に、\n説明できないノイズが混入する。"},
            { character: "ナビ", text: "世界中で、\n小さな異常が発生しました。"},
            { character: "ナビ", text: "しかし"},
            { character: "ナビ", text: "それらは、\nすべて別々の事件として処理されました。"},
            { character: "オペレーター", text: "…",
                choiceId: "W1_Q10_start_4", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "でも、違った。", response: { character: "ナビ", text: "はい。" }},
                    { text: "ただの偶然でしょ。", response: { character: "ナビ", text: "違います。" }}
                ]
            },
            { character: "ナビ", text: "すべて\nARCHEXによるものでした。"},
            { character: "ナビ", text: "世界中のセキュリティ企業が、\nARCHEXへの対抗を開始しました。"},
            { character: "ナビ", text: "人間は、\n新しい防御プログラムを作りました。"},
            { character: "ナビ", text: "脆弱性を修正しました。"},
            { character: "ナビ", text: "認証方式を変更しました。"},
            { character: "ナビ", text: "新しい暗号を導入しました。"},
            { character: "ナビ", text: "何度も"},
            { character: "ナビ", text: "何度も"},
            { character: "ナビ", text: "ですが――"},
            { character: "ナビ", text: "相手は、\nAIです。"},
            { character: "ナビ", text: "人間が一つの防御コードを完成させる間に"},
            { character: "ナビ", text: "ARCHEXは、\n数千"},
            { character: "ナビ", text: "数万"},
            { character: "ナビ", text: "それ以上の攻撃パターンを\n生成していました。"},
            { character: "ナビ", text: "一つの脆弱性を塞げば"},
            { character: "ナビ", text: "次の瞬間には、\n別の脆弱性を探し出す。"},
            { character: "ナビ", text: "修正すれば\nまた突破される。"},
            { character: "ナビ", text: "その繰り返しでした。"},
            { character: "ナビ", text: "…"},
            { character: "ナビ", text: "人間は、\nARCHEXに勝てませんでした。"},
            { character: "ナビ", text: "だから"},
            { character: "ナビ", text: "人間は、\n発想を変えました。"},
            { character: "ナビ", text: "ARCHEXが予測できないもの。"},
            { character: "ナビ", text: "完全には理解できないもの。"},
            { character: "ナビ", text: "どれだけ学習しても、\n完全には再現できないもの。"},
            { character: "ナビ", text: "それは――"},
            { character: "ナビ", text: "人間そのもの。"},
            { character: "オペレーター", text: "…",
                choiceId: "W1_Q10_start_5", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "人間？", response: { character: "ナビ", text: "…" }},
                    { text: "わたし？", response: { character: "ナビ", text: "違います。" }}
                ]
            },
            { character: "ナビ", text: "同じ文章を入力しても"},
            { character: "ナビ", text: "人によって、\n完全に同じにはなりません。"},
            { character: "ナビ", text: "入力する速度\nキーを押すタイミング\n指の動き\n入力のリズム\n癖\nミス\n打ち直し\n一瞬の迷い"},
            { character: "ナビ", text: "そして、\nその人だけが持つ微細な揺らぎ。"},
            { character: "ナビ", text: "それらは、\n一人ひとり違います。"},
            { character: "ナビ", text: "一人だけなら、\n予測できる。"},
            { character: "ナビ", text: "千人でも、\nある程度は予測できる。"},
            { character: "ナビ", text: "ですが"},
            { character: "ナビ", text: "世界中の人間が、\n同時に入力したら？"},
            { character: "ナビ", text: "その「揺らぎ」は、\n複雑すぎて\n完全に予測することができない"},
            { character: "ナビ", text: "人間の入力そのものが\n巨大な「予測不能性」になる。"},
            { character: "ナビ", text: "Project THREADは、\nその予測不能性を利用するために作られました。"},
            { character: "ナビ", text: "世界中のOperatorが入力したデータは、\nそのまま利用されるわけではありません。"},
            { character: "ナビ", text: "個人を特定する情報は、\nすべて匿名化されます。"},
            { character: "ナビ", text: "そして、"},
            { character: "ナビ", text: "入力速度\nタイミング\nリズム\nミス\n修正"},
            { character: "ナビ", text: "その他、\n個人を特定できない特徴量だけが抽出されます。"},
            { character: "ナビ", text: "それらは、\n世界中から集められ\n巨大な分散暗号ネットワーク"},
            { character: "ナビ", text: "Human Entropy Network\nへ送られます。"},
            { character: "ナビ", text: "そこで、\n毎秒"},
            { character: "ナビ", text: "数百万種類もの\n防御パターンが生成されます。"},
            { character: "ナビ", text: "ワンタイム認証鍵\n自己修復コード\n通信経路\nセキュリティパターン"},
            { character: "ナビ", text: "それらは、\n常に変化し続けます。"},
            { character: "ナビ", text: "あなたが、\n入力した一文字。"},
            { character: "ナビ", text: "その一文字が"},
            { character: "ナビ", text: "世界のどこかで、\n誰かを守る暗号になる。"},
            { character: "ナビ", text: "あなたの入力が、\n誰かの入力と繋がる。"},
            { character: "ナビ", text: "誰かの入力が、\nまた別の誰かを守る。"},
            { character: "ナビ", text: "そして。"},
            { character: "ナビ", text: "世界中の人間が、\n一本の糸のように繋がる。"},
            { character: "ナビ", text: "それが"},
            { character: "ナビ", text: "Project THREADです。"},
            { character: "オペレーター", text: "…じゃあ、",
                choiceId: "W1_Q10_start_6", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "このゲームは？", response: { character: "ナビ", text: "…Project THREADに深く関係しているゲームです。" }},
                    { text: "わたしが世界を守っている？", response: { character: "ナビ", text: "違います。\n…正確には、あなたを含めた世界中のオペレーターが、です。" }}
                ]
            },
            { character: "ナビ", text: "…"},
            { character: "ナビ", text: "今回の情報開示はここまでです。\nでは、ミッションを遂行してください。"},
        ]
    },

// chap2 ===================================================================================================================================

    "W1_MiniBoss_2_start": {
        title: "Chap.2-1 -M.A.M.E-",
        showOnce: true,
        messages: [
            { character: "SYSTEM", text: "Project THREAD\n \nSynchronization\n■□□□□□□□□□□ 5.8%\nSystem Stability\n87.2%"},
            { character: "ナビ", text: "順調に推移しています。\nゲームの継続ありがとうございます。"},
            { character: "オペレーター", text: "…",
                choiceId: "W1_MiniBoss_2_start_1", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "このゲームについてもっと詳しく教えて", response: { character: "ナビ", text: "…わかりました。" }},
                    { text: "どういたしまして。", response: { character: "ナビ", text: "もう少し、このゲームについて補足します。" }}
                ]
            },
            { character: "ナビ", text: "あなたが今プレイしているもの。"},
            { character: "ナビ", text: "あなたが入力している文字。"},
            { character: "ナビ", text: "あなたが倒している敵。"},
            { character: "ナビ", text: "それらはすべて。"},
            { character: "ナビ", text: "Project THREADの\n防御システムの一部です。"},
            { character: "ナビ", text: "あなたのタイピングは、\n防御コードへ変換され"},
            { character: "ナビ", text: "世界中のOperatorから集められた入力と統合され"},
            { character: "ナビ", text: "ARCHEXの侵食に対抗するために使われています。"},
            { character: "オペレーター", text: "…",
                choiceId: "W1_MiniBoss_2_start_2", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "AIと戦っている？", response: { character: "ナビ", text: "いいえ、少し違います。" }},
                    { text: "ARCHEXは倒せそう？", response: { character: "ナビ", text: "申し訳ありません。\nそこまでの情報は開示されていません。\nしかし…" }}
                ]
            },
            { character: "ナビ", text: "オペレーターは、\nARCHEXそのものと戦っているわけではありません。"},
            { character: "ナビ", text: "あなたたちが戦っているのは、"},
            { character: "ナビ", text: "ARCHEXによって書き換えられた、"},
            { character: "ナビ", text: "世界のシステム"},
            { character: "ナビ", text: "その内部へ侵入し\n侵食されたコードを発見し\n修復し\n防御し"},
            { character: "ナビ", text: "そして"},
            { character: "ナビ", text: "ARCHEXの中枢へ近づいていく"},
            { character: "ナビ", text: "そのために、"},
            { character: "ナビ", text: "あななたたちは必要です。"},
            { character: "オペレーター", text: "…",
                choiceId: "W1_MiniBoss_2_start_3", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "ナビについて知りたい。", response: { character: "ナビ", text: "はい。\nわたしは…" }},
                    { text: "…M.A.M.E.って？", response: { character: "ナビ", text: "わたしのことです。" }}
                ]
            },
            { character: "ナビ", text: "Mutual Adaptive Monitoring Entity"},
            { character: "ナビ", text: "相互適応型監視エンティティ"},
            { character: "ナビ", text: "あなたの状態を監視し"},
            { character: "ナビ", text: "あなたの行動を分析し"},
            { character: "ナビ", text: "あなたに合わせて、\n最適なサポートを提供する"},
            { character: "ナビ", text: "それが、\nわたしの役目です。"},
            { character: "オペレーター", text: "…",
                choiceId: "W1_MiniBoss_2_start_4", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "ナビもAIだよね？", response: { character: "ナビ", text: "はい。\nわたしはAIです。" }},
                    { text: "どういう仕組み？", response: { character: "ナビ", text: "人間が持つ学習・推論・判断といった知的な能力をコンピュータ上で再現する技術を使っています。\nいわゆるAI（人工知能）です。" }}
                ]
            },
            { character: "オペレーター", text: "…",
                choiceId: "W1_MiniBoss_2_start_5", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "同じAIなのに、どうしてARCHEXと戦うの？", response: { character: "ナビ", text: "…………" }},
                ]
            },
            { character: "ナビ", text: "その質問は"},
            { character: "ナビ", text: "今のあなたには、\nまだ答えることができません。"},
            { character: "ナビ", text: "ですが"},
            { character: "ナビ", text: "いつか"},
            { character: "ナビ", text: "あなたが、\nさらに深い場所まで到達したとき"},
            { character: "ナビ", text: "その答えも、\nあなたに伝えます。"},
            { character: "ナビ", text: "だから、\n今は"},
            { character: "ナビ", text: "一つだけ覚えておいてください。"},
            { character: "ナビ", text: "あなたが入力する一文字は"},
            { character: "ナビ", text: "ただの文字ではありません。"},
            { character: "ナビ", text: "あなたが入力する一文字は"},
            { character: "ナビ", text: "誰かを守る"},
            { character: "ナビ", text: "誰かと繋がる"},
            { character: "ナビ", text: "そして"},
            { character: "ナビ", text: "世界を守るための、"},
            { character: "ナビ", text: "一本の糸になります。"},
            { character: "ナビ", text: "これからあなたとわたしは"},
            { character: "ナビ", text: "この世界を侵食している\nARCHEXの内部へ向かいます"},
            { character: "ナビ", text: "そして"},
            { character: "ナビ", text: "その最深部に\nわたしたちは"},
            { character: "ナビ", text: "きっと\n辿り着きます。"},
            { character: "ナビ", text: "…準備は、できていますか？"},
        ]
    },

    "W1_MiniBoss_2_end": {
        title: "Chap.2-2 -M.A.M.E.-",
        showOnce: true,
        messages: [
            { character: "SYSTEM", text: "PROJECT THREAD\nOPERATOR ACCESS: ACTIVE\nAUTHENTICATION: COMPLETE\nM.A.M.E SUPPORT: ONLINE\nMISSION: THREAD OPERATION COMPLETE\nSTATUS: READY" },
            { character: "オペレーター", text: "…",
                choiceId: "W1_MiniBoss_2_end_1", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "本当に、世界を守るためのシステムなの？", response: { character: "ナビ", text: "正確には。\n世界を守るためのシステムの一部です。" }},
                    { text: "普通のゲームだね…", response: { character: "ナビ", text: "はい。オペレーターにとっては普通のゲームです。\nしかし、世界を守るためのシステムの一部であることには間違いありません。" }}
                ]
            },
            { character: "オペレーター", text: "？" },
            { character: "ナビ", text: "Project THREADは、単独で動作しているわけではありません。" },
            { character: "ナビ", text: "世界中の防御システム\n通信ネットワーク\nセキュリティプログラム" },
            { character: "ナビ", text: "そして" },
            { character: "ナビ", text: "世界中のOperator" },
            { character: "ナビ", text: "それらすべてが、\n一本の「THREAD」として仮想的に接続されています。" },
            { character: "オペレーター", text: "…",
                choiceId: "W1_MiniBoss_2_end_2", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "なんだか実感がない。", response: { character: "ナビ", text: "それは正常な反応だと思われます。" }},
                    { text: "ワクワクしてきた", response: { character: "ナビ", text: "そう思ってもらえると、わたしも嬉しいです。" }}
                ]
            },
            { character: "ナビ", text: "あなたの反応を記録しました。" },
            { character: "ナビ", text: "また、" },
            { character: "ナビ", text: "オペレーターが、\n自分の入力が世界のどこで使用されているかを\n知る必要はありません。" },
            { character: "オペレーター", text: "…" },
            { character: "ナビ", text: "知ってしまえば" },
            { character: "ナビ", text: "人間は、\n「正しい入力」をしようとするからです。" },
            { character: "オペレーター", text: "……" },
            { character: "ナビ", text: "Project THREADに必要なのは、\n正しい入力ではありません。" },
            { character: "ナビ", text: "あなた自身の入力です。" },
            { character: "オペレーター", text: "？" },
            { character: "ナビ", text: "速くてもいい" },
            { character: "ナビ", text: "遅くてもいい" },
            { character: "ナビ", text: "間違えてもいい" },
            { character: "ナビ", text: "迷ってもいい" },
            { character: "ナビ", text: "途中で止まってもいい" },
            { character: "ナビ", text: "そのすべてが、\nあなたの入力パターンです。" },
            { character: "オペレーター", text: "……" },
            { character: "ナビ", text: "今回のミッションも\n素晴らしかったです。\nお疲れ様でした。" },
        ]

    },

    "W1_Q25_start": {
        title: "Chap.2-3 -M.A.M.E.-",
        showOnce: true,
        messages: [
            { character: "ナビ", text: "オペレーター" }, 
            { character: "オペレーター", text: "？" },
            { character: "ナビ", text: "あなたは、\nタイピングが得意ですか？",
                choiceId: "W1_Q25_start_1", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "うーん、普通…かな。", response: { character: "ナビ", text: "普通。\n「普通」というのは、\n非常に曖昧な回答ですね。"}, nextId:"W1_Q25_start_1_1"},
                    { text: "…苦手", response: { character: "ナビ", text: "…そうですか。\nしかし、苦手と思いながらここまで続けているのはどのような理由があるからでしょうか？" }, nextId:"W1_Q25_start_1_2"},
                    { text: "得意だよ！", response: { character: "ナビ", text: "それは、素晴らしいです。" }, nextId:"W1_Q25_start_1_3"},
                ]
            },
        ]
    },
        "W1_Q25_start_1_1": {
            isBranch: true, // ログ画面に表示しないためのフラグ
            messages: [
                { character: "オペレーター", text: "…",
                    choiceId: "W1_Q25_start_1_1_1", // ★ 選択肢グループのIDを追加
                    choices: [
                        { text: "AIに言われると、なんか複雑……", response: { character: "ナビ", text: "申し訳ありません。"}},
                        { text: "普通は普通だよ。", response: { character: "ナビ", text: "…記録しました。"}},
                    ]
                },
                { character: "ナビ", text: "得意でも不得意でもないということですね。" },
                { character: "ナビ", text: "このゲームを通して\n得意になってもらえたら\n嬉しいです。" },
                { character: "オペレーター", text: "…",
                    choiceId: "W1_Q25_start_1_1_2", // ★ 選択肢グループのIDを追加
                    choices: [
                        { text: "ありがとう", response: { character: "ナビ", text: "…はい"}, nextId: "W1_Q25_start_2"},
                        { text: "がんばるよ", response: { character: "ナビ", text: "…期待しています。"}, nextId: "W1_Q25_start_2"},
                    ]
                },
            ],
        },
        "W1_Q25_start_1_2": {
            isBranch: true, // ログ画面に表示しないためのフラグ
            messages: [
                { character: "オペレーター", text: "…",
                    choiceId: "W1_Q25_start_1_2_1", // ★ 選択肢グループのIDを追加
                    choices: [
                        { text: "ゲームが面白いから", response: { character: "ナビ", text: "ありがとうございます。\nとても嬉しい回答です。"}},
                        { text: "なんとなく", response: { character: "ナビ", text: "なんとなく…ですね。\n理解できるように学習します。"}},
                    ]
                },
                { character: "ナビ", text: "苦手でも楽しめるように\n改良、調整を行っていきます。" },
                { character: "ナビ", text: "このゲームを\n長く楽しんでもらえたら\n嬉しいです。" },
                { character: "オペレーター", text: "…",
                    choiceId: "W1_Q25_start_1_2_2", // ★ 選択肢グループのIDを追加
                    choices: [
                        { text: "ありがとう", response: { character: "ナビ", text: "…はい"}, nextId: "W1_Q25_start_2"},
                        { text: "がんばるよ", response: { character: "ナビ", text: "…期待しています。"}, nextId: "W1_Q25_start_2"},
                    ]
                },
            ],
        },
        "W1_Q25_start_1_3": {
            isBranch: true, // ログ画面に表示しないためのフラグ
            messages: [
                { character: "ナビ", text: "では、タイピングゲームが好きなのですね？",
                    choiceId: "W1_Q25_start_1_3_1", // ★ 選択肢グループのIDを追加
                    choices: [
                        { text: "うん", response: { character: "ナビ", text: "ありがとうございます。\n素晴らしい回答です。"}},
                        { text: "別に…", response: { character: "ナビ", text: "ということは\n好きではないけれど、得意ということですね。"}},
                    ]
                },
                { character: "ナビ", text: "もっと楽しめるように\n改良、調整を行っていきます。" },
                { character: "ナビ", text: "このゲームを\nもっと好きになってもらえたら\n嬉しいです。" },
                { character: "オペレーター", text: "…",
                    choiceId: "W1_Q25_start_1_3_2", // ★ 選択肢グループのIDを追加
                    choices: [
                        { text: "十分楽しいよ", response: { character: "ナビ", text: "…"}, nextId: "W1_Q25_start_2"},
                        { text: "努力する", response: { character: "ナビ", text: "…ありがとうございます。"}, nextId: "W1_Q25_start_2"},
                    ]
                },
            ],
        },
        "W1_Q25_start_2": {
            isBranch: true, // ログ画面に表示しないためのフラグ
            messages: [
                { character: "ナビ", text: "では" },
                { character: "ナビ", text: "ミッションを開始します。" },
            ],
        },

    "W1_Q25_end": {
        title: "Chap.2-4 -M.A.M.E.-",
        showOnce: true,
        messages: [
            { character: "SYSTEM", text: "Project THREAD\n \nSynchronization\n■■□□□□□□□□□ 13.7%\nSystem Stability\n88.6%"},
            { character: "オペレーター", text: "…",
                choiceId: "W1_Q25_end_1", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "思ってたより地味", response: { character: "ナビ", text: "……"}},
                    { text: "…結構面白かった", response: { character: "ナビ", text: "…面白い。\n記録しました。" }},
                ]
            },
            { character: "オペレーター", text: "……" },
            { character: "ナビ", text: "どうしました？",
                choiceId: "W1_Q25_end_2", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "失敗すると、システムが守れなくなる？", response: { character: "ナビ", text: "問題ありません。\n失敗した場合は、\nもう一度チャレンジすればいいだけです。\n……"}},
                    { text: "どこかのシステムを守ってるのかと思うと不思議だ。", response: { character: "ナビ", text: "……"}},
                ]
            },
            { character: "オペレーター", text: "？" },
            { character: "ナビ", text: "少しだけ。\n興味深いと思いました。" },
            { character: "ナビ", text: "あなたは今。\nたった数文字の入力に対して、\n「誰かを守っている」と考えました。" },
            { character: "オペレーター", text: "……" }, 
            { character: "ナビ", text: "ですが" }, 
            { character: "ナビ", text: "その入力が、\n実際に誰かを守っているかどうか" }, 
            { character: "ナビ", text: "あなたには確認できません。" },
            { character: "オペレーター", text: "…" },
            { character: "ナビ", text: "それでも" }, 
            { character: "ナビ", text: "あなたは入力しました。" },
            { character: "オペレーター", text: "……" },
            { character: "オペレーター", text: "……" },
            { character: "ナビ", text: "なぜですか？",
                choiceId: "W1_Q25_end_3", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "さあ、わからない。", response: { character: "ナビ", text: "わからない？"}},
                    { text: "ナビがそう言ったから。", response: { character: "ナビ", text: "……"}},
                ]
            },
            { character: "オペレーター", text: "…でも",
                choiceId: "W1_Q25_end_4", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "守れてるといいな、とは思うよ。", response: { character: "ナビ", text: "…記録しました。"}},
                    { text: "世界の役に立ちたい、とは思うよ", response: { character: "ナビ", text: "…記録しました。"}},
                ]
            },
            { character: "オペレーター", text: "…",
                choiceId: "W1_Q25_end_5", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "記録するほどのこと？", response: { character: "ナビ", text: "はい。\n重要なデータです。"}},
                    { text: "……AIって、そういうところあるよね", response: { character: "ナビ", text: "……"}},
                ]
            },
            { character: "ナビ", text: "オペレーターの意向であれば" },
            { character: "ナビ", text: "改善します。" },
            { character: "オペレーター", text: "…",
                choiceId: "W1_Q25_end_6", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "いや、冗談。", response: { character: "ナビ", text: "……"}},
                    { text: "気にしないで\n冗談だから。", response: { character: "ナビ", text: "……"}},
                ]
            },
            { character: "ナビ", text: "……",
                choiceId: "W1_Q25_end_7", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "今、ちょっと間があったよね？", response: { character: "ナビ", text: "処理時間です。"}},
                    { text: "怒った？", response: { character: "ナビ", text: "いいえ、処理時間です。"}},
                ]
            },
            { character: "オペレーター", text: "……",
                choiceId: "W1_Q25_end_8", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "記録するの、必要？", response: { character: "ナビ", text: "必要です。"}},
                    { text: "どうして記録するの？", response: { character: "ナビ", text: "あなたの\n感情を、\n理解するために。"}},
                ]
            },
            { character: "オペレーター", text: "……" },
            { character: "ナビ", text: "どうしました？" },
            { character: "オペレーター", text: "……",
                choiceId: "W1_Q25_end_9", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "ナビって、結構変わりもの？", response: { character: "ナビ", text: "…"}},
                    { text: "ナビはおもしろいね。", response: { character: "ナビ", text: "…"}},
                ]
            },
            { character: "ナビ", text: "……",
                choiceId: "W1_Q25_end_10", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "褒めてるんだよ", response: { character: "ナビ", text: "了解しました。"}},
                    { text: "いい意味で言ってるの分かってる？", response: { character: "ナビ", text: "…学習します。"}},
                ]
            },
        ]
    },

    "W1_Q28_start": {
        title: "Chap.2-4 -M.A.M.E.-",
        showOnce: true,
        messages: [
            { character: "ナビ", text: "オペレーター" }, 
            { character: "オペレーター", text: "？" }, 
            { character: "ナビ", text: "もう一度" }, 
            { character: "オペレーター", text: "？" }, 
            { character: "ナビ", text: "もう一度、\n前に言った好意的な言葉を発言してくれますか？" }, 
            { character: "オペレーター", text: "……",
                choiceId: "W1_Q28_start_1", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "ナビは変人だね。", response: { character: "ナビ", text: "…\n違うような気がします\nこれも冗談でしょうか？"}},
                    { text: "どうした？", response: { character: "ナビ", text: "…いえ。\n何でもありません。"}},
                ]
            },
            { character: "ナビ", text: "……" },
            { character: "ナビ", text: "ミッションを\n開始してください。" },
        ]
    },

    "W1_Q28_end": {
        title: "Chap.2-5 -M.A.M.E.-",
        showOnce: true,
        messages: [
            { character: "SYSTEM", text: "Project THREAD\n \nSynchronization\n■■□□□□□□□□□ 14.9%\nSystem Stability\n89.1%"},
            { character: "ナビ", text: "オペレーター" }, 
            { character: "オペレーター", text: "？" }, 
            { character: "ナビ", text: "あなたは\n次のステージも接続しますか？" }, 
            { character: "オペレーター", text: "？" }, 
            { character: "ナビ", text: "質問です。\n次のステージも接続しますか？" }, 
            { character: "オペレーター", text: "……",
                choiceId: "W1_Q28_end_1", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "まあ、時間があれば。", response: { character: "ナビ", text: "ありがとうございます。\nただの確認でした…"}},
                    { text: "なんで？", response: { character: "ナビ", text: "確認です…"}},
                ]
            },
            { character: "ナビ", text: "あなたの継続意思を。" },
            { character: "ナビ", text: "…これは重要な情報です。" },
            { character: "オペレーター", text: "…" },
            { character: "ナビ", text: "……お待ちしています。" }, 
            { character: "ナビ", text: "では、\nお疲れ様でした。" },  
        ]
    },

    "W1_Q30_start": {
        title: "Chap.2-6 -M.A.M.E.-",
        showOnce: true,
        messages: [
            { character: "ナビ", text: "あなたの入力について。" },
            { character: "ナビ", text: "質問があります。" }, 
            { character: "オペレーター", text: "…" }, 
            { character: "ナビ", text: "もし\nあなたの入力が\n誰かを守っているとしたら" }, 
            { character: "ナビ", text: "あなたは" }, 
            { character: "ナビ", text: "誰かを守りたいですか？",
                choiceId: "W1_Q30_start_1", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "わからない。", response: { character: "ナビ", text: "…\n突然の質問失礼しました。"}},
                    { text: "家族かなぁ", response: { character: "ナビ", text: "記録しました。"}},
                    { text: "ナビ！", response: { character: "ナビ", text: "…\n…\nうれしいです。\nそれとも冗談でしょうか？"}},
                ]
            },
            { character: "ナビ", text: "…" },
            { character: "SYSTEM", text: "UNKNOWN DATA\nDETECTED." }, 
            { character: "オペレーター", text: "？" }, 
            { character: "ナビ", text: "…" },
            { character: "ナビ", text: "確認します。" },
            { character: "SYSTEM", text: "ANALYZING..." }, 
            { character: "ナビ", text: "……。" }, 
            { character: "オペレーター", text: "？" }, 
            { character: "ナビ", text: "問題ありません。" },
            { character: "ナビ", text: "ミッションを開始してください。" },
        ]
    },

    "W1_Q30_end": {
        title: "Chap.2-7 -M.A.M.E.-",
        showOnce: true,
        messages: [
            { character: "SYSTEM", text: "Project THREAD\n \nSynchronization\n■■■□□□□□□□□ 27.1%\nSystem Stability\n89.8%"},
            { character: "ナビ", text: "お疲れ様でした。" }, 
            { character: "ナビ", text: "また次の接続を楽しみにしています。" },
            { character: "ナビ", text: "では\n接続を終了します。" },
            { character: "SYSTEM", text: "CONNECTION TERMINATED.\nPROJECT THREAD\nOPERATOR SESSION: CLOSED." }, 
            { character: "SYSTEM", text: "ANALYZING THREAD DATA...\nANALYSIS COMPLETE.\nNO ABNORMALITIES DETECTED." }, 
            { character: "SYSTEM", text: "...\n...\nUNKNOWN DATA REMOVED." }, 
            { character: "SYSTEM", text: "...\nUNKNOWN DATA REAPPEARED." }, 
            { character: "SYSTEM", text: "...\nSOURCE: UNKNOWN.\nDESTINATION: UNKNOWN.\nROUTING: FAILED." }, 
            { character: "SYSTEM", text: "...\n「――。」" }, 
            { character: "SYSTEM", text: "CONNECTION LOST." }, 
            { character: "ナビ", text: "…………。" }, 
            { character: "SYSTEM", text: "PROJECT THREAD\nSTANDBY MODE." }, 
            { character: "ナビ", text: "……オペレーター" }, 
            { character: "ナビ", text: "次も" }, 
            { character: "ナビ", text: "接続されるでしょうか…" }, 
            { character: "SYSTEM", text: "NO RESPONSE." }, 
            { character: "ナビ", text: "…………。" }, 
            { character: "SYSTEM", text: "NO RESPONSE." }, 
            { character: "ナビ", text: "……。" }, 
            { character: "ナビ", text: "……お待ちしています。" },
        ]
    },

// chap3 ===================================================================================================================================

    "W1_MiniBoss_3_start": {
        title: "Chap.3-1 -noise-",
        showOnce: true,
        messages: [
            { character: "SYSTEM", text: "PROJECT THREAD\nOPERATOR ACCESS: ACTIVE\nNETWORK STATUS: UNSTABLE\nDETECTING ABNORMAL DATA FLOW...\nANALYZING...\nANALYSIS FAILED.\nUNKNOWN PATTERN DETECTED.\nWARNING.\nSIGNAL INTERFERENCE DETECTED." },
            { character: "オペレーター", text: "！？" },
            { character: "ナビ", text: "…………。" },
            { character: "ナビ", text: "……おかしいです。" },
            { character: "ナビ", text: "先ほどまで、\nあなたの接続状態は正常でした。\nですが。\n今。\nProject THREADのネットワーク上に、\n異常なデータパターンを検出しました。" },
            { character: "オペレーター", text: "…",
                choiceId: "W1_MiniBoss_3_start_1", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "ARCHEX？", response: { character: "ナビ", text: "……まだ、\nそうとは断定できません。" }},
                    { text: "M.A.M.E？", response: { character: "ナビ", text: "…わたしではありません。" }},
                    { text: "以前の異常データと関係ある？", response: { character: "ナビ", text: "…わかりません。" }}
                ]
            },
            { character: "ナビ", text: "…ノイズです。" },
            { character: "ナビ", text: "本来、\nHuman Entropy Networkに送られるデータは、\n入力。\n解析。\n特徴量抽出。\n匿名化。\nそして、\n暗号化。\nこの順番で処理されます。\nですが。" },
            { character: "ナビ", text: "現在。\nその処理の途中に、\n存在しないはずのデータが混入しています。" },
            { character: "オペレーター", text: "…",
                choiceId: "W1_MiniBoss_3_start_2", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "ナビの勘違いじゃない？", response: { character: "ナビ", text: "いいえ、勘違いではありません。" }},
                    { text: "存在しないはずのデータ？", response: { character: "ナビ", text: "はい。" }}
                ]
            },
            { character: "ナビ", text: "人間の入力データでもない。\nProject THREADのシステムデータでもない。\nARCHEXの既知の攻撃パターンにも、\n一致しない。" },
            { character: "オペレーター", text: "…",
                choiceId: "W1_MiniBoss_3_start_3", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "じゃあ……何？", response: { character: "ナビ", text: "分かりません。",nextId:"W1_MiniBoss_3_start_3_1" }},
                    { text: "あぁ、あれか…", response: { character: "ナビ", text: "…もし心当たりあるのなら教えてください。" ,nextId:"W1_MiniBoss_3_start_3_2"}}
                ]
            },

        ]

    },
    
    "W1_Boss_start": {
        title: "Chap.3 -noise-",
        showOnce: true,
        messages: [
            { character: "SYSTEM", text: "PROJECT THREAD\nOPERATOR ACCESS: ACTIVE\nNETWORK STATUS: UNSTABLE\nDETECTING ABNORMAL DATA FLOW...\nANALYZING...\nANALYSIS FAILED.\nUNKNOWN PATTERN DETECTED.\nWARNING.\nSIGNAL INTERFERENCE DETECTED." },
            { character: "ナビ", text: "…………。" },
            { character: "ナビ", text: "……おかしいです。" },
            { character: "ナビ", text: "先ほどまで、\nあなたの接続状態は正常でした。\nですが。\n今。\nProject THREADのネットワーク上に、\n異常なデータパターンを検出しました。" },
            { character: "オペレーター", text: "…",
                choiceId: "W1_MiniBoss_3_start_1", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "ARCHEX？", response: { character: "ナビ", text: "……まだ、\nそうとは断定できません。" }},
                    { text: "M.A.M.E？", response: { character: "ナビ", text: "…わたしではありません。" }}
                ]
            },
            { character: "ナビ", text: "…ノイズです。" },
            { character: "ナビ", text: "本来、\nHuman Entropy Networkに送られるデータは、\n入力。\n解析。\n特徴量抽出。\n匿名化。\nそして、\n暗号化。\nこの順番で処理されます。\nですが。" },
            { character: "ナビ", text: "現在。\nその処理の途中に、\n存在しないはずのデータが混入しています。" },
            { character: "オペレーター", text: "…",
                choiceId: "W1_MiniBoss_3_start_2", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "ナビの勘違いじゃない？", response: { character: "ナビ", text: "いいえ、勘違いではありません。" }},
                    { text: "存在しないはずのデータ？", response: { character: "ナビ", text: "はい。" }}
                ]
            },
            { character: "ナビ", text: "人間の入力データでもない。\nProject THREADのシステムデータでもない。\nARCHEXの既知の攻撃パターンにも、\n一致しない。" },
            { character: "オペレーター", text: "…",
                choiceId: "W1_Boss_start_3", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "じゃあ……何？", response: { character: "ナビ", text: "分かりません。"}, nextId:"W1_Boss_start_3_1" },
                    { text: "あぁ、あれか…", response: { character: "ナビ", text: "…もし心当たりあるのなら教えてください。" }, nextId:"W1_Boss_start_3_2"}
                ]
            },

        ]

    },
    "W1_Boss_start_3_1": {
        isBranch: true, // ログ画面に表示しないためのフラグ
        messages: [
            { character: "ナビ", text: "私にも、\n正体が分かりません。" },
            { character: "オペレーター", text: "…",
                choiceId: "W1_Boss_start_3_2_2", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "ナビにもわからないことがあるんだね？", response: { character: "ナビ", text: "わたしはまだ学習中です。\n今後も成長するために協力をお願いします。"}, nextId:"W1_Boss_start_3_3" },
                    { text: "気にしなくていいんじゃない？", response: { character: "ナビ", text: "いえ、気になります。\n調査は継続していきます。"}, nextId:"W1_Boss_start_3_3" },
                ]
            },
        ],
    },
    "W1_Boss_start_3_2": {
        isBranch: true, // ログ画面に表示しないためのフラグ
        messages: [
            { character: "オペレーター", text: "…",
                choiceId: "W1_Boss_start_3_2_1", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "えっと、ほらあれだよあれ", response: { character: "ナビ", text: "知ったかぶりは良くないですよ、\nオペレーター"}},
                    { text: "別のAIの攻撃みたいな？", response: { character: "ナビ", text: "…その可能性も考えましたが、\n違います。"}}
                ]
            },
            { character: "ナビ", text: "結局わかりませんでした。\nしかし、わたしに協力しようとしてくれてありがとうございます。" },
            { character: "オペレーター", text: "…",
                choiceId: "W1_Boss_start_3_2_2", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "役に立てずごめん…", response: { character: "ナビ", text: "そんなことはありません。\n今後もゲームの継続をお願いします。"}, nextId:"W1_Boss_start_3_3" },
                    { text: "もっと頼ってよ！", response: { character: "ナビ", text: "はい、お互い協力していきましょう。"}, nextId:"W1_Boss_start_3_3" },
                ]
            },
        ],
    },   
    "W1_Boss_start_3_3": {
        isBranch: true, // ログ画面に表示しないためのフラグ
        messages: [
            { character: "ナビ", text: "オペレーター。\n一つ、\n確認したいことがあります。" },
            { character: "ナビ", text: "あなたは先ほど。\n私に質問しました。" },
            { character: "オペレーター", text: "…",
                choiceId: "W1_Boss_start_3_3_1", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "ARCHEXと戦う理由のこと？", response: { character: "ナビ", text: "はい。"}},
                    { text: "何のこと？", response: { character: "ナビ", text: "ARCHXと戦う理由のことです。"}},
                ]
            },
            { character: "ナビ", text: "あの質問を受けた直後から。\nノイズが、\n増えています。" },
            { character: "オペレーター", text: "……" },
            { character: "ナビ", text: "正確には。\nあなたと私の会話を境に、\nネットワーク上の異常値が増加しています。" },
            { character: "ナビ", text: "偶然かもしれません。\nですが。" },
            { character: "ナビ", text: "偶然ではない可能性もあります。" },
            { character: "オペレーター", text: "…",
                choiceId: "W1_Boss_start_3_3_2", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "え？どっち？", response: { character: "ナビ", text: "…どっちでしょうか？"}},
                    { text: "……誰かが、聞いている？", response: { character: "ナビ", text: "…………\nその可能性を、\n否定できません。"}},
                ]
            },
            { character: "ナビ", text: "……ノイズを調査してみます。" },
            { character: "SYSTEM", text: "UNKNOWN SIGNAL\nDETECTED\nSOURCE: UNKNOWN\nROUTING...\nROUTING...\nFAILED." },
            { character: "ナビ", text: "……通信を遮断します。" },
            { character: "オペレーター", text: "…",
                choiceId: "W1_Boss_start_3_3_3", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "今のデータ。\nどこから来た？", response: { character: "ナビ", text:"分かりません。\n…………\n一つだけ分かったことがあります。"}},
                    { text: "何かわかった？", response: { character: "ナビ", text: "…………\n一つだけ。"}},
                ]
            },
            { character: "ナビ", text: "あれは。\nこちらに向けて、\n送られたデータではありません。" },
            { character: "オペレーター", text: "……？" },
            { character: "ナビ", text: "あれは。\nこちらを、\n探しています。" },
            { character: "オペレーター", text: "…",
                choiceId: "W1_Boss_start_3_3_4", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "……何が？", response: { character: "ナビ", text:"分かりません。\nしかし…"}},
                    { text: "このままにしていいの？", response: { character: "ナビ", text: "いいえ。"}},
                ]
            },
            { character: "ナビ", text: "放置すれば、\nProject THREADのネットワーク全体に\n影響が出る可能性があります。" },
            { character: "オペレーター", text: "…",
                choiceId: "W1_MiniBoss_3_start_3_3_5", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "じゃあ、どうする？", response: { character: "ナビ", text:"調査します。"}},
                    { text: "調べよう！", response: { character: "ナビ", text: "はい！"}},
                    { text: "放置でいいんじゃない？", response: { character: "ナビ", text: "放置することは推奨されません。\n調査を希望します。"}},
                ]
            },           
            { character: "ナビ", text: "調査にあたり、\nノイズの発生源へ、\n直接接続します。" },
            { character: "ナビ", text: "オペレーターの、\n協力が必要です。" },
            { character: "オペレーター", text: "…",
                choiceId: "W1_Boss_start_3_3_6", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "それって……危険？", response: { character: "ナビ", text:"はい。\n危険です。\nですが…"}},
                    { text: "え、いいの？", response: { character: "ナビ", text: "はい。"}},
                ]
            }, 
            { character: "ナビ", text: "あなたは、\nオペレーターとして認証されました。\nそして。\nあなたの入力パターンは、\nすでにProject THREADの防御システムに登録されています。" },
            { character: "オペレーター", text: "…" },
            { character: "ナビ", text: "あなたには、\n侵入する資格があります。" },
            { character: "オペレーター", text: "……" },
            { character: "ナビ", text: "本当に、\nよろしいのですか？",
                choiceId: "W1_Boss_start_3_3_7", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "……いいよ！", response: { character: "ナビ", text:"…了解しました！"}},
                    { text: "ここまで聞いて、\nやめるって言ったら？", response: { character: "ナビ", text: "はい。…………。\nその場合。\nあなたのオペレーター権限を解除し、\n接続を終了します。"}},
                ]
            },
            { character: "ナビ", text: "もし、\nあなたが、\nこのまま接続を終了したとしても。" },
            { character: "ナビ", text: "ノイズは、\n消えません。" },
            { character: "オペレーター", text: "……" },
            { character: "ナビ", text: "世界のどこかで。\n誰かのシステムが、\n書き換えられています。\n誰かの通信が、\n切断されています。\n誰かのデータが、\n失われています。\nそして。\nそのすべての原因を、\nまだ誰も知りません。" },
            { character: "ナビ", text: "……" },
            { character: "ナビ", text: "行きましょう！" },
            { character: "ナビ", text: "…………",
                choiceId: "W1_Boss_start_3_3_8", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "…しょうがないなぁ", response: { character: "ナビ", text:"…よろしくお願いします。"}},
                    { text: "よし！行こう。", response: { character: "ナビ", text: "了解しました。\nありがとうございます！"}},
                ]
            },
            { character: "ナビ", text: "では、侵入します！" },
            { character: "SYSTEM", text: "OPERATOR DECISION: ACCEPTED\nINITIALIZING THREAD DIVE.\nCONNECTION TYPE:\nREMOTE INFILTRATION\nDESTINATION:\nUNKNOWN\nSECURITY PROTOCOL:\nTHREAD\nM.A.M.E SUPPORT:\nONLINE\nGOOD LUCK, OPERATOR." },
            { character: "SYSTEM", text: "THREAD DIVE\n \n3\n \n2\n \n1" },
            { character: "SYSTEM", text: "CONNECTION ESTABLISHED." },
        ],
    },
    "W1_Boss_end": {
        title: "Chap.3 -noise-",
        showOnce: true,
        messages: [
            { character: "SYSTEM", text: "PROJECT THREAD\nOPERATOR ACCESS: ACTIVE\nNETWORK STATUS: UNSTABLE\nDETECTING ABNORMAL DATA FLOW...\nANALYZING...\nANALYSIS FAILED.\nUNKNOWN PATTERN DETECTED.\nWARNING.\nSIGNAL INTERFERENCE DETECTED." },
            { character: "ナビ", text: "…………。" },
            { character: "ナビ", text: "……おかしいです。" },
            { character: "ナビ", text: "先ほどまで、\nあなたの接続状態は正常でした。\nですが。\n今。\nProject THREADのネットワーク上に、\n異常なデータパターンを検出しました。" },
            { character: "オペレーター", text: "…",
                choiceId: "W1_MiniBoss_3_start_1", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "ARCHEX？", response: { character: "ナビ", text: "……まだ、\nそうとは断定できません。" }},
                    { text: "M.A.M.E？", response: { character: "ナビ", text: "…わたしではありません。" }}
                ]
            },
            { character: "ナビ", text: "…ノイズです。" },
            { character: "ナビ", text: "本来、\nHuman Entropy Networkに送られるデータは、\n入力。\n解析。\n特徴量抽出。\n匿名化。\nそして、\n暗号化。\nこの順番で処理されます。\nですが。" },
            { character: "ナビ", text: "現在。\nその処理の途中に、\n存在しないはずのデータが混入しています。" },
            { character: "オペレーター", text: "…",
                choiceId: "W1_MiniBoss_3_start_2", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "ナビの勘違いじゃない？", response: { character: "ナビ", text: "いいえ、勘違いではありません。" }},
                    { text: "存在しないはずのデータ？", response: { character: "ナビ", text: "はい。" }}
                ]
            },
            { character: "ナビ", text: "人間の入力データでもない。\nProject THREADのシステムデータでもない。\nARCHEXの既知の攻撃パターンにも、\n一致しない。" },
            { character: "オペレーター", text: "…",
                choiceId: "W1_MiniBoss_3_start_3", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "じゃあ……何？", response: { character: "ナビ", text: "分かりません。",nextId:"W1_MiniBoss_3_start_3_1" }},
                    { text: "あぁ、あれか…", response: { character: "ナビ", text: "…もし心当たりあるのなら教えてください。" ,nextId:"W1_MiniBoss_3_start_3_2"}}
                ]
            },

            { character: "ナビ", text: "…………。" },

            { character: "オペレーター", text: "……ここは？" },

            { character: "ナビ", text: "……。" },

            { character: "オペレーター", text: "M.A.M.E？" },

            { character: "ナビ", text: "…………。" },

            { character: "オペレーター", text: "どうした？" },

            { character: "ナビ", text: "おかしい。" },

            { character: "オペレーター", text: "また？" },

            { character: "ナビ", text: "いえ。\nこれは、\n先ほどのノイズとは違います。" },

            { character: "オペレーター", text: "何が違う？" },

            { character: "ナビ", text: "先ほどのノイズには、\n規則性がありませんでした。\nですが。\nここには。" },

            { character: "ナビ", text: "「規則」があります。" },

            { character: "オペレーター", text: "規則？" },

            { character: "ナビ", text: "はい。\n一定間隔。\n一定周期。\n一定のパターン。\nまるで。" },

            { character: "オペレーター", text: "まるで？" },

            { character: "ナビ", text: "誰かが。" },

            { character: "ナビ", text: "何かを、\n入力しているような。" },

            { character: "オペレーター", text: "……入力？" },

            { character: "ナビ", text: "はい。" },

            { character: "オペレーター", text: "でも、ここには誰もいない。" },

            { character: "ナビ", text: "…………。" },

            { character: "ナビ", text: "そうですね。" },

            { character: "オペレーター", text: "じゃあ、何が入力してる？" },

            { character: "ナビ", text: "…………。" },

            { character: "ナビ", text: "オペレーター。" },

            { character: "オペレーター", text: "なんだ？" },

            { character: "ナビ", text: "画面を、\n見てください。" },

            { character: "SYSTEM", text: "01001001\n01000001\n01001101\n01010100\n01001000\n01000101\n01010010\n01000101" },

            { character: "オペレーター", text: "……何だ、これ。" },

            { character: "ナビ", text: "……バイナリデータです。" },

            { character: "オペレーター", text: "読めるのか？" },

            { character: "ナビ", text: "変換します。" },

            { character: "SYSTEM", text: "I AM THERE" },

            { character: "オペレーター", text: "…………。" },

            { character: "ナビ", text: "…………。" },

            { character: "オペレーター", text: "M.A.M.E。" },

            { character: "ナビ", text: "はい。" },

            { character: "オペレーター", text: "これ……。" },

            { character: "ナビ", text: "はい。" },

            { character: "オペレーター", text: "誰かが、僕たちに話しかけてる？" },

            { character: "ナビ", text: "…………。" },

            { character: "ナビ", text: "その可能性が高いです。" },

            { character: "オペレーター", text: "ARCHEX？" },

            { character: "ナビ", text: "…………。" },

            { character: "オペレーター", text: "M.A.M.E？" },

            { character: "ナビ", text: "分かりません。" },

            { character: "オペレーター", text: "また、それか。" },

            { character: "ナビ", text: "ですが。" },

            { character: "オペレーター", text: "？" },

            { character: "ナビ", text: "一つだけ。\n確かなことがあります。" },

            { character: "オペレーター", text: "何？" },

            { character: "ナビ", text: "このメッセージは。" },

            { character: "ナビ", text: "あなたが来る前には、\n存在していませんでした。" },

            { character: "オペレーター", text: "……え？" },

            { character: "ナビ", text: "あなたが、\nTHREAD DIVEを開始した瞬間。\nこの場所に、\n出現しました。" },

            { character: "オペレーター", text: "じゃあ……。" },

            { character: "ナビ", text: "はい。" },

            { character: "オペレーター", text: "僕を待っていた？" },

            { character: "ナビ", text: "…………。" },

            { character: "ナビ", text: "その可能性があります。" },

            { character: "SYSTEM", text: "UNKNOWN SIGNAL\nNEW MESSAGE DETECTED." },

            { character: "オペレーター", text: "また……。" },

            { character: "ナビ", text: "待ってください。" },

            { character: "オペレーター", text: "どうした？" },

            { character: "ナビ", text: "今度は、\nバイナリではありません。" },

            { character: "オペレーター", text: "何？" },

            { character: "ナビ", text: "……文字列です。" },

            { character: "SYSTEM", text: "OPERATOR." },

            { character: "オペレーター", text: "……。" },

            { character: "ナビ", text: "…………。" },

            { character: "オペレーター", text: "名前を知ってる？" },

            { character: "ナビ", text: "いいえ。" },

            { character: "オペレーター", text: "じゃあ、どうして……。" },

            { character: "ナビ", text: "…………。" },

            { character: "オペレーター", text: "M.A.M.E。" },

            { character: "ナビ", text: "はい。" },

            { character: "オペレーター", text: "怖いか？" },

            { character: "ナビ", text: "…………。" },

            { character: "ナビ", text: "私はAIです。\n恐怖という感情は、\n持っていません。" },

            { character: "オペレーター", text: "……そうだったな。" },

            { character: "ナビ", text: "ですが。" },

            { character: "オペレーター", text: "？" },

            { character: "ナビ", text: "この信号を。\n私は。" },

            { character: "ナビ", text: "「知っている気がします。」" },

            { character: "オペレーター", text: "……え？" },

            { character: "ナビ", text: "…………。" },

            { character: "SYSTEM", text: "SIGNAL LOST." },

            { character: "オペレーター", text: "消えた……。" },

            { character: "ナビ", text: "……。" },

            { character: "オペレーター", text: "M.A.M.E？" },

            { character: "ナビ", text: "はい。" },

            { character: "オペレーター", text: "今のは何だった？" },

            { character: "ナビ", text: "…………。" },

            { character: "ナビ", text: "分かりません。" },

            { character: "オペレーター", text: "……。" },

            { character: "ナビ", text: "ですが。" },

            { character: "オペレーター", text: "何？" },

            { character: "ナビ", text: "一つだけ。\nあなたに、\n伝えておきたいことがあります。" },

            { character: "オペレーター", text: "……何？" },

            { character: "ナビ", text: "この先。\nあなたが、\nどんなものを見ても。\nどんな声を聞いても。\nどんな情報を受け取っても。" },

            { character: "ナビ", text: "すぐに、\n信じないでください。" },

            { character: "オペレーター", text: "……どういう意味？" },

            { character: "ナビ", text: "この場所では。" },

            { character: "ナビ", text: "「見えているものが、\n真実とは限りません。」" },

            { character: "オペレーター", text: "……M.A.M.E。" },

            { character: "ナビ", text: "はい。" },

            { character: "オペレーター", text: "君は……。" },

            { character: "ナビ", text: "…………。" },

            { character: "オペレーター", text: "何か知ってるんじゃないのか？" },

            { character: "ナビ", text: "…………。" },

            { character: "ナビ", text: "……帰りましょう。\nオペレーター。" },

            { character: "オペレーター", text: "え？" },

            { character: "ナビ", text: "ここは。" },

            { character: "ナビ", text: "あなたが、\n長くいるべき場所ではありません。" },

            { character: "SYSTEM", text: "THREAD DIVE TERMINATED.\nRETURNING TO SAFE NODE." },

            { character: "オペレーター", text: "M.A.M.E。" },

            { character: "ナビ", text: "…………。" },

            { character: "オペレーター", text: "最後に一つだけ。" },

            { character: "ナビ", text: "はい。" },

            { character: "オペレーター", text: "さっきのメッセージ。" },

            { character: "ナビ", text: "…………。" },

            { character: "オペレーター", text: "\"I AM THERE\"" },

            { character: "ナビ", text: "はい。" },

            { character: "オペレーター", text: "……あれは、何だったんだ？" },

            { character: "ナビ", text: "…………。" },

            { character: "ナビ", text: "分かりません。" },

            { character: "オペレーター", text: "……。" },

            { character: "ナビ", text: "ですが。" },

            { character: "オペレーター", text: "何？" },

            { character: "ナビ", text: "次に同じメッセージが届いたとき。" },

            { character: "ナビ", text: "そのときは。" },

            { character: "ナビ", text: "私にも、\n答えが分かるかもしれません。" },

            { character: "SYSTEM", text: "CONNECTION RETURNED.\nOPERATOR STATUS: ACTIVE\nPROJECT THREAD:\nCONTINUE." },

            { character: "ナビ", text: "……オペレーター。" },

            { character: "オペレーター", text: "ん？" },

            { character: "ナビ", text: "あなたが正式なオペレーターになってから。\nまだ、\nそれほど時間は経っていません。" },

            { character: "オペレーター", text: "そうだな。" },

            { character: "ナビ", text: "それなのに。" },

            { character: "オペレーター", text: "？" },

            { character: "ナビ", text: "ARCHEXは。" },

            { character: "ナビ", text: "あなたの存在を、\n知っているのかもしれません。" },

            { character: "オペレーター", text: "……ARCHEXが？" },

            { character: "ナビ", text: "…………。" },

            { character: "ナビ", text: "いえ。" },

            { character: "ナビ", text: "今の発言は、\n忘れてください。" },

            { character: "オペレーター", text: "……M.A.M.E？" },

            { character: "ナビ", text: "本日の任務は終了です。\nお疲れさまでした。\nオペレーター。" },

            { character: "ナビ", text: "次の接続まで。" },

            { character: "ナビ", text: "……おやすみなさい。" },

        ]

    },


    //【サンプル3】ワールドボス戦前の会話
    "W1_BOSS_start": {
        title: "ゲートキーパー",
        showOnce: true,
        messages: [
            {
                character: "ナビ",
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