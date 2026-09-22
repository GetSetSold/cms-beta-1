-- ============================================================================
-- 0002_fixups.sql — GetSetSold.ca Phase 1 fix-up migration
-- Target project: atmrjimfcydgjonlxzvr (Pre-con + CRM + Page Builder)
-- Date: 2026-09-21
--
-- What this fixes (from schema review):
--  1. home_models.phase_id was uuid while phases.id is bigint -> re-created as
--     bigint so the join can become a real foreign key. NOTE: existing
--     phase_id values are dropped (they could never join correctly anyway).
--  2. Pre-con tables were public-read-only -> added authenticated write
--     policies so the admin app can edit via the Supabase client.
--  3. Media was modeled twice (images.related_type/related_id AND
--     image_assignments) -> images is now just the file row; image_assignments
--     is the single canonical link table.
--  4. site_settings had no public read policy (public site needs it) and
--     several NOT NULL columns had no defaults -> added both.
--  5. forms / form_sections / form_questions were authenticated-only ->
--     public can now read active forms so the site can render them.
--  6. Missing foreign keys -> added as NOT VALID (won't fail on existing
--     orphan rows; run VALIDATE CONSTRAINT later once data is clean).
--  7. Missing indexes on FK / filter columns.
--  8. Three overlapping block-template tables (blocks_library,
--     block_templates, template_presets) -> merged into blocks_library,
--     old tables dropped.
--  9. Small cleanups: payment_installments."Description" -> description,
--     promos.builder_id made nullable, unique index on forms.key.
--
-- How to run:
--   Supabase Dashboard -> SQL Editor -> paste & run, OR
--   supabase db push (if using the CLI with this file in supabase/migrations)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Make sure RLS is enabled everywhere (idempotent)
-- ----------------------------------------------------------------------------
ALTER TABLE builders ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE home_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE home_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE images ENABLE ROW LEVEL SECURITY;
ALTER TABLE image_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE amenities ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_amenities ENABLE ROW LEVEL SECURITY;
ALTER TABLE promos ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE floorplans ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE neighbourhoods ENABLE ROW LEVEL SECURITY;
ALTER TABLE guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE calculators_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE static_pages ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 1. Align home_models.phase_id with phases.id (bigint)
--    Drops the broken uuid column and re-creates it as bigint.
-- ----------------------------------------------------------------------------
ALTER TABLE home_models DROP CONSTRAINT IF EXISTS home_models_phase_id_fkey;
ALTER TABLE home_models DROP COLUMN IF EXISTS phase_id;
ALTER TABLE home_models ADD COLUMN phase_id bigint;

-- ----------------------------------------------------------------------------
-- 2. Media dedupe: images becomes file-only, image_assignments is the link
-- ----------------------------------------------------------------------------
ALTER TABLE images DROP COLUMN IF EXISTS related_type;
ALTER TABLE images DROP COLUMN IF EXISTS related_id;
DROP TYPE IF EXISTS related_type_enum;

-- Keep related_type values sane going forward (NOT VALID so existing rows pass)
ALTER TABLE image_assignments DROP CONSTRAINT IF EXISTS image_assignments_related_type_check;
ALTER TABLE image_assignments
  ADD CONSTRAINT image_assignments_related_type_check
  CHECK (related_type IN ('project','builder','home_model','floorplan','phase','promo','page','block'))
  NOT VALID;

-- ----------------------------------------------------------------------------
-- 3. site_settings: defaults for NOT NULL columns + public read
-- ----------------------------------------------------------------------------
ALTER TABLE site_settings ALTER COLUMN nav_items SET DEFAULT '[]'::jsonb;
ALTER TABLE site_settings ALTER COLUMN footer_links SET DEFAULT '[]'::jsonb;
ALTER TABLE site_settings ALTER COLUMN mobile_menu_style SET DEFAULT 'default';
ALTER TABLE site_settings ALTER COLUMN header_style SET DEFAULT 'default';
ALTER TABLE site_settings ALTER COLUMN footer_style SET DEFAULT 'default';
ALTER TABLE site_settings ALTER COLUMN header_fixed_desktop SET DEFAULT true;
ALTER TABLE site_settings ALTER COLUMN header_fixed_mobile SET DEFAULT false;

DROP POLICY IF EXISTS "public can read site_settings" ON site_settings;
CREATE POLICY "public can read site_settings"
  ON site_settings FOR SELECT TO public USING (true);

