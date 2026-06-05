// resultView.js
import { renderOnlineRanking } from "../online/getRanking.js";


// ======================================
// 結果画面表示専用
// ======================================
export function resetResultButtons() {
  const ids = [
    "playAgainBtn",
    "retryMissedBtn",
    "resultToQuestMenuBtn",
    "questBackBtn",
    "resultOpenRecordsBtn",
    "resultToStartMenuBtn",
    "resultBackBtn" // ←これ重要
  ];

  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "";
  });
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

  resetResultButtons();

  const resultStats = dom.resultStats();
  if (!resultStats) return;

  let modeTitle = "RESULT";
  if (mode === "normal") modeTitle = "スタンダード";
  else if (mode === "time_attack") modeTitle = "タイムアタック";
  else if (mode === "long_text") modeTitle = "長文モード";
  else if (mode === "miss_practice") modeTitle = "ミス練習";

  const totalInputs = totalCorrect + totalMistake;
  const accuracyText = totalInputs === 0 ? "―" : `${accuracy}%`;
  const kpmText = totalInputs === 0 ? "―" : totalKpm;
  const solvedText = solvedCount ?? 0;

  let html = `<div class="result-container-centered">`;
  html += `
    ${isFreeMode ? `<div class="result-free-badge">FREE</div>` : ""}
    <div class="result-title">${modeTitle}</div>
  `;

  if (mode === "time_attack") {
    html += `
      <div class="result-score">
        <div class="result-rank">解答数</div>
        ${solvedText}
      </div>
      <div class="result-rank2">
        <span>eScore</span><span>${eScore} ／ ${eRank}</span>
      </div>
    `;
  } else {
    html += `
      <div class="result-score">
        ${eScore}
        <div class="result-rank">${eRank}</div>
      </div>
    `;
  }

  html += `
  <div class="result-stats">
    <div class="r-row"><span class="result-label">正確率</span><span class="result-value">${accuracyText}</span></div>
    <div class="r-row"><span class="result-label">KPM</span><span class="result-value">${kpmText}</span></div>
    <div class="r-row"><span class="result-label">ミス</span><span class="result-value">${totalMistake}</span></div>
    <div class="r-row"><span class="result-label">時間</span><span class="result-value">${Math.round(totalTime)}s</span></div>
  </div>

  ${isTimeUp ? `<div class="r-badge timeup">時間切れ</div>` : ""}
  ${isNewRecord ? `<div class="r-badge new">NEW RECORD</div>` : ""}
  ${isRankIn ? `<div class="r-badge rank">RANK IN ${rankPos ? rankPos+"位" : ""}</div>` : ""}
  `;
  html += `</div>`; // .result-container-centered の閉じ

  resultStats.innerHTML = html;

  const gameDiv = dom.game();
  const resultDiv = dom.result();
  const showQuest = dom.showQuest();
  const showMap = dom.showMap();

  // 通常モードなら非表示
    showQuest.style.display = "none";
    showMap.style.display = "none";

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