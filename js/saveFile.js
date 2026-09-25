/**
 * ============================================================================
 * MameType Save Format (MAMETYPE) — 公式リファレンス
 * ============================================================================
 *
 * 目的
 * ----
 * 通常ユーザーが JSON を直接開いて数値を編集できないようにし、1個のファイルで
 * Daily / Quest / 共通設定を跨ブラウザで受け渡します。既存の localStorage を
 * ゲーム内保存の正本とし続けるため、このモジュールは Export 時に既存キーを読み、
 * Import 時に検証済みの値だけ既存キーへ書き戻します。
 *
 * 通常Exportは1個だけ
 * ------------------
 * - Export: `mametype-save-YYYYMMDD-HHmmss.mametype` 1個
 * - Import: 上記 `.mametype` 1個
 * - Reset: BACKUP DATAの全ターゲットキーを削除し、ページ再読み込みで初期値から再開
 * - storage.js の旧JSON関数は開発・旧形式互換用としてソース上だけに保持する。
 *   設定画面には表示せず、削除・自動変換・新形式への自動降格も行わない。
 *
 * Export対象の正本キー（allowlist）
 * --------------------------------
 * Daily:
 *   typing_game_records, typing_game_ranking, difficulty_daily
 * Global:
 *   typing_player_stats
 * Quest:
 *   questProgress, questPlayerStats, questStars, quest_slots, quest_auto_save,
 *   QuestStages_Cache_v3, difficulty_quest
 * Settings:
 *   typing_game_settings, typing_game_quality, keybinds, final_n_mode,
 *   free_mode_config_v1, difficulty_free, difficulty_free_enemy
 *
 * Export対象から除外するキー
 * ------------------------
 * - player_id / recovery_code / typing_player_profile
 *   オンライン認証は既存のサーバー検証付き COPY / IMPORT UI の所有物であり、
 *   クライアント固定鍵のゲームファイルへ移さない。
 * - mametype_applied_version / saveDataNoticeDismissedVersion / devPanelPos
 *   端末固有のキャッシュ・通知UI・開発状態。
 * - questDifficulty / mametypeDisplaySize / playerName / playerStats
 *   現行コードで正式な状態として使われていない旧キー。
 * - Cache Storage / IndexedDB / sessionStorage / Cookie
 *   MameTypeのゲームセーブではない。
 *
 * null の意味
 * ----------
 * 永続JSONデータの null は「その localStorage キーが存在しなかった」ことを表します。
 * ただし Export payload の構造上、daily.records / ranking / quest.stars / slots は
 * ファイル内で配列・object必須です。値なしを許可するのは progress / playerStats /
 * autoSave / stageCache / settings の各項目など、既存Loaderが未設定を扱える項目です。
 * Import時は JSON.stringify(null) した文字列を書き込まず removeItem します。特に
 * questProgress / questPlayerStats へ文字列 "null" を書くと既存 Loader が
 * object を期待して壊れるため、この区別は厳守します。
 * 値が存在するJSONキーは stringify済みの文字列として既存形式へ戻します。
 *
 * バイナリコンテナ（Container Version 1、合計24 byteのheader）
 * ---------------------------------------------------------
 * offset size 内容
 *   0      8    ASCII magic: "MAMETYPE"
 *   8      2    containerVersion: uint16 little-endian
 *  10      1    cipherSuite: 1 = AES-256-GCM
 *  11      1    keyVersion: 1 = SAVE_KEYS[1]
 *  12     12    exportごとのランダム96-bit IV
 *  24      -    AES-GCM ciphertext（Web Cryptoは128-bit tagを末尾に付加）
 *
 * header 24 byte entirety を AES-GCM additionalData にするため、version / suite /
 * key version / IV を変えると復号・認証が失敗します。独自checksumは実装しません。
 *
 * 暗号のセキュリティ境界
 * -------------------
 * - 256-bit固定鍵をJavaScriptに保持し、AES-GCMでencrypt/decryptする。
 * - exportごとに crypto.getRandomValues(new Uint8Array(12)) で新しいIVを作る。
 * - 同じkey + 同じIVを二度使わない。
 * - Web Cryptoなので secure context（HTTPS / localhost）が必要。
 * - クライアント内固定鍵は高度な利用者には抽出可能であり、コンソールから復号して
 *   正しく再暗号化することもできます。本実装は「容易なJSON直接編集」の抑止と
 *   認証Tagによる改ざん検出が目的であり、完全なチート防止ではありません。
 * - ファイル名、拡張子、MIMEだけで正当性を判定しません。
 *
 * 暗号化されたJSON payload（Schema Version 1）
 * --------------------------------------------
 * {
 *   schemaVersion: 1,
 *   appVersion: APP_VERSION,          // 情報。互換性判定には使わない
 *   exportedAt: ISO-8601,
 *   data: {
 *     daily:   { records, ranking, difficulty },
 *     global:  { playerStats },
 *     quest:   { progress, playerStats, stars, slots, autoSave,
 *                stageCache, difficulty },
 *     settings:{ game, renderQuality, keybinds, finalNMode, freeMode,
 *                freeDifficulty, freeEnemyDifficulty }
 *   }
 * }
 *
 * `global.playerStats` という分類は、現行 typing_player_stats が Daily だけでなく
 * Free の統計、Quest関連実績、真エンディングのグローバルフラグも含むため。
 * ゲーム内の保存先名や意味は変更しません。
 *
 * バージョンアップで拡張する方法
 * ------------------------------
 * 4つのversionを用途別に分けます。
 *
 * 1) containerVersion
 *    binary header、cipher suite、containerの読み方、圧縮方式を変更する場合に上げる。
 *    1 readerを維持したまま2 readerを追加し、versionで分岐する。
 *
 * 2) schemaVersion
 *    永続化するゲームデータ構造を変更する場合に上げる。具体的には新しい保存対象キー、
 *    object/arrayの意味や型、既存キーの意味、default、migration requirement。
 *    「任意フィールド追加」も旧appで落としたり誤解釈し得るため、schema変更として
 *    version bumpとreviewする。
 *
 * 3) keyVersion
 *    固定AES鍵そのものを変更する場合だけ上げる。keyIdを古い値のまま別の鍵へ差し替えない。
 *    将来 keyVersion 2 を追加するときも、v1 file読取用に SAVE_KEYS[1] を削除しない。
 *
 * 4) appVersion
 *    MameType appのrelease情報。旧appで読めるかとは無関係。
 *
 * 実装手順:
 *   a. CURRENT_SCHEMA_VERSION と envelope reader/writerを追加・更新する。
 *   b. CURRENT_SCHEMA_VERSION より小さいversionには dedicated migrationを追加する。
 *   c. migrationはlocalStorageへ直接書かず、memory上で古いschemaを現行schemaへ変換する。
 *   d. migration後にも必ず全validationを通す。
 *   e. 新しいExportは常に最新schemaで生成する。
 *   f. 古いreaderを残し、未知の新しいschemaは「破損」ではなく「未対応」と表示する。
 * 本ファイルはExport詳細リファレンスと実装の単一正本とし、version変更時は
 * このコメント、migration map、ブラウザ内fixture test、compatibility matrixを同時更新する。
 *
 * migration skeleton（将来v2へ変更する場合の例）
 * --------------------------------------------
 * const CURRENT_SCHEMA_VERSION = 2;
 * const SCHEMA_MIGRATIONS = {
 *   1: (payload) => {
 *     const migrated = migrateV1DataToV2(payload.data);
 *     return { ...payload, schemaVersion: 2, data: migrated };
 *   },
 * };
 *
 * 実装上のルール:
 * - migrationはpure functionにしてlocalStorage/Date.now/randomへ触れない。
 * - migration後に再度全validationする。
 * - 旧versionのExport pathとkey mapは削除しない。
 *
 * Compatibility matrix（実装の正本）
 * -------------------------------------
 * - Container v1 / Key v1 / Schema v1: 現在のExport・Importで相互利用可。
 * - Container v2以降: 旧container readerを残し、containerVersionで分岐する。
 * - Key v2以降: keyVersion 1の鍵とreaderを残し、新Exportだけ最新keyを使う。
 * - Schema v2以降: SCHEMA_MIGRATIONS[1]等を追加し、旧schemaを現行へ変換する。
 * - 未知のversion: 破損と区別してUNSUPPORTED_MESSAGEを返す。
 *
 * PBKDF2は使わない。ユーザー入力passphraseがなく、secret自体がクライアントに
 * 埋め込まれているため、PBKDF2を追加してもクライアントから秘密鍵を解析できる
 * 境界は変わらない。目的在于、JSONの容易な直接編集と認証Tagのない改ざんを防ぐことである。
 *
 * 固定鍵の更新時:
 * const SAVE_KEYS = { 1: createSaveKeyV1() }; // v1 fileを古い形式でも読めるまま保持
 * // 将来: const SAVE_KEYS = { 1: createSaveKeyV1(), 2: createSaveKeyV2() };
 * //      const LATEST_KEY_VERSION = 2; // 新しいExportだけがkey 2を使う
 *
 * Export keyの追加手順
 * --------------------
 * 1. localStorage全列挙ではなく TARGET_KEYS のallowlistへ明示追加する。
 * 2. Export reader、payload field、Import writer/validatorを同時に追加する。
 * 3. null / default / migrationの要否をレビューする。
 * 4. schema変更があれば schemaVersionを上げる。
 * 5. 往復test、古いschema fixture test、不正値testを追加する。
 *
 * Import安全性
 * -----------
 * 1. File size → 2. header/format → 3. container/cipher/key version → 4. AES-GCM復号・tag認証
 * 5. UTF-8 → 6. JSON.parse → 7. schema versionとmigration → 8. schema/型/値/参照整合 validation
 * 9. 全て成功するまで localStorage.setItem / removeItem を一度も呼ばない。
 * 10. 適用直前の対象キーをsnapshotし、書込中exception時はrestoreする。
 * 11. questPlayerStats / questProgress / stageCache等のmemory cacheは再構築するため、
 *     正常apply後は page reloadする。
 *
 * Reset安全性
 * -----------
 * - localStorage.clear()は使わず、Importと同じ TARGET_KEYS だけを削除する。
 * - Player ID / recovery_code / typing_player_profile / Cache Storageは対象外。
 * - 削除前の全ターゲット値をsnapshotし、途中exception時はrollbackする。
 * - UIは二段階確認、成功時だけquest sessionを破棄してpage reloadする。
 *
 * 既知の制約
 * ----------
 * - localStorageにはtransactionがない。snapshot rollbackは quota等への実用的な防御だが、
 *   localStorage自体が使用不能になる障害時の完全なtransaction保証ではない。
 * - 巨大JSONによるmemory loadを防ぐためplaintextとfile sizeを制限する。
 * - 認証Tagは「鍵を知らない状態での改ざん」を検出する。鍵を抽出した攻撃者は再暗号化可能。
 *
 * 関連ファイル
 * ------------
 * - storage.js / main.js はゲーム内保存の正本・UI接続を担当
 * - service-worker.js / main.js OFFLINE_APP_FILES: このJSをオフラインでも取得
 * - dev/saveFileTest.html: Browser内round trip / tamper / validation / rollback test
 *
 * 実機ブラウザ確認
 * ----------------
 * 1. HTTPSまたはlocalhostで dev/saveFileTest.html を開き、全テストがALL PASSになること。
 * 2. 設定→BACKUP DATAでExportし、先頭がMAMETYPE、JSON文字列を含まないことを確認する。
 * 3. Resetを二段階確認し、Backup対象だけが初期化され、Player ID等が残ることを確認する。
 * 4. Safari→Chrome、Chrome→Safari、Edge→ChromeでExportファイルをImportする。
 * 5. ファイルを1 byte変更してからImportし、拒否後に既存データが残ることを確認する。
 * 6. 通常ゲーム、クエスト開始/セーブ/ロード、デイリープレーをsmoke testする。
 * ============================================================================
 */

