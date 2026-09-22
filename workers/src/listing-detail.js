// listing-detail.js — full single-listing page renderer, ported from the
// real getsetsold.ca real-estate.html (price hero, stats, description,
// features, room details, gallery, mortgage calculator, similar listings,
// HPI market trends) but restyled in our own brand tokens (Fraunces/Manrope,
// ink/blue) instead of their Roboto/#013A51 theme, per your call to use the
// new design system rather than pixel-match the old one.
//
// Data contract (confirmed from the real pages, not guessed):
//   ListingKey, UnparsedAddress, City, Province, PostalCode, OfficeName,
//   ListPrice, TotalActualRent, BedroomsTotal, BathroomsTotalInteger,
//   ParkingTotal, AboveGradeFinishedArea, PublicRemarks, OriginalEntryTimestamp.
//   `property` table's Media is an array of {MediaURL, Caption, PreferredPhotoYN}
//   (confirmed via listings-images.js). The `grid` table (used for similar
//   listings) is different — Media there is a single thumbnail URL string,
//   plus a separate PhotosCount int (confirmed via listings-similar-grid.js).
// Sale vs rent: ListPrice present -> sale; else TotalActualRent -> rent.
//
// Two things on the real page are NOT stored in either Supabase project —
// they're separate external pieces, and I'm reproducing the same pattern
// rather than guessing a schema for them:
//   - Room details: the real page loads them via a separate script
//     (rooms-metrics.js) that reads a `Rooms` field on the listing row.
//     This renderer reads `listing.Rooms` the same way IF it's present
//     (array of {RoomType, Level, Dimensions} — the common RESO shape) and
//     simply omits the section if it isn't, rather than fabricating rows.
//   - HPI market trends: the real page fetches a public static JSON file
//     at https://www.getsetsold.ca/ontario-housing-market/ontario-hpi-data.json
//     client-side. This renderer fetches that same public file the same
//     way (client-side, after page load) — it isn't in Supabase, so the
//     Worker can't pre-fetch it server-side without hardcoding that URL,
//     which felt like the wrong place to bake in that dependency
//     permanently. Flag this to me if you'd rather it move server-side.

import { tokens } from "./tokens.js";

function esc(s = "") {
  return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function fmtMoney(n) {
  if (n == null || n === "") return null;
  const num = Number(n);
  if (Number.isNaN(num)) return null;
  return "$" + num.toLocaleString("en-CA");
}

function isSale(listing) {
  return listing.ListPrice != null && listing.ListPrice !== "";
}

function priceDisplay(listing) {
  if (isSale(listing)) return fmtMoney(listing.ListPrice) || "Price on request";
  if (listing.TotalActualRent) return (fmtMoney(listing.TotalActualRent) || "") + "/mo";
  return "Price on request";
}

function daysOnMarket(timestamp) {
  if (!timestamp) return null;
  const entry = new Date(timestamp);
  if (Number.isNaN(entry.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - entry.getTime()) / 86400000));
}

// Field names confirmed from the real listings-images.js: listing.Media is
// an array of { MediaURL, Caption, PreferredPhotoYN } — no "Order" field.
// The hero photo is whichever item has PreferredPhotoYN true (falls back
// to the first valid item), not a sort order. Returns [{url, caption}].
function mediaItems(media) {
  if (!media) return [];
  let arr = media;
  if (typeof media === "string") {
    try { arr = JSON.parse(media); } catch { return media.startsWith("http") ? [{ url: media, caption: "" }] : []; }
  }
  if (!Array.isArray(arr)) return [];
  const valid = arr.filter((m) => m && (m.MediaURL || (typeof m === "string" && m)));
  const items = valid.map((m) => ({
    url: typeof m === "string" ? m : m.MediaURL,
    caption: typeof m === "string" ? "" : m.Caption || "",
    preferred: typeof m === "string" ? false : !!m.PreferredPhotoYN,
  }));
  const preferredIdx = items.findIndex((m) => m.preferred);
  if (preferredIdx > 0) {
    const [preferred] = items.splice(preferredIdx, 1);
    items.unshift(preferred);
  }
  return items;
}

// Back-compat helper for callers that just want URLs (similar-listing cards, etc.)
function mediaUrls(media) {
  return mediaItems(media).map((m) => m.url);
}

function statPill(label, value) {
  if (value == null || value === "") return "";
  return `<div class="ld-stat"><div class="ld-stat-value">${esc(String(value))}</div><div class="ld-stat-label">${esc(label)}</div></div>`;
}

// Small inline icon set for the hero header's stat grid — ported concept
// from hero-container.js's Material Icons grid (bed/bath/parking/sqft/dom/
// type), redrawn as inline SVGs so we're not pulling in a Material Icons
// font just for six glyphs.
const HERO_ICONS = {
  bed: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 18v-7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7M3 18v2M21 18v2M3 13h18M6 13v-2a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
  bath: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 12h16v2a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-2ZM4 12V6a2 2 0 0 1 2-2 2 2 0 0 1 2 2M2 19h20"/></svg>`,
  parking: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 16V7h3.5a2.5 2.5 0 0 1 0 5H9"/></svg>`,
  sqft: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 8V3h5M21 8V3h-5M3 16v5h5M21 16v5h-5"/></svg>`,
  dom: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>`,
  type: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 11 12 3l9 8M5 10v10h14V10"/></svg>`,
  stories: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/></svg>`,
  built: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="6" width="18" height="15" rx="2"/><path d="M3 11h18M8 3v4M16 3v4"/><circle cx="12" cy="15.5" r="1.4" fill="currentColor" stroke="none"/></svg>`,
};

// Some RESO fields (StructureType, etc.) come back as a jsonb array
// (e.g. ["Row / Townhouse"]) rather than a plain string — unwrap it to
// readable text instead of printing the raw ["..."] literal.
function displayValue(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  if (typeof value === "string" && value.startsWith("[") && value.endsWith("]")) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter(Boolean).join(", ");
    } catch { /* not JSON, fall through */ }
  }
  return value;
}

function heroStat(icon, value, label) {
  if (value == null || value === "") return "";
  const display = displayValue(value);
  if (display == null || display === "") return "";
  return `<div class="ld-hero-stat"><i>${HERO_ICONS[icon] || ""}</i><div class="ld-hero-stat-value">${esc(String(display))}</div><div class="ld-hero-stat-label">${esc(label)}</div></div>`;
}

