/**
 * GetSetSold.ca public site — Cloudflare Worker.
 *
 * Serves the marketing/lead-gen website:
 *  - renders CMS pages (Supabase `pages` table, blocks JSONB) to HTML
 *  - serves MLS listing detail + pre-con project detail routes
 *  - accepts lead-capture form POSTs at /api/leads
 *  - serves sitemap.xml / robots.txt / health
 *
 * No npm dependencies. Supabase is called via plain fetch() to PostgREST.
 * Reads use the anon key; server-side writes use the service key and never
 * leave the Worker (only sent as an Authorization header to Supabase).
 */

import { cssVariables } from './tokens.js';
import { renderBlocks, esc, safeUrl } from './blocks.js';

// ---------------------------------------------------------------------------
// Supabase REST helper
// ---------------------------------------------------------------------------

/**
 * sb(env, 'cms'|'mls', table, query, opts)
 * opts: { method, body, service } — service:true uses SUPABASE_SERVICE_KEY
 * (CMS only). MLS is always read-only via MLS_SUPABASE_KEY.
 */
async function sb(env, which, table, query, opts = {}) {
  const isMls = which === 'mls';
  const base = isMls ? env.MLS_SUPABASE_URL : env.SUPABASE_URL;
  const key = opts.service
    ? env.SUPABASE_SERVICE_KEY
    : isMls ? env.MLS_SUPABASE_KEY : env.SUPABASE_ANON_KEY;
  if (!base || !key) throw new Error(`missing ${which} supabase credentials`);
  const url = `${String(base).replace(/\/$/, '')}/rest/v1/${table}?${query}`;
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  let body;
  const method = opts.method || (opts.body !== undefined ? 'POST' : 'GET');
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    headers['Prefer'] = 'return=representation';
    body = JSON.stringify(opts.body);
  }
  const res = await fetch(url, { method, headers, body });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`${which}/${table} ${res.status}: ${t.slice(0, 200)}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// blocks_library id cache (per-isolate, 60s) to avoid a lookup per request
let libCache = { at: 0, ids: new Set() };
async function getBlockLib(env) {
  if (Date.now() - libCache.at < 60000 && libCache.ids.size) return libCache.ids;
  try {
    const rows = await sb(env, 'cms', 'blocks_library', 'select=id');
    libCache = { at: Date.now(), ids: new Set((rows || []).map((r) => r.id)) };
  } catch { /* render without validation */ }
  return libCache.ids;
}

// ---------------------------------------------------------------------------
// Global stylesheet (tokens -> :root vars + all block styles)
// ---------------------------------------------------------------------------

function globalCss() {
  return `${cssVariables()}
