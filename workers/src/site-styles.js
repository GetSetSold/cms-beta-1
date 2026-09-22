// workers/src/site-styles.js //

const _baseSiteStyles = `
:root{
  --ink:#0B0B0D; --ink-70:#4B4B52; --ink-45:#84848C;
  --paper:#FFFFFF; --surface:#F5F5F7; --line:#E4E4E8;
  --blue:#2451E0; --blue-dim:#EDF1FD;
}
*, *::before, *::after{box-sizing:border-box;}
html{ height:100%; }
body{ margin:0; min-height:100vh; display:flex; flex-direction:column; font-family:'Manrope',sans-serif; color:var(--ink); background:var(--paper); }
h1,h2,h3{ font-family:'Fraunces',serif; margin:0; font-weight:500; letter-spacing:-0.01em; }
a{ color:inherit; text-decoration:none; }
button, input{ font-family:inherit; }
img{ max-width:100%; display:block; }

/* Header / footer */
.site-header{ height:76px; display:flex; align-items:center; justify-content:space-between; padding:0 56px; border-bottom:1px solid var(--line); gap:20px; position:relative; z-index:40; background:#fff; }
.logo{ font-family:'Fraunces',serif; font-size:22px; font-weight:600; flex-shrink:0; }
.main-nav{ display:flex; align-items:center; gap:26px; font-size:14px; color:var(--ink-70); flex:1; justify-content:center; }
.nav-link{ color:var(--ink-70); text-decoration:none; font-weight:600; background:none; border:none; font-size:14px; font-family:inherit; cursor:pointer; padding:0; display:flex; align-items:center; gap:4px; }
.nav-link:hover{ color:var(--ink); }
.header-actions{ display:flex; align-items:center; gap:14px; flex-shrink:0; }
.btn{ border:none; border-radius:999px; padding:11px 22px; font-size:13px; font-weight:600; cursor:pointer; display:inline-block; }
.btn-dark, .btn-primary{ background:var(--ink); color:#fff; }
.btn-primary{ background:var(--blue); width:100%; margin-bottom:10px; text-align:center; }
.btn-outline{ background:transparent; border:1px solid var(--line); color:var(--ink); width:100%; text-align:center; }
.btn-accent{ background:var(--blue); color:#fff; padding:10px 20px; }
.btn-accent:hover{ background:var(--ink); }

/* Mobile hamburger */
.nav-toggle{ display:none; flex-direction:column; justify-content:center; gap:5px; width:36px; height:36px; background:none; border:none; cursor:pointer; padding:0; }
.nav-toggle span{ display:block; height:2px; width:22px; background:var(--ink); border-radius:2px; transition:transform .2s ease, opacity .2s ease; }
.nav-toggle.open span:nth-child(1){ transform:translateY(7px) rotate(45deg); }
.nav-toggle.open span:nth-child(2){ opacity:0; }
.nav-toggle.open span:nth-child(3){ transform:translateY(-7px) rotate(-45deg); }

/* Accordion-style submenu */
.nav-item-toggle{ justify-content:space-between; width:100%; }
.nav-toggle-sign{ font-size:16px; font-weight:400; color:var(--ink-45); }
.nav-submenu{ display:none; flex-direction:column; gap:2px; padding-left:14px; }
.nav-item-group.open .nav-submenu{ display:flex; }
.nav-sublink{ color:var(--ink-45); font-size:13.5px; font-weight:600; padding:8px 0; text-decoration:none; }
.nav-sublink:hover{ color:var(--blue); }

.site-footer{ padding:40px 56px; border-top:1px solid var(--line); font-size:12.5px; color:var(--ink-45); margin-top:auto; }
.logo-img{ height:32px; width:auto; display:block; }
.footer-links{ margin-top:8px; display:flex; flex-wrap:wrap; gap:14px; }
.footer-link{ color:var(--ink-70); text-decoration:none; font-weight:600; font-size:13px; }
.footer-link:hover{ color:var(--blue); }
.footer-social{ margin-top:8px; display:flex; gap:14px; }
.footer-social-link{ color:var(--ink-45); text-decoration:none; font-weight:600; }
.footer-social-link:hover{ color:var(--blue); }
.footer-license{ margin-top:8px; font-size:11px; color:var(--ink-45); }

/* Fixed/sticky header */
@media (min-width:901px){ .header-fixed-desktop{ position:sticky; top:0; z-index:60; } }
@media (max-width:900px){ .header-fixed-mobile{ position:sticky; top:0; z-index:60; } }

/* Desktop header layouts */
@media (min-width:901px){
  .site-header-centered{ flex-wrap:wrap; justify-content:center; height:auto; padding-top:16px; padding-bottom:12px; row-gap:10px; }
  .site-header-centered .logo{ order:1; width:100%; text-align:center; }
  .site-header-centered .main-nav{ order:2; width:100%; justify-content:center; flex:none; }
  .site-header-centered .header-actions{ order:3; width:100%; justify-content:center; }
  .site-header-minimal{ height:64px; }
  .site-header-minimal .main-nav{ justify-content:flex-start; gap:18px; margin-left:28px; }
  .site-header-minimal .btn-accent{ padding:8px 16px; font-size:12px; }
}

/* Footer layouts */
.footer-col + .footer-col{ margin-top:14px; }
.site-footer-columns{ display:flex; flex-wrap:wrap; justify-content:space-between; align-items:flex-start; gap:28px; }
.site-footer-columns .footer-col + .footer-col{ margin-top:0; }
.site-footer-columns .footer-license{ flex-basis:100%; }
.site-footer-centered{ text-align:center; }
.site-footer-centered .footer-links, .site-footer-centered .footer-social{ justify-content:center; }

/* Shared block scaffolding */
.block{ padding:56px; max-width:1440px; width:100%; margin:0 auto; }
.block-full{ padding:56px; max-width:none; margin:0; width:100%; }
.badge{ font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.03em; padding:5px 10px; border-radius:999px; }
.section-head{ display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:24px; }
.see-all{ font-size:13px; font-weight:700; color:var(--blue); }

/* hero_search */
.hero-search{ text-align:center; display:flex; flex-direction:column; align-items:center; gap:22px; background:var(--surface); padding:88px 56px 64px; }
.hero-search .eyebrow{ font-size:12px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--blue); }
.hero-search h1{ font-size:52px; max-width:760px; line-height:1.1; }
.hero-search .subcopy{ font-size:15.5px; color:var(--ink-70); max-width:520px; }
.search-bar{ display:flex; width:720px; max-width:100%; background:#fff; border-radius:16px; padding:8px; gap:8px; box-shadow:0 12px 30px rgba(11,11,13,.08); }
.search-bar input{ flex:1; border:none; outline:none; font-size:14px; padding:12px 16px; }
.search-bar button{ background:var(--blue); color:#fff; border:none; border-radius:10px; padding:0 26px; font-size:13.5px; font-weight:700; }
.stat-row{ display:flex; gap:32px; }
.stat{ display:flex; flex-direction:column; align-items:center; gap:2px; }
.stat-value{ font-family:'Fraunces',serif; font-size:24px; font-weight:600; }
.stat-label{ font-size:11.5px; color:var(--ink-45); text-transform:uppercase; letter-spacing:.04em; }

/* service_tiles */
.service-tiles{ display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:24px; }
.service-tile{ border-radius:18px; padding:32px; display:flex; flex-direction:column; gap:14px; min-height:200px; }
.tile-light{ background:var(--surface); color:var(--ink); }
.tile-dark{ background:var(--ink); color:#fff; }
.tile-tint{ background:var(--blue-dim); color:var(--ink); }
.tile-cta{ font-size:13px; font-weight:700; margin-top:auto; }

/* cta_band */
.cta-band{ display:flex; justify-content:space-between; align-items:center; border-radius:22px; margin:56px; padding:48px 56px; }
.cta-dark{ background:var(--ink); color:#fff; }
.cta-tint{ background:var(--blue-dim); color:var(--ink); }
.cta-band h2{ margin-bottom:8px; color:inherit; }
.cta-band p{ color:inherit; opacity:.8; max-width:420px; margin:0; }
.cta-band .btn-primary{ width:auto; margin:0; white-space:nowrap; }

/* process_steps */
.process-steps h2{ font-size:26px; text-align:center; margin-bottom:32px; }
.step-grid{ display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:20px; }
.step{ padding:26px; border-radius:16px; background:var(--surface); display:flex; flex-direction:column; gap:12px; }
.step-num{ width:34px; height:34px; border-radius:50%; background:var(--blue); color:#fff; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:700; }
.step-title{ font-size:15px; font-weight:700; }
.step p{ font-size:12.5px; color:var(--ink-70); line-height:1.6; margin:0; }

/* stat_band */
.stat-band{ display:flex; justify-content:space-between; border-radius:20px; padding:36px 48px; }
.stat-bordered{ border:1px solid var(--line); }
.stat-filled{ background:var(--surface); }

/* testimonial */
.testimonial{ display:flex; gap:32px; align-items:center; border-radius:20px; padding:48px; background:var(--ink); color:#fff; }
.testimonial .avatar{ width:64px; height:64px; border-radius:50%; background:var(--blue); flex:0 0 auto; }
.testimonial .quote{ font-family:'Fraunces',serif; font-size:20px; line-height:1.5; margin:0 0 12px; }
.testimonial .attribution{ font-size:12.5px; color:rgba(255,255,255,.6); }

/* lead_form */
.lead-form{ display:flex; justify-content:space-between; align-items:center; gap:24px; border-radius:20px; padding:48px; background:var(--surface); flex-wrap:wrap; }
.lead-copy{ max-width:380px; }
.lead-copy p{ font-size:13.5px; color:var(--ink-70); margin:8px 0 0; }
.lead-fields{ display:flex; gap:10px; flex-wrap:wrap; }
.lead-fields input{ border:1px solid var(--line); border-radius:10px; padding:13px 16px; font-size:13.5px; }
.lead-fields button{ background:var(--blue); color:#fff; border:none; border-radius:10px; padding:0 24px; font-size:13.5px; font-weight:700; }

/* Listing cards */
.listing-grid{ display:grid; gap:24px; }
.grid-3{ grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); }
.listing-card{ border:1px solid var(--line); border-radius:14px; overflow:hidden; display:block; }
.listing-photo{ height:190px; background-size:cover; background-position:center; position:relative; }
.listing-photo .badge{ position:absolute; top:12px; left:12px; }
.listing-photo .photo-count{ position:absolute; bottom:10px; right:12px; }
.listing-body{ padding:16px; }
.listing-price{ font-family:'Fraunces',serif; font-size:19px; font-weight:600; margin-bottom:4px; }
.listing-address{ font-size:12.5px; color:var(--ink-70); margin-bottom:10px; }
.listing-specs{ display:flex; gap:14px; font-size:12px; color:var(--ink-45); padding-top:10px; border-top:1px solid var(--line); }

/* listing_grid page chrome */
.listing-grid-page .result-count{ font-size:13.5px; color:var(--ink-45); margin-top:6px; }
.view-toggle{ display:flex; gap:8px; }
.view-toggle a{ padding:9px 16px; border-radius:999px; border:1px solid var(--line); font-size:12.5px; font-weight:600; color:var(--ink-70); }
.view-toggle a.active{ background:var(--ink); color:#fff; border-color:var(--ink); }
.filter-bar{ display:flex; gap:10px; padding:14px 18px; background:var(--surface); border-radius:14px; margin-bottom:24px; }
.filter-pill{ padding:8px 16px; border-radius:999px; font-size:12.5px; font-weight:600; border:none; background:transparent; color:var(--ink-70); cursor:pointer; }
.filter-pill.active{ background:var(--ink); color:#fff; }
.filter-select, .filter-input{ padding:9px 14px; border-radius:10px; border:1px solid var(--line); background:#fff; font-size:13px; color:var(--ink); font-family:inherit; }
.filter-select:focus, .filter-input:focus{ outline:none; border-color:var(--ink-45); }
.filter-input{ width:110px; }
.btn-outline-sm{ padding:8px 16px; border-radius:999px; border:1px solid var(--line); background:#fff; color:var(--ink-70); font-size:12.5px; font-weight:600; cursor:pointer; }
.btn-outline-sm:hover{ border-color:var(--ink-45); color:var(--ink); }
.pagination-row{ display:flex; justify-content:center; align-items:center; gap:6px; margin:32px 0; flex-wrap:wrap; }
.page-btn{ min-width:38px; height:38px; padding:0 10px; border-radius:10px; border:1px solid var(--line); background:#fff; color:var(--ink-70); font-size:13px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; }
.page-btn:hover{ border-color:var(--ink-45); color:var(--ink); }
.page-btn.active{ background:var(--ink); color:#fff; border-color:var(--ink); }
.page-btn:disabled{ opacity:.4; cursor:not-allowed; }
.page-ellipsis{ padding:0 6px; color:var(--ink-45); font-size:13px; }
.empty-state{ text-align:center; padding:60px 20px; color:var(--ink-45); font-size:14px; }

/* map_split_search */
.map-split{ display:flex; height:820px; padding:0; max-width:none; width:100%; }
.map-list-panel{ width:460px; flex:0 0 auto; border-right:1px solid var(--line); display:flex; flex-direction:column; }
.panel-head{ padding:18px 20px; border-bottom:1px solid var(--line); font-size:13px; }
.map-list-scroll{ flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:12px; }
.map-list-row{ display:flex; gap:12px; padding:10px; border-radius:12px; cursor:pointer; }
.map-list-row .thumb{ width:88px; height:72px; border-radius:10px; flex:0 0 auto; background-size:cover; background-position:center; }
.row-top{ display:flex; justify-content:space-between; align-items:flex-start; }
.row-price{ font-family:'Fraunces',serif; font-size:16px; font-weight:600; }
.row-address{ font-size:12.5px; color:var(--ink-70); margin-top:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.row-specs{ font-size:11.5px; color:var(--ink-45); margin-top:6px; }
.map-panel{ flex:1; position:relative; background:var(--surface); }
.map-list-row.active{ background:var(--blue-dim); }
.map-empty{ padding:24px 4px; font-size:13px; color:var(--ink-45); }
.map-pin{ cursor:pointer; font-size:11px; font-weight:700; color:#fff; padding:5px 10px; border-radius:20px; white-space:nowrap; border:2px solid rgba(255,255,255,.85); box-shadow:0 2px 8px rgba(0,0,0,.22); transition:transform .15s; }
.map-pin:hover{ transform:scale(1.08); }
.map-pin.active{ transform:scale(1.15); }
.map-pin.sale{ background:var(--ink); }
.map-pin.lease{ background:var(--blue); }
.maplibregl-popup-content{ padding:0 !important; border-radius:12px !important; overflow:hidden !important; box-shadow:0 12px 30px rgba(11,11,13,.18) !important; border:1px solid var(--line) !important; }
.maplibregl-popup-tip{ display:none !important; }
.map-popup-img{ width:100%; height:120px; object-fit:cover; display:block; background:var(--surface); }
.map-popup-body{ padding:12px 14px 14px; }
.map-popup-price{ font-family:'Fraunces',serif; font-size:16px; font-weight:600; }
.map-popup-addr{ font-size:12px; color:var(--ink-70); margin:3px 0 6px; }
.map-popup-specs{ font-size:11.5px; color:var(--ink-45); margin-bottom:10px; }
.map-popup-link{ display:inline-block; font-size:12px; font-weight:700; color:var(--blue); }

/* listing_detail */
.listing-detail .hero-photo{ height:460px; border-radius:16px; background-size:cover; background-position:center; background-color:var(--surface); }
.listing-detail .title-row{ display:flex; justify-content:space-between; align-items:flex-start; margin-top:32px; }
.listing-detail .title-row h1{ font-size:34px; margin-top:10px; }
.listing-detail .sub{ font-size:15px; color:var(--ink-70); margin-top:6px; }
.listing-detail .price{ font-family:'Fraunces',serif; font-size:38px; font-weight:600; color:var(--blue); }
.specs-row{ margin:28px 0; padding:22px 28px; background:var(--surface); border-radius:16px; display:flex; justify-content:space-between; }
.spec{ display:flex; flex-direction:column; gap:4px; align-items:center; }
.spec-value{ font-family:'Fraunces',serif; font-size:22px; font-weight:600; }
.spec-label{ font-size:12px; color:var(--ink-45); text-transform:uppercase; letter-spacing:.04em; }
.body-split{ display:flex; gap:48px; align-items:flex-start; }
.description{ flex:1; }
.description p{ font-size:14.5px; line-height:1.7; color:var(--ink-70); }
.agent-card{ width:340px; flex:0 0 auto; border:1px solid var(--line); border-radius:16px; padding:22px; }
.agent-name{ font-size:14px; font-weight:700; }
.agent-office{ font-size:12px; color:var(--ink-45); margin-bottom:16px; }
.mortgage-est{ margin-top:12px; padding-top:12px; border-top:1px solid var(--line); display:flex; justify-content:space-between; font-size:13px; }

/* RESPONSIVE — iPad (≤900px) and iPhone (≤600px) */
@media (max-width: 900px) {
  .block{ padding:40px 28px; }
  .cta-band{ margin:32px 28px; padding:36px; }
  .site-header{ padding:0 20px; flex-wrap:wrap; height:auto; min-height:76px; }
  .nav-toggle{ display:flex; }
  .main-nav-overlay, .main-nav-accordion{
    position:absolute; top:76px; left:0; right:0; background:#fff; border-bottom:1px solid var(--line);
    flex-direction:column; align-items:stretch; gap:0; max-height:0; overflow:hidden; transition:max-height .25s ease;
  }
  .main-nav-overlay.open, .main-nav-accordion.open{ max-height:80vh; overflow-y:auto; }
  .main-nav-overlay .nav-link, .main-nav-accordion .nav-link{ padding:14px 20px; border-bottom:1px solid var(--line); }
  .main-nav-accordion .nav-item-group{ border-bottom:1px solid var(--line); }
  .main-nav-accordion .nav-item-toggle{ padding:14px 20px; border-bottom:none; }
  .main-nav-accordion .nav-submenu{ padding:0 20px 10px 32px; }
  .main-nav-simple{
    order:3; width:100%; flex-basis:100%;
    display:flex; flex-wrap:nowrap; justify-content:flex-start; gap:8px; padding:12px 0 4px; margin:0 -20px; padding-left:20px; overflow-x:auto;
  }
  .main-nav-simple .nav-link{ flex-shrink:0; background:var(--surface); padding:8px 14px; border-radius:999px; white-space:nowrap; }
  .hero-search{ padding:64px 28px 48px; }
  .hero-search h1{ font-size:38px; }
  .search-bar{ width:100%; }
  .service-tiles{ grid-template-columns:repeat(2,minmax(0,1fr)); }
  .step-grid{ grid-template-columns:repeat(2,minmax(0,1fr)); }
  .grid-3{ grid-template-columns:repeat(2,minmax(0,1fr)); }
  .map-split{ height:auto; flex-direction:column; }
  .map-list-panel{ width:100%; border-right:none; border-bottom:1px solid var(--line); }
  .map-list-scroll{ max-height:420px; }
  .map-panel{ height:420px; }
  .body-split{ flex-direction:column; }
  .agent-card{ width:100%; }
  .specs-row{ flex-wrap:wrap; gap:16px; justify-content:flex-start; }
  .listing-detail .hero-photo{ height:320px; }
  .listing-detail .title-row{ flex-direction:column; gap:10px; }
  .listing-detail .title-row h1{ font-size:28px; }
  .listing-detail .price{ font-size:30px; }
  .testimonial{ padding:32px; }
  .lead-form{ padding:32px; }
}

@media (max-width: 600px) {
  .block{ padding:28px 18px; }
  .cta-band{ margin:20px 18px; padding:26px 22px; flex-direction:column; align-items:flex-start; gap:18px; }
  .cta-band .btn-primary{ width:100%; text-align:center; }
  .section-head{ flex-direction:column; align-items:flex-start; gap:8px; }
  .hero-search{ padding:48px 18px 36px; gap:16px; }
  .hero-search h1{ font-size:28px; }
  .hero-search .subcopy{ font-size:14px; }
  .search-bar{ flex-direction:column; border-radius:14px; }
  .search-bar button{ padding:12px; border-radius:8px; }
  .stat-row{ gap:18px; flex-wrap:wrap; justify-content:center; }
  .stat-value{ font-size:19px; }
  .service-tiles{ grid-template-columns:1fr; }
  .service-tile{ min-height:auto; padding:24px; }
  .step-grid{ grid-template-columns:1fr; }
  .stat-band{ flex-direction:column; gap:20px; padding:28px 24px; text-align:center; }
  .testimonial{ flex-direction:column; text-align:center; padding:28px 22px; gap:18px; }
  .testimonial .quote{ font-size:17px; }
  .lead-form{ flex-direction:column; align-items:stretch; padding:28px 22px; }
  .lead-copy{ max-width:none; }
  .lead-fields{ flex-direction:column; }
  .lead-fields input, .lead-fields button{ width:100%; box-sizing:border-box; }
  .grid-3{ grid-template-columns:1fr; }
  .listing-photo{ height:200px; }
  .filter-bar{ flex-wrap:wrap; padding:12px; }
  .view-toggle{ flex-wrap:wrap; }
  .map-list-row{ flex-direction:row; }
  .map-list-row .thumb{ width:72px; height:60px; }
  .map-panel, .map-list-scroll{ max-height:320px; height:320px; }
  .listing-detail .hero-photo{ height:220px; border-radius:12px; }
  .listing-detail .title-row h1{ font-size:22px; }
  .listing-detail .price{ font-size:24px; }
  .specs-row{ padding:16px; gap:14px; }
  .spec-value{ font-size:18px; }
  .agent-card{ padding:18px; }
  .site-footer{ padding:28px 18px; }
  .df-grid{ grid-template-columns:1fr !important; }
  .df-field{ grid-column:1 / -1 !important; }
  .df-wrap{ padding:22px 18px; border-radius:12px; }
}
`;

