
CREATE TABLE public.coaching_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  practice_area TEXT NOT NULL,
  persona TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  call_type TEXT NOT NULL,
  topics TEXT,
  consultant_name TEXT,
  transcript JSONB NOT NULL,
  evaluation JSONB
);

ALTER TABLE public.coaching_sessions ENABLE ROW LEVEL SECURITY;

-- Anyone (anon) can insert a session record. No selects allowed via anon/auth keys.
CREATE POLICY "Anyone can insert sessions"
ON public.coaching_sessions
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE INDEX idx_coaching_sessions_created_at ON public.coaching_sessions (created_at DESC);
