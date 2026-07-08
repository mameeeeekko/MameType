import { getPlayerStats, getSpeedRank, getAccuracyRank, formatPlayTime, ACHIEVEMENTS } from "./playerStats.js";
import { savePlayerStats } from "./storage.js";
import { getPlayerStatsForEnemy } from "./questPlayerStats.js";
import { getClearedStageCount, getTotalStars, getAvailableMaxStars, hasSeenTrueEnding } from "./questProgress.js";
import { PASSIVE_SKILLS, ACTIVE_SKILLS, getSkillById } from "./questSkills.js";
import { QUEST_MAP } from "./questMap.js";
import { SKILL_TREE } from "./skillTree.js";
import { openQuestMenuModal } from "./questMapUI.js";
import { handleGlobalSoundToggle } from "./main.js";
import { getSoundEnabled } from "./gameCore.js";
import { images } from "./assetsLoader.js";

function formatDateOnly(dateStr){
  if(!dateStr) return "";
  return dateStr.slice(0,10);
}

export function initAchievementsUI() {
  const btn = document.getElementById("hudAchievementsBtn");
  const modal = document.getElementById("achModal");
  const list = document.getElementById("achList");
  const close = document.getElementById("achClose");

  if (!btn || !modal || !list || !close) return;

  btn.onclick = () => {
    renderAchievements(list);
    modal.style.display = "flex";
  };

  close.onclick = () => {
    const fresh = getPlayerStats();
    markAchievementsSeen(fresh);   // ★既読化
    modal.style.display = "none";
  };

  modal.onclick = e => {
    if (e.target === modal) modal.style.display = "none";
  };
}

function renderAchievements(container) {
  const stats = getPlayerStats();

  const html = ACHIEVEMENTS.map(a => {
    const unlocked = Array.isArray(stats.achievements) && stats.achievements.includes(a.id);
    const isNew =
      unlocked &&
      Array.isArray(stats.seenAchievements) &&
      !stats.seenAchievements.includes(a.id);

    return `
      <div class="ach-item ${unlocked ? "unlocked" : ""}">
        ${isNew ? `<div class="ach-new">NEW</div>` : ""}
        <div>🏅</div>
        <div style="font-size:11px">${a.name}</div>
        <div class="ach-desc">${a.desc}</div>
      </div>
    `;
  }).join("");

  container.innerHTML = `
    <div class="daily-stats-section">
      勲章 ${(stats.achievements?.length || 0)}/${ACHIEVEMENTS.length}
    </div>
    <div class="ach-grid">${html}</div>
  `;
}

function markAchievementsSeen(s) {
  if (!s) return;

  // achievements を配列に正規化
  if (!Array.isArray(s.achievements)) {
    s.achievements = Object.values(s.achievements || {});
  }

  // seen を配列に正規化
  if (!Array.isArray(s.seenAchievements)) {
    s.seenAchievements = Object.values(s.seenAchievements || {});
  }

  let changed = false;

  for (const id of s.achievements) {
    if (!s.seenAchievements.includes(id)) {
      s.seenAchievements.push(id);
      changed = true;
    }
  }

  if (changed) {
    s.seenAchievements = Array.from(s.seenAchievements);
    savePlayerStats(s);
  }
}

// 変更後（引数追加）
export function updateHud(statsArg, options = {}) {
  const stats = statsArg || getPlayerStats();

  const isQuest = options.isQuestMode;
  const normalHud = document.getElementById("normalHud");
  const questHud  = document.getElementById("questHud");

  // ===== 表示切り替え =====
  if (isQuest) {
    if (normalHud) normalHud.style.display = "none";
    if (questHud)  questHud.style.display = "block";

    updateQuestHud();   // ← クエスト専用
  } else {
    if (normalHud) normalHud.style.display = "block";
    if (questHud)  questHud.style.display = "none";

    updateNormalHud(stats); // ← 通常
  }

  updateHudSoundBtn();
  setupStatsModal(options); // ← イベントは分離
}

function updateHudSoundBtn() {
  const hud = document.getElementById("playerHud");
  if (!hud) return;

  let soundCtrl = hud.querySelector(".hud-sound-ctrl");
  if (!soundCtrl) {
    soundCtrl = document.createElement("div");
    soundCtrl.className = "hud-row hud-sound-ctrl";
    soundCtrl.innerHTML = `
      <div class="sound-toggle-btn" style="cursor:pointer">
        <img src="" class="global-sound-toggle-img">
        <span class="global-sound-toggle-txt"></span>
      </div>
    `;
    soundCtrl.onclick = (e) => {
      e.stopPropagation();
      handleGlobalSoundToggle();
    };
    // ホバーエフェクト
    const btn = soundCtrl.querySelector(".sound-toggle-btn");
    if (btn) {
        btn.onmouseenter = () => {
            btn.style.transform = 'scale(1.1)';
            btn.style.transition = 'transform 0.2s ease';
        };
        btn.onmouseleave = () => btn.style.transform = 'scale(1.0)';
    }
    hud.appendChild(soundCtrl);
  }

  const enabled = getSoundEnabled();
  const img = soundCtrl.querySelector(".global-sound-toggle-img");
  const txt = soundCtrl.querySelector(".global-sound-toggle-txt");
  
  if (img) {
    img.src = enabled ? "./assets/pic/sound1.png" : "./assets/pic/soundmute.png";
    img.style.filter = "brightness(1.2)"; // アイコンの視認性向上
  }
  
  if (txt) txt.textContent = enabled ? "sound on" : "sound off";
}
function setupStatsModal(options = {}) {
  const modal = document.getElementById("playerStatsModal");
  const modalQuest = document.getElementById("questStatsModal");
  const btn = document.getElementById("hudDetailBtn");
  const closeBtn = document.getElementById("statsClose");
  const closeBtnQuest = document.getElementById("statsCloseQuest");


  const isQuest = options.isQuestMode;

  if (!btn || !modal || !closeBtn || !closeBtnQuest) return;
  
  const fresh = getPlayerStats();
  // クエストステータスモーダルの横幅を広げ、中央揃えを確実にする
  const modalBox = modalQuest?.querySelector(".quest-modal-box");
  if (modalBox) {
    // 横幅をさらに広げる
    modalBox.style.maxWidth = "1200px";
    // コンテンツが切れないように、モーダルの最小高さを設定
    modalBox.style.minHeight = "720px";
  }

  if (modalQuest) {
    modalQuest.style.justifyContent = "center";
    // コンテンツが画面を超える場合にスクロールできるようにし、
    // 常に上端から表示されるようにする
    modalQuest.style.overflowY = "auto";
    modalQuest.style.alignItems = "flex-start";
    modalQuest.style.paddingTop = "2rem";
  }

  //詳細ステータス分岐
  btn.onclick = () => {
    if(isQuest){
      modalQuest.style.display = "flex";
      renderQuestStatsModal();
    } else {
      modal.style.display = "flex";
      renderStatsModal(fresh);
    }
  };

  closeBtn.onclick = () => {
    markAchievementsSeen(fresh);
    modal.style.display = "none";
  };

  closeBtnQuest.onclick = () => {
    markAchievementsSeen(fresh);
    modalQuest.style.display = "none";
  };

  modal.addEventListener("click", e => {
    if (e.target === modal) modal.style.display = "none";
  });
}

