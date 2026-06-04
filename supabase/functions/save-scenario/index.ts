import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-password, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const str = (v: unknown, max: number) =>
  typeof v === "string" ? v.slice(0, max) : null;

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

    const row = {
      name: str(body.name, 200),
      practice_area: str(body.practice_area, 64),
      call_type: str(body.call_type, 64),
      difficulty: str(body.difficulty, 64),
      persona: str(body.persona, 2000),
      duration_minutes: Number(body.duration_minutes) || 10,
      topics: body.topics ? str(body.topics, 8000) : null,
      created_by_hint: body.created_by_hint ? str(body.created_by_hint, 200) : null,
    };

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (typeof body.id === "string" && body.id) {
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