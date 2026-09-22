// Media library: grid of images via image_assignments join images.
// Upload goes to the `media` storage bucket, then inserts images row +
// image_assignments row. Delete removes assignments + images row + object.

import { listImagesWithUrls, uploadImage, deleteImage, RELATED_TYPES } from "../mediaApi.js";
import {
  esc, loadingState, errorState, emptyState, pageHead,
  toast, confirmDialog, openModal, closeModal,
} from "../ui.js";

export async function renderMedia() {
  const app = document.getElementById("app");
  app.innerHTML =
    pageHead("Media", "Images stored in the media bucket, linked via image assignments.",
      `<button class="btn btn-primary" id="upload-btn">Upload image</button>`) +
    `<div class="card"><div id="media-grid">${loadingState()}</div></div>`;

  document.getElementById("upload-btn").onclick = () => openUploadModal(renderMedia);

  try {
    const withUrls = await listImagesWithUrls();
    const grid = document.getElementById("media-grid");
    if (!withUrls.length) { grid.innerHTML = emptyState("No images yet. Upload your first image."); return; }

    grid.innerHTML = `<div class="media-grid">${withUrls.map((img) => `
      <div class="media-card">
        <div class="media-thumb"><a href="${esc(img.url)}" target="_blank" rel="noopener"><img src="${esc(img.url)}" alt="" loading="lazy" /></a></div>
        <div class="media-body">
          <div class="media-name">${esc(img.name || img.path)}</div>
          <div class="media-assign">
            ${(img.image_assignments || []).map((a) => `<span class="badge badge-info">${esc(a.related_type)}${a.related_id ? ` · ${esc(String(a.related_id).slice(0, 8))}` : ""}</span>`).join("") || `<span class="muted small">unassigned</span>`}
          </div>
          <div class="btn-row">
            <button class="btn btn-sm" data-copy="${esc(img.url)}">Copy URL</button>
            <button class="btn btn-sm btn-danger" data-del="${esc(img.id)}" data-path="${esc(img.path)}">Delete</button>
          </div>
        </div>
      </div>`).join("")}</div>`;

    grid.querySelectorAll("[data-copy]").forEach((btn) => {
      btn.onclick = async () => {
        try { await navigator.clipboard.writeText(btn.dataset.copy); toast("URL copied."); }
        catch { toast("Copy failed — long-press the image link instead.", "error"); }
      };
    });
    grid.querySelectorAll("[data-del]").forEach((btn) => {
      btn.onclick = async () => {
        if (!(await confirmDialog("Delete this image and all its assignments? The file will be removed from storage."))) return;
        try {
          await deleteImage(btn.dataset.del, btn.dataset.path);
          toast("Image deleted.");
          renderMedia();
        } catch (err) { toast(err.message || String(err), "error"); }
      };
    });
  } catch (err) {
    document.getElementById("media-grid").innerHTML = errorState(err.message || String(err));
  }
}

function openUploadModal(onDone) {
  const modal = openModal(`
    <h3>Upload image</h3>
    <form id="upload-form">
      <label class="field"><span>File</span><input type="file" name="file" accept="image/*" required /></label>
      <div class="field-row">
        <label class="field"><span>Assign to type <span class="muted">(optional)</span></span>
          <select name="related_type"><option value="">— unassigned —</option>
          ${RELATED_TYPES.map((t) => `<option value="${t}">${t}</option>`).join("")}</select></label>
        <label class="field"><span>Related ID <span class="muted">(optional)</span></span>
          <input type="text" name="related_id" placeholder="uuid / bigint id" /></label>
      </div>
      <p class="form-error" id="upload-error" hidden></p>
      <div class="btn-row" style="justify-content:flex-end">
        <button type="button" class="btn" id="upload-cancel">Cancel</button>
        <button type="submit" class="btn btn-primary" id="upload-submit">Upload</button>
      </div>
    </form>`);
  modal.querySelector("#upload-cancel").onclick = closeModal;
  const form = modal.querySelector("#upload-form");
  form.onsubmit = async (e) => {
    e.preventDefault();
    const errBox = modal.querySelector("#upload-error");
    errBox.hidden = true;
    const file = form.file.files[0];
    if (!file) return;
    const btn = modal.querySelector("#upload-submit");
    btn.disabled = true;
    btn.textContent = "Uploading…";
    try {
      await uploadImage(file, {
        related_type: form.related_type.value || undefined,
        related_id: form.related_id.value.trim() || undefined,
      });
      closeModal();
      toast("Image uploaded.");
      onDone();
    } catch (err) {
      errBox.textContent = err.message || String(err);
      errBox.hidden = false;
      btn.disabled = false;
      btn.textContent = "Upload";
    }
  };
}