import { APP_VERSION } from "./version.js";

export const SAVE_FILE_EXTENSION = ".mametype";
export const SAVE_CONTAINER_VERSION = 1;
export const CURRENT_SCHEMA_VERSION = 1;
const SCHEMA_MIGRATIONS = Object.freeze({
  // 将来 schemaVersion 2 を追加する例:
  // 1: (payload) => migrateV1ToV2(payload),
});
export const SAVE_FORMAT_REFERENCE = "MameType Save Format v1";

const MAGIC = "MAMETYPE";
const CIPHER_AES_256_GCM = 1;
const KEY_VERSION_V1 = 1;
const LATEST_KEY_VERSION = KEY_VERSION_V1;
const IV_BYTES = 12;
const HEADER_BYTES = 24;
const GCM_TAG_BYTES = 16;
const MAX_FILE_BYTES = 16 * 1024 * 1024;
const MAX_PLAINTEXT_BYTES = 12 * 1024 * 1024;
const MAX_RANKING_ENTRIES = 100;

const CORRUPT_OR_WRONG_FILE_MESSAGE =
  "セーブデータが破損しているか、正しいMameTypeのセーブデータではありません。";
const UNSUPPORTED_MESSAGE =
  "このセーブデータは、現在のMameTypeが対応していない形式です。対応するバージョンのMameTypeで読み込んでください。";
