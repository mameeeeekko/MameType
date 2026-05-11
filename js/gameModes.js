// gameModes.js
import { getDifficulty } from "./difficulties.js";

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



export const GameModes = {
  NORMAL: {
    id: "normal",
    name: "通常モード",
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

      const filtered = filterByDifficulty(TARGETS, modeData.difficulty);
      let shuffled = shuffleArray(filtered);

      const limit = modeData.fixedQuestionLimit;

      // 足りなければ補充
      if (shuffled.length < limit) {
        const extra = shuffleArray(TARGETS);
        shuffled = shuffled.concat(extra);
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
      const filtered = filterByDifficulty(TARGETS, modeData.difficulty);
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
    const filtered = filterByDifficulty(TARGETS_LONG, modeData.difficulty);
    const shuffled = shuffleArray(filtered);
    return shuffled.slice(0, modeData.questionLimit);
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
  }

};
