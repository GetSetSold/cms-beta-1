// Singleton Supabase client (ESM via importmap CDN). Created lazily after
// config loads so a missing config.js fails gracefully with a setup hint.

import { createClient } from "@supabase/supabase-js";
import { loadConfig } from "./config.js";

let client = null;
let configMissing = false;

export async function getSupabase() {
  if (client) return client;
  const cfg = await loadConfig();
  if (!cfg.configured) {
    configMissing = true;
    throw new Error(
      "Supabase is not configured. Copy admin/config.example.js to admin/config.js and fill in SUPABASE_URL and SUPABASE_ANON_KEY."
    );
  }
  client = createClient(cfg.url, cfg.anonKey);
  return client;
}

export function isConfigMissing() {
  return configMissing;
}
