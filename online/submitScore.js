import { supabase } from "./supabase.js";

export async function submitScore(scoreData) {
  // ① バリデーション追加（重要）
  if (
    !scoreData ||
    typeof scoreData.score !== "number" ||
    Number.isNaN(scoreData.score)
  ) {
    console.error("invalid scoreData:", scoreData);
    return { success: false, error: "invalid data" };
  }

  // ② insert
  const { data, error } = await supabase
    .from("scores")
    .insert([scoreData]);

  // ③ エラーを見える化（超重要）
  if (error) {
    console.error("Score insert error:", error);
    return { success: false, error };
  }

  return { success: true, data };
}