// workers/src/blocks-realestate.js
//
// Renderer functions for the block types registered in 0003_blocks_and_pages.sql.
// Each export takes (props, data) and returns an HTML string — `data` is whatever
// the Worker already fetched for that block's `data_source` (grid rows, a single
// property row, etc.) before calling the renderer. Pure-content blocks (hero_search,
// service_tiles, cta_band, process_steps, stat_band, testimonial, lead_form) get
// `data = null` and render from `props` alone.
//
// Reconciled with the real tokens.js (its `color` keys now match this brand
// exactly — see the updated tokens.js). No more local color duplication.
import { tokens } from './tokens.js';
const COLOR = {
  ink: tokens.color.ink,
  blue: tokens.color.blue,
  blueDim: tokens.color.blueDim,
  surface: tokens.color.surface,
  success: tokens.color.success,
  successDim: tokens.color.successDim,
};

const money = (n) => `$${Number(n).toLocaleString()}`;

// A `grid` row -> the shape every real-estate block needs. Centralizing this
// means sync bugs (like the ListOfficeKey one) only ever need fixing in one place.
function normalizeListing(row) {
  const forLease = !!row.TotalActualRent;
  return {
    key: row.ListingKey,
    address: row.UnparsedAddress,
    city: row.City,
    priceLabel: forLease ? `${money(row.TotalActualRent)}/mo` : money(row.ListPrice),
    status: forLease ? 'For Rent' : 'For Sale',
    beds: row.BedroomsTotal,
    baths: row.BathroomsTotalInteger,
    parking: row.ParkingTotal,
    sqft: row.AboveGradeFinishedArea ?? row.LivingArea ?? null,
    // `grid` rows have Media already flattened to a plain URL string by
    // ddf-sync.js. `property` rows (used by the office_only filter) keep
    // Media as the raw DDF shape: an array of objects with a MediaURL
    // field — same shape listing_detail() already reads directly
    // (p.Media?.[0]?.MediaURL). Handle both here so featured_listings
    // photos work regardless of which table the row came from.
    photo: typeof row.Media === 'string' ? row.Media : (row.Media?.[0]?.MediaURL || null),
    officeKey: row.ListOfficeKey,
    officeName: row.OfficeName,
    lat: row.Latitude,
    lng: row.Longitude,
  };
}

const statusBadge = (status) => {
  const lease = status === 'For Rent';
  return `background:${lease ? COLOR.blueDim : COLOR.successDim}; color:${lease ? COLOR.blue : COLOR.success};`;
};

// =====================================================
// hero_search — Home / Service Landing hero
// =====================================================
export function hero_search(props) {
  const stats = (props.stats || [])
    .map(s => `<div class="stat"><div class="stat-value">${s.value}</div><div class="stat-label">${s.label}</div></div>`)
    .join('');

  return `
  <section class="block hero-search">
    ${props.eyebrow ? `<div class="eyebrow">${props.eyebrow}</div>` : ''}
    <h1>${props.headline || ''}</h1>
    ${props.subcopy ? `<p class="subcopy">${props.subcopy}</p>` : ''}
    ${props.showSearch ? `
      <form class="search-bar" method="get" action="/listings">
        <input name="q" placeholder="Search by city, neighbourhood or MLS®#">
        <button type="submit">Search</button>
      </form>` : ''}
    ${stats ? `<div class="stat-row">${stats}</div>` : ''}
  </section>`;
}

// =====================================================
// service_tiles
// =====================================================
export function service_tiles(props) {
  const tiles = (props.tiles || []).map(t => `
    <a href="${t.link || '#'}" class="service-tile tile-${t.style || 'light'}">
      <h3>${t.title}</h3>
      <p>${t.copy || ''}</p>
      <span class="tile-cta">${t.cta || 'Learn more'} &rarr;</span>
    </a>`).join('');
  return `<section class="block service-tiles">${tiles}</section>`;
}

// =====================================================
// cta_band
// =====================================================
export function cta_band(props) {
  return `
  <section class="block cta-band cta-${props.style || 'dark'}">
    <div>
      <h2>${props.headline || ''}</h2>
      <p>${props.copy || ''}</p>
    </div>
    <a href="${props.ctaLink || '#'}" class="btn btn-primary">${props.ctaLabel || 'Learn more'}</a>
  </section>`;
}