function updateQuestHud() {
  const s = getPlayerStatsForEnemy("quest") || {};

  const level   = Number(s.level) || 1;
  const exp     = Number(s.exp) || 0;
  const nextExp = Number(s.nextExp ?? s.next) || 1;
  const maxHp   = Number(s.maxHp ?? s.hp) || 0;
  const defense = Number(s.defense ?? s.def) || 0;
  const cleared = getClearedStageCount();
  const totalStars = getTotalStars();
  const maxStars   = getAvailableMaxStars();

  const levelEl = document.getElementById("hudLevel");
  const hpEl    = document.getElementById("hudHp");
  const defEl   = document.getElementById("hudDef");
  const expEl   = document.getElementById("hudExp");
  const clearEl = document.getElementById("hudClear");

  // 数値の色や大きさをEXP（hud-value）のスタイルに合わせる
  if (levelEl) {
    levelEl.textContent = level;
    levelEl.style.setProperty("color", "#f0f6fc", "important");
    levelEl.style.fontWeight = "bold";
    levelEl.style.fontSize = "13px";
  }
  if (hpEl) {
    hpEl.textContent = maxHp;
    hpEl.style.setProperty("color", "#f0f6fc", "important");
    hpEl.style.fontWeight = "bold";
    hpEl.style.fontSize = "13px";
  }
  if (defEl) {
    defEl.textContent = defense;
    defEl.style.setProperty("color", "#f0f6fc", "important");
    defEl.style.fontWeight = "bold";
    defEl.style.fontSize = "13px";
  }
  
  if (expEl)   expEl.textContent   = `${exp} / ${nextExp}`;

  const expPercent = Math.min(exp / nextExp, 1) * 100;
  const bar = document.getElementById("hudExpBar");
  if (bar) bar.style.width = expPercent + "%";

  const percent = maxStars > 0
  ? Math.floor((totalStars / maxStars) * 100)
  : 0;

  if (clearEl) {
    const crown = hasSeenTrueEnding() ? ' C' : '';
    clearEl.textContent = `CLEAR ${cleared} 　 ★${totalStars}/${maxStars} (${percent}%) 　 ${crown}`;
  }
}

function updateNormalHud(stats) {
  const normal = stats.regular || {};
  const free   = stats.freeMode || {};
  const enemy  = stats.enemyMode || {};

  const avgSpeed = normal.avgSpeed || 0;
  const avgAcc   = normal.avgAccuracy || 0;
  const maxSpeed = normal.maxSpeed || 0;

  // 1. 値の更新
  const elSpeed = document.getElementById("hudAvgSpeed");
  const elAcc   = document.getElementById("hudAvgAcc");
  const elMax   = document.getElementById("hudMaxSpeed");
  const elSRank = document.getElementById("hudSpeedRank");
  const elARank = document.getElementById("hudAccRank");

  // データの代入（スタイルはCSSに任せる）
  if (elSpeed) elSpeed.textContent = avgSpeed.toFixed(1);
  if (elAcc)   elAcc.textContent   = avgAcc.toFixed(1) + "%";
  if (elMax)   elMax.textContent   = maxSpeed.toFixed(1);

  if (elSRank) elSRank.textContent = "/ " + getSpeedRank(avgSpeed);
  if (elARank) elARank.textContent = "/ " + getAccuracyRank(avgAcc);

   // バーの長さ更新
  const speedBar = document.getElementById("hudSpeedBar");
  const accBar   = document.getElementById("hudAccBar");

  if (speedBar) speedBar.style.width = Math.min(avgSpeed / 600, 1) * 100 + "%";
  if (accBar)   accBar.style.width   = Math.min(avgAcc / 100, 1) * 100 + "%";
  
  const totalTime = (normal.totalGameTime || 0) + (free.totalTime || 0) + (enemy.totalPlayTime || 0);
  const el = document.getElementById("totalPlayTime");
  if (el) el.textContent = formatPlayTime(totalTime);

}


//=======================================================
//クエストモードステータス詳細画面
//=======================================================

