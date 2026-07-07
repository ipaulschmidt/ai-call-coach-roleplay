import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-password",
};

type Ev = Record<string, any> | null;

const SCORE_KEYS = [
  "sales_strategy",
  "technical_delivery",
  "consultant_confidence",
  "agenda_setting",
  "active_listening",
  "next_steps",
];

function overallScore(ev: Ev): number | null {
  if (!ev || typeof ev !== "object") return null;
  // Prefer a top-line score if present
  for (const k of ["overall", "overall_score", "score", "summary_score"]) {
    const v = (ev as any)[k];
    if (typeof v === "number" && !Number.isNaN(v)) return v;
  }
  const scores: number[] = [];
  for (const k of SCORE_KEYS) {
    const dim = (ev as any)[k];
    if (dim && typeof dim.score === "number") scores.push(dim.score);
  }
  if (!scores.length) return null;
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
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

    let rangeStart: string | null = null;
    let rangeEnd: string | null = null;
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      rangeStart = typeof body?.rangeStart === "string" ? body.rangeStart : null;
      rangeEnd = typeof body?.rangeEnd === "string" ? body.rangeEnd : null;
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let q = supabase
      .from("coaching_sessions")
      .select("id, created_at, consultant_name, rep_email, call_type, rubric, scenario_name, practice_area, difficulty, persona, evaluation")
      .order("created_at", { ascending: false });
    if (rangeStart) q = q.gte("created_at", rangeStart);
    if (rangeEnd) q = q.lte("created_at", rangeEnd);

    const { data, error } = await q;
    if (error) throw error;

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    // For "sessions_last_7_days" we always need "last 7 days from today"
    // independent of the range filter. Query separately if needed.
    let recentByKey = new Map<string, number>();
    if (rangeStart || rangeEnd) {
      const { data: recent } = await supabase
        .from("coaching_sessions")
        .select("consultant_name, rep_email, created_at")
        .gte("created_at", new Date(sevenDaysAgo).toISOString());
      for (const r of recent || []) {
        const key = r.rep_email
          ? r.rep_email.toLowerCase().trim()
          : (r.consultant_name || "anon").toLowerCase().trim();
        recentByKey.set(key, (recentByKey.get(key) || 0) + 1);
      }
    }

    const groups = new Map<string, any[]>();
    for (const row of data || []) {
      // Skip anonymous sessions (no email AND no consultant_name) from the leaderboard entirely.
      if (!(row as any).rep_email && !(row as any).consultant_name) continue;
      // Deduplicate strictly by email when present so name-spelling variants merge.
      // Fall back to consultant_name only when there is no email at all.
      const rawKey = (row as any).rep_email
        ? (row as any).rep_email.toString()
        : (row as any).consultant_name.toString();
      const key = rawKey.toLowerCase().trim();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }

    const leaderboard = Array.from(groups.entries()).map(([key, sessions]) => {
      // Prefer the most-recent non-null consultant_name and rep_email
      const sorted = [...sessions].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      const nameSource = sorted.find((s) => s.consultant_name)?.consultant_name || null;
      const emailSource = sorted.find((s) => s.rep_email)?.rep_email || null;
      let displayName = nameSource;
      if (!displayName && emailSource) displayName = emailSource.split("@")[0];
      if (!displayName) displayName = "Anonymous";

      const scores = sessions
        .map((s) => overallScore(s.evaluation))
        .filter((v): v is number => typeof v === "number");
      const avg =
        scores.length > 0
          ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
          : null;

      const withScores = sorted.filter((s) => overallScore(s.evaluation) !== null);
      const mostRecentScore = withScores.length ? overallScore(withScores[0].evaluation) : null;
      const firstScore = withScores.length ? overallScore(withScores[withScores.length - 1].evaluation) : null;

      let trend: "up" | "down" | "flat" | null = null;
      if (withScores.length >= 2 && mostRecentScore !== null && firstScore !== null) {
        const diff = mostRecentScore - firstScore;
        trend = diff > 5 ? "up" : diff < -5 ? "down" : "flat";
      }

      const typeKeys = new Set<string>();
      for (const s of sessions) {
        const t = s.scenario_name || `${s.call_type || ""}__${s.rubric || ""}`;
        typeKeys.add(t);
      }

      const sessionsLast7 = (rangeStart || rangeEnd)
        ? (recentByKey.get(key) || 0)
        : sessions.filter((s) => new Date(s.created_at).getTime() >= sevenDaysAgo).length;

      return {
        key,
        name: displayName,
        email: emailSource,
        total_sessions: sessions.length,
        sessions_last_7_days: sessionsLast7,
        avg_overall_score: avg,
        most_recent_score: mostRecentScore,
        first_score: firstScore,
        score_trend: trend,
        distinct_scenario_types: typeKeys.size,
        last_active: sorted[0].created_at,
        sessions: sorted.map((s) => ({
          id: s.id,
          created_at: s.created_at,
          call_type: s.call_type,
          rubric: s.rubric,
          scenario_name: s.scenario_name,
          practice_area: s.practice_area,
          difficulty: s.difficulty,
          persona: s.persona,
          overall_score: overallScore(s.evaluation),
        })),
      };
    });

    leaderboard.sort((a, b) => b.total_sessions - a.total_sessions);

    return new Response(JSON.stringify({ leaderboard }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("get-leaderboard error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});