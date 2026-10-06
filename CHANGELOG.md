# Changelog

---

## [1.0.73] - 2026-10-06

### Added
- **STAGE3（クエストノード `W1_Q3`）の開始前会話で、各ミッションパターンの特徴をナビが説明するようにした**
  - `js/dialogueData.js` に `"W1_Q3_start"`（タイトル「チュートリアル3 -ミッションパターン2-」）を新規追加。
  - 説明対象は `js/enemyModeConfig.js` の `generateStage()` case0〜9 と同一の10ケース
    （撃破 / 生存 / 迎撃 / 電撃戦 / 砲台制圧戦 / タイムアタック / サボタージュ / 圧倒 / 精密射撃 / 純粋なる試練）。
    内容は実装と矛盾しないよう、各ケースの `endConditions` / `clearConditions` / 固有挙動
    （チェインの組み直し、飽和度上限、出題8文字以内＝`OVERWHELM_MAX_WORD_LENGTH`、ミス上限、アイテム・アクティブスキル禁止）に合わせた。
  - `showOnce: true`（他チュートリアルと同じ）… STAGE3 クリアまで毎回再生し、クリア後は会話をスキップ。
  - 副作用: `W1_Q3` ノードに会話バッジが付き、STAGE3 のランダム前会話（`RANDOM_DIALOGUES` の `pre`）はこの会話に置き換わる。

### Changed
- **チュートリアルの番号を1つずつ繰り下げた**
  - 既存「チュートリアル2 -ミッションパターン1-」の直後に本会話（チュートリアル3）を挿入するため、以降をずらした。変更は `title` のみ（本文に番号の参照は無い）。
    - `W1_Q5_start` … チュートリアル3 -エネミー文字タイプ- → **4**
    - `W1_MiniBoss_1_end` … チュートリアル4 -スキル- → **5**
    - `W1_Q12_start` … チュートリアル5 -アイテム- → **6**
    - `W1_Q13_start` … チュートリアル6 -星- → **7**
    - `W1_DEFENSE_1_start` … チュートリアル7 -防衛- → **8**
- **アプリケーションバージョンを `1.0.73` に更新**
  - `js/version.js` の `APP_VERSION` を `1.0.73` に更新。

## [1.0.72] - 2026-10-02

### Changed
- **スキルツリー長文「プログラミング」が出題されたとき、クリア条件の制限時間に +50秒 を加算**
  - 背景: 長文タグのうち「プログラミング」はコードサンプルが多く打鍵数が多い。
    他の長文と同じ「◯秒以内にクリア」条件では明らかに厳しすぎたため補正する。
  - 補正内容（`js/skillTree.js`）:
    - `PROGRAMMING_TAG_TIME_BONUS_SEC` … 加算秒数の定数（50）を新規追加。
    - `adjustUnlockForChallengeTags(unlock, challenge)` … 新規追加。
      出題タグ（`challenge.tags`）に「プログラミング」を含む場合のみ、
      条件の `type: "time"` だけ `value + 50` を返す。`unlock` 本体は改変せずコピーを返す。
    - `getChallengeTagNote(challenge)` … 新規追加。補正対象なら説明文を返す。
      長文は開始時までタグが未確定なので、候補（`tagWeights`）に
      「プログラミング」が含まれていれば必ず説明を返す。
    - `getUnlockTextForChallenge(unlock, challenge)` … 新規追加。
      補正したうえで `getUnlockText()` を通す表示用ヘルパー。
      判定と表示がずれるのを防ぐため、クリア条件の表示はすべてこれを経由させる。
  - 判定側の変更（`js/skillTreeResult.js`）:
    - `handleSkillModeResult()` が `node.unlock` を直接使っていたのを
      `adjustUnlockForChallengeTags(node.unlock, challenge)` 経由に変更。
      `challenge` は `gameState.currentChallenge` で、開始時に `tags` が確定しているため
      「実際に出題されたタグ」で判定できる。
  - 表示側の変更（`js/skillTree.js` / `js/skillTreeResult.js` / `js/skillTreeUI.js` / `style.css`）:
    - **長文入力中の上部ヒント（`#skillUnlockHint`）** … `startSkillMode()` が
      `getUnlockText(node.unlock)` を使っていたのを
      `getUnlockTextForChallenge(node.unlock, runtimeChallenge)` に変更。
      「プログラミング」が出題された場合は加算後の秒数（例: 145 → 195秒）を表示する。
    - **結果画面の「クリア目標」** … 同じく `getUnlockTextForChallenge()` 経由に変更し、
      判定値と表示値を一致させた。
    - オンマウス時のツールチップと開始イントロのタグ表示直下に
      「プログラミング」は文字数が多く難しいため、クリア条件の制限時間に +50秒 を加算
      を表示（`.skill-tag-note` スタイルを新規追加）。
    - 候補に「プログラミング」が含まれる長文ノードでのみ表示される。
  - 影響範囲:
    - 対象は長文タグ候補に「プログラミング」を含むノードのみ。
      該当するのは `LONG_TEXT_CHALLENGE_TABLE[3]`（`KILL_NEAREST_H` /
      `KILL_RANDOM` / `KILL_ALL` / `KB_UP_4` / `KNOCKBACK_EDGE` /
      `COOLDOWN_SPEED_3` / `DAMAGE_NEGATE_3` の一部）のみ。
    - `time` 条件だけ加算し、`accuracy` / `miss` / `score` は打鍵数ベースの指標のため据え置き。
    - `checkSkillUnlocks()`（子ノードの開放判定）は補正なし。
      子ノード解放は「親ノードでクリアしたか」ベースのため個別補正は不要。
    - 左（normal）・上（time_attack）・下（英語主体）は `challenge.tags` に
      「プログラミング」を持たないため挙動不変。
    - セーブデータ非互換なし。
- アプリケーションバージョンを `1.0.72` に更新
  - `js/version.js` の `APP_VERSION` を `1.0.72` に更新。
  - Service Worker のキャッシュ名を `mametype-v1.0.72` に更新。

---

## [1.0.71] - 2026-10-02

### Changed
- **スキルツリー右側（長文）の出題タグを「ノード生成時」から「チャレンジ開始時」に変更**
  - 症状: `buildLongTextSkill()` が `SKILL_TREE` 定数の生成関数であるにもかかわらず
    長文タグの重み抽選を行っていたため、タグは**ページ読み込み時に1回だけ**決まっていた。
    → リロードするまで同じノードの長文はずっと同じタグが出題されていた。
  - 変更内容（`js/skillTree.js`）:
    - `buildLongTextSkill()` … 抽選処理を削除。`challenge` は重み付き候補
      （`tagWeights`）だけを持ち、タグを固定しなくなった。
      `LONG_TEXT_CHALLENGE_TABLE[depth].tags` を `map(t => ({ ...t }))` で複製して保持するため
      元テーブルとの参照は切れており、偶発的な書き換えは発生しない（単一ソースは `LONG_TEXT_CHALLENGE_TABLE` のまま）。
    - `pickWeightedTag()` … `buildLongTextSkill()` 内の抽選ロジックを共通関数として切り出し。
    - `createRuntimeChallenge()` … 新規追加。開始時点の `challenge` を生成する。
      長文のみ重み抽選して `tags: [tag]` を1つに確定させ、
      `normal` / `time_attack` は決定的なのでそのまま返す（`challenge` 本体は改変せずコピーを返す）。
    - `startSkillMode()` … `createRuntimeChallenge()` を通過させた `runtimeChallenge` を
      `doCountdown({ custom })` に渡すよう変更（`mode` / `difficulty` も同オブジェクトから取得）。
  - 表示側の変更（`js/skillTreeUI.js`）:
    - オンマウス時のツールチップ（`canvas.onmousemove`）と
      開始イントロ（`showSkillIntro`）のタグ表示を
      `node.challenge.tags` 直参照から `getChallengeTagList(node.challenge)` に変更。
    - `getChallengeTagList()` は「選ばれる可能性があるタグ」を全件返すため、
      長文は 1個ではなく候補すべて（2〜3個）が表示される。
      `.skill-tags` / `.skill-tag` は元から `flex-wrap: wrap` のため折り返して収まり、**CSS変更は不要**。
  - 影響範囲:
    - 対象は右側（long_text）のノードのみ（`isSupport=false` のため英語補正も無関係）。
    - 左（normal）・上（time_attack）・下（英語主体）は `challenge` に `tagWeights` を持たないため
      従来と完全に同一の挙動。
    - 出題フィルタ（`js/gameModes.js` の `LONG_TEXT.buildTargets` → `filterByTags`）は
      開始時に確定した `tags: [tag]` を参照するため、**出題範囲自体は従来と同一**。
      変わるのは「そのタグがいつ 引かれるか」だけ。
    - リトライ（`js/skillTreeResult.js` の `startSkillMode()` 再呼び出し）も開始時なので、
      **リトライのたびに別タグが引かれる**。
    - 解放判定（`checkSkillUnlocks` / `unlock` / `requirements`）は challenge を参照しないため不変。
    - セーブデータ非互換なし（保存されるのは `unlockedNodes` のID配列のみ。challenge は保存されない）。
- アプリケーションバージョンを `1.0.71` に更新
  - `js/version.js` の `APP_VERSION` を `1.0.71` に更新。
  - Service Worker のキャッシュ名を `mametype-v1.0.71` に更新。

---

## [1.0.70] - 2026-10-02

