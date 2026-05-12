import { supabase } from "./supabase.js";

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