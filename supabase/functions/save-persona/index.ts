import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-password, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : null);

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || "persona";
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
    const required = ["name", "role", "blurb", "practice_area"];
    for (const k of required) {
      if (!body[k] || typeof body[k] !== "string") {
        return new Response(JSON.stringify({ error: `Missing field: ${k}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const row: Record<string, unknown> = {
      name: str(body.name, 120),
      role: str(body.role, 160),
      blurb: str(body.blurb, 600),
      practice_area: str(body.practice_area, 64),
      gender: body.gender === "male" || body.gender === "female" ? body.gender : null,
      avatar_url: body.avatar_url ? str(body.avatar_url, 1000) : null,
      personality_traits: body.personality_traits ? str(body.personality_traits, 1000) : null,
      known_objections: body.known_objections ? str(body.known_objections, 1000) : null,
      voice_notes: body.voice_notes ? str(body.voice_notes, 1000) : null,
      source_type: body.source_type === "real_person_modeled" ? "real_person_modeled" : "composite",
      source_reference: body.source_reference ? str(body.source_reference, 1000) : null,
      brand_context: body.brand_context ? str(body.brand_context, 300) : null,
    };

    if (typeof body.id === "string" && body.id) {
      const { data, error } = await supabase
        .from("personas")
        .update(row)
        .eq("id", body.id)
        .select("*")
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ persona: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseId = slugify(row.name as string);
    let candidateId = baseId;
    let attempt = 1;
    while (true) {
      const { data: existing } = await supabase
        .from("personas")
        .select("id")
        .eq("id", candidateId)
        .maybeSingle();
      if (!existing) break;
      attempt += 1;
      candidateId = `${baseId}-${attempt}`;
    }
    row.id = candidateId;

    const { data, error } = await supabase
      .from("personas")
      .insert([row])
      .select("*")
      .single();
    if (error) throw error;
    return new Response(JSON.stringify({ persona: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("save-persona error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});