### Changed
- **スキルツリー「下」（英語主体）のノードで、クリア条件の難易度を補正**
  - 背景: 下の補助系ノード（`isSupport=true`）は `SUPPORT_TAGS`（英語＋数字＋記号）で出題されるが、
    クリア条件は左（normal）・上（time_attack）と同じテーブルから取っていた。
    英語は「1文字＝1打鍵」に対し日本語（かな→ローマ字）は1文字あたり約1.4〜1.6打鍵なので、
    同じ文字数制限・同じ条件だと英語が明らかに易しかった。
  - 係数の根拠（実測 / 同じ制限時間でクリアできる問数）:
    - 240秒 … 日本語45問 / 英語56問（比 1.244 → 秒/問 0.804）
    - 150秒 … 日本語27問 / 英語35問（比 1.296 → 秒/問 0.771）
    - 2つの実験が独立にほぼ同じ値を示したため、英語は日本語の約 1.27 倍の問数
      （= 0.79 倍の所要時間）で打けると判断。
  - 補正内容（`js/skillTree.js` の `ENGLISH_TIME_FACTOR` / `ENGLISH_TARGET_FACTOR`）:
    - **スタンダード（normal）** … 出題側の問題数（`questionLimit`）は全ノード共通なので、
      クリア条件の**時間（time）だけ**を 0.79 倍に詰める（5秒刻みに丸め）
      `adjustUnlockForEnglishNormal()` が担当
    - **タイムアタック（time_attack）** … 出題側の制限時間（`limitSec`）は全ノード共通なので、
      クリア条件の**問数（target）だけ**を 1.27 倍に増やす（整数丸め）
      `adjustUnlockForEnglishTimeAttack()` が担当
    - `score` / `accuracy` / `miss` はいずれも打鍵数ベースの指標（`score` は `KPM × 正確率^3`）で
      言語差が出ないため**据え置き**（ご指定の「time と target だけ補正」と一致）
    - モードごとに補正関数を分けているため、time / target を一律で処理する汎用分岐ではなく、
      各モードで対象になる条件だけが確実に補正される
  - 補正後の条件:
    - time   : 75→60 / 80→65 / 65→50 / 85→65 / 150→120 / 140→110 / 270→215 / 260→205
    - target : 8→10 / 9→11 / 21→27 / 22→28 / 24→30 / 25→32 / 42→53 / 43→55
  - 影響範囲:
    - 対象は下の16ノードのみ（SLOT_1 / STOCK_1 / ITEM_SPAWN_1〜3 / MAX_HP_1〜3 /
      DEF_UP_1〜3 / EXP_UP_1〜3 / EXP_AUTO_1 / EXP_UP_2 / COOLDOWN_SPEED_1）
    - 左（normal）・上（time_attack）・右（long_text）は `isSupport=false` のため**完全に不変**
    - `challenge` 側（`questionLimit` / `limitSec` / `tags`）も変更なし＝**クリア条件だけ**を補正
    - 表示は `getUnlockText()` が `cond.value` を読むため UI側の変更は不要
    - セーブデータ非互換なし（`unlockedNodes` の保存形式は不変。既に解放済みのノードは巻き戻らない）
- アプリケーションバージョンを `1.0.70` に更新
  - `js/version.js` の `APP_VERSION` を `1.0.70` に更新。
  - Service Worker のキャッシュ名を `mametype-v1.0.70` に更新。

---

## [1.0.69] - 2026-10-01

### Changed
- **クエストマップの通常ステージのノード名を「Q11」〜「Q90」形式に変更**
  - 対象: `js/questMap.js` の `QUEST_MAP` にある通常ステージノード（全76ノード）のみ。
  - 採番規則: ノードIDの数字部分を引き、その値をそのまま表示名にする。
    - WORLD1: `W1_Q11`〜`W1_Q30` → `Q11`〜`Q30`（20ノード）
    - WORLD2: `W2_Q31`〜`W2_Q60` のうち防衛以外の28ノード → `Q31`〜`Q60`
    - WORLD3: `W3_Q61`〜`W3_Q90` のうち防衛以外の28ノード → `Q61`〜`Q90`
  - 据え置き（変更対象外）:
    - 接続テスト1〜10（`W1_Q1`〜`W1_Q10`）— チュートリアルとしての名称を維持するため。
    - 防衛ノード全12（`W1_DEFENSE_1`〜`WEX_DEFENSE_12`）— ノード種別が判別できる名称を維持。
    - 中ボス全10（`W1_MiniBoss_1`〜`WEX_MiniBoss_10`）とボス4
      （`W1_BOSS` / `W2_BOSS` / `W3_BOSS` / `WEND_LastBoss` = "Final Thread"）。
    - EXTRAの通常ステージ10（`WEX_Q91`〜`WEX_Q100`）— 現在の `EX1`〜`EX10` を維持。
  - `id` / `stage` / `next` / `pos` / `reward` / `enableRandomDialogue` には一切手を触れておらず、
    **進行状況・星・クリア判定のロジックは変更なし**（セーブデータ互換性に影響しない）。
  - 影響する表示（いずれも `node.name` の表示のみ）:
    - マップ上のノードラベル（`js/questMapUI.js` の `label.textContent = node.name`）
    - 会話ログ画面のステージ名（`js/dialogue.js` の `getStageName()`）
    - クエスト記録の「STAGE11 (Q11)」形式の表示（`js/hud.js` の `findQuestNode()`）
  - 補足: `js/questMap.js` の `W1_MiniBoss_1` に `name` が2行重複して定義されていた
    （`"最終接続テスト"` が上、`"システム・コア"` が下。後者が常に優先される状態だった）ため、
    実効値である `name: "システム・コア"` のみを残し、順序に依存する混乱を解消した。
    中ボス系の表示名は従来どおり「システム・コア」で、挙動は変わらない。
- アプリケーションバージョンを `1.0.69` に更新
  - `js/version.js` の `APP_VERSION` を `1.0.69` に更新。
  - Service Worker のキャッシュ名を `mametype-v1.0.69` に更新。

---

## [1.0.68] - 2026-10-01

### Changed
- **【純粋なる試練】（case 9）で、アクティブスキルUIに禁止マークを表示し、クールダウンタイムバーを動かさないよう変更**
  - 背景: case 9 は `js/enemyModeConfig.js` の `config.player = { ...ENEMY_MODE_CONFIG.player, disableActiveSkill: true }`
    によりアクティブスキルの使用が禁止されるが、表示側がそれを反映していなかった。
    `js/enemyCore.js` の Active Skill Charge Update は `skillUiEnabled` のみで条件判定していたため、
    **禁止されたにもかかわらずクールダウンが減り、ストックが1まで溜まってリングが満タン（＝使用可能に見える）状態**になっていた。
    同じ理由でコンボによるクールダウン短縮倍率のポップアップも出てしまっていた。
  - 実装:
    - `js/enemyCore.js`（`gameLoop()`）:
      - `skillUiEnabled` の直後に `activeSkillDisabled`（= `gameState.player?.disableActiveSkill === true`）を派生。
      - チャージ更新の条件に `!activeSkillDisabled` を追加。
        これによりクールダウンは減らず、ストックは0のまま保たれ、進捗リングは0で固定される。
      - `updateComboTierBar()` の第2引数に `skillUiEnabled && !activeSkillDisabled` を渡し、
        クールダウンが動かないため、倍率ポップアップ（`triggerCooldownSpeedPopup`）も出さない。
    - `js/enemyRenderer.js`（`renderActiveSkillUI()`）:
      - `disabled` を同様に判定。
      - `ratio` は禁止時に0で固定。`ready` / `fullyCharged` には `!disabled` をANDで追加した。
        これにより既存関数（`drawCooldownCircle` / `drawSkillIconCircle`）の挙動をそのまま活用できる。
      - 禁止時は `drawSkillProhibitMark()` でアイコン上に禁止マーク（暗幕＋赤リング＋左上→右下の斜線）を重ねる。
        アイコン自体は消さない（「装備はあるが、この試練では発動できない」ことを明示するため）。
      - ストック数字は禁止時は描画しない。
      - ツールチップ（`drawSkillTooltip()`）に `disabled` 引数を追加し、
        禁止時は先頭に赤字で「この試練では使用できません」の警告行を出す。
  - 影響範囲:
    - `disableActiveSkill: true` を設定しているステージ（＝ case 9 の純粋なる試練）のみ。
    - 他のステージは `disableActiveSkill` が `false` のため挙動は一切変わらない。
    - 通常モードは `initPlayerByMode` の else 側で `disableActiveSkill = false` に固定されているため従来どおり。
  - 付随: `js/version.js` の `APP_VERSION` を `1.0.68` に、
    Service Worker のキャッシュ名を `mametype-v1.0.68` に更新。

---

## [1.0.67] - 2026-10-01

### Fixed
- **全滅（Eliminate）終了条件が、アイテムが残っていると成立しなくなっていた不具合を修正**
  - 影響箇所: `js/enemyCore.js` の `gameLoop()` 内・フェーズ完了判定（`allSpawnedDefeated`）および
    クリア条件の「全処理終了（フォールバック）」判定。
  - 背景: 「全敵撃破で終了」は `enemies.filter(e => e.isObjective).length === 0`（= 目標敵が0体）
    を条件にしていた。しかし `ItemEnemy` は `Enemy` を継承するだけで `isObjective` を上書きしておらず、
    基底コンストラクタの `isObjective = true`（`js/enemy.js`）をそのまま引き継いでいた。
    このため **画面上にアイテムが1体残っているだけで「目標敵が0体」にならず、
    終了条件が一切発火しない** 状態になっていた（アイテムを取得、または寿命切れで
    `enemies` から消えた瞬間にようやく条件が揃って終了する、という挙動）。
  - 実装:
    - `js/enemy.js` の `ItemEnemy` コンストラクタに `this.isObjective = false;` を追加。
      アイテムは「ステージ目標敵」ではないというセマンティクスを根本的に修正した。
      既に `isObjective = false` を明示している召喚敵（`js/enemy.js`）・
      ビット（`js/enemy.js`）と同じ「ステージ目標外」の扱いに揃えたもの。
    - `js/enemyCore.js` の全滅判定を
      `e => e && !e.isDead && e.isObjective && !e.isItem` に変更。
      決定地点に「アイテムは終了判定を止めない」意図をコードとして残し、自己ガードとした。
    - `js/enemyCore.js` の「全処理終了（フォールバック）」側の `enemies.length === 0` も
      `e => e && !e.isDead && !e.isItem` に変更し、同種の不整合を解消。
  - 変更後の挙動: 残ったアイテムの有無に関わらず、敵が全滅していれば即座に終了する。
    残っていたアイテムは自動取得されず、屏幕上に取り残されて消える（スコア・戦績には影響しない）。
  - 影響範囲:
    - `endConditions.allSpawnedDefeated` / `phaseConditions.allSpawnedDefeated` を使う
      エネミーモードの全滅ステージのみ。`spawn.limit != null` ガードがあるため、
      該当しないステージの挙動は一切変わらない。
    - `killEnemy()` は元から `if (!isItem && !isBullet)` ガード内で
      `defeatedCount` / `objectiveDefeated` / `processedCount` / `phaseProcessedCount` /
      スコアを加算しているため、**アイテム取得を「敵をキルした」ように数える
      挙動は一切生じない**（従来どおり）。`chainCount` は元から `!isItem` ガードの外側に
      ありアイテム取得でも加算されるが、今回の変更では一切触れていない（既存の挙動を維持）。
  - 付随: `js/version.js` の `APP_VERSION` を `1.0.67` に、
    Service Worker のキャッシュ名を `mametype-v1.0.67` に更新。

