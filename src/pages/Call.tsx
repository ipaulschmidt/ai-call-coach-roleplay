import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, MicOff, PhoneOff, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useSession, type Turn } from "@/lib/session";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

type Status = "idle" | "listening" | "thinking" | "speaking";

// Web Speech API typings (kept loose)
const SpeechRecognitionImpl: any =
  typeof window !== "undefined"
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  // Prefer en-US natural voices
  const preferred = [
    "Google US English",
    "Samantha",
    "Microsoft Aria Online (Natural) - English (United States)",
    "Microsoft Jenny Online (Natural) - English (United States)",
  ];
  for (const name of preferred) {
    const v = voices.find((x) => x.name === name);
    if (v) return v;
  }
  return voices.find((v) => v.lang?.startsWith("en")) ?? voices[0];
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

  const recognitionRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const transcriptRef = useRef<Turn[]>(transcript);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const greetedRef = useRef(false);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    if (!config) {
      navigate("/");
      return;
    }
    setSupportsSTT(!!SpeechRecognitionImpl);
    // warm voices
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
    return () => {
      cleanupAudio();
      cleanupSTT();
      window.speechSynthesis?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript, interim]);

  // Auto-greet when call opens
  useEffect(() => {
    if (!config || greetedRef.current) return;
    greetedRef.current = true;
    void sendToAI([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const cleanupSTT = () => {
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

  const startMeter = async () => {
    if (audioCtxRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
      }, 1200);
    };
    rec.onerror = (e: any) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      console.error("STT error:", e.error);
    };
    rec.onend = () => {
      // Auto-restart if still listening
      if (status === "listening" && recognitionRef.current === rec) {
        try {
          rec.start();
        } catch {}
      }
    };
    recognitionRef.current = rec;
    try {
      rec.start();
      setStatus("listening");
    } catch {}
  }, [setTranscript, status]);

  const stopListening = () => {
    cleanupSTT();
  };

  const sendToAI = async (history: Turn[]) => {
    if (!config) return;
    setStatus("thinking");
    stopListening();

    const placeholder: Turn = { role: "assistant", content: "" };
    let working = [...history, placeholder];
    setTranscript(working);

    let assistantText = "";
    let spokenUpTo = 0;
    let firstChunk = true;
    const speak = (text: string) => {
      if (!text.trim()) return;
      const u = new SpeechSynthesisUtterance(text);
      const v = pickVoice();
      if (v) u.voice = v;
      u.rate = 1.0;
      u.pitch = 1.0;
      window.speechSynthesis.speak(u);
    };

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: history, config }),
      });

      if (!resp.ok || !resp.body) {
        const data = await resp.json().catch(() => ({}));
        toast.error(data.error || `AI error (${resp.status})`);
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
        if (d) break;
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
              // Speak in sentence chunks for natural delivery
              const m = assistantText.slice(spokenUpTo).match(/^[\s\S]*?[.!?]\s/);
              if (m) {
                speak(assistantText.slice(spokenUpTo, spokenUpTo + m[0].length));
                spokenUpTo += m[0].length;
              }
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      // Flush any remaining text
      if (assistantText.length > spokenUpTo) {
        speak(assistantText.slice(spokenUpTo));
      }

      // Wait for TTS to finish, then resume listening
      const waitForSpeech = () =>
        new Promise<void>((resolve) => {
          const check = () => {
            if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
              resolve();
            } else {
              setTimeout(check, 200);
            }
          };
          check();
        });
      await waitForSpeech();
      setStatus("idle");
      if (!muted && supportsSTT) void startListening();
    } catch (e) {
      console.error(e);
      toast.error("Connection lost. Try again.");
      setStatus("idle");
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
    window.speechSynthesis.cancel();
    cleanupSTT();
    cleanupAudio();
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
          <Button variant="destructive" onClick={endCall} className="gap-2">
            <PhoneOff className="h-4 w-4" /> End call
          </Button>
        </div>

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