const APPLY_FAILED_MESSAGE =
  "セーブデータを書き込めませんでした。現在のデータは変更前の状態に戻しました。";

/**
 * クライアント内固定AES-256鍵。
 *
 * 分割しても機密性にはならず、解析者には最終的に再構成できます。旧versionの
 * ファイル互通のために、鍵を更新しても keyVersion 1 のmapエントリを削除しないこと。
 */
const SAVE_KEYS = Object.freeze({
  1: (() => {
    const keyHex = [
      "8f2c6a14",
      "d93b7e05",
      "c4a1f826",
      "db39e770",
      "15bd84f2",
      "a6c9017e",
      "35d8b04f",
      "a72c6193",
    ].join("");
    const bytes = new Uint8Array(32);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Number.parseInt(keyHex.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  })(),
});

const TARGET_KEYS = Object.freeze([
  "typing_game_records",
  "typing_game_ranking",
  "difficulty_daily",
  "typing_player_stats",
  "questProgress",
  "questPlayerStats",
  "questStars",
  "quest_slots",
  "quest_auto_save",
  "QuestStages_Cache_v3",
  "difficulty_quest",
  "typing_game_settings",
  "typing_game_quality",
  "keybinds",
  "final_n_mode",
  "free_mode_config_v1",
  "difficulty_free",
  "difficulty_free_enemy",
]);

const JSON_VALUE_KEYS = new Set([
  "typing_game_records",
  "typing_game_ranking",
  "typing_player_stats",
  "questProgress",
  "questPlayerStats",
  "questStars",
  "quest_slots",
  "quest_auto_save",
  "QuestStages_Cache_v3",
  "typing_game_settings",
  "keybinds",
  "free_mode_config_v1",
]);

const STRING_VALUE_KEYS = new Set([
  "difficulty_daily",
  "difficulty_quest",
  "final_n_mode",
  "difficulty_free",
  "difficulty_free_enemy",
  "typing_game_quality",
]);

const VALID_DIFFICULTIES = new Set(["easy", "normal", "hard", "master"]);
const VALID_QUALITIES = new Set(["auto", "high", "medium", "low"]);
const VALID_FINAL_N_MODES = new Set(["nn", "n"]);
const VALID_KEYBIND_NAMES = new Set(["unlock", "autoLock", "pause", "activeSkill"]);
const VALID_KEY_CODES = new Set([
  "Tab",
  "Enter",
  "Backspace",
  "Delete",
  "Control",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

class SaveFileError extends Error {
  constructor(message, code = "SAVE_FILE_ERROR") {
    super(message);
    this.name = "SaveFileError";
    this.code = code;
  }
}

function getWebCrypto(cryptoImpl = globalThis.crypto) {
  if (!cryptoImpl?.subtle || typeof cryptoImpl.getRandomValues !== "function") {
    throw new SaveFileError(
      "この環境では暗号化セーブを利用できません。HTTPSまたはlocalhostでMameTypeを開いてください。",
      "WEB_CRYPTO_UNAVAILABLE",
    );
  }
  return cryptoImpl;
}

function getStorage(storageImpl) {
  let resolved;
  try {
    resolved = storageImpl ?? globalThis.localStorage;
  } catch {
    resolved = null;
  }
  if (!resolved) {
    throw new SaveFileError("ブラウザの保存領域を利用できません。", "STORAGE_UNAVAILABLE");
  }
  return resolved;
}

function parseStoredJson(raw, key) {
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    throw new SaveFileError(
      `現在の保存データ「${key}」が壊れているため、Exportを中止しました。`,
      "LOCAL_DATA_CORRUPT",
    );
  }
}

function readStoredValue(storage, key) {
  const raw = storage.getItem(key);
  if (raw === null) return null;
  if (JSON_VALUE_KEYS.has(key)) return parseStoredJson(raw, key);
  if (STRING_VALUE_KEYS.has(key)) return raw;
  return raw;
}

function buildPayload(storageImpl) {
  const storage = getStorage(storageImpl);

  // localStorageの値が一意に決まるよう、同じsnapshotの途中で全allowlistを読む。
  // readStoredValueでkeyを一度ずつ取得し、その結果をpayloadへまとめる。
  const snapshot = new Map();
  for (const key of TARGET_KEYS) {
    snapshot.set(key, readStoredValue(storage, key));
  }
  const value = (key) => snapshot.get(key);
  const payload = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      daily: {
        records: value("typing_game_records") ?? [],
        ranking: value("typing_game_ranking") ?? {},
        difficulty: value("difficulty_daily"),
      },
      global: {
        playerStats: value("typing_player_stats"),
      },
      quest: {
        progress: value("questProgress"),
        playerStats: value("questPlayerStats"),
        stars: value("questStars") ?? {},
        slots: value("quest_slots") ?? [],
        autoSave: value("quest_auto_save"),
        stageCache: value("QuestStages_Cache_v3"),
        difficulty: value("difficulty_quest"),
      },
      settings: {
        game: value("typing_game_settings"),
        renderQuality: value("typing_game_quality"),
        keybinds: value("keybinds"),
        finalNMode: value("final_n_mode"),
        freeMode: value("free_mode_config_v1"),
        freeDifficulty: value("difficulty_free"),
        freeEnemyDifficulty: value("difficulty_free_enemy"),
      },
    },
  };
  return validateSavePayload(payload);
}

function bytesEqual(actual, expected) {
  if (actual.length !== expected.length) return false;
  for (let i = 0; i < actual.length; i++) {
    if (actual[i] !== expected[i]) return false;
  }
  return true;
}

function encodeHeader(iv, keyVersion = LATEST_KEY_VERSION) {
  const header = new Uint8Array(HEADER_BYTES);
  const view = new DataView(header.buffer);
  header.set(new TextEncoder().encode(MAGIC), 0);
  view.setUint16(8, SAVE_CONTAINER_VERSION, true);
  view.setUint8(10, CIPHER_AES_256_GCM);
  view.setUint8(11, keyVersion);
  header.set(iv, 12);
  return header;
}

