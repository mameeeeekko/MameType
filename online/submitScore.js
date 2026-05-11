import { supabase } from "./supabase.js";

export async function submitScore(scoreData) {
  const { error } = await supabase
    .from("scores")
    .insert([scoreData]);

  if (error) {
    console.error(error);
  }
}
