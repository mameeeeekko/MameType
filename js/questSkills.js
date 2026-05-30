//questSkills.js
import { killEnemy } from "./enemyCore.js";
import { spawnItemSkillEffect } from "./effectManager.js";


export function getSkillById(skillId) {
  return PASSIVE_SKILLS[skillId] || ACTIVE_SKILLS[skillId];
}

// ===========================================
// アクティブスキル。
//   装備して使う。ゲーム中に発動できる。
//   effectも対応
// ============================================

export function activateSkill(skillId, gameState, enemies = []) {

    const skill = ACTIVE_SKILLS[skillId];
    if (!skill) return;

    // =========================
    // Effect
    // =========================

    if (skill.type === "kill") {

        spawnItemSkillEffect({
            category: "kill",
            source: "skill",

            level:
                skill.value === "all"
                    ? "large"
                    : skill.value >= 5
                        ? "medium"
                        : "small",

            targets:
                enemies.filter(
                    e => e && !e.isDead && !e.isItem
                )
        });
    }

    else if (skill.type === "heal") {

        spawnItemSkillEffect({

            category: "heal",
            source: "skill",

            level:
                skill.value >= 50
                    ? "large"
                    : "medium",

            x: gameState.player.x,
            y: gameState.player.y
        });
    }

    else if (skill.type === "freeze") {

        spawnItemSkillEffect({

            category: "freeze",
            source: "skill",

            level:
                skill.value >= 5
                    ? "large"
                    : "medium",

            targets:
                enemies.filter(
                    e => e && !e.isDead && !e.isItem
                )
        });
    }

    // =========================
    // Skill
    // =========================

    const handler = SKILL_HANDLERS[skill.type];
    if (!handler) return;

    handler(skill.value, gameState, enemies);
}

// ===========================================
// アクティブスキルtype別発動関数
// ============================================

const SKILL_HANDLERS = {

  heal: (value, state) => {
    const player = state.player;

    if (!player) return;

    player.hp = Math.min(
      player.maxHp,
      player.hp + value
    );
  },

  freeze: (value, state) => {
    state.enemyStats.freezeTimer = value;
  },

  kill: (value, state, enemiesList = []) => {

    const aliveEnemies =
      enemiesList.filter(e => e && !e.isDead && !e.isItem);

    if (aliveEnemies.length === 0) return;

    const mode = value.mode;
    const count = value.count ?? 1;

    // =========================
    // 全滅
    // =========================
    if (mode === "all") {

      aliveEnemies.forEach(enemy => {
        killEnemy(enemy, state, {
          fromSkill: true
        });
      });

      return;
    }

    // =========================
    // ランダム
    // =========================
    if (mode === "random") {

      const shuffled = [...aliveEnemies]
        .sort(() => Math.random() - 0.5);

      shuffled
        .slice(0, count)
        .forEach(enemy => {
          killEnemy(enemy, state, {
            fromSkill: true
          });
        });

      return;
    }

    // =========================
    // 最寄り順
    // =========================
    if (mode === "nearest") {

      const sorted = [...aliveEnemies].sort((a, b) => {

        const dx1 = a.x - state.player.x;
        const dy1 = a.y - state.player.y;

        const dx2 = b.x - state.player.x;
        const dy2 = b.y - state.player.y;

        return (dx1*dx1 + dy1*dy1)
            - (dx2*dx2 + dy2*dy2);
      });

      sorted
        .slice(0, count)
        .forEach(enemy => {
          killEnemy(enemy, state, {
            fromSkill: true
          });
        });

      return;
    }
  },
};


// ===========================================
// 常時発動スキル。
//   装備して使うものと、自動スキルあり。
//   自動スキルはequipableをfalse
// ============================================

export const PASSIVE_SKILLS = {

  // =====================
  // チェイン系
  // =====================
  chain_up_1: {
    name: "チェイン増強強化Ⅰ",
    icon: "./assets/pic/chain_up.jpeg",
    desc: "チェイン倍率が10%上昇",
    equipable: true,
    apply: (p) => {
      p.chainRate *= 1.1;
    }
  },

  chain_decay_1: {
    name: "チェイン維持強化Ⅰ",
    icon: "⏳",
    desc: "チェイン減衰が10%緩和",
    equipable: true,
    apply: (p) => {
      p.chainDecayRate *= 0.9;
    }
  },

  chain_bonus_1: {
    name: "チェインボーナスⅠ",
    icon: "./assets/pic/chain_bonus.jpeg",
    desc: "チェインボーナスが10%上昇",
    equipable: true,
    apply: (p) => {
      p.chainBonus *= 1.1;
    }
  },

  glass_chain_1: {
    name: "極限集中",
    icon: "🧠",
    desc: "チェイン倍率+20% / 切れやすさ+10%",
    equipable: true,
    apply: (s) => {
      s.chainRate *= 1.2;
      s.chainDecayRate *= 1.1;
    }
  },

  // =====================
  // ノックバック系
  // =====================
  kb_up_1: {
    name: "ノックバック強化Ⅰ",
    icon: "👊",
    desc: "ノックバック性能が20%上昇",
    equipable: true,
    apply: (p) => {
      p.knockbackBonus *= 1.2;
    }
  },

  // =====================
  // 自動効果系
  // =====================
  slot_1: {
    name: "スキルスロット+1",
    icon: "./assets/pic/skill_1.jpeg",
    desc: "スキルスロットが1増える",
    equipable: false,
  },

  skill_stock_1: {
    name: "アクティブスキルストック+1",
    icon: "./assets/pic/skill_1.jpeg",
    desc: "アクティブスキルのストックが1増える",
    equipable: false,
  }

};


// ===========================================
// アクティブスキル
/* ===========================================
  kill_nearest: 
    name: "処刑",
    icon: "./assets/pic/chain_up.jpeg",
    desc: "最も近い敵を撃破",
    cooldown: 10, //sec
    type: "kill" or "heal" or "freeze"
    
    //killの場合 (kill以外の場合はvalueのみ)
    value: 
      mode: "random" or  "nearest" of "all"
      count: 2, //allの場合は記載しない。
*/
// ============================================

export const ACTIVE_SKILLS = {

  heal_small: {
    name: "リカバー",
    icon: "💚",
    desc: "HPを回復",
    cooldown: 30, //sec
    type: "heal",
    value: 30,
  },

  freeze_3: {
    name: "フリーズ",
    icon: "❄️",
    desc: "敵を一定時間停止",
    cooldown: 36,
    type: "freeze",
    value: 5, // seconds
  },

  kill_nearest: {
    name: "処刑",
    icon: "./assets/pic/chain_up.jpeg",
    desc: "最も近い敵を撃破",
    cooldown: 10,
    type: "kill",
    value: {
      mode: "all",
      //count: 2,
    }
  }
};