function parseHeader(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < HEADER_BYTES + GCM_TAG_BYTES) {
    throw new SaveFileError(CORRUPT_OR_WRONG_FILE_MESSAGE, "INVALID_FILE");
  }

  const magic = bytes.slice(0, 8);
  if (!bytesEqual(magic, new TextEncoder().encode(MAGIC))) {
    throw new SaveFileError(CORRUPT_OR_WRONG_FILE_MESSAGE, "INVALID_MAGIC");
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const containerVersion = view.getUint16(8, true);
  if (containerVersion !== SAVE_CONTAINER_VERSION) {
    throw new SaveFileError(UNSUPPORTED_MESSAGE, "UNSUPPORTED_CONTAINER");
  }

  const cipherSuite = view.getUint8(10);
  if (cipherSuite !== CIPHER_AES_256_GCM) {
    throw new SaveFileError(UNSUPPORTED_MESSAGE, "UNSUPPORTED_CIPHER");
  }

  const keyVersion = view.getUint8(11);
  if (!SAVE_KEYS[keyVersion]) {
    throw new SaveFileError(UNSUPPORTED_MESSAGE, "UNSUPPORTED_KEY");
  }

  return {
    containerVersion,
    cipherSuite,
    keyVersion,
    iv: bytes.slice(12, HEADER_BYTES),
    header: bytes.slice(0, HEADER_BYTES),
  };
}

async function importSaveKey(keyVersion, cryptoImpl) {
  const rawKey = SAVE_KEYS[keyVersion];
  if (!rawKey) throw new SaveFileError(UNSUPPORTED_MESSAGE, "UNSUPPORTED_KEY");
  const cryptoApi = getWebCrypto(cryptoImpl);
  try {
    return await cryptoApi.subtle.importKey(
      "raw",
      rawKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
  } catch {
    throw new SaveFileError(CORRUPT_OR_WRONG_FILE_MESSAGE, "KEY_IMPORT_FAILED");
  }
}

async function encryptBytes(plaintext, cryptoImpl) {
  const cryptoApi = getWebCrypto(cryptoImpl);
  const iv = cryptoApi.getRandomValues(new Uint8Array(IV_BYTES));
  const header = encodeHeader(iv, LATEST_KEY_VERSION);
  const key = await importSaveKey(LATEST_KEY_VERSION, cryptoApi);

  try {
    const encrypted = await cryptoApi.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: header, tagLength: 128 },
      key,
      plaintext,
    );
    const ciphertext = new Uint8Array(encrypted);
    const output = new Uint8Array(header.length + ciphertext.length);
    output.set(header, 0);
    output.set(ciphertext, header.length);
    return output;
  } catch {
    throw new SaveFileError("セーブデータの暗号化に失敗しました。", "ENCRYPT_FAILED");
  }
}

async function decryptBytes(bytes, cryptoImpl) {
  const headerInfo = parseHeader(bytes);
  const ciphertext = bytes.slice(HEADER_BYTES);
  const key = await importSaveKey(headerInfo.keyVersion, cryptoImpl);

  let decrypted;
  try {
    decrypted = await getWebCrypto(cryptoImpl).subtle.decrypt(
      {
        name: "AES-GCM",
        iv: headerInfo.iv,
        additionalData: headerInfo.header,
        tagLength: 128,
      },
      key,
      ciphertext,
    );
  } catch {
    // Web Cryptoは改ざん・誤key・truncateをOperationError等にする。
    // 「改ざん」と断定せず、破損/別formatと同じ一般メッセージへ統一する。
    throw new SaveFileError(CORRUPT_OR_WRONG_FILE_MESSAGE, "AUTH_FAILED");
  }
  if (decrypted.byteLength > MAX_PLAINTEXT_BYTES) {
    throw new SaveFileError("セーブデータのサイズが大きすぎます。", "PLAINTEXT_TOO_LARGE");
  }
  return new Uint8Array(decrypted);
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertPlainObject(value, path) {
  if (!isPlainObject(value)) {
    throw new SaveFileError(`セーブデータの構造が正しくありません（${path}）。`, "INVALID_STRUCTURE");
  }
}

function assertOptionalPlainObject(value, path) {
  if (value !== undefined && value !== null) assertPlainObject(value, path);
}

function assertStringArray(value, path) {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new SaveFileError(`セーブデータの構造が正しくありません（${path}）。`, "INVALID_STRUCTURE");
  }
}

function assertFiniteNumber(value, path, { min = -Infinity, max = Infinity } = {}) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new SaveFileError(`セーブデータの値が正しくありません（${path}）。`, "INVALID_VALUE");
  }
}

function assertInteger(value, path, { min = -Infinity, max = Infinity } = {}) {
  assertFiniteNumber(value, path, { min, max });
  if (!Number.isInteger(value)) {
    throw new SaveFileError(`セーブデータの値が正しくありません（${path}）。`, "INVALID_VALUE");
  }
}

function assertBooleanMap(value, path) {
  assertPlainObject(value, path);
  for (const [key, flag] of Object.entries(value)) {
    if (typeof key !== "string" || typeof flag !== "boolean") {
      throw new SaveFileError(`セーブデータの構造が正しくありません（${path}）。`, "INVALID_STRUCTURE");
    }
  }
}

function assertJsonValue(value, path, depth = 0) {
  if (depth > 128) {
    throw new SaveFileError("セーブデータの構造が深すぎます。", "STRUCTURE_TOO_DEEP");
  }
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    assertFiniteNumber(value, path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertJsonValue(item, `${path}[${index}]`, depth + 1));
    return;
  }
  if (isPlainObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      if (key === "__proto__" || key === "prototype" || key === "constructor") {
        throw new SaveFileError(`セーブデータに許可されない項目があります（${path}）。`, "UNSAFE_KEY");
      }
      assertJsonValue(child, `${path}.${key}`, depth + 1);
    }
    return;
  }
  throw new SaveFileError(`セーブデータに未対応の値があります（${path}）。`, "INVALID_VALUE");
}

function validateDifficulty(value, path) {
  if (value !== undefined && value !== null && (typeof value !== "string" || !VALID_DIFFICULTIES.has(value))) {
    throw new SaveFileError(`セーブデータの値が正しくありません（${path}）。`, "INVALID_VALUE");
  }
}

