// Forms viewer: list forms with sections + questions, read-only.

import { getSupabase } from "../supabase.js";
import {
  esc, loadingState, errorState, emptyState, pageHead, statusBadge,
} from "../ui.js";

export async function renderForms() {
  const app = document.getElementById("app");
  app.innerHTML =
    pageHead("Forms", "Public lead forms — read-only here; edit in the database or a future form builder.") +
    `<div id="forms-list">${loadingState()}</div>`;

  try {
    const sb = await getSupabase();
    const { data: forms, error } = await sb.from("forms").select("*");
    if (error) throw error;
    forms.sort((a, b) => String(a.name || a.title || a.key || "").localeCompare(String(b.name || b.title || b.key || "")));
    const box = document.getElementById("forms-list");
    if (!forms.length) { box.innerHTML = `<div class="card">${emptyState("No forms defined.")}</div>`; return; }

    box.innerHTML = (await Promise.all(forms.map(async (f) => {
      const [{ data: sections }, { data: questions }] = await Promise.all([
        sb.from("form_sections").select("*").eq("form_id", f.id),
        sb.from("form_questions").select("*").eq("form_id", f.id),
      ]);
      const sortKey = (r) => r.sort_order ?? r.position ?? 0;
      const secs = (sections || []).sort((a, b) => sortKey(a) - sortKey(b));
      const qs = (questions || []).sort((a, b) => sortKey(a) - sortKey(b));
      const unsectioned = qs.filter((q) => !q.section_id);
      const bySection = Object.fromEntries(secs.map((s) => [s.id, []]));
      for (const q of qs) if (q.section_id && bySection[q.section_id]) bySection[q.section_id].push(q);

      const qRow = (q) => `
        <div style="padding:8px 0;border-bottom:1px solid var(--gray-100);font-size:14px">
          <strong>${esc(q.label || q.question || q.key || q.id)}</strong>
          <span class="muted small">· ${esc(q.type || q.question_type || "text")}${q.required ? " · required" : ""}</span>
          ${q.options ? `<div class="muted small mono">options: ${esc(Array.isArray(q.options) ? q.options.join(", ") : JSON.stringify(q.options))}</div>` : ""}
        </div>`;

      return `<div class="card">
        <div class="page-head" style="margin-bottom:8px">
          <div><h3 style="margin:0">${esc(f.name || f.title || f.key)}</h3>
          <div class="muted small mono">key: ${esc(f.key || "—")}</div></div>
          <div>${statusBadge(f.status)}</div>
        </div>
        ${secs.map((s) => `
          <p style="font-weight:700;font-size:13px;margin:14px 0 4px;color:var(--gray-600)">${esc(s.title || s.name || "Section")}</p>
          ${(bySection[s.id] || []).map(qRow).join("") || `<p class="muted small">No questions.</p>`}`).join("")}
        ${unsectioned.length ? `<p style="font-weight:700;font-size:13px;margin:14px 0 4px;color:var(--gray-600)">General</p>${unsectioned.map(qRow).join("")}` : ""}
        ${!qs.length ? emptyState("No questions in this form.") : ""}
      </div>`;
    }))).join("");
  } catch (err) {
    document.getElementById("forms-list").innerHTML = errorState(err.message || String(err));
  }
}
