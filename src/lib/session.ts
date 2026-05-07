import { create } from "zustand";

export type Difficulty = "easy" | "realistic" | "hard";
export type CallType = "discovery" | "service";
export type PracticeArea = "hubspot" | "paid_media" | "globalia";

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
    tagline: "Paid search, paid social, programmatic, retail media, YouTube/CTV, measurement & analytics, creative strategy, landing-page CRO.",
    defaultTopics: "Google Ads (Search/PMax), Meta Ads, LinkedIn Ads, programmatic display, retail media, YouTube & CTV, MMM vs MTA, GA4 / server-side tracking, landing page CRO",
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
    { id: "revops", name: "Jordan Kim", role: "Curious RevOps Lead", blurb: "Loves architecture. Asks about workflows and data.", gender: "female" },
    { id: "tech-admin", name: "Sam Reyes", role: "Technical HubSpot Admin", blurb: "Knows the product. Will catch any inaccuracy.", gender: "male" },
  ],
  paid_media: [
    { id: "ecom-cmo", name: "Dana Wright", role: "DTC E-com CMO", blurb: "Cares about ROAS, CAC, and creative velocity. Hates vanity metrics.", gender: "female" },
    { id: "b2b-demand", name: "Elena Park", role: "B2B Demand-Gen Director", blurb: "LinkedIn-heavy, pipeline-obsessed, wants attribution clarity.", gender: "female" },
    { id: "growth-founder", name: "Tessa Rivera", role: "Series-B Growth Founder", blurb: "Scaling fast, skeptical of agencies, wants proof of channel mix.", gender: "female" },
    { id: "performance-analyst", name: "Riya Mehta", role: "Performance Analyst", blurb: "Will pressure-test MMM, MTA, GA4 setup, and incrementality testing.", gender: "female" },
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
    (t) => `We met this prospect at a digital marketing conference — they stopped by the Point Success Media booth and asked about ${t}.`,
    (t) => `They filled out the 'Get a paid media audit' form on the Point Success Media website, calling out ${t} as their main concern.`,
    (t) => `A HubSpot rep introduced us — the prospect uses HubSpot and wants a paid media partner who can help with ${t}.`,
    (t) => `They were referred by an existing Point Success Media client and the conversation is centered on ${t}.`,
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
    (t) => `Existing client — they just renewed their quarterly retainer and want to revisit ${t} for the next 90 days.`,
    (t) => `New client kickoff — SOW signed for paid media management, and ${t} is the headline focus for onboarding.`,
    (t) => `Retainer client of 6 months — this month's performance review zooms in on ${t}: what's working, what to change.`,
    (t) => `Existing client — they bought a block of strategy hours specifically to plan ${t} together.`,
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