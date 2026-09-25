import {
  createSavePayload,
  encryptSavePayload,
  decryptSavePayload,
  applySavePayload,
  importSaveFile,
  resetSaveData,
} from "../js/saveFile.js";

const results = document.querySelector("#results");
const summary = document.querySelector("#summary");
let passed = 0;
let failed = 0;

function report(name, ok, detail = "") {
  const line = document.createElement("div");
  line.className = ok ? "pass" : "fail";
  line.textContent = `${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`;
  results.appendChild(line);
  if (ok) passed++;
  else failed++;
}

function assert(condition, name, detail = "") {
  report(name, Boolean(condition), detail);
}

function expectReject(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => report(name, false, " rejection was expected"))
    .catch((error) => report(name, true, error.code || error.message));
}

class MemoryStorage {
  constructor(entries = {}) {
    this.map = new Map(Object.entries(entries));
    this.failAt = null;
    this.writeCount = 0;
  }
  get length() { return this.map.size; }
  key(index) { return [...this.map.keys()][index] ?? null; }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) {
    this.writeCount++;
    if (this.failAt !== null && this.writeCount === this.failAt) {
      throw new DOMException("simulated write failure", "QuotaExceededError");
    }
    this.map.set(key, String(value));
  }
  removeItem(key) {
    this.writeCount++;
    if (this.failAt !== null && this.writeCount === this.failAt) {
      throw new DOMException("simulated write failure", "QuotaExceededError");
    }
    this.map.delete(key);
  }
}

function fixtureEntries() {
  return {
    typing_game_records: JSON.stringify([{
      id: "record-1",
      date: "2026-09-25T00:00:00.000Z",
      mode: "normal",
      accuracy: 99,
      eScore: 300,
      userProtectedModes: { normal: true },
      rankingProtectedModes: { normal: true },
    }]),
    typing_game_ranking: JSON.stringify({ normal: ["record-1"] }),
    difficulty_daily: "normal",
    typing_player_stats: JSON.stringify({
      totalPlays: 1,
      achievements: ["first_play"],
      seenAchievements: ["first_play"],
      hasSeenTrueEnding: false,
    }),
    questProgress: JSON.stringify({
      unlocked: ["W1_Q1"],
      cleared: ["W1_Q1"],
      unlockedWorlds: ["WORLD1"],
      selectedWorldId: "WORLD1",
      playedDialogues: { intro: true },
      playedChoices: {},
      enteredStages: { W1_Q1: true },
    }),
    questPlayerStats: JSON.stringify({
      level: 2,
      unlockedSkills: ["skill-1"],
      equippedSkills: [],
    }),
    questStars: JSON.stringify({ W1_Q1: 3 }),
    quest_slots: JSON.stringify([]),
    quest_auto_save: JSON.stringify({
      progress: { unlocked: ["W1_Q1"], cleared: ["W1_Q1"] },
      playerStats: { level: 2 },
      stars: { W1_Q1: 3 },
    }),
    QuestStages_Cache_v3: JSON.stringify({ STAGE1: { missionName: "test" } }),
    difficulty_quest: "hard",
    typing_game_settings: JSON.stringify({ soundEnabled: true, dialogueSpeed: 3 }),
    typing_game_quality: "high",
    keybinds: JSON.stringify({
      unlock: "Delete",
      autoLock: "Tab",
      pause: "Enter",
      activeSkill: "Backspace",
    }),
    final_n_mode: "n",
    free_mode_config_v1: JSON.stringify({ lastModeId: "Standard" }),
    difficulty_free: "normal",
    difficulty_free_enemy: "normal",
    player_id: "must-not-export",
    recovery_code: "must-not-export",
  };
}

