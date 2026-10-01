const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Gemini 2.5 Pro TTS voices. Existing callers pass legacy ElevenLabs/OpenAI
// voice IDs; map them by the gender they represented.
const FEMALE_VOICE = "Kore"; // warm, natural female
const MALE_VOICE = "Charon"; // deep, natural male

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
]);

const GEMINI_VOICES = new Set([
  "Kore", "Charon", "Puck", "Fenrir", "Aoede", "Leda", "Orus", "Zephyr",
  "Callirrhoe", "Achernar", "Sulafat", "Vindemiatrix", "Sadachbia",
  "Sadaltager", "Zubenelgenubi", "Algenib", "Rasalgethi", "Laomedeia",
  "Achird", "Alnilam", "Schedar", "Gacrux", "Pulcherrima", "Algieba",
  "Despina", "Erinome", "Enceladus", "Iapetus", "Umbriel", "Autonoe",
]);

const voiceForRequest = (voiceId?: string) => {
  if (voiceId && GEMINI_VOICES.has(voiceId)) return voiceId;
  if (voiceId && MALE_LEGACY_IDS.has(voiceId)) return MALE_VOICE;
  return FEMALE_VOICE;
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
          model: "google/gemini-2.5-pro-tts",
          contents: [
            {
              parts: [
                {
                  text: `Say this naturally, like a real person on a phone call — conversational, warm but professional, with realistic pacing: ${text}`,
                },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voiceForRequest(voiceId) },
              },
            },
          },
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

    const contentType = resp.headers.get("Content-Type") || "audio/wav";
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
