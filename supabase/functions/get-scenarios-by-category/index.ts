import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const category = body?.category === "bdr" ? "bdr" : body?.category === "ae" ? "ae" : null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const run = async () => {
      let query = supabase
        .from("scenarios")
        .select("id, name, persona, call_type, difficulty, duration_minutes, practice_area, category, goal")
        .order("created_at", { ascending: true });
      if (category) query = query.eq("category", category);
      return await query;
    };

    let { data, error } = await run();
    // Transient clock-skew between runtime and DB ("JWT issued at future") — retry once.
    if (error && (error.code === "PGRST303" || /issued at future/i.test(error.message ?? ""))) {
      await new Promise((r) => setTimeout(r, 1500));
      ({ data, error } = await run());
    }
    if (error) throw new Error(`${error.code ?? "DB"}: ${error.message ?? "query failed"}`);

    return new Response(JSON.stringify({ scenarios: data ?? [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("get-scenarios-by-category error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});