// =====================================================
// process_steps
// =====================================================
export function process_steps(props) {
  const steps = (props.steps || []).map((s, i) => `
    <div class="step">
      <div class="step-num">${i + 1}</div>
      <div class="step-title">${s.title}</div>
      <p>${s.copy || ''}</p>
    </div>`).join('');
  return `
  <section class="block process-steps">
    ${props.heading ? `<h2>${props.heading}</h2>` : ''}
    <div class="step-grid">${steps}</div>
  </section>`;
}

// =====================================================
// stat_band
// =====================================================
export function stat_band(props) {
  const stats = (props.stats || [])
    .map(s => `<div class="stat"><div class="stat-value">${s.value}</div><div class="stat-label">${s.label}</div></div>`)
    .join('');
  return `<section class="block stat-band stat-${props.style || 'bordered'}">${stats}</section>`;
}

// =====================================================
// testimonial
// =====================================================
export function testimonial(props) {
  return `
  <section class="block testimonial">
    <div class="avatar"></div>
    <div>
      <p class="quote">&ldquo;${props.quote || ''}&rdquo;</p>
      <div class="attribution">${props.name || ''} &middot; ${props.detail || ''}</div>
    </div>
  </section>`;
}

// =====================================================
// lead_form — writes to `leads` via the Worker's form endpoint, tagged with formType
// =====================================================
export function lead_form(props) {
  const fieldSets = {
    address_only: `<input name="address" placeholder="Property address" required>`,
    name_email_phone: `
      <input name="name" placeholder="Full name" required>
      <input name="email" type="email" placeholder="Email" required>
      <input name="phone" placeholder="Phone">`,
    full_buyer: `
      <input name="name" placeholder="Full name" required>
      <input name="email" type="email" placeholder="Email" required>
      <input name="budget_max" placeholder="Max budget">
      <input name="areas" placeholder="Preferred areas">`,
  };
  return `
  <section class="block lead-form">
    <div class="lead-copy">
      <h2>${props.heading || ''}</h2>
      <p>${props.copy || ''}</p>
    </div>
    <form class="lead-fields" method="post" action="/api/leads">
      <input type="hidden" name="form_type" value="${props.formType || 'contact'}">
      ${fieldSets[props.fields] || fieldSets.address_only}
      <button type="submit">${props.ctaLabel || 'Submit'}</button>
    </form>
  </section>`;
}

// =====================================================
// featured_listings — data: array of `grid` rows, already filtered/limited by the Worker
// =====================================================
export function featured_listings(props, data) {
  const listings = (data || []).map(normalizeListing);
  const cards = listings.map(l => `
    <a href="/listings/${l.key}" class="listing-card">
      <div class="listing-photo" style="${l.photo ? `background-image:url('${l.photo}')` : 'background:' + COLOR.surface}">
        <span class="badge" style="${statusBadge(l.status)}">${l.status}</span>
      </div>
      <div class="listing-body">
        <div class="listing-price">${l.priceLabel}</div>
        <div class="listing-address">${l.address}, ${l.city}</div>
      </div>
    </a>`).join('');

  return `
  <section class="block featured-listings">
    <div class="section-head">
      <h2>${props.heading || 'Featured listings'}</h2>
      <a href="/listings" class="see-all">View all &rarr;</a>
    </div>
    <div class="listing-grid grid-3">${cards}</div>
  </section>`;
}

// =====================================================
// listing_grid — full, client-interactive city listings page. data: the
// FIRST page's { listings, total } (server-rendered for instant first paint
// and SEO), then the client re-fetches from /api/listings-search on every
// city/type/beds/price/page change via fetch(), matching the function of
// the real listings.html reference (city dropdown, sale/rent pills, price &
// beds filters, pagination) but styled in this site's own black/blue pill
// system instead of its navy theme, and without exposing any Supabase key
// client-side — /api/listings-search proxies mlsFetch server-side instead.
let listingGridCounter = 0;