/* Dynamic lead-capture forms */
export const dynamicFormStyles = `.df-block{ background:var(--surface); } .df-wrap{ max-width:640px; margin:0 auto; background:#fff; border:1px solid var(--line); border-radius:16px; padding:32px 36px; } .df-heading{ margin-bottom:20px; font-size:22px; } .df-section{ margin-bottom:32px; padding-bottom:32px; border-bottom:1px solid var(--line); } .df-section:last-of-type{ margin-bottom:20px; padding-bottom:0; border-bottom:none; } .df-section-title{ font-family:'Fraunces',serif; font-size:18px; margin:0 0 8px; } .df-section-desc{ font-size:13.5px; color:var(--ink-70); margin:0 0 16px; } .df-grid{ display:grid; grid-template-columns:repeat(2,1fr); gap:16px; } .df-field{ display:flex; flex-direction:column; gap:6px; } .df-label{ font-size:12.5px; font-weight:700; color:var(--ink-70); } .df-header-field{ margin-top:6px; } .df-header-label{ font-family:'Fraunces',serif; font-size:16px; margin:0 0 6px; } .df-field input[type=text], .df-field input[type=email], .df-field input[type=tel], .df-field input[type=number], .df-field input[type=date], .df-field select, .df-field textarea{ padding:11px 13px; border:1px solid var(--line); border-radius:10px; font-family:inherit; font-size:13.5px; background:#fff; color:var(--ink); } .df-field textarea{ min-height:90px; resize:vertical; } .df-field input:focus, .df-field select:focus, .df-field textarea:focus{ outline:none; border-color:var(--blue); } .df-choice-group{ display:flex; flex-direction:column; gap:8px; } .df-radio, .df-checkbox{ display:flex; align-items:center; gap:8px; font-size:13.5px; font-weight:normal; color:var(--ink); cursor:pointer; } .df-help{ font-size:11.5px; color:var(--ink-45); } .df-submit{ margin-top:8px; background:var(--ink); color:#fff; border:none; border-radius:999px; padding:13px 26px; font-weight:700; font-size:13.5px; cursor:pointer; } .df-submit:hover{ background:var(--blue); } .df-submit:disabled{ opacity:.5; cursor:not-allowed; } .df-repeater{ border:1px solid #e2e2e6; border-radius:14px; padding:16px; background:#fafafa; } .df-repeater-items{ display:flex; flex-direction:column; gap:14px; margin-top:10px; } .df-repeater-row{ display:grid; grid-template-columns:1fr 1fr; gap:12px; padding:14px; background:#fff; border:1px solid #ececef; border-radius:10px; position:relative; } .df-repeater-row .df-field{ margin:0; } .df-repeater-remove{ grid-column:1/-1; justify-self:end; background:none; border:none; color:#b3261e; font-size:12.5px; font-weight:600; cursor:pointer; padding:2px 4px; } .df-repeater-add{ margin-top:10px; background:#fff; border:1.5px solid var(--ink); color:var(--ink); border-radius:999px; padding:9px 18px; font-weight:700; font-size:13px; cursor:pointer; } .df-repeater-add:hover{ background:var(--ink); color:#fff; } @media (max-width:600px){ .df-repeater-row{ grid-template-columns:1fr; } } .df-error{ color:#C0362C; font-size:12.5px; margin-top:8px; } .df-success{ font-size:15px; font-weight:600; padding:20px 0; } .df-missing{ padding:24px; background:var(--surface); border-radius:12px; color:var(--ink-45); font-size:13.5px; }`;

// MERGED EXPORT: Ensures form styles are ALWAYS loaded alongside site styles
export const siteStyles = _baseSiteStyles + "\n" + dynamicFormStyles;
