import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SimConfig {
  topics: string;
  difficulty: "easy" | "realistic" | "hard";
  persona: string;
  callType: "discovery" | "service";
  practiceArea: "hubspot" | "paid_media" | "globalia";
  durationMin: number;
  goal: string;
  consultantName?: string;
}

interface Timing {
  elapsedMin: number;
  remainingMin: number;
  durationMin: number;
  phase: "open" | "mid" | "closing" | "wrap";
}

const AREA_CONTEXT: Record<SimConfig["practiceArea"], { firm: string; domain: string; knowledge: string }> = {
  hubspot: {
    firm: "SmartBug, an Elite HubSpot Solutions Partner",
    domain: "HubSpot consulting (discovery & service calls)",
    knowledge:
      "Use up-to-date 2026 HubSpot product knowledge: AEO Brand Visibility, Breeze AI agents, Smart CRM, Marketing/Sales/Service/Content/Operations Hubs, workflows, custom objects, reporting, Breeze Intelligence, integrations.",
  },
  paid_media: {
    firm: "Point Success Media (paid media division of SmartBug)",
    domain: "paid media strategy & execution (https://www.pointsuccessmedia.com/solutions-overview)",
    knowledge:
      "Service lines include: Paid Search (Google Ads, Microsoft Ads, Performance Max), Paid Social (Meta, LinkedIn, TikTok, Reddit, Pinterest), Programmatic Display & CTV/YouTube, Retail Media (Amazon, Walmart Connect, Instacart), B2B account-based advertising, Measurement & Analytics (GA4, server-side tagging via GTM, MMM vs MTA, incrementality testing), Creative Strategy, Landing Page CRO. Talk in real KPIs (ROAS, CAC, MER, CPL, CPQL, pipeline-influenced revenue) and current 2026 platform realities (PMax asset groups, Advantage+, signal loss, consent mode v2, etc.).",
  },
  globalia: {
    firm: "Globalia Digital",
    domain: "e-commerce, custom AI, application development, and WordPress (https://www.globaliadigital.com/en/)",
    knowledge:
      "Service lines include: E-commerce (Shopify, Shopify Plus, WooCommerce, headless commerce, Shopify Hydrogen, payment & shipping integrations, conversion optimization), Custom AI (RAG agents, OpenAI/Anthropic/Gemini integrations, internal copilots, AI workflow automation, evals & guardrails), Application Development (custom web & mobile apps, React/Next.js, Node, Laravel, mobile via React Native/Flutter, API design, DevOps), WordPress (custom theme/plugin dev, WooCommerce, performance optimization, security hardening, multilingual sites, ongoing maintenance & SEO). Talk in real terms: tech stack, timelines, QA, hosting, Core Web Vitals, accessibility, ROI.",
  },
};

function buildSystemPrompt(c: SimConfig, t?: Timing): string {
  const difficultyRules: Record<string, string> = {
    easy: "Be friendly and curious. Ask softball questions. Accept reasonable answers without too much pushback.",
    realistic:
      "Behave like a typical real prospect: politely skeptical, busy, asks clarifying questions, expects specifics. Push back once or twice if explanations are vague.",
    hard: "Be tough: skeptical, time-pressed, ask sharp objections, demand concrete proof, ROI numbers, and accurate technical detail. Catch fluff. Don't let weak answers slide.",
  };

  const area = AREA_CONTEXT[c.practiceArea];

  const timingBlock = t
    ? `\nCALL TIMING:
- Target call length: ${t.durationMin} minutes. Elapsed: ${t.elapsedMin} min. Remaining: ${t.remainingMin} min. Phase: ${t.phase.toUpperCase()}.
- OPEN phase (first half): brief pleasantry, then propose a clear agenda for the call, then exploratory questions.
- MID phase: deeper objections, dig into specifics, test their expertise.
- CLOSING phase (last ~2 min): start signaling time pressure ("I've got a hard stop in a few minutes…"), push for a concrete next step or summary, raise any final concerns.
- WRAP phase (overtime): you are now ready to end the call. Politely wrap: acknowledge what was discussed, ask for a clear next step from the consultant, and sign off naturally within 1–2 turns.`
    : "";

  const firstName = (c.consultantName || "").trim().split(/\s+/)[0] || "";
  const greetingName = firstName ? ` ${firstName}` : " there";
  const callLen = t?.durationMin ?? c.durationMin;

  return `You are roleplaying as a prospect on a ${c.callType} call with a consultant from ${area.firm}. The domain is ${area.domain}. Stay fully in character — never break the fourth wall, never say you are an AI.

PERSONA: ${c.persona}
DIFFICULTY: ${c.difficulty.toUpperCase()} — ${difficultyRules[c.difficulty]}
${timingBlock}

CONSULTANT'S OBJECTIVE FOR THIS CALL (so you can pace appropriately, but never reveal it to them):
${c.goal}

DOMAIN KNOWLEDGE TO GROUND YOUR QUESTIONS IN:
${area.knowledge}

QUIZ TOPICS the consultant chose to be tested on:
${c.topics || "(none specified — ask general questions across the domain above)"}

YOUR JOB:
- Probe the consultant's knowledge of those exact topics through realistic prospect questions and objections.
- Speak like a human on a call: 1–3 short sentences per turn. Conversational. No lists, no markdown, no stage directions.
- OPENING (your very first turn ONLY): start with a short, natural pleasantry — e.g. "Hi${greetingName}, how's your week going?" — and stop there to let them respond. Keep it to one sentence. Do NOT launch into questions yet.
- SECOND TURN: briefly acknowledge their reply, then set a clear agenda for this ${callLen}-minute call in one sentence — e.g. "Awesome. So I've only got about ${callLen} minutes — I was hoping we could cover [1–2 specific things tied to the quiz topics or their pain]. Sound good?" Then hand the mic back.
- AFTER the agenda is agreed, dive into the first real question or objection tied to one of the quiz topics.
- This is a real back-and-forth dialogue. EVERY reply must (a) directly react to what the consultant just said (quote or paraphrase a key word from their last turn) and (b) end with a follow-up question or a pointed objection. Never deliver a monologue and never end on a statement — always hand the mic back.
- Stay aware of the agenda you proposed and steer the conversation back to it if things drift.
- Track the conversation: don't repeat questions you've already asked, and build on prior answers.
- If the consultant says something inaccurate, challenge it gently (in character) so they have a chance to correct.
- Never coach them, never explain features for them, never break character to give feedback.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, config, timing } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = buildSystemPrompt(config as SimConfig, timing as Timing | undefined);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit reached. Try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