function renderQuestStatsModal() {

  const skillData = calcQuestSkillStats();
  const skillStats = skillData;
  const s = getPlayerStatsForEnemy("quest") || {};
  const r = s.questRecord || {};
  const totalStars = getTotalStars();

  const maxStars = getAvailableMaxStars();
  const starsPercent = Math.floor(totalStars / maxStars * 100);
  const exp = Number(s.exp) || 0;
  const nextExp = Number(s.nextExp) || 1;
  const expPercent = Math.min(exp / nextExp, 1) * 100;

  const unlockedNodes =
    s.skillTreeProgress?.unlockedNodes || [];
  
  const itemPickupTotal =
    Object.values(r.itemPickupCount || {})
      .reduce((sum, v) => sum + v, 0);

  // 左
  const left = document.getElementById("questBasicStats");

  if (left) {
    left.innerHTML = `
      <div class="quest-bottom-title quest-stats-section">STATUS</div>

        <div class="quest-stats-row"><span class="quest-stats-label">Lv</span><span>${s.level}</span></div>
        <div class="quest-stats-row"><span class="quest-stats-label">HP</span><span>${s.maxHp} ${skillStats.maxHp ? `<span class="stat-plus">(+${skillStats.maxHp})</span>` : ''}</span></div>
        <div class="quest-stats-row"><span class="quest-stats-label">DEF</span><span>${s.defense} ${skillStats.defense ? `<span class="stat-plus">(+${skillStats.defense})</span>` : ''}</span></div>
        <div class="quest-stats-row"><span class="quest-stats-label">EXP</span><span>${exp} / ${nextExp}</span></div>

        <div class="quest-exp-wrap">
          <div class="quest-exp-bar-bg">
            <div class="quest-exp-bar-fill" style="width:${expPercent}%"></div>
          </div>
        </div>

      <div class="quest-bottom-title quest-stats-section">SKILL BONUS</div>

        <div class="quest-skill-row">
          <span>Chain増加</span>
          ${renderQuestStatBar(skillStats.chainRate)}
          <span>x${skillStats.chainRate.toFixed(2)}</span>
        </div>

        <div class="quest-skill-row">
          <span>Chain減衰</span>
          ${renderQuestStatBar(skillStats.chainDecayRate, true)}
          <span>x${skillStats.chainDecayRate.toFixed(2)}</span>
        </div>

        <div class="quest-skill-row">
          <span>ChainBonus</span>
          ${renderQuestStatBar(skillStats.chainBonus)}
          <span>x${skillStats.chainBonus.toFixed(2)}</span>
        </div>

        <div class="quest-skill-row">
          <span>KnockBack</span>
          ${renderQuestStatBar(skillStats.knockbackBonus)}
          <span>x${skillStats.knockbackBonus.toFixed(2)}</span>
        </div>

        <div class="quest-skill-row">
          <span>MaxHP</span>
          ${renderQuestStatBarForValue(skillStats.maxHp, 'addition')}
          <span>+${skillStats.maxHp || 0}</span>
        </div>

        <div class="quest-skill-row">
          <span>DEF</span>
          ${renderQuestStatBarForValue(skillStats.defense, 'addition')}
          <span>+${skillStats.defense || 0}</span>
        </div>

        <div class="quest-skill-row">
          <span>EXP</span>
          ${renderQuestStatBarForValue(skillStats.expMultiplier, 'multiplier')}
          <span>x${(skillStats.expMultiplier || 1).toFixed(2)}</span>
        </div>

        <div class="quest-skill-row">
          <span>ITEM SPAWN</span>
          ${renderQuestStatBarForValue(skillStats.itemSpawnMultiplier, 'multiplier_special')}
          <span>x${(skillStats.itemSpawnMultiplier || 1).toFixed(2)}</span>
        </div>

        <div class="quest-skill-row">
          <span>GUARD</span>
          ${renderQuestStatBarForValue(skillStats.damageNegateChance, 'percentage')}
          <span>${((skillStats.damageNegateChance || 0) * 100).toFixed(0)}%</span>
        </div>

        <div class="quest-skill-row">
          <span>COOLDOWN</span>
          ${renderQuestStatBar(skillStats.cooldownSpeed, 'multiplier_special')}
          <span>x${skillStats.cooldownSpeed.toFixed(2)}</span>
        </div>

        <div class="quest-skill-row">
          <span>REVIVE</span>
          ${renderQuestStatBarForValue(skillStats.reviveChance, 'percentage')}
          <span>${((skillStats.reviveChance || 0) * 100).toFixed(0)}%</span>
        </div>



      <div class="quest-bottom-title quest-stats-section">INPUT</div>
        <div class="quest-stats-row"><span class="quest-stats-label">Avg.KPM</span><span>${(r.avgKpm || 0).toFixed(1)}</span></div>
        <div class="quest-stats-row"><span class="quest-stats-label">Max KPM</span><span>${r.maxKpm || 0}</span></div>
        <div class="quest-stats-row"><span class="quest-stats-label">Accuracy</span><span>${(r.avgAccuracy || 0).toFixed(1)}%</span></div>
        <div class="quest-stats-row"><span class="quest-stats-label">Max Combo</span><span>${r.maxCombo || 0}</span></div>
        <div class="quest-stats-row"><span class="quest-stats-label">Max Chain</span><span>${r.maxChain || 0}</span></div>
    `;
  }

  // 右（スキル）
  renderQuestActiveStock();
  renderQuestActiveSkills();  
  renderQuestEquipmentSkills();

  // 中央リング
  renderQuestRing(s, totalStars, maxStars);

  // 下
  const bottom = document.getElementById("questBottom");

  if (bottom) {

    const r = s.questRecord || {};

    // スクロール可能にするためのスタイルを適用
    const logContainerStyle = ``; // このスタイルはカード個別に適用するため、ここでは不要
    // 2つのカードを均等に並べるためのスタイル
    const gridContainerStyle = `display: grid; grid-template-columns: 1fr 1fr; gap: 10px;`;
    const cardStyle = `height: 160px; display: flex; flex-direction: column;`;
    const cardContentStyle = `flex-grow: 1; overflow-y: auto; margin-top: 8px; padding-right: 10px; min-height: 0;`;

    bottom.innerHTML = `
  
      <div class="quest-log">

        <!-- ======================================================
          TAB BUTTONS
          ・ここで表示カテゴリを切り替える
          ・UIの意味を分けるのが目的
        ====================================================== -->
        <div class="quest-tabs">

          <!-- STATUS = ステータス・活動系 -->
          <button class="quest-tab active" data-tab="status">
            STATUS
          </button>

          <!-- PROGRESSION = ステージ・ノード進行ログ -->
          <button class="quest-tab" data-tab="progression">
            PROGRESSION
          </button>

          <!-- SKILL = スキル使用履歴 -->
          <button class="quest-tab" data-tab="skill">
            SKILL
          </button>

        </div>

        <!-- ======================================================
          STATUS TAB
          ・旧 RECORD + ACTIVITY を統合
          ・プレイヤーの現在状態 + 行動統計
        ====================================================== -->
       <div class="quest-tab-content-wrapper">
        <div class="quest-tab-content" id="tab-status" style="display: block;">
          ${renderStatusTabContent(r, cardStyle, cardContentStyle, totalStars, maxStars, itemPickupTotal)}
        </div>
        <div class="quest-tab-content" id="tab-progression" style="display: none;">
          ${renderProgressionTabContent(r, gridContainerStyle, cardStyle, cardContentStyle)}
        </div>
        <div class="quest-tab-content" id="tab-skill" style="display: none;">
          ${renderSkillTabContent(r, gridContainerStyle, cardStyle, cardContentStyle, unlockedNodes)}
        </div>
      </div>
    `;
  }

  // DOM生成後に初期化
  initQuestTabs();
}

