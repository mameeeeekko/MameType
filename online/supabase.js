//supabase.js

// Use esm.sh bundled build to avoid runtime submodule 404s (postgrest-js.mjs etc.)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?bundle";

const supabaseUrl = "https://oowxivavwsgucsxahmre.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vd3hpdmF2d3NndWNzeGFobXJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NzY1ODAsImV4cCI6MjA5NDA1MjU4MH0.MAIzfj7_Jb8dGrxyxOdqMODAqL5-EghFCXQJq_iL2To";

export const supabase = createClient(supabaseUrl, supabaseKey);