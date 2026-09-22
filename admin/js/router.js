// Hash router. Routes are registered as [pattern, handler] where pattern may
// contain :param segments. Handlers receive (params, query) and render into #app.

const routes = [];

export function addRoute(pattern, handler) {
  routes.push({ pattern, handler });
}

function matchRoute(path) {
  for (const { pattern, handler } of routes) {
    const pSegs = pattern.split("/");
    const pathSegs = path.split("/");
    if (pSegs.length !== pathSegs.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < pSegs.length; i++) {
      if (pSegs[i].startsWith(":")) {
        params[pSegs[i].slice(1)] = decodeURIComponent(pathSegs[i]);
      } else if (pSegs[i] !== pathSegs[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return { handler, params };
  }
  return null;
}

function currentPath() {
  const hash = window.location.hash || "#/dashboard";
  const [path, queryStr] = hash.slice(1).split("?");
  return { path: path || "/dashboard", query: new URLSearchParams(queryStr || "") };
}

export function navigate(path) {
  window.location.hash = "#" + path;
}

let currentHandler = null;

export async function render() {
  const { path, query } = currentPath();
  const matched = matchRoute(path);
  const app = document.getElementById("app");
  const nav = document.getElementById("main-nav");

  if (!matched) {
    navigate("/dashboard");
    return;
  }

  // Highlight active nav item (top-level section only)
  const section = path.split("/")[1];
  nav.querySelectorAll("a").forEach((a) => {
    a.classList.toggle("active", a.dataset.route === section);
  });

  window.scrollTo(0, 0);
  currentHandler = matched.handler;
  try {
    await matched.handler(matched.params, query);
  } catch (err) {
    console.error(err);
    app.innerHTML = `<div class="alert-error"><strong>View failed to render.</strong><br>${err.message || err}</div>`;
  }
}

export function startRouter() {
  window.addEventListener("hashchange", render);
  render();
}