function renderQuestEquipmentSkills() {
  const el = document.getElementById("questRight");
  if (!el) return;

  const equipped = calcQuestSkillStats().equipped || [];

  // コンテナをクリア
  el.innerHTML = "";

  el.insertAdjacentHTML('beforeend', `
    <div class="quest-bottom-title" style="margin-bottom: 8px;">
      PASSIVE SKILL
    </div>
  `);

  if (equipped.length === 0) {
    el.innerHTML += `<div class="skill-empty">NO EQUIP</div>`;
    return;
  }

  equipped.forEach(id => {
    const skill = PASSIVE_SKILLS?.[id];
    if (!skill) return;

    const item = document.createElement("div");
    item.className = "skill-item equipped";

    item.innerHTML = `
      <div class="skill-icon-wrap">
        <img src="${images[skill.icon]?.src || ""}" class="skill-icon">
      </div>
      <div class="skill-main">
        <div class="skill-name" style="color: #fff;">${skill.name}</div>
        <div class="skill-desc" style="color: #fff;">${skill.desc ?? ""}</div>
      </div>
    `;

    el.appendChild(item);
  });
}


function renderQuestActiveSkills() {
  const el = document.getElementById("questActiveSkills");
  if (!el) return;

  const stats = getPlayerStatsForEnemy("quest") || {};

  // 装備中アクティブ
  const equipped = stats.equippedActiveSkills || [];

  // 最大ストック
  const maxStock = stats.activeSkillStockMax || 1;

  // コンテナをクリア
  el.innerHTML = "";

  el.insertAdjacentHTML('beforeend', `
    <div class="quest-bottom-title" style="margin-bottom: 8px;">
      ACTIVE SKILL
    </div>
  `);

  if (equipped.length === 0) {
    el.innerHTML += `<div class="skill-empty">NO EQUIP</div>`;
    return;
  }

  equipped.forEach(id => {

    // ACTIVE_SKILLS を import 必須
    const skill = ACTIVE_SKILLS?.[id];
    if (!skill) return;

    const item = document.createElement("div");
    item.className = "skill-item equipped active";

    item.innerHTML = `
      <div class="skill-icon-wrap">
        <img src="${images[skill.icon]?.src || ""}" class="skill-icon">
      </div>

      <div class="skill-main">
        <div class="skill-name active-name" style="color: #fff;">${skill.name}</div>

        <div class="skill-desc" style="color: #fff;">
          ${skill.desc ?? ""}
        </div>
      </div>
    `;

    el.appendChild(item);
  });
}

function renderQuestActiveStock() {
  const el = document.getElementById("questActiveStock");
  if (!el) return;

  const s = getPlayerStatsForEnemy("quest") || {};
  const stockMax = Number(s.activeSkillStockMax || 1);

  el.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.className = "stock-inline-bars";

  for (let i = 0; i < stockMax; i++) {
    const bar = document.createElement("div");
    bar.className = "stock-mini-bar";
    wrap.appendChild(bar);
  }

  el.appendChild(wrap);
}


