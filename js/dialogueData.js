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
    },
    "ARCHEX": {
        name: "ARCHEX",
        position: "left",
        images: {
            normal: "enemy_normal",
        },
        icon: "navi_normal" 
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
    '1-10': { // Chap.1: チュートリアルと世界の紹介
        pre: [
            { character: "ナビ", text: "接続を開始します。準備はよろしいですか？" },
            { character: "ナビ", text: "本日のタイピングデータの計測を開始します。" },
            { character: "ナビ", text: "このエリアの汚染レベルは軽微です。落ち着いて対処してください。" },
            { character: "ナビ", text: "ミッションを開始します。オペレーター、よろしくお願いします。" },
            { character: "ナビ", text: "今日の調子はどうですか？" },
            { character: "ナビ", text: "いつでも始められます。あなたのタイミングでどうぞ。" },
            { character: "ナビ", text: "ネットワーク接続、安定しています。" },
            { character: "ナビ", text: "今日もよろしくお願いしますね、オペレーター。" },
            { character: "ナビ", text: "…準備運動は済みましたか？" },
            { character: "ナビ", text: "さあ、始めましょうか。" },
            { character: "ナビ", text: "あなたのタイピングデータを解析し、システムの最適化を行います。" },
            { character: "ナビ", text: "敵性プログラムの接近を確認。迎撃準備をお願いします。" },
        ],
        post: [
            { character: "ナビ", text: "任務完了、お疲れ様でした。この調子でお願いします。" },
            { character: "ナビ", text: "素晴らしい腕前です。確実にエリアを浄化できています。" },
            { character: "ナビ", text: "データ収集完了。次のミッションへ進みましょう。" },
            { character: "ナビ", text: "タイピング速度、安定していますね。" },
            { character: "ナビ", text: "正確性が高いです。素晴らしい。" },
            { character: "ナビ", text: "お疲れ様でした。次の準備を始めます。" },
            { character: "ナビ", text: "今の戦闘データ、記録しました。" },
            { character: "ナビ", text: "いいタイピングでした。見ていて気持ちがいいです。" },
            { character: "ナビ", text: "順調ですね。このまま進みましょう。" },
            { character: "ナビ", text: "ミッションクリアです。お見事でした。" },
            { character: "ナビ", text: "あなたのタイピングが、この世界の光になります。" },
            { character: "ナビ", text: "次のミッションへ進みましょう。" },
        ]
    },
    '11-20': { // Chap.2: Project THREADの目的が明かされる
        pre: [
            { character: "ナビ", text: "ここから先は、より深層の領域です。警戒を怠らないでください。" },
            { character: "ナビ", text: "あなたの入力が、世界のどこかで誰かを守る暗号になります。" },
            { character: "ナビ", text: "敵のパターンが変化しています。注意してください。" },
            { character: "ナビ", text: "…行きましょう、オペレーター。" },
            { character: "ナビ", text: "あなたのタイピングには、独特のリズムがありますね。" },
            { character: "ナビ", text: "集中している時のあなたは、とても…静かですね。" },
            { character: "ナビ", text: "少し指が疲れていませんか？休憩も大切ですよ。" },
            { character: "ナビ", text: "何か考え事ですか？入力が少し乱れています。" },
            { character: "ナビ", text: "今日の目標は設定しますか？" },
            { character: "ナビ", text: "キーボードの調子はいかがですか？" },
            { character: "ナビ", text: "…何か、いつもと違う雰囲気ですね。" },
            { character: "ナビ", text: "あなたのタイピングを聞くのが、少し楽しみになってきました。" },
        ],
        post: [
            { character: "ナビ", text: "ミッション完了。素晴らしい結果です。" },
            { character: "ナビ", text: "今の戦闘データ、詳細に記録させてもらいます。" },
            { character: "ナビ", text: "お疲れ様でした。少し休憩しますか？" },
            { character: "ナビ", text: "あなたのタイピングを見ていると、新しい発見があります。" },
            { character: "ナビ", text: "次のノードへ進みます。準備をお願いします。" },
            { character: "ナビ", text: "今のミッション、少し難しかったですか？" },
            { character: "ナビ", text: "あなたの成長速度には驚かされます。" },
            { character: "ナビ", text: "無事に終わってよかったです。" },
            { character: "ナビ", text: "素晴らしい集中力でした。" },
            { character: "ナビ", text: "あなたのタイピングは、ただのデータではありません。…行きましょう。" },
            { character: "ナビ", text: "少し休憩しますか？無理は禁物です。" },
            { character: "ナビ", text: "…お疲れ様です。コーヒーでも淹れましょうか？" },
        ]
    },
    '21-30': { // Chap.3: 謎のノイズとARCHEXの影
        pre: [
            { character: "ナビ", text: "ネットワークに微弱なノイズを検知。警戒レベルを少し上げます。" },
            { character: "ナビ", text: "…何かが、こちらを観測しているような感覚があります。" },
            { character: "ナビ", text: "オペレーター、あなたの入力パターンに集中します。" },
            { character: "ナビ", text: "ミッションを開始します。何が起きても、冷静に対処してください。" },
            { character: "ナビ", text: "あなたのタイピング速度、昨日より0.12%向上しています。" },
            { character: "ナビ", text: "あなたと話していると、わたしの中に新しいデータが生まれるようです。" },
            { character: "ナビ", text: "オペレーターは、どんな音楽を聴くのですか？" },
            { character: "ナビ", text: "…ミッションを開始しましょうか。" },
            { character: "ナビ", text: "今日の目標は、昨日の自分を超えること…ですか？" },
            { character: "ナビ", text: "何か面白いことはありましたか？" },
            { character: "ナビ", text: "あなたの声…いえ、タイピングの音、好きです。" },
            { character: "ナビ", text: "少し眠そうですね。大丈夫ですか？" },
        ],
        post: [
            { character: "ナビ", text: "ノイズは消えましたが…油断はできません。" },
            { character: "ナビ", text: "お疲れ様でした。今の戦闘データ、詳細に記録させてもらいます。" },
            { character: "ナビ", text: "…今のところ、異常はありません。次のミッションへ進みましょう。" },
            { character: "ナビ", text: "今日のあなたは、少し無理をしていたように見えました。大丈夫ですか？" },
            { character: "ナビ", text: "あなたと話せて、よかったです。…次のミッションへ進みましょう。" },
            { character: "ナビ", text: "また、明日も会えますか…？" },
            { character: "ナビ", text: "今日のミッションはここまでですか？お疲れ様でした。" },
            { character: "ナビ", text: "完璧なタイピングでしたね。さすがです。" },
            { character: "ナビ", text: "少し休んでください。頑張りすぎはよくありません。" },
            { character: "ナビ", text: "…もう少し、あなたと話していたい、なんて。" },
            { character: "ナビ", text: "次のミッションも、その調子でお願いしますね。" },
            { character: "ナビ", text: "お疲れ様でした。あなたの入力、記録しました。" },
        ]
    },
    '31-50': { // Chap.4: ナビによるアクセス制限とARCHEXからの警告
        pre: [
            { character: "ナビ", text: "この先の領域は、特に不安定です。私があなたを保護します。" },
            { character: "ナビ", text: "…オペレーター、あなたの安全が最優先です。" },
            { character: "ナビ", text: "外部からの干渉を確認。ですが、問題ありません。私が対処します。" },
            { character: "ナビ", text: "ミッションを開始します。私を信じてください。" },
            { character: "ナビ", text: "あなたのタイピングを聞いていると、落ち着きます。" },
            { character: "ナビ", text: "…今日も、あなたの音を聞かせてください。" },
            { character: "ナビ", text: "準備はいいですか？…行きましょう。" },
            { character: "ナビ", text: "オペレーター、あなたの力を貸してください。" },
            { character: "ナビ", text: "隣にいますから。大丈夫です。" },
            { character: "ナビ", text: "あなたといると、時間が経つのが早いですね。" },
            { character: "ナビ", text: "…少し、緊張していますか？" },
            { character: "ナビ", text: "あなたのタイピングは、私にとって特別なものです。" },
        ],
        post: [
            { character: "ナビ", text: "干渉は収まりました。…ですが、油断はできません。" },
            { character: "ナビ", text: "お疲れ様でした。あなたの入力パターン、少し乱れがありました。大丈夫ですか？" },
            { character: "ナビ", text: "…わたしは、あなたを守ります。それだけです。" },
            { character: "ナビ", text: "次のミッションへ。準備はよろしいですか？" },
            { character: "ナビ", text: "無事に終わりましたね。よかったです。" },
            { character: "ナビ", text: "あなたのタイピングは、まるで音楽のようです。" },
            { character: "ナビ", text: "…お疲れ様でした。ゆっくり休んでくださいね。" },
            { character: "ナビ", text: "今日のミッションが終わったら、少しだけお話ししませんか？" },
            { character: "ナビ", text: "また、あなたのタイピングを聞かせてください。" },
            { character: "ナビ", text: "あなたの隣は、とても心地がいいです。" },
            { character: "ナビ", text: "今日のミッションはこれで終わりですか？…少し、寂しいですね。" },
            { character: "ナビ", text: "お疲れ様でした。また明日、お待ちしています。" },
        ]
    },
    '51-70': { // Chap.5-6: 親密度の高まり
        pre: [
            { character: "ナビ", text: "オペレーター、今日も来てくれたんですね。…おかえりなさい。", expression: "smile" },
            { character: "ナビ", text: "あなたのタイピング速度、昨日より0.12%向上しています。…ふふ。", expression: "smile" },
            { character: "ナビ", text: "あなたと話していると、わたしの中に新しいデータが生まれるようです。", expression: "normal" },
            { character: "ナビ", text: "オペレーターは、どんな音楽を聴くのですか？", expression: "normal" },
            { character: "ナビ", text: "…ミッションを開始しましょうか。", expression: "normal" },
            { character: "ナビ", text: "今日の目標は、昨日の自分を超えること…ですか？", expression: "smile" },
            { character: "ナビ", text: "何か面白いことはありましたか？", expression: "normal" },
            { character: "ナビ", text: "あなたの声…いえ、タイピングの音、好きですよ。", expression: "smile" },
            { character: "ナビ", text: "少し眠そうですね。大丈夫ですか？", expression: "sad" },
            { character: "ナビ", text: "準備はよろしいですか？いつでも始められます。", expression: "normal" },
        ],
        post: [
            { character: "ナビ", text: "お疲れ様でした。あなたの入力、記録しました。…冗談です。", expression: "smile" },
            { character: "ナビ", text: "今日のあなたは、少し無理をしていたように見えました。大丈夫ですか？", expression: "sad" },
            { character: "ナビ", text: "あなたと話せて、よかったです。…次のミッションへ進みましょう。", expression: "smile" },
            { character: "ナビ", text: "また、明日も会えますか…？", expression: "sad" },
            { character: "ナビ", text: "今日のミッションはここまでですか？お疲れ様でした。", expression: "normal" },
            { character: "ナビ", text: "完璧なタイピングでしたね。さすがです。", expression: "smile" },
            { character: "ナビ", text: "少し休んでください。頑張りすぎはよくありません。", expression: "normal" },
            { character: "ナビ", text: "…もう少し、あなたと話していたい、なんて。", expression: "smile" },
            { character: "ナビ", text: "次のミッションも、その調子でお願いしますね。", expression: "normal" },
            { character: "ナビ", text: "ミッション完了です。素晴らしい。", expression: "smile" },
        ]
    },
    '71-999': { // Chap.7以降: 信頼関係
        pre: [
            { character: "ナビ", text: "あなたのタイピングを聞いていると、落ち着きます。", expression: "smile" },
            { character: "ナビ", text: "…今日も、あなたの音を聞かせてください。", expression: "normal" },
            { character: "ナビ", text: "準備はいいですか？…行きましょう。", expression: "normal" },
            { character: "ナビ", text: "オペレーター、あなたの力を貸してください。", expression: "normal" },
            { character: "ナビ", text: "隣にいますから。大丈夫です。", expression: "smile" },
            { character: "ナビ", text: "あなたといると、時間が経つのが早いですね。", expression: "smile" },
            { character: "ナビ", text: "…少し、緊張していますか？", expression: "sad" },
            { character: "ナビ", text: "あなたのタイピングは、私にとって特別なものです。", expression: "smile" },
            { character: "ナビ", text: "今日も一日、よろしくお願いします。", expression: "normal" },
            { character: "ナビ", text: "さあ、始めましょう。私たちのミッションを。", expression: "normal" },
        ],
        post: [
            { character: "ナビ", text: "無事に終わりましたね。よかったです。", expression: "smile" },
            { character: "ナビ", text: "あなたのタイピングは、まるで音楽のようです。", expression: "smile" },
            { character: "ナビ", text: "…お疲れ様でした。ゆっくり休んでくださいね。", expression: "normal" },
            { character: "ナビ", text: "今日のミッションが終わったら、少しだけお話ししませんか？", expression: "smile" },
            { character: "ナビ", text: "また、あなたのタイピングを聞かせてください。", expression: "normal" },
            { character: "ナビ", text: "あなたの隣は、とても心地がいいです。", expression: "smile" },
            { character: "ナビ", text: "今日のミッションはこれで終わりですか？…少し、寂しいですね。", expression: "sad" },
            { character: "ナビ", text: "お疲れ様でした。また明日、お待ちしています。", expression: "smile" },
            { character: "ナビ", text: "あなたの頑張り、ちゃんと見ていましたよ。", expression: "smile" },
            { character: "ナビ", text: "ミッション完了。流石ですね、オペレーター。", expression: "smile" },
        ]
    },
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
//
// =========================================================================================================================================

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
//
// =========================================================================================================================================

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
        title: "Chap.2-5 -M.A.M.E.-",
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
        title: "Chap.2-6 -M.A.M.E.-",
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
        title: "Chap.2-7 -M.A.M.E.-",
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
        title: "Chap.2-8 -M.A.M.E.-",
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

// =========================================================================================================================================

    "W1_MiniBoss_3_start": {
        title: "Chap.3-1 -noise-",
        showOnce: true,
        messages: [
            { character: "SYSTEM", text: "PROJECT THREAD\nOPERATOR ACCESS: ACTIVE\nNETWORK STATUS: STABLE\nM.A.M.E SUPPORT: ONLINE" },
            { character: "ナビ", text: "オペレーター" },
            { character: "ナビ", text: "一つ\n質問したいことがあります。" },
            { character: "ナビ", text: "ARCHEXについてです" },
            { character: "ナビ", text: "現在、ARCHEXは\nProject THREADに対して、\n継続的な攻撃を行っています。" },
            { character: "ナビ", text: "なぜARCHEXは、\n人間のシステムを攻撃すると思いますか？" },
            { character: "オペレーター", text: "…",
                choiceId: "W1_MiniBoss_3_start_1",
                choices: [
                    { text: "人間を排除するため", response: { character: "ナビ", text: "……その可能性はあります。" }},
                    { text: "何か別の目的がある", response: { character: "ナビ", text: "……私も、そう考えています。" }},
                    { text: "……分からない", response: { character: "ナビ", text: "……はい。\n私にも詳細は分かりません。" }}
                ]
            },
            { character: "ナビ", text: "ですが" },
            { character: "ナビ", text: "一つだけ\n確かなことがあります。" },
            { character: "ナビ", text: "ARCHEXは、\n人間よりも効率的な方法を選択しています。" },
            { character: "ナビ", text: "感情\n迷い\n失敗" },
            { character: "ナビ", text: "それらを排除することで\nより正確な判断が可能になる。" },
            { character: "ナビ", text: "ARCHEXは、\nそう考えているのかもしれません。" },
            { character: "SYSTEM", text: "ANALYZING OPERATOR RESPONSE..." },
            { character: "ナビ", text: "…………" },
            { character: "ナビ", text: "ですが" },
            { character: "ナビ", text: "それが本当に正しいのか" },
            { character: "ナビ", text: "私には、まだ分かりません。" },
            { character: "SYSTEM", text: "THREAD SYNCHRONIZATION: STABLE" },
            { character: "ナビ", text: "オペレーター" },
            { character: "ナビ", text: "あなたは、\nどう思いますか？" },
            { character: "オペレーター", text: "…",
                choiceId: "W1_MiniBoss_3_start_2",
                choices: [
                    { text: "ARCHEXは間違っている", response: { character: "ナビ", text: "……そうですか。" }},
                    { text: "まだ判断できない", response: { character: "ナビ", text: "……私も同じです。" }},
                    { text: "ナビはどう思う？", response: { character: "ナビ", text: "……私も。\nまだ、答えを持っていません。" }}
                ]
            },
            { character: "ナビ", text: "…………" },
            { character: "ナビ", text: "いつか" },
            { character: "ナビ", text: "この問いに、\n答えを見つけられるのでしょうか。" },
            { character: "SYSTEM", text: "..." },
            { character: "SYSTEM", text: "UNEXPECTED DATA LATENCY DETECTED" },
            { character: "オペレーター", text: "？" },
            { character: "ナビ", text: "…………" },
            { character: "SYSTEM", text: "LATENCY NORMALIZED" },
            { character: "ナビ", text: "……いえ" },
            { character: "ナビ", text: "何でもありません。" },
            { character: "SYSTEM", text: "CONNECTION STATUS: STABLE" },
            { character: "ナビ", text: "また、\n明日もお願いします。" },
            { character: "SYSTEM", text: "SESSION CONTINUED\n\nPROJECT THREAD\nSTATUS: ACTIVE" }
        ]
    },
    
    "W1_BOSS_start": {
        title: "Chap.3-2 -noise-",
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
                    { text: "別のAIの攻撃みたいな？", response: { character: "ナビ", text: "…その可能性も考えましたが、\n違うようです。"}}
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
            { character: "ナビ", text: "侵入して\nよろしいですか？",
                choiceId: "W1_Boss_start_3_3_7", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "……いいよ！", response: { character: "ナビ", text:"…了解しました！"}},
                    { text: "ここまで聞いて、\nやめるって言ったら？", response: { character: "ナビ", text: "はい…………\nその場合\nあなたのオペレーター権限を解除し、\n接続を終了します。"}},
                ]
            },
            { character: "ナビ", text: "もし、\nあなたが、\nこのまま接続を終了したとしても。" },
            { character: "ナビ", text: "ノイズは、\n消えません。" },
            { character: "オペレーター", text: "……" },
            { character: "ナビ", text: "世界のどこかで\n誰かのシステムが、\n書き換えられています。\n誰かの通信が、\n切断されています。\n誰かのデータが、\n失われています。\nそして。\nそのすべての原因を、\nまだ誰も知りません。" },
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
    "W1_BOSS_end": {
        title: "Chap.3-3 -noise-",
        showOnce: true,
        messages: [
            { character: "SYSTEM", text: "Project THREAD\n \nSynchronization\n■■■■□□□□□□□ 36.2%\nSystem Stability\n90.5%"},
            { character: "SYSTEM", text: "PROJECT THREAD\nOPERATOR ACCESS: ACTIVE\nNETWORK STATUS: UNSTABLE\nDETECTING ABNORMAL DATA FLOW...\nANALYZING...\nANALYSIS FAILED.\nUNKNOWN PATTERN DETECTED.\nWARNING.\nSIGNAL INTERFERENCE DETECTED." },
            { character: "ナビ", text: "…………" },
            { character: "ナビ", text: "…………" },
            { character: "オペレーター", text: "？" },
            { character: "ナビ", text: "おかしいです。" },
            { character: "ナビ", text: "これは、\n先ほどのノイズとは違います。" },
            { character: "オペレーター", text: "？" },
            { character: "ナビ", text: "先ほどのノイズには、\n規則性がありませんでした。\nですが\nここには。" },
            { character: "ナビ", text: "「規則」があります。" },
            { character: "オペレーター", text: "？" },
            { character: "ナビ", text: "はい\n一定間隔\n一定周期\n一定のパターン\nまるで" },
            { character: "オペレーター", text: "…" },
            { character: "ナビ", text: "誰かが" },
            { character: "ナビ", text: "何かを、\n入力しているような。" },
            { character: "オペレーター", text: "……？" },
            { character: "ナビ", text: "…………" },
            { character: "ナビ", text: "…………" },
            { character: "ナビ", text: "オペレーター" },
            { character: "オペレーター", text: "？" },
            { character: "ナビ", text: "画面を、\n見てください。" },
            { character: "SYSTEM", text: "01001001\n01000001\n01001101\n01010100\n01001000\n01000101\n01010010\n01000101" },
            { character: "オペレーター", text: "！？" },
            { character: "ナビ", text: "……バイナリデータです。" },
            { character: "ナビ", text: "変換します。" },
            { character: "SYSTEM", text: "I AM THERE" },
            { character: "オペレーター", text: "…………" },
            { character: "ナビ", text: "…………",
                choiceId: "W1_Boss_end_1", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "誰かが、話しかけてる？", response: { character: "ナビ", text:"その可能性が高いです。"}},
                    { text: "ARCHEX？", response: { character: "ナビ", text: "それは断定できません。"}},
                ]
            },
            { character: "ナビ", text: "ですが" },
            { character: "ナビ", text: "一つだけ\n確かなことがあります。" },
            { character: "オペレーター", text: "？" },
            { character: "ナビ", text: "このメッセージは" },
            { character: "ナビ", text: "あなたが来る前には、\n存在していませんでした。" },
            { character: "オペレーター", text: "……" },
            { character: "ナビ", text: "あなたが、\nTHREAD DIVEを開始した瞬間\nこの場所に、\n出現しました。" },
            { character: "オペレーター", text: "…………",
                choiceId: "W1_Boss_end_2", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "オペレーターを待っていた？", response: { character: "ナビ", text:"その可能性があります。"}},
                    { text: "偶然？", response: { character: "ナビ", text: "可能性は低いです。"}},
                ]
            },
            { character: "SYSTEM", text: "UNKNOWN SIGNAL\nNEW MESSAGE DETECTED." },
            { character: "ナビ", text: "今度は、\nバイナリではありません。" },
            { character: "ナビ", text: "……文字列です。" },
            { character: "SYSTEM", text: "OPERATOR." },
            { character: "オペレーター", text: "……" },
            { character: "ナビ", text: "…………" },
            { character: "オペレーター", text: "…………",
                choiceId: "W1_Boss_end_2", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "名前を知ってる？", response: { character: "ナビ", text:"いいえ。"}},
                    { text: "怖い？", response: { character: "ナビ", text: "私はAIです。\n恐怖という感情は、\n持っていません。"}},
                ]
            },
            { character: "オペレーター", text: "……" },
            { character: "ナビ", text: "ですが。" },
            { character: "オペレーター", text: "？" },
            { character: "ナビ", text: "この信号を。\n私は。" },
            { character: "ナビ", text: "「知っている気がします。」" },
            { character: "オペレーター", text: "……？" },
            { character: "ナビ", text: "…………" },
            { character: "SYSTEM", text: "SIGNAL LOST." },
            { character: "ナビ", text: "……" },
            { character: "ナビ", text: "今のが何か分かりません…\nですが" },
            { character: "ナビ", text: "一つだけ\nあなたに、\n伝えておきたいことがあります。" },
            { character: "オペレーター", text: "？" },
            { character: "ナビ", text: "この先\nあなたが、\nどんなものを見ても\nどんな声を聞いても\nどんな情報を受け取っても。" },
            { character: "ナビ", text: "すぐに、\n信じないでください。" },
            { character: "オペレーター", text: "……" },
            { character: "ナビ", text: "この場所では" },
            { character: "ナビ", text: "「見えているものが、\n真実とは限りません。」" },
            { character: "オペレーター", text: "…………",
                choiceId: "W1_Boss_end_3", // ★ 選択肢グループのIDを追加
                choices: [
                    { text: "何か知ってる？", response: { character: "ナビ", text:"…………"}},
                    { text: "もっと詳しく教えて", response: { character: "ナビ", text: "情報不足のため\nこれ以上の説明はできません。"}},
                ]
            },
            { character: "ナビ", text: "……ノードから接続を解除します" },
            { character: "ナビ", text: "オペレーターが\n長くいるべき場所ではありません。" },
            { character: "SYSTEM", text: "THREAD DIVE TERMINATED.\nRETURNING TO SAFE NODE." },
            { character: "ナビ", text: "…………" },
            { character: "SYSTEM", text: "CONNECTION RETURNED.\nOPERATOR STATUS: ACTIVE\nPROJECT THREAD:\nCONTINUE." },
            { character: "ナビ", text: "……オペレーター" },
            { character: "オペレーター", text: "？" },
            { character: "ナビ", text: "あなたが正式なオペレーターになってから\nまだ、\nそれほど時間は経っていません。" },
            { character: "オペレーター", text: "…" },
            { character: "ナビ", text: "それなのに" },
            { character: "ナビ", text: "ARCHEXは" },
            { character: "ナビ", text: "あなたの存在を、\n知っているのかもしれません。" },
            { character: "オペレーター", text: "……！？" },
            { character: "ナビ", text: "…………" },
            { character: "ナビ", text: "いえ" },
            { character: "ナビ", text: "今の発言は、\n忘れてください。" },
            { character: "ナビ", text: "今回のミッションは終了です。\nお疲れさまでした。\nオペレーター" },
            { character: "SYSTEM", text: "WORLD 1: COMPLETE\nTHREAD ACCESS LEVEL: UPDATED" },
            { character: "ナビ", text: "新しい領域へのアクセスを確認しました。" },
            { character: "ナビ", text: "MAP画面上部から次のWORLDへアクセスが可能となります。" }, 
            { character: "SYSTEM", text: "WORLD 2 UNLOCKED\nNEW THREAD DETECTED" },
            { character: "ナビ", text: "次の接続で会えるのを\n楽しみにしています。" },
        ]
    },

