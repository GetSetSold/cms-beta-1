// Auth: sign in/out, session persistence, route guarding.

import { getSupabase } from "./supabase.js";

export async function signIn(email, password) {
  const sb = await getSupabase();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signOut() {
  const sb = await getSupabase();
  await sb.auth.signOut();
}

export async function getSession() {
  const sb = await getSupabase();
  const { data } = await sb.auth.getSession();
  return data.session || null;
}

// Refresh-aware guard: returns true when a valid session exists.
export async function requireAuth() {
  try {
    const sb = await getSupabase();
    const { data } = await sb.auth.getSession();
    return !!data.session;
  } catch {
    return false;
  }
}