// Gallery — uses Fancybox (same library/CDN as your real
// listings-thumbnail-fancybox.js) instead of a hand-rolled lightbox: real
// pinch-zoom, a proper toolbar (zoom/fullscreen/download/close), and one
// less thing for us to maintain. Each photo is wrapped in an
// <a data-fancybox="gallery" href="{full photo}">, matching the real
// site's markup convention, and Fancybox.bind() picks all of them up.
// items: [{url, caption, preferred}] from mediaItems() — already ordered
// with the preferred/hero photo first. We keep our 2x2 thumbnail grid
// (rather than the real site's full thumbnail strip) for visual fit with
// the rest of the brand, but every photo stays reachable: the "+N more"
// tile and hidden anchors keep the FULL set navigable inside Fancybox,
// same as clicking through all photos on the real site.
// Collage layout: big hero on the left, a 2x2 thumbnail grid on the right.
// The last grid cell doubles as a "+N" counter (all remaining photos stay
// reachable as hidden Fancybox anchors, same trick as before) and a pill
// reading "Click to view gallery" floats centered over the seam between
// hero and grid — every tile opens the same Fancybox lightbox. On mobile
// the grid collapses and just the hero + pill remain (see the media query),
// so the whole gallery collapses down to "tap the photo, see everything."
function renderGallery(items) {
  if (!items.length) {
    return `<div class="ld-gallery-empty">No photos available</div>`;
  }
  const [hero, ...rest] = items;
  const visible = rest.slice(0, 4);
  const overflow = items.length > 5 ? items.length - 5 : 0;
  const thumbs = visible.map((m, i) => {
    const isLast = i === visible.length - 1;
    const countBadge = isLast && overflow
      ? `<span class="ld-gallery-count"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10.5" r="1.5"/><path d="m21 15-5-5L5 19"/></svg>+${overflow}</span>`
      : "";
    return `<a data-fancybox="gallery" href="${esc(m.url)}" data-caption="${esc(m.caption)}" class="ld-thumb" style="background-image:url('${esc(m.url)}')">${countBadge}</a>`;
  }).join("");
  const hiddenOverflow = overflow
    ? items.slice(5).map((m) => `<a data-fancybox="gallery" href="${esc(m.url)}" data-caption="${esc(m.caption)}" style="display:none;"></a>`).join("")
    : "";
  return `
    <div class="ld-gallery">
      <a data-fancybox="gallery" href="${esc(hero.url)}" data-caption="${esc(hero.caption)}" class="ld-hero-img" style="background-image:url('${esc(hero.url)}')"></a>
      ${items.length > 1 ? `<div class="ld-thumb-grid">${thumbs}</div>` : ""}
      ${hiddenOverflow}
      <a data-fancybox="gallery" href="${esc(hero.url)}" data-caption="${esc(hero.caption)}" class="ld-gallery-cta">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10.5" r="1.5"/><path d="m21 15-5-5L5 19"/></svg>
        Click to view gallery
      </a>
    </div>`;
}

// Field names confirmed from the real rooms-metrics.js on getsetsold.ca:
// listing.Rooms is an array of { RoomLevel, RoomType, RoomDimensions,
// RoomLength, RoomWidth, RoomLengthWidthUnits }. RoomDimensions is a
// pre-formatted string when present; otherwise we build "L x W units"
// from RoomLength/RoomWidth/RoomLengthWidthUnits the same way that script does.
function roomDimensions(r) {
  if (r.RoomDimensions) return r.RoomDimensions;
  if (r.RoomLength && r.RoomWidth) {
    const units = r.RoomLengthWidthUnits || "";
    return `${r.RoomLength} x ${r.RoomWidth}${units ? " " + units : ""}`;
  }
  return null;
}

function renderRooms(listing) {
  let rooms = listing.Rooms;
  if (typeof rooms === "string") {
    try { rooms = JSON.parse(rooms); } catch { rooms = null; }
  }
  if (!Array.isArray(rooms) || !rooms.length) return "";
  const rows = rooms.map((r) => `
    <div class="ld-room-row">
      <div class="ld-room-col"><div class="ld-room-label">Room</div><div>${esc(r.RoomType || "—")}</div></div>
      <div class="ld-room-col"><div class="ld-room-label">Level</div><div>${esc(r.RoomLevel || "—")}</div></div>
      <div class="ld-room-col"><div class="ld-room-label">Dimensions</div><div>${esc(roomDimensions(r) || "—")}</div></div>
    </div>`).join("");
  return `
    <div class="ld-section">
      <div class="ld-section-title">Room Details</div>
      <div class="ld-room-table">${rows}</div>
    </div>`;
}

function renderFeatures(listing) {
  const items = [];
  if (listing.HeatType) items.push(`Heating: ${listing.HeatType}`);
  if (listing.CoolingYN != null) items.push(listing.CoolingYN ? "Central Air" : null);
  if (listing.BasementType) items.push(`Basement: ${listing.BasementType}`);
  if (listing.GarageType || listing.ParkingTotal) items.push(`Parking: ${listing.GarageType || listing.ParkingTotal}`);
  if (listing.PropertyType) items.push(listing.PropertyType);
  if (listing.YearBuilt) items.push(`Built ${listing.YearBuilt}`);
  const clean = items.filter(Boolean);
  if (!clean.length) return "";
  return `
    <div class="ld-section">
      <div class="ld-section-title">Features</div>
      <div class="ld-features-grid">
        ${clean.map((f) => `<div class="ld-feature-item">${esc(f)}</div>`).join("")}
      </div>
    </div>`;
}

// This is the listing page's Affordability Calculator — it lives in the
// right (sticky) panel next to the contact card, matching the real site's
// #afford-widget placement. Previously titled "Mortgage Calculator" with no
// id, so the hero's "Affordability Calculator" button (which links to
// #ld-mortgage-calc) pointed at nothing. Fixed: real id, real label, and it
// stays wired to THIS listing's price via data-price (read by the ld-calc
// script below), which is the actual connection between the calculator and
// the listing being viewed.
function renderMortgageCalc(listing) {
  if (!isSale(listing)) return "";
  const price = Number(listing.ListPrice) || 0;
  return `
    <div class="ld-card" id="ld-mortgage-calc">
      <div class="ld-card-title">Affordability Calculator</div>
      <div class="ld-card-subtitle">Based on this property's list price of ${esc(fmtMoney(price) || "$0")}</div>
      <div class="ld-calc" data-price="${price}">
        <label>Down payment (%)
          <input type="number" class="ld-calc-down" value="20" min="0" max="100">
        </label>
        <label>Interest rate (%)
          <input type="number" class="ld-calc-rate" value="5.25" step="0.05" min="0">
        </label>
        <label>Amortization (years)
          <input type="number" class="ld-calc-years" value="25" min="1" max="30">
        </label>
        <div class="ld-calc-result">
          <div class="ld-calc-result-label">Est. monthly payment</div>
          <div class="ld-calc-result-value" id="ld-calc-output">—</div>
        </div>
      </div>
    </div>`;
}

