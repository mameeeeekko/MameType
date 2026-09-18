// freeSkillUI.js
// =====================================================
// フリーモード（ENEMY / QUEST BOSS）専用のアクティブスキル設定UI
// ・スキル選択モーダル（全アクティブスキルから1枠選択／なしも可）
// ・星強化モーダル（フリー専用の単一レベル。コストなしで自由設定）
// ・クエストのスキル/星強化データとは完全に独立（値は main.js 側が保持する）
//
// ※ 状態は持たず、コールバック（onSelect / onChange）で呼び出し元と連携する。
// ※ 見た目はクエストのモーダル（quest-modal / skill-grid / star-upgrade-*）を流用する。
// =====================================================

import { ACTIVE_SKILLS } from "./questSkills.js";
import { images } from "./assetsLoader.js";
import { playSE } from "./effectManager.js";
import { stageRect, clientToStage, STAGE_W, STAGE_H } from "./stageScale.js";

// =====================================================
// 星強化（フリーモード専用）
// =====================================================
export const FREE_SKILL_STAR_MAX_LEVEL = 10;
export const FREE_SKILL_STAR_REDUCTION_PER_LEVEL = 0.05; // 5%

/**
 * フリー専用の星強化レベルを 0〜10 に丸めます。
 * @param {number} level
 * @returns {number}
 */
export function clampFreeSkillStarLevel(level) {
  const n = Number(level);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(FREE_SKILL_STAR_MAX_LEVEL, Math.floor(n)));
}

/**
 * フリー専用の星強化レベルからクールダウンの時間係数を返します。
 * @param {number} level
 * @returns {number} 1.0 = 強化なし、0.5 = 50%短縮
 */
export function getFreeSkillStarTimeFactor(level) {
  const lv = clampFreeSkillStarLevel(level);
  return Math.max(0.05, 1 - lv * FREE_SKILL_STAR_REDUCTION_PER_LEVEL);
}

/**
 * スキルIDからスキル定義を返します（未選択・不正IDは null）。
 * main.js が ACTIVE_SKILLS を直接 import しなくて済むようにするためのヘルパー。
 * @param {string|null} skillId
 * @returns {object|null}
 */
export function getFreeSkillInfo(skillId) {
  if (!skillId) return null;
  return ACTIVE_SKILLS?.[skillId] ?? null;
}

// =====================================================
// モーダル共通
// =====================================================
const MODAL_ID = "freeSkillModal";

export function isFreeSkillModalOpen() {
  return !!document.getElementById(MODAL_ID);
}

export function closeFreeSkillModal() {
  // ★閉じる際にホバー中のツールチップも消す（要素remove時はmouseleaveが発火しないため）
  hideFreeSkillTooltip();
  const el = document.getElementById(MODAL_ID);
  if (el) el.remove();
}

/**
 * モーダル表示中のキー処理。表示中は他のキー処理へ流さないため true を返します。
 * @param {KeyboardEvent} e
 * @returns {boolean} 処理したかどうか
 */
export function handleFreeSkillModalKey(e) {
  if (!isFreeSkillModalOpen()) return false;

  const key = (e.key || "").toLowerCase();
  if (key === "escape" || key === "b" || key === "v" || key === "u") {
    e.preventDefault();
    closeFreeSkillModal();
  }
  // モーダル表示中はメニューのキー操作（BACK 等）へ漏らさない
  return true;
}

function buildBaseModal({ title, boxClass }) {
  closeFreeSkillModal();

  const overlay = document.createElement("div");
  overlay.id = MODAL_ID;
  // ★free-skill-modal: フリーモードの設定パネル(z-index 10550)より前面に出すための専用クラス
  overlay.className = "quest-modal free-skill-modal";

  const box = document.createElement("div");
  box.className = `quest-modal-box ${boxClass}`;

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "×";
  closeBtn.className = "quest-modal-close-btn";
  closeBtn.onclick = closeFreeSkillModal;

  const titleEl = document.createElement("div");
  titleEl.className = "quest-modal-title";
  titleEl.textContent = title;

  const content = document.createElement("div");
  content.className = "quest-modal-content";

  box.appendChild(closeBtn);
  box.appendChild(titleEl);
  box.appendChild(content);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  return { overlay, box, content };
}

// =====================================================
// ツールチップ（クエストと同じ .quest-tooltip を流用）
// =====================================================
let tooltipEl = null;

function hideFreeSkillTooltip() {
  if (tooltipEl) {
    tooltipEl.remove();
    tooltipEl = null;
  }
}

