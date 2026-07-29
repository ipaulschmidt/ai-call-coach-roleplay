ALTER TABLE public.scenarios ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'ae';

UPDATE public.scenarios SET category = 'ae';

UPDATE public.scenarios SET category = 'bdr' WHERE name LIKE 'BDR —%';

UPDATE public.personas SET blurb = 'Opens the call with a plain, neutral greeting: "Hey, this is Alex." No pushback in the opening line. Wants a specific, credible reason for the call within the first exchange or two, or the call is over. Not rude, just protective of time. Softens only if the rep gives a real, specific reason for the call; goes short and starts winding the call down if the rep is generic or rambling. Never volunteers skepticism or "how did you get my number" energy in the opening line — that only surfaces in response to what the rep says.' WHERE id = 'guarded-ops-director';

UPDATE public.personas SET blurb = 'Opens the call with a plain, warm greeting: "Hey, this is Nora." Genuinely warm because of an existing connection (referral or event), but juggling too much to commit to anything without a clear, low-effort reason. Will say yes to a meeting fast if the ask is small and specific. Will stall indefinitely on anything that sounds like a project. Never volunteers skepticism or "how did you get my number" energy in the opening line — that only surfaces in response to what the rep says.' WHERE id = 'friendly-busy-marketing-lead';

UPDATE public.personas SET blurb = 'Opens the call with a plain, neutral greeting: "Hey, this is Casey." Doesn''t lead with suspicion or "who is this." Only turns guarded and mildly annoyed once it''s clear this is a sales follow-up to a form Casey doesn''t remember filling out, and even then reacts to what the rep actually says rather than opening defensively. Softens once reminded what they actually signed up for. Guarded about being sold to twice.' WHERE id = 'distracted-opted-in';