function listingCardHtml(l) {
  return `
    <a href="/listings/${l.key}" class="listing-card">
      <div class="listing-photo" style="${l.photo ? `background-image:url('${l.photo}')` : 'background:' + COLOR.surface}">
        <span class="badge" style="${statusBadge(l.status)}">${l.status}</span>
      </div>
      <div class="listing-body">
        <div class="listing-price">${l.priceLabel}</div>
        <div class="listing-address">${l.address || ''}, ${l.city || ''}</div>
        <div class="listing-specs">
          <span>${l.beds ?? '–'} bd</span><span>${l.baths ?? '–'} ba</span>
          <span>${l.parking ?? '–'} pk</span><span>${l.sqft ? l.sqft.toLocaleString() : '–'} sqft</span>
        </div>
      </div>
    </a>`;
}

export function listing_grid(props, data) {
  const id = `lg-${listingGridCounter++}`;
  const listings = (data?.listings || []).map(normalizeListing);
  const total = data?.total ?? listings.length;
  const pageSize = props.pageSize || 12;
  const cards = listings.map(listingCardHtml).join('');
  const defaultCity = props.defaultArea || '';
  // listingType is the real param/value name used across your site
  // (?city=Hamilton&listingType=lease vs listingType=sale) — 'sale' | 'lease'
  // | '' (both). Kept `defaultType` as an accepted legacy prop name too.
  const defaultListingType = props.defaultListingType || (props.defaultType === 'rent' ? 'lease' : props.defaultType) || '';
  // Each page's own default city becomes the heading unless the page
  // supplies an explicit override — "Listings" alone on a page that's
  // scoped to e.g. Hamilton was the "generic on every page" bug.
  const defaultHeading = defaultCity ? `${defaultCity} Listings` : 'Listings';

  return `
  <section class="block-full listing-grid-page" id="${id}">
    <div class="section-head">
      <div>
        <h1 id="${id}-heading">${props.heading || defaultHeading}</h1>
        <div class="result-count" id="${id}-count">${total} active listings</div>
      </div>
      <div class="view-toggle">
        <a class="active" href="#">Grid</a>
        <a href="/listings/map">Map</a>
      </div>
    </div>
    <div class="filter-bar" id="${id}-filters">
      <select class="filter-select" id="${id}-city">
        <option value="">All Cities</option>
      </select>
      <button class="filter-pill${defaultListingType === '' ? ' active' : ''}" data-type="">All</button>
      <button class="filter-pill${defaultListingType === 'sale' ? ' active' : ''}" data-type="sale">For Sale</button>
      <button class="filter-pill${defaultListingType === 'lease' ? ' active' : ''}" data-type="lease">For Rent</button>
      <select class="filter-select" id="${id}-beds">
        <option value="0">Any beds</option>
        <option value="1">1+ bd</option>
        <option value="2">2+ bd</option>
        <option value="3">3+ bd</option>
        <option value="4">4+ bd</option>
        <option value="5">5+ bd</option>
      </select>
      <input class="filter-input" type="number" id="${id}-price-min" placeholder="Min $">
      <input class="filter-input" type="number" id="${id}-price-max" placeholder="Max $">
      <button class="btn-outline-sm" id="${id}-reset" type="button">Reset</button>
    </div>
    <div class="listing-grid grid-3" id="${id}-grid">${cards}</div>
    <div class="pagination-row" id="${id}-pagination"></div>
    <script>
    (function() {
      var root = document.getElementById('${id}');
      if (!root) return;
      var citySel = document.getElementById('${id}-city');
      var bedsSel = document.getElementById('${id}-beds');
      var priceMinEl = document.getElementById('${id}-price-min');
      var priceMaxEl = document.getElementById('${id}-price-max');
      var gridEl = document.getElementById('${id}-grid');
      var countEl = document.getElementById('${id}-count');
      var pagEl = document.getElementById('${id}-pagination');
      var pageSize = ${pageSize};
      var headingEl = document.getElementById('${id}-heading');
      var cityLabel = ${JSON.stringify(defaultCity)};
      // state.listingType: '' (all) | 'sale' | 'lease' — matches the real
      // ?listingType= values used site-wide, not an internal-only code.
      var state = { city: '${defaultCity.replace(/'/g, "\\'")}', listingType: '${defaultListingType}', beds: 0, priceMin: 0, priceMax: 0, page: 1 };

      function updateHeading() {
        if (!headingEl) return;
        headingEl.textContent = (state.city || cityLabel || '') ? (state.city || cityLabel) + ' Listings' : 'Listings';
      }

      function esc(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
      function money(n) { return '$' + Number(n).toLocaleString(); }

      function cardHtml(l) {
        var forLease = !!l.TotalActualRent && !l.ListPrice;
        var status = forLease ? 'For Rent' : 'For Sale';
        var badgeStyle = forLease ? 'background:${COLOR.blueDim};color:${COLOR.blue};' : 'background:${COLOR.successDim};color:${COLOR.success};';
        var price = forLease ? money(l.TotalActualRent) + '/mo' : money(l.ListPrice);
        var photo = l.Media || '';
        return '<a href="/listings/' + l.ListingKey + '" class="listing-card">' +
          '<div class="listing-photo" style="' + (photo ? "background-image:url('" + photo + "')" : 'background:${COLOR.surface}') + '">' +
            '<span class="badge" style="' + badgeStyle + '">' + status + '</span>' +
          '</div>' +
          '<div class="listing-body">' +
            '<div class="listing-price">' + price + '</div>' +
            '<div class="listing-address">' + esc(l.UnparsedAddress) + ', ' + esc(l.City) + '</div>' +
            '<div class="listing-specs">' +
              '<span>' + (l.BedroomsTotal != null ? l.BedroomsTotal : '–') + ' bd</span>' +
              '<span>' + (l.BathroomsTotalInteger != null ? l.BathroomsTotalInteger : '–') + ' ba</span>' +
              '<span>' + (l.ParkingTotal != null ? l.ParkingTotal : '–') + ' pk</span>' +
              '<span>' + (l.AboveGradeFinishedArea ? Number(l.AboveGradeFinishedArea).toLocaleString() : '–') + ' sqft</span>' +
            '</div>' +
          '</div>' +
        '</a>';
      }

      function renderPagination(total) {
        var pages = Math.max(1, Math.ceil(total / pageSize));
        if (pages <= 1) { pagEl.innerHTML = ''; return; }
        var html = '';
        for (var i = 1; i <= pages; i++) {
          if (pages > 9 && i !== 1 && i !== pages && Math.abs(i - state.page) > 2) {
            if (i === 2 || i === pages - 1) html += '<span class="page-ellipsis">…</span>';
            continue;
          }
          html += '<button type="button" class="page-btn' + (i === state.page ? ' active' : '') + '" data-page="' + i + '">' + i + '</button>';
        }
        pagEl.innerHTML = html;
        Array.prototype.forEach.call(pagEl.querySelectorAll('.page-btn'), function(btn) {
          btn.addEventListener('click', function() { state.page = parseInt(btn.dataset.page, 10); load(); window.scrollTo({top: root.offsetTop - 20, behavior: 'smooth'}); });
        });
      }

      function load() {
        gridEl.style.opacity = '0.5';
        var qs = new URLSearchParams();
        if (state.city) qs.set('city', state.city);
        if (state.listingType) qs.set('listingType', state.listingType);
        if (state.beds) qs.set('beds', state.beds);
        if (state.priceMin) qs.set('priceMin', state.priceMin);
        if (state.priceMax) qs.set('priceMax', state.priceMax);
        qs.set('page', state.page);
        qs.set('pageSize', pageSize);
        fetch('/api/listings-search?' + qs.toString())
          .then(function(r) { return r.json(); })
          .then(function(data) {
            var listings = data.listings || [];
            gridEl.innerHTML = listings.map(cardHtml).join('') || '<div class="empty-state">No listings match these filters.</div>';
            gridEl.style.opacity = '1';
            countEl.textContent = (data.total || listings.length) + ' active listings';
            renderPagination(data.total || listings.length);
            updateHeading();
            // Every filter that actually affects results lives in the URL,
            // matching the real site's shareable-link behaviour, e.g.
            // ?city=Hamilton&listingType=sale&priceMin=500000&priceMax=750000
            var url = new URL(window.location);
            if (state.city) url.searchParams.set('city', state.city); else url.searchParams.delete('city');
            if (state.listingType) url.searchParams.set('listingType', state.listingType); else url.searchParams.delete('listingType');
            if (state.beds) url.searchParams.set('beds', state.beds); else url.searchParams.delete('beds');
            if (state.priceMin) url.searchParams.set('priceMin', state.priceMin); else url.searchParams.delete('priceMin');
            if (state.priceMax) url.searchParams.set('priceMax', state.priceMax); else url.searchParams.delete('priceMax');
            url.searchParams.delete('type');
            if (state.page > 1) url.searchParams.set('page', state.page); else url.searchParams.delete('page');
            try { window.history.replaceState({}, '', url); } catch(e) {}
          })
          .catch(function() { gridEl.style.opacity = '1'; });
      }

      fetch('/api/cities').then(function(r) { return r.json(); }).then(function(data) {
        (data.cities || []).forEach(function(c) {
          var opt = document.createElement('option');
          opt.value = c; opt.textContent = c;
          if (c === state.city) opt.selected = true;
          citySel.appendChild(opt);
        });
      });

      citySel.addEventListener('change', function() { state.city = citySel.value; state.page = 1; load(); });
      bedsSel.addEventListener('change', function() { state.beds = parseInt(bedsSel.value, 10) || 0; state.page = 1; load(); });
      priceMinEl.addEventListener('change', function() { state.priceMin = parseInt(priceMinEl.value, 10) || 0; state.page = 1; load(); });
      priceMaxEl.addEventListener('change', function() { state.priceMax = parseInt(priceMaxEl.value, 10) || 0; state.page = 1; load(); });
      Array.prototype.forEach.call(root.querySelectorAll('.filter-pill'), function(btn) {
        btn.addEventListener('click', function() {
          Array.prototype.forEach.call(root.querySelectorAll('.filter-pill'), function(b) { b.classList.remove('active'); });
          btn.classList.add('active');
          state.listingType = btn.dataset.type;
          state.page = 1;
          load();
        });
      });
      document.getElementById('${id}-reset').addEventListener('click', function() {
        state = { city: '', listingType: '', beds: 0, priceMin: 0, priceMax: 0, page: 1 };
        citySel.value = ''; bedsSel.value = '0'; priceMinEl.value = ''; priceMaxEl.value = '';
        Array.prototype.forEach.call(root.querySelectorAll('.filter-pill'), function(b) { b.classList.toggle('active', b.dataset.type === ''); });
        load();
      });

      /* Restore full filter state from the URL on load — city, listingType,
         beds, priceMin, priceMax, page — so a shared link like
         ?city=Hamilton&listingType=lease reproduces the same results
         (also accepts the old ?type=sale|rent shape for any stale links). */
      var params = new URLSearchParams(window.location.search);
      if (params.get('city')) { state.city = params.get('city'); }
      var lt = params.get('listingType') || (params.get('type') === 'rent' ? 'lease' : params.get('type') === 'sale' ? 'sale' : '');
      if (lt === 'sale' || lt === 'lease') {
        state.listingType = lt;
        Array.prototype.forEach.call(root.querySelectorAll('.filter-pill'), function(b) { b.classList.toggle('active', b.dataset.type === state.listingType); });
      }
      if (params.get('beds')) { state.beds = parseInt(params.get('beds'), 10) || 0; bedsSel.value = String(state.beds); }
      if (params.get('priceMin')) { state.priceMin = parseInt(params.get('priceMin'), 10) || 0; priceMinEl.value = state.priceMin; }
      if (params.get('priceMax')) { state.priceMax = parseInt(params.get('priceMax'), 10) || 0; priceMaxEl.value = state.priceMax; }
      if (params.get('page')) { state.page = parseInt(params.get('page'), 10) || 1; }
      updateHeading();
      renderPagination(${total});
      if (params.get('city') || lt || params.get('beds') || params.get('priceMin') || params.get('priceMax') || params.get('page')) load();
    })();
    </script>
  </section>`;
}

