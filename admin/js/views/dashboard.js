// Dashboard: counts of new leads, contacts, pages, unread notifications.

import { getSupabase } from "../supabase.js";
import { esc, loadingState, errorState, pageHead } from "../ui.js";

export async function renderDashboard() {
  const app = document.getElementById("app");
  app.innerHTML = pageHead("Dashboard", "Overview of your site and pipeline.") + loadingState();

  try {
    const sb = await getSupabase();
    const [
      newLeads, contacts, publishedPages, draftPages, unreadNotifs,
    ] = await Promise.all([
      sb.from("leads").select("id", { count: "exact", head: true }).eq("status", "new"),
      sb.from("contacts").select("id", { count: "exact", head: true }),
      sb.from("pages").select("id", { count: "exact", head: true }).eq("status", "published"),
      sb.from("pages").select("id", { count: "exact", head: true }).eq("status", "draft"),
      // Assumes notifications.is_read boolean; falls back to total count below.
      sb.from("notifications").select("id", { count: "exact", head: true }).eq("is_read", false),
    ]);

    for (const r of [newLeads, contacts, publishedPages, draftPages]) {
      if (r.error) throw r.error;
    }

    let unread = unreadNotifs.count ?? 0;
    if (unreadNotifs.error) {
      // Column may differ (e.g. read_at) — fall back to total count.
      const total = await sb.from("notifications").select("id", { count: "exact", head: true });
      unread = total.error ? 0 : (total.count ?? 0);
    }

    const stat = (num, label, href, accent = false) => `
      <a class="stat-card" href="${href}">
        <p class="stat-num ${accent ? "accent" : ""}">${esc(num ?? 0)}</p>
        <p class="stat-label">${esc(label)}</p>
      </a>`;

    app.innerHTML = pageHead("Dashboard", "Overview of your site and pipeline.") + `
      <div class="stat-grid">
        ${stat(newLeads.count, "New leads", "#/leads?status=new", true)}
        ${stat(contacts.count, "Contacts", "#/contacts")}
        ${stat(publishedPages.count, "Published pages", "#/pages?status=published")}
        ${stat(draftPages.count, "Draft pages", "#/pages?status=draft")}
        ${stat(unread, "Unread notifications", "#/dashboard")}
      </div>
      <div class="card">
        <h3>Quick actions</h3>
        <div class="btn-row">
          <a class="btn btn-primary" href="#/pages">Manage pages</a>
          <a class="btn" href="#/leads?status=new">Review new leads</a>
          <a class="btn" href="#/media">Open media library</a>
          <a class="btn" href="#/settings">Site settings</a>
        </div>
      </div>`;
  } catch (err) {
    app.innerHTML = pageHead("Dashboard") + errorState(err.message || String(err));
  }
}
