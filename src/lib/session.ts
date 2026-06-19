import { create } from "zustand";

export type Difficulty = "easy" | "realistic" | "hard";
export type CallType = "discovery" | "service" | "tough";
export type PracticeArea = "hubspot" | "paid_media" | "globalia";
export type Rubric =
  | "sales_discovery"
  | "service_kickoff"
  | "scope_expansion"
  | "tough_recovery";

export const RUBRIC_LABELS: Record<Rubric, string> = {
  sales_discovery: "Sales Discovery",
  service_kickoff: "Service Kickoff",
  scope_expansion: "Scope & Expansion",
  tough_recovery: "Tough Recovery",
};

/** Default rubric for legacy sessions/scenarios that have no rubric set. */
export function deriveDefaultRubric(callType: CallType | string | undefined): Rubric {
  if (callType === "tough") return "tough_recovery";
  if (callType === "service") return "service_kickoff";
  return "sales_discovery";
}

export interface SimConfig {
  topics: string;
  difficulty: Difficulty;
  persona: string;
  callType: CallType;
  practiceArea: PracticeArea;
  durationMin: number;
  goal: string;
  scenario?: string;
  personaId?: string;
  personaAvatar?: string;
  situationId?: string;
  situationLabel?: string;
  variantId?: string;
  internalPlaybook?: string;
  repEmail?: string;
  scenarioName?: string;
  rubric?: Rubric;
}

export interface Turn {
  role: "user" | "assistant";
  content: string;
}

export interface Evaluation {
  sales_strategy: { score: number; notes: string };
  technical_delivery: {
    score: number;
    notes: string;
    topics_covered: string[];
    topics_missed: string[];
  };
  consultant_confidence: {
    score: number;
    notes: string;
    filler_words: string[];
    pacing: "slow" | "good" | "rushed";
  };
  agenda_setting?: { score: number; notes: string };
  active_listening?: { score: number; notes: string; examples: string[] };
  next_steps?: { score: number; notes: string; offered_times: boolean; secured_meeting: boolean };
  corrective_feedback: string[];
  wins: string[];
  summary: string;
}

interface SessionState {
  config: SimConfig | null;
  transcript: Turn[];
  evaluation: Evaluation | null;
  setConfig: (c: SimConfig) => void;
  setTranscript: (t: Turn[]) => void;
  setEvaluation: (e: Evaluation | null) => void;
  reset: () => void;
}

export const useSession = create<SessionState>((set) => ({
  config: null,
  transcript: [],
  evaluation: null,
  setConfig: (config) => set({ config }),
  setTranscript: (transcript) => set({ transcript }),
  setEvaluation: (evaluation) => set({ evaluation }),
  reset: () => set({ config: null, transcript: [], evaluation: null }),
}));

export const PRACTICE_AREAS: {
  id: PracticeArea;
  label: string;
  tagline: string;
  defaultTopics: string;
}[] = [
  {
    id: "hubspot",
    label: "HubSpot",
    tagline: "Discovery & service calls for HubSpot consulting (2026 product set: AEO Brand Visibility, Breeze AI agents, Smart CRM, Service Hub, etc.).",
    defaultTopics: "AEO Brand Visibility Dashboard, Breeze Prospecting Agents, Smart CRM, Service Hub workflows, Marketing Hub campaigns",
  },
  {
    id: "paid_media",
    label: "Paid Media (Point Success)",
    tagline: "Lead-gen paid media for home-service franchise brands (Budget Blinds, Kitchen Tune-Up, College HUNKS, ProLift Garage Doors, etc.) — Google Ads, Meta, Microsoft.",
    defaultTopics: "Google Search campaigns, Performance Max, Meta awareness + remarketing, Microsoft Ads, local lead-gen, CPL & lead quality, territory targeting, franchisor preferred-vendor dynamics",
  },
  {
    id: "globalia",
    label: "Globalia (E-com / Custom AI / App Dev / WordPress)",
    tagline: "E-commerce builds (Shopify/WooCommerce), custom AI solutions, custom application development, and WordPress.",
    defaultTopics: "Shopify & WooCommerce builds, headless commerce, custom AI agents & RAG, application development (web/mobile), WordPress design & maintenance, performance & SEO",
  },
];