---

## [1.0.66] - 2026-10-01

### Added
- **【精密射撃】の CLEAR 欄に「MISS」行を追加（KILL の直下）**
  - 背景: 精密射撃は `endConditions.failOnMissCount`（ステージにより 7 / 5 / 3）で
    ミス数を制限，早在 `js/enemyCore.js` で `mistakeCount >= failOnMissCount` を失敗判定にしている。
    しかしゲーム中HUDの CLEAR 欄には KILL 行しか無く、残り何回ミスできるかが
    画面上からは分からなかった（ミッション説明の `buildEndText()` に「◯回ミスすると終了」と出るのみ）。
  - 実装: `js/enemyRenderer.js` の `renderEndCondition()` で、
    `clear.killCount`（KILL 行）の push 直後に `MISS` 行を `lines2` へ追加。
    - 表示形式: `MISS: <現在のミス数>/<許容ミス数>`（KILL 行と同じ「現在/目標」形式）
    - 分母は `end.failOnMissCount` をそのまま使用。失敗判定と同一の値なので二重管理にならない。
    - 判定は `!= null` のため、`failOnMissCount` を持たない他ミッションの表示は一切変わらない。
    - 残り1回以下（その1回で終了する状態）のみ赤字 `#ff6b6b`。
      達成条件の緑（`#4caf50`）とは意味が逆のため、両者を混同させない。
  - 影響範囲: エネミーモード（精密射撃ステージ）／クエスト・フリーモードの両方。
    通常モード・防衛モードには影響しない。
  - 付随: `js/version.js` の `APP_VERSION` を `1.0.66` に、
    Service Worker のキャッシュ名を `mametype-v1.0.66` に更新。

---

## [1.0.65] - 2026-10-01

### Fixed
- **エネミーモードで同じ問題が同時に存在しうる問題を修正**
  - 背景: 画面上の敵同士が**まったく同じ問題**を持っていると、プレイヤーが打鍵した
    文字が「どちらの敵への入力」か判別できず、狙った敵を倒せないまま入力が吸われる。
    重複チェックがあったのは通常スポーン時のみで、以下の経路にはチェックが無く重複し得た。
    1. `Enemy.onWordComplete()` — 複数問題敵の2問目以降（RING / 固定砲台 / ボス hitCount 6〜15）
    2. `createBitEnemy()` — 左右のビット同士、およびボス本体との重複
    3. `spawnEnemy()` — 敵だけでなく弾・防御ワードが判定対象に入っていなかった
    4. `updateBehaviors("attack")` — ボスの防御ワード（activeAttack）
  - 実装:
    - `js/enemySpawner.js` に共通ヘルパー2つを追加。
      - `collectUsedTexts(state, excludeSelf, extraTexts)`
        生存中の敵・弾・各敵の `activeAttack` から「使用中のtext」を Set に集める。
      - `getUniqueWordForState(type, state, { maxLenLimit, retry, excludeSelf, extraTexts })`
        上記Setに含まれない問題だけを最大20回再抽選して返す。
        枯渇時のみ**重複を許容して最後の一問を返す**（敵が出現し損ねたり、
        hitCount を消費したのに新しい問題が出ず入力不能になる事故を防ぐ）。
    - 上記1〜4をすべて新ヘルパー経由に変更。
    - `js/enemy.js` `createEnemyByType()`（召喚敵）も `activeAttack` を重複判定に加えた。
      召喚元（`spawner`）自身の問題は許容する。
  - 影響範囲: エネミーモードの通常出現 / 複数問題敵 / ボス（ビット連動含む）/ 迎撃 / 召喚 /
    ボスの防御ワード。フリーモード・クエストステージの両方に効く。
  - 影響を受けないもの: 通常モード・防衛モードの問題列挙（別ルートのため）。
  - 補足:
    - 2問目引き直しと防御ワードは、自分自身は重複判定から除外する
      （自分自身は画面上で1つの問題しか持たないため）。
    - `js/target.js` のシャッフルバッグ（1巡するまで重複しない）は変更していない。
  - アプリケーションバージョン: `js/version.js` の `APP_VERSION` を `1.0.65` に、
    Service Worker のキャッシュ名を `mametype-v1.0.65` に更新。
---

## [1.0.64] - 2026-10-01

### Changed
- **同時存在数（`maxAlive`）の上限に達しているときは、敵を倒してもすぐには補充しないようにした**
  - 影響箇所: `js/enemyCore.js` のスポーン処理（`gameLoop` 内）。
  - 変更前の挙動: 出現タイマーの基準時刻 `lastSpawnTime` は「実際に敵を1体以上出した時」しか更新されなかった。
    このため `maxAlive` で上限に達して湧きが止められている間に経過した時間が残り、
    敵を倒して枠が空いた瞬間に `now - lastSpawnTime > spawn.interval` が条件を満たしてしまい、
    待ち時間なしで次の敵が補充されていた（上限を設けた意味が薄れていた）。
  - 変更後の挙動: 上限に達している間は `lastSpawnTime` を現在時刻まで巻き戻すようにした。
    これにより「枠が空いた時点（`maxAlive` から減った時点）」を起点に、
    `spawn.interval`（× 難易度の `spawnRate`）が経過してから出現する。
  - 実装: `aliveLimitOk`（同時存在数の判定）が false のときに `lastSpawnTime = now` を代入する3行のみ。
    既存の `lastSpawnTime` を流用しているため、ポーズ中の時間同期（`lastSpawnTime += deltaMs`）と、
    フェーズ切替時・ゲーム開始時のリセットはそのまま正しく働く。
  - 影響範囲:
    - 通常出現（`enemies.length`）と迎撃モード（`enemyBullets.length`）の両方に効く。
    - `immediateOnClear`（全滅時は即座に出現）の挙動は変更なし。
      本変更が影響するのは「画面が空になったとき」ではないため、maxAlive 溜まり状態とは干渉しない。
    - DEV overrides の `spawn.maxAlive` で上限を動的に上げた場合も、1間隔待ってから出現する。
  - 補足: `spawn.limit`（出現総数）によるブロックではタイマーを巻き戻さない（そもそも再出現しないため）。

---

## [1.0.63] - 2026-09-30

### Changed
- **RING（リング）の出現比率を全14テーブルで削減**
  - 影響箇所: `js/enemyModeConfig.js` の
    HEAVY系7（`ENEMY_TIER_BALANCED` / `ENEMY_TIER_ENGLISH_HEAVY` / `ENEMY_TIER_SYMBOL_HEAVY` /
    `ENEMY_TIER_ONOMATOPOEIA_HEAVY` / `ENEMY_TIER_PUNCTUATION_HEAVY` / `ENEMY_TIER_SOKUON_HEAVY` /
    `ENEMY_TIER_PROVERB_HEAVY`）＋ ONLY系7。
  - 背景: RING は `hitCount: 2`（1体につき2入力）のため、出現割合が高いと**実効的な湧き速度が低下**し、
    湧いた敵を捌ききれないため、難易度が跳ね上がっていた。
    特に HEAVY系の T8 が約61%、ONLY系の T8 が約52% と突出していた。
  - 対応方針:
    1. RING は各階層1枠に集約し、連続湧きを防止
    2. 減らした weight は STRIPE（速度1.2倍・入力は1回のまま＝湧き速度を維持）か 無地LARGE へ転用
    3. 目標RING比率: T4 15% / T5 10% / T6 20% / T7 25% / T8 30% / T9 30% / T10 35%
  - 主な変更（T8 / T10 の例）:
    - HEAVY系 T8: 約61% → 約27%
    - HEAVY系 T10: 約55% → 約32%
    - `ENEMY_TIER_SOKUON_HEAVY` の T4: 約50%（突出） → 約14%
    - ONLY系 T8: 約52% → 約24%
    - ONLY系 T10: 約42% → 約23%
  - 設計の根拠はコード内のコメント（「RING（リング）出現率の設計方針」）に記載。
  - 重みは `pickWeightedEntry()` が合計で正規化する相対抽選のため、weight 合計が 100 を超えていても
    挙動は weight 比のまま。
  - 注意: クエストステージは `enemyTable` を localStorage（`QuestStages_Cache_v5`）に保存済みのため、
    保存済みステージには旧構成が残る。フリーモードと新規生成ステージには新構成が反映される。
- **固定砲台の hitCount を Tier ごとの割合で抽選できるようにした**
  - 影響箇所:
    - `js/enemy.js` … `FIXED_TURRET_TIER_CONFIG` に `hitCountRatio`（0〜1）を追加。
      `createFixedTurretType()` がその値を type へ通す。
    - `js/enemySpawner.js` … `spawnEnemy()` で固定砲台のみ `Math.random()` を引いて
      `enemy.hitCount` を上書き（1〜hitCount の範囲に収める安全ガード付き）。
    - `js/main.js` … フリーモード【砲台制圧戦】の仕様表示に
      `formatFixedTurretHitCountText()` を追加し、「2回(60%) / 1回(40%)」のように内訳を表示。
  - `hitCountRatio` の意味: **「その Tier の砲台が `hitCount` 回入力になる確率」**（0.6 なら 6割が2入力）。
    未指定（`undefined`）の Tier は従来どおり 100% で `hitCount` を使う。
  - 採用値: T3〜T6 = `0`（1入力固定） / T7 = `0.3`（2入力が解禁される最初のTier、7割は1入力） /
    T8 = `0.5` / T9 = `0.55` / T10 = `0.6`。
  - 補足: `hitCount: 1` の Tier に比率を書いても `Math.max(1, hitCount-1)` = 1 となるため
    実効は1入力固定。T7 で `hitCount` を 1→2 に上げたことで、初めて2入力が実際に混ざる。
  - 挙動: 画面上の「×2」バッジは `enemy.hitCount > 1` で個体ごとに判定されるため、
    1入力の砲台には出ず、2入力の砲台にだけ出る。`onWordComplete()` は `hitCount--` のみ行うため
    追加対応は不要。弾（`BulletEnemy`）は `hitCount: 1` 固定なので影響なし。
  - 撃破スコアは hitCount に比例配分せず据え置き。1入力の砲台が得点効率では有利になるが、
    実装の単純さと「運良く1入力で倒せたときの達成感」を優先した意図的な設計。
  - 単一ソースの原則を維持: 表示値は `FIXED_TURRET_TIER_CONFIG` を直接参照し、ミラー表は設けていない。