async function run() {
  results.textContent = "";
  passed = 0;
  failed = 0;
  const source = new MemoryStorage(fixtureEntries());
  const payload = createSavePayload(source);

  assert(payload.data.daily.records.length === 1, "payload: daily records");
  assert(payload.data.quest.progress.cleared[0] === "W1_Q1", "payload: quest progress");
  assert(payload.data.settings.renderQuality === "high", "payload: settings");
  assert(
    !JSON.stringify(payload).includes("must-not-export"),
    "payload: online credentials are excluded",
  );

  const encrypted = await encryptSavePayload(payload, crypto);
  const encryptedAgain = await encryptSavePayload(payload, crypto);
  assert(
    !encrypted.slice(12, 24).every((value, index) => value === encryptedAgain[12 + index]),
    "crypto: each export uses a fresh IV",
  );
  assert(
    new TextDecoder().decode(encrypted).includes("questProgress") === false,
    "crypto: plaintext is hidden",
  );
  assert(encrypted[0] === 0x4d && encrypted[1] === 0x41, "crypto: MAMETYPE magic");

  const decrypted = await decryptSavePayload(encrypted, crypto);
  assert(decrypted.data.quest.stars.W1_Q1 === 3, "crypto: round trip");

  const destination = new MemoryStorage({
    keep: "untouched",
    player_id: "existing-player-id",
    recovery_code: "existing-recovery-code",
  });
  await importSaveFile(new Blob([encrypted]), {
    storage: destination,
    cryptoImpl: crypto,
  });
  assert(destination.getItem("questProgress").includes("W1_Q1"), "import: quest applied");
  assert(
    destination.getItem("typing_game_records").includes("record-1"),
    "import: daily applied",
  );
  assert(
    destination.getItem("typing_game_quality") === "high",
    "import: string setting applied",
  );
  assert(destination.getItem("keep") === "untouched", "import: unrelated keys untouched");
  assert(
    destination.getItem("player_id") === "existing-player-id" &&
      destination.getItem("recovery_code") === "existing-recovery-code",
    "import: online credentials remain untouched",
  );

  const malformedBytes = encrypted.slice(0, 24);
  await expectReject("format: header-only file rejected", () =>
    decryptSavePayload(malformedBytes, crypto));

  const wrongKeyVersion = encrypted.slice();
  wrongKeyVersion[11] = 9;
  await expectReject("format: unsupported key version rejected", () =>
    decryptSavePayload(wrongKeyVersion, crypto));

  const tampered = encrypted.slice();
  tampered[tampered.length - 1] ^= 1;
  const tamperTarget = new MemoryStorage({ safe: "before" });
  await expectReject("tamper: ciphertext rejected", () =>
    importSaveFile(new Blob([tampered]), {
      storage: tamperTarget,
      cryptoImpl: crypto,
    }));
  assert(tamperTarget.getItem("safe") === "before", "tamper: storage unchanged");
  assert(tamperTarget.writeCount === 0, "tamper: storage was not written");

  const wrongVersion = encrypted.slice();
  wrongVersion[8] = 2;
  await expectReject("version: unsupported container rejected", () =>
    decryptSavePayload(wrongVersion, crypto));

  const wrongMagic = encrypted.slice();
  wrongMagic[0] = 0;
  await expectReject("format: wrong magic rejected", () =>
    decryptSavePayload(wrongMagic, crypto));

  const wrongIv = encrypted.slice();
  wrongIv[12] ^= 1;
  await expectReject("format: modified IV rejected", () =>
    decryptSavePayload(wrongIv, crypto));

  const badPayload = structuredClone(payload);
  badPayload.data.quest.slots = [null, null, null, null];
  await expectReject("validation: too many quest slots rejected", () =>
    encryptSavePayload(badPayload, crypto));

  const badRanking = structuredClone(payload);
  badRanking.data.daily.ranking.normal.push("missing-record");
  await expectReject("validation: dangling ranking ID rejected", () =>
    encryptSavePayload(badRanking, crypto));

  const wrongRankingMode = structuredClone(payload);
  wrongRankingMode.data.daily.ranking = { time_attack: ["record-1"] };
  await expectReject("validation: ranking mode mismatch rejected", () =>
    encryptSavePayload(wrongRankingMode, crypto));

  const badRecordMode = structuredClone(payload);
  badRecordMode.data.daily.records[0].mode = "";
  await expectReject("validation: empty record mode rejected", () =>
    encryptSavePayload(badRecordMode, crypto));

  const badRankingMode = structuredClone(payload);
  badRankingMode.data.daily.ranking = { "": ["record-1"] };
  await expectReject("validation: empty ranking mode rejected", () =>
    encryptSavePayload(badRankingMode, crypto));

  const missingQuest = structuredClone(payload);
  delete missingQuest.data.quest.progress;
  await expectReject("validation: missing required quest progress rejected", () =>
    encryptSavePayload(missingQuest, crypto));

  const missingAutoSave = structuredClone(payload);
  delete missingAutoSave.data.quest.autoSave;
  await expectReject("validation: missing required auto-save rejected", () =>
    encryptSavePayload(missingAutoSave, crypto));

  const legacyProtected = structuredClone(payload);
  legacyProtected.data.daily.records[0].userProtected = true;
  legacyProtected.data.daily.records[0].rankingProtected = true;
  delete legacyProtected.data.daily.records[0].userProtectedModes;
  delete legacyProtected.data.daily.records[0].rankingProtectedModes;
  const legacyProtectedDestination = new MemoryStorage();
  await applySavePayload(legacyProtected, legacyProtectedDestination);
  const legacyRecord = JSON.parse(legacyProtectedDestination.getItem("typing_game_records"))[0];
  assert(
    legacyRecord.userProtectedModes.normal === true && legacyRecord.rankingProtectedModes.normal === true,
    "import: legacy protection flags migrated",
  );

  const legacySnapshot = structuredClone(payload);
  legacySnapshot.data.quest.autoSave = { stars: { W1_Q1: 3 } };
  legacySnapshot.data.quest.slots = [null, { progress: { cleared: [] }, stars: {} }, null];
  const legacyValidated = await encryptSavePayload(legacySnapshot, crypto);
  assert(legacyValidated.length > 24, "compatibility: legacy quest snapshot accepted");

  const unsupportedSchema = structuredClone(payload);
  unsupportedSchema.schemaVersion = 2;
  await expectReject("version: unsupported schema rejected", () =>
    encryptSavePayload(unsupportedSchema, crypto));

  const missingSettings = structuredClone(payload);
  delete missingSettings.data.settings.keybinds;
  await expectReject("validation: missing required settings rejected", () =>
    encryptSavePayload(missingSettings, crypto));

  const badKeybind = structuredClone(payload);
  badKeybind.data.settings.keybinds.unlock = "F12";
  await expectReject("validation: unsupported keybind rejected", () =>
    encryptSavePayload(badKeybind, crypto));

  const duplicateKeybind = structuredClone(payload);
  duplicateKeybind.data.settings.keybinds.autoLock = duplicateKeybind.data.settings.keybinds.unlock;
  await expectReject("validation: duplicate keybind rejected", () =>
    encryptSavePayload(duplicateKeybind, crypto));

  const badStarUpgrade = structuredClone(payload);
  badStarUpgrade.data.quest.playerStats.starSkillUpgrades = { "skill-1": { level: 11 } };
  await expectReject("validation: star upgrade range rejected", () =>
    encryptSavePayload(badStarUpgrade, crypto));

  const unsafe = structuredClone(payload);
  const unsafeObject = JSON.parse('{"__proto__":{"polluted":true}}');
  unsafe.data.settings.freeMode = unsafeObject;
  await expectReject("validation: prototype-pollution key rejected", () =>
    encryptSavePayload(unsafe, crypto));

  const nullPayload = structuredClone(payload);
  nullPayload.data.global.playerStats = null;
  nullPayload.data.quest.progress = null;
  nullPayload.data.quest.playerStats = null;
  nullPayload.data.quest.autoSave = null;
  nullPayload.data.quest.stageCache = null;
  nullPayload.data.settings.game = null;
  nullPayload.data.settings.keybinds = null;
  nullPayload.data.settings.freeMode = null;
  const nullDestination = new MemoryStorage({ ...fixtureEntries(), keep: "before" });
  await applySavePayload(nullPayload, nullDestination);
  assert(
    nullDestination.getItem("typing_player_stats") === null &&
      nullDestination.getItem("questProgress") === null &&
      nullDestination.getItem("questPlayerStats") === null &&
      nullDestination.getItem("quest_auto_save") === null &&
      nullDestination.getItem("QuestStages_Cache_v3") === null &&
      nullDestination.getItem("typing_game_settings") === null &&
      nullDestination.getItem("keybinds") === null &&
      nullDestination.getItem("free_mode_config_v1") === null,
    "apply: null means remove missing target keys",
  );
  assert(nullDestination.getItem("keep") === "before", "apply: unrelated key preserved");

  const invalidBeforeWrite = new MemoryStorage({ safe: "before" });
  const invalidPayload = structuredClone(payload);
  invalidPayload.data.quest.progress = "not-an-object";
  await expectReject("apply: invalid payload rejected", () =>
    applySavePayload(invalidPayload, invalidBeforeWrite));
  assert(
    invalidBeforeWrite.writeCount === 0 && invalidBeforeWrite.getItem("safe") === "before",
    "apply: validation failed before any storage write",
  );

  const rollbackStorage = new MemoryStorage({
    ...fixtureEntries(),
    keep: "before",
  });
  rollbackStorage.failAt = 5;
  const beforeRollback = new Map(rollbackStorage.map);
  await expectReject("apply: write failure rejected", () =>
    applySavePayload(payload, rollbackStorage));
  // failAtは「指定した1回目のwrite」のみ失敗し、rollback開始時には解除されている。
  const restored = [...beforeRollback].every(
    ([key, value]) => rollbackStorage.getItem(key) === value,
  );
  assert(restored, "apply: rollback restored every target key");

  const resetStorage = new MemoryStorage({
    ...fixtureEntries(),
    player_id: "keep-player-id",
    recovery_code: "keep-recovery-code",
    typing_player_profile: "keep-profile",
    mametype_applied_version: "1.0.51",
    saveDataNoticeDismissedVersion: "1.0.51",
    devPanelPos: "keep-dev-panel-position",
    unrelated: "keep-unrelated",
  });
  const resetKeys = resetSaveData(resetStorage);
  const backupTargetsRemoved = [
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
  ];
  const resetTargetSet = new Set(resetKeys);
  assert(
    backupTargetsRemoved.length === resetKeys.length &&
      backupTargetsRemoved.every((key) => resetTargetSet.has(key)) &&
      backupTargetsRemoved.every((key) => resetStorage.getItem(key) === null),
    "reset: every BACKUP DATA target removed",
  );
  assert(
    resetStorage.getItem("player_id") === "keep-player-id" &&
      resetStorage.getItem("recovery_code") === "keep-recovery-code" &&
      resetStorage.getItem("typing_player_profile") === "keep-profile" &&
      resetStorage.getItem("mametype_applied_version") === "1.0.51" &&
      resetStorage.getItem("saveDataNoticeDismissedVersion") === "1.0.51" &&
      resetStorage.getItem("devPanelPos") === "keep-dev-panel-position" &&
      resetStorage.getItem("unrelated") === "keep-unrelated",
    "reset: online identity and unrelated data preserved",
  );

  const resetRollbackStorage = new MemoryStorage({
    ...fixtureEntries(),
    player_id: "keep-player-id",
    recovery_code: "keep-recovery-code",
    unrelated: "keep-unrelated",
  });
  resetRollbackStorage.failAt = 5;
  const beforeResetRollback = new Map(resetRollbackStorage.map);
  await expectReject("reset: delete failure rejected", () =>
    resetSaveData(resetRollbackStorage));
  const resetRestored = [...beforeResetRollback].every(
    ([key, value]) => resetRollbackStorage.getItem(key) === value,
  );
  assert(resetRestored, "reset: rollback restored every target and unrelated key");

  summary.textContent = `${failed === 0 ? "ALL PASS" : "FAILED"} — ${passed} passed / ${failed} failed`;
  summary.style.color = failed === 0 ? "#3fb950" : "#f85149";
}

document.querySelector("#run").addEventListener("click", () => {
  run().catch((error) => {
    console.error(error);
    report("unexpected exception", false, error.stack || error.message);
    summary.textContent = `FAILED — ${passed} passed / ${failed} failed`;
    summary.style.color = "#f85149";
  });
});
