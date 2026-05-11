import { supabase } from "./supabase.js";

export async function submitScore(scoreData) {
  const { error } = await supabase
    .from("scores")
    .insert([scoreData]);
  
    console.log("insert result", data, error);
    
  if (error) {
    console.error(error);
  }
}