// Same MapTiler key used on the listing detail page's Location & Directions
// map and confirmed from your real map-search.html (`const MBTOKEN = '...'`
// passed as both the MapLibre style key AND assigned to mapboxgl.accessToken
// — that second part is a no-op with MapLibre, which is all this needs).
const MAPTILER_KEY = 'Zr8EXulAyt75JJibE0ol';

// Unique-ish per-render id so two map_split_search blocks on the same page
// (or the same block rendered twice, e.g. live preview + saved page) never
// collide on a single hardcoded #map-canvas id.
let mapBlockCounter = 0;

// =====================================================
// map_split_search — data: { listings } (same grid rows, with lat/lng).
// Previously this block only prepared listing+coordinate data and left
// #map-canvas empty with a "mount a real map provider" comment — nothing
// ever rendered a map. Wired up for real now: loads MapLibre GL + the same
// MapTiler style your listings-directions.js/hero maps use, drops a price-
// bubble marker per listing (same concept as your real map-search.html),
// and syncs list-row <-> marker selection both ways.
// =====================================================
export function map_split_search(props, data) {
  const listings = (data?.listings || []).map(normalizeListing).filter((l) => l.lat && l.lng);
  const mapId = 'map-canvas-' + (++mapBlockCounter);

  const rows = listings.map(l => `
    <div class="map-list-row" data-key="${l.key}">
      <div class="thumb" style="${l.photo ? `background-image:url('${l.photo}')` : 'background:' + COLOR.surface}"></div>
      <div>
        <div class="row-top">
          <div class="row-price">${l.priceLabel}</div>
          <span class="badge" style="${statusBadge(l.status)}">${l.status}</span>
        </div>
        <div class="row-address">${l.address}</div>
        <div class="row-specs">${l.beds ?? '–'} bd &middot; ${l.baths ?? '–'} ba &middot; ${l.sqft ? l.sqft.toLocaleString() : '–'} sqft</div>
      </div>
    </div>`).join('');

  const pins = listings.map(l => ({
    key: l.key, lat: l.lat, lng: l.lng, price: l.priceLabel, status: l.status,
    address: l.address, beds: l.beds, baths: l.baths, photo: l.photo || '',
    detailUrl: '/listings/' + encodeURIComponent(l.key || ''),
  }));

  return `
  <section class="block map-split">
    <div class="map-list-panel">
      <div class="panel-head"><strong>${listings.length}</strong> listings in view</div>
      <div class="map-list-scroll" id="${mapId}-list">${rows || '<div class="map-empty">No listings with map coordinates in this area yet.</div>'}</div>
    </div>
    <div class="map-panel" id="${mapId}"></div>
  </section>
  <script>
  (function() {
    var pins = ${JSON.stringify(pins)};
    var mapEl = document.getElementById('${mapId}');
    if (!mapEl || !pins.length) return;

    function esc(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

    function init() {
      var map = new maplibregl.Map({
        container: '${mapId}',
        style: 'https://api.maptiler.com/maps/streets-v4/style.json?key=${MAPTILER_KEY}',
        center: [pins[0].lng, pins[0].lat],
        zoom: 12,
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

      var markers = {};
      var activeEl = null;
      var activePopup = null;

      function closePopup() {
        if (activePopup) { activePopup.remove(); activePopup = null; }
        if (activeEl) { activeEl.classList.remove('active'); activeEl = null; }
        document.querySelectorAll('#${mapId}-list .map-list-row.active').forEach(function(r) { r.classList.remove('active'); });
      }
      map.on('click', closePopup);

      function selectPin(p, marker, markerEl) {
        closePopup();
        markerEl.classList.add('active');
        activeEl = markerEl;
        var row = document.querySelector('#${mapId}-list .map-list-row[data-key="' + p.key + '"]');
        if (row) { row.classList.add('active'); row.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
        var img = p.photo ? '<img class="map-popup-img" src="' + esc(p.photo) + '" alt="">' : '';
        var html = img +
          '<div class="map-popup-body">' +
            '<div class="map-popup-price">' + esc(p.price) + '</div>' +
            '<div class="map-popup-addr">' + esc(p.address || '') + '</div>' +
            '<div class="map-popup-specs">' + (p.beds ?? '–') + ' bd &middot; ' + (p.baths ?? '–') + ' ba</div>' +
            '<a class="map-popup-link" href="' + esc(p.detailUrl) + '">View Details &rarr;</a>' +
          '</div>';
        activePopup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: [0, -8], maxWidth: '260px' })
          .setLngLat([p.lng, p.lat]).setHTML(html).addTo(map);
      }

      var bounds = new maplibregl.LngLatBounds();
      pins.forEach(function(p) {
        var el = document.createElement('div');
        el.className = 'map-pin ' + (p.status === 'For Rent' ? 'lease' : 'sale');
        el.textContent = p.price;
        el.addEventListener('click', function(e) { e.stopPropagation(); selectPin(p, marker, el); });
        var marker = new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map);
        markers[p.key] = { marker: marker, el: el };
        bounds.extend([p.lng, p.lat]);
      });
      if (pins.length > 1) map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 0 });

      document.querySelectorAll('#${mapId}-list .map-list-row').forEach(function(row) {
        row.addEventListener('click', function() {
          var key = row.getAttribute('data-key');
          var p = pins.find(function(x) { return x.key === key; });
          var m = markers[key];
          if (!p || !m) return;
          map.flyTo({ center: [p.lng, p.lat], zoom: 15 });
          selectPin(p, m.marker, m.el);
        });
      });
    }

    if (window.maplibregl) { init(); return; }
    if (!document.querySelector('link[data-maplibre-css]')) {
      var css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css';
      css.setAttribute('data-maplibre-css', '1');
      document.head.appendChild(css);
    }
    var script = document.createElement('script');
    script.src = 'https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js';
    script.onload = init;
    document.head.appendChild(script);
  })();
  </script>`;
}

