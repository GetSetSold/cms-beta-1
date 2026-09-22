/**
 * Block renderers for the GetSetSold.ca public site.
 *
 * Every block is an async function `(props, ctx) => string` returning an
 * HTML string. `props` comes from the page's `blocks` JSONB array
 * (`{type|block_type, props}`); `ctx` is built per-request in src/index.js:
 *
 *   ctx = {
 *     env, settings, baseUrl, pageSlug,
 *     sb(table, query, opts)  // CMS Supabase REST read (anon key)
 *     mls(table, query)       // MLS Supabase REST read (read-only)
 *     ld: []                  // JSON-LD objects collected during render
 *     lib: Set               // validated block-type ids from blocks_library
 *   }
 *
 * All interpolated data MUST go through esc(). Renderers that cannot
 * satisfy their data needs fail soft: they return an HTML comment.
 */

import { renderListingDetail } from './listing-detail.js';

export const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

/** Join truthy class names. */
const cx = (...parts) => parts.filter(Boolean).join(' ');

/** Safe https/http URL for href/src attributes; falls back to '#'. */
export function safeUrl(u, fallback = '#') {
  const s = String(u ?? '').trim();
  return /^(https?:\/\/|\/|#|mailto:|tel:)/i.test(s) ? s : fallback;
}

/**
 * Parse a prop that may already be an array, a JSON string, or a
 * Python-repr string (single quotes, True/False/None) as stored by the
 * previous page builder. Always returns an array (possibly empty).
 */
function parseList(v) {
  if (Array.isArray(v)) return v;
  if (v == null) return [];
  const s = String(v).trim();
  if (!s || s === 'None' || s === '[]') return [];
  try {
    const j = JSON.parse(s);
    return Array.isArray(j) ? j : [];
  } catch { /* fall through to repr parsing */ }
  try {
    const jsonish = s
      .replace(/'/g, '"')
      .replace(/\bNone\b/g, 'null')
      .replace(/\bTrue\b/g, 'true')
      .replace(/\bFalse\b/g, 'false');
    const j = JSON.parse(jsonish);
    return Array.isArray(j) ? j : [];
  } catch {
    return [];
  }
}

/** Section background variants. */
function bgClass(variant) {
  return { light: 'gss-bg-light', dark: 'gss-bg-dark', accent: 'gss-bg-accent', image: 'gss-bg-image' }[variant] || '';
}

// ---------------------------------------------------------------------------
// Shared: form field builders for lead-capture blocks
// ---------------------------------------------------------------------------

function fieldHtml(f) {
  const req = f.required ? ' required' : '';
  const label = `<label class="gss-field"><span class="gss-label">${esc(f.label)}${f.required ? ' *' : ''}</span>`;
  const name = ` name="${esc(f.name)}"`;
  let input;
  if (f.type === 'textarea') {
    input = `<textarea${name} rows="4" placeholder="${esc(f.placeholder || '')}"${req}></textarea>`;
  } else if (f.type === 'select') {
    const opts = (f.options || []).map((o) => {
      const v = typeof o === 'string' ? o : o.value;
      const l = typeof o === 'string' ? o : (o.label || o.value);
      return `<option value="${esc(v)}">${esc(l)}</option>`;
    }).join('');
    input = `<select${name}${req}><option value="">Select…</option>${opts}</select>`;
  } else {
    input = `<input type="${esc(f.type || 'text')}"${name} placeholder="${esc(f.placeholder || '')}"${req}${
      f.inputmode ? ` inputmode="${esc(f.inputmode)}"` : ''}${f.pattern ? ` pattern="${esc(f.pattern)}"` : ''}>`;
  }
  return label + input + '</label>';
}

/**
 * Standard lead-capture <form>. POSTs JSON to /api/leads; a global
 * submit handler (inlined by src/index.js) intercepts it.
 */
export function leadForm({ formType, title, subtitle, fields, submitLabel, note, id }) {
  const fid = esc(id || `gss-form-${formType}`);
  return `<form id="${fid}" class="gss-form gss-card" data-gss-form data-form-type="${esc(formType)}" novalidate>
    <input type="text" name="company" class="gss-honeypot" tabindex="-1" autocomplete="off" aria-hidden="true">
    ${title ? `<h3 class="gss-form-title">${esc(title)}</h3>` : ''}
    ${subtitle ? `<p class="gss-form-sub">${esc(subtitle)}</p>` : ''}
    <div class="gss-form-grid">${fields.map(fieldHtml).join('')}</div>
    <button type="submit" class="gss-btn gss-btn-accent gss-btn-block">${esc(submitLabel || 'Submit')}</button>
    ${note ? `<p class="gss-form-note">${esc(note)}</p>` : ''}
    <p class="gss-form-msg" role="status" aria-live="polite"></p>
  </form>`;
}

// ---------------------------------------------------------------------------
// LAYOUT
// ---------------------------------------------------------------------------

const DEFAULT_NAV = [
  { label: 'Buy', href: '/buy' },
  { label: 'Sell', href: '/sell' },
  { label: 'Pre-Construction', href: '/pre-construction' },
  { label: 'Neighbourhoods', href: '/neighbourhoods' },
  { label: 'Guides', href: '/guides' },
  { label: 'Contact', href: '/contact' },
];

async function site_header(props, ctx) {
  const s = ctx.settings || {};
  const brand = esc(s.business_name || 'GetSetSold');
  const logo = s.logo_url ? `<img src="${esc(safeUrl(s.logo_url))}" alt="${brand}" class="gss-logo-img">` : '';
  const navItems = (Array.isArray(s.nav_items) && s.nav_items.length ? s.nav_items : DEFAULT_NAV);
  const nav = navItems.map((n) =>
    `<li><a href="${esc(safeUrl(n.href || n.url || '#'))}">${esc(n.label || n.title || '')}</a></li>`).join('');
  const phone = s.phone ? `<a class="gss-header-phone" href="tel:${esc(String(s.phone).replace(/[^+\d]/g, ''))}">${esc(s.phone)}</a>` : '';
  const fixed = s.header_fixed_desktop === false ? '' : ' gss-header-fixed';
  return `<header class="gss-header${fixed}">
    <div class="gss-container gss-header-inner">
      <a href="/" class="gss-brand" aria-label="${brand} home">${logo}<span class="gss-brand-text">${brand}<span class="gss-brand-dot">.</span></span></a>
      <nav class="gss-nav" aria-label="Primary"><ul>${nav}</ul></nav>
      <div class="gss-header-actions">${phone}<a href="/contact" class="gss-btn gss-btn-accent gss-btn-sm">Free Valuation</a></div>
      <button class="gss-nav-toggle" aria-label="Open menu" aria-expanded="false"><span></span><span></span><span></span></button>
    </div>
  </header>`;
}

async function site_footer(props, ctx) {
  const s = ctx.settings || {};
  const brand = esc(s.business_name || 'GetSetSold');
  const cols = (Array.isArray(s.footer_links) && s.footer_links.length ? s.footer_links : [
    { heading: 'Buy', links: [{ label: 'Homes for Sale', href: '/buy' }, { label: 'Pre-Construction', href: '/pre-construction' }, { label: 'VIP Buyer Program', href: '/vip-buyer' }] },
    { heading: 'Sell', links: [{ label: 'Free Home Valuation', href: '/home-valuation' }, { label: '1% Listing Program', href: '/sell' }] },
    { heading: 'Resources', links: [{ label: 'Guides', href: '/guides' }, { label: 'Neighbourhoods', href: '/neighbourhoods' }, { label: 'Blog', href: '/blog' }] },
  ]);
  const colHtml = cols.map((c) => `<div class="gss-footer-col"><h4>${esc(c.heading || '')}</h4><ul>${
    (c.links || []).map((l) => `<li><a href="${esc(safeUrl(l.href || l.url || '#'))}">${esc(l.label || l.title || '')}</a></li>`).join('')
  }</ul></div>`).join('');
  const year = new Date().getFullYear();
  return `<footer class="gss-footer">
    <div class="gss-container">
      <div class="gss-footer-grid">
        <div class="gss-footer-brand"><span class="gss-brand-text">${brand}<span class="gss-brand-dot">.</span></span>
          <p>Rohit Sharma, REALTOR® — Lombard Group Real Estate Inc., Brokerage. Serving Caledonia, Haldimand County, Hamilton, Niagara &amp; the GTA.</p>
          ${s.phone ? `<p><a href="tel:${esc(String(s.phone).replace(/[^+\d]/g, ''))}">${esc(s.phone)}</a></p>` : ''}
          ${s.email ? `<p><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></p>` : ''}
        </div>${colHtml}
      </div>
      <div class="gss-footer-bottom"><span>© ${year} ${brand}. All rights reserved.</span>
        <span><a href="/privacy-policy">Privacy</a> · <a href="/terms">Terms</a></span></div>
    </div>
  </footer>`;
}

async function hero(props, ctx) {
  const p = props || {};
  const bg = p.bg_image || p.image;
  const kicker = p.kicker || p.eyebrow;
  const buttons = Array.isArray(p.buttons) && p.buttons.length
    ? p.buttons
    : (p.cta_label ? [{ label: p.cta_label, href: p.cta_href || '#', style: 'accent' }] : []);
  return `<section class="gss-hero ${esc(p.size || 'large')}">
    ${bg ? `<div class="gss-hero-bg" style="background-image:url('${esc(safeUrl(bg))}')"></div><div class="gss-hero-overlay"></div>` : ''}
    <div class="gss-container gss-hero-inner">
      ${kicker ? `<p class="gss-kicker">${esc(kicker)}</p>` : ''}
      <h1>${esc(p.heading || '')}</h1>
      ${p.subheading ? `<p class="gss-hero-sub">${esc(p.subheading)}</p>` : ''}
      ${buttons.length ? `<div class="gss-btn-row">${
        buttons.map((b) => `<a class="gss-btn ${b.style === 'outline' ? 'gss-btn-outline-light' : b.style === 'dark' ? 'gss-btn-dark' : 'gss-btn-accent'}" href="${esc(safeUrl(b.href))}">${esc(b.label)}</a>`).join('')
      }</div>` : ''}
      ${p.trust_line ? `<p class="gss-hero-trust">${esc(p.trust_line)}</p>` : ''}
    </div>
  </section>`;
}

async function page_hero(props, ctx) {
  const p = props || {};
  return `<section class="gss-page-hero ${bgClass(p.variant)}">
    <div class="gss-container">
      ${p.kicker ? `<p class="gss-kicker">${esc(p.kicker)}</p>` : ''}
      <h1>${esc(p.title || '')}</h1>
      ${p.subtitle ? `<p class="gss-lead">${esc(p.subtitle)}</p>` : ''}
    </div>
  </section>`;
}

async function breadcrumbs(props, ctx) {
  const items = (props && props.items) || [{ label: 'Home', href: '/' }];
  return `<nav class="gss-breadcrumbs gss-container" aria-label="Breadcrumb"><ol>${
    items.map((it, i) => i < items.length - 1
      ? `<li><a href="${esc(safeUrl(it.href))}">${esc(it.label)}</a></li>`
      : `<li aria-current="page">${esc(it.label)}</li>`).join('')
  }</ol></nav>`;
}

async function section(props, ctx) {
  const p = props || {};
  const inner = p.blocks ? await renderBlocks(p.blocks, ctx) : (p.html || '');
  const style = p.bg_image && p.variant === 'image'
    ? ` style="background-image:url('${esc(safeUrl(p.bg_image))}')"` : '';
  return `<section class="gss-section ${bgClass(p.variant)}${p.tight ? ' gss-section-tight' : ''}"${style}>
    <div class="gss-container${p.wide ? ' gss-container-wide' : ''}">${inner}</div>
  </section>`;
}

async function grid(props, ctx) {
  const p = props || {};
  const cols = Math.min(Math.max(parseInt(p.columns, 10) || 3, 1), 4);
  const inner = p.blocks ? await renderBlocks(p.blocks, ctx) : '';
  return `<div class="gss-grid gss-grid-${cols}">${inner}</div>`;
}

async function spacer(props) {
  const h = parseInt((props && props.height) || 48, 10);
  return `<div class="gss-spacer" style="height:${Math.min(Math.max(h, 8), 200)}px" aria-hidden="true"></div>`;
}

async function divider() {
  return `<hr class="gss-divider">`;
}

// ---------------------------------------------------------------------------
// CONTENT
// ---------------------------------------------------------------------------

/** rich_text: trusted HTML authored in the admin (sanitized at save time). */
async function rich_text(props) {
  const p = props || {};
  const align = ['left', 'center', 'right'].includes(p.align) ? ` gss-text-${p.align}` : '';
  // `body_html` is the prop name used by the previous builder.
  const html = p.html || p.body_html || '';
  const heading = p.heading ? `<h2>${esc(p.heading)}</h2>` : '';
  return `<div class="gss-richtext${align}">${heading}${html}</div>`;
}

/**
 * image: direct URL prop, or resolve via image_assignments when an
 * `assignment: {related_type, related_id}` prop is given.
 * related_type is constrained to: project, builder, home_model,
 * floorplan, phase, promo, page, block.
 */
async function image(props, ctx) {
  const p = props || {};
  let url = p.url || p.src || '';
  let alt = p.alt || '';
  if (!url && p.assignment && p.assignment.related_type && p.assignment.related_id) {
    try {
      const rows = await ctx.sb(
        'image_assignments',
        // images table columns: image_url, alt_text
        `select=image_id,images(image_url,alt_text)&related_type=eq.${encodeURIComponent(p.assignment.related_type)}&related_id=eq.${encodeURIComponent(p.assignment.related_id)}&limit=1`
      );
      const img = rows && rows[0] && rows[0].images;
      if (img && img.image_url) {
        url = img.image_url;
        alt = alt || img.alt_text || '';
      }
    } catch { /* fail soft */ }
  }
  if (!url) return '<!-- image: no url -->';
  const cap = p.caption ? `<figcaption>${esc(p.caption)}</figcaption>` : '';
  return `<figure class="gss-image ${p.rounded === false ? '' : 'gss-image-rounded'}">
    <img src="${esc(safeUrl(url))}" alt="${esc(alt)}"${p.width ? ` width="${parseInt(p.width, 10)}"` : ''} loading="lazy">${cap}</figure>`;
}

async function gallery(props) {
  const p = props || {};
  const items = Array.isArray(p.images) ? p.images : [];
  if (!items.length) return '<!-- gallery: empty -->';
  return `<div class="gss-gallery gss-gallery-${Math.min(items.length, 4)}">` + items.map((im) => {
    const it = typeof im === 'string' ? { url: im } : im;
    return `<figure><img src="${esc(safeUrl(it.url))}" alt="${esc(it.alt || '')}" loading="lazy">${
      it.caption ? `<figcaption>${esc(it.caption)}</figcaption>` : ''}</figure>`;
  }).join('') + '</div>';
}

async function stats(props) {
  const p = props || {};
  // `stats` (possibly a serialized string) is the prop name used by the previous builder.
  const items = Array.isArray(p.items) && p.items.length ? p.items : parseList(p.stats);
  if (!items.length) return '<!-- stats: empty -->';
  return `<div class="gss-stats">${items.map((s) =>
    `<div class="gss-stat"><span class="gss-stat-value">${esc(s.value)}</span><span class="gss-stat-label">${esc(s.label)}</span></div>`
  ).join('')}</div>`;
}

async function testimonials(props) {
  const p = props || {};
  const items = Array.isArray(p.items) ? p.items : [];
  if (!items.length) return '<!-- testimonials: empty -->';
  return `<div class="gss-testimonials">${items.map((t) =>
    `<blockquote class="gss-testimonial gss-card">
      <div class="gss-stars" aria-label="${esc(t.rating || '5')} out of 5 stars">${'★'.repeat(Math.min(parseInt(t.rating, 10) || 5, 5))}</div>
      <p>“${esc(t.quote)}”</p>
      <footer>— ${esc(t.name)}${t.detail ? `, ${esc(t.detail)}` : ''}</footer>
    </blockquote>`).join('')}</div>`;
}

async function faq(props, ctx) {
  const p = props || {};
  const items = Array.isArray(p.items) ? p.items : [];
  if (!items.length) return '<!-- faq: empty -->';
  // Collect FAQPage JSON-LD for <head>.
  ctx.ld.push({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((q) => ({
      '@type': 'Question',
      name: q.question,
      acceptedAnswer: { '@type': 'Answer', text: q.answer },
    })),
  });
  return `<div class="gss-faq">${p.heading ? `<h2>${esc(p.heading)}</h2>` : ''}${
    items.map((q) => `<details class="gss-faq-item"><summary>${esc(q.question)}</summary><div class="gss-faq-answer"><p>${esc(q.answer)}</p></div></details>`).join('')
  }</div>`;
}

async function cta_banner(props) {
  const p = props || {};
  // Legacy prop names from the previous builder: cta_label / cta_href / phone.
  const buttonLabel = p.button_label || p.cta_label;
  const buttonHref = p.button_href || p.cta_href || '/contact';
  const text = p.text || (p.phone ? `Call ${p.phone}` : '');
  return `<section class="gss-cta-banner ${p.variant === 'dark' ? 'gss-bg-dark' : 'gss-bg-accent'}">
    <div class="gss-container gss-cta-inner">
      <div><h2>${esc(p.heading || '')}</h2>${text ? `<p>${esc(text)}</p>` : ''}</div>
      ${buttonLabel ? `<a class="gss-btn ${p.variant === 'dark' ? 'gss-btn-accent' : 'gss-btn-white'}" href="${esc(safeUrl(buttonHref))}">${esc(buttonLabel)}</a>` : ''}
    </div>
  </section>`;
}

async function agent_bio(props, ctx) {
  const p = props || {};
  const s = ctx.settings || {};
  // settings column is agent_image_url (agent_photo kept as fallback)
  const photo = p.photo || s.agent_photo || s.agent_image_url;
  return `<div class="gss-agent-bio gss-card">
    ${photo ? `<img class="gss-agent-photo" src="${esc(safeUrl(photo))}" alt="${esc(p.name || 'Rohit Sharma')}">` : ''}
    <div><h3>${esc(p.name || 'Rohit Sharma')}, REALTOR®</h3>
    ${p.title ? `<p class="gss-agent-title">${esc(p.title)}</p>` : ''}
    ${p.bio ? `<p>${esc(p.bio)}</p>` : ''}
    <p class="gss-agent-creds">Lombard Group Real Estate Inc., Brokerage · Serving Caledonia &amp; Haldimand County, Hamilton, Niagara &amp; the GTA</p>
    <div class="gss-btn-row"><a class="gss-btn gss-btn-accent gss-btn-sm" href="/contact">Work With Me</a>
    ${s.phone ? `<a class="gss-btn gss-btn-outline gss-btn-sm" href="tel:${esc(String(s.phone).replace(/[^+\d]/g, ''))}">Call ${esc(s.phone)}</a>` : ''}</div></div>
  </div>`;
}

async function video(props) {
  const p = props || {};
  const url = String(p.embed_url || p.url || '');
  if (!/^https:\/\//i.test(url)) return '<!-- video: invalid url -->';
  // Normalize common watch URLs to embed URLs.
  let src = url;
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/i);
  const vimeo = url.match(/vimeo\.com\/(\d+)/i);
  if (yt) src = `https://www.youtube.com/embed/${yt[1]}`;
  else if (vimeo) src = `https://player.vimeo.com/video/${vimeo[1]}`;
  return `<div class="gss-video"><iframe src="${esc(src)}" title="${esc(p.title || 'Video')}" loading="lazy"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
}

async function icon_features(props) {
  const p = props || {};
  const items = Array.isArray(p.items) ? p.items : [];
  if (!items.length) return '<!-- icon_features: empty -->';
  return `<div class="gss-features">${items.map((f) =>
    `<div class="gss-feature"><span class="gss-feature-icon" aria-hidden="true">${esc(f.icon || '✓')}</span>
      <div><h3>${esc(f.title)}</h3>${f.text ? `<p>${esc(f.text)}</p>` : ''}</div></div>`).join('')}</div>`;
}

async function steps(props) {
  const p = props || {};
  const items = Array.isArray(p.items) ? p.items : [];
  if (!items.length) return '<!-- steps: empty -->';
  return `<div class="gss-steps">${p.heading ? `<h2 class="gss-steps-heading">${esc(p.heading)}</h2>` : ''}<ol>${
    items.map((s, i) => `<li><span class="gss-step-num">${i + 1}</span><div><h3>${esc(s.title)}</h3>${s.text ? `<p>${esc(s.text)}</p>` : ''}</div></li>`).join('')
  }</ol></div>`;
}

// ---------------------------------------------------------------------------
// REAL ESTATE (data-driven)
// ---------------------------------------------------------------------------

/** First non-empty value among candidate keys (MLS schemas vary). */
function pick(row, ...keys) {
  for (const k of keys) {
    const v = row && row[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return '';
}

function money(v) {
  const n = Number(v);
  return Number.isFinite(n) ? '$' + n.toLocaleString('en-CA') : esc(v);
}

function listingCard(l) {
  const id = pick(l, 'id', 'mls_number', 'listing_id');
  const price = pick(l, 'list_price', 'price', 'current_price');
  const addr = pick(l, 'address', 'street_address', 'full_address');
  const city = pick(l, 'city', 'municipality', 'town');
  const beds = pick(l, 'beds', 'bedrooms', 'br');
  const baths = pick(l, 'baths', 'bathrooms', 'bath');
  const sqft = pick(l, 'sqft', 'sq_ft', 'living_area', 'interior_sqft');
  const photo = pick(l, 'photo_url', 'image_url', 'primary_photo', 'thumbnail');
  const status = pick(l, 'status');
  const specs = [beds && `${esc(beds)} bd`, baths && `${esc(baths)} ba`, sqft && `${esc(Number(sqft).toLocaleString('en-CA'))} sqft`].filter(Boolean).join(' · ');
  return `<article class="gss-listing-card gss-card">
    <a href="/listing/${esc(encodeURIComponent(String(id)))}" class="gss-listing-media">
      ${photo ? `<img src="${esc(safeUrl(photo))}" alt="${esc(addr || 'Listing photo')}" loading="lazy">` : '<div class="gss-listing-placeholder">GetSetSold</div>'}
      ${status ? `<span class="gss-listing-status">${esc(status)}</span>` : ''}
    </a>
    <div class="gss-listing-body">
      <p class="gss-listing-price">${money(price)}</p>
      <p class="gss-listing-addr">${esc(addr)}${city ? `, ${esc(city)}` : ''}</p>
      ${specs ? `<p class="gss-listing-specs">${specs}</p>` : ''}
    </div>
  </article>`;
}

/** listing_grid: reads the MLS `grid` table. Props: limit, city, status, order. */
async function listing_grid(props, ctx) {
  const p = props || {};
  // Legacy prop names from the previous builder: pageSize / defaultArea.
  const limit = Math.min(parseInt(p.limit || p.pageSize, 10) || 9, 50);
  const city = p.city || (p.defaultArea && p.defaultArea !== 'None' ? p.defaultArea : '');
  let qs = `select=*&limit=${limit}`;
  if (city) qs += `&city=eq.${encodeURIComponent(city)}`;
  if (p.status) qs += `&status=eq.${encodeURIComponent(p.status)}`;
  let rows;
  try {
    rows = await ctx.mls('grid', qs);
  } catch {
    try { rows = await ctx.mls('grid', `select=*&limit=${limit}`); } catch { rows = []; }
  }
  if (!rows || !rows.length) return '<!-- listing_grid: no results -->';
  const heading = p.heading ? `<div class="gss-container"><h2 class="gss-center">${esc(p.heading)}</h2></div>` : '';
  return `${heading}<div class="gss-listing-grid">${rows.map(listingCard).join('')}</div>
    ${p.more_href ? `<p class="gss-center"><a class="gss-btn gss-btn-outline" href="${esc(safeUrl(p.more_href))}">${esc(p.more_label || 'View All Listings')}</a></p>` : ''}`;
}

/**
 * listing_detail: reads one MLS `property` (or `sold`) row by id / MLS number,
 * then delegates to the full single-listing renderer in listing-detail.js
 * (gallery, hero stats, cashback banner, rooms, map, POI, HPI trends,
 * similar listings, affordability calculator, contact card).
 * mlsFetch adapts listing-detail.js's `mlsFetch(env, query)` contract
 * (returns a raw Response) onto this Worker's MLS Supabase credentials.
 */
async function listing_detail(props, ctx) {
  const p = props || {};
  const id = p.id || p.mls_number || ctx.routeParams?.id;
  if (!id) return '<!-- listing_detail: no id -->';
  const key = encodeURIComponent(String(id));
  let row = null;
  for (const table of ['property', 'sold']) {
    for (const col of ['id', 'mls_number', 'listing_id']) {
      try {
        const rows = await ctx.mls(table, `select=*&${col}=eq.${key}&limit=1`);
        if (rows && rows.length) { row = { ...rows[0], _table: table }; break; }
      } catch { /* try next */ }
    }
    if (row) break;
  }
  if (!row) return `<div class="gss-container"><p class="gss-empty">This listing is no longer available. <a href="/buy">Browse current listings</a>.</p></div>`;
  const addr = row.UnparsedAddress || row.address || row.street_address || row.full_address;
  const city = row.City || row.city || row.municipality;
  const price = row.ListPrice ?? row.list_price ?? row.price ?? row.sold_price ?? row.current_price;
  // RealEstateListing JSON-LD
  ctx.ld.push({
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: [addr, city].filter(Boolean).join(', '),
    ...(price != null && Number.isFinite(Number(price)) ? { offers: { '@type': 'Offer', price: Number(price), priceCurrency: 'CAD' } } : {}),
  });
  const env = ctx.env || {};
  const mlsFetch = async (e, q) => {
    const base = String((e && e.MLS_SUPABASE_URL) || '').replace(/\/$/, '');
    const k = e && e.MLS_SUPABASE_KEY;
    if (!base || !k) throw new Error('missing mls supabase credentials');
    return fetch(`${base}/rest/v1/${q}`, { headers: { apikey: k, Authorization: `Bearer ${k}` } });
  };
  return renderListingDetail(p, { listing: row, settings: ctx.settings || {} }, env, mlsFetch);
}

/** featured_carousel: horizontal scroll of featured MLS listings (props.ids or latest). */
async function featured_carousel(props, ctx) {
  const p = props || {};
  let rows = [];
  try {
    if (Array.isArray(p.ids) && p.ids.length) {
      const inList = p.ids.map((x) => encodeURIComponent(String(x))).join(',');
      rows = await ctx.mls('grid', `select=*&id=in.(${inList})`);
    } else {
      rows = await ctx.mls('grid', `select=*&limit=${Math.min(parseInt(p.limit, 10) || 8, 20)}`);
    }
  } catch { rows = []; }
  if (!rows.length) return '<!-- featured_carousel: no results -->';
  return `<div class="gss-carousel"><div class="gss-carousel-track">${rows.map(listingCard).join('')}</div></div>`;
}

/** precon_grid: reads pre-con `projects` (with builder name). Props: limit, city. */
async function precon_grid(props, ctx) {
  const p = props || {};
  const limit = Math.min(parseInt(p.limit, 10) || 6, 24);
  let rows = [];
  try {
    let qs = `select=*,builders(builder_name)&limit=${limit}`;
    if (p.city) qs += `&city=eq.${encodeURIComponent(p.city)}`;
    rows = await ctx.sb('projects', qs);
  } catch {
    try { rows = await ctx.sb('projects', `select=*&limit=${limit}`); } catch { rows = []; }
  }
  if (!rows.length) return '<!-- precon_grid: no results -->';
  const cards = rows.map((r) => {
    const slug = pick(r, 'slug', 'id');
    const name = pick(r, 'name', 'project_name');
    const city = pick(r, 'city', 'municipality');
    const priceFrom = pick(r, 'p_start_price', 'price_from', 'starting_price', 'min_price');
    const img = pick(r, 'main_image_url', 'hero_image', 'image_url', 'photo_url');
    const builder = r.builders && r.builders.builder_name ? r.builders.builder_name : pick(r, 'builder_name');
    return `<article class="gss-listing-card gss-card">
      <a href="/pre-construction/${esc(encodeURIComponent(String(slug)))}" class="gss-listing-media">
        ${img ? `<img src="${esc(safeUrl(img))}" alt="${esc(name)}" loading="lazy">` : '<div class="gss-listing-placeholder">Pre-Construction</div>'}
      </a>
      <div class="gss-listing-body">
        ${builder ? `<p class="gss-listing-builder">${esc(builder)}</p>` : ''}
        <h3 class="gss-listing-name">${esc(name)}</h3>
        <p class="gss-listing-addr">${city ? esc(city) : ''}${priceFrom ? ` · From ${money(priceFrom)}` : ''}</p>
      </div>
    </article>`;
  }).join('');
  return `<div class="gss-listing-grid">${cards}</div>`;
}

/** precon_detail: project + phases + home_models. Props: slug (or ctx.routeParams.slug). */
async function precon_detail(props, ctx) {
  const p = props || {};
  const slug = p.slug || ctx.routeParams?.slug;
  if (!slug) return '<!-- precon_detail: no slug -->';
  const key = encodeURIComponent(String(slug));
  let project = null;
  try {
    let rows = await ctx.sb('projects', `select=*,builders(builder_name)&slug=eq.${key}&limit=1`);
    if (!rows || !rows.length) rows = await ctx.sb('projects', `select=*,builders(builder_name)&id=eq.${key}&limit=1`);
    project = rows && rows[0];
  } catch { /* soft fail */ }
  if (!project) return `<div class="gss-container"><p class="gss-empty">Project not found. <a href="/pre-construction">Browse pre-construction</a>.</p></div>`;
  const pid = project.id;
  let phases = [], models = [];
  try { phases = await ctx.sb('phases', `select=*&project_id=eq.${encodeURIComponent(pid)}`) || []; } catch { /* ignore */ }
  try {
    models = await ctx.sb('home_models', `select=*&project_id=eq.${encodeURIComponent(pid)}`) || [];
  } catch {
    try { models = await ctx.sb('home_models', `select=*`) || []; } catch { /* ignore */ }
  }
  const name = pick(project, 'name', 'project_name');
  const builder = project.builders && project.builders.builder_name ? project.builders.builder_name : pick(project, 'builder_name');
  const city = pick(project, 'city');
  const priceFrom = pick(project, 'p_start_price', 'price_from', 'starting_price');
  const desc = pick(project, 'project_description', 'description', 'about');
  const img = pick(project, 'main_image_url', 'hero_image', 'image_url');
  ctx.ld.push({ '@context': 'https://schema.org', '@type': 'Product', name });
  return `<div class="gss-precon-detail">
    ${img ? `<img class="gss-precon-hero" src="${esc(safeUrl(img))}" alt="${esc(name)}">` : ''}
    <p class="gss-kicker">${esc(builder || 'Pre-Construction')}</p>
    <h1>${esc(name)}</h1>
    <p class="gss-lead">${city ? esc(city) : ''}${priceFrom ? ` · From ${money(priceFrom)}` : ''}</p>
    ${desc ? `<div class="gss-richtext"><p>${esc(desc)}</p></div>` : ''}
    ${phases.length ? `<h2>Phases</h2><ul class="gss-plain-list">${phases.map((ph) =>
      `<li><strong>${esc(pick(ph, 'name', 'phase_name', `Phase ${ph.id}`))}</strong>${pick(ph, 'status') ? ` — ${esc(pick(ph, 'status'))}` : ''}</li>`).join('')}</ul>` : ''}
    ${models.length ? `<h2>Home Models</h2><div class="gss-model-grid">${models.map((m) =>
      `<div class="gss-card gss-model-card"><h3>${esc(pick(m, 'name', 'model_name'))}</h3>
        <p>${pick(m, 'beds', 'bedrooms') ? `${esc(pick(m, 'beds', 'bedrooms'))} bd · ` : ''}${pick(m, 'baths', 'bathrooms') ? `${esc(pick(m, 'baths', 'bathrooms'))} ba · ` : ''}${pick(m, 'sqft', 'sq_ft') ? `${esc(pick(m, 'sqft', 'sq_ft'))} sqft` : ''}</p>
        ${pick(m, 'starting_price', 'price', 'base_price') ? `<p class="gss-listing-price">${money(pick(m, 'starting_price', 'price', 'base_price'))}</p>` : ''}</div>`).join('')}</div>` : ''}
    <div class="gss-listing-cta"><a class="gss-btn gss-btn-accent" href="/contact?project=${esc(encodeURIComponent(String(project.id)))}">Register for VIP Pricing</a></div>
  </div>`;
}

/** neighbourhood_block: cards for neighbourhoods in a city. Props: city (slug/name), limit. */
async function neighbourhood_block(props, ctx) {
  const p = props || {};
  const limit = Math.min(parseInt(p.limit, 10) || 8, 40);
  let cityRow = null;
  try {
    if (p.city) {
      const key = encodeURIComponent(String(p.city));
      let rows = await ctx.sb('cities', `select=id,name,slug&slug=eq.${key}&limit=1`);
      if (!rows || !rows.length) rows = await ctx.sb('cities', `select=id,name,slug&name=ilike.${key}&limit=1`);
      cityRow = rows && rows[0];
    }
  } catch { /* ignore */ }
  let hoods = [];
  try {
    const qs = cityRow
      ? `select=*,cities(name,slug)&city_id=eq.${encodeURIComponent(cityRow.id)}&limit=${limit}`
      : `select=*,cities(name,slug)&limit=${limit}`;
    hoods = await ctx.sb('neighbourhoods', qs) || [];
  } catch { hoods = []; }
  if (!hoods.length) return '<!-- neighbourhood_block: no results -->';
  return `<div class="gss-hood-grid">${hoods.map((n) => {
    const slug = pick(n, 'slug', 'id');
    const cityName = n.cities && n.cities.name ? n.cities.name : '';
    return `<a class="gss-hood-card gss-card" href="/neighbourhoods/${esc(encodeURIComponent(String(slug)))}">
      <h3>${esc(pick(n, 'name'))}</h3>${cityName ? `<p>${esc(cityName)}</p>` : ''}</a>`;
  }).join('')}</div>`;
}

/** Standard input sets for each client-side calculator engine (see index.js). */
const CALC_FIELDS = {
  mortgage_payment: [
    { name: 'price', label: 'Home price', type: 'number', required: true, placeholder: '750000' },
    { name: 'down_payment', label: 'Down payment', type: 'number', required: true, placeholder: '150000' },
    { name: 'rate', label: 'Interest rate (%)', type: 'number', required: true, placeholder: '5.25' },
    { name: 'years', label: 'Amortization (years)', type: 'number', required: true, placeholder: '25' },
  ],
  affordability: [
    { name: 'income', label: 'Annual household income', type: 'number', required: true, placeholder: '120000' },
    { name: 'debts', label: 'Monthly debts', type: 'number', placeholder: '500' },
    { name: 'rate', label: 'Interest rate (%)', type: 'number', required: true, placeholder: '5.25' },
    { name: 'years', label: 'Amortization (years)', type: 'number', required: true, placeholder: '25' },
  ],
  land_transfer: [
    { name: 'price', label: 'Purchase price', type: 'number', required: true, placeholder: '750000' },
    { name: 'toronto', label: 'Toronto property (double LTT)?', type: 'select', options: [{ value: '0', label: 'No' }, { value: '1', label: 'Yes' }] },
    { name: 'first_time', label: 'First-time buyer?', type: 'select', options: [{ value: '0', label: 'No' }, { value: '1', label: 'Yes' }] },
  ],
  closing_costs: [
    { name: 'price', label: 'Purchase price', type: 'number', required: true, placeholder: '750000' },
  ],
};

/** Minimal markdown -> HTML for calculator copy (paragraphs, headings, bold, links). */
function mdParagraphs(md) {
  return String(md).split(/\n{2,}/).map((chunk) => {
    const t = chunk.trim();
    if (!t) return '';
    const hm = t.match(/^(#{1,3})\s+(.*)$/);
    const inline = (s) => esc(s)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      .replace(/\n/g, '<br>');
    if (hm) {
      const lvl = Math.min(hm[1].length + 1, 4);
      return `<h${lvl}>${inline(hm[2])}</h${lvl}>`;
    }
    return `<p>${inline(t)}</p>`;
  }).join('');
}

/**
 * calculator_widget: renders a calculator from calculators_config by slug.
 * Uses the row's title / copy_md / formula_type; inputs come from the
 * built-in field set for that formula_type and the client-side engines
 * in index.js do the math.
 */
async function calculator_widget(props, ctx) {
  const p = props || {};
  const key = p.key || p.slug;
  if (!key) return '<!-- calculator_widget: no key -->';
  let cfg = null;
  try {
    const rows = await ctx.sb('calculators_config', `select=slug,title,formula_type,copy_md&slug=eq.${encodeURIComponent(String(key))}&limit=1`);
    cfg = rows && rows[0];
  } catch { /* ignore */ }
  if (!cfg) return `<!-- calculator_widget: unknown calculator ${esc(key)} -->`;
  const formulaType = cfg.formula_type || 'generic';
  const fields = CALC_FIELDS[formulaType] || [];
  const cid = `calc-${String(key).replace(/[^a-z0-9-]/gi, '')}`;
  return `<div class="gss-calc gss-card" id="${esc(cid)}" data-calc-type="${esc(formulaType)}">
    <h3>${esc(cfg.title || String(key))}</h3>
    ${cfg.copy_md ? `<div class="gss-richtext">${mdParagraphs(cfg.copy_md)}</div>` : ''}
    ${fields.length ? `<div class="gss-form-grid">${fields.map(fieldHtml).join('')}</div>
    <button type="button" class="gss-btn gss-btn-accent" data-calc-run>Calculate</button>
    <div class="gss-calc-result" role="status" aria-live="polite"></div>` : ''}
  </div>`;
}

// ---------------------------------------------------------------------------
// LEAD CAPTURE (each POSTs to /api/leads with its form_type)
// ---------------------------------------------------------------------------

async function valuation_form(props) {
  const p = props || {};
  return leadForm({
    formType: 'valuation', id: p.id,
    title: p.title || 'What’s Your Home Worth?',
    subtitle: p.subtitle || 'Get a free, no-obligation home valuation — usually within 24 hours.',
    submitLabel: p.submit_label || 'Get My Free Valuation',
    note: 'No spam. Your details stay with us.',
    fields: [
      { name: 'first_name', label: 'First name', required: true, placeholder: 'Jane' },
      { name: 'last_name', label: 'Last name', required: true, placeholder: 'Doe' },
      { name: 'email', label: 'Email', type: 'email', required: true, placeholder: 'jane@example.com' },
      { name: 'phone', label: 'Phone', type: 'tel', required: true, placeholder: '(905) 555-0100' },
      { name: 'address', label: 'Property address', required: true, placeholder: '123 Main St' },
      { name: 'city', label: 'City', required: true, placeholder: 'Caledonia' },
      { name: 'beds', label: 'Bedrooms', type: 'number', inputmode: 'numeric' },
      { name: 'baths', label: 'Bathrooms', type: 'number', inputmode: 'numeric' },
      { name: 'timeline', label: 'When are you thinking of selling?', type: 'select', options: ['ASAP', '1–3 months', '3–6 months', 'Just curious'] },
    ],
  });
}

async function vip_signup(props) {
  const p = props || {};
  return leadForm({
    formType: 'vip_buyer', id: p.id,
    title: p.title || 'Join the VIP Buyer Program',
    subtitle: p.subtitle || 'Get cash back up to $5,000 plus early access to new listings.',
    submitLabel: p.submit_label || 'Join VIP',
    fields: [
      { name: 'first_name', label: 'First name', required: true },
      { name: 'last_name', label: 'Last name', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'phone', label: 'Phone', type: 'tel', required: true },
      { name: 'areas', label: 'Preferred areas', placeholder: 'Caledonia, Cayuga, Hagersville…' },
      { name: 'budget', label: 'Budget range', type: 'select', options: ['Under $500k', '$500k–$750k', '$750k–$1M', '$1M+'] },
    ],
  });
}

async function contact_form(props) {
  const p = props || {};
  return leadForm({
    formType: 'contact', id: p.id,
    title: p.title || p.heading || 'Get in Touch',
    subtitle: p.subtitle || 'Questions about buying or selling? Send a message.',
    submitLabel: p.submit_label || 'Send Message',
    fields: [
      { name: 'first_name', label: 'First name', required: true },
      { name: 'last_name', label: 'Last name', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'phone', label: 'Phone', type: 'tel' },
      { name: 'subject', label: 'Subject', type: 'select', options: ['Buying', 'Selling', 'Pre-construction', 'Valuation', 'Other'] },
      { name: 'message', label: 'Message', type: 'textarea', required: true, placeholder: 'How can we help?' },
    ],
  });
}

async function referral_form(props) {
  const p = props || {};
  return leadForm({
    formType: 'referral', id: p.id,
    title: p.title || 'Refer a Friend',
    subtitle: p.subtitle || 'Know someone buying or selling? We’ll take great care of them.',
    submitLabel: p.submit_label || 'Send Referral',
    fields: [
      { name: 'first_name', label: 'Your first name', required: true },
      { name: 'last_name', label: 'Your last name', required: true },
      { name: 'email', label: 'Your email', type: 'email', required: true },
      { name: 'referral_name', label: 'Friend’s name', required: true },
      { name: 'referral_contact', label: 'Friend’s phone or email', required: true },
      { name: 'message', label: 'Anything we should know?', type: 'textarea' },
    ],
  });
}

async function newsletter_form(props) {
  const p = props || {};
  return `<form class="gss-newsletter" data-gss-form data-form-type="newsletter" novalidate>
    <input type="text" name="company" class="gss-honeypot" tabindex="-1" autocomplete="off" aria-hidden="true">
    <label class="gss-newsletter-label" for="nl-email">${esc(p.title || 'Market updates, monthly. No spam.')}</label>
    <div class="gss-newsletter-row">
      <input id="nl-email" type="email" name="email" placeholder="you@example.com" required aria-label="Email address">
      <button type="submit" class="gss-btn gss-btn-accent">${esc(p.submit_label || 'Subscribe')}</button>
    </div>
    <p class="gss-form-msg" role="status" aria-live="polite"></p>
  </form>`;
}

// ---------------------------------------------------------------------------
// LEGACY BLOCKS (ids from blocks_library / previous builder)
// These normalize legacy prop shapes and delegate to the canonical
// renderers above, so existing pages keep working unchanged.
// ---------------------------------------------------------------------------

/** header_nav -> site_header (nav items may be a serialized string). */
async function header_nav(props, ctx) {
  const p = props || {};
  const navItems = parseList(p.nav_items).map((n) => ({ label: n.label, href: n.href }));
  const settings = {
    ...ctx.settings,
    ...(p.logo_text ? { business_name: p.logo_text } : {}),
    ...(navItems.length ? { nav_items: navItems } : {}),
    ...(p.phone ? { phone: p.phone } : {}),
  };
  return site_header(p, { ...ctx, settings });
}

/** footer -> site_footer. */
async function footer(props, ctx) {
  return site_footer(props, ctx);
}

/** hero_search -> hero + stats band. */
async function hero_search(props, ctx) {
  const p = props || {};
  const heroHtml = await hero({
    ...p,
    kicker: p.kicker || p.eyebrow,
    heading: p.heading || p.headline,
    subheading: p.subheading || p.subcopy,
  }, ctx);
  const items = parseList(p.stats);
  if (!items.length) return heroHtml;
  const statsHtml = await stats({ items }, ctx);
  return `${heroHtml}<div class="gss-container" style="margin-top:-2.5rem;position:relative;z-index:2"><div class="gss-card" style="padding:1.5rem 2rem">${statsHtml}</div></div>`;
}

/** featured_listings -> featured_carousel (count -> limit). */
async function featured_listings(props, ctx) {
  const p = props || {};
  return featured_carousel({ limit: p.count || p.limit || 6 }, ctx);
}

/** stat_band / stats_row -> stats. */
async function stat_band(props, ctx) {
  return stats({ items: parseList(props && props.stats) }, ctx);
}
async function stats_row(props, ctx) {
  return stats({ items: parseList(props && props.stats) }, ctx);
}

/** process_steps -> steps (copy -> text). */
async function process_steps(props, ctx) {
  const p = props || {};
  const items = parseList(p.steps).map((s) => ({ title: s.title, text: s.text || s.copy }));
  return steps({ heading: p.heading, items }, ctx);
}

/** testimonial / testimonial_carousel -> testimonials. */
async function testimonial(props, ctx) {
  const p = props || {};
  if (!p.quote) return '<!-- testimonial: empty -->';
  return testimonials({
    items: [{ quote: p.quote, name: p.name, detail: p.detail, rating: p.rating || 5 }],
  }, ctx);
}
async function testimonial_carousel(props, ctx) {
  const p = props || {};
  const items = parseList(p.items || p.testimonials).map((t) => ({
    quote: t.quote, name: t.name, detail: t.detail, rating: t.rating || 5,
  })).filter((t) => t.quote);
  return testimonials({ items }, ctx);
}

/** lead_form -> leadForm with the requested form type. */
async function lead_form(props) {
  const p = props || {};
  const formType = ['valuation', 'vip_buyer', 'contact', 'referral', 'newsletter'].includes(p.formType)
    ? p.formType : 'contact';
  return leadForm({
    formType,
    title: p.title || p.heading || 'Get in Touch',
    subtitle: p.subtitle || p.copy || '',
    submitLabel: p.submitLabel || p.submit_label || p.ctaLabel || 'Submit',
    note: 'No spam. Your details stay with us.',
    fields: [
      { name: 'first_name', label: 'First name', required: true },
      { name: 'last_name', label: 'Last name', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'phone', label: 'Phone', type: 'tel', required: true },
      { name: 'message', label: 'Message', type: 'textarea', placeholder: 'How can we help?' },
    ],
  });
}

/** image_text_split: simple two-column image/text (graceful when empty). */
async function image_text_split(props) {
  const p = props || {};
  const img = p.image || p.image_url;
  const kicker = p.kicker || p.eyebrow;
  const buttons = Array.isArray(p.buttons) ? p.buttons.filter((b) => b && (b.label || b.href)) : [];
  if (!p.heading && !p.text && !p.body && !img) return '<!-- image_text_split: empty -->';
  const imgHtml = img ? `<img src="${esc(safeUrl(img))}" alt="${esc(p.alt || p.heading || '')}" loading="lazy" style="border-radius:var(--radius-md)">` : '';
  const textHtml = `<div>${kicker ? `<p class="gss-kicker">${esc(kicker)}</p>` : ''}${p.heading ? `<h2>${esc(p.heading)}</h2>` : ''}${p.text || p.body ? `<div class="gss-richtext">${p.text || p.body}</div>` : ''}${buttons.length ? `<div class="gss-btn-row" style="margin-top:16px">${buttons.map((b) => `<a class="gss-btn ${b.style === 'outline' ? 'gss-btn-outline' : 'gss-btn-accent'}" href="${esc(safeUrl(b.href || '#'))}">${esc(b.label || 'Learn more')}</a>`).join('')}</div>` : ''}</div>`;
  const cols = p.flip ? `${textHtml}<div>${imgHtml}</div>` : `<div>${imgHtml}</div>${textHtml}`;
  return `<div class="gss-container"><div class="gss-grid gss-grid-2" style="align-items:center">${cols}</div></div>`;
}

/** section_heading: centered kicker + heading + subheading for section intros. */
async function section_heading(props) {
  const p = props || {};
  if (!p.heading && !p.kicker && !p.sub) return '<!-- section_heading: empty -->';
  const align = ['left', 'center', 'right'].includes(p.align) ? p.align : 'center';
  return `<div class="gss-container"><div class="gss-section-head" style="text-align:${align};max-width:720px;margin:0 auto 8px">
    ${p.kicker ? `<p class="gss-kicker">${esc(p.kicker)}</p>` : ''}
    ${p.heading ? `<h2>${esc(p.heading)}</h2>` : ''}
    ${p.sub ? `<p class="gss-lead">${esc(p.sub)}</p>` : ''}
  </div></div>`;
}

/** button_row: one centered row of buttons (single button via label/href, or a buttons array). */
async function button_row(props) {
  const p = props || {};
  const buttons = Array.isArray(p.buttons) && p.buttons.length
    ? p.buttons
    : (p.label ? [{ label: p.label, href: p.href || '#', style: p.style }] : []);
  if (!buttons.length) return '<!-- button_row: empty -->';
  const align = ['left', 'center', 'right'].includes(p.align) ? p.align : 'center';
  return `<div class="gss-container"><div class="gss-btn-row" style="justify-content:${align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center'};margin:8px 0 8px">${buttons.map((b) =>
    `<a class="gss-btn ${b.style === 'outline' ? 'gss-btn-outline' : b.style === 'dark' ? 'gss-btn-dark' : 'gss-btn-accent'}" href="${esc(safeUrl(b.href || '#'))}">${esc(b.label || 'Click')}</a>`).join('')}</div></div>`;
}

/** map_split_search -> listing_grid with heading. */
async function map_split_search(props, ctx) {
  const p = props || {};
  return listing_grid({
    heading: p.heading || '',
    limit: 12,
    city: p.defaultArea && p.defaultArea !== 'None' ? p.defaultArea : undefined,
  }, ctx);
}

/** service_tiles -> card grid with optional CTA links. */
async function service_tiles(props) {
  const p = props || {};
  const tiles = parseList(p.tiles);
  if (!tiles.length) return '<!-- service_tiles: empty -->';
  return `<div class="gss-container"><div class="gss-features">${tiles.map((t) =>
    `<div class="gss-feature gss-card"><div><h3>${esc(t.title || '')}</h3>${
      t.copy ? `<p>${esc(t.copy)}</p>` : ''
    }${t.cta ? `<p><a class="gss-btn gss-btn-outline gss-btn-sm" href="${esc(safeUrl(t.link))}">${esc(t.cta)}</a></p>` : ''
    }</div></div>`).join('')}</div></div>`;
}

// ---------------------------------------------------------------------------
// REGISTRY
// ---------------------------------------------------------------------------

export const BLOCKS = {
  // layout
  site_header, site_footer, hero, page_hero, breadcrumbs, section, grid, spacer, divider,
  // content
  rich_text, image, gallery, stats, testimonials, faq, cta_banner, agent_bio,
  video, icon_features, steps,
  // real estate
  listing_grid, listing_detail, featured_carousel, precon_grid, precon_detail,
  neighbourhood_block, calculator_widget,
  // lead capture
  valuation_form, vip_signup, contact_form, referral_form, newsletter_form,
  // legacy ids from blocks_library / previous builder (delegating renderers)
  header_nav, footer, hero_search, featured_listings, stat_band, stats_row,
  process_steps, testimonial, testimonial_carousel, lead_form,
  image_text_split, map_split_search, service_tiles,
  // structured content blocks (migrated from raw-HTML rich_text, Sept 2026)
  section_heading, button_row,
};

/**
 * Render a page's blocks array. Accepts both `{type, props}` and the legacy
 * `{block_type, props}` shape. A block renders whenever the worker has a
 * renderer for it — blocks_library is the admin's picker registry, not a
 * render gate (several native layout blocks predate it).
 */
export async function renderBlocks(blocks, ctx) {
  if (!Array.isArray(blocks)) return '';
  const out = [];
  for (const b of blocks) {
    const type = b && (b.type || b.block_type);
    const fn = type && BLOCKS[type];
    if (!fn) { out.push(`<!-- unknown block: ${esc(type)} -->`); continue; }
    try {
      out.push(await fn(b.props || {}, ctx));
    } catch (err) {
      out.push(`<!-- block error: ${esc(type)} -->`);
    }
  }
  return out.join('\n');
}