-- ----------------------------------------------------------------------------
-- 4. Public read for active forms (site needs to render them)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "public can read active forms" ON forms;
CREATE POLICY "public can read active forms"
  ON forms FOR SELECT TO public USING (status = 'active');

DROP POLICY IF EXISTS "public can read active form_sections" ON form_sections;
CREATE POLICY "public can read active form_sections"
  ON form_sections FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM forms WHERE forms.id = form_sections.form_id AND forms.status = 'active'
  ));

DROP POLICY IF EXISTS "public can read active form_questions" ON form_questions;
CREATE POLICY "public can read active form_questions"
  ON form_questions FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM forms WHERE forms.id = form_questions.form_id AND forms.status = 'active'
  ));

-- ----------------------------------------------------------------------------
-- 5. Authenticated write policies for pre-con tables
--    (matches the existing convention: TO public + auth.role() check)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "authenticated write: builders" ON builders;
CREATE POLICY "authenticated write: builders" ON builders FOR ALL TO public
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "authenticated write: projects" ON projects;
CREATE POLICY "authenticated write: projects" ON projects FOR ALL TO public
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "authenticated write: phases" ON phases;
CREATE POLICY "authenticated write: phases" ON phases FOR ALL TO public
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "authenticated write: home_models" ON home_models;
CREATE POLICY "authenticated write: home_models" ON home_models FOR ALL TO public
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "authenticated write: home_types" ON home_types;
CREATE POLICY "authenticated write: home_types" ON home_types FOR ALL TO public
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "authenticated write: images" ON images;
CREATE POLICY "authenticated write: images" ON images FOR ALL TO public
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "authenticated write: image_assignments" ON image_assignments;
CREATE POLICY "authenticated write: image_assignments" ON image_assignments FOR ALL TO public
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "authenticated write: amenities" ON amenities;
CREATE POLICY "authenticated write: amenities" ON amenities FOR ALL TO public
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "authenticated write: project_amenities" ON project_amenities;
CREATE POLICY "authenticated write: project_amenities" ON project_amenities FOR ALL TO public
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "authenticated write: promos" ON promos;
CREATE POLICY "authenticated write: promos" ON promos FOR ALL TO public
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "authenticated write: payment_plans" ON payment_plans;
CREATE POLICY "authenticated write: payment_plans" ON payment_plans FOR ALL TO public
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "authenticated write: payment_installments" ON payment_installments;
CREATE POLICY "authenticated write: payment_installments" ON payment_installments FOR ALL TO public
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "authenticated write: floorplans" ON floorplans;
CREATE POLICY "authenticated write: floorplans" ON floorplans FOR ALL TO public
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- ----------------------------------------------------------------------------
-- 6. Foreign keys (NOT VALID: won't fail on existing orphan rows)
--    After cleaning data, run: ALTER TABLE <t> VALIDATE CONSTRAINT <name>;
-- ----------------------------------------------------------------------------
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_builder_id_fkey;
ALTER TABLE projects ADD CONSTRAINT projects_builder_id_fkey
  FOREIGN KEY (builder_id) REFERENCES builders(id) ON DELETE SET NULL NOT VALID;

ALTER TABLE phases DROP CONSTRAINT IF EXISTS phases_project_id_fkey;
ALTER TABLE phases ADD CONSTRAINT phases_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE NOT VALID;

ALTER TABLE home_models DROP CONSTRAINT IF EXISTS home_models_project_id_fkey;
ALTER TABLE home_models ADD CONSTRAINT home_models_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE NOT VALID;

ALTER TABLE home_models DROP CONSTRAINT IF EXISTS home_models_phase_id_fkey;
ALTER TABLE home_models ADD CONSTRAINT home_models_phase_id_fkey
  FOREIGN KEY (phase_id) REFERENCES phases(id) ON DELETE SET NULL NOT VALID;

ALTER TABLE home_models DROP CONSTRAINT IF EXISTS home_models_home_type_id_fkey;
ALTER TABLE home_models ADD CONSTRAINT home_models_home_type_id_fkey
  FOREIGN KEY (home_type_id) REFERENCES home_types(id) ON DELETE SET NULL NOT VALID;

ALTER TABLE floorplans DROP CONSTRAINT IF EXISTS floorplans_model_id_fkey;
ALTER TABLE floorplans ADD CONSTRAINT floorplans_model_id_fkey
  FOREIGN KEY (model_id) REFERENCES home_models(id) ON DELETE CASCADE NOT VALID;

ALTER TABLE promos DROP CONSTRAINT IF EXISTS promos_project_id_fkey;
ALTER TABLE promos ADD CONSTRAINT promos_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE NOT VALID;

ALTER TABLE promos DROP CONSTRAINT IF EXISTS promos_builder_id_fkey;
ALTER TABLE promos ADD CONSTRAINT promos_builder_id_fkey
  FOREIGN KEY (builder_id) REFERENCES builders(id) ON DELETE CASCADE NOT VALID;

ALTER TABLE project_amenities DROP CONSTRAINT IF EXISTS project_amenities_project_id_fkey;
ALTER TABLE project_amenities ADD CONSTRAINT project_amenities_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE NOT VALID;

ALTER TABLE project_amenities DROP CONSTRAINT IF EXISTS project_amenities_amenity_id_fkey;
ALTER TABLE project_amenities ADD CONSTRAINT project_amenities_amenity_id_fkey
  FOREIGN KEY (amenity_id) REFERENCES amenities(id) ON DELETE CASCADE NOT VALID;

ALTER TABLE payment_plans DROP CONSTRAINT IF EXISTS payment_plans_project_id_fkey;
ALTER TABLE payment_plans ADD CONSTRAINT payment_plans_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE NOT VALID;

ALTER TABLE payment_plans DROP CONSTRAINT IF EXISTS payment_plans_home_type_id_fkey;
ALTER TABLE payment_plans ADD CONSTRAINT payment_plans_home_type_id_fkey
  FOREIGN KEY (home_type_id) REFERENCES home_types(id) ON DELETE SET NULL NOT VALID;

ALTER TABLE payment_installments DROP CONSTRAINT IF EXISTS payment_installments_plan_id_fkey;
ALTER TABLE payment_installments ADD CONSTRAINT payment_installments_plan_id_fkey
  FOREIGN KEY (payment_plan_id) REFERENCES payment_plans(id) ON DELETE CASCADE NOT VALID;

ALTER TABLE image_assignments DROP CONSTRAINT IF EXISTS image_assignments_image_id_fkey;
ALTER TABLE image_assignments ADD CONSTRAINT image_assignments_image_id_fkey
  FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE NOT VALID;

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_contact_id_fkey;
ALTER TABLE leads ADD CONSTRAINT leads_contact_id_fkey
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL NOT VALID;

ALTER TABLE buyers DROP CONSTRAINT IF EXISTS buyers_contact_id_fkey;
ALTER TABLE buyers ADD CONSTRAINT buyers_contact_id_fkey
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE NOT VALID;

ALTER TABLE sellers DROP CONSTRAINT IF EXISTS sellers_contact_id_fkey;
ALTER TABLE sellers ADD CONSTRAINT sellers_contact_id_fkey
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE NOT VALID;

ALTER TABLE activity_log DROP CONSTRAINT IF EXISTS activity_log_contact_id_fkey;
ALTER TABLE activity_log ADD CONSTRAINT activity_log_contact_id_fkey
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE NOT VALID;

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_contact_id_fkey;
ALTER TABLE notifications ADD CONSTRAINT notifications_contact_id_fkey
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE NOT VALID;

ALTER TABLE notification_rules DROP CONSTRAINT IF EXISTS notification_rules_buyer_id_fkey;
ALTER TABLE notification_rules ADD CONSTRAINT notification_rules_buyer_id_fkey
  FOREIGN KEY (buyer_id) REFERENCES buyers(id) ON DELETE CASCADE NOT VALID;

ALTER TABLE neighbourhoods DROP CONSTRAINT IF EXISTS neighbourhoods_city_id_fkey;
ALTER TABLE neighbourhoods ADD CONSTRAINT neighbourhoods_city_id_fkey
  FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE CASCADE NOT VALID;

ALTER TABLE form_sections DROP CONSTRAINT IF EXISTS form_sections_form_id_fkey;
ALTER TABLE form_sections ADD CONSTRAINT form_sections_form_id_fkey
  FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE NOT VALID;

ALTER TABLE form_questions DROP CONSTRAINT IF EXISTS form_questions_form_id_fkey;
ALTER TABLE form_questions ADD CONSTRAINT form_questions_form_id_fkey
  FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE NOT VALID;

ALTER TABLE form_questions DROP CONSTRAINT IF EXISTS form_questions_section_id_fkey;
ALTER TABLE form_questions ADD CONSTRAINT form_questions_section_id_fkey
  FOREIGN KEY (section_id) REFERENCES form_sections(id) ON DELETE CASCADE NOT VALID;

-- ----------------------------------------------------------------------------
-- 7. Indexes on FK / filter columns
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_projects_builder_id ON projects(builder_id);
CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
CREATE INDEX IF NOT EXISTS idx_phases_project_id ON phases(project_id);
CREATE INDEX IF NOT EXISTS idx_home_models_project_id ON home_models(project_id);
CREATE INDEX IF NOT EXISTS idx_home_models_phase_id ON home_models(phase_id);
CREATE INDEX IF NOT EXISTS idx_home_models_home_type_id ON home_models(home_type_id);
CREATE INDEX IF NOT EXISTS idx_floorplans_model_id ON floorplans(model_id);
CREATE INDEX IF NOT EXISTS idx_promos_project_id ON promos(project_id);
CREATE INDEX IF NOT EXISTS idx_promos_builder_id ON promos(builder_id);
CREATE INDEX IF NOT EXISTS idx_image_assignments_related ON image_assignments(related_type, related_id);
CREATE INDEX IF NOT EXISTS idx_image_assignments_image_id ON image_assignments(image_id);
CREATE INDEX IF NOT EXISTS idx_leads_contact_id ON leads(contact_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_buyers_contact_id ON buyers(contact_id);
CREATE INDEX IF NOT EXISTS idx_sellers_contact_id ON sellers(contact_id);
CREATE INDEX IF NOT EXISTS idx_pages_status ON pages(status);
CREATE INDEX IF NOT EXISTS idx_pages_type ON pages(type);
CREATE INDEX IF NOT EXISTS idx_neighbourhoods_city_id ON neighbourhoods(city_id);
CREATE INDEX IF NOT EXISTS idx_form_sections_form_id ON form_sections(form_id);
CREATE INDEX IF NOT EXISTS idx_form_questions_form_id ON form_questions(form_id);
CREATE INDEX IF NOT EXISTS idx_form_questions_section_id ON form_questions(section_id);

-- ----------------------------------------------------------------------------
-- 8. Consolidate block template tables into blocks_library
-- ----------------------------------------------------------------------------
INSERT INTO blocks_library (id, category, label, name, description, tags, block_type, props, blocks, prop_schema, created_at, updated_at)
SELECT
  template_id,
  COALESCE(category, 'general'),
  COALESCE(name, template_id),
  name,
  description,
  tags,
  block_type,
  props,
  blocks,
  '{}'::jsonb,
  COALESCE(created_at, now()),
  COALESCE(updated_at, now())
FROM block_templates
ON CONFLICT (id) DO NOTHING;

INSERT INTO blocks_library (id, category, label, name, description, block_type, blocks, prop_schema, created_at, updated_at)
SELECT
  preset_key,
  COALESCE(category, 'presets'),
  name,
  name,
  description,
  'preset',
  blocks,
  '{}'::jsonb,
  COALESCE(created_at, now()),
  COALESCE(updated_at, now())
FROM template_presets
ON CONFLICT (id) DO NOTHING;

DROP TABLE IF EXISTS block_templates;
DROP TABLE IF EXISTS template_presets;

-- ----------------------------------------------------------------------------
-- 9. Small cleanups
-- ----------------------------------------------------------------------------
-- payment_installments."Description" -> description (case consistency)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_installments' AND column_name = 'Description'
  ) THEN
    ALTER TABLE payment_installments RENAME COLUMN "Description" TO description;
  END IF;
END $$;

-- promos.builder_id: allow project-level promos without a builder
ALTER TABLE promos ALTER COLUMN builder_id DROP NOT NULL;

-- forms.key should be unique (lookup key)
CREATE UNIQUE INDEX IF NOT EXISTS forms_key_unique_idx ON forms(key);

-- ============================================================================
-- Post-run checklist:
--  1. In the admin app, point any block-template reads at blocks_library only.
--  2. Backfill home_models.phase_id (bigint) against phases(id).
--  3. Clean orphan FK rows, then VALIDATE CONSTRAINT for each NOT VALID FK.
--  4. If public form INSERTs should go through the Worker only (service_role),
--     drop the "anon can insert contacts/leads" policies and keep inserts
--     server-side.
-- ============================================================================
