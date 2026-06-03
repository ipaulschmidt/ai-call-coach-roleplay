import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const required = ["practice_area", "persona", "difficulty", "call_type", "transcript"];
    for (const k of required) {
      if (body[k] === undefined || body[k] === null) {
        return new Response(JSON.stringify({ error: `Missing field: ${k}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    const str = (v: unknown, max: number) =>
      typeof v === "string" ? v.slice(0, max) : null;

    const row = {
      practice_area: str(body.practice_area, 64),
      persona: str(body.persona, 2000),
      difficulty: str(body.difficulty, 64),
      call_type: str(body.call_type, 64),
      topics: body.topics ? str(body.topics, 2000) : null,
      consultant_name: body.consultant_name ? str(body.consultant_name, 200) : null,
      transcript: body.transcript,
      evaluation: body.evaluation ?? null,
    };

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data, error } = await supabase
      .from("coaching_sessions")
      .insert([row])
      .select("id")
      .single();
    if (error) throw error;
    return new Response(JSON.stringify({ id: data.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("save-session error:", e);
    return new Response(JSON.stringify({ error: "Could not save session" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});