import { supabase } from "./supabase.js";

console.log("submitScore loaded");

export async function submitScore(scoreData) {
  console.log("before insert");

  const { data, error } = await supabase
    .from("scores")
    .insert([scoreData]);

  console.log("after insert");
  console.log("insert result", data, error);
}