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

let cachedPortalId: string | null = null;

async function getPortalId(authHeader: string): Promise<string | null> {
  if (cachedPortalId) return cachedPortalId;
  try {
    const r = await fetch(`${HS}/account-info/v3/details`, {
      headers: { Authorization: authHeader },
    });
    if (!r.ok) {
      await r.text();
      return null;
    }
    const d = await r.json();
    if (d?.portalId) {
      cachedPortalId = String(d.portalId);
      return cachedPortalId;
    }
  } catch (_) { /* ignore */ }
  return null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtDate(d: Date): string {
  return d.toLocaleString("en-US", {
    month: "long", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function buildNote(b: Body, when: Date): string {
  const rep = b.repName?.trim() || b.repEmail || "";
  const row = (label: string, val: string) =>
    `<tr><td style="padding:2px 12px 2px 0;color:#516f90;font-weight:600;white-space:nowrap;">${escapeHtml(label)}</td><td style="padding:2px 0;">${escapeHtml(val)}</td></tr>`;

  const meta = [
    row("Date", fmtDate(when)),
    row("Rep", rep),
    row("Practice Area", b.practiceArea ?? ""),
    row("Call Type", b.callType ?? ""),
    row("Persona", b.personaName ?? ""),
    row("Difficulty", b.difficulty ?? ""),
    row("Duration", `${b.durationMinutes ?? 0} min`),
    row("Focus / Quiz Topics", b.quizTopics?.trim() || "None specified"),
  ].join("");

  const transcriptItems = (b.transcript ?? []).map((m) => {
    const isRep = m.role === "user";
    const label = isRep ? "Rep" : "Prospect / Client";
    const color = isRep ? "#0078d4" : "#33475b";
    return `<p style="margin:6px 0;line-height:1.5;"><strong style="color:${color};">${label}:</strong> ${escapeHtml(m.content)}</p>`;
  }).join("");

  return [
    `<h2 style="margin:0 0 12px 0;">🎯 SmartBug Coach — Role-Play Session</h2>`,
    `<table style="border-collapse:collapse;font-size:14px;margin-bottom:16px;"><tbody>${meta}</tbody></table>`,
    `<hr style="border:none;border-top:1px solid #cbd6e2;margin:16px 0;" />`,
    `<h3 style="margin:0 0 8px 0;">Transcript</h3>`,
    `<div>${transcriptItems || '<p style="color:#7c98b6;">No transcript captured.</p>'}</div>`,
  ].join("");
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

    const portalId = await getPortalId(`Bearer ${key}`);
    const contactUrl = portalId
      ? `https://app.hubspot.com/contacts/${portalId}/record/0-1/${contact.id}`
      : null;
    return json({
      logged: true,
      contactId: contact.id,
      contactUrl,
      contactName: [contact.properties?.firstname, contact.properties?.lastname]
        .filter(Boolean)
        .join(" ") || null,
    });
  } catch (e) {
    console.error("log-session error", e);
    return json({ logged: false, reason: "api_error" });
  }
});