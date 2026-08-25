// gameModes.js
import { getDifficulty } from "./difficulties.js";
import { getWord } from "./target.js";
import { QUEST_MAP } from "./questMap.js"; export { QUEST_MAP };

// 難易度==========================================
function filterByDifficulty(targets, difficultyId) {
  const diff = getDifficulty(difficultyId);

  // typingが無い場合の保険
  if (!diff.basic) return targets;

  return targets.filter(t => {
    const len = t.text.length;
    return len >= diff.basic.min && len <= diff.basic.max;
  });
}

function filterByTags(targets, tags = []) {

  if (!tags.length) {
    return targets;
  }

  if (tags.includes("empty")) {
    return targets.filter(t => {
      const targetTags = t.tags || [];
      return targetTags.length === 0;
    });
  }

  return targets.filter(t => {
    const targetTags = t.tags || [];

    // 長文モードの場合（tagsに"長文"が含まれる）はAND条件
    if (tags.includes("長文")) {
      // 指定されたすべてのタグがターゲットに含まれているかチェック
      return tags.every(tag => targetTags.includes(tag));
    } else {
      // それ以外のモードではOR条件
      // 指定されたタグのいずれかがターゲットに含まれているかチェック
      return tags.some(tag => targetTags.includes(tag));
    }
  });
}

export const GameModes = {
  NORMAL: {
    id: "normal",
    name: "通常モード",
    bgm: "bgm_rainy",
    description: "決められた問題数をクリアするモード",

    onStart(state) {
      const custom = state.modeData.custom;

      state.modeData.questionLimit =
        custom?.questionLimit ?? 2;

      state.modeData.fixedQuestionLimit = state.modeData.questionLimit;
    },

    shouldContinue(state) {
      return state.currentIndex < state.modeData.fixedQuestionLimit;
    },

    isFinished(state) {
      return state.currentIndex >= state.modeData.questionLimit;
    },

    // ★ 出題リストを決める責務もここへ
    buildTargets({ TARGETS, shuffleArray, modeData }) {

      const tags = modeData.custom?.tags || [];

      let filtered = filterByDifficulty(
        TARGETS,
        modeData.difficulty
      );

      filtered = filterByTags(filtered, tags);

      let shuffled = shuffleArray(filtered);

      const limit = modeData.fixedQuestionLimit;

      if (shuffled.length < limit) {
        shuffled = shuffleArray(filtered);
      }

      return shuffled.slice(0, limit);
    },

    buildResultExtra(state) {
      return {
        mode: "normal",
        questionLimit: state.modeData.questionLimit
      };
    }
  },

  TIME_ATTACK: {
    id: "time_attack",
    name: "タイムトライアル",
    bgm: "bgm_gameover",

    LIMIT_SEC: 15,

    onStart(state) {
      const custom = state.modeData.custom;

      state.modeData.limitSec =
        custom?.limitSec ?? GameModes.TIME_ATTACK.LIMIT_SEC;

      state.modeData.startTime = performance.now();
    },

    shouldContinue(state) {
      const elapsed = (performance.now() - state.modeData.startTime) / 1000;
      return elapsed < state.modeData.limitSec;
    },

    isFinished(state) {
      const elapsed = (performance.now() - state.modeData.startTime) / 1000;
      return elapsed >= state.modeData.limitSec;
    },

    buildTargets({ TARGETS, shuffleArray, modeData }) {

      const tags = modeData.custom?.tags || [];

      let filtered = filterByDifficulty(
        TARGETS,
        modeData.difficulty
      );

      filtered = filterByTags(filtered, tags);

      return shuffleArray(filtered);
    },

    buildResultExtra(state) {
      return {
        mode: "time_attack",
        limitSec: state.modeData.limitSec
      };
    }
  },

LONG_TEXT: {
  id: "long_text",
  name: "長文問題",
  bgm: "bgm_yakanhikou",

  onStart(state) {
    state.modeData.questionLimit = 1;
  },

  shouldContinue(state) {
    return state.currentIndex < state.modeData.questionLimit;
  },

  isFinished(state) {
    return state.currentIndex >= state.modeData.questionLimit;
  },

  buildTargets({ TARGETS_LONG, modeData, shuffleArray }) {

    const tags = modeData.custom?.tags || [];
    let filtered = TARGETS_LONG;

    filtered = filterByTags(filtered, tags);

    const shuffled = shuffleArray(filtered);

    return shuffled.slice(
      0,
      modeData.questionLimit
    );
  },

  buildResultExtra(state) {
    return {
      mode: "long_text",
      questionLimit: state.modeData.questionLimit,
      difficulty: state.modeData.difficulty
    };
  }
},

  MISS_PRACTICE: {
    id: "miss_practice",
    name: "間違い練習モード",
    bgm: "bgm_yellow",

    onStart(state) {},

    shouldContinue(state) {
      return state.currentIndex < state.shuffledTargets.length;
    },

    isFinished(state) {
      return state.currentIndex >= state.shuffledTargets.length;
    },

    buildTargets({ practiceTargets }) {
      return practiceTargets.slice();
    },

    buildResultExtra() {
      return { mode: "miss_practice" };
    }
  },

  ENEMY_MODE: {
    id: "enemy_mode",
    name: "Enemyモード",
  },

  DEFENSE_MODE: {
    id: "defense_mode",
    name: "防衛戦モード",
    bgm: "bgm_dive", 
    saveToStats: true, // ★記録保存対象
    description: "コアを侵食から守り切れ！",

    onStart(state) {
      const custom = state.modeData.custom;
      // 防衛戦モード用の設定
      state.modeData.totalCharsToType = custom?.totalCharsToType ?? 300;
      state.modeData.timeLimitSec = custom?.timeLimitSec ?? 120;
      state.modeData.missPenaltySec = custom?.missPenaltySec ?? 1.5;
    },

    // このモードでは常に1問なので、常にfalseを返す
    shouldContinue(state) {
      return false;
    },

    isFinished(state) {
      // 終了判定はenemyCore.jsのループに委ねる
      return false;
    },

    buildResultExtra(state) {
      return { mode: "defense_mode" };
    }
  }

};
