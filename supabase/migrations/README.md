# Migrations

Migration history for the CMS / pre-con / CRM Supabase project (`atmrjimfcydgjonlxzvr`).

| File | Status |
|------|--------|
| `0001_core_schema.sql` | **Applied directly in the Supabase dashboard SQL editor** (not stored in this repo — the canonical schema already lives in the project). |
| `0002_fixups.sql` | Fix-up migration: corrects the `home_models.phase_id` type mismatch (uuid → bigint FK to `phases`), adds authenticated write policies, dedupes the media pattern (`images` = file-only, `image_assignments` = canonical link table), adds public read + defaults for `site_settings`, public reads for active forms, missing FKs (`NOT VALID`) + indexes, consolidates block tables into `blocks_library`, renames `payment_installments."Description"` → `description`, makes `promos.builder_id` nullable, adds unique index on `forms.key`. Applied 2026-09-21. |

**Convention:** new migrations go here as `0003_*.sql`, `0004_*.sql`, … and are applied in order via the Supabase dashboard SQL editor (or `supabase db push` if the CLI is linked later).

> The MLS tables (`grid`, `property`, `sold`) live in a **separate** Supabase project (`nkjxlwuextxzpeohutxz`) and are read-only from the Worker — no migrations for them here.