- **アプリケーションバージョンを `1.0.63` に更新**
  - `js/version.js` の `APP_VERSION` を `1.0.63` に更新。
  - Service Worker のキャッシュ名を `mametype-v1.0.63` に更新。

---

## [1.0.62] - 2026-09-30

### Changed
- **単色（ONLY）敵テーブルの全7色統一**
  - 影響箇所: `js/enemyModeConfig.js` の
    `ENEMY_TIER_GRAY_ONLY` / `ENEMY_TIER_PURPLE_ONLY` / `ENEMY_TIER_YELLOW_ONLY` /
    `ENEMY_TIER_BLUE_ONLY` / `ENEMY_TIER_PINK_ONLY` / `ENEMY_TIER_GREEN_ONLY` / `ENEMY_TIER_RED_ONLY`。
  - 背景: 従来は `ENEMY_TIER_RED_ONLY` だけが「T1〜T4=SMALL主体 → T5でLARGE登場 → T9〜T10=LARGE主体+装飾」
    という10階層の骨格を持っていたが、ほかの6色は 1〜3 エントリ固定で、T5以降も SMALL/NORMAL が主力だった。
    色を選ぶと敵の構成の厚みが大きく変わっていたため、7色すべてを同じ骨格に揃えた。
  - 並び替え規則（3階層）を7色すべてに適用:
    1. `size`    : LARGE → NORMAL → SMALL
    2. `pattern` : 無地 → STRIPE → RING
    3. `shape`   : CIRCLE → SQUARE → PINWHEEL
  - 色は主shapeで差別化し、見た目にも違いが出るよう調整した:
    GRAY / PURPLE / YELLOW / RED は CIRCLE 主体、PINK / GREEN は SQUARE 主体、BLUE は PINWHEEL 主体。
  - `ENEMY_TIER_YELLOW_ONLY` は「ことわざ＝短い語彙がない」ため SMALL タイプが存在しない
    （`enemySpawner.js` / `enemy.js` で `YELLOW_*_SMALL*` は NORMAL へ強制変換される）。
    従来 T1 が `YELLOW_CIRCLE_SMALL` のみで実質 NORMAL の二重指定になっていたため、
    Yellow だけ NORMAL を最小サイズとして扱う形に修正。
  - 重みは `pickWeightedEntry()` が合計で正規化する相対抽選のため、各階層の weight 合計は 100 を超えていても
    挙動は weight 比のまま（並び替え・重み再設計による抽選結果の変化は意図したもの）。
  - 変更なし: キーの名前、`description`（「のみ」を含むので `addFixedTurretEntriesToTable()` の
    固定砲台除外条件はそのまま有効）、`index.html` の選択肢、`TIER_TABLES` の登録順。
  - 注意: クエストステージは `enemyTable` を localStorage（`QuestStages_Cache_v5`）に保存済みのため、
    保存済みステージには旧構成が残る。フリーモードと新規生成ステージには新構成が反映される。

---

## [1.0.61] - 2026-09-30

### Changed
- **被弾時のチェインの挙動を「0リセット」から「多めに減少」に変更**
  - 従来は `markDamageTaken()` が `chainBurst()` を無条件に呼び、被弾するたびに
    `chainCount` が即座に 0 になっていた（チェイン強制リセット）。
  - これを撤回。ミス時と同じ「チェインバーを減算する」方式に統一し、
    **減る量だけを `missPenalty`(500) より重い `damagePenalty`(2500) にして** 被弾を表現する。
  - `chainCount` を直接触らないため、バーが 0 を割り込まない限りチェインは維持される。
    0 を割り込んだ場合は従来通り `updateChainBar()` → `chainBurst()` で自然に破断する（ミスと同じ挙動）。
  - 設定: `js/enemyModeConfig.js` の `ENEMY_MODE_CONFIG.chain.damagePenalty`（既定 `2500`）。
  - 反映箇所: `js/enemyCore.js` の `markDamageTaken()` / `gameState.enemyStats` 初期化 / Dev Override 適用部。
  - 変更なし: ミス時の処理（`inputCore.js` / `enemyCore.js`）、時間減衰による自然破断（`updateChainBar`）。
- **DEV パネル（PARAM）に `Damage` 行を追加**
  - `missPenalty` と同じ操作（値の投入 / 適用 / リセット、`Def/2500` 表示）で
    `damagePenalty` を調整できるようにした。`dev/devTools.js` に
    `setDamagePenalty` / `applyDamagePenalty` / `resetDamagePenalty` を追加。
- **アプリケーションバージョンを `1.0.61` に更新**
  - `js/version.js` の `APP_VERSION` を `1.0.61` に更新。
  - Service Worker のキャッシュ名を `mametype-v1.0.61` に更新。

---

## [1.0.60] - 2026-09-29

### Added
- **フリーモード（ENEMY）の Rule Settings に特殊ミッション4種を追加**
  - 選択肢が「時間制限 / 討伐数指定 / エンドレス」から、
    さらに「電撃戦 / 迎撃 / 砲台制圧戦 / 圧倒」の計7種に拡張。
  - 実装: `index.html` の `data-pattern` と `.pattern-detail` パネル（`enemyParamBlitz` / `enemyParamIntercept` / `enemyParamTurret` / `enemyParamOverwhelm`）。
  - ミッション構成はクエストの `generateStage()` case 2/3/4/7 と同一パラメータで、
    `js/enemyModeConfig.js` の `buildFreeEnemyMissionConfig()` に集約（`INTERCEPT_TIER_SPEC` / `OVERWHELM_MAX_WORD_LENGTH` を再利用し、バランス値は二重管理にしない）。
- **【迎撃】に使用文字種の選択を追加（英語 / 数字 / 記号 / すべて）**
  - `freeInterceptCharType` の select を追加。文字プールは `enemy.js` の `getUnusedLetter()` に既にある4種をそのまま使う。
  - `INTERCEPT_CHAR_TYPES` を単一ソースとして、select 選択肢・保存値の妥当性検証・説明表示で共有。
  - `getInterceptTierSpec()` は `INTERCEPT_TIER_SPEC` 本体の参照を返すため、
    `buildFreeEnemyMissionConfig()` 内で**必ずコピーを作って** `charType` を上書きする（直接書き換えるとクエスト等其他ゲームへ波及する）。
- **【迎撃】【砲台制圧戦】に出現 Tier の実数値を説明欄に表示**
  - 迎撃: 総弾数 / 1ウェーブ発数 / 同時存在上限 / 弾速 / ダメージ / 使用文字種。
  - 砲台制圧戦: 入力回数 / 出題文字数 / 撃破スコア / レーザーと弾砲のダメージ・間隔・連射数・文字種。
  - 固定砲台の専用定義は T3 以降のため、T1・T2 指定時は T3 として動作することを注記。
  - ★砲台の表示値は `enemy.js` の `FIXED_TURRET_TIER_CONFIG` を直接参照する（単一ソース）。
    そちらの値を編集すれば UI の説明欄も自動的に追従する。ミラー表は設けない。

### Fixed
- **フリーモードの特殊ミッションが「時間制限 Survive が少し違うだけの通常戦」になっていた不具合を修正**
  - `js/enemyCore.js` のフリーモード分岐は、終了条件をゼロから再構築し `phaseConditions` を削除、
    `spawn.limit` を強制 `null` にするため、ミッション固有の設定が一切 `stage` へ引き継がれていなかった。
  - 3点を緩和:
    1. `custom.phaseConditions` があれば復元（クリア判定は phaseCond 優先のため、電撃戦・迎撃ではこれが無いと発火しない）
    2. `endConditions` / `clearConditions` の再構築に `chainCount` / `survive` / `allBulletsResolved` を通す
    3. `spawn.limit` を `custom.spawn?.limit ?? null` に変更（迎撃の総弾数が進行そのもの）
  - 加えて `FREE_MISSION_STAGE_KEYS` で `interceptMode` / `interceptSpec` / `berserk` / `saturation` / `turretMode` / `maxWordLength` / `enemySpeedMultiplier` / `missionName` を `stage` に引き継ぐ。
  - 結果として迎撃は「全弾処理完了」でクリア可能になり、電撃戦はチェイン達成、砲台制圧戦・圧倒は生存クリアが効く。
- **Rule Settings の保存先が誤検出する問題を修正**
  - `#configEnemy` 内の GAME START ボタンも `pattern-btn active` を持つため、
    保存時のセレクタを `#configEnemy .pattern-selector .pattern-btn.active` に絞った。

### Changed
- アプリケーションバージョンを `1.0.60` に更新
  - `js/version.js` の `APP_VERSION` を `1.0.60` に更新。
  - Service Worker のキャッシュ名を `mametype-v1.0.60` に更新。

---

## [1.0.59] - 2026-09-28

### Changed
- **【迎撃】を各ブロックの先頭ステージ（STAGE1 / 11 / 21 / 31 / 41 ...）に配置しないように変更**
  - 既定では序盤3枠（下一桁 1〜3）を `[0:撃破, 1:生存, 2:迎撃]` のシャッフルで埋めており、
    ブロック先頭に迎撃が来る可能性があったため。
  - `initGeneratedStages()` で先頭が迎撃だった場合のみ 2〜3番目と入れ替える（それ以外は従来どおりのランダム配置）。
  - `generateStage()` のパターン自動決定（`explicitPattern` なし時）も、
    下一桁が 1 のときは `[0, 1]` からだけ選ぶよう修正して不変条件を生成側に固定。
