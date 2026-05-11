//supabase.js

import { createClient } from "https://esm.sh/@supabase/supabase-js";

const supabaseUrl = "YOUR_SUPABASE_URL";
const supabaseKey = "YOUR_ANON_KEY";

export const supabase = createClient(supabaseUrl, supabaseKey);