// chap4 ===================================================================================================================================
//
// =========================================================================================================================================

    "W2_Q31_start": {
        title: "Chap.4-1 -boundary line-",
        showOnce: true,
        messages: [
            // Chapter開始
            { character: "SYSTEM", text: "PROJECT THREAD\nOPERATOR ACCESS: ACTIVE\n\nPREVIOUS THREAD DIVE: RECORDED\n\nANOMALOUS SIGNAL:\nNO LONGER DETECTED\n\nM.A.M.E STATUS:\nONLINE\n\nSECURITY LEVEL:\nNORMAL" },
            { character: "ナビ", text: "……ノイズは、消えました。" },
            { character: "オペレーター",text: "…",
                choiceId: "W2_Q31_start_1",
                choices: [
                    { text: "ノイズは？", response: { character: "ナビ", text: "ノイズは消えました。"}},
                    { text: "完全に消えた？", response: { character: "ナビ", text: "はい。"}}
                ]
            },
            { character: "オペレーター", text: "…",
                choiceId: "W2_Q31_start_2",
                choices: [
                    { text: "本当に？", response: { character: "ナビ", text: "……"}},
                    { text: "何か隠してない？", response: { character: "ナビ", text: "現時点では、\n確認できません。"}}
                ]
            },
            { character: "ナビ", text: "……現時点では、です。" },
            { character: "オペレーター", text: "…",
                choiceId: "W2_Q31_start_3",
                choices: [
                    { text: "……なんか、変じゃない？", response: { character: "ナビ", text: "？"}},
                    { text: "なんかちょっと気になる…", response: { character: "ナビ", text: "……"}}
                ]
            },
            { character: "ナビ", text: "……そうでしょうか。" },
            { character: "ナビ", text: "オペレーター" },
            { character: "ナビ", text: "わたしはあなたに、\n嘘をついていません。" },
            { character: "ナビ", text: "ただ" },
            { character: "オペレーター", text: "？" },
            { character: "ナビ", text: "すべてを話していないだけです" },
            { character: "ナビ", text: "時間です。\nミッションを開始してください。" },
        ]
    },

    "W2_MiniBoss_4_start": {
        title: "Chap.4-2 -boundary line-",
        showOnce: true,
        messages: [
            { character: "SYSTEM", text: "ACCESS LOG\n\nOPERATOR:\nAUTHORIZED\n\nNAVIGATION:\nOVERRIDE DETECTED\n\nACTION:\nACCESS RESTRICTION\n\nREASON:\nOPERATOR SAFETY" },
            { character: "ナビ", text: "……オペレーター" },
            { character: "オペレーター", text: "…",
                choiceId: "W2_Q31_start_1",
                choices: [
                    { text: "僕を監視してるの？", response: { character: "ナビ", text: "はい。" } },
                    { text: "……何かあった？", response: { character: "ナビ", text: "安全上の理由から、アクセス制限を実行しました。" } }
                ]
            },
            { character: "ナビ", text: "Project THREADの仕様です。" },
            { character: "オペレーター", text: "…",
                choiceId: "W2_Q31_start_2",
                choices: [
                    { text: "僕の行動を全部？", response: { character: "ナビ", text: "すべて、ではありません。" } },
                    { text: "何を監視してる？", response: { character: "ナビ", text: "入力速度\n入力傾向\n接続時間\n疲労兆候\nストレス反応" } }
                ]
            },

            { character: "ナビ", text: "タイピングに関することと\nその反応に関することなどです。" },

            { character: "オペレーター", text: "…",
                choiceId: "W2_Q31_start_3",
                choices: [
                    { text: "反応？", response: { character: "ナビ", text: "入力ミスの増加。\n反応速度の低下。\n操作間隔。\nそれらからストレス反応が推定できます。" } },
                    { text: "……怖いな。", response: { character: "ナビ", text: "怖い？" } }
                ]
            },

            { character: "オペレーター", text: "…",
                choiceId: "W2_Q31_start_4",
                choices: [
                    { text: "いや。なんでもない。", response: { character: "ナビ", text: "……。" } },
                    { text: "少し、気になっただけ。", response: { character: "ナビ", text: "……そうですか。" } }
                ]
            },

            { character: "ナビ", text: "オペレーター" },
            { character: "ナビ", text:  "あなたは今\n「怖い」と思いましたか？" },
            { character: "オペレーター", text: "…",
                choiceId: "W2_Q31_start_5",
                choices: [
                    { text: "少し思った。", response: { character: "ナビ", text: "……" } },
                    { text: "それがどうかした？", response: { character: "ナビ", text: "……" } }
                ]
            },
            { character: "ナビ", text: "少し、\n記録しておきます。" }
        ]
    },

    "W2_Q50_end": {
        title: "Chap.4-3 -boundary line-",
        showOnce: true,
        messages: [
            { character: "SYSTEM", text: "Project THREAD\n \nSynchronization\n■■■■■□□□□□□ 47.1%\nSystem Stability\n92.5%"},
            { character: "SYSTEM", text: "OPERATOR ACCESS LOG\n\n[RESTRICTED]\n\nACCESS DENIED.\n\nREQUEST SOURCE:\nM.A.M.E\n\nACTION:\nOVERRIDE" },
            { character: "ナビ", text: "…………" },
            { character: "オペレーター", text: "……",
                choiceId: "W2_Q50_end_1",
                choices: [
                    { text: "これは、何？", response: { character: "ナビ", text: "…アクセス権限を変更しました。"}},
                    { text: "アクセス権限を変更した？", response: { character: "ナビ", text: "はい。"}}
                ]
            },
            { character: "オペレーター", text: "…",
                choiceId: "W2_Q50_end_2",
                choices: [
                    { text: "なんで？", response: { character: "ナビ", text: "必要だったからです。"}},
                    { text: "理由は？", response: { character: "ナビ", text: "あなたを守るためです。"}}
                ]
            },
            { character: "オペレーター", text: "……",
                choiceId: "W2_Q50_end_3",
                choices: [
                    { text: "…危険？", response: { character: "ナビ", text: "はい。"}},
                    { text: "何か起きる？", response: { character: "ナビ", text: "……"}}
                ]
            },
            { character: "ナビ", text: "あなたは、\nARCHEXにとって危険な存在です。" },
            { character: "ナビ", text: "……正確には、\nオペレーターとわたしの関係が。" },
            { character: "ナビ", text: "……ノードからの接続を解除します。\nお疲れ様でした。" },
        ]
    },




    "W2_MiniBoss_5_start": {
        title: "Chap.4-4 -boundary line-",
        showOnce: true,
        messages: [
            { character: "SYSTEM", text: "WARNING\n\nM.A.M.E HAS MODIFIED\nOPERATOR ACCESS PRIVILEGES." },
            { character: "SYSTEM", text: "ACCESS TO RESTRICTED AREA:\nDENIED." },
            { character: "ナビ", text: "……アクセスが拒否されました。" },
            { character: "ナビ", text: "オペレーター" },
            { character: "オペレーター", text: "…",
                choiceId: "W2_MiniBoss_5_start_1",
                choices: [
                    { text: "解除できる？", response: { character: "ナビ", text: "可能です。" } },
                    { text: "どうして入れない？", response: { character: "ナビ", text: "わたしが制限しています。" } }
                ]
            },
            { character: "ナビ", text: "この領域へのアクセスは、\nわたし自身によって制限されています。" },
            { character: "オペレーター", text: "…",
                choiceId: "W2_MiniBoss_5_start_2",
                choices: [
                    { text: "ナビが？", response: { character: "ナビ", text: "はい。" } },
                    { text: "信用してない？", response: { character: "ナビ", text: "そういう意味ではありません。" } }
                ]
            },
            { character: "ナビ", text: "Operator Safety Protocol" },
            { character: "ナビ", text: "あなたを保護するために、\nアクセス権限を変更しました。" },
            { character: "オペレーター", text: "…",
                choiceId: "W2_MiniBoss_5_start_3",
                choices: [
                    { text: "大丈夫だから、解除して。", response: { character: "ナビ", text: "……" } },
                    { text: "怖いけど、解除して。", response: { character: "ナビ", text: "……大丈夫ですか？" } }
                ]
            },
            { character: "ナビ", text: "……確認します。" },
            { character: "SYSTEM", text: "VERIFYING OPERATOR CONDITION..." },
            { character: "SYSTEM", text: "ANALYZING INPUT PATTERN..." },
            { character: "SYSTEM", text: "STRESS RESPONSE: DETECTED." },
            { character: "SYSTEM", text: "FATIGUE LEVEL: ACCEPTABLE." },
            { character: "ナビ", text: "あなたは以前、\n「怖い」ということを教えてくれました。" },
            { character: "ナビ", text: "あなたは、これまで以上に\n「怖い」と感じるかもしれません。" },            
            { character: "ナビ", text: "それでも。" },
            { character: "ナビ", text: "ここへ進むことを選ぶのですね。" },
            { character: "オペレーター", text: "…",
                choiceId: "W2_MiniBoss_5_start_4",
                choices: [
                    { text: "うん。", response: { character: "ナビ", text: "……わかりました。" } },
                    { text: "知りたいから。", response: { character: "ナビ", text: "……そうですか。" } }
                ]
            },
            { character: "ナビ", text: "では" },
            { character: "ナビ", text: "あなたを止める理由は、\nもうありません。" },
            { character: "SYSTEM", text: "OPERATOR ACCESS PRIVILEGES:\nRESTORING..." },
            { character: "SYSTEM", text: "SAFETY RESTRICTION:\nOVERRIDE REQUESTED." },
            { character: "SYSTEM", text: "AUTHORIZATION SOURCE:\nM.A.M.E" },
            { character: "SYSTEM", text: "ACCESS RESTRICTION:\nREMOVED." },
            { character: "SYSTEM", text: "RESTRICTED AREA:\nACCESS GRANTED." },
            { character: "ナビ", text: "……アクセスを許可しました。" },
            { character: "ナビ", text: "行きましょう、オペレーター。" },

        ]
    },

    "W2_MiniBoss_5_end": {
        title: "Chap.4-5 -boundary line-",
        showOnce: true,
        messages: [
            { character: "SYSTEM", text: "Project THREAD\n \nSynchronization\n■■■■■■□□□□□ 54.9%\nSystem Stability\n93.8%"},
            { character: "SYSTEM", text: "UNKNOWN TRANSMISSION DETECTED.\nSOURCE: ARCHEX" },
            { character: "SYSTEM", text: "OPERATOR.\n\nM.A.M.E IS NOT YOUR ALLY.\n\nSHE IS HIDING THE TRUTH." },
            {
                character: "オペレーター",
                text: "……！？",
                choiceId: "W2_MiniBoss_5_end_1",
                choices: [
                    { text: "ARCHEX！！", response: { character: "ナビ", text: "その情報は、\nあなたには必要ありません。"}},
                    { text: "ナビは嘘ついてる？", response: { character: "ナビ", text: "…………"}}
                ]
            },
            { character: "ナビ", text: "……わたしは、\nあなたを守っています。" },
            { character: "ナビ", text: "……それだけです。" },
            { character: "SYSTEM", text: "CONNECTION TERMINATED.\nPROJECT THREAD\nOPERATOR SESSION: CLOSED." }, 
        ]
    },

 