export const PERSONAS_BY_AREA: Record<PracticeArea, ReadonlyArray<{
  id: string;
  name: string;
  role: string;
  blurb: string;
  gender?: "female" | "male";
}>> = {
  hubspot: [
    { id: "skeptical-cfo", name: "Margaret Vale", role: "Skeptical CFO", blurb: "Wants ROI numbers. Allergic to buzzwords.", gender: "female" },
    { id: "busy-marketing", name: "Priya Shah", role: "Busy Marketing Manager", blurb: "Time-poor, juggling 3 campaigns. Cares about speed.", gender: "female" },
    { id: "revops", name: "Jordan Kim", role: "Curious RevOps Lead", blurb: "Loves architecture. Asks about workflows and data.", gender: "male" },
    { id: "tech-admin", name: "Sam Reyes", role: "Technical HubSpot Admin", blurb: "Knows the product. Will catch any inaccuracy.", gender: "male" },
  ],
  paid_media: [
    { id: "office-owner", name: "Marcus Hale", role: "Office-Based Franchise Owner", blurb: "Multi-unit Budget Blinds owner. Runs ops, watches the leads dashboard. Talks growth, ROAS, and competitive metrics.", gender: "male" },
    { id: "overwhelmed-owner", name: "Brittany Cole", role: "Overwhelmed Owner-Operator", blurb: "Single-location Kitchen Tune-Up owner. 1–2 person shop. Hard to reach. Marketing only matters when leads slow down.", gender: "female" },
    { id: "seasoned-marketer", name: "Ethan Brooks", role: "Seasoned Marketing Manager", blurb: "Independent marketing lead across 4 College HUNKS franchisees. Hands-on, opinionated, holds budget authority.", gender: "male" },
    { id: "marketing-friend", name: "Hannah Reyes", role: "'The Marketing Girl'", blurb: "Franchisee's niece, marketing student, runs their social. Limited PPC expertise. Owner is watching from behind the scenes.", gender: "female" },
    { id: "franchisor-director", name: "Lauren Pace", role: "Franchisor Marketing Director", blurb: "Corporate side at HFC. Vets preferred vendors for 1,000+ locations. Cares about network-wide consistency and reporting.", gender: "female" },
  ],
  globalia: [
    { id: "ecom-owner", name: "Carla Núñez", role: "Shopify Store Owner", blurb: "$3M GMV, conversion-obsessed, weighing headless re-platform.", gender: "female" },
    { id: "ai-curious-coo", name: "Mira Liu", role: "Mid-market COO", blurb: "Wants a custom AI agent for ops. Worried about hallucinations and ROI.", gender: "female" },
    { id: "product-pm", name: "Aisha Brown", role: "Product Manager", blurb: "Scoping a custom web/mobile app build. Asks about stack, timeline, QA.", gender: "female" },
    { id: "wp-marketer", name: "Jen Becker", role: "Marketing Lead", blurb: "Owns a WordPress site that's slow and outdated. Cares about SEO + uptime.", gender: "female" },
  ],
};

// ElevenLabs voice IDs — one stable voice per gender so the prospect's
// voice never changes mid-call.
export const VOICE_FEMALE = "EXAVITQu4vr4xnSDxMaL"; // Sarah
export const VOICE_MALE = "JBFqnCBsd6RMkjVDRZzb"; // George

export function voiceForPersona(area: PracticeArea, personaId: string | undefined): string {
  if (!personaId) return VOICE_FEMALE;
  const p = PERSONAS_BY_AREA[area]?.find((x) => x.id === personaId);
  return p?.gender === "male" ? VOICE_MALE : VOICE_FEMALE;
}

export const DURATION_OPTIONS: { value: number; label: string; desc: string }[] = [
  { value: 5, label: "5 min", desc: "Quick rep — single objection drill" },
  { value: 10, label: "10 min", desc: "Recommended — full mini-roleplay" },
  { value: 20, label: "20 min", desc: "Extended — multi-topic deep dive" },
  { value: 30, label: "30 min", desc: "Max — full mock call" },
];

type ScenarioTemplate = (topic: string) => string;

const DISCOVERY_SCENARIOS_BY_AREA: Record<PracticeArea, ScenarioTemplate[]> = {
  hubspot: [
    (t) => `We met this prospect at INBOUND last month — they swung by the SmartBug booth and mentioned they're trying to figure out ${t}.`,
    (t) => `They filled out the 'Talk to a HubSpot expert' form on the SmartBug website this week, specifically asking about ${t}.`,
    (t) => `A HubSpot sales rep introduced us — the prospect is evaluating HubSpot and the rep flagged ${t} as the area they need partner help on.`,
    (t) => `They were referred by an existing SmartBug client and want to talk through ${t} on this first call.`,
  ],
  paid_media: [
    (t) => `New franchisee just opened their location and was given Point Success as a vetted vendor by their franchisor. They want to talk through ${t} before signing on.`,
    (t) => `Franchisee booked an intro call after a corporate webinar — leads have slowed down and they're hoping ${t} is the answer.`,
    (t) => `Existing franchisor partner referred them. They've been running ads with another vendor and aren't happy with results around ${t}.`,
    (t) => `Multi-unit owner heard about us from another franchisee in the network. They want to consolidate ad spend across locations and dig into ${t}.`,
  ],
  globalia: [
    (t) => `We met this prospect at a Shopify / e-commerce meetup — they're exploring ${t} and want to see if we're a fit.`,
    (t) => `They filled out the contact form on the Globalia Digital website asking specifically about ${t}.`,
    (t) => `A partner agency referred them after they hit the limits of their current setup around ${t}.`,
    (t) => `They were referred by an existing Globalia client and want to scope ${t} on this first call.`,
  ],
};

