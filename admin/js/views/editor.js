// Page editor: edit title/slug/status, SEO fields, and the blocks[] array.
// Blocks come from blocks_library (id, category, label, name, description,
// block_type, props, prop_schema). Each page block is { type, props }.

import { getSupabase } from "../supabase.js";
import {
  esc, loadingState, errorState, emptyState, pageHead,
  statusBadge, toast, confirmDialog, openModal, closeModal,
} from "../ui.js";
import { listImagesWithUrls } from "../mediaApi.js";
import { navigate } from "../router.js";

let state = null; // { row, blocks, registry, registryById, dirty }

export async function renderEditor({ slug }) {
  const app = document.getElementById("app");
  app.innerHTML = loadingState("Loading page…");
  state = null;

  try {
    const sb = await getSupabase();
    const [{ data: row, error: pageErr }, { data: registry, error: regErr }] = await Promise.all([
      sb.from("pages").select("*").eq("slug", slug).single(),
      sb.from("blocks_library").select("id, category, label, name, description, block_type, props, prop_schema").order("category").order("label"),
    ]);
    if (regErr) console.warn("blocks_library load warning:", regErr.message);
    if (pageErr) throw pageErr;

    state = {
      row,
      blocks: Array.isArray(row.blocks) ? structuredClone(row.blocks) : [],
      registry: registry || [],
      registryById: Object.fromEntries((registry || []).map((r) => [r.id, r])),
      dirty: false,
    };
    renderAll(app);
  } catch (err) {
    app.innerHTML = pageHead("Edit page") + errorState(err.message || String(err));
  }
}

function markDirty() {
  if (!state.dirty) {
    state.dirty = true;
    const btn = document.getElementById("save-btn");
    if (btn) btn.disabled = false;
  }
}

function renderAll(app) {
  const { row, blocks } = state;
  const isPublished = row.status === "published";
  app.innerHTML = `
    ${pageHead(`Edit: ${row.title || row.slug}`, `/${row.slug}`, `
      <a class="btn" href="#/pages">← Pages</a>
      <button class="btn ${isPublished ? "" : "btn-primary"}" id="publish-btn">${isPublished ? "Unpublish" : "Publish"}</button>
      <button class="btn btn-primary" id="save-btn" ${state.dirty ? "" : "disabled"}>Save changes</button>`)}
    <div class="card">
      <h3>Page details</h3>
      <div class="field-row">
        <label class="field"><span>Title</span><input type="text" id="f-title" value="${esc(row.title || "")}" /></label>
        <label class="field"><span>Slug</span><input type="text" id="f-slug" value="${esc(row.slug || "")}" /></label>
      </div>
      <div class="field-row">
        <label class="field"><span>Type</span><input type="text" id="f-type" value="${esc(row.type || "")}" placeholder="e.g. landing, guide, city" /></label>
        <label class="field"><span>Status</span>
          <select id="f-status">
            <option value="draft" ${row.status === "draft" ? "selected" : ""}>Draft</option>
            <option value="published" ${row.status === "published" ? "selected" : ""}>Published</option>
          </select></label>
      </div>
    </div>
    <div class="card">
      <h3>SEO</h3>
      <label class="field"><span>Meta title</span><input type="text" id="seo-title" value="${esc(row.seo?.title || "")}" placeholder="Defaults to page title" /></label>
      <label class="field"><span>Meta description</span><textarea id="seo-description" placeholder="~150 characters">${esc(row.seo?.description || "")}</textarea></label>
      <div class="field-row">
        <label class="field"><span>OG image</span>
          <div style="display:flex;gap:8px"><input type="text" id="seo-og-image" value="${esc(row.seo?.og_image || "")}" placeholder="Image URL" />
          <button class="btn" type="button" id="seo-og-browse">Browse</button></div></label>
        <label class="field"><span>Canonical URL</span><input type="url" id="seo-canonical" value="${esc(row.seo?.canonical || "")}" placeholder="https://…" /></label>
      </div>
      <label class="check-row"><input type="checkbox" id="seo-noindex" ${row.seo?.noindex ? "checked" : ""} /> Noindex (hide from search engines)</label>
    </div>
    <div class="card">
      <div class="page-head" style="margin-bottom:12px">
        <div><h3 style="margin:0">Blocks <span class="muted small" id="block-count">(${blocks.length})</span></h3></div>
        <div class="btn-row"><button class="btn" id="add-block-btn">+ Add block</button></div>
      </div>
      <div id="block-list" class="block-list">${blocks.length ? "" : emptyState("No blocks yet. Add your first block above.")}</div>
    </div>`;

  // Details + SEO bindings
  for (const [id, key] of [["f-title", "title"], ["f-slug", "slug"], ["f-type", "type"]]) {
    app.querySelector(`#${id}`).addEventListener("input", (e) => { state.row[key] = e.target.value; markDirty(); });
  }
  app.querySelector("#f-status").addEventListener("change", (e) => { state.row.status = e.target.value; markDirty(); renderAll(app); });
  for (const [id, key] of [["seo-title", "title"], ["seo-description", "description"], ["seo-og-image", "og_image"], ["seo-canonical", "canonical"]]) {
    app.querySelector(`#${id}`).addEventListener("input", (e) => {
      state.row.seo = { ...(state.row.seo || {}), [key]: e.target.value };
      markDirty();
    });
  }
  app.querySelector("#seo-noindex").addEventListener("change", (e) => {
    state.row.seo = { ...(state.row.seo || {}), noindex: e.target.checked };
    markDirty();
  });
  app.querySelector("#seo-og-browse").onclick = () =>
    openImagePicker((url) => { app.querySelector("#seo-og-image").value = url; app.querySelector("#seo-og-image").dispatchEvent(new Event("input")); });

  app.querySelector("#save-btn").onclick = savePage;
  app.querySelector("#publish-btn").onclick = async () => {
    state.row.status = state.row.status === "published" ? "draft" : "published";
    await savePage();
  };
  app.querySelector("#add-block-btn").onclick = openAddBlockModal;

  renderBlockList();
}

