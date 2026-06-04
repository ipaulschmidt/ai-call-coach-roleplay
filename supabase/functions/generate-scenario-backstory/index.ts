import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-password, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PROMPT = `Based on the following service description, write 1–2 sentences describing why a realistic prospect is on this call. Make it specific and plausible — a real inbound reason like a form fill, referral, or event follow-up. Write it in third person. Do not mention the service name directly. Do not summarize the service. Just give the rep context for how this conversation started.

Example output: "They were referred by an existing client and filled out the Contact Us form earlier this week asking about AI search visibility. This is a first call."

Service description:
`;

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

    const { topics } = await req.json().catch(() => ({}));
    const trimmed = typeof topics === "string" ? topics.trim() : "";
    if (!trimmed) {
      return new Response(JSON.stringify({ backstory: "" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: PROMPT + trimmed }],
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("backstory gen error:", resp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await resp.json();
    const raw = String(data.choices?.[0]?.message?.content ?? "").trim();
    const backstory = raw.replace(/^["'`]+|["'`]+$/g, "").slice(0, 600);
    return new Response(JSON.stringify({ backstory }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-scenario-backstory error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});