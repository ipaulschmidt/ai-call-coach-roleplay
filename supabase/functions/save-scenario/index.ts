import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-password, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const str = (v: unknown, max: number) =>
  typeof v === "string" ? v.slice(0, max) : null;

const ALLOWED_RUBRICS = new Set([
  "sales_discovery",
  "service_kickoff",
  "scope_expansion",
  "tough_recovery",
  "business_development",
]);

function buildGoal(callType: string, name: string): string {
  const n = name || "this scenario";
  if (callType === "discovery") {
    return `Pitch ${n} to this prospect, uncover their top 1–2 pains, do a light qualification (budget, timeline, or decision process — pick what matters most), and earn a clear next step.`;
  }
  if (callType === "tough") {
    return `Navigate this conversation around ${n}, address the client's concerns directly, protect scope where needed, and close with a concrete next step.`;
  }
  return `Introduce ${n} to this client, confirm their goals and current situation, walk them through what this engagement delivers, and align on a clear path forward.`;
}

const DISTILL_PROMPT = `You are preparing a briefing for an AI that will roleplay as a realistic prospect or client being pitched or introduced to a service. Extract only what that AI needs to respond accurately and naturally. From the content below, extract and rewrite in plain language:

1. What the service is — one short paragraph, plain language only
2. Who it's for — the ideal customer profile, firmographics, and pain points
3. How prospects typically talk about the problem this solves — specific language and phrases if present
4. Pricing and investment — if mentioned
5. Common objections or concerns — if mentioned
6. Who it is NOT a good fit for — if mentioned

Ignore everything else: internal staffing models, delivery processes, SOW language, escalation paths, tool comparison tables, links, and anything written for internal teams rather than for understanding the service itself.

Return only the extracted content as clean plain text with the six section headers above. No preamble, no commentary.

Content to process:
`;

async function distillTopics(raw: string): Promise<string | null> {
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return null;
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: DISTILL_PROMPT + raw }],
      }),
    });
    if (!resp.ok) {
      console.error("distill error:", resp.status, await resp.text());
      return null;
    }
    const data = await resp.json();
    const out = String(data.choices?.[0]?.message?.content ?? "").trim();
    return out || null;
  } catch (e) {
    console.error("distill exception:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const ADMIN_PASSWORD = Deno.env.get("ADMIN_PASSWORD");
    if (!ADMIN_PASSWORD) throw new Error("ADMIN_PASSWORD not configured");
    if ((req.headers.get("x-admin-password") || "") !== ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const required = ["name", "practice_area", "call_type", "difficulty", "persona", "duration_minutes"];
    for (const k of required) {
      if (body[k] === undefined || body[k] === null || body[k] === "") {
        return new Response(JSON.stringify({ error: `Missing field: ${k}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const row: Record<string, unknown> = {
      name: str(body.name, 200),
      practice_area: str(body.practice_area, 64),
      call_type: str(body.call_type, 64),
      difficulty: str(body.difficulty, 64),
      persona: str(body.persona, 2000),
      duration_minutes: Number(body.duration_minutes) || 10,
      topics: body.topics ? str(body.topics, 8000) : null,
      scenario: body.scenario ? str(body.scenario, 2000) : null,
      created_by_hint: body.created_by_hint ? str(body.created_by_hint, 200) : null,
      featured: typeof body.featured === "boolean" ? body.featured : false,
    };

    row.rubric =
      typeof body.rubric === "string" && ALLOWED_RUBRICS.has(body.rubric)
        ? str(body.rubric, 64)
        : null;

    const providedGoal = typeof body.goal === "string" ? body.goal.trim() : "";
    row.goal = providedGoal
      ? str(providedGoal, 2000)
      : buildGoal(row.call_type as string, row.name as string);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (typeof body.id === "string" && body.id) {
      // On update: only re-distill if topics changed.
      const { data: existing } = await supabase
        .from("scenarios")
        .select("topics, topics_distilled")
        .eq("id", body.id)
        .maybeSingle();
      const newTopics = typeof row.topics === "string" ? row.topics : null;
      if (newTopics) {
        if (!existing || existing.topics !== newTopics || !existing.topics_distilled) {
          row.topics_distilled = await distillTopics(newTopics);
        }
      } else {
        row.topics_distilled = null;
      }
      const { data, error } = await supabase
        .from("scenarios")
        .update(row)
        .eq("id", body.id)
        .select("*")
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ scenario: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typeof row.topics === "string" && row.topics) {
      row.topics_distilled = await distillTopics(row.topics);
    }

    const { data, error } = await supabase
      .from("scenarios")
      .insert([row])
      .select("*")
      .single();
    if (error) throw error;
    return new Response(JSON.stringify({ scenario: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("save-scenario error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});