function blockLabel(block) {
  const reg = state.registryById[block.type];
  return reg?.label || reg?.name || block.type;
}

function renderBlockList() {
  const list = document.getElementById("block-list");
  if (!list) return;
  if (!state.blocks.length) {
    list.innerHTML = emptyState("No blocks yet. Add your first block above.");
    return;
  }
  list.innerHTML = state.blocks.map((b, i) => {
    const preview = previewProps(b.props);
    return `<div class="block-item" data-idx="${i}">
      <div class="block-item-head">
        <span class="block-name">${esc(blockLabel(b))}</span>
        <span class="block-type">${esc(b.type)}</span>
        <span class="spacer"></span>
        <div class="block-controls">
          <button class="btn" data-act="up" ${i === 0 ? "disabled" : ""} title="Move up">↑</button>
          <button class="btn" data-act="down" ${i === state.blocks.length - 1 ? "disabled" : ""} title="Move down">↓</button>
          <button class="btn" data-act="dup" title="Duplicate">⧉</button>
          <button class="btn" data-act="collapse" title="Collapse/expand">–</button>
          <button class="btn btn-danger" data-act="del" title="Delete">✕</button>
        </div>
      </div>
      <div class="block-item-body" data-body>${propFieldsHtml(b, i)}</div>
      <div class="block-preview" data-preview hidden>${esc(preview)}</div>
    </div>`;
  }).join("");

  list.querySelectorAll(".block-item").forEach((item) => {
    const idx = Number(item.dataset.idx);
    bindPropInputs(item, idx);
    item.querySelectorAll("[data-act]").forEach((btn) => {
      btn.onclick = () => blockAction(idx, btn.dataset.act, item);
    });
  });
}

