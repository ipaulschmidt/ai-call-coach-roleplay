import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, MicOff, PhoneOff, Send, Target, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useSession, type Turn } from "@/lib/session";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tts`;
// ElevenLabs voice id used for the prospect (Sarah - warm, natural)
const ELEVENLABS_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

type Status = "idle" | "listening" | "thinking" | "speaking";

// Web Speech API typings (kept loose)
const SpeechRecognitionImpl: any =
  typeof window !== "undefined"
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

// Pick the best available female en-US browser voice.
function pickBrowserVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const en = voices.filter((v) => v.lang?.toLowerCase().startsWith("en"));
  const preferred = [
    "Google US English",
    "Microsoft Aria",
    "Microsoft Jenny",
    "Microsoft Zira",
    "Samantha",
    "Karen",
    "Moira",
    "Tessa",
    "Victoria",
    "Allison",
    "Ava",
  ];
  for (const name of preferred) {
    const match = en.find((v) => v.name.includes(name));
    if (match) return match;
  }
  const female = en.find((v) =>
    /female|woman|aria|jenny|zira|samantha|karen|moira|tessa|victoria|allison|ava|sarah|emily|joanna/i.test(v.name)
  );
  return female || en[0] || voices[0];
}

// Wait for the voice list to populate (some browsers load it async after page load).
function waitForVoices(timeoutMs = 2500): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return resolve();
    if (window.speechSynthesis.getVoices().length > 0) return resolve();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    window.speechSynthesis.onvoiceschanged = () => finish();
    setTimeout(finish, timeoutMs);
  });
}

const Call = () => {
  const navigate = useNavigate();
  const { config, transcript, setTranscript } = useSession();

  const [status, setStatus] = useState<Status>("idle");
  const [interim, setInterim] = useState("");
  const [muted, setMuted] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [supportsSTT, setSupportsSTT] = useState(true);
  const [audioLevel, setAudioLevel] = useState(0);
  const [startedAt, setStartedAt] = useState<number>(() => Date.now());
  const [now, setNow] = useState<number>(Date.now());
  const [callStarted, setCallStarted] = useState(false);

  const recognitionRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const transcriptRef = useRef<Turn[]>(transcript);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const greetedRef = useRef(false);
  const speakingRef = useRef(false);
  const endedRef = useRef(false);
  const shouldListenRef = useRef(false);
  // Currently-playing TTS audio element so we can stop it on end-call / interrupt
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  // While true, ignore STT results (the AI is speaking — don't capture its own voice)
  const muteSTTRef = useRef(false);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    if (!config) {
      navigate("/");
      return;
    }
    setSupportsSTT(!!SpeechRecognitionImpl);
    // Warm up the voice list (some browsers populate it asynchronously)
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
    return () => {
      cleanupAudio();
      cleanupSTT();
      stopAllPlayback();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript, interim]);

  // Tick the timer every second
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const durationMs = (config?.durationMin ?? 10) * 60_000;
  const elapsedMs = now - startedAt;
  const remainingMs = Math.max(0, durationMs - elapsedMs);
  const remainingMin = Math.floor(remainingMs / 60_000);
  const remainingSec = Math.floor((remainingMs % 60_000) / 1000);
  const overtime = elapsedMs > durationMs;
  const lastTwoMin = !overtime && remainingMs <= 2 * 60_000;

  // Greeting is triggered by the user clicking "Start call" (required for browser audio autoplay)
  const handleStartCall = async () => {
    if (greetedRef.current) return;
    greetedRef.current = true;
    setCallStarted(true);
    setStartedAt(Date.now());
    // iOS Safari: kick off mic + audio playback synchronously inside the user gesture
    // so subsequent restarts work without needing another tap.
    try {
      // Pre-warm a single <audio> element that we'll reuse for every TTS playback.
      // Calling .play() inside the gesture unlocks it for the rest of the session.
      if (!audioElRef.current) {
        const a = new Audio();
        a.preload = "auto";
        (a as any).playsInline = true;
        audioElRef.current = a;
        // Fire & forget: empty src play will reject, that's fine — it still unlocks audio.
        try { a.play().catch(() => {}); } catch {}
      }
    } catch {}
    // Start mic + STT in the gesture too. Don't await before this.
    if (!muted && supportsSTT) {
      void startListening();
    }
    void sendToAI([]);
  };

  const cleanupSTT = () => {
    shouldListenRef.current = false;
    try {
      recognitionRef.current?.stop();
    } catch {}
    recognitionRef.current = null;
  };

  const cleanupAudio = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
  };

  const stopAllPlayback = () => {
    try {
      window.speechSynthesis?.cancel();
    } catch {}
    try {
      if (audioElRef.current) {
        audioElRef.current.pause();
        // Keep the element so iOS stays "unlocked" — just clear the source.
        audioElRef.current.removeAttribute("src");
        audioElRef.current.load();
      }
    } catch {}
    speakingRef.current = false;
  };

  // Speak via ElevenLabs (server-side), with a graceful fallback to the browser's
  // built-in SpeechSynthesis if the network/API call fails.
  const speakViaElevenLabs = async (text: string): Promise<void> => {
    if (!text.trim() || endedRef.current) return;
    try {
      const resp = await fetch(TTS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ text, voiceId: ELEVENLABS_VOICE_ID }),
      });
      if (!resp.ok) {
        const err = await resp.text().catch(() => "");
        console.error("TTS failed", resp.status, err);
        return speakViaBrowserFallback(text);
      }
      const blob = await resp.blob();
      if (endedRef.current) return;
      const url = URL.createObjectURL(blob);
      // Reuse the unlocked element if we have one (critical for iOS Safari).
      const audio = audioElRef.current ?? new Audio();
      audio.src = url;
      (audio as any).playsInline = true;
      audioElRef.current = audio;
      speakingRef.current = true;
      await new Promise<void>((resolve) => {
        const cleanup = () => {
          speakingRef.current = false;
          URL.revokeObjectURL(url);
          resolve();
        };
        audio.onended = cleanup;
        audio.onerror = cleanup;
        audio.play().catch((e) => {
          console.error("Audio playback error", e);
          cleanup();
        });
      });
    } catch (e) {
      console.error("TTS error", e);
      return speakViaBrowserFallback(text);
    }
  };

  const speakViaBrowserFallback = (text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!text.trim() || endedRef.current || !window.speechSynthesis) return resolve();
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        const v = pickBrowserVoice();
        if (v) utter.voice = v;
        utter.lang = v?.lang || "en-US";
        speakingRef.current = true;
        utter.onend = () => { speakingRef.current = false; resolve(); };
        utter.onerror = () => { speakingRef.current = false; resolve(); };
        window.speechSynthesis.speak(utter);
      } catch {
        speakingRef.current = false;
        resolve();
      }
    });
  };

  const startMeter = async () => {
    if (audioCtxRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        setAudioLevel(rms);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) {
      console.error(e);
      toast.error("Microphone permission denied");
    }
  };

  const startListening = useCallback(async () => {
    if (!SpeechRecognitionImpl) return;
    if (endedRef.current) return;
    await startMeter();
    if (recognitionRef.current) return;
    const rec = new SpeechRecognitionImpl();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    let finalBuffer = "";
    let silenceTimer: ReturnType<typeof setTimeout> | null = null;

    const flush = () => {
      const finalText = finalBuffer.trim();
      finalBuffer = "";
      setInterim("");
      if (!finalText) return;
      const next = [...transcriptRef.current, { role: "user" as const, content: finalText }];
      setTranscript(next);
      void sendToAI(next);
    };

    rec.onresult = (event: any) => {
      // Ignore everything while the AI is speaking so we don't transcribe its own voice
      if (muteSTTRef.current) return;
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) finalBuffer += res[0].transcript + " ";
        else interimText += res[0].transcript;
      }
      setInterim(interimText);
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        if (finalBuffer.trim()) flush();
      }, 2000);
    };
    rec.onerror = (e: any) => {
      if (e.error === "no-speech" || e.error === "aborted" || e.error === "network") return;
      console.error("STT error:", e.error);
      if (
        e.error === "not-allowed" ||
        e.error === "service-not-allowed" ||
        e.error === "audio-capture"
      ) {
        setSupportsSTT(false);
        setMuted(true);
        cleanupSTT();
        setStatus("idle");
        toast.error(
          "Mic blocked in this preview. Open the preview in a new tab (top-right ↗) or just type your replies below.",
          { duration: 8000 },
        );
      }
    };
    rec.onend = () => {
      // Auto-restart if we're supposed to keep listening (browsers stop STT after ~60s of silence)
      if (shouldListenRef.current && recognitionRef.current === rec && !endedRef.current) {
        setTimeout(() => {
          try { rec.start(); } catch {}
        }, 100);
      }
    };
    recognitionRef.current = rec;
    try {
      rec.start();
      shouldListenRef.current = true;
      setStatus("listening");
    } catch {}
  }, [setTranscript, status]);

  const stopListening = () => {
    cleanupSTT();
  };

  const sendToAI = async (history: Turn[]) => {
    if (!config) return;
    if (endedRef.current) return;
    setStatus("thinking");
    // Don't tear down the mic / STT between turns — iOS Safari can't re-acquire them
    // outside of the original user gesture. Just gate STT input while the AI talks.
    muteSTTRef.current = true;

    const placeholder: Turn = { role: "assistant", content: "" };
    let working = [...history, placeholder];
    setTranscript(working);

    let assistantText = "";
    let firstChunk = true;

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: history,
          config: {
            ...config,
            consultantName: sessionStorage.getItem("consultantName") || "",
          },
          timing: {
            elapsedMin: Math.floor(elapsedMs / 60_000),
            remainingMin: Math.ceil(remainingMs / 60_000),
            durationMin: config.durationMin,
            phase: overtime ? "wrap" : remainingMs <= 2 * 60_000 ? "closing" : remainingMs <= durationMs / 2 ? "mid" : "open",
          },
        }),
      });

      if (!resp.ok || !resp.body) {
        const data = await resp.json().catch(() => ({}));
        if (!endedRef.current) toast.error(data.error || `AI error (${resp.status})`);
        setTranscript(history);
        setStatus("idle");
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;

      while (!done) {
        const { done: d, value } = await reader.read();
        if (d || endedRef.current) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line || line.startsWith(":")) continue;
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (delta) {
              assistantText += delta;
              if (firstChunk) {
                setStatus("speaking");
                firstChunk = false;
              }
              working = [...history, { role: "assistant", content: assistantText }];
              setTranscript(working);
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      // Speak the full reply via the browser's built-in voice (free, no infra)
      if (assistantText.trim()) {
        setStatus("speaking");
        await speakViaElevenLabs(assistantText);
      }
      // Small buffer so the speaker's tail doesn't bleed back into the mic
      await new Promise((r) => setTimeout(r, 350));
      setStatus("idle");
      muteSTTRef.current = false;
      // Make sure STT is running (no-op if already alive)
      if (!muted && supportsSTT) void startListening();
    } catch (e) {
      console.error(e);
      toast.error("Connection lost. Try again.");
      setStatus("idle");
      muteSTTRef.current = false;
    }
  };

  const sendTyped = () => {
    const text = textInput.trim();
    if (!text) return;
    setTextInput("");
    const next = [...transcript, { role: "user" as const, content: text }];
    setTranscript(next);
    void sendToAI(next);
  };

  const toggleMute = () => {
    if (muted) {
      setMuted(false);
      if (status === "idle") void startListening();
    } else {
      setMuted(true);
      stopListening();
    }
  };

  const endCall = () => {
    // Hard-stop everything: TTS voice, STT recognition, mic stream, and any pending AI work
    endedRef.current = true;
    // SpeechSynthesis is a global window singleton — it survives navigation, so we must
    // explicitly and aggressively cancel it. Chrome occasionally needs cancel() to be
    // called twice (once to stop the current utterance, once to flush the queue).
    try {
      window.speechSynthesis?.cancel();
      window.speechSynthesis?.cancel();
    } catch {}
    stopAllPlayback();
    cleanupSTT();
    cleanupAudio();
    setStatus("idle");
    setInterim("");
    navigate("/report");
  };

  const orbScale =
    status === "speaking" ? 1.15 : 1 + Math.min(audioLevel * 4, 0.4);

  if (!config) return null;

  return (
    <main className="min-h-screen px-4 py-6 md:py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Live call</div>
            <div className="text-lg font-semibold">{config.persona.split(" — ")[0]}</div>
            <div className="text-sm text-muted-foreground">{config.persona.split(" — ")[1]}</div>
          </div>
          <div className="flex items-center gap-3">
            <div
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium tabular-nums ${
                overtime
                  ? "border-destructive bg-destructive/10 text-destructive"
                  : lastTwoMin
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card/60 text-muted-foreground"
              }`}
              title={`${config.durationMin} min target`}
            >
              <Clock className="h-3.5 w-3.5" />
              {overtime ? "Overtime" : `${remainingMin}:${remainingSec.toString().padStart(2, "0")}`}
            </div>
            <Button variant="destructive" onClick={endCall} className="gap-2">
              <PhoneOff className="h-4 w-4" /> End call
            </Button>
          </div>
        </div>

        <Card className="mb-6 border-primary/30 bg-primary/5 p-4 backdrop-blur">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-md bg-primary/15 p-2">
              <Target className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1">
              <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                Your goal · {config.durationMin} min target
              </div>
              <p className="text-sm leading-relaxed text-foreground/90">{config.goal}</p>
            </div>
            {!callStarted && (
              <Button onClick={handleStartCall} size="lg" className="gap-2 shrink-0">
                <Mic className="h-4 w-4" /> Start call
              </Button>
            )}
          </div>
        </Card>

        <div className="grid gap-6 md:grid-cols-[1fr_1.1fr]">
          {/* Visualizer */}
          <Card className="flex flex-col items-center justify-center gap-6 border-border/60 bg-card/60 p-8 backdrop-blur min-h-[360px]">
            <div className="relative flex h-56 w-56 items-center justify-center">
              <div
                className={`absolute inset-0 rounded-full blur-2xl transition-opacity ${
                  status === "speaking" ? "opacity-90" : "opacity-50"
                }`}
                style={{ background: "var(--gradient-orb)" }}
              />
              <div
                className="relative h-40 w-40 rounded-full transition-transform duration-150"
                style={{
                  background: "var(--gradient-orb)",
                  transform: `scale(${orbScale})`,
                  boxShadow: "var(--shadow-glow)",
                }}
              />
            </div>

            <div className="flex flex-col items-center gap-3">
              <span
                className={`rounded-full border px-4 py-1 text-xs font-medium uppercase tracking-wider ${
                  status === "listening"
                    ? "border-primary bg-primary/10 text-primary"
                    : status === "speaking"
                    ? "border-primary bg-primary text-primary-foreground"
                    : status === "thinking"
                    ? "border-border bg-muted text-muted-foreground"
                    : "border-border bg-background text-muted-foreground"
                }`}
              >
                {status === "listening" && "Listening"}
                {status === "speaking" && "Speaking"}
                {status === "thinking" && "Thinking…"}
                {status === "idle" && "Idle"}
              </span>

              <div className="flex gap-2">
                {supportsSTT && (
                  <Button onClick={toggleMute} variant={muted ? "secondary" : "default"} className="gap-2">
                    {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    {muted ? "Mic off" : "Mic on"}
                  </Button>
                )}
              </div>

              {!supportsSTT && (
                <p className="max-w-xs text-center text-xs text-muted-foreground">
                  Your browser doesn't support live speech recognition. Type your responses below.
                </p>
              )}
            </div>
          </Card>

          {/* Transcript */}
          <Card className="flex flex-col border-border/60 bg-card/60 backdrop-blur min-h-[360px] max-h-[60vh]">
            <div className="border-b border-border/60 px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground">
              Live transcript
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {transcript.length === 0 && status !== "thinking" && (
                <p className="text-sm text-muted-foreground">The prospect will speak first…</p>
              )}
              {transcript.map((t, i) => (
                <div key={i} className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                      t.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    <div className="mb-0.5 text-[10px] uppercase tracking-wider opacity-70">
                      {t.role === "user" ? "You" : "Prospect"}
                    </div>
                    {t.content || <span className="opacity-60">…</span>}
                  </div>
                </div>
              ))}
              {interim && (
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl bg-primary/40 px-4 py-2 text-sm italic text-primary-foreground">
                    {interim}
                  </div>
                </div>
              )}
              <div ref={transcriptEndRef} />
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendTyped();
              }}
              className="flex gap-2 border-t border-border/60 p-3"
            >
              <Input
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={supportsSTT ? "Or type instead…" : "Type your reply…"}
                className="bg-background/50"
              />
              <Button type="submit" size="icon" disabled={!textInput.trim() || status === "thinking"}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </main>
  );
};

export default Call;