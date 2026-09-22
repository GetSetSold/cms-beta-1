# GetSetSold — Deploy Checklist

Everything in this zip is ready to ship. Work top to bottom; each step is independent where noted.

## 0. Supabase dashboard (5 min) — do first
1. **Auth → Users → Add user** — create your admin login (email + password). There is no sign-up page; this is the only way in.
2. **Storage → New bucket** — name it `media`, make it **public**. (The admin media library uploads here.)
3. **Project Settings → Data API** — copy the `service_role` key (keep it secret). You already have the anon key wired in `admin/config.js`.

## 1. GitHub (5 min)
1. Create a new repo (e.g. `getsetsold`), push this whole folder to `main`.
2. Add two repo secrets (**Settings → Secrets → Actions**):
   - `CLOUDFLARE_ACCOUNT_ID`
   - `CLOUDFLARE_API_TOKEN` (needs Workers + Pages permissions)
3. Pushing to `main` auto-deploys both the Worker and the Pages site via `.github/workflows/deploy.yml`.

## 2. Cloudflare Pages — admin app (10 min)
1. **Workers & Pages → Create → Pages → Connect to Git** → pick the repo.
2. Build settings: **no build command**, output directory **`admin`**.
3. Your admin will live at `https://<project>.pages.dev` (map `admin.getsetsold.ca` later if you want).
4. `admin/config.js` is already wired with your Supabase URL + anon key — log in with the Auth user from step 0.

## 3. Cloudflare Worker — public site (10 min)
From the `workers/` folder (or let the GitHub Action do it):
```bash
npx wrangler deploy
npx wrangler secret put SUPABASE_URL          # https://atmrjimfcydgjonlxzvr.supabase.co
npx wrangler secret put SUPABASE_ANON_KEY     # CMS anon key
npx wrangler secret put SUPABASE_SERVICE_KEY  # CMS service_role key (step 0.3)
npx wrangler secret put MLS_SUPABASE_URL      # https://nkjxlwuextxzpeohutxz.supabase.co
npx wrangler secret put MLS_SUPABASE_KEY      # MLS read key
```
Then **Workers → cms → Settings → Domains & Routes** → add route for `getsetsold.ca/*`.

## 4. Smoke test (5 min)
- [ ] Admin login works; Pages list loads; block library shows ~91 blocks.
- [ ] Create a test page, add a Hero + Pre-con grid, publish.
- [ ] Public site renders the page at `getsetsold.ca/<slug>`.
- [ ] Submit a test lead form → appears in admin Leads as `new`.
- [ ] `/sitemap.xml` loads.

## Notes
- `admin/config.js` is gitignored but **included in this zip** so Pages works immediately. Don't commit it to a public repo — or do, it's the publishable anon key; your call.
- Lead form inserts use the service-role key server-side (bypasses RLS safely).
- If a block renders empty on the public site, check the Worker logs — unknown block types degrade to HTML comments, never 500s.
