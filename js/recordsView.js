// recordsView.js
// =====================================================
// 記録（ランキング・履歴）画面の表示を担当
// ★ 軽量化済み版：DOM 操作を最小化し、ゲーム中の音遅延を防止
// ★ フィルタは「モードのみ」
// ★ フリーモード（isFreeMode === true）の記録は表示しない
// ★ 難易度は一切使用しない（UI からもロジックからも排除）
// =====================================================

import { RECORDS_KEY, loadRecords, clearRecords, clearRanking, MAX_RANKING, syncRankingProtection } from "./storage.js";
import { GameModes } from "./gameModes.js";


// =====================================================
// 現在選択されているモードを取得
// =====================================================
let currentMode = GameModes.NORMAL.id ?? GameModes.NORMAL;

function getCurrentMode() {
  return currentMode;
}

// 履歴で何件まで表示するか
const HISTORY_INITIAL_COUNT = 20;
let historyVisibleCount = HISTORY_INITIAL_COUNT;

function resetHistoryVisible() {
  historyVisibleCount = HISTORY_INITIAL_COUNT;
}

// NEWバッジの表示期間 (24時間)
const NEW_BADGE_DURATION_MS = 24 * 60 * 60 * 1000;
const getNewBadgeHtml = (record, isLatest = false) => {
  if (record.newInRankingAt && (Date.now() - record.newInRankingAt) < NEW_BADGE_DURATION_MS) {
    const className = isLatest ? "ranking-new-badge latest-record" : "ranking-new-badge";
    return `<span class="${className}">NEW</span>`;
  }
  return '';
};

// サマリー表示＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
function renderSummary(records) {
  const container = document.getElementById("recordsSummary");
  if (!container) return;

  const mode = getCurrentMode();
  const filtered = filterByMode(records, mode);

  if (!filtered.length) {
    container.innerHTML = "";
    return;
  }

  let bestValue = 0;

  if (mode === "time_attack") {
    bestValue = Math.max(...filtered.map(r => r.solvedCount ?? 0));
  } else if (mode === "enemy_mode") {
    bestValue = Math.max(...filtered.map(r => r.gScore ?? 0));
  } else {
    bestValue = Math.max(...filtered.map(r => r.eScore ?? r.score ?? 0));
  }

  const avgKpm = Math.round(
    filtered.reduce((sum, r) => sum + (r.kpm || 0), 0) / filtered.length
  );

  const avgAcc = Math.round(
    filtered.reduce((sum, r) => sum + (r.accuracy || 0), 0) / filtered.length
  );

  container.innerHTML = `
    <div class="summary-card">
      <div class="summary-label">BEST</div>
      <div class="summary-value">${bestValue}</div>
    </div>

    <div class="summary-card">
      <div class="summary-label">PLAY</div>
      <div class="summary-value">${filtered.length}</div>
    </div>

    <div class="summary-card">
      <div class="summary-label">AVG KPM</div>
      <div class="summary-value">${avgKpm}</div>
    </div>

    <div class="summary-card">
      <div class="summary-label">AVG ACC</div>
      <div class="summary-value">${avgAcc}%</div>
    </div>
  `;
}

// 記録画面を表示する =================================================

export function showRecordsView(initialMode = GameModes.NORMAL) {
  syncRankingProtection(); 
  const records = loadRecords();
  resetHistoryVisible();

  // 現在のモードをデフォルトで表示する。
  currentMode = initialMode?.id ?? initialMode;

  // ボタンの active 反映
  const buttons = document.querySelectorAll("#recordsModeButtons button");
  buttons.forEach(b => {
    b.classList.toggle("active", b.dataset.mode === currentMode);
  });

  // モード切り替えセレクトをセットアップ
  setupFilters(records);

  // 初期描画
  renderSummary(records);
  renderRanking(records);
  renderHistory(records);
  renderBestEScoreGraph(records);

  // 画面切り替え
  document.getElementById("menu").style.display = "none";
  document.getElementById("game").style.display = "none";
  document.getElementById("result").style.display = "none";
  document.getElementById("records").style.display = "block";

  // リセットボタン
  const resetBtn = document.getElementById("resetRecordsBtn");
  if (resetBtn) {
    resetBtn.onclick = () => {
      const ok = confirm("本当にすべての記録を削除しますか？\nこの操作は元に戻せません。");
      if (!ok) return;

      clearRecords();
      clearRanking();
      resetHistoryVisible();

      const records = loadRecords();
      renderSummary(records);
      renderRanking(records);
      renderHistory(records);
      renderBestEScoreGraph(records);
    };
  }
}

