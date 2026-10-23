# AGENTS.md

## Rules

- Practice-area identifiers are neutral codes (`hubspot`, `paid_media`, `digital_build`)
  and user-facing text uses neutral labels (CRM & Marketing, Paid Media, Digital Build).
  Organization brand names must never appear in source, docs, README, or seeded content,
  because the repository is shared publicly and the app is white-label.
- When adding a practice area, add its code to the `PracticeArea` union in
  `src/lib/session.ts` plus the label maps in `Index.tsx`, `RelatedScenarios.tsx`,
  `SessionCard.tsx`, `LeaderboardTab.tsx`, and `AREA_CONTEXT` in
  `supabase/functions/chat/index.ts` — the database column is unconstrained text, so a
  missing label silently renders a raw code in the UI.
