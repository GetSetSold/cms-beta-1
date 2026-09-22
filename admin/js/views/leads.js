// Leads: table with status filter, detail drawer (linked contact + payload),
// status change, add note -> activity_log.

import { getSupabase } from "../supabase.js";
import {
  esc, loadingState, errorState, emptyState, pageHead,
  statusBadge, fmtDate, shortId, toast,
  openDrawer, closeDrawer, contactName,
} from "../ui.js";

const STATUSES = ["new", "contacted", "qualified", "converted", "lost", "spam"];

export async function renderLeads(_params, query) {
  const app = document.getElementById("app");
  const statusFilter = query.get("status") || "";
  app.innerHTML =
    pageHead("Leads", "Form submissions from the public site.") +
    `<div class="card"><div class="btn-row">
      ${["", ...STATUSES].map((s) => `
        <a class="btn btn-sm ${statusFilter === s ? "btn-primary" : ""}" href="#/leads${s ? `?status=${s}` : ""}">${s || "All"}</a>`).join("")}
    </div></div>
    <div class="card"><div id="leads-table">${loadingState()}</div></div>`;

  try {
    const sb = await getSupabase();
    let q = sb.from("leads")
      .select("id, form_type, status, payload, created_at, contact_id, contacts(id, name, first_name, last_name, email, phone)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (statusFilter) q = q.eq("status", statusFilter);
    const { data, error } = await q;
    if (error) throw error;

    const tbl = document.getElementById("leads-table");
    if (!data.length) { tbl.innerHTML = emptyState("No leads match this filter."); return; }
    tbl.innerHTML = `<div class="table-wrap"><table class="data">
      <thead><tr><th>Name</th><th>Form</th><th>Status</th><th>Received</th><th></th></tr></thead>
      <tbody>${data.map((l) => {
        const linked = contactName(l.contacts);
        const name = l.name || (linked !== "—" ? linked : (l.payload?.name || l.payload?.full_name || "—"));
        return `<tr>
          <td><strong>${esc(name)}</strong><div class="muted small">${esc(l.contacts?.email || l.payload?.email || "")}</div></td>
          <td class="mono small">${esc(l.form_type || "—")}</td>
          <td>${statusBadge(l.status)}</td>
          <td class="muted small">${fmtDate(l.created_at)}</td>
          <td><button class="btn btn-sm" data-view="${esc(l.id)}">View</button></td>
        </tr>`;
      }).join("")}</tbody></table></div>`;

    tbl.querySelectorAll("[data-view]").forEach((btn) => {
      btn.onclick = () => openLeadDrawer(btn.dataset.view, () => renderLeads(_params, query));
    });
  } catch (err) {
    document.getElementById("leads-table").innerHTML = errorState(err.message || String(err));
  }
}

async function openLeadDrawer(leadId, onChange) {
  const drawer = openDrawer(loadingState("Loading lead…"));
  try {
    const sb = await getSupabase();
    const { data: lead, error } = await sb.from("leads")
      .select("*, contacts(*)")
      .eq("id", leadId)
      .single();
    if (error) throw error;

    const c = lead.contacts;
    drawer.innerHTML = `
      <div class="drawer-head">
        <div><h3>${esc(lead.name || contactName(c))}</h3>
        <div class="muted small">Lead ${shortId(lead.id)} · ${fmtDate(lead.created_at)}</div></div>
        <button class="btn btn-sm" id="drawer-close">✕</button>
      </div>
      <div class="card">
        <h3>Contact</h3>
        <dl class="kv">
          <dt>Name</dt><dd>${esc(contactName(c))}</dd>
          <dt>Email</dt><dd>${esc(c?.email || lead.payload?.email || "—")}</dd>
          <dt>Phone</dt><dd>${esc(c?.phone || lead.payload?.phone || "—")}</dd>
          <dt>Form</dt><dd class="mono">${esc(lead.form_type || "—")}</dd>
          <dt>Status</dt><dd>${statusBadge(lead.status)}</dd>
        </dl>
        <label class="field"><span>Change status</span>
          <select id="lead-status">
            ${STATUSES.map((s) => `<option value="${s}" ${lead.status === s ? "selected" : ""}>${s}</option>`).join("")}
          </select></label>
      </div>
      <div class="card">
        <h3>Submission payload</h3>
        <pre class="json">${esc(JSON.stringify(lead.payload ?? {}, null, 2))}</pre>
      </div>
      <div class="card">
        <h3>Add note</h3>
        <form id="note-form">
          <label class="field"><span>Note (saved to activity log)</span>
            <textarea id="note-text" required placeholder="e.g. Called, left voicemail…"></textarea></label>
          <button class="btn btn-primary" type="submit">Add note</button>
        </form>
        <div id="notes-list" style="margin-top:16px">${loadingState("Loading notes…")}</div>
      </div>`;

    drawer.querySelector("#drawer-close").onclick = closeDrawer;

    drawer.querySelector("#lead-status").onchange = async (e) => {
      const { error: upErr } = await sb.from("leads").update({ status: e.target.value }).eq("id", lead.id);
      if (upErr) toast(upErr.message, "error");
      else { toast("Status updated."); onChange(); openLeadDrawer(leadId, onChange); }
    };

    drawer.querySelector("#note-form").onsubmit = async (e) => {
      e.preventDefault();
      const text = drawer.querySelector("#note-text").value.trim();
      if (!text || !lead.contact_id) {
        if (!lead.contact_id) toast("No linked contact — note needs a contact.", "error");
        return;
      }
      // Assumes activity_log(contact_id, type, note, created_at).
      const { error: nErr } = await sb.from("activity_log").insert({
        contact_id: lead.contact_id,
        type: "note",
        note: text,
      });
      if (nErr) toast(nErr.message, "error");
      else { toast("Note added."); drawer.querySelector("#note-text").value = ""; loadNotes(sb, lead.contact_id, drawer); }
    };

    if (lead.contact_id) loadNotes(sb, lead.contact_id, drawer);
    else drawer.querySelector("#notes-list").innerHTML = emptyState("No linked contact.");
  } catch (err) {
    drawer.innerHTML = errorState(err.message || String(err));
  }
}

async function loadNotes(sb, contactId, drawer) {
  const box = drawer.querySelector("#notes-list");
  try {
    const { data, error } = await sb.from("activity_log")
      .select("*").eq("contact_id", contactId).order("created_at", { ascending: false }).limit(50);
    if (error) throw error;
    if (!data.length) { box.innerHTML = emptyState("No notes yet."); return; }
    box.innerHTML = data.map((n) => `
      <div style="border-bottom:1px solid var(--gray-100);padding:10px 0">
        <div class="small"><strong>${esc(n.type || "note")}</strong> <span class="muted">· ${fmtDate(n.created_at)}</span></div>
        <div style="font-size:14px;margin-top:4px">${esc(n.note || n.body || n.description || "")}</div>
      </div>`).join("");
  } catch (err) {
    box.innerHTML = errorState(err.message || String(err));
  }
}
