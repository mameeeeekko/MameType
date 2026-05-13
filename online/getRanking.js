import { supabase } from "./supabase.js";
import { isOnlineEnabled } from "../online/playerProfile.js";
import { RANKING_VERSION } from "../js/version.js";

// ========================================================
// ランキング一覧取得関数
// ========================================================
export async function getRanking(
  mode = null,
  from = 0,
  to = 99
) {
  let query = supabase
    .from("scores")
    .select("*")
    .eq("ranking_version", RANKING_VERSION);

  // モード絞り込み
  if (mode) {
    query = query.eq("mode", mode);
  }

  // モード別ソート
  if (mode === "time_attack") {
    query = query
      .order("solvedCount", { ascending: false })
      .order("score", { ascending: false });
  } else {
    query = query.order("score", { ascending: false });
  }

  query = query.range(from, to);

  const { data, error } = await query;

  if (error) {
    console.error("ranking fetch error:", error);
    return [];
  }

  return data ?? [];
}

// ========================================================
// オンラインでの順位獲得関数　結果で表示する用
// ========================================================
export async function renderOnlineRanking(
  currentScore,
  currentSolvedCount = 0,
  currentMode
) {
  console.log("ranking start");

  try {
    const el = document.getElementById("onlineRanking");
    if (!el) return;

    // ================================
    // オンライン未参加
    // ================================
    if (!isOnlineEnabled()) {
      el.innerHTML = `
        <div class="ranking-disabled">
          <h3>🌐 オンラインランキング未参加</h3>
        </div>
      `;
      return;
    }

    // ================================
    // ランキング取得
    // ================================
    const ranking = await getRanking(currentMode, 0, 99);
    console.log("ranking:", ranking);

    if (!ranking || !ranking.length) {
      el.innerHTML = `
        <div class="ranking-disabled">
          まだランキングデータがありません
        </div>
      `;
      return;
    }

    let rankIndex;

    if (currentMode === "time_attack") {
      rankIndex = ranking.findIndex(
        r => (r.solvedCount || 0) <= currentSolvedCount
      );
    } else {
      rankIndex = ranking.findIndex(
        r => r.score <= currentScore
      );
    }

    const rank =
      rankIndex === -1
        ? ranking.length + 1
        : rankIndex + 1;

    el.innerHTML = `
      <div class="r-badge online">
        ONLINE RANK ${rank}位
        <div class="ranking-season">${RANKING_VERSION}</div>
      </div>
    `;

  } catch (err) {
    console.error("renderOnlineRanking error:", err);
  }
}