/**
 * モード選択用セレクトをセットアップ
 * 変更されたらランキング・履歴・グラフを再描画する
 */
function setupFilters(records) {
  const container = document.getElementById("recordsModeButtons");
  if (!container) return;

  const buttons = container.querySelectorAll("button");

  buttons.forEach(btn => {
    btn.onclick = () => {
      // モード更新
      currentMode = btn.dataset.mode;

      // 見た目更新
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      // 再描画
      resetHistoryVisible();
      renderSummary(records);
      renderRanking(records);
      renderHistory(records);
      renderBestEScoreGraph(records);
    };
  });
}

/**
 * ランキング（スコア上位maxranking分）を表示
 */
function renderRanking(records) {
  const container = document.getElementById("ranking");
  container.innerHTML = "";

  const mode = getCurrentMode();

  // モードで絞り込み
  const filtered = filterByMode(records, mode);

  // 絞り込んだジャンル（モード）内での最新タイムスタンプを取得（一番新しい記録を強調するため）
  const latestTimestamp = filtered.length > 0
    ? Math.max(...filtered.map(r => new Date(r.date).getTime()))
    : 0;

  if (!filtered.length) {
    container.textContent = "まだ記録がありません";
    return;
  }

  let sorted;
  if (mode === "time_attack") {
    sorted = [...filtered]
      .sort((a, b) => (b.solvedCount ?? 0) - (a.solvedCount ?? 0))
      .slice(0, MAX_RANKING);
  } else if (mode === "enemy_mode") {
    sorted = [...filtered]
      .sort((a, b) => (b.gScore ?? 0) - (a.gScore ?? 0))
      .slice(0, MAX_RANKING);
  } else {
    sorted = [...filtered]
      .sort((a, b) => (b.eScore ?? 0) - (a.eScore ?? 0))
      .slice(0, MAX_RANKING);
  }

  let columns;
  let rows;

  if (mode === "time_attack") {
    columns = ["順位", "日時", "解答数", "eScore", "KPM", "正確率"];
    rows = sorted.map((r, i) => [
      `<div class="rank-cell">${getNewBadgeHtml(r, new Date(r.date).getTime() === latestTimestamp)}<span class="rank-number">${i + 1}</span></div>`,
      new Date(r.date).toLocaleString(),
      r.solvedCount ?? 0,
      r.eScore ?? r.score,
      r.kpm,
      r.accuracy + "%"
    ]);
  } else if (mode === "enemy_mode") {
    columns = ["順位", "日時", "gScore", "gRank", "撃破数", "最大コンボ", "最大チェイン", "KPM", "正確率"];
    rows = sorted.map((r, i) => [
      `<div class="rank-cell">${getNewBadgeHtml(r, new Date(r.date).getTime() === latestTimestamp)}<span class="rank-number">${i + 1}</span></div>`,
      new Date(r.date).toLocaleString(),
      r.gScore,
      r.gRank ?? "_",
      r.defeatedCount ?? 0,
      r.maxCombo ?? 0,
      r.maxChain ?? 0,
      r.kpm,
      r.accuracy + "%"
    ]);
  } else {
    columns = ["順位", "日時", "eScore", "ランク", "KPM", "正確率"];
    rows = sorted.map((r, i) => [
      `<div class="rank-cell">${getNewBadgeHtml(r, new Date(r.date).getTime() === latestTimestamp)}<span class="rank-number">${i + 1}</span></div>`,
      new Date(r.date).toLocaleString(),
      r.eScore ?? r.score,
      r.eRank ?? "-",
      r.kpm,
      r.accuracy + "%"
    ]);
  }

  // ===== スクロール用ラッパー =====
  const wrapper = document.createElement("div");
  wrapper.style.width = "100%";
  wrapper.style.display = "flex";
  wrapper.style.justifyContent = "center";
  wrapper.style.position = "relative";

  // 20件超えたらスクロール
  if (rows.length > 20) {
    wrapper.style.maxHeight = "420px";
    wrapper.style.overflowY = "auto";
    wrapper.style.border = "1px solid rgba(88, 166, 255, 0.2)";
    wrapper.style.borderRadius = "12px";
  }

  container.appendChild(wrapper);

  renderTable(wrapper, columns, rows);
}

