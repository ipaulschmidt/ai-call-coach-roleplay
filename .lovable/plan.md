## Goal

Add **Tough conversation** as a third Call Type chip on the setup page. When selected, a "Conversation type" picker appears below it with **14 buckets** of difficult-client situations. Each bucket has 2–4 hidden variants the AI rolls at session start so the same bucket feels fresh on repeat practice. Everything else on the page stays where it is, and no script previews / study aids are exposed in the UI.

## UI changes (`src/pages/Index.tsx`)

Step 03 — "Shape the call":

1. Add a third chip to the existing CALL_TYPES inline group: **Tough conversation** — subhead "Existing client, hard moment."
2. When `callType === "tough"`, render a new **Conversation type** section (below the call-type description card, above Difficulty). 4-column grid of card-buttons matching the existing card styling. Each card shows a short title and one-line subtitle. Stored as `situationId` in local state. Layout for 14 cards: 4 × 3 + 2 in the final row, left-aligned.
3. **Hide the Difficulty selector** when `callType === "tough"` — the situation drives the dynamic. Force `difficulty = "realistic"` under the hood for type compatibility.
4. Roleplay length stays.
5. CTA summary line shows the chosen situation title instead of difficulty in tough mode.

## The 14 buckets (with hidden variants)

The user only sees the bucket title + subtitle. The variant is randomly selected per session and only used inside the system prompt.

1. **Past-due payment** — money conversation
   - 30 days late, polite but evasive · 60+ days late, going dark · chronic late payer · disputing the invoice
2. **Scope creep pushback** — protect the SOW
   - "can you just add this real quick" · stacking small free asks · expecting a major add as included · pushing for free strategy work
3. **Missed deadline** — you're behind
   - missed a hard launch date · slipped milestone, client found out · cascading delays · you have to ask for an extension
4. **Termination signal** — they're leaving
   - "we're evaluating other agencies" · end-of-contract non-renewal · sudden cancellation request · soft "we need to think about this"
5. **Rate increase** — telling them prices are going up
   - annual lift on a happy client · mid-contract increase needed · new pricing applied at renewal · raising rate on a price-sensitive client
6. **Team change** — their favorite person left
   - reassigning their favorite consultant · PM left the firm · seasonal account team shuffle · senior swap to junior
7. **Bad results** — KPIs are down, own it
   - paid campaign tanked · pipeline didn't materialize · attribution looks worse than expected · wrong KPI was being optimized
8. **Firing the client** — you're leaving them
   - chronic late payer being let go · scope/relationship not viable · culture / abusive behavior · strategic refocus away from their segment
9. **Discount / fee reduction request** — they want to pay less
   - asking for a discount mid-engagement · wants to cut retainer hours · threatening to pull work in-house · "match this other agency's quote"
10. **Difficult feedback loop** — endless or vague revisions
    - "make it pop" / vague feedback · contradictory feedback across stakeholders · nitpicking deliverables · changing direction after sign-off
11. **Slow approvals / ghosting** — they're blocking the work
    - sign-off stuck for weeks · client gone dark · approvals bottlenecked on one exec · they reappear and expect no slippage
12. **New stakeholder / new boss** — relationship reset
    - new CMO wants to re-evaluate everything · champion left, replacement is skeptical · surprise exec joins the call · acquired company, new leadership
13. **Emergency / fire-drill request** — last-minute pressure
    - "we need this by Monday" · weekend / after-hours ask · urgent pivot mid-sprint · CEO-driven panic request
14. **Blame-shifting** — they missed it, they blame you
    - their late approval caused the slip, blamed on you · their bad data, blamed on your reporting · their stakeholder didn't show, your fault somehow · escalating to your boss over their own miss

## Data changes (`src/lib/session.ts`)

- Extend `CallType` to `"discovery" | "service" | "tough"`.
- Extend `SimConfig` with optional `situationId?: string`, `situationLabel?: string`, `variantId?: string`.
- Add `TOUGH_SITUATIONS: { id, label, subtitle, variants: { id, label, scenario, internalPlaybook }[] }[]` — `scenario` is a 1–2 sentence client-side backstory (becomes `config.scenario`). `internalPlaybook` is hidden multi-line guidance (the model's resolution map: boundaries, what good looks like, traps to avoid). Never rendered in UI; only sent server-side.
- Add `pickToughVariant(situationId)` that randomly selects a variant.
- Add `buildToughGoal(situationId, variantId, durationMin)` returning the hidden consultant objective for the chat/evaluate prompts.
- Update `pickScenario` so `tough` returns the variant's `scenario` string.

## Edge function changes

`supabase/functions/chat/index.ts`:
- Extend `SimConfig.callType` to include `"tough"` and add optional `situationId`, `situationLabel`, `variantId`, `internalPlaybook`.
- Add a third branch in `buildSystemPrompt`: when `callType === "tough"`, swap the SALES/SERVICE rule blocks for a TOUGH rule block + the variant's `internalPlaybook`. Relationship block flips to "you ARE a client and you're upset / pushing back / evasive / frustrated as appropriate to this variant."
- Timing block stays the same.

`supabase/functions/evaluate/index.ts`:
- When `config.callType === "tough"`, swap the rubric to: **Empathy & Acknowledgement**, **Firmness / Boundary Holding**, **Options Offered**, **Scope & Money Protected**, **Concrete Next Step**. Keep `corrective_feedback`, `wins`, `summary`. Sales/service mode keeps the current rubric.

## Out of scope

- No script previews, hint text, or "study aids" anywhere in the UI.
- No redesign of any other step or page.
- Persona picker (Step 02) stays as-is — the situation+variant drives the dynamic, not the persona.
