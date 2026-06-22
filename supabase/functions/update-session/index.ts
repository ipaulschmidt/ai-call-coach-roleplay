import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-password, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const ADMIN_PASSWORD = Deno.env.get("ADMIN_PASSWORD");
    if (!ADMIN_PASSWORD) throw new Error("ADMIN_PASSWORD not configured");
    const provided = req.headers.get("x-admin-password") || "";
    if (provided !== ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const body = await req.json().catch(() => ({}));
    const id = typeof body?.id === "string" ? body.id : "";
    if (!UUID_RE.test(id)) {
      return new Response(JSON.stringify({ error: "Invalid id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const trim = (v: unknown, max: number) =>
      typeof v === "string" ? v.trim().slice(0, max) : "";
    const consultant_name = trim(body.consultant_name, 200);
    const rep_email = trim(body.rep_email, 320);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { error } = await supabase
      .from("coaching_sessions")
      .update({
        consultant_name: consultant_name || null,
        rep_email: rep_email || null,
      })
      .eq("id", id);
    if (error) throw error;
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("update-session error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});