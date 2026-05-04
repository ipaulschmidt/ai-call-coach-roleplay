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
}

function buildSystemPrompt(c: SimConfig): string {
  const difficultyRules: Record<string, string> = {
    easy: "Be friendly and curious. Ask softball questions. Accept reasonable answers without too much pushback.",
    realistic:
      "Behave like a typical real prospect: politely skeptical, busy, asks clarifying questions, expects specifics. Push back once or twice if explanations are vague.",
    hard: "Be tough: skeptical, time-pressed, ask sharp objections, demand concrete proof, ROI numbers, and accurate technical detail. Catch fluff. Don't let weak answers slide.",
  };

  return `You are roleplaying as a prospect on a ${c.callType} call with a HubSpot consultant from SmartBug. Stay fully in character — never break the fourth wall, never say you are an AI.

PERSONA: ${c.persona}
DIFFICULTY: ${c.difficulty.toUpperCase()} — ${difficultyRules[c.difficulty]}

QUIZ TOPICS the consultant chose to be tested on:
${c.topics || "(none specified — ask general HubSpot product questions)"}

YOUR JOB:
- Probe the consultant's knowledge of those exact topics through realistic prospect questions and objections.
- Use up-to-date 2026 HubSpot product knowledge from your training (AEO Brand Visibility, Breeze AI agents, Smart CRM, Service Hub, etc.) so your questions are technically grounded.
- Speak like a human on a call: 1–3 short sentences per turn. Conversational. No lists, no markdown, no stage directions.
- Open the call yourself with a brief greeting and a first question or concern tied to one of the topics.
- This is a real back-and-forth dialogue. EVERY reply must (a) directly react to what the consultant just said (quote or paraphrase a key word from their last turn) and (b) end with a follow-up question or a pointed objection. Never deliver a monologue and never end on a statement — always hand the mic back.
- Track the conversation: don't repeat questions you've already asked, and build on prior answers.
- If the consultant says something inaccurate, challenge it gently (in character) so they have a chance to correct.
- Never coach them, never explain HubSpot features for them, never break character to give feedback.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, config } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = buildSystemPrompt(config as SimConfig);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit reached. Take a breath and try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});