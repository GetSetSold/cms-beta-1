# GetSetSold Admin

Static single-page admin app for the GetSetSold.ca page builder + CRM.
Plain HTML/CSS/JS — no frameworks, no build step. Deploys to Cloudflare Pages
straight from this folder.

## Setup

1. Copy the config template and fill in your Supabase values:
   ```bash
   cp config.example.js config.js
   ```
   Then edit `config.js`:
   ```js
   export const SUPABASE_URL = "https://atmrjimfcydgjonlxzvr.supabase.co";
   export const SUPABASE_ANON_KEY = "eyJ…"; // anon public key
   ```
   Find these in Supabase Dashboard → Project Settings → Data API.
   `config.js` is gitignored and never committed.

2. Serve or deploy the folder as-is (e.g. Cloudflare Pages, project root = `admin/`).

3. Sign in with a Supabase Auth user (email/password). Auth users are managed in
   the Supabase Dashboard → Authentication. All data views require an
   authenticated session (per RLS); the login screen guards every route.

## Views

| Route | View |
|---|---|
| `#/dashboard` | Counts: new leads, contacts, published/draft pages, unread notifications |
| `#/pages` | Page list (title, slug, type, status, updated) with status filter; create + delete |
| `#/pages/:slug/edit` | Page editor: details, SEO, and the blocks array |
| `#/leads` | Leads table with status filter; drawer shows linked contact + payload JSON, status change, notes → `activity_log` |
| `#/contacts` | Contact search + table; drawer shows details, linked leads, notes |
| `#/buyers`, `#/sellers` | Pipeline tables (contact join) with status filters + detail drawer |
| `#/media` | Image grid via `image_assignments` ⨝ `images`; upload to the `media` storage bucket (optional assignment), copy URL, delete (assignments + row + storage object) |
| `#/forms` | Read-only viewer: forms with sections + questions |
| `#/settings` | Form bound to `site_settings` row `id=1` (brand/contact, socials JSON, header/footer styles) |

## Page editor details

- **Add block**: block picker reads the `blocks_library` registry (grouped by
  category, searchable). Inserting copies the registry row's default `props`
  into the page's `blocks[]` as `{ type, props }`. Rows with
  `block_type = 'preset'` and a `blocks` array insert all of their blocks.
- **Prop editing**: fields are auto-generated per prop. If the registry row has
  `prop_schema.properties`, it drives the form:
  ```json
  { "properties": {
      "heading":   { "type": "text", "label": "Heading" },
      "body":      { "type": "textarea" },
      "columns":   { "type": "number" },
      "dark":      { "type": "boolean" },
      "align":     { "type": "select", "options": ["left", "center"] },
      "image_url": { "type": "image" }
  } }
  ```
  Supported field types: `text`, `textarea`, `number`, `boolean`, `select`,
  `image` (media-library picker), `url`, `json`. Without a schema, the type is
  detected from the prop name/value (image-ish keys → picker, long text →
  textarea, objects/arrays → JSON editor).
- **Block controls**: move up/down, duplicate, collapse (with prop summary),
  delete. Save writes the whole `blocks` array back to `pages.blocks`.
- **SEO**: meta title/description, OG image (picker), canonical, noindex.
- **Publish**: toggles `status` between `draft` and `published` and saves.

## File layout

```
index.html          shell: login screen + sidebar nav + #app mount
styles.css          design tokens (CSS custom properties) + all component styles
config.example.js   Supabase credentials template (copy to config.js)
app.js              entry: boot, login wiring, route registration
js/
  config.js         loads ../config.js, reports whether it's configured
  supabase.js       lazy singleton Supabase client (ESM via CDN importmap)
  auth.js           signIn/signOut/session helpers
  router.js         hash router with :param support
  ui.js             esc(), loading/error/empty states, toast, modal, drawer
  mediaApi.js       images + image_assignments + `media` bucket helpers
  views/            one module per view (dashboard, pages, editor, leads,
                    contacts, pipeline, media, forms, settings)
```

## Notes / assumptions

- Media assumes `images(path, name, mime_type, size_bytes, created_at)` and a
  public `media` storage bucket. Links live only in `image_assignments`.
- `activity_log` notes assume columns `(contact_id, type, note, created_at)`.
- Unread notifications assume `notifications.is_read`; falls back to total count.
- `contacts` name rendering tries `name`, then `first_name`/`last_name`.
- Leads table shows `leads.name` if present, else the linked contact / payload name.
