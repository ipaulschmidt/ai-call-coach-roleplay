const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// openai/gpt-4o-mini-tts — fast, low-latency TTS (reverted from Gemini for
// quicker response times). Existing callers pass legacy ElevenLabs voice IDs
// (one stable voice per gender from src/lib/session.ts); map them to
// OpenAI voices so the prospect's voice stays consistent.
const FEMALE_VOICE = "nova";
const MALE_VOICE = "onyx";

const MALE_LEGACY_IDS = new Set([
  "JBFqnCBsd6RMkjVDRZzb", // George
  "CwhRBWXzGAHq8TQ4Fs17", // Roger
  "IKne3meq5aSn9XLyUdCD", // Charlie
  "TX3LPaxmHKxFdv7VOQHJ", // Liam
  "onyx",
  "echo",
  "ash",
  "fable",
  "ballad",
  "verse",
]);

const OPENAI_VOICES = new Set([
  "alloy", "echo", "fable", "onyx", "nova", "shimmer",
  "ash", "ballad", "coral", "sage", "verse",
]);

const voiceForRequest = (voiceId?: string) => {
  if (voiceId && OPENAI_VOICES.has(voiceId)) return voiceId;
  if (voiceId && MALE_LEGACY_IDS.has(voiceId)) return MALE_VOICE;
  // Includes the legacy female ElevenLabs ID (EXAVITQu4vr4xnSDxMaL) and any
  // unknown value — fall back to the female voice.
  return FEMALE_VOICE;
};

const INSTRUCTIONS =
  "Voice: conversational and warm but professional, like a real person on a phone call. Realistic pacing, natural inflection.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { text, voiceId } = await req.json();
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "text required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resp = await fetch(
      "https://ai.gateway.lovable.dev/v1/audio/speech",
      {
        method: "POST",
        headers: {
          "Lovable-API-Key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini-tts",
          input: text,
          voice: voiceForRequest(voiceId),
          instructions: INSTRUCTIONS,
          response_format: "mp3",
        }),
      },
    );

    if (!resp.ok) {
      const err = await resp.text();
      return new Response(
        JSON.stringify({
          error: "TTS provider request failed",
          status: resp.status,
          details: err || `TTS failed: ${resp.status}`,
        }),
        {
          status: resp.status === 402 || resp.status === 429 ? resp.status : 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const contentType = resp.headers.get("Content-Type") || "audio/mpeg";
    if (!contentType.startsWith("audio/")) {
      const body = await resp.text();
      return new Response(JSON.stringify({ error: "TTS returned a non-audio response", details: body }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const audio = await resp.arrayBuffer();
    return new Response(audio, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Content-Length": String(audio.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