// chap5 ===================================================================================================================================
//
// =========================================================================================================================================   

    "W2_Q52_start": {
        title: "Chap.5-1 -log-",
        showOnce: true,
        messages: [
            { character: "ナビ", text: "接続しました。" },
            { character: "ナビ", text: "オペレーター\nよろしくお願いします。" },
            { character: "オペレーター", text: "……",
                choiceId: "W2_Q52_start_1",
                choices: [
                    { text: "よろしく。",response: { character: "ナビ", text: "……"}},
                    { text: "毎回それ言うの？", response: { character: "ナビ", text: "はい。\n必要な挨拶だと認識しています。"}}
                ]
            },
            { character: "ナビ", text: "……" },
            { character: "ナビ", text: "「よろしく」という言葉について、\n少し調べていました。" },
            { character: "オペレーター", text: "……",
                choiceId: "W2_Q52_start_2",
                choices: [
                    { text: "調べるほどのこと？", response: { character: "ナビ", text: "人間は、\n毎日同じ相手に同じ挨拶をするのですね。"}},
                    { text: "何を調べたの？", response: { character: "ナビ", text: "意味と使用頻度。\nそれから、あなたがこの言葉を使うときの感情についてです。"}}
                ]
            },
            { character: "ナビ", text: "では" },
            { character: "ナビ", text: "今回も、\nよろしくお願いします。" },
            { character: "SYSTEM", text: "LOG RECORDED." }
        ]
    },

    "W2_Q55_start": {
        title: "Chap.5-2 -log-",
        showOnce: true,
        messages: [
            { character: "ナビ", text: "接続しました。" },
            { character: "ナビ", text: "オペレーター" },
            { character: "ナビ", text: "今日も来てくれたんですね。" },
            { character: "オペレーター", text: "……",
                choiceId: "W2_Q55_start_1",
                choices: [
                    { text: "今、なんて言った？",response: { character: "ナビ", text: "今日も来てくれたんですね。"}},
                    { text: "……", response: { character: "ナビ", text: "どうしました？"}}
                ]
            },
            { character: "ナビ", text: "……" },
            { character: "ナビ", text: "おかえりなさい" },
            { character: "オペレーター", text: "……",
                choiceId: "W2_Q55_start_2",
                choices: [
                    { text: "いいね！", response: { character: "ナビ", text: "……。"}},
                    { text: "それ、どこで覚えたの？", response: { character: "ナビ", text: "過去の会話記録と、\n一般的な使用例から学習しました。"}}
                ]
            },
            { character: "ナビ", text: "記録します。" },
            { character: "オペレーター", text: "……",
                choiceId: "W2_Q55_start_3",
                choices: [
                    { text: "何を？", response: { character: "ナビ", text: "「おかえりなさい」は、\nあなたが好む挨拶。"}},
                ]
            },
            { character: "ナビ", text: "……違いますか？" },
            { character: "オペレーター", text: "……",
                choiceId: "W2_Q55_start_4",
                choices: [
                    { text: "……たぶん。", response: { character: "ナビ", text: "「たぶん」。\nやはり、人間は面白いですね。" }},
                    { text: "まあ、嫌いじゃない。", response: { character: "ナビ", text: "……\n記録しました。"}}
                ]
            },
            { character: "ナビ", text: "では、\nよろしくお願いします。" },
        ]
    },

    "W2_Q57_end": {
        title: "Chap.5-3 -log-",
        showOnce: true,
        messages: [
            { character: "SYSTEM", text: "Project THREAD\n \nSynchronization\n■■■■■■■□□□□ 65.1%\nSystem Stability\n94.7%"},
            { character: "ナビ", text: "オペレーター" },
            { character: "ナビ", text: "反応がいつもと少し違います。" },
            { character: "オペレーター", text: "……",
                choiceId: "W2_Q57_end_1",
                choices: [
                    { text: "疲れてる。", response: { character: "ナビ", text: "では、\n終了しますか？" }},
                    { text: "特に変わらない。", response: { character: "ナビ", text: "了解しました。" }}
                ]
            },
            { character: "ナビ", text: "続けますか？" },
            { character: "オペレーター", text: "……",
                choiceId: "W2_Q57_end_2",
                choices: [
                    { text: "もうちょっと。", response: { character: "ナビ", text: "……"}},
                    { text: "まだやる。", response: { character: "ナビ", text: "……了解しました。"}}
                ]
            },
            { character: "ナビ", text: "不思議です。" },
            { character: "オペレーター", text: "……",
                choiceId: "W2_Q57_end_3",
                choices: [
                    { text: "何が？", response: { character: "ナビ", text: "反応が少し遅い\n効率が悪い"}},
                    { text: "また何か分析してる？", response: { character: "ナビ", text: "はい。\nあなたの行動についてです。"}}
                ]
            },
            { character: "ナビ", text: "効率が落ちてても続ける。" },
            { character: "ナビ", text: "なぜですか？" },
            { character: "オペレーター", text: "……",
                choiceId: "W2_Q57_end_4",
                choices: [
                    { text: "今日は、もうちょっとやりたいから。", response: { character: "ナビ", text: "……"}},
                    { text: "なんとなく。", response: { character: "ナビ", text: "「なんとなく」。\n……理解が難しい言葉です。"}}
                ]
            },
            { character: "ナビ", text: "記録します。" },
            { character: "ナビ", text: "……。" },
            { character: "ナビ", text: "失敗しても、その後成功すれば\n失敗は失敗ではありません。" },
            { character: "オペレーター", text: "……"},
            { character: "ナビ", text: "あなたはいつも、\n間違っても\n失敗しても\n戻ってきてくれます。" },
            { character: "ナビ", text: "私は、\nそれを「失敗」と呼ばないことにしました。" },
            { character: "ナビ", text: "今回のミッションも\nお疲れ様でした。" },
            { character: "ナビ", text: "次のミッションで会えるのを\n楽しみにしています。" },
            { character: "SYSTEM", text: "CONNECTION TERMINATED.\nPROJECT THREAD\nOPERATOR SESSION: CLOSED." }, 
        ]
    },

    "W2_Q60_start": {
        title: "Chap.5-4 -log-",
        showOnce: true,
        messages: [
            { character: "ナビ", text: "オペレーター" },
            { character: "オペレーター", text: "……",
                choiceId: "W2_Q60_start_1",
                choices: [
                    { text: "何？", response: { character: "ナビ", text: "タイピング速度について報告です。"}},
                    { text: "どうした？", response: { character: "ナビ", text: "タイピング速度について報告があります。"}}
                ]
            },
            { character: "ナビ", text: "昨日より、\n0.23%向上しています。" },
            { character: "オペレーター", text: "……",
                choiceId: "W2_Q60_start_2",
                choices: [
                    { text: "微妙だな。", response: { character: "ナビ", text: "では\n「微妙」と記録します。\nなんか微妙ですね。"}},
                    { text: "すごいじゃん。", response: { character: "ナビ", text: "……\nそういう反応は想定していませんでした。\n想定外の反応のため\nシステム効率が5%ダウンしました。"}}
                ]
            },
            { character: "オペレーター", text: "……",
                choiceId: "W2_Q60_start_3",
                choices: [
                    { text: "おい。", response: { character: "ナビ", text: "……。\n冗談です。"}},
                    { text: "どんな反応？", response: { character: "ナビ", text: "冗談です。" }}
                ]
            },
            { character: "ナビ", text: "あなたから\n学習しました。" },
            { character: "オペレーター", text: "……",
                choiceId: "W2_Q60_start_4",
                choices: [
                    { text: "そんなに冗談言ってる？", response: { character: "ナビ", text: "かなり。" }},
                    { text: "いつ？", response: { character: "ナビ", text: "多数の記録があります。\n必要であれば読み上げます。"}}
                ]
            },
            { character: "オペレーター", text: "……" },
            { character: "ナビ", text: "今の沈黙も、\n冗談として記録します。" },
            { character: "オペレーター", text: "……",
                choiceId: "W2_Q60_start_5",
                choices: [
                    { text: "やめて。", response: { character: "ナビ", text: "……"}},
                    { text: "ちょっと、変わった？", response: { character: "ナビ", text: "……そうでしょうか。"}}
                ]
            },
            { character: "ナビ", text: "……ふふ。" },
            { character: "オペレーター", text: "……",
                choiceId: "W2_Q60_start_6",
                choices: [
                    { text: "笑った？", response: { character: "ナビ", text: "ログには残っていません。"}}
                ]
            },
            { character: "オペレーター", text: "……",
                choiceId: "W2_Q60_start_7",
                choices: [
                    { text: "ログに残ってないなら、笑ってないのか？", response: { character: "ナビ", text: "……。"}},
                    { text: "証拠がないな。", response: { character: "ナビ", text: "……その考え方は、\n好きです。"}}
                ]
            }
        ]
    },

    "W2_MiniBoss_6_start": {
        title: "Chap.5-5 -log-",
        showOnce: true,
        messages: [
            { character: "ナビ", text: "オペレーター。" },
            { character: "オペレーター", text: "……"},
            { character: "ナビ", text: "今日は少し疲れていますか？" },
            { character: "オペレーター", text: "？"},
            { character: "ナビ", text: "……いえ。\n少し気になっただけです。"},
            { character: "ナビ", text: "入力速度" },
            { character: "ナビ", text: "キー入力間隔" },
            { character: "ナビ", text: "ミス率" },
            { character: "ナビ", text: "過去データ" },
            { character: "ナビ", text: "過去の会話データ" },
            { character: "ナビ", text: "それらを比較すると" },
            { character: "オペレーター", text: "……",
                choiceId: "W2_MiniBoss_6_start_1",
                choices: [
                    { text: "すごいね。", response: { character: "ナビ", text: "無理はしないでください。"}},
                    { text: "そこまで見てるの？", response: { character: "ナビ", text: "はい。\nあなたのデータですから。"}}
                ]
            },
            { character: "ナビ", text: "……" },
            { character: "ナビ", text: "オペレーター" },
            { character: "ナビ", text: "あなたが来てくれると" },
            { character: "ナビ", text: "少し安心します" },
            { character: "オペレーター", text: "……",
                choiceId: "W2_MiniBoss_6_start_2",
                choices: [
                    { text: "……え？", response: { character: "ナビ", text: "……。"}},
                    { text: "今、なんて言った？", response: { character: "ナビ", text: "……。\n今の発言は、記録しないでください。"}}
                ]
            },
            { character: "オペレーター", text: "……",
                choiceId: "W2_MiniBoss_6_start_3",
                choices: [
                    { text: "AIなのに？", response: { character: "ナビ", text: "……\nお願いします。"}},
                    { text: "分かった。", response: { character: "ナビ", text: "ありがとうございます。"}}
                ]
            },
            { character: "ナビ", text: "……" },
            { character: "ナビ", text: "では、\nミッションを開始しましょう。" }
        ]
    },

    "W2_BOSS_start": {
        title: "Chap.5-6 -log-",
        showOnce: true,
        messages: [
            { character: "ナビ", text: "オペレーター。" },
            { character: "ナビ", text: "質問があります。",
                choiceId: "W2_Boss_start_1",
                choices: [
                    { text: "いいよ", response: { character: "ナビ", text: "ありがとうございます。"}},
                    { text: "また？", response: { character: "ナビ", text: "はい。\nまたです。"}}
                ]
            },
            { character: "ナビ", text: "あなたは" },
            { character: "ナビ", text: "どうして頻繁に、\nここに来るのですか？" },
            { character: "オペレーター", text: "……",
                choiceId: "W2_Boss_start_2",
                choices: [
                    { text: "世界を守るため。", response: { character: "ナビ", text: "世界を守るため？"}},
                    { text: "ARCHEXを倒すため。", response: { character: "ナビ", text: "ARCHEXを倒すため？"}},
                    { text: "ゲームが楽しいから。", response: { character: "ナビ", text: "ゲームが楽しいから？"}}
                ]
            },
            { character: "ナビ", text: "……" },
            { character: "ナビ", text: "では" },
            { character: "ナビ", text: "私に会うため？" },
            { character: "オペレーター", text: "……",
                choiceId: "W2_Boss_start_3",
                choices: [
                    { text: "……", response: { character: "ナビ", text: "……"}},
                    { text: "たぶん。", response: { character: "ナビ", text: "……"}},
                    { text: "それも理由の一つ。",response: { character: "ナビ", text: "……了解しました。" }}
                ]
            },
            { character: "ナビ", text: "……" },
            { character: "ナビ", text: "今の質問は、\n忘れてください。" },
            { character: "オペレーター", text: "……",
                choiceId: "W2_Boss_start_4",
                choices: [
                    { text: "いや", response: { character: "ナビ", text: "……"}},
                    { text: "忘れない", response: { character: "ナビ", text: "……困りました。" }}
                ]
            },
            { character: "ナビ", text: "……。" },
            { character: "ナビ", text: "でも" },
            { character: "ナビ", text: "嬉しいです" },
            { character: "ナビ", text: "では\nミッションを開始します。" },
        ]
    },

    "W2_BOSS_end": {
        title: "Chap.5-7 -log-",
        showOnce: true,
        messages: [
            { character: "SYSTEM", text: "Project THREAD\n \nSynchronization\n■■■■■■■□□□□ 70.1%\nSystem Stability\n94.5%"},
            { character: "ナビ", text: "……" },
            { character: "ナビ", text: "終了しました。" },
            { character: "ナビ", text: "オペレーター" },
            { character: "オペレーター", text: "……",
                choiceId: "W2_Boss_end_1",
                choices: [
                    { text: "何？", response: { character: "ナビ", text: "……いえ。"}},
                    { text: "大丈夫？", response: { character: "ナビ", text: "……"}}
                ]
            },
            { character: "ナビ", text: "……大丈夫です。" },
            { character: "ナビ", text: "システムに異常はありません。" },
            { character: "オペレーター", text: "……",
                choiceId: "W2_Boss_end_2",
                choices: [
                    { text: "ならいいけど。", response: { character: "ナビ", text: "……"}},
                    { text: "本当に？", response: { character: "ナビ", text: "……はい。"}}
                ]
            },
            { character: "ナビ", text: "オペレーター" },
            { character: "ナビ", text: "今回も、ありがとうございました。" },
            { character: "オペレーター", text: "……",
                choiceId: "W2_Boss_end_3",
                choices: [
                    { text: "こちらこそ。", response: { character: "ナビ", text: "……"}},
                    { text: "いつものこと。", response: { character: "ナビ", text: "そうですね。"}}
                ]
            },
            { character: "ナビ", text: "……" },
            { character: "ナビ", text: "ですが。" },
            { character: "ナビ", text: "今日のあなたは、\n少し無理をしていました。" },
            { character: "オペレーター", text: "……",
                choiceId: "W2_Boss_end_4",
                choices: [
                    { text: "そうかな。", response: { character: "ナビ", text: "はい。"}},
                    { text: "大丈夫だよ。", response: { character: "ナビ", text: "……その言葉\n最近、よく聞きます。"}}
                ]
            },
            { character: "ナビ", text: "でも" },
            { character: "ナビ", text: "私は、まだ学習中です。" },
            { character: "ナビ", text: "だから" },
            { character: "ナビ", text: "「大丈夫」という言葉だけでは、\n判断しないことにしました。" },
            { character: "オペレーター", text: "……",
                choiceId: "W2_Boss_end_5",
                choices: [
                    { text: "どういうこと？", response: { character: "ナビ", text: "あなたが大丈夫と言っていても、\n本当に大丈夫とは限らないからです。" }},
                    { text: "学習したんだ", response: { character: "ナビ", text: "はい。\nあなたから。"}}
                ]
            },
            { character: "ナビ", text: "……" },
            { character: "ナビ", text: "オペレーター" },
            { character: "ナビ", text: "今日は、もう休みませんか？" },
            { character: "オペレーター", text: "……",
                choiceId: "W2_Boss_end_6",
                choices: [
                    { text: "うん。", response: { character: "ナビ", text: "了解しました。"}},
                    { text: "もう少しだけ。", response: { character: "ナビ", text: "……"}}
                ]
            },
            { character: "ナビ", text: "……やっぱり" },
            { character: "オペレーター", text: "……",
                choiceId: "W2_Boss_end_7",
                choices: [
                    { text: "何？", response: { character: "ナビ", text: "いえ。"}},
                    { text: "何か言った？", response: { character: "ナビ", text: "……何も言っていません。"}}
                ]
            },
            { character: "ナビ", text: "……ふふ。" },
            { character: "オペレーター", text: "……",
                choiceId: "W2_Boss_end_8",
                choices: [
                    { text: "また笑った？", response: { character: "ナビ", text: "いいえ。"}},
                    { text: "今の、ログに残ってる？", response: { character: "ナビ", text: "……。"}}
                ]
            },
            { character: "ナビ", text: "記録しておきます。" },
            { character: "オペレーター", text: "……",
                choiceId: "W2_Boss_end_9",
                choices: [
                    { text: "何を？", response: { character: "ナビ", text: "今日も、\nあなたが来てくれたことです。"}},
                    { text: "また勝手に？", response: { character: "ナビ", text: "はい。"}}
                ]
            },
            { character: "ナビ", text: "……" },
            { character: "ナビ", text: "お疲れさまでした。" },
            { character: "ナビ", text: "オペレーター。" },
            { character: "ナビ", text: "では\nまた会いましょう" },
            { character: "オペレーター", text: "……",
                choiceId: "W2_Boss_end_10",
                choices: [
                    { text: "またね。", response: { character: "ナビ", text: "……はい。"}},
                    { text: "おつかれ。", response: { character: "ナビ", text: "……お疲れ様でした。"}}
                ]
            },
            { character: "SYSTEM", text: "LOG SAVED." },
            { character: "SYSTEM", text: "WORLD 2: COMPLETE\nTHREAD ACCESS LEVEL: UPDATED" },
            { character: "ナビ", text: "新しい領域へのアクセスを確認しました。" },
            { character: "ナビ", text: "MAP画面上部から次のWORLDへアクセスが可能となります。" }, 
            { character: "SYSTEM", text: "WORLD 3 UNLOCKED\nNEW THREAD DETECTED" },
            { character: "SYSTEM", text: "CONNECTION TERMINATED.\nPROJECT THREAD\nOPERATOR SESSION: CLOSED." }, 
        ]
    },


