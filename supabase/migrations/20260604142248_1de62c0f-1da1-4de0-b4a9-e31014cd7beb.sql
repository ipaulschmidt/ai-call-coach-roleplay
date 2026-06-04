CREATE TABLE public.scenarios (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  name             text NOT NULL,
  practice_area    text NOT NULL,
  call_type        text NOT NULL,
  difficulty       text NOT NULL,
  persona          text NOT NULL,
  duration_minutes integer NOT NULL,
  topics           text,
  created_by_hint  text
);

GRANT ALL ON public.scenarios TO service_role;

ALTER TABLE public.scenarios ENABLE ROW LEVEL SECURITY;

-- No public policies: all reads/writes go through edge functions using the service role,
-- mirroring the existing coaching_sessions pattern.

ALTER TABLE public.coaching_sessions
  ADD COLUMN scenario_id uuid REFERENCES public.scenarios(id) ON DELETE SET NULL;