import { useState, useRef, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Mic, Sparkles, Target, CheckCircle2, XCircle, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  PERSONAS_BY_AREA,
  PRACTICE_AREAS,
  DURATION_OPTIONS,
  buildGoal,
  pickScenario,
  useSession,
  type CallType,
  type Difficulty,
  type PracticeArea,
} from "@/lib/session";
import logo from "@/assets/smartbug-logo.png";

const DIFFICULTIES: { id: Difficulty; label: string; desc: string }[] = [
  { id: "easy", label: "Easy", desc: "Friendly, curious prospect" },
  { id: "realistic", label: "Realistic", desc: "Polite skeptic, real-world flow" },
  { id: "hard", label: "Hard", desc: "Tough objections, expert pushback" },
];

const CALL_TYPES: { id: CallType; label: string }[] = [
  { id: "discovery", label: "Discovery" },
  { id: "service", label: "Service / Onboarding" },
];

const Index = () => {
  const navigate = useNavigate();
  const { setConfig, reset } = useSession();
  const [practiceArea, setPracticeArea] = useState<PracticeArea>("hubspot");
  const personas = useMemo(() => PERSONAS_BY_AREA[practiceArea], [practiceArea]);
  const [topics, setTopics] = useState("");
  const [consultantName, setConsultantName] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("realistic");
  const [personaId, setPersonaId] = useState<string>(personas[0].id);
  const [callType, setCallType] = useState<CallType>("discovery");
  const [durationMin, setDurationMin] = useState<number>(10);
  const [micTest, setMicTest] = useState<{
    status: "idle" | "testing" | "ok" | "fail";
    heard?: string;
    error?: string;
  }>({ status: "idle" });
  const recRef = useRef<any>(null);

  const handleAreaChange = (id: PracticeArea) => {
    setPracticeArea(id);
    setPersonaId(PERSONAS_BY_AREA[id][0].id);
    setTopics("");
  };

  const runMicTest = async () => {
    const Impl: any =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Impl) {
      setMicTest({ status: "fail", error: "Your browser doesn't support speech recognition. Use Chrome or Edge." });
      return;
    }
    setMicTest({ status: "testing" });
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setMicTest({ status: "fail", error: "Mic permission denied. Allow it in the browser address bar and retry." });
      return;
    }

    const rec = new Impl();
    recRef.current = rec;
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";
    let heard = "";
    let settled = false;

    const finish = (result: typeof micTest) => {
      if (settled) return;
      settled = true;
      try { rec.stop(); } catch {}
      stream?.getTracks().forEach((t) => t.stop());
      setMicTest(result);
      if (result.status === "ok") toast.success(`Heard: "${result.heard}"`);
      else if (result.status === "fail") toast.error(result.error || "Mic test failed");
    };

    rec.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) heard += e.results[i][0].transcript;
    };
    rec.onerror = (e: any) => {
      if (e.error === "service-not-allowed" || e.error === "not-allowed") {
        finish({ status: "fail", error: "Mic blocked in this preview frame. Open the preview in a new tab (↗) and retry." });
      } else if (e.error === "no-speech") {
        finish({ status: "fail", error: "Didn't hear anything. Try again and speak clearly." });
      } else {
        finish({ status: "fail", error: `Speech error: ${e.error}` });
      }
    };
    rec.onend = () => {
      const text = heard.trim();
      if (text) finish({ status: "ok", heard: text });
      else finish({ status: "fail", error: "Didn't catch any words. Try again." });
    };

    try { rec.start(); } catch {
      finish({ status: "fail", error: "Couldn't start mic. Try again." });
      return;
    }
    setTimeout(() => { try { rec.stop(); } catch {} }, 2000);
  };

  const start = () => {
    const persona = personas.find((p) => p.id === personaId)!;
    reset();
    const finalTopics = topics.trim();
    setConfig({
      topics: finalTopics,
      difficulty,
      persona: `${persona.name} — ${persona.role}. ${persona.blurb}`,
      callType,
      practiceArea,
      durationMin,
      goal: buildGoal(practiceArea, callType, finalTopics, durationMin),
      scenario: pickScenario(practiceArea),
    });
    // Stash consultant name for Report to persist
    sessionStorage.setItem("consultantName", consultantName.trim());
    navigate("/call");
  };

  const currentArea = PRACTICE_AREAS.find((a) => a.id === practiceArea)!;

  return (
    <main className="min-h-screen px-4 py-10 md:py-16">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <img src={logo} alt="SmartBug" className="h-7 md:h-8" />
          <Link to="/admin" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <Lock className="h-3.5 w-3.5" /> Admin
          </Link>
        </div>
        <header className="mb-10 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            SmartBug · Consultant Mode
          </div>
          <h1 className="text-balance text-4xl font-bold tracking-tight md:text-6xl" style={{ fontFamily: "'Space Grotesk', Inter, sans-serif" }}>
            SmartBug <span className="text-primary">Coach</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-balance text-base text-muted-foreground md:text-lg">
            Roleplay HubSpot, Paid Media, and Globalia discovery & service calls against an AI prospect. Get scored on strategy, technical accuracy, and confidence.
          </p>
        </header>

        <Card className="space-y-8 border-border/60 bg-card/70 p-6 shadow-elevated backdrop-blur md:p-8">
          <section>
            <Label className="mb-3 block text-sm font-semibold">Practice area</Label>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {PRACTICE_AREAS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => handleAreaChange(a.id)}
                  className={`rounded-lg border p-4 text-left transition-all ${
                    practiceArea === a.id
                      ? "border-primary bg-primary/10 ring-1 ring-primary"
                      : "border-border/60 bg-background/40 hover:border-border"
                  }`}
                >
                  <div className="text-sm font-semibold">{a.label}</div>
                  <div className="mt-1 text-xs text-muted-foreground line-clamp-3">{a.tagline}</div>
                </button>
              ))}
            </div>
          </section>

          <section>
            <Label htmlFor="topics" className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Target className="h-4 w-4 text-primary" /> Quiz me on…
            </Label>
            <Textarea
              id="topics"
              value={topics}
              onChange={(e) => setTopics(e.target.value)}
              placeholder={currentArea.defaultTopics}
              className="min-h-[110px] resize-none border-border/70 bg-background/50 text-base"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              List specific tactics, tools, or services. The prospect will probe your knowledge of these. Leave blank to use defaults for {currentArea.label}.
            </p>
          </section>

          <section>
            <Label htmlFor="name" className="mb-2 block text-sm font-semibold">Your name (optional)</Label>
            <Input
              id="name"
              value={consultantName}
              onChange={(e) => setConsultantName(e.target.value)}
              placeholder="So admins can see who ran this call"
              className="bg-background/50"
            />
          </section>

          <section>
            <Label className="mb-3 block text-sm font-semibold">Difficulty</Label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDifficulty(d.id)}
                  className={`rounded-lg border p-4 text-left transition-all ${
                    difficulty === d.id
                      ? "border-primary bg-primary/10 ring-1 ring-primary"
                      : "border-border/60 bg-background/40 hover:border-border"
                  }`}
                >
                  <div className="font-semibold">{d.label}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{d.desc}</div>
                </button>
              ))}
            </div>
          </section>

          <section>
            <Label className="mb-3 block text-sm font-semibold">Prospect persona</Label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {personas.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPersonaId(p.id)}
                  className={`rounded-lg border p-4 text-left transition-all ${
                    personaId === p.id
                      ? "border-primary bg-primary/10 ring-1 ring-primary"
                      : "border-border/60 bg-background/40 hover:border-border"
                  }`}
                >
                  <div className="text-sm font-semibold">{p.name}</div>
                  <div className="text-xs text-primary">{p.role}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{p.blurb}</div>
                </button>
              ))}
            </div>
          </section>

          <section>
            <Label className="mb-3 block text-sm font-semibold">Call type</Label>
            <div className="flex flex-wrap gap-2">
              {CALL_TYPES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCallType(c.id)}
                  className={`rounded-full border px-4 py-1.5 text-sm transition-all ${
                    callType === c.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border/60 bg-background/40 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </section>

          <section>
            <Label className="mb-3 block text-sm font-semibold">Roleplay length</Label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {DURATION_OPTIONS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setDurationMin(d.value)}
                  className={`rounded-lg border p-3 text-left transition-all ${
                    durationMin === d.value
                      ? "border-primary bg-primary/10 ring-1 ring-primary"
                      : "border-border/60 bg-background/40 hover:border-border"
                  }`}
                >
                  <div className="text-sm font-semibold">{d.label}</div>
                  <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{d.desc}</div>
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Industry best practice for sales roleplays is 5–10 min. The prospect will start wrapping up as time runs out.
            </p>
          </section>

          <Button
            onClick={start}
            size="lg"
            className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90 glow"
          >
            <Mic className="h-5 w-5" />
            Continue
          </Button>

          <div className="rounded-lg border border-border/60 bg-background/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Mic check</div>
                <div className="text-xs text-muted-foreground">Records 2 seconds and confirms speech recognition is working.</div>
              </div>
              <Button type="button" variant="secondary" onClick={runMicTest} disabled={micTest.status === "testing"} className="gap-2 shrink-0">
                {micTest.status === "testing" ? (<><Loader2 className="h-4 w-4 animate-spin" /> Listening…</>) : (<><Mic className="h-4 w-4" /> Test mic</>)}
              </Button>
            </div>
            {micTest.status === "ok" && (
              <div className="mt-3 flex items-start gap-2 rounded-md border border-primary/40 bg-primary/10 p-2 text-xs">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>Mic works. Heard: <span className="font-medium">"{micTest.heard}"</span></span>
              </div>
            )}
            {micTest.status === "fail" && (
              <div className="mt-3 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <span>{micTest.error}</span>
              </div>
            )}
          </div>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">Voice powered by your browser. Best in Chrome or Edge. Mic permission required.</p>

        <section className="mt-16">
          <h2 className="mb-6 text-center text-2xl font-bold tracking-tight md:text-3xl" style={{ fontFamily: "'Space Grotesk', Inter, sans-serif" }}>
            Frequently asked questions
          </h2>
          <Card className="border-border/60 bg-card/70 p-2 backdrop-blur md:p-4">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="discovery-vs-service">
                <AccordionTrigger className="text-left">
                  What's the difference between a Discovery call and a Service / Onboarding call?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  <p className="mb-3">
                    <span className="font-semibold text-foreground">Discovery</span> is a pre-sale conversation with a prospect who hasn't bought yet. Your job is to diagnose their business problem, qualify fit, uncover budget / timeline / decision process, and earn the right to propose a solution. The prospect is skeptical, comparing options, and pushing back on value. Success looks like: clear pain identified, mutual next step booked, and you've avoided pitching features too early.
                  </p>
                  <p>
                    <span className="font-semibold text-foreground">Service / Onboarding</span> happens after the deal is signed. The client has already bought — now you're kicking off the engagement, aligning on goals, setting expectations, gathering access, and building the project plan. The tone is collaborative, not persuasive. Success looks like: scope confirmed, stakeholders mapped, timeline agreed, and the client feels confident in the roadmap. You're managing a relationship, not winning one.
                  </p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="how-scoring-works">
                <AccordionTrigger className="text-left">How does scoring work?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  After you end the call, the AI evaluates your transcript on strategy, technical accuracy, and confidence — and gives you specific feedback on what to improve.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="practice-areas">
                <AccordionTrigger className="text-left">Which practice areas are supported?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  HubSpot (CRM, Marketing Hub, Sales Hub, Service Hub, Breeze AI), Paid Media (Point Success Media's PPC, paid social, programmatic), and Globalia (e-commerce, custom AI, app development, WordPress).
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="mic-tips">
                <AccordionTrigger className="text-left">Mic isn't working in the preview?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Chrome blocks mic access in embedded iframes. Open the preview in a new tab (↗ top-right) or just type your replies in the transcript box. Use headphones to avoid the prospect's voice being picked up by your mic.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Card>
        </section>
      </div>
    </main>
  );
};

export default Index;
