# GetSetSold.ca — Rebuild

Static site + page builder + CRM for GetSetSold.ca (Rohit Sharma, REALTOR® — Lombard Group Real Estate Inc., Brokerage).

**Stack:** static HTML/CSS/JS → GitHub → Cloudflare Pages (admin) + Cloudflare Workers (public site) → Supabase (Postgres + Auth + Storage).

```
getsetsold/
├── admin/                  # Static SPA — CRM + page builder backend (→ Cloudflare Pages)
│   ├── index.html
│   ├── styles.css          # Design tokens as CSS vars (mirrors workers/src/tokens.js)
│   ├── config.example.js   # Copy to config.js and fill in (config.js is gitignored)
│   └── js/                 # SPA: auth, router, views (dashboard, pages, editor, CRM, media, forms, settings)
├── workers/                # Cloudflare Worker — renders the PUBLIC site
│   └── src/
│       ├── index.js        # Router: pages, sitemap, /api/leads, health
│       ├── blocks.js       # ~35 block render functions + BLOCKS registry
│       └── tokens.js       # Shared design tokens (black/white + cobalt #2456e6)
├── supabase/
│   └── migrations/         # 0002_fixups.sql (applied); README documents 0001 (applied in dashboard)
├── .github/workflows/     # deploy.yml — Pages + Workers on push to main
└── wrangler.toml           # Worker config (no secrets committed)
```

**Brand:** black + white, one cobalt blue accent (`#2456e6`). Modern, clean, trust-forward.

## What Rohit must provide (deploy checklist)

- [ ] **Supabase (CMS project `atmrjimfcydgjonlxzvr`)**
  - [ ] Project URL → goes in `admin/config.js` as `SUPABASE_URL`
  - [ ] `anon` public key → goes in `admin/config.js` as `SUPABASE_ANON_KEY`
  - [ ] `service_role` key → set once via `wrangler secret put SUPABASE_SERVICE_KEY`
  - [ ] Confirm `0002_fixups.sql` applied (done 2026-09-21)
  - [ ] Create Storage bucket `media` (public read) for the media library
- [ ] **Supabase (MLS project `nkjxlwuextxzpeohutxz`)** — read-only from the Worker
  - [ ] Project URL → `MLS_SUPABASE_URL`
  - [ ] API key with read access to `grid`/`property`/`sold` → `wrangler secret put MLS_SUPABASE_KEY`
- [ ] **Cloudflare**
  - [ ] Account ID + API token → GitHub secrets `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`
  - [ ] API token needs: Workers Scripts (edit), Pages (edit), Account Settings (read)
  - [ ] Create Pages project `getsetsold-admin` (build output: repo's `admin/` dir, no build step)
  - [ ] Point `getsetsold.ca` (and `www`) at the Worker via a route, or serve the Worker on the apex domain
- [ ] **GitHub**
  - [ ] New repo (e.g. `getsetsold-web`), push this directory, `main` branch deploys on push
- [ ] **Admin login**
  - [ ] Create the admin user in Supabase Auth (dashboard → Authentication → Users) — the SPA uses email/password sign-in; no sign-up UI is exposed

## Deploy steps

1. **Supabase (CMS project):** run `supabase/migrations/0002_fixups.sql` in the SQL editor (done 2026-09-21 — skip if already applied). Create the `media` storage bucket (public).
2. **Admin config:** `cp admin/config.example.js admin/config.js` and fill in `SUPABASE_URL` + `SUPABASE_ANON_KEY`. (Never commit `config.js` — it's gitignored.)
3. **Worker secrets:**
   ```bash
   wrangler secret put SUPABASE_ANON_KEY
   wrangler secret put SUPABASE_SERVICE_KEY
   wrangler secret put MLS_SUPABASE_KEY
   # optionally: wrangler secret put SUPABASE_URL / MLS_SUPABASE_URL (or set as [vars])
   ```
4. **GitHub:** push to `main`. The workflow deploys the Worker and publishes `admin/` to Pages.
5. **DNS:** attach the Worker to `getsetsold.ca` (Workers → your worker → Settings → Domains & Routes). Admin lives at the Pages URL (e.g. `getsetsold-admin.pages.dev`, or map `admin.getsetsold.ca` later — open decision).

## Local development

```bash
# Worker (public site)
npx wrangler dev            # serves http://localhost:8787 ; reads .dev.vars for secrets

# Admin SPA — any static server from the repo root:
npx serve admin             # then open the printed URL; needs admin/config.js filled in
```

## Data flow

- **Public pages:** Worker reads `pages` (status=`published`) + `blocks_library`, renders HTML with per-page SEO + JSON-LD. MLS listings come from the separate MLS project (read-only).
- **Lead capture:** forms POST to the Worker's `/api/leads` → inserts `contacts` (if new) + `leads` (form_type, payload, status=`new`) using the service key; notification rules can trigger `notifications` rows.
- **Admin:** authenticated users (Supabase Auth) CRUD pages/blocks/CRM rows directly via the anon key + RLS.

## Open decisions (not blocking deploy)

- Admin at `admin.getsetsold.ca` vs `/admin` path
- Email/SMS providers (Resend vs SendGrid; Twilio vs alternative) — notifications table is ready, provider wiring is Phase 2
- `booking.getsetsold.ca` stays separate for now
