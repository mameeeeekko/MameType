import { supabase } from "./supabase.js";
import {
  isOnlineEnabled,
  getPlayerName
} from "./playerProfile.js";

export async function submitScore(scoreData) {

  // ================================
  // オンラインランキングOFFなら送信しない
  // ================================
  if (!isOnlineEnabled()) {
    console.log("オンラインランキングOFF");
    return { success: false, skipped: true };
  }

  // ================================
  // バリデーション
  // ================================
  if (
    !scoreData ||
    typeof scoreData.score !== "number" ||
    Number.isNaN(scoreData.score)
  ) {
    console.error("invalid scoreData:", scoreData);
    return { success: false, error: "invalid data" };
  }

  // ================================
  // 名前自動付与
  // ================================
  scoreData.player_name = getPlayerName() || "NoName";

  // ================================
  // insert
  // ================================
  const { data, error } = await supabase
    .from("scores")
    .insert([scoreData]);

  if (error) {
    console.error("Score insert error:", error);
    return { success: false, error };
  }

  return { success: true, data };
}