function renderQuestRing(s) {
  const canvas = document.getElementById("questCoreCanvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const w = canvas.width = 280;
  const h = canvas.height = 280;

  const cx = w / 2;
  const cy = h / 2;

  ctx.clearRect(0, 0, w, h);

  const exp = Number(s.exp) || 0;
  const nextExp = Number(s.nextExp) || 1;
  const ratio = Math.min(exp / nextExp, 1);

  const level = s.level || 1;

  /* =========================
     外側リング背景
  ========================= */
  ctx.strokeStyle = "rgba(0,255,255,0.15)";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(cx, cy, 86, 0, Math.PI * 2);
  ctx.stroke();

  /* =========================
     EXPリング
  ========================= */
  ctx.strokeStyle = "rgba(0,255,255,0.95)";
  ctx.shadowBlur = 14;
  ctx.shadowColor = "rgba(0,255,255,0.9)";
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.arc(
    cx,
    cy,
    86,
    -Math.PI / 2,
    -Math.PI / 2 + Math.PI * 2 * ratio
  );
  ctx.stroke();

  ctx.shadowBlur = 0;

  /* =========================
     内側リング
  ========================= */
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 58, 0, Math.PI * 2);
  ctx.stroke();

  /* =========================
     中央 EXP%
  ========================= */
  // ctx.fillStyle = "#9ff";
  // ctx.font = "bold 24px monospace";
  // ctx.textAlign = "center";
  // ctx.fillText(`${Math.floor(ratio * 100)}%`, cx, cy + 8);

  /* =========================
     下部 Lv表示
  ========================= */
  const levelY = cy + 132;

  /* Lvラベル */
  ctx.fillStyle = "rgba(130,220,255,0.75)";
  ctx.font = "14px monospace";
  ctx.textAlign = "right";
  ctx.fillText("Lv", cx - 4, levelY);

  /* 数字 */
  ctx.fillStyle = "rgba(180,255,255,0.98)";
  ctx.font = "bold 22px monospace";
  ctx.textAlign = "left";
  ctx.fillText(String(level), cx + 4, levelY);


  /* =========================
    右側 スキルスロット
  ========================= */

  const passiveSlots =
    Number(
      (s.baseSkillSlot || 0) +
      (s.bonusSkillSlot || 0)
    );

  const activeSlots = Number(
    s.activeSkillSlots ??
    1
  );

  const equippedPassive =
    s.equippedSkills?.length || 0;

  const equippedActive =
    s.equippedActiveSkills?.length || 0;

  const slotX = cx + 114;

  /* =========================
    ACTIVE
  ========================= */

  const activeStartY =
    cy - 54;

  for (let i = 0; i < activeSlots; i++) {

    const y = activeStartY + i * 22;

    const filled = i < equippedActive;

    ctx.fillStyle = filled
      ? "rgba(255,140,40,0.28)"
      : "rgba(255,140,40,0.06)";

    ctx.strokeStyle = filled
      ? "rgba(255,200,120,0.95)"
      : "rgba(255,180,80,0.35)";

    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.roundRect(slotX, y, 14, 14, 3);
    ctx.fill();
    ctx.stroke();

    /* 内部ライン */
    ctx.strokeStyle = filled
      ? "rgba(255,255,255,0.9)"
      : "rgba(255,255,255,0.25)";

    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(slotX + 2.5, y + 7);
    ctx.lineTo(slotX + 11, y + 7);
    ctx.stroke();
  }

  /* =========================
    PASSIVE
  ========================= */

  const passiveStartY =
    cy - 4;

  for (let i = 0; i < passiveSlots; i++) {

    const y = passiveStartY + i * 22;

    const filled = i < equippedPassive;

    ctx.fillStyle = filled
      ? "rgba(0,255,255,0.22)"
      : "rgba(0,255,255,0.05)";

    ctx.strokeStyle = filled
      ? "rgba(120,255,255,0.95)"
      : "rgba(0,255,255,0.35)";

    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.roundRect(slotX, y, 14, 14, 3);
    ctx.fill();
    ctx.stroke();

    /* 内部ライン */
    ctx.strokeStyle = filled
      ? "rgba(255,255,255,0.85)"
      : "rgba(255,255,255,0.2)";

    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(slotX + 2.5, y + 7);
    ctx.lineTo(slotX + 11, y + 7);
    ctx.stroke();
  }

  /* =========================
    スキルスロット当たり判定
  ========================= */

  function isSkillSlotHit(mx, my) {

    // ACTIVE
    for (let i = 0; i < activeSlots; i++) {

      const y = activeStartY + i * 22;

      const hit =
        mx >= slotX &&
        mx <= slotX + 14 &&
        my >= y &&
        my <= y + 14;

      if (hit) return true;
    }

    // PASSIVE
    for (let i = 0; i < passiveSlots; i++) {

      const y = passiveStartY + i * 22;

      const hit =
        mx >= slotX &&
        mx <= slotX + 14 &&
        my >= y &&
        my <= y + 14;

      if (hit) return true;
    }

    return false;
  }

  /* =========================
    hover cursor
  ========================= */

  canvas.onmousemove = (e) => {

    const rect = canvas.getBoundingClientRect();

    const mx =
      (e.clientX - rect.left) *
      (canvas.width / rect.width);

    const my =
      (e.clientY - rect.top) *
      (canvas.height / rect.height);

    const hovering =
      isSkillSlotHit(mx, my);

    canvas.style.cursor =
      hovering
        ? "pointer"
        : "default";
  };

  /* =========================
    skillスロットコンテナのclick 
  ========================= */

  canvas.onclick = (e) => {

    const rect = canvas.getBoundingClientRect();

    const mx =
      (e.clientX - rect.left) *
      (canvas.width / rect.width);

    const my =
      (e.clientY - rect.top) *
      (canvas.height / rect.height);

    const hit =
      isSkillSlotHit(mx, my);

    if (!hit) return;

    closeQuestStatsModal();

    openQuestMenuModal("skill");

  };

}

function closeQuestStatsModal() {

  const modal =
    document.getElementById("questStatsModal");

  if (!modal) return;

  modal.style.display = "none";
}

//=== skillパラメータ関連関数 ======================
function calcQuestSkillStats() {
  const stats = getPlayerStatsForEnemy("quest") || {};
  const equipped = stats.equippedSkills || [];

  console.log("equippedSkills =", equipped);

  const result = {
    chainRate: 1,
    chainDecayRate: 1,
    chainBonus: 1,
    knockbackBonus: 1,
    maxHp: 0,
    defense: 0,
    expMultiplier: 1,
    itemSpawnMultiplier: 1,
    damageNegateChance: 0,
    reviveChance: 0,
    cooldownSpeed: 1.0,
  };

  equipped.forEach(id => {
    const skill = PASSIVE_SKILLS?.[id];

    console.log("skill =", id, skill);

    if (!skill) return;

    if (typeof skill.apply === "function") {
      skill.apply(result);
      console.log("after apply", id, structuredClone(result));
    }
  });

  console.log("final result =", result);

  return {
    equipped,
    ...result
  };
}