function blockAction(idx, act, item) {
  const b = state.blocks;
  if (act === "up" && idx > 0) [b[idx - 1], b[idx]] = [b[idx], b[idx - 1]];
  else if (act === "down" && idx < b.length - 1) [b[idx + 1], b[idx]] = [b[idx], b[idx + 1]];
  else if (act === "dup") b.splice(idx + 1, 0, structuredClone(b[idx]));
  else if (act === "del") {
    confirmDialog(`Delete the "${blockLabel(b[idx])}" block?`).then((yes) => {
      if (yes) { b.splice(idx, 1); markDirty(); renderBlockList(); renderCount(); }
    });
    return;
  } else if (act === "collapse") {
    const body = item.querySelector("[data-body]");
    const prev = item.querySelector("[data-preview]");
    const collapsed = body.classList.toggle("collapsed");
    prev.hidden = !collapsed;
    btn.textContent = collapsed ? "+" : "–";
    return;
  }
  markDirty();
  renderBlockList();
  renderCount();
}

function renderCount() {
  const el = document.getElementById("block-count");
  if (el) el.textContent = `(${state.blocks.length})`;
}

// ---------- Prop fields ----------

function detectType(key, value) {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (Array.isArray(value) || (value !== null && typeof value === "object")) return "json";
  const k = key.toLowerCase();
  if (/image|img|thumbnail|photo|picture|logo|banner|og_image|avatar/.test(k)) return "image";
  if (/(^|_)url$|^link$|^href$|cta_url|button_url/.test(k)) return "url";
  const v = String(value ?? "");
  if (v.length > 120 || /text|content|body|description|excerpt|bio|caption/.test(k)) return "textarea";
  return "text";
}

// Build starter props for a fresh block: registry defaults plus an empty
// value for every prop_schema key, so the prop form is never blank.
function defaultProps(reg) {
  const base = reg && reg.props && typeof reg.props === "object" ? structuredClone(reg.props) : {};
  const ps = reg?.prop_schema;
  const schema = ps && typeof ps === "object"
    ? (ps.properties && typeof ps.properties === "object" ? ps.properties : ps)
    : null;
  if (schema) {
    for (const key of Object.keys(schema)) {
      if (!(key in base)) {
        const t = schema[key]?.type;
        base[key] = t === "boolean" ? false : t === "number" ? null : t === "array" ? [] : t === "object" ? {} : "";
      }
    }
  }
  return base;
}

function fieldSpec(block, key, value) {
  // prop_schema is a flat { key: {type,label,...} } map in this database
  // (some rows use JSON-Schema style with a nested `properties` object).
  const ps = state.registryById[block.type]?.prop_schema;
  const schemaProps = ps && typeof ps === "object"
    ? (ps.properties && typeof ps.properties === "object" ? ps.properties : ps)
    : null;
  const s = schemaProps?.[key];
  if (s && typeof s === "object") {
    return {
      type: s.type || detectType(key, value),
      label: s.label || key,
      options: Array.isArray(s.options) ? s.options : [],
      hint: s.hint || "",
    };
  }
  return { type: detectType(key, value), label: key, options: [], hint: "" };
}