/* base */
*,*::before,*::after{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;font-family:var(--font-sans);color:var(--ink);background:var(--white);line-height:1.6;-webkit-font-smoothing:antialiased}
img{max-width:100%;height:auto;display:block}
a{color:var(--accent);text-decoration:none}
a:hover{text-decoration:underline}
h1,h2,h3{line-height:1.2;margin:0 0 .6em;color:var(--black);letter-spacing:-.01em}
h1{font-size:2.5rem}h2{font-size:1.75rem}h3{font-size:1.25rem}
p{margin:0 0 1em}
.gss-container{max-width:var(--container-max);margin:0 auto;padding-left:var(--gutter);padding-right:var(--gutter)}
.gss-container-wide{max-width:1400px}
.gss-center{text-align:center}
.gss-muted{color:var(--grey-500)}
.gss-empty{background:var(--grey-50);border:1px solid var(--grey-200);border-radius:var(--radius-md);padding:2rem;text-align:center}
/* header */
.gss-header{background:var(--white);border-bottom:1px solid var(--grey-200);z-index:50}
.gss-header-fixed{position:sticky;top:0}
.gss-header-inner{display:flex;align-items:center;gap:1.5rem;height:72px}
.gss-brand{display:flex;align-items:center;gap:.5rem;font-weight:800;font-size:1.35rem;color:var(--black)}
.gss-brand:hover{text-decoration:none}
.gss-brand-dot{color:var(--accent)}
.gss-logo-img{height:40px;width:auto}
.gss-nav{margin-left:auto}
.gss-nav ul{display:flex;gap:1.4rem;list-style:none;margin:0;padding:0}
.gss-nav a{color:var(--ink);font-weight:600;font-size:.95rem}
.gss-nav a:hover{color:var(--accent);text-decoration:none}
.gss-header-actions{margin-left:auto;display:flex;align-items:center;gap:1rem}
.gss-nav + .gss-header-actions{margin-left:0}
.gss-header-phone{font-weight:700;color:var(--black);white-space:nowrap}
.gss-nav-toggle{display:none;background:none;border:0;cursor:pointer;flex-direction:column;gap:5px;padding:.5rem}
.gss-nav-toggle span{display:block;width:24px;height:2px;background:var(--black)}
/* buttons */
.gss-btn{display:inline-block;padding:.8rem 1.6rem;border-radius:var(--radius-pill);font-weight:700;font-size:1rem;border:2px solid transparent;cursor:pointer;text-align:center;transition:transform .08s ease,box-shadow .15s ease,background .15s ease}
.gss-btn:hover{text-decoration:none;transform:translateY(-1px)}
.gss-btn-accent{background:var(--accent);color:var(--white)}
.gss-btn-accent:hover{background:var(--accent-dark);color:var(--white)}
.gss-btn-dark{background:var(--black);color:var(--white)}
.gss-btn-outline{border-color:var(--black);color:var(--black);background:transparent}
.gss-btn-outline:hover{background:var(--black);color:var(--white)}
.gss-btn-outline-light{border-color:var(--white);color:var(--white);background:transparent}
.gss-btn-outline-light:hover{background:var(--white);color:var(--black)}
.gss-btn-white{background:var(--white);color:var(--black)}
.gss-btn-sm{padding:.5rem 1.1rem;font-size:.875rem}
.gss-btn-block{width:100%}
.gss-btn-row{display:flex;gap:.8rem;flex-wrap:wrap;margin-top:1.2rem}
/* hero */
.gss-hero{position:relative;background:var(--black);color:var(--white);padding:6rem 0;overflow:hidden}
.gss-hero.large{padding:8rem 0}
.gss-hero h1{color:var(--white);font-size:var(--font-size-hero,3.25rem);font-size:3.25rem;margin-bottom:.5rem}
.gss-hero-bg{position:absolute;inset:0;background-size:cover;background-position:center}
.gss-hero-overlay{position:absolute;inset:0;background:linear-gradient(180deg,rgba(17,17,17,.72),rgba(17,17,17,.55))}
.gss-hero-inner{position:relative}
.gss-hero-sub{font-size:1.2rem;color:#e5e8ee;max-width:640px}
.gss-hero-trust{margin-top:1.4rem;color:#c9cfda;font-size:.9rem}
.gss-kicker{text-transform:uppercase;letter-spacing:.12em;font-size:.8rem;font-weight:800;color:var(--accent);margin-bottom:.6rem}
.gss-hero .gss-kicker{color:#9db4ff}
/* page hero / sections */
.gss-page-hero{padding:3.5rem 0 2.5rem;background:var(--grey-50);border-bottom:1px solid var(--grey-200)}
.gss-page-hero h1{font-size:2.5rem}
.gss-lead{font-size:1.15rem;color:var(--grey-700);max-width:720px}
.gss-section{padding:var(--section-y) 0}
.gss-section-tight{padding:2.5rem 0}
.gss-bg-light{background:var(--grey-50)}
.gss-bg-dark{background:var(--black);color:#eef0f4}
.gss-bg-dark h1,.gss-bg-dark h2,.gss-bg-dark h3{color:var(--white)}
.gss-bg-accent{background:var(--accent);color:var(--white)}
.gss-bg-accent h1,.gss-bg-accent h2,.gss-bg-accent h3{color:var(--white)}
.gss-bg-accent .gss-kicker{color:var(--white)}
.gss-bg-image{background-size:cover;background-position:center}
/* grid */
.gss-grid{display:grid;gap:1.5rem;margin:1.5rem 0}
.gss-grid-1{grid-template-columns:1fr}.gss-grid-2{grid-template-columns:repeat(2,1fr)}
.gss-grid-3{grid-template-columns:repeat(3,1fr)}.gss-grid-4{grid-template-columns:repeat(4,1fr)}
.gss-spacer{width:100%}
.gss-divider{border:0;border-top:1px solid var(--grey-200);margin:2.5rem auto;max-width:var(--container-max)}
/* rich text */
.gss-richtext{max-width:760px}
.gss-richtext.gss-text-center{margin:0 auto;text-align:center;max-width:860px}
.gss-richtext.gss-text-right{text-align:right;margin-left:auto}
/* cards */
.gss-card{background:var(--white);border:1px solid var(--grey-200);border-radius:var(--radius-lg);box-shadow:var(--shadow-sm);padding:1.75rem}
/* listings */
.gss-listing-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1.5rem;margin:1.5rem 0}
.gss-listing-card{padding:0;overflow:hidden;display:flex;flex-direction:column}
.gss-listing-media{position:relative;display:block;aspect-ratio:4/3;background:var(--grey-100);overflow:hidden}
.gss-listing-media img{width:100%;height:100%;object-fit:cover}
.gss-listing-placeholder{display:flex;align-items:center;justify-content:center;height:100%;color:var(--grey-500);font-weight:700}
.gss-listing-status{position:absolute;top:.75rem;left:.75rem;background:var(--accent);color:var(--white);font-size:.75rem;font-weight:700;padding:.25rem .7rem;border-radius:var(--radius-pill)}
.gss-listing-body{padding:1.25rem}
.gss-listing-price{font-size:1.35rem;font-weight:800;color:var(--black);margin:0 0 .25rem}
.gss-listing-addr{color:var(--grey-700);margin:0 0 .4rem}
.gss-listing-specs{color:var(--grey-500);font-size:.9rem;margin:0}
.gss-listing-builder{font-size:.8rem;text-transform:uppercase;letter-spacing:.08em;color:var(--accent);font-weight:700;margin:0 0 .25rem}
.gss-listing-name{margin:0 0 .25rem}
.gss-carousel{overflow:hidden;margin:1.5rem -1.25rem;padding:0 1.25rem}
.gss-carousel-track{display:flex;gap:1.25rem;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:.5rem}
.gss-carousel-track .gss-listing-card{min-width:300px;scroll-snap-align:start}
.gss-listing-detail{max-width:900px}
.gss-listing-price-lg{font-size:2rem;font-weight:800;color:var(--accent)}
.gss-sold-banner{display:inline-block;background:var(--black);color:var(--white);font-weight:800;padding:.4rem 1rem;border-radius:var(--radius-pill);letter-spacing:.1em}
.gss-spec-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:1rem;margin:1.5rem 0}
.gss-spec-grid>div{background:var(--grey-50);border-radius:var(--radius-md);padding:.9rem 1.1rem}
.gss-spec-grid dt{font-size:.8rem;color:var(--grey-500);text-transform:uppercase;letter-spacing:.06em}
.gss-spec-grid dd{margin:.2rem 0 0;font-weight:700;font-size:1.1rem}
.gss-listing-cta{display:flex;gap:.8rem;flex-wrap:wrap;margin:2rem 0}
/* gallery / image / video */
.gss-image{margin:1.5rem 0}
.gss-image-rounded img{border-radius:var(--radius-lg)}
.gss-image figcaption{color:var(--grey-500);font-size:.875rem;margin-top:.5rem;text-align:center}
.gss-gallery{display:grid;gap:1rem;margin:1.5rem 0}
.gss-gallery-2{grid-template-columns:repeat(2,1fr)}.gss-gallery-3{grid-template-columns:repeat(3,1fr)}.gss-gallery-4{grid-template-columns:repeat(4,1fr)}
.gss-gallery img{border-radius:var(--radius-md);aspect-ratio:4/3;object-fit:cover;width:100%}
.gss-gallery figcaption{font-size:.85rem;color:var(--grey-500)}
.gss-video{position:relative;aspect-ratio:16/9;margin:1.5rem 0;border-radius:var(--radius-lg);overflow:hidden;background:var(--black)}
.gss-video iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
/* stats / testimonials / faq */
.gss-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1.5rem;text-align:center;margin:1.5rem 0}
.gss-stat-value{display:block;font-size:2.5rem;font-weight:800;color:var(--accent)}
.gss-stat-label{color:var(--grey-700);font-weight:600}
.gss-testimonials{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.5rem;margin:1.5rem 0}
.gss-stars{color:#f59e0b;letter-spacing:.15em;margin-bottom:.5rem}
.gss-testimonial footer{color:var(--grey-500);font-size:.9rem;margin-top:.8rem}
.gss-faq{max-width:800px;margin:1.5rem 0}
.gss-faq-item{border:1px solid var(--grey-200);border-radius:var(--radius-md);margin-bottom:.75rem;background:var(--white)}
.gss-faq-item summary{cursor:pointer;padding:1.1rem 1.25rem;font-weight:700;list-style:none;display:flex;justify-content:space-between;align-items:center}
.gss-faq-item summary::-webkit-details-marker{display:none}
.gss-faq-item summary::after{content:'+';font-size:1.4rem;color:var(--accent)}
.gss-faq-item[open] summary::after{content:'–'}
.gss-faq-answer{padding:0 1.25rem 1.25rem;color:var(--grey-700)}
/* cta / agent / features / steps */
.gss-cta-banner{padding:3.5rem 0;margin:2rem 0}
.gss-cta-inner{display:flex;align-items:center;justify-content:space-between;gap:2rem;flex-wrap:wrap}
.gss-cta-inner h2{margin-bottom:.4rem}
.gss-cta-inner p{margin:0;opacity:.92}
.gss-agent-bio{display:grid;grid-template-columns:160px 1fr;gap:1.75rem;align-items:start;margin:1.5rem 0}
.gss-agent-photo{width:160px;height:160px;object-fit:cover;border-radius:50%}
.gss-agent-title{color:var(--accent);font-weight:700;margin:-.4em 0 .6em}
.gss-agent-creds{font-size:.9rem;color:var(--grey-500)}
.gss-features{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1.5rem;margin:1.5rem 0}
.gss-feature{display:flex;gap:1rem;align-items:flex-start}
.gss-feature-icon{display:inline-flex;align-items:center;justify-content:center;min-width:44px;height:44px;border-radius:50%;background:var(--accent-soft);color:var(--accent);font-weight:800;font-size:1.2rem}
.gss-steps ol{list-style:none;margin:1.5rem 0;padding:0;display:grid;gap:1.25rem}
.gss-steps li{display:flex;gap:1.25rem;align-items:flex-start}
.gss-step-num{display:inline-flex;align-items:center;justify-content:center;min-width:48px;height:48px;border-radius:50%;background:var(--black);color:var(--white);font-weight:800;font-size:1.25rem}
.gss-steps-heading{text-align:center}
/* breadcrumbs / hoods / models */
.gss-breadcrumbs{padding:1rem 1.25rem 0;font-size:.875rem}
.gss-breadcrumbs ol{display:flex;gap:.5rem;list-style:none;margin:0;padding:0;flex-wrap:wrap}
.gss-breadcrumbs li+li::before{content:'/';margin-right:.5rem;color:var(--grey-300)}
.gss-breadcrumbs [aria-current]{color:var(--grey-500)}
.gss-hood-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1.25rem;margin:1.5rem 0}
.gss-hood-card:hover{text-decoration:none;box-shadow:var(--shadow-md);transform:translateY(-2px)}
.gss-hood-card h3{margin-bottom:.2rem}
.gss-hood-card p{margin:0;color:var(--grey-500);font-size:.9rem}
.gss-model-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:1.25rem;margin:1.5rem 0}
.gss-plain-list{margin:1rem 0 1.5rem;padding-left:1.25rem}
.gss-precon-hero{width:100%;max-height:420px;object-fit:cover;border-radius:var(--radius-lg);margin-bottom:1.5rem}
/* forms */
.gss-form{max-width:560px;margin:1.5rem 0}
.gss-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.25rem}
.gss-field{display:flex;flex-direction:column;gap:.35rem;font-size:.95rem}
.gss-field:has(textarea){grid-column:1/-1}
.gss-label{font-weight:600;font-size:.875rem}
.gss-form input,.gss-form select,.gss-form textarea,.gss-newsletter input{padding:.75rem .9rem;border:1px solid var(--grey-300);border-radius:var(--radius-md);font:inherit;width:100%;background:var(--white)}
.gss-form input:focus,.gss-form select:focus,.gss-form textarea:focus,.gss-newsletter input:focus{outline:2px solid var(--accent);outline-offset:1px;border-color:var(--accent)}
.gss-honeypot{position:absolute!important;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden}
.gss-form-title{margin-bottom:.25rem}
.gss-form-sub{color:var(--grey-700);margin-bottom:1.25rem}
.gss-form-note{font-size:.8rem;color:var(--grey-500);margin-top:.8rem;text-align:center}
.gss-form-msg{margin:.9rem 0 0;font-weight:600;min-height:1.4em}
.gss-form-msg.ok{color:var(--success)}
.gss-form-msg.err{color:var(--error)}
.gss-newsletter{margin:1.5rem 0}
.gss-newsletter-label{display:block;font-weight:700;margin-bottom:.6rem}
.gss-newsletter-row{display:flex;gap:.6rem}
.gss-newsletter-row input{flex:1}
/* calculator */
.gss-calc{max-width:560px;margin:1.5rem 0}
.gss-calc-result{margin-top:1.25rem;padding:1.1rem 1.25rem;background:var(--accent-soft);border-radius:var(--radius-md);font-weight:700;display:none}
.gss-calc-result.show{display:block}
/* footer */
.gss-footer{background:var(--black);color:#c9cfda;margin-top:4rem;padding:3.5rem 0 1.5rem}
.gss-footer-grid{display:grid;grid-template-columns:1.4fr repeat(3,1fr);gap:2rem}
.gss-footer .gss-brand-text{color:var(--white);font-weight:800;font-size:1.3rem}
.gss-footer h4{color:var(--white);font-size:.95rem;margin-bottom:.8rem}
.gss-footer ul{list-style:none;margin:0;padding:0}
.gss-footer li{margin-bottom:.5rem}
.gss-footer a{color:#c9cfda}
.gss-footer a:hover{color:var(--white)}
.gss-footer-bottom{display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;border-top:1px solid #2a2a2a;margin-top:2.5rem;padding-top:1.5rem;font-size:.875rem}
/* responsive */
@media (max-width:900px){
  .gss-grid-3,.gss-grid-4,.gss-listing-grid{grid-template-columns:repeat(2,1fr)}
  .gss-footer-grid{grid-template-columns:1fr 1fr}
  .gss-nav{display:none;position:absolute;top:72px;left:0;right:0;background:var(--white);border-bottom:1px solid var(--grey-200);padding:1rem 1.25rem}
  .gss-nav ul{flex-direction:column;gap:.9rem}
  .gss-header{position:relative}
  .gss-header.gss-nav-open .gss-nav{display:block}
  .gss-nav-toggle{display:flex}
  .gss-header-phone{display:none}
  .gss-agent-bio{grid-template-columns:1fr;text-align:center;justify-items:center}
}
@media (max-width:640px){
  .gss-grid-2,.gss-grid-3,.gss-grid-4,.gss-listing-grid{grid-template-columns:1fr}
  .gss-hero h1{font-size:2.25rem}
  .gss-form-grid{grid-template-columns:1fr}
  .gss-newsletter-row{flex-direction:column}
  .gss-cta-inner{flex-direction:column;align-items:flex-start}
}`;
}

// ---------------------------------------------------------------------------
// Client-side script: lead forms, mobile nav, calculators
// ---------------------------------------------------------------------------

function clientScript() {
  return `document.addEventListener('DOMContentLoaded',function(){
  // mobile nav
  var t=document.querySelector('.gss-nav-toggle'),h=document.querySelector('.gss-header');
  if(t&&h){t.addEventListener('click',function(){var o=h.classList.toggle('gss-nav-open');t.setAttribute('aria-expanded',o?'true':'false');});}
  // lead forms -> POST /api/leads
  document.querySelectorAll('form[data-gss-form]').forEach(function(f){
    f.addEventListener('submit',function(e){
      e.preventDefault();
      var msg=f.querySelector('.gss-form-msg');
      var fd=new FormData(f),payload={};
      fd.forEach(function(v,k){if(k!=='company')payload[k]=String(v).trim();});
      if(fd.get('company')){return;} // honeypot
      var btn=f.querySelector('[type=submit]');
      var origLabel=btn?btn.textContent:'';
      if(btn){btn.disabled=true;btn.textContent='Sending…';}
      fetch('/api/leads',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({form_type:f.dataset.formType,payload:payload,page:location.pathname})})
      .then(function(r){return r.json().then(function(j){return {ok:r.ok,j:j};});})
      .then(function(r){
        if(msg){msg.className='gss-form-msg '+(r.ok?'ok':'err');
          msg.textContent=r.ok?'Thanks — we\\u2019ll be in touch shortly.':(r.j.error||'Something went wrong. Please try again.');}
        if(r.ok){f.reset();}
      }).catch(function(){
        if(msg){msg.className='gss-form-msg err';msg.textContent='Network error. Please try again.';}
      }).finally(function(){if(btn){btn.disabled=false;btn.textContent=origLabel;}});
    });
  });
  // calculators
  function num(v){var n=parseFloat(String(v).replace(/[^\\d.]/g,''));return isFinite(n)?n:0;}
  function fmt(n){return '$'+Math.round(n).toLocaleString('en-CA');}
  function ltt(price,toronto){var b=[[55000,.005],[250000,.01],[400000,.015],[2000000,.02],[Infinity,.025]],tax=0,prev=0;
    for(var i=0;i<b.length;i++){var cap=Math.min(price,b[i][0]);if(cap>prev){tax+=(cap-prev)*b[i][1];prev=cap;}else break;}
    return toronto?tax*2:tax;}
  document.querySelectorAll('[data-calc-run]').forEach(function(btn){
    btn.addEventListener('click',function(){
      var box=btn.closest('[data-calc-type]');if(!box)return;
      var type=box.dataset.calcType,g=function(n){var el=box.querySelector('[name="'+n+'"]');return el?num(el.value):0;};
      var out=box.querySelector('.gss-calc-result'),html='';
      if(type==='mortgage_payment'){var P=g('price')-g('down_payment'),r=g('rate')/100/12,n=g('years')*12;
        var m=r>0?P*r/(1-Math.pow(1+r,-n)):P/n;html='Estimated monthly payment: <strong>'+fmt(m)+'</strong>';}
      else if(type==='affordability'){var r2=g('rate')/100/12,n2=g('years')*12,allow=g('income')*0.32/12-g('debts');
        var loan=r2>0?allow*(1-Math.pow(1+r2,-n2))/r2:allow*n2;html='Estimated max home price: <strong>'+fmt(loan/0.8)+'</strong> (20% down assumed)';}
      else if(type==='land_transfer'){var p2=g('price'),t=ltt(p2,g('toronto')>0),reb=g('first_time')>0?Math.min(4000,t):0;
        html='Land transfer tax: <strong>'+fmt(t-reb)+'</strong>'+(reb?' (includes first-time buyer rebate)':'');}
      else if(type==='closing_costs'){var p3=g('price');html='Estimated closing costs: <strong>'+fmt(ltt(p3,false)+2000)+'</strong> (LTT + ~$2,000 legal/title)';}
      else{html='Thanks — based on your inputs, we\\u2019ll follow up with a detailed breakdown.';}
      if(out){out.innerHTML=html;out.classList.add('show');}
    });
  });
});`;
}

// ---------------------------------------------------------------------------
// Page rendering
// ---------------------------------------------------------------------------

function headHtml({ title, description, canonical, ogImage, ldJson, baseUrl, settings }) {
  const siteName = (settings && settings.business_name) || 'GetSetSold';
  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'RealEstateAgent',
      name: `${siteName} — Rohit Sharma, REALTOR®`,
      url: baseUrl,
      ...(settings && settings.phone ? { telephone: settings.phone } : {}),
      ...(settings && settings.email ? { email: settings.email } : {}),
      parentOrganization: { '@type': 'RealEstateAgent', name: 'Lombard Group Real Estate Inc., Brokerage' },
      areaServed: ['Caledonia', 'Haldimand County', 'Hamilton', 'Niagara', 'Halton', 'GTA'],
    },
    ...ldJson,
  ];
  return `<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
${description ? `<meta name="description" content="${esc(description)}">` : ''}
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(siteName)}">
<meta property="og:title" content="${esc(title)}">
${description ? `<meta property="og:description" content="${esc(description)}">` : ''}
<meta property="og:url" content="${esc(canonical)}">
${ogImage ? `<meta property="og:image" content="${esc(safeUrl(ogImage))}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%232456e6'/%3E%3Ctext x='16' y='22' font-family='Arial' font-size='18' font-weight='bold' fill='white' text-anchor='middle'%3EG%3C/text%3E%3C/svg%3E">
<style>${globalCss()}</style>
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
</head>`;
}

function docHtml({ head, body }) {
  return `<!DOCTYPE html><html lang="en">${head}<body>${body}<script>${clientScript()}</script></body></html>`;
}

async function buildCtx(env, baseUrl, settings, routeParams, pageSlug) {
  return {
    env,
    settings: settings || {},
    baseUrl,
    pageSlug,
    routeParams: routeParams || {},
    sb: (table, query, opts) => sb(env, 'cms', table, query, opts),
    mls: (table, query) => sb(env, 'mls', table, query),
    ld: [],
    lib: await getBlockLib(env),
  };
}

/** Render a CMS page by slug. Returns a Response (200 or 404). */
async function renderPage(env, url, slug) {
  const baseUrl = String(env.SITE_URL || url.origin).replace(/\/$/, '');
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) throw new Error('missing cms supabase credentials');
  const key = encodeURIComponent(slug);
  const [pageRows, settingsRows] = await Promise.all([
    sb(env, 'cms', 'pages', `select=slug,blocks,seo,status&slug=eq.${key}&status=eq.published&limit=1`).catch(() => []),
    sb(env, 'cms', 'site_settings', 'select=*&id=eq.1').catch(() => []),
  ]);
  const page = pageRows && pageRows[0];
  const settings = (settingsRows && settingsRows[0]) || {};
  if (!page) return notFoundResponse(env, url, settings, baseUrl);

  const ctx = await buildCtx(env, baseUrl, settings, {}, slug);
  if (slug === 'home') {
    ctx.ld.push({
      '@context': 'https://schema.org', '@type': 'WebSite', name: settings.business_name || 'GetSetSold',
      url: baseUrl, potentialAction: { '@type': 'SearchAction', target: `${baseUrl}/buy?q={query}`, 'query-input': 'required name=query' },
    });
  }
  let blocks = Array.isArray(page.blocks) ? [...page.blocks] : [];
  const types = new Set(blocks.map((b) => b && b.type));
  if (!types.has('site_header')) blocks.unshift({ type: 'site_header', props: {} });
  if (!types.has('site_footer')) blocks.push({ type: 'site_footer', props: {} });
  const body = await renderBlocks(blocks, ctx);

  const seo = page.seo || {};
  const title = seo.title || `${slug === 'home' ? (settings.business_name || 'GetSetSold') : slug} | ${settings.business_name || 'GetSetSold'}`;
  const canonical = `${baseUrl}${slug === 'home' ? '/' : `/${slug}`}`;
  const html = docHtml({
    head: headHtml({
      title, description: seo.description || '', canonical,
      ogImage: seo.og_image || seo.image || '', ldJson: ctx.ld, baseUrl, settings,
    }),
    body,
  });
  return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

/** Render a virtual (non-CMS) detail page from a block list. */
async function renderVirtualPage(env, url, { title, description, blocks, routeParams, canonicalPath }) {
  const baseUrl = String(env.SITE_URL || url.origin).replace(/\/$/, '');
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) throw new Error('missing cms supabase credentials');
  const settingsRows = await sb(env, 'cms', 'site_settings', 'select=*&id=eq.1').catch(() => []);
  const settings = (settingsRows && settingsRows[0]) || {};
  const ctx = await buildCtx(env, baseUrl, settings, routeParams, '');
  const all = [{ type: 'site_header', props: {} }, ...blocks, { type: 'site_footer', props: {} }];
  const body = await renderBlocks(all, ctx);
  const html = docHtml({
    head: headHtml({
      title: `${title} | ${settings.business_name || 'GetSetSold'}`,
      description: description || '', canonical: `${baseUrl}${canonicalPath}`,
      ogImage: '', ldJson: ctx.ld, baseUrl, settings,
    }),
    body,
  });
  return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

async function notFoundResponse(env, url, settings, baseUrl) {
  const ctx = await buildCtx(env, baseUrl, settings || {}, {}, '');
  const body = await renderBlocks([
    { type: 'site_header', props: {} },
    { type: 'section', props: { blocks: [
      { type: 'rich_text', props: { align: 'center', html: '<h1>Page not found</h1><p>The page you’re looking for doesn’t exist or has moved.</p><p><a class="gss-btn gss-btn-accent" href="/">Back to Home</a></p>' } },
    ] } },
    { type: 'site_footer', props: {} },
  ], ctx);
  const html = docHtml({
    head: headHtml({ title: `Not Found | ${(settings && settings.business_name) || 'GetSetSold'}`, description: '', canonical: `${baseUrl}/404`, ogImage: '', ldJson: [], baseUrl, settings: settings || {} }),
    body,
  });
  return new Response(html, { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

function errorResponse(env, url) {
  const baseUrl = String((env && env.SITE_URL) || (url && url.origin) || '').replace(/\/$/, '');
  return new Response(docHtml({
    head: `<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Something went wrong</title><style>${globalCss()}</style></head>`,
    body: `<div class="gss-container" style="padding:4rem 1.25rem;text-align:center"><h1>Something went wrong</h1><p>Please try again in a moment, or <a href="${esc(baseUrl)}/contact">contact us</a>.</p><p><a class="gss-btn gss-btn-dark" href="${esc(baseUrl)}/">Back to Home</a></p></div>`,
  }), { status: 500, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

// ---------------------------------------------------------------------------
// /api/leads
// ---------------------------------------------------------------------------

const ALLOWED_FORM_TYPES = new Set(['valuation', 'vip_buyer', 'contact', 'referral', 'newsletter']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function handleLeadPost(request, env) {
  let data;
  try { data = await request.json(); } catch { return json({ error: 'Invalid JSON body.' }, 400); }
  const formType = String(data.form_type || '');
  const payload = data.payload && typeof data.payload === 'object' ? data.payload : {};
  if (!ALLOWED_FORM_TYPES.has(formType)) return json({ error: 'Unknown form type.' }, 400);
  if (data.company) return json({ ok: true }); // honeypot: pretend success
  const email = String(payload.email || '').trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) return json({ error: 'A valid email address is required.' }, 400);

  // 1) find-or-create contact (service key; server-side only)
  let contactId = null;
  try {
    const found = await sb(env, 'cms', 'contacts', `select=id&email=eq.${encodeURIComponent(email)}&limit=1`, { service: true });
    if (found && found.length) {
      contactId = found[0].id;
    } else {
      const created = await sb(env, 'cms', 'contacts', 'select=id', {
        service: true,
        body: {
          email,
          first_name: payload.first_name || null,
          last_name: payload.last_name || null,
          phone: payload.phone || null,
          source: 'website',
        },
      });
      contactId = created && created[0] ? created[0].id : null;
    }
  } catch { /* continue without contact link */ }

  // 2) insert lead
  let leadId = null;
  try {
    const leads = await sb(env, 'cms', 'leads', 'select=id', {
      service: true,
      body: {
        contact_id: contactId,
        form_type: formType,
        payload: { ...payload, page: data.page || null },
        status: 'new',
      },
    });
    leadId = leads && leads[0] ? leads[0].id : null;
  } catch (err) {
    return json({ error: 'Could not save your submission. Please try again.' }, 500);
  }

  // 3) activity log (best effort)
  try {
    await sb(env, 'cms', 'activity_log', 'select=id', {
      service: true,
      body: { action: 'lead_created', related_type: 'lead', related_id: leadId, data: { form_type: formType } },
    });
  } catch { /* non-critical */ }

  // 4) notifications per notification_rules (best effort)
  try {
    const rules = await sb(env, 'cms', 'notification_rules', 'select=*', { service: true });
    const match = (rules || []).filter((r) =>
      r.enabled !== false &&
      ([r.event, r.trigger, r.form_type].includes(formType) || [r.event, r.trigger].includes('lead_created')));
    for (const rule of match.slice(0, 5)) {
      await sb(env, 'cms', 'notifications', 'select=id', {
        service: true,
        body: {
          title: `New ${formType} lead`,
          body: `${payload.first_name || ''} ${payload.last_name || ''} <${email}>`.trim(),
          related_type: 'lead',
          related_id: leadId,
          rule_id: rule.id || null,
          channel: rule.channel || 'email',
        },
      }).catch(() => {});
    }
  } catch { /* non-critical */ }

  return json({ ok: true, lead_id: leadId });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
}

// ---------------------------------------------------------------------------
// sitemap.xml / robots.txt
// ---------------------------------------------------------------------------

async function sitemapResponse(env, url) {
  const baseUrl = String(env.SITE_URL || url.origin).replace(/\/$/, '');
  const urls = new Set([`${baseUrl}/`]);
  const add = (rows, prefix, getSlug) => {
    for (const r of rows || []) {
      const s = getSlug(r);
      if (s) urls.add(`${baseUrl}${prefix}/${encodeURIComponent(String(s))}`);
    }
  };
  try {
    const pages = await sb(env, 'cms', 'pages', 'select=slug&status=eq.published&limit=500');
    add(pages, '', (r) => (r.slug && r.slug !== 'home' ? r.slug : null));
  } catch { /* ignore */ }
  try {
    const guides = await sb(env, 'cms', 'guides', 'select=slug&limit=500').catch(() => []);
    add(guides, '/guides', (r) => r.slug);
  } catch { /* ignore */ }
  try {
    const posts = await sb(env, 'cms', 'blog_posts', 'select=slug&limit=500').catch(() => []);
    add(posts, '/blog', (r) => r.slug);
  } catch { /* ignore */ }
  try {
    const listings = await sb(env, 'mls', 'grid', 'select=*&limit=500');
    add(listings, '/listing', (r) => r.id || r.mls_number || r.listing_id);
  } catch { /* ignore */ }
  try {
    const projects = await sb(env, 'cms', 'projects', 'select=slug,id&limit=200');
    add(projects, '/pre-construction', (r) => r.slug || r.id);
  } catch { /* ignore */ }
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${
    [...urls].map((u) => `<url><loc>${esc(u)}</loc></url>`).join('')
  }</urlset>`;
  return new Response(xml, { headers: { 'content-type': 'application/xml', 'cache-control': 'public, max-age=3600' } });
}

function robotsResponse(env, url) {
  const baseUrl = String(env.SITE_URL || url.origin).replace(/\/$/, '');
  return new Response(`User-agent: *\nAllow: /\nSitemap: ${baseUrl}/sitemap.xml\n`, {
    headers: { 'content-type': 'text/plain' },
  });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    const path = url.pathname.replace(/\/+$/, '') || '/';

    try {
      // --- API ---
      if (path === '/api/health' && method === 'GET') return json({ ok: true, ts: new Date().toISOString() });
      if (path === '/api/leads' && method === 'POST') return await handleLeadPost(request, env);
      if (path === '/api/leads') return json({ error: 'Method not allowed.' }, 405);

      if (method === 'GET' || method === 'HEAD') {
        if (path === '/robots.txt') return robotsResponse(env, url);
        if (path === '/sitemap.xml') return sitemapResponse(env, url);

        // listing detail (MLS)
        let m = path.match(/^\/listing\/([^/]+)$/);
        if (m) {
          const id = decodeURIComponent(m[1]);
          // best-effort SEO prefetch
          let pre = null;
          try {
            const rows = await sb(env, 'mls', 'property', `select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
            pre = rows && rows[0];
          } catch { /* ignore */ }
          const addr = pre && (pre.address || pre.street_address || pre.full_address);
          return await cachedPage(request, env, ctx, () => renderVirtualPage(env, url, {
            title: addr ? `${addr} — Listing` : 'Listing Details',
            description: addr ? `Details for ${addr}.` : 'Listing details.',
            blocks: [{ type: 'listing_detail', props: { id } }],
            routeParams: { id },
            canonicalPath: `/listing/${encodeURIComponent(id)}`,
          }));
        }

        // pre-con project detail
        m = path.match(/^\/pre-construction\/([^/]+)$/);
        if (m && m[1] !== '') {
          const slug = decodeURIComponent(m[1]);
          return await cachedPage(request, env, ctx, () => renderVirtualPage(env, url, {
            title: 'Pre-Construction Project',
            description: 'Pre-construction project details, phases and home models.',
            blocks: [{ type: 'precon_detail', props: { slug } }],
            routeParams: { slug },
            canonicalPath: `/pre-construction/${encodeURIComponent(slug)}`,
          }));
        }

        // CMS pages: / -> home, /:slug -> page
        const slug = path === '/' ? 'home' : decodeURIComponent(path.slice(1));
        if (!slug.includes('/')) {
          return await cachedPage(request, env, ctx, () => renderPage(env, url, slug));
        }
      }

      return new Response('Not found', { status: 404 });
    } catch (err) {
      return errorResponse(env, url);
    }
  },
};

/**
 * Cache GET HTML renders in the Cloudflare Cache API (5 min default),
 * bypassed with ?nocache=1. API routes are never cached.
 */
async function cachedPage(request, env, ctx, render) {
  const url = new URL(request.url);
  const ttl = Math.max(parseInt(env.CACHE_TTL_SECONDS || '300', 10), 0);
  const useCache = request.method === 'GET' && ttl > 0 && !url.searchParams.has('nocache');
  if (!useCache) return render();
  const cache = caches.default;
  const cacheKey = new Request(url.toString(), { method: 'GET' });
  let res = await cache.match(cacheKey);
  if (res) return res;
  res = await render();
  if (res.status === 200) {
    const headers = new Headers(res.headers);
    headers.set('cache-control', `public, max-age=${ttl}`);
    const cached = new Response(res.body, { status: res.status, headers });
    // put() in the background; don't block the response
    ctx.waitUntil(cache.put(cacheKey, cached.clone()).catch(() => {}));
    return cached;
  }
  return res;
}