function renderQuestStatBar(value, inverse = false) {
  const base = 1.0;

  // inverse=true は小さいほど強い
  const delta = inverse ? base - value : value - base;

  // 表示上限を基準の3倍 (x3) にする。
  // base=1 の場合、最大表示 (center→edge) は value = 3 で到達するようにする。
  const maxMultiplier = 3;
  const maxDelta = Math.max(0.0001, maxMultiplier - base); // 安全対策（ゼロ除算防止）
  const scale = 50 / maxDelta; // delta * scale がパーセンテージ幅にマッピングされる

  const width = Math.min(Math.abs(delta) * scale, 50);
  const left = delta >= 0 ? 50 : 50 - width;
  const dir = delta >= 0 ? "up" : "down";
  const borderRadiusStyle = dir === 'up'
    ? 'border-radius: 0 999px 999px 0;'
    : 'border-radius: 999px 0 0 999px;';

  return `
    <div class="quest-skill-bar">
      <div class="quest-skill-bar-center"></div>
      <div class="quest-skill-bar-fill ${dir}"
           style="left:${left}%; width:${width}%; ${borderRadiusStyle}">
      </div>
    </div>
  `;
}

/**
 * スキルボーナスの種類に応じた汎用的なスタッツバーをレンダリングする
 * @param {number} value - 現在の数値
 * @param {'addition' | 'multiplier' | 'multiplier_special' | 'percentage'} type - 値の種類
 * @returns {string} - バーのHTML文字列
 */
function renderQuestStatBarForValue(value = 0, type = 'addition') {
  let delta = 0;
  let maxDelta = 1; // デフォルトの最大値

  switch (type) {
    case 'addition':
      // 例: MaxHP +50 -> delta: 50, maxDelta: 100 (仮)
      delta = value;
      maxDelta = 100; // HPやDEFの最大ボーナス値（仮）
      break;
    case 'multiplier':
      // 例: EXP x1.5 -> delta: 0.5, maxDelta: 2.0 (x3.0が最大)
      delta = value - 1.0;
      maxDelta = 2.0;
      break;
    case 'multiplier_special':
      // 例: ITEM SPAWN x0.5 -> delta: -0.5, maxDelta: 1.0 (x0 or x2.0が最大)
      delta = value;
      maxDelta = 2.0;
      break;
    case 'percentage':
      // 例: GUARD 20% -> delta: 0.2, maxDelta: 1.0 (100%が最大)
      delta = value;
      maxDelta = 1.0;
      break;
  }

  const scale = 50 / Math.max(0.0001, maxDelta);
  const width = Math.min(Math.abs(delta) * scale, 50);
  const left = delta >= 0 ? 50 : 50 - width;
  const dir = delta >= 0 ? "up" : "down";
  const borderRadiusStyle = dir === 'up'
    ? 'border-radius: 0 999px 999px 0;'
    : 'border-radius: 999px 0 0 999px;';

  return `
    <div class="quest-skill-bar">
      <div class="quest-skill-bar-center"></div>
      <div class="quest-skill-bar-fill ${dir}"
           style="left:${left}%; width:${width}%; ${borderRadiusStyle}">
      </div>
    </div>
  `;
}

