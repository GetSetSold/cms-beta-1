// Shared UI helpers: escaping, loading/error/empty states, toasts, modal, drawer.

// Escape user content before injecting into HTML.
export function esc(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function loadingState(label = "Loading…") {
  return `<div class="state"><div class="spinner"></div><div>${esc(label)}</div></div>`;
}

export function errorState(message) {
  return `<div class="alert-error"><strong>Something went wrong.</strong><br>${esc(message)}</div>`;
}

export function emptyState(message) {
  return `<div class="empty">${esc(message)}</div>`;
}

export function pageHead(title, sub = "", actions = "") {
  return `<div class="page-head">
    <div><h2>${esc(title)}</h2>${sub ? `<p class="sub">${esc(sub)}</p>` : ""}</div>
    <div class="btn-row">${actions}</div>
  </div>`;
}

export function statusBadge(status) {
  const s = String(status || "").toLowerCase();
  const map = {
    published: "badge-published", active: "badge-active",
    draft: "badge-draft", inactive: "badge-inactive",
    new: "badge-info", unread: "badge-info",
    contacted: "badge-warning", qualified: "badge-warning",
    converted: "badge-success", closed: "badge-success", won: "badge-success",
    lost: "badge-danger", spam: "badge-danger", archived: "badge-neutral",
  };
  return `<span class="badge ${map[s] || "badge-neutral"}">${esc(status || "—")}</span>`;
}

export function fmtDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return esc(value);
  return d.toLocaleString("en-CA", {
    year: "numeric", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

export function shortId(id) {
  const s = String(id || "");
  return s.length > 8 ? s.slice(0, 8) + "…" : s;
}

// ---- Toasts ----
export function toast(message, kind = "") {
  const root = document.getElementById("toast-root");
  const el = document.createElement("div");
  el.className = `toast ${kind === "error" ? "toast-error" : ""}`;
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

// ---- Drawer (right slide-over) ----
export function openDrawer(html) {
  closeDrawer();
  const backdrop = document.createElement("div");
  backdrop.className = "drawer-backdrop";
  backdrop.id = "drawer-backdrop";
  const drawer = document.createElement("div");
  drawer.className = "drawer";
  drawer.id = "drawer";
  drawer.innerHTML = html;
  backdrop.addEventListener("click", closeDrawer);
  document.body.append(backdrop, drawer);
  return drawer;
}

export function closeDrawer() {
  document.getElementById("drawer-backdrop")?.remove();
  document.getElementById("drawer")?.remove();
}

// ---- Modal ----
export function openModal(html) {
  closeModal();
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.id = "modal-backdrop";
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.id = "modal";
  modal.innerHTML = html;
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeModal();
  });
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
  return modal;
}

export function closeModal() {
  document.getElementById("modal-backdrop")?.remove();
}

// ---- Confirm dialog ----
export function confirmDialog(message) {
  return new Promise((resolve) => {
    const modal = openModal(`
      <h3>Are you sure?</h3>
      <p>${esc(message)}</p>
      <div class="btn-row" style="justify-content:flex-end">
        <button class="btn" id="confirm-no">Cancel</button>
        <button class="btn btn-danger" id="confirm-yes">Delete</button>
      </div>`);
    modal.querySelector("#confirm-no").onclick = () => { closeModal(); resolve(false); };
    modal.querySelector("#confirm-yes").onclick = () => { closeModal(); resolve(true); };
  });
}

// Best-effort display name from a contact row (schema-tolerant).
export function contactName(c) {
  if (!c) return "—";
  return c.name || [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || "—";
}
