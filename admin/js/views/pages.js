// Pages list: title/slug/status/updated_at, create, delete.

import { getSupabase } from "../supabase.js";
import {
  esc, loadingState, errorState, emptyState, pageHead,
  statusBadge, fmtDate, toast, confirmDialog, openModal, closeModal,
} from "../ui.js";
import { navigate } from "../router.js";

export async function renderPages(_params, query) {
  const app = document.getElementById("app");
  const statusFilter = query.get("status") || "";
  app.innerHTML =
    pageHead("Pages", "Create, edit and publish site pages.", `<button class="btn btn-primary" id="new-page-btn">New page</button>`) +
    `<div class="card"><div class="btn-row" id="status-filter">
      ${["", "published", "draft"].map((s) => `
        <a class="btn btn-sm ${statusFilter === s ? "btn-primary" : ""}" href="#/pages${s ? `?status=${s}` : ""}">${s || "All"}</a>`).join("")}
    </div></div>
    <div class="card"><div id="pages-table">${loadingState()}</div></div>`;

  document.getElementById("new-page-btn").onclick = () => openCreateModal(() => renderPages(_params, query));

  try {
    const sb = await getSupabase();
    let q = sb.from("pages").select("id, slug, title, status, type, updated_at").order("updated_at", { ascending: false });
    if (statusFilter) q = q.eq("status", statusFilter);
    const { data, error } = await q;
    if (error) throw error;

    const tbl = document.getElementById("pages-table");
    if (!data.length) {
      tbl.innerHTML = emptyState("No pages yet. Create your first page to get started.");
      return;
    }
    tbl.innerHTML = `<div class="table-wrap"><table class="data">
      <thead><tr><th>Title</th><th>Slug</th><th>Type</th><th>Status</th><th>Updated</th><th></th></tr></thead>
      <tbody>${data.map((p) => `
        <tr>
          <td><strong>${esc(p.title || p.slug)}</strong></td>
          <td class="mono">/${esc(p.slug)}</td>
          <td class="muted small">${esc(p.type || "—")}</td>
          <td>${statusBadge(p.status)}</td>
          <td class="muted small">${fmtDate(p.updated_at)}</td>
          <td style="white-space:nowrap">
            <a class="btn btn-sm" href="#/pages/${encodeURIComponent(p.slug)}/edit">Edit</a>
            <button class="btn btn-sm btn-danger" data-del="${esc(p.id)}">Delete</button>
          </td>
        </tr>`).join("")}</tbody></table></div>`;

    tbl.querySelectorAll("[data-del]").forEach((btn) => {
      btn.onclick = async () => {
        if (!(await confirmDialog(`Delete this page permanently? This cannot be undone.`))) return;
        const { error: delErr } = await sb.from("pages").delete().eq("id", btn.dataset.del);
        if (delErr) toast(delErr.message, "error");
        else { toast("Page deleted."); renderPages(_params, query); }
      };
    });
  } catch (err) {
    document.getElementById("pages-table").innerHTML = errorState(err.message || String(err));
  }
}

function openCreateModal(onDone) {
  const modal = openModal(`
    <h3>New page</h3>
    <form id="create-page-form">
      <label class="field"><span>Title</span><input type="text" name="title" required placeholder="e.g. Sell Your Home in Caledonia" /></label>
      <label class="field"><span>Slug</span><input type="text" name="slug" required placeholder="e.g. sell-caledonia" pattern="[a-z0-9\\-]+" />
        <div class="field-hint">Lowercase letters, numbers and hyphens only. Used in the page URL.</div></label>
      <label class="field"><span>Type</span><input type="text" name="type" placeholder="e.g. landing, guide, city" /></label>
      <label class="field"><span>Status</span>
        <select name="status"><option value="draft">Draft</option><option value="published">Published</option></select></label>
      <p class="form-error" id="create-page-error" hidden></p>
      <div class="btn-row" style="justify-content:flex-end">
        <button type="button" class="btn" id="create-cancel">Cancel</button>
        <button type="submit" class="btn btn-primary">Create page</button>
      </div>
    </form>`);

  modal.querySelector("#create-cancel").onclick = closeModal;
  const form = modal.querySelector("#create-page-form");
  form.slug.addEventListener("input", () => {
    form.slug.value = form.slug.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
  });
  form.title.addEventListener("input", () => {
    if (!form.slug.dataset.touched) {
      form.slug.value = form.title.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    }
  });
  form.slug.addEventListener("change", () => { form.slug.dataset.touched = "1"; });

  form.onsubmit = async (e) => {
    e.preventDefault();
    const errBox = modal.querySelector("#create-page-error");
    errBox.hidden = true;
    try {
      const sb = await getSupabase();
      const payload = {
        title: form.title.value.trim(),
        slug: form.slug.value.trim(),
        type: form.type.value.trim() || null,
        status: form.status.value,
        blocks: [],
        seo: {},
      };
      const { error } = await sb.from("pages").insert(payload);
      if (error) throw error;
      closeModal();
      toast("Page created.");
      navigate(`/pages/${encodeURIComponent(payload.slug)}/edit`);
      onDone();
    } catch (err) {
      errBox.textContent = err.message || String(err);
      errBox.hidden = false;
    }
  };
}