function propFieldsHtml(block, idx) {
  const props = block.props && typeof block.props === "object" ? block.props : {};
  const keys = Object.keys(props);
  if (!keys.length) return `<p class="muted small">This block has no editable props.</p>`;
  return keys.map((key) => {
    const spec = fieldSpec(block, key, props[key]);
    const v = props[key];
    const dataAttr = `data-block="${idx}" data-key="${esc(key)}"`;
    const hint = spec.hint ? `<div class="field-hint">${esc(spec.hint)}</div>` : "";
    switch (spec.type) {
      case "boolean":
        return `<label class="check-row"><input type="checkbox" ${dataAttr} ${v ? "checked" : ""} /> ${esc(spec.label)}</label>`;
      case "number":
        return `<label class="field"><span>${esc(spec.label)}</span><input type="number" ${dataAttr} value="${esc(v ?? "")}" />${hint}</label>`;
      case "select": {
        const opts = spec.options.map((o) => {
          const val = typeof o === "object" ? o.value : o;
          const lab = typeof o === "object" ? (o.label ?? o.value) : o;
          return `<option value="${esc(val)}" ${String(val) === String(v) ? "selected" : ""}>${esc(lab)}</option>`;
        }).join("");
        return `<label class="field"><span>${esc(spec.label)}</span><select ${dataAttr}><option value="">—</option>${opts}</select>${hint}</label>`;
      }
      case "image":
        return `<label class="field"><span>${esc(spec.label)}</span>
          <div style="display:flex;gap:8px"><input type="text" ${dataAttr} value="${esc(v ?? "")}" placeholder="Image URL" />
          <button class="btn" type="button" data-browse="${idx}" data-bkey="${esc(key)}">Browse</button></div>${hint}</label>`;
      case "url":
        return `<label class="field"><span>${esc(spec.label)}</span><input type="url" ${dataAttr} value="${esc(v ?? "")}" placeholder="https://" />${hint}</label>`;
      case "textarea":
        return `<label class="field"><span>${esc(spec.label)}</span><textarea ${dataAttr}>${esc(v ?? "")}</textarea>${hint}</label>`;
      case "json":
        return `<label class="field"><span>${esc(spec.label)} <span class="muted">(JSON)</span></span><textarea class="mono" ${dataAttr}>${esc(JSON.stringify(v, null, 2))}</textarea>${hint}</label>`;
      default:
        return `<label class="field"><span>${esc(spec.label)}</span><input type="text" ${dataAttr} value="${esc(v ?? "")}" />${hint}</label>`;
    }
  }).join("");
}

function bindPropInputs(item, idx) {
  const block = state.blocks[idx];
  item.querySelectorAll("[data-block][data-key]").forEach((input) => {
    const key = input.dataset.key;
    const apply = () => {
      const spec = fieldSpec(block, key, block.props?.[key]);
      let val;
      if (spec.type === "boolean") val = input.checked;
      else if (spec.type === "number") val = input.value === "" ? null : Number(input.value);
      else if (spec.type === "json") {
        try { val = JSON.parse(input.value); input.style.borderColor = ""; }
        catch { input.style.borderColor = "var(--color-danger)"; return; }
      } else val = input.value;
      block.props = { ...(block.props || {}), [key]: val };
      markDirty();
    };
    input.addEventListener(input.type === "checkbox" ? "change" : "input", apply);
  });
  item.querySelectorAll("[data-browse]").forEach((btn) => {
    btn.onclick = () => {
      const key = btn.dataset.bkey;
      openImagePicker((url) => {
        const input = item.querySelector(`[data-block="${idx}"][data-key="${CSS.escape(key)}"]`);
        if (input) {
          input.value = url;
          input.dispatchEvent(new Event("input"));
        }
      });
    };
  });
}