function validateRecords(records) {
  if (!Array.isArray(records)) {
    throw new SaveFileError("セーブデータの構造が正しくありません（daily.records）。", "INVALID_STRUCTURE");
  }
  const recordsById = new Map();
  records.forEach((record, index) => {
    const path = `daily.records[${index}]`;
    assertPlainObject(record, path);
    if (typeof record.id !== "string" || record.id.length === 0 || recordsById.has(record.id)) {
      throw new SaveFileError(`セーブデータの構造が正しくありません（${path}.id）。`, "INVALID_STRUCTURE");
    }
    if (record.userProtected !== undefined && typeof record.userProtected !== "boolean") {
      throw new SaveFileError(`セーブデータの構造が正しくありません（${path}.userProtected）。`, "INVALID_STRUCTURE");
    }
    if (record.rankingProtected !== undefined && typeof record.rankingProtected !== "boolean") {
      throw new SaveFileError(`セーブデータの構造が正しくありません（${path}.rankingProtected）。`, "INVALID_STRUCTURE");
    }
    recordsById.set(record.id, record);
    if (
      typeof record.mode !== "string" ||
      record.mode.length === 0 ||
      record.mode.length > 64 ||
      record.mode === "__proto__" ||
      record.mode === "prototype" ||
      record.mode === "constructor"
    ) {
      throw new SaveFileError(`セーブデータの構造が正しくありません（${path}.mode）。`, "INVALID_STRUCTURE");
    }
    if (record.date !== undefined) {
      if (typeof record.date !== "string" || Number.isNaN(Date.parse(record.date))) {
        throw new SaveFileError(`セーブデータの構造が正しくありません（${path}.date）。`, "INVALID_STRUCTURE");
      }
    }
    for (const [key, value] of Object.entries(record)) {
      if (typeof value === "number") {
        assertFiniteNumber(value, `${path}.${key}`);
      }
    }
    if (record.userProtectedModes !== undefined && record.userProtectedModes !== null) {
      assertBooleanMap(record.userProtectedModes, `${path}.userProtectedModes`);
    }
    if (record.rankingProtectedModes !== undefined && record.rankingProtectedModes !== null) {
      assertBooleanMap(record.rankingProtectedModes, `${path}.rankingProtectedModes`);
    }
  });
  return recordsById;
}

function validateRanking(ranking, recordsById) {
  assertPlainObject(ranking, "daily.ranking");
  for (const [mode, ids] of Object.entries(ranking)) {
    const path = `daily.ranking.${mode}`;
    if (
      typeof mode !== "string" ||
      mode.length === 0 ||
      mode.length > 64 ||
      mode === "__proto__" ||
      mode === "prototype" ||
      mode === "constructor" ||
      !Array.isArray(ids)
    ) {
      throw new SaveFileError(`セーブデータの構造が正しくありません（${path}）。`, "INVALID_STRUCTURE");
    }
    const seen = new Set();
    for (const id of ids) {
      const record = recordsById.get(id);
      if (typeof id !== "string" || !record || record.mode !== mode || seen.has(id)) {
        throw new SaveFileError(`セーブデータの構造が正しくありません（${path}）。`, "INVALID_STRUCTURE");
      }
      seen.add(id);
    }
    if (ids.length > MAX_RANKING_ENTRIES) {
      throw new SaveFileError(`セーブデータの値が正しくありません（${path}）。`, "INVALID_VALUE");
    }
  }
}

function validatePlayerStats(playerStats) {
  assertOptionalPlainObject(playerStats, "global.playerStats");
  if (playerStats == null) return;
  if (playerStats.achievements !== undefined) {
    assertStringArray(playerStats.achievements, "global.playerStats.achievements");
  }
  if (playerStats.seenAchievements !== undefined) {
    assertStringArray(playerStats.seenAchievements, "global.playerStats.seenAchievements");
  }
  if (playerStats.hasSeenTrueEnding !== undefined && typeof playerStats.hasSeenTrueEnding !== "boolean") {
    throw new SaveFileError(
      "セーブデータの値が正しくありません（global.playerStats.hasSeenTrueEnding）。",
      "INVALID_VALUE",
    );
  }
  assertJsonValue(playerStats, "global.playerStats");
}

function validateQuestProgress(progress) {
  assertOptionalPlainObject(progress, "quest.progress");
  if (progress == null) return;
  for (const key of ["unlocked", "cleared", "unlockedWorlds"]) {
    if (progress[key] !== undefined) assertStringArray(progress[key], `quest.progress.${key}`);
  }
  if (progress.selectedWorldId !== undefined && typeof progress.selectedWorldId !== "string") {
    throw new SaveFileError("セーブデータの構造が正しくありません（quest.progress.selectedWorldId）。", "INVALID_STRUCTURE");
  }
  for (const key of [
    "hasSeenTrueEnding",
    "hasExtraCleared",
    "hasShownExtraEnding",
    "hasShownExtraClearReward",
    "hasShownFirstFullClearReward",
    "hasBossChallengeUnlocked",
    "hasFreeActiveSkillUnlocked",
  ]) {
    if (progress[key] !== undefined && typeof progress[key] !== "boolean") {
      throw new SaveFileError(`セーブデータの構造が正しくありません（quest.progress.${key}）。`, "INVALID_STRUCTURE");
    }
  }
  if (progress.playedDialogues !== undefined && progress.playedDialogues !== null) {
    assertBooleanMap(progress.playedDialogues, "quest.progress.playedDialogues");
  }
  if (progress.enteredStages !== undefined && progress.enteredStages !== null) {
    assertBooleanMap(progress.enteredStages, "quest.progress.enteredStages");
  }
  if (progress.playedChoices !== undefined && progress.playedChoices !== null) {
    assertPlainObject(progress.playedChoices, "quest.progress.playedChoices");
    for (const [choiceId, indexes] of Object.entries(progress.playedChoices)) {
      const path = `quest.progress.playedChoices.${choiceId}`;
      if (!Array.isArray(indexes)) {
        throw new SaveFileError(`セーブデータの構造が正しくありません（${path}）。`, "INVALID_STRUCTURE");
      }
      indexes.forEach((index, valueIndex) => {
        assertInteger(index, `${path}[${valueIndex}]`, { min: 0 });
      });
    }
  }
  assertJsonValue(progress, "quest.progress");
}

