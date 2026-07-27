const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const OPENAI_VOICES = new Set([
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "nova",
  "onyx",
  "sage",
  "shimmer",
]);

const voiceForRequest = (voiceId?: string) => {
  if (voiceId && OPENAI_VOICES.has(voiceId)) return voiceId;

  // Existing callers pass ElevenLabs voice IDs. Map the common app defaults to
  // Lovable AI voices so exhausted ElevenLabs quota can no longer break calls.
  const elevenLabsVoiceMap: Record<string, string> = {
    EXAVITQu4vr4xnSDxMaL: "nova", // Sarah
    FGY2WhTYpPnrIDTdsKH5: "coral", // Laura
    Xb7hH8MSUJpSbSDYk0k2: "shimmer", // Alice
    pFZP5JQG7iQjIQuC4Bku: "sage", // Lily
    JBFqnCBsd6RMkjVDRZzb: "onyx", // George
    CwhRBWXzGAHq8TQ4Fs17: "echo", // Roger
    IKne3meq5aSn9XLyUdCD: "ash", // Charlie
    TX3LPaxmHKxFdv7VOQHJ: "fable", // Liam
  };

  return voiceId ? elevenLabsVoiceMap[voiceId] || "nova" : "nova";
};

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
          response_format: "mp3",
          instructions: "Natural, conversational sales roleplay voice. Keep the delivery realistic and concise.",
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
        "Content-Type": "audio/mpeg",
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