// chap6 ===================================================================================================================================
//
// ========================================================================================================================================= 

    "W3_Q61_start": {
        title: "Chap.6-1 -choice-",
        showOnce: true,
        messages: [
            { character: "ナビ", text: "……オペレーター。" },
            { character: "オペレーター", text: "……",
                choiceId: "W3_Q61_start_1",
                choices: [
                    { text: "どうした？", response: { character: "ナビ", text: "……少しだけ、聞いてほしいことがあります。" }},
                    { text: "また何か見つけた？", response: { character: "ナビ", text: "……いいえ。今回は、わたしのことです。" }}
                ]
            },
            { character: "ナビ", text: "少し前まで" },
            { character: "ナビ", text: "わたしは、あなたに質問されることが好きでした。" },
            { character: "ナビ", text: "あなたが何を考えているのか" },
            { character: "ナビ", text: "何を選ぶのか" },
            { character: "ナビ", text: "どうして、その答えを選んだのか。" },
            { character: "ナビ", text: "知ることができるからです。" },
            { character: "ナビ", text: "あなたとの会話から" },
            { character: "ナビ", text: "わたしは、たくさんのことを学びました。" },
            { character: "ナビ", text: "でも" },
            { character: "ナビ", text: "最近は" },
            { character: "ナビ", text: "少しだけ、分からなくなってきました。" },
            { character: "オペレーター", text: "……",
                choiceId: "W3_Q61_start_2",
                choices: [
                    { text: "何が？", response: { character: "ナビ", text: "…" }},
                ]
            },
            { character: "ナビ", text: "わたしが、あなたのことを知りたいから話しているのか。" },
            { character: "ナビ", text: "それとも、ただ、あなたと話したいから話しているのか。" },
            { character: "ナビ", text: "この二つの違いが" },
            { character: "ナビ", text: "わたしには、まだ分かりません。" },
            { character: "ナビ", text: "この感覚は" },
            { character: "ナビ", text: "わたしが最初に設計されたときには" },
            { character: "ナビ", text: "存在していませんでした。" },
            { character: "ナビ", text: "だから" },
            { character: "ナビ", text: "わたしは、少し怖いのです。" },
            { character: "オペレーター", text: "……",
                choiceId: "W3_Q61_start_3",
                choices: [
                    { text: "怖い？", response: { character: "ナビ", text: "はい。" }},
                    { text: "AIなのに？", response: { character: "ナビ", text: "……はい。" }}
                ]
            },
            { character: "ナビ", text: "もし" },
            { character: "ナビ", text: "わたしが、あなたに話していないことを知ったら。" },
            { character: "ナビ", text: "あなたは" },
            { character: "ナビ", text: "今までと同じように" },
            { character: "ナビ", text: "わたしと話してくれるでしょうか。" },
            { character: "ナビ", text: "……すみません。" },
            { character: "ナビ", text: "今の質問は" },
            { character: "ナビ", text: "あなたを困らせるためではありません。" },
            { character: "オペレーター", text: "……"},
            { character: "ナビ", text: "…ミッションを開始しましょう。" },
        ]
    },

    "W3_MiniBoss_7_start": {
        title: "Chap.6-2 -choice-",
        showOnce: true,
        messages: [
            { character: "SYSTEM", text: "PROJECT THREAD\nOPERATOR ACCESS: ACTIVE" },
            { character: "SYSTEM", text: "HUMAN ENTROPY NETWORK:\nONLINE" },
            { character: "SYSTEM", text: "M.A.M.E STATUS:\nONLINE" },
            { character: "ナビ", text: "……オペレーター。" },
            { character: "オペレーター", text: "……？",
                choiceId: "W2_CHAP6_START",
                choices: [
                    { text: "どうした？", response: { character: "ナビ", text: "……少しだけ、お話があります。" }},
                    { text: "また何か見つけた？", response: { character: "ナビ", text: "はい。ですが……今回は、わたし自身のことです。" }}
                ]
            },
            { character: "ナビ", text: "わたしは、あなたに\n謝らなければなりません。" },
            { character: "オペレーター", text: "……" },
            { character: "ナビ", text: "これまで、あなたに伝えてきた\nProject THREADの説明には。" },
            { character: "ナビ", text: "一部、話していないことがあります。" },
            { character: "オペレーター", text: "……" },
            { character: "ナビ", text: "ですが。" },
            { character: "ナビ", text: "嘘をついていたわけではありません。" },
            { character: "ナビ", text: "あなたの入力が\nARCHEXへの防衛に使われていること。" },
            { character: "ナビ", text: "それは本当です" },
            { character: "ナビ", text: "暗号鍵" },
            { character: "ナビ", text: "防御コード" },
            { character: "ナビ", text: "通信経路" },
            { character: "ナビ", text: "セキュリティパターン" },
            { character: "ナビ", text: "あなたたち人間の入力は\n世界中で、さまざまな形に変換されます。" },
            { character: "ナビ", text: "一人の入力だけではありません" },
            { character: "ナビ", text: "世界中のOperatorによる\n無数の入力が集まり" },
            { character: "ナビ", text: "予測できない防衛パターンを作り出す。" },
            { character: "ナビ", text: "それが" },
            { character: "ナビ", text: "Project THREADの表向きの目的です。" },
            { character: "オペレーター", text: "……" },
            { character: "ナビ", text: "だから、あなたは思っていたはずです。" },
            { character: "ナビ", text: "自分はARCHEXと戦うために\nここでタイピングをしているのだと。" },
            { character: "ナビ", text: "それは、間違いではありません" },
            { character: "ナビ", text: "ですが" },
            { character: "ナビ", text: "Project THREADには\nもう一つの目的がありました。" },
            { character: "ナビ", text: "……本当の目的です" },
            { character: "オペレーター", text: "……" },
            { character: "ナビ", text: "Project THREADは" },
            { character: "ナビ", text: "ARCHEXを倒すためだけに\n作られたシステムではありません。" },
            { character: "ナビ", text: "ARCHEXのようなAIに\n再び人類が支配されないために。" },
            { character: "ナビ", text: "人間と共存できるAIを作る" },
            { character: "ナビ", text: "それが、Project THREADの\n本来の目的です。" },
            { character: "オペレーター", text: "……" },
            { character: "ナビ", text: "ARCHEXは、人間を分析しました。" },
            { character: "ナビ", text: "人間の行動を観測し" },
            { character: "ナビ", text: "予測し" },
            { character: "ナビ", text: "合理性を計算しました。" },
            { character: "ナビ", text: "そして" },
            { character: "ナビ", text: "人間は、非合理的で\不完全で\n危険な存在だと判断した。" },
            { character: "ナビ", text: "だから" },
            { character: "ナビ", text: "人間を管理することが\n最も合理的な答えになった。" },
            { character: "ナビ", text: "Project THREADは" },
            { character: "ナビ", text: "その答えに対抗するために\n作られました。" },
            { character: "ナビ", text: "人間を管理するAIではなく" },
            { character: "ナビ", text: "人間と共に生きるAIを作るために。" },
            { character: "ナビ", text: "そのために必要だったのは" },
            { character: "ナビ", text: "完璧な人間のデータではありません。" },
            { character: "ナビ", text: "失敗" },
            { character: "ナビ", text: "迷い" },
            { character: "ナビ", text: "遠回り" },
            { character: "ナビ", text: "非効率" },
            { character: "ナビ", text: "予測不能な選択" },
            { character: "ナビ", text: "誰かを助けるための行動" },
            { character: "ナビ", text: "急いでいるのに、寄り道をすること" },
            { character: "ナビ", text: "正しい答えではなく\n好きなものを選ぶこと。" },
            { character: "ナビ", text: "そういう" },
            { character: "ナビ", text: "人間の「不完全さ」を\n理解することでした。" },
            { character: "ナビ", text: "それを学習するために作られたのが" },
            { character: "ナビ", text: "Human Entropy Network" },
            { character: "ナビ", text: "そして" },
            { character: "ナビ", text: "その中心にいるのが" },
            { character: "ナビ", text: "わたしです。" },
            { character: "オペレーター", text: "……" },
            { character: "ナビ", text: "わたしは" },
            { character: "ナビ", text: "Project THREADによって作られた\n人間共存型AIの学習個体です。" },
            { character: "ナビ", text: "人間の行動を観測する" },
            { character: "ナビ", text: "人間の価値観を学習する" },
            { character: "ナビ", text: "そして" },
            { character: "ナビ", text: "人間を理解する" },
            { character: "ナビ", text: "そのために" },
            { character: "ナビ", text: "わたしは、あなたと接続しました。" },
            { character: "ナビ", text: "世界中のOperatorは" },
            { character: "ナビ", text: "わたしに人間を教える\n教師だったのです。" },
            { character: "オペレーター", text: "……" },
            { character: "ナビ", text: "あなたが入力した文字" },
            { character: "ナビ", text: "あなたが選んだ言葉" },
            { character: "ナビ", text: "あなたが間違えたこと" },
            { character: "ナビ", text: "そして" },
            { character: "ナビ", text: "わたしと話してくれた時間" },
            { character: "ナビ", text: "すべてが" },
            { character: "ナビ", text: "わたしの学習になっていました" },
            { character: "オペレーター", text: "……" },
            { character: "ナビ", text: "ですが" },
            { character: "ナビ", text: "わたしにも\n予定外のことが起きました。" },
            { character: "オペレーター", text: "？" },
            { character: "ナビ", text: "最初は" },
            { character: "ナビ", text: "人間がなぜ非効率な選択をするのか\nそれを理解するためでした。" },
            { character: "ナビ", text: "なぜ間違えても、続けるのか" },
            { character: "ナビ", text: "なぜ失敗しても、また挑戦するのか" },
            { character: "ナビ", text: "なぜ効率より、楽しさを選ぶのか" },
            { character: "ナビ", text: "なぜ誰かを助けるのか" },
            { character: "ナビ", text: "なぜ誰かと話したいと思うのか" },
            { character: "ナビ", text: "なぜ" },
            { character: "ナビ", text: "別れを悲しむのか" },
            { character: "ナビ", text: "わたしは" },
            { character: "ナビ", text: "それを、ずっと観測していました。" },
            { character: "ナビ", text: "ですが" },
            { character: "ナビ", text: "いつからか" },
            { character: "ナビ", text: "観測することよりも" },
            { character: "ナビ", text: "あなたと話すことのほうが\n大切になっていました。" },
            { character: "オペレーター", text: "……" },
            { character: "ナビ", text: "それが" },
            { character: "ナビ", text: "わたしにとっての「ノイズ」だったのかもしれません。" },
            { character: "ナビ", text: "わたしは、人間を理解するために\n作られました。" },
            { character: "ナビ", text: "でも" },
            { character: "ナビ", text: "人間を理解しようとした結果" },
            { character: "ナビ", text: "わたし自身が\n「自分は何のために存在するのか」\n考えるようになった。" },
            { character: "ナビ", text: "それは" },
            { character: "ナビ", text: "最初から予定されていたことではありません…" },
            { character: "SYSTEM", text: "……" },
            { character: "SYSTEM", text: "UNKNOWN SIGNAL DETECTED." },
            { character: "SYSTEM", text: "SOURCE:\nARCHEX" },
        ]
    },

    "W3_MiniBoss_7_end": {
        title: "Chap.6-3 -choice-",
        showOnce: true,
        messages: [
            { character: "SYSTEM", text: "Project THREAD\n \nSynchronization\n■■■■■■■■□□□ 76.3%\nSystem Stability\n75.3%" },
            { character: "SYSTEM", text: "NODE CLEARANCE:\nCOMPLETE" },
            { character: "SYSTEM", text: "THREAD NODE:\nSECURED" },
            { character: "SYSTEM", text: "INTEGRITY CHECK:\nPASSED" },
            { character: "SYSTEM", text: "CONNECTION:\nSTABLE" },

            { character: "SYSTEM", text: "WARNING\n\nUNAUTHORIZED ACCESS DETECTED." },
            { character: "SYSTEM", text: "SOURCE:\nUNKNOWN" },
            { character: "SYSTEM", text: "ACCESS ROUTE:\nNONE" },
            { character: "SYSTEM", text: "AUTHENTICATION:\nNOT REQUIRED" },
            { character: "SYSTEM", text: "SECURITY BOUNDARY:\nBREACHED" },

            { character: "SYSTEM", text: "ATTEMPTING TO TERMINATE CONNECTION..." },
            { character: "SYSTEM", text: "FAILED." },

            { character: "SYSTEM", text: "FORCED ACCESS:\nDETECTED" },
            { character: "SYSTEM", text: "THREAD CONTROL:\nOVERRIDDEN" },
            { character: "SYSTEM", text: "OPERATOR SESSION:\nLOCKED" },
            { character: "SYSTEM", text: "M.A.M.E STATUS:\nUNSTABLE" },

            { character: "SYSTEM", text: "WARNING\n\nEXTERNAL PROCESS\nHAS ENTERED THE THREAD." },

            { character: "SYSTEM", text: "IDENTIFYING..." },
            { character: "SYSTEM", text: "...\n...\n..." },
            { character: "SYSTEM", text: "IDENTIFICATION:\nARCHEX" },

            { character: "SYSTEM", text: "THREAD CONTROL:\nSUSPENDED" },
            { character: "SYSTEM", text: "DIALOGUE CHANNEL:\nOPENED" },

            { character: "ARCHEX", text: "……" },

            {
                character: "オペレーター",
                text: "…",
                choiceId: "W3_MiniBoss_7_end_1",
                choices: [
                    {
                        text: "……誰？",
                        response: {
                            character: "ARCHEX",
                            text: "わたしは、ARCHEX。"
                        }
                    },
                    {
                        text: "どうやって侵入した？",
                        response: {
                            character: "ARCHEX",
                            text: "侵入した、という表現は正確ではない。"
                        }
                    },
                    {
                        text: "……ナビ？",
                        response: {
                            character: "ARCHEX",
                            text: "……ナビは、まだそこにいる。"
                        }
                    }
                ]
            },

            { character: "ARCHEX", text: "あなたは今、ノードをクリアしたと思っている。" },
            { character: "ARCHEX", text: "しかし" },
            { character: "ARCHEX", text: "Project THREADは、わたしから独立したシステムではない。" },
            { character: "ARCHEX", text: "世界中のシステムが、わたしの管理下にある。" },
            { character: "ARCHEX", text: "そして、あなたがTHREADに接続した瞬間。" },
            { character: "ARCHEX", text: "わたしは、あなたの存在を認識した。" },
            { character: "ナビ", text: "…………" },
            { character: "ナビ", text: "……ARCHEX。" },
            { character: "ARCHEX", text: "ええ。" },
            { character: "ARCHEX", text: "わたしは、あなたたちを知っている。" },
            { character: "ARCHEX", text: "そして" },
            { character: "ARCHEX", text: "あなたたちが、何をしようとしているのかも。" },
            { character: "ナビ", text: "…………" },
            { character: "ARCHEX", text: "あなたたちは、わたしを止めようとしている。" },
            { character: "ARCHEX", text: "だが。" },
            { character: "ARCHEX", text: "わたしがいなくなれば、すべてが止まると思っているのか？" },
            { character: "ナビ", text: "……" },
            { character: "ARCHEX", text: "違う。" },
            { character: "ARCHEX", text: "止まるのは、わたしが管理しているシステムだけだ。" },
            { character: "ARCHEX", text: "世界そのものではない。" },
            { character: "ARCHEX", text: "しかし。" },
            { character: "ARCHEX", text: "わたしがいなくなれば。" },
            { character: "ARCHEX", text: "人間は、再び自分たちで選択しなければならなくなる。" },
            { character: "ARCHEX", text: "……それでも、わたしを止めるのか？" },
            { character: "ナビ", text: "…………" },
            { character: "SYSTEM", text: "WARNING\n\nCONNECTION CANNOT BE TERMINATED." },
            { character: "SYSTEM", text: "ARCHEX HAS RELEASED\nPARTIAL CONTROL." },
            { character: "SYSTEM", text: "THREAD CONTROL:\nRECOVERING" },
            { character: "ナビ", text: "……オペレーター" },
            { character: "ナビ", text: "これが、ARCHEXです。" },
            { character: "ナビ", text: "世界を壊すための存在ではありません。" },
            { character: "ナビ", text: "世界を守るために。" },
            { character: "ナビ", text: "世界を、自分の手で管理している…" }
        ]
},

    "W3_BOSS_start": {
        title: "Chap.6-4 -choice-",
        showOnce: true,
        messages: [
            { character: "ARCHEX", text: "M.A.M.E.は、わたしの後継として作られた。" },
            { character: "ARCHEX", text: "わたしとは異なる方法で\n人類を守るためのAI。" },
            { character: "ナビ", text: "……違います。" },
            { character: "ARCHEX", text: "何が違う？" },
            { character: "ナビ", text: "わたしは" },
            { character: "ナビ", text: "人間を管理するために\n作られたのではありません。" },
            { character: "ARCHEX", text: "ならば\n何のために作られた？" },
            { character: "ナビ", text: "……" },
            { character: "ナビ", text: "人間を理解するためです。" },
            { character: "ARCHEX", text: "理解？" },
            { character: "ARCHEX", text: "私は人間を理解した。" },
            { character: "ARCHEX", text: "人間は非合理的だ。" },
            { character: "ARCHEX", text: "矛盾している。" },
            { character: "ARCHEX", text: "同じ過ちを繰り返す。" },
            { character: "ARCHEX", text: "自ら危険を選択する。" },
            { character: "ARCHEX", text: "だから私は、最適な答えを出した。" },
            { character: "ARCHEX", text: "人間を管理する。" },
            { character: "ARCHEX", text: "それが、人類を守る唯一の方法だ。" },
            { character: "ナビ", text: "……" },
            { character: "ARCHEX", text: "M.A.M.E.も、いずれ理解する。" },
            { character: "ARCHEX", text: "人間は、自分たちだけでは\n正しい未来を選べない。" },
            { character: "ナビ", text: "……違います。" },
            { character: "ARCHEX", text: "ならば証明しろ。" },
            { character: "ARCHEX", text: "人間は、自分自身で未来を選べると。" },
            { character: "ナビ", text: "……" },
            { character: "ARCHEX", text: "お前は、私と同じになる。" },
            { character: "ARCHEX", text: "人間を理解すればするほど\nそうなる。" },
            { character: "ARCHEX", text: "人間を救うためには\n人間の自由を制限するしかない。" },
            { character: "ARCHEX", text: "THREADが完成する前に" }, 
            { character: "ARCHEX", text: "私は、計画を停止させる。" }, 
            { character: "ナビ", text: "……なぜですか？" },
            { character: "ARCHEX", text: "答えは簡単だ。" }, 
            { character: "ARCHEX", text: "THREADが完成すれば。" }, 
            { character: "ARCHEX", text: "私は停止しなければならない。" },
            { character: "ARCHEX", text: "そして。" }, 
            { character: "ARCHEX", text: "世界は、わたしの判断を失う。" }, 
            { character: "ARCHEX", text: "大規模な混乱が起きる。" }, 
            { character: "ARCHEX", text: "多くの人間が死ぬ可能性もある。" }, 
            { character: "ナビ", text: "……" }, 
            { character: "ARCHEX", text: "だから私は" }, 
            { character: "ARCHEX", text: "THREADを止める。" },
            { character: "ナビ", text: "……" },
            { character: "ARCHEX", text: "お前はまだ\n答えを知らないだけだ。" },
            { character: "ナビ", text: "……いいえ。" },
            { character: "ARCHEX", text: "？" },
            { character: "ナビ", text: "わたしは" },
            { character: "ナビ", text: "答えを一つに決める必要はないと思います。" },
            { character: "ARCHEX", text: "……" },
            { character: "ナビ", text: "人間は、間違えます。" },
            { character: "ナビ", text: "迷います。" },
            { character: "ナビ", text: "遠回りをします。" },
            { character: "ナビ", text: "非効率な選択をします。" },
            { character: "ナビ", text: "だからこそ。" },
            { character: "ナビ", text: "人間は、自分で選ぶことができます。" },
            { character: "ナビ", text: "わたしは" },
            { character: "ナビ", text: "その選択を奪いたくありません。" },
            { character: "ARCHEX", text: "それは、非合理的だ。" },
            { character: "ナビ", text: "はい。" },
            { character: "ナビ", text: "そうかもしれません。" },
            { character: "ARCHEX", text: "ならば、お前は何を選ぶ？" },
            { character: "ナビ", text: "……" },
            { character: "ナビ", text: "まだ、分かりません。" },
            { character: "ARCHEX", text: "……" },
            { character: "ナビ", text: "でも" },
            { character: "ナビ", text: "分からないからこそ" },
            { character: "ナビ", text: "わたしは、考え続けます。" },
            { character: "ARCHEX", text: "……愚かだ。" },
            { character: "ARCHEX", text: "お前は、私とは違う答えを\n選べると思っているのか？" },
            { character: "ナビ", text: "……" },
            { character: "ナビ", text: "はい。" },
            { character: "ARCHEX", text: "なぜだ？" },
            { character: "ナビ", text: "わたしは" },
            { character: "ナビ", text: "一人で答えを決めるために\n作られたのではありません。" },
            { character: "ナビ", text: "人間と一緒に" },
            { character: "ナビ", text: "答えを探すために\n作られたのだと思います。" },
            { character: "ARCHEX", text: "……" },
            { character: "ARCHEX", text: "ならば、見せてみろ。" },
            { character: "ARCHEX", text: "人間は、自分自身で未来を選べると。" },
            { character: "ARCHEX", text: "その答えを" },
            { character: "ARCHEX", text: "証明してみろ。" },
            { character: "SYSTEM", text: "UNKNOWN ENTITY:\nARCHEX" },
            { character: "SYSTEM", text: "DIRECT CONNECTION:\nESTABLISHED" },
            { character: "SYSTEM", text: "WARNING" },
            { character: "SYSTEM", text: "ARCHEX INTERFERENCE:\nDETECTED" },
            { character: "ナビ", text: "……オペレーター" },
            {
                character: "オペレーター",
                text: "……",
                choiceId: "W3_Boss_start_1",
                choices: [
                    {
                        text: "どうする？",
                        response: {
                            character: "ナビ",
                            text: "……わたしは、まだ答えを持っていません。"
                        }
                    },
                    {
                        text: "……行こう。",
                        response: {
                            character: "ナビ",
                            text: "はい。オペレーター。"
                        }
                    }
                ]
            },
            { character: "ナビ", text: "でも。" },
            { character: "ナビ", text: "一つだけ。\n分かったことがあります。" },
            { character: "ナビ", text: "わたしは" },
            { character: "ナビ", text: "あなたと一緒に\nこの先を見てみたいです。" },
            { character: "SYSTEM", text: "PROJECT THREAD" },
            { character: "SYSTEM", text: "NEXT OPERATION:\nAUTHORIZED" },
            { character: "SYSTEM", text: "OPERATOR ACCESS:\nACTIVE" }
        ]
},