- **【迎撃】弾の色を速度別に変えた（色相は固定・明度/彩度のみ）**
  - `INTERCEPT_TIER_SPEC` の `variance` により同じウェーブでも弾速がばらつくため、
    速度に合わせて「遅い弾＝深い青 `#00b8f5` / 標準＝従来色 `#5cd6ff` / 速い弾＝明るいシアン `#b8edff`」
    を3点で補間して設定するようにした。
  - 3色とも色相約195°で揃えているため、背景や敵との配色バランスは崩れない。
  - `getInterceptBulletColor()` を `enemyModeConfig.js` に追加（スポーン側・描画側の単一ソース）。
  - ワープ出現演出（`drawInterceptWarpEffect`）の光輪・収束リング・中心閃光も
    弾の速度色に合わせて着色し、出現直後から速さが色で見えるようにした。
  - 入力対象（ロック／候補）になった弾のオレンジ化は従来どおり（他ミッションと共有のため変更なし）。
- **クエストステージキャッシュキーを `QuestStages_Cache_v4` → `QuestStages_Cache_v5` に変更**
  - 保存済みステージを新配置で再生成するため。
  - 参照箇所: `enemyModeConfig.js` / `questProgress.js`（`resetQuestAll`）/ `saveFile.js`（allowlist・JSON化対象・読取・書出・コメント）/ `dev/saveFileTest.js`
- **アプリケーションバージョンを `1.0.59` に更新**
  - `js/version.js` の `APP_VERSION` を `1.0.59` に更新。
  - Service Worker のキャッシュ名を `mametype-v1.0.59` に更新。

---

## [1.0.55] - 2026-09-28

### Fixed
- **【迎撃】の左上パネル（OBJECTIVE / CLEAR / 迎撃率リング）が描画されない不具合を修正**
  - タイマー開始条件が「通常敵が画面に入った時」のみで、敵を一体も使わない迎撃では永久に開始されず、
    `renderEndCondition` が `if (!startTime) return;` で全描画をスキップしていた。
  - 弾が画面に入った時点でタイマーを開始するよう修正（通常モードの挙動は不変）。
- **【迎撃】で結果の統計がすべて 0 だった不具合を修正**
  - `gScore`: 弾の撃ち落としがスコアを加算していなかった（`if (!isItem && !isBullet)` の内側だったため）
  - `kills` / `defeatedCount`: 同様に弾が加算対象になっていなかった
  - `correctCount` / `mistakeCount` / `accuracy`: 入力統計は元から動作。KPMのみ無効化。

### Added
- **【迎撃】弾1発あたりのスコアを T1〜T10 で設定可能に**
  - `INTERCEPT_TIER_SPEC` に `score` を追加（T1: 30 → T10: 90）
  - チェイン倍率が乗る。通常の敵と同様の方式

### Changed
- **【迎撃】では KPM を評価軸にしない**
  - `gKpm` / `skillScore` / `rank` を無効化（`rank` は `-`）
  - スコア計算の速度ボーナスも加算しない
  - クエスト記録への `kpm` 登録を行わない（`hasKpm: false`）
  - 結果画面の KPM 欄は「迎撃率（撃ち落とし/総数）」に差し替え
  - ※ `avgKpm` は `totalTyped / totalBattleTime` で算出されるため影響を受けない
- **アプリケーションバージョンを `1.0.55` に更新**
  - `js/version.js` の `APP_VERSION` を `1.0.55` に更新。
  - Service Worker のキャッシュ名を `mametype-v1.0.55` に更新。

---

## [1.0.54] - 2026-09-28

### Added
- **【迎撃】ミッションを新規追加（旧【殲滅】スロットを置き換え）**
  - 敵は一体も出ず、空間からワープして現れる弾を撃ち落とすだけのミッション。
  - 弾は homing 100%（必ずプレイヤーへ向かう）なので、回避はできない。「撃ち落とすか当たるか」の二択になる。
  - 迎撃率（撃ち落とした弾 / 湧いた弾の総数）でスター評価する。★5 は迎撃率100%のみ。
  - 迎撃率100%はフリーズ／回復スキルなどを使ってかなり頑張る必要がある。
- **弾の速度ゆらぎ**（1ウェーブ内で「遅い弾」と「速い弾」が混在）
- **迎撃率HUD**：円形リング内に百分比を表示（被弾するとリングが短くなる）
- **弾の出現演出**：ワープ（収束リング＋光輪＋中心閃光）。演出中は移動しない
- **迎撃用のHUD表示**：`SPAWNED 送出した数/総数`、`BULLET 画面上の残弾数`、`SHOT 撃ち落とし進捗`

### Changed
- ミッションパターン枠は従来どおり10種のまま（増減なし）。パターン2（【迎撃】）のみ差し替え
- 迎撃の弾は既存の `enemyBullets` 配列をそのまま使い、`isObjective` で迎撃の弾だけを区別する
- 弾の `BulletEnemy` は既定の `color` / `shape` を保持（描画で落ちないように）
- クエストステージキャッシュキーを `QuestStages_Cache_v3` → `QuestStages_Cache_v4` に変更（保存済みステージを新構成で再生成）
- `isTierPressureExempt` にパターン2（迎撃）を追加（出現間隔・同時存在数を独自設計）
- **アプリケーションバージョンを `1.0.54` に更新**
  - `js/version.js` の `APP_VERSION` を `1.0.54` に更新。
  - Service Worker のキャッシュ名を `mametype-v1.0.54` に更新。

---

## [1.0.53] - 2026-09-26

### Changed
- **固定砲台を「正六角形の外壁＋同系色の内部装甲」に刷新**
  - 固定砲台（`shape: "turret"`）は「幅が広く背の低い面取り長方形」で画面に埋もれていたため、外壁を**正六角形**に変更。
    - `js/shapeDefinitions.js` の `case "turret"` を、外接円半径 = `size` の正6頂点パスに再定義。
    - 頂点が真上・真下（pointy-top）なので左右対称で、`enemyRenderer.js` の `rotate(0)` 前提は維持。
    - 外接円半径がそのまま `Enemy.radius`（= 接触判定の半径）なので、**見た目と当たり判定がちょうど一致**する。
  - `js/enemyRenderer.js` の `drawTurretShape()` を書き直し、描画要素を4つに整理（シグネチャは `grad` 廃止で `(ctx, x, y, size, color)`）。
    - ① 外壁の放射グラデーション
    - ② **内部装甲**：外壁と同じ向きで内接する小六角形（半径 `size*0.66`）
    - ③ 装甲パネル線：小六角形の各頂点から外壁の同じ頂点へ放射状に戻す6本
    - ④ 中心コア（`size*0.22`）
    - 配色は `adjustColor` で明度だけ変えた**同系色のみ**を使用（`| color + 55 |` と `| color - 70 |`）。警戒縞や白いハイライト輪郭は不使用。
    - 外壁には外側グロー（`shadowBlur = size*0.35`）を残し、暗い背景から分離する。
    - コアの脈動アニメーションは撤去し、固定描画に単純化。
  - 固定砲台の色から無彩度のグレーを廃止し、攻撃演出と同系色に変更。
    - 固定レーザー砲台 `#717171` → **`#e05252`**（レーザー演出の赤 `#ff554f` と統一）
    - 固定弾砲台 `#d4d4d4` → **`#3fa9e8`**（弾色 `#4aa3df` と統一）
  - 固定砲台の `size` を `20` → **`26`** に拡大。
    - ⚠️ `size` は `Enemy` の `radius` であり、接触判定 `enemy.js` の `dist < player.radius + this.type.size` にも使われるため、**接触ダメージの距離は従来比 +6px 広がる**。
    - UI セーフエリア（`getUISafeMinEnemyY`）／出現マージン／`×残数`バッジ／ロックカーソルはすべて `size` 相対なので 6px ずつ追従する。
  - レーザー砲台の攻撃まで時間を**横棒 → リング**に変更（アイテムの消えるまでの時間と同じUI）。
    - 横棒は word とローマ字の間（`y - size*1.15` 付近）に置かれるため、文字列の重なり回避でずれると被って見えなくなるケースがあった。
    - `js/effectManager.js` の `renderFixedTurretLaserCountdown()` を、アイテムの寿命リング（`enemyRenderer.js` の Item Lifetime Ring）と同じ `arc` スタイルに統一。
    - 半径 `size * 1.12`（＝六角形外壁の外側）、背景リング＋残量リングの2層、残り 25% 以下で赤（`#ef4444`）のパルス。起点はアイテムと同じく「左固定・上半分が縮む」表現。
    - リングは本体を囲むだけなので、word／ローマ字のどちらとも衝突しない。
    - 危険予兆の「3→2→1」カウントダウン数字（`radius: 11` 固定 → `Math.max(11, Math.round(size * 0.58))` で `size` 追従）はそのまま維持。
- **アプリケーションバージョンを `1.0.53` に更新**
  - `js/version.js` の `APP_VERSION` を `1.0.53` に更新。
  - Service Worker のキャッシュ名を `mametype-v1.0.53` に更新。

### Notes
- 弾数・ダメージ・攻撃間隔・`hitCount`・出現重みなどのバランス値は一切変更なし。
- キャッシュ名を変更したため、Service Worker の旧キャッシュは自然に解除される。

---

## [1.0.52] - 2026-09-26

### Changed
- **【圧倒】の敵を10文字以内に制限**
  - 大量の低速の敵が画面に溜まる【圧倒】だけ、出題文字数の上限を10文字に設定。
  - 敵の種類・見た目（色/形/サイズ）・出現重み・速度・ダメージは変更なし。
  - 上限を超える長文の敵（例: LARGEサイズ／`minLen 8-15`）は、**その敵の属性タグの10文字以内の問題**へ差し替える。
    - 例: 紫（英語）の大型敵 → 英語の8〜10文字、黄（ことわざ）の大型敵 → ことわざの8〜10文字。
  - `SMALL`（2〜4字）・`NORMAL`（5〜10字）・固定砲台のT3〜T9は元々10文字以内なので変化なし。
  - 複数問題敵（`hitCount > 1`）の2問目以降も同じ上限を適用。
  - 【圧倒】以外は従来どおり（フリーモード・ボス戦・防衛モードを含む）。
- **アプリケーションバージョンを `1.0.52` に更新**
  - `js/version.js` の `APP_VERSION` を `1.0.52` に更新。
  - Service Worker のキャッシュ名を `mametype-v1.0.52` に更新。

