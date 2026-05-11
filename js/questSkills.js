//questSkills.js

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
  // スロット系
  // =====================
  slot_1: {
    name: "スキルスロット+1",
    icon: "./assets/pic/skill_1.jpeg",
    desc: "スキルスロットが1増える",
    equipable: false,
  }

};