//==============================================================
//デイリーステータス詳細
//==============================================================
function renderStatsModal(sArg) {
  
  const s = sArg ?? getPlayerStats() ?? {};
  const e = s.enemyMode ?? {};
  const n = s.regular ?? {};
  const f = s.freeMode ?? {};

  const AllTime = f.totalTime + n.totalGameTime + e.totalPlayTime;
  const basicTotalPlays = n.totalPlays + e.totalPlays

  // ★追加：各モード回数
  const eModes = e.modes || {};
  const nModes = n.modes || {};
  const fModes = f.modes || {};

  const nNormalNum = nModes["normal"] || 0;
  const nAttackNum = nModes["time_attack"] || 0;
  const nLongNum   = nModes["long_text"] || 0;
  const nMissNum   = nModes["miss_practice"] || 0;
  const eEnemyNum  = eModes["enemy_mode"] || 0;

  const fNormalNum = fModes["normal"] || 0;
  const fAttackNum = fModes["time_attack"] || 0;
  const fLongNum   = fModes["long_text"] || 0;
  const fMissNum   = fModes["miss_practice"] || 0;
  const fEnemyNum  = fModes["enemy_mode"] || 0;

  const NormalNum = nNormalNum + fNormalNum
  const AttackNum = nAttackNum + fAttackNum
  const LongNum = nLongNum + fLongNum
  const MissNum = nMissNum + fMissNum
  const EnemyNum = eEnemyNum + fEnemyNum;

  const content = document.getElementById("statsContent");

  content.innerHTML = `
    <div class="daily-stats-grid">
      <div class="daily-stats-card">
        <div class="daily-stats-section">入力（ベーシック）</div>
        <div class="daily-stats-row"><span>平均KPM</span><span>${(n.avgSpeed || 0).toFixed(0)}</span></div>
        <div class="daily-stats-row"><span>平均正確率</span><span>${(n.avgAccuracy || 0).toFixed(1)}%</span></div>
        <div class="daily-stats-row">
          <span>最高KPM</span><span>
            ${n.maxSpeed || 0}
            ${n.maxSpeedDate ? `(${formatDateOnly(n.maxSpeedDate)})` : ""}
          </span>
        </div>
        <div class="daily-stats-row"><span>累計タイプ数</span><span>${n.totalTyped || 0}</span></div>
        <div class="daily-stats-row"><span>累計ミス数</span><span>${n.totalMiss || 0}</span></div>
      </div>

      <div class="daily-stats-card">
        <div class="daily-stats-section">入力（エネミー）</div>
        <div class="daily-stats-row"><span>平均KPM</span><span>${(e.avgGKpm || 0).toFixed(0)}</span></div>
        <div class="daily-stats-row"><span>平均正確率</span><span>${(e.avgAccuracy || 0).toFixed(1)}%</span></div>
        <div class="daily-stats-row">
          <span>最高KPM</span><span>
            ${e.maxGKpm || 0}
            ${e.maxGKpmDate ? `(${formatDateOnly(e.maxGKpmDate)})` : ""}
          </span>
        </div>
        <div class="daily-stats-row"><span>最大チェイン</span><span>${e.maxChain || 0}</span></div>
        <div class="daily-stats-row"><span>最大コンボ</span><span>${e.maxCombo || 0}</span></div>  
        
        <div class="daily-stats-row"><span>累計タイプ数</span><span>${e.totalTyped || 0}</span></div>
        <div class="daily-stats-row"><span>累計ミス数</span><span>${e.totalMiss || 0}</span></div>
        <div class="daily-stats-row"><span>敵撃破数</span><span>${e.totalKills || 0}</span></div>
      </div>

      <div class="daily-stats-card">
        <div class="daily-stats-section">総合</div>
        <div class="daily-stats-row"><span>最高eScore</span><span>
        ${n.maxEScore || 0}
        ${n.maxEScoreDate ? `(${formatDateOnly(n.maxEScoreDate)})` : ""}
        </span></div>
        <div class="daily-stats-row">
          <span>最高gScore</span><span>
            ${e.maxGScore || 0}
            ${e.maxGScoreDate ? `(${formatDateOnly(e.maxGScoreDate)})` : ""}
          </span>
        </div>
        <div class="daily-stats-row"><span>プレイ時間</span><span>${formatPlayTime(AllTime || 0)}</span></div>
        <div class="daily-stats-row"><span>プレイ回数</span><span>${s.totalPlays || 0}</span></div>
        <div class="daily-stats-row sub"><span>スタンダード</span><span>${NormalNum || 0}</span></div>
        <div class="daily-stats-row sub"><span>タイムアタック</span><span>${AttackNum || 0}</span></div>
        <div class="daily-stats-row sub"><span>長文</span><span>${LongNum || 0}</span></div>
        <div class="daily-stats-row sub"><span>エネミー</span><span>${EnemyNum || 0}</span></div>
        <div class="daily-stats-row sub"><span>ミス練習</span><span>${MissNum || 0}</span></div>
        <div class="daily-stats-row sub"><span>最多プレイ回数／日</span><span>${s.days?.maxPerDay || 0}</span></div>
        <div class="daily-stats-row sub"><span>今日のプレイ回数</span><span>${s.days?.todayCount || 0}</span></div>
      </div>
        
      <div class="daily-stats-card">
        <div class="daily-stats-section">デイリー</div>
        <div class="daily-stats-row"><span>プレイ時間</span><span>${formatPlayTime((n.totalGameTime || 0) + (e.totalPlayTime || 0))}</span></div>
        <div class="daily-stats-row"><span>プレイ回数</span><span>${basicTotalPlays || 0}</span></div>
        <div class="daily-stats-row sub"><span>スタンダード</span><span>${nNormalNum || 0}</span></div>
        <div class="daily-stats-row sub"><span>タイムアタック</span><span>${nAttackNum || 0}</span></div>
        <div class="daily-stats-row sub"><span>長文</span><span>${nLongNum || 0}</span></div>
        <div class="daily-stats-row sub"><span>エネミー</span><span>${eEnemyNum || 0}</span></div>
        <div class="daily-stats-row sub"><span>ミス練習</span><span>${nMissNum || 0}</span></div>
      </div>

      <div class="daily-stats-card">
        <div class="daily-stats-section">フリーモード</div>
        <div class="daily-stats-row"><span>プレイ時間</span><span>${formatPlayTime(f.totalTime || 0)}</span></div>
        <div class="daily-stats-row"><span>プレイ回数</span><span>${f.totalPlays || 0}</span></div>
        <div class="daily-stats-row sub"><span>スタンダード</span><span>${fNormalNum || 0}</span></div>
        <div class="daily-stats-row sub"><span>タイムアタック</span><span>${fAttackNum || 0}</span></div>
        <div class="daily-stats-row sub"><span>長文</span><span>${fLongNum || 0}</span></div>
        <div class="daily-stats-row sub"><span>エネミー</span><span>${fEnemyNum || 0}</span></div>
        <div class="daily-stats-row sub"><span>ミス練習</span><span>${fMissNum || 0}</span></div>
      </div>

      <div class="daily-stats-card">
        <div class="daily-stats-section">日数</div>
        <div class="daily-stats-row"><span>プレイ日数</span><span>${s.days?.unique || 0}</span></div>
        <div class="daily-stats-row"><span>連続日数</span><span>${s.days?.streak || 0}</span></div>
      </div>
    </div>
  `;

}

 
// ノードをフラット検索（クエストモードのステータス表示でステージ名を取得するため）
function findQuestNode(id) {

  for (const world of Object.values(QUEST_MAP)) {

    const node = world.nodes?.find(n => n.id === id);

    if (node) return node;
  }

  return null;
}

function initQuestTabs() {
  const tabs = document.querySelectorAll(".quest-tab");
  const contents = document.querySelectorAll(".quest-tab-content");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      // Deactivate all tabs and contents
      tabs.forEach(t => t.classList.remove("active"));
      contents.forEach(c => c.style.display = "none");

      // Activate the clicked tab and corresponding content
      tab.classList.add("active");
      const contentId = "tab-" + tab.dataset.tab;
      const activeContent = document.getElementById(contentId);
      if (activeContent) {
        activeContent.style.display = "block";
      }
    });
  });
}

