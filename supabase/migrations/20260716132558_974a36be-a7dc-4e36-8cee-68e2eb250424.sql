GRANT SELECT ON public.scenarios TO anon, authenticated;
CREATE POLICY "Public can read scenarios" ON public.scenarios FOR SELECT USING (true);