function showFreeSkillTooltip(skill, event) {
  hideFreeSkillTooltip();
  if (!skill) return;

  tooltipEl = document.createElement("div");
  tooltipEl.className = "quest-tooltip";

  const cooldownHTML = skill.cooldown
    ? `<div class="skill-tooltip-cooldown">cooldown: ${skill.cooldown}sec</div>`
    : "";

  tooltipEl.innerHTML = `
    <b>${skill.name}</b>
    <div style="margin-top: 5px;">${skill.desc ?? ""}</div>
    ${cooldownHTML}
  `;

  document.body.appendChild(tooltipEl);

  // transform スケール下でも正しく配置できるよう、クエストと同じくステージ座標で扱う
  const tooltipRect = stageRect(tooltipEl);
  const m = clientToStage(event?.clientX ?? 0, event?.clientY ?? 0);

  let left = m.x + 12;
  let top = m.y + 12;

  if (left + tooltipRect.width > STAGE_W) left = m.x - tooltipRect.width - 12;
  if (top + tooltipRect.height > STAGE_H) top = m.y - tooltipRect.height - 12;

  tooltipEl.style.left = left + "px";
  tooltipEl.style.top = top + "px";
}

// =====================================================
// スキル選択モーダル
// =====================================================
/**
 * フリーモードで使用するアクティブスキルを選択するモーダルを開きます。
 * @param {object} opts
 * @param {string} [opts.title] - モーダルのタイトル
 * @param {string|null} [opts.currentSkillId] - 現在選択中のスキルID（null = なし）
 * @param {(skillId: string|null) => void} [opts.onSelect] - 選択時に呼ばれる
 */
export function openFreeSkillSelectModal({ title = "SKILL SELECT", currentSkillId = null, onSelect } = {}) {
  playSE("questmenu");

  const { content } = buildBaseModal({ title, boxClass: "quest-modal-skill" });

  let selectedId = currentSkillId && ACTIVE_SKILLS[currentSkillId] ? currentSkillId : null;

  const desc = document.createElement("div");
  desc.className = "star-upgrade-desc";
  desc.style.marginBottom = "10px";
  desc.innerHTML = `
    フリーモードで使用するアクティブスキルを1つ選択してください。<br>
    全スキルから自由に選択できます（クエストのスキルツリー解放状況は不要です）。<br>
    ※ 「なし」を選ぶとスキルを使用しません。
  `;

  const grid = document.createElement("div");
  grid.className = "skill-grid";

  content.appendChild(desc);
  content.appendChild(grid);

  function render() {
    grid.innerHTML = "";

    // --- なし ---
    const noneItem = document.createElement("div");
    noneItem.className = "skill-grid-item" + (selectedId === null ? " equipped" : "");
    noneItem.innerHTML = `
      <div class="skill-grid-icon-wrap">
        <div class="skill-grid-icon" style="display:flex; align-items:center; justify-content:center; font-size:20px; color:#8b949e;">－</div>
      </div>
      <div class="skill-grid-name">なし</div>
    `;
    noneItem.onclick = () => {
      if (selectedId === null) return;
      playSE("skill_off");
      selectedId = null;
      render();
      onSelect?.(null);
    };
    noneItem.onmouseleave = () => hideFreeSkillTooltip();
    grid.appendChild(noneItem);

    // --- 全アクティブスキル ---
    Object.entries(ACTIVE_SKILLS).forEach(([skillId, skill]) => {
      const item = document.createElement("div");
      item.className = "skill-grid-item" + (selectedId === skillId ? " equipped" : "");

      item.innerHTML = `
        <div class="skill-grid-icon-wrap">
          <img src="${images[skill.icon]?.src || ""}" class="skill-grid-icon">
        </div>
        <div class="skill-grid-name">${skill.name}</div>
      `;

      item.onclick = () => {
        if (selectedId === skillId) return;
        playSE("skill_on");
        selectedId = skillId;
        render();
        onSelect?.(skillId);
      };

      item.onmousemove = (e) => showFreeSkillTooltip(skill, e);
      item.onmouseleave = () => hideFreeSkillTooltip();

      grid.appendChild(item);
    });
  }

  render();
}

// =====================================================
// 星強化モーダル（設定したスキル1件のみ／コストなし）
// =====================================================
/**
 * フリー専用の星強化モーダルを開きます。
 * クエストの星強化とは独立しており、コストなしで Lv を自由に設定できます。
 * @param {object} opts
 * @param {string|null} [opts.skillId] - 対象スキルID（null の場合は案内のみ表示）
 * @param {number} [opts.level] - 現在のフリー専用レベル（0〜10）
 * @param {(level: number) => void} [opts.onChange] - レベル変更時に呼ばれる
 */
