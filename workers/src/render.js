// workers/src/render.js
//
// The actual "turn database rows into HTML" step. Two Supabase clients — one
// per project, since they're separate databases (see the earlier discussion
// on why MLS sync and CRM/pages live in different Supabase projects). This
// file only assembles and renders; it doesn't touch DDF or write anything.

import { createClient } from '@supabase/supabase-js';
import { registry } from './blocks-realestate.js';
import { siteStyles } from './site-styles.js';

function getClients(env) {
  return {
    crm: createClient(env.CRM_SUPABASE_URL, env.CRM_SUPABASE_ANON_KEY),
    mls: createClient(env.MLS_SUPABASE_URL, env.MLS_SUPABASE_ANON_KEY),
  };
}

// ---------------------------------------------------------
// Per-block data fetchers — only called for blocks whose
// blocks_library.data_source says they need one.
// ---------------------------------------------------------
async function fetchBlockData(blockName, props, clients) {
  if (blockName === 'featured_listings') {
    if (props.filter === 'office_only') {
      const officeKey = props.officeKey || '291890';
      const { data, error } = await clients.mls
        .from('property')
        .select('*')
        .eq('ListOfficeKey', officeKey)
        .limit(props.count || 3);
      if (error) { console.error('featured_listings (property) fetch failed:', error.message); return []; }
      return data;
    }

    let query = clients.mls.from('grid').select('*').limit(props.count || 3);
    if (props.filter === 'for_lease') query = query.not('TotalActualRent', 'is', null);
    if (props.filter === 'for_sale') query = query.is('TotalActualRent', null);
    const { data, error } = await query;
    if (error) { console.error('featured_listings fetch error:', error.message); return []; }
    return data;
  }

  if (blockName === 'listing_grid') {
    const pageSize = props.pageSize || 12;
    let query = clients.mls.from('grid').select('*', { count: 'exact' }).limit(pageSize);
    if (props.defaultArea) query = query.eq('City', props.defaultArea);
    const { data, count, error } = await query;
    if (error) { console.error('listing_grid fetch error:', error.message); return { listings: [], total: 0 }; }
    return { listings: data, total: count };
  }

  if (blockName === 'map_split_search') {
    let query = clients.mls.from('grid').select('*').not('Latitude', 'is', null).limit(50);
    if (props.defaultArea) query = query.eq('City', props.defaultArea);
    const { data, error } = await query;
    if (error) { console.error('map_split_search fetch error:', error.message); return { listings: [] }; }
    return { listings: data };
  }

  return null;
}

// listing_detail is special: it doesn't come from a `pages` row block, it's a
// direct route (/listings/:listingKey) — see the note in 0003_blocks_and_pages.sql
// on why single listings aren't one `pages` row each.
async function fetchListingDetail(listingKey, clients) {
  const { data: property, error } = await clients.mls
    .from('property')
    .select('*')
    .eq('ListingKey', listingKey)
    .single();

  if (error || !property) return null;
  return { listing: property, officeName: property.OfficeName };
}

// ---------------------------------------------------------
// Page shell — nav/footer wrap every rendered page.
// ---------------------------------------------------------
function pageShell({ title, description, bodyHtml }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title || 'GetSetSold'}</title>
  <meta name="description" content="${description || ''}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>${siteStyles}</style>
</head>
<body>
  <header class="site-header">
    <a href="/" class="logo">GetSetSold</a>
    <!-- .main-nav matches the CSS's real class (site-styles.js only styles
         .main-nav / .main-nav-overlay / .main-nav-accordion / .main-nav-simple).
         This used to be "site-nav", which matched nothing in the stylesheet,
         so the nav fell back to unstyled default <a> stacking on every
         screen size — that's what looked like a "stuck on mobile" layout
         even on desktop. -->
    <nav class="main-nav" id="main-nav">
      <a href="/listings" class="nav-link">Buy</a>
      <a href="/sell" class="nav-link">Sell</a>
      <a href="/pre-construction" class="nav-link">Pre-Construction</a>
      <a href="/neighbourhoods" class="nav-link">Neighbourhoods</a>
    </nav>
    <div class="header-actions">
      <a href="/contact" class="btn btn-dark">Book a Consultation</a>
      <!-- Hamburger for ≤900px. The CSS already fully styles .nav-toggle
           (3-bar → X animation) and the ≤900px collapse of .main-nav, but
           no markup ever emitted this button, so mobile had no way to open
           the menu either. -->
      <button class="nav-toggle" id="nav-toggle" aria-label="Toggle menu" aria-expanded="false" aria-controls="main-nav">
        <span></span><span></span><span></span>
      </button>
    </div>
  </header>
  <main>${bodyHtml}</main>
  <footer class="site-footer">
    <div>© ${new Date().getFullYear()} GetSetSold — Rohit Sharma, Lombard Group Real Estate Inc.</div>
  </footer>
  <script>
  (function() {
    var toggle = document.getElementById('nav-toggle');
    var nav = document.getElementById('main-nav');
    if (!toggle || !nav) return;
    toggle.addEventListener('click', function() {
      var open = nav.classList.toggle('open');
      toggle.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  })();
  </script>
</body>
</html>`;
}

// ---------------------------------------------------------
// Main entry: render a `pages` row by slug
// ---------------------------------------------------------
export async function renderPage(slug, env, { preview = false } = {}) {
  const clients = getClients(env);

  const { data: page, error } = await clients.crm
    .from('pages')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error) throw new Error(`pages fetch failed: ${error.message}`);
  if (!page) return null;

  // Public visitors only ever see published pages. RLS already enforces this
  // at the database layer (see the confirmed policies), but the Worker uses
  // the anon key here too, so RLS is the real gate — this check is just a
  // clear, fast-failing signal in application code as well.
  if (page.status !== 'published' && !preview) return null;

  const blocks = Array.isArray(page.blocks) ? page.blocks : [];

  const rendered = await Promise.all(blocks.map(async (b) => {
    const fn = registry[b.block];
    if (!fn) {
      console.error(`Unknown block type in pages.blocks: "${b.block}" (slug: ${slug})`);
      return `<!-- unknown block: ${b.block} -->`;
    }
    const data = await fetchBlockData(b.block, b.props || {}, clients);
    return fn(b.props || {}, data);
  }));

  return pageShell({
    title: page.title,
    description: page.seo?.description,
    bodyHtml: rendered.join('\n'),
  });
}

// Single-listing route: /listings/:listingKey
export async function renderListingDetail(listingKey, env) {
  const clients = getClients(env);
  const data = await fetchListingDetail(listingKey, clients);
  if (!data) return null;

  const html = registry.listing_detail({ showMortgageCalc: true, showAgentCard: true }, data);
  return pageShell({
    title: `${data.listing.UnparsedAddress || listingKey} — GetSetSold`,
    description: (data.listing.PublicRemarks || '').slice(0, 155),
    bodyHtml: html,
  });
}
