// Contacts: table + detail drawer (linked leads, notes via activity_log).

import { getSupabase } from "../supabase.js";
import {
  esc, loadingState, errorState, emptyState, pageHead,
  statusBadge, fmtDate, shortId, toast,
  openDrawer, closeDrawer, contactName,
} from "../ui.js";

export async function renderContacts() {
  const app = document.getElementById("app");
  app.innerHTML =
    pageHead("Contacts", "Everyone in the CRM.") +
    `<div class="card">
      <label class="field" style="max-width:360px"><span>Search</span>
        <input type="text" id="contact-search" placeholder="Name or email…" /></label>
      <div id="contacts-table">${loadingState()}</div>
    </div>`;

  const load = async (term = "") => {
    const tbl = document.getElementById("contacts-table");
    tbl.innerHTML = loadingState();
    try {
      const sb = await getSupabase();
      let q = sb.from("contacts").select("*").order("created_at", { ascending: false }).limit(200);
      if (term) q = q.or(`name.ilike.%${term}%,email.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%`);
      const { data, error } = await q;
      if (error) throw error;
      if (!data.length) { tbl.innerHTML = emptyState("No contacts found."); return; }
      tbl.innerHTML = `<div class="table-wrap"><table class="data">
        <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Added</th><th></th></tr></thead>
        <tbody>${data.map((c) => `
          <tr>
            <td><strong>${esc(contactName(c))}</strong></td>
            <td class="small">${esc(c.email || "—")}</td>
            <td class="small">${esc(c.phone || "—")}</td>
            <td class="muted small">${fmtDate(c.created_at)}</td>
            <td><button class="btn btn-sm" data-view="${esc(c.id)}">View</button></td>
          </tr>`).join("")}</tbody></table></div>`;
      tbl.querySelectorAll("[data-view]").forEach((btn) => {
        btn.onclick = () => openContactDrawer(btn.dataset.view);
      });
    } catch (err) {
      tbl.innerHTML = errorState(err.message || String(err));
    }
  };

  let t;
  document.getElementById("contact-search").addEventListener("input", (e) => {
    clearTimeout(t);
    t = setTimeout(() => load(e.target.value.trim()), 300);
  });
  load();
}

async function openContactDrawer(contactId) {
  const drawer = openDrawer(loadingState("Loading contact…"));
  try {
    const sb = await getSupabase();
    const [
      { data: contact, error: cErr },
      { data: leads, error: lErr },
      { data: notes, error: nErr },
    ] = await Promise.all([
      sb.from("contacts").select("*").eq("id", contactId).single(),
      sb.from("leads").select("id, form_type, status, created_at").eq("contact_id", contactId).order("created_at", { ascending: false }),
      sb.from("activity_log").select("*").eq("contact_id", contactId).order("created_at", { ascending: false }).limit(50),
    ]);
    if (cErr) throw cErr;
    if (lErr) throw lErr;
    if (nErr) throw nErr;

    drawer.innerHTML = `
      <div class="drawer-head">
        <div><h3>${esc(contactName(contact))}</h3>
        <div class="muted small">Contact ${shortId(contact.id)} · added ${fmtDate(contact.created_at)}</div></div>
        <button class="btn btn-sm" id="drawer-close">✕</button>
      </div>
      <div class="card">
        <h3>Details</h3>
        <dl class="kv">
          <dt>Email</dt><dd>${esc(contact.email || "—")}</dd>
          <dt>Phone</dt><dd>${esc(contact.phone || "—")}</dd>
          ${Object.entries(contact)
            .filter(([k]) => !["id", "name", "first_name", "last_name", "email", "phone", "created_at", "updated_at"].includes(k))
            .map(([k, v]) => `<dt>${esc(k)}</dt><dd class="small">${esc(typeof v === "object" ? JSON.stringify(v) : (v ?? "—"))}</dd>`).join("")}
        </dl>
      </div>
      <div class="card">
        <h3>Leads (${leads.length})</h3>
        ${leads.length ? `<div class="table-wrap"><table class="data">
          <thead><tr><th>Form</th><th>Status</th><th>Received</th></tr></thead>
          <tbody>${leads.map((l) => `
            <tr><td class="mono small">${esc(l.form_type || "—")}</td><td>${statusBadge(l.status)}</td><td class="muted small">${fmtDate(l.created_at)}</td></tr>`).join("")}
          </tbody></table></div>` : emptyState("No leads linked.")}
      </div>
      <div class="card">
        <h3>Notes (${notes.length})</h3>
        ${notes.length ? notes.map((n) => `
          <div style="border-bottom:1px solid var(--gray-100);padding:10px 0">
            <div class="small"><strong>${esc(n.type || "note")}</strong> <span class="muted">· ${fmtDate(n.created_at)}</span></div>
            <div style="font-size:14px;margin-top:4px">${esc(n.note || n.body || n.description || "")}</div>
          </div>`).join("") : emptyState("No notes yet — add one from a lead.")}
      </div>`;

    drawer.querySelector("#drawer-close").onclick = closeDrawer;
  } catch (err) {
    drawer.innerHTML = errorState(err.message || String(err));
  }
}
