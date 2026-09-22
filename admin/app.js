// GetSetSold Admin — entry point.
// Boots config, handles the login screen, guards routes, starts the router.

import { loadConfig } from "./js/config.js";
import { getSupabase } from "./js/supabase.js";
import { signIn, signOut } from "./js/auth.js";
import { addRoute, startRouter, navigate } from "./js/router.js";
import { renderDashboard } from "./js/views/dashboard.js";
import { renderPages } from "./js/views/pages.js";
import { renderEditor } from "./js/views/editor.js";
import { renderLeads } from "./js/views/leads.js";
import { renderContacts } from "./js/views/contacts.js";
import { renderBuyers, renderSellers } from "./js/views/pipeline.js";
import { renderMedia } from "./js/views/media.js";
import { renderForms } from "./js/views/forms.js";
import { renderSettings } from "./js/views/settings.js";

addRoute("/dashboard", renderDashboard);
addRoute("/pages", renderPages);
addRoute("/pages/:slug/edit", renderEditor);
addRoute("/leads", renderLeads);
addRoute("/contacts", renderContacts);
addRoute("/buyers", renderBuyers);
addRoute("/sellers", renderSellers);
addRoute("/media", renderMedia);
addRoute("/forms", renderForms);
addRoute("/settings", renderSettings);

let routerStarted = false;
function ensureRouter() {
  if (!routerStarted) { routerStarted = true; startRouter(); }
}

const loginScreen = document.getElementById("login-screen");
const appShell = document.getElementById("app-shell");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const configWarning = document.getElementById("login-config-warning");

function showLogin() {
  loginScreen.hidden = false;
  appShell.hidden = true;
}

function showApp() {
  loginScreen.hidden = true;
  appShell.hidden = false;
}

async function boot() {
  const cfg = await loadConfig();
  if (!cfg.configured) {
    configWarning.innerHTML =
      `Supabase is not configured yet. Copy <code>admin/config.example.js</code> to <code>admin/config.js</code> and fill in your project URL and anon key.`;
    configWarning.hidden = false;
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.hidden = true;
    const btn = document.getElementById("login-submit");
    btn.disabled = true;
    try {
      await signIn(loginForm.email.value.trim(), loginForm.password.value);
      loginForm.password.value = "";
      showApp();
      navigate("/dashboard");
      ensureRouter();
    } catch (err) {
      loginError.textContent = err.message || "Sign-in failed.";
      loginError.hidden = false;
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById("logout-btn").addEventListener("click", async () => {
    try { await signOut(); } catch { /* already signed out */ }
    showLogin();
  });

  // Restore session if one exists (Supabase persists it in localStorage).
  try {
    const sb = await getSupabase();
    const { data } = await sb.auth.getSession();
    sb.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") showLogin();
    });
    if (data.session) {
      showApp();
      navigate("/dashboard");
      ensureRouter();
    } else {
      showLogin();
    }
  } catch {
    // Config missing or unreachable — stay on login with the warning shown.
    showLogin();
  }
}

boot();
