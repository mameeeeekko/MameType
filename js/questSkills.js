//questSkills.js
import { killEnemy } from "./enemyCore.js";
import { spawnItemSkillEffect } from "./effectManager.js";


export function getSkillById(skillId) {
  return PASSIVE_SKILLS[skillId] || ACTIVE_SKILLS[skillId];
}

// アクティブスキル。
//   装備して使う。ゲーム中に発動できる。
//   effectも対応
// ============================================

export function activateSkill(skillId, gameState, enemies = []) {

    const skill = ACTIVE_SKILLS[skillId];
    if (!skill) return;

    const player = gameState.player;

    // ★安全ガード（重要）
    if (!player) {
        console.error("[activateSkill] player is undefined in gameState");
        return;
    }

    // =========================
    // Effect
    // =========================

    if (skill.type === "heal") {

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
                    e => e && !e.isDead && !e.isItem && !e.type?.id?.includes("boss")
                )
        });
    }

    else if (skill.type === "knockback") {

        spawnItemSkillEffect({

            category: "knockback",
            source: "skill",

            level: "large",

            x: gameState.player.x,
            y: gameState.player.y
        });
    }

    else if (skill.type === "invincible") {

        spawnItemSkillEffect({
            category: "invincible",
            source: "skill",
            level:
                skillId.includes("short") ? "small" :
                skillId.includes("medium") ? "medium" :
                "large",

            x: player.x,
            y: player.y,

            value: skill.value // ← 秒そのまま渡す（ms変換は内部でやる想定）
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

  freeze: (value, state, enemiesList = []) => {
      //表示している敵と弾丸が止まる
      const targets = [
          ...enemiesList.filter(
              e => e && !e.isDead && !e.isItem
          ),
          ...(state.enemyBullets || []).filter(
              b => b && !b.isDead
          )
      ];

      targets.forEach(target => {
          target.freezeTimer = Math.max(
              target.freezeTimer || 0,
              value
          );
      });
  },

  kill: (value, state, enemiesList = []) => {

    const aliveEnemies =
        enemiesList.filter(
            e => e && !e.isDead && !e.isItem && !e.type?.id?.includes("boss")
        );

    if (aliveEnemies.length === 0) return;

    let targets = [];

    if (value.mode === "all") {

        targets = aliveEnemies;

    } else if (value.mode === "random") {

        targets = [...aliveEnemies]
            .sort(() => Math.random() - 0.5)
            .slice(0, value.count);

    } else if (value.mode === "nearest") {

        targets = [...aliveEnemies]
            .sort((a, b) => {

                const da =
                    (a.x - state.player.x) ** 2 +
                    (a.y - state.player.y) ** 2;

                const db =
                    (b.x - state.player.x) ** 2 +
                    (b.y - state.player.y) ** 2;

                return da - db;
            })
            .slice(0, value.count);
    }

    // 演出は対象だけ
    spawnItemSkillEffect({
        category: "kill",
        source: "skill",
        level:
            targets.length >= 10
                ? "large"
                : targets.length >= 5
                    ? "medium"
                    : "small",
        targets
    });

    targets.forEach(enemy => {
        killEnemy(enemy, state, {
            fromSkill: true
        });
    });
  },
};

  // ノックバック (画面端まで押し出す) と無敵系ハンドラを追加
  SKILL_HANDLERS.knockback = (value, state, enemiesList = []) => {
    const targets = enemiesList.filter(e => e && !e.isDead && !e.isItem);
    if (!targets.length) return;

    const canvasEl = document.getElementById("enemyModeCanvas");
    const rect = canvasEl ? canvasEl.getBoundingClientRect() : { width: 800, height: 600 };
    const cw = rect.width, ch = rect.height;

    targets.forEach(t => {

        const dx = t.x - state.player.x;
        const dy = t.y - state.player.y;

        const size =
            t.type?.size ||
            t.radius ||
            15;

        let targetX = t.x;
        let targetY = t.y;

        if (Math.abs(dx) >= Math.abs(dy)) {

            targetX =
                dx > 0
                    ? cw - size - 10
                    : size + 10;

        } else {

            targetY =
                dy > 0
                    ? ch - size - 10
                    : size + 10;
        }

        // 衝撃波より少し遅れて飛ばす
        t.knockbackDelay = 8;

        t.knockbackStartX = t.x;
        t.knockbackStartY = t.y;

        t.knockbackTargetX = targetX;
        t.knockbackTargetY = targetY;

        t.knockbackTime = 0;
        t.knockbackDuration = 18;
    });
  };

  SKILL_HANDLERS.invincible = (value, state) => {
    if (!state.player) return;
    state.player.invincibleTimer = Math.max(state.player.invincibleTimer || 0, value);
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
    icon: "chain_up_1",
    desc: "チェイン増加が10%上昇",
    equipable: true,
    apply: (p) => {
      p.chainRate = (p.chainRate || 1) + 0.10;
    }
  },

  chain_up_2: {
    name: "チェイン増強強化Ⅱ",
    icon: "chain_up_2",
    desc: "チェイン増加が15%上昇",
    equipable: true,
    apply: (p) => {
      p.chainRate = (p.chainRate || 1) + 0.15;
    }
  },

  chain_up_3: {
    name: "チェイン増強強化Ⅲ",
    icon: "chain_up_3",
    desc: "チェイン増加が20%上昇",
    equipable: true,
    apply: (p) => {
      p.chainRate = (p.chainRate || 1) + 0.20;
    }
  },

  chain_up_4: {
    name: "チェイン増強強化Ⅳ",
    icon: "chain_up_4",
    desc: "チェイン増加が25%上昇",
    equipable: true,
    apply: (p) => {
      p.chainRate = (p.chainRate || 1) + 0.25;
    }
  },

  chain_decay_1: {
    name: "チェイン維持強化Ⅰ",
    icon: "chain_decay_1",
    desc: "チェイン減衰が10%緩和",
    equipable: true,
    apply: (p) => {
      p.chainDecayRate = (p.chainDecayRate || 1) - 0.10;
    }
  },

  chain_decay_2: {
    name: "チェイン維持強化Ⅱ",
    icon: "chain_decay_2",
    desc: "チェイン減衰が15%緩和",
    equipable: true,
    apply: (p) => {
      p.chainDecayRate = (p.chainDecayRate || 1) - 0.15;
    }
  },

  chain_decay_3: {
    name: "チェイン維持強化Ⅲ",
    icon: "chain_decay_3",
    desc: "チェイン減衰が20%緩和",
    equipable: true,
    apply: (p) => {
      p.chainDecayRate = (p.chainDecayRate || 1) - 0.20;
    }
  },

  chain_decay_4: {
    name: "チェイン維持強化Ⅳ",
    icon: "chain_decay_4",
    desc: "チェイン減衰が25%緩和",
    equipable: true,
    apply: (p) => {
      p.chainDecayRate = (p.chainDecayRate || 1) - 0.25;
    }
  },

  chain_bonus_1: {
    name: "チェインボーナスⅠ",
    icon: "chain_bonus_1",
    desc: "チェインボーナスが10%上昇",
    equipable: true,
    apply: (p) => {
      p.chainBonus = (p.chainBonus || 1) + 0.10;
    }
  },

  chain_bonus_2: {
    name: "チェインボーナスⅡ",
    icon: "chain_bonus_2",
    desc: "チェインボーナスが15%上昇",
    equipable: true,
    apply: (p) => {
      p.chainBonus = (p.chainBonus || 1) + 0.15;
    }
  },

  chain_bonus_3: {
    name: "チェインボーナスⅢ",
    icon: "chain_bonus_3",
    desc: "チェインボーナスが20%上昇",
    equipable: true,
    apply: (p) => {
      p.chainBonus = (p.chainBonus || 1) + 0.20;
    }
  },

  chain_bonus_4: {
    name: "チェインボーナスⅣ",
    icon: "chain_bonus_4",
    desc: "チェインボーナスが25%上昇",
    equipable: true,
    apply: (p) => {
      p.chainBonus = (p.chainBonus || 1) + 0.25;
    }
  },

  glass_chain_1: {
    name: "極限集中",
    icon: "glass_1",
    desc: "チェイン倍率+15% / 切れやすさ+5%",
    equipable: true,
    apply: (s) => {
      s.chainRate = (s.chainRate || 1) + 0.15;
      s.chainDecayRate = (s.chainDecayRate || 1) + 0.05;
    }
  },

  glass_chain_2: {
    name: "極限集中Ⅱ",
    icon: "glass_2",
    desc: "チェイン倍率+25% / 切れやすさ+10%",
    equipable: true,
    apply: (s) => {
      s.chainRate = (s.chainRate || 1) + 0.25;
      s.chainDecayRate = (s.chainDecayRate || 1) + 0.10;
    }
  },

  glass_chain_3: {
    name: "極限集中Ⅲ",
    icon: "glass_3",
    desc: "チェイン倍率+35% / 切れやすさ+15%",
    equipable: true,
    apply: (s) => {
      s.chainRate = (s.chainRate || 1) + 0.35;
      s.chainDecayRate = (s.chainDecayRate || 1) + 0.15;
    }
  },

  glass_chain_4: {
    name: "極限集中Ⅳ",
    icon: "glass_4",
    desc: "チェイン倍率+45% / 切れやすさ+20%",
    equipable: true,
    apply: (s) => {
      s.chainRate = (s.chainRate || 1) + 0.45;
      s.chainDecayRate = (s.chainDecayRate || 1) + 0.20;
    }
  },

  // =====================
  // ノックバック系
  // =====================
  kb_up_1: {
    name: "ノックバック強化Ⅰ",
    icon: "kb_1",
    desc: "ノックバック性能が15%上昇",
    equipable: true,
    apply: (p) => {
      p.knockbackBonus = (p.knockbackBonus || 1) + 0.15;
    }
  },

  kb_up_2: {
    name: "ノックバック強化Ⅱ",
    icon: "kb_2",
    desc: "ノックバック性能が25%上昇",
    equipable: true,
    apply: (p) => {
      p.knockbackBonus = (p.knockbackBonus || 1) + 0.25;
    }
  },

  kb_up_3: {
    name: "ノックバック強化Ⅲ",
    icon: "kb_3",
    desc: "ノックバック性能が35%上昇",
    equipable: true,
    apply: (p) => {
      p.knockbackBonus = (p.knockbackBonus || 1) + 0.35;
    }
  },

  kb_up_4: {
    name: "ノックバック強化Ⅳ",
    icon: "kb_4",
    desc: "ノックバック性能が45%上昇",
    equipable: true,
    apply: (p) => {
      p.knockbackBonus = (p.knockbackBonus || 1) + 0.45;
    }
  },

  // =====================
  // status up系
  // =====================
  max_hp_1: {
    name: "体力増強Ⅰ",
    icon: "hpup_1",
    desc: "最大HPが10増加",
    equipable: true,
    apply: (p) => {
      p.maxHp = (p.maxHp || 0) + 10;
    }
  },
   max_hp_2: {
    name: "体力増強Ⅱ",
    icon: "hpup_2",
    desc: "最大HPが50増加",
    equipable: true,
    apply: (p) => {
      p.maxHp = (p.maxHp || 0) + 50;
    }
  },
   max_hp_3: {
    name: "体力増強Ⅲ",
    icon: "hpup_3",
    desc: "最大HPが100増加",
    equipable: true,
    apply: (p) => {
      p.maxHp = (p.maxHp || 0) + 100;
    }
  },

  defense_up_1: {
    name: "防御強化Ⅰ",
    icon: "defup_1",
    desc: "防御が5増加（最大99）",
    equipable: true,
    apply: (p) => {
      p.defense = Math.min(99, (p.defense || 0) + 5);
    }
  },

  defense_up_2: {
    name: "防御強化Ⅱ",
    icon: "defup_2",
    desc: "防御が10増加（最大99）",
    equipable: true,
    apply: (p) => {
      p.defense = Math.min(99, (p.defense || 0) + 10);
    }
  },

  defense_up_3: {
    name: "防御強化Ⅲ",
    icon: "defup_3",
    desc: "防御が15増加（最大99）",
    equipable: true,
    apply: (p) => {
      p.defense = Math.min(99, (p.defense || 0) + 15);
    }
  },

  // =====================
  // 経験値ボーナス（パッシブ、重ねがけ対応）
  // 合計すると +100% (x2) になるよう additive に設定
  // =====================
  exp_up_1: {
    name: "経験値増加Ⅰ",
    icon: "expup_1",
    desc: "獲得経験値が20%上昇",
    equipable: true,
    apply: (p) => {
      p.expMultiplier = (p.expMultiplier || 1) + 0.20; // x1.2
    }
  },

  exp_up_2: {
    name: "経験値増加Ⅱ",
    icon: "expup_2",
    desc: "獲得経験値が30%上昇",
    equipable: true,
    apply: (p) => {
      p.expMultiplier = (p.expMultiplier || 1) + 0.30; // x1.3
    }
  },

  exp_up_3: {
    name: "経験値増加Ⅲ",
    icon: "expup_3",
    desc: "獲得経験値が50%上昇",
    equipable: true,
    apply: (p) => {
      p.expMultiplier = (p.expMultiplier || 1) + 0.50; // x1.5
    }
  },

  // =====================
  // 自動効果系
  // =====================
  // アイテム出現率アップ
  item_spawn_1: {
    name: "アイテム出現率アップⅠ",
    icon: "item_1",
    desc: "アイテム出現率が20%上昇",
    equipable: true,
    apply: (p) => {
      p.itemSpawnMultiplier = (p.itemSpawnMultiplier || 1) + 0.20;
    }
  },

  item_spawn_2: {
    name: "アイテム出現率アップⅡ",
    icon: "item_2",
    desc: "アイテム出現率が25%上昇",
    equipable: true,
    apply: (p) => {
      p.itemSpawnMultiplier = (p.itemSpawnMultiplier || 1) + 0.25;
    }
  },

  item_spawn_3: {
    name: "アイテム出現率アップⅢ",
    icon: "item_3",
    desc: "アイテム出現率が30%上昇",
    equipable: true,
    apply: (p) => {
      p.itemSpawnMultiplier = (p.itemSpawnMultiplier || 1) + 0.30;
    }
  },

  // 一定確率でダメージ無効化 boss接触無効
  damage_negate_1: {
    name: "ダメージ無効化Ⅰ",
    icon: "negate_1",
    desc: "攻撃を10%の確率で無効化",
    equipable: true,
    apply: (p) => {
      p.damageNegateChance = (p.damageNegateChance || 0) + 0.10;
    }
  },

  damage_negate_2: {
    name: "ダメージ無効化Ⅱ",
    icon: "negate_2",
    desc: "攻撃を13%の確率で無効化",
    equipable: true,
    apply: (p) => {
      p.damageNegateChance = (p.damageNegateChance || 0) + 0.13;
    }
  },

  damage_negate_3: {
    name: "ダメージ無効化Ⅲ",
    icon: "negate_3",
    desc: "攻撃を16%の確率で無効化",
    equipable: true,
    apply: (p) => {
      p.damageNegateChance = (p.damageNegateChance || 0) + 0.16;
    }
  },

  // 一度だけ復活（確率）
  revive_once_1: {
    name: "一度だけ復活Ⅰ",
    icon: "revive_1",
    desc: "死亡時に20%の確率で一度だけ復活",
    equipable: true,
    apply: (p) => {
      p.reviveChance = (p.reviveChance || 0) + 0.20;
    }
  },

  revive_once_2: {
    name: "一度だけ復活Ⅱ",
    icon: "revive_2",
    desc: "死亡時に30%の確率で一度だけ復活",
    equipable: true,
    apply: (p) => {
      p.reviveChance = (p.reviveChance || 0) + 0.30;
    }
  },

  revive_once_3: {
    name: "一度だけ復活Ⅲ",
    icon: "revive_3",
    desc: "死亡時に40%の確率で一度だけ復活",
    equipable: true,
    apply: (p) => {
      p.reviveChance = (p.reviveChance || 0) + 0.40;
    }
  },
  
  slot_1: {
    name: "スキルスロット+1",
    icon: "skillslot_1",
    desc: "スキルスロットが1増える",
    equipable: false,
  },

  skill_stock_1: {
    name: "アクティブスキルストック+1",
    icon: "stock_1",
    desc: "アクティブスキルのストックが1増える",
    equipable: false,
  },

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
    icon: "recover_1",
    desc: "HPを小回復",
    cooldown: 60, //sec
    type: "heal",
    value: 30,
  },

  heal_medium: {
    name: "リカバー",
    icon: "recover_2",
    desc: "HPを中回復",
    cooldown: 120, //sec
    type: "heal",
    value: 60,
  },

  heal_high: {
    name: "リカバー",
    icon: "recover_3",
  desc: "HPを大回復",
    cooldown: 180, //sec
    type: "heal",
    value: 100,
  },
  
  //freeze 
  freeze_light: {
    name: "フリーズ3",
    icon: "freeze_1",
    desc: "敵を一定時間停止",
    cooldown: 60,
    type: "freeze",
    value: 3, // seconds
  },

  freeze_medium: {
    name: "フリーズ5",
    icon: "freeze_2",
    desc: "敵を一定時間停止",
    cooldown: 120,
    type: "freeze",
    value: 5, // seconds
  },

  freeze_heavy: {
    name: "フリーズ8",
    icon: "freeze_3",
    desc: "敵を一定時間停止",
    cooldown: 180,
    type: "freeze",
    value: 8, // seconds
  },


  kill_nearest: {
    name: "処刑",
    icon: "kill_1",
    desc: "最も近い敵を2体撃破",
    cooldown: 80, //80
    type: "kill",
    value: {
      mode: "nearest",
      count: 2,
    }
  },

  kill_random: {
    name: "処刑",
    icon: "kill_random",
    desc: "ランダムで敵を4体撃破",
    cooldown: 160, //160
    type: "kill",
    value: {
      mode: "random",
      count: 4,
    }
  },

  kill_nearest_h: {
    name: "処刑",
    icon: "kill_near",
    desc: "最も近い敵を4体撃破",
    cooldown: 200, //200
    type: "kill",
    value: {
      mode: "nearest",
      count: 4,
    }
  }

  ,kill_all: {
    name: "処刑",
    icon: "kill_all",
    desc: "すべての敵を撃破",
    cooldown: 300,
    type: "kill",
    value: {
      mode: "all",
    }
  },

  // ノックバック：敵を画面端まで押し出す
  knockback_edge: {
    name: "エッジノックバック",
    icon: "knockback",
    desc: "画面端まで敵をノックバックさせる",
    cooldown: 200, //200
    type: "knockback",
    value: {
      mode: "edge"
    }
  },

  // 無敵（短時間）
  invincible_short: {
    name: "バリア（短）",
    icon: "guard_1",
    desc: "一定時間無敵になる（短）",
    cooldown: 120, //120
    type: "invincible",
    value: 3
  },

  invincible_medium: {
    name: "バリア（中）",
    icon: "guard_2",
    desc: "一定時間無敵になる（中）",
    cooldown: 180,
    type: "invincible",
    value: 5
  },

  invincible_long: {
    name: "バリア（長）",
    icon: "guard_3",
    desc: "一定時間無敵になる（長）",
    cooldown: 240,//240
    type: "invincible",
    value: 8
  }

};