### Notes
- 実装: `js/target.js` に `resolveWordLengthRange()` を追加（上限だけ縮める。敵タイプ定義の `minLen` は保持）。
- `js/enemySpawner.js` の `spawnEnemy()` が `config.maxWordLength` または `missionName === "圧倒"` で上限を判定。
- クエストステージは `localStorage`（`QuestStages_Cache_v3`）に保存済みだが、ミッション名での判定があるため**キャッシュキーは変更せず**、保存済み環境でもそのまま10文字制限が効く。

---

## [1.0.51] - 2026-09-25

### Added
- **通常ユーザー向け統合セーブ機能を追加**
  - デイリー／クエスト／共通設定を1個の `.mametype` ファイルへまとめるExportを追加。
  - Importはファイル形式・バージョン・AES-GCM認証・JSON構造・型・値を検証してから、既存のlocalStorageキーへ戻す。
  - 壊れたファイルや認証失敗時は、既存データを書き換えない。
  - 設定画面を `BACKUP DATA` に整理し、Export / Import / Reset だけを表示する。
  - ResetはBackup対象のlocalStorageキーだけを削除し、Player ID・復元コード・オフラインデータは保持する。
  - 旧JSON Export/Import関数は設定画面から削除し、開発・旧形式互換用としてソース上だけに保持。
- **保存フォーマットのリファレンスコメントを追加**
  - 正式な仕様は `js/saveFile.js` の冒頭コメントを参照。
  - `containerVersion` / `schemaVersion` / `keyVersion` / `appVersion` の用途、将来のmigration追加手順、保存対象キーを記録。
- **ブラウザ内テストページを追加**
  - `dev/saveFileTest.html` で往復、復号、Header/IV/ciphertext改ざん、構造検証、Reset、localStorage rollbackを確認する。
- **アプリケーションバージョンを `1.0.51` に更新**
  - `js/version.js` の `APP_VERSION` を `1.0.51` に更新。
  - Service Workerのキャッシュ名を `mametype-v1.0.51` に更新。

### Security boundary
- クライアント内固定鍵を使うAES-GCMは、JSONの容易な直接編集を抑止し改ざんを検出する目的である。
- JavaScriptから鍵を抽出・解析する高度な利用者までは防げず、完全なチート防止ではない。

---

## [1.0.50] - 2026-09-25

### Added
- **クエストモードの会話画面に会話速度設定ボタンを追加**
  - 会話枠右上のボタンから5段階の会話速度を選択できるようにした。
  - 選択した速度は設定画面の会話速度スライダーと `typing_game_settings.dialogueSpeed` に同期する。
  - 速度変更は会話中でも次の文字から反映される。
- **アプリケーションバージョンを `1.0.50` に更新**
  - `js/version.js` の `APP_VERSION` を `1.0.50` に更新
  - Service Worker のキャッシュ名を `mametype-v1.0.50` に更新

---

## [1.0.49] - 2026-09-25

### Added
- **T3以降の固定砲台敵を追加**
  - 移動せず、幅が広く背の低い据置型を実装。砲身や方向部品は持たず、中央に装甲リングを1つだけ配置。
  - レーザー砲台は攻撃までの残り時間をバーで表示し、最後の3秒は`3 → 2 → 1`で予兆を表示してから、防御ワードなしの直接攻撃を行う。防御スキルの無敵時間中は専用のガード演出に切り替わる。
  - 弾砲台は既存のボス用`BulletEnemy`と同じ弾処理を使い、Tierごとの弾数・ダメージを調整。
  - T3〜T10の固定砲台設定に、攻撃間隔・撃破スコア・弾速・弾文字種類を追加。
  - 各Tierの`hitCount`と入力文字数の設定は維持し、T8以降は出現重みの増加を頭打ちにした。
  - 固定砲台専用のレーザー・被弾・ガードエフェクトと、防御成功時にバリア外側へ散る残光を実装。
- **アプリケーションバージョンを `1.0.49` に更新**
  - `js/version.js` の `APP_VERSION` を `1.0.49` に更新
  - Service Worker のキャッシュ名を `mametype-v1.0.49` に更新

---

## [1.0.48] - 2026-09-24

### Changed
- **ステージ前会話のスキップ条件を「クリア済み」→「一度でもステージに挑戦済み」に変更**
  - クリア済みステージは従来どおり**自動スキップ**（`js/questMapUI.js` の `shouldSkipDialogue` は変更なし）
  - 一度でもステージに入っていれば（**未クリア**、**ESCで中断して抜けた場合**も含む）、ステージ前会話の `skip to end(E)` / `skip to choices(C)` が使えるようになった
  - `js/questProgress.js` に `enteredStages`（nodeID → true）を新設し、`markStageEntered()` / `hasStageBeenEntered()` を追加。`hasStageBeenEntered()` はクリア済みも true とみなすため、旧セーブデータでも従来どおりスキップ可能
  - `js/questMapUI.js`: ステージ開始処理（`startCombat` / `startDefense`）の先頭で `markStageEntered(node.id)` を呼び、イントロで ENTER した時点＝突入として記録（イントロの `ESC / B` キャンセルは記録しない）
  - `js/dialogue.js`: `_start` 会話の `canSkip` と、選択肢選択後の再判定を `hasStageBeenEntered()` ベースに変更。ランダムなステージ前会話（一時ID `_random_...`）も、`startDialogue()` で保持したクエストIDを使ってスキップ可能に
- **アプリケーションバージョンを `1.0.48` に更新**
  - `js/version.js` の `APP_VERSION` を `1.0.48` に更新
  - Service Worker のキャッシュ名を `mametype-v1.0.48` に更新

---

## [1.0.47] - 2026-09-24

### Added
- **クエストモードHUDの CLEAR 行に「EXTRA全クリアマーク（Ex）」を追加**
  - `js/hud.js` の `updateQuestHud()` で、既存の全クリアマーク「C」（`hasSeenTrueEnding()`）の**右隣**に、EXTRA全クリア時（`hasExtraCleared()`）のみ「Ex」バッジを表示
  - 見た目は「C」と完全に同一（`CLEAR_BADGE_STYLE` を C / Ex で共有）。背景 `#fadb14` ／ 文字色 `#1c1c1c` ／ 角丸 4px ／ `padding: 1px 5px` ／ `font-size: 10px` ／ bold ／ `margin-left: 4px` ／ `vertical-align: middle`
  - 表示先は `index.html` の `#hudClear`（クエストHUD）。`index.html` / `style.css` は変更なし（従来どおりインラインスタイル方式）

### Changed
- **アプリケーションバージョンを `1.0.47` に更新**
  - `js/version.js` の `APP_VERSION` を `1.0.47` に更新
  - Service Worker のキャッシュ名を `mametype-v1.0.47` に更新

---

## [1.0.46] - 2026-09-21

### Changed
- **クエストモードの「SAVE / LOAD」「CLEAR REWARD」「KEY BINDINGS」をクエストモーダルUIに統一**
  - `index.html`: 旧スタイル（`.save-modal` / `.save-modal-content` / `<h2>`）から、SKILL TREE・EQUIP SKILLS と同じ
    `.quest-modal` → `.quest-modal-box` → `.quest-modal-title` + `.quest-modal-content` + `.quest-modal-close-btn` 構成へ変更
  - JS が参照する ID（`saveModal` / `questSlots` / `saveToQuestMenuBackBtn` / `clearRewardModal` / `clearRewardContent` /
    `clearRewardModalCloseBtn` / `keybindConfigModal` / `keybindConfigContent` / `keybindConfigCloseBtn` / `keybindConfigSaveBtn`）はすべて維持し、開閉も従来どおり `hidden` クラスで行う（JS 変更なし）
  - `style.css`: `.quest-modal.hidden { display: none; }` を追加（`.quest-modal` は `display: flex` のため、これが無いと閉じられない）
  - `#saveModal, #clearRewardModal, #keybindConfigModal { z-index: 10010; }` を 画面階層セクションに追加し、従来の重なり順を維持
  - スロットカード／報酬パネル／キーバインド行を EQUIP SKILLS と同じカード配色（`rgba(13,17,23,.92)` ＋ `rgba(88,166,255,.3)` 罫線・角丸12px）に統一。LOAD/SAVE は `.quest-modal-btn` と同じ見た目に
  - `#keybindConfigContent` は設定画面と共用の `.keybind-row` を外し、モーダル専用の `.keybind-modal-list` に変更（設定画面の KEY セクションは不変）
  - モーダル幅は 3 画面共通で `min(640px, 92dvw)`。内容はボックス内スクロール（見切れ防止）
- **クエスト系モーダル7画面のタイトル文字サイズを統一**
  - `:root` に `--quest-modal-title-size: 26px` を新設し、`.quest-modal-title` はこの変数のみでサイズを決めるよう変更
  - `.quest-modal-box.quest-modal-skill .quest-modal-title` の `font-size: 22px` 上書きを削除（余白8pxのみ維持）
  - 対象: DIFFICULTY / SKILL TREE / SKILL(EQUIP SKILLS) / STAR UPGRADE / SAVE・LOAD / KEY BIND / CLEAR REWARD（フリーモードのスキル・星強化モーダルも同一クラスのため揃う）
- **アプリケーションバージョンを `1.0.46` に更新**
  - `js/version.js` の `APP_VERSION` を `1.0.46` に更新
  - Service Worker のキャッシュ名を `mametype-v1.0.46` に更新

---

## [1.0.42] - 2026-09-17

### Changed
- **オフライン用データのダウンロードを「完全手動・実測進捗」に刷新**
  - 旧実装は `START_OFFLINE_CACHE` をSWへ投げるだけで、進捗・完了・失敗が伝わらず「押した瞬間に最新版です」と誤表示され、実際には1件も保存されていなかった
  - 新実装: 設定ボタン押下時のみ、ページ側（`js/main.js` の `downloadOfflineData()`）が直接 `caches.open()` + `fetch` で Cache Storage（`mametype-app` / `mametype-assets`）へ書き込む
  - 進捗は「取得 n ・ 既存 m ／ 全 N 件」の実測値をモーダルに表示。完了前に全URLを `caches.match()` で検証し、失敗があれば「再試行」ボタンを出す
  - アセットは既存スキップ。失敗したURLだけを「再試行」で取り直す（保存済み分の再取得は不要）
  - Service Worker に `GET_OFFLINE_MANIFEST` を追加（同一オリジンのURL一覧を返信）。install 時のブートキャッシュを廃止
