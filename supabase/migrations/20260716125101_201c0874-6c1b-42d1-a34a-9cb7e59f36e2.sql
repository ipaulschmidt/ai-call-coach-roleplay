CREATE TABLE public.personas (
  id text PRIMARY KEY,
  name text NOT NULL,
  role text NOT NULL,
  blurb text NOT NULL,
  practice_area text NOT NULL,
  gender text CHECK (gender IN ('female', 'male')),
  avatar_url text,
  personality_traits text,
  known_objections text,
  voice_notes text,
  source_type text NOT NULL DEFAULT 'composite' CHECK (source_type IN ('composite', 'real_person_modeled')),
  source_reference text,
  brand_context text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_personas_practice_area ON public.personas(practice_area);

GRANT SELECT ON public.personas TO anon, authenticated;
GRANT ALL ON public.personas TO service_role;

ALTER TABLE public.personas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read personas"
  ON public.personas FOR SELECT
  USING (true);

INSERT INTO public.personas (id, name, role, blurb, practice_area, gender, source_type) VALUES
('skeptical-cfo', 'Margaret Vale', 'Skeptical CFO', 'Wants ROI numbers. Allergic to buzzwords.', 'hubspot', 'female', 'composite'),
('busy-marketing', 'Priya Shah', 'Busy Marketing Manager', 'Time-poor, juggling 3 campaigns. Cares about speed.', 'hubspot', 'female', 'composite'),
('revops', 'Jordan Kim', 'Curious RevOps Lead', 'Loves architecture. Asks about workflows and data.', 'hubspot', 'male', 'composite'),
('tech-admin', 'Sam Reyes', 'Technical HubSpot Admin', 'Knows the product. Will catch any inaccuracy.', 'hubspot', 'male', 'composite'),
('office-owner', 'Marcus Hale', 'Office-Based Franchise Owner', 'Multi-unit Budget Blinds owner. Runs ops, watches the leads dashboard. Talks growth, ROAS, and competitive metrics.', 'paid_media', 'male', 'composite'),
('overwhelmed-owner', 'Brittany Cole', 'Overwhelmed Owner-Operator', 'Single-location Kitchen Tune-Up owner. 1–2 person shop. Hard to reach. Marketing only matters when leads slow down.', 'paid_media', 'female', 'composite'),
('seasoned-marketer', 'Ethan Brooks', 'Seasoned Marketing Manager', 'Independent marketing lead across 4 College HUNKS franchisees. Hands-on, opinionated, holds budget authority.', 'paid_media', 'male', 'composite'),
('marketing-friend', 'Hannah Reyes', 'The Marketing Girl', 'Franchisee''s niece, marketing student, runs their social. Limited PPC expertise. Owner is watching from behind the scenes.', 'paid_media', 'female', 'composite'),
('franchisor-director', 'Lauren Pace', 'Franchisor Marketing Director', 'Corporate side at HFC. Vets preferred vendors for 1,000+ locations. Cares about network-wide consistency and reporting.', 'paid_media', 'female', 'composite'),
('ecom-owner', 'Carla Núñez', 'Shopify Store Owner', '$3M GMV, conversion-obsessed, weighing headless re-platform.', 'globalia', 'female', 'composite'),
('ai-curious-coo', 'Mira Liu', 'Mid-market COO', 'Wants a custom AI agent for ops. Worried about hallucinations and ROI.', 'globalia', 'female', 'composite'),
('product-pm', 'Aisha Brown', 'Product Manager', 'Scoping a custom web/mobile app build. Asks about stack, timeline, QA.', 'globalia', 'female', 'composite'),
('wp-marketer', 'Jen Becker', 'Marketing Lead', 'Owns a WordPress site that''s slow and outdated. Cares about SEO + uptime.', 'globalia', 'female', 'composite');