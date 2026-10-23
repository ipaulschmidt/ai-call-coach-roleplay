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
  scenarioName?: string;
  transcript?: Array<{ role: string; content: string }>;
  evaluation?: any;
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
    row("Scenario", b.scenarioName?.trim() || "Custom session"),
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

  const ev = b.evaluation;
  const isTough = b.callType === "tough";
  const scoreLabels = isTough
    ? {
        sales_strategy: "Empathy & Acknowledgement",
        technical_delivery: "Options Offered",
        consultant_confidence: "Firmness / Boundaries",
        agenda_setting: "Scope & Money Protected",
        next_steps: "Concrete Next Step",
      }
    : {
        sales_strategy: "Sales Strategy",
        technical_delivery: "Technical Delivery",
        consultant_confidence: "Consultant Confidence",
        agenda_setting: "Agenda Setting",
        active_listening: "Active Listening",
        next_steps: "Next Steps",
      };

  const scoreColor = (s: number) =>
    s >= 85 ? "#00bda5" : s >= 70 ? "#33475b" : "#d93f4c";

  const scoreBlock = (label: string, node: any) => {
    if (!node || typeof node.score !== "number") return "";
    const color = scoreColor(node.score);
    return `
      <td style="vertical-align:top;padding:8px 12px 8px 0;width:33%;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#7c98b6;font-weight:600;">${escapeHtml(label)}</div>
        <div style="font-size:24px;font-weight:700;color:${color};margin-top:2px;">${node.score}<span style="font-size:13px;color:#7c98b6;font-weight:500;">/100</span></div>
        <div style="font-size:13px;color:#33475b;line-height:1.4;margin-top:4px;">${escapeHtml(node.notes || "")}</div>
      </td>`;
  };

  let scoresHtml = "";
  if (ev) {
    const cells: string[] = [];
    cells.push(scoreBlock(scoreLabels.sales_strategy, ev.sales_strategy));
    cells.push(scoreBlock(scoreLabels.technical_delivery, ev.technical_delivery));
    cells.push(scoreBlock(scoreLabels.consultant_confidence, ev.consultant_confidence));
    cells.push(scoreBlock(scoreLabels.agenda_setting, ev.agenda_setting));
    if (!isTough) cells.push(scoreBlock((scoreLabels as any).active_listening, ev.active_listening));
    cells.push(scoreBlock(scoreLabels.next_steps, ev.next_steps));
    const filled = cells.filter(Boolean);
    const rows: string[] = [];
    for (let i = 0; i < filled.length; i += 3) {
      rows.push(`<tr>${filled.slice(i, i + 3).join("")}</tr>`);
    }
    scoresHtml = `<h3 style="margin:0 0 8px 0;">Scores</h3><table style="border-collapse:collapse;width:100%;margin-bottom:16px;"><tbody>${rows.join("")}</tbody></table>`;
  }

  let summaryHtml = "";
  if (ev?.summary) {
    summaryHtml = `<h3 style="margin:0 0 6px 0;">Summary</h3><p style="margin:0 0 14px 0;line-height:1.5;color:#33475b;">${escapeHtml(ev.summary)}</p>`;
  }

  let signalsHtml = "";
  if (ev && !isTough) {
    const tc = ev.technical_delivery?.topics_covered ?? [];
    const tm = ev.technical_delivery?.topics_missed ?? [];
    const pacing = ev.consultant_confidence?.pacing ?? "";
    const fillers: string[] = ev.consultant_confidence?.filler_words ?? [];
    const examples: string[] = ev.active_listening?.examples ?? [];
    const offeredTimes = ev.next_steps?.offered_times;
    const securedMeeting = ev.next_steps?.secured_meeting;

    const chips = (arr: string[], color: string) =>
      arr.length
        ? arr
            .map(
              (t) =>
                `<span style="display:inline-block;background:${color}22;color:${color};border-radius:12px;padding:2px 10px;font-size:12px;margin:2px 4px 2px 0;">${escapeHtml(t)}</span>`,
            )
            .join("")
        : `<span style="color:#7c98b6;font-size:12px;">None</span>`;

    signalsHtml = `
      <h3 style="margin:0 0 8px 0;">Topic coverage &amp; delivery signals</h3>
      <div style="font-size:13px;color:#33475b;margin-bottom:6px;"><strong>Covered:</strong> ${chips(tc, "#00bda5")}</div>
      <div style="font-size:13px;color:#33475b;margin-bottom:10px;"><strong>Missed:</strong> ${chips(tm, "#d93f4c")}</div>
      <div style="font-size:13px;color:#33475b;"><strong>Pacing:</strong> ${escapeHtml(pacing)}</div>
      <div style="font-size:13px;color:#33475b;"><strong>Filler words:</strong> ${fillers.length ? escapeHtml(fillers.join(", ")) : "none detected"}</div>
      <div style="font-size:13px;color:#33475b;"><strong>Offered specific times:</strong> ${offeredTimes ? "Yes" : "No"} · <strong>Meeting booked:</strong> ${securedMeeting ? "Yes" : "No"}</div>
      ${examples.length ? `<div style="font-size:13px;color:#33475b;margin-top:8px;"><strong>Active-listening examples:</strong><ul style="margin:4px 0 0 18px;padding:0;">${examples.map((e) => `<li style="margin:2px 0;font-style:italic;">${escapeHtml(e)}</li>`).join("")}</ul></div>` : ""}
      <hr style="border:none;border-top:1px solid #cbd6e2;margin:16px 0;" />`;
  }

  const winsHtml = ev?.wins?.length
    ? `<h3 style="margin:0 0 6px 0;color:#00bda5;">What you nailed</h3><ul style="margin:0 0 14px 18px;padding:0;color:#33475b;">${ev.wins.map((w: string) => `<li style="margin:3px 0;">${escapeHtml(w)}</li>`).join("")}</ul>`
    : "";
  const correctiveHtml = ev?.corrective_feedback?.length
    ? `<h3 style="margin:0 0 6px 0;color:#d93f4c;">Corrective feedback</h3><ul style="margin:0 0 14px 18px;padding:0;color:#33475b;">${ev.corrective_feedback.map((w: string) => `<li style="margin:3px 0;">${escapeHtml(w)}</li>`).join("")}</ul>`
    : "";

  return [
    `<h2 style="margin:0 0 12px 0;">🎯 Call Coach — Role-Play Session</h2>`,
    `<table style="border-collapse:collapse;font-size:14px;margin-bottom:16px;"><tbody>${meta}</tbody></table>`,
    `<hr style="border:none;border-top:1px solid #cbd6e2;margin:16px 0;" />`,
    summaryHtml,
    scoresHtml,
    signalsHtml,
    winsHtml,
    correctiveHtml,
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