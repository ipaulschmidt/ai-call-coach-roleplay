import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Loader2, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  PERSONAS_BY_AREA,
  PRACTICE_AREAS,
  buildGoal,
  pickScenario,
  useSession,
  type CallType,
  type Difficulty,
  type PracticeArea,
} from "@/lib/session";
import { PERSONA_AVATARS } from "@/lib/personaAvatars";
import logo from "@/assets/smartbug-logo.png";

interface ScenarioRow {
  id: string;
  name: string;
  practice_area: PracticeArea;
  call_type: CallType;
  difficulty: Difficulty;
  persona: string;
  duration_minutes: number;
  topics: string | null;
  topics_distilled?: string | null;
  goal?: string | null;
  scenario?: string | null;
}

const CALL_TYPE_LABELS: Record<CallType, string> = {
  discovery: "Sales Discovery",
  service: "Service / Onboarding",
  tough: "Tough Conversation",
};

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  realistic: "Realistic",
  hard: "Hard",
};

export default function Scenario() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setConfig, reset } = useSession();

  const [loading, setLoading] = useState(true);
  const [scenario, setScenario] = useState<ScenarioRow | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [repEmail, setRepEmail] = useState("");
  const [consultantName, setConsultantName] = useState("");

  useEffect(() => {
    if (!id) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("get-scenario", {
          body: { id },
        });
        if (error) throw error;
        if (data?.error || !data?.scenario) {
          setNotFound(true);
          return;
        }
        setScenario(data.scenario as ScenarioRow);
      } catch (e: any) {
        console.error(e);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const persona = useMemo(() => {
    if (!scenario) return null;
    const list = PERSONAS_BY_AREA[scenario.practice_area] ?? [];
    return list.find((p) => scenario.persona.startsWith(p.name)) ?? null;
  }, [scenario]);

  const areaLabel = scenario
    ? PRACTICE_AREAS.find((a) => a.id === scenario.practice_area)?.label ?? scenario.practice_area
    : "";

  const start = () => {
    if (!scenario) return;
    const email = repEmail.trim();
    if (!email) return;
    reset();
    const isTough = scenario.call_type === "tough";
    const distilled = scenario.topics_distilled?.trim() ?? "";
    const raw = scenario.topics?.trim() ?? "";
    const finalTopics = distilled || raw;
    if (distilled) {
      console.log(`TOPICS FEED: using topics_distilled (${distilled.length} chars)`);
    } else {
      console.log(`TOPICS FEED: falling back to topics (${raw.length} chars)`);
    }
    setConfig({
      topics: finalTopics,
      difficulty: scenario.difficulty,
      persona: scenario.persona,
      callType: scenario.call_type,
      practiceArea: scenario.practice_area,
      durationMin: scenario.duration_minutes,
      goal: scenario.goal?.trim()
        ? scenario.goal.trim()
        : buildGoal(
            scenario.practice_area,
            isTough ? "service" : scenario.call_type,
            finalTopics,
            scenario.duration_minutes,
          ),
      scenario: scenario.scenario?.trim() || "",
      personaId: persona?.id,
      personaAvatar: persona ? PERSONA_AVATARS[persona.id] : undefined,
      repEmail: email,
      scenarioName: scenario.name,
    });
    sessionStorage.setItem("consultantName", consultantName.trim());
    sessionStorage.setItem("repEmail", email);
    sessionStorage.setItem("scenarioId", scenario.id);
    sessionStorage.setItem("scenarioName", scenario.name);
    navigate("/call");
  };

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center px-4">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </main>
    );
  }

  if (notFound || !scenario) {
    return (
      <main className="grid min-h-screen place-items-center px-4">
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-bold">Scenario not found.</h1>
          <Link to="/" className="text-sm text-primary underline underline-offset-2">
            Back to home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 md:py-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-10 flex items-center justify-between">
          <img src={logo} alt="SmartBug" className="h-7 md:h-8" />
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
            Main session builder →
          </Link>
        </div>

        <header className="mb-8">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Pre-built scenario</div>
          <h1
            className="mt-1 text-balance text-4xl font-bold tracking-tight md:text-5xl"
            style={{ fontFamily: "'Space Grotesk', Inter, sans-serif" }}
          >
            {scenario.name}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            This scenario is locked. Enter your email to start the roleplay.
          </p>
        </header>

        <Card className="border-border/60 bg-card/70 p-6 backdrop-blur">
          <div className="mb-5 flex items-start gap-4">
            {persona && (
              <img
                src={PERSONA_AVATARS[persona.id]}
                alt={persona.name}
                className="h-16 w-16 shrink-0 rounded-full object-cover ring-1 ring-border"
              />
            )}
            <div className="min-w-0">
              <div className="text-sm font-semibold">
                {persona?.name ?? scenario.persona.split(" — ")[0]}
              </div>
              <div className="text-xs text-primary">
                {persona?.role ?? ""}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {persona?.blurb ?? ""}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-lg border border-border/60 bg-background/40 p-4 text-sm md:grid-cols-4">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Practice area</div>
              <div className="mt-0.5 font-medium">{areaLabel}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Call type</div>
              <div className="mt-0.5 font-medium">{CALL_TYPE_LABELS[scenario.call_type]}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Difficulty</div>
              <div className="mt-0.5 font-medium">{DIFFICULTY_LABELS[scenario.difficulty]}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Duration</div>
              <div className="mt-0.5 font-medium">{scenario.duration_minutes} min</div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="email" className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">
                Your work email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                required
                value={repEmail}
                onChange={(e) => setRepEmail(e.target.value)}
                placeholder="Used to log this session to your HubSpot record"
                className="bg-background/50"
              />
            </div>
            <div>
              <Label htmlFor="name" className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">
                Your name (optional)
              </Label>
              <Input
                id="name"
                value={consultantName}
                onChange={(e) => setConsultantName(e.target.value)}
                placeholder="So admins can see who ran this call"
                className="bg-background/50"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              <div className="font-semibold">Ready to start?</div>
              <div className="text-xs text-muted-foreground">
                You'll be on a {scenario.duration_minutes}-minute call with{" "}
                <span className="text-primary">{persona?.name ?? "the prospect"}</span>.
              </div>
            </div>
            <Button
              onClick={start}
              size="lg"
              disabled={!repEmail.trim()}
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Start the roleplay <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
        </Card>

        <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
          <Mic className="h-3.5 w-3.5" /> Voice powered by your browser. Best in Chrome or Edge.
        </p>
      </div>
    </main>
  );
}