function renderContactCard(listing, settings = {}) {
  const price = priceDisplay(listing);
  const agentName = settings.agent_name || "";
  const agentImage = settings.agent_image_url || "";
  const phoneDisplay = settings.phone || "416-605-7488";
  return `
    <div class="ld-card ld-contact-card">
      ${agentImage ? `
      <div class="ld-contact-agent">
        <img src="${esc(agentImage)}" alt="${esc(agentName || "Listing agent")}" class="ld-contact-agent-photo">
        ${agentName ? `<div class="ld-contact-agent-name">${esc(agentName)}</div>` : ""}
      </div>` : agentName ? `<div class="ld-contact-agent-name ld-contact-agent-name-noimg">${esc(agentName)}</div>` : ""}
      <div class="ld-contact-price">${esc(price)}</div>
      <div class="ld-contact-office">${esc(listing.OfficeName || "Lombard Group Real Estate Inc., Brokerage")}</div>
      <form class="ld-contact-form" data-form-type="listing_inquiry" action="/api/leads" method="POST">
        <input type="hidden" name="listing_key" value="${esc(listing.ListingKey || "")}">
        <input type="hidden" name="source_page" value="${esc("/listings/" + (listing.ListingKey || ""))}">
        <input name="name" placeholder="Name" required>
        <input name="email" type="email" placeholder="Email" required>
        <input name="phone" placeholder="Phone" required>
        <textarea name="message" placeholder="I'm interested in this property...">I'm interested in ${esc(listing.UnparsedAddress || "this property")}.</textarea>
        <button type="submit" class="ld-btn-primary">Request Info</button>
      </form>
      <a class="ld-btn-secondary" href="tel:+1${esc(String(phoneDisplay).replace(/\D/g, ""))}">Call ${esc(phoneDisplay)}</a>
    </div>`;
}

// Cashback banner — matches your real cashback-banner.js: sale listings get
// a cashback offer (0.25% of list price, capped at $5,000), rentals get a
// "free service to tenants" message instead. Same two CTAs: call, and
// share (native share sheet with a clipboard-copy fallback).
function renderCashbackBanner(listing) {
  const sale = isSale(listing);
  const shareUrl = `/listings/${encodeURIComponent(listing.ListingKey || "")}`;
  if (sale) {
    const price = Number(listing.ListPrice) || 0;
    const cashback = Math.min(price * 0.0025, 5000);
    return `
      <div class="ld-cashback sale">
        <div class="ld-cashback-pill">Cashback Offer</div>
        <div class="ld-cashback-headline">Get <em>$${Math.round(cashback).toLocaleString()}</em> cash back when you buy this home</div>
        <div class="ld-cashback-sub">Purchase this property with us and receive up to <strong>$${Math.round(cashback).toLocaleString()}</strong> back at closing &mdash; no catches, just more money in your pocket.</div>
        <div class="ld-cashback-actions">
          <a class="ld-cashback-cta primary" href="tel:+14166057488">Enquire Now</a>
          <button type="button" class="ld-cashback-cta secondary" data-share-url="${esc(shareUrl)}">Share</button>
        </div>
      </div>`;
  }
  return `
    <div class="ld-cashback rent">
      <div class="ld-cashback-pill">Free Service</div>
      <div class="ld-cashback-headline">Free rental service for <em>tenants</em></div>
      <div class="ld-cashback-sub">We'll help you secure this rental at no cost to you &mdash; our fee is covered by the landlord.</div>
      <div class="ld-cashback-actions">
        <a class="ld-cashback-cta primary" href="tel:+14166057488">Enquire Now</a>
        <button type="button" class="ld-cashback-cta secondary" data-share-url="${esc(shareUrl)}">Share</button>
      </div>
    </div>`;
}

// Directions/map — matches your real listings-directions.js: same MapTiler
// key, a small map centered on the listing, and a button that just opens
// Google Maps with the coordinates as the destination (no routing API).
const MAPTILER_KEY = "Zr8EXulAyt75JJibE0ol";

function renderMapDirections(listing) {
  const lat = parseFloat(listing.Latitude);
  const lng = parseFloat(listing.Longitude);
  if (!lat || !lng) return "";
  return `
    <div class="ld-section">
      <div class="ld-section-title">Location &amp; Directions</div>
      <div id="ld-map" class="ld-map" data-lat="${lat}" data-lng="${lng}"></div>
      <a class="ld-btn-secondary" style="margin-top:12px;" target="_blank"
         href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}">Get Directions</a>
    </div>`;
}

// Nearby places — your live site uses the Mapbox Search API for this, which
// needs a genuine Mapbox token (different service from MapTiler, which is
// what we actually have a key for). Since there's no Mapbox token, this
// uses the Overpass API (OpenStreetMap) instead: free, no key required,
// and consistent with MapTiler's own OSM-based map data. Same three
// categories as the live site (schools, restaurants, grocery).
function renderPoiSection(listing) {
  const lat = parseFloat(listing.Latitude);
  const lng = parseFloat(listing.Longitude);
  if (!lat || !lng) return "";
  return `
    <div class="ld-section" id="ld-poi-section" data-lat="${lat}" data-lng="${lng}">
      <div class="ld-section-title">What's Nearby</div>
      <div class="ld-poi-tabs">
        <button type="button" class="ld-poi-tab active" data-cat="school">Schools</button>
        <button type="button" class="ld-poi-tab" data-cat="restaurant">Restaurants</button>
        <button type="button" class="ld-poi-tab" data-cat="grocery">Grocery</button>
      </div>
      <div class="ld-poi-list" id="ld-poi-list"><div class="ld-hpi-loading">Loading nearby places…</div></div>
    </div>`;
}

