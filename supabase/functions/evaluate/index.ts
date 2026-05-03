import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { transcript, config } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a senior HubSpot sales coach evaluating a SmartBug consultant's roleplay call. Be specific, fair, and direct. Cite exact moments. Score on a 0–100 scale where 70 = competent, 85 = strong, 95+ = expert. Do not flatter.`;

    const userPrompt = `CALL CONFIG:
- Persona: ${config.persona}
- Difficulty: ${config.difficulty}
- Call type: ${config.callType}
- Quiz topics the consultant chose to be tested on: ${config.topics || "(none)"}

TRANSCRIPT (consultant = the SmartBug rep, prospect = the AI):
${transcript}

Evaluate the consultant on the three metrics. For technical_delivery, focus on whether they accurately explained the listed quiz topics. For consultant_confidence, infer from filler words ("um", "uh", "like", "you know"), hedging language, and pacing inferred from sentence length — note in your rationale that this is transcript-based.`;

    const tool = {
      type: "function",
      function: {
        name: "submit_evaluation",
        description: "Return the structured evaluation of the consultant's call.",
        parameters: {
          type: "object",
          properties: {
            sales_strategy: {
              type: "object",
              properties: {
                score: { type: "number" },
                notes: { type: "string" },
              },
              required: ["score", "notes"],
              additionalProperties: false,
            },
            technical_delivery: {
              type: "object",
              properties: {
                score: { type: "number" },
                notes: { type: "string" },
                topics_covered: { type: "array", items: { type: "string" } },
                topics_missed: { type: "array", items: { type: "string" } },
              },
              required: ["score", "notes", "topics_covered", "topics_missed"],
              additionalProperties: false,
            },
            consultant_confidence: {
              type: "object",
              properties: {
                score: { type: "number" },
                notes: { type: "string" },
                filler_words: { type: "array", items: { type: "string" } },
                pacing: { type: "string", enum: ["slow", "good", "rushed"] },
              },
              required: ["score", "notes", "filler_words", "pacing"],
              additionalProperties: false,
            },
            corrective_feedback: { type: "array", items: { type: "string" } },
            wins: { type: "array", items: { type: "string" } },
            summary: { type: "string" },
          },
          required: [
            "sales_strategy",
            "technical_delivery",
            "consultant_confidence",
            "corrective_feedback",
            "wins",
            "summary",
          ],
          additionalProperties: false,
        },
      },
    };

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "submit_evaluation" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit reached. Try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await response.text();
      console.error("eval gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) throw new Error("No tool call in response");
    const evaluation = JSON.parse(call.function.arguments);

    return new Response(JSON.stringify({ evaluation }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("evaluate error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});