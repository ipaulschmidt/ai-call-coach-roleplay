import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

interface Body {
  repEmail?: string;
  repName?: string;
  practiceArea?: string;
  callType?: string;
  personaName?: string;
  difficulty?: string;
  durationMinutes?: number;
  quizTopics?: string;
  transcript?: Array<{ role: string; content: string }>;
}

const HS = "https://api.hubapi.com";

function fmtDate(d: Date): string {
  return d.toLocaleString("en-US", {
    month: "long", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function buildNote(b: Body, when: Date): string {
  const transcriptText = (b.transcript ?? []).map((m) => {
    const label = m.role === "user" ? "REP" : "PROSPECT/CLIENT";
    return `[${label}]: ${m.content}`;
  }).join("\n");
  return [
    "🎯 SmartBug Coach — Role-Play Session",
    "",
    `Date: ${fmtDate(when)}`,
    `Rep: ${b.repName?.trim() || b.repEmail || ""}`,
    `Practice Area: ${b.practiceArea ?? ""}`,
    `Call Type: ${b.callType ?? ""}`,
    `Persona: ${b.personaName ?? ""}`,
    `Difficulty: ${b.difficulty ?? ""}`,
    `Duration: ${b.durationMinutes ?? 0} min`,
    `Focus / Quiz Topics: ${b.quizTopics?.trim() || "None specified"}`,
    "",
    "── TRANSCRIPT ──────────────────────────────",
    transcriptText,
    "────────────────────────────────────────────",
  ].join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const key = Deno.env.get("HUBSPOT_SERVICE_KEY");
    if (!key) return json({ logged: false, reason: "api_error" });

    const body = (await req.json().catch(() => ({}))) as Body;
    const email = (body.repEmail || "").trim().toLowerCase();
    if (!email) return json({ logged: false, reason: "no_contact" });

    const headers = {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    };

    // Step A — find contact
    const searchResp = await fetch(`${HS}/crm/v3/objects/contacts/search`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        filterGroups: [{
          filters: [{ propertyName: "email", operator: "EQ", value: email }],
        }],
        properties: ["email", "firstname", "lastname"],
      }),
    });
    if (!searchResp.ok) {
      console.error("HubSpot search failed", searchResp.status, await searchResp.text());
      return json({ logged: false, reason: "api_error" });
    }
    const searchData = await searchResp.json();
    const contact = searchData?.results?.[0];
    if (!contact?.id) return json({ logged: false, reason: "no_contact" });

    // Step B — note body
    const now = new Date();
    const noteBody = buildNote(body, now);

    // Step C — create note + association
    const noteResp = await fetch(`${HS}/crm/v3/objects/notes`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        properties: {
          hs_note_body: noteBody,
          hs_timestamp: now.toISOString(),
        },
        associations: [{
          to: { id: contact.id },
          types: [{
            associationCategory: "HUBSPOT_DEFINED",
            associationTypeId: 202,
          }],
        }],
      }),
    });
    if (!noteResp.ok) {
      console.error("HubSpot note create failed", noteResp.status, await noteResp.text());
      return json({ logged: false, reason: "api_error" });
    }

    return json({ logged: true });
  } catch (e) {
    console.error("log-session error", e);
    return json({ logged: false, reason: "api_error" });
  }
});