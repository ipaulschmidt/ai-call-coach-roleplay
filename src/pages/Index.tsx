import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, Sparkles, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PERSONAS, useSession, type CallType, type Difficulty } from "@/lib/session";

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
  const [topics, setTopics] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("realistic");
  const [personaId, setPersonaId] = useState<string>(PERSONAS[0].id);
  const [callType, setCallType] = useState<CallType>("discovery");

  const start = () => {
    const persona = PERSONAS.find((p) => p.id === personaId)!;
    reset();
    setConfig({
      topics: topics.trim(),
      difficulty,
      persona: `${persona.name} — ${persona.role}. ${persona.blurb}`,
      callType,
    });
    navigate("/call");
  };

  return (
    <main className="min-h-screen px-4 py-10 md:py-16">
      <div className="mx-auto max-w-4xl">
        <header className="mb-10 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            SmartBug · Consultant Mode
          </div>
          <h1 className="text-balance text-4xl font-bold tracking-tight md:text-6xl" style={{ fontFamily: "'Space Grotesk', Inter, sans-serif" }}>
            Hub<span className="text-primary">Coach</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-balance text-base text-muted-foreground md:text-lg">
            Roleplay HubSpot discovery and service calls against an AI prospect. Get scored on strategy, technical accuracy, and confidence.
          </p>
        </header>

        <Card className="space-y-8 border-border/60 bg-card/70 p-6 shadow-elevated backdrop-blur md:p-8">
          <section>
            <Label htmlFor="topics" className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Target className="h-4 w-4 text-primary" /> Quiz me on…
            </Label>
            <Textarea
              id="topics"
              value={topics}
              onChange={(e) => setTopics(e.target.value)}
              placeholder="e.g. The 2026 AEO Brand Visibility Dashboard, Breeze Prospecting Agents, CRM-powered prompt suggestions"
              className="min-h-[110px] resize-none border-border/70 bg-background/50 text-base"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              List specific HubSpot features or tools. The prospect will probe your knowledge of these.
            </p>
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
              {PERSONAS.map((p) => (
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

          <Button
            onClick={start}
            size="lg"
            className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90 glow"
          >
            <Mic className="h-5 w-5" />
            Start the call
          </Button>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Voice powered by your browser. Best in Chrome or Edge. Mic permission required.
        </p>
      </div>
    </main>
  );
};

export default Index;
