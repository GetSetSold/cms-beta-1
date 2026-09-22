# GetSetSold Pages Worker

Cloudflare Worker that serves the **public** GetSetSold.ca website. It renders
CMS pages from Supabase (blocks JSONB → HTML), serves MLS listing detail and
pre-con project detail pages, and accepts lead-capture form submissions.

No npm dependencies — Supabase is called with plain `fetch()` against
PostgREST. There is no `package.json`; deploy with Wrangler.

## Files

```
workers/
├── src/
│   ├── index.js   # Worker entry: router, page renderer, /api/leads, sitemap
│   ├── blocks.js  # ~33 block renderers + BLOCKS registry + renderBlocks()
│   └── tokens.js  # design tokens (colors, fonts, radii…) + :root CSS vars
└── README.md
```

## Routes

| Method | Path | Description |
|---|---|---|
| GET | `/` | Renders the `home` page |
| GET | `/:slug` | Renders a published CMS page (`pages.slug`) |
| GET | `/listing/:id` | Listing detail from the MLS project (`property`, falls back to `sold`); `:id` may be an `id` or MLS number |
| GET | `/pre-construction/:slug` | Project detail (`projects` + `phases` + `home_models`) |
| POST | `/api/leads` | Lead capture: validates, upserts `contacts`, inserts `leads` (`status='new'`), logs `activity_log`, creates `notifications` per `notification_rules` |
| GET | `/api/health` | `{ ok: true, ts }` |
| GET | `/sitemap.xml` | Published pages + guides + blog posts + MLS listings + pre-con projects |
| GET | `/robots.txt` | Allow-all + sitemap reference |

Pages are cached in the Cloudflare Cache API (default 5 min). Append
`?nocache=1` to bypass. API routes are never cached.

`site_header` / `site_footer` blocks are auto-injected when a page's block
list doesn't include them.

## Environment variables / secrets

`wrangler.toml` lives in the repo root (parent agent owns it). The Worker
needs these bindings — set real values with `wrangler secret put`, never in
the toml:

| Name | Kind | Purpose |
|---|---|---|
| `SUPABASE_URL` | var or secret | CMS project (`atmrjimfcydgjonlxzvr`) REST base |
| `SUPABASE_ANON_KEY` | secret | Public reads (pages, blocks_library, site_settings, pre-con…) |
| `SUPABASE_SERVICE_KEY` | secret | Server-side writes only: `contacts` upsert, `leads` insert, `activity_log`, `notifications` |
| `MLS_SUPABASE_URL` | var or secret | **Separate** MLS project REST base |
| `MLS_SUPABASE_KEY` | secret | MLS project read key — **read-only; the Worker never writes to MLS** |
| `SITE_URL` | var | Canonical origin, e.g. `https://getsetsold.ca` (falls back to request origin) |
| `CACHE_TTL_SECONDS` | var | Page cache TTL (default `300`; `0` disables) |

## Local dev

```bash
# from the repo root; create .dev.vars with the secrets above (gitignored)
npx wrangler dev
```

`wrangler dev` reads `.dev.vars` for local secrets. Do not commit that file.

## Deploy

```bash
npx wrangler deploy
```

Secrets must exist first:

```bash
wrangler secret put SUPABASE_ANON_KEY
wrangler secret put SUPABASE_SERVICE_KEY
wrangler secret put MLS_SUPABASE_KEY
```

## How rendering works

1. `renderPage(slug)` fetches `pages` (status=`published`), `site_settings`
   (id=1) and the `blocks_library` id list in parallel.
2. Block types are validated against `blocks_library`; unknown types render
   as an HTML comment instead of breaking the page.
3. `renderBlocks()` runs each block's `(props, ctx)` renderer; data-driven
   blocks (`listing_grid`, `precon_grid`, …) fetch via `ctx.sb` / `ctx.mls`.
4. `<head>` gets per-page SEO (`pages.seo`: title/description/og_image),
   canonical URL, global CSS generated from `tokens.js`, and JSON-LD
   (`RealEstateAgent` org on every page, `WebSite` on home, `FAQPage` when an
   `faq` block is present, `RealEstateListing`/`Product` on detail pages).
5. Lead forms POST JSON to `/api/leads`; a global submit handler inlines
   success/error messaging. A honeypot field (`company`) silently drops bots.

## Block catalog

**Layout:** `site_header` `site_footer` `hero` `page_hero` `breadcrumbs`
`section` `grid` `spacer` `divider`
**Content:** `rich_text` `image` `gallery` `stats` `testimonials` `faq`
`cta_banner` `agent_bio` `video` `icon_features` `steps`
**Real estate:** `listing_grid` `listing_detail` `featured_carousel`
`precon_grid` `precon_detail` `neighbourhood_block` `calculator_widget`
**Lead capture:** `valuation_form` `vip_signup` `contact_form`
`referral_form` `newsletter_form`

## Assumptions / column guesses

The CMS schema beyond the confirmed facts was not fully visible, so these
column names are **guessed** and every data fetch fails soft (renders an
HTML comment) if they don't exist:

- `site_settings`: `site_name`, `logo_url`, `phone`, `email`, `nav_items`,
  `footer_links`, `agent_photo` (+ confirmed: `header_fixed_desktop`, …)
- `pages`: `title` (used only as SEO fallback)
- `images`: `url`, `alt_text` (or `file_path`)
- `contacts` (write): `email`, `first_name`, `last_name`, `phone`, `source`
- `leads` (write): `contact_id`, `form_type`, `payload`, `status` (confirmed)
- `activity_log` (write): `action`, `related_type`, `related_id`, `data`
- `notification_rules` (read): `enabled`, `event`/`trigger`/`form_type`, `channel`
- `notifications` (write): `title`, `body`, `related_type`, `related_id`, `rule_id`, `channel`
- MLS `grid`/`property`/`sold`: `id`, `mls_number`, `listing_id`, `list_price`/`price`,
  `address`, `city`, `beds`/`bedrooms`, `baths`/`bathrooms`, `sqft`,
  `photo_url`/`image_url`, `status`, `description`
- `projects`: `slug`, `name`, `city`, `price_from`, `hero_image`, `description`
- `calculators_config`: `key`, `name`, `type`, `fields[]`, `description`
  (`type` ∈ `mortgage_payment` `affordability` `land_transfer` `closing_costs` `generic`)
- `cities`: `id`, `name`, `slug`; `neighbourhoods`: `city_id`, `name`, `slug`
- `guides` / `blog_posts`: `slug`

If a column is wrong, PostgREST returns 400 and the block degrades to a
comment rather than a 500 — check page output and align the guesses.
