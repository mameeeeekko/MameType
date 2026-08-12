// starEvaluator.js

// =========================
// 星評価
// =========================

export const STAR_EVALUATORS = {

  // =========================
  // 撃破数ベース
  // =========================
  killCount: (stats, ctx, config) => {
    if (stats.failed) return 0;

    const { thresholds } = config;
    let stars = 0;

    thresholds.forEach((t, i) => {
      if (stats.defeatedCount >= t) stars = i + 1;
    });

    // ★最低保証
    return Math.max(stars, 1);
  },

  // =========================
  // 残り時間ベース
  // =========================
  timeRemaining: (stats, ctx, config) => {
    if (stats.failed) return 0;

    const elapsed = ctx.now - ctx.startTime;
    const total = ctx.stage.endConditions.timerMs;

    if (!total) return 1;

    const remainRate = 1 - (elapsed / total);

    let stars = 0;
    config.thresholds.forEach((t, i) => {
      if (remainRate >= t) stars = i + 1;
    });

    // ★最低保証
    return Math.max(stars, 1);
  },

  // =========================
  // 残りHPベース
  // =========================
  hpRemaining: (stats, ctx, config) => {
    if (stats.failed) return 0;

    const hpRate = ctx.player.hp / ctx.player.maxHp;

    let stars = 0;
    config.thresholds.forEach((t, i) => {
      if (hpRate >= t) stars = i + 1;
    });

    // ★最低保証
    return Math.max(stars, 1);
  },

  // =========================
  // 正確性ベース
  // =========================
  accuracy: (stats, ctx, config) => {
    if (stats.failed) return 0;

    const accuracy = (stats.accuracy ?? 0) / 100; // ← 重要

    let stars = 0;
    config.thresholds.forEach((t, i) => {
        if (accuracy >= t) stars = i + 1;
    });

    return Math.max(stars, 1);
    },

  // =========================
  // ゲーム時間（速さ）ベース
  // =========================
  clearTime: (stats, ctx, config) => {
    if (stats.failed) return 0;

    const elapsed = ctx.now - ctx.startTime;

    let stars = 0;
    config.thresholds.forEach((t, i) => {
        if (elapsed <= t) stars = i + 1; // 短いほど良い
    });

    return Math.max(stars, 1);
    },

  // =========================
  // タイピング速度ベース（KPMなど）
  // =========================
  typingSpeed: (stats, ctx, config) => {
    if (stats.failed) return 0;

    const speed = stats.gKpm ?? 0;

    let stars = 0;
    config.thresholds.forEach((t, i) => {
        if (speed >= t) stars = i + 1;
    });

    return Math.max(stars, 1);
    },

  // =========================
  // 総合評価（正確性 + 時間 + HP）
  // =========================
  composite: (stats, ctx, config) => {
    if (stats.failed) return 0;

    const accuracy = (stats.accuracy ?? 0) / 100; // 0-1
    const hpRate = ctx.player.hp / ctx.player.maxHp; // 0-1
    
    // KPMを評価指標に追加 (300KPMで満点とする)
    const speed = stats.gKpm ?? 0;
    const maxKpmForScore = 300;
    const speedRate = Math.min(speed / maxKpmForScore, 1.0);

    const weights = config.weights || {
        accuracy: 0.4,
        speed: 0.3,
        hp: 0.3
    };

    const score =
        accuracy * weights.accuracy +
        speedRate * weights.speed +
        hpRate * weights.hp;

    let stars = 0;
    config.thresholds.forEach((t, i) => {
        if (score >= t) stars = i + 1;
    });

    return Math.max(stars, 1);
  },

};