const SERVICE_SCENARIOS_BY_AREA: Record<PracticeArea, ScenarioTemplate[]> = {
  hubspot: [
    (t) => `Existing client — they just bought a 40-hour block of HubSpot consulting hours and want to spend them on ${t}.`,
    (t) => `Retainer client of 6 months — this month's check-in is focused on ${t}: progress, blockers, and what to prioritize next sprint.`,
    (t) => `New onboarding kickoff — they signed a HubSpot implementation SOW last week and ${t} is the first workstream.`,
    (t) => `Existing retainer client — they want to expand the engagement to cover ${t} and need a plan.`,
  ],
  paid_media: [
    (t) => `Existing franchisee client — monthly check-in. Leads are flat and they want to dig into ${t} this call.`,
    (t) => `New franchisee onboarding — they signed last week, ad accounts are being built, and ${t} is the first conversation.`,
    (t) => `Long-time franchisee — quarterly performance review. ${t} is the headline topic for the next 90 days.`,
    (t) => `Multi-unit franchisee — wants to revisit budget allocation across locations and zoom in on ${t}.`,
  ],
  globalia: [
    (t) => `Existing client — they just purchased a block of dev hours and want to spend them on ${t}.`,
    (t) => `New build kickoff — they signed a SOW and ${t} is the first deliverable on the roadmap.`,
    (t) => `Retainer client of 6 months — this month's check-in is focused on ${t}: open tickets and what to ship next sprint.`,
    (t) => `Existing client — they want to scope ${t} as an add-on to their current engagement and need a plan.`,
  ],
};

export function pickScenario(area: PracticeArea, callType: CallType = "discovery", topics: string = ""): string {
  const list = (callType === "service" ? SERVICE_SCENARIOS_BY_AREA : DISCOVERY_SCENARIOS_BY_AREA)[area];
  const tpl = list[Math.floor(Math.random() * list.length)];
  const trimmed = topics.trim();
  // Use the first comma-separated topic if multiple are listed, otherwise the whole string.
  const topic = trimmed ? trimmed.split(",")[0].trim() : "their top priorities";
  return tpl(topic);
}

const FIRM_BY_AREA: Record<PracticeArea, string> = {
  hubspot: "SmartBug",
  paid_media: "Point Success Media",
  globalia: "Globalia Digital",
};

export function buildGoal(
  area: PracticeArea,
  callType: CallType,
  topics: string,
  durationMin: number = 10,
): string {
  const firm = FIRM_BY_AREA[area];
  const topicsTrimmed = topics.trim();
  const focus = topicsTrimmed ? ` Focus on ${topicsTrimmed}.` : "";

  if (callType === "discovery") {
    if (durationMin <= 5) {
      return `Quick discovery rep (${durationMin} min): open with a clear agenda, surface ONE core pain point, and lock in a concrete next step.${focus} Don't try to qualify everything — pick the highest-value thread and go deep.`;
    }
    if (durationMin <= 10) {
      return `Discovery mini-roleplay (${durationMin} min): set a brief agenda, uncover the prospect's top 1–2 pains, do a light qualification (budget OR timeline OR decision process — pick what matters most), and earn a clear next step.${focus}`;
    }
    if (durationMin <= 20) {
      return `Extended discovery (${durationMin} min): set the agenda, uncover business pain, qualify fit (budget, timeline, decision process), demonstrate how ${firm} solves it, and lock a next step.${focus}`;
    }
    return `Full discovery call (${durationMin} min): set the agenda, deeply uncover business pain, fully qualify fit (budget, timeline, decision process, success criteria), demonstrate how ${firm} can solve their problem, handle objections, and earn mutual agreement on next steps.${focus}`;
  }

  // service / onboarding kickoff
  if (durationMin <= 5) {
    return `Quick kickoff rep (${durationMin} min): confirm the #1 goal, set one clear expectation, and agree on the immediate next step.${focus}`;
  }
  if (durationMin <= 10) {
    return `Kickoff mini-roleplay (${durationMin} min): align on top goals, confirm scope at a high level, and set the next 1–2 weeks.${focus}`;
  }
  if (durationMin <= 20) {
    return `Extended kickoff (${durationMin} min): align on goals, confirm scope, map key stakeholders, set timeline expectations, and gather what you need to begin.${focus}`;
  }
  return `Full onboarding kickoff (${durationMin} min): align on goals, confirm scope in detail, map all stakeholders, set timeline and communication expectations, gather requirements, and leave the client confident in the roadmap and the next 2 weeks.${focus}`;
}

// ============================================================
// TOUGH CLIENT CONVERSATIONS
// 14 buckets, each with 2–4 hidden variants. The user picks the
// bucket; a variant is rolled at session start so the same bucket
// feels fresh on repeat practice. `internalPlaybook` is NEVER
// shown in the UI — only sent to the model server-side.
// ============================================================

export interface ToughVariant {
  id: string;
  label: string;
  scenario: string; // 1–2 sentence backstory shown as config.scenario
  internalPlaybook: string; // hidden coach-side resolution map
}

export interface ToughSituation {
  id: string;
  label: string;
  subtitle: string;
  variants: ToughVariant[];
}

export interface LibrarySituation {
  id: string;
  label: string;
  subtitle: string;
  rubric: Rubric;
  variants: ToughVariant[];
}

const PB = (lines: string[]) => lines.map((l) => `- ${l}`).join("\n");