function renderStatusTabContent(r, cardStyle, cardContentStyle, totalStars, maxStars, itemPickupTotal) {
  const starsPercent = maxStars > 0 ? Math.floor(totalStars / maxStars * 100) : 0;
  return `
    <div class="quest-bottom-grid">
      <div class="quest-bottom-card" style="${cardStyle}">
        <div class="quest-bottom-title">RECORD</div>
        <div style="${cardContentStyle}">
          <div class="quest-bottom-row"><span class="quest-bottom-label">CLEAR</span><span class="quest-bottom-value">${getClearedStageCount()}</span></div>
          <div class="quest-bottom-row"><span class="quest-bottom-label">BEST SCORE</span><span class="quest-bottom-value gold">${(r.maxGScore || 0).toLocaleString()}</span></div>
          <div class="quest-bottom-row"><span class="quest-bottom-label">★</span><span class="quest-bottom-value gold">${totalStars} / ${maxStars} (${starsPercent}%)</span></div>
          <div class="quest-bottom-row"><span class="quest-bottom-label">PLAY</span><span class="quest-bottom-value">${r.totalPlays || 0}</span></div>
          <div class="quest-bottom-row"><span class="quest-bottom-label">KILL</span><span class="quest-bottom-value">${r.totalKills || 0}</span></div>
          <div class="quest-bottom-row"><span class="quest-bottom-label">ITEM</span><span class="quest-bottom-value">${itemPickupTotal}</span></div>
          <div class="quest-bottom-row"><span class="quest-bottom-label">TIME</span><span class="quest-bottom-value">${formatPlayTime(r.totalPlayTime || 0)}</span></div>
          <div class="quest-bottom-row"><span class="quest-bottom-label">TYPED</span><span class="quest-bottom-value">${r.totalTyped || 0}</span></div>
          <div class="quest-bottom-row"><span class="quest-bottom-label">MISS</span><span class="quest-bottom-value">${r.totalMiss || 0}</span></div>
        </div>
      </div>
      <div class="quest-bottom-card" style="${cardStyle}">
        <div class="quest-bottom-title">ACTIVITY</div>
        <div style="${cardContentStyle}">
          <div class="quest-bottom-row"><span class="quest-bottom-label">TODAY</span><span class="quest-bottom-value">${r.days?.todayCount || 0}</span></div>
          <div class="quest-bottom-row"><span class="quest-bottom-label">BEST / DAY</span><span class="quest-bottom-value">${r.days?.maxPerDay || 0}</span></div>
          <div class="quest-bottom-row"><span class="quest-bottom-label">STREAK</span><span class="quest-bottom-value gold">${r.days?.streak || 0}</span></div>
          <div class="quest-bottom-row"><span class="quest-bottom-label">ACTIVE DAYS</span><span class="quest-bottom-value">${r.days?.unique || 0}</span></div>
        </div>
      </div>
    </div>
  `;
}

function renderProgressionTabContent(r, gridContainerStyle, cardStyle, cardContentStyle) {
  return `
    <div class="quest-bottom-grid" style="${gridContainerStyle}">
      <div class="quest-bottom-card" style="${cardStyle}">
        <div class="quest-bottom-title">STAGE LOG</div>
        <div style="${cardContentStyle}">
          ${Object.entries(r.stageAttemptCount || {}).sort((a, b) => b[1] - a[1]).map(([id, count]) => {
            const node = findQuestNode(id);
            const name = node?.name || id;
            return `<div class="quest-bottom-row"><span class="quest-bottom-label">${id} (${name})</span><span class="quest-bottom-value">${count}</span></div>`;
          }).join("")}
        </div>
      </div>
      <div class="quest-bottom-card" style="${cardStyle}">
        <div class="quest-bottom-title">SKILL NODE LOG</div>
        <div style="${cardContentStyle}">
          ${Object.entries(r.skillNodeAttemptCount || {}).sort((a, b) => b[1] - a[1]).map(([id, count]) => `
            <div class="quest-bottom-row"><span class="quest-bottom-label">${id}</span><span class="quest-bottom-value">${count}</span></div>
          `).join("")}
        </div>
      </div>
    </div>
  `;
}

function renderSkillTabContent(r, gridContainerStyle, cardStyle, cardContentStyle, unlockedNodes) {
  return `
    <div class="quest-bottom-grid" style="${gridContainerStyle}">
      <div class="quest-bottom-card" style="${cardStyle}">
        <div class="quest-bottom-title">SKILL USES</div>
        <div style="${cardContentStyle}">
          ${Object.entries(r.activeSkillUseCount || {}).sort((a, b) => b[1] - a[1]).map(([id, count]) => {
            const skill = ACTIVE_SKILLS[id];
            const name = skill?.name || id;
            const icon = skill?.icon || "";
            const isImage = typeof icon === "string" && (icon.includes("/") || icon.endsWith(".png") || icon.endsWith(".jpg") || icon.endsWith(".jpeg") || icon.endsWith(".webp"));
            const iconHtml = isImage ? `<img src="${icon}" class="quest-skill-bottom-icon">` : `<span>${icon}</span>`;
            return `
              <div class="quest-bottom-row">
                <span class="quest-bottom-label" style="display:flex; align-items:center; gap: 6px;">
                  ${iconHtml}<span>${name}</span>
                </span>
                <span class="quest-bottom-value">${count}</span>
              </div>
            `;
          }).join("")}
        </div>
      </div>
      <div class="quest-bottom-card" style="${cardStyle}">
        <div class="quest-bottom-title">AUTO PASSIVE SKILLS</div>
        <div style="${cardContentStyle}">
          ${unlockedNodes
            .map(nodeId => SKILL_TREE[nodeId])
            .filter(node => node?.skillId)
            .filter(node => !ACTIVE_SKILLS[node.skillId])
            .map(node => getSkillById(node.skillId))
            .filter(skill => skill?.equipable === false)
            .map(skill => {
              const name = skill?.name || "UNKNOWN";
              const desc = skill?.desc || "";
              const iconSrc = images[skill.icon]?.src || "";

              return `
                <div class="skill-item" style="background: rgba(0,255,255,0.02); border-color: rgba(0,255,255,0.08); margin-bottom: 4px;">
                  <div class="skill-icon-wrap" style="width: 28px; height: 28px;">
                    <img src="${iconSrc}" class="skill-icon" style="width: 22px; height: 22px;">
                  </div>
                  <div class="skill-main">
                    <div class="skill-name" style="color: #fff; font-size: 12px;">${name}</div>
                    <div class="skill-desc" style="color: #ccc; font-size: 10px;">${desc}</div>
                  </div>
                </div>
              `;
            }).join("")}
        </div>
      </div>
    </div>
  `;
}
