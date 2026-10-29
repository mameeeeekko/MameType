# Mame Roma Engine (日本語ローマ字入力判定ライブラリ)

本格派ブラウザタイピングゲーム『[MameType](https://github.com/mameeeeekko/MameType)』の日本語ローマ字入力判定システムを、誰でも自由に使えるように独立させた**完全ビルドレス・ゼロ依存（Zero-dependency）**のJavaScriptライブラリです。

Node.jsやnpm、ビルドツール（webpack, Vite等）は一切不要。ファイルをHTMLと同じ場所に置くだけで、ブラウザだけで本格的なタイピング判定が動きます。

---

## 目次
1. [このライブラリでできること（解決する課題）](#1-このライブラリでできること解決する課題)
2. [コピペで今すぐ動く完全サンプルコード](#2-コピペで今すぐ動く完全サンプルコード)
3. [タイピングゲームの画面表示の作り方（文字の色分け）](#3-タイピングゲームの画面表示の作り方文字の色分け)
4. [キー入力判定の使い方と返り値の解説](#4-キー入力判定の使い方と返り値の解説)
5. [複数問・単語リストを連続で出題する実装例](#5-複数問単語リストを連続で出題する実装例)
6. [オプション設定（文末の「ん」モード切替など）](#6-オプション設定文末のんモード切替など)
7. [中級者向け：自前のゲームループ・React/Vue等と統合する（evaluateKey）](#7-中級者向け自前のゲームループreactvue等と統合するevaluatekey)
8. [テストの実行方法](#8-テストの実行方法)
9. [よくある質問・トラブルシューティング（FAQ）](#9-よくある質問トラブルシューティングfaq)
10. [更新履歴 (Changelog)](#10-更新履歴-changelog)

---

## 1. このライブラリでできること（解決する課題）

自作タイピングゲームを作るとき、最大の壁となるのが**「日本語ローマ字入力の膨大な例外規則」**です。本ライブラリはこれらをすべて自動で完璧に処理します。

* **複数入力の完全サポート**:
  * 「し」を `si`、`shi`、`ci` のどれで打っても正解判定。
  * 「つ」(`tu`/`tsu`)、「ち」(`ti`/`chi`)、「ふ」(`fu`/`hu`)、「じ」(`ji`/`zi`) 等もすべて網羅。
  * 拗音の分離打ち（「しゃ」を `sya`, `sha` だけでなく `silya`, `sixya` と打つ）にも対応。
* **促音（っ）の2大入力方式に対応**:
  * 子音重ね: 「かった」を `katta` と打てば、「っ」と「た」を自動でまとめて確定。
  * 単体打ち: 「かった」を `ka` + `ltu` + `ta` や `ka` + `xtu` + `ta` と打っても正解。
* **撥音（ん）の高度なIME互換処理**:
  * 「さんぽ」で `s-a-n` の後に子音 `p` を打つと、自動で「ん」が確定し、押したキー `p` が次の「ぽ」の入力として引き継がれます。
  * 「かんい」のように次が母音・ヤ行の場合は、`ka-n-i`（`kani`）でも `ka-nn-i`（`kanni`）でもどちらでも入力可能です。
* **画面表示の自動追従（Display Sync）**:
  * ユーザーが `s` を打った瞬間、画面上のローマ字表示が自動で `s...` に追従し、その後に `h` を打てば `shi...`、`i` を打てば `si...` にリアルタイムで切り替わります。
* **キーボード環境差・全角半角の吸収**:
  * 全角の英数字・記号は自動で半角扱い。
  * Mac JISキーボードで `Shift + ^` を押した時に出る `〜`（波ダッシュ）や `‾`（オーバーライン）も自動で `~` として判定。
  * 記号 `→` を `-` と `>` の2打で判定可能。

---

## 2. コピペで今すぐ動く完全サンプルコード

以下のHTMLファイルを `sample.html` として保存し、ライブラリの `src/` フォルダと同じ階層に置くだけで、ブラウザ上で実際に遊べるタイピングゲームが起動します。

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>Mame Roma Engine サンプルゲーム</title>
  <style>
    body {
      font-family: sans-serif;
      background: #1e1e1e;
      color: #ffffff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
    }
    .typing-box {
      background: #2d2d2d;
      padding: 40px;
      border-radius: 12px;
      text-align: center;
      box-shadow: 0 8px 24px rgba(0,0,0,0.5);
      min-width: 400px;
    }
    .kanji-text { font-size: 36px; font-weight: bold; margin-bottom: 8px; }
    .kana-text { font-size: 20px; color: #888888; margin-bottom: 20px; }
    .roma-text { font-size: 28px; letter-spacing: 2px; font-family: monospace; }
    
    /* 入力済み文字と未入力文字の色分け */
    .typed { color: #4ade80; }     /* 入力済み：緑色 */
    .remaining { color: #666666; } /* 未入力：灰色 */
    
    .miss { animation: shake 0.1s; }
    @keyframes shake {
      0% { transform: translateX(-4px); }
      50% { transform: translateX(4px); }
      100% { transform: translateX(0); }
    }
  </style>
</head>
<body>

  <div class="typing-box" id="typingBox">
    <div class="kanji-text">考える</div>
    <div class="kana-text">かんがえる</div>
    <div class="roma-text" id="romaDisplay"></div>
  </div>

  <script type="module">
    // ライブラリから TypingSession をインポート
    import { TypingSession } from './src/index.js';

    // 1. お題のかな文字列を渡してセッションを作成
    const session = new TypingSession("かんがえる");

    const romaDisplay = document.getElementById("romaDisplay");
    const typingBox = document.getElementById("typingBox");

    // 2. 画面描画関数（入力済み文字と未入力文字を色分け）
    function render() {
      const fullRoma = session.getDisplayRoma(); // 現在の表示用ローマ字（例: "kangaeru"）
      const typedLen = session.inputedRomaji.length + session.typed.length; // 入力済み文字数

      const typedPart = fullRoma.slice(0, typedLen);     // 入力済み部分（例: "ka"）
      const remainPart = fullRoma.slice(typedLen);      // 未入力部分（例: "ngaeru"）

      romaDisplay.innerHTML = `<span class="typed">${typedPart}</span><span class="remaining">${remainPart}</span>`;
    }

    // 初回表示
    render();

    // 3. キー入力を受け取って判定
    window.addEventListener("keydown", (e) => {
      // session.input にキー（e.key）を渡すだけ！
      const result = session.input(e.key);

      // ShiftキーやAltキーなど、文字入力以外のキーは無視
      if (result.ignored) return;

      // ブラウザのスクロール等の標準動作を防ぐ（Spaceキー等）
      e.preventDefault();

      if (result.isMiss) {
        // ミスした時の演出（画面を一瞬揺らすなど）
        typingBox.classList.remove("miss");
        void typingBox.offsetWidth; // CSSアニメーション再トリガー
        typingBox.classList.add("miss");
        return;
      }

      if (result.success) {
        // 成功したら画面を再描画（入力済み部分が進む）
        render();

        // 単語全体が入力完了したかチェック
        if (result.isFinished) {
          setTimeout(() => {
            alert("クリア！おめでとうございます！");
          }, 50);
        }
      }
    });
  </script>
</body>
</html>
```

---

## 3. タイピングゲームの画面表示の作り方（文字の色分け）

タイピングゲームで最も重要な「**打った文字を緑、まだ打っていない文字を灰色にする**」UIは、以下のように数行で実装できます。

### 基本の仕組み
`session` オブジェクトから以下の情報を取得します：
1. `session.getDisplayRoma()`: 現在の入力状況に合わせて生成された全体のローマ字文字列（例: `"kangaeru"`）
2. `session.inputedRomaji`: これまで確定した打鍵の累積文字列（例: `"ka"`）
3. `session.typed`: 現在途中入力中のキーバッファ（例: `"s"`）

```javascript
// 入力済みの文字数を計算
const typedLen = session.inputedRomaji.length + session.typed.length;

// 文字列をスライスして <span> タグで囲む
const fullRoma = session.getDisplayRoma();
const typedPart = fullRoma.slice(0, typedLen);
const remainingPart = fullRoma.slice(typedLen);

displayElement.innerHTML = `
  <span class="typed">${typedPart}</span>
  <span class="remaining">${remainingPart}</span>
`;
```

---

## 4. キー入力判定の使い方と返り値の解説

### 入力判定の実行
```javascript
const result = session.input(e.key);
```
※ `session.input(e)` のように、`KeyboardEvent` そのものを渡しても自動でキーを取得します。

### `result` オブジェクトの各プロパティ

| プロパティ | 型 | 説明・使いみち |
| :--- | :--- | :--- |
| `result.success` | `boolean` | キーが正解だった場合 `true`。タイプ音の再生や画面更新を行う。 |
| `result.isMiss` | `boolean` | キーが間違っていた場合 `true`。ミス音の再生やコンボ数リセットを行う。 |
| `result.isComplete` | `boolean` | **1つのかな文字（例: 「か」）が完成した瞬間**に `true`。 |
| `result.isFinished` | `boolean` | **単語全体（例: 「かんがえる」）がすべて打ち終わった瞬間**に `true`。次の問題へ進むトリガーにする。 |
| `result.charCount` | `number` | 今回の打鍵で確定した打鍵数（途中は `0`、通常確定は `1`、促音一括時は `2`）。スコア加算に使える。 |
| `result.key` | `string` | 半角小文字に正規化された入力キー（例: `"a"`, `"~"`）。 |
| `result.ignored` | `boolean` | Shift, Control, F12 などのタイピング対象外キーだった場合 `true`。ミス判定にせずそのまま return する。 |
| `result.typed` | `string` | 現在入力中のバッファ（例: `shi` を入力中の `s` や `sh`）。 |
| `result.inputedRomaji` | `string` | これまで確定した打鍵の累積文字列。 |
| `result.pos` | `number` | かな文字列の中で、いま何文字目を打っているかのインデックス。 |

---

## 5. 複数問・単語リストを連続で出題する実装例

複数の問題を順番に出題する場合は、`session.reset(新しいかな)` を呼ぶだけで、内部状態を綺麗にリセットして次の問題を開始できます。

```javascript
import { TypingSession } from './src/index.js';

// 単語リスト（漢字と読みがな）
const WORDS = [
  { kanji: "桜", kana: "さくら" },
  { kanji: "花火", kana: "はなび" },
  { kanji: "富士山", kana: "ふじさん" },
  { kanji: "新幹線", kana: "しんかんせん" }
];

let currentIndex = 0;
const session = new TypingSession(WORDS[currentIndex].kana);

function updateDisplay() {
  document.getElementById("kanji").textContent = WORDS[currentIndex].kanji;
  document.getElementById("kana").textContent = WORDS[currentIndex].kana;
  
  const full = session.getDisplayRoma();
  const len = session.inputedRomaji.length + session.typed.length;
  document.getElementById("roma").innerHTML = 
    `<span class="typed">${full.slice(0, len)}</span><span class="remaining">${full.slice(len)}</span>`;
}

updateDisplay();

window.addEventListener("keydown", (e) => {
  const res = session.input(e.key);
  if (res.ignored) return;

  if (res.isMiss) {
    // ミス時の処理
    return;
  }

  if (res.success) {
    updateDisplay();

    // 1単語終了したら次の問題へ
    if (res.isFinished) {
      currentIndex++;

      if (currentIndex < WORDS.length) {
        // 次の単語をセットしてリセット！
        session.reset(WORDS[currentIndex].kana);
        updateDisplay();
      } else {
        alert("すべての単語をクリアしました！");
      }
    }
  }
});
```

---

## 6. オプション設定（文末の「ん」モード切替など）

コンストラクタまたは第2引数の `options` で動作をカスタマイズできます。

```javascript
const session = new TypingSession("にほん", {
  finalNMode: 'n' // 'nn'（デフォルト）または 'n'
});
```

* **`finalNMode: 'nn'` (デフォルト)**:
  * 単語の末尾にある「ん」を入力するとき、`n` を2回打つ必要があります（例: `n-i-h-o-n-n`）。
  * 多くのタイピングゲームの標準仕様です。
* **`finalNMode: 'n'`**:
  * 単語の末尾にある「ん」を、`n` 1回打つだけで即座に確定・単語完了とみなします（例: `n-i-h-o-n`）。
  * よりスピーディーに入力させたい場合の設定です。

---

## 7. 中級者向け：自前のゲームループ・React/Vue等と統合する（evaluateKey）

`TypingSession` クラスを使わず、自前の状態管理（ReactのState、VueのRef、Redux等）や既存のゲームループで判定したい場合は、**ステートレスな純粋関数 `evaluateKey`** を直接使えます。

```javascript
import { evaluateKey, getDisplayFullRoma } from './src/index.js';

// あなたが管理している状態オブジェクト
let gameState = {
  text: "とうきょう", // お題のかな
  pos: 0,             // 現在のかな位置
  typed: "",          // 入力中バッファ
  inputedRomaji: ""   // 確定済みローマ字
};

// キーが押されたら evaluateKey を呼ぶ
function onKeyDown(key) {
  // 状態オブジェクトとキーを渡す（gameState 自体は書き換わりません）
  const result = evaluateKey(key, gameState, { finalNMode: 'nn' });

  if (result.ignored) return;

  if (result.isMiss) {
    console.log("ミス！");
    return;
  }

  if (result.success) {
    // 返り値で新しい状態を更新
    gameState.pos = result.pos;
    gameState.typed = result.typed;
    gameState.inputedRomaji = result.inputedRomaji;

    // 表示用ローマ字を計算
    const displayRoma = getDisplayFullRoma(gameState);
    console.log("現在表示:", displayRoma);

    if (result.isFinished) {
      console.log("単語クリア！");
    }
  }
}
```

---

## 8. テストの実行方法

本ライブラリは、促音、撥音、拗音、全角半角、Mac環境差などの全77テストを収録しています。
npmやNode.jsがなくても、**ブラウザで開くだけ**でテストを実行できます。

1. `tests/index.html` をブラウザ（Google Chrome, Safari, Edge, Firefoxなど）でダブルクリックして開きます。
2. 画面上に全77項目のテストが自動実行され、結果が緑色（ALL PASS）で表示されます。

---

## 9. よくある質問・トラブルシューティング（FAQ）

### Q1. ローカルのHTMLをブラウザで開くと `CORS error` や `Cannot use import statement outside a module` が出る
* **原因**: ブラウザのセキュリティ仕様により、`file:///` 形式でローカルファイルを開いた場合、外部JSファイルの `import` が制限されることがあります。
* **解決策**:
  * **VS Code をお使いの場合**: 拡張機能「Live Server」をインストールし、HTMLファイルを右クリックして「Open with Live Server」を選択するとローカルサーバー経由で安全に開けます。
  * **Macをお使いの場合**: ターミナルで `python3 -m http.server` と打ち、ブラウザで `http://localhost:8000` を開くだけで動作します。

### Q2. ひらがなではなく、漢字混じりのテキストを渡しても判定できますか？
* **回答**: `TypingSession` の第1引数には、**必ず「ひらがな・記号・英数字」**を渡してください（例: 漢字「東京」ではなく読みがなの「とうきょう」）。
* 漢字を直接ローマ字に自動変換する機能は含まれていません。問題文データとして `{ kanji: "東京", kana: "とうきょう" }` のように読みがなを用意して渡してください。

### Q3. キーボードの日本語入力（IME）がオンのままでも判定できますか？
* **回答**: 一般的なタイピングゲームと同様、**「半角英数入力（直接入力モード）」**でキーを押してプレイする設計になっています。日本語IMEがオン（全角入力中）の場合、ブラウザの未確定変換バッファが優先されてしまうため、ゲームプレイ前にIMEをオフ（半角英数）にしてプレイしてください。

---

## 10. 更新履歴 (Changelog)

- **v1.0.0** (2026-10-26)
  - 初期リリース。
  - ゼロ依存・完全バニラJavaScript（ES Modules）構成。
  - 促音（っ）、撥音（ん）、拗音の複数入力表記、動的表示追従（Display Sync）に対応。
  - Mac JIS環境差吸収（波ダッシュ・全角記号等）に対応。
  - 全77テストを収録。

---

## ライセンス

MIT License - Copyright (c) 2026 mameeeeekko
