import { supabase } from "./supabase.js";
import {
  isOnlineEnabled,  getPlayerName,
  getPlayerId, // ★ インポート
  getRecoveryCode // ★ 追加
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
  // ★ RPC（データベース関数）を呼び出すように変更
  const { data, error } = await supabase.rpc("upsert_score", {
    new_id: scoreData.id,
    new_player_id: getPlayerId(), // ★ 永続的なプレイヤーIDを送信
    new_recovery_code: getRecoveryCode(), // ★ 復元コードを送信
    new_player_name: scoreData.player_name,
    new_score: scoreData.score,
    new_kpm: scoreData.kpm,
    new_solved_count: scoreData.solvedCount,
    new_accuracy: scoreData.accuracy,
    new_mode: scoreData.mode,
    new_ranking_version: scoreData.ranking_version,
  });

  if (error) {
    // ★ エラーメッセージをRPC用に修正
    console.error("Score upsert RPC error:", error);
    return { success: false, error };
  }

  // ★ RPCからの返り値(data)が更新されたかどうかを示す boolean になる
  return {
    success: true,
    data,
    onlineUpdated: data === true
  };
}