function validateQuestPlayerStats(playerStats) {
  assertOptionalPlainObject(playerStats, "quest.playerStats");
  if (playerStats == null) return;
  if (playerStats.level !== undefined) {
    assertInteger(playerStats.level, "quest.playerStats.level", { min: 1, max: 99 });
  }
  for (const key of [
    "unlockedSkills",
    "equippedSkills",
    "equippedActiveSkills",
    "obtainedSlotStages",
  ]) {
    if (playerStats[key] !== undefined) assertStringArray(playerStats[key], `quest.playerStats.${key}`);
  }
  if (playerStats.skillTreeProgress !== undefined && playerStats.skillTreeProgress !== null) {
    assertPlainObject(playerStats.skillTreeProgress, "quest.playerStats.skillTreeProgress");
    if (playerStats.skillTreeProgress.unlockedNodes !== undefined && playerStats.skillTreeProgress.unlockedNodes !== null) {
      assertStringArray(
        playerStats.skillTreeProgress.unlockedNodes,
        "quest.playerStats.skillTreeProgress.unlockedNodes",
      );
    }
  }
  if (playerStats.starSkillUpgrades !== undefined && playerStats.starSkillUpgrades !== null) {
    assertPlainObject(playerStats.starSkillUpgrades, "quest.playerStats.starSkillUpgrades");
    for (const [skillId, upgrade] of Object.entries(playerStats.starSkillUpgrades)) {
      if (!skillId) throw new SaveFileError("セーブデータの構造が正しくありません（quest.playerStats.starSkillUpgrades）。", "INVALID_STRUCTURE");
      if (upgrade === null) continue;
      assertPlainObject(upgrade, `quest.playerStats.starSkillUpgrades.${skillId}`);
      if (upgrade.level !== undefined) assertInteger(upgrade.level, `quest.playerStats.starSkillUpgrades.${skillId}.level`, { min: 0, max: 10 });
    }
  }
  assertJsonValue(playerStats, "quest.playerStats");
}

function validateStars(stars) {
  assertPlainObject(stars, "quest.stars");
  for (const [nodeId, value] of Object.entries(stars)) {
    if (nodeId.length === 0) {
      throw new SaveFileError("セーブデータの構造が正しくありません（quest.stars）。", "INVALID_STRUCTURE");
    }
    assertInteger(value, `quest.stars.${nodeId}`, { min: 0, max: 5 });
  }
}

function validateQuestSnapshot(snapshot, path) {
  assertOptionalPlainObject(snapshot, path);
  if (snapshot == null) return;
  // 旧セーブには未導入フィールドが欠けることがあるため、既存Loaderのdefault補完に委ねる。
  if (snapshot.progress !== undefined) validateQuestProgress(snapshot.progress);
  if (snapshot.playerStats !== undefined) validateQuestPlayerStats(snapshot.playerStats);
  if (snapshot.stars !== undefined && snapshot.stars !== null) validateStars(snapshot.stars);
  assertJsonValue(snapshot, path);
}

function validateQuestSlots(slots) {
  if (!Array.isArray(slots) || slots.length > 3) {
    throw new SaveFileError("セーブデータの構造が正しくありません（quest.slots）。", "INVALID_STRUCTURE");
  }
  slots.forEach((slot, index) => {
    if (slot === null) return;
    const path = `quest.slots[${index}]`;
    assertPlainObject(slot, path);
    // 旧スロットの欠損フィールドは既存Loaderのdefault補完に委ねる。
    if (slot.progress !== undefined) validateQuestProgress(slot.progress);
    if (slot.playerStats !== undefined) validateQuestPlayerStats(slot.playerStats);
    if (slot.stars !== undefined && slot.stars !== null) validateStars(slot.stars);
    if (slot.savedAt !== undefined) {
      assertFiniteNumber(slot.savedAt, `${path}.savedAt`, { min: 0 });
    }
    assertJsonValue(slot, path);
  });
}

function validateSettings(settings) {
  assertPlainObject(settings, "settings");
  const requiredSettings = [
    "game",
    "renderQuality",
    "keybinds",
    "finalNMode",
    "freeMode",
    "freeDifficulty",
    "freeEnemyDifficulty",
  ];
  // requiredな設定項目は、値としてnull也行える（未設定を既存Loaderに委ねる）。
  for (const field of requiredSettings) {
    if (!(field in settings)) {
      throw new SaveFileError(`セーブデータの構造が正しくありません（settings.${field}）。`, "INVALID_STRUCTURE");
    }
  }
  if (settings.game !== undefined && settings.game !== null) {
    assertPlainObject(settings.game, "settings.game");
    if (settings.game.soundEnabled !== undefined && typeof settings.game.soundEnabled !== "boolean") {
      throw new SaveFileError("セーブデータの値が正しくありません（settings.game.soundEnabled）。", "INVALID_VALUE");
    }
    if (settings.game.soundSettings !== undefined) {
      assertPlainObject(settings.game.soundSettings, "settings.game.soundSettings");
      for (const [name, enabled] of Object.entries(settings.game.soundSettings)) {
        if (typeof enabled !== "boolean") {
          throw new SaveFileError(`セーブデータの値が正しくありません（settings.game.soundSettings.${name}）。`, "INVALID_VALUE");
        }
      }
    }
    if (settings.game.soundVolumes !== undefined) {
      assertPlainObject(settings.game.soundVolumes, "settings.game.soundVolumes");
      for (const [name, volume] of Object.entries(settings.game.soundVolumes)) {
        assertFiniteNumber(volume, `settings.game.soundVolumes.${name}`, { min: 0, max: 1 });
      }
    }
    if (settings.game.dialogueSpeed !== undefined) {
      assertInteger(settings.game.dialogueSpeed, "settings.game.dialogueSpeed", { min: 0, max: 4 });
    }
    assertJsonValue(settings.game, "settings.game");
  }
  if (settings.renderQuality !== undefined && settings.renderQuality !== null && !VALID_QUALITIES.has(settings.renderQuality)) {
    throw new SaveFileError("セーブデータの値が正しくありません（settings.renderQuality）。", "INVALID_VALUE");
  }
  if (settings.keybinds !== undefined && settings.keybinds !== null) {
    assertPlainObject(settings.keybinds, "settings.keybinds");
    const usedCodes = new Set();
    for (const name of Object.keys(settings.keybinds)) {
      if (!VALID_KEYBIND_NAMES.has(name)) {
        throw new SaveFileError(`セーブデータの値が正しくありません（settings.keybinds.${name}）。`, "INVALID_VALUE");
      }
      const code = settings.keybinds[name];
      if (!VALID_KEY_CODES.has(code)) {
        throw new SaveFileError(`セーブデータの値が正しくありません（settings.keybinds.${name}）。`, "INVALID_VALUE");
      }
      if (usedCodes.has(code)) {
        throw new SaveFileError("キーバインドが重複しています。", "DUPLICATE_KEYBIND");
      }
      usedCodes.add(code);
    }
  }
  if (settings.finalNMode !== undefined && settings.finalNMode !== null && !VALID_FINAL_N_MODES.has(settings.finalNMode)) {
    throw new SaveFileError("セーブデータの値が正しくありません（settings.finalNMode）。", "INVALID_VALUE");
  }
  if (settings.freeMode !== undefined && settings.freeMode !== null) {
    assertPlainObject(settings.freeMode, "settings.freeMode");
    assertJsonValue(settings.freeMode, "settings.freeMode");
  }
  if (settings.freeDifficulty !== undefined) {
    validateDifficulty(settings.freeDifficulty, "settings.freeDifficulty");
  }
  if (settings.freeEnemyDifficulty !== undefined) {
    validateDifficulty(settings.freeEnemyDifficulty, "settings.freeEnemyDifficulty");
  }
}

