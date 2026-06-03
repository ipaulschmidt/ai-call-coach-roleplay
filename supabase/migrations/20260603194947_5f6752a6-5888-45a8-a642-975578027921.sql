DROP POLICY IF EXISTS "Anyone can view sessions" ON public.coaching_sessions;
DROP POLICY IF EXISTS "Anyone can insert sessions" ON public.coaching_sessions;
REVOKE ALL ON public.coaching_sessions FROM anon;
REVOKE ALL ON public.coaching_sessions FROM authenticated;
GRANT ALL ON public.coaching_sessions TO service_role;