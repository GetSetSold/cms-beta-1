// Site settings: form bound to the single site_settings row (id=1).
// Brand/contact/social fields are rendered only if the column exists on the
// row; header/footer style columns are known from the migration.

import { getSupabase } from "../supabase.js";
import {
  esc, loadingState, errorState, pageHead, toast,
} from "../ui.js";

const BRAND_FIELDS = [
  { col: "business_name", label: "Business name", type: "text", ph: "GetSetSold" },
  { col: "brand_color", label: "Brand colour", type: "color", ph: "#2456e6" },
  { col: "phone", label: "Phone", type: "text", ph: "416-605-7488" },
  { col: "email", label: "Email", type: "email", ph: "hello@getsetsold.ca" },
  { col: "agent_name", label: "Agent name", type: "text", ph: "Rohit Sharma" },
  { col: "brokerage_name", label: "Brokerage", type: "text", ph: "Lombard Group Real Estate Inc." },
  { col: "logo_url", label: "Logo URL", type: "url", ph: "https://" },
  { col: "favicon_url", label: "Favicon URL", type: "url", ph: "https://" },
  { col: "agent_image_url", label: "Agent photo URL", type: "url", ph: "https://" },
  { col: "address", label: "Address", type: "text", ph: "" },
  { col: "license_text", label: "License / RECO text", type: "text", ph: "" },
];

const SOCIAL_FIELDS = ["facebook", "instagram", "linkedin", "youtube", "x"];

const STYLE_FIELDS = [
  { col: "header_style", label: "Header style", type: "text" },
  { col: "footer_style", label: "Footer style", type: "text" },
  { col: "mobile_menu_style", label: "Mobile menu style", type: "text" },
  { col: "header_fixed_desktop", label: "Fixed header (desktop)", type: "boolean" },
  { col: "header_fixed_mobile", label: "Fixed header (mobile)", type: "boolean" },
];

export async function renderSettings() {
  const app = document.getElementById("app");
  app.innerHTML = pageHead("Site settings", "Global settings shared by the public site.") +
    `<div class="card"><div id="settings-form">${loadingState()}</div></div>`;

  try {
    const sb = await getSupabase();
    const { data: row, error } = await sb.from("site_settings").select("*").eq("id", 1).single();
    if (error) throw error;

    const box = document.getElementById("settings-form");
    const has = (col) => Object.prototype.hasOwnProperty.call(row, col);

    const brandHtml = BRAND_FIELDS.filter((f) => has(f.col)).map((f) =>
      f.type === "color"
        ? `<label class="field"><span>${esc(f.label)}</span>
            <div style="display:flex;gap:8px"><input type="color" id="set-${f.col}" value="${esc(row[f.col] || "#2456e6")}" style="width:56px;height:38px;padding:2px" />
            <input type="text" id="set-${f.col}-text" value="${esc(row[f.col] || "")}" placeholder="${esc(f.ph)}" /></div></label>`
        : `<label class="field"><span>${esc(f.label)}</span><input type="${f.type}" id="set-${f.col}" value="${esc(row[f.col] || "")}" placeholder="${esc(f.ph)}" /></label>`
    ).join("");

    const social = has("social") && row.social && typeof row.social === "object" ? row.social : {};
    const socialHtml = has("social") ? SOCIAL_FIELDS.map((s) =>
      `<label class="field"><span style="text-transform:capitalize">${esc(s)}</span><input type="url" id="set-social-${s}" value="${esc(social[s] || "")}" placeholder="https://" /></label>`
    ).join("") : "";

    const styleHtml = STYLE_FIELDS.filter((f) => has(f.col)).map((f) =>
      f.type === "boolean"
        ? `<label class="check-row"><input type="checkbox" id="set-${f.col}" ${row[f.col] ? "checked" : ""} /> ${esc(f.label)}</label>`
        : `<label class="field"><span>${esc(f.label)}</span><input type="text" id="set-${f.col}" value="${esc(row[f.col] || "")}" /></label>`
    ).join("");

    const jsonHtml = ["nav_items", "footer_links"].filter(has).map((col) =>
      `<label class="field"><span>${esc(col)} <span class="muted">(JSON)</span></span><textarea class="mono" id="set-${col}">${esc(JSON.stringify(row[col] ?? [], null, 2))}</textarea></label>`
    ).join("");

    box.innerHTML = `
      <form id="settings-save-form">
        ${brandHtml ? `<h3>Brand & contact</h3>${brandHtml}` : ""}
        ${socialHtml ? `<h3>Social links</h3><div class="field-row">${socialHtml}</div>` : ""}
        ${styleHtml ? `<h3>Header / footer</h3>${styleHtml}` : ""}
        ${jsonHtml ? `<h3>Navigation</h3>${jsonHtml}` : ""}
        ${!brandHtml && !socialHtml && !styleHtml && !jsonHtml ? `<p class="muted">No editable settings columns found on this row.</p>` : ""}
        <p class="form-error" id="settings-error" hidden></p>
        <div class="btn-row"><button type="submit" class="btn btn-primary" id="settings-submit">Save settings</button></div>
      </form>`;

    // Keep color picker + text in sync
    if (has("brand_color")) {
      const picker = box.querySelector("#set-brand_color");
      const text = box.querySelector("#set-brand_color-text");
      if (picker && text) {
        picker.addEventListener("input", () => { text.value = picker.value; });
        text.addEventListener("input", () => { if (/^#[0-9a-fA-F]{6}$/.test(text.value)) picker.value = text.value; });
      }
    }

    box.querySelector("#settings-save-form").onsubmit = async (e) => {
      e.preventDefault();
      const errBox = box.querySelector("#settings-error");
      errBox.hidden = true;
      const btn = box.querySelector("#settings-submit");
      btn.disabled = true;
      try {
        const update = {};
        for (const f of BRAND_FIELDS) {
          if (!has(f.col)) continue;
          update[f.col] = f.type === "color"
            ? box.querySelector("#set-brand_color-text").value.trim()
            : box.querySelector(`#set-${f.col}`).value.trim() || null;
        }
        if (has("social")) {
          const s = {};
          for (const name of SOCIAL_FIELDS) {
            const v = box.querySelector(`#set-social-${name}`).value.trim();
            if (v) s[name] = v;
          }
          update.social = s;
        }
        for (const f of STYLE_FIELDS) {
          if (!has(f.col)) continue;
          update[f.col] = f.type === "boolean"
            ? box.querySelector(`#set-${f.col}`).checked
            : box.querySelector(`#set-${f.col}`).value.trim() || null;
        }
        for (const col of ["nav_items", "footer_links"]) {
          if (!has(col)) continue;
          try { update[col] = JSON.parse(box.querySelector(`#set-${col}`).value || "[]"); }
          catch { throw new Error(`${col} is not valid JSON.`); }
        }
        const { error: upErr } = await sb.from("site_settings").update(update).eq("id", 1);
        if (upErr) throw upErr;
        toast("Settings saved.");
      } catch (err) {
        errBox.textContent = err.message || String(err);
        errBox.hidden = false;
      } finally {
        btn.disabled = false;
      }
    };
  } catch (err) {
    document.getElementById("settings-form").innerHTML = errorState(err.message || String(err));
  }
}
