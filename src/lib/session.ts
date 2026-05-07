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
    defaultTopics: "AEO Brand Visibility Dashboard, Breeze Prospecting Agents, CRM-powered prompt suggestions, Service Hub workflows",
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
}>> = {
  hubspot: [
    { id: "skeptical-cfo", name: "Margaret Vale", role: "Skeptical CFO", blurb: "Wants ROI numbers. Allergic to buzzwords." },
    { id: "busy-marketing", name: "Priya Shah", role: "Busy Marketing Manager", blurb: "Time-poor, juggling 3 campaigns. Cares about speed." },
    { id: "revops", name: "Jordan Kim", role: "Curious RevOps Lead", blurb: "Loves architecture. Asks about workflows and data." },
    { id: "tech-admin", name: "Sam Reyes", role: "Technical HubSpot Admin", blurb: "Knows the product. Will catch any inaccuracy." },
  ],
  paid_media: [
    { id: "ecom-cmo", name: "Dana Wright", role: "DTC E-com CMO", blurb: "Cares about ROAS, CAC, and creative velocity. Hates vanity metrics." },
    { id: "b2b-demand", name: "Elena Park", role: "B2B Demand-Gen Director", blurb: "LinkedIn-heavy, pipeline-obsessed, wants attribution clarity." },
    { id: "growth-founder", name: "Tessa Rivera", role: "Series-B Growth Founder", blurb: "Scaling fast, skeptical of agencies, wants proof of channel mix." },
    { id: "performance-analyst", name: "Riya Mehta", role: "Performance Analyst", blurb: "Will pressure-test MMM, MTA, GA4 setup, and incrementality testing." },
  ],
  globalia: [
    { id: "ecom-owner", name: "Carla Núñez", role: "Shopify Store Owner", blurb: "$3M GMV, conversion-obsessed, weighing headless re-platform." },
    { id: "ai-curious-coo", name: "Mira Liu", role: "Mid-market COO", blurb: "Wants a custom AI agent for ops. Worried about hallucinations and ROI." },
    { id: "product-pm", name: "Aisha Brown", role: "Product Manager", blurb: "Scoping a custom web/mobile app build. Asks about stack, timeline, QA." },
    { id: "wp-marketer", name: "Jen Becker", role: "Marketing Lead", blurb: "Owns a WordPress site that's slow and outdated. Cares about SEO + uptime." },
  ],
};

export const DURATION_OPTIONS: { value: number; label: string; desc: string }[] = [
  { value: 5, label: "5 min", desc: "Quick rep — single objection drill" },
  { value: 10, label: "10 min", desc: "Recommended — full mini-roleplay" },
  { value: 20, label: "20 min", desc: "Extended — multi-topic deep dive" },
  { value: 30, label: "30 min", desc: "Max — full mock call" },
];

const SCENARIOS_BY_AREA: Record<PracticeArea, string[]> = {
  hubspot: [
    "We met this prospect at INBOUND last month — they swung by the SmartBug booth and gave us their card.",
    "They filled out the 'Talk to a HubSpot expert' form on the SmartBug website earlier this week.",
    "A HubSpot sales rep introduced us — the prospect is evaluating HubSpot and the rep flagged them as a great fit for partner help.",
    "They were referred by an existing SmartBug client who's seen real ROI from their HubSpot implementation.",
  ],
  paid_media: [
    "We met this prospect at a digital marketing conference — they stopped by the Point Success Media booth.",
    "They filled out the 'Get a paid media audit' form on the Point Success Media website.",
    "A HubSpot rep introduced us — the prospect uses HubSpot and asked for a paid media partner recommendation.",
    "They were referred by an existing Point Success Media client who's seen strong ROAS lift.",
  ],
  globalia: [
    "We met this prospect at a Shopify / e-commerce meetup — they asked about a re-platform.",
    "They filled out the contact form on the Globalia Digital website.",
    "A partner agency referred them after hitting the limits of their current setup.",
    "They were referred by an existing Globalia client who recommended us for their next build.",
  ],
};

export function pickScenario(area: PracticeArea): string {
  const list = SCENARIOS_BY_AREA[area];
  return list[Math.floor(Math.random() * list.length)];
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