export function openFreeStarUpgradeModal({ skillId = null, level = 0, onChange } = {}) {
  playSE("questmenu");

  const { content } = buildBaseModal({ title: "STAR UPGRADE", boxClass: "quest-modal-starUpgrade" });

  let currentLevel = clampFreeSkillStarLevel(level);

  // --- ヘッダー（固定） ---
  const header = document.createElement("div");
  header.className = "star-upgrade-header";

  const ownedBox = document.createElement("div");
  ownedBox.className = "star-upgrade-owned";
  ownedBox.innerHTML = `
    <span class="star-upgrade-label">FREE SKILL</span>
    <span class="star-upgrade-value">COST FREE</span>
  `;
  header.appendChild(ownedBox);

  const desc = document.createElement("div");
  desc.className = "star-upgrade-desc";
  desc.innerHTML = `
    フリーモード専用の星強化です。クエストの星や星強化データとは関係なく、<b>コストなしで自由に設定</b>できます。<br>
    設定したスキルにのみ反映され、Lv.1ごとにクールダウンが5%短縮されます（最大Lv.${FREE_SKILL_STAR_MAX_LEVEL}・50%短縮）。
  `;
  header.appendChild(desc);
  content.appendChild(header);

  // --- 本体（対象スキル1件） ---
  const list = document.createElement("div");
  list.className = "star-upgrade-list";
  content.appendChild(list);

  const skill = skillId ? ACTIVE_SKILLS?.[skillId] : null;

  if (!skill) {
    const empty = document.createElement("div");
    empty.className = "star-upgrade-desc";
    empty.style.padding = "16px 4px";
    empty.innerHTML = "スキルが選択されていません。<br>先に「SKILL SELECT」でスキルを選択してください。";
    list.appendChild(empty);
    return;
  }

  function render() {
    list.innerHTML = "";

    const factor = getFreeSkillStarTimeFactor(currentLevel);
    const reduction = Math.round((1 - factor) * 100);
    const isMax = currentLevel >= FREE_SKILL_STAR_MAX_LEVEL;
    const isMin = currentLevel <= 0;

    const baseCooldown = typeof skill.cooldown === "number" ? skill.cooldown : null;
    const cooldownHTML = baseCooldown !== null
      ? (currentLevel > 0
        ? `cooldown: ${baseCooldown.toFixed(1)}sec → <span class="star-upgrade-cd-reduced">${(baseCooldown * factor).toFixed(1)}sec</span>`
        : `cooldown: ${baseCooldown.toFixed(1)}sec`)
      : `cooldown: ${skill.cooldown ?? "-"}sec`;

    let progressBlocks = "";
    for (let i = 1; i <= FREE_SKILL_STAR_MAX_LEVEL; i++) {
      progressBlocks += `<div class="star-upgrade-progress-block ${i <= currentLevel ? "filled" : ""}"></div>`;
    }

    const item = document.createElement("div");
    item.className = "star-upgrade-item";

    item.innerHTML = `
      <div class="star-upgrade-item-icon">
        <img src="${images[skill.icon]?.src || ""}" class="star-upgrade-skill-icon">
      </div>
      <div class="star-upgrade-item-info">
        <div class="star-upgrade-item-name">${skill.name}</div>
        <div class="star-upgrade-item-desc">${skill.desc ?? ""}</div>
        <div class="star-upgrade-item-cooldown">${cooldownHTML}</div>
        <div class="star-upgrade-progress">${progressBlocks}</div>
        <div class="star-upgrade-item-stats">
          <span>Lv.${currentLevel}/${FREE_SKILL_STAR_MAX_LEVEL}</span>
          <span>短縮 ${reduction}%</span>
        </div>
      </div>
      <div class="star-upgrade-item-action" style="gap:6px;">
        <button class="star-upgrade-btn ${isMin ? "disabled" : ""}" ${isMin ? "disabled" : ""}>－</button>
        <button class="star-upgrade-btn ${isMax ? "disabled" : ""}" ${isMax ? "disabled" : ""}>＋</button>
      </div>
    `;

    list.appendChild(item);

    const [minusBtn, plusBtn] = item.querySelectorAll(".star-upgrade-btn");

    if (!isMin) {
      minusBtn.onclick = () => {
        currentLevel = clampFreeSkillStarLevel(currentLevel - 1);
        playSE("skill_on");
        render();
        onChange?.(currentLevel);
      };
    }

    if (!isMax) {
      plusBtn.onclick = () => {
        currentLevel = clampFreeSkillStarLevel(currentLevel + 1);
        playSE("skill_on");
        render();
        onChange?.(currentLevel);
      };
    }
  }

  render();
}