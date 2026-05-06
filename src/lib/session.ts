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

const FIRM_BY_AREA: Record<PracticeArea, string> = {
  hubspot: "SmartBug",
  paid_media: "Point Success Media",
  globalia: "Globalia Digital",
};

export function buildGoal(
  area: PracticeArea,
  callType: CallType,
  topics: string,
): string {
  const firm = FIRM_BY_AREA[area];
  const topicsTrimmed = topics.trim();
  if (callType === "discovery") {
    return `Run a discovery call: uncover the prospect's business pain, qualify fit (budget, timeline, decision process), and earn a clear next step (proposal or follow-up meeting). Demonstrate how ${firm} can solve their problem${topicsTrimmed ? ` — especially around ${topicsTrimmed}` : ""}. End the call with mutual agreement on what happens next.`;
  }
  return `Run a service / onboarding kickoff: align on goals, confirm scope, map stakeholders, set timeline expectations, and gather what you need to begin work${topicsTrimmed ? ` (focus areas: ${topicsTrimmed})` : ""}. End the call with the client feeling confident in the roadmap and clear on the next 2 weeks.`;
}