- **自動アップデート促しモーダルを全廃**
  - `#update-notification` モーダルと `showUpdateNotification` / `showUpdateReady` / `showOfflineReady` / `showUpdateProgressPreparing` / `autoApplyUpdate` / 中央下の `#swDownloadIndicator` バーを削除
  - 新バージョンの検知は設定画面の VERSION 欄の**テキスト表示のみ**。適用（再起動）はオフラインDLモーダル内の「更新を適用して再起動」ボタンを押したときだけ実行
- **BGM / SE を「モード開始時読み込み」に変更（起動時の自動デコードを停止）**
  - `effectManager.js` に `registerSoundAssets()` / `ensureSound()` を新設。`playBGM` / `playSE` / `fadeBGMTo` は未取得の音源をその場で読み込んでから再生する（`buffers[name]` が無くても黙って無音にならない）
  - 各モード開始処理（gameCore / enemyCore / defenseCore）で `await ensureSound(bgm)` を追加し、BGM開始の遅れを最小化
  - 起動時の画像・フォントの裏読み込み（`loadRemainingAssets`）は従来どおり維持（フォント最優先）
- **アプリケーションバージョンを `1.0.42` に更新**
  - `js/version.js` の `APP_VERSION` を `1.0.42` に更新
  - Service Worker のキャッシュ名を `mametype-v1.0.42` に更新

### Fixed
- **版を上げても手動DL済みのオフラインデータが消えないように修正**
  - SW の activate は旧 `mametype-v*` キャッシュのみ削除し、固定名の `mametype-app` / `mametype-assets` は保持する
- **オフライン起動が失敗する可能性を解消**
  - `supabase.js`（`https://esm.sh` を静的import）を `js/main.js` から外し、新設の `online/loadSupabase.js` 経由で「実際に通信する瞬間」だけ動的importする。esm.sh が取得できない環境でもゲーム本体は起動する（オンラインランキング等のみ無効化）

---

## [1.0.39] - 2026-09-15

### Changed
- **アプリケーションバージョンを `1.0.39` に更新**
  - `js/version.js` の `APP_VERSION` を `1.0.39` に更新
  - Service Worker のキャッシュ名を `mametype-v1.0.39` に更新

### Fixed
- 軽微なメタデータ修正とドキュメント更新

---

## [1.0.36] - 2026-09-13

### Fixed
- **オフライン用DLバーが100%近くで突然0%に戻る問題を修正**
  - DLは2フェーズ構成（①起動コア → ②残り全アセット）で、フェーズ②開始時の `start` 再受信がバーを0%リセットしていた
  - `_startEstimatedDlProgress(startPct)` を引数化し、既に表示中の%から継続するよう変更
  - `showUpdateProgressPreparing`・`start` 受信時は、バー表示中なら0%に戻さず現在の%から推定を継続
  - `complete-boot`（フェーズ①完了）ではバー・推定を止めずフェーズ②へ引き継ぐ（隠して再表示すると幅が0%に戻るため）
  - `_lastShownDlPct` を `_updateSwDownloadBar` 内で記録し、再開起点として使用

---

## [1.0.35] - 2026-09-13

### Fixed
- **ダウンロード中バーが途中で0%に戻って進まない問題を修正**
  - 遅れて届いた `start` メッセージが推定進捗を0%にリセットしていたため、既にバーが表示中の場合は幅を0%へ戻さないように変更
  - 推定タイマーが動いている間は `start` で再初期化しない（バーの連続前進を維持）
  - 実測 `progress` が届いたら推定を停止し、実測%を中央下バーにも反映（Windowsは実測、Safariは推定で表示）
  - `file-error` 時も推定を停止して実測%を反映

### Changed
- **設定画面の説明文を削除**
  - 「最新版をダウンロードして、オフライン（インターネット無し）でも遊べるようにします。」を除去（ボタン名だけで目的を伝える）

---

## [1.0.34] - 2026-09-13

### Changed
- **「最新版をオフライン用にダウンロード」完了後のモーダル（今すぐ更新/後で）を廃止**
  - ボタン押下＝適用・再起動への同意と見なし、ダウンロード完了後に自動で適用（`SKIP_WAITING`→再起動）するよう変更
  - 進捗は設定のステータス文＋中央下バーで表示（`ダウンロード完了。オフライン用キャッシュを更新中…自動で再起動します`）
  - バックグラウンド検出（ページを開いただけで新版が見つかった場合）は、勝手な再起動を避けるため従来どおりモーダル表示
  - 初回DL（オフライン用データの初期取得）の「OK」モーダル、Safari向け推定進捗・5秒再送・10秒保険リロードは維持

---

## [1.0.33] - 2026-09-13

### Improved
- **「アップデートを確認」を「最新版をオフライン用にダウンロード」へ改称**
  - 本来の目的（最新版をキャッシュしてオフラインでも遊べるようにする）をUIに明示
- **設定画面にオンライン版とオフライン用キャッシュ版を分けて表示**
  - `オンライン（実行中）: vX ／ オフライン用キャッシュ: vY`
  - キャッシュ版は適用完了（controllerchange／初回DL完了）時に localstorage へ記録
  - オフラインで動く版が一目で分かるように

### Fixed
- **Safariでダウンロード中バーが0%のまま進まない問題を修正**
  - Safariはinstall中の新SWからの postMessage を受信できないため、実測が来ない間は推定進捗タイマー（1秒毎+1%、最大90%）でバーを前進させる
  - 実測 `UPDATE_PROGRESS` が届いたら推定値を上書き、完了・更新なし・エラー時は停止して掃除

---

## [1.0.32] - 2026-09-13

### Fixed
- **「適用しています...」のバーが止まって見える問題の再修正**
  - 適用開始時に `getRegistration()` で登録を取り直してから `waiting` を参照（クロージャ陳腐化の防止）
  - `SKIP_WAITING` 再送時も登録を取り直す
- **Windows ChromeでINP約2秒の主因を緩和**
  - `inputCore.handleKey()` のタイプ音をクリティカルパスから外し、後追い再生に変更（`requestIdleCallback`／`setTimeout(0)`）
  - 入力→描画を先に通すことでINPの「入力遅延」を短縮。音質・音量の仕様は不変
  - Windowsのタイピング表示から `text-shadow` を外しペイント負荷を微減（`text-stroke` のみ維持、renderer不変）

---

## [1.0.31] - 2026-09-13

### Fixed
- **「適用しています...」モーダルがCmd+Rまで止まる問題を修正**
  - 適用バーを90%打ち止めから100%までの単調増加に変更（100ms毎+2%、Cmd+R不要と明示）
  - 保険リロードを段階式に（5秒で waiting 再送→10秒で強制リロード）
- **最新時に確認を押すと下バー0%放置になる問題を修正**
  - 更新なし確定・失敗・ポーリング終了時に `_hideSwDownloadBar()` で必ず消す
  - waiting 確定時はバーを消してから通知モーダルへ遷移

---

## [1.0.30] - 2026-09-13

### Fixed
- **バージョン表示を以前の表記に戻す**
  - 設定の文言を `現在のバージョン: vX`／`最新です（vX）` に復帰
  - 起動時チェックの誘導文言も簡素化
  - タイトル下 `versionLabel` は実行中コード版（`APP_VERSION`）のまま。オンライン素通し構成ではページ自体が常に最新コードのため
- **Safariで確認バーが自動で進まない・適用モーダルで操作不能になる問題を修正**
  - 準備中は全画面モーダルで塞がず中央下バーのみで進捗表示（初回DL時のみモーダル）。モーダルは waiting 確定後に表示
  - `registration.waiting` 検出のポーリング保険（1秒毎・最大30秒）を追加し、postMessage 取りこぼしでも通知へ遷移
  - キー横取りを「今すぐ更新ボタンありの完了状態のみ」に限定し、準備中は裏操作・Cmd+R を塞がない
  - `isApplyingUpdate` ガードは維持（適用中の確認ボタン再入場を抑止）

---

## [1.0.29] - 2026-09-13

### Fixed
- **適用前からメニューのバージョンが最新に見える混乱を解消**
  - 設定のバージョン文言を「実行中 vX（適用＝オフライン用データの更新）」に整理し、ページのコード更新とSWキャッシュ更新が別物であることを明記
- **適用中に設定の確認を押すとモーダルで詰む問題を修正**
  - `isApplyingUpdate` ガードを導入。「今すぐ更新」押下〜リロード完了まで確認ボタンの再入場と準備中モーダルの再初期化を抑止
- **WindowsのUI文字のにじみ対策を見直し**
  - 全体の弱いstroke（0.1px）を撤去（逆効果のため）
  - Windowsのみ小UI文字は `Yu Gothic UI / Meiryo` 優先に切替、タイピング大文字のみ丸ゴ維持＋stroke 0.2px＋微 shadow で補正
  - 静的CSSのみのためタイピング遅延なし（renderer不変）

---

## [1.0.28] - 2026-09-13

### Fixed
- **Safariでアップデート進捗が自動で増えない問題を修正**
  - 「アップデートを確認」押下直後に準備中モーダル（0%）を先行表示（`onupdatefound` 発火待ちを解消）
  - `start` 受信時にモーダル側バーも0%で即時更新（中央下バーのみ進む問題を解消）
  - 完了ステータス名の不一致を修正（SW側 `complete-boot` を受信側でも受理）
- **「今すぐ更新」ボタンの文字を中央揃えに修正**
  - `.update-button` に `display:inline-flex; justify-content:center; align-items:center` を追加（`text-align` のみでは `inline-flex` で中央化されないため）
- **WindowsのUI全体の文字のにじみを軽減**
  - Windows判定で `body.win` を付与し、静的CSSのみで補正（`-webkit-text-stroke`＋タイピング表示のみ `weight:500`、実ウェイト同梱済み）
  - renderer/毎フレーム描画は不変のため、タイピング表示遅延なし
- **Windowsでhardresetしないと真っ黒のまま起動しない問題を緩和**
  - 起動時に `version.js` を `no-store` で1回だけ取得し、差分があれば設定画面に更新誘導を表示（案A: 自動DLなし、ゲーム起動・描画に介入しない）
  - `loadCoreAssets` に30秒タイムアウト＋継続フォールバックを追加し、停滞しても真っ黒のままにしない

---

## [1.0.27] - 2026-09-13

