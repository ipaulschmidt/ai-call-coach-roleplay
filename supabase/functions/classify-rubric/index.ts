import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED = new Set([
  "sales_discovery",
  "service_kickoff",
  "scope_expansion",
  "tough_recovery",
  "business_development",
]);

function fallback(callType: string | undefined): string {
  if (callType === "tough") return "tough_recovery";
  if (callType === "service") return "service_kickoff";
  return "sales_discovery";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { goal, callType } = await req.json().catch(() => ({}));
    const goalText = typeof goal === "string" ? goal.trim() : "";
    if (!goalText) {
      return new Response(JSON.stringify({ rubric: fallback(callType) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const prompt = `Pick the ONE scoring rubric that best matches the rep's goal for this roleplay. Return ONLY the rubric key — no punctuation, no explanation, nothing else.

Rubrics:
- sales_discovery — pre-sale prospect call: surface pain, qualify fit, earn a next step.
- service_kickoff — post-sale onboarding, kickoff, or status call with a friendly, cooperative client: set expectations, clarify scope, translate work into business value.
- scope_expansion — healthy-relationship moment where the rep must hold scope, name scope creep, or convert an expansion signal into a real paid path while staying warm.
- tough_recovery — hard moment with an existing client (past-due payment, dispute, scope-creep pushback, churn risk, escalation): empathy, firm boundaries, options, scope/money protection.
- business_development — outbound BDR cold call or first-touch call to someone who is not expecting it (intent signal, job posting, referral, event follow-up, stale inbound lead): earn attention fast with a specific reason for the call, handle the brush-off, qualify lightly without over-discovering, and book a meeting.

Call type tag (hint, not authoritative): ${callType ?? "(none)"}
Rep goal: ${goalText}

Answer with exactly one of: sales_discovery, service_kickoff, scope_expansion, tough_recovery, business_development`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("classify-rubric gateway error:", resp.status, t);
      return new Response(JSON.stringify({ rubric: fallback(callType) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await resp.json();
    const raw = String(data.choices?.[0]?.message?.content ?? "").trim().toLowerCase();
    const cleaned = raw.replace(/[^a-z_]/g, "");
    const rubric = ALLOWED.has(cleaned) ? cleaned : fallback(callType);
    return new Response(JSON.stringify({ rubric }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("classify-rubric error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});