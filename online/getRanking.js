import { supabase } from "./supabase.js";
import { isOnlineEnabled } from "../online/playerProfile.js";

export async function getRanking(mode = null) {
  let query = supabase
    .from("scores")
    .select("*")
    .limit(10);

  // モード絞り込み
  if (mode) {
    query = query.eq("mode", mode);
  }

  // =========================
  // モード別ソート条件
  // =========================
  if (mode === "time_attack") {
    // タイムアタックは解答数優先
    query = query
      .order("solvedCount", { ascending: false })
      .order("score", { ascending: false }); // 同点時
  } else {
    // 通常はスコア
    query = query.order("score", { ascending: false });
  }

  const { data, error } = await query;

  if (error) {
    console.error("ranking fetch error:", error);
    return [];
  }

  return data;
}

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
    const ranking = await getRanking(currentMode);
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
      </div>
    `;

  } catch (err) {
    console.error("renderOnlineRanking error:", err);
  }
}