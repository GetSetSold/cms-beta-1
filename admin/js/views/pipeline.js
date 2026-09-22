// Buyers table with filters. Detail drawer shows linked contact + notes.

import { getSupabase } from "../supabase.js";
import {
  esc, loadingState, errorState, emptyState, pageHead,
  statusBadge, fmtDate, shortId,
  openDrawer, closeDrawer, contactName,
} from "../ui.js";

export async function renderBuyers(_params, query) {
  await renderPipelineTable({
    table: "buyers",
    title: "Buyers",
    sub: "VIP Buyer Program pipeline.",
    query,
    route: "buyers",
  });
}

export async function renderSellers(_params, query) {
  await renderPipelineTable({
    table: "sellers",
    title: "Sellers",
    sub: "Seller Success Program pipeline.",
    query,
    route: "sellers",
  });
}

async function renderPipelineTable({ table, title, sub, query, route }) {
  const app = document.getElementById("app");
  const statusFilter = query.get("status") || "";
  app.innerHTML =
    pageHead(title, sub) +
    `<div class="card"><div class="btn-row" id="filter-row">${loadingState("Loading…")}</div></div>
     <div class="card"><div id="rows-table">${loadingState()}</div></div>`;

  try {
    const sb = await getSupabase();
    const { data, error } = await sb.from(table)
      .select("*, contacts(id, name, first_name, last_name, email, phone)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;

    const statuses = [...new Set(data.map((r) => r.status).filter(Boolean))];
    const filterRow = document.getElementById("filter-row");
    filterRow.innerHTML = ["", ...statuses].map((s) => `
      <a class="btn btn-sm ${statusFilter === s ? "btn-primary" : ""}" href="#/${route}${s ? `?status=${encodeURIComponent(s)}` : ""}">${esc(s || "All")}</a>`).join("");

    const rows = statusFilter ? data.filter((r) => r.status === statusFilter) : data;
    const tbl = document.getElementById("rows-table");
    if (!rows.length) { tbl.innerHTML = emptyState(`No ${title.toLowerCase()} match this filter.`); return; }

    tbl.innerHTML = `<div class="table-wrap"><table class="data">
      <thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Added</th><th></th></tr></thead>
      <tbody>${rows.map((r) => `
        <tr>
          <td><strong>${esc(contactName(r.contacts))}</strong></td>
          <td class="small">${esc(r.contacts?.email || "—")}</td>
          <td>${statusBadge(r.status)}</td>
          <td class="muted small">${fmtDate(r.created_at)}</td>
          <td><button class="btn btn-sm" data-view="${esc(r.id)}">View</button></td>
        </tr>`).join("")}</tbody></table></div>`;

    tbl.querySelectorAll("[data-view]").forEach((btn) => {
      btn.onclick = () => openRecordDrawer(sb, table, title, btn.dataset.view);
    });
  } catch (err) {
    document.getElementById("rows-table").innerHTML = errorState(err.message || String(err));
  }
}

async function openRecordDrawer(sb, table, title, id) {
  const drawer = openDrawer(loadingState("Loading…"));
  try {
    const { data: rec, error } = await sb.from(table).select("*, contacts(*)").eq("id", id).single();
    if (error) throw error;
    const c = rec.contacts;
    const extra = Object.entries(rec).filter(([k]) => !["id", "contact_id", "contacts", "status", "created_at", "updated_at"].includes(k));

    const { data: notes } = await sb.from("activity_log").select("*")
      .eq("contact_id", rec.contact_id).order("created_at", { ascending: false }).limit(20);

    drawer.innerHTML = `
      <div class="drawer-head">
        <div><h3>${esc(contactName(c))}</h3>
        <div class="muted small">${esc(title.slice(0, -1))} ${shortId(rec.id)} · ${fmtDate(rec.created_at)}</div></div>
        <button class="btn btn-sm" id="drawer-close">✕</button>
      </div>
      <div class="card">
        <h3>Details</h3>
        <dl class="kv">
          <dt>Status</dt><dd>${statusBadge(rec.status)}</dd>
          <dt>Email</dt><dd>${esc(c?.email || "—")}</dd>
          <dt>Phone</dt><dd>${esc(c?.phone || "—")}</dd>
          ${extra.map(([k, v]) => `<dt>${esc(k)}</dt><dd class="small">${esc(typeof v === "object" ? JSON.stringify(v) : (v ?? "—"))}</dd>`).join("")}
        </dl>
      </div>
      <div class="card">
        <h3>Recent notes</h3>
        ${(notes && notes.length) ? notes.map((n) => `
          <div style="border-bottom:1px solid var(--gray-100);padding:10px 0">
            <div class="small"><strong>${esc(n.type || "note")}</strong> <span class="muted">· ${fmtDate(n.created_at)}</span></div>
            <div style="font-size:14px;margin-top:4px">${esc(n.note || n.body || n.description || "")}</div>
          </div>`).join("") : emptyState("No notes yet.")}
      </div>`;
    drawer.querySelector("#drawer-close").onclick = closeDrawer;
  } catch (err) {
    drawer.innerHTML = errorState(err.message || String(err));
  }
}
