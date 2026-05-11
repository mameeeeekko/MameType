import { supabase } from "./supabase.js";

export async function getRanking(mode = null) {
  let query = supabase
    .from("scores")
    .select("*")
    .order("score", { ascending: false })
    .limit(10);

  // モード別ランキングにしたい場合
  if (mode) {
    query = query.eq("mode", mode);
  }

  const { data, error } = await query;

  if (error) {
    console.error("ranking fetch error:", error);
    return [];
  }

  return data;
}