// Confirmed from the real listings-similar-grid.js: same `grid` table, but
// it filters on an EXACT City match (not a wildcard/ilike), excludes the
// current property by address (not by ListingKey — grid rows are keyed
// differently), and — importantly — filters by the SAME status as the
// listing being viewed (a for-sale page never shows for-rent "similar"
// listings, and vice versa). We were missing that status filter before.
// Fetches up to 12 (not just the first 4) so the "Load more" button in the
// full-width Similar Listings section below has real rows to reveal instead
// of needing a second round trip — see renderListingDetail's SIMILAR_INITIAL/
// SIMILAR_FETCH_LIMIT split.
async function fetchSimilar(listing, env, mlsFetch) {
  if (!listing.City) return [];
  const sale = isSale(listing);
  const statusFilter = sale ? "&ListPrice=not.is.null" : "&TotalActualRent=not.is.null";
  const q = `grid?select=*,Media,PhotosCount&City=eq.${encodeURIComponent(listing.City)}` +
    `&UnparsedAddress=neq.${encodeURIComponent(listing.UnparsedAddress || "")}${statusFilter}&limit=12`;
  try {
    const res = await mlsFetch(env, q);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

// Shown right away, before "Load more" reveals the rest — matches 4/row on
// desktop (see .ld-similar-grid), so a page can open with a full first row
// even though the grid narrows to 3 then 1 column on smaller screens.
const SIMILAR_INITIAL_COUNT = 4;

function renderSimilarCard(row, hidden = false) {
  const photos = mediaUrls(row.Media);
  const sale = isSale(row);
  const price = sale ? fmtMoney(row.ListPrice) : (row.TotalActualRent ? (fmtMoney(row.TotalActualRent) || "") + "/mo" : "Price on request");
  // grid.PhotosCount — confirmed from listings-similar-grid.js (same field
  // used there for its "N Photos" badge).
  const photoCount = row.PhotosCount || 0;
  return `
    <a class="ld-similar-card${hidden ? " ld-hidden" : ""}" href="/listings/${esc(row.ListingKey || "")}">
      <div class="ld-similar-thumb" style="background-image:url('${esc(photos[0] || "")}')">
        <span class="ld-similar-status ${sale ? "sale" : "rent"}">${sale ? "For Sale" : "For Rent"}</span>
        ${photoCount > 0 ? `<span class="ld-similar-photocount">${photoCount} Photos</span>` : ""}
      </div>
      <div class="ld-similar-body">
        <div class="ld-similar-price">${esc(price)}</div>
        <div class="ld-similar-addr">${esc(row.UnparsedAddress || "")}</div>
        <div class="ld-similar-city">${esc(row.City || "")}</div>
      </div>
    </a>`;
}

export async function renderListingDetail(props, data, env, mlsFetch) {
  const listing = data?.listing || {};
  const photos = mediaItems(listing.Media);
  const dom = daysOnMarket(listing.OriginalEntryTimestamp);
  const sale = isSale(listing);

  const similar = mlsFetch ? await fetchSimilar(listing, env, mlsFetch) : [];

  const heroStatsHtml = [
    heroStat("dom", dom != null ? `${dom} ${dom === 1 ? "Day" : "Days"}` : null, "Days on Market"),
    heroStat("bed", listing.BedroomsTotal, "Bedrooms"),
    heroStat("bath", listing.BathroomsTotalInteger, "Bathrooms"),
    heroStat("parking", listing.ParkingTotal, "Parking"),
    heroStat("sqft", listing.AboveGradeFinishedArea ? Number(listing.AboveGradeFinishedArea).toLocaleString() : null, "Sq Ft"),
    heroStat("type", listing.StructureType || listing.PropertySubType, "Type"),
    heroStat("stories", listing.StoriesTotal || listing.Stories, "Stories"),
    heroStat("built", listing.YearBuilt, "Year Built"),
  ].join("");

  return `
  <div class="ld-wrap">
    <div class="ld-breadcrumb"><a href="/">Home</a> / <a href="/listings">Listings</a> / ${esc(listing.City || "")}</div>

    ${renderGallery(photos)}

    <div class="ld-layout">
      <div class="ld-main">
        <div class="ld-price-card">
          <span class="ld-status-tag ${sale ? "sale" : "rent"}">${sale ? "For Sale" : "For Rent"}</span>
          <div class="ld-price">${esc(priceDisplay(listing))}</div>
          <div class="ld-address">${esc(listing.UnparsedAddress || "")}${listing.City ? ", " + esc(listing.City) : ""}${listing.Province ? ", " + esc(listing.Province) : ""} <span class="ld-postal">${esc(listing.PostalCode || "")}</span></div>
          <div class="ld-price-card-bottom">
            <div class="ld-mls">MLS® <strong>${esc(listing.ListingKey || listing.ListingId || "")}</strong>${listing.OfficeName ? " | " + esc(listing.OfficeName) : ""}</div>
            <div class="ld-hero-actions">
              <a href="tel:+14166057488" class="ld-hero-btn ld-hero-btn-contact">Contact</a>
              <a href="#ld-mortgage-calc" class="ld-hero-btn ld-hero-btn-afford">Affordability Calculator</a>
            </div>
          </div>
        </div>

        <div class="ld-hero-stats">${heroStatsHtml}</div>

        ${props.showCashback !== false ? renderCashbackBanner(listing) : ""}

        ${listing.PublicRemarks ? `
        <div class="ld-section">
          <div class="ld-section-title">About This Property</div>
          <div class="ld-description">${esc(listing.PublicRemarks)}</div>
        </div>` : ""}

        ${renderFeatures(listing)}
        ${renderRooms(listing)}
        ${props.showMap !== false ? renderMapDirections(listing) : ""}
        ${props.showPoi !== false ? renderPoiSection(listing) : ""}

        ${props.showHpi !== false ? `
        <div class="ld-section" id="ld-hpi-section" data-city="${esc(listing.City || "")}">
          <div class="ld-section-title">Local Market Trends</div>
          <div class="ld-hpi-loading">Loading market data…</div>
        </div>` : ""}
      </div>

      <div class="ld-side">
        ${renderContactCard(listing, data?.settings || {})}
        ${props.showMortgageCalc !== false ? renderMortgageCalc(listing) : ""}
      </div>
    </div>

    ${similar.length ? `
    <!-- Similar Listings — full width, below BOTH the left and right panel
         (not inside .ld-main on the left, which is where this used to live).
         4/row desktop, 3/row tablet, 1/row mobile (see .ld-similar-grid
         breakpoints); "Load more" reveals the rest of what fetchSimilar
         already pulled (up to 12) without a second request. -->
    <div class="ld-section ld-similar-section" id="ld-similar-section">
      <div class="ld-section-title">Similar Listings</div>
      <div class="ld-similar-grid">
        ${similar.map((row, i) => renderSimilarCard(row, i >= SIMILAR_INITIAL_COUNT)).join("")}
      </div>
      ${similar.length > SIMILAR_INITIAL_COUNT ? `
      <button type="button" class="ld-btn-secondary ld-similar-load-more" id="ld-similar-load-more">
        Load More Listings
      </button>` : ""}
    </div>
    <script>
      (function() {
        var btn = document.getElementById('ld-similar-load-more');
        var section = document.getElementById('ld-similar-section');
        if (!btn || !section) return;
        btn.addEventListener('click', function() {
          var hidden = section.querySelectorAll('.ld-similar-card.ld-hidden');
          for (var i = 0; i < hidden.length; i++) hidden[i].classList.remove('ld-hidden');
          btn.remove();
        });
      })();
    </script>` : ""}
  </div>

  <style>
    .ld-wrap { max-width: 1440px; margin: 0 auto; padding: 24px 56px 64px; font-family: ${tokens.font.body}; color: ${tokens.color.ink}; background: ${tokens.color.surface}; }
    @media (max-width: 1100px) { .ld-wrap { padding: 20px 32px 48px; } }
    @media (max-width: 600px) {
      .ld-wrap { padding: 14px 12px 40px; }
      .ld-card, .ld-section, .ld-price-card { padding: 16px 16px; }
      .ld-price { font-size: 1.5rem; }
      .ld-price-card-bottom { flex-direction: column; align-items: flex-start; }
      .ld-hero-actions { width: 100%; }
      .ld-hero-btn { flex: 1 1 auto; text-align: center; }
      .ld-hero-stats { grid-template-columns: repeat(2,1fr); }
      .ld-hero-stat { padding: 14px 6px; border-right:1px solid ${tokens.color.line}; border-bottom:1px solid ${tokens.color.line}; }
      .ld-hero-stat:nth-child(2n) { border-right:none; }
      .ld-hero-stat:nth-last-child(-n+2) { border-bottom:none; }
      .ld-features-grid { grid-template-columns: 1fr; }
      .ld-room-row { grid-template-columns: 1fr; }
      .ld-room-col { border-right: none; border-bottom: 1px solid ${tokens.color.line}; }
      .ld-hpi-stats { grid-template-columns: 1fr; }
    }
    .ld-breadcrumb { font-size: 12px; color: ${tokens.color.ink45}; margin-bottom: 14px; }
    .ld-breadcrumb a { color: ${tokens.color.blue}; text-decoration: none; }

    /* Gallery collage — big hero + 2x2 thumb grid, a floating "Click to
       view gallery" pill over the seam (concept from your real-estate.html
       gallery), all opening the same Fancybox lightbox. */
    .ld-gallery { position:relative; display:grid; grid-template-columns: 1.6fr 1fr; gap:10px; border-radius:18px; overflow:hidden; margin-bottom:24px; height:460px; }
    .ld-hero-img { position:relative; display:block; background-size:cover; background-position:center; border-radius:18px; cursor:zoom-in; background-color:${tokens.color.surface}; }
    .ld-gallery-empty { display:flex; align-items:center; justify-content:center; height:280px; border-radius:18px; background:${tokens.color.surface}; color:${tokens.color.ink45}; }
    .ld-thumb-grid { display:grid; grid-template-columns:1fr 1fr; grid-template-rows:1fr 1fr; gap:10px; height:100%; }
    .ld-thumb { position:relative; display:block; background-size:cover; background-position:center; cursor:zoom-in; border-radius:14px; background-color:${tokens.color.surface}; }
    .ld-gallery-count { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; background:rgba(11,11,13,0.58); color:#fff; font-weight:700; font-size:16px; border-radius:14px; }
    .ld-gallery-count svg { width:22px; height:22px; }
    .ld-gallery-cta { position:absolute; left:50%; bottom:18px; transform:translateX(-50%); display:flex; align-items:center; gap:8px; background:${tokens.color.ink}; color:#fff; font-size:12.5px; font-weight:700; padding:10px 18px; border-radius:999px; text-decoration:none; box-shadow:0 6px 20px rgba(11,11,13,0.3); }
    .ld-gallery-cta svg { width:16px; height:16px; }
    .ld-gallery-cta:hover { background:${tokens.color.blue}; }
    @media (max-width: 760px) {
      .ld-gallery { grid-template-columns:1fr; height:300px; border-radius:16px; }
      .ld-hero-img { border-radius:16px; }
      .ld-thumb-grid { display:none; }
      .ld-gallery-cta { bottom:14px; }
    }

    /* Matches .ld-gallery's column split + gap exactly (1.6fr/1fr, 10px gap)
       so the price/stats card lines up under the hero photo and the sidebar
       lines up under the thumbnail grid — same grid math, same parent
       width, so the seams land in the same place. */
    .ld-layout { display:grid; grid-template-columns: 1.6fr 1fr; gap: 10px; align-items:start; }
    @media (max-width: 900px) { .ld-layout { grid-template-columns: 1fr; } }

    .ld-card, .ld-section { background:#fff; border:1px solid ${tokens.color.line}; border-radius:16px; padding:20px 22px; margin-bottom:16px; }

    /* Hero — concept ported from your real hero-container.js/hero-header.css
       (status badge + price + address on a card, stat-icon grid below), but
       kept in our light brand cards on the page's #f5f5f7 surface instead of
       the old dark navy banner — matches how your own real-estate.html
       actually lays it out (white cards on a light-grey page). */
    .ld-price-card { background:#fff; border:1px solid ${tokens.color.line}; border-radius:16px; padding:24px 26px 18px; margin-bottom:16px; }
    .ld-status-tag { display:inline-block; padding:4px 11px; border-radius:4px; font-size:11px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; margin-bottom:14px; color:#fff; }
    .ld-status-tag.sale { background:${tokens.color.ink}; }
    .ld-status-tag.rent { background:${tokens.color.warning}; }
    .ld-price { font-family:${tokens.font.display}; font-size:2.1rem; font-weight:600; margin-bottom:8px; color:${tokens.color.ink}; }
    .ld-address { font-size:17px; color:${tokens.color.ink}; margin-bottom:16px; }
    .ld-postal { color:${tokens.color.ink45}; }
    .ld-price-card-bottom { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; padding-top:14px; border-top:1px solid ${tokens.color.line}; }
    .ld-mls { font-size:13px; color:${tokens.color.ink45}; }
    .ld-mls strong { color:${tokens.color.ink70}; }
    .ld-hero-actions { display:flex; gap:10px; flex-wrap:wrap; }
    .ld-hero-btn { display:inline-block; padding:11px 20px; border-radius:999px; font-size:13px; font-weight:700; text-decoration:none; }
    .ld-hero-btn-contact { background:${tokens.color.ink}; color:#fff; }
    .ld-hero-btn-contact:hover { background:${tokens.color.blue}; }
    .ld-hero-btn-afford { background:${tokens.color.blue}; color:#fff; }
    .ld-hero-btn-afford:hover { background:${tokens.color.ink}; }

    .ld-hero-stats { display:grid; grid-template-columns:repeat(4,1fr); background:#fff; border:1px solid ${tokens.color.line}; border-radius:16px; overflow:hidden; margin-bottom:16px; }
    .ld-hero-stat { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; padding:20px 8px 18px; text-align:center; border-right:1px solid ${tokens.color.line}; border-bottom:1px solid ${tokens.color.line}; }
    .ld-hero-stat:nth-child(4n) { border-right:none; }
    .ld-hero-stat:nth-child(n+5) { border-bottom:none; }
    .ld-hero-stat i { display:flex; width:24px; height:24px; color:${tokens.color.ink}; }
    .ld-hero-stat i svg { width:100%; height:100%; }
    .ld-hero-stat-value { font-family:${tokens.font.display}; font-size:1.15rem; font-weight:700; color:${tokens.color.ink}; }
    .ld-hero-stat-label { font-size:10px; text-transform:uppercase; letter-spacing:0.05em; color:${tokens.color.ink45}; }

    .ld-section-title { font-family:${tokens.font.display}; font-size:1.1rem; font-weight:600; margin-bottom:14px; padding-bottom:10px; border-bottom:1px solid ${tokens.color.line}; }
    .ld-description { font-size:14px; line-height:1.75; color:${tokens.color.ink70}; white-space:pre-line; }

    .ld-features-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; }
    .ld-feature-item { font-size:13px; padding:10px 14px; background:${tokens.color.surface}; border-radius:8px; }

    .ld-room-table { border:1px solid ${tokens.color.line}; border-radius:12px; overflow:hidden; }
    .ld-room-row { display:grid; grid-template-columns:1fr 1fr 1fr; border-bottom:1px solid ${tokens.color.line}; }
    .ld-room-row:last-child { border-bottom:none; }
    .ld-room-col { padding:12px; border-right:1px solid ${tokens.color.line}; }
    .ld-room-col:last-child { border-right:none; }
    .ld-room-label { font-size:9px; text-transform:uppercase; letter-spacing:0.06em; color:${tokens.color.ink45}; margin-bottom:2px; }

    .ld-cashback { border-radius:16px; overflow:hidden; margin-bottom:16px; padding:22px 24px; position:relative; }
    .ld-cashback.sale { background:linear-gradient(135deg, ${tokens.color.ink} 0%, #1a1a1f 60%, ${tokens.color.blue} 140%); }
    .ld-cashback.rent { background:linear-gradient(135deg, #0d2b1f 0%, #1a4532 60%, ${tokens.color.success} 140%); }
    .ld-cashback-pill { display:inline-flex; padding:4px 12px; border-radius:20px; font-size:10px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; margin-bottom:10px; background:rgba(255,255,255,.18); color:#fff; }
    .ld-cashback-headline { font-family:${tokens.font.display}; font-size:1.35rem; font-weight:600; color:#fff; line-height:1.25; margin-bottom:6px; }
    .ld-cashback-headline em { font-style:italic; color:${tokens.color.blueDim}; }
    .ld-cashback-sub { font-size:13px; color:rgba(255,255,255,.75); line-height:1.55; margin-bottom:16px; max-width:520px; }
    .ld-cashback-actions { display:flex; gap:10px; flex-wrap:wrap; }
    .ld-cashback-cta { padding:10px 18px; border-radius:999px; font-size:12.5px; font-weight:700; text-decoration:none; cursor:pointer; border:none; }
    .ld-cashback-cta.primary { background:#fff; color:${tokens.color.ink}; }
    .ld-cashback-cta.secondary { background:rgba(255,255,255,.15); color:#fff; border:1px solid rgba(255,255,255,.3); }
    @media (max-width:600px) { .ld-cashback { padding:18px; } .ld-cashback-headline { font-size:1.1rem; } }

    .ld-map { height:280px; border-radius:12px; background:${tokens.color.surface}; overflow:hidden; }

    .ld-poi-tabs { display:flex; gap:8px; margin-bottom:14px; }
    .ld-poi-tab { padding:7px 14px; border-radius:999px; border:1px solid ${tokens.color.line}; background:#fff; font-family:${tokens.font.body}; font-size:12.5px; font-weight:600; color:${tokens.color.ink70}; cursor:pointer; }
    .ld-poi-tab.active { background:${tokens.color.ink}; color:#fff; border-color:${tokens.color.ink}; }
    .ld-poi-item { display:flex; justify-content:space-between; gap:12px; padding:12px 0; border-bottom:1px solid ${tokens.color.line}; font-size:13px; }
    .ld-poi-item:last-child { border-bottom:none; }
    .ld-poi-name { font-weight:600; }
    .ld-poi-addr { font-size:12px; color:${tokens.color.ink45}; margin-top:2px; }
    .ld-poi-dist { font-size:12.5px; color:${tokens.color.blue}; font-weight:700; white-space:nowrap; flex-shrink:0; }

    .ld-hpi-loading { font-size:13px; color:${tokens.color.ink45}; padding:20px; text-align:center; }
    .ld-hpi-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
    .ld-hpi-stat { background:${tokens.color.blueDim}; border-radius:10px; padding:14px; text-align:center; }
    .ld-hpi-stat-label { font-size:10px; text-transform:uppercase; color:${tokens.color.ink45}; margin-bottom:4px; }
    .ld-hpi-stat-value { font-family:${tokens.font.display}; font-size:1.2rem; font-weight:600; }
    .ld-hpi-stat-value.up { color:${tokens.color.success}; }
    .ld-hpi-stat-value.down { color:#c0362c; }

    /* Similar Listings is a full-width section below .ld-layout (not inside
       .ld-main), so it isn't bound by .ld-main's narrower column width —
       4/row desktop, 3/row tablet (<=900px), 1/row mobile (<=600px). */
    .ld-similar-section { max-width:none; }
    .ld-similar-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
    @media (max-width:900px) { .ld-similar-grid { grid-template-columns:repeat(3,1fr); } }
    @media (max-width:600px) { .ld-similar-grid { grid-template-columns:1fr; gap:10px; } }
    .ld-similar-card.ld-hidden { display:none; }
    .ld-similar-load-more { max-width:280px; margin:18px auto 0; }
    .ld-similar-card { display:block; text-decoration:none; color:inherit; border:1px solid ${tokens.color.line}; border-radius:12px; overflow:hidden; transition:transform .18s; }
    .ld-similar-card:hover { transform:translateY(-2px); }
    .ld-similar-thumb { position:relative; height:110px; background-size:cover; background-position:center; background-color:${tokens.color.surface}; }
    .ld-similar-status { position:absolute; top:8px; left:8px; padding:3px 8px; border-radius:4px; font-size:9.5px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; color:#fff; }
    .ld-similar-status.sale { background:${tokens.color.ink}; }
    .ld-similar-status.rent { background:${tokens.color.warning}; }
    .ld-similar-photocount { position:absolute; bottom:8px; right:8px; background:rgba(11,11,13,0.65); color:#fff; font-size:9.5px; font-weight:600; padding:2px 7px; border-radius:4px; }
    .ld-similar-body { padding:10px 12px; }
    .ld-similar-price { font-weight:700; font-size:14px; color:${tokens.color.blue}; }
    .ld-similar-addr { font-size:12px; margin-top:2px; }
    .ld-similar-city { font-size:11px; color:${tokens.color.ink45}; }

    .ld-card-title { font-family:${tokens.font.display}; font-size:1rem; font-weight:600; margin-bottom:14px; }
    .ld-card-subtitle { font-size:12px; color:${tokens.color.ink45}; margin-top:-8px; margin-bottom:14px; }
    .ld-contact-agent { display:flex; align-items:center; gap:12px; margin-bottom:14px; }
    .ld-contact-agent-photo { width:52px; height:52px; border-radius:50%; object-fit:cover; flex-shrink:0; background:${tokens.color.surface}; }
    .ld-contact-agent-name { font-family:${tokens.font.display}; font-size:14.5px; font-weight:600; }
    .ld-contact-agent-name-noimg { margin-bottom:6px; }
    .ld-contact-price { font-family:${tokens.font.display}; font-size:1.5rem; font-weight:600; }
    .ld-contact-office { font-size:12px; color:${tokens.color.ink45}; margin-bottom:14px; }
    .ld-contact-form input, .ld-contact-form textarea { width:100%; padding:10px 12px; border:1px solid ${tokens.color.line}; border-radius:8px; font-family:${tokens.font.body}; font-size:13px; margin-bottom:8px; box-sizing:border-box; }
    .ld-contact-form textarea { min-height:70px; resize:vertical; }
    .ld-btn-primary { width:100%; padding:13px; background:${tokens.color.blue}; color:#fff; border:none; border-radius:999px; font-weight:700; font-size:13px; cursor:pointer; }
    .ld-btn-primary:hover { background:${tokens.color.ink}; }
    .ld-btn-secondary { display:block; text-align:center; margin-top:10px; padding:11px; border:1px solid ${tokens.color.ink}; border-radius:999px; text-decoration:none; color:${tokens.color.ink}; font-size:13px; font-weight:700; }
    .ld-btn-secondary:hover { background:${tokens.color.ink}; color:#fff; }

    .ld-calc { display:flex; flex-direction:column; gap:10px; }
    .ld-calc label { font-size:12px; color:${tokens.color.ink70}; display:flex; flex-direction:column; gap:4px; }
    .ld-calc input { padding:8px 10px; border:1px solid ${tokens.color.line}; border-radius:6px; font-size:13px; }
    .ld-calc-result { margin-top:6px; padding-top:12px; border-top:1px solid ${tokens.color.line}; text-align:center; }
    .ld-calc-result-label { font-size:11px; color:${tokens.color.ink45}; text-transform:uppercase; }
    .ld-calc-result-value { font-family:${tokens.font.display}; font-size:1.4rem; font-weight:600; color:${tokens.color.blue}; }
  </style>

  <script>
  (function() {
    // Gallery — Fancybox, same CDN/library your real
    // listings-thumbnail-fancybox.js uses. Loaded once per page; binds to
    // every [data-fancybox="gallery"] anchor the gallery markup rendered.
    if (document.querySelector('[data-fancybox="gallery"]')) {
      var fbCss = document.createElement('link');
      fbCss.rel = 'stylesheet';
      fbCss.href = 'https://cdn.jsdelivr.net/npm/@fancyapps/ui/dist/fancybox.css';
      document.head.appendChild(fbCss);
      var fbScript = document.createElement('script');
      fbScript.src = 'https://cdn.jsdelivr.net/npm/@fancyapps/ui/dist/fancybox.umd.js';
      fbScript.onload = function() {
        if (window.Fancybox) {
          // autoStart:true so the lightbox always opens with the small
          // thumbnail strip visible — on mobile this is exactly "main
          // image on top, small gallery strip below" per Fancybox's own
          // responsive Thumbs layout, no extra work needed for that case.
          Fancybox.bind('[data-fancybox="gallery"]', {
            Thumbs: { autoStart: true },
            Toolbar: { display: ['zoom', 'fullscreen', 'download', 'close'] },
          });
        }
      };
      document.head.appendChild(fbScript);
    }

    // Mortgage calculator
    var calc = document.querySelector('.ld-calc');
    if (calc) {
      var price = parseFloat(calc.getAttribute('data-price')) || 0;
      var out = document.getElementById('ld-calc-output');
      function recalc() {
        var downPct = parseFloat(calc.querySelector('.ld-calc-down').value) || 0;
        var rate = parseFloat(calc.querySelector('.ld-calc-rate').value) || 0;
        var years = parseFloat(calc.querySelector('.ld-calc-years').value) || 25;
        var principal = price * (1 - downPct / 100);
        var monthlyRate = (rate / 100) / 12;
        var n = years * 12;
        var payment = monthlyRate === 0 ? principal / n : principal * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
        out.textContent = isFinite(payment) && payment > 0 ? '$' + Math.round(payment).toLocaleString('en-CA') : '—';
      }
      calc.addEventListener('input', recalc);
      recalc();
    }

    // HPI market trends — same public JSON the live site uses, fetched
    // client-side. Confirmed real shape (was wrong before): top-level key
    // is "cities", an OBJECT keyed by board slug (e.g. "oakville-milton"),
    // not a "regions" array — each entry has name/slug/latest.{compositeBenchmark,
    // momChange,yoyChange,marketCondition,propertyTypes}/history12m/peak.
    //
    // City -> board resolution: the real site does this via a separate
    // ontario-hpi-mapping.js module (BOARD_CITIES / NEIGHBORHOODS lookup
    // tables covering 28 Ontario boards) that I wasn't able to pull the
    // full source of. This does a best-effort match instead — exact slug,
    // then exact name, then a substring match for merged-board slugs like
    // "oakville-milton" containing "Oakville" — which covers most single-
    // city listings but won't be as precise as the real board mapping. If
    // you can paste the real BOARD_CITIES table, I'll wire up an exact match.
    var hpiSection = document.getElementById('ld-hpi-section');
    if (hpiSection) {
      var city = hpiSection.getAttribute('data-city') || '';
      var citySlug = city.trim().toLowerCase().replace(/\s+/g, '-');
      fetch('https://www.getsetsold.ca/ontario-housing-market/ontario-hpi-data.json')
        .then(function(r) { return r.json(); })
        .then(function(data) {
          var cities = (data && data.cities) || {};
          var match = null;
          if (citySlug && cities[citySlug]) {
            match = cities[citySlug];
          } else {
            var keys = Object.keys(cities);
            for (var i = 0; i < keys.length && !match; i++) {
              var entry = cities[keys[i]];
              if (entry && entry.name && entry.name.toLowerCase() === city.toLowerCase()) match = entry;
            }
            for (var j = 0; j < keys.length && !match; j++) {
              if (keys[j].indexOf(citySlug) !== -1) match = cities[keys[j]];
            }
          }
          var loading = hpiSection.querySelector('.ld-hpi-loading');
          if (!match || !match.latest) {
            if (loading) loading.textContent = 'Market trend data not available for this area.';
            return;
          }
          var l = match.latest;
          function fmtChg(n) {
            var cls = n > 0 ? 'up' : n < 0 ? 'down' : '';
            return '<span class="' + cls + '">' + (n > 0 ? '+' : '') + n.toFixed(1) + '%</span>';
          }
          hpiSection.innerHTML = '<div class="ld-section-title">Local Market Trends' + (match.name ? ' — ' + match.name : '') + '</div>' +
            '<div class="ld-hpi-stats">' +
              '<div class="ld-hpi-stat"><div class="ld-hpi-stat-label">Benchmark Price</div><div class="ld-hpi-stat-value">$' + Math.round(l.compositeBenchmark || 0).toLocaleString('en-CA') + '</div></div>' +
              '<div class="ld-hpi-stat"><div class="ld-hpi-stat-label">Month over Month</div><div class="ld-hpi-stat-value ' + (l.momChange > 0 ? 'up' : 'down') + '">' + fmtChg(l.momChange || 0) + '</div></div>' +
              '<div class="ld-hpi-stat"><div class="ld-hpi-stat-label">Year over Year</div><div class="ld-hpi-stat-value ' + (l.yoyChange > 0 ? 'up' : 'down') + '">' + fmtChg(l.yoyChange || 0) + '</div></div>' +
            '</div>';
        })
        .catch(function() {
          var loading = hpiSection.querySelector('.ld-hpi-loading');
          if (loading) loading.textContent = 'Market trend data unavailable.';
        });
    }

    // Cashback banner share button
    document.querySelectorAll('.ld-cashback-cta.secondary[data-share-url]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var url = location.origin + btn.getAttribute('data-share-url');
        if (navigator.share) {
          navigator.share({ url: url }).catch(function() {});
        } else if (navigator.clipboard) {
          navigator.clipboard.writeText(url).then(function() {
            var old = btn.textContent;
            btn.textContent = 'Copied!';
            setTimeout(function() { btn.textContent = old; }, 1800);
          });
        }
      });
    });

    // Directions map — same MapTiler key/style your live site uses
    var mapEl = document.getElementById('ld-map');
    if (mapEl) {
      var lat = parseFloat(mapEl.getAttribute('data-lat'));
      var lng = parseFloat(mapEl.getAttribute('data-lng'));
      var mlScript = document.createElement('script');
      mlScript.src = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js';
      var mlCss = document.createElement('link');
      mlCss.rel = 'stylesheet';
      mlCss.href = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';
      document.head.appendChild(mlCss);
      mlScript.onload = function() {
        var map = new maplibregl.Map({
          container: 'ld-map',
          style: 'https://api.maptiler.com/maps/streets-v4/style.json?key=${MAPTILER_KEY}',
          center: [lng, lat],
          zoom: 14,
          interactive: false,
        });
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }));
        new maplibregl.Marker({ color: '${tokens.color.blue}' }).setLngLat([lng, lat]).addTo(map);
      };
      document.head.appendChild(mlScript);
    }

    // Nearby places — Overpass API (OpenStreetMap), no key required
    var poiSection = document.getElementById('ld-poi-section');
    if (poiSection) {
      var pLat = parseFloat(poiSection.getAttribute('data-lat'));
      var pLng = parseFloat(poiSection.getAttribute('data-lng'));
      var poiList = document.getElementById('ld-poi-list');
      var OVERPASS_TAGS = {
        school: '["amenity"~"school|college|university"]',
        restaurant: '["amenity"~"restaurant|cafe|fast_food"]',
        grocery: '["shop"~"supermarket|grocery|convenience"]',
      };
      var poiCache = {};

      function haversineKm(la1, lo1, la2, lo2) {
        var R = 6371, r = function(d) { return d * Math.PI / 180; };
        var a = Math.sin(r(la2 - la1) / 2) ** 2 + Math.cos(r(la1)) * Math.cos(r(la2)) * Math.sin(r(lo2 - lo1) / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      }

      function loadPoi(cat) {
        if (poiCache[cat]) { renderPoiList(poiCache[cat]); return; }
        poiList.innerHTML = '<div class="ld-hpi-loading">Loading nearby places\\u2026</div>';
        var radius = 3000; // meters
        var q = '[out:json][timeout:15];(node' + OVERPASS_TAGS[cat] + '(around:' + radius + ',' + pLat + ',' + pLng + '););out center 20;';
        fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: q })
          .then(function(r) { return r.json(); })
          .then(function(data) {
            var items = (data.elements || []).map(function(el) {
              var tags = el.tags || {};
              var d = haversineKm(pLat, pLng, el.lat, el.lon);
              return {
                name: tags.name || 'Unnamed',
                addr: [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ') || tags['addr:city'] || '',
                dist: d,
              };
            }).sort(function(a, b) { return a.dist - b.dist; }).slice(0, 8);
            poiCache[cat] = items;
            renderPoiList(items);
          })
          .catch(function() {
            poiList.innerHTML = '<div class="ld-hpi-loading">Nearby places unavailable right now.</div>';
          });
      }

      function renderPoiList(items) {
        if (!items.length) { poiList.innerHTML = '<div class="ld-hpi-loading">Nothing found nearby.</div>'; return; }
        poiList.innerHTML = items.map(function(p) {
          return '<div class="ld-poi-item"><div><div class="ld-poi-name">' + p.name + '</div>' +
            (p.addr ? '<div class="ld-poi-addr">' + p.addr + '</div>' : '') + '</div>' +
            '<div class="ld-poi-dist">' + p.dist.toFixed(1) + ' km</div></div>';
        }).join('');
      }

      poiSection.querySelectorAll('.ld-poi-tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
          poiSection.querySelectorAll('.ld-poi-tab').forEach(function(t) { t.classList.remove('active'); });
          tab.classList.add('active');
          loadPoi(tab.getAttribute('data-cat'));
        });
      });
      loadPoi('school');
    }
  })();
  </script>`;
}