// =====================================================
// listing_detail — data: { listing: property row, officeName }
// =====================================================
export function listing_detail(props, data) {
  const p = data?.listing || {};
  const forLease = !!p.TotalActualRent;
  const priceLabel = forLease ? `${money(p.TotalActualRent)}/mo` : money(p.ListPrice);
  const specs = [
    { label: 'Beds', value: p.BedroomsTotal },
    { label: 'Baths', value: p.BathroomsTotalInteger },
    { label: 'Parking', value: p.ParkingTotal },
    { label: 'Sqft', value: (p.LivingArea ?? p.AboveGradeFinishedArea)?.toLocaleString() },
  ].map(s => `<div class="spec"><div class="spec-value">${s.value ?? '–'}</div><div class="spec-label">${s.label}</div></div>`).join('');

  return `
  <section class="block listing-detail">
    <div class="gallery">
      <div class="hero-photo" style="${p.Media?.[0]?.MediaURL ? `background-image:url('${p.Media[0].MediaURL}')` : ''}"></div>
    </div>
    <div class="title-row">
      <div>
        <span class="badge" style="${statusBadge(forLease ? 'For Rent' : 'For Sale')}">${forLease ? 'For Rent' : 'For Sale'}</span>
        <h1>${p.UnparsedAddress || ''}</h1>
        <div class="sub">${p.City || ''}, ${p.Province || 'ON'} &middot; ${p.PostalCode || ''}</div>
      </div>
      <div class="price">${priceLabel}</div>
    </div>
    <div class="specs-row">${specs}</div>
    <div class="body-split">
      <div class="description">
        <h2>About this home</h2>
        <p>${p.PublicRemarks || ''}</p>
      </div>
      ${props.showAgentCard !== false ? `
      <aside class="agent-card">
        <div class="agent-name">Rohit Sharma</div>
        <div class="agent-office">${data?.officeName || p.OfficeName || ''} &middot; Office ${p.ListOfficeKey || ''}</div>
        <button class="btn btn-primary">Request a showing</button>
        <button class="btn btn-outline">Call agent</button>
        ${props.showMortgageCalc !== false && !forLease ? `
        <div class="mortgage-est">
          <div class="label">Est. monthly payment</div>
          <div class="value">${money(Math.round((p.ListPrice || 0) * 0.8 * 0.045 / 12))}</div>
        </div>` : ''}
      </aside>` : ''}
    </div>
  </section>`;
}

export const registry = {
  hero_search, service_tiles, cta_band, process_steps, stat_band, testimonial,
  lead_form, featured_listings, listing_grid, map_split_search, listing_detail,
};