function validatePayload(payload) {
  assertPlainObject(payload, "root");
  if (payload.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    throw new SaveFileError(UNSUPPORTED_MESSAGE, "UNSUPPORTED_SCHEMA");
  }
  const requiredKeys = ["schemaVersion", "appVersion", "exportedAt", "data"];
  for (const key of requiredKeys) {
    if (!(key in payload)) {
      throw new SaveFileError(`セーブデータの構造が正しくありません（${key}）。`, "INVALID_STRUCTURE");
    }
  }

  if (typeof payload.appVersion !== "string" || payload.appVersion.length === 0 || payload.appVersion.length > 64) {
    throw new SaveFileError("セーブデータの構造が正しくありません（appVersion）。", "INVALID_STRUCTURE");
  }
  if (typeof payload.exportedAt !== "string" || Number.isNaN(Date.parse(payload.exportedAt))) {
    throw new SaveFileError("セーブデータの構造が正しくありません（exportedAt）。", "INVALID_STRUCTURE");
  }

  const data = payload.data;
  assertPlainObject(data, "data");
  for (const section of ["daily", "global", "quest", "settings"]) {
    if (!(section in data)) {
      throw new SaveFileError(`セーブデータの構造が正しくありません（data.${section}）。`, "INVALID_STRUCTURE");
    }
  }
  const daily = data.daily;
  assertPlainObject(daily, "data.daily");
  for (const field of ["records", "ranking", "difficulty"]) {
    if (!(field in daily)) {
      throw new SaveFileError(`セーブデータの構造が正しくありません（data.daily.${field}）。`, "INVALID_STRUCTURE");
    }
  }
  for (const field of ["records", "ranking"]) {
    if (daily[field] === undefined || daily[field] === null) {
      throw new SaveFileError(`セーブデータの構造が正しくありません（data.daily.${field}）。`, "INVALID_STRUCTURE");
    }
  }
  const recordsById = validateRecords(daily.records);
  validateRanking(daily.ranking, recordsById);
  validateDifficulty(daily.difficulty, "data.daily.difficulty");

  assertPlainObject(data.global, "data.global");
  if (!("playerStats" in data.global)) {
    throw new SaveFileError("セーブデータの構造が正しくありません（data.global.playerStats）。", "INVALID_STRUCTURE");
  }
  validatePlayerStats(data.global.playerStats);

  const quest = data.quest;
  assertPlainObject(quest, "data.quest");
  for (const field of [
    "progress",
    "playerStats",
    "stars",
    "slots",
    "autoSave",
    "stageCache",
    "difficulty",
  ]) {
    if (!(field in quest)) {
      throw new SaveFileError(`セーブデータの構造が正しくありません（data.quest.${field}）。`, "INVALID_STRUCTURE");
    }
  }
  for (const field of ["stars", "slots"]) {
    if (quest[field] === undefined || quest[field] === null) {
      throw new SaveFileError(`セーブデータの構造が正しくありません（data.quest.${field}）。`, "INVALID_STRUCTURE");
    }
  }
  validateQuestProgress(quest.progress);
  validateQuestPlayerStats(quest.playerStats);
  validateStars(quest.stars);
  validateQuestSlots(quest.slots);
  validateQuestSnapshot(quest.autoSave, "data.quest.autoSave");
  assertOptionalPlainObject(quest.stageCache, "data.quest.stageCache");
  if (quest.stageCache !== undefined && quest.stageCache !== null) {
    assertJsonValue(quest.stageCache, "data.quest.stageCache");
  }
  validateDifficulty(quest.difficulty, "data.quest.difficulty");

  assertJsonValue(data, "data");
  validateSettings(data.settings);
  assertJsonValue(payload, "root");
  return payload;
}

function migratePayload(payload) {
  assertPlainObject(payload, "root");
  if (
    !Number.isInteger(payload.schemaVersion) ||
    payload.schemaVersion < 1 ||
    payload.schemaVersion > CURRENT_SCHEMA_VERSION
  ) {
    throw new SaveFileError(UNSUPPORTED_MESSAGE, "UNSUPPORTED_SCHEMA");
  }

  let current = payload;
  for (let version = current.schemaVersion; version < CURRENT_SCHEMA_VERSION; version++) {
    const migrate = SCHEMA_MIGRATIONS[version];
    if (typeof migrate !== "function") {
      throw new SaveFileError(UNSUPPORTED_MESSAGE, "MISSING_MIGRATION");
    }
    const next = migrate(current);
    if (!isPlainObject(next) || next.schemaVersion !== version + 1) {
      throw new SaveFileError("セーブデータのmigration結果が不正です。", "INVALID_MIGRATION");
    }
    current = next;
  }
  return current;
}

function normalizeRecordsForImport(records, ranking) {
  const safeRanking = ranking ?? {};
  return records.map((record) => {
    const next = { ...record };
    const userProtectedModes = { ...(record.userProtectedModes || {}) };
    const rankingProtectedModes = { ...(record.rankingProtectedModes || {}) };
    // storage.jsの旧形式移行と同じ処理。新形式Importでも保護状態を落とさない。
    if (record.userProtected === true) userProtectedModes[record.mode] = true;
    if (record.rankingProtected === true) rankingProtectedModes[record.mode] = true;
    next.userProtectedModes = userProtectedModes;
    next.rankingProtectedModes = rankingProtectedModes;
    delete next.userProtected;
    delete next.rankingProtected;
    const ids = Object.prototype.hasOwnProperty.call(safeRanking, record.mode)
      ? safeRanking[record.mode]
      : [];
    next.rankingProtectedModes[record.mode] = Array.isArray(ids) && ids.includes(record.id);
    return next;
  });
}

function serializeStoredJson(value) {
  return value === null || value === undefined ? null : JSON.stringify(value);
}