### Fixed
- **ゲーム開始直後に別問題が一瞬表示される問題を修正（Windows のみ）**
  - `js/gameCore.js` の `loadText()` で `renderState()` の前に `document.fonts.ready` を待機
  - フォントが切替（swap）完了してから問題を描画するため、フォールバック描画のチラ見えを防止
  - タイピング中は影響なし（初回描画時のみ数ms〜数十ms待機）

---

## [1.0.25] - 2026-09-13

### Added
- **アップデート確認の手動化と進捗表示の改善**
  - ページロード時の自動バックグラウンド更新チェックを廃止（低スペックPC/Windows への負荷削減）
  - 「アップデートを確認」ボタン押下時にのみ更新チェックを実行
  - ダウンロード中にモーダル内へプログレスバー・進捗％・ファイル数（`● / ● files`）を表示
  - ダウンロード完了後に「今すぐ更新」ボタンを有効化

### Fixed
- **アップデート通知モーダルのボタン文字を中央揃えに修正**
  - `.update-button` に `text-align: center` を追加

---

## [1.0.24] - 2026-09-13

### Fixed
- ### 修正 1: `js/renderer.js` — 標準/タイムアタックモード

__問題__: `renderNormal` の日本語表示が毎フレーム `innerHTML` を再構築していた。Windows でフォント再評価が頻発し、入力文字が遅れて表示される原因。

__修正内容__:

- `_normalJpSpans` スパンプールと `_normalPreparedText` キャッシュを追加
- テキストが変わったときのみスパンを生成し、毎フレームは `className` のみ更新
- `\r` / `\n` 文字の扱いも従来どおり（空文字に変換）
- `resetRendererState` にプールリセットを追加

### 修正 2: `js/defenseRenderer.js` — 防衛モード

__問題__: `renderWordList` が毎フレーム `getDisplayFullRoma` と `measureText` を呼んでいた。漢字問題でこの計算が重く、Canvas 全体がカクつく原因。

__修正内容__:

- `_defenseRomaCacheKey` / `_defenseCachedRemainingRoma` キャッシュを追加
- 現在単語・入力位置・入力文字列が変わったときのみ `getDisplayFullRoma` を再計算


---

## [1.0.22] - 2026-09-12

### Fixed
- **タイプ表示の遅れを安定状態へ復帰（毎フレーム描画 + 同期描画に戻す）**
  - 「軽量化」で入った「打鍵時のみ描画 + rAF二重遅延（`renderState` の rAF → `render` の rAF）」を撤去し、安定していた仕様に戻した
  - `speedTick` が毎フレーム `renderState()` を呼び、`render()` / `renderState()` は同期実行 → **打った文字が常に1フレーム以内で表示される**
  - タイムアタックの250ms描画スロットルは毎フレーム描画に統合のため廃止（タイマー数値は秒変化時のみ更新のまま）
  - Low品質のFPSキャップ（`shouldRunFrame`）とAuto品質の計測（`recordFrame`）は従来どおり維持
- **更新後の自動再起動が動かない問題を修正**
  - 「今すぐ更新」押下後、待機中SWが無い場合は `update()` → 再取得 → それでも無ければ **自動でページを再読み込み**（モーダルで止まりっぱなしを防止）
  - `controllerchange` が5秒以内に起きなくても**強制再読み込みの保険タイマー**を追加 → 「アップデート後、自動的に再起動します」の文言どおりに動作
- **更新画面の裏でキーボードショートカットが発火する問題を修正**
  - アップデート通知モーダル表示中は全ショートカットを無効化（Escape / b のみ「後で」で閉じられる）
  - メニュー系ショートカットの画面判定を `getComputedStyle` ベースに変更（インライン未設定の隠れ画面まで「表示中」と誤判定して、メニューにいないのにゲームやメニューが裏で起動する問題を防止）

---

## [1.0.21] - 2026-09-12

### Fixed
- **タイピング表示の遅延（スタンダード / タイムアタック / 長文 / 防衛）をフォント事前読み込みで解消**
  - 自己ホストフォント（M PLUS Rounded 1c / Inter）は unicode-range サブセット（woff2 約200ファイル）に分かれており、**その文字を初めて表示した瞬間にネットワークから遅延取得**される（`font-display: swap`）
  - このため、漢字を含む問題が出るたびに新しいサブセットの取得待ちが発生し、タイピング表示が「フォールバック描画 → 差し替え」で遅れていた（エネミーモードは表示がほぼひらがな・ローマ字のため、最頻出サブセットだけで済み問題が起きなかった）
  - **起動後の裏読み込みで全フォントサブセットを事前取得**し、HTTP キャッシュに載せることで、タイピング中のフォント取得待ちを構造的に排除（assetsLoader が fonts.css から woff2 一覧を自動抽出。フォント → 画像 → 音声の優先順で読み込み、中央下の進捗バーに集約）
  - **Service Worker 側でもフォントを事前キャッシュ**（オフライン起動時も日本語表示が即時・正しいフォントで描かれる）
  - キャッシュバージョンを v1.0.21 に更新

---

## [1.0.20] - 2026-09-11

### Fixed
- **SW 起因の「failed to fetch」「no cached response」・タイピング表示遅延を完全に回避**
  - fetch ハンドラを「**オンライン中は一切介入しない**」方式に変更。`navigator.onLine` が真（オンライン）の間は SW はリクエストを横取りせず、ページは SW が無いのと同じ速度でネットワークに直行する
  - これにより、Windows で見られていた「SW の fetch だけ失敗する（プロキシ/セキュリティソフト等の環境要因）→ モジュールやフォントが 503 になり、スタンダードの日本語表示だけフォールバック描画で遅延」という問題が構造的に解消
  - **オフライン時のみ**キャッシュから配信（それまでに install / activate のバックグラウンド事前キャッシュが用意したキャッシュ）
- バックグラウンド事前キャッシュはオンライン中のみ実行するよう変更

---

## [1.0.19] - 2026-09-11

### Fixed
- **Windows で「failed to fetch at service-worker.js:615:16」→ 起動不能になる問題を根本修正**
  - Service Worker の fetch ハンドラを「**ネットワーク最優先**」方式に刷新。オンライン時は `caches.match`（CacheStorage 排他ロック待ち）を行わずに即ネットワーク応答を返し、絶対に throw しない（ネットワーク失敗時のみキャッシュへフォールバックし、それも無ければオフライン用の 503 レスポンスを返す）
  - **タイピング遅延の解消** — 従来は全リクエストがまずキャッシュ読み取りのロックを待っていたが、ネットワーク最優先にしたことでタイプ音などの fetch がロック待ちで遅延しなくなった
- install 時のキャッシュを**起動コア（BOOT_CORE_ASSETS）のみ**に縮小し、素早く有効化されるように変更
- 起動コア以外は **activate 後のバックグラウンド**で「1件ずつ・300ms 間隔」でキャッシュ（進捗は中央下バーで表示、完了で「オフラインで遊べるようになりました」通知）
- キャッシュバージョンを v1.0.19 に更新（壊れたキャッシュを確実に置換）

---

## [1.0.18] - 2026-09-11

### Fixed
- **service-worker.js の起動時 ReferenceError を修正（Windows で起動しない問題の根本原因）**
  - `DEFERRED_ASSETS`（未使用の定数）が `CORE_ASSETS` の宣言より前にそれを参照しており、`const` の一時的デッドゾーンにより SW スクリプトの評価が `cannot access CORE_ASSETS before initialization` で失敗していた
  - 未使用の `DEFERRED_ASSETS` を削除し、SW が正常に登録・実行されるように修正
- `notifyClients()` を堅牢化 — 閉じられたクライアントへの `postMessage` 失敗で install の進捗通知が中断しないように

---

## [1.0.17] - 2026-09-11

### Added
- SW（Service Worker）の裏ダウンロード進捗バーを画面中央下に追加（オフライン用データ / アップデートデータの取得中だけ表示）
- ダウンロード完了時に「オフラインでも遊べるようになりました」または「アップデートの準備が完了しました」のお知らせを表示
- アップデート通知モーダル側のプログレスバーを撤去（通知が出る頃には常に100%のため不要。進捗は中央下バーに集約）

### Fixed
- service-worker.js の CORE_ASSETS 配列内に入り込んだ不要コード（`await`）を除去し SW の構文エラーを修正（SW 登録が正しく行われるようになった。これにより Windows でのオフラインキャッシュ・更新通知が正常動作）

---

## [1.0.15] - 2026-09-11

### Fixed
- サウンドアイコン `sound1.png` / `soundmute.png` のパスが `../assets/...`（親階層参照→Pages 上で404）になっていたのを `./assets/...` に修正（Windows で起動時に画像読み込みエラー）

---

## [1.0.14] - 2026-09-11

### Fixed
- オーディオデバイスが無効な環境（Windows でオーディオサービス停止・ポリシー制御中など）で AudioContext の生成に失敗すると、コアアセット読み込み全体が失敗してゲームが起動しない問題を修正（音なしモードで続行するように）
- 音源（BGM/SE）の取得・デコードに失敗しても起動が止まらないように強化

### Improved
- 両OSでフォントのフォールバック順を整備（Windows では丸ゴに無い文字が Meiryo / Yu Gothic UI で描かれる）

---

## [1.0.13] - 2026-09-11

### Improved
- Windows の 125% / 150% 表示スケーリング環境でステージの原点・サイズをデバイスピクセルにスナップし、全体のぼやけ・にじみを低減
- 品質 Low / Auto 自動劣化の DPR 下限を 1.0 → 1.25 に引き上げ（125% 環境で文字が 1:1 解像度になる）
- Windows のみ、文字の可読性補正を追加（Canvas の小さい文字を同色ストロークで太字化 / DOM は -webkit-text-stroke + weight 500）
- Web フォント読み込み完了後に Canvas を一度だけ再フィット（フォールバック字形の残骸を防止）

---

## [1.0.12] - 2026-09-11

### Improved
- windowsでの文字のにじみに対応
- 勲章システムに、獲得までの回数を表記。

---

## [1.0.11] - 2026-09-10

### Added
- セーブデータ保存に関する注意事項を知らせるダイアログを追加(「次回から表示しない」チェックボックス付き。バージョン更新時は設定をリセットして再表示)

---

## [1.0.0] - 2026-09-10

### Added
- test release

### Improved
- test

### Fixed
- test

---