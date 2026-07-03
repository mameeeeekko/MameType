// resultView.js
import { renderOnlineRanking } from "../online/getRanking.js";


// ======================================
// 結果画面表示専用
// ======================================
export function resetResultButtons(mode, options = {}) {
  const ids = [
    "playAgainBtn",
    "retryMissedBtn",
    "resultToQuestMenuBtn",
    "questBackBtn",
    "resultOpenRecordsBtn",
    "resultToStartMenuBtn",
    "resultBackBtn"
  ];

  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.style.display = "inline-block";
      el.classList.add("result-btn"); // ボタンのスタイルを統一
    }
  });

  const isEnemy = mode === "enemy_mode";
  const isLongText = mode === "long_text";
  const hasMissed = (options.missedCount ?? 0) > 0;

  // デイリー/フリーモードのリザルトではクエスト関連ボタンは常に非表示
  const toQuest = document.getElementById("resultToQuestMenuBtn");
  const toQuestMap = document.getElementById("questBackBtn");
  if (toQuest) toQuest.style.display = "none";
  if (toQuestMap) toQuestMap.style.display = "none";

  // ミス練習ボタンの表示制御
  const retryBtn = document.getElementById("retryMissedBtn");
  if (retryBtn) {
    if (isEnemy || isLongText || !hasMissed) {
      retryBtn.style.display = "none";
    }
  }

  // ボタンコンテナを取得して横並びクラスを適用
  const btnContainer = document.querySelector(".result-buttons");
  if (btnContainer) {
    btnContainer.classList.add("menu-btn-container");
  }
}

const dom = {
  resultStats: () => document.getElementById("resultStats"),
  game: () => document.getElementById("game"),
  result: () => document.getElementById("result"),
  showQuest: () => document.getElementById("resultToQuestMenuBtn"),
  showMap: () => document.getElementById("questBackBtn"),
};

export function showResult({
  totalCorrect,
  totalMistake,
  totalTime,
  solvedCount,
  isTimeUp,
  mode,
  totalKpm,
  eScore,
  eRank,
  accuracy,
  isNewRecord = false,
  isRankIn = false,
  rankPos = null,
  isFreeMode = false
}) {

  resetResultButtons(mode, { missedCount: totalMistake });

  // ★「記録を見る」ボタンに現在のモードIDを保存する
  const resultOpenRecordsBtn = document.getElementById("resultOpenRecordsBtn");
  if (resultOpenRecordsBtn) {
    resultOpenRecordsBtn.dataset.modeId = mode;
  }

  const resultStats = dom.resultStats();
  if (!resultStats) return;

  let modeTitle = "RESULT";
  if (mode === "normal") modeTitle = "STANDARD";
  else if (mode === "time_attack") modeTitle = "TIME ATTACK";
  else if (mode === "long_text") modeTitle = "LONG TEXT";
  else if (mode === "miss_practice") modeTitle = "MISS PRACTICE";

  const totalInputs = totalCorrect + totalMistake;
  const accuracyText = totalInputs === 0 ? "―" : `${accuracy}%`;
  const kpmText = totalInputs === 0 ? "―" : totalKpm;
  const solvedText = solvedCount ?? 0;

  let html = `<div class="result-container-centered wider menu-style-card">`;
  html += `
    ${isFreeMode ? `<div class="result-free-badge">FREE</div>` : ""}
    <div class="result-title-main">${modeTitle.toUpperCase()}</div>
  `;

  if (mode === "time_attack") {
    html += `
      <div class="result-header-row">
        <div class="result-header-item">
          <div class="r-label">SOLVED</div>
          <div class="r-value big">${solvedText}</div>
        </div>
        <div class="result-header-item">
          <div class="r-label">eScore / RANK</div>
          <div class="r-value">${eScore} <span class="rank-unit">/ ${eRank}</span></div>
        </div>
      </div>
    `;
  } else {
    html += `
      <div class="result-header-row">
        <div class="result-header-item">
          <div class="r-label">eScore</div>
          <div class="r-value big">${eScore}</div>
        </div>
        <div class="result-header-item">
          <div class="r-label">RANK</div>
          <div class="r-value big accent">${eRank}</div>
        </div>
      </div>
    `;
  }

  html += `
  <div class="result-stats-grid">
    <div class="r-row"><span class="result-label">Accuracy</span><span class="result-value">${accuracyText}</span></div>
    <div class="r-row"><span class="result-label">KPM</span><span class="result-value">${kpmText}</span></div>
    <div class="r-row"><span class="result-label">Misses</span><span class="result-value">${totalMistake}</span></div>
    <div class="r-row"><span class="result-label">Time</span><span class="result-value">${Math.round(totalTime)}s</span></div>
  </div>

  <div class="result-badges">
    ${isTimeUp ? `<div class="r-badge timeup">時間切れ</div>` : ""}
    ${isNewRecord ? `<div class="r-badge new">NEW RECORD</div>` : ""}
    ${isRankIn ? `<div class="r-badge rank">RANK IN ${rankPos ? rankPos+"位" : ""}</div>` : ""}
  </div>

  <div id="onlineRanking" class="result-online-ranking"></div>
  `;
  html += `</div>`; // .result-container-centered の閉じ

  resultStats.innerHTML = html;

  const gameDiv = dom.game();
  const resultDiv = dom.result();

  if (gameDiv) gameDiv.style.display = "none";
  if (resultDiv) resultDiv.style.display = "flex";

  // ★ここを遅延させる
  requestAnimationFrame(() => {
    const onlineRankingEl = document.getElementById("onlineRanking");

    if (!navigator.onLine) {
      if (onlineRankingEl) {
        onlineRankingEl.innerHTML = `<div class="ranking-disabled">ネットワークに接続されていません</div>`;
      }
      return;
    }

    if (!isFreeMode) {
      renderOnlineRanking(eScore, solvedCount, mode);
    } else {
      if (onlineRankingEl) onlineRankingEl.innerHTML = "";
    }
  });
}