function previewProps(props) {
  if (!props || typeof props !== "object") return "";
  return Object.entries(props)
    .slice(0, 4)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? "{…}" : String(v).slice(0, 40)}`)
    .join(" · ");
}

// ---------- Add block ----------

function openAddBlockModal() {
  const cats = {};
  for (const r of state.registry) {
    const c = r.category || "general";
    (cats[c] ||= []).push(r);
  }
  const modal = openModal(`
    <h3>Add block</h3>
    <label class="field"><span>Search</span><input type="text" id="block-search" placeholder="Filter blocks…" /></label>
    <div id="add-block-list">
      ${Object.entries(cats).map(([cat, rows]) => `
        <p class="add-block-cat" data-cat>${esc(cat)}</p>
        <div class="add-block-grid" data-catgrid>
          ${rows.map((r) => `
            <div class="add-block-card" data-add="${esc(r.id)}" data-search="${esc(((r.label || r.name || "") + " " + (r.description || "") + " " + r.id).toLowerCase())}">
              <h4>${esc(r.label || r.name || r.id)}</h4>
              <p>${esc(r.description || r.id)}${r.block_type === "preset" ? " · preset" : ""}</p>
            </div>`).join("")}
        </div>`).join("") || emptyState("No blocks in the library yet.")}
    </div>
    <div class="btn-row" style="justify-content:flex-end;margin-top:16px">
      <button class="btn" id="addblock-cancel">Cancel</button>
    </div>`);

  modal.querySelector("#addblock-cancel").onclick = closeModal;
  const search = modal.querySelector("#block-search");
  search.addEventListener("input", () => {
    const q = search.value.toLowerCase();
    modal.querySelectorAll("[data-add]").forEach((card) => {
      card.style.display = card.dataset.search.includes(q) ? "" : "none";
    });
    modal.querySelectorAll("[data-catgrid]").forEach((grid) => {
      const visible = [...grid.querySelectorAll("[data-add]")].some((c) => c.style.display !== "none");
      grid.style.display = visible ? "" : "none";
      grid.previousElementSibling.style.display = visible ? "" : "none";
    });
  });
  search.focus();

  modal.querySelectorAll("[data-add]").forEach((card) => {
    card.onclick = () => {
      const reg = state.registryById[card.dataset.add];
      if (!reg) return;
      if (reg.block_type === "preset" && Array.isArray(reg.blocks)) {
        for (const b of reg.blocks) state.blocks.push(structuredClone(b));
        toast(`Inserted preset (${reg.blocks.length} blocks).`);
      } else {
        state.blocks.push({ type: reg.id, props: defaultProps(reg) });
        toast(`Added "${reg.label || reg.name || reg.id}".`);
      }
      closeModal();
      markDirty();
      renderBlockList();
    };
  });
}

// ---------- Image picker ----------

let mediaCache = null;
async function openImagePicker(onSelect) {
  const modal = openModal(`<h3>Choose image</h3><div id="picker-grid">${loadingState()}</div>
    <div class="btn-row" style="justify-content:flex-end;margin-top:16px"><button class="btn" id="picker-cancel">Cancel</button></div>`);
  modal.querySelector("#picker-cancel").onclick = closeModal;
  const grid = modal.querySelector("#picker-grid");
  try {
    mediaCache = await listImagesWithUrls();
    if (!mediaCache.length) { grid.innerHTML = emptyState("No images in the library yet."); return; }
    grid.innerHTML = `<div class="media-grid">${mediaCache.map((img, i) => `
      <div class="media-card" data-pick="${i}" style="cursor:pointer">
        <div class="media-thumb"><img src="${esc(img.url)}" alt="" loading="lazy" /></div>
        <div class="media-body"><div class="media-name">${esc(img.name || img.path)}</div></div>
      </div>`).join("")}</div>`;
    grid.querySelectorAll("[data-pick]").forEach((card) => {
      card.onclick = () => { onSelect(mediaCache[Number(card.dataset.pick)].url); closeModal(); };
    });
  } catch (err) {
    grid.innerHTML = errorState(err.message || String(err));
  }
}

// ---------- Save ----------

async function savePage() {
  const btn = document.getElementById("save-btn");
  btn.disabled = true;
  btn.textContent = "Saving…";
  try {
    const sb = await getSupabase();
    const { row, blocks } = state;
    const { error } = await sb.from("pages").update({
      title: row.title || row.slug,
      slug: row.slug,
      type: row.type || null,
      status: row.status,
      blocks,
      seo: row.seo || {},
    }).eq("id", row.id);
    if (error) throw error;
    state.dirty = false;
    toast("Page saved.");
    if (window.location.hash !== `#/pages/${encodeURIComponent(row.slug)}/edit`) {
      navigate(`/pages/${encodeURIComponent(row.slug)}/edit`);
    } else {
      renderAll(document.getElementById("app"));
    }
  } catch (err) {
    toast(err.message || String(err), "error");
    btn.disabled = false;
    btn.textContent = "Save changes";
  }
}