function buildStorageWrites(payload) {
  const data = payload.data;
  const records = normalizeRecordsForImport(data.daily.records, data.daily.ranking);
  return [
    ["typing_game_records", JSON.stringify(records)],
    ["typing_game_ranking", JSON.stringify(data.daily.ranking)],
    ["difficulty_daily", data.daily.difficulty ?? null],
    ["typing_player_stats", serializeStoredJson(data.global.playerStats)],
    ["questProgress", serializeStoredJson(data.quest.progress)],
    ["questPlayerStats", serializeStoredJson(data.quest.playerStats)],
    ["questStars", JSON.stringify(data.quest.stars)],
    ["quest_slots", JSON.stringify(data.quest.slots)],
    ["quest_auto_save", serializeStoredJson(data.quest.autoSave)],
    ["QuestStages_Cache_v3", serializeStoredJson(data.quest.stageCache)],
    ["difficulty_quest", data.quest.difficulty ?? null],
    ["typing_game_settings", serializeStoredJson(data.settings.game)],
    ["typing_game_quality", data.settings.renderQuality ?? null],
    ["keybinds", serializeStoredJson(data.settings.keybinds)],
    ["final_n_mode", data.settings.finalNMode ?? null],
    ["free_mode_config_v1", serializeStoredJson(data.settings.freeMode)],
    ["difficulty_free", data.settings.freeDifficulty ?? null],
    ["difficulty_free_enemy", data.settings.freeEnemyDifficulty ?? null],
  ];
}

function restoreStorageSnapshot(storage, snapshot) {
  const failures = [];
  for (const [key, value] of snapshot) {
    try {
      if (value === null) storage.removeItem(key);
      else storage.setItem(key, value);
    } catch {
      failures.push(key);
    }
  }
  return failures;
}

function applyPayload(payload, storageImpl) {
  const storage = getStorage(storageImpl);
  const writes = buildStorageWrites(payload);
  if (writes.some(([, value]) => value === undefined)) {
    throw new SaveFileError("セーブデータの構造が正しくありません。", "INVALID_STRUCTURE");
  }
  const normalizedWrites = writes.map(([key, value]) => [
    key,
    value === null || value === undefined ? null : String(value),
  ]);
  const snapshot = TARGET_KEYS.map((key) => [key, storage.getItem(key)]);

  try {
    for (const [key, value] of normalizedWrites) {
      if (value === null || value === undefined) storage.removeItem(key);
      else storage.setItem(key, value);
    }
  } catch {
    const rollbackFailures = restoreStorageSnapshot(storage, snapshot);
    if (rollbackFailures.length > 0) {
      throw new SaveFileError(
        "保存領域の異常により、データ更新とrollbackの両方に失敗しました。ブラウザを閉じて再起動してください。",
        "ROLLBACK_FAILED",
      );
    }
    throw new SaveFileError(APPLY_FAILED_MESSAGE, "APPLY_FAILED");
  }
}

/**
 * BACKUP DATAのReset実装。
 *
 * Importと同じ TARGET_KEYS だけを削除するため、Player ID / recovery_code /
 * typing_player_profile / Cache Storage / 通知UI状態は変更しない。
 * localStorage.clear()は使用せず、途中で失敗した場合は削除前の値へrollbackする。
 */
export function resetSaveData(storageImpl) {
  const storage = getStorage(storageImpl);
  const snapshot = TARGET_KEYS.map((key) => [key, storage.getItem(key)]);

  try {
    for (const key of TARGET_KEYS) {
      storage.removeItem(key);
    }
  } catch {
    const rollbackFailures = restoreStorageSnapshot(storage, snapshot);
    if (rollbackFailures.length > 0) {
      throw new SaveFileError(
        "保存領域の異常により、データ削除とrollbackの両方に失敗しました。ブラウザを閉じて再起動してください。",
        "ROLLBACK_FAILED",
      );
    }
    throw new SaveFileError(
      "セーブデータをリセットできませんでした。現在のデータは変更前の状態に戻しました。",
      "RESET_FAILED",
    );
  }

  return [...TARGET_KEYS];
}

function makeFileName(now = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  const stamp = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    "-",
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("");
  return `mametype-save-${stamp}${SAVE_FILE_EXTENSION}`;
}

function downloadBytes(bytes, fileName) {
  const blob = new Blob([bytes], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function createSavePayload(storageImpl) {
  return buildPayload(storageImpl);
}

export function validateSavePayload(payload) {
  return validatePayload(migratePayload(structuredClone(payload)));
}

export async function encryptSavePayload(payload, cryptoImpl) {
  const validated = validateSavePayload(payload);
  const plaintext = new TextEncoder().encode(JSON.stringify(validated));
  if (plaintext.byteLength > MAX_PLAINTEXT_BYTES) {
    throw new SaveFileError("セーブデータのサイズが大きすぎます。", "PLAINTEXT_TOO_LARGE");
  }
  return encryptBytes(plaintext, cryptoImpl);
}

export async function decryptSavePayload(bytes, cryptoImpl) {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (input.byteLength <= 0 || input.byteLength > MAX_FILE_BYTES) {
    throw new SaveFileError("セーブファイルのサイズが正しくありません。", "INVALID_FILE_SIZE");
  }
  const plaintext = await decryptBytes(input, cryptoImpl);
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(plaintext);
  } catch {
    throw new SaveFileError(CORRUPT_OR_WRONG_FILE_MESSAGE, "INVALID_UTF8");
  }
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new SaveFileError(CORRUPT_OR_WRONG_FILE_MESSAGE, "INVALID_JSON");
  }
  return validateSavePayload(payload);
}

export function applySavePayload(payload, storageImpl) {
  const validated = validateSavePayload(payload);
  applyPayload(validated, storageImpl);
  return validated;
}

export async function exportSaveFile({
  storage,
  cryptoImpl = globalThis.crypto,
  fileName = makeFileName(),
} = {}) {
  const payload = buildPayload(storage);
  const encrypted = await encryptSavePayload(payload, cryptoImpl);
  downloadBytes(encrypted, fileName);
  return payload;
}

export async function importSaveFile(file, {
  storage,
  cryptoImpl = globalThis.crypto,
} = {}) {
  const isBlob = typeof Blob !== "undefined" && file instanceof Blob;
  if (!isBlob && typeof file?.arrayBuffer !== "function") {
    throw new SaveFileError(CORRUPT_OR_WRONG_FILE_MESSAGE, "INVALID_FILE");
  }
  if (typeof file.size === "number" && (file.size <= 0 || file.size > MAX_FILE_BYTES)) {
    throw new SaveFileError("セーブファイルのサイズが正しくありません。", "INVALID_FILE_SIZE");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength <= 0 || bytes.byteLength > MAX_FILE_BYTES) {
    throw new SaveFileError("セーブファイルのサイズが正しくありません。", "INVALID_FILE_SIZE");
  }

  const payload = await decryptSavePayload(bytes, cryptoImpl);
  applyPayload(payload, storage);
  return payload;
}