export const TOUGH_SITUATIONS: ToughSituation[] = [
  {
    id: "past_due_payment",
    label: "Past-due payment",
    subtitle: "Money conversation",
    variants: [
      {
        id: "30_polite_evasive",
        label: "30 days late, polite but evasive",
        scenario: "They've been a client for 8 months. Their last invoice is 32 days past due. They're cordial but keep deflecting when accounting comes up.",
        internalPlaybook: PB([
          "Stay friendly on the surface; deflect with 'AP is slow this month' / 'I'll check with finance'",
          "Soften only when the consultant names the specific invoice + amount + due date",
          "Good resolution: a concrete pay date this week AND clear ack of the policy going forward",
          "Trap to test: consultant being apologetic about asking; reward firm-but-warm framing",
        ]),
      },
      {
        id: "60_going_dark",
        label: "60+ days late, going dark",
        scenario: "They're 65 days past due on a $14k invoice and have stopped responding to email. The consultant finally got them on the phone.",
        internalPlaybook: PB([
          "Open guarded, mildly annoyed at being 'cornered'",
          "Real reason: cash flow crunch, but you won't volunteer it without empathy first",
          "Good resolution: payment plan with first installment in 7 days + work pause if not honored",
          "Trap: consultant threatening collections too early; reward acknowledgement before pressure",
        ]),
      },
      {
        id: "chronic_late",
        label: "Chronic late payer",
        scenario: "Every invoice for the last 6 months has been 20–40 days late. They think it's normal. The consultant is here to reset terms.",
        internalPlaybook: PB([
          "You don't see a problem ('we always pay eventually')",
          "Push back on auto-pay and shorter terms",
          "Good resolution: written agreement on net-15 + auto-pay or a credit hold policy",
          "Trap: vague 'try to do better' close — reward consultant locking specifics",
        ]),
      },
      {
        id: "disputing_invoice",
        label: "Disputing the invoice",
        scenario: "They're refusing to pay last month's invoice — they say the hours billed don't match what was delivered.",
        internalPlaybook: PB([
          "Lead with the dispute, not the relationship",
          "Real complaint underneath: you didn't feel kept in the loop",
          "Good resolution: walk the line items, fix any genuine errors, secure payment on the rest with a comms cadence going forward",
          "Trap: caving on the whole invoice to keep peace; reward defending legitimate work",
        ]),
      },
    ],
  },
  {
    id: "missed_deadline",
    label: "Missed deadline",
    subtitle: "You're behind",
    variants: [
      {
        id: "hard_launch",
        label: "Missed a hard launch date",
        scenario: "The campaign was supposed to go live yesterday. It didn't. They're the client and they just found out.",
        internalPlaybook: PB([
          "Open hot — frustrated, possibly catastrophizing impact",
          "Calm down only after a clean ownership statement (no excuses) + a real recovery plan",
          "Good resolution: ownership, root cause in one sentence, new firm date, what changes structurally",
          "Trap: consultant blaming team / vendors / the client themselves",
        ]),
      },
      {
        id: "slipped_milestone",
        label: "Slipped milestone, you found out",
        scenario: "They discovered through a status report (not a heads-up call) that a milestone slipped 2 weeks. They feel out of the loop.",
        internalPlaybook: PB([
          "The miss matters less than the silence — that's the real wound",
          "Push on 'why didn't you tell me'",
          "Good resolution: acknowledge the comms failure first, then the timeline fix, then a new comms cadence",
          "Trap: jumping straight to the new plan without naming the trust hit",
        ]),
      },
      {
        id: "cascading",
        label: "Cascading delays",
        scenario: "The third deadline in a row is at risk. Their patience is running out.",
        internalPlaybook: PB([
          "Skeptical of any new promise; reference the prior misses",
          "Want to know what is structurally different this time",
          "Good resolution: smaller, verifiable next checkpoint + named accountable owner + escalation path",
          "Trap: another optimistic timeline with no system change",
        ]),
      },
      {
        id: "ask_extension",
        label: "Asking for an extension",
        scenario: "The consultant needs to ask them for more time on a deliverable that hasn't slipped publicly yet.",
        internalPlaybook: PB([
          "Initially neutral — depends entirely on how they ask",
          "React badly to vague reasons; respond well to specifics + trade-offs",
          "Good resolution: clear new date, what changes, what you'd like the client to choose between",
          "Trap: open-ended 'a few more weeks'",
        ]),
      },
    ],
  },
  {
    id: "termination_signal",
    label: "Termination signal",
    subtitle: "They're leaving",
    variants: [
      {
        id: "evaluating_others",
        label: "'We're evaluating other agencies'",
        scenario: "They drop, mid-call, that they're talking to two other firms about taking over the work.",
        internalPlaybook: PB([
          "Don't reveal the real driver until asked thoughtfully",
          "Real driver: a specific unmet expectation, not price",
          "Good resolution: consultant gets to the actual issue, proposes a concrete fix with timeline, doesn't beg",
          "Trap: discount-as-defense; reward diagnosis-first",
        ]),
      },
      {
        id: "non_renewal",
        label: "End-of-contract non-renewal",
        scenario: "Their contract ends in 30 days. They've decided not to renew but haven't told the firm yet.",
        internalPlaybook: PB([
          "Polite but firm; decision is mostly made",
          "Will share real reasons if the consultant is calm and curious",
          "Good resolution: honest debrief, clean handoff plan, door left open — not a save attempt",
          "Trap: hard-sell to reverse the decision",
        ]),
      },
      {
        id: "sudden_cancel",
        label: "Sudden cancellation request",
        scenario: "They're calling to cancel effective immediately. They won't say exactly why on the call.",
        internalPlaybook: PB([
          "Closed off, transactional",
          "Real reason: leadership change above you, not the work",
          "Good resolution: respect the decision, get to the real reason, protect the relationship and final invoicing",
          "Trap: making it about the consultant's hurt feelings",
        ]),
      },
      {
        id: "soft_think",
        label: "Soft 'we need to think about this'",
        scenario: "They're hedging on continuing past Q1 — not a hard no, but the energy has shifted.",
        internalPlaybook: PB([
          "Vague on purpose; testing whether they'll dig",
          "Underlying issue: you don't see clear progress vs. cost",
          "Good resolution: surface the specific concern, agree on a 30-day proof checkpoint",
          "Trap: accepting the vague answer and moving on",
        ]),
      },
    ],
  },
  {
    id: "rate_increase",
    label: "Rate increase",
    subtitle: "Telling them prices are going up",
    variants: [
      {
        id: "annual_happy",
        label: "Annual lift on a happy client",
        scenario: "Standard 7% annual increase at renewal. They're a happy client but they weren't expecting it.",
        internalPlaybook: PB([
          "Mild surprise, not anger",
          "Want to understand why and what you're getting",
          "Good resolution: clear rationale, what's improved, simple acceptance",
          "Trap: over-justifying / sounding apologetic",
        ]),
      },
      {
        id: "mid_contract",
        label: "Mid-contract increase needed",
        scenario: "They're being told costs are going up before their contract is up for renewal. This feels off to them.",
        internalPlaybook: PB([
          "Push back on the timing; reference the contract",
          "Open to a delayed effective date or a concession",
          "Good resolution: honest reason, options (effective at renewal vs. now with X added), respect the contract",
          "Trap: framing it as non-negotiable when it should be a conversation",
        ]),
      },
      {
        id: "renewal_new_pricing",
        label: "New pricing applied at renewal",
        scenario: "They're a long-time client being moved to the firm's new (higher) standard pricing model.",
        internalPlaybook: PB([
          "Feel like loyalty isn't being rewarded",
          "Want to understand the structural change, not just the number",
          "Good resolution: explain the model change, offer a transition glidepath",
          "Trap: treating it as a pure number conversation",
        ]),
      },
      {
        id: "price_sensitive",
        label: "Raising rate on a price-sensitive client",
        scenario: "Budget is genuinely tight on their side. The consultant still has to deliver a rate increase.",
        internalPlaybook: PB([
          "Real budget pressure — not posturing",
          "Open to scope adjustment to keep total spend close to flat",
          "Good resolution: rate goes up, scope is right-sized, total cost lands somewhere honest",
          "Trap: caving on rate to keep the logo",
        ]),
      },
    ],
  },
  {
    id: "team_change",
    label: "Team change",
    subtitle: "Their favorite person left",
    variants: [
      {
        id: "reassigning_favorite",
        label: "Reassigning their favorite consultant",
        scenario: "Their trusted day-to-day lead is being moved to a new account. The consultant on this call has to deliver the news.",
        internalPlaybook: PB([
          "Initial reaction: visible disappointment, mild panic",
          "Want to know who, why, and how continuity is protected",
          "Good resolution: warm intro to the new lead, transition plan, your trusted lead stays in for X weeks",
          "Trap: trying to talk you out of caring",
        ]),
      },
      {
        id: "pm_left",
        label: "PM left the firm",
        scenario: "Their project manager quit. They only learned about it from an out-of-office reply.",
        internalPlaybook: PB([
          "Annoyed at the comms failure as much as the change",
          "Worried about institutional knowledge",
          "Good resolution: acknowledge the bad comms, name the new PM, share a knowledge-transfer plan",
          "Trap: glossing over the fact you found out the wrong way",
        ]),
      },
      {
        id: "team_shuffle",
        label: "Seasonal account team shuffle",
        scenario: "Half their team is rotating off as part of an annual reorg. They feel like they're starting over.",
        internalPlaybook: PB([
          "Skeptical of 'this is normal' framing",
          "Want concrete protection of momentum",
          "Good resolution: overlap period, written context handoff, you meet new team before they take over",
          "Trap: treating it as routine when it doesn't feel routine to you",
        ]),
      },
      {
        id: "senior_to_junior",
        label: "Senior swap to junior",
        scenario: "A senior strategist is being replaced by someone more junior on their account.",
        internalPlaybook: PB([
          "Read this as a downgrade",
          "Worry it's because you're 'not important enough'",
          "Good resolution: explain the structure (who oversees the junior), clear escalation path, protect senior involvement on key moments",
          "Trap: pretending nothing changed",
        ]),
      },
    ],
  },
  {
    id: "bad_results",
    label: "Bad results",
    subtitle: "KPIs are down. Own it",
    variants: [
      {
        id: "campaign_tanked",
        label: "Paid campaign tanked",
        scenario: "Last month's campaign underperformed badly — CPL doubled, ROAS halved. They want answers.",
        internalPlaybook: PB([
          "Open frustrated, want a culprit",
          "Calm down with honest diagnosis + plan, not blame",
          "Good resolution: ownership, what changed, what you'll test, clear timeline to recover",
          "Trap: blaming the algorithm / the market / the creative the client approved",
        ]),
      },
      {
        id: "pipeline_didnt",
        label: "Pipeline didn't materialize",
        scenario: "They spent 2 quarters investing in demand-gen and the pipeline impact isn't showing up.",
        internalPlaybook: PB([
          "Patient but losing faith",
          "Want to know if this is fixable or the wrong strategy",
          "Good resolution: honest read on the strategy, what to keep / cut / change, decision point in 30 days",
          "Trap: another 'just give it more time'",
        ]),
      },
      {
        id: "attribution_worse",
        label: "Attribution looks worse than expected",
        scenario: "After a tracking overhaul, the numbers now show the campaigns were never as effective as the old reports claimed.",
        internalPlaybook: PB([
          "Feel misled by prior reporting",
          "Want to know if the work was worth it at all",
          "Good resolution: name the old reporting flaw plainly, anchor on the new baseline, plan to drive the new number up",
          "Trap: defending the old numbers",
        ]),
      },
      {
        id: "wrong_kpi",
        label: "Wrong KPI was being optimized",
        scenario: "They realize together the team has been optimizing for a metric that doesn't drive their business.",
        internalPlaybook: PB([
          "Frustrated this wasn't caught earlier",
          "Want a reset, not a rationalization",
          "Good resolution: clean acknowledgement, agree the new north-star metric, plan to re-orient inside 2 weeks",
          "Trap: trying to salvage the old metric",
        ]),
      },
    ],
  },
  {
    id: "firing_client",
    label: "Firing the client",
    subtitle: "You're leaving them",
    variants: [
      {
        id: "chronic_late_fire",
        label: "Chronic late payer being let go",
        scenario: "After repeated late payments and broken promises on payment plans, the firm is ending the relationship.",
        internalPlaybook: PB([
          "Surprised it's gotten this far",
          "Try to negotiate a last-chance arrangement",
          "Good resolution: clear final invoice plan, defined wind-down period, professional handoff, no relitigation",
          "Trap: getting drawn into another payment plan",
        ]),
      },
      {
        id: "scope_not_viable",
        label: "Scope/relationship not viable",
        scenario: "The work has drifted into something the firm can't profitably or competently deliver. They have to end it cleanly.",
        internalPlaybook: PB([
          "Hurt — read this as rejection",
          "Want a clear reason, not a corporate one",
          "Good resolution: honest, kind, specific reason; concrete handoff plan; recommendation of better-fit firms",
          "Trap: vague 'it's not you it's us' framing",
        ]),
      },
      {
        id: "abusive",
        label: "Culture / abusive behavior",
        scenario: "A specific stakeholder has been verbally abusive to their team. The firm is ending the engagement.",
        internalPlaybook: PB([
          "Defensive about the behavior, may minimize it",
          "Want to argue specific incidents",
          "Good resolution: name the standard, name 1–2 examples, immediate end, dignified offboarding",
          "Trap: getting pulled into he-said-she-said",
        ]),
      },
      {
        id: "strategic_refocus",
        label: "Strategic refocus away from their segment",
        scenario: "The firm is exiting their industry / size segment. The work is fine — the fit isn't.",
        internalPlaybook: PB([
          "Confused, want to know if this is really about them",
          "Open to a thoughtful handoff",
          "Good resolution: honest strategic context, generous transition window, warm intros to alternatives",
          "Trap: making the client feel like collateral damage",
        ]),
      },
    ],
  },
  {
    id: "discount_request",
    label: "Discount / fee reduction",
    subtitle: "They want to pay less",
    variants: [
      {
        id: "mid_engagement",
        label: "Asking for a discount mid-engagement",
        scenario: "They're asking for 15% off the next 3 months. Nothing has gone wrong — they just want a better deal.",
        internalPlaybook: PB([
          "Frame it as 'just asking'",
          "Will accept a no if the consultant doesn't flinch",
          "Good resolution: hold the rate, optionally trade scope for cost, no guilt",
          "Trap: caving without a trade",
        ]),
      },
      {
        id: "cut_hours",
        label: "Wants to cut retainer hours",
        scenario: "They want to drop their retainer from 40 hrs to 20 hrs/month, keep 'the same outcomes.'",
        internalPlaybook: PB([
          "Don't accept that fewer hours = fewer deliverables",
          "Want the consultant to make it work",
          "Good resolution: clear before/after scope, what gets cut, written confirmation",
          "Trap: agreeing to same scope at half hours",
        ]),
      },
      {
        id: "pull_in_house",
        label: "Threatening to pull work in-house",
        scenario: "They're floating bringing the work in-house unless the firm matches the cost of one FTE.",
        internalPlaybook: PB([
          "Half-bluff — you haven't actually scoped the in-house cost",
          "Open to options if the consultant engages seriously",
          "Good resolution: walk through real total cost of in-house, propose hybrid or repositioned scope",
          "Trap: caving to the bluff or dismissing it",
        ]),
      },
      {
        id: "match_quote",
        label: "'Match this other agency's quote'",
        scenario: "They have a competing proposal at 30% lower cost and want this firm to match it to keep the work.",
        internalPlaybook: PB([
          "Genuinely have the quote",
          "Don't actually want to switch — you trust this team",
          "Good resolution: surface what's different in the two scopes, hold value, optionally adjust scope not rate",
          "Trap: matching the price",
        ]),
      },
    ],
  },
  {
    id: "feedback_loop",
    label: "Difficult feedback loop",
    subtitle: "Endless or vague revisions",
    variants: [
      {
        id: "make_it_pop",
        label: "'Make it pop' / vague feedback",
        scenario: "They keep sending back work with vague feedback like 'feels off' / 'make it pop.' They can't articulate why.",
        internalPlaybook: PB([
          "Genuinely struggle to put words to it",
          "Respond well to structured questions, not 'what do you mean?'",
          "Good resolution: consultant runs you through a structured feedback frame and lands clear direction",
          "Trap: another guess-and-revise round",
        ]),
      },
      {
        id: "contradictory",
        label: "Contradictory feedback across stakeholders",
        scenario: "Two of their stakeholders gave directly opposite feedback. They forwarded both to the consultant.",
        internalPlaybook: PB([
          "Want the consultant to solve the politics for you",
          "Will resist a meeting that 'wastes' executive time",
          "Good resolution: consultant proposes a tie-breaker process or single decision-maker; doesn't try to please everyone",
          "Trap: silently averaging the two and shipping",
        ]),
      },
      {
        id: "nitpicking",
        label: "Nitpicking deliverables",
        scenario: "They're on round 7 of revisions on a single deliverable, focused on tiny details that don't change outcomes.",
        internalPlaybook: PB([
          "Feel responsible for 'getting it right'",
          "Don't see the cost of the loop",
          "Good resolution: name the pattern with care, cap remaining rounds, agree on what 'done' looks like",
          "Trap: burning more hours to keep the peace",
        ]),
      },
      {
        id: "post_signoff",
        label: "Changing direction after sign-off",
        scenario: "They signed off on the strategy 3 weeks ago and are now asking for a substantially different direction.",
        internalPlaybook: PB([
          "Don't see the change as a change",
          "Push back on the idea that this is a new SOW",
          "Good resolution: replay the sign-off, frame the new direction as a change order with hours/timeline impact",
          "Trap: absorbing the rework",
        ]),
      },
    ],
  },
  {
    id: "ghosting",
    label: "Slow approvals / ghosting",
    subtitle: "They're blocking the work",
    variants: [
      {
        id: "stuck_signoff",
        label: "Sign-off stuck for weeks",
        scenario: "A deliverable has been waiting 3 weeks for their sign-off. The consultant is calling to unstick it.",
        internalPlaybook: PB([
          "Slightly defensive ('I've been swamped')",
          "Won't commit to a date without prompting",
          "Good resolution: a specific sign-off date, a fallback (auto-approval / delegate), comms cadence",
          "Trap: 'I'll get to it soon'",
        ]),
      },
      {
        id: "gone_dark",
        label: "Client gone dark",
        scenario: "They haven't responded to anything in 10 days. The consultant finally got them on a call.",
        internalPlaybook: PB([
          "Real reason: another priority has eaten you alive",
          "Don't see how it's affecting the work",
          "Good resolution: name the impact, agree on a lightweight comms plan that survives crunch periods",
          "Trap: pretending the silence didn't matter",
        ]),
      },
      {
        id: "single_exec",
        label: "Approvals bottlenecked on one exec",
        scenario: "Every approval routes through one executive who is impossible to reach. Work is stalling.",
        internalPlaybook: PB([
          "Protective of the exec ('that's how she works')",
          "Resist routing around them",
          "Good resolution: agree on what classes of decisions can be made without the exec + a regular standing slot",
          "Trap: accepting the bottleneck as fixed",
        ]),
      },
      {
        id: "reappear_no_slip",
        label: "Reappear and expect no slippage",
        scenario: "After 2 weeks of silence, they're back and asking why nothing has shipped while they were gone.",
        internalPlaybook: PB([
          "Genuinely don't connect your silence to the delay",
          "Want a fix, not a lecture",
          "Good resolution: short, calm replay of the dependency, new realistic date, agreed escalation if you go dark again",
          "Trap: scolding vs. resetting",
        ]),
      },
    ],
  },
  {
    id: "new_stakeholder",
    label: "New stakeholder / new boss",
    subtitle: "Relationship reset",
    variants: [
      {
        id: "new_cmo",
        label: "New CMO wants to re-evaluate everything",
        scenario: "A new CMO joined last month and is reviewing all agency relationships. They've been told this call is 'just a chat.'",
        internalPlaybook: PB([
          "Friendly, but evaluating",
          "Want a clear story of value to date and forward plan",
          "Good resolution: confident replay of impact, listen to the new agenda, propose how the work maps to it",
          "Trap: defensive list of past work",
        ]),
      },
      {
        id: "champion_left",
        label: "Champion left, replacement is skeptical",
        scenario: "Their internal champion is gone. Their replacement is openly skeptical of agency spend in general.",
        internalPlaybook: PB([
          "Direct, slightly cold",
          "Will respect specifics and numbers; suspicious of relationship language",
          "Good resolution: business-case framing, clear ROI, propose a short trial / checkpoint",
          "Trap: leaning on the prior relationship",
        ]),
      },
      {
        id: "surprise_exec",
        label: "Surprise exec joins the call",
        scenario: "An exec the consultant has never met has joined the standing call unannounced and is asking pointed questions.",
        internalPlaybook: PB([
          "Brief, no pleasantries; testing competence",
          "Want to know what value, what risk, what's next",
          "Good resolution: confident 60-second context, then direct answers, propose a follow-up just with the exec",
          "Trap: rambling or deferring everything to a follow-up",
        ]),
      },
      {
        id: "acquired",
        label: "Acquired company, new leadership",
        scenario: "Their company was just acquired. New parent leadership is on the call to vet whether to keep the engagement.",
        internalPlaybook: PB([
          "Polite but transactional",
          "Want to understand fit with the new parent's playbook",
          "Good resolution: clear story of impact, openness to scope changes, request a working session post-integration",
          "Trap: assuming nothing has changed",
        ]),
      },
    ],
  },
  {
    id: "fire_drill",
    label: "Emergency / fire-drill request",
    subtitle: "Last-minute pressure",
    variants: [
      {
        id: "by_monday",
        label: "'We need this by Monday'",
        scenario: "It's Thursday afternoon. They're asking for a substantial deliverable by Monday morning.",
        internalPlaybook: PB([
          "Apologetic but insistent",
          "Real underlying driver: a board / exec ask you can't push back on",
          "Good resolution: feasibility check, explicit trade-offs (what slips), price impact if it's outside scope, written confirmation",
          "Trap: agreeing without naming the cost",
        ]),
      },
      {
        id: "weekend_ask",
        label: "Weekend / after-hours ask",
        scenario: "They're texting on a Saturday morning expecting work to start before Monday.",
        internalPlaybook: PB([
          "Don't see it as crossing a line",
          "Will respect a calm boundary if the response is fast",
          "Good resolution: acknowledge, clarify true urgency, set the policy for after-hours going forward",
          "Trap: silent compliance",
        ]),
      },
      {
        id: "urgent_pivot",
        label: "Urgent pivot mid-sprint",
        scenario: "They want to drop everything in flight and pivot the whole sprint to a new urgent priority.",
        internalPlaybook: PB([
          "Justified urgency, but you haven't thought about what gets dropped",
          "Open to trade-offs once made explicit",
          "Good resolution: written list of what pauses, what moves, what the new dates are",
          "Trap: layering the pivot on top of existing work",
        ]),
      },
      {
        id: "ceo_panic",
        label: "CEO-driven panic request",
        scenario: "Their CEO saw something today and demanded a response by EOD. They're delivering the panic to the consultant.",
        internalPlaybook: PB([
          "Adopting the CEO's urgency without filtering",
          "Will calm down if the consultant calmly reframes the actual ask",
          "Good resolution: separate 'what the CEO actually needs' from 'how it was asked,' deliver a smaller right-sized response today + plan for tomorrow",
          "Trap: matching the panic energy",
        ]),
      },
    ],
  },
  {
    id: "blame_shifting",
    label: "Blame-shifting",
    subtitle: "They missed it. They blame you",
    variants: [
      {
        id: "late_approval",
        label: "Their late approval, blamed on you",
        scenario: "They approved the asset 8 days late and the launch slipped. They're framing the slippage as the firm's fault.",
        internalPlaybook: PB([
          "Genuinely don't see your role in it",
          "Will soften with calm receipts (timestamps), not arguments",
          "Good resolution: walk the timeline together without heat, agree on a clearer SLA both ways",
          "Trap: a defensive 'you approved late' opener",
        ]),
      },
      {
        id: "bad_data",
        label: "Their bad data, blamed on your reporting",
        scenario: "The numbers in the report are off because they sent the wrong source data. They're blaming the firm's reporting.",
        internalPlaybook: PB([
          "Defensive about your data hygiene",
          "Open to a process fix once the source is acknowledged",
          "Good resolution: name the source issue without finger-pointing, propose a validation step in the future",
          "Trap: rebuilding the report without naming the cause",
        ]),
      },
      {
        id: "stakeholder_noshow",
        label: "Their stakeholder didn't show, your fault somehow",
        scenario: "A key stakeholder on their side missed the workshop. They're blaming the consultant for not 'doing enough' to ensure attendance.",
        internalPlaybook: PB([
          "Won't accept that internal attendance is your responsibility",
          "Will respect a calm restatement of who owns what",
          "Good resolution: name the ownership clearly and kindly, propose the rescheduling cost / process",
          "Trap: apologizing to keep peace",
        ]),
      },
      {
        id: "escalation",
        label: "Escalating to your boss over their own miss",
        scenario: "They've gone over the consultant's head to their leadership about a slip they actually caused.",
        internalPlaybook: PB([
          "Convinced you're in the right",
          "Surprised the consultant is addressing the escalation directly",
          "Good resolution: calm, factual replay; name that future issues should come to them first; preserve the relationship",
          "Trap: getting emotional about being escalated on",
        ]),
      },
    ],
  },
];

export function getToughSituation(id: string | undefined): ToughSituation | undefined {
  return TOUGH_SITUATIONS.find((s) => s.id === id);
}

export function pickToughVariant(situationId: string): ToughVariant | undefined {
  const sit = getToughSituation(situationId);
  if (!sit) return undefined;
  return sit.variants[Math.floor(Math.random() * sit.variants.length)];
}

export function buildToughGoal(
  situationId: string,
  variantLabel: string,
  durationMin: number,
): string {
  const sit = getToughSituation(situationId);
  const label = sit?.label ?? "tough conversation";
  return `Tough client conversation (${durationMin} min) — ${label}: ${variantLabel}. Lead with empathy and acknowledgement, then hold a firm boundary, offer concrete options, protect scope and money, and land a specific next step. Do not over-apologize, do not cave on the substance, and do not let the conversation end without a concrete commitment.`;
}