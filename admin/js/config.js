// Loads ../config.js (gitignored, created by Rohit from config.example.js).
// Returns { url, anonKey, configured } — configured is false when the file
// is missing or still holds placeholder values.

let cached = null;

export async function loadConfig() {
  if (cached) return cached;
  let url = "";
  let anonKey = "";
  try {
    const mod = await import("../config.js");
    url = (mod.SUPABASE_URL || "").trim();
    anonKey = (mod.SUPABASE_ANON_KEY || "").trim();
  } catch {
    // config.js doesn't exist yet — user must copy config.example.js
  }
  const configured =
    url.startsWith("https://") &&
    !url.includes("YOUR-PROJECT") &&
    anonKey.length > 20 &&
    !anonKey.includes("YOUR-ANON");
  cached = { url, anonKey, configured };
  return cached;
}
