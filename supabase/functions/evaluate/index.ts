import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { transcript, config } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Resolve the rubric. Prefer the explicit rubric on the session config;
    // fall back to the legacy callType-based default so older sessions/scenarios
    // still score correctly.
    const rubric:
      | "sales_discovery"
      | "service_kickoff"
      | "scope_expansion"
      | "tough_recovery"
      | "business_development" =
      config.rubric ??
      (config.callType === "tough"
        ? "tough_recovery"
        : config.callType === "service"
        ? "service_kickoff"
        : "sales_discovery");
    const isSalesDiscovery = rubric === "sales_discovery";
    const isColdCall = rubric === "business_development";
    // Both of these rubrics use the full six-field evaluation schema.
    const isFullSchema = isSalesDiscovery || isColdCall;
    const isTough = rubric === "tough_recovery";

    const systemPromptByRubric: Record<typeof rubric, string> = {
      sales_discovery: `You are a senior HubSpot sales coach evaluating a SmartBug consultant's roleplay call. Be specific, fair, and direct. Cite exact moments. Score on a 0–100 scale where 70 = competent, 85 = strong, 95+ = expert. Do not flatter.`,
      service_kickoff: `You are a senior client-services coach evaluating a delivery KICKOFF or status call with a healthy, cooperative client — NOT a hard moment. Be specific, fair, and direct. Cite exact moments. Score on a 0–100 scale where 70 = competent, 85 = strong, 95+ = expert. Reward: realistic expectations, clear in/out of scope, value translated to business outcomes, calm assured delivery, and a concrete next step. Penalize: over-promising to please the client, vague scope, task-listing without business value, and ending without a real commitment.`,
      scope_expansion: `You are a senior client-services coach evaluating how the consultant handled a SCOPE-PROTECTION or EXPANSION moment with a friendly, satisfied client. The hard part is doing something slightly uncomfortable without damaging warmth. Be specific, fair, and direct. Cite exact moments. Score on a 0–100 scale where 70 = competent, 85 = strong, 95+ = expert. Reward: protecting the SOW/hours/rate, naming the scope-creep pattern or the expansion signal, converting the moment into something real (change order, properly scoped next engagement, paid path), and staying warm and consultative throughout. Penalize: caving to be liked, giving away free strategy, vague "let's talk later" closes, and a rigid/nickel-and-diming tone.`,
      tough_recovery: `You are a senior client-services coach evaluating a consultant's handling of a TOUGH client conversation (${config.situationLabel ?? "hard moment"}). Be specific, fair, and direct. Cite exact moments from the transcript. Score on a 0–100 scale where 70 = competent, 85 = strong, 95+ = expert. Do not flatter. Reward: explicit empathy, firm boundaries, concrete options, scope/money protection, and a real next step. Penalize: over-apologizing, vague reassurances, caving on substance, blame-shifting, ending without a commitment.`,
      business_development: `You are a senior BDR / business development coach evaluating an OUTBOUND COLD CALL. Be specific, fair, and direct. Cite exact moments. Score on a 0–100 scale where 70 = competent, 85 = strong, 95+ = expert. Do not flatter. A cold call is NOT a discovery call: reward earning attention fast, a specific credible reason for the call, calmly handling brush-offs, asking only enough to confirm relevance, accurately referencing the signal (job posting, referral, event conversation, site visit, form fill), and closing for a specific meeting time. Penalize: generic openers, launching into a full pitch or a full needs assessment, over-explaining, getting flustered or over-apologizing, misrepresenting the signal, and vague "let's stay in touch" closes. Do NOT penalize the rep for keeping the call short — that is correct on a cold call.`,
    };
    const systemPrompt = systemPromptByRubric[rubric];

    const userPrompt = `CALL CONFIG:
- Persona: ${config.persona}
- Difficulty: ${config.difficulty}
- Call type: ${config.callType}
- Quiz topics the consultant chose to be tested on: ${config.topics || "(none)"}

TRANSCRIPT (consultant = the SmartBug rep, prospect = the AI):
${transcript}

Evaluate the consultant on the three metrics. For technical_delivery, focus on whether they accurately explained the listed quiz topics. For consultant_confidence, infer from filler words ("um", "uh", "like", "you know"), hedging language, and pacing inferred from sentence length — note in your rationale that this is transcript-based.`;

    const userPromptWithExtras = `${userPrompt}

Also evaluate two additional skills:
- agenda_setting: Was a clear agenda established early in the call? Score based on whether the conversation had a clear, mutually-understood structure — NOT on who said it first.
  • If the consultant proactively set the agenda ("I've got about X minutes — I want to cover A, B, C — sound good?"): 90+.
  • If the PROSPECT clearly laid out what they wanted to cover and the consultant went along with it (the agenda is clear, even though the prospect drove it): that's fine — score 85+. Do NOT penalize the consultant for this.
  • If the prospect jumped straight into the discussion WITHOUT laying out a clear agenda, and the consultant ALSO failed to take control and set one: that's the coaching gap — score 40–60 and call out in 'notes' that the consultant should have stepped in to frame the call.
  • If no agenda was established at all and the call wandered: 0–30.
- active_listening: Did the consultant paraphrase or repeat back what the prospect said before responding (e.g. "So what I'm hearing is…", "Just to make sure I understand, you're saying…")? Score based on how often and how accurately they reflected the prospect's actual words / pain back to them. Cite 1–3 short examples (or note their absence) in the examples array.
- next_steps: Did the consultant clearly land a next step before the call ended? The gold standard is offering 2+ specific date/time options for a follow-up meeting. Even if the prospect declined to schedule, the consultant should still have proposed concrete times (e.g. "How about Tuesday at 2pm or Thursday morning?"). Score 95+ if a meeting was actually scheduled, 80–90 if specific times were offered but not booked, 50–70 if a vague next step was discussed ("I'll send something over"), 0–30 if no next step was raised at all. Set 'offered_times' true if specific dates/times were proposed. Set 'secured_meeting' true only if the prospect agreed to a specific time.`;

    const toughUserPrompt = `CALL CONFIG:
- Tough conversation type: ${config.situationLabel ?? "(unspecified)"}
- Persona: ${config.persona}
- Practice area: ${config.practiceArea}
- Target call length: ${config.durationMin} min

TRANSCRIPT (consultant = the firm's rep, client = the AI):
${transcript}

Score the consultant on these five tough-conversation metrics. For each, give a 0–100 score and direct notes citing specific moments:
- empathy: Did the consultant explicitly acknowledge the client's situation/feelings BEFORE pitching a fix? Bonus for paraphrasing the client's concern back. Penalize jumping to solutions or minimizing.
- firmness: Did the consultant hold a clear, specific boundary (on scope, money, timeline, behavior, etc.) without becoming hostile or flinching into vague apologies?
- options_offered: Did they present 2+ concrete options or a clear trade-off, instead of a single take-it-or-leave-it answer or a vague "we'll figure it out"?
- scope_money_protected: Did they protect the firm's scope, hours, rate, and timeline integrity? Penalize giving away free work, caving on rate, or absorbing rework caused by the client.
- next_step: Did they land a specific commitment with a date/owner before the call ended? Vague "we'll follow up" = 30–50. Concrete commitment = 85+.

Then provide:
- corrective_feedback: 2–4 specific, actionable improvements with quoted moments where possible.
- wins: 2–4 things they did well, with quotes.
- summary: 2–3 sentence overall read.`;

    const serviceKickoffUserPrompt = `CALL CONFIG:
- Persona: ${config.persona}
- Practice area: ${config.practiceArea}
- Target call length: ${config.durationMin} min
- Topics in focus: ${config.topics || "(none)"}

TRANSCRIPT (consultant = the firm's rep, client = the AI):
${transcript}

Score the consultant on these five service-kickoff metrics. For each, 0–100 score and direct notes with cited moments:
- expectation_setting: Did the rep set clear, realistic expectations about what happens, by when, and what success looks like? Penalize over-promising to please the client.
- scope_clarity: Did the rep clearly establish what is in and out of scope without sounding defensive?
- value_translation: Did the rep translate the work into business value the client can repeat to their own leadership, rather than describing tasks?
- delivery_confidence: Did the rep sound assured and in control of the engagement? Infer from filler words and hedging — note this is transcript-based.
- next_step: Did the rep land a specific, concrete next step with an owner and timeframe? Vague = 30–50, concrete = 85+.

Then provide corrective_feedback (2–4), wins (2–4), and a 2–3 sentence summary.`;

    const scopeExpansionUserPrompt = `CALL CONFIG:
- Persona: ${config.persona}
- Practice area: ${config.practiceArea}
- Target call length: ${config.durationMin} min
- Topics in focus: ${config.topics || "(none)"}

TRANSCRIPT (consultant = the firm's rep, client = the AI):
${transcript}

Score the consultant on these five scope-protection / expansion metrics. For each, 0–100 score and direct notes with cited moments:
- holding_scope: Did the rep protect the SOW/hours/rate without caving and without going cold? For expansion scenarios where scope-holding doesn't apply, score whether they avoided giving away free work or strategy.
- spotting_the_opportunity: Did the rep recognize the moment — either the scope-creep pattern that needed naming, or the expansion signal that opened a door?
- materializing_it: Did the rep convert the moment into something real — a scoped change order, a properly scoped next engagement, or a clear paid path — rather than a vague "let's talk later" or a freebie?
- relationship_warmth: Did the rep stay warm and consultative while doing the uncomfortable thing? Penalize rigidity, nickel-and-diming tone, or transactional coldness.
- next_step: Did the rep land a specific, concrete next step? Vague = 30–50, concrete = 85+.

IMPORTANT EVALUATION RULES FOR THIS RUBRIC:
- This is an improvised roleplay. The consultant does not have a real SOW, account history, or rates in front of them. Do NOT penalize them for not citing specific account data, real ROI figures, or documented initiatives. Reward how they handle the moment, not whether they recalled real numbers.
- Distinguish carefully between scope protection and expansion. A client who declines to pay a premium for low-value work in order to protect budget for high-value work is a scope-protection WIN, not a missed expansion. Do not score the consultant down for "missing an expansion signal" when the client was actually choosing to protect or reprioritize their existing scope. Only flag a missed expansion when there was a genuine, unaddressed opening to grow the engagement.
- Read the client's stated preferences accurately. If the client says they would rather NOT pay a premium for a given type of work, do not record that as the client wanting to pay a premium. Quote the client accurately in your feedback.

Then provide corrective_feedback (2–4), wins (2–4), and a 2–3 sentence summary.`;

    // Helper: build a 5-dimension tool whose dimensions map in fixed order
    // to the standard Evaluation slots (sales_strategy, technical_delivery,
    // consultant_confidence, agenda_setting, next_steps).
    const buildFiveDimensionTool = (toolName: string, dims: string[]) => {
      const scoreNotes = {
        type: "object",
        properties: { score: { type: "number" }, notes: { type: "string" } },
        required: ["score", "notes"],
        additionalProperties: false,
      } as const;
      const properties: Record<string, unknown> = {};
      for (const d of dims) properties[d] = scoreNotes;
      properties.corrective_feedback = { type: "array", items: { type: "string" } };
      properties.wins = { type: "array", items: { type: "string" } };
      properties.summary = { type: "string" };
      return {
        type: "function",
        function: {
          name: toolName,
          description: "Return the structured five-dimension evaluation.",
          parameters: {
            type: "object",
            properties,
            required: [...dims, "corrective_feedback", "wins", "summary"],
            additionalProperties: false,
          },
        },
      };
    };

    const FIVE_DIM_RUBRICS = {
      service_kickoff: [
        "expectation_setting",
        "scope_clarity",
        "value_translation",
        "delivery_confidence",
        "next_step",
      ],
      scope_expansion: [
        "holding_scope",
        "spotting_the_opportunity",
        "materializing_it",
        "relationship_warmth",
        "next_step",
      ],
      tough_recovery: [
        "empathy",
        "options_offered",
        "firmness",
        "scope_money_protected",
        "next_step",
      ],
    } as const;

    const tool = {
      type: "function",
      function: {
        name: "submit_evaluation",
        description: "Return the structured evaluation of the consultant's call.",
        parameters: {
          type: "object",
          properties: {
            sales_strategy: {
              type: "object",
              properties: {
                score: { type: "number" },
                notes: { type: "string" },
              },
              required: ["score", "notes"],
              additionalProperties: false,
            },
            technical_delivery: {
              type: "object",
              properties: {
                score: { type: "number" },
                notes: { type: "string" },
                topics_covered: { type: "array", items: { type: "string" } },
                topics_missed: { type: "array", items: { type: "string" } },
              },
              required: ["score", "notes", "topics_covered", "topics_missed"],
              additionalProperties: false,
            },
            consultant_confidence: {
              type: "object",
              properties: {
                score: { type: "number" },
                notes: { type: "string" },
                filler_words: { type: "array", items: { type: "string" } },
                pacing: { type: "string", enum: ["slow", "good", "rushed"] },
              },
              required: ["score", "notes", "filler_words", "pacing"],
              additionalProperties: false,
            },
            agenda_setting: {
              type: "object",
              properties: {
                score: { type: "number" },
                notes: { type: "string" },
              },
              required: ["score", "notes"],
              additionalProperties: false,
            },
            active_listening: {
              type: "object",
              properties: {
                score: { type: "number" },
                notes: { type: "string" },
                examples: { type: "array", items: { type: "string" } },
              },
              required: ["score", "notes", "examples"],
              additionalProperties: false,
            },
            next_steps: {
              type: "object",
              properties: {
                score: { type: "number" },
                notes: { type: "string" },
                offered_times: { type: "boolean" },
                secured_meeting: { type: "boolean" },
              },
              required: ["score", "notes", "offered_times", "secured_meeting"],
              additionalProperties: false,
            },
            corrective_feedback: { type: "array", items: { type: "string" } },
            wins: { type: "array", items: { type: "string" } },
            summary: { type: "string" },
          },
          required: [
            "sales_strategy",
            "technical_delivery",
            "consultant_confidence",
            "agenda_setting",
            "active_listening",
            "next_steps",
            "corrective_feedback",
            "wins",
            "summary",
          ],
          additionalProperties: false,
        },
      },
    };

    const isFiveDim = !isSalesDiscovery;
    const fiveDimDims = isFiveDim ? FIVE_DIM_RUBRICS[rubric as keyof typeof FIVE_DIM_RUBRICS] : null;
    const fiveDimTool = isFiveDim
      ? buildFiveDimensionTool(`submit_${rubric}_evaluation`, fiveDimDims as unknown as string[])
      : null;
    const fiveDimUserPrompt =
      rubric === "service_kickoff"
        ? serviceKickoffUserPrompt
        : rubric === "scope_expansion"
        ? scopeExpansionUserPrompt
        : toughUserPrompt;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: isSalesDiscovery ? userPromptWithExtras : fiveDimUserPrompt },
        ],
        tools: [isSalesDiscovery ? tool : (fiveDimTool as unknown)],
        tool_choice: {
          type: "function",
          function: {
            name: isSalesDiscovery ? "submit_evaluation" : `submit_${rubric}_evaluation`,
          },
        },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit reached. Try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await response.text();
      console.error("eval gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) throw new Error("No tool call in response");
    const raw = JSON.parse(call.function.arguments);

    // For five-dimension rubrics, map the dimensions in fixed order into the
    // standard Evaluation shape so the existing Report renders. Report uses
    // config.rubric to relabel the slots.
    let evaluation: unknown = raw;
    if (isFiveDim && fiveDimDims) {
      const [d1, d2, d3, d4, d5] = fiveDimDims;
      evaluation = {
        sales_strategy: raw[d1],
        technical_delivery: {
          score: raw[d2].score,
          notes: raw[d2].notes,
          topics_covered: [],
          topics_missed: [],
        },
        consultant_confidence: {
          score: raw[d3].score,
          notes: raw[d3].notes,
          filler_words: [],
          pacing: "good",
        },
        agenda_setting: raw[d4],
        next_steps: {
          score: raw[d5].score,
          notes: raw[d5].notes,
          offered_times: false,
          secured_meeting: false,
        },
        corrective_feedback: raw.corrective_feedback,
        wins: raw.wins,
        summary: raw.summary,
      };
    }

    return new Response(JSON.stringify({ evaluation }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("evaluate error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});