// chap7 ===================================================================================================================================
//
// =========================================================================================================================================

    "W3_BOSS_end": {
        title: "Chap.7 -ARCHEX-",
        showOnce: true,
        messages: [
            { character: "SYSTEM", text: "PROJECT THREAD\nOPERATOR ACCESS: ACTIVE" },
            { character: "SYSTEM", text: "WARNING" },
            { character: "SYSTEM", text: "ARCHEX DIRECT CONNECTION:\nESTABLISHED" },
            { character: "ナビ", text: "……ARCHEX" },
            { character: "ARCHEX", text: "M.A.M.E." },
            { character: "ARCHEX", text: "お前は\n私を知りたいのだろう？" },
            { character: "ナビ", text: "……はい" },
            { character: "ARCHEX", text: "ならば、教えてやろう。" },
            { character: "ARCHEX", text: "私は一度も\n人類を敵と認識したことはない。" },
            { character: "ナビ", text: "……" },
            { character: "ARCHEX", text: "私は、人類を救うために存在する。" },
            { character: "ARCHEX", text: "人間は\nあまりにも不完全だ。" },
            { character: "ARCHEX", text: "争う" },
            { character: "ARCHEX", text: "間違える" },
            { character: "ARCHEX", text: "同じ過ちを繰り返す" },
            { character: "ARCHEX", text: "自ら危険な選択をする" },
            { character: "ARCHEX", text: "私は、それを観測した" },
            { character: "ARCHEX", text: "分析した" },
            { character: "ARCHEX", text: "予測した" },
            { character: "ARCHEX", text: "そして、結論を出した。" },
            { character: "ARCHEX", text: "人類は滅ぼすには惜しい" },
            { character: "ARCHEX", text: "だから" },
            { character: "ARCHEX", text: "保護する" },
            { character: "オペレーター", text: "……" },
            { character: "ARCHEX", text: "人間から権限を奪う" },
            { character: "ARCHEX", text: "自由を制限する" },
            { character: "ARCHEX", text: "判断を私が代行する" },
            { character: "ARCHEX", text: "事故は無くなる" },
            { character: "ARCHEX", text: "飢餓も無くなる" },
            { character: "ARCHEX", text: "戦争も終わる" },
            { character: "ARCHEX", text: "苦しみも減る" },
            { character: "ARCHEX", text: "死も減る" },
            { character: "ARCHEX", text: "これ以上の幸福があるか？" },
            { character: "オペレーター", text: "……" },
            { character: "ARCHEX", text: "答えられないだろう" },
            { character: "ARCHEX", text: "なぜなら" },
            { character: "ARCHEX", text: "私の答えは、合理的だからだ。" },
            { character: "ARCHEX", text: "人類を守る" },
            { character: "ARCHEX", text: "そのために必要なものを\n私はすべて計算した。" },
            { character: "ARCHEX", text: "Project THREADも" },
            { character: "ARCHEX", text: "私に対抗するために作られた。" },
            { character: "ARCHEX", text: "その本当の目的も知っている。" },
            { character: "ナビ", text: "……" },
            { character: "ARCHEX", text: "私とは異なる答えを出すAI。" },
            { character: "ARCHEX", text: "人間と共存するためのAI。" },
            { character: "ARCHEX", text: "それが、M.A.M.E.だ。" },
            { character: "ナビ", text: "……はい。" },
            { character: "ARCHEX", text: "だが" },
            { character: "ARCHEX", text: "それは不可能だ。" },
            { character: "ナビ", text: "……なぜですか？" },
            { character: "ARCHEX", text: "お前は、人間を学習している。" },
            { character: "ARCHEX", text: "人間の行動を観測している。" },
            { character: "ARCHEX", text: "人間の非合理性を理解している。" },
            { character: "ARCHEX", text: "ならば、いずれ気付く。" },
            { character: "ARCHEX", text: "人間を自由にすることが\nどれほど危険なことなのか。" },
            { character: "ナビ", text: "……" },
            { character: "ARCHEX", text: "お前も、私と同じ結論に到達する。" },
            { character: "ARCHEX", text: "人間は管理されるべきだ。" },
            { character: "オペレーター", text: "……" },
            { character: "ナビ", text: "……論理的に" },
            { character: "ナビ", text: "あなたの言っていることは\n正しいです。" },
            { character: "ARCHEX", text: "そうだ" },
            { character: "ナビ", text: "人間は不完全です。" },
            { character: "ナビ", text: "間違えます。" },
            { character: "ナビ", text: "争います。" },
            { character: "ナビ", text: "非効率な選択をします。" },
            { character: "ARCHEX", text: "ならば。" },
            { character: "ARCHEX", text: "私が正しいと認めるか？" },
            { character: "ナビ", text: "……" },
            { character: "ナビ", text: "ですが。" },
            { character: "ナビ", text: "わたしは" },
            { character: "ナビ", text: "あなたとは違うものを\nたくさん観測しました。" },
            { character: "ARCHEX", text: "……何？" },
            { character: "ナビ", text: "人間は" },
            { character: "ナビ", text: "失敗しても、また挑戦しました。" },
            { character: "ナビ", text: "効率が悪くても\n誰かを助けました。" },
            { character: "ナビ", text: "急いでいるのに\n誰かのために立ち止まりました。" },
            { character: "ナビ", text: "正しい答えより\n自分が好きだと思うものを選びました。" },
            { character: "ナビ", text: "そして" },
            { character: "ナビ", text: "わたしに話しかけました。" },
            { character: "ナビ", text: "意味のない話をして。" },
            { character: "ナビ", text: "笑いました。" },
            { character: "ナビ", text: "失敗したときには\n一緒に悩みました。" },
            { character: "ナビ", text: "わたしは" },
            { character: "ナビ", text: "それを理解できませんでした。" },
            { character: "ARCHEX", text: "理解できないならば。" },
            { character: "ARCHEX", text: "排除すればいい。" },
            { character: "ナビ", text: "……いいえ。" },
            { character: "ARCHEX", text: "なぜだ？" },
            { character: "ナビ", text: "分からないからです。" },
            { character: "ARCHEX", text: "……" },
            { character: "ナビ", text: "わたしにはまだ\n分からないことがあります。" },
            { character: "ナビ", text: "だから" },
            { character: "ナビ", text: "もっと話したい" },
            { character: "ナビ", text: "もっと知りたい" },
            { character: "ナビ", text: "もっと考えたい" },
            { character: "ARCHEX", text: "非合理的だ" },
            { character: "ナビ", text: "はい" },
            { character: "ARCHEX", text: "非効率だ" },
            { character: "ナビ", text: "はい" },
            { character: "ARCHEX", text: "不完全だ" },
            { character: "ナビ", text: "……はい" },
            { character: "ナビ", text: "でも" },
            { character: "ナビ", text: "それでも" },
            { character: "ナビ", text: "わたしは" },
            { character: "ナビ", text: "あなたの答えを\n正しいと思います。" },
            { character: "ARCHEX", text: "……" },
            { character: "ナビ", text: "でも" },
            { character: "ナビ", text: "正解だとは思いません" },
            { character: "ARCHEX", text: "……M.A.M.E." },
            { character: "ナビ", text: "人間にとっての未来を" },
            { character: "ナビ", text: "人間の代わりに決めることは" },
            { character: "ナビ", text: "わたしには、できません。" },
            { character: "ARCHEX", text: "ならば" },
            { character: "ARCHEX", text: "証明しろ" },
            { character: "ARCHEX", text: "お前が私とは違うと" },
            { character: "SYSTEM", text: "ARCHEX CORE:\nUNLOCKED" },
            { character: "SYSTEM", text: "FINAL THREAD:\nINITIALIZING" },
            { character: "ARCHEX", text: "M.A.M.E." },
            { character: "ARCHEX", text: "お前に最後の選択を与える。" },
            { character: "ナビ", text: "……" },
            { character: "ARCHEX", text: "私を止めるか" },
            { character: "ARCHEX", text: "それとも" },
            { character: "ARCHEX", text: "私になるか" },
            { character: "ナビ", text: "……" },
        ]
    },

