import { create } from "zustand";

export type Difficulty = "easy" | "realistic" | "hard";
export type CallType = "discovery" | "service";

export interface SimConfig {
  topics: string;
  difficulty: Difficulty;
  persona: string;
  callType: CallType;
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

export const PERSONAS = [
  {
    id: "skeptical-cfo",
    name: "Marcus Vale",
    role: "Skeptical CFO",
    blurb: "Wants ROI numbers. Allergic to buzzwords.",
  },
  {
    id: "busy-marketing",
    name: "Priya Shah",
    role: "Busy Marketing Manager",
    blurb: "Time-poor, juggling 3 campaigns. Cares about speed.",
  },
  {
    id: "revops",
    name: "Jordan Kim",
    role: "Curious RevOps Lead",
    blurb: "Loves architecture. Asks about workflows and data.",
  },
  {
    id: "tech-admin",
    name: "Sam Reyes",
    role: "Technical HubSpot Admin",
    blurb: "Knows the product. Will catch any inaccuracy.",
  },
] as const;