/**
 * 履歴（新しい順）を表示
 */
// --------------------------------------------
// renderHistory：履歴テーブル描画
// --------------------------------------------
function renderHistory(records) {
  const container = document.getElementById("history");
  container.innerHTML = "";

  const mode = getCurrentMode();

  // フリーモード除外・モード絞り込み
  const filtered = filterByMode(records, mode);
  if (!filtered.length) {
    container.textContent = "まだ記録がありません";
    return;
  }

  const sorted = [...filtered].sort((a, b) => new Date(b.date) - new Date(a.date));
  const visible = sorted.slice(0, historyVisibleCount);
  
  // -----------------------------
  // 列と行作成
  // -----------------------------
  let columns, rows;
  if (mode === "time_attack") {
    columns = ["日時", "解答数", "eScore", "KPM", "正確率", "ミス", "保護"];
    rows = visible.map(r => {
  const mode = r.mode;
  const mark =
    (r.userProtectedModes?.[mode] ? "🔒" : "") +
    (r.rankingProtectedModes?.[mode] ? "👑" : "");

  return [
    new Date(r.date).toLocaleString(),
    r.solvedCount ?? 0,
    r.eScore ?? r.score,
    r.kpm,
    r.accuracy + "%",
    r.totalMistake,
    mark
  ];
});

  } else if (mode === "enemy_mode") {
  columns = ["日時", "gScore", "gRank", "撃破数", "最大コンボ", "最大チェイン", "KPM", "正確率", "ミス", "保護"];

  rows = visible.map(r => {
    const mode = r.mode;
    const mark =
      (r.userProtectedModes?.[mode] ? "🔒" : "") +
      (r.rankingProtectedModes?.[mode] ? "👑" : "");
    
    return [
      new Date(r.date).toLocaleString(),
      r.gScore,
      r.gRank ?? "-",
      r.defeatedCount ?? 0,
      r.maxCombo ?? 0,
      r.maxChain ?? 0,
      r.kpm,
      r.accuracy + "%",
      r.totalMistake,
      mark
    ];
  });
} else {
    columns = ["日時", "eScore", "ランク", "KPM", "正確率", "ミス", "保護"];
  rows = visible.map(r => {
  const mode = r.mode;
  const mark =
    (r.userProtectedModes?.[mode] ? "🔒" : "") +
    (r.rankingProtectedModes?.[mode] ? "👑" : "");
    
  return [
    new Date(r.date).toLocaleString(),
    r.eScore ?? r.score,
    r.eRank ?? "-",
    r.kpm,
    r.accuracy + "%",
    r.totalMistake,
    mark
  ];
});

  }

  renderTable(container, columns, rows);

  // -----------------------------
  // 鍵マーククリックで userProtected ON/OFF
  // -----------------------------
rows.forEach((rowData, rowIndex) => {
  const tr = container.querySelector("table").rows[rowIndex + 1];
  const lastTd = tr.cells[tr.cells.length - 1];

  lastTd.style.cursor = "pointer";
  lastTd.addEventListener("click", () => {
    const record = sorted[rowIndex];
    const mode = record.mode;

    if (!record.userProtectedModes) record.userProtectedModes = {};
    record.userProtectedModes[mode] =
      !record.userProtectedModes?.[mode];

    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
    renderHistory(records);
  });
});


  // 「もっと見る」ボタン
  if (historyVisibleCount < sorted.length) {
    const moreBtn = document.createElement("button");
    moreBtn.textContent = "過去の分を見る";
    moreBtn.className = "records-more-btn"; // スタイルをCSSで制御しやすくするため
    moreBtn.style.display = "block";
    moreBtn.style.margin = "10px auto";
    moreBtn.addEventListener("click", () => {
      historyVisibleCount += 20;
      renderHistory(records);
    });
    container.appendChild(moreBtn);
  }
}


/**
 * 共通のテーブル描画関数（軽量化）
 */
function renderTable(container, columns, rows) {
  const table = document.createElement("table");
  table.style.margin = "0 auto";
  table.style.width = "100%";

  // ヘッダー行
  const headerTr = document.createElement("tr");
  columns.forEach(col => {
    const th = document.createElement("th");
    th.textContent = col;

    th.style.padding = "8px 10px";

    // 固定ヘッダー
    th.style.position = "sticky";
    th.style.top = "0";
    th.style.zIndex = "10";

    headerTr.appendChild(th);
  });

  table.appendChild(headerTr);

  // データ行
  rows.forEach(row => {
    const tr = document.createElement("tr");
    row.forEach(cell => {
      const td = document.createElement("td");
      td.innerHTML = cell; // タグをレンダリングするためにinnerHTMLを使用
      td.style.padding = "4px 8px";
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });

  container.appendChild(table);
}

/**
 * モードで絞り込み
 * ・フリーモードの記録（isFreeMode === true）は除外
 * ・指定された mode と一致するものだけ通す
 */
function filterByMode(records, mode) {
  return records.filter(r => {
    // フリーモードは表示しない（保険）
    if (r.isFreeMode) return false;

    // モード一致のみ
    if (r.mode !== mode) return false;

    return true;
  });
}

function renderBestEScoreGraph(records) {
  const mode = getCurrentMode();

  // モードで絞り込み（フリーモード除外）
  const filtered = filterByMode(records, mode);

  // タイムアタックなら solvedCount、それ以外は eScore
  const timeline = buildBestTimeline(filtered, mode);

  const container = document.getElementById("bestScoreGraph");
  if (!container) return;

  const MAX_POINTS = 50;
  const sliced = timeline.slice(-MAX_POINTS);
  renderTimelineGraph(container, sliced, mode);
}

/**
 * タイムアタックは solvedCount、それ以外は eScore
 * 「自己ベストを更新したときだけ」履歴に積む
 */
function buildBestTimeline(records, mode) {
  const sorted = [...records].sort((a, b) => new Date(a.date) - new Date(b.date));
  let best = -Infinity;
  const timeline = [];

  for (const r of sorted) {
    let value;
    if (mode === "time_attack") {
      value = r.solvedCount ?? 0;
    } else if (mode === "enemy_mode") {
      value = r.gScore;
    }else {
      value = r.eScore ?? r.score;
    }
    if (value == null) continue;

    if (value > best) {
      best = value;
      timeline.push({
        date: new Date(r.date),
        value: value
      });
    }
  }

  return timeline; // [{ date, value }, ...]
}

/**
 * 共通のグラフ描画
 */
function renderTimelineGraph(container, timeline, mode) {
  if (!timeline || !timeline.length) {
    container.textContent = "まだ自己ベスト更新の履歴がありません";
    return;
  }

  container.innerHTML = "";

  const points = timeline.map(p => ({
    t: p.date.getTime(),
    value: Number(p.value)
  }));

  const values = points.map(p => p.value);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);

  const canvas = document.createElement("canvas");
  const padding = { left: 70, right: 40, top: 40, bottom: 100 };
  canvas.width  = Math.max(points.length * 110, 720);
  canvas.height = container.clientHeight || 380;
  container.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  const w = canvas.width - padding.left - padding.right;
  const h = canvas.height - padding.top - padding.bottom;

  // ───── サイバーダーク背景 ─────
  ctx.fillStyle = "#010409";
  ctx.strokeStyle = "rgba(164, 164, 164, 0.2)";
  ctx.lineWidth = 1;
  roundRect(ctx, 10, 10, canvas.width - 20, canvas.height - 20, 16);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  // ───── Y範囲 ─────
  const paddingRatio = 0.15;
  let minDisplay, maxDisplay;

  if (mode === "time_attack") {
    minDisplay = 0;
    maxDisplay = maxV + (maxV - minV) * paddingRatio || 1;
  } else {
    minDisplay = minV - (maxV - minV) * paddingRatio;
    maxDisplay = maxV + (maxV - minV) * paddingRatio;
  }

  const yAt = v => {
    if (maxDisplay === minDisplay) return padding.top + h / 2;
    return padding.top + h - ((v - minDisplay) / (maxDisplay - minDisplay)) * h;
  };

  const xAtIndex = i => {
    if (points.length === 1) return padding.left + w / 2;
    return padding.left + (i / (points.length - 1)) * w;
  };

  // ───── グリッド線─────
  ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (h / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + w, y);
    ctx.stroke();
  }

  // ───── 折れ線（丸い線） ─────
  ctx.strokeStyle = "#a4a4a4";
  ctx.lineWidth = 4;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.shadowColor = "rgba(99,102,241,0.25)";
  ctx.shadowBlur = 6;

  ctx.beginPath();
  points.forEach((p, i) => {
    const x = xAtIndex(i);
    const y = yAt(p.value);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.shadowBlur = 0;

  // ───── 点（白縁＋影） ─────
  points.forEach((p, i) => {
    const x = xAtIndex(i);
    const y = yAt(p.value);

    ctx.fillStyle = "#a4a4a4";
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 3;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
  });

  // ───── 最新点 ─────
  const last = points[points.length - 1];
  if (last) {
    const x = xAtIndex(points.length - 1);
    const y = yAt(last.value);

    ctx.fillStyle = "#f59e0b";
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 4;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
  }


// ───── 数値ラベル ────
ctx.font = "bold 12px sans-serif";
ctx.textAlign = "center";
ctx.textBaseline = "bottom";

points.forEach((p, i) => {
  const x = xAtIndex(i);
  const y = yAt(p.value);

  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = 2;
  ctx.shadowOffsetY = 1;

  ctx.fillStyle = "#c9d1d9";
  ctx.fillText(p.value.toFixed(0), x, y - 10);
  // 影リセット
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
});

  // ───── X軸ラベル ─────
  ctx.font = "11px sans-serif";
  ctx.fillStyle = "#8b949e";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  points.forEach((p, i) => {
    const x = xAtIndex(i);
    const d = new Date(p.t);

    const dateStr = d.toLocaleDateString();
    const timeStr = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    ctx.fillText(dateStr, x, padding.top + h + 14);
    ctx.fillText(timeStr, x, padding.top + h + 28);
  });

  // ───── Y軸タイトル（カラーチップ） ─────
  const label =
  mode === "time_attack"
    ? "解答数"
    : mode === "enemy_mode"
    ? "gScore"
    : "eScore";

  ctx.save();
  ctx.translate(26, padding.top + h / 2);
  ctx.rotate(-Math.PI / 2);

  ctx.fillStyle = "#161b22";
  roundRect(ctx, -30, -12, 60, 24, 12);
  ctx.fill();

  ctx.fillStyle = "#a4a4a4";
  ctx.font = "bold 11px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, 0, 0);

  ctx.restore();
}


// 角丸矩形
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