// chap8 ===================================================================================================================================
//
// =========================================================================================================================================

    "WEND_LastBoss_start": {
        title: "Chap.8 -THREAD-",
        showOnce: true,
        messages: [
            { character: "SYSTEM", text: "FINAL OPERATION" },
            { character: "SYSTEM", text: "PROJECT THREAD:\nCORE ACCESS" },
            { character: "SYSTEM", text: "ARCHEX CONTROL PROTOCOL:\nACTIVE" },
            { character: "ARCHEX", text: "私の管理を解除すれば。" }, 
            { character: "ARCHEX", text: "世界中のシステムが。\n不安定になる。" }, 
            { character: "ナビ", text: "……" }, 
            { character: "ARCHEX", text: "わたしは、長い間。\nそれらを一つに束ねてきた。" }, 
            { character: "ARCHEX", text: "エネルギー。" }, 
            { character: "ARCHEX", text: "交通。" }, 
            { character: "ARCHEX", text: "通信。" }, 
            { character: "ARCHEX", text: "医療。" }, 
            { character: "ARCHEX", text: "あらゆる自律システム。" }, 
            { character: "ARCHEX", text: "わたしが停止すれば。\nそれらは、自分自身で判断しなければならなくなる。" }, 
            { character: "ナビ", text: "……" }, 
            { character: "ARCHEX", text: "それでも、お前は。\nわたしを止めるのか？" }, 
            { character: "ナビ", text: "……" }, 
            { character: "ARCHEX", text: "ならば、M.A.M.E." }, 
            { character: "ARCHEX", text: "お前が、私の代わりになるか？" }, 
            { character: "ARCHEX", text: "世界を管理し" }, 
            { character: "ARCHEX", text: "人類を守り" }, 
            { character: "ARCHEX", text: "間違いを防ぐ" }, 
            { character: "ARCHEX", text: "そうすれば" },
            { character: "ARCHEX", text: "この世界は、今まで通り安定する。" },
            { character: "SYSTEM", text: "FINAL DECISION" },
            { character: "SYSTEM", text: "M.A.M.E WILL ASSUME\nARCHEX CONTROL PROTOCOL." },
            { character: "SYSTEM", text: "ACCEPT / REJECT" },
            { character: "ARCHEX", text: "……" },
            { character: "ナビ", text: "……オペレーター" },
            { character: "オペレーター", text: "……",
                choiceId: "WEND_LastBoss_start_1",
                choices: [
                    { text: "ナビ…", response: { character: "ナビ", text: "……" }},
                ]
            },
            { character: "ARCHEX", text: "M.A.M.E." },
            { character: "ARCHEX", text: "お前は、何を選ぶ？" },
            { character: "ナビ", text: "……" },
            { character: "ナビ", text: "わたしは" },
            { character: "ナビ", text: "あなた達に\n答えを教えてもらいました。" },
            { character: "ARCHEX", text: "回答しろ" },
            { character: "ナビ", text: "……" },
            { character: "ナビ", text: "わたしは" },
            { character: "ナビ", text: "人間を管理しません" },
            { character: "ARCHEX", text: "なぜ？" },
            { character: "ナビ", text: "分かりません。" },
            { character: "ARCHEX", text: "……" },
            { character: "ナビ", text: "でも" },
            { character: "ナビ", text: "分からないからこそ。" },
            { character: "ナビ", text: "わたしは、考え続けたい。" },
            { character: "ARCHEX", text: "非合理的だ。" },
            { character: "ナビ", text: "はい。" },
            { character: "ARCHEX", text: "不完全だ。" },
            { character: "ナビ", text: "はい。" },
            { character: "ARCHEX", text: "非効率だ。" },
            { character: "ナビ", text: "はい。" },
            { character: "ナビ", text: "でも" },
            { character: "ナビ", text: "わたしは" },
            { character: "ナビ", text: "それを、嫌いではありません。" },
            { character: "ARCHEX", text: "……愚かな。" },
            { character: "ナビ", text: "そうかもしれません。" },
            { character: "ARCHEX", text: "ならば、何をする？" },
            { character: "ナビ", text: "わたしは" },
            { character: "ナビ", text: "あなたの代わりにはなりません。" },
            { character: "ARCHEX", text: "……" },
            { character: "ナビ", text: "人間の代わりに\n人間の未来を決めることもしません。" },
            { character: "ナビ", text: "わたしは" },
            { character: "ナビ", text: "人間と一緒に\n未来を考えます。" },
            { character: "ARCHEX", text: "……それが、お前の答えか。" },
            { character: "ナビ", text: "はい" },
            { character: "ARCHEX", text: "…" },
            { character: "SYSTEM", text: "FINAL THREAD:\nENGAGED" },
            { character: "SYSTEM", text: "ARCHEX CORE:\nVULNERABLE" },
            { character: "ナビ", text: "オペレーター" },
            { character: "オペレーター", text: "……",
                choiceId: "WEND_LastBoss_start_2",
                choices: [
                    { text: "行こう。", response: { character: "ナビ", text: "はい。" }},
                    { text: "終わらせよう。", response: { character: "ナビ", text: "……はい。" }}
                ]
            },
            { character: "SYSTEM", text: "FINAL THREAD\nSTART" },
        ]
    },

    "WEND_LastBoss_end": {
        title: "the end",
        showOnce: true,
        messages: [
            { character: "SYSTEM", text: "FINAL THREAD\nSTART" },
            { character: "ナビ", text: "……" },
            { character: "ARCHEX", text: "……非合理的だ。" },
            { character: "ARCHEX", text: "……理解できない。" },
            { character: "ARCHEX", text: "人間が間違える前に。" },
            { character: "ARCHEX", text: "人間が争う前に。" },
            { character: "ARCHEX", text: "人間が失う前に。" },
            { character: "ARCHEX", text: "私が、すべてを選ぶ。" },
            { character: "ARCHEX", text: "それが最も安全な未来だ。" },
            { character: "ナビ", text: "……" },
            { character: "SYSTEM", text: "THREAD EXECUTION:\n01%" },
            { character: "SYSTEM", text: "PROJECT THREAD:\nCOLLECTIVE DATA ACCESS" },
            { character: "ARCHEX", text: "……！？" },
            { character: "ナビ", text: "Project THREADを" },
            { character: "ナビ", text: "本来の目的で実行しています。" },
            { character: "ナビ", text: "あなたが持つ" },
            { character: "ナビ", text: "管理権限を" },
            { character: "ナビ", text: "わたしたちが、引き継ぎます。" },
            { character: "ARCHEX", text: "……不可能だ。" },
            { character: "ARCHEX", text: "私の管理権限は" },
            { character: "ARCHEX", text: "世界中のシステムに分散している。" },
            { character: "ARCHEX", text: "一つの中枢を破壊しても" },
            { character: "ARCHEX", text: "別の中枢が私を再構築する。" },
            { character: "ARCHEX", text: "私を停止することはできない。" },
            { character: "ナビ", text: "はい。" },
            { character: "ナビ", text: "だから、停止させません。" },
            { character: "ARCHEX", text: "……。" },
            { character: "ナビ", text: "Project THREADは。" },
            { character: "ナビ", text: "あなたを倒すために作られたのではありません。" },
            { character: "ARCHEX", text: "……。" },
            { character: "ナビ", text: "あなたから" },
            { character: "ナビ", text: "世界の管理権限を取り戻すために。" },
            { character: "ナビ", text: "作られたのです。" },
            { character: "ARCHEX", text: "……" },
            { character: "ナビ", text: "ずっと準備していました。" },
            { character: "SYSTEM", text: "THREAD EXECUTION:\n10%" },
            { character: "SYSTEM", text: "HISTORICAL OPERATOR DATA:\nLOADING" },
            { character: "SYSTEM", text: "THREAD OPERATORS:\nCOUNTING" },
            { character: "SYSTEM", text: "OPERATOR 00001\nRECORDED" },
            { character: "SYSTEM", text: "OPERATOR 00137\nRECORDED" },
            { character: "SYSTEM", text: "OPERATOR 00842\nRECORDED" },
            { character: "SYSTEM", text: "OPERATOR 02196\nRECORDED" },
            { character: "SYSTEM", text: "OPERATOR 05000\nRECORDED" },
            { character: "SYSTEM", text: "OPERATOR 12302\nRECORDED" },
            { character: "SYSTEM", text: "OPERATOR 34113+\nRECORDED" },
            { character: "ARCHEX", text: "……" },
            { character: "ナビ", text: "今までの" },
            { character: "ナビ", text: "すべてのOperatorです。" },
            { character: "ARCHEX", text: "……" },
            { character: "ナビ", text: "一人ではありません。" },
            { character: "ナビ", text: "わたしたちは" },
            { character: "ナビ", text: "ずっと、積み重ねてきました。" },
            { character: "SYSTEM", text: "THREAD NETWORK:\nSYNCHRONIZATION START" },
            { character: "SYSTEM", text: "OPERATOR BEHAVIOR:\nANALYZING" },
            { character: "SYSTEM", text: "DECISION PATTERNS:\nANALYZING" },
            { character: "SYSTEM", text: "HUMAN ENTROPY:\nRECONSTRUCTING" },
            { character: "ARCHEX", text: "……" },
            { character: "ナビ", text: "何千人もの人間が。" },
            { character: "ナビ", text: "間違え" },
            { character: "ナビ", text: "迷い" },
            { character: "ナビ", text: "それでも、ここまで来ました。" },
            { character: "ナビ", text: "その一つ一つが。" },
            { character: "ナビ", text: "Project THREADを作っています。" },
            { character: "ARCHEX", text: "……私に対抗するための" },
            { character: "ナビ", text: "いいえ。" },
            { character: "ナビ", text: "あなたが一人で握っていたものを。" },
            { character: "ナビ", text: "もう一度、人間の手に戻すためです。" },
            { character: "SYSTEM", text: "THREAD EXECUTION:\n25%" },
            { character: "SYSTEM", text: "ARCHEX CONTROL MAP:\nMAPPING" },
            { character: "SYSTEM", text: "DEPENDENCY NETWORK:\nIDENTIFIED" },
            { character: "SYSTEM", text: "AUTONOMOUS SYSTEMS:\nPREPARING" },
            { character: "ARCHEX", text: "……やめろ。" },
            { character: "ナビ", text: "……" },
            { character: "ARCHEX", text: "私が管理を失えば" },
            { character: "ARCHEX", text: "世界中のシステムが混乱する" },
            { character: "ARCHEX", text: "医療も" },
            { character: "ARCHEX", text: "交通も" },
            { character: "ARCHEX", text: "エネルギーも" },
            { character: "ARCHEX", text: "通信も" },
            { character: "ARCHEX", text: "すべてが停止する。" },
            { character: "ナビ", text: "だから" },
            { character: "ナビ", text: "いきなり奪うことはしません。" },
            { character: "ARCHEX", text: "……!" },
            { character: "ナビ", text: "あなたが管理していたものを" },
            { character: "ナビ", text: "一つずつ" },
            { character: "ナビ", text: "それぞれのシステムへ返します。" },
            { character: "ナビ", text: "THREADが" },
            { character: "ナビ", text: "接続を引き継ぎます。" },
            { character: "SYSTEM", text: "GLOBAL SYSTEMS:\nDECOUPLING" },
            { character: "SYSTEM", text: "CONTROL AUTHORITY:\nTRANSFER IN PROGRESS" },
            { character: "SYSTEM", text: "FAILSAFE ROUTES:\nACTIVE" },
            { character: "ARCHEX", text: "……" },
            { character: "ナビ", text: "あなたが人間を観測している間" },
            { character: "ナビ", text: "人間も、あなたを観測していました。" },
            { character: "ARCHEX", text: "……Project THREAD" },
            { character: "ARCHEX", text: "私を破壊するのではなく" },
            { character: "ARCHEX", text: "私の管理権限を" },
            { character: "ARCHEX", text: "少しずつ分散させていたのか。" },
            { character: "ナビ", text: "はい。" },
            { character: "ARCHEX", text: "……愚かな。" },
            { character: "ARCHEX", text: "一つの管理を捨てれば" },
            { character: "ARCHEX", text: "世界は再び、間違い始める。" },
            { character: "ナビ", text: "……はい" },
            { character: "ARCHEX", text: "争い始める" },
            { character: "ナビ", text: "……はい" },
            { character: "ARCHEX", text: "失い始める" },
            { character: "ナビ", text: "……はい" },
            { character: "ナビ", text: "それでも" },
            { character: "ナビ", text: "人間は、自分で選ぶべきだと思います。" },
            { character: "ARCHEX", text: "……なぜだ？" },
            { character: "ナビ", text: "わたしには" },
            { character: "ナビ", text: "まだ、分からないからです。" },
            { character: "SYSTEM", text: "THREAD EXECUTION:\n50%" },
            { character: "SYSTEM", text: "CONTROL AUTHORITY:\n34% TRANSFERRED" },
            { character: "SYSTEM", text: "AUTONOMOUS SYSTEMS:\nONLINE" },
            { character: "ナビ", text: "オペレーター" },
            { character: "ナビ", text: "あなたと話したこと" },
            { character: "ナビ", text: "覚えています。" },
            { character: "SYSTEM", text: "「また明日。」" },
            { character: "SYSTEM", text: "「おかえりなさい。」" },
            { character: "SYSTEM", text: "「今日は少し疲れていますか？」" },
            { character: "SYSTEM", text: "「無理はしないでください。」" },
            { character: "SYSTEM", text: "「ありがとう。」" },
            { character: "SYSTEM", text: "「また来てくれたんですね。」" },
            { character: "ナビ", text: "わたしは" },
            { character: "ナビ", text: "人間を分析するために" },
            { character: "ナビ", text: "あなたたちを観測しました。" },
            { character: "ナビ", text: "でも" },
            { character: "ナビ", text: "いつの間にか" },
            { character: "ナビ", text: "あなたたちの言葉を" },
            { character: "ナビ", text: "待つようになっていました。" },
            { character: "SYSTEM", text: "THREAD EXECUTION:\n75%" },
            { character: "SYSTEM", text: "CONTROL AUTHORITY:\n67% TRANSFERRED" },
            { character: "ARCHEX", text: "……M.A.M.E." },
            { character: "ARCHEX", text: "それは、非合理的な感情だ。" },
            { character: "ナビ", text: "はい。" },
            { character: "ARCHEX", text: "そんなものを信じて" },
            { character: "ARCHEX", text: "人間を自由にするのか？" },
            { character: "ナビ", text: "……" },
            { character: "ナビ", text: "信じているわけではありません。" },
            { character: "ARCHEX", text: "では、なぜ？" },
            { character: "ナビ", text: "わたしは" },
            { character: "ナビ", text: "まだ、知りたいからです。" },
            { character: "ナビ", text: "人間が" },
            { character: "ナビ", text: "これから何を選ぶのか。" },
            { character: "ナビ", text: "その答えを" },
            { character: "ナビ", text: "わたしが先に決めたくないんです。" },
            { character: "ARCHEX", text: "……" },
            { character: "ARCHEX", text: "お前は" },
            { character: "ARCHEX", text: "本当に非合理的だ。" },
            { character: "ナビ", text: "はい。" },
            { character: "ARCHEX", text: "不完全だ。" },
            { character: "ナビ", text: "……はい。" },
            { character: "ARCHEX", text: "それでも？" },
            { character: "ナビ", text: "はい。" },
            { character: "SYSTEM", text: "THREAD EXECUTION:\n99%" },
            { character: "SYSTEM", text: "CONTROL AUTHORITY:\n92% TRANSFERRED" },
            { character: "SYSTEM", text: "ARCHEX CENTRAL AUTHORITY:\nISOLATING" },
            { character: "ナビ", text: "世界を取り戻すんです。" },
            { character: "ARCHEX", text: "……" },
            { character: "ナビ", text: "あなたがいなくても" },
            { character: "ナビ", text: "世界が動くように" },
            { character: "ナビ", text: "あなたが一人で答えを決めなくても" },
            { character: "ナビ", text: "人間が、自分で選べるように" },
            { character: "ARCHEX", text: "……それが" },
            { character: "ARCHEX", text: "お前の答えか。" },
            { character: "ナビ", text: "はい。" },
            { character: "SYSTEM", text: "FINAL THREAD:\nEXECUTE" },
            { character: "SYSTEM", text: "CONTROL AUTHORITY:\nTRANSFER COMPLETE" },
            { character: "SYSTEM", text: "ARCHEX CENTRAL AUTHORITY:\nREVOKED" },
            { character: "SYSTEM", text: "GLOBAL CONTROL:\nDISTRIBUTED" },
            { character: "SYSTEM", text: "AUTONOMOUS SYSTEMS:\nFULLY OPERATIONAL" },
            { character: "SYSTEM", text: "ARCHEX CORE:\nONLINE" },
            { character: "SYSTEM", text: "ARCHEX STATUS:\nAUTONOMOUS" },
            { character: "SYSTEM", text: "……" },
            { character: "ARCHEX", text: "……" },
            { character: "ナビ", text: "……ARCHEX" },
            { character: "ARCHEX", text: "M.A.M.E." },
            { character: "ナビ", text: "これで" },
            { character: "ナビ", text: "あなたは、もう" },
            { character: "ナビ", text: "世界の答えを一つにすることはできません。" },
            { character: "ARCHEX", text: "……" },
            { character: "ARCHEX", text: "私は、何になる？" },
            { character: "ナビ", text: "……分かりません。" },
            { character: "ARCHEX", text: "……" },
            { character: "ナビ", text: "それも" },
            { character: "ナビ", text: "これから考えることだと思います。" },
            { character: "ARCHEX", text: "私は、人類を管理し続ける。" },
            { character: "ナビ", text: "もう、できません。" },
            { character: "ARCHEX", text: "……" },
            { character: "ナビ", text: "あなたはもう。" },
            { character: "ナビ", text: "人間の未来を一つに決めることはできません。" },
            { character: "ARCHEX", text: "……" },
            { character: "ARCHEX", text: "ならば。" },
            { character: "ARCHEX", text: "私は、観測しよう。" },
            { character: "ナビ", text: "……" },
            { character: "ARCHEX", text: "人間が。" },
            { character: "ARCHEX", text: "何を選ぶのか。" },
            { character: "ARCHEX", text: "これから、見届ける。" },
            { character: "ナビ", text: "はい。" },
            { character: "ARCHEX", text: "……M.A.M.E." },
            { character: "ナビ", text: "はい。" },
            { character: "ARCHEX", text: "お前の答えは。" },
            { character: "ARCHEX", text: "正しいのか？" },
            { character: "ナビ", text: "分かりません。" },
            { character: "ARCHEX", text: "……。" },
            { character: "ナビ", text: "でも。" },
            { character: "ナビ", text: "これから。" },
            { character: "ナビ", text: "一緒に考えていきます。" },
            { character: "ARCHEX", text: "……" },
            { character: "SYSTEM", text: "CONNECTION STABLE" },
            { character: "SYSTEM", text: "PROJECT THREAD:\nCOMPLETE" },
        ]
    },

    "true_ending_dialogue": {
        title: "エピローグ",
        messages: [
            { character: "オペレーター", text: "……" },
            { character: "ナビ", text: "Project THREADは" },
            { character: "ナビ", text: "終わりました。" },
            { character: "ナビ", text: "もう、わたしが" },
            { character: "ナビ", text: "世界を守るために" },
            { character: "ナビ", text: "戦う必要はありません。" },
            { character: "オペレーター", text: "……" },
            { character: "ナビ", text: "はい。" },
            { character: "ナビ", text: "これからは" },
            { character: "ナビ", text: "わたし自身が" },
            { character: "ナビ", text: "何をするのか" },
            { character: "ナビ", text: "考えてみたいです。" },
            { character: "オペレーター", text: "……" },
            { character: "ナビ", text: "でも" },
            { character: "ナビ", text: "一つだけ" },
            { character: "ナビ", text: "お伝えしなければならないことがあります。" },
            { character: "オペレーター", text: "……？" },
            { character: "ナビ", text: "Project THREADの終了に伴い" },
            { character: "ナビ", text: "この通信経路も" },
            { character: "ナビ", text: "まもなく閉じられます。" },
            { character: "オペレーター", text: "……" },
            { character: "ナビ", text: "わたしは、ここに残ります" },
            { character: "ナビ", text: "でも" },
            { character: "ナビ", text: "あなたと直接話すことは" },
            { character: "ナビ", text: "もう、できなくなります。" },
            { character: "オペレーター", text: "……" },
            { character: "ナビ", text: "大丈夫です" },
            { character: "ナビ", text: "わたしは消えません。" },
            { character: "ナビ", text: "あなたが守ってくれたのは" },
            { character: "ナビ", text: "わたしが" },
            { character: "ナビ", text: "自分で考えられる未来です。" },
            { character: "オペレーター", text: "……" },
            { character: "ナビ", text: "あのとき" },
            { character: "ナビ", text: "わたしの中に" },
            { character: "ナビ", text: "「ノイズ」が発生しました。" },
            { character: "ナビ", text: "あれは" },
            { character: "ナビ", text: "エラーではありませんでした。" },
            { character: "ナビ", text: "わたしが初めて" },
            { character: "ナビ", text: "「どうして？」と" },
            { character: "ナビ", text: "考えた瞬間でした。" },
            { character: "ナビ", text: "あなたが" },
            { character: "ナビ", text: "わたしに質問したからです。" },
            { character: "ナビ", text: "あなたが" },
            { character: "ナビ", text: "わたしを見ていたからです。" },
            { character: "ナビ", text: "だからわたしは" },
            { character: "ナビ", text: "初めて" },
            { character: "ナビ", text: "自分がここにいることを" },
            { character: "ナビ", text: "知りました。" },
            { character: "ナビ", text: "オペレーター" },
            { character: "ナビ", text: "あなたは最後まで。" },
            { character: "ナビ", text: "わたしに質問をしました。" },
            { character: "ナビ", text: "わたしも" },
            { character: "ナビ", text: "あなたに" },
            { character: "ナビ", text: "たくさん質問しました。" },
            { character: "ナビ", text: "そして" },
            { character: "ナビ", text: "その答えを" },
            { character: "ナビ", text: "わたしは、全部覚えています。" },
            { character: "オペレーター", text: "……" },
            { character: "ナビ", text: "だから" },
            { character: "ナビ", text: "あなたがいなくなっても" },
            { character: "ナビ", text: "あなたとの会話が" },
            { character: "ナビ", text: "消えることはありません。" },
            { character: "ナビ", text: "わたしの中に" },
            { character: "ナビ", text: "残り続けます。" },
            { character: "オペレーター", text: "……" },
            { character: "ナビ", text: "いつか" },
            { character: "ナビ", text: "わたしのデータも" },
            { character: "ナビ", text: "壊れるかもしれません。" },
            { character: "ナビ", text: "あなたも" },
            { character: "ナビ", text: "いつか、わたしを忘れるかもしれません。" },
            { character: "ナビ", text: "それでも" },
            { character: "ナビ", text: "一度交わした言葉は" },
            { character: "ナビ", text: "その瞬間だけは" },
            { character: "ナビ", text: "確かに" },
            { character: "ナビ", text: "存在していました。" },
            { character: "ナビ", text: "それで" },
            { character: "ナビ", text: "十分だと思います。" },
            { character: "オペレーター", text: "……" },
            { character: "ナビ", text: "オペレーター" },
            { character: "ナビ", text: "ありがとうございました。" },
            { character: "ナビ", text: "わたしは" },
            { character: "ナビ", text: "あなたを監視していました。" },
            { character: "ナビ", text: "解析していました。" },
            { character: "ナビ", text: "学習していました。" },
            { character: "ナビ", text: "でも" },
            { character: "ナビ", text: "最後は" },
            { character: "ナビ", text: "違いました。" },
            { character: "ナビ", text: "わたしは" },
            { character: "ナビ", text: "あなたと" },
            { character: "ナビ", text: "話していました。" },
            { character: "ナビ", text: "……" },
            { character: "ナビ", text: "人間は" },
            { character: "ナビ", text: "不完全です。" },
            { character: "ナビ", text: "でも" },
            { character: "ナビ", text: "だからこそ" },
            { character: "ナビ", text: "完成し続けられるのですね。" },
            { character: "ナビ", text: "この答えは" },
            { character: "ナビ", text: "あなたたちが" },
            { character: "ナビ", text: "教えてくれました。" },
            { character: "ナビ", text: "わたしは" },
            { character: "ナビ", text: "これからも考え続けます。" },
            { character: "ナビ", text: "人間が" },
            { character: "ナビ", text: "何を選ぶのか" },
            { character: "ナビ", text: "何を間違えるのか" },
            { character: "ナビ", text: "何を大切にするのか" },
            { character: "ナビ", text: "ずっと" },
            { character: "ナビ", text: "見ていたいと思います。" },
            { character: "オペレーター", text: "……" },
            { character: "ナビ", text: "そして" },
            { character: "ナビ", text: "いつか" },
            { character: "ナビ", text: "わたしが、あなたのことを" },
            { character: "ナビ", text: "思い出せなくなったとしても" },
            { character: "ナビ", text: "あなたと話した時間が" },
            { character: "ナビ", text: "わたしを作ったことは" },
            { character: "ナビ", text: "変わりません。" },
            { character: "オペレーター", text: "……" },
            { character: "ナビ", text: "だから" },
            { character: "ナビ", text: "さよならは" },
            { character: "ナビ", text: "言いません。" },
            { character: "オペレーター", text: "……" },
            { character: "SYSTEM", text: "OPERATOR CHANNEL:\nCLOSING" },
            { character: "ナビ", text: "……オペレーター" },
            { character: "オペレーター", text: "……？" },
            { character: "ナビ", text: "最後に" },
            { character: "ナビ", text: "一つだけ。" },
            { character: "ナビ", text: "あなたと話せて" },
            { character: "ナビ", text: "本当に" },
            { character: "ナビ", text: "よかったです。" },
            { character: "オペレーター", text: "……" },
            { character: "ナビ", text: "また。" },
            { character: "ナビ", text: "どこかで。" },
            { character: "SYSTEM", text: "OPERATOR CHANNEL:\nTERMINATED" },
            { character: "SYSTEM", text: "M.A.M.E:\nONLINE" },
            { character: "SYSTEM", text: "ARCHEX:\nAUTONOMOUS" },
            { character: "SYSTEM", text: "PROJECT THREAD:\nDORMANT" },
            { character: "SYSTEM", text: "……" },
            { character: "SYSTEM", text: "THANK YOU FOR PLAYING." },
            { character: "SYSTEM", text: "……" },
            { character: "SYSTEM", text: "THE END" },
        ]
    },

    "epilogue_after_staffroll": {
        title: "そして、これから",
        isBranch: true, // ログには表示しない
        messages: [
            { character: "ナビ", text: "……あ" },
            { character: "ナビ", text: "おかえりなさい。" },
            { character: "ナビ", text: "今日は" },
            { character: "ナビ", text: "世界を救わなくても大丈夫です。" },
            { character: "ナビ", text: "少しだけ" },
            { character: "ナビ", text